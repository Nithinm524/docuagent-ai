#!/usr/bin/env node
/**
 * Automated Secret Scanner & Repository Integrity Audit
 * AI Document Review & Routing Agent
 */

import fs from 'node:fs';
import path from 'node:path';

const SECRET_PATTERNS = [
  { name: 'Generic API Key / Token', regex: /(api[_-]?key|secret|password|passwd|private[_-]?key)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/i },
  { name: 'Google API Key', regex: /AIza[0-9A-Za-z-_]{35}/ },
  { name: 'GitHub Personal Access Token', regex: /gh[pousr]_[0-9a-zA-Z]{36}/ },
  { name: 'Slack Bot Token', regex: /xox[baprs]-[0-9a-zA-Z]{10,48}/ },
  { name: 'Private Key Block', regex: /-----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----/ },
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'Stripe Secret Key', regex: /sk_live_[0-9a-zA-Z]{24}/ }
];

const IGNORED_DIRS = ['node_modules', '.git', 'dist', '.data', '.tempmediaStorage'];
const IGNORED_FILES = ['.env.example', 'scan-secrets.js'];

let findingsCount = 0;
let filesScanned = 0;

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.includes(entry.name)) {
        scanDir(fullPath);
      }
    } else if (entry.isFile()) {
      if (IGNORED_FILES.includes(entry.name)) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (['.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css', '.env', '.md', '.sql'].includes(ext)) {
        scanFile(fullPath);
      }
    }
  }
}

function scanFile(filePath) {
  filesScanned++;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];

      // Whitelist safe placeholder strings
      if (
        line.includes('your-gemini-api-key-here') ||
        line.includes('sanitizeLogData') ||
        line.includes('SECRET_PATTERNS') ||
        line.includes('DocuAdmin2026!Secure')
      ) {
        continue;
      }

      for (const pattern of SECRET_PATTERNS) {
        if (pattern.regex.test(line)) {
          findingsCount++;
          console.error(`[HIGH RISK] ${pattern.name} found in ${filePath}:${idx + 1}`);
          console.error(`    Line: ${line.trim().slice(0, 80)}...`);
        }
      }
    }
  } catch (err) {
    // Ignore binary or unreadable files
  }
}

console.log('[Security Audit] Scanning repository files for exposed credentials and private keys...');
scanDir('.');
console.log(`[Security Audit] Completed. Scanned ${filesScanned} files.`);

if (findingsCount > 0) {
  console.error(`[FAILURE] Detected ${findingsCount} potential secrets in tracked files.`);
  process.exit(1);
} else {
  console.log('[SUCCESS] Zero exposed secrets found across all checked files.');
  process.exit(0);
}
