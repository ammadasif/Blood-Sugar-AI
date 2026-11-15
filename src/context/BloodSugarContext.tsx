import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { BloodSugarReading, AppSettings } from '../types';
import { dbService } from '../services/indexedDB';
import { settingsService } from '../services/settingsStorage';
import { generateSampleReadings } from '../utils/sampleData';
import { cloudSyncService, SyncResult } from '../services/cloudSyncService';

interface BloodSugarContextType {
  readings: BloodSugarReading[];
  settings: AppSettings;
  isLoading: boolean;
  isSyncing: boolean;
  syncNotice: string | null;
  addReading: (reading: Omit<BloodSugarReading, 'id' | 'createdAt' | 'updatedAt'>) => Promise<BloodSugarReading>;
  editReading: (reading: BloodSugarReading) => Promise<BloodSugarReading>;
  removeReading: (id: string) => Promise<void>;
  removeMultipleReadings: (ids: string[]) => Promise<void>;
  importReadings: (newReadings: BloodSugarReading[]) => Promise<number>;
  clearAllData: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => void;
  loadSampleData: () => Promise<void>;
  markBackupCompleted: () => void;
  syncWithCloud: (manualUser?: string, mode?: 'upload' | 'download' | 'merge') => Promise<SyncResult>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  toggleTheme: () => void;
}

const BloodSugarContext = createContext<BloodSugarContextType | undefined>(undefined);

