import { AppSettings, TargetRangeConfig } from '../types';
import { DEFAULT_RANGES, DIABETES_MANAGEMENT_RANGES } from '../utils/analysis';

const SETTINGS_KEY = 'gluco_track_pro_settings_v1';

export const INITIAL_SETTINGS: AppSettings = {
  unit: 'mg/dL',
  targetProfile: 'general_screening',
  ranges: { ...DEFAULT_RANGES },
  storageLimit: 1000,
  autoDeleteOldReadings: false,
  theme: 'light',
  hasDismissedBackupWarning: false,
  lastBackupDate: undefined,
};

class SettingsStorageService {
  public getSettings(): AppSettings {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (!stored) {
        this.saveSettings(INITIAL_SETTINGS);
        return INITIAL_SETTINGS;
      }
      const parsed = JSON.parse(stored) as Partial<AppSettings>;
      return {
        ...INITIAL_SETTINGS,
        ...parsed,
        ranges: {
          ...DEFAULT_RANGES,
          ...(parsed.ranges || {}),
        },
      };
    } catch (err) {
      console.error('Failed to load settings from localStorage:', err);
      return INITIAL_SETTINGS;
    }
  }

  public saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (err) {
      console.error('Failed to persist settings:', err);
    }
  }

  public updateSettings(partial: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated: AppSettings = {
      ...current,
      ...partial,
      ranges: partial.ranges ? { ...current.ranges, ...partial.ranges } : current.ranges,
    };
    this.saveSettings(updated);
    return updated;
  }

  public applyProfilePreset(profile: 'general_screening' | 'diagnosed_diabetes'): AppSettings {
    const current = this.getSettings();
    const newRanges: TargetRangeConfig =
      profile === 'diagnosed_diabetes'
        ? { ...DIABETES_MANAGEMENT_RANGES }
        : { ...DEFAULT_RANGES };

    const updated: AppSettings = {
      ...current,
      targetProfile: profile,
      ranges: newRanges,
    };
    this.saveSettings(updated);
    return updated;
  }

  public recordBackup(): void {
    const current = this.getSettings();
    current.lastBackupDate = new Date().toISOString();
    current.hasDismissedBackupWarning = false;
    this.saveSettings(current);
  }

  public resetToDefaults(): AppSettings {
    this.saveSettings(INITIAL_SETTINGS);
    return INITIAL_SETTINGS;
  }
}

export const settingsService = new SettingsStorageService();

