import React, { useState, useMemo } from 'react';
import {
  Activity,
  Flame,
  Clock,
  Calendar,
  Sparkles,
  Filter,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Utensils,
  Check,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import { useBloodSugar } from '../context/BloodSugarContext';
import {
  calculateEstimatedA1c,
  calculateVariability,
  analyzeReading,
  READING_TYPE_LABELS,
} from '../utils/analysis';
import {
  convertFromInternal,
  formatBloodSugar,
  formatDate,
  formatDateDMY,
  formatTime,
} from '../utils/conversions';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';

type AnalyticsDateFilter = 'all' | 'today' | '7days' | '30days' | 'this_month' | 'custom';

export const AnalyticsView: React.FC = () => {
  const { readings, settings } = useBloodSugar();

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<AnalyticsDateFilter>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Find min and max dates across all readings for quick custom range preset
  const { earliestDate, latestDate } = useMemo(() => {
    if (readings.length === 0) return { earliestDate: '', latestDate: '' };
    const dates = readings.map((r) => r.date).sort();
    return { earliestDate: dates[0], latestDate: dates[dates.length - 1] };
  }, [readings]);

  // Filtered readings based on selected date filter
  const filteredReadings = useMemo(() => {
    if (readings.length === 0) return [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return readings.filter((r) => {
      if (dateFilter === 'all') return true;
      if (dateFilter === 'today') return r.date === todayStr;

      const readingDate = new Date(`${r.date}T00:00:00`);

      if (dateFilter === '7days') {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);
        return readingDate >= sevenDaysAgo;
      }
      if (dateFilter === '30days') {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return readingDate >= thirtyDaysAgo;
      }
      if (dateFilter === 'this_month') {
        return (
          readingDate.getFullYear() === now.getFullYear() &&
          readingDate.getMonth() === now.getMonth()
        );
      }
      if (dateFilter === 'custom') {
        if (customStart && r.date < customStart) return false;
        if (customEnd && r.date > customEnd) return false;
        return true;
      }
      return true;
    });
  }, [readings, dateFilter, customStart, customEnd]);

  // Sort chronological
  const chronologicalReadings = useMemo(() => {
    return [...filteredReadings].sort((a, b) =>
      `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
    );
  }, [filteredReadings]);

  // All glucose readings values in mg/dL for the filtered period
  const valuesMgDl = useMemo(() => filteredReadings.map((r) => r.value), [filteredReadings]);

  // Overall Mean
  const meanMgDl = useMemo(() => {
    if (valuesMgDl.length === 0) return 0;
    return Math.round(valuesMgDl.reduce((a, b) => a + b, 0) / valuesMgDl.length);
  }, [valuesMgDl]);

  // Estimated A1c
  const estimatedA1c = useMemo(() => calculateEstimatedA1c(meanMgDl), [meanMgDl]);

  // Glycemic Variability (SD & CV)
  const variability = useMemo(() => calculateVariability(valuesMgDl), [valuesMgDl]);

  // Highest and Lowest readings in the filtered period
  const { highestReading, lowestReading, latestReading } = useMemo(() => {
    if (filteredReadings.length === 0) {
      return { highestReading: null, lowestReading: null, latestReading: null };
    }
    const sortedByVal = [...filteredReadings].sort((a, b) => b.value - a.value);
    const sortedByTime = [...filteredReadings].sort((a, b) =>
      `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)
    );
    return {
      highestReading: sortedByVal[0],
      lowestReading: sortedByVal[sortedByVal.length - 1],
      latestReading: sortedByTime[0],
    };
  }, [filteredReadings]);

  // LIVE STATUS BREAKDOWN ACCORDING TO USER'S CONFIGURABLE CLINICAL REFERENCE RANGES
  const statusStats = useMemo(() => {
    if (filteredReadings.length === 0) {
      return {
        normal: 0,
        elevated: 0,
        high: 0,
        low: 0,
        normalPct: 0,
        elevatedPct: 0,
        highPct: 0,
        lowPct: 0,
        total: 0,
      };
    }

    const total = filteredReadings.length;
    let normal = 0;
    let elevated = 0;
    let high = 0;
    let low = 0;

    filteredReadings.forEach((r) => {
      const a = analyzeReading(r, settings);
      if (a.status === 'normal') normal++;
      else if (a.status === 'elevated') elevated++;
      else if (a.status === 'high') high++;
      else if (a.status === 'low') low++;
    });

    return {
      normal,
      elevated,
      high,
      low,
      normalPct: Math.round((normal / total) * 100),
      elevatedPct: Math.round((elevated / total) * 100),
      highPct: Math.round((high / total) * 100),
      lowPct: Math.round((low / total) * 100),
      total,
    };
  }, [filteredReadings, settings]);

  // MEAL SLOT DETAILED BREAKDOWN (Fasting, Breakfast, Lunch, Dinner)
  const mealSlotStats = useMemo(() => {
    const fasting = filteredReadings.filter((r) => r.type === 'fasting');
    const breakfast = filteredReadings.filter(
      (r) =>
        (r.type === '2h_after_meal' || r.type === '1h_after_meal') &&
        (r.mealInfo?.toLowerCase().includes('breakfast') ||
          r.notes?.toLowerCase().includes('breakfast') ||
          r.time < '11:30')
    );
    const lunch = filteredReadings.filter(
      (r) =>
        (r.type === '2h_after_meal' || r.type === '1h_after_meal') &&
        (r.mealInfo?.toLowerCase().includes('lunch') ||
          r.notes?.toLowerCase().includes('lunch') ||
          (r.time >= '11:30' && r.time < '17:00'))
    );
    const dinner = filteredReadings.filter(
      (r) =>
        (r.type === '2h_after_meal' || r.type === '1h_after_meal') &&
        (r.mealInfo?.toLowerCase().includes('dinner') ||
          r.notes?.toLowerCase().includes('dinner') ||
          r.time >= '17:00')
    );

    const calcGroup = (group: typeof filteredReadings, targetLimit: number) => {
      if (group.length === 0) {
        return { count: 0, avg: 0, min: 0, max: 0, inTargetCount: 0, inTargetPct: 0, elevatedCount: 0 };
      }
      const vals = group.map((r) => r.value);
      const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      let inTargetCount = 0;
      group.forEach((r) => {
        const a = analyzeReading(r, settings);
        if (a.status === 'normal') inTargetCount++;
      });
      return {
        count: group.length,
        avg: convertFromInternal(avg, settings.unit),
        min: convertFromInternal(min, settings.unit),
        max: convertFromInternal(max, settings.unit),
        inTargetCount,
        inTargetPct: Math.round((inTargetCount / group.length) * 100),
        elevatedCount: group.length - inTargetCount,
      };
    };

    const fastingLimit = convertFromInternal(settings.ranges.fasting.normalMax, settings.unit);
    const postMealLimit = convertFromInternal(settings.ranges.afterMeal2h.normalMax, settings.unit);

    return {
      fasting: { ...calcGroup(fasting, fastingLimit), limit: fastingLimit, label: 'Fasting' },
      breakfast: { ...calcGroup(breakfast, postMealLimit), limit: postMealLimit, label: '2h Breakfast' },
      lunch: { ...calcGroup(lunch, postMealLimit), limit: postMealLimit, label: '2h Lunch' },
      dinner: { ...calcGroup(dinner, postMealLimit), limit: postMealLimit, label: '2h Dinner' },
    };
  }, [filteredReadings, settings]);

  // Chart 1: Meal Slots Bar Chart Data
  const mealSlotsChartData = useMemo(() => {
    return [
      {
        slot: 'Fasting',
        average: mealSlotStats.fasting.avg,
        count: mealSlotStats.fasting.count,
        targetLimit: mealSlotStats.fasting.limit,
        inTargetPct: mealSlotStats.fasting.inTargetPct,
        fillColor: mealSlotStats.fasting.inTargetPct >= 70 ? '#10b981' : '#f59e0b',
      },
      {
        slot: '2h Breakfast',
        average: mealSlotStats.breakfast.avg,
        count: mealSlotStats.breakfast.count,
        targetLimit: mealSlotStats.breakfast.limit,
        inTargetPct: mealSlotStats.breakfast.inTargetPct,
        fillColor: mealSlotStats.breakfast.inTargetPct >= 70 ? '#3b82f6' : '#f59e0b',
      },
      {
        slot: '2h Lunch',
        average: mealSlotStats.lunch.avg,
        count: mealSlotStats.lunch.count,
        targetLimit: mealSlotStats.lunch.limit,
        inTargetPct: mealSlotStats.lunch.inTargetPct,
        fillColor: mealSlotStats.lunch.inTargetPct >= 70 ? '#6366f1' : '#f59e0b',
      },
      {
        slot: '2h Dinner',
        average: mealSlotStats.dinner.avg,
        count: mealSlotStats.dinner.count,
        targetLimit: mealSlotStats.dinner.limit,
        inTargetPct: mealSlotStats.dinner.inTargetPct,
        fillColor: mealSlotStats.dinner.inTargetPct >= 70 ? '#14b8a6' : '#f59e0b',
      },
    ].filter((s) => s.count > 0);
  }, [mealSlotStats]);

  // Chart 2: Daily Progression Line Chart (Day by Day)
  const dailyTrendsChartData = useMemo(() => {
    const dayMap: Record<string, { fasting: number[]; postMeal: number[] }> = {};

    chronologicalReadings.forEach((r) => {
      if (!dayMap[r.date]) {
        dayMap[r.date] = { fasting: [], postMeal: [] };
      }
      if (r.type === 'fasting') {
        dayMap[r.date].fasting.push(r.value);
      } else {
        dayMap[r.date].postMeal.push(r.value);
      }
    });

    return Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, group]) => {
        const fAvg = group.fasting.length
          ? convertFromInternal(
              Math.round(group.fasting.reduce((s, v) => s + v, 0) / group.fasting.length),
              settings.unit
            )
          : null;
        const pmAvg = group.postMeal.length
          ? convertFromInternal(
              Math.round(group.postMeal.reduce((s, v) => s + v, 0) / group.postMeal.length),
              settings.unit
            )
          : null;

        return {
          date: formatDateDMY(date),
          rawDate: date,
          Fasting: fAvg,
          'Post-Meal': pmAvg,
        };
      });
  }, [chronologicalReadings, settings.unit]);

  // Chart 3: Day of Week trends
  const dayOfWeekData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const bins: Record<string, number[]> = {
      Mon: [],
      Tue: [],
      Wed: [],
      Thu: [],
      Fri: [],
      Sat: [],
      Sun: [],
    };

    filteredReadings.forEach((r) => {
      const [year, month, day] = r.date.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      const dayName = days[dateObj.getDay()];
      if (bins[dayName]) bins[dayName].push(r.value);
    });

    const orderedDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return orderedDays.map((d) => {
      const values = bins[d];
      const avg = values.length
        ? convertFromInternal(
            Math.round(values.reduce((s, v) => s + v, 0) / values.length),
            settings.unit
          )
        : 0;
      return {
        day: d,
        average: avg,
        count: values.length,
      };
    });
  }, [filteredReadings, settings.unit]);

  // LIVE CLINICAL INSIGHTS COMMENTARY GENERATOR
  const liveInsights = useMemo(() => {
    if (filteredReadings.length === 0) return [];
    const insights: { title: string; desc: string; type: 'success' | 'warning' | 'info' }[] = [];

    // 1. Overall Target Range Compliance
    if (statusStats.normalPct >= 70) {
      insights.push({
        title: 'Strong Target Compliance',
        desc: `${statusStats.normalPct}% (${statusStats.normal} of ${statusStats.total}) of your blood sugar readings met clinical reference targets.`,
        type: 'success',
      });
    } else {
      insights.push({
        title: 'Elevated Glycemic Burden',
        desc: `${statusStats.elevatedPct + statusStats.highPct}% (${statusStats.elevated + statusStats.high} readings) exceeded target thresholds. Review meal carbohydrate intake and physical activity.`,
        type: 'warning',
      });
    }

    // 2. Fasting Analysis
    if (mealSlotStats.fasting.count > 0) {
      if (mealSlotStats.fasting.inTargetPct >= 75) {
        insights.push({
          title: 'Optimal Fasting Baseline',
          desc: `Morning fasting average is ${mealSlotStats.fasting.avg} ${settings.unit} with ${mealSlotStats.fasting.inTargetPct}% within normal limits (target: < ${mealSlotStats.fasting.limit} ${settings.unit}).`,
          type: 'success',
        });
      } else {
        insights.push({
          title: 'Fasting Glucose Elevation',
          desc: `Fasting average is ${mealSlotStats.fasting.avg} ${settings.unit} (highest: ${mealSlotStats.fasting.max} ${settings.unit}). ${mealSlotStats.fasting.elevatedCount} fasting readings were above target.`,
          type: 'warning',
        });
      }
    }

    // 3. Post-meal Spikes Detection
    const highSpikes = filteredReadings.filter((r) => r.value >= 150);
    if (highSpikes.length > 0) {
      const spike = highSpikes.sort((a, b) => b.value - a.value)[0];
      insights.push({
        title: `Post-Prandial Peak Detected`,
        desc: `Highest post-meal reading reached ${formatBloodSugar(spike.value, settings.unit)} on ${formatDateDMY(spike.date)} (${READING_TYPE_LABELS[spike.type]}${spike.mealInfo ? ` - ${spike.mealInfo}` : ''}).`,
        type: 'warning',
      });
    } else {
      insights.push({
        title: 'No Severe Spikes',
        desc: `All post-meal readings remained below 150 mg/dL across the monitored period.`,
        type: 'success',
      });
    }

    // 4. Variability
    if (variability) {
      if (variability.cv <= 36) {
        insights.push({
          title: 'Stable Glycemic Profile',
          desc: `Coefficient of Variation (CV) is ${variability.cv}%, well within the stable threshold (≤ 36%), protecting vascular health.`,
          type: 'info',
        });
      } else {
        insights.push({
          title: 'High Glycemic Fluctuation',
          desc: `CV is ${variability.cv}% (target ≤ 36%), indicating notable swings between lows and highs.`,
          type: 'warning',
        });
      }
    }

    return insights;
  }, [filteredReadings, statusStats, mealSlotStats, settings, variability]);

  const handleFitToDataRange = () => {
    if (earliestDate && latestDate) {
      setCustomStart(earliestDate);
      setCustomEnd(latestDate);
      setDateFilter('custom');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <MedicalDisclaimer compact />

      {/* Date Range Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Analysis Timeframe</h3>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
              {filteredReadings.length} {filteredReadings.length === 1 ? 'Reading' : 'Readings'}
            </span>
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: '7days', label: 'Last 7 Days' },
              { id: '30days', label: 'Last 30 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'custom', label: 'Custom Range' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDateFilter(tab.id as AnalyticsDateFilter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  dateFilter === tab.id
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Sub-Bar */}
        {dateFilter === 'custom' && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs animate-fade-in">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                Custom Range:
              </span>
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs w-full sm:w-auto"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs w-full sm:w-auto"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {earliestDate && latestDate && (
                <button
                  type="button"
                  onClick={handleFitToDataRange}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                >
                  Fit to Dataset ({formatDateDMY(earliestDate)} - {formatDateDMY(latestDate)})
                </button>
              )}
              {(customStart || customEnd) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomStart('');
                    setCustomEnd('');
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Clear custom dates"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active Range Summary Pill */}
        {filteredReadings.length > 0 && (
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>
              Analyzing {filteredReadings.length} readings across{' '}
              {new Set(filteredReadings.map((r) => r.date)).size} days
              {customStart || customEnd
                ? ` (${customStart ? formatDateDMY(customStart) : 'Start'} to ${
                    customEnd ? formatDateDMY(customEnd) : 'Present'
                  })`
                : ''}
            </span>
          </div>
        )}
      </div>

      {/* Empty State when filter yields 0 readings */}
      {filteredReadings.length === 0 ? (
        <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl text-center space-y-3 shadow-sm">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            No readings found for this timeframe
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Try switching to &quot;All Time&quot; or click &quot;Fit to Dataset&quot; to inspect all recorded blood sugar measurements.
          </p>
          {earliestDate && latestDate && (
            <button
              onClick={handleFitToDataRange}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
            >
              Fit to Dataset ({formatDateDMY(earliestDate)} - {formatDateDMY(latestDate)})
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Hero Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Estimated HbA1c */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-3xl p-5 shadow-lg shadow-blue-500/10 space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between text-blue-100">
                <span className="text-[11px] font-bold uppercase tracking-wider">Estimated HbA1c</span>
                <Activity className="w-4 h-4" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                  {estimatedA1c ? `${estimatedA1c}%` : '—'}
                </span>
                <span className="text-[11px] text-blue-200">ADAG formula</span>
              </div>
              <p className="text-[11px] text-blue-100 leading-tight">
                From period average of {formatBloodSugar(meanMgDl, settings.unit)}. Normal &lt; 5.7%.
              </p>
            </div>

            {/* 2. Glycemic Variability (CV) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Glycemic Variability (CV)</span>
                <Flame className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
                  {variability ? `${variability.cv}%` : '—'}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    variability && variability.cv <= 36
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {variability && variability.cv <= 36 ? 'Target ≤ 36%' : 'High Fluctuation'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                SD: <strong>{variability ? formatBloodSugar(variability.sd, settings.unit) : 'N/A'}</strong>. Lower protects vascular health.
              </p>
            </div>

            {/* 3. In Target Range (TITR) — ACCORDING TO USER'S REAL DATA */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">In Target Range</span>
                <Sparkles className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-3xl sm:text-4xl font-extrabold ${
                    statusStats.normalPct >= 70
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {statusStats.normalPct}%
                </span>
                <span className="text-[11px] text-slate-400">
                  {statusStats.normal} of {statusStats.total} tests
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                {statusStats.elevated + statusStats.high > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {statusStats.elevated + statusStats.high} readings ({statusStats.elevatedPct + statusStats.highPct}%) above target
                  </span>
                ) : (
                  'All readings within configured limits.'
                )}
              </p>
            </div>

            {/* 4. Range Extremes (Highest / Lowest) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Period Extremes</span>
                <Activity className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-0.5">
                    <ArrowDownRight className="w-3 h-3 text-emerald-500" /> Lowest
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {lowestReading ? formatBloodSugar(lowestReading.value, settings.unit) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-0.5">
                    <ArrowUpRight className="w-3 h-3 text-rose-500" /> Highest
                  </div>
                  <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
                    {highestReading ? formatBloodSugar(highestReading.value, settings.unit) : '—'}
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                Avg: <strong className="text-slate-700 dark:text-slate-300">{formatBloodSugar(meanMgDl, settings.unit)}</strong> across {filteredReadings.length} tests
              </p>
            </div>
          </div>

          {/* DYNAMIC CLINICAL DISTRIBUTION BAR ACCORDING TO USER'S DATA */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" />
                  Clinical Target Range Distribution Breakdown
                </h3>
                <p className="text-xs text-slate-400">
                  Evaluated against your active clinical target profile ({settings.targetProfile.replace('_', ' ').toUpperCase()})
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full w-fit">
                {statusStats.normalPct}% In Target
              </span>
            </div>

            {/* Multi-segment Bar matching real data */}
            <div className="h-6 w-full rounded-xl overflow-hidden flex shadow-inner bg-slate-100 dark:bg-slate-800">
              {statusStats.lowPct > 0 && (
                <div
                  style={{ width: `${statusStats.lowPct}%` }}
                  title={`Low Glucose: ${statusStats.low} readings (${statusStats.lowPct}%)`}
                  className="bg-sky-500 h-full transition-all"
                />
              )}
              {statusStats.normalPct > 0 && (
                <div
                  style={{ width: `${statusStats.normalPct}%` }}
                  title={`Within Target: ${statusStats.normal} readings (${statusStats.normalPct}%)`}
                  className="bg-emerald-500 h-full transition-all"
                />
              )}
              {statusStats.elevatedPct > 0 && (
                <div
                  style={{ width: `${statusStats.elevatedPct}%` }}
                  title={`Elevated: ${statusStats.elevated} readings (${statusStats.elevatedPct}%)`}
                  className="bg-amber-500 h-full transition-all"
                />
              )}
              {statusStats.highPct > 0 && (
                <div
                  style={{ width: `${statusStats.highPct}%` }}
                  title={`High/Screening: ${statusStats.high} readings (${statusStats.highPct}%)`}
                  className="bg-rose-600 h-full transition-all"
                />
              )}
            </div>

            {/* Dynamic Legend with exact counts & percentages */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/60 flex items-center gap-3">
                <span className="w-3.5 h-3.5 rounded-md bg-emerald-500 shrink-0" />
                <div>
                  <p className="font-extrabold text-emerald-800 dark:text-emerald-200">
                    {statusStats.normalPct}% ({statusStats.normal})
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Within Target</p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800/60 flex items-center gap-3">
                <span className="w-3.5 h-3.5 rounded-md bg-amber-500 shrink-0" />
                <div>
                  <p className="font-extrabold text-amber-800 dark:text-amber-200">
                    {statusStats.elevatedPct}% ({statusStats.elevated})
                  </p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Elevated / Attention</p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-800/60 flex items-center gap-3">
                <span className="w-3.5 h-3.5 rounded-md bg-rose-600 shrink-0" />
                <div>
                  <p className="font-extrabold text-rose-800 dark:text-rose-200">
                    {statusStats.highPct}% ({statusStats.high})
                  </p>
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">High / Screening Tier</p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-800/60 flex items-center gap-3">
                <span className="w-3.5 h-3.5 rounded-md bg-sky-500 shrink-0" />
                <div>
                  <p className="font-extrabold text-sky-800 dark:text-sky-200">
                    {statusStats.lowPct}% ({statusStats.low})
                  </p>
                  <p className="text-[10px] text-sky-600 dark:text-sky-400 font-medium">Low Glucose (&lt;70)</p>
                </div>
              </div>
            </div>
          </div>

          {/* MEAL SLOT GLYCEMIC CARDS (FASTING, BREAKFAST, LUNCH, DINNER) */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Utensils className="w-4 h-4 text-emerald-600" />
              Meal Slot Glycemic Analysis ({settings.unit})
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Fasting Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Morning Fasting</span>
                  <span className="text-[10px] text-slate-400">Target &lt; {mealSlotStats.fasting.limit}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {mealSlotStats.fasting.count > 0 ? `${mealSlotStats.fasting.avg}` : '—'}
                  </span>
                  <span className="text-xs text-slate-400">avg across {mealSlotStats.fasting.count} tests</span>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] flex items-center justify-between text-slate-500">
                  <span>Range: {mealSlotStats.fasting.min} - {mealSlotStats.fasting.max}</span>
                  <span
                    className={`font-bold ${
                      mealSlotStats.fasting.inTargetPct >= 70 ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {mealSlotStats.fasting.inTargetPct}% In Target
                  </span>
                </div>
              </div>

              {/* Breakfast Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">2h Post-Breakfast</span>
                  <span className="text-[10px] text-slate-400">Target &lt; {mealSlotStats.breakfast.limit}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                    {mealSlotStats.breakfast.count > 0 ? `${mealSlotStats.breakfast.avg}` : '—'}
                  </span>
                  <span className="text-xs text-slate-400">avg across {mealSlotStats.breakfast.count} tests</span>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] flex items-center justify-between text-slate-500">
                  <span>Range: {mealSlotStats.breakfast.min} - {mealSlotStats.breakfast.max}</span>
                  <span
                    className={`font-bold ${
                      mealSlotStats.breakfast.inTargetPct >= 70 ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {mealSlotStats.breakfast.inTargetPct}% In Target
                  </span>
                </div>
              </div>

              {/* Lunch Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">2h Post-Lunch</span>
                  <span className="text-[10px] text-slate-400">Target &lt; {mealSlotStats.lunch.limit}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
                    {mealSlotStats.lunch.count > 0 ? `${mealSlotStats.lunch.avg}` : '—'}
                  </span>
                  <span className="text-xs text-slate-400">avg across {mealSlotStats.lunch.count} tests</span>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] flex items-center justify-between text-slate-500">
                  <span>Range: {mealSlotStats.lunch.min} - {mealSlotStats.lunch.max}</span>
                  <span
                    className={`font-bold ${
                      mealSlotStats.lunch.inTargetPct >= 70 ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {mealSlotStats.lunch.inTargetPct}% In Target
                  </span>
                </div>
              </div>

              {/* Dinner Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">2h Post-Dinner</span>
                  <span className="text-[10px] text-slate-400">Target &lt; {mealSlotStats.dinner.limit}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-teal-600 dark:text-teal-400">
                    {mealSlotStats.dinner.count > 0 ? `${mealSlotStats.dinner.avg}` : '—'}
                  </span>
                  <span className="text-xs text-slate-400">avg across {mealSlotStats.dinner.count} tests</span>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] flex items-center justify-between text-slate-500">
                  <span>Range: {mealSlotStats.dinner.min} - {mealSlotStats.dinner.max}</span>
                  <span
                    className={`font-bold ${
                      mealSlotStats.dinner.inTargetPct >= 70 ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {mealSlotStats.dinner.inTargetPct}% In Target
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* REAL DATA CLINICAL INSIGHTS */}
          <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-slate-800/80 dark:to-slate-800/40 border border-blue-100 dark:border-slate-700 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Live Data-Driven Clinical Observations
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {liveInsights.map((insight, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/60 dark:border-slate-800 space-y-1 shadow-xs"
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    {insight.type === 'success' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : insight.type === 'warning' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <Info className="w-3.5 h-3.5 text-blue-500" />
                    )}
                    <span
                      className={
                        insight.type === 'success'
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : insight.type === 'warning'
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-blue-700 dark:text-blue-300'
                      }
                    >
                      {insight.title}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{insight.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CHARTS: MEAL SLOTS + DAILY PROGRESSION LINE CHART */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Meal Slot Averages vs Targets */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-blue-500" />
                    Meal Slot Averages ({settings.unit})
                  </h3>
                  <p className="text-xs text-slate-400">Mean blood sugar across daily measurement slots</p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mealSlotsChartData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                    <XAxis dataKey="slot" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderRadius: '12px',
                        border: 'none',
                        color: '#f8fafc',
                        fontSize: '11px',
                      }}
                      formatter={(val: any, _name: any, item: any) => [
                        `${val} ${settings.unit} (Target: < ${item.payload.targetLimit}, ${item.payload.inTargetPct}% in range)`,
                        'Average',
                      ]}
                    />
                    <Bar dataKey="average" radius={[8, 8, 0, 0]}>
                      {mealSlotsChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fillColor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Daily Progression Line Chart (Day by Day) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Daily Glycemic Progression ({settings.unit})
                  </h3>
                  <p className="text-xs text-slate-400">Fasting vs Post-Meal trends across consecutive days</p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyTrendsChartData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderRadius: '12px',
                        border: 'none',
                        color: '#f8fafc',
                        fontSize: '11px',
                      }}
                      formatter={(val: any, name: any) => [`${val} ${settings.unit}`, name]}
                    />
                    <ReferenceLine
                      y={convertFromInternal(settings.ranges.fasting.normalMax, settings.unit)}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      label={{
                        value: `Fasting Limit`,
                        fill: '#10b981',
                        fontSize: 9,
                        position: 'top',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Fasting"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#10b981' }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="Post-Meal"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#3b82f6' }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Chart 3: Day of Week Patterns */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  Day of Week Patterns ({settings.unit})
                </h3>
                <p className="text-xs text-slate-400">Assess weekday vs weekend glycemic variations</p>
              </div>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayOfWeekData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '11px',
                    }}
                    formatter={(val: any) => [`${val} ${settings.unit}`, 'Average']}
                  />
                  <Bar dataKey="average" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
