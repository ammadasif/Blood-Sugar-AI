import { BloodSugarReading, ReadingAnalysis, ReadingStatus, ReadingType, TargetRangeConfig, AppSettings, BloodSugarUnit } from '../types';
import { formatBloodSugar } from './conversions';

export const DEFAULT_RANGES: TargetRangeConfig = {
  lowThreshold: 70, // Below 70 mg/dL is hypoglycemia / low blood sugar
  fasting: {
    normalMax: 99,
    elevatedMax: 125, // 100 - 125 is prediabetes screening range, >= 126 is diabetes screening
  },
  beforeMeal: {
    normalMax: 99,
    elevatedMax: 125,
  },
  afterMeal1h: {
    normalMax: 140,
    elevatedMax: 199,
  },
  afterMeal2h: {
    normalMax: 139,
    elevatedMax: 199, // 140 - 199 is elevated/impaired tolerance, >= 200 is screening range
  },
  random: {
    normalMax: 140,
    elevatedMax: 199,
  },
  veryHighThreshold: 250,
};

export const DIABETES_MANAGEMENT_RANGES: TargetRangeConfig = {
  lowThreshold: 70,
  fasting: {
    normalMax: 130, // ADA non-pregnant adult target: 80-130 mg/dL
    elevatedMax: 180,
  },
  beforeMeal: {
    normalMax: 130,
    elevatedMax: 180,
  },
  afterMeal1h: {
    normalMax: 180,
    elevatedMax: 220,
  },
  afterMeal2h: {
    normalMax: 180, // ADA post-prandial target: < 180 mg/dL
    elevatedMax: 220,
  },
  random: {
    normalMax: 180,
    elevatedMax: 220,
  },
  veryHighThreshold: 250,
};

export const READING_TYPE_LABELS: Record<ReadingType, string> = {
  fasting: 'Fasting',
  before_meal: 'Before Meal',
  '1h_after_meal': '1 Hour After Meal',
  '2h_after_meal': '2 Hours After Meal',
  random: 'Random / Casual',
};

/**
 * Evaluates a blood sugar reading against configurable target ranges
 * and produces clinical context, interpretation, and recommendations.
 */
