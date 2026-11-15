import * as XLSX from 'xlsx';
import { BloodSugarReading, ReadingType, AppSettings } from '../types';
import { analyzeReading, READING_TYPE_LABELS } from '../utils/analysis';
import { convertFromInternal, formatBloodSugar } from '../utils/conversions';

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
 * Parses and validates an uploaded Excel file (.xlsx or .xls)
 */
export async function parseExcelFile(
  file: File,
  existingReadings: BloodSugarReading[],
  settings: AppSettings
): Promise<ExcelImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  
  if (!workbook.SheetNames.length) {
    throw new Error('The uploaded Excel file contains no worksheets.');
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
  });

  if (!rawData || rawData.length === 0) {
    throw new Error('The Excel worksheet is empty.');
  }

  // Create duplicate lookup set based on date + time
  const existingSet = new Set(existingReadings.map((r) => `${r.date}#${r.time}`));
  const importedInThisBatchSet = new Set<string>();

  const allPreviewRows: ExcelImportRow[] = [];
  const validRows: ExcelImportRow[] = [];
  const duplicateRows: ExcelImportRow[] = [];
  const invalidRows: ExcelImportRow[] = [];

  rawData.forEach((row, index) => {
    const rowNum = index + 2; // +1 for 0-index, +1 for header row

    // Find columns by flexible header names
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

    // Standardize date (YYYY-MM-DD)
    let parsedDate = '';
    if (dateVal) {
      const parsedD = new Date(dateVal);
      if (!isNaN(parsedD.getTime())) {
        const y = parsedD.getFullYear();
        const m = String(parsedD.getMonth() + 1).padStart(2, '0');
        const d = String(parsedD.getDate()).padStart(2, '0');
        parsedDate = `${y}-${m}-${d}`;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
        parsedDate = dateVal;
      }
    }

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
        // Fallback or trim
        const match = timeVal.match(/(\d{1,2}):(\d{2})/);
        if (match) {
          parsedTime = `${match[1].padStart(2, '0')}:${match[2]}`;
        }
      }
    }
    if (!parsedTime) {
      parsedTime = '12:00'; // Default fallback time if missing
    }

    // Parse numeric level
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

    // Convert value to internal mg/dL if unit was mmol/L
    let finalMgDl = parsedLevel;
    if (unitVal === 'mmol/L' && !isNaN(parsedLevel)) {
      finalMgDl = Math.round(parsedLevel * 18.0182);
    }

    let parsedReading: BloodSugarReading | undefined = undefined;
    if (status !== 'invalid') {
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
  };
}

/**
 * Exports blood sugar readings to an Excel (.xlsx) file with professional formatting
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
      'Date': r.date,
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

  // Set nice column widths
  worksheet['!cols'] = [
    { wch: 5 },  // #
    { wch: 12 }, // Date
    { wch: 10 }, // Time
    { wch: 18 }, // Blood Sugar
    { wch: 20 }, // Reading Type
    { wch: 12 }, // Status
    { wch: 30 }, // Clinical Context
    { wch: 22 }, // Meal Information
    { wch: 26 }, // Notes & Symptoms
    { wch: 24 }, // Comments
    { wch: 45 }, // Recommendation
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
 * Generates and downloads a ready-to-use sample Excel Import Template (.xlsx)
 */
