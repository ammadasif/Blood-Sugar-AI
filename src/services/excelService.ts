import * as XLSX from 'xlsx';
import { BloodSugarReading, ReadingType, AppSettings } from '../types';
import { analyzeReading, READING_TYPE_LABELS } from '../utils/analysis';
import {
  convertFromInternal,
  formatBloodSugar,
  formatDateDMY,
  parseFlexibleDate,
} from '../utils/conversions';
import { getDailyMatrixRows } from '../utils/matrixHelper';

export interface ExcelImportRow {
  rowNumber: number;
  date: string;
  time: string;
  sugarLevel: number;
  unit: string;
  type: ReadingType;
  typeRaw: string;
  mealInfo?: string;
  notes?: string;
  status: 'valid' | 'duplicate' | 'invalid';
  validationMessage?: string;
  parsedReading?: BloodSugarReading;
}

export interface ExcelImportResult {
  totalRows: number;
  validRows: ExcelImportRow[];
  duplicateRows: ExcelImportRow[];
  invalidRows: ExcelImportRow[];
  allPreviewRows: ExcelImportRow[];
  formatDetected: 'matrix_daily' | 'flat_list';
}

/**
 * Normalizes reading type string into canonical ReadingType
 */
export function normalizeReadingType(input: string): ReadingType {
  const clean = (input || '').trim().toLowerCase();
  if (clean.includes('fasting')) return 'fasting';
  if (clean.includes('before') || clean.includes('pre-meal') || clean.includes('pre meal')) return 'before_meal';
  if (clean.includes('1h') || clean.includes('1 hour') || clean.includes('1-hour') || clean.includes('1 hr')) return '1h_after_meal';
  if (clean.includes('2h') || clean.includes('2 hour') || clean.includes('2-hour') || clean.includes('2 hr') || clean.includes('post-meal') || clean.includes('after meal')) return '2h_after_meal';
  return 'random';
}

/**
 * Parses and validates an uploaded Excel or CSV file.
 * Automatically recognizes:
 * 1. Matrix Daily Logbook format (Date | Fasting | 2h Breakfast | 2h Lunch | 2h Dinner)
 * 2. Flat Standard format (Date | Time | Blood Sugar | Type | Notes)
 */
