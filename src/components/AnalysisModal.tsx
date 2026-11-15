import React from 'react';
import {
  X,
  Activity,
  Calendar,
  Clock,
  Utensils,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Edit2,
  Trash2,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { BloodSugarReading, AppSettings } from '../types';
import { analyzeReading, READING_TYPE_LABELS } from '../utils/analysis';
import { formatBloodSugar, formatDate, formatTime } from '../utils/conversions';

interface AnalysisModalProps {
  isOpen: boolean;
  reading: BloodSugarReading | null;
  previousReading?: BloodSugarReading | null;
  settings: AppSettings;
  onClose: () => void;
  onEdit?: (reading: BloodSugarReading) => void;
  onDelete?: (id: string) => void;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({
  isOpen,
  reading,
  previousReading,
  settings,
  onClose,
  onEdit,
  onDelete,
}) => {
  if (!isOpen || !reading) return null;

  const analysis = analyzeReading(reading, settings, previousReading);

  const getStatusStyles = () => {
    switch (analysis.status) {
      case 'normal':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/40',
          border: 'border-emerald-200 dark:border-emerald-800',
          text: 'text-emerald-700 dark:text-emerald-300',
          badge: 'bg-emerald-600 text-white',
          glow: 'shadow-emerald-100 dark:shadow-emerald-950/20',
        };
      case 'elevated':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/40',
          border: 'border-amber-200 dark:border-amber-800',
          text: 'text-amber-700 dark:text-amber-300',
          badge: 'bg-amber-500 text-white',
          glow: 'shadow-amber-100 dark:shadow-amber-950/20',
        };
      case 'high':
      case 'low':
        return {
          bg: 'bg-rose-50 dark:bg-rose-950/40',
          border: 'border-rose-200 dark:border-rose-800',
          text: 'text-rose-700 dark:text-rose-300',
          badge: 'bg-rose-600 text-white',
          glow: 'shadow-rose-100 dark:shadow-rose-950/20',
        };
      default:
        return {
          bg: 'bg-slate-50 dark:bg-slate-900',
          border: 'border-slate-200 dark:border-slate-800',
          text: 'text-slate-700 dark:text-slate-300',
          badge: 'bg-slate-600 text-white',
          glow: 'shadow-slate-100 dark:shadow-slate-950/20',
        };
    }
  };

  const style = getStatusStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Blood Sugar Clinical Analysis
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatDate(reading.date)} at {formatTime(reading.time)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Main Reading Card */}
          <div className={`p-5 rounded-2xl border ${style.border} ${style.bg} space-y-3`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${style.badge}`}>
                {analysis.label}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {READING_TYPE_LABELS[reading.type]}
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-1">
              <div>
                <span className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {formatBloodSugar(reading.value, settings.unit)}
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{analysis.targetRangeText}</p>
              </div>

              {analysis.comparisonWithPrevious && (
                <div className="flex flex-col items-end text-xs">
                  <div
                    className={`flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md ${
                      analysis.comparisonWithPrevious.trend === 'up'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                        : analysis.comparisonWithPrevious.trend === 'down'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {analysis.comparisonWithPrevious.trend === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
                    {analysis.comparisonWithPrevious.trend === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
                    {analysis.comparisonWithPrevious.trend === 'same' && <Minus className="w-3.5 h-3.5" />}
                    <span>
                      {analysis.comparisonWithPrevious.diff > 0 ? '+' : ''}
                      {formatBloodSugar(analysis.comparisonWithPrevious.diff, settings.unit)}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1">vs previous reading</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{analysis.title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {analysis.explanation}
              </p>
            </div>
          </div>

          {/* Clinical Recommendation Card */}
          <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Physiological Insights & Recommendation
            </h4>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {analysis.recommendation}
            </p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
              <div className="text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Date & Time</span>
              </div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {formatDate(reading.date)} • {formatTime(reading.time)}
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
              <div className="text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Measurement Type</span>
              </div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {READING_TYPE_LABELS[reading.type]}
              </p>
            </div>

            {reading.mealInfo && (
              <div className="col-span-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <div className="text-slate-400 flex items-center gap-1">
                  <Utensils className="w-3.5 h-3.5" />
                  <span>Meal Details</span>
                </div>
                <p className="font-medium text-slate-800 dark:text-slate-200">{reading.mealInfo}</p>
              </div>
            )}

            {(reading.notes || reading.comments) && (
              <div className="col-span-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <div className="text-slate-400 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Symptoms, Notes & Comments</span>
                </div>
                {reading.notes && <p className="font-medium text-slate-800 dark:text-slate-200">{reading.notes}</p>}
                {reading.comments && (
                  <p className="text-slate-600 dark:text-slate-400 italic text-[11px]">{reading.comments}</p>
                )}
              </div>
            )}
          </div>

          {/* Medical Notice */}
          <div className="p-3 bg-slate-100 dark:bg-slate-800/40 rounded-xl flex items-start gap-2.5 text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p>
              Reference ranges applied: <strong>{settings.targetProfile.replace('_', ' ')}</strong> mode. This reading
              analysis is algorithmic and informational.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                onClick={() => {
                  onDelete(reading.id);
                  onClose();
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => {
                  onEdit(reading);
                  onClose();
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition flex items-center gap-1.5"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
