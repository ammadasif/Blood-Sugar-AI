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
  loginUser: (username: string, displayName?: string, autoFetchBackend?: boolean) => Promise<UserProfile>;
  logoutUser: () => void;
  switchProfile: (username: string, autoFetchBackend?: boolean) => Promise<void>;

  // Backend File Automatic Sync
  loadUserFromBackend: (targetUser?: string) => Promise<{ success: boolean; message: string; count?: number }>;
  saveBackendJson: (username?: string) => void;

  // File-Based Database (Save / Load File)
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
    const init = async () => {
      await reloadData();

      // If user is already signed in and has 0 readings locally, auto-fetch from backend!
      const current = settingsService.getSettings();
      if (current.currentUser?.username) {
        const localReadings = await dbService.getAllReadings();
        if (localReadings.length === 0) {
          const res = await userService.fetchUserFromBackend(
            current.currentUser.username,
            current.firebaseDbUrl
          );
          if (res.success && res.readings && res.readings.length > 0) {
            await dbService.bulkAddReadings(res.readings);
            await reloadData();
          }
        }
      }
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
  // BACKEND FILE AUTO-SYNC
  // ───────────────────────────────────────────────
  const loadUserFromBackend = async (
    targetUser?: string
  ): Promise<{ success: boolean; message: string; count?: number }> => {
    const userToLoad = targetUser || settings.currentUser?.username;
    if (!userToLoad) {
      return { success: false, message: 'Please enter a username.' };
    }

    const res = await userService.fetchUserFromBackend(userToLoad, settings.firebaseDbUrl);
    if (res.success && res.readings && res.readings.length > 0) {
      await dbService.clearAllReadings();
      await dbService.bulkAddReadings(res.readings);
      await reloadData();
      return { success: true, message: res.message, count: res.readings.length };
    }
    return { success: false, message: res.message };
  };

  const saveBackendJson = (username?: string) => {
    const user = username || settings.currentUser?.username || 'ammad';
    const display = settings.currentUser?.displayName || user;
    userService.saveBackendJsonFile(readings, user, display);
  };

  // ───────────────────────────────────────────────
  // USER PROFILE & ACCOUNT
  // ───────────────────────────────────────────────
  const loginUser = async (
    username: string,
    displayName?: string,
    autoFetchBackend: boolean = true
  ): Promise<UserProfile> => {
    const currentList = settings.savedUsers || [];
    const { user, updatedUsers } = userService.createOrLogin(username, displayName, currentList);

    const updated = settingsService.updateSettings({
      currentUser: user,
      savedUsers: updatedUsers,
    });
    setSettings(updated);

    if (autoFetchBackend) {
      await loadUserFromBackend(user.username);
    }

    return user;
  };

  const logoutUser = () => {
    const updated = settingsService.updateSettings({
      currentUser: undefined,
    });
    setSettings(updated);
  };

  const switchProfile = async (username: string, autoFetchBackend: boolean = true) => {
    const target = (settings.savedUsers || []).find((u) => u.username === username);
    if (target) {
      const updated = settingsService.updateSettings({
        currentUser: { ...target, lastLoginAt: Date.now() },
      });
      setSettings(updated);

      if (autoFetchBackend) {
        await loadUserFromBackend(target.username);
      }
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
        loadUserFromBackend,
        saveBackendJson,
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
