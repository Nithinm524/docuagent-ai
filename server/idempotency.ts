/**
 * Server-Side Idempotency & Duplicate Submission Prevention
 * AI Document Review & Routing Agent
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { sendError } from './errors.ts';
import { log } from './logger.ts';

const IDEMP_DIR = path.resolve(process.cwd(), '.data');
const IDEMP_FILE = path.join(IDEMP_DIR, 'idempotency_keys.json');

export interface IdempotencyRecord {
  key: string;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  expiresAt: string;
  statusCode?: number;
  responseBody?: any;
  requestFingerprint: string;
}

export class IdempotencyStore {
  private cache = new Map<string, IdempotencyRecord>();
  private ttlMs = 24 * 3600 * 1000; // 24 hours TTL

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(IDEMP_FILE)) {
        const raw = fs.readFileSync(IDEMP_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        const now = Date.now();
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (new Date(item.expiresAt).getTime() > now) {
              this.cache.set(item.key, item);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Idempotency store load warning:', e);
    }
  }

  private persist() {
    try {
      if (!fs.existsSync(IDEMP_DIR)) {
        fs.mkdirSync(IDEMP_DIR, { recursive: true });
      }
      const data = Array.from(this.cache.values());
      fs.writeFileSync(IDEMP_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Idempotency store persist error:', e);
    }
  }

  public get(key: string): IdempotencyRecord | undefined {
    const record = this.cache.get(key);
    if (!record) return undefined;
    if (new Date(record.expiresAt).getTime() < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return record;
  }

  public setProcessing(key: string, requestFingerprint: string): boolean {
    const existing = this.get(key);
    if (existing) {
      return false; // Already present
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlMs).toISOString();

    const record: IdempotencyRecord = {
      key,
      status: 'processing',
      createdAt: now.toISOString(),
      expiresAt,
      requestFingerprint
    };

    this.cache.set(key, record);
    this.persist();
    return true;
  }

  public complete(key: string, statusCode: number, responseBody: any): void {
    const record = this.cache.get(key);
    if (record) {
      record.status = 'completed';
      record.statusCode = statusCode;
      record.responseBody = responseBody;
      this.persist();
    }
  }

  public fail(key: string, statusCode: number, errorBody: any): void {
    const record = this.cache.get(key);
    if (record) {
      record.status = 'failed';
      record.statusCode = statusCode;
      record.responseBody = errorBody;
      this.persist();
    }
  }

  public remove(key: string): void {
    this.cache.delete(key);
    this.persist();
  }

  public clear(): void {
    this.cache.clear();
    this.persist();
  }

  public getStats() {
    return {
      active_keys: this.cache.size,
      storage_file: IDEMP_FILE
    };
  }
}

export const idempotencyStore = new IdempotencyStore();

/**
 * Computes deterministic SHA-256 fingerprint for a request payload.
 */
export function computePayloadFingerprint(body: any): string {
  const normalized = JSON.stringify(body || {});
  return crypto.createHash('sha256').update(normalized).digest('hex');
}