export async function parseExcelFile(
  file: File,
  existingReadings: BloodSugarReading[],
  settings: AppSettings
): Promise<ExcelImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  if (!workbook.SheetNames.length) {
    throw new Error('The uploaded file contains no worksheets.');
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
  });

  if (!rawData || rawData.length === 0) {
    throw new Error('The worksheet is empty.');
  }

  // Create duplicate lookup set based on date + time
  const existingSet = new Set(existingReadings.map((r) => `${r.date}#${r.time}`));
  const importedInThisBatchSet = new Set<string>();

  const allPreviewRows: ExcelImportRow[] = [];
  const validRows: ExcelImportRow[] = [];
  const duplicateRows: ExcelImportRow[] = [];
  const invalidRows: ExcelImportRow[] = [];

  // Check if columns match Daily Matrix format
  const firstRowKeys = Object.keys(rawData[0] || {}).map((k) => k.toLowerCase());
  const isMatrixFormat =
    firstRowKeys.some((k) => k.includes('fasting')) &&
    (firstRowKeys.some((k) => k.includes('breakfast')) ||
      firstRowKeys.some((k) => k.includes('lunch')) ||
      firstRowKeys.some((k) => k.includes('dinner')));

  if (isMatrixFormat) {
    // =========================================================================
    // 1. DAILY MATRIX FORMAT PARSER
    // =========================================================================
    let currentRowNum = 1;

    rawData.forEach((row) => {
      currentRowNum++;
      let dateRaw = '';
      let fastingVal: any = null;
      let breakfastVal: any = null;
      let lunchVal: any = null;
      let dinnerVal: any = null;

      for (const [key, val] of Object.entries(row)) {
        const lower = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (lower.includes('date')) {
          dateRaw = String(val).trim();
        } else if (lower.includes('fasting')) {
          fastingVal = val;
        } else if (lower.includes('breakfast')) {
          breakfastVal = val;
        } else if (lower.includes('lunch')) {
          lunchVal = val;
        } else if (lower.includes('dinner')) {
          dinnerVal = val;
        }
      }

      const parsedDate = parseFlexibleDate(dateRaw);
      // Skip legend or empty footer rows (e.g., 'Test, Range (mg/dL)', 'Fasting (8-10 hours)')
      if (!parsedDate) {
        return;
      }

      // Helper to process individual meal slot in this row
      const processSlot = (
        rawValue: any,
        slotType: ReadingType,
        slotTime: string,
        slotMeal: string | undefined,
        slotLabel: string
      ) => {
        if (rawValue === '' || rawValue === null || rawValue === undefined) {
          return;
        }

        const cleanNum = parseFloat(String(rawValue).replace(/[^0-9.]/g, ''));
        if (isNaN(cleanNum) || cleanNum <= 0) {
          return;
        }

        const lookupKey = `${parsedDate}#${slotTime}`;
        const isDuplicate = existingSet.has(lookupKey) || importedInThisBatchSet.has(lookupKey);
        if (!isDuplicate) {
          importedInThisBatchSet.add(lookupKey);
        }

        const status: 'valid' | 'duplicate' = isDuplicate ? 'duplicate' : 'valid';
        const now = Date.now();

        // Convert value to internal mg/dL if needed
        let finalMgDl = cleanNum;
        if (settings.unit === 'mmol/L' && cleanNum < 35) {
          finalMgDl = Math.round(cleanNum * 18.0182);
        }

        const reading: BloodSugarReading = {
          id: `reading_${parsedDate}_${slotTime.replace(':', '')}_${Math.random().toString(36).substring(2, 6)}`,
          date: parsedDate,
          time: slotTime,
          value: Math.round(finalMgDl),
          unitAtEntry: settings.unit,
          type: slotType,
          mealInfo: slotMeal,
          notes: slotLabel,
          createdAt: now,
          updatedAt: now,
        };

        const previewItem: ExcelImportRow = {
          rowNumber: currentRowNum,
          date: parsedDate,
          time: slotTime,
          sugarLevel: cleanNum,
          unit: settings.unit,
          type: slotType,
          typeRaw: slotLabel,
          mealInfo: slotMeal,
          notes: slotLabel,
          status,
          validationMessage: isDuplicate
            ? `Duplicate entry found on ${parsedDate} at ${slotTime}`
            : undefined,
          parsedReading: reading,
        };

        allPreviewRows.push(previewItem);
        if (status === 'valid') validRows.push(previewItem);
        else duplicateRows.push(previewItem);
      };

      // Process up to 4 readings per day row
      processSlot(fastingVal, 'fasting', '07:30', undefined, 'Fasting (Morning)');
      processSlot(breakfastVal, '2h_after_meal', '09:30', 'Breakfast', '2 Hours After Breakfast');
      processSlot(lunchVal, '2h_after_meal', '14:00', 'Lunch', '2 Hours After Lunch');
      processSlot(dinnerVal, '2h_after_meal', '21:00', 'Dinner', '2 Hours After Dinner');
    });

    return {
      totalRows: allPreviewRows.length,
      validRows,
      duplicateRows,
      invalidRows,
      allPreviewRows,
      formatDetected: 'matrix_daily',
    };
  }

  // =========================================================================
  // 2. STANDARD FLAT ROW-BY-ROW FORMAT PARSER
  // =========================================================================
  rawData.forEach((row, index) => {
    const rowNum = index + 2;

    let dateVal = '';
    let timeVal = '';
    let levelVal: any = null;
    let typeVal = '';
    let mealVal = '';
    let notesVal = '';
    let unitVal = settings.unit;

    for (const [key, val] of Object.entries(row)) {
      const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (lowerKey.includes('date')) {
        dateVal = String(val).trim();
      } else if (lowerKey.includes('time')) {
        timeVal = String(val).trim();
      } else if (
        lowerKey.includes('bloodsugar') ||
        lowerKey.includes('sugarlevel') ||
        lowerKey.includes('glucose') ||
        lowerKey.includes('reading') ||
        lowerKey.includes('level') ||
        lowerKey.includes('value')
      ) {
        levelVal = val;
      } else if (lowerKey.includes('type') || lowerKey.includes('category')) {
        typeVal = String(val).trim();
      } else if (lowerKey.includes('meal') || lowerKey.includes('food')) {
        mealVal = String(val).trim();
      } else if (lowerKey.includes('note') || lowerKey.includes('comment') || lowerKey.includes('symptom')) {
        notesVal = String(val).trim();
      } else if (lowerKey.includes('unit')) {
        unitVal = String(val).trim().toLowerCase().includes('mmol') ? 'mmol/L' : 'mg/dL';
      }
    }

    const parsedDate = parseFlexibleDate(dateVal);

    // Standardize time (HH:mm)
    let parsedTime = '';
    if (timeVal) {
      if (/^\d{1,2}:\d{2}(:\d{2})?(\s?[APap][Mm])?$/.test(timeVal)) {
        const d = new Date(`1970-01-01 ${timeVal}`);
        if (!isNaN(d.getTime())) {
          const hours = String(d.getHours()).padStart(2, '0');
          const mins = String(d.getMinutes()).padStart(2, '0');
          parsedTime = `${hours}:${mins}`;
        }
      } else {
        const match = timeVal.match(/(\d{1,2}):(\d{2})/);
        if (match) {
          parsedTime = `${match[1].padStart(2, '0')}:${match[2]}`;
        }
      }
    }
    if (!parsedTime) {
      parsedTime = '12:00';
    }

    const parsedLevel = parseFloat(String(levelVal).replace(/[^0-9.]/g, ''));
    const readingType = normalizeReadingType(typeVal);

    let status: 'valid' | 'duplicate' | 'invalid' = 'valid';
    let validationMessage = '';

    if (!parsedDate) {
      status = 'invalid';
      validationMessage = 'Missing or invalid Date format.';
    } else if (isNaN(parsedLevel) || parsedLevel <= 0 || parsedLevel > 1000) {
      status = 'invalid';
      validationMessage = 'Invalid Blood Sugar level (must be a positive number).';
    } else {
      const lookupKey = `${parsedDate}#${parsedTime}`;
      if (existingSet.has(lookupKey) || importedInThisBatchSet.has(lookupKey)) {
        status = 'duplicate';
        validationMessage = `Duplicate record found with same Date (${parsedDate}) and Time (${parsedTime}).`;
      } else {
        importedInThisBatchSet.add(lookupKey);
      }
    }

    let finalMgDl = parsedLevel;
    if (unitVal === 'mmol/L' && !isNaN(parsedLevel)) {
      finalMgDl = Math.round(parsedLevel * 18.0182);
    }

    let parsedReading: BloodSugarReading | undefined = undefined;
    if (status !== 'invalid' && parsedDate) {
      const now = Date.now();
      parsedReading = {
        id: `reading_${parsedDate}_${parsedTime.replace(':', '')}_${Math.random().toString(36).substring(2, 7)}`,
        date: parsedDate,
        time: parsedTime,
        value: Math.round(finalMgDl),
        unitAtEntry: (unitVal as any) || settings.unit,
        type: readingType,
        mealInfo: mealVal || undefined,
        notes: notesVal || undefined,
        createdAt: now,
        updatedAt: now,
      };
    }

    const previewRow: ExcelImportRow = {
      rowNumber: rowNum,
      date: parsedDate || dateVal || 'Invalid',
      time: parsedTime || timeVal || '12:00',
      sugarLevel: isNaN(parsedLevel) ? 0 : parsedLevel,
      unit: unitVal,
      type: readingType,
      typeRaw: typeVal || 'Random',
      mealInfo: mealVal,
      notes: notesVal,
      status,
      validationMessage,
      parsedReading,
    };

    allPreviewRows.push(previewRow);
    if (status === 'valid') validRows.push(previewRow);
    else if (status === 'duplicate') duplicateRows.push(previewRow);
    else invalidRows.push(previewRow);
  });

  return {
    totalRows: rawData.length,
    validRows,
    duplicateRows,
    invalidRows,
    allPreviewRows,
    formatDetected: 'flat_list',
  };
}

