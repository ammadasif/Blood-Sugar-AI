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
