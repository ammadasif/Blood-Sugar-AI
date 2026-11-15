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
} from '../utils/conversions';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';

export const AddReadingView: React.FC = () => {
  const { addReading, settings, readings, setActiveTab } = useBloodSugar();

  const [date, setDate] = useState<string>(getCurrentDate());
  const [time, setTime] = useState<string>(getCurrentTime());
  const [valueInput, setValueInput] = useState<string>('');
  const [readingType, setReadingType] = useState<ReadingType>('fasting');
  const [mealInfo, setMealInfo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [comments, setComments] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [savedSuccessReading, setSavedSuccessReading] = useState<BloodSugarReading | null>(null);

  // The previous reading chronologically to compare against
  const previousReading = readings.length > 0 ? readings[0] : null;

  // Real-time calculation for live analysis preview
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

  // Quick preset helper
  const applyPreset = (type: ReadingType, timePreset: string, mealDefault?: string) => {
    setReadingType(type);
    setTime(timePreset);
    if (mealDefault) setMealInfo(mealDefault);
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

      const saved = await addReading({
        date,
        time,
        value: internalValue,
        unitAtEntry: settings.unit,
        type: readingType,
        mealInfo: mealInfo.trim() || undefined,
        notes: notes.trim() || undefined,
        comments: comments.trim() || undefined,
      });

      setSavedSuccessReading(saved);
      // Reset value and notes for next entry while keeping date
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <MedicalDisclaimer compact />

      {/* Success Notification Banner */}
      {savedSuccessReading && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                Reading Recorded Successfully!
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                {formatBloodSugar(savedSuccessReading.value, settings.unit)} ({READING_TYPE_LABELS[savedSuccessReading.type]}) on{' '}
                {savedSuccessReading.date} at {savedSuccessReading.time}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('history')}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
            >
              <span>View In History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setSavedSuccessReading(null)}
              className="p-1.5 text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Entry Form + Live Clinical Analysis Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Container (7 Cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-blue-600" />
              New Reading Entry
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Input your blood sugar test values. Classification happens automatically.
            </p>
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Quick Timing Presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset('fasting', '07:30')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-600 transition"
              >
                Fasting (Morning)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('2h_after_meal', '09:30', 'Breakfast')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-600 transition"
              >
                2h Post-Breakfast
              </button>
              <button
                type="button"
                onClick={() => applyPreset('2h_after_meal', '14:30', 'Lunch')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-600 transition"
              >
                2h Post-Lunch
              </button>
              <button
                type="button"
                onClick={() => applyPreset('2h_after_meal', '20:30', 'Dinner')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-600 transition"
              >
                2h Post-Dinner
              </button>
              <button
                type="button"
                onClick={() => applyPreset('random', getCurrentTime())}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-600 transition"
              >
                Random Now
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="e.g. Rolled oats with almond milk, 2 scrambled eggs"
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

            {/* Additional Comments */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                Additional Comments
              </label>
              <textarea
                rows={2}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Any special circumstances or context for this reading..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{isSubmitting ? 'Recording...' : 'Record Blood Sugar Reading'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Live Automatic Analysis & Feedback Card (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Real-Time Clinical Analysis
              </h4>
              <span className="text-[11px] font-semibold text-slate-400">Live Feedback</span>
            </div>

            {liveAnalysis ? (
              <div className="space-y-4 animate-fade-in">
                {/* Status Box */}
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

                {/* Recommendation */}
                <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-2xl text-xs space-y-1">
                  <span className="font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 text-[10px]">
                    Guidance & Action
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {liveAnalysis.recommendation}
                  </p>
                </div>

                {/* Previous Reading Comparison */}
                {liveAnalysis.comparisonWithPrevious ? (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Comparison with Previous</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {liveAnalysis.comparisonWithPrevious.previousDate} (
                        {formatBloodSugar(liveAnalysis.comparisonWithPrevious.previousValue, settings.unit)})
                      </span>
                    </div>

                    <div
                      className={`flex items-center gap-1 font-bold px-2 py-1 rounded-xl text-xs ${
                        liveAnalysis.comparisonWithPrevious.trend === 'up'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                          : liveAnalysis.comparisonWithPrevious.trend === 'down'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {liveAnalysis.comparisonWithPrevious.trend === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
                      {liveAnalysis.comparisonWithPrevious.trend === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
                      <span>
                        {liveAnalysis.comparisonWithPrevious.diff > 0 ? '+' : ''}
                        {formatBloodSugar(liveAnalysis.comparisonWithPrevious.diff, settings.unit)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-xs text-slate-400 text-center">
                    This will be recorded as your initial baseline reading.
                  </div>
                )}
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

          {/* Target Profile Summary Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl text-xs space-y-2">
            <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
              <span>Active Target Profile</span>
              <span className="capitalize text-blue-600 dark:text-blue-400">
                {settings.targetProfile.replace('_', ' ')}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <p>• Fasting Target: &lt; {formatBloodSugar(settings.ranges.fasting.normalMax, settings.unit)}</p>
              <p>• 2h Post-Meal: &lt; {formatBloodSugar(settings.ranges.afterMeal2h.normalMax, settings.unit)}</p>
              <p>• Low Glucose Threshold: &lt; {formatBloodSugar(settings.ranges.lowThreshold, settings.unit)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