/**
 * EXPORT 1: Daily Matrix Format (Logbook Table) - EXACT format requested by user
 * Columns: Sr. No., Date (30-Oct-2026), Fasting (mg/dL), 2 Hours After Breakfast, 2 Hours After Lunch, 2 Hours After Dinner
 */
export function exportToDailyMatrixExcel(
  readings: BloodSugarReading[],
  settings: AppSettings,
  filenamePrefix = 'GlucoTrack_Daily_Logbook'
): void {
  const matrixRows = getDailyMatrixRows(readings, settings, 'asc');

  const excelRows = matrixRows.map((row) => ({
    'Sr. No.': row.srNo,
    'Date': row.dateDisplay,
    [`Fasting (${settings.unit})`]: row.fasting ? convertFromInternal(row.fasting.value, settings.unit) : '',
    [`2 Hours After Breakfast (${settings.unit})`]: row.breakfast ? convertFromInternal(row.breakfast.value, settings.unit) : '',
    [`2 Hours After Lunch (${settings.unit})`]: row.lunch ? convertFromInternal(row.lunch.value, settings.unit) : '',
    [`2 Hours After Dinner (${settings.unit})`]: row.dinner ? convertFromInternal(row.dinner.value, settings.unit) : '',
  }));

  // Empty separator
  excelRows.push({
    'Sr. No.': '',
    'Date': '',
    [`Fasting (${settings.unit})`]: '',
    [`2 Hours After Breakfast (${settings.unit})`]: '',
    [`2 Hours After Lunch (${settings.unit})`]: '',
    [`2 Hours After Dinner (${settings.unit})`]: '',
  } as any);

  // Range legend at bottom matching user's template
  const lowF = convertFromInternal(settings.ranges.lowThreshold, settings.unit);
  const maxF = convertFromInternal(settings.ranges.fasting.normalMax, settings.unit);
  const max2h = convertFromInternal(settings.ranges.afterMeal2h.normalMax, settings.unit);

  excelRows.push({
    'Sr. No.': 'Test',
    'Date': `Range (${settings.unit})`,
    [`Fasting (${settings.unit})`]: '',
    [`2 Hours After Breakfast (${settings.unit})`]: '',
    [`2 Hours After Lunch (${settings.unit})`]: '',
    [`2 Hours After Dinner (${settings.unit})`]: '',
  } as any);

  excelRows.push({
    'Sr. No.': 'Fasting (8–10 hours)',
    'Date': `${lowF}–${maxF}`,
    [`Fasting (${settings.unit})`]: '',
    [`2 Hours After Breakfast (${settings.unit})`]: '',
    [`2 Hours After Lunch (${settings.unit})`]: '',
    [`2 Hours After Dinner (${settings.unit})`]: '',
  } as any);

  excelRows.push({
    'Sr. No.': '2 hours after meal',
    'Date': `70–${max2h}`,
    [`Fasting (${settings.unit})`]: '',
    [`2 Hours After Breakfast (${settings.unit})`]: '',
    [`2 Hours After Lunch (${settings.unit})`]: '',
    [`2 Hours After Dinner (${settings.unit})`]: '',
  } as any);

  const worksheet = XLSX.utils.json_to_sheet(excelRows);
  worksheet['!cols'] = [
    { wch: 22 },
    { wch: 16 },
    { wch: 18 },
    { wch: 32 },
    { wch: 28 },
    { wch: 28 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily_Logbook');

  const filename = `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

/**
 * EXPORT 2: Daily Matrix Format as CSV
 */
export function exportToDailyMatrixCSV(
  readings: BloodSugarReading[],
  settings: AppSettings,
  filenamePrefix = 'GlucoTrack_Daily_Logbook'
): void {
  const matrixRows = getDailyMatrixRows(readings, settings, 'asc');

  const headers = [
    'Sr. No.',
    'Date',
    `Fasting (${settings.unit})`,
    `2 Hours After Breakfast (${settings.unit})`,
    `2 Hours After Lunch (${settings.unit})`,
    `2 Hours After Dinner (${settings.unit})`,
  ];

  const rows = matrixRows.map((r) => [
    r.srNo,
    r.dateDisplay,
    r.fasting ? convertFromInternal(r.fasting.value, settings.unit) : '',
    r.breakfast ? convertFromInternal(r.breakfast.value, settings.unit) : '',
    r.lunch ? convertFromInternal(r.lunch.value, settings.unit) : '',
    r.dinner ? convertFromInternal(r.dinner.value, settings.unit) : '',
  ].join(','));

  const lowF = convertFromInternal(settings.ranges.lowThreshold, settings.unit);
  const maxF = convertFromInternal(settings.ranges.fasting.normalMax, settings.unit);
  const max2h = convertFromInternal(settings.ranges.afterMeal2h.normalMax, settings.unit);

  const footer = [
    'Test,Range (' + settings.unit + ')',
    `Fasting (8–10 hours),${lowF}–${maxF}`,
    `2 hours after meal,70–${max2h}`,
  ];

  const content = [headers.join(','), ...rows, footer.join('\r\n')].join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * EXPORT 3: Detailed Row-by-Row Excel Export
 */
export function exportToExcel(
  readings: BloodSugarReading[],
  settings: AppSettings,
  filterDescription = 'All Readings'
): void {
  const rows = readings.map((r, index) => {
    const analysis = analyzeReading(r, settings);
    const displayValue = convertFromInternal(r.value, settings.unit);

    return {
      '#': index + 1,
      'Date': formatDateDMY(r.date),
      'Time': r.time,
      [`Blood Sugar (${settings.unit})`]: displayValue,
      'Reading Type': READING_TYPE_LABELS[r.type] || r.type,
      'Status': analysis.label,
      'Clinical Context': analysis.title,
      'Meal Information': r.mealInfo || '',
      'Notes & Symptoms': r.notes || '',
      'Comments': r.comments || '',
      'Recommendation': analysis.recommendation,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet['!cols'] = [
    { wch: 5 },
    { wch: 14 },
    { wch: 10 },
    { wch: 18 },
    { wch: 20 },
    { wch: 12 },
    { wch: 30 },
    { wch: 22 },
    { wch: 26 },
    { wch: 24 },
    { wch: 45 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Readings');

  // Summary Worksheet
  const total = readings.length;
  const fasting = readings.filter((r) => r.type === 'fasting');
  const postMeal = readings.filter((r) => r.type === '2h_after_meal' || r.type === '1h_after_meal');
  const avgFasting = fasting.length ? Math.round(fasting.reduce((s, r) => s + r.value, 0) / fasting.length) : 0;
  const avgPostMeal = postMeal.length ? Math.round(postMeal.reduce((s, r) => s + r.value, 0) / postMeal.length) : 0;

  const summaryData = [
    { 'GlucoTrack Pro': 'Personal Health Monitoring Report', 'Value': '' },
    { 'GlucoTrack Pro': 'Filter Scope', 'Value': filterDescription },
    { 'GlucoTrack Pro': 'Export Generated At', 'Value': new Date().toLocaleString() },
    { 'GlucoTrack Pro': 'Active Unit', 'Value': settings.unit },
    { 'GlucoTrack Pro': 'Total Exported Readings', 'Value': total },
    { 'GlucoTrack Pro': 'Average Fasting Blood Sugar', 'Value': avgFasting ? formatBloodSugar(avgFasting, settings.unit) : 'N/A' },
    { 'GlucoTrack Pro': 'Average Post-Meal Blood Sugar', 'Value': avgPostMeal ? formatBloodSugar(avgPostMeal, settings.unit) : 'N/A' },
    { 'GlucoTrack Pro': 'Medical Disclaimer', 'Value': 'For informational tracking only. Not a medical diagnosis.' },
  ];

  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 32 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Report Summary');

  const filename = `GlucoTrack_Readings_${filterDescription.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

/**
 * Generates and downloads the exact Daily Matrix Template requested by the user (.xlsx)
 */
export function downloadExcelTemplate(unit: 'mg/dL' | 'mmol/L' = 'mg/dL'): void {
  const isMmol = unit === 'mmol/L';
  const sampleValues = [
    { no: 1, date: '30-Oct-2026', f: 97, b: 160, l: 114, d: 134 },
    { no: 2, date: '31-Oct-2026', f: 99, b: 90, l: 124, d: 161 },
    { no: 3, date: '01-Nov-2026', f: 124, b: 104, l: 129, d: 137 },
    { no: 4, date: '02-Nov-2026', f: 109, b: 116, l: 103, d: 147 },
    { no: 5, date: '03-Nov-2026', f: 103, b: 105, l: 124, d: 154 },
    { no: 6, date: '04-Nov-2026', f: 109, b: 108, l: 112, d: 137 },
    { no: 7, date: '05-Nov-2026', f: 106, b: '', l: '', d: '' },
    { no: 8, date: '06-Nov-2026', f: 95, b: 96, l: 108, d: 107 },
    { no: 9, date: '07-Nov-2026', f: 96, b: 107, l: 108, d: 109 },
    { no: 10, date: '08-Nov-2026', f: 95, b: 99, l: 111, d: 91 },
    { no: 11, date: '09-Nov-2026', f: 97, b: '', l: 115, d: 112 },
    { no: 12, date: '10-Nov-2026', f: 94, b: '', l: 111, d: 116 },
    { no: 13, date: '11-Nov-2026', f: 98, b: '', l: 103, d: 86 },
    { no: 14, date: '12-Nov-2026', f: 99, b: '', l: 106, d: 107 },
    { no: 15, date: '13-Nov-2026', f: 94, b: '', l: 117, d: 109 },
    { no: 16, date: '14-Nov-2026', f: 108, b: '', l: '', d: '' },
    { no: 17, date: '15-Nov-2026', f: 94, b: 98, l: 114, d: '' },
  ];

  const conv = (v: number | string) => {
    if (v === '' || typeof v !== 'number') return '';
    return isMmol ? Number((v / 18.0182).toFixed(1)) : v;
  };

  const rows = sampleValues.map((s) => ({
    'Sr. No.': s.no,
    'Date': s.date,
    [`Fasting (${unit})`]: conv(s.f),
    [`2 Hours After Breakfast (${unit})`]: conv(s.b),
    [`2 Hours After Lunch (${unit})`]: conv(s.l),
    [`2 Hours After Dinner (${unit})`]: conv(s.d),
  }));

  // Separator
  rows.push({
    'Sr. No.': '',
    'Date': '',
    [`Fasting (${unit})`]: '',
    [`2 Hours After Breakfast (${unit})`]: '',
    [`2 Hours After Lunch (${unit})`]: '',
    [`2 Hours After Dinner (${unit})`]: '',
  } as any);

  // Range legend
  rows.push({
    'Sr. No.': 'Test',
    'Date': `Range (${unit})`,
    [`Fasting (${unit})`]: '',
    [`2 Hours After Breakfast (${unit})`]: '',
    [`2 Hours After Lunch (${unit})`]: '',
    [`2 Hours After Dinner (${unit})`]: '',
  } as any);

  rows.push({
    'Sr. No.': 'Fasting (8–10 hours)',
    'Date': isMmol ? '3.3–5.3' : '60–95',
    [`Fasting (${unit})`]: '',
    [`2 Hours After Breakfast (${unit})`]: '',
    [`2 Hours After Lunch (${unit})`]: '',
    [`2 Hours After Dinner (${unit})`]: '',
  } as any);

  rows.push({
    'Sr. No.': '2 hours after meal',
    'Date': isMmol ? '3.9–6.9' : '70–125',
    [`Fasting (${unit})`]: '',
    [`2 Hours After Breakfast (${unit})`]: '',
    [`2 Hours After Lunch (${unit})`]: '',
    [`2 Hours After Dinner (${unit})`]: '',
  } as any);

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 22 },
    { wch: 16 },
    { wch: 18 },
    { wch: 32 },
    { wch: 28 },
    { wch: 28 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Daily_Logbook');
  XLSX.writeFile(wb, `GlucoTrack_Daily_Logbook_Template_${unit.replace('/', '_')}.xlsx`);
}

/**
 * Generates and downloads the exact Daily Matrix Template as CSV
 */
export function downloadCSVTemplate(unit: 'mg/dL' | 'mmol/L' = 'mg/dL'): void {
  const isMmol = unit === 'mmol/L';
  const conv = (v: number | string) => {
    if (v === '' || typeof v !== 'number') return '';
    return isMmol ? (v / 18.0182).toFixed(1) : String(v);
  };

  const sampleValues = [
    { no: 1, date: '30-Oct-2026', f: 97, b: 160, l: 114, d: 134 },
    { no: 2, date: '31-Oct-2026', f: 99, b: 90, l: 124, d: 161 },
    { no: 3, date: '01-Nov-2026', f: 124, b: 104, l: 129, d: 137 },
    { no: 4, date: '02-Nov-2026', f: 109, b: 116, l: 103, d: 147 },
    { no: 5, date: '03-Nov-2026', f: 103, b: 105, l: 124, d: 154 },
    { no: 6, date: '04-Nov-2026', f: 109, b: 108, l: 112, d: 137 },
    { no: 7, date: '05-Nov-2026', f: 106, b: '', l: '', d: '' },
    { no: 8, date: '06-Nov-2026', f: 95, b: 96, l: 108, d: 107 },
    { no: 9, date: '07-Nov-2026', f: 96, b: 107, l: 108, d: 109 },
    { no: 10, date: '08-Nov-2026', f: 95, b: 99, l: 111, d: 91 },
    { no: 11, date: '09-Nov-2026', f: 97, b: '', l: 115, d: 112 },
    { no: 12, date: '10-Nov-2026', f: 94, b: '', l: 111, d: 116 },
    { no: 13, date: '11-Nov-2026', f: 98, b: '', l: 103, d: 86 },
    { no: 14, date: '12-Nov-2026', f: 99, b: '', l: 106, d: 107 },
    { no: 15, date: '13-Nov-2026', f: 94, b: '', l: 117, d: 109 },
    { no: 16, date: '14-Nov-2026', f: 108, b: '', l: '', d: '' },
    { no: 17, date: '15-Nov-2026', f: 94, b: 98, l: 114, d: '' },
  ];

  const header = `Sr. No.,Date,Fasting (${unit}),2 Hours After Breakfast (${unit}),2 Hours After Lunch (${unit}),2 Hours After Dinner (${unit})`;
  const rows = sampleValues.map(
    (s) => `${s.no},${s.date},${conv(s.f)},${conv(s.b)},${conv(s.l)},${conv(s.d)}`
  );

  const rangeHeader = `Test,Range (${unit})`;
  const fRange = `Fasting (8–10 hours),${isMmol ? '3.3–5.3' : '60–95'}`;
  const pRange = `2 hours after meal,${isMmol ? '3.9–6.9' : '70–125'}`;

  const csvContent = [header, ...rows, rangeHeader, fRange, pRange].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GlucoTrack_Daily_Logbook_Template_${unit.replace('/', '_')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
