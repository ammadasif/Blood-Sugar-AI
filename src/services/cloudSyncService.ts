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
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPRESSION HELPERS — Browser native CompressionStream API
// No external library needed. Works in Chrome 80+, Safari 16.4+, Firefox 113+
// ─────────────────────────────────────────────────────────────────────────────
class CloudSyncService {

  // ───────────────────────────────────────────────
  public sanitizeUsername(username: string): string {
    return (username || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  }

  // ───────────────────────────────────────────────
  // COMPRESS string → base64url (deflate-raw)
  // ───────────────────────────────────────────────
  private async compress(str: string): Promise<string> {
    try {
      const stream = new (window as any).CompressionStream('deflate-raw');
      const writer = stream.writable.getWriter();
      writer.write(new TextEncoder().encode(str));
      writer.close();

      const chunks: Uint8Array[] = [];
      const reader = stream.readable.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const buf = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { buf.set(c, off); off += c.length; }

      // base64url (no +, /, =)
      return btoa(String.fromCharCode(...buf))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    } catch {
      // Fallback: plain base64
      return btoa(encodeURIComponent(str)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
  }

  // ───────────────────────────────────────────────
  // DECOMPRESS base64url → string
  // ───────────────────────────────────────────────
  public async decompress(b64url: string): Promise<string> {
    try {
      const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4;
      const padded = pad ? b64 + '='.repeat(4 - pad) : b64;

      const bytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));

      const stream = new (window as any).DecompressionStream('deflate-raw');
      const writer = stream.writable.getWriter();
      writer.write(bytes);
      writer.close();

      const chunks: Uint8Array[] = [];
      const reader = stream.readable.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const buf = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { buf.set(c, off); off += c.length; }
      return new TextDecoder().decode(buf);
    } catch {
      // Fallback: plain base64
      try {
        const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
        const pad = b64.length % 4;
        const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
        return decodeURIComponent(atob(padded));
      } catch {
        return '';
      }
    }
  }

  // ───────────────────────────────────────────────
  // GENERATE QR TRANSFER URL
  // Readings → compressed → base64url → ?import=... URL
  // QR code for this URL lets mobile import in one scan
  // ───────────────────────────────────────────────
  public async generateQRTransferUrl(readings: BloodSugarReading[]): Promise<string> {
    const base = `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '');

    // Minimal payload: only essential fields to keep size small
    const minimal = readings.map(r => ({
      d: r.date,
      t: r.time,
      v: r.value,
      y: r.type,
      u: r.unitAtEntry || 'mg/dL',
      m: r.mealInfo || '',
      n: r.notes || '',
      i: r.id,
    }));

    const json = JSON.stringify(minimal);
    const compressed = await this.compress(json);
    return `${base}/?import=${compressed}`;
  }

  // ───────────────────────────────────────────────
  // DECODE IMPORT URL DATA
  // Called when app opens with ?import=... param
  // ───────────────────────────────────────────────
  public async decodeImportParam(importParam: string): Promise<BloodSugarReading[] | null> {
    try {
      const json = await this.decompress(importParam);
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return null;

      return parsed.map((item: any, idx: number) => ({
        id: item.i || `import_${item.d}_${(item.t || '').replace(':', '')}_${idx}`,
        date: item.d,
        time: item.t,
        value: Number(item.v),
        unitAtEntry: item.u || 'mg/dL',
        type: item.y || 'fasting',
        mealInfo: item.m || undefined,
        notes: item.n || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
    } catch (e) {
      console.warn('[CloudSync] Failed to decode import param:', e);
      return null;
    }
  }

  // ───────────────────────────────────────────────
  // QR CODE IMAGE URL (uses free qrserver.com API)
  // ───────────────────────────────────────────────
  public getQRCodeImageUrl(dataUrl: string, size = 240): string {
    const encoded = encodeURIComponent(dataUrl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&ecc=M&margin=1`;
  }

  // ───────────────────────────────────────────────
  // LOCAL CACHE (keeps working offline)
  // ───────────────────────────────────────────────
  private saveToCache(cleanUser: string, payload: CloudSyncPayload) {
    try {
      localStorage.setItem(`glucotrack_cache_${cleanUser}`, JSON.stringify(payload));
    } catch { /* storage full */ }
  }

  public loadFromCache(cleanUser: string): CloudSyncPayload | null {
    try {
      const raw = localStorage.getItem(`glucotrack_cache_${cleanUser}`);
      if (!raw) return null;
      const data = JSON.parse(raw) as CloudSyncPayload;
      return data && Array.isArray(data.readings) ? data : null;
    } catch {
      return null;
    }
  }

  // ───────────────────────────────────────────────
  // PUSH — Save to localStorage cache (primary local sync)
  // ───────────────────────────────────────────────
  public async pushToCloud(
    username: string,
    readings: BloodSugarReading[],
    settings: AppSettings
  ): Promise<SyncResult> {
    const cleanUser = this.sanitizeUsername(username);
    if (!cleanUser || cleanUser.length < 2) {
      return { success: false, message: 'Username kam az kam 2 characters ka hona chahiye.' };
    }

    const payload: CloudSyncPayload = {
      username: cleanUser,
      version: 3,
      updatedAt: Date.now(),
      deviceInfo: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
      readings,
      settings: {
        unit: settings.unit,
        targetProfile: settings.targetProfile,
        ranges: settings.ranges,
      },
    };

    // Save to localStorage cache
    this.saveToCache(cleanUser, payload);

    return {
      success: true,
      message: `✅ ${readings.length} readings locally saved under username '${cleanUser}'.\n📱 Ab QR Code se Mobile par transfer karein.`,
      readingsCount: readings.length,
      updatedAt: payload.updatedAt,
    };
  }

  // ───────────────────────────────────────────────
  // PULL — Load from localStorage cache
  // ───────────────────────────────────────────────
  public async pullFromCloud(
    username: string,
    _settings?: AppSettings
  ): Promise<{ success: boolean; message: string; payload?: CloudSyncPayload }> {
    const cleanUser = this.sanitizeUsername(username);
    if (!cleanUser || cleanUser.length < 2) {
      return { success: false, message: 'Invalid username.' };
    }

    const cached = this.loadFromCache(cleanUser);
    if (cached && cached.readings.length > 0) {
      return {
        success: true,
        message: `✅ ${cached.readings.length} readings mill gayi username '${cleanUser}' ke liye.`,
        payload: cached,
      };
    }

    return {
      success: false,
      message: `❌ Is device par username '${cleanUser}' ka koi data nahi mila.\n\n📱 Dusre device se QR Code scan karein, ya wahan se Push karke yahan Pull karein.`,
    };
  }

  // ───────────────────────────────────────────────
  // MERGE — Combine local + imported readings
  // ───────────────────────────────────────────────
  public mergeReadings(
    localReadings: BloodSugarReading[],
    cloudReadings: BloodSugarReading[]
  ): { merged: BloodSugarReading[]; newCount: number } {
    const existingMap = new Map<string, BloodSugarReading>();
    const fingerprintSet = new Set<string>();
    const fp = (r: BloodSugarReading) => `${r.date}_${r.time}_${r.type}_${r.value}`;

    localReadings.forEach(r => {
      existingMap.set(r.id, r);
      fingerprintSet.add(fp(r));
    });

    let newCount = 0;
    cloudReadings.forEach(cr => {
      if (!existingMap.has(cr.id) && !fingerprintSet.has(fp(cr))) {
        existingMap.set(cr.id, cr);
        fingerprintSet.add(fp(cr));
        newCount++;
      } else if (existingMap.has(cr.id)) {
        const local = existingMap.get(cr.id)!;
        if ((cr.updatedAt || 0) > (local.updatedAt || 0)) existingMap.set(cr.id, cr);
      }
    });

    const merged = Array.from(existingMap.values()).sort((a, b) =>
      `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)
    );
    return { merged, newCount };
  }

  // ───────────────────────────────────────────────
  // MOBILE SYNC URL (?user=...)
  // ───────────────────────────────────────────────
  public generateMobileSyncUrl(username: string): string {
    const clean = this.sanitizeUsername(username);
    const base = `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '');
    return `${base}/?user=${encodeURIComponent(clean)}`;
  }
}

export const cloudSyncService = new CloudSyncService();
