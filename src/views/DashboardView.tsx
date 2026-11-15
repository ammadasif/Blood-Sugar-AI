import React, { useState, useMemo } from 'react';
import {
  Activity,
  Calendar,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  Flame,
  PlusCircle,
  Eye,
  Filter,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { useBloodSugar } from '../context/BloodSugarContext';
import { BloodSugarReading, ReadingType } from '../types';
import { analyzeReading, READING_TYPE_LABELS } from '../utils/analysis';
import { convertFromInternal, formatBloodSugar, formatDate, formatTime } from '../utils/conversions';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';
import { AnalysisModal } from '../components/AnalysisModal';
import { EditReadingModal } from '../components/EditReadingModal';

type DateFilterType = 'all' | 'today' | '7days' | '30days' | 'this_month' | 'last_month' | 'custom';

export const DashboardView: React.FC = () => {
  const { readings, settings, setActiveTab, editReading, removeReading, loadSampleData } = useBloodSugar();

  const [dateFilter, setDateFilter] = useState<DateFilterType>('30days');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [selectedReadingForAnalysis, setSelectedReadingForAnalysis] = useState<BloodSugarReading | null>(null);
  const [selectedReadingForEdit, setSelectedReadingForEdit] = useState<BloodSugarReading | null>(null);

  // Filter readings based on active date range
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
      if (dateFilter === 'last_month') {
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return (
          readingDate.getFullYear() === prevMonth.getFullYear() &&
          readingDate.getMonth() === prevMonth.getMonth()
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

  // Aggregate KPI metrics
  const metrics = useMemo(() => {
    const totalCount = filteredReadings.length;
    if (totalCount === 0) {
      return {
        totalCount: 0,
        avgFasting: 0,
        avgNonFasting: 0,
        latest: null,
        lowest: null,
        highest: null,
        normalCount: 0,
        highCount: 0,
        lowCount: 0,
        elevatedCount: 0,
      };
    }

    const fastingReadings = filteredReadings.filter((r) => r.type === 'fasting');
    const nonFastingReadings = filteredReadings.filter((r) => r.type !== 'fasting');

    const avgFasting = fastingReadings.length
      ? Math.round(fastingReadings.reduce((sum, r) => sum + r.value, 0) / fastingReadings.length)
      : 0;

    const avgNonFasting = nonFastingReadings.length
      ? Math.round(nonFastingReadings.reduce((sum, r) => sum + r.value, 0) / nonFastingReadings.length)
      : 0;

    let lowest = filteredReadings[0];
    let highest = filteredReadings[0];
    let normalCount = 0;
    let highCount = 0;
    let lowCount = 0;
    let elevatedCount = 0;

    filteredReadings.forEach((r) => {
      if (r.value < lowest.value) lowest = r;
      if (r.value > highest.value) highest = r;

      const analysis = analyzeReading(r, settings);
      if (analysis.status === 'normal') normalCount++;
      else if (analysis.status === 'elevated') elevatedCount++;
      else if (analysis.status === 'high') highCount++;
      else if (analysis.status === 'low') lowCount++;
    });

    const latest = filteredReadings[0]; // Already sorted descending

    return {
      totalCount,
      avgFasting,
      avgNonFasting,
      latest,
      lowest,
      highest,
      normalCount,
      elevatedCount,
      highCount,
      lowCount,
    };
  }, [filteredReadings, settings]);

  // Chart 1: Blood Sugar Trends (Chronological asc)
  const trendsChartData = useMemo(() => {
    const chronological = [...filteredReadings].reverse();
    return chronological.map((r) => ({
      date: formatDate(r.date),
      rawDate: r.date,
      time: formatTime(r.time),
      type: READING_TYPE_LABELS[r.type],
      displayValue: convertFromInternal(r.value, settings.unit),
      valueMgDl: r.value,
      reading: r,
    }));
  }, [filteredReadings, settings.unit]);

  // Chart 2: Fasting vs Non-Fasting comparison by date
  const comparisonChartData = useMemo(() => {
    // Group by date
    const dateMap: Record<string, { fasting: number[]; nonFasting: number[] }> = {};
    filteredReadings.forEach((r) => {
      if (!dateMap[r.date]) {
        dateMap[r.date] = { fasting: [], nonFasting: [] };
      }
      if (r.type === 'fasting') {
        dateMap[r.date].fasting.push(r.value);
      } else {
        dateMap[r.date].nonFasting.push(r.value);
      }
    });

    return Object.entries(dateMap)
      .map(([date, group]) => {
        const avgF = group.fasting.length
          ? convertFromInternal(
              Math.round(group.fasting.reduce((s, v) => s + v, 0) / group.fasting.length),
              settings.unit
            )
          : null;
        const avgNF = group.nonFasting.length
          ? convertFromInternal(
              Math.round(group.nonFasting.reduce((s, v) => s + v, 0) / group.nonFasting.length),
              settings.unit
            )
          : null;

        return {
          date: formatDate(date),
          rawDate: date,
          Fasting: avgF,
          'Non-Fasting': avgNF,
        };
      })
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
      .slice(-10); // Show last 10 active dates for clear readability
  }, [filteredReadings, settings.unit]);

  // Chart 3: Monthly Average Blood Sugar
  const monthlyChartData = useMemo(() => {
    const monthMap: Record<string, number[]> = {};
    readings.forEach((r) => {
      const monthKey = r.date.substring(0, 7); // YYYY-MM
      if (!monthMap[monthKey]) monthMap[monthKey] = [];
      monthMap[monthKey].push(r.value);
    });

    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, values]) => {
        const avg = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
        const [year, month] = monthKey.split('-').map(Number);
        const dateObj = new Date(year, month - 1, 1);
        const label = dateObj.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

        return {
          month: label,
          average: convertFromInternal(avg, settings.unit),
          count: values.length,
        };
      });
  }, [readings, settings.unit]);

  // Chart 4: Reading Distribution Pie
  const distributionData = useMemo(() => {
    return [
      { name: 'Normal', value: metrics.normalCount, color: '#16a34a' }, // Green
      { name: 'Elevated', value: metrics.elevatedCount, color: '#f59e0b' }, // Amber
      { name: 'High', value: metrics.highCount, color: '#e11d48' }, // Rose/Red
      { name: 'Low', value: metrics.lowCount, color: '#0284c7' }, // Sky Blue / Low
    ].filter((item) => item.value > 0);
  }, [metrics]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Notice */}
      <MedicalDisclaimer compact />

      {/* Filter and Timeframe Selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Filter className="w-4 h-4 text-blue-500" />
          <span>Filter Timeframe:</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {[
            { id: 'today', label: 'Today' },
            { id: '7days', label: 'Last 7 Days' },
            { id: '30days', label: 'Last 30 Days' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
            { id: 'all', label: 'All Time' },
            { id: 'custom', label: 'Custom' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDateFilter(tab.id as DateFilterType)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                dateFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 pt-2 md:pt-0 w-full md:w-auto">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
            />
          </div>
        )}
      </div>

      {/* Empty State Banner if no readings recorded yet */}
      {readings.length === 0 && (
        <div className="p-8 bg-gradient-to-br from-blue-50 to-teal-50 dark:from-slate-900 dark:to-slate-800 border border-blue-200/80 dark:border-slate-700 rounded-3xl text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Welcome to GlucoTrack Pro</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Your personal, privacy-first blood sugar monitoring dashboard. All data stays securely in your browser.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setActiveTab('add_reading')}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record Your First Reading</span>
            </button>
            <button
              onClick={loadSampleData}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition flex items-center gap-2"
            >
              <span>Load 14-Day Sample History</span>
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Total Readings */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Readings</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {metrics.totalCount}
            </span>
            <span className="text-xs font-medium text-slate-400">in filter</span>
          </div>
        </div>

        {/* Average Fasting */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Fasting</span>
            <Clock className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {metrics.avgFasting ? formatBloodSugar(metrics.avgFasting, settings.unit) : '—'}
            </span>
            <span className="text-xs font-medium text-slate-400">Target &lt; 100</span>
          </div>
        </div>

        {/* Average Non-Fasting */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Non-Fasting</span>
            <Calendar className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
              {metrics.avgNonFasting ? formatBloodSugar(metrics.avgNonFasting, settings.unit) : '—'}
            </span>
            <span className="text-xs font-medium text-slate-400">Post-meal</span>
          </div>
        </div>

        {/* Latest Reading */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Latest Reading</span>
            <Activity className="w-4 h-4 text-teal-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {metrics.latest ? formatBloodSugar(metrics.latest.value, settings.unit) : '—'}
            </span>
            {metrics.latest && (
              <span className="text-[11px] font-medium text-slate-400 truncate max-w-[90px]">
                {formatDate(metrics.latest.date)}
              </span>
            )}
          </div>
        </div>

        {/* Lowest Recorded */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Lowest Recorded</span>
            <ArrowDownRight className="w-4 h-4 text-teal-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-teal-600 dark:text-teal-400">
              {metrics.lowest ? formatBloodSugar(metrics.lowest.value, settings.unit) : '—'}
            </span>
            {metrics.lowest && (
              <span className="text-[11px] font-medium text-slate-400 truncate max-w-[90px]">
                {formatDate(metrics.lowest.date)}
              </span>
            )}
          </div>
        </div>

        {/* Highest Recorded */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Highest Recorded</span>
            <ArrowUpRight className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400">
              {metrics.highest ? formatBloodSugar(metrics.highest.value, settings.unit) : '—'}
            </span>
            {metrics.highest && (
              <span className="text-[11px] font-medium text-slate-400 truncate max-w-[90px]">
                {formatDate(metrics.highest.date)}
              </span>
            )}
          </div>
        </div>

        {/* Normal Readings Count */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Normal Readings</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {metrics.normalCount}
            </span>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {metrics.totalCount ? Math.round((metrics.normalCount / metrics.totalCount) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* High / Low Attention Count */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Elevated & High</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400">
              {metrics.elevatedCount + metrics.highCount}
            </span>
            <span className="text-xs font-medium text-slate-400">
              {metrics.lowCount > 0 ? `(${metrics.lowCount} Low)` : 'Requires care'}
            </span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Blood Sugar Trends */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                Blood Sugar Trends ({settings.unit})
              </h3>
              <p className="text-xs text-slate-400">Sequential glucose reading values</p>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {trendsChartData.length} entries
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            {trendsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendsChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '11px',
                    }}
                    formatter={(val: any) => [`${val} ${settings.unit}`, 'Level']}
                    labelFormatter={(label, items) => {
                      const item = items[0]?.payload;
                      return item ? `${item.date} ${item.time} (${item.type})` : label;
                    }}
                  />
                  <ReferenceLine
                    y={convertFromInternal(settings.ranges.fasting.normalMax, settings.unit)}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{
                      value: `Fasting Ref (${convertFromInternal(settings.ranges.fasting.normalMax, settings.unit)})`,
                      fill: '#10b981',
                      fontSize: 9,
                      position: 'top',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="displayValue"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ fill: '#3b82f6', r: 3 }}
                    activeDot={{ r: 6, fill: '#2563eb' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No readings match the current filter.
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Fasting vs Non-Fasting */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" />
                Fasting vs. Non-Fasting Comparison
              </h3>
              <p className="text-xs text-slate-400">Daily average comparison ({settings.unit})</p>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            {comparisonChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="Fasting" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Non-Fasting" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No comparison data available for this range.
              </div>
            )}
          </div>
        </div>

        {/* Chart 3: Monthly Average Blood Sugar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-500" />
                Monthly Average Blood Sugar
              </h3>
              <p className="text-xs text-slate-400">Longitudinal monthly glycemic trends</p>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            {monthlyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.15} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '11px',
                    }}
                    formatter={(val: any) => [`${val} ${settings.unit}`, 'Avg Blood Sugar']}
                  />
                  <Bar dataKey="average" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Record more data across months to view monthly trends.
              </div>
            )}
          </div>
        </div>

        {/* Chart 4: Reading Distribution */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500" />
                Readings Classification Distribution
              </h3>
              <p className="text-xs text-slate-400">Proportion of normal, elevated, high & low</p>
            </div>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {distributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400">No readings to classify.</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Readings Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Measurements</h3>
            <p className="text-xs text-slate-400">Latest recorded blood sugar entries</p>
          </div>
          <button
            onClick={() => setActiveTab('history')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <span>View All History</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {filteredReadings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Blood Sugar</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Notes / Meal</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredReadings.slice(0, 5).map((r, idx) => {
                  const previous = filteredReadings[idx + 1] || null;
                  const analysis = analyzeReading(r, settings, previous);
                  const isNormal = analysis.status === 'normal';
                  const isElevated = analysis.status === 'elevated';
                  const isHighOrLow = analysis.status === 'high' || analysis.status === 'low';

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-medium">
                        {formatDate(r.date)} <span className="text-slate-400 ml-1">{formatTime(r.time)}</span>
                      </td>
                      <td className="py-3 px-3 font-bold text-sm text-slate-900 dark:text-white">
                        {formatBloodSugar(r.value, settings.unit)}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {READING_TYPE_LABELS[r.type]}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isNormal
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                              : isElevated
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                              : isHighOrLow
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {analysis.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {r.mealInfo || r.notes || '—'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setSelectedReadingForAnalysis(r)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition inline-flex items-center gap-1 font-semibold"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Analysis</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            No recent readings available for this filter.
          </div>
        )}
      </div>

      {/* Analysis Modal */}
      {selectedReadingForAnalysis && (
        <AnalysisModal
          isOpen={!!selectedReadingForAnalysis}
          reading={selectedReadingForAnalysis}
          previousReading={
            filteredReadings[
              filteredReadings.findIndex((r) => r.id === selectedReadingForAnalysis.id) + 1
            ] || null
          }
          settings={settings}
          onClose={() => setSelectedReadingForAnalysis(null)}
          onEdit={(r) => setSelectedReadingForEdit(r)}
          onDelete={(id) => removeReading(id)}
        />
      )}

      {/* Edit Reading Modal */}
      {selectedReadingForEdit && (
        <EditReadingModal
          isOpen={!!selectedReadingForEdit}
          reading={selectedReadingForEdit}
          settings={settings}
          onClose={() => setSelectedReadingForEdit(null)}
          onSave={async (updated) => {
            await editReading(updated);
          }}
        />
      )}
    </div>
  );
};
