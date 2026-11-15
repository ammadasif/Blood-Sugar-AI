import { BloodSugarUnit } from '../types';

export const CONVERSION_FACTOR = 18.0182; // 1 mmol/L = 18.0182 mg/dL

/**
 * Converts a mg/dL value to mmol/L rounded to 1 decimal place.
 */
export function mgDlToMmol(mgDl: number): number {
  return Number((mgDl / CONVERSION_FACTOR).toFixed(1));
}

/**
 * Converts a mmol/L value to mg/dL rounded to integer.
 */
export function mmolToMgDl(mmol: number): number {
  return Math.round(mmol * CONVERSION_FACTOR);
}

/**
 * Converts stored mg/dL value to user's selected unit.
 */
export function convertFromInternal(mgDlValue: number, targetUnit: BloodSugarUnit): number {
  if (targetUnit === 'mmol/L') {
    return mgDlToMmol(mgDlValue);
  }
  return Math.round(mgDlValue);
}

/**
 * Converts user entered value in given unit to internal mg/dL.
 */
export function convertToInternal(enteredValue: number, inputUnit: BloodSugarUnit): number {
  if (inputUnit === 'mmol/L') {
    return mmolToMgDl(enteredValue);
  }
  return Math.round(enteredValue);
}

/**
 * Formats a blood sugar value with its unit.
 */
export function formatBloodSugar(mgDlValue: number, unit: BloodSugarUnit): string {
  const converted = convertFromInternal(mgDlValue, unit);
  if (unit === 'mmol/L') {
    return `${converted.toFixed(1)} ${unit}`;
  }
  return `${converted} ${unit}`;
}

/**
 * Formats just the number according to the target unit.
 */
export function formatBloodSugarNumber(mgDlValue: number, unit: BloodSugarUnit): string {
  const converted = convertFromInternal(mgDlValue, unit);
  if (unit === 'mmol/L') {
    return converted.toFixed(1);
  }
  return converted.toString();
}

/**
 * Format date string to DD-MMM-YYYY (e.g. 30-Oct-2026)
 */
export function formatDateDMY(dateString: string): string {
  if (!dateString) return '';
  try {
    const [year, month, day] = dateString.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mIdx = parseInt(month, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      return `${day}-${monthNames[mIdx]}-${year}`;
    }
    return dateString;
  } catch {
    return dateString;
  }
}

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Parses flexible dates like "30-Oct-2026", "01-Nov-2026", "2026-10-30", "30/10/2026"
 * into canonical "YYYY-MM-DD".
 */
export function parseFlexibleDate(val: any): string | null {
  if (!val) return null;
  const str = String(val).trim();

  // 1. Check YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // 2. Check DD-MMM-YYYY or DD MMM YYYY or DD/MMM/YYYY (e.g. 30-Oct-2026)
  const dmyAlpha = str.match(/^(\d{1,2})[\s\-\/\.]([A-Za-z]{3,})[\s\-\/\.](\d{2,4})$/);
  if (dmyAlpha) {
    const day = dmyAlpha[1].padStart(2, '0');
    const mStr = dmyAlpha[2].toLowerCase();
    const mon = MONTH_MAP[mStr] || MONTH_MAP[mStr.substring(0, 3)];
    let year = dmyAlpha[3];
    if (year.length === 2) year = `20${year}`;
    if (mon) {
      return `${year}-${String(mon).padStart(2, '0')}-${day}`;
    }
  }

  // 3. Check numeric with separator DD/MM/YYYY or MM/DD/YYYY
  const dmyNum = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyNum) {
    const p1 = parseInt(dmyNum[1], 10);
    const p2 = parseInt(dmyNum[2], 10);
    let y = dmyNum[3];
    if (y.length === 2) y = `20${y}`;

    if (p1 > 12) {
      // Must be Day/Month/Year
      return `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
    } else if (p2 > 12) {
      // Must be Month/Day/Year
      return `${y}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
    } else {
      // Default assume DD/MM/YYYY
      return `${y}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
    }
  }

  // 4. Excel Serial date
  const num = Number(str);
  if (!isNaN(num) && num > 30000 && num < 70000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + num * 86400000);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }

  // 5. Native JS Date fallback
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return null;
}

/**
 * Format a date string (YYYY-MM-DD) to a human friendly format
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Format 24-hour time (HH:mm) to 12-hour AM/PM format
 */
export function formatTime(timeString: string): string {
  if (!timeString) return '';
  try {
    const [hours, minutes] = timeString.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes < 10 ? '0' : ''}${minutes} ${ampm}`;
  } catch {
    return timeString;
  }
}

/**
 * Get current local date in YYYY-MM-DD
 */
export function getCurrentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current local time in HH:mm
 */
export function getCurrentTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