export function downloadExcelTemplate(unit: 'mg/dL' | 'mmol/L' = 'mg/dL'): void {
  const isMmol = unit === 'mmol/L';
  const templateRows = [
    {
      'Date': '2026-11-15',
      'Time': '07:30',
      'Blood Sugar': isMmol ? 5.2 : 94,
      'Unit': unit,
      'Reading Type': 'Fasting',
      'Meal Information': '',
      'Notes': 'Woke up well rested',
      'Comments': 'Morning baseline',
    },
    {
      'Date': '2026-11-15',
      'Time': '09:30',
      'Blood Sugar': isMmol ? 6.8 : 122,
      'Unit': unit,
      'Reading Type': '2 Hours After Meal',
      'Meal Information': 'Oatmeal with almonds & blueberries',
      'Notes': 'Felt good energy',
      'Comments': 'Post-breakfast check',
    },
    {
      'Date': '2026-11-15',
      'Time': '13:00',
      'Blood Sugar': isMmol ? 5.4 : 98,
      'Unit': unit,
      'Reading Type': 'Before Meal',
      'Meal Information': 'Pre-lunch',
      'Notes': '',
      'Comments': '',
    },
    {
      'Date': '2026-11-15',
      'Time': '15:00',
      'Blood Sugar': isMmol ? 7.6 : 138,
      'Unit': unit,
      'Reading Type': '2 Hours After Meal',
      'Meal Information': 'Grilled chicken salad with olive oil',
      'Notes': 'Light 15 min walk after lunch',
      'Comments': '',
    },
    {
      'Date': '2026-11-15',
      'Time': '22:15',
      'Blood Sugar': isMmol ? 5.8 : 105,
      'Unit': unit,
      'Reading Type': 'Random',
      'Meal Information': '',
      'Notes': 'Bedtime check',
      'Comments': 'Normal day',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateRows);

  worksheet['!cols'] = [
    { wch: 14 }, // Date
    { wch: 10 }, // Time
    { wch: 14 }, // Blood Sugar
    { wch: 10 }, // Unit
    { wch: 22 }, // Reading Type
    { wch: 35 }, // Meal Information
    { wch: 30 }, // Notes
    { wch: 25 }, // Comments
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Readings_Template');

  // Sheet 2: Column instructions & guide
  const guideRows = [
    {
      'Column Header': 'Date',
      'Required': 'YES',
      'Accepted Formats': 'YYYY-MM-DD (e.g. 2026-11-15), MM/DD/YYYY, or DD/MM/YYYY',
      'Description': 'The date the measurement was recorded.',
    },
    {
      'Column Header': 'Time',
      'Required': 'YES',
      'Accepted Formats': 'HH:mm (24-hour e.g. 07:30, 20:45) or 12-hour (7:30 AM, 8:45 PM)',
      'Description': 'The time the test was performed.',
    },
    {
      'Column Header': 'Blood Sugar',
      'Required': 'YES',
      'Accepted Formats': 'Number (e.g. 95, 120, or 5.4)',
      'Description': 'Blood glucose test numeric value.',
    },
    {
      'Column Header': 'Unit',
      'Required': 'Optional',
      'Accepted Formats': 'mg/dL or mmol/L',
      'Description': 'Unit of entry (automatically converted to internal storage).',
    },
    {
      'Column Header': 'Reading Type',
      'Required': 'YES',
      'Accepted Formats': 'Fasting, Before Meal, 1 Hour After Meal, 2 Hours After Meal, Random',
      'Description': 'Contextual category used for clinical evaluation.',
    },
    {
      'Column Header': 'Meal Information',
      'Required': 'Optional',
      'Accepted Formats': 'Free text (e.g. Oatmeal, Chicken Salad)',
      'Description': 'Food and drinks consumed before or around the test.',
    },
    {
      'Column Header': 'Notes',
      'Required': 'Optional',
      'Accepted Formats': 'Free text (e.g. 20 min walk, Felt dizzy)',
      'Description': 'Symptoms, activities, or medications.',
    },
    {
      'Column Header': 'Comments',
      'Required': 'Optional',
      'Accepted Formats': 'Free text',
      'Description': 'Additional notes for personal reference or doctor.',
    },
  ];

  const guideSheet = XLSX.utils.json_to_sheet(guideRows);
  guideSheet['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 45 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'Instructions_Guide');

  XLSX.writeFile(workbook, `GlucoTrack_Import_Template_${unit.replace('/', '_')}.xlsx`);
}

/**
 * Generates and downloads a ready-to-use CSV Import Template (.csv)
 */
export function downloadCSVTemplate(unit: 'mg/dL' | 'mmol/L' = 'mg/dL'): void {
  const isMmol = unit === 'mmol/L';
  const csvContent = [
    'Date,Time,Blood Sugar,Unit,Reading Type,Meal Information,Notes,Comments',
    `2026-11-15,07:30,${isMmol ? '5.2' : '94'},${unit},Fasting,,"Woke up well rested","Morning baseline"`,
    `2026-11-15,09:30,${isMmol ? '6.8' : '122'},${unit},2 Hours After Meal,"Oatmeal with almonds & blueberries","Felt good energy","Post-breakfast check"`,
    `2026-11-15,13:00,${isMmol ? '5.4' : '98'},${unit},Before Meal,"Pre-lunch",,`,
    `2026-11-15,15:00,${isMmol ? '7.6' : '138'},${unit},2 Hours After Meal,"Grilled chicken salad with olive oil","Light 15 min walk after lunch",`,
    `2026-11-15,22:15,${isMmol ? '5.8' : '105'},${unit},Random,,"Bedtime check","Normal day"`,
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GlucoTrack_Import_Template_${unit.replace('/', '_')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


