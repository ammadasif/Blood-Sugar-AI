import { BloodSugarReading } from '../types';

/**
 * Generates realistic 14-day blood sugar monitoring sample data
 * Covers fasting, pre-meal, 1h-post-meal, 2h-post-meal, and random readings
 * with realistic fluctuations and notes.
 */
export function generateSampleReadings(): BloodSugarReading[] {
  const readings: BloodSugarReading[] = [];
  const now = new Date();

  // 14 days ago up to today
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    // Day variability factor
    const dayFactor = Math.sin(i) * 5;

    // 1. Morning Fasting (7:00 - 7:30 AM)
    const fastingValue = Math.round(88 + dayFactor + (Math.random() * 16 - 8));
    readings.push({
      id: `sample_fasting_${dateStr}`,
      date: dateStr,
      time: '07:15',
      value: Math.max(72, fastingValue),
      unitAtEntry: 'mg/dL',
      type: 'fasting',
      notes: i % 4 === 0 ? 'Woke up well rested' : undefined,
      createdAt: new Date(`${dateStr}T07:15:00`).getTime(),
      updatedAt: new Date(`${dateStr}T07:15:00`).getTime(),
    });

    // 2. Post-Breakfast (2h post-meal: 9:30 AM)
    const postBreakfast = Math.round(124 + dayFactor * 1.5 + (Math.random() * 20 - 10));
    readings.push({
      id: `sample_post_breakfast_${dateStr}`,
      date: dateStr,
      time: '09:30',
      value: postBreakfast,
      unitAtEntry: 'mg/dL',
      type: '2h_after_meal',
      mealInfo: i % 2 === 0 ? 'Oatmeal with berries and walnuts' : 'Eggs and whole grain toast',
      notes: 'Felt energetic',
      createdAt: new Date(`${dateStr}T09:30:00`).getTime(),
      updatedAt: new Date(`${dateStr}T09:30:00`).getTime(),
    });

    // 3. Before Lunch (12:45 PM) - alternate days
    if (i % 2 === 1) {
      const preLunch = Math.round(92 + (Math.random() * 14 - 7));
      readings.push({
        id: `sample_pre_lunch_${dateStr}`,
        date: dateStr,
        time: '12:45',
        value: preLunch,
        unitAtEntry: 'mg/dL',
        type: 'before_meal',
        notes: 'Before lunch check',
        createdAt: new Date(`${dateStr}T12:45:00`).getTime(),
        updatedAt: new Date(`${dateStr}T12:45:00`).getTime(),
      });
    }

    // 4. Post-Dinner (2h post-meal: 20:30 PM)
    // Add one or two higher readings to show warnings/screening context realistically
    let postDinner = Math.round(132 + (Math.random() * 24 - 12));
    if (i === 3) postDinner = 168; // Elevated reading example
    if (i === 8) postDinner = 148; // Mildly elevated

    readings.push({
      id: `sample_post_dinner_${dateStr}`,
      date: dateStr,
      time: '20:30',
      value: postDinner,
      unitAtEntry: 'mg/dL',
      type: '2h_after_meal',
      mealInfo: i === 3 ? 'Pasta dinner with dessert' : 'Grilled salmon with quinoa and vegetables',
      notes: i === 3 ? 'Higher carb meal, dessert had refined sugar' : 'Light evening walk completed',
      createdAt: new Date(`${dateStr}T20:30:00`).getTime(),
      updatedAt: new Date(`${dateStr}T20:30:00`).getTime(),
    });

    // 5. Occasional Random or Bedtime check (22:45 PM)
    if (i % 3 === 0) {
      const bedtime = Math.round(105 + (Math.random() * 16 - 8));
      readings.push({
        id: `sample_random_${dateStr}`,
        date: dateStr,
        time: '22:45',
        value: bedtime,
        unitAtEntry: 'mg/dL',
        type: 'random',
        notes: 'Pre-bedtime check',
        createdAt: new Date(`${dateStr}T22:45:00`).getTime(),
        updatedAt: new Date(`${dateStr}T22:45:00`).getTime(),
      });
    }
  }

  // Sort descending by date and time
  return readings.sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
}
