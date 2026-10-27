/**
 * Structured Server-Side Logger with Secret Sanitization
 * AI Document Review & Routing Agent
 */

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  requestId?: string;
  operation: string;
  caseId?: string;
  durationMs?: number;
  message: string;
  errorSummary?: string;
  clientIp?: string;
  targetResource?: string;
  details?: Record<string, any>;
}

// Bounded in-memory ring buffer for diagnostics inspection (last 150 entries)
const LOG_BUFFER_SIZE = 150;
const logBuffer: StructuredLog[] = [];

/**
 * Redacts secrets, API keys, tokens, PII, financial identifiers, and document payloads from logs.
 */
export function sanitizeLogData(input: any): any {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') {
    // Redact base64 file payloads
    if (input.startsWith('data:') && input.includes(';base64,')) {
      return `[REDACTED_BASE64_DATA length=${input.length}]`;
    }
    // Redact API keys / tokens / credentials
    let sanitized = input
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_GEMINI_KEY]')
      .replace(/(Bearer\s+)[A-Za-z0-9_\-\.]+/gi, '$1[REDACTED_TOKEN]')
      .replace(/("?(?:apiKey|password|secret|key)"?\s*[:=]\s*"?[^",\s]+"?)/gi, '[REDACTED_CREDENTIAL]')
      // Redact SSN: 000-00-0000
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]')
      // Redact Aadhaar: 0000 0000 0000
      .replace(/\b\d{4}\s\d{4}\s\d{4}\b/g, '[REDACTED_AADHAAR]')
      // Redact PAN: 5 letters, 4 digits, 1 letter
      .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, '[REDACTED_PAN]')
      // Redact Card/Bank 13-19 digit strings
      .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[REDACTED_ACCOUNT_NUM]');
    return sanitized;
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeLogData);
  }
  if (typeof input === 'object') {
    const sanitizedObj: Record<string, any> = {};
    for (const [key, val] of Object.entries(input)) {
      const lower = key.toLowerCase();
      if (
        lower.includes('key') ||
        lower.includes('secret') ||
        lower.includes('token') ||
        lower.includes('password') ||
        lower.includes('authorization')
      ) {
        sanitizedObj[key] = '[REDACTED]';
      } else if (
        lower.includes('passport') ||
        lower.includes('ssn') ||
        lower.includes('aadhaar') ||
        lower.includes('pan_number') ||
        lower.includes('account_number') ||
        lower.includes('tax_id') ||
        lower.includes('id_number') ||
        lower.includes('document_number')
      ) {
        sanitizedObj[key] = '[REDACTED_PII_IDENTIFIER]';
      } else if (lower.includes('filedataurl') || lower.includes('rawtext') || lower.includes('raw_text')) {
        sanitizedObj[key] = typeof val === 'string' ? `[TEXT_DATA length=${val.length}]` : '[REDACTED]';
      } else {
        sanitizedObj[key] = sanitizeLogData(val);
      }
    }
    return sanitizedObj;
  }
  return input;
}

export function log(entry: Omit<StructuredLog, 'timestamp'>): StructuredLog {
  const fullEntry: StructuredLog = {
    timestamp: new Date().toISOString(),
    ...entry,
    message: sanitizeLogData(entry.message),
    errorSummary: entry.errorSummary ? sanitizeLogData(entry.errorSummary) : undefined,
    details: entry.details ? sanitizeLogData(entry.details) : undefined
  };

  // Add to ring buffer
  logBuffer.unshift(fullEntry);
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.pop();
  }

  // Print single-line structured output for production monitoring
  const out = `[${fullEntry.timestamp}] [${fullEntry.level}] [${fullEntry.operation}] ${fullEntry.message}${
    fullEntry.durationMs !== undefined ? ` (${fullEntry.durationMs}ms)` : ''
  }${fullEntry.errorSummary ? ` - ERROR: ${fullEntry.errorSummary}` : ''}`;

  if (fullEntry.level === 'ERROR') {
    console.error(out);
  } else if (fullEntry.level === 'WARN') {
    console.warn(out);
  } else {
    console.log(out);
  }

  return fullEntry;
}

export function getRecentLogs(limit = 50, level?: LogLevel): StructuredLog[] {
  let filtered = logBuffer;
  if (level) {
    filtered = filtered.filter((l) => l.level === level);
  }
  return filtered.slice(0, Math.min(limit, LOG_BUFFER_SIZE));
}

export function clearLogs(): void {
  logBuffer.length = 0;
}
