import { BloodSugarReading, AppSettings } from '../types';
import { READING_TYPE_LABELS, analyzeReading } from '../utils/analysis';
import { convertFromInternal, formatBloodSugar, formatDate, formatTime } from '../utils/conversions';

export interface FullBackupPayload {
  version: string;
  exportedAt: string;
  source: 'GlucoTrack Pro';
  settings: AppSettings;
  readings: BloodSugarReading[];
}

/**
 * Downloads a string as a file in the browser
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a complete JSON backup
 */
export function exportJSONBackup(readings: BloodSugarReading[], settings: AppSettings): void {
  const payload: FullBackupPayload = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    source: 'GlucoTrack Pro',
    settings,
    readings,
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const dateStr = new Date().toISOString().split('T')[0];
  downloadFile(jsonString, `GlucoTrack_Backup_${dateStr}.json`, 'application/json');
}

/**
 * Parses and validates a restored JSON backup file
 */
export async function parseJSONBackup(file: File): Promise<FullBackupPayload> {
  const text = await file.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The file is not a valid JSON document.');
  }

  if (!parsed || (!Array.isArray(parsed.readings) && !Array.isArray(parsed))) {
    throw new Error('Unrecognized backup format. Missing readings array.');
  }

  const readingsList: BloodSugarReading[] = Array.isArray(parsed) ? parsed : parsed.readings;

  // Validate items
  const validReadings: BloodSugarReading[] = readingsList.filter(
    (item) => item && typeof item.value === 'number' && item.date && item.time
  );

  return {
    version: parsed.version || '1.0.0',
    exportedAt: parsed.exportedAt || new Date().toISOString(),
    source: 'GlucoTrack Pro',
    settings: parsed.settings,
    readings: validReadings,
  };
}

/**
 * Generates and downloads a CSV export of readings
 */
export function exportCSV(readings: BloodSugarReading[], settings: AppSettings): void {
  const headers = [
    'Date',
    'Time',
    `Blood Sugar (${settings.unit})`,
    'Reading Type',
    'Status',
    'Clinical Context',
    'Meal Information',
    'Notes',
    'Comments',
  ];

  const rows = readings.map((r) => {
    const analysis = analyzeReading(r, settings);
    const displayValue = convertFromInternal(r.value, settings.unit);
    const escapeCsv = (str?: string) => `"${(str || '').replace(/"/g, '""')}"`;

    return [
      r.date,
      r.time,
      displayValue,
      escapeCsv(READING_TYPE_LABELS[r.type] || r.type),
      escapeCsv(analysis.label),
      escapeCsv(analysis.title),
      escapeCsv(r.mealInfo),
      escapeCsv(r.notes),
      escapeCsv(r.comments),
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const dateStr = new Date().toISOString().split('T')[0];
  downloadFile(csvContent, `GlucoTrack_Readings_${dateStr}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Generates and downloads a human-readable Notepad / TXT log of readings
 */
export function exportTXT(readings: BloodSugarReading[], settings: AppSettings): void {
  const divider = '='.repeat(70);
  const subDivider = '-'.repeat(70);

  let content = `${divider}\r\n`;
  content += ` GLUCOTRACK PRO - PERSONAL BLOOD SUGAR LOG (TEXT BACKUP)\r\n`;
  content += ` Generated On: ${new Date().toLocaleString()}\r\n`;
  content += ` Total Readings Recorded: ${readings.length}\r\n`;
  content += ` Active Unit: ${settings.unit}\r\n`;
  content += ` Target Profile: ${settings.targetProfile.replace('_', ' ').toUpperCase()}\r\n`;
  content += `${divider}\r\n\r\n`;

  content += `MEDICAL DISCLAIMER:\r\n`;
  content += `This log is for personal reference and informational tracking only.\r\n`;
  content += `It does not constitute medical advice or a formal clinical diagnosis.\r\n`;
  content += `Always review your readings with your primary healthcare provider.\r\n\r\n`;

  content += `RECORDED READINGS HISTORY:\r\n`;
  content += `${subDivider}\r\n`;

  readings.forEach((r, idx) => {
    const analysis = analyzeReading(r, settings);
    content += `Entry #${idx + 1} | ${formatDate(r.date)} at ${formatTime(r.time)}\r\n`;
    content += `  Blood Sugar Level: ${formatBloodSugar(r.value, settings.unit)}\r\n`;
    content += `  Reading Type:      ${READING_TYPE_LABELS[r.type]}\r\n`;
    content += `  Status:            [${analysis.label}] - ${analysis.title}\r\n`;
    if (r.mealInfo) content += `  Meal Details:      ${r.mealInfo}\r\n`;
    if (r.notes) content += `  Notes / Symptoms:  ${r.notes}\r\n`;
    if (r.comments) content += `  Comments:          ${r.comments}\r\n`;
    content += `  Recommendation:    ${analysis.recommendation}\r\n`;
    content += `${subDivider}\r\n`;
  });

  const dateStr = new Date().toISOString().split('T')[0];
  downloadFile(content, `GlucoTrack_Log_${dateStr}.txt`, 'text/plain;charset=utf-8;');
}
