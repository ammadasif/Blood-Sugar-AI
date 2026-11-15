import React, { useState } from 'react';
import {
  PlusCircle,
  Activity,
  Calendar,
  Clock,
  Utensils,
  FileText,
  MessageSquare,
  CheckCircle,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Table,
  Sliders,
} from 'lucide-react';
import { useBloodSugar } from '../context/BloodSugarContext';
import { ReadingType, BloodSugarReading } from '../types';
import { READING_TYPE_LABELS, analyzeReading } from '../utils/analysis';
import {
  convertToInternal,
  formatBloodSugar,
  getCurrentDate,
  getCurrentTime,
  convertFromInternal,
  formatDateDMY,
} from '../utils/conversions';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';

export const AddReadingView: React.FC = () => {
  const { addReading, settings, readings, setActiveTab } = useBloodSugar();

  // Mode: 'single' (one reading) vs 'day_matrix' (Log full day matching matrix format)
  const [entryMode, setEntryMode] = useState<'day_matrix' | 'single'>('day_matrix');

  // Single reading state
  const [date, setDate] = useState<string>(getCurrentDate());
  const [time, setTime] = useState<string>(getCurrentTime());
  const [valueInput, setValueInput] = useState<string>('');
  const [readingType, setReadingType] = useState<ReadingType>('fasting');
  const [mealInfo, setMealInfo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [comments, setComments] = useState<string>('');

  // Daily matrix multi-reading state
  const [matrixDate, setMatrixDate] = useState<string>(getCurrentDate());
  const [fastingVal, setFastingVal] = useState<string>('');
  const [breakfastVal, setBreakfastVal] = useState<string>('');
  const [lunchVal, setLunchVal] = useState<string>('');
  const [dinnerVal, setDinnerVal] = useState<string>('');
  const [dayNotes, setDayNotes] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [savedSuccessCount, setSavedSuccessCount] = useState<number | null>(null);

  // The previous reading chronologically to compare against
  const previousReading = readings.length > 0 ? readings[0] : null;

  // Real-time calculation for single reading preview
  const parsedNum = parseFloat(valueInput);
  const hasValidValue = !isNaN(parsedNum) && parsedNum > 0 && parsedNum <= 800;
  const internalValue = hasValidValue ? convertToInternal(parsedNum, settings.unit) : 0;

  const mockLiveReading: BloodSugarReading = {
    id: 'preview',
    date,
    time,
    value: internalValue,
    unitAtEntry: settings.unit,
    type: readingType,
    mealInfo: mealInfo.trim() || undefined,
    notes: notes.trim() || undefined,
    comments: comments.trim() || undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const liveAnalysis = hasValidValue
    ? analyzeReading(mockLiveReading, settings, previousReading)
    : null;

  // Single submit
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      setError('Please select a measurement date.');
      return;
    }
    if (!time) {
      setError('Please specify a measurement time.');
      return;
    }
    if (!hasValidValue) {
      setError(
        `Please enter a valid blood sugar reading between ${
          settings.unit === 'mmol/L' ? '1.0 and 44.0' : '20 and 800'
        } ${settings.unit}.`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await addReading({
        date,
        time,
        value: internalValue,
        unitAtEntry: settings.unit,
        type: readingType,
        mealInfo: mealInfo.trim() || undefined,
        notes: notes.trim() || undefined,
        comments: comments.trim() || undefined,
      });

      setSavedSuccessCount(1);
      setValueInput('');
      setMealInfo('');
      setNotes('');
      setComments('');
      setTime(getCurrentTime());
    } catch (err: any) {
      setError(err?.message || 'Failed to save blood sugar reading.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Matrix Full Day submit
  const handleMatrixSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matrixDate) {
      setError('Please choose a date for the daily log.');
      return;
    }

    const fNum = parseFloat(fastingVal);
    const bNum = parseFloat(breakfastVal);
    const lNum = parseFloat(lunchVal);
    const dNum = parseFloat(dinnerVal);

    const hasAny = (!isNaN(fNum) && fNum > 0) ||
      (!isNaN(bNum) && bNum > 0) ||
      (!isNaN(lNum) && lNum > 0) ||
      (!isNaN(dNum) && dNum > 0);

    if (!hasAny) {
      setError('Please enter at least one blood sugar reading for this date.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      let count = 0;

      // 1. Fasting
      if (!isNaN(fNum) && fNum > 0) {
        await addReading({
          date: matrixDate,
          time: '07:30',
          value: convertToInternal(fNum, settings.unit),
          unitAtEntry: settings.unit,
          type: 'fasting',
          notes: dayNotes ? `Fasting - ${dayNotes}` : undefined,
        });
        count++;
      }

      // 2. 2h Post-Breakfast
      if (!isNaN(bNum) && bNum > 0) {
        await addReading({
          date: matrixDate,
          time: '09:30',
          value: convertToInternal(bNum, settings.unit),
          unitAtEntry: settings.unit,
          type: '2h_after_meal',
          mealInfo: 'Breakfast',
          notes: '2 Hours After Breakfast',
        });
        count++;
      }

      // 3. 2h Post-Lunch
      if (!isNaN(lNum) && lNum > 0) {
        await addReading({
          date: matrixDate,
          time: '14:00',
          value: convertToInternal(lNum, settings.unit),
          unitAtEntry: settings.unit,
          type: '2h_after_meal',
          mealInfo: 'Lunch',
          notes: '2 Hours After Lunch',
        });
        count++;
      }

      // 4. 2h Post-Dinner
      if (!isNaN(dNum) && dNum > 0) {
        await addReading({
          date: matrixDate,
          time: '21:00',
          value: convertToInternal(dNum, settings.unit),
          unitAtEntry: settings.unit,
          type: '2h_after_meal',
          mealInfo: 'Dinner',
          notes: '2 Hours After Dinner',
        });
        count++;
      }

      setSavedSuccessCount(count);
      setFastingVal('');
      setBreakfastVal('');
      setLunchVal('');
      setDinnerVal('');
      setDayNotes('');
    } catch (err: any) {
      setError(err?.message || 'Failed to save daily readings.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <MedicalDisclaimer compact />

      {/* Entry Mode Switcher */}
      <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl w-full sm:w-fit sm:flex sm:items-center">
        <button
          type="button"
          onClick={() => {
            setEntryMode('day_matrix');
            setError(null);
          }}
          className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
            entryMode === 'day_matrix'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Table className="w-4 h-4 shrink-0" />
          <span className="truncate">Matrix (Full Day)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setEntryMode('single');
            setError(null);
          }}
          className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
            entryMode === 'single'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span className="truncate">Single Entry</span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {savedSuccessCount && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                {savedSuccessCount} {savedSuccessCount === 1 ? 'Reading' : 'Readings'} Recorded Successfully!
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Saved to your local IndexedDB journal. View in the Daily Logbook table.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('history')}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
            >
              <span>View Logbook</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setSavedSuccessCount(null)}
              className="p-1.5 text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 1: FULL DAY MATRIX ENTRY                                            */}
      {/* ========================================================================= */}
      {entryMode === 'day_matrix' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Table className="w-5 h-5 text-blue-600" />
              Daily Logbook Entry (Matrix Form)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter your morning fasting and 2-hour post-meal values for the day on one screen
            </p>
          </div>

          <form onSubmit={handleMatrixSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
                {error}
              </div>
            )}

            {/* Date Selector */}
            <div className="max-w-xs">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Date of Measurement *
              </label>
              <input
                type="date"
                value={matrixDate}
                onChange={(e) => setMatrixDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Format in table: {formatDateDMY(matrixDate)}
              </span>
            </div>

            {/* 4 Matrix Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1. Fasting */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-500" />
                    Fasting ({settings.unit})
                  </span>
                  <span className="text-[10px] text-slate-400">Target: 60–95 / &lt;100</span>
                </div>
                <input
                  type="number"
                  step={settings.unit === 'mmol/L' ? '0.1' : '1'}
                  value={fastingVal}
                  onChange={(e) => setFastingVal(e.target.value)}
                  placeholder="e.g. 97"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-extrabold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 block">Morning test before breakfast</span>
              </div>

              {/* 2. 2h After Breakfast */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-blue-500" />
                    2h After Breakfast ({settings.unit})
                  </span>
                  <span className="text-[10px] text-slate-400">Target: 70–125 / &lt;140</span>
                </div>
                <input
                  type="number"
                  step={settings.unit === 'mmol/L' ? '0.1' : '1'}
                  value={breakfastVal}
                  onChange={(e) => setBreakfastVal(e.target.value)}
                  placeholder="e.g. 160"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-extrabold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 block">2 hours post-breakfast test</span>
              </div>

              {/* 3. 2h After Lunch */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-indigo-500" />
                    2h After Lunch ({settings.unit})
                  </span>
                  <span className="text-[10px] text-slate-400">Target: 70–125 / &lt;140</span>
                </div>
                <input
                  type="number"
                  step={settings.unit === 'mmol/L' ? '0.1' : '1'}
                  value={lunchVal}
                  onChange={(e) => setLunchVal(e.target.value)}
                  placeholder="e.g. 114"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-extrabold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 block">2 hours post-lunch test</span>
              </div>

              {/* 4. 2h After Dinner */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-teal-500" />
                    2h After Dinner ({settings.unit})
                  </span>
                  <span className="text-[10px] text-slate-400">Target: 70–125 / &lt;140</span>
                </div>
                <input
                  type="number"
                  step={settings.unit === 'mmol/L' ? '0.1' : '1'}
                  value={dinnerVal}
                  onChange={(e) => setDinnerVal(e.target.value)}
                  placeholder="e.g. 134"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-extrabold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 block">2 hours post-dinner test</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Daily Notes or Symptoms (Optional)
              </label>
              <input
                type="text"
                value={dayNotes}
                onChange={(e) => setDayNotes(e.target.value)}
                placeholder="e.g. Good diet day, 30 min evening walk"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Table className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : "Save Day's Blood Sugar Log"}</span>
            </button>
          </form>
        </div>
      ) : (
        /* ========================================================================= */
        /* MODE 2: SINGLE READING ENTRY                                             */
        /* ========================================================================= */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-blue-600" />
                Single Measurement Entry
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Record an individual measurement with detailed meal notes and instant classification
              </p>
            </div>

            <form onSubmit={handleSingleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
                  {error}
                </div>
              )}

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Time
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              {/* Blood Sugar Level & Reading Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span>Level ({settings.unit}) *</span>
                    <span className="text-[10px] text-blue-600 font-medium">Unit: {settings.unit}</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step={settings.unit === 'mmol/L' ? '0.1' : '1'}
                      value={valueInput}
                      onChange={(e) => setValueInput(e.target.value)}
                      required
                      placeholder={settings.unit === 'mmol/L' ? '5.4' : '98'}
                      className="w-full pl-3 pr-12 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-extrabold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                      {settings.unit}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-slate-400" />
                    Reading Type *
                  </label>
                  <select
                    value={readingType}
                    onChange={(e) => setReadingType(e.target.value as ReadingType)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="fasting">Fasting (Pre-breakfast)</option>
                    <option value="before_meal">Before Meal (Pre-prandial)</option>
                    <option value="1h_after_meal">1 Hour After Meal</option>
                    <option value="2h_after_meal">2 Hours After Meal</option>
                    <option value="random">Random / Casual</option>
                  </select>
                </div>
              </div>

              {/* Meal Information */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-slate-400" />
                  Meal Information (Optional)
                </label>
                <input
                  type="text"
                  value={mealInfo}
                  onChange={(e) => setMealInfo(e.target.value)}
                  placeholder="e.g. Oatmeal with blueberries, grilled chicken salad"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notes / Symptoms */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Notes / Symptoms
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Mild headache, took 20 min walk, rested well"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{isSubmitting ? 'Recording...' : 'Record Single Reading'}</span>
              </button>
            </form>
          </div>

          {/* Right Preview Card */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Real-Time Clinical Analysis
                </h4>
                <span className="text-[11px] font-semibold text-slate-400">Live Preview</span>
              </div>

              {liveAnalysis ? (
                <div className="space-y-4 animate-fade-in">
                  <div
                    className={`p-4 rounded-2xl border ${
                      liveAnalysis.status === 'normal'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                        : liveAnalysis.status === 'elevated'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                          liveAnalysis.status === 'normal'
                            ? 'bg-emerald-600 text-white'
                            : liveAnalysis.status === 'elevated'
                            ? 'bg-amber-500 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {liveAnalysis.label}
                      </span>
                      <span className="text-xs font-medium opacity-80">{liveAnalysis.targetRangeText}</span>
                    </div>

                    <h5 className="text-base font-bold mt-2">{liveAnalysis.title}</h5>
                    <p className="text-xs mt-1 leading-relaxed opacity-90">{liveAnalysis.explanation}</p>
                  </div>

                  <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-2xl text-xs space-y-1">
                    <span className="font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 text-[10px]">
                      Guidance & Action
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      {liveAnalysis.recommendation}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                    <Activity className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-slate-400">
                    Type a blood sugar number above to see immediate physiological analysis and recommendations.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
