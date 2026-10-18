/**
 * Safe File-Backed Backup and Restore Service
 * AI Document Review & Routing Agent
 */

import fs from 'node:fs';
import path from 'node:path';
import { caseStore } from './store.ts';
import { log } from './logger.ts';
import { AppError } from './errors.ts';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

export interface BackupMetadata {
  fileName: string;
  filePath: string;
  timestamp: string;
  sizeBytes: number;
  caseCount: number;
  version: number;
}

export class BackupService {
  constructor() {
    this.ensureDir();
  }

  private ensureDir() {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      }
    } catch (e) {
      console.warn('Backup directory ensure error:', e);
    }
  }

  /**
   * Creates a timestamped backup of current persistent case data.
   */
  public createBackup(isPreRestore = false): BackupMetadata {
    this.ensureDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prefix = isPreRestore ? 'pre-restore-safety-snapshot' : 'backup';
    const fileName = `${prefix}-${timestamp}.json`;
    const targetPath = path.join(BACKUPS_DIR, fileName);

    const cases = caseStore.getAll();
    const backupPayload = {
      version: 1,
      created_at: new Date().toISOString(),
      case_count: cases.length,
      cases
    };

    const tempPath = `${targetPath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(backupPayload, null, 2), 'utf-8');
    fs.renameSync(tempPath, targetPath);

    const stats = fs.statSync(targetPath);

    log({
      level: 'INFO',
      operation: 'BACKUP_CREATED',
      message: `Backup created: ${fileName} (${cases.length} cases, ${Math.round(stats.size / 1024)} KB)`
    });

    return {
      fileName,
      filePath: targetPath,
      timestamp: new Date().toISOString(),
      sizeBytes: stats.size,
      caseCount: cases.length,
      version: 1
    };
  }

  /**
   * Lists available backup files ordered by recency.
   */
  public listBackups(): BackupMetadata[] {
    this.ensureDir();
    if (!fs.existsSync(BACKUPS_DIR)) return [];

    const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.endsWith('.json'));
    const list: BackupMetadata[] = [];

    for (const f of files) {
      try {
        const fullPath = path.join(BACKUPS_DIR, f);
        const stats = fs.statSync(fullPath);
        const raw = fs.readFileSync(fullPath, 'utf-8');
        const parsed = JSON.parse(raw);

        list.push({
          fileName: f,
          filePath: fullPath,
          timestamp: parsed.created_at || stats.mtime.toISOString(),
          sizeBytes: stats.size,
          caseCount: Array.isArray(parsed.cases) ? parsed.cases.length : (parsed.case_count || 0),
          version: parsed.version || 1
        });
      } catch (err) {
        console.warn(`Failed reading backup header for ${f}:`, err);
      }
    }

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Validates and restores a backup file.
   * Creates a pre-restore backup first to ensure no valid data is silently destroyed.
   */
  public restoreBackup(fileName: string): { restoredCases: number; preRestoreBackup: string } {
    this.ensureDir();
    const safeName = path.basename(fileName);
    const backupPath = path.join(BACKUPS_DIR, safeName);

    if (!fs.existsSync(backupPath)) {
      throw new AppError(`Backup file "${safeName}" not found.`, 'BACKUP_FAILED', 404);
    }

    let parsed: any;
    try {
      const raw = fs.readFileSync(backupPath, 'utf-8');
      parsed = JSON.parse(raw);
    } catch (err: any) {
      throw new AppError(`Corrupt backup file: Unable to parse JSON. (${err.message})`, 'RESTORE_FAILED', 400);
    }

    // Validate backup schema integrity
    if (!parsed || typeof parsed !== 'object') {
      throw new AppError('Invalid backup file: Root must be a JSON object.', 'RESTORE_FAILED', 400);
    }
    if (!Array.isArray(parsed.cases)) {
      throw new AppError('Invalid backup file: "cases" array missing from backup payload.', 'RESTORE_FAILED', 400);
    }
    for (const c of parsed.cases) {
      if (!c.case_id || !c.case_number || !c.status) {
        throw new AppError(`Incompatible case record schema found in backup.`, 'RESTORE_FAILED', 400);
      }
    }

    // 1. Create safety snapshot before altering current state!
    const preRestore = this.createBackup(true);

    // 2. Perform atomic restore into store
    caseStore.restoreFromCases(parsed.cases);

    log({
      level: 'INFO',
      operation: 'BACKUP_RESTORED',
      message: `Successfully restored ${parsed.cases.length} cases from ${safeName}. Safety snapshot saved as ${preRestore.fileName}.`
    });

    return {
      restoredCases: parsed.cases.length,
      preRestoreBackup: preRestore.fileName
    };
  }
}

export const backupService = new BackupService();
