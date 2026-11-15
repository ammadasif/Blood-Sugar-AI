import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BloodSugarReading, AppSettings } from '../types';
import { dbService } from '../services/indexedDB';
import { settingsService } from '../services/settingsStorage';
import { generateSampleReadings } from '../utils/sampleData';

interface BloodSugarContextType {
  readings: BloodSugarReading[];
  settings: AppSettings;
  isLoading: boolean;
  addReading: (reading: Omit<BloodSugarReading, 'id' | 'createdAt' | 'updatedAt'>) => Promise<BloodSugarReading>;
  editReading: (reading: BloodSugarReading) => Promise<BloodSugarReading>;
  removeReading: (id: string) => Promise<void>;
  removeMultipleReadings: (ids: string[]) => Promise<void>;
  importReadings: (newReadings: BloodSugarReading[]) => Promise<number>;
  clearAllData: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => void;
  loadSampleData: () => Promise<void>;
  markBackupCompleted: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  toggleTheme: () => void;
}

const BloodSugarContext = createContext<BloodSugarContextType | undefined>(undefined);

export const BloodSugarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [readings, setReadings] = useState<BloodSugarReading[]>([]);
  const [settings, setSettings] = useState<AppSettings>(settingsService.getSettings());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

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

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  // Synchronize theme with DOM
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  const toggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = settingsService.updateSettings({ theme: nextTheme });
    setSettings(updated);
  };

  const addReading = async (
    readingData: Omit<BloodSugarReading, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<BloodSugarReading> => {
    const now = Date.now();
    const id = `reading_${readingData.date}_${readingData.time.replace(':', '')}_${Math.random().toString(36).substring(2, 7)}`;
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
  };

  return (
    <BloodSugarContext.Provider
      value={{
        readings,
        settings,
        isLoading,
        addReading,
        editReading,
        removeReading,
        removeMultipleReadings,
        importReadings,
        clearAllData,
        updateSettings,
        loadSampleData,
        markBackupCompleted,
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
