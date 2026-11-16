import React, { useState, useRef } from 'react';
import {
  HeartPulse,
  User,
  LogIn,
  RotateCcw,
  Upload,
  Cloud,
  Check,
  AlertCircle,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { useBloodSugar } from '../context/BloodSugarContext';

export const WelcomeScreen: React.FC = () => {
  const {
    loginUser,
    restoreReadingsFromCloud,
    loadDataFromFile,
    settings,
    updateSettings,
  } = useBloodSugar();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [firebaseUrl, setFirebaseUrl] = useState(settings.firebaseDbUrl || '');
  const [showCloudConfig, setShowCloudConfig] = useState(Boolean(settings.firebaseDbUrl));
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStartFresh = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanUser) {
      setFeedback({ text: 'Please enter a valid username.', ok: false });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      if (firebaseUrl.trim()) {
        updateSettings({ firebaseDbUrl: firebaseUrl.trim() });
      }
      await loginUser(cleanUser, displayName.trim() || undefined, firebaseUrl.trim() || undefined);
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Login failed', ok: false });
      setIsProcessing(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanUser) {
      setFeedback({ text: 'Please enter your username to restore readings for.', ok: false });
      return;
    }

    const targetUrl = firebaseUrl.trim() || settings.firebaseDbUrl;
    if (!targetUrl) {
      setShowCloudConfig(true);
      setFeedback({
        text: 'Please enter your Firebase Database URL below to restore from cloud.',
        ok: false,
      });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await restoreReadingsFromCloud(targetUrl, cleanUser);
      if (res.success) {
        await loginUser(cleanUser, displayName.trim() || undefined, targetUrl);
      } else {
        setFeedback({ text: res.message, ok: false });
      }
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Cloud restore failed.', ok: false });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'user';
    setIsProcessing(true);
    setFeedback(null);
    try {
      const res = await loadDataFromFile(file);
      await loginUser(cleanUser, displayName.trim() || undefined);
      setFeedback({
        text: `Successfully restored ${res.count} readings from file!`,
        ok: true,
      });
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Failed to parse file.', ok: false });
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6">
        {/* App Logo & Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/25">
            <HeartPulse className="w-8 h-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Welcome to GlucoTrack Pro
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter your username to set up your personal blood sugar logbook
          </p>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2.5 ${
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

        {/* Registration / Sign In Form */}
        <form onSubmit={handleStartFresh} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-500" />
              <span>Username *</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
              }
              placeholder="e.g. ammad"
              className="w-full mt-1.5 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              required
              autoFocus
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Your unique ID used to backup and restore your readings across all devices.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Your Name (Optional)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Ammad Asif"
              className="w-full mt-1.5 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Cloud Sync Config Toggle */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowCloudConfig(!showCloudConfig)}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>
                {showCloudConfig
                  ? 'Hide Real-Time Cloud Settings'
                  : 'Want real-time cloud sync across Laptop & Mobile? (Click here)'}
              </span>
            </button>

            {showCloudConfig && (
              <div className="mt-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2 animate-fade-in">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Firebase Realtime DB URL</span>
                  <a
                    href="https://console.firebase.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                  >
                    <span>Get free URL</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </label>
                <input
                  type="text"
                  value={firebaseUrl}
                  onChange={(e) => setFirebaseUrl(e.target.value)}
                  placeholder="e.g. https://my-sugar-db-default-rtdb.firebaseio.com"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-400 leading-normal">
                  Paste your free Firebase Realtime Database URL once. Both Laptop and Mobile will sync automatically in real time!
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{isProcessing ? 'Setting up...' : 'Start Fresh (New User)'}</span>
            </button>

            <button
              type="button"
              onClick={handleRestoreFromCloud}
              disabled={isProcessing || !username.trim()}
              className="w-full py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RotateCcw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>Restore Readings from Cloud</span>
            </button>
          </div>
        </form>

        {/* File Restore Alternative */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.json,.csv"
            onChange={handleFileRestore}
            className="hidden"
          />
          <span className="text-[11px] text-slate-400">Have a backup file?</span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File (.xlsx / .json)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
