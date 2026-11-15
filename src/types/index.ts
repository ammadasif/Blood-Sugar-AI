export type ReadingType = 
  | 'fasting' 
  | 'before_meal' 
  | '1h_after_meal' 
  | '2h_after_meal' 
  | 'random';

export type ReadingStatus = 'normal' | 'elevated' | 'high' | 'low' | 'unspecified';

export type BloodSugarUnit = 'mg/dL' | 'mmol/L';

export type TargetProfile = 'general_screening' | 'diagnosed_diabetes' | 'custom';

export interface RangeThresholds {
  normalMax: number;
  elevatedMax: number; // Values equal or below this are elevated, above this is high/screening range
}

export interface TargetRangeConfig {
  lowThreshold: number; // Below this is Low / Hypoglycemia (default 70 mg/dL)
  fasting: RangeThresholds; // Default: 99 normalMax, 125 elevatedMax
  beforeMeal: RangeThresholds; // Default: 99 normalMax, 125 elevatedMax
  afterMeal1h: RangeThresholds; // Default: 140 normalMax, 199 elevatedMax
  afterMeal2h: RangeThresholds; // Default: 139 normalMax, 199 elevatedMax
  random: RangeThresholds; // Default: 140 normalMax, 199 elevatedMax
  veryHighThreshold: number; // e.g. 250 mg/dL
}

export interface BloodSugarReading {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (24-hour)
  value: number; // ALWAYS stored internally in mg/dL for consistent mathematical aggregation
  unitAtEntry: BloodSugarUnit;
  type: ReadingType;
  mealInfo?: string;
  notes?: string;
  comments?: string;
  createdAt: number; // Timestamp ms
  updatedAt: number; // Timestamp ms
}

export interface ReadingAnalysis {
  status: ReadingStatus;
  badgeColor: 'emerald' | 'amber' | 'rose' | 'slate';
  label: string;
  title: string;
  explanation: string;
  recommendation: string;
  targetRangeText: string;
  comparisonWithPrevious?: {
    diff: number; // positive = increased, negative = decreased
    trend: 'up' | 'down' | 'same';
    previousDate: string;
    previousTime: string;
    previousValue: number;
  };
}

export interface AppSettings {
  unit: BloodSugarUnit;
  targetProfile: TargetProfile;
  ranges: TargetRangeConfig;
  storageLimit: number;
  autoDeleteOldReadings: boolean;
  theme: 'light' | 'dark';
  hasDismissedBackupWarning?: boolean;
  lastBackupDate?: string;
}

export interface ReadingFilter {
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
  readingTypes?: ReadingType[];
  statuses?: ReadingStatus[];
  sortBy?: 'date_desc' | 'date_asc' | 'value_desc' | 'value_asc';
}

export interface PeriodSummary {
  periodLabel: string;
  totalCount: number;
  averageOverall: number;
  averageFasting: number;
  averagePostMeal: number;
  highest: { value: number; date: string; time: string } | null;
  lowest: { value: number; date: string; time: string } | null;
  normalCount: number;
  elevatedCount: number;
  highCount: number;
  lowCount: number;
  normalPercentage: number;
  elevatedPercentage: number;
  highPercentage: number;
  lowPercentage: number;
  fastingCount: number;
  postMealCount: number;
  estimatedA1c?: number;
  variabilitySD?: number;
  variabilityCV?: number;
}
