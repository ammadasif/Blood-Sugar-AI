import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Printer,
  Calendar,
  Activity,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { useBloodSugar } from '../context/BloodSugarContext';
import { BloodSugarReading, PeriodSummary } from '../types';
import { analyzeReading, READING_TYPE_LABELS } from '../utils/analysis';
import {
  convertFromInternal,
  formatBloodSugar,
  formatDate,
  formatDateDMY,
  formatTime,
} from '../utils/conversions';
import { generatePDFReport } from '../services/pdfService';
import { exportToExcel } from '../services/excelService';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';

type ReportPeriod = 'all' | 'daily' | 'weekly' | 'monthly' | 'custom';

export const ReportsView: React.FC = () => {
  const { readings, settings } = useBloodSugar();

  // Find dataset boundary dates
  const { earliestDate, latestDate } = useMemo(() => {
    if (readings.length === 0) return { earliestDate: '', latestDate: '' };
    const dates = readings.map((r) => r.date).sort();
    return { earliestDate: dates[0], latestDate: dates[dates.length - 1] };
  }, [readings]);

  // Default to 'all' if all readings fall outside the last 30 days, else 'monthly'
  const [period, setPeriod] = useState<ReportPeriod>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Determine current active period date range
  const { currentReadings, previousReadings, periodLabel, prevPeriodLabel } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    let current: BloodSugarReading[] = [];
    let previous: BloodSugarReading[] = [];
    let pLabel = '';
    let prevLabel = '';

    if (period === 'all') {
      current = [...readings];
      previous = [];
      pLabel = earliestDate && latestDate
        ? `All Records (${formatDateDMY(earliestDate)} – ${formatDateDMY(latestDate)})`
        : 'All Recorded Data';
      prevLabel = 'None';
    } else if (period === 'daily') {
      pLabel = `Today (${formatDateDMY(todayStr)})`;
      prevLabel = 'Yesterday';
      current = readings.filter((r) => r.date === todayStr);

      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      previous = readings.filter((r) => r.date === yStr);
    } else if (period === 'weekly') {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      const sevenStr = sevenDaysAgo.toISOString().split('T')[0];

      const fourteenDaysAgo = new Date(now);
      fourteenDaysAgo.setDate(now.getDate() - 14);
      const fourteenStr = fourteenDaysAgo.toISOString().split('T')[0];

      pLabel = 'Last 7 Days';
      prevLabel = 'Previous 7 Days';

      current = readings.filter((r) => r.date >= sevenStr && r.date <= todayStr);
      previous = readings.filter((r) => r.date >= fourteenStr && r.date < sevenStr);
    } else if (period === 'monthly') {
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const thirtyStr = thirtyDaysAgo.toISOString().split('T')[0];

      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(now.getDate() - 60);
      const sixtyStr = sixtyDaysAgo.toISOString().split('T')[0];

      pLabel = 'Last 30 Days';
      prevLabel = 'Previous 30 Days';

      current = readings.filter((r) => r.date >= thirtyStr && r.date <= todayStr);
      previous = readings.filter((r) => r.date >= sixtyStr && r.date < thirtyStr);
    } else {
      // Custom Range
      const startDisplay = customStart ? formatDateDMY(customStart) : (earliestDate ? formatDateDMY(earliestDate) : 'Start');
      const endDisplay = customEnd ? formatDateDMY(customEnd) : (latestDate ? formatDateDMY(latestDate) : 'Present');
      pLabel = `Custom (${startDisplay} to ${endDisplay})`;
      prevLabel = 'Prior Equivalent Duration';

      current = readings.filter((r) => {
        if (customStart && r.date < customStart) return false;
        if (customEnd && r.date > customEnd) return false;
        return true;
      });

      // Calculate days in custom range for comparison
      const s = customStart ? new Date(customStart) : new Date(now.getTime() - 30 * 86400000);
      const e = customEnd ? new Date(customEnd) : now;
      const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000));

      const priorStart = new Date(s.getTime() - days * 86400000).toISOString().split('T')[0];
      const priorEnd = s.toISOString().split('T')[0];

      previous = readings.filter((r) => r.date >= priorStart && r.date < priorEnd);
    }

    return {
      currentReadings: current,
      previousReadings: previous,
      periodLabel: pLabel,
      prevPeriodLabel: prevLabel,
    };
  }, [readings, period, customStart, customEnd, earliestDate, latestDate]);

  // Generate Period Summary metrics
  const currentSummary: PeriodSummary = useMemo(() => {
    const totalCount = currentReadings.length;
    if (totalCount === 0) {
      return {
        periodLabel,
        totalCount: 0,
        averageOverall: 0,
        averageFasting: 0,
        averagePostMeal: 0,
        highest: null,
        lowest: null,
        normalCount: 0,
        elevatedCount: 0,
        highCount: 0,
        lowCount: 0,
        normalPercentage: 0,
        elevatedPercentage: 0,
        highPercentage: 0,
        lowPercentage: 0,
        fastingCount: 0,
        postMealCount: 0,
      };
    }

    const fasting = currentReadings.filter((r) => r.type === 'fasting');
    const postMeal = currentReadings.filter(
      (r) => r.type === '2h_after_meal' || r.type === '1h_after_meal'
    );

    const avgOverall = Math.round(currentReadings.reduce((s, r) => s + r.value, 0) / totalCount);
    const avgFasting = fasting.length
      ? Math.round(fasting.reduce((s, r) => s + r.value, 0) / fasting.length)
      : 0;
    const avgPostMeal = postMeal.length
      ? Math.round(postMeal.reduce((s, r) => s + r.value, 0) / postMeal.length)
      : 0;

    let normalCount = 0;
    let elevatedCount = 0;
    let highCount = 0;
    let lowCount = 0;

    currentReadings.forEach((r) => {
      const a = analyzeReading(r, settings);
      if (a.status === 'normal') normalCount++;
      else if (a.status === 'elevated') elevatedCount++;
      else if (a.status === 'high') highCount++;
      else if (a.status === 'low') lowCount++;
    });

    const sortedByVal = [...currentReadings].sort((a, b) => b.value - a.value);

    return {
      periodLabel,
      totalCount,
      averageOverall: avgOverall,
      averageFasting: avgFasting,
      averagePostMeal: avgPostMeal,
      highest: sortedByVal[0] || null,
      lowest: sortedByVal[sortedByVal.length - 1] || null,
      normalCount,
      elevatedCount,
      highCount,
      lowCount,
      normalPercentage: Math.round((normalCount / totalCount) * 100),
      elevatedPercentage: Math.round((elevatedCount / totalCount) * 100),
      highPercentage: Math.round((highCount / totalCount) * 100),
      lowPercentage: Math.round((lowCount / totalCount) * 100),
      fastingCount: fasting.length,
      postMealCount: postMeal.length,
    };
  }, [currentReadings, periodLabel, settings]);

  // Comparison vs. Prior Period
  const comparison = useMemo(() => {
    if (previousReadings.length === 0 || currentSummary.totalCount === 0) return null;
    const prevAvg = Math.round(
      previousReadings.reduce((s, r) => s + r.value, 0) / previousReadings.length
    );
    const diff = currentSummary.averageOverall - prevAvg;
    const pctChange = ((diff / prevAvg) * 100).toFixed(1);
    const trend = diff < -2 ? 'down' : diff > 2 ? 'up' : 'steady';

    return { prevAvg, diff, pctChange, trend };
  }, [previousReadings, currentSummary]);

  // Automated commentary
  const clinicalCommentary = useMemo(() => {
    if (currentSummary.totalCount === 0) {
      return 'No readings recorded for the selected timeframe. Record blood sugar readings or broaden your date range to generate a clinical analysis.';
    }

    const comments: string[] = [];

    if (currentSummary.normalPercentage >= 70) {
      comments.push(
        `Glycemic stability is strong with ${currentSummary.normalPercentage}% of readings falling within target reference ranges.`
      );
    } else if (currentSummary.normalPercentage >= 50) {
      comments.push(
        `Moderate glycemic control observed with ${currentSummary.normalPercentage}% within normal targets; ${
          currentSummary.elevatedPercentage + currentSummary.highPercentage
        }% were elevated or high.`
      );
    } else {
      comments.push(
        `High variability noted; only ${currentSummary.normalPercentage}% of readings were within target ranges. Clinical review recommended.`
      );
    }

    if (currentSummary.averageFasting > 0) {
      if (currentSummary.averageFasting < 100) {
        comments.push(
          `Your average fasting glucose (${formatBloodSugar(
            currentSummary.averageFasting,
            settings.unit
          )}) is within the optimal fasting reference tier.`
        );
      } else if (currentSummary.averageFasting <= 125) {
        comments.push(
          `Fasting averages (${formatBloodSugar(
            currentSummary.averageFasting,
            settings.unit
          )}) fall in the prediabetes screening threshold; consider evaluating evening carbohydrate intake.`
        );
      } else {
        comments.push(
          `Fasting averages (${formatBloodSugar(
            currentSummary.averageFasting,
            settings.unit
          )}) exceed standard screening thresholds (126+ mg/dL). Share this report with your physician.`
        );
      }
    }

    if (comparison) {
      if (comparison.trend === 'down') {
        comments.push(
          `Positive progress: overall average glucose decreased by ${Math.abs(
            Number(comparison.pctChange)
          )}% compared to ${prevPeriodLabel}.`
        );
      } else if (comparison.trend === 'up') {
        comments.push(
          `Average glucose increased by ${comparison.pctChange}% compared to ${prevPeriodLabel}.`
        );
      } else {
        comments.push(`Overall glucose levels remained steady compared to the prior period.`);
      }
    }

    return comments.join(' ');
  }, [currentSummary, comparison, prevPeriodLabel, settings.unit]);

  const handleFitToDataRange = () => {
    if (earliestDate && latestDate) {
      setCustomStart(earliestDate);
      setCustomEnd(latestDate);
      setPeriod('custom');
    }
  };

  // Actions
  const handleDownloadPDF = () => {
    if (currentReadings.length === 0) return;
    generatePDFReport(currentReadings, settings, currentSummary);
  };

  const handleDownloadExcel = () => {
    if (currentReadings.length === 0) return;
    exportToExcel(currentReadings, settings, `Report_${periodLabel}`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <MedicalDisclaimer compact />

      {/* Report Period Selector & Action Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Reporting Timeframe</h3>
              <p className="text-xs text-slate-400">Select aggregation window or custom range</p>
            </div>
          </div>

          {/* Period Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
            {[
              { id: 'all', label: 'All Records' },
              { id: 'daily', label: 'Daily (Today)' },
              { id: 'weekly', label: 'Weekly (Last 7 Days)' },
              { id: 'monthly', label: 'Monthly (Last 30 Days)' },
              { id: 'custom', label: 'Custom Range' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setPeriod(item.id as ReportPeriod)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  period === item.id
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Action Export Buttons */}
          <div className="grid grid-cols-3 sm:flex items-center gap-2 w-full lg:w-auto">
            <button
              onClick={handleDownloadExcel}
              disabled={currentReadings.length === 0}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition disabled:opacity-40"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={currentReadings.length === 0}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition disabled:opacity-40"
            >
              <FileText className="w-4 h-4" />
              <span>PDF</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={currentReadings.length === 0}
              title="Print Report"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <Printer className="w-4 h-4" />
              <span className="sm:hidden">Print</span>
            </button>
          </div>
        </div>

        {/* Custom Date Range Panel */}
        {period === 'custom' && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs animate-fade-in">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                Select Custom Dates:
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
      </div>

      {/* Printable Report Document Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-8 shadow-sm space-y-6 print:shadow-none print:border-none print:p-0">
        {/* Report Header */}
        <div className="border-b border-slate-100 dark:border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded-md">
                GLUCOTRACK PRO
              </span>
              <span className="text-xs text-slate-400">Clinical Evaluation Report</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              Glycemic Profile & Health Summary
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Evaluation Scope: <strong>{periodLabel}</strong> • Preferred Unit: <strong>{settings.unit}</strong>
            </p>
          </div>
          <div className="text-left sm:text-right text-xs text-slate-400">
            <p>Generated: {new Date().toLocaleDateString()}</p>
            <p>Target Profile: {settings.targetProfile.replace('_', ' ').toUpperCase()}</p>
          </div>
        </div>

        {/* Automated Commentary Banner */}
        <div className="p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-slate-800/80 dark:to-slate-800/40 border border-blue-100 dark:border-slate-700 rounded-2xl flex items-start gap-3">
          <div className="p-2 bg-blue-600 text-white rounded-xl shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-200">
              Automated Summary Commentary
            </h4>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {clinicalCommentary}
            </p>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Readings</span>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{currentSummary.totalCount}</p>
            <p className="text-[11px] text-slate-400">
              {currentSummary.fastingCount} Fasting / {currentSummary.postMealCount} Post-Meal
            </p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Average Fasting</span>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {currentSummary.averageFasting ? formatBloodSugar(currentSummary.averageFasting, settings.unit) : 'N/A'}
            </p>
            <p className="text-[11px] text-slate-400">Ref: &lt; 100 mg/dL</p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Average Post-Meal</span>
            <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
              {currentSummary.averagePostMeal ? formatBloodSugar(currentSummary.averagePostMeal, settings.unit) : 'N/A'}
            </p>
            <p className="text-[11px] text-slate-400">Ref: &lt; 140 mg/dL</p>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Extreme Values</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold text-rose-600">
                Max: {currentSummary.highest ? formatBloodSugar(currentSummary.highest.value, settings.unit) : '—'}
              </span>
            </div>
            <span className="text-xs font-bold text-teal-600 block">
              Min: {currentSummary.lowest ? formatBloodSugar(currentSummary.lowest.value, settings.unit) : '—'}
            </span>
          </div>
        </div>

        {/* Prior Period Trend Comparison Banner */}
        {comparison && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {comparison.trend === 'down' ? (
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <TrendingDown className="w-4 h-4" />
                </div>
              ) : comparison.trend === 'up' ? (
                <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                  <TrendingUp className="w-4 h-4" />
                </div>
              ) : (
                <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
                  <Activity className="w-4 h-4" />
                </div>
              )}
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Trend vs. Prior Period ({prevPeriodLabel}):
                </span>{' '}
                <span className="text-slate-600 dark:text-slate-400">
                  Prior average was {formatBloodSugar(comparison.prevAvg, settings.unit)} (change of{' '}
                  {comparison.diff > 0 ? '+' : ''}
                  {formatBloodSugar(comparison.diff, settings.unit)}, {comparison.pctChange}%)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Distribution Breakdown Percentages */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Reading Distribution Breakdown
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">Normal Range</span>
              <p className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
                {currentSummary.normalPercentage}%
              </p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                {currentSummary.normalCount} readings
              </p>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">Elevated</span>
              <p className="text-xl font-extrabold text-amber-700 dark:text-amber-400 mt-1">
                {currentSummary.elevatedPercentage}%
              </p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                {currentSummary.elevatedCount} readings
              </p>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
              <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300">High / Screening</span>
              <p className="text-xl font-extrabold text-rose-700 dark:text-rose-400 mt-1">
                {currentSummary.highPercentage}%
              </p>
              <p className="text-[10px] text-rose-600 dark:text-rose-400">{currentSummary.highCount} readings</p>
            </div>

            <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800">
              <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300">Low Glucose</span>
              <p className="text-xl font-extrabold text-sky-700 dark:text-sky-400 mt-1">
                {currentSummary.lowPercentage}%
              </p>
              <p className="text-[10px] text-sky-600 dark:text-sky-400">{currentSummary.lowCount} readings</p>
            </div>
          </div>
        </div>

        {/* Tabular List of Readings in Report */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Readings Recorded in Period ({currentReadings.length})
            </h4>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Swipe horizontally to inspect all details
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl -mx-1 sm:mx-0">
            <table className="w-full text-left text-xs min-w-[560px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 text-slate-500 font-semibold">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Blood Sugar</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Classification</th>
                  <th className="py-2.5 px-3">Notes & Symptoms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {currentReadings.length > 0 ? (
                  currentReadings.map((r) => {
                    const a = analyzeReading(r, settings);
                    return (
                      <tr key={r.id}>
                        <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-900 dark:text-white">
                          {formatDateDMY(r.date)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{formatTime(r.time)}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {formatBloodSugar(r.value, settings.unit)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">{READING_TYPE_LABELS[r.type]}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              a.status === 'normal'
                                ? 'text-emerald-600'
                                : a.status === 'elevated'
                                ? 'text-amber-600'
                                : 'text-rose-600'
                            }`}
                          >
                            {a.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 truncate max-w-xs">
                          {r.mealInfo || r.notes || '—'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                      No readings found for the selected timeframe.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Medical Disclaimer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 italic">
          MEDICAL DISCLAIMER: This document is for personal tracking and informational monitoring only. It does not provide medical diagnosis or replace clinical consultation with a licensed healthcare provider.
        </div>
      </div>
    </div>
  );
};
