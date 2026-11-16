import React, { useState } from 'react';
import { Menu, Plus, RefreshCw, Bell, User } from 'lucide-react';
import { useBloodSugar } from '../context/BloodSugarContext';
import { UserAccountModal } from './UserAccountModal';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const { activeTab, setActiveTab, settings, updateSettings, readings, currentUser } = useBloodSugar();
  const [showAccountModal, setShowAccountModal] = useState(false);

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return { title: 'Health Overview & Trends', subtitle: 'Real-time glycemic monitoring & clinical distribution' };
      case 'add_reading':
        return { title: 'Record Blood Sugar', subtitle: 'Enter new measurement with instant classification' };
      case 'history':
        return { title: 'Measurement History', subtitle: 'Search, filter, edit and review complete logs' };
      case 'analytics':
        return { title: 'Glycemic Analytics', subtitle: 'Estimated A1c, variability and time in range' };
      case 'reports':
        return { title: 'Clinical Reports', subtitle: 'Automated summaries, PDF exports and print view' };
      case 'import_export':
        return { title: 'Data Import & Backup', subtitle: 'Excel, CSV, TXT & full encrypted JSON backup' };
      case 'settings':
        return { title: 'Settings & Clinical Ranges', subtitle: 'Configure target thresholds, units and storage limits' };
      default:
        return { title: 'GlucoTrack Pro', subtitle: 'Personal Health Dashboard' };
    }
  };

  const { title, subtitle } = getPageTitle();

  const toggleUnit = () => {
    const nextUnit = settings.unit === 'mg/dL' ? 'mmol/L' : 'mg/dL';
    updateSettings({ unit: nextUnit });
  };

  // Check if backup reminder is appropriate (if user has > 10 readings and no backup in 7 days)
  const showBackupReminder =
    readings.length >= 10 &&
    !settings.hasDismissedBackupWarning &&
    (!settings.lastBackupDate ||
      Date.now() - new Date(settings.lastBackupDate).getTime() > 7 * 24 * 60 * 60 * 1000);

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-3 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate max-w-[130px] sm:max-w-none">
              {title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Backup Reminder Banner */}
          {showBackupReminder && (
            <button
              onClick={() => setActiveTab('import_export')}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition animate-pulse"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Backup Recommended</span>
            </button>
          )}

          {/* User Account / Profile Button */}
          <button
            onClick={() => setShowAccountModal(true)}
            title={currentUser ? `Signed in as ${currentUser.displayName} (@${currentUser.username})` : 'Sign In / Select User Profile'}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              currentUser
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-200'
            }`}
          >
            {currentUser ? (
              <span className="w-5 h-5 rounded-lg bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">
                {currentUser.displayName.charAt(0).toUpperCase()}
              </span>
            ) : (
              <User className="w-3.5 h-3.5 text-blue-500" />
            )}
            <span className="truncate max-w-[80px] sm:max-w-[120px]">
              {currentUser ? currentUser.displayName : 'Sign In'}
            </span>
          </button>

          {/* Quick Unit Switcher Pill */}
          <button
            onClick={toggleUnit}
            title="Click to toggle between mg/dL and mmol/L"
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700/60 transition"
          >
            <RefreshCw className="w-3 h-3 text-blue-500" />
            <span>{settings.unit}</span>
          </button>

          {/* Quick Add Reading Button */}
          {activeTab !== 'add_reading' && (
            <button
              onClick={() => setActiveTab('add_reading')}
              className="flex items-center gap-1 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm shadow-blue-500/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Reading</span>
            </button>
          )}
        </div>
      </header>

      {/* User Account Modal */}
      <UserAccountModal isOpen={showAccountModal} onClose={() => setShowAccountModal(false)} />
    </>
  );
};
