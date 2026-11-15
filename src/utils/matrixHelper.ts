import { BloodSugarReading, DailyMatrixRow, AppSettings } from '../types';
import { formatDateDMY, convertFromInternal } from './conversions';

/**
 * Organizes a flat list of blood sugar readings into a day-by-day matrix
 * matching the clinical logbook format:
 * Date | Fasting | 2h Breakfast | 2h Lunch | 2h Dinner | Daily Avg
 */
export function getDailyMatrixRows(
  readings: BloodSugarReading[],
  settings: AppSettings,
  sortOrder: 'desc' | 'asc' = 'desc'
): DailyMatrixRow[] {
  const map = new Map<string, {
    fasting?: BloodSugarReading;
    breakfast?: BloodSugarReading;
    lunch?: BloodSugarReading;
    dinner?: BloodSugarReading;
    other: BloodSugarReading[];
  }>();

  readings.forEach((r) => {
    if (!map.has(r.date)) {
      map.set(r.date, { other: [] });
    }
    const day = map.get(r.date)!;

    if (r.type === 'fasting') {
      if (!day.fasting) day.fasting = r;
      else day.other.push(r);
    } else if (
      r.mealInfo?.toLowerCase().includes('breakfast') ||
      (r.type === '2h_after_meal' && r.time < '11:30' && !day.breakfast)
    ) {
      if (!day.breakfast) day.breakfast = r;
      else day.other.push(r);
    } else if (
      r.mealInfo?.toLowerCase().includes('lunch') ||
      (r.type === '2h_after_meal' && r.time >= '11:30' && r.time < '17:00' && !day.lunch)
    ) {
      if (!day.lunch) day.lunch = r;
      else day.other.push(r);
    } else if (
      r.mealInfo?.toLowerCase().includes('dinner') ||
      (r.type === '2h_after_meal' && r.time >= '17:00' && !day.dinner)
    ) {
      if (!day.dinner) day.dinner = r;
      else day.other.push(r);
    } else if (r.type === 'before_meal' && !day.fasting) {
      day.fasting = r;
    } else {
      day.other.push(r);
    }
  });

  const sortedDates = Array.from(map.keys()).sort((a, b) =>
    sortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b)
  );

  return sortedDates.map((date, idx) => {
    const day = map.get(date)!;
    const allDayReadings = [day.fasting, day.breakfast, day.lunch, day.dinner, ...day.other].filter(
      (r): r is BloodSugarReading => !!r
    );

    const avgVal = allDayReadings.length
      ? Math.round(allDayReadings.reduce((sum, r) => sum + r.value, 0) / allDayReadings.length)
      : undefined;

    return {
      srNo: idx + 1,
      date,
      dateDisplay: formatDateDMY(date),
      fasting: day.fasting,
      breakfast: day.breakfast,
      lunch: day.lunch,
      dinner: day.dinner,
      otherReadings: day.other,
      averageValue: avgVal,
    };
  });
}

