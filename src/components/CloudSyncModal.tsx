import React, { useState } from 'react';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  X,
  Check,
  Copy,
  Smartphone,
  Laptop,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useBloodSugar } from '../context/BloodSugarContext';
import { cloudSyncService } from '../services/cloudSyncService';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, readings, syncWithCloud, isSyncing } = useBloodSugar();

  const [inputUsername, setInputUsername] = useState(settings.username || '');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(
    null
  );

  if (!isOpen) return null;

  const cleanUser = cloudSyncService.sanitizeUsername(inputUsername);
  const mobileSyncUrl = cleanUser ? cloudSyncService.generateMobileSyncUrl(cleanUser) : '';

  const handleSaveUsername = () => {
    if (!cleanUser) {
      setFeedbackMsg({ text: 'Please enter a valid username.', type: 'error' });
      return;
    }
    updateSettings({ username: cleanUser, cloudSyncEnabled: true });
    setFeedbackMsg({ text: `Username '${cleanUser}' saved!`, type: 'success' });
  };

  const handleSyncMerge = async () => {
    if (!cleanUser) {
      setFeedbackMsg({ text: 'Please enter a username first.', type: 'error' });
      return;
    }
    handleSaveUsername();
    const res = await syncWithCloud(cleanUser, 'merge');
    setFeedbackMsg({
      text: res.message,
      type: res.success ? 'success' : 'error',
    });
  };

  const handleUploadOnly = async () => {
    if (!cleanUser) {
      setFeedbackMsg({ text: 'Please enter a username first.', type: 'error' });
      return;
    }
    handleSaveUsername();
    const res = await syncWithCloud(cleanUser, 'upload');
    setFeedbackMsg({
      text: res.message,
      type: res.success ? 'success' : 'error',
    });
  };

  const handleDownloadOnly = async () => {
    if (!cleanUser) {
      setFeedbackMsg({ text: 'Please enter a username first.', type: 'error' });
      return;
    }
    handleSaveUsername();
    const res = await syncWithCloud(cleanUser, 'download');
    setFeedbackMsg({
      text: res.message,
      type: res.success ? 'success' : 'error',
    });
  };

  const handleCopyMobileLink = async () => {
    if (!mobileSyncUrl) return;
    try {
      await navigator.clipboard.writeText(mobileSyncUrl);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    } catch {
      // Fallback
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Cloud className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Cross-Device Cloud Sync
              </h3>
              <p className="text-xs text-slate-400">
                Match by username to sync readings between Mobile & Laptop
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`p-3 rounded-2xl text-xs font-medium flex items-center gap-2 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : feedbackMsg.type === 'error'
                ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                : 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Username Input */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Your Personal Sync Username:</span>
            {settings.username && (
              <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
                Active: {settings.username}
              </span>
            )}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              placeholder="e.g. ammad or ammad123"
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleSyncMerge}
              disabled={isSyncing || !cleanUser}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Use this exact same username on your mobile and laptop to access the same records.
          </p>
        </div>

        {/* Sync Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleUploadOnly}
            disabled={isSyncing || !cleanUser}
            className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 text-left transition flex items-center gap-3 disabled:opacity-50"
          >
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <CloudUpload className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Push to Cloud</h4>
              <p className="text-[10px] text-slate-400">Upload {readings.length} local readings</p>
            </div>
          </button>

          <button
            type="button"
            onClick={handleDownloadOnly}
            disabled={isSyncing || !cleanUser}
            className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 text-left transition flex items-center gap-3 disabled:opacity-50"
          >
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              <CloudDownload className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Pull from Cloud</h4>
              <p className="text-[10px] text-slate-400">Download to this device</p>
            </div>
          </button>
        </div>

        {/* 1-Click Mobile Link Sharing Card */}
        {cleanUser && (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-slate-800/80 dark:to-slate-800/40 border border-blue-100 dark:border-slate-700 space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                How to open on Mobile (Direct Sync Link):
              </h4>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Open this link on your phone. It will automatically load your readings without any manual typing:
            </p>

            <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                {mobileSyncUrl}
              </span>
              <button
                type="button"
                onClick={handleCopyMobileLink}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 shrink-0 transition"
              >
                {copyFeedback ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Status Info Footer */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Local IndexedDB cache enabled (works offline)</span>
          </div>
          {settings.lastSyncTimestamp && (
            <span>
              Last Synced: {new Date(settings.lastSyncTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
