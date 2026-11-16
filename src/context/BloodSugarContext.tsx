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
  loginUser: (username: string, displayName?: string, firebaseDbUrl?: string) => Promise<UserProfile>;
  logoutUser: () => void;
  switchProfile: (username: string) => Promise<void>;

  // Real-Time Cloud Backup & Restore
  backupReadingsToCloud: (customUrl?: string) => Promise<{ success: boolean; message: string }>;
  restoreReadingsFromCloud: (
    customUrl?: string,
    customUsername?: string
  ) => Promise<{ success: boolean; message: string; count?: number }>;

  // File-Based Backup (Save / Load File)
  saveDataToFile: (format?: 'excel' | 'json') => void;
  loadDataFromFile: (file: File) => Promise<{ count: number; format: string }>;
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

  // Initial load: Only read local database, no hardcoded readings!
  useEffect(() => {
    const init = async () => {
      await reloadData();
    };
    init();
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
  const loginUser = async (
    username: string,
    displayName?: string,
    firebaseDbUrl?: string
  ): Promise<UserProfile> => {
    const currentList = settings.savedUsers || [];
    const { user, updatedUsers } = userService.createOrLogin(username, displayName, currentList);

    const partialUpdate: Partial<AppSettings> = {
      currentUser: user,
      savedUsers: updatedUsers,
    };
    if (firebaseDbUrl) {
      partialUpdate.firebaseDbUrl = firebaseDbUrl.trim();
    }

    const updated = settingsService.updateSettings(partialUpdate);
    setSettings(updated);
    return user;
  };

  const logoutUser = () => {
    const updated = settingsService.updateSettings({
      currentUser: undefined,
    });
    setSettings(updated);
  };

  const switchProfile = async (username: string) => {
    const target = (settings.savedUsers || []).find((u) => u.username === username);
    if (target) {
      const updated = settingsService.updateSettings({
        currentUser: { ...target, lastLoginAt: Date.now() },
      });
      setSettings(updated);
    }
  };

  // ───────────────────────────────────────────────
  // REAL-TIME CLOUD BACKUP & RESTORE
  // ───────────────────────────────────────────────
  const backupReadingsToCloud = async (
    customUrl?: string
  ): Promise<{ success: boolean; message: string }> => {
    const url = customUrl || settings.firebaseDbUrl;
    if (!url) {
      return {
        success: false,
        message: 'No Cloud Database URL configured. Please set your Firebase URL in Settings or enter it here.',
      };
    }
    const username = settings.currentUser?.username;
    if (!username) {
      return { success: false, message: 'Please sign in first before backing up readings.' };
    }

    const res = await userService.backupToFirebase(url, username, readings, settings);
    if (res.success) {
      markBackupCompleted();
      if (customUrl && customUrl !== settings.firebaseDbUrl) {
        updateSettings({ firebaseDbUrl: customUrl.trim() });
      }
    }
    return res;
  };

  const restoreReadingsFromCloud = async (
    customUrl?: string,
    customUsername?: string
  ): Promise<{ success: boolean; message: string; count?: number }> => {
    const url = customUrl || settings.firebaseDbUrl;
    const username = customUsername || settings.currentUser?.username;

    if (!url) {
      return {
        success: false,
        message: 'No Cloud Database URL configured. Please enter your Firebase Realtime DB URL.',
      };
    }
    if (!username) {
      return { success: false, message: 'Please enter a username to restore readings for.' };
    }

    const res = await userService.restoreFromFirebase(url, username);
    if (res.success && res.readings) {
      await dbService.clearAllReadings();
      if (res.readings.length > 0) {
        await dbService.bulkAddReadings(res.readings);
      }
      await reloadData();

      if (customUrl && customUrl !== settings.firebaseDbUrl) {
        updateSettings({ firebaseDbUrl: customUrl.trim() });
      }

      return {
        success: true,
        message: `Successfully restored ${res.readings.length} readings for '${username}'!`,
        count: res.readings.length,
      };
    }

    return {
      success: false,
      message: res.message || `No readings found in cloud for username '${username}'.`,
    };
  };

  // ───────────────────────────────────────────────
  // FILE-BASED DATABASE (SAVE & LOAD EXCEL / JSON)
  // ───────────────────────────────────────────────
  const saveDataToFile = (format: 'excel' | 'json' = 'excel') => {
    userService.saveDatabaseFile(readings, settings, settings.currentUser, format);
    markBackupCompleted();
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
    return newRecord;
  };

  const editReading = async (reading: BloodSugarReading): Promise<BloodSugarReading> => {
    const updatedRecord: BloodSugarReading = {
      ...reading,
      updatedAt: Date.now(),
    };
    await dbService.updateReading(updatedRecord);
    await reloadData();
    return updatedRecord;
  };

  const removeReading = async (id: string): Promise<void> => {
    await dbService.deleteReading(id);
    await reloadData();
  };

  const removeMultipleReadings = async (ids: string[]): Promise<void> => {
    await dbService.deleteMultiple(ids);
    await reloadData();
  };

  const importReadings = async (newReadings: BloodSugarReading[]): Promise<number> => {
    const count = await dbService.bulkAddReadings(newReadings);
    await reloadData();
    return count;
  };

  const clearAllData = async (): Promise<void> => {
    await dbService.clearAllReadings();
    setReadings([]);
  };

  const loadSampleData = async () => {
    const samples = generateSampleReadings();
    await dbService.bulkAddReadings(samples);
    await reloadData();
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
        backupReadingsToCloud,
        restoreReadingsFromCloud,
        saveDataToFile,
        loadDataFromFile,
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