export const BloodSugarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [readings, setReadings] = useState<BloodSugarReading[]>([]);
  const [settings, setSettings] = useState<AppSettings>(settingsService.getSettings());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const readingsRef = useRef<BloodSugarReading[]>([]);
  readingsRef.current = readings;

  const settingsRef = useRef<AppSettings>(settings);
  settingsRef.current = settings;

  // Load readings from IndexedDB
  const reloadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await dbService.getAllReadings();
      setReadings(data);
    } catch (err) {
      console.error('Failed to load readings from IndexedDB:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Synchronize theme with DOM
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  // Cloud Sync Handler
  const syncWithCloud = useCallback(
    async (
      manualUser?: string,
      mode: 'upload' | 'download' | 'merge' = 'merge'
    ): Promise<SyncResult> => {
      const activeUser = manualUser || settingsRef.current.username;
      if (!activeUser) {
        return { success: false, message: 'Please enter a username to sync your devices.' };
      }

      setIsSyncing(true);
      setSyncNotice('Connecting to cloud sync...');

      try {
        const cleanUser = cloudSyncService.sanitizeUsername(activeUser);

        // 1. DOWNLOAD OR MERGE MODE: Pull remote first
        if (mode === 'download' || mode === 'merge') {
          const pullRes = await cloudSyncService.pullFromCloud(cleanUser, settingsRef.current);
          if (pullRes.success && pullRes.payload?.readings) {
            const currentLocal = await dbService.getAllReadings();

            if (mode === 'download') {
              // Direct replace with remote
              await dbService.clearAllReadings();
              await dbService.bulkAddReadings(pullRes.payload.readings);
              await reloadData();
              const msg = `Synced ${pullRes.payload.readings.length} readings from device profile '${cleanUser}'.`;
              setSyncNotice(msg);
              setIsSyncing(false);
              return { success: true, message: msg, readingsCount: pullRes.payload.readings.length };
            } else {
              // Merge mode
              const { merged, newCount } = cloudSyncService.mergeReadings(
                currentLocal,
                pullRes.payload.readings
              );
              await dbService.clearAllReadings();
              await dbService.bulkAddReadings(merged);
              await reloadData();

              // Push the combined merged dataset back to cloud so both devices have all records
              await cloudSyncService.pushToCloud(cleanUser, merged, settingsRef.current);

              const now = Date.now();
              settingsService.updateSettings({
                username: cleanUser,
                cloudSyncEnabled: true,
                lastSyncTimestamp: now,
              });
              setSettings(settingsService.getSettings());

              const msg = `Synced! ${merged.length} readings unified across devices (${newCount} new added).`;
              setSyncNotice(msg);
              setIsSyncing(false);
              return { success: true, message: msg, readingsCount: merged.length, updatedAt: now };
            }
          } else if (mode === 'download') {
            const msg = pullRes.message || 'No records found on cloud for this username.';
            setSyncNotice(msg);
            setIsSyncing(false);
            return { success: false, message: msg };
          }
        }

        // 2. UPLOAD MODE or fallback initial upload if remote had no records
        const currentLocal = await dbService.getAllReadings();
        const pushRes = await cloudSyncService.pushToCloud(cleanUser, currentLocal, settingsRef.current);

        const now = Date.now();
        settingsService.updateSettings({
          username: cleanUser,
          cloudSyncEnabled: true,
          lastSyncTimestamp: now,
        });
        setSettings(settingsService.getSettings());

        setSyncNotice(pushRes.message);
        setIsSyncing(false);
        return pushRes;
      } catch (err: any) {
        const errorMsg = `Sync notice: ${err?.message || 'Check network connection'}`;
        setSyncNotice(errorMsg);
        setIsSyncing(false);
        return { success: false, message: errorMsg };
      }
    },
    [reloadData]
  );

  // Background auto-sync helper
  const triggerBackgroundPush = useCallback(async () => {
    if (settingsRef.current.cloudSyncEnabled && settingsRef.current.username) {
      try {
        const current = await dbService.getAllReadings();
        await cloudSyncService.pushToCloud(
          settingsRef.current.username,
          current,
          settingsRef.current
        );
      } catch (err) {
        console.warn('Background sync deferred:', err);
      }
    }
  }, []);

  // Initial load: Check IndexedDB + URL Parameters for Cross-Device Sync Link
  useEffect(() => {
    const initApp = async () => {
      await reloadData();

      // Check URL parameters for 1-click Mobile Sync: ?user=ammad
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlUser = urlParams.get('user');

        if (urlUser) {
          const clean = cloudSyncService.sanitizeUsername(urlUser);
          if (clean) {
            settingsService.updateSettings({ username: clean, cloudSyncEnabled: true });
            setSettings(settingsService.getSettings());
            // Automatically pull from cloud on initial load
            await syncWithCloud(clean, 'merge');
            // Clean URL query without full reload
            const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash}`;
            window.history.replaceState({}, document.title, cleanUrl);
            return;
          }
        }

        // Check URL for Import link: ?import=COMPRESSED_DATA (also check hash if redirected)
        let importParam = urlParams.get('import');
        if (!importParam && window.location.hash.includes('import=')) {
          const hashQuery = window.location.hash.includes('?') 
            ? window.location.hash.split('?')[1] 
            : window.location.hash.slice(1);
          importParam = new URLSearchParams(hashQuery).get('import');
        }

        if (importParam) {
          try {
            setSyncNotice('Data import ho raha hai...');
            const importedReadings = await cloudSyncService.decodeImportParam(importParam);
            if (importedReadings && importedReadings.length > 0) {
              const currentLocal = await dbService.getAllReadings();
              const { merged, newCount } = cloudSyncService.mergeReadings(currentLocal, importedReadings);
              await dbService.clearAllReadings();
              await dbService.bulkAddReadings(merged);
              await reloadData();
              setSyncNotice(`✅ ${newCount > 0 ? `${newCount} nayi readings import ho gayi!` : 'All readings synced!'} Total: ${merged.length}`);
              // Clean URL query without full reload
              window.history.replaceState({}, document.title, window.location.pathname);
              setTimeout(() => setSyncNotice(null), 7000);
              return;
            } else {
              setSyncNotice('❌ Import link invalid tha ya readings decode nahi hui.');
              setTimeout(() => setSyncNotice(null), 5000);
            }
          } catch (e) {
            console.warn('QR import failed:', e);
            setSyncNotice('❌ Data import karne mein error aaya.');
            setTimeout(() => setSyncNotice(null), 5000);
          }
        }

        // If username was already configured, auto-refresh from cloud if enabled
        const saved = settingsService.getSettings();
        if (saved.username && saved.cloudSyncEnabled) {
          syncWithCloud(saved.username, 'merge');
        }
      } catch (err) {
        console.warn('Initial sync check notice:', err);
      }
    };

    initApp();
  }, [reloadData, syncWithCloud]);

  const toggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = settingsService.updateSettings({ theme: nextTheme });
    setSettings(updated);
  };

  const addReading = async (
    readingData: Omit<BloodSugarReading, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<BloodSugarReading> => {
    const now = Date.now();
    const id = `reading_${readingData.date}_${readingData.time.replace(':', '')}_${Math.random()
      .toString(36)
      .substring(2, 7)}`;
    const newRecord: BloodSugarReading = {
      ...readingData,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await dbService.addReading(newRecord, settings.storageLimit, settings.autoDeleteOldReadings);
    await reloadData();
    triggerBackgroundPush();
    return newRecord;
  };

  const editReading = async (reading: BloodSugarReading): Promise<BloodSugarReading> => {
    const updatedRecord: BloodSugarReading = {
      ...reading,
      updatedAt: Date.now(),
    };
    await dbService.updateReading(updatedRecord);
    await reloadData();
    triggerBackgroundPush();
    return updatedRecord;
  };

  const removeReading = async (id: string): Promise<void> => {
    await dbService.deleteReading(id);
    await reloadData();
    triggerBackgroundPush();
  };

  const removeMultipleReadings = async (ids: string[]): Promise<void> => {
    await dbService.deleteMultiple(ids);
    await reloadData();
    triggerBackgroundPush();
  };

  const importReadings = async (newReadings: BloodSugarReading[]): Promise<number> => {
    const count = await dbService.bulkAddReadings(newReadings);
    await reloadData();
    triggerBackgroundPush();
    return count;
  };

  const clearAllData = async (): Promise<void> => {
    await dbService.clearAllReadings();
    setReadings([]);
    triggerBackgroundPush();
  };

  const updateSettings = (partial: Partial<AppSettings>) => {
    const updated = settingsService.updateSettings(partial);
    setSettings(updated);
  };

  const markBackupCompleted = () => {
    settingsService.recordBackup();
    setSettings(settingsService.getSettings());
  };

  const loadSampleData = async () => {
    const samples = generateSampleReadings();
    await dbService.bulkAddReadings(samples);
    await reloadData();
    triggerBackgroundPush();
  };

  return (
    <BloodSugarContext.Provider
      value={{
        readings,
        settings,
        isLoading,
        isSyncing,
        syncNotice,
        addReading,
        editReading,
        removeReading,
        removeMultipleReadings,
        importReadings,
        clearAllData,
        updateSettings,
        loadSampleData,
        markBackupCompleted,
        syncWithCloud,
        activeTab,
        setActiveTab,
        toggleTheme,
      }}
    >
      {children}
    </BloodSugarContext.Provider>
  );
};

export const useBloodSugar = (): BloodSugarContextType => {
  const context = useContext(BloodSugarContext);
  if (!context) {
    throw new Error('useBloodSugar must be used within a BloodSugarProvider');
  }
  return context;
};
