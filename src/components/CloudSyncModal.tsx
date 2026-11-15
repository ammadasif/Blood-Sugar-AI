import React, { useState, useEffect } from 'react';
import {
  Cloud,
  X,
  Check,
  Copy,
  Smartphone,
  QrCode,
  RefreshCw,
  ArrowDownToLine,
  Upload,
  ShieldCheck,
  Info,
  Zap,
} from 'lucide-react';
import { useBloodSugar } from '../context/BloodSugarContext';
import { cloudSyncService } from '../services/cloudSyncService';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SyncTab = 'qr' | 'username';

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, readings, syncWithCloud, isSyncing } = useBloodSugar();

  const [activeTab, setActiveTab] = useState<SyncTab>('qr');
  const [inputUsername, setInputUsername] = useState(settings.username || '');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // QR Code state
  const [qrUrl, setQrUrl] = useState<string>('');
  const [qrImgUrl, setQrImgUrl] = useState<string>('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);

  if (!isOpen) return null;

  const cleanUser = cloudSyncService.sanitizeUsername(inputUsername);
  const mobileSyncUrl = cleanUser ? cloudSyncService.generateMobileSyncUrl(cleanUser) : '';

  // ─── QR CODE GENERATION ──────────────────────────────────────
  const handleGenerateQR = async () => {
    if (readings.length === 0) {
      setFeedbackMsg({ text: 'Koi readings nahi hain. Pehle readings add karein.', type: 'error' });
      return;
    }
    setQrLoading(true);
    setFeedbackMsg(null);
    try {
      const transferUrl = await cloudSyncService.generateQRTransferUrl(readings);
      setQrUrl(transferUrl);
      const imgUrl = cloudSyncService.getQRCodeImageUrl(transferUrl, 240);
      setQrImgUrl(imgUrl);
      setFeedbackMsg({
        text: `✅ QR Code ready! ${readings.length} readings encode ho gayi. Mobile se scan karein.`,
        type: 'success',
      });
    } catch (e) {
      setFeedbackMsg({ text: 'QR Code generate karne mein error aaya. Try again.', type: 'error' });
    } finally {
      setQrLoading(false);
    }
  };

  const handleCopyQrUrl = async () => {
    if (!qrUrl) return;
    try {
      await navigator.clipboard.writeText(qrUrl);
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 2500);
    } catch {}
  };

  // ─── USERNAME SYNC ──────────────────────────────────────────
  const handleSaveUsername = () => {
    if (!cleanUser) {
      setFeedbackMsg({ text: 'Valid username enter karein.', type: 'error' });
      return;
    }
    updateSettings({ username: cleanUser, cloudSyncEnabled: true });
    setFeedbackMsg({ text: `✅ Username '${cleanUser}' save ho gaya!`, type: 'success' });
  };

  const handleSync = async (mode: 'upload' | 'download' | 'merge') => {
    if (!cleanUser) {
      setFeedbackMsg({ text: 'Pehle username enter karein.', type: 'error' });
      return;
    }
    handleSaveUsername();
    setFeedbackMsg(null);
    const res = await syncWithCloud(cleanUser, mode);
    setFeedbackMsg({ text: res.message, type: res.success ? 'success' : 'error' });
  };

  const handleCopyMobileLink = async () => {
    if (!mobileSyncUrl) return;
    try {
      await navigator.clipboard.writeText(mobileSyncUrl);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Cross-Device Sync</h3>
              <p className="text-[11px] text-slate-400">Mobile ↔ Laptop data share karein</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3 pb-0">
          <button
            onClick={() => { setActiveTab('qr'); setFeedbackMsg(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'qr'
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            QR Code Transfer
            <span className="text-[9px] bg-emerald-500 text-white px-1.5 rounded-full font-bold">
              RECOMMENDED
            </span>
          </button>
          <button
            onClick={() => { setActiveTab('username'); setFeedbackMsg(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'username'
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Username Sync
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Feedback Message */}
          {feedbackMsg && (
            <div className={`p-3 rounded-2xl text-xs font-medium flex items-start gap-2 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : feedbackMsg.type === 'error'
                ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                : 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
            }`}>
              {feedbackMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <Info className="w-4 h-4 shrink-0 mt-0.5" />}
              <span className="whitespace-pre-wrap">{feedbackMsg.text}</span>
            </div>
          )}

          {/* ═══ QR CODE TAB ══════════════════════════════════ */}
          {activeTab === 'qr' && (
            <div className="space-y-4">
              {/* How it works */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900 space-y-2">
                <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Kaise kaam karta hai:
                </h4>
                <ol className="text-[11px] text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                  <li><strong>Laptop par:</strong> "Generate QR Code" click karein</li>
                  <li><strong>Mobile par:</strong> QR Code ko scan karein (Camera app)</li>
                  <li>Link open hote hi aapka data automatic import ho jayega ✅</li>
                </ol>
                <p className="text-[10px] text-blue-500 dark:text-blue-500">
                  🔒 No server, no account, no internet needed — data sirf QR mein hai
                </p>
              </div>

              {/* Generate Button */}
              <button
                type="button"
                onClick={handleGenerateQR}
                disabled={qrLoading || readings.length === 0}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm transition"
              >
                {qrLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <QrCode className="w-4 h-4" />
                )}
                {qrLoading ? 'Generating...' : `Generate QR Code (${readings.length} readings)`}
              </button>

              {/* QR Code Display */}
              {qrImgUrl && (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <div className="p-3 bg-white rounded-2xl border-2 border-blue-200 dark:border-blue-700 shadow-md inline-block">
                      <img
                        src={qrImgUrl}
                        alt="Sync QR Code"
                        className="w-48 h-48 sm:w-56 sm:h-56"
                        onError={() => setFeedbackMsg({ text: 'QR image load nahi hui. URL copy kar ke manually open karein.', type: 'error' })}
                      />
                    </div>
                  </div>

                  <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                    📱 Mobile camera se scan karein — link open hote hi data import ho jayega
                  </p>

                  {/* Copy URL fallback */}
                  <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <Smartphone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="flex-1 text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                      {qrUrl.slice(0, 60)}...
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyQrUrl}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold flex items-center gap-1 transition"
                    >
                      {qrCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {qrCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ USERNAME TAB ══════════════════════════════════ */}
          {activeTab === 'username' && (
            <div className="space-y-4">
              {/* Info */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-100 dark:border-amber-900">
                <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Username sync same device ke LocalStorage mein save karta hai. <strong>Sirf tab kaam karta hai jab dono devices ne pehle ek baar is app ko open kiya ho.</strong> QR Code method recommended hai.</span>
                </p>
              </div>

              {/* Username Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Sync Username:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputUsername}
                    onChange={(e) => setInputUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="e.g. ammad123"
                    className="flex-1 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleSync('merge')}
                    disabled={isSyncing || !cleanUser}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    Sync
                  </button>
                </div>
              </div>

              {/* Upload / Download buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSync('upload')}
                  disabled={isSyncing || !cleanUser}
                  className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-left flex items-center gap-2 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-xs"
                >
                  <div className="p-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    <Upload className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Push</p>
                    <p className="text-[10px] text-slate-400">Save locally</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleSync('download')}
                  disabled={isSyncing || !cleanUser}
                  className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-left flex items-center gap-2 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-xs"
                >
                  <div className="p-1.5 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Pull</p>
                    <p className="text-[10px] text-slate-400">Load from cache</p>
                  </div>
                </button>
              </div>

              {/* Mobile Link */}
              {cleanUser && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Mobile ka Link:
                  </label>
                  <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="flex-1 text-[11px] font-mono text-blue-600 dark:text-blue-400 truncate">
                      {mobileSyncUrl}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyMobileLink}
                      className="shrink-0 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                    >
                      {copyFeedback ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-[10px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Data sirf aapke device par — koi external server nahi</span>
            {settings.lastSyncTimestamp && (
              <span className="ml-auto">
                Last: {new Date(settings.lastSyncTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
