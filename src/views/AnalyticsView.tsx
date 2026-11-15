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
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useBloodSugar } from '../context/BloodSugarContext';
import { calculateEstimatedA1c, calculateVariability } from '../utils/analysis';
import {
  convertFromInternal,
  formatBloodSugar,
  formatDate,
  formatDateDMY,
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
  const { highestReading, lowestReading } = useMemo(() => {
    if (filteredReadings.length === 0) return { highestReading: null, lowestReading: null };
    const sorted = [...filteredReadings].sort((a, b) => b.value - a.value);
    return {
      highestReading: sorted[0],
      lowestReading: sorted[sorted.length - 1],
    };
  }, [filteredReadings]);

  // Time in Range (TIR) metrics based on international consensus
  const timeInRangeStats = useMemo(() => {
    if (filteredReadings.length === 0) {
      return { veryLow: 0, low: 0, inRange: 0, high: 0, veryHigh: 0, total: 0 };
    }

    const total = filteredReadings.length;
    let veryLow = 0; // < 54 mg/dL
    let low = 0; // 54 - 69 mg/dL
    let inRange = 0; // 70 - 180 mg/dL (or custom)
    let high = 0; // 181 - 250 mg/dL
    let veryHigh = 0; // > 250 mg/dL

    filteredReadings.forEach((r) => {
      const v = r.value;
      if (v < 54) veryLow++;
      else if (v < 70) low++;
      else if (v <= 180) inRange++;
      else if (v <= 250) high++;
      else veryHigh++;
    });

    return {
      veryLow: Math.round((veryLow / total) * 100),
      low: Math.round((low / total) * 100),
      inRange: Math.round((inRange / total) * 100),
      high: Math.round((high / total) * 100),
      veryHigh: Math.round((veryHigh / total) * 100),
      total,
    };
  }, [filteredReadings]);

  // Time of Day distribution (Morning, Afternoon, Evening, Night)
  const timeOfDayData = useMemo(() => {
    const bins: Record<string, number[]> = {
      'Morning (06-12)': [],
      'Afternoon (12-18)': [],
      'Evening (18-22)': [],
      'Night (22-06)': [],
    };

    filteredReadings.forEach((r) => {
      const hour = parseInt(r.time.split(':')[0], 10);
      if (hour >= 6 && hour < 12) bins['Morning (06-12)'].push(r.value);
      else if (hour >= 12 && hour < 18) bins['Afternoon (12-18)'].push(r.value);
      else if (hour >= 18 && hour < 22) bins['Evening (18-22)'].push(r.value);
      else bins['Night (22-06)'].push(r.value);
    });

    return Object.entries(bins).map(([slot, values]) => {
      const avg = values.length
        ? convertFromInternal(
            Math.round(values.reduce((s, v) => s + v, 0) / values.length),
            settings.unit
          )
        : 0;
      return {
        slot,
        average: avg,
        count: values.length,
      };
    });
  }, [filteredReadings, settings.unit]);

  // Day of Week trends
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
            {/* Estimated A1c */}
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

            {/* Glucose Variability */}
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

            {/* Time In Range (TIR) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Time In Range (TIR)</span>
                <Sparkles className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {timeInRangeStats.inRange}%
                </span>
                <span className="text-[11px] text-slate-400">Goal &gt; 70%</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Standard clinical target band (70–180 mg/dL).
              </p>
            </div>

            {/* Range Extremes (Highest / Lowest) */}
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
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {highestReading ? formatBloodSugar(highestReading.value, settings.unit) : '—'}
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                Avg: <strong className="text-slate-700 dark:text-slate-300">{formatBloodSugar(meanMgDl, settings.unit)}</strong> across {filteredReadings.length} tests
              </p>
            </div>
          </div>

          {/* Time In Range Stacked Breakdown Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                International Consensus Time in Range (TIR) Breakdown
              </h3>
              <p className="text-xs text-slate-400">Standardized clinical glycemic tiers</p>
            </div>

            {/* Multi-segment Bar */}
            <div className="h-6 w-full rounded-xl overflow-hidden flex shadow-inner bg-slate-100 dark:bg-slate-800">
              {timeInRangeStats.veryLow > 0 && (
                <div
                  style={{ width: `${timeInRangeStats.veryLow}%` }}
                  title={`Very Low (< 54 mg/dL): ${timeInRangeStats.veryLow}%`}
                  className="bg-red-600 h-full transition-all"
                />
              )}
              {timeInRangeStats.low > 0 && (
                <div
                  style={{ width: `${timeInRangeStats.low}%` }}
                  title={`Low (54-69 mg/dL): ${timeInRangeStats.low}%`}
                  className="bg-sky-500 h-full transition-all"
                />
              )}
              {timeInRangeStats.inRange > 0 && (
                <div
                  style={{ width: `${timeInRangeStats.inRange}%` }}
                  title={`In Range (70-180 mg/dL): ${timeInRangeStats.inRange}%`}
                  className="bg-emerald-500 h-full transition-all"
                />
              )}
              {timeInRangeStats.high > 0 && (
                <div
                  style={{ width: `${timeInRangeStats.high}%` }}
                  title={`High (181-250 mg/dL): ${timeInRangeStats.high}%`}
                  className="bg-amber-500 h-full transition-all"
                />
              )}
              {timeInRangeStats.veryHigh > 0 && (
                <div
                  style={{ width: `${timeInRangeStats.veryHigh}%` }}
                  title={`Very High (> 250 mg/dL): ${timeInRangeStats.veryHigh}%`}
                  className="bg-rose-700 h-full transition-all"
                />
              )}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-red-600 shrink-0" />
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{timeInRangeStats.veryLow}%</p>
                  <p className="text-[10px] text-slate-400">Very Low (&lt;54)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-sky-500 shrink-0" />
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{timeInRangeStats.low}%</p>
                  <p className="text-[10px] text-slate-400">Low (54–69)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-emerald-500 shrink-0" />
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{timeInRangeStats.inRange}%</p>
                  <p className="text-[10px] text-slate-400">In Range (70–180)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-amber-500 shrink-0" />
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{timeInRangeStats.high}%</p>
                  <p className="text-[10px] text-slate-400">High (181–250)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-rose-700 shrink-0" />
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{timeInRangeStats.veryHigh}%</p>
                  <p className="text-[10px] text-slate-400">Very High (&gt;250)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Hourly / Day-of-Week Distribution Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Time of Day */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    Time of Day Distribution ({settings.unit})
                  </h3>
                  <p className="text-xs text-slate-400">Average glucose levels during key periods</p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeOfDayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                    <XAxis dataKey="slot" tick={{ fontSize: 9, fill: '#94a3b8' }} />
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
                    <Bar dataKey="average" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Day of the Week */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    Day of Week Patterns ({settings.unit})
                  </h3>
                  <p className="text-xs text-slate-400">Assess weekday vs weekend glycemic variations</p>
                </div>
              </div>

              <div className="h-64 w-full">
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
                    <Bar dataKey="average" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
