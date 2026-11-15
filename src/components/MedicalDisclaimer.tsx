import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';

interface MedicalDisclaimerProps {
  compact?: boolean;
}

export const MedicalDisclaimer: React.FC<MedicalDisclaimerProps> = ({ compact = false }) => {
  const [isExpanded, setIsExpanded] = useState(!compact);

  if (compact) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Medical Disclaimer & Screening Reference Notice</span>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-amber-700 dark:text-amber-400 hover:underline inline-flex items-center gap-1 font-medium"
          >
            {isExpanded ? 'Hide' : 'Read'}
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
        {isExpanded && (
          <p className="mt-2 text-amber-700/90 dark:text-amber-300/90 leading-relaxed">
            GlucoTrack Pro is intended solely for personal tracking and informational monitoring. The default reference
            thresholds represent general population screening guidelines (e.g. ADA general screening) and are not
            individualized clinical targets. This software does not provide medical diagnoses or treatment recommendations.
            Always consult a licensed physician or endocrinologist regarding your health metrics.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-emerald-50/80 dark:from-slate-900/90 dark:to-slate-900/70 border border-blue-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-xl text-blue-700 dark:text-blue-300 shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            Clinical Reference & Medical Notice
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Default thresholds (Fasting: 70–99 mg/dL normal, 100–125 prediabetes, 126+ screening; 2-hour post-meal: &lt;140 normal,
            140–199 elevated, 200+ screening) represent standard adult non-pregnant screening ranges. If you are diagnosed with
            diabetes or have unique glycemic goals, configure your targets in <strong>Settings</strong>. This tool never
            replaces professional medical evaluation.
          </p>
        </div>
      </div>
    </div>
  );
};
