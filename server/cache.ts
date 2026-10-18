/**
 * In-Memory Bounded TTL Cache for Read-Only API Responses
 * AI Document Review & Routing Agent
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

export class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(maxEntries = 100) {
    this.maxEntries = maxEntries;
  }

  public get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.value as T;
  }

  public set<T>(key: string, value: T, ttlMs = 5000): void {
    // Evict oldest if full
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, {
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs
    });
  }

  public invalidate(key: string): boolean {
    return this.store.delete(key);
  }

  public invalidatePrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  public clear(): void {
    this.store.clear();
  }

  public getStats() {
    return {
      entries: this.store.size,
      max_entries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hit_ratio_pct:
        this.hits + this.misses > 0
          ? Math.round((this.hits / (this.hits + this.misses)) * 100)
          : 0
    };
  }
}

export const apiCache = new MemoryCache(100);
