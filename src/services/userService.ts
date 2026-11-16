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
   * Automatically loads the user's backend JSON file from server/GitHub Pages/Firebase
   * Without the user having to manually export/import anything!
   */
  public async fetchUserFromBackend(
    username: string,
    firebaseDbUrl?: string
  ): Promise<{
    success: boolean;
    readings?: BloodSugarReading[];
    message: string;
    source?: string;
  }> {
    const cleanUser = this.sanitizeUsername(username);
    if (!cleanUser) {
      return { success: false, message: 'Invalid username.' };
    }

    const candidateUrls: { name: string; url: string }[] = [];
    const timestamp = Date.now();

    // 1. If Firebase DB is configured
    if (firebaseDbUrl && firebaseDbUrl.startsWith('http')) {
      const cleanBase = firebaseDbUrl.replace(/\/+$/, '');
      candidateUrls.push({
        name: 'Firebase Cloud Database',
        url: `${cleanBase}/users/${cleanUser}.json?t=${timestamp}`,
      });
    }

    // 2. Relative site URL based on current page directory
    try {
      const docPath = window.location.pathname;
      const cleanDir = docPath.substring(0, docPath.lastIndexOf('/') + 1) || '/';
      candidateUrls.push({
        name: 'Site Backend File',
        url: `${window.location.origin}${cleanDir}data/users/${cleanUser}.json?t=${timestamp}`,
      });
    } catch {
      // Fallback relative
    }

    // 3. Explicit GitHub Pages deployment URL
    candidateUrls.push({
      name: 'GitHub Pages Backend',
      url: `https://ammadasif.github.io/Blood-Sugar-AI/data/users/${cleanUser}.json?t=${timestamp}`,
    });

    // 4. Raw GitHub fallback (CORS friendly, guaranteed live upon git push)
    candidateUrls.push({
      name: 'GitHub Repository Backend',
      url: `https://raw.githubusercontent.com/ammadasif/Blood-Sugar-AI/main/public/data/users/${cleanUser}.json?t=${timestamp}`,
    });

    // 5. Root path fallback
    candidateUrls.push({
      name: 'Root Path Fallback',
      url: `/data/users/${cleanUser}.json?t=${timestamp}`,
    });

    for (const candidate of candidateUrls) {
      try {
        const res = await fetch(candidate.url, { cache: 'no-cache' });
        if (res.ok) {
          const data = await res.json();
          const readings: BloodSugarReading[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.readings)
            ? data.readings
            : [];

          if (readings.length > 0) {
            return {
              success: true,
              readings,
              message: `Retrieved ${readings.length} readings from backend file for user '${cleanUser}'!`,
              source: candidate.name,
            };
          }
        }
      } catch (e) {
        // Try next candidate
      }
    }

    return {
      success: false,
      message: `No backend JSON file found for username '${cleanUser}'.`,
    };
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
   * Save user's JSON file specifically formatted as the backend file (`<username>.json`)
   */
  public saveBackendJsonFile(readings: BloodSugarReading[], username: string, displayName?: string): void {
    const payload = {
      username,
      displayName: displayName || username,
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      totalReadings: readings.length,
      readings,
    };
    const jsonString = JSON.stringify(payload, null, 2);
    downloadFile(jsonString, `${username}.json`, 'application/json');
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

  /**
   * Optional Live Cloud Sync via Firebase Realtime Database
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
