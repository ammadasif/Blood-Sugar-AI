import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  History,
  LineChart,
  FileSpreadsheet,
  ArrowUpDown,
  Settings,
  HeartPulse,
  Sun,
  Moon,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useBloodSugar } from '../context/BloodSugarContext';

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onMobileClose }) => {
  const { activeTab, setActiveTab, readings, settings, toggleTheme, currentUser } = useBloodSugar();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'add_reading', label: 'Add Reading', icon: PlusCircle },
    { id: 'history', label: 'Reading History', icon: History, count: readings.length },
    { id: 'analytics', label: 'Analytics', icon: LineChart },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'import_export', label: 'Import / Export', icon: ArrowUpDown },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleSelectTab = (id: string) => {
    setActiveTab(id);
    onMobileClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onMobileClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden animate-fade-in"
        />
      )}

      {/* Sidebar Content */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <HeartPulse className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                GlucoTrack <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-extrabold px-1.5 py-0.5 rounded-md">PRO</span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">Blood Sugar Analytics</p>
            </div>
          </div>
          <button
            onClick={onMobileClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                      isActive
                        ? 'bg-blue-700 text-blue-100'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Privacy & System Status Badge */}
        <div className="p-3 mx-3 mb-2 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>100% Local Storage</span>
            </div>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{settings.unit}</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>User: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{currentUser ? currentUser.displayName : 'Guest'}</strong></span>
            <span className="capitalize text-[10px] bg-slate-200/60 dark:bg-slate-700 px-2 py-0.5 rounded-md font-medium text-slate-600 dark:text-slate-300">
              {settings.targetProfile.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Bottom Theme & Help Bar */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {settings.theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-blue-500" />
                <span>Dark Mode</span>
              </>
            )}
          </button>

          <span className="text-[11px] text-slate-400 font-mono">v1.0</span>
        </div>
      </aside>
    </>
  );
};

