import React, { useState, useRef } from 'react';
import {
  User,
  Users,
  LogIn,
  LogOut,
  X,
  Check,
  FileSpreadsheet,
  FileCode,
  Upload,
  Download,
  ShieldCheck,
  Cloud,
  RotateCcw,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useBloodSugar } from '../context/BloodSugarContext';

interface UserAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserAccountModal: React.FC<UserAccountModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    loginUser,
    logoutUser,
    switchProfile,
    settings,
    updateSettings,
    readings,
    saveDataToFile,
    loadDataFromFile,
    backupReadingsToCloud,
    restoreReadingsFromCloud,
  } = useBloodSugar();

  const [usernameInput, setUsernameInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [firebaseUrl, setFirebaseUrl] = useState(settings.firebaseDbUrl || '');
  const [activeTab, setActiveTab] = useState<'profile' | 'cloud' | 'files'>('profile');
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) {
      setFeedback({ text: 'Please enter a username.', ok: false });
      return;
    }

    setIsProcessing(true);
    setFeedback(null);
    try {
      const user = await loginUser(
        usernameInput.trim(),
        displayNameInput.trim() || undefined,
        firebaseUrl.trim() || undefined
      );
      setFeedback({
        text: `Signed in as ${user.displayName}!`,
        ok: true,
      });
      setUsernameInput('');
      setDisplayNameInput('');
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Login failed', ok: false });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloudBackup = async () => {
    const targetUrl = firebaseUrl.trim() || settings.firebaseDbUrl;
    if (!targetUrl) {
      setFeedback({
        text: 'Please enter your Firebase Database URL to backup to cloud.',
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
        text: 'Please enter your Firebase Database URL to restore from cloud.',
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

  const handleSaveFile = (format: 'excel' | 'json') => {
    try {
      saveDataToFile(format);
      setFeedback({
        text: `Successfully saved ${readings.length} readings as ${format.toUpperCase()} file!`,
        ok: true,
      });
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Save failed', ok: false });
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFeedback(null);
    try {
      const result = await loadDataFromFile(file);
      setFeedback({
        text: `Loaded ${result.count} readings from ${file.name}! All dashboard charts updated.`,
        ok: true,
      });
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Failed to parse file.', ok: false });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const savedProfiles = settings.savedUsers || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">User Account & Profile</h3>
              <p className="text-xs text-slate-400">Manage active profile, real-time cloud and local backups</p>
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

        {/* Navigation Tabs */}
        <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
          <button
            onClick={() => {
              setActiveTab('profile');
              setFeedback(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Profile
          </button>

          <button
            onClick={() => {
              setActiveTab('cloud');
              setFeedback(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'cloud'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            Real-Time Cloud
          </button>

          <button
            onClick={() => {
              setActiveTab('files');
              setFeedback(null);
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'files'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            File Backup
          </button>
        </div>

        {/* ─── TAB 1: PROFILE ─── */}
        {activeTab === 'profile' && (
          <div className="space-y-4 animate-fade-in">
            {currentUser && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/60 dark:from-slate-800/80 dark:to-slate-800/40 border border-blue-100 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white font-extrabold flex items-center justify-center text-sm shadow-md shadow-blue-500/20">
                    {currentUser.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {currentUser.displayName}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      @{currentUser.username} • {readings.length} readings logged
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={logoutUser}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 text-xs font-semibold border border-slate-200 dark:border-slate-600 transition flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}

            {/* Switch or Add Profile */}
            <form onSubmit={handleSignIn} className="space-y-3 pt-1">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Switch or Add User Account
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500">Username *</label>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) =>
                      setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
                    }
                    placeholder="e.g. ammad"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500">Your Name (Optional)</label>
                  <input
                    type="text"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder="e.g. Ammad Asif"
                    className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/20 disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>{isProcessing ? 'Switching...' : 'Switch to this Account'}</span>
              </button>
            </form>

            {/* Saved Accounts */}
            {savedProfiles.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Saved Profiles on this Device
                </label>
                <div className="space-y-1.5">
                  {savedProfiles.map((p) => (
                    <div
                      key={p.username}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                        currentUser?.username === p.username
                          ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                          {p.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {p.displayName}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">@{p.username}</p>
                        </div>
                      </div>

                      {currentUser?.username === p.username ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => switchProfile(p.username)}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-blue-50 hover:text-blue-600 border border-slate-200 dark:border-slate-600 transition"
                        >
                          Select
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: REAL-TIME CLOUD ─── */}
        {activeTab === 'cloud' && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-blue-500" />
                  <span>Firebase Realtime Database URL</span>
                </label>
                <a
                  href="https://console.firebase.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 font-semibold"
                >
                  <span>Free Console</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <input
                type="text"
                value={firebaseUrl}
                onChange={(e) => setFirebaseUrl(e.target.value)}
                placeholder="e.g. https://my-blood-sugar-default-rtdb.firebaseio.com"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-slate-400">
                Active user: <strong>@{currentUser?.username || 'user'}</strong> • Cloud key: <code>users/{currentUser?.username || 'user'}.json</code>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleCloudBackup}
                disabled={isProcessing}
                className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Backup to Cloud</span>
              </button>

              <button
                type="button"
                onClick={handleCloudRestore}
                disabled={isProcessing}
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore from Cloud</span>
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB 3: FILE BACKUP ─── */}
        {activeTab === 'files' && (
          <div className="space-y-4 animate-fade-in">
            {/* Save Data File */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <Download className="w-4 h-4 text-emerald-500" />
                <span>Download Backup File ({readings.length} readings)</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSaveFile('json')}
                  disabled={readings.length === 0}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-blue-50 text-left transition disabled:opacity-50 flex items-center gap-2.5"
                >
                  <FileCode className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">JSON File (.json)</p>
                    <p className="text-[10px] text-slate-400">Full backup</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveFile('excel')}
                  disabled={readings.length === 0}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-emerald-50 text-left transition disabled:opacity-50 flex items-center gap-2.5"
                >
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Excel (.xlsx)</p>
                    <p className="text-[10px] text-slate-400">4-Column matrix</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Load Data File */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <Upload className="w-4 h-4 text-blue-500" />
                <span>Restore from Backup File (.xlsx, .json, .csv)</span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.json,.csv"
                onChange={handleFileSelected}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-blue-300 hover:border-blue-500 dark:border-slate-600 bg-white dark:bg-slate-800 text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-5 h-5 text-blue-600" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Choose File to Restore
                </span>
                <span className="text-[10px] text-slate-400">
                  Select your saved Excel or JSON backup file
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Client-side secure</span>
          </div>
          <span>{readings.length} readings logged</span>
        </div>
      </div>
    </div>
  );
};
