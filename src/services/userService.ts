import { BloodSugarReading, AppSettings, UserProfile } from '../types';
import { exportToDailyMatrixExcel, parseExcelFile } from './excelService';
import { exportJSONBackup, parseJSONBackup, downloadFile } from './backupService';

export class UserService {
  private sanitizeUsername(input: string): string {
    return (input || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');
  }

  /**
   * Log in or create a user profile
   */
  public createOrLogin(username: string, displayName?: string, currentUsers: UserProfile[] = []): {
    user: UserProfile;
    updatedUsers: UserProfile[];
  } {
    const clean = this.sanitizeUsername(username);
    if (!clean) {
      throw new Error('Please enter a valid username (letters and numbers only).');
    }

    const now = Date.now();
    const existingIndex = currentUsers.findIndex((u) => u.username === clean);

    let user: UserProfile;
    let updatedUsers = [...currentUsers];

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
   * 1-Click Save Data File (Excel Daily Matrix or JSON)
   * This is completely offline, privacy-first, and saves the user's complete dataset
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
      // User's exact 4-column daily matrix format with clinical legend!
      exportToDailyMatrixExcel(readings, settings, `Blood_Sugar_Logbook_${userTag}_${dateStr}.xlsx`);
    } else {
      // Complete JSON document format
      exportJSONBackup(readings, settings);
    }
  }

  /**
   * 1-Click Load Data File (.xlsx, .xls, .json, .csv)
   * Automatically parses any supported data file and extracts all readings
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

  /**
   * Optional Live Cloud Sync via Firebase Realtime Database
   * If user sets firebaseDbUrl in settings, both laptop and mobile stay in live sync automatically!
   */
  public async syncWithFirebase(
    firebaseDbUrl: string,
    username: string,
    readings: BloodSugarReading[],
    settings: AppSettings,
    mode: 'push' | 'pull' | 'merge' = 'merge'
  ): Promise<{
    success: boolean;
    message: string;
    readings?: BloodSugarReading[];
  }> {
    const cleanUser = this.sanitizeUsername(username);
    if (!cleanUser) {
      return { success: false, message: 'Invalid username.' };
    }

    const cleanBase = firebaseDbUrl.replace(/\/+$/, '');
    const endpoint = `${cleanBase}/users/${cleanUser}.json`;

    try {
      if (mode === 'pull' || mode === 'merge') {
        const res = await fetch(endpoint);
        if (res.ok) {
          const remoteData = await res.json();
          if (remoteData && Array.isArray(remoteData.readings)) {
            if (mode === 'pull') {
              return {
                success: true,
                message: `Retrieved ${remoteData.readings.length} readings from Firebase cloud for '${cleanUser}'.`,
                readings: remoteData.readings,
              };
            }

            // Merge mode
            const existingMap = new Map<string, BloodSugarReading>();
            const fpSet = new Set<string>();
            const getFp = (r: BloodSugarReading) => `${r.date}_${r.time}_${r.type}_${r.value}`;

            readings.forEach((r) => {
              existingMap.set(r.id, r);
              fpSet.add(getFp(r));
            });

            remoteData.readings.forEach((cr: BloodSugarReading) => {
              const fp = getFp(cr);
              if (!existingMap.has(cr.id) && !fpSet.has(fp)) {
                existingMap.set(cr.id, cr);
                fpSet.add(fp);
              }
            });

            const merged = Array.from(existingMap.values()).sort((a, b) =>
              `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)
            );

            // Push merged back
            await fetch(endpoint, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: cleanUser,
                updatedAt: Date.now(),
                readings: merged,
              }),
            });

            return {
              success: true,
              message: `Unified ${merged.length} readings across devices with Firebase!`,
              readings: merged,
            };
          }
        }
      }

      // Push mode
      const pushRes = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          updatedAt: Date.now(),
          readings,
          unit: settings.unit,
        }),
      });

      if (pushRes.ok) {
        return {
          success: true,
          message: `Saved ${readings.length} readings to Firebase cloud under '${cleanUser}'!`,
          readings,
        };
      } else {
        return {
          success: false,
          message: `Firebase responded with status ${pushRes.status}. Check database rules.`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to connect to Firebase: ${err?.message || 'Network error'}`,
      };
    }
  }
}

export const userService = new UserService();
