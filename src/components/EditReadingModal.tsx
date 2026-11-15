import React, { useState, useEffect } from 'react';
import { X, Save, Activity, Utensils, FileText } from 'lucide-react';
import { BloodSugarReading, ReadingType, AppSettings } from '../types';
import { READING_TYPE_LABELS, analyzeReading } from '../utils/analysis';
import { convertFromInternal, convertToInternal } from '../utils/conversions';

interface EditReadingModalProps {
  isOpen: boolean;
  reading: BloodSugarReading | null;
  settings: AppSettings;
  onClose: () => void;
  onSave: (updated: BloodSugarReading) => Promise<void>;
}

export const EditReadingModal: React.FC<EditReadingModalProps> = ({
  isOpen,
  reading,
  settings,
  onClose,
  onSave,
}) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [valueInput, setValueInput] = useState('');
  const [readingType, setReadingType] = useState<ReadingType>('fasting');
  const [mealInfo, setMealInfo] = useState('');
  const [notes, setNotes] = useState('');
  const [comments, setComments] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (reading) {
      setDate(reading.date);
      setTime(reading.time);
      setValueInput(String(convertFromInternal(reading.value, settings.unit)));
      setReadingType(reading.type);
      setMealInfo(reading.mealInfo || '');
      setNotes(reading.notes || '');
      setComments(reading.comments || '');
      setError(null);
    }
  }, [reading, settings.unit]);

  if (!isOpen || !reading) return null;

  const numVal = parseFloat(valueInput);
  const internalValue = !isNaN(numVal) ? convertToInternal(numVal, settings.unit) : 0;
  const previewReading: BloodSugarReading = {
    ...reading,
    date,
    time,
    value: internalValue,
    type: readingType,
  };
  const previewAnalysis = !isNaN(numVal) && numVal > 0 ? analyzeReading(previewReading, settings) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      setError('Date is required.');
      return;
    }
    if (!time) {
      setError('Time is required.');
      return;
    }
    if (isNaN(numVal) || numVal <= 0 || numVal > 800) {
      setError(`Please enter a valid blood sugar level in ${settings.unit}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({
        ...reading,
        date,
        time,
        value: internalValue,
        type: readingType,
        mealInfo: mealInfo.trim() || undefined,
        notes: notes.trim() || undefined,
        comments: comments.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update reading.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Edit Blood Sugar Reading</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Modify reading values and context</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Blood Sugar Value & Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Level ({settings.unit})
              </label>
              <input
                type="number"
                step={settings.unit === 'mmol/L' ? '0.1' : '1'}
                value={valueInput}
                onChange={(e) => setValueInput(e.target.value)}
                required
                placeholder={settings.unit === 'mmol/L' ? '5.4' : '98'}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Reading Type</label>
              <select
                value={readingType}
                onChange={(e) => setReadingType(e.target.value as ReadingType)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(READING_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Analysis Preview */}
          {previewAnalysis && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                previewAnalysis.status === 'normal'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : previewAnalysis.status === 'elevated'
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
              }`}
            >
              <div>
                <span className="font-bold uppercase tracking-wider">{previewAnalysis.label}: </span>
                <span>{previewAnalysis.title}</span>
              </div>
              <span className="text-[11px] opacity-80">{previewAnalysis.targetRangeText}</span>
            </div>
          )}

          {/* Meal Info */}
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

          {/* Notes and Symptoms */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Notes & Symptoms
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Felt dizzy, rested well, 30 min brisk walk"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Comments */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
              Additional Comments
            </label>
            <input
              type="text"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Optional notes for doctor or personal reference"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
