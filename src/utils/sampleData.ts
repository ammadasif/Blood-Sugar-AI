import { BloodSugarReading } from '../types';

/**
 * Pre-populates realistic blood sugar records corresponding directly
 * to the user's standard 17-day Daily Monitoring Matrix.
 */
export function generateSampleReadings(): BloodSugarReading[] {
  const readings: BloodSugarReading[] = [];

  const rawDataset = [
    { date: '2026-10-30', fasting: 97, bfast: 160, lunch: 114, dinner: 134 },
    { date: '2026-10-31', fasting: 99, bfast: 90,  lunch: 124, dinner: 161 },
    { date: '2026-11-01', fasting: 124, bfast: 104, lunch: 129, dinner: 137 },
    { date: '2026-11-02', fasting: 109, bfast: 116, lunch: 103, dinner: 147 },
    { date: '2026-11-03', fasting: 103, bfast: 105, lunch: 124, dinner: 154 },
    { date: '2026-11-04', fasting: 109, bfast: 108, lunch: 112, dinner: 137 },
    { date: '2026-11-05', fasting: 106, bfast: null, lunch: null, dinner: null },
    { date: '2026-11-06', fasting: 95,  bfast: 96,  lunch: 108, dinner: 107 },
    { date: '2026-11-07', fasting: 96,  bfast: 107, lunch: 108, dinner: 109 },
    { date: '2026-11-08', fasting: 95,  bfast: 99,  lunch: 111, dinner: 91 },
    { date: '2026-11-09', fasting: 97,  bfast: null, lunch: 115, dinner: 112 },
    { date: '2026-11-10', fasting: 94,  bfast: null, lunch: 111, dinner: 116 },
    { date: '2026-11-11', fasting: 98,  bfast: null, lunch: 103, dinner: 86 },
    { date: '2026-11-12', fasting: 99,  bfast: null, lunch: 106, dinner: 107 },
    { date: '2026-11-13', fasting: 94,  bfast: null, lunch: 117, dinner: 109 },
    { date: '2026-11-14', fasting: 108, bfast: null, lunch: null, dinner: null },
    { date: '2026-11-15', fasting: 94,  bfast: 98,  lunch: 114, dinner: null },
  ];

  rawDataset.forEach((day, idx) => {
    // 1. Fasting (07:30)
    if (day.fasting !== null) {
      readings.push({
        id: `reading_${day.date}_0730_${idx}`,
        date: day.date,
        time: '07:30',
        value: day.fasting,
        unitAtEntry: 'mg/dL',
        type: 'fasting',
        notes: day.fasting > 100 ? 'Slightly elevated fasting level' : 'Normal morning baseline',
        createdAt: new Date(`${day.date}T07:30:00`).getTime(),
        updatedAt: new Date(`${day.date}T07:30:00`).getTime(),
      });
    }

    // 2. 2 Hours After Breakfast (09:30)
    if (day.bfast !== null) {
      readings.push({
        id: `reading_${day.date}_0930_${idx}`,
        date: day.date,
        time: '09:30',
        value: day.bfast,
        unitAtEntry: 'mg/dL',
        type: '2h_after_meal',
        mealInfo: 'Breakfast',
        notes: day.bfast > 140 ? 'Higher post-breakfast glycemic response' : 'Good response',
        createdAt: new Date(`${day.date}T09:30:00`).getTime(),
        updatedAt: new Date(`${day.date}T09:30:00`).getTime(),
      });
    }

    // 3. 2 Hours After Lunch (14:00)
    if (day.lunch !== null) {
      readings.push({
        id: `reading_${day.date}_1400_${idx}`,
        date: day.date,
        time: '14:00',
        value: day.lunch,
        unitAtEntry: 'mg/dL',
        type: '2h_after_meal',
        mealInfo: 'Lunch',
        notes: '2 hours post-lunch test',
        createdAt: new Date(`${day.date}T14:00:00`).getTime(),
        updatedAt: new Date(`${day.date}T14:00:00`).getTime(),
      });
    }

    // 4. 2 Hours After Dinner (21:00)
    if (day.dinner !== null) {
      readings.push({
        id: `reading_${day.date}_2100_${idx}`,
        date: day.date,
        time: '21:00',
        value: day.dinner,
        unitAtEntry: 'mg/dL',
        type: '2h_after_meal',
        mealInfo: 'Dinner',
        notes: '2 hours post-dinner test',
        createdAt: new Date(`${day.date}T21:00:00`).getTime(),
        updatedAt: new Date(`${day.date}T21:00:00`).getTime(),
      });
    }
  });

  return readings.sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
}
