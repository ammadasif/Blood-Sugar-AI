import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { BloodSugarReading, AppSettings, UserProfile } from '../types';
import { dbService } from '../services/indexedDB';
import { settingsService } from '../services/settingsStorage';
import { generateSampleReadings } from '../utils/sampleData';
import { userService } from '../services/userService';

interface BloodSugarContextType {
  readings: BloodSugarReading[];
  settings: AppSettings;
  isLoading: boolean;
  currentUser?: UserProfile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  toggleTheme: () => void;

  // CRUD operations
  addReading: (reading: Omit<BloodSugarReading, 'id' | 'createdAt' | 'updatedAt'>) => Promise<BloodSugarReading>;
  editReading: (reading: BloodSugarReading) => Promise<BloodSugarReading>;
  removeReading: (id: string) => Promise<void>;
  removeMultipleReadings: (ids: string[]) => Promise<void>;
  importReadings: (newReadings: BloodSugarReading[]) => Promise<number>;
  clearAllData: () => Promise<void>;
  loadSampleData: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => void;
  markBackupCompleted: () => void;

  // User Account & Profile
  loginUser: (username: string, displayName?: string) => UserProfile;
  logoutUser: () => void;
  switchProfile: (username: string) => void;

  // File-Based Database (Excel / JSON / Text)
  saveDataToFile: (format?: 'excel' | 'json') => void;
  loadDataFromFile: (file: File) => Promise<{ count: number; format: string }>;

  // Optional Live Cloud Sync (Firebase)
  syncWithFirebaseCloud: (mode?: 'push' | 'pull' | 'merge') => Promise<{ success: boolean; message: string }>;
}

const BloodSugarContext = createContext<BloodSugarContextType | undefined>(undefined);

export const BloodSugarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [readings, setReadings] = useState<BloodSugarReading[]>([]);
  const [settings, setSettings] = useState<AppSettings>(settingsService.getSettings());
  const [isLoading, setIsLoading] = useState<boolean>(true);
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

  // Initial load
  useEffect(() => {
    reloadData();
  }, [reloadData]);

  const toggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = settingsService.updateSettings({ theme: nextTheme });
    setSettings(updated);
  };

  const updateSettings = (partial: Partial<AppSettings>) => {
    const updated = settingsService.updateSettings(partial);
    setSettings(updated);
  };

  const markBackupCompleted = () => {
    settingsService.recordBackup();
    setSettings(settingsService.getSettings());
  };

  // ───────────────────────────────────────────────
  // USER PROFILE & ACCOUNT
  // ───────────────────────────────────────────────
  const loginUser = (username: string, displayName?: string): UserProfile => {
    const currentList = settings.savedUsers || [];
    const { user, updatedUsers } = userService.createOrLogin(username, displayName, currentList);

    const updated = settingsService.updateSettings({
      currentUser: user,
      savedUsers: updatedUsers,
    });
    setSettings(updated);
    return user;
  };

  const logoutUser = () => {
    const updated = settingsService.updateSettings({
      currentUser: undefined,
    });
    setSettings(updated);
  };

  const switchProfile = (username: string) => {
    const target = (settings.savedUsers || []).find((u) => u.username === username);
    if (target) {
      const updated = settingsService.updateSettings({
        currentUser: { ...target, lastLoginAt: Date.now() },
      });
      setSettings(updated);
    }
  };

  // ───────────────────────────────────────────────
  // FILE-BASED DATABASE (SAVE & LOAD EXCEL / JSON)
  // ───────────────────────────────────────────────
  const saveDataToFile = (format: 'excel' | 'json' = 'excel') => {
    userService.saveDatabaseFile(readings, settings, settings.currentUser, format);
  };

  const loadDataFromFile = async (file: File): Promise<{ count: number; format: string }> => {
    const result = await userService.loadDatabaseFile(file, readings, settings);
    if (result.readings.length > 0) {
      await dbService.bulkAddReadings(result.readings);
      await reloadData();
    }
    return { count: result.count, format: result.format };
  };

  // ───────────────────────────────────────────────
  // OPTIONAL LIVE CLOUD SYNC (FIREBASE)
  // ───────────────────────────────────────────────
  const syncWithFirebaseCloud = async (
    mode: 'push' | 'pull' | 'merge' = 'merge'
  ): Promise<{ success: boolean; message: string }> => {
    if (!settings.firebaseDbUrl) {
      return { success: false, message: 'Firebase Database URL not configured in Settings.' };
    }
    const username = settings.currentUser?.username || 'default_user';
    const res = await userService.syncWithFirebase(
      settings.firebaseDbUrl,
      username,
      readings,
      settings,
      mode
    );

    if (res.success && res.readings) {
      await dbService.clearAllReadings();
      await dbService.bulkAddReadings(res.readings);
      await reloadData();
    }
    return res;
  };

  // ───────────────────────────────────────────────
  // CRUD OPERATIONS
  // ───────────────────────────────────────────────
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

    // Auto-sync with Firebase if configured
    if (settings.firebaseDbUrl) {
      syncWithFirebaseCloud('push').catch(() => {});
    }

    return newRecord;
  };

  const editReading = async (reading: BloodSugarReading): Promise<BloodSugarReading> => {
    const updatedRecord: BloodSugarReading = {
      ...reading,
      updatedAt: Date.now(),
    };
    await dbService.updateReading(updatedRecord);
    await reloadData();

    if (settings.firebaseDbUrl) {
      syncWithFirebaseCloud('push').catch(() => {});
    }

    return updatedRecord;
  };

  const removeReading = async (id: string): Promise<void> => {
    await dbService.deleteReading(id);
    await reloadData();

    if (settings.firebaseDbUrl) {
      syncWithFirebaseCloud('push').catch(() => {});
    }
  };

  const removeMultipleReadings = async (ids: string[]): Promise<void> => {
    await dbService.deleteMultiple(ids);
    await reloadData();

    if (settings.firebaseDbUrl) {
      syncWithFirebaseCloud('push').catch(() => {});
    }
  };

  const importReadings = async (newReadings: BloodSugarReading[]): Promise<number> => {
    const count = await dbService.bulkAddReadings(newReadings);
    await reloadData();

    if (settings.firebaseDbUrl) {
      syncWithFirebaseCloud('push').catch(() => {});
    }

    return count;
  };

  const clearAllData = async (): Promise<void> => {
    await dbService.clearAllReadings();
    setReadings([]);

    if (settings.firebaseDbUrl) {
      syncWithFirebaseCloud('push').catch(() => {});
    }
  };

  const loadSampleData = async () => {
    const samples = generateSampleReadings();
    await dbService.bulkAddReadings(samples);
    await reloadData();

    if (settings.firebaseDbUrl) {
      syncWithFirebaseCloud('push').catch(() => {});
    }
  };

  return (
    <BloodSugarContext.Provider
      value={{
        readings,
        settings,
        isLoading,
        currentUser: settings.currentUser,
        activeTab,
        setActiveTab,
        toggleTheme,
        addReading,
        editReading,
        removeReading,
        removeMultipleReadings,
        importReadings,
        clearAllData,
        loadSampleData,
        updateSettings,
        markBackupCompleted,
        loginUser,
        logoutUser,
        switchProfile,
        saveDataToFile,
        loadDataFromFile,
        syncWithFirebaseCloud,
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
