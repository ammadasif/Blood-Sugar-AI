import React, { useState } from 'react';
import {
  Cloud,
  X,
  Check,
  Copy,
  Smartphone,
  RefreshCw,
  ArrowDownToLine,
  Upload,
  ShieldCheck,
  Info,
  MessageCircle,
  Mail,
  Link2,
  Zap,
  QrCode,
} from 'lucide-react';
import { useBloodSugar } from '../context/BloodSugarContext';
import { cloudSyncService } from '../services/cloudSyncService';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SyncTab = 'share' | 'username';

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, readings, syncWithCloud, isSyncing } = useBloodSugar();

  const [activeTab, setActiveTab] = useState<SyncTab>('share');
  const [inputUsername, setInputUsername] = useState(settings.username || '');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Share link state
  const [shareUrl, setShareUrl] = useState<string>('');       // original long URL
  const [shortUrl, setShortUrl] = useState<string>('');       // tinyurl short
  const [qrImgUrl, setQrImgUrl] = useState<string>('');       // QR image of short URL
  const [shareLoading, setShareLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  if (!isOpen) return null;

  const cleanUser = cloudSyncService.sanitizeUsername(inputUsername);
  const mobileSyncUrl = cleanUser ? cloudSyncService.generateMobileSyncUrl(cleanUser) : '';

  // ─── GENERATE + SHORTEN LINK ────────────────────────────────
  const handleGenerateLink = async () => {
    if (readings.length === 0) {
      setFeedbackMsg({ text: 'Koi readings nahi hain. Pehle readings add karein.', type: 'error' });
      return;
    }
    setShareLoading(true);
    setShareUrl('');
    setShortUrl('');
    setQrImgUrl('');
    setFeedbackMsg({ text: '⏳ Link generate aur short ho raha hai...', type: 'info' });
    try {
      // 1. Build compressed import URL
      const longUrl = await cloudSyncService.generateQRTransferUrl(readings);
      setShareUrl(longUrl);

      // 2. Shorten via TinyURL
      const short = await cloudSyncService.shortenUrl(longUrl);
      setShortUrl(short);

      // 3. QR code from short URL (very scannable now!)
      setQrImgUrl(cloudSyncService.getQRCodeImageUrl(short, 240));

      setFeedbackMsg({
        text: `✅ Short link ready! ${readings.length} readings encode ho gayi.\nQR scan karein ya WhatsApp/Email se bhejein.`,
        type: 'success',
      });
    } catch {
      setFeedbackMsg({ text: 'Link generate karne mein error. Try again.', type: 'error' });
    } finally {
      setShareLoading(false);
    }
  };

  const displayUrl = shortUrl || shareUrl;

  const handleCopyLink = async () => {
    if (!displayUrl) return;
    try {
      await navigator.clipboard.writeText(displayUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {}
  };

  const handleWhatsApp = () => {
    if (!displayUrl) return;
    const msg = encodeURIComponent(`GlucoTrack data:\n${displayUrl}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const handleEmail = () => {
    if (!displayUrl) return;
    const sub = encodeURIComponent('GlucoTrack Blood Sugar Data - Sync Link');
    const body = encodeURIComponent(`Mobile par yeh link open karein:\n\n${displayUrl}\n\nLink open hote hi data automatic import ho jayega.`);
    window.open(`mailto:?subject=${sub}&body=${body}`, '_blank');
  };

  // ─── USERNAME SYNC ───────────────────────────────────────────
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
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3 pb-0">
          <button
            onClick={() => { setActiveTab('share'); setFeedbackMsg(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'share'
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Link Share
            <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-bold">BEST</span>
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
              {feedbackMsg.type === 'success'
                ? <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                : <Info className="w-4 h-4 shrink-0 mt-0.5" />}
              <span className="whitespace-pre-wrap">{feedbackMsg.text}</span>
            </div>
          )}

          {/* ═══ SHARE LINK TAB ══════════════════════════════════ */}
          {activeTab === 'share' && (
            <div className="space-y-4">

              {/* How it works */}
              <div className="p-3.5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 rounded-2xl border border-blue-100 dark:border-blue-900 space-y-2.5">
                <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  3 Steps mein sync:
                </h4>
                <div className="space-y-1.5">
                  {[
                    { step: '1', text: 'Neeche "Link Generate Karein" click karein', bold: false },
                    { step: '2', text: 'WhatsApp ya Email se apne mobile par bhejein', bold: false },
                    { step: '3', text: 'Mobile par link kholo → data automatic import!', bold: true },
                  ].map(({ step, text, bold }) => (
                    <div key={step} className="flex items-start gap-2 text-[11px] text-blue-700 dark:text-blue-400">
                      <span className="shrink-0 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center mt-0.5">{step}</span>
                      <span className={bold ? 'font-bold' : ''}>{text}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-blue-500 dark:text-blue-500 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Koi server nahi, koi account nahi — data sirf link mein
                </p>
              </div>

              {/* Generate Button */}
              <button
                type="button"
                onClick={handleGenerateLink}
                disabled={shareLoading || readings.length === 0}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm transition"
              >
                {shareLoading
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Link2 className="w-4 h-4" />}
                {shareLoading ? 'Generating...' : `Link Generate Karein (${readings.length} readings)`}
              </button>

              {/* Share Options — shown after link generated */}
              {displayUrl && (
                <div className="space-y-3">

                  {/* Short URL display + copy */}
                  <div className="flex items-center gap-2 p-3 bg-slate-900 dark:bg-black rounded-2xl border border-slate-700">
                    <div className="flex-1 overflow-hidden">
                      <p className="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">
                        {shortUrl ? '⚡ Short URL (Clean & Scannable)' : '🔗 Direct Transfer URL'}
                      </p>
                      <p className="text-xs sm:text-sm font-mono font-bold text-emerald-400 truncate">
                        {displayUrl}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
                    >
                      {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {linkCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  {/* QR Code (scannable in 1 second now because TinyURL is ~25 chars!) */}
                  {qrImgUrl && (
                    <div className="flex flex-col items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <div className="p-2.5 bg-white rounded-2xl border-2 border-emerald-400 shadow-md inline-block">
                        <img
                          src={qrImgUrl}
                          alt="Sync Short QR Code"
                          className="w-40 h-40 sm:w-48 sm:h-48"
                        />
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 text-center font-medium flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Ab QR Code direct camera se scan ho jayega (Short URL)</span>
                      </p>
                    </div>
                  )}

                  {/* Quick Share Buttons */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* WhatsApp */}
                    <button
                      type="button"
                      onClick={handleWhatsApp}
                      className="p-3 rounded-2xl bg-[#25D366] hover:bg-[#20b558] text-white flex items-center justify-center gap-2 font-bold text-sm shadow-sm transition active:scale-95"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span>WhatsApp</span>
                    </button>

                    {/* Email */}
                    <button
                      type="button"
                      onClick={handleEmail}
                      className="p-3 rounded-2xl bg-slate-700 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white flex items-center justify-center gap-2 font-bold text-sm shadow-sm transition active:scale-95"
                    >
                      <Mail className="w-5 h-5" />
                      <span>Email</span>
                    </button>
                  </div>

                  {/* Mobile instructions box */}
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium flex items-start gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        Mobile camera se scan karein ya WhatsApp link tap karein — 
                        <strong> automatically saari readings load ho jayengi!</strong> ✅
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ USERNAME TAB ══════════════════════════════════ */}
          {activeTab === 'username' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-100 dark:border-amber-900">
                <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Username sync is device ke LocalStorage mein save karta hai.
                    <strong> "Link Share" method zyada reliable hai</strong> — dono devices par kaam karta hai.
                  </span>
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

              {/* Upload / Download */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSync('upload')}
                  disabled={isSyncing || !cleanUser}
                  className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-left flex items-center gap-2 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  <div className="p-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    <Upload className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Push</p>
                    <p className="text-[10px] text-slate-400">Save locally</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleSync('download')}
                  disabled={isSyncing || !cleanUser}
                  className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-left flex items-center gap-2 disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  <div className="p-1.5 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Pull</p>
                    <p className="text-[10px] text-slate-400">Load from cache</p>
                  </div>
                </button>
              </div>

              {/* Mobile URL copy */}
              {cleanUser && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Smartphone className="w-3 h-3" /> Mobile Link:
                  </label>
                  <div className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="flex-1 text-[11px] font-mono text-blue-600 dark:text-blue-400 truncate">{mobileSyncUrl}</span>
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
