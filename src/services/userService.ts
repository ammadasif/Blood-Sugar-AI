import { BloodSugarReading, AppSettings, UserProfile } from '../types';
import { exportToDailyMatrixExcel, parseExcelFile } from './excelService';
import { exportJSONBackup, parseJSONBackup, downloadFile } from './backupService';

export class UserService {
  public sanitizeUsername(input: string): string {
    return (input || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');
  }

  /**
   * Log in or create a user profile
   */
  public createOrLogin(
    username: string,
    displayName?: string,
    currentUsers: UserProfile[] = []
  ): {
    user: UserProfile;
    updatedUsers: UserProfile[];
  } {
    const clean = this.sanitizeUsername(username);
    if (!clean) {
      throw new Error('Please enter a valid username (letters, numbers, underscores, hyphens only).');
    }

    const now = Date.now();
    const existingIndex = currentUsers.findIndex((u) => u.username === clean);

    let user: UserProfile;
    const updatedUsers = [...currentUsers];

    if (existingIndex >= 0) {
      user = {
        ...currentUsers[existingIndex],
        displayName: displayName?.trim() || currentUsers[existingIndex].displayName || clean,
        lastLoginAt: now,
      };
      updatedUsers[existingIndex] = user;
    } else {
      user = {
        id: clean,
        username: clean,
        displayName: displayName?.trim() || clean.charAt(0).toUpperCase() + clean.slice(1),
        createdAt: now,
        lastLoginAt: now,
      };
      updatedUsers.push(user);
    }

    return { user, updatedUsers };
  }

  /**
   * Real-time Cloud Backup via Firebase Realtime Database
   * Directly PUTs readings to <firebaseUrl>/users/<username>.json
   */
  public async backupToFirebase(
    firebaseDbUrl: string,
    username: string,
    readings: BloodSugarReading[],
    settings: AppSettings
  ): Promise<{ success: boolean; message: string }> {
    const cleanUser = this.sanitizeUsername(username);
    if (!cleanUser) {
      return { success: false, message: 'Invalid username.' };
    }

    let baseUrl = firebaseDbUrl.trim().replace(/\/+$/, '');
    if (!baseUrl.startsWith('http')) {
      baseUrl = `https://${baseUrl}`;
    }
    const endpoint = `${baseUrl}/users/${cleanUser}.json`;

    try {
      const payload = {
        username: cleanUser,
        displayName: settings.currentUser?.displayName || cleanUser,
        updatedAt: Date.now(),
        totalReadings: readings.length,
        unit: settings.unit,
        readings,
      };

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        return {
          success: true,
          message: `Backed up ${readings.length} readings for '${cleanUser}' to Cloud successfully!`,
        };
      } else {
        const errorText = await res.text();
        return {
          success: false,
          message: `Cloud responded with error (${res.status}): ${errorText.slice(0, 80)}. Check Firebase rules.`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Network error connecting to Cloud: ${err?.message || 'Check connection'}`,
      };
    }
  }

  /**
   * Real-time Cloud Restore via Firebase Realtime Database
   * Directly GETs readings from <firebaseUrl>/users/<username>.json
   */
  public async restoreFromFirebase(
    firebaseDbUrl: string,
    username: string
  ): Promise<{
    success: boolean;
    readings?: BloodSugarReading[];
    message: string;
  }> {
    const cleanUser = this.sanitizeUsername(username);
    if (!cleanUser) {
      return { success: false, message: 'Invalid username.' };
    }

    let baseUrl = firebaseDbUrl.trim().replace(/\/+$/, '');
    if (!baseUrl.startsWith('http')) {
      baseUrl = `https://${baseUrl}`;
    }
    const endpoint = `${baseUrl}/users/${cleanUser}.json?t=${Date.now()}`;

    try {
      const res = await fetch(endpoint, { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        if (!data) {
          return {
            success: false,
            message: `No backed-up readings found in cloud for username '${cleanUser}'.`,
          };
        }

        const readings: BloodSugarReading[] = Array.isArray(data)
          ? data
          : Array.isArray(data.readings)
          ? data.readings
          : [];

        return {
          success: true,
          readings,
          message: `Retrieved ${readings.length} readings from Cloud for '${cleanUser}'!`,
        };
      } else {
        return {
          success: false,
          message: `Cloud responded with error (${res.status}). Verify database URL.`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Network error connecting to Cloud: ${err?.message || 'Check connection'}`,
      };
    }
  }

  /**
   * 1-Click Save Data File (Excel Daily Matrix or JSON)
   */
  public saveDatabaseFile(
    readings: BloodSugarReading[],
    settings: AppSettings,
    user?: UserProfile,
    format: 'excel' | 'json' = 'excel'
  ): void {
    const dateStr = new Date().toISOString().split('T')[0];
    const userTag = user?.displayName ? user.displayName.replace(/\s+/g, '_') : 'User';

    if (format === 'excel') {
      exportToDailyMatrixExcel(readings, settings, `Blood_Sugar_Logbook_${userTag}_${dateStr}.xlsx`);
    } else {
      exportJSONBackup(readings, settings);
    }
  }

  /**
   * 1-Click Load Data File (.xlsx, .xls, .json, .csv)
   */
  public async loadDatabaseFile(
    file: File,
    existingReadings: BloodSugarReading[],
    settings: AppSettings
  ): Promise<{
    readings: BloodSugarReading[];
    count: number;
    format: 'excel_matrix' | 'excel_flat' | 'json';
  }> {
    const fileName = file.name.toLowerCase();

    // 1. JSON file
    if (fileName.endsWith('.json')) {
      const backup = await parseJSONBackup(file);
      const readings = Array.isArray(backup.readings) ? backup.readings : [];
      return {
        readings,
        count: readings.length,
        format: 'json',
      };
    }

    // 2. Excel or CSV file (.xlsx, .xls, .csv)
    const result = await parseExcelFile(file, existingReadings, settings);
    const validReadings = result.validRows
      .filter((r) => r.parsedReading)
      .map((r) => r.parsedReading!);

    return {
      readings: validReadings,
      count: validReadings.length,
      format: result.formatDetected === 'matrix_daily' ? 'excel_matrix' : 'excel_flat',
    };
  }
}

export const userService = new UserService();
