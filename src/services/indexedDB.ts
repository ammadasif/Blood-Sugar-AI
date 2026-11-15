import { BloodSugarReading } from '../types';

const DB_NAME = 'GlucoTrackPro_DB';
const DB_VERSION = 1;
const STORE_NAME = 'readings';

class DatabaseService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error || new Error('Failed to open IndexedDB'));
      };
    });

    return this.dbPromise;
  }

  public async getAllReadings(): Promise<BloodSugarReading[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result as BloodSugarReading[];
        // Sort descending by date, then time
        results.sort((a, b) => {
          const dateTimeA = `${a.date}T${a.time}`;
          const dateTimeB = `${b.date}T${b.time}`;
          return dateTimeB.localeCompare(dateTimeA);
        });
        resolve(results);
      };

      request.onerror = () => reject(request.error);
    });
  }

  public async getReadingById(id: string): Promise<BloodSugarReading | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve((request.result as BloodSugarReading) || null);
      request.onerror = () => reject(request.error);
    });
  }

  public async addReading(
    reading: BloodSugarReading,
    storageLimit?: number,
    autoDeleteOld?: boolean
  ): Promise<BloodSugarReading> {
    const db = await this.openDB();

    // Check storage limit if configured
    if (storageLimit && autoDeleteOld) {
      const all = await this.getAllReadings();
      if (all.length >= storageLimit) {
        // Find oldest readings to delete
        const excessCount = all.length - storageLimit + 1;
        // all is sorted newest first, so oldest are at the end
        const toDelete = all.slice(-excessCount);
        for (const item of toDelete) {
          await this.deleteReading(item.id);
        }
      }
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(reading);

      request.onsuccess = () => resolve(reading);
      request.onerror = () => reject(request.error);
    });
  }

  public async updateReading(reading: BloodSugarReading): Promise<BloodSugarReading> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(reading);

      request.onsuccess = () => resolve(reading);
      request.onerror = () => reject(request.error);
    });
  }

  public async deleteReading(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async deleteMultiple(ids: string[]): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      ids.forEach((id) => store.delete(id));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async bulkAddReadings(readings: BloodSugarReading[]): Promise<number> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      let count = 0;

      readings.forEach((item) => {
        store.put(item);
        count++;
      });

      tx.oncomplete = () => resolve(count);
      tx.onerror = () => reject(tx.error);
    });
  }

  public async clearAllReadings(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getCount(): Promise<number> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

export const dbService = new DatabaseService();

