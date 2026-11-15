import React, { useState } from 'react';
import { BloodSugarProvider, useBloodSugar } from './context/BloodSugarContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './views/DashboardView';
import { AddReadingView } from './views/AddReadingView';
import { HistoryView } from './views/HistoryView';
import { AnalyticsView } from './views/AnalyticsView';
import { ReportsView } from './views/ReportsView';
import { ImportExportView } from './views/ImportExportView';
import { SettingsView } from './views/SettingsView';
import { HeartPulse } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { activeTab, isLoading, syncNotice } = useBloodSugar();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'add_reading':
        return <AddReadingView />;
      case 'history':
        return <HistoryView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'reports':
        return <ReportsView />;
      case 'import_export':
        return <ImportExportView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-600 to-teal-500 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 animate-pulse">
          <HeartPulse className="w-8 h-8" />
        </div>
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
          Loading your blood sugar records...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Sidebar Navigation */}
      <Sidebar mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />

      {/* Main Content Area (offset by sidebar width on large screens) */}
      <div className="lg:pl-64 flex flex-col flex-1 min-h-screen transition-all">
        <Header onOpenMobileMenu={() => setMobileSidebarOpen(true)} />

        {/* Sync Toast Notification */}
        {syncNotice && (
          <div className="mx-4 mt-3 sm:mx-6 lg:mx-8 p-3.5 rounded-2xl bg-slate-900 text-white dark:bg-blue-950 dark:border dark:border-blue-800 shadow-xl flex items-center justify-between gap-3 animate-fade-in z-30">
            <div className="flex items-center gap-2.5 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{syncNotice}</span>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{renderActiveView()}</main>

        {/* Global Minimal Footer */}
        <footer className="border-t border-slate-200/60 dark:border-slate-800/60 py-4 px-6 text-center text-[11px] text-slate-400">
          GlucoTrack Pro • Client-Side Secure Health Journal • All data remains strictly on your device.
        </footer>
      </div>
    </div>
  );
};

export function App() {
  return (
    <BloodSugarProvider>
      <MainLayout />
    </BloodSugarProvider>
  );
}

export default App;

