import React, { useMemo } from 'react';
import {
  LineChart as LineChartIcon,
  Activity,
  Flame,
  Clock,
  Calendar,
  Sparkles,
  Info,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { useBloodSugar } from '../context/BloodSugarContext';
import { calculateEstimatedA1c, calculateVariability } from '../utils/analysis';
import { convertFromInternal, formatBloodSugar } from '../utils/conversions';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';

export const AnalyticsView: React.FC = () => {
  const { readings, settings } = useBloodSugar();

  // All glucose readings values in mg/dL
  const valuesMgDl = useMemo(() => readings.map((r) => r.value), [readings]);

  // Overall Mean
  const meanMgDl = useMemo(() => {
    if (valuesMgDl.length === 0) return 0;
    return Math.round(valuesMgDl.reduce((a, b) => a + b, 0) / valuesMgDl.length);
  }, [valuesMgDl]);

  // Estimated A1c
  const estimatedA1c = useMemo(() => calculateEstimatedA1c(meanMgDl), [meanMgDl]);

  // Glycemic Variability (SD & CV)
  const variability = useMemo(() => calculateVariability(valuesMgDl), [valuesMgDl]);

  // Time in Range (TIR) metrics based on international consensus
  const timeInRangeStats = useMemo(() => {
    if (readings.length === 0) {
      return { veryLow: 0, low: 0, inRange: 0, high: 0, veryHigh: 0, total: 0 };
    }

    const total = readings.length;
    let veryLow = 0; // < 54 mg/dL
    let low = 0; // 54 - 69 mg/dL
    let inRange = 0; // 70 - 180 mg/dL (or custom)
    let high = 0; // 181 - 250 mg/dL
    let veryHigh = 0; // > 250 mg/dL

    readings.forEach((r) => {
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
  }, [readings]);

  // Time of Day distribution (Morning, Afternoon, Evening, Night)
  const timeOfDayData = useMemo(() => {
    const bins: Record<string, number[]> = {
      'Morning (06-12)': [],
      'Afternoon (12-18)': [],
      'Evening (18-22)': [],
      'Night (22-06)': [],
    };

    readings.forEach((r) => {
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
  }, [readings, settings.unit]);

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

    readings.forEach((r) => {
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
  }, [readings, settings.unit]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <MedicalDisclaimer compact />

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Estimated A1c */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-3xl p-6 shadow-lg shadow-blue-500/10 space-y-3">
          <div className="flex items-center justify-between text-blue-100">
            <span className="text-xs font-bold uppercase tracking-wider">Estimated HbA1c</span>
            <Activity className="w-5 h-5" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold tracking-tight">
              {estimatedA1c ? `${estimatedA1c}%` : '—'}
            </span>
            <span className="text-xs text-blue-200">ADAG clinical formula</span>
          </div>
          <p className="text-xs text-blue-100 leading-relaxed">
            Calculated from your overall average glucose ({formatBloodSugar(meanMgDl, settings.unit)}). General non-diabetic
            reference is &lt; 5.7%. Pre-diabetes is 5.7%–6.4%.
          </p>
        </div>

        {/* Glucose Variability */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Glycemic Variability (CV)</span>
            <Flame className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
              {variability ? `${variability.cv}%` : '—'}
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                variability && variability.cv <= 36
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              }`}
            >
              {variability && variability.cv <= 36 ? 'Stable (Target ≤ 36%)' : 'High Fluctuation'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Standard Deviation:{' '}
            <strong className="text-slate-700 dark:text-slate-300">
              {variability ? formatBloodSugar(variability.sd, settings.unit) : 'N/A'}
            </strong>
            . Lower variability protects vascular endothelium from oxidative stress.
          </p>
        </div>

        {/* Time In Range (TIR) Summary */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Time In Range (TIR)</span>
            <Sparkles className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {timeInRangeStats.inRange}%
            </span>
            <span className="text-xs text-slate-400">Clinical goal &gt; 70%</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Proportion of readings falling within the standard target interval (70–180 mg/dL).
          </p>
        </div>
      </div>

      {/* Time In Range Stacked Breakdown Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
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
    </div>
  );
};