export function analyzeReading(
  reading: BloodSugarReading,
  settings: AppSettings,
  previousReading?: BloodSugarReading | null
): ReadingAnalysis {
  const { value, type } = reading;
  const { ranges, targetProfile, unit } = settings;
  const lowLimit = ranges.lowThreshold || 70;
  const isDiagnosedProfile = targetProfile === 'diagnosed_diabetes';

  let status: ReadingStatus = 'normal';
  let badgeColor: 'emerald' | 'amber' | 'rose' | 'slate' = 'emerald';
  let title = '';
  let explanation = '';
  let recommendation = '';
  let targetRangeText = '';

  // Get specific range config for the reading type
  let typeRange = ranges.fasting;
  if (type === 'before_meal') typeRange = ranges.beforeMeal;
  else if (type === '1h_after_meal') typeRange = ranges.afterMeal1h;
  else if (type === '2h_after_meal') typeRange = ranges.afterMeal2h;
  else if (type === 'random') typeRange = ranges.random;

  // Format ranges in user's unit
  const lowFormatted = formatBloodSugar(lowLimit, unit);
  const normalMaxFormatted = formatBloodSugar(typeRange.normalMax, unit);
  const elevatedMaxFormatted = formatBloodSugar(typeRange.elevatedMax, unit);

  // 1. Check for Low / Hypoglycemia first
  if (value < lowLimit) {
    status = 'low';
    badgeColor = 'rose';
    title = 'Low Blood Sugar (Hypoglycemia)';
    targetRangeText = `Target: ${lowFormatted} - ${normalMaxFormatted}`;
    explanation = `Your reading of ${formatBloodSugar(value, unit)} is below the minimum reference threshold (${lowFormatted}). This indicates hypoglycemia.`;
    recommendation =
      'Consume 15–20g of fast-acting carbohydrates (such as 4 oz fruit juice, regular soda, or 3-4 glucose tablets). Recheck blood sugar in 15 minutes. Seek medical assistance if symptoms are severe or persistent.';
  }
  // 2. Type-specific evaluations
  else if (type === 'fasting' || type === 'before_meal') {
    targetRangeText = isDiagnosedProfile
      ? `Target: ${lowFormatted} – ${normalMaxFormatted}`
      : `Reference: ${lowFormatted} – ${normalMaxFormatted}`;

    if (value <= typeRange.normalMax) {
      status = 'normal';
      badgeColor = 'emerald';
      title = isDiagnosedProfile ? 'Within Fasting Target' : 'Normal Fasting Reference';
      explanation = isDiagnosedProfile
        ? `Your fasting blood sugar of ${formatBloodSugar(value, unit)} is well within your personal glycemic target range.`
        : `Your fasting blood sugar of ${formatBloodSugar(value, unit)} is within the general normal reference range for healthy adults.`;
      recommendation = 'Maintain your balanced nutrition, physical activity, and hydration routines.';
    } else if (value <= typeRange.elevatedMax) {
      status = 'elevated';
      badgeColor = 'amber';
      title = isDiagnosedProfile ? 'Slightly Above Fasting Target' : 'Prediabetes Screening Range';
      explanation = isDiagnosedProfile
        ? `Your fasting reading of ${formatBloodSugar(value, unit)} is slightly above your target range (${normalMaxFormatted}).`
        : `Your fasting blood sugar of ${formatBloodSugar(value, unit)} is above the general normal reference range and falls within the prediabetes screening range (${lowFormatted}–${elevatedMaxFormatted}).`;
      recommendation = isDiagnosedProfile
        ? 'Review dinner composition, evening snacks, sleep quality, and discuss dosage timing with your physician if this pattern persists.'
        : 'Consider discussing this result with a healthcare professional for comprehensive assessment. Focus on balanced meals with whole foods and regular activity.';
    } else {
      status = 'high';
      badgeColor = 'rose';
      title = isDiagnosedProfile ? 'High Fasting Reading' : 'Diabetes Screening Range';
      explanation = isDiagnosedProfile
        ? `Your fasting blood sugar of ${formatBloodSugar(value, unit)} is significantly elevated above your clinical target.`
        : `Your fasting blood sugar of ${formatBloodSugar(value, unit)} meets or exceeds standard clinical screening thresholds (${elevatedMaxFormatted}+).`;
      recommendation =
        'Contact your healthcare provider to discuss this reading. Check for potential confounding factors such as illness, acute stress, or medication adherence. Drink water to stay well-hydrated.';
    }
  } else if (type === '2h_after_meal' || type === '1h_after_meal') {
    const mealTiming = type === '1h_after_meal' ? '1 hour post-meal' : '2 hours post-meal';
    targetRangeText = isDiagnosedProfile
      ? `Target: Below ${normalMaxFormatted}`
      : `Reference: Below ${normalMaxFormatted}`;

    if (value <= typeRange.normalMax) {
      status = 'normal';
      badgeColor = 'emerald';
      title = 'Within Post-Meal Reference Range';
      explanation = `Your ${mealTiming} blood sugar reading of ${formatBloodSugar(value, unit)} is within the standard reference target.`;
      recommendation = 'Good post-prandial glycemic response. Note the meal contents to understand which foods support stable glucose levels.';
    } else if (value <= typeRange.elevatedMax) {
      status = 'elevated';
      badgeColor = 'amber';
      title = 'Elevated Post-Meal Level';
      explanation = `Your ${mealTiming} reading of ${formatBloodSugar(value, unit)} is above the ideal threshold (${normalMaxFormatted}) and indicates impaired glucose clearance.`;
      recommendation =
        'A light 10–15 minute walk after meals can help muscle glucose uptake. Consider evaluating carbohydrate portions, refined sugar intake, and fiber content of the preceding meal.';
    } else {
      status = 'high';
      badgeColor = 'rose';
      title = isDiagnosedProfile ? 'Markedly High Post-Meal Reading' : 'Post-Meal Screening Range';
      explanation = `Your ${mealTiming} blood sugar of ${formatBloodSugar(value, unit)} is markedly elevated (${elevatedMaxFormatted}+).`;
      recommendation =
        'Ensure proper hydration. Review the meal composition (simple sugars vs complex carbs) and consult your doctor or certified diabetes educator for personalized management advice.';
    }
  } else {
    // Random / Casual reading
    targetRangeText = isDiagnosedProfile
      ? `Target: Below ${normalMaxFormatted}`
      : `Contextual: Typically < ${normalMaxFormatted} fasting or < ${elevatedMaxFormatted} non-fasting`;

    if (value <= typeRange.normalMax) {
      status = 'normal';
      badgeColor = 'emerald';
      title = 'Normal Random Blood Sugar';
      explanation = `Your random reading of ${formatBloodSugar(value, unit)} is within the expected physiological range regardless of recent meals.`;
      recommendation = 'Levels appear stable. Continue observing overall lifestyle and dietary balance.';
    } else if (value <= typeRange.elevatedMax) {
      status = 'elevated';
      badgeColor = 'amber';
      title = 'Borderline / Attention Random Reading';
      explanation = `Your random blood sugar of ${formatBloodSugar(value, unit)} is mildly elevated. Interpretation depends on time elapsed since your last caloric intake.`;
      recommendation =
        'Log your last meal time and content. If you have not eaten for over 2 hours, this reading warrants continued observation and consultation with a healthcare provider.';
    } else {
      status = 'high';
      badgeColor = 'rose';
      title = 'Elevated Random Blood Sugar';
      explanation = `A random blood sugar reading of ${formatBloodSugar(value, unit)} exceeds standard casual reference limits (${elevatedMaxFormatted}+).`;
      recommendation =
        'Repeat testing with a standardized fasting or 2-hour post-prandial test and consult a qualified medical professional for clinical guidance.';
    }
  }

  // Calculate comparison with previous reading
  let comparisonWithPrevious: ReadingAnalysis['comparisonWithPrevious'] = undefined;
  if (previousReading) {
    const diff = value - previousReading.value;
    let trend: 'up' | 'down' | 'same' = 'same';
    if (diff > 3) trend = 'up';
    else if (diff < -3) trend = 'down';

    comparisonWithPrevious = {
      diff,
      trend,
      previousDate: previousReading.date,
      previousTime: previousReading.time,
      previousValue: previousReading.value,
    };
  }

  return {
    status,
    badgeColor,
    label: status.toUpperCase(),
    title,
    explanation,
    recommendation,
    targetRangeText,
    comparisonWithPrevious,
  };
}

/**
 * Calculates estimated A1c (%) from average blood glucose in mg/dL
 * ADAG formula: A1c = (average_glucose + 46.7) / 28.7
 */
export function calculateEstimatedA1c(averageMgDl: number): number | null {
  if (!averageMgDl || averageMgDl <= 0) return null;
  const a1c = (averageMgDl + 46.7) / 28.7;
  return Number(a1c.toFixed(1));
}

/**
 * Calculates glycemic variability (Standard Deviation and Coefficient of Variation)
 */
export function calculateVariability(valuesMgDl: number[]): { sd: number; cv: number } | null {
  if (!valuesMgDl || valuesMgDl.length < 2) return null;
  const mean = valuesMgDl.reduce((acc, val) => acc + val, 0) / valuesMgDl.length;
  const variance =
    valuesMgDl.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (valuesMgDl.length - 1);
  const sd = Math.sqrt(variance);
  const cv = (sd / mean) * 100; // In %
  return {
    sd: Number(sd.toFixed(1)),
    cv: Number(cv.toFixed(1)),
  };
}

