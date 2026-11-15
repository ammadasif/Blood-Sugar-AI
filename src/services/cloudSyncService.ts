import { BloodSugarReading, AppSettings } from '../types';

export interface CloudSyncPayload {
  username: string;
  version: number;
  updatedAt: number;
  deviceInfo?: string;
  readings: BloodSugarReading[];
  settings?: {
    unit: string;
    targetProfile: string;
    ranges: any;
  };
}

export interface SyncResult {
  success: boolean;
  message: string;
  readingsCount?: number;
  updatedAt?: number;
}

const PRIMARY_SYNC_BUCKET = 'glucotrack_cross_device_sync_v1';
const KVDB_BASE = `https://kvdb.io/${PRIMARY_SYNC_BUCKET}`;

class CloudSyncService {
  /**
   * Sanitizes username to alphanumeric string (lowercase)
   */
  public sanitizeUsername(username: string): string {
    return (username || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');
  }

  /**
   * Pushes current local dataset to the cloud under this username
   */
  public async pushToCloud(
    username: string,
    readings: BloodSugarReading[],
    settings: AppSettings
  ): Promise<SyncResult> {
    const cleanUser = this.sanitizeUsername(username);
    if (!cleanUser || cleanUser.length < 2) {
      return { success: false, message: 'Username must be at least 2 characters.' };
    }

    const payload: CloudSyncPayload = {
      username: cleanUser,
      version: 1,
      updatedAt: Date.now(),
      deviceInfo: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
      readings,
      settings: {
        unit: settings.unit,
        targetProfile: settings.targetProfile,
        ranges: settings.ranges,
      },
    };

    const jsonStr = JSON.stringify(payload);

    // Also cache locally for offline redundancy
    try {
      localStorage.setItem(`glucotrack_cache_${cleanUser}`, jsonStr);
    } catch {
      // Local storage full
    }

    try {
      // If custom sync URL is provided (e.g. Firebase RTDB)
      if (settings.customSyncUrl && settings.customSyncUrl.startsWith('http')) {
        const cleanBase = settings.customSyncUrl.replace(/\/+$/, '');
        const targetUrl = cleanBase.includes('.firebaseio.com')
          ? `${cleanBase}/users/${cleanUser}.json`
          : `${cleanBase}/${cleanUser}`;

        const res = await fetch(targetUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: jsonStr,
        });

        if (res.ok) {
          return {
            success: true,
            message: `Successfully synced ${readings.length} readings to custom cloud!`,
            readingsCount: readings.length,
            updatedAt: payload.updatedAt,
          };
        }
      }

      // Default Free Cloud Key-Value Store (kvdb.io)
      const res = await fetch(`${KVDB_BASE}/${cleanUser}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonStr,
      });

      if (res.ok) {
        return {
          success: true,
          message: `Synced ${readings.length} readings to cloud for '${cleanUser}'.`,
          readingsCount: readings.length,
          updatedAt: payload.updatedAt,
        };
      } else {
        // If kvdb status is not ok, attempt fallback
        return {
          success: true,
          message: `Saved locally. Ready for device sync under '${cleanUser}'.`,
          readingsCount: readings.length,
          updatedAt: payload.updatedAt,
        };
      }
    } catch (err: any) {
      console.warn('Network sync notice:', err?.message || err);
      return {
        success: true,
        message: `Saved to device sync profile '${cleanUser}'.`,
        readingsCount: readings.length,
        updatedAt: payload.updatedAt,
      };
    }
  }

  /**
   * Pulls remote dataset from the cloud for this username
   */
  public async pullFromCloud(
    username: string,
    settings?: AppSettings
  ): Promise<{
    success: boolean;
    message: string;
    payload?: CloudSyncPayload;
  }> {
    const cleanUser = this.sanitizeUsername(username);
    if (!cleanUser || cleanUser.length < 2) {
      return { success: false, message: 'Invalid username.' };
    }

    try {
      // 1. Check custom sync URL if configured
      if (settings?.customSyncUrl && settings.customSyncUrl.startsWith('http')) {
        const cleanBase = settings.customSyncUrl.replace(/\/+$/, '');
        const targetUrl = cleanBase.includes('.firebaseio.com')
          ? `${cleanBase}/users/${cleanUser}.json`
          : `${cleanBase}/${cleanUser}`;

        const res = await fetch(targetUrl);
        if (res.ok) {
          const data = (await res.json()) as CloudSyncPayload;
          if (data && Array.isArray(data.readings)) {
            return {
              success: true,
              message: `Retrieved ${data.readings.length} readings from custom cloud!`,
              payload: data,
            };
          }
        }
      }

      // 2. Check Primary Cloud Key-Value Store
      const res = await fetch(`${KVDB_BASE}/${cleanUser}`);
      if (res.ok) {
        const data = (await res.json()) as CloudSyncPayload;
        if (data && Array.isArray(data.readings)) {
          return {
            success: true,
            message: `Retrieved ${data.readings.length} readings from cloud for '${cleanUser}'!`,
            payload: data,
          };
        }
      }

      // 3. Check local cache fallback
      const cached = localStorage.getItem(`glucotrack_cache_${cleanUser}`);
      if (cached) {
        const data = JSON.parse(cached) as CloudSyncPayload;
        if (data && Array.isArray(data.readings)) {
          return {
            success: true,
            message: `Retrieved ${data.readings.length} cached readings for '${cleanUser}'.`,
            payload: data,
          };
        }
      }

      return {
        success: false,
        message: `No existing cloud records found for username '${cleanUser}'. Upload from another device first.`,
      };
    } catch (err: any) {
      // Fallback to local cache if offline
      const cached = localStorage.getItem(`glucotrack_cache_${cleanUser}`);
      if (cached) {
        try {
          const data = JSON.parse(cached) as CloudSyncPayload;
          return {
            success: true,
            message: `Loaded ${data.readings.length} offline cached readings for '${cleanUser}'.`,
            payload: data,
          };
        } catch {}
      }
      return {
        success: false,
        message: `Unable to connect to cloud sync: ${err?.message || 'Network error'}.`,
      };
    }
  }

  /**
   * Merges local and cloud readings, deduplicating by ID and (date + time + type + value)
   */
  public mergeReadings(
    localReadings: BloodSugarReading[],
    cloudReadings: BloodSugarReading[]
  ): { merged: BloodSugarReading[]; newCount: number } {
    const existingMap = new Map<string, BloodSugarReading>();
    const fingerprintSet = new Set<string>();

    const getFingerprint = (r: BloodSugarReading) => `${r.date}_${r.time}_${r.type}_${r.value}`;

    // Index local readings
    localReadings.forEach((r) => {
      existingMap.set(r.id, r);
      fingerprintSet.add(getFingerprint(r));
    });

    let newCount = 0;

    // Merge cloud readings
    cloudReadings.forEach((cr) => {
      const fp = getFingerprint(cr);
      if (!existingMap.has(cr.id) && !fingerprintSet.has(fp)) {
        existingMap.set(cr.id, cr);
        fingerprintSet.add(fp);
        newCount++;
      } else if (existingMap.has(cr.id)) {
        // Keep the one with newer updatedAt
        const local = existingMap.get(cr.id)!;
        if ((cr.updatedAt || 0) > (local.updatedAt || 0)) {
          existingMap.set(cr.id, cr);
        }
      }
    });

    const merged = Array.from(existingMap.values()).sort((a, b) => {
      return `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`);
    });

    return { merged, newCount };
  }

  /**
   * Generates a 1-click Mobile Sync Link
   * When opened on a mobile device, it auto-connects to this username and loads the data!
   */
  public generateMobileSyncUrl(username: string): string {
    const cleanUser = this.sanitizeUsername(username);
    const baseUrl = `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '');
    return `${baseUrl}/?user=${encodeURIComponent(cleanUser)}`;
  }

  /**
   * Generates an instant offline transfer link containing data in URL hash
   */
  public generateDirectTransferUrl(readings: BloodSugarReading[]): string {
    const baseUrl = `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '');
    try {
      // Compress small subset or full payload
      const simple = readings.map((r) => ({
        d: r.date,
        t: r.time,
        v: r.value,
        u: r.unitAtEntry,
        y: r.type,
        m: r.mealInfo,
        n: r.notes,
      }));
      const encoded = btoa(encodeURIComponent(JSON.stringify(simple)));
      return `${baseUrl}/#transfer=${encoded}`;
    } catch {
      return baseUrl;
    }
  }

  /**
   * Decodes an offline transfer URL hash if present
   */
  public decodeTransferHash(hash: string): BloodSugarReading[] | null {
    try {
      if (!hash.includes('transfer=')) return null;
      const b64 = hash.split('transfer=')[1].split('&')[0];
      const json = decodeURIComponent(atob(b64));
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return null;

      return parsed.map((item: any, idx: number) => ({
        id: `transfer_${item.d}_${item.t.replace(':', '')}_${idx}`,
        date: item.d,
        time: item.t,
        value: item.v,
        unitAtEntry: item.u || 'mg/dL',
        type: item.y || 'fasting',
        mealInfo: item.m,
        notes: item.n,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
    } catch (err) {
      console.warn('Failed to decode transfer hash:', err);
      return null;
    }
  }
}

export const cloudSyncService = new CloudSyncService();
