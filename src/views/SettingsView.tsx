import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  Activity,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { useBloodSugar } from '../context/BloodSugarContext';
import { BloodSugarUnit, TargetProfile, TargetRangeConfig } from '../types';
import { DEFAULT_RANGES, DIABETES_MANAGEMENT_RANGES } from '../utils/analysis';
import { convertFromInternal, convertToInternal, formatBloodSugar } from '../utils/conversions';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { MedicalDisclaimer } from '../components/MedicalDisclaimer';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, readings, loadSampleData } = useBloodSugar();

  // Local form state
  const [unit, setUnit] = useState<BloodSugarUnit>(settings.unit);
  const [profile, setProfile] = useState<TargetProfile>(settings.targetProfile);
  const [storageLimit, setStorageLimit] = useState<number>(settings.storageLimit || 1000);
  const [autoDeleteOld, setAutoDeleteOld] = useState<boolean>(settings.autoDeleteOldReadings || false);

  // Range inputs (stored in user unit for display/editing, converted to mg/dL upon save)
  const [lowThreshold, setLowThreshold] = useState<number>(
    convertFromInternal(settings.ranges.lowThreshold, settings.unit)
  );

  const [fastingNormalMax, setFastingNormalMax] = useState<number>(
    convertFromInternal(settings.ranges.fasting.normalMax, settings.unit)
  );
  const [fastingElevatedMax, setFastingElevatedMax] = useState<number>(
    convertFromInternal(settings.ranges.fasting.elevatedMax, settings.unit)
  );

  const [postMeal2hNormalMax, setPostMeal2hNormalMax] = useState<number>(
    convertFromInternal(settings.ranges.afterMeal2h.normalMax, settings.unit)
  );
  const [postMeal2hElevatedMax, setPostMeal2hElevatedMax] = useState<number>(
    convertFromInternal(settings.ranges.afterMeal2h.elevatedMax, settings.unit)
  );

  const [postMeal1hNormalMax, setPostMeal1hNormalMax] = useState<number>(
    convertFromInternal(settings.ranges.afterMeal1h.normalMax, settings.unit)
  );
  const [postMeal1hElevatedMax, setPostMeal1hElevatedMax] = useState<number>(
    convertFromInternal(settings.ranges.afterMeal1h.elevatedMax, settings.unit)
  );

  const [randomNormalMax, setRandomNormalMax] = useState<number>(
    convertFromInternal(settings.ranges.random.normalMax, settings.unit)
  );
  const [randomElevatedMax, setRandomElevatedMax] = useState<number>(
    convertFromInternal(settings.ranges.random.elevatedMax, settings.unit)
  );

  // Modal & Notification states
  const [savedAlert, setSavedAlert] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showLoadSampleModal, setShowLoadSampleModal] = useState(false);

  // Handler for Profile Preset change
  const handleProfilePresetChange = (newProfile: TargetProfile) => {
    setProfile(newProfile);
    let targetRanges = DEFAULT_RANGES;
    if (newProfile === 'diagnosed_diabetes') {
      targetRanges = DIABETES_MANAGEMENT_RANGES;
    }
    // Update local inputs
    setLowThreshold(convertFromInternal(targetRanges.lowThreshold, unit));
    setFastingNormalMax(convertFromInternal(targetRanges.fasting.normalMax, unit));
    setFastingElevatedMax(convertFromInternal(targetRanges.fasting.elevatedMax, unit));
    setPostMeal2hNormalMax(convertFromInternal(targetRanges.afterMeal2h.normalMax, unit));
    setPostMeal2hElevatedMax(convertFromInternal(targetRanges.afterMeal2h.elevatedMax, unit));
    setPostMeal1hNormalMax(convertFromInternal(targetRanges.afterMeal1h.normalMax, unit));
    setPostMeal1hElevatedMax(convertFromInternal(targetRanges.afterMeal1h.elevatedMax, unit));
    setRandomNormalMax(convertFromInternal(targetRanges.random.normalMax, unit));
    setRandomElevatedMax(convertFromInternal(targetRanges.random.elevatedMax, unit));
  };

  // Handler for unit toggle
  const handleUnitChange = (newUnit: BloodSugarUnit) => {
    if (newUnit === unit) return;
    // Convert all current inputs to the new unit
    setLowThreshold(convertFromInternal(convertToInternal(lowThreshold, unit), newUnit));
    setFastingNormalMax(convertFromInternal(convertToInternal(fastingNormalMax, unit), newUnit));
    setFastingElevatedMax(convertFromInternal(convertToInternal(fastingElevatedMax, unit), newUnit));
    setPostMeal2hNormalMax(convertFromInternal(convertToInternal(postMeal2hNormalMax, unit), newUnit));
    setPostMeal2hElevatedMax(convertFromInternal(convertToInternal(postMeal2hElevatedMax, unit), newUnit));
    setPostMeal1hNormalMax(convertFromInternal(convertToInternal(postMeal1hNormalMax, unit), newUnit));
    setPostMeal1hElevatedMax(convertFromInternal(convertToInternal(postMeal1hElevatedMax, unit), newUnit));
    setRandomNormalMax(convertFromInternal(convertToInternal(randomNormalMax, unit), newUnit));
    setRandomElevatedMax(convertFromInternal(convertToInternal(randomElevatedMax, unit), newUnit));
    setUnit(newUnit);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();

    const newRanges: TargetRangeConfig = {
      lowThreshold: convertToInternal(lowThreshold, unit),
      fasting: {
        normalMax: convertToInternal(fastingNormalMax, unit),
        elevatedMax: convertToInternal(fastingElevatedMax, unit),
      },
      beforeMeal: {
        normalMax: convertToInternal(fastingNormalMax, unit),
        elevatedMax: convertToInternal(fastingElevatedMax, unit),
      },
      afterMeal1h: {
        normalMax: convertToInternal(postMeal1hNormalMax, unit),
        elevatedMax: convertToInternal(postMeal1hElevatedMax, unit),
      },
      afterMeal2h: {
        normalMax: convertToInternal(postMeal2hNormalMax, unit),
        elevatedMax: convertToInternal(postMeal2hElevatedMax, unit),
      },
      random: {
        normalMax: convertToInternal(randomNormalMax, unit),
        elevatedMax: convertToInternal(randomElevatedMax, unit),
      },
      veryHighThreshold: 250,
    };

    updateSettings({
      unit,
      targetProfile: profile,
      ranges: newRanges,
      storageLimit: Math.max(10, storageLimit),
      autoDeleteOldReadings: autoDeleteOld,
    });

    setSavedAlert(true);
    setTimeout(() => setSavedAlert(false), 4000);
  };

  const handleResetDefaults = () => {
    updateSettings({
      unit: 'mg/dL',
      targetProfile: 'general_screening',
      ranges: { ...DEFAULT_RANGES },
      storageLimit: 1000,
      autoDeleteOldReadings: false,
    });
    setUnit('mg/dL');
    setProfile('general_screening');
    setStorageLimit(1000);
    setAutoDeleteOld(false);
    handleProfilePresetChange('general_screening');
    setShowResetModal(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <MedicalDisclaimer compact />

      {savedAlert && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 animate-fade-in">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Settings and clinical reference ranges updated successfully!</span>
          </div>
          <button onClick={() => setSavedAlert(false)} className="underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Unit and Target Profile Selection */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-600" />
                Measurement Unit & Clinical Target Profile
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure preferred blood glucose unit and clinical guideline framework
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Unit Toggle */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Blood Sugar Measurement Unit
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleUnitChange('mg/dL')}
                  className={`p-3 rounded-2xl border text-left transition ${
                    unit === 'mg/dL'
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <p className="font-bold text-sm">mg/dL</p>
                  <p className="text-[11px] opacity-75">Milligrams per deciliter (US standard)</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleUnitChange('mmol/L')}
                  className={`p-3 rounded-2xl border text-left transition ${
                    unit === 'mmol/L'
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <p className="font-bold text-sm">mmol/L</p>
                  <p className="text-[11px] opacity-75">Millimoles per liter (UK/International)</p>
                </button>
              </div>
            </div>

            {/* Target Profile Preset */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Clinical Target Profile Preset
              </label>
              <select
                value={profile}
                onChange={(e) => handleProfilePresetChange(e.target.value as TargetProfile)}
                className="w-full px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                <option value="general_screening">
                  General Population Screening (Normal: Fasting 70-99, Post-meal &lt;140)
                </option>
                <option value="diagnosed_diabetes">
                  Diagnosed Diabetes Management (ADA Targets: Fasting 80-130, Post-meal &lt;180)
                </option>
                <option value="custom">Custom Ranges (Set Individual Thresholds Below)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Detailed Reference Ranges Config */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-600" />
              Configurable Blood Sugar Thresholds ({unit})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Customize upper and lower boundaries for each measurement category
            </p>
          </div>

          <div className="space-y-4">
            {/* Low Glucose Threshold */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Hypoglycemia / Low Blood Sugar Threshold
                </h4>
                <p className="text-[11px] text-slate-400">
                  Readings below this value trigger low blood sugar alerts and immediate carb guidance
                </p>
              </div>
              <div className="w-28">
                <input
                  type="number"
                  step={unit === 'mmol/L' ? '0.1' : '1'}
                  value={lowThreshold}
                  onChange={(e) => setLowThreshold(parseFloat(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Fasting Range */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Fasting Blood Sugar Thresholds</h4>
                  <p className="text-[11px] text-slate-400">General screening: 70–99 Normal, 100–125 Prediabetes, 126+ Screening</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Normal Range Upper Limit ({unit})</label>
                  <input
                    type="number"
                    step={unit === 'mmol/L' ? '0.1' : '1'}
                    value={fastingNormalMax}
                    onChange={(e) => setFastingNormalMax(parseFloat(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">
                    Prediabetes / Elevated Limit ({unit})
                  </label>
                  <input
                    type="number"
                    step={unit === 'mmol/L' ? '0.1' : '1'}
                    value={fastingElevatedMax}
                    onChange={(e) => setFastingElevatedMax(parseFloat(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* 2-Hour Post Meal Range */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    2 Hours After Meal (Post-Prandial) Thresholds
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    General reference: Below 140 Normal, 140–199 Elevated, 200+ Screening
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Normal Upper Limit ({unit})</label>
                  <input
                    type="number"
                    step={unit === 'mmol/L' ? '0.1' : '1'}
                    value={postMeal2hNormalMax}
                    onChange={(e) => setPostMeal2hNormalMax(parseFloat(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Elevated Upper Limit ({unit})</label>
                  <input
                    type="number"
                    step={unit === 'mmol/L' ? '0.1' : '1'}
                    value={postMeal2hElevatedMax}
                    onChange={(e) => setPostMeal2hElevatedMax(parseFloat(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* 1-Hour Post Meal Range */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    1 Hour After Meal Thresholds
                  </h4>
                  <p className="text-[11px] text-slate-400">Peak glycemic excursion timing</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Normal Target Limit ({unit})</label>
                  <input
                    type="number"
                    step={unit === 'mmol/L' ? '0.1' : '1'}
                    value={postMeal1hNormalMax}
                    onChange={(e) => setPostMeal1hNormalMax(parseFloat(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Elevated Upper Limit ({unit})</label>
                  <input
                    type="number"
                    step={unit === 'mmol/L' ? '0.1' : '1'}
                    value={postMeal1hElevatedMax}
                    onChange={(e) => setPostMeal1hElevatedMax(parseFloat(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Random Range */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Random / Casual Blood Sugar Thresholds
                  </h4>
                  <p className="text-[11px] text-slate-400">Contextual interpretation without strict fasting requirements</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Normal Range Limit ({unit})</label>
                  <input
                    type="number"
                    step={unit === 'mmol/L' ? '0.1' : '1'}
                    value={randomNormalMax}
                    onChange={(e) => setRandomNormalMax(parseFloat(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Elevated Casual Limit ({unit})</label>
                  <input
                    type="number"
                    step={unit === 'mmol/L' ? '0.1' : '1'}
                    value={randomElevatedMax}
                    onChange={(e) => setRandomElevatedMax(parseFloat(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Storage Limits & Retention Policy */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-indigo-600" />
              Local Storage Quota & Retention Policy
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Control storage capacity and automatic pruning of legacy readings
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Maximum Readings Capacity</h4>
                <p className="text-[11px] text-slate-400">
                  Current usage: <strong>{readings.length}</strong> of{' '}
                  <strong>{storageLimit.toLocaleString()}</strong> readings stored
                </p>
              </div>
              <div className="w-36">
                <input
                  type="number"
                  min="50"
                  max="50000"
                  step="50"
                  value={storageLimit}
                  onChange={(e) => setStorageLimit(parseInt(e.target.value, 10) || 1000)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start gap-3">
              <input
                type="checkbox"
                id="auto-delete-toggle"
                checked={autoDeleteOld}
                onChange={(e) => setAutoDeleteOld(e.target.checked)}
                className="mt-1 rounded text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="auto-delete-toggle" className="text-xs cursor-pointer space-y-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  Automatically delete oldest readings when limit is reached
                </span>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                  When enabled, recording reading #{storageLimit + 1} will automatically remove the oldest historical
                  record to preserve memory space.
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Demo / Sample Data Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Sample History Data</h4>
              <p className="text-[11px] text-slate-400">
                Populate your dashboard with realistic 14-day blood sugar logs for testing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowLoadSampleModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            Load 14-Day Sample History
          </button>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset to Defaults</span>
          </button>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-2xl text-xs font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-md shadow-blue-500/20 transition flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Save All Configurations</span>
          </button>
        </div>
      </form>

      {/* Reset Confirmation */}
      <ConfirmationModal
        isOpen={showResetModal}
        title="Reset Configuration to Factory Defaults?"
        message="This will reset your preferred unit to mg/dL, target profile to General Population Screening, and default storage limit to 1,000 readings. Existing readings will not be erased."
        confirmText="Reset Configuration"
        isDanger
        onConfirm={handleResetDefaults}
        onCancel={() => setShowResetModal(false)}
      />

      {/* Load Sample Data Confirmation */}
      <ConfirmationModal
        isOpen={showLoadSampleModal}
        title="Load 14-Day Sample Readings?"
        message="This will add 30+ realistic sample blood sugar entries covering fasting, post-breakfast, post-dinner, and random checks into your browser database."
        confirmText="Load Sample Data"
        onConfirm={async () => {
          await loadSampleData();
          setShowLoadSampleModal(false);
          setSavedAlert(true);
        }}
        onCancel={() => setShowLoadSampleModal(false)}
      />
    </div>
  );
};

