import React, { useState, useRef } from 'react';
import {
  X,
  Cloud,
  Upload,
  Download,
  RotateCcw,
  Check,
  AlertCircle,
  FileSpreadsheet,
  FileCode,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { useBloodSugar } from '../context/BloodSugarContext';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'backup' | 'restore';
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'backup',
}) => {
  const {
    currentUser,
    readings,
    settings,
    updateSettings,
    backupReadingsToCloud,
    restoreReadingsFromCloud,
    saveDataToFile,
    loadDataFromFile,
  } = useBloodSugar();

  const [activeTab, setActiveTab] = useState<'backup' | 'restore'>(defaultMode);
  const [firebaseUrl, setFirebaseUrl] = useState(settings.firebaseDbUrl || '');
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleCloudBackup = async () => {
    const targetUrl = firebaseUrl.trim() || settings.firebaseDbUrl;
    if (!targetUrl) {
      setFeedback({
        text: 'Please enter your Firebase Database URL below to backup to cloud.',
        ok: false,
      });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await backupReadingsToCloud(targetUrl);
      setFeedback({ text: res.message, ok: res.success });
      if (res.success && targetUrl !== settings.firebaseDbUrl) {
        updateSettings({ firebaseDbUrl: targetUrl });
      }
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Cloud backup failed.', ok: false });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloudRestore = async () => {
    const targetUrl = firebaseUrl.trim() || settings.firebaseDbUrl;
    if (!targetUrl) {
      setFeedback({
        text: 'Please enter your Firebase Database URL below to restore from cloud.',
        ok: false,
      });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await restoreReadingsFromCloud(targetUrl);
      setFeedback({ text: res.message, ok: res.success });
      if (res.success && targetUrl !== settings.firebaseDbUrl) {
        updateSettings({ firebaseDbUrl: targetUrl });
      }
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Cloud restore failed.', ok: false });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSave = (format: 'excel' | 'json') => {
    try {
      saveDataToFile(format);
      setFeedback({
        text: `Saved ${readings.length} readings as ${format.toUpperCase()} file to your device!`,
        ok: true,
      });
    } catch (err: any) {
      setFeedback({ text: err?.message || 'File save failed', ok: false });
    }
  };

  const handleFileLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await loadDataFromFile(file);
      setFeedback({
        text: `Loaded ${res.count} readings from ${file.name}! All charts updated.`,
        ok: true,
      });
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Failed to parse file.', ok: false });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Backup & Restore Readings
              </h3>
              <p className="text-xs text-slate-400">
                Active user: <strong className="text-slate-700 dark:text-slate-200">@{currentUser?.username || 'user'}</strong> • {readings.length} readings
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

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
              feedback.ok
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {feedback.ok ? (
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Mode Tabs */}
        <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
          <button
            onClick={() => {
              setActiveTab('backup');
              setFeedback(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'backup'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Backup Readings
          </button>

          <button
            onClick={() => {
              setActiveTab('restore');
              setFeedback(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'restore'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restore Readings
          </button>
        </div>

        {/* ─── REAL-TIME CLOUD SECTION (FIREBASE) ─── */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 to-indigo-50/40 dark:from-slate-800/70 dark:to-slate-800/40 border border-blue-100 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-blue-600" />
              <span>Real-Time Cloud Sync (Firebase)</span>
            </h4>
            <a
              href="https://console.firebase.google.com"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 font-semibold"
            >
              <span>Get Free URL</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500">
              Firebase Realtime Database URL
            </label>
            <input
              type="text"
              value={firebaseUrl}
              onChange={(e) => setFirebaseUrl(e.target.value)}
              placeholder="e.g. https://my-blood-sugar-default-rtdb.firebaseio.com"
              className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {activeTab === 'backup' ? (
            <button
              type="button"
              onClick={handleCloudBackup}
              disabled={isProcessing}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Upload className={`w-4 h-4 ${isProcessing ? 'animate-bounce' : ''}`} />
              <span>{isProcessing ? 'Backing up to Cloud...' : `Backup ${readings.length} Readings to Cloud`}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCloudRestore}
              disabled={isProcessing}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <RotateCcw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{isProcessing ? 'Restoring from Cloud...' : 'Restore Readings from Cloud'}</span>
            </button>
          )}

          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
            Saves your readings directly under <code>users/{currentUser?.username || 'user'}.json</code> so any device can restore them instantly in real time!
          </p>
        </div>

        {/* ─── OFFLINE FILE BACKUP / RESTORE SECTION ─── */}
        <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {activeTab === 'backup' ? 'Or Download Offline File' : 'Or Restore from File'}
          </h4>

          {activeTab === 'backup' ? (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleFileSave('json')}
                disabled={readings.length === 0}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 text-left transition disabled:opacity-50 flex items-center gap-2.5"
              >
                <FileCode className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">JSON File (.json)</p>
                  <p className="text-[10px] text-slate-400">Full backup</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleFileSave('excel')}
                disabled={readings.length === 0}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 text-left transition disabled:opacity-50 flex items-center gap-2.5"
              >
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Excel Matrix (.xlsx)</p>
                  <p className="text-[10px] text-slate-400">4-Column logbook</p>
                </div>
              </button>
            </div>
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.json,.csv"
                onChange={handleFileLoad}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 dark:border-slate-700 dark:hover:border-blue-400 bg-slate-50 dark:bg-slate-800 text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-5 h-5 text-blue-600" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Choose Backup File (.json / .xlsx)
                </span>
                <span className="text-[10px] text-slate-400">
                  Select your saved backup file to restore records
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Secure & Private</span>
          </div>
          <span>{readings.length} readings</span>
        </div>
      </div>
    </div>
  );
};
