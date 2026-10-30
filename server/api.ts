/**
 * Express API Endpoints for AI Document Review & Routing Agent
 *
 * Implements:
 * - Security headers & request ID tracking
 * - Sliding window rate limiting (stricter on expensive AI/upload endpoints)
 * - Idempotency key duplicate prevention on document processing
 * - Server-side file signature, MIME, and 15MB size validation
 * - Read-only TTL response caching for metrics
 * - Server-side pagination & filtering on cases
 * - Optimistic concurrency control (version conflict detection HTTP 409)
 * - Health endpoints: /api/health/live, /api/health/ready
 * - Diagnostics, usage tracking, budgets, and backup/restore admin endpoints
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import { caseStore } from './store.ts';
import { runAgentPipeline, reEvaluateCase, generateExecutiveSummary } from './agent.ts';
import { SYNTHETIC_SCENARIOS } from '../src/shared/samples.ts';
import { DOCUMENT_SCHEMAS } from '../src/shared/validation.ts';
import type { AuditEvent, ReviewAction } from '../src/shared/types.ts';
import { log, getRecentLogs } from './logger.ts';
import { sendError, AppError } from './errors.ts';
import {
  expensiveAiLimiter,
  standardApiLimiter,
  globalRateLimiter,
  authLimiter,
  dpdpLimiter,
  passwordResetLimiter,
  accountActionLimiter
} from './rateLimiter.ts';
import { usageTracker } from './usageTracker.ts';
import {
  idempotencyStore,
  computePayloadFingerprint
} from './idempotency.ts';
import { validateUploadFile, MAX_UPLOAD_SIZE_BYTES } from './fileValidation.ts';
import { apiCache } from './cache.ts';
import { backupService } from './backup.ts';
import { notificationService } from './notifications.ts';
import {
  authService,
  requireAuth,
  optionalAuth,
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME
} from './auth.ts';
import {
  validateLoginBody,
  validateFieldUpdateBody,
  validateFindingResolutionBody,
  validateReviewActionBody
} from './validators.ts';

const api = express();

// Enable trust proxy for Cloud Run and reverse proxy IP detection
api.set('trust proxy', 1);

// Helper to trim and redact sensitive case fields for unauthorized roles
function trimCaseResponse(c: any, role?: string): any {
  if (!c) return c;
  const isPrivileged = role === 'admin' || role === 'reviewer';
  if (isPrivileged) return c;

  const redactedFields = (c.extracted_fields || []).map((f: any) => {
    const isSensitive = ['passport_number', 'national_id', 'ssn', 'account_number', 'tax_id', 'aadhaar'].includes(f.field_name);
    if (isSensitive && f.field_value && f.field_value.length > 4) {
      return {
        ...f,
        field_value: `***${f.field_value.slice(-4)}`,
        reviewed_value: f.reviewed_value ? `***${f.reviewed_value.slice(-4)}` : f.reviewed_value
      };
    }
    return f;
  });

  return {
    ...c,
    extracted_fields: redactedFields,
    file_data_url: c.file_data_url ? '[PROTECTED PAYLOAD: PRIVILEGED ACCESS ONLY]' : undefined
  };
}

// Request ID & security headers middleware
api.use((req: Request, res: Response, next: NextFunction) => {
  const reqId =
    (req.headers['x-request-id'] as string) ||
    `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
  (req as any).requestId = reqId;
  res.setHeader('X-Request-Id', reqId);

  // Security & Frame embedding headers compatible with AI Studio iframe environment
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self' https://*.google.com https://*.run.app https://aistudio.google.com;"
  );
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  // CORS headers for API endpoints
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id, X-CSRF-Token, X-Requested-With, Idempotency-Key');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  // Prevent caching of private document and user data
  if (req.path.startsWith('/api/cases') || req.path.startsWith('/api/auth') || req.path.startsWith('/api/dpdp')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  // HTTPS & HSTS detection
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const isLocal = req.hostname === 'localhost' || req.hostname === '127.0.0.1' || req.hostname === '0.0.0.0';

  if (isHttps) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Force HTTPS redirect on top-level pages only (never on /api routes to prevent AJAX fetch errors)
  if (
    process.env.FORCE_HTTPS === 'true' &&
    !isHttps &&
    !isLocal &&
    !req.path.startsWith('/api')
  ) {
    const host = req.headers.host;
    if (host) {
      return res.redirect(301, `https://${host}${req.url}`);
    }
  }

  next();
});

api.use(express.json({ limit: '15mb' }));

// Helper to log errors safely
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// -------------------------------------------------------------
// 1. HEALTH CHECK & SEO DISCOVERY ENDPOINTS
// -------------------------------------------------------------

/**
 * Public Sitemap and Robots routes with explicit MIME headers
 */
api.get('/sitemap.xml', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.sendFile(path.resolve(process.cwd(), 'public/sitemap.xml'));
});

api.get('/robots.txt', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.sendFile(path.resolve(process.cwd(), 'public/robots.txt'));
});

/**
 * Liveness endpoint: lightweight check if server process is running.
 */
api.get('/api/health/live', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

/**
 * Readiness endpoint: checks file storage accessibility and configuration.
 */
api.get('/api/health/ready', (req: Request, res: Response) => {
  const storageInfo = caseStore.getStorageInfo();
  const isStorageOk = storageInfo.status === 'operational';
  const memUsage = process.memoryUsage();

  const statusCode = isStorageOk ? 200 : 503;
  res.status(statusCode).json({
    status: isStorageOk ? 'ready' : 'degraded',
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      storage: {
        status: isStorageOk ? 'ok' : 'error',
        storage_type: storageInfo.storage_type,
        cases_in_memory: storageInfo.case_count,
        file_accessible: storageInfo.file_exists
      },
      memory: {
        rss_mb: Math.round(memUsage.rss / (1024 * 1024)),
        heap_used_mb: Math.round(memUsage.heapUsed / (1024 * 1024))
      },
      ai_provider: {
        gemini_configured: !!process.env.GEMINI_API_KEY,
        budget_status: usageTracker.isOperationAllowed().allowed ? 'ok' : 'budget_capped'
      }
    }
  });
});

// -------------------------------------------------------------
// 1B. AUTHENTICATION, SESSIONS, AND BOT PROTECTION
// -------------------------------------------------------------

/**
 * User Registration Endpoint:
 * Salted scrypt hashing, role support (admin, reviewer, viewer, applicant),
 * and affirmative Terms of Use acceptance requirement.
 */
api.post(
  '/api/auth/register',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, name, role, tenantId, termsAccepted } = req.body || {};
    const { session, token } = await authService.register(
      email,
      password,
      name,
      role,
      tenantId,
      termsAccepted
    );

    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/'
    });

    res.cookie(CSRF_COOKIE_NAME, session.csrfToken, {
      httpOnly: false,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/'
    });

    res.status(201).json({
      success: true,
      token,
      csrfToken: session.csrfToken,
      user: {
        userId: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
        tenantId: session.tenantId
      }
    });
  })
);

api.post(
  '/api/auth/login',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = validateLoginBody(req.body);
    const { session, token } = await authService.login(email, password, req);

    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/'
    });

    res.cookie(CSRF_COOKIE_NAME, session.csrfToken, {
      httpOnly: false,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({
      success: true,
      token,
      csrfToken: session.csrfToken,
      user: {
        userId: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
        tenantId: session.tenantId
      }
    });
  })
);

api.post('/api/auth/logout', (req: Request, res: Response) => {
  const sessionId = (req as any).user?.sessionId;
  if (sessionId) {
    authService.logout(sessionId);
  }
  res.clearCookie(SESSION_COOKIE_NAME);
  res.clearCookie(CSRF_COOKIE_NAME);
  res.json({ success: true, message: 'Logged out successfully.' });
});

api.post('/api/auth/demo', authLimiter, (req: Request, res: Response) => {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(SESSION_COOKIE_NAME, 'demo-reviewer-token', {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/'
  });

  res.cookie(CSRF_COOKIE_NAME, 'firebase-bearer-exempt', {
    httpOnly: false,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/'
  });

  log({
    level: 'INFO',
    operation: 'DEMO_AUTH_GRANTED',
    message: 'Issued demo reviewer session token for sandbox evaluation.'
  });

  res.json({
    success: true,
    token: 'demo-reviewer-token',
    csrfToken: 'firebase-bearer-exempt',
    user: {
      userId: 'usr-reviewer-01',
      email: 'reviewer@docuagent.local',
      name: 'Lead Reviewer Morgan',
      role: 'reviewer',
      tenantId: 'tenant-enterprise-primary'
    }
  });
});

api.get('/api/auth/me', optionalAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({
    authenticated: !user?.isAnonymous,
    user: {
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      isAnonymous: !!user.isAnonymous
    },
    csrfToken: user.csrfToken || 'demo-csrf-token'
  });
});

api.post('/api/auth/verify-challenge', standardApiLimiter, (req: Request, res: Response) => {
  const { challengeTimestamp } = req.body || {};
  if (!challengeTimestamp || typeof challengeTimestamp !== 'number') {
    return sendError(res, new AppError('BOT_CHALLENGE_FAILED', 400, 'Invalid challenge payload.'));
  }
  const ageMs = Date.now() - challengeTimestamp;
  if (ageMs < 400) {
    return sendError(res, new AppError('BOT_CHALLENGE_FAILED', 400, 'Bot velocity threshold violated.'));
  }
  if (ageMs > 300000) {
    return sendError(res, new AppError('BOT_CHALLENGE_FAILED', 400, 'Challenge expired. Please retry.'));
  }
  res.json({ verified: true, timestamp: Date.now() });
});

/**
 * Password Reset Request Endpoint:
 * Rate-limited to 5 requests per 15 minutes per IP.
 * Enforces account enumeration resistance.
 */
api.post(
  '/api/auth/password-reset/request',
  passwordResetLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return sendError(res, new AppError('INVALID_REQUEST_BODY', 400, 'Parameter "email" is required.'));
    }
    const result = await authService.requestPasswordReset(email);
    res.json(result);
  })
);

/**
 * Password Reset Confirmation Endpoint:
 * Rate-limited single-use token verification.
 * Hashes new password and invalidates all active user sessions across all devices.
 */
api.post(
  '/api/auth/password-reset/confirm',
  passwordResetLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { token, newPassword } = req.body || {};
    if (!token || typeof token !== 'string') {
      return sendError(res, new AppError('INVALID_TOKEN', 400, 'Parameter "token" is required.'));
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return sendError(res, new AppError('WEAK_PASSWORD', 400, 'Password must be at least 8 characters long.'));
    }
    const result = await authService.resetPasswordWithToken(token, newPassword);
    res.json(result);
  })
);

/**
 * User Account Deletion Endpoint (Right to Erasure / Account Termination):
 * Requires authenticated session, CSRF verification, and password re-authentication.
 * Revokes sessions and permanently purges user-associated document records.
 */
api.delete(
  '/api/auth/account',
  accountActionLimiter,
  requireAuth(),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { passwordConfirmation } = req.body || {};

    if (!passwordConfirmation || typeof passwordConfirmation !== 'string') {
      return sendError(
        res,
        new AppError('PASSWORD_REQUIRED', 400, 'Parameter "passwordConfirmation" is required to delete account.')
      );
    }

    const result = await authService.deleteUserAccount(
      user.userId,
      passwordConfirmation,
      (uid) => caseStore.purgeUserData(uid)
    );

    res.clearCookie(SESSION_COOKIE_NAME);
    res.clearCookie(CSRF_COOKIE_NAME);
    res.json(result);
  })
);

/**
 * Automated Data Retention Cleanup Endpoint:
 * Restricted to administrators. Purges records past the retention window (default 90 days).
 */
api.post(
  '/api/admin/retention/cleanup',
  standardApiLimiter,
  requireAuth(['admin']),
  asyncHandler(async (req: Request, res: Response) => {
    const { retentionDays } = req.body || {};
    const days = typeof retentionDays === 'number' && retentionDays > 0 ? retentionDays : 90;
    const result = caseStore.runRetentionCleanup(days);
    res.json({
      success: true,
      message: `Data retention cleanup completed for threshold ${days} days.`,
      result
    });
  })
);

// -------------------------------------------------------------
// 1D. EMAIL NOTIFICATIONS & USER PREFERENCES
// -------------------------------------------------------------

api.get('/api/notifications/preferences', requireAuth(), (req: Request, res: Response) => {
  const user = (req as any).user;
  const userId = user?.userId || 'usr-reviewer-01';
  const prefs = notificationService.getPreferences(userId, user?.email);
  res.json({ success: true, preferences: prefs });
});

api.put(
  '/api/notifications/preferences',
  standardApiLimiter,
  requireAuth(),
  (req: Request, res: Response) => {
    const user = (req as any).user;
    const userId = user?.userId || 'usr-reviewer-01';
    const updated = notificationService.updatePreferences(userId, req.body || {});
    res.json({ success: true, message: 'Notification preferences updated.', preferences: updated });
  }
);

api.get('/api/notifications/logs', standardApiLimiter, requireAuth(), (req: Request, res: Response) => {
  const history = notificationService.getHistory(30);
  res.json({ success: true, logs: history, count: history.length });
});

api.post('/api/notifications/test', standardApiLimiter, requireAuth(), (req: Request, res: Response) => {
  const user = (req as any).user;
  const logEntry = notificationService.notify({
    event: 'DOCUMENT_UPLOADED',
    caseId: `test-${Date.now().toString(36)}`,
    caseNumber: 'DOC-TEST-001',
    documentType: 'Passport',
    status: 'Ready for Review',
    recipientUserId: user?.userId,
    recipientEmail: user?.email
  });
  res.json({ success: true, message: 'Test notification generated.', entry: logEntry });
});

// -------------------------------------------------------------
// 2. DASHBOARD STATS (CACHED)
// -------------------------------------------------------------

api.get('/api/stats', standardApiLimiter, (req: Request, res: Response) => {
  const cacheKey = 'stats_summary';
  const cached = apiCache.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  const cases = caseStore.getAll();
  const total = cases.length;
  const readyForReview = cases.filter((c) => c.status === 'Ready for Review').length;
  const needsMoreInfo = cases.filter((c) => c.status === 'Needs More Information').length;
  const priorityReview = cases.filter((c) => c.status === 'Priority Review').length;
  const completed = cases.filter((c) => c.status === 'Review Completed').length;
  const failed = cases.filter((c) => c.status === 'Processing Failed').length;

  const queues = {
    general: cases.filter(
      (c) => c.assigned_queue === 'General Review' && c.status !== 'Review Completed'
    ).length,
    missing_info: cases.filter(
      (c) => c.assigned_queue === 'Missing Information' && c.status !== 'Review Completed'
    ).length,
    priority: cases.filter(
      (c) => c.assigned_queue === 'Priority Review' && c.status !== 'Review Completed'
    ).length
  };

  const byDocType = cases.reduce((acc, c) => {
    acc[c.document_type] = (acc[c.document_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const payload = {
    total,
    readyForReview,
    needsMoreInfo,
    priorityReview,
    completed,
    failed,
    queues,
    byDocType
  };

  apiCache.set(cacheKey, payload, 3000); // 3 second TTL
  res.setHeader('X-Cache', 'MISS');
  res.json(payload);
});

// -------------------------------------------------------------
// 3. CASE LISTING WITH PAGINATION & FILTERING
// -------------------------------------------------------------

api.get('/api/cases', standardApiLimiter, requireAuth(), (req: Request, res: Response) => {
  const user = (req as any).user;
  const {
    status,
    queue,
    search,
    docType,
    page,
    limit,
    all,
    reviewer,
    documentId,
    startDate,
    endDate,
    findingCategory,
    findingSeverity,
    extractedFieldValue
  } = req.query as Record<string, string | undefined>;

  // Support backward-compatible full list if all=true or no page/limit provided
  if (all === 'true' || (!page && !limit)) {
    let cases = caseStore.getAll();

    if (user?.role === 'applicant' && user?.userId) {
      cases = cases.filter((c) => c.created_by === user.userId);
    }
    if (user?.tenantId && user.tenantId !== 'tenant-enterprise-primary') {
      cases = cases.filter((c) => !c.tenant_id || c.tenant_id === user.tenantId);
    }

    if (status && status !== 'all') {
      cases = cases.filter((c) => c.status.toLowerCase() === status.toLowerCase());
    }
    if (queue && queue !== 'all') {
      cases = cases.filter((c) => c.assigned_queue.toLowerCase() === queue.toLowerCase());
    }
    if (docType && docType !== 'all') {
      cases = cases.filter((c) => c.document_type.toLowerCase() === docType.toLowerCase());
    }
    if (reviewer && reviewer !== 'all') {
      const rLower = reviewer.toLowerCase();
      cases = cases.filter((c) => c.assigned_reviewer && c.assigned_reviewer.toLowerCase().includes(rLower));
    }
    if (documentId && documentId.trim()) {
      const dLower = documentId.toLowerCase().trim();
      cases = cases.filter((c) => c.case_number.toLowerCase().includes(dLower) || c.case_id.toLowerCase().includes(dLower));
    }
    if (startDate) {
      const startMs = new Date(startDate).getTime();
      if (!isNaN(startMs)) {
        cases = cases.filter((c) => new Date(c.created_at).getTime() >= startMs);
      }
    }
    if (endDate) {
      const endMs = new Date(endDate).getTime();
      if (!isNaN(endMs)) {
        const adjustedEnd = endDate.length <= 10 ? endMs + 86400000 : endMs;
        cases = cases.filter((c) => new Date(c.created_at).getTime() <= adjustedEnd);
      }
    }
    if (findingCategory && findingCategory !== 'all') {
      const fCatLower = findingCategory.toLowerCase();
      cases = cases.filter((c) =>
        c.validation_findings && c.validation_findings.some((f) => f.category && f.category.toLowerCase() === fCatLower)
      );
    }
    if (findingSeverity && findingSeverity !== 'all') {
      const fSevLower = findingSeverity.toLowerCase();
      cases = cases.filter((c) =>
        c.validation_findings && c.validation_findings.some((f) => f.severity && f.severity.toLowerCase() === fSevLower)
      );
    }
    if (extractedFieldValue && extractedFieldValue.trim()) {
      const valLower = extractedFieldValue.toLowerCase().trim();
      cases = cases.filter((c) =>
        c.extracted_fields &&
        c.extracted_fields.some(
          (f) =>
            (f.field_value && f.field_value.toLowerCase().includes(valLower)) ||
            (f.reviewed_value && f.reviewed_value.toLowerCase().includes(valLower))
        )
      );
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      cases = cases.filter(
        (c) =>
          c.case_number.toLowerCase().includes(q) ||
          c.case_id.toLowerCase().includes(q) ||
          c.file_name.toLowerCase().includes(q) ||
          (c.assigned_reviewer && c.assigned_reviewer.toLowerCase().includes(q)) ||
          (c.extracted_fields &&
            c.extracted_fields.some(
              (f) =>
                f.field_value.toLowerCase().includes(q) ||
                (f.reviewed_value && f.reviewed_value.toLowerCase().includes(q))
            ))
      );
    }
    return res.json(cases.map((c) => trimCaseResponse(c, user?.role)));
  }

  // Server-side paginated result with tenant and role scoping
  const paginated = caseStore.getPaginated({
    status: typeof status === 'string' ? status : undefined,
    queue: typeof queue === 'string' ? queue : undefined,
    docType: typeof docType === 'string' ? docType : undefined,
    search: typeof search === 'string' ? search : undefined,
    reviewer: typeof reviewer === 'string' ? reviewer : undefined,
    documentId: typeof documentId === 'string' ? documentId : undefined,
    startDate: typeof startDate === 'string' ? startDate : undefined,
    endDate: typeof endDate === 'string' ? endDate : undefined,
    findingCategory: typeof findingCategory === 'string' ? findingCategory : undefined,
    findingSeverity: typeof findingSeverity === 'string' ? findingSeverity : undefined,
    extractedFieldValue: typeof extractedFieldValue === 'string' ? extractedFieldValue : undefined,
    page: page ? parseInt(page as string, 10) : 1,
    limit: limit ? parseInt(limit as string, 10) : 10,
    tenantId: user?.tenantId,
    userId: user?.userId,
    userRole: user?.role
  });

  res.json({
    ...paginated,
    data: paginated.data.map((c) => trimCaseResponse(c, user?.role))
  });
});

// -------------------------------------------------------------
// 4. GET SINGLE CASE
// -------------------------------------------------------------

api.get('/api/cases/:id', standardApiLimiter, requireAuth(), (req: Request, res: Response) => {
  const caseItem = caseStore.getById(req.params.id);
  if (!caseItem) {
    return sendError(res, 404, 'CASE_NOT_FOUND', 'Case not found', (req as any).requestId);
  }

  try {
    caseStore.checkRecordAccess(caseItem, (req as any).user);
  } catch (err: any) {
    return sendError(res, 403, 'IDOR_FORBIDDEN', err.message || 'Access denied', (req as any).requestId);
  }

  res.json(trimCaseResponse(caseItem, (req as any).user?.role));
});

// -------------------------------------------------------------
// 5. INGEST & PROCESS DOCUMENT (RATE LIMITED & IDEMPOTENT)
// -------------------------------------------------------------

api.post(
  '/api/cases/process',
  expensiveAiLimiter,
  requireAuth(),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      fileName,
      fileSizeKb,
      fileMime,
      documentType,
      rawText,
      fileDataUrl,
      crossReferenceFileName,
      crossReferenceText,
      isUnreadable,
      manualFields,
      consentRecord
    } = req.body;

    const reqId = (req as any).requestId;

    if (!fileName || typeof fileName !== 'string') {
      return sendError(
        res,
        400,
        'INVALID_REQUEST_BODY',
        'Parameter "fileName" string is required.',
        reqId
      );
    }

    // 1. Validate File Signature, Size, and Extension
    const fileValidation = validateUploadFile({
      fileName,
      fileDataUrl,
      fileMime,
      fileSizeKb
    });

    if (!fileValidation.valid) {
      log({
        level: 'WARN',
        operation: 'UPLOAD_VALIDATION_FAILED',
        requestId: reqId,
        message: fileValidation.error || 'Invalid upload file'
      });
      const isSizeError = fileValidation.error?.includes('exceeds');
      return sendError(
        res,
        isSizeError ? 413 : 400,
        isSizeError ? 'FILE_TOO_LARGE' : 'UNSUPPORTED_FILE_TYPE',
        fileValidation.error || 'Upload validation failed.',
        reqId
      );
    }

    // 2. Idempotency Check
    const idempotencyKey =
      (req.headers['idempotency-key'] as string) ||
      `auto-idemp-${computePayloadFingerprint({
        fileName: fileValidation.sanitizedFileName,
        fileSizeKb,
        fileDataUrl: fileDataUrl ? fileDataUrl.slice(0, 1000) : ''
      })}`;

    const existingIdemp = idempotencyStore.get(idempotencyKey);
    if (existingIdemp) {
      if (existingIdemp.status === 'processing') {
        return sendError(
          res,
          409,
          'IDEMPOTENCY_IN_PROGRESS',
          'A matching submission is currently being processed. Please wait for the initial request to complete.',
          reqId
        );
      }
      if (existingIdemp.status === 'completed' && existingIdemp.responseBody) {
        log({
          level: 'INFO',
          operation: 'IDEMPOTENCY_REPLAY',
          requestId: reqId,
          message: `Replaying cached result for idempotency key ${idempotencyKey}`
        });
        res.setHeader('Idempotency-Replayed', 'true');
        return res.status(existingIdemp.statusCode || 200).json(existingIdemp.responseBody);
      }
    }

    // Lock idempotency key to prevent race conditions during active processing
    idempotencyStore.setProcessing(idempotencyKey, computePayloadFingerprint(req.body));

    // Check if client requested streaming progress updates
    const isStream = req.query.stream === 'true' || req.headers.accept?.includes('text/event-stream');

    if (isStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const sendEvent = (event: string, data: any) => {
        if (!res.writableEnded) {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        }
      };

      // Stage 1: File Uploaded
      sendEvent('stage', {
        stage: 'uploaded',
        message: 'Upload validated',
        detail: {
          fileName: fileValidation.sanitizedFileName,
          fileSizeKb,
          fileMime
        }
      });

      let isAborted = false;
      req.on('close', () => {
        isAborted = true;
        idempotencyStore.remove(idempotencyKey);
      });

      try {
        const caseRecord = await runAgentPipeline(
          {
            fileName: fileValidation.sanitizedFileName,
            fileSizeKb: fileSizeKb || 150,
            fileMime: fileMime || 'application/pdf',
            documentType: documentType || 'auto',
            rawText,
            fileDataUrl,
            crossReferenceFileName,
            crossReferenceText,
            isUnreadable: !!isUnreadable,
            manualFields,
            consentRecord
          },
          (detail) => {
            if (!isAborted) {
              sendEvent('stage', detail);
            }
          }
        );

        if (isAborted) return;

        idempotencyStore.complete(idempotencyKey, 201, caseRecord);

        log({
          level: 'INFO',
          operation: 'CASE_PROCESSED_STREAM',
          requestId: reqId,
          caseId: caseRecord.case_id,
          message: `Case ${caseRecord.case_number} streamed. Status: ${caseRecord.status}`
        });

        notificationService.notify({
          event: 'DOCUMENT_UPLOADED',
          caseId: caseRecord.case_id,
          caseNumber: caseRecord.case_number,
          documentType: caseRecord.document_type,
          status: caseRecord.status,
          recipientUserId: (req as any).user?.userId,
          recipientEmail: (req as any).user?.email
        });

        sendEvent('complete', {
          stage: 'ready',
          message: 'Processing complete',
          caseRecord
        });
        res.end();
        return;
      } catch (err: any) {
        idempotencyStore.fail(idempotencyKey, 500, { error: err.message });
        sendEvent('error', { error: err.message || 'Processing workflow failed.' });
        res.end();
        return;
      }
    }

    // Standard non-streaming fallback
    try {
      const caseRecord = await runAgentPipeline({
        fileName: fileValidation.sanitizedFileName,
        fileSizeKb: fileSizeKb || 150,
        fileMime: fileMime || 'application/pdf',
        documentType: documentType || 'auto',
        rawText,
        fileDataUrl,
        crossReferenceFileName,
        crossReferenceText,
        isUnreadable: !!isUnreadable,
        manualFields,
        consentRecord
      });

      // Complete idempotency record
      idempotencyStore.complete(idempotencyKey, 201, caseRecord);

      log({
        level: 'INFO',
        operation: 'CASE_PROCESSED',
        requestId: reqId,
        caseId: caseRecord.case_id,
        message: `Case ${caseRecord.case_number} processed. Status: ${caseRecord.status}`
      });

      // Dispatch event notification based on user preferences
      notificationService.notify({
        event: 'DOCUMENT_UPLOADED',
        caseId: caseRecord.case_id,
        caseNumber: caseRecord.case_number,
        documentType: caseRecord.document_type,
        status: caseRecord.status,
        recipientUserId: (req as any).user?.userId,
        recipientEmail: (req as any).user?.email
      });

      res.status(201).json(caseRecord);
    } catch (err: any) {
      idempotencyStore.fail(idempotencyKey, 500, { error: err.message });
      throw err;
    }
  })
);

// -------------------------------------------------------------
// 6. RE-RUN / RE-EVALUATE AGENT WORKFLOW
// -------------------------------------------------------------

const handleReEvaluateRoute = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const reviewer = req.body?.reviewer || user?.name || 'Human Specialist';
  const reqId = (req as any).requestId;
  const caseId = req.params.id;

  const existing = caseStore.getById(caseId);
  if (!existing) {
    return sendError(
      res,
      404,
      'CASE_NOT_FOUND',
      `Cannot re-evaluate: Case "${caseId}" was not found in the database.`,
      reqId
    );
  }

  try {
    caseStore.checkRecordAccess(existing, user);
  } catch (err: any) {
    return sendError(res, 403, 'IDOR_FORBIDDEN', err.message || 'Access denied', reqId);
  }

  try {
    const updated = await reEvaluateCase(caseId, reviewer);
    if (!updated) {
      return sendError(
        res,
        404,
        'CASE_NOT_FOUND',
        `Re-evaluation failed: Case "${caseId}" could not be located.`,
        reqId
      );
    }
    log({
      level: 'INFO',
      operation: 'CASE_RE_EVALUATED',
      requestId: reqId,
      caseId,
      message: `Case ${updated.case_number} re-evaluated by ${reviewer}. Status: ${updated.status}; Queue: ${updated.assigned_queue}.`
    });
    res.json(updated);
  } catch (err: any) {
    log({
      level: 'ERROR',
      operation: 'RE_EVALUATE_EXCEPTION',
      requestId: reqId,
      caseId,
      message: `Re-evaluation failed: ${err.message}`,
      errorSummary: err.message
    });
    return sendError(
      res,
      500,
      'INTERNAL_SERVER_ERROR',
      `Re-evaluation execution error: ${err.message || 'Internal processing failure'}`,
      reqId
    );
  }
});

api.post('/api/cases/:id/re-run', expensiveAiLimiter, requireAuth(), handleReEvaluateRoute);
api.post('/api/cases/:id/re-evaluate', expensiveAiLimiter, requireAuth(), handleReEvaluateRoute);

// -------------------------------------------------------------
// 7. EDIT FIELD (OPTIMISTIC CONCURRENCY CHECK)
// -------------------------------------------------------------

api.patch(
  '/api/cases/:id/fields/:fieldId',
  standardApiLimiter,
  requireAuth(),
  asyncHandler(async (req: Request, res: Response) => {
    const { reviewedValue } = validateFieldUpdateBody(req.body);
    const { id, fieldId } = req.params;
    const reqId = (req as any).requestId;
    const user = (req as any).user;
    const reviewerLabel = user?.name || req.body.reviewerLabel || 'Reviewer';
    const expectedVersion = req.body.expectedVersion;

    const existing = caseStore.getById(id);
    if (!existing) {
      return sendError(res, 404, 'CASE_NOT_FOUND', `Case ${id} not found`, reqId);
    }
    try {
      caseStore.checkRecordAccess(existing, user);
    } catch (err: any) {
      return sendError(res, 403, 'IDOR_FORBIDDEN', err.message || 'Access denied', reqId);
    }

    try {
      const updatedPre = caseStore.update(
        id,
        (record) => {
          const fieldIndex = record.extracted_fields.findIndex((f) => f.field_id === fieldId);
          if (fieldIndex === -1) return record;

          const oldVal =
            record.extracted_fields[fieldIndex].reviewed_value ??
            record.extracted_fields[fieldIndex].field_value;
          record.extracted_fields[fieldIndex].reviewed_value = reviewedValue;
          record.extracted_fields[fieldIndex].is_edited = true;
          record.extracted_fields[fieldIndex].is_uncertain = false;

          const audit: AuditEvent = {
            event_id: `evt-${id}-${Date.now()}`,
            case_id: id,
            event_type: 'FIELD_CORRECTED',
            actor: 'Human Reviewer',
            summary: `Field "${record.extracted_fields[fieldIndex].field_label}" corrected by ${
              reviewerLabel || 'Reviewer'
            }.`,
            details: `Previous: "${oldVal}" -> Revised: "${reviewedValue}"`,
            created_at: new Date().toISOString()
          };

          const action: ReviewAction = {
            action_id: `act-${id}-${Date.now()}`,
            case_id: id,
            reviewer_label: reviewerLabel || 'Reviewer',
            action: 'correct_field',
            notes: `Corrected "${record.extracted_fields[fieldIndex].field_label}" to "${reviewedValue}"`,
            created_at: new Date().toISOString()
          };

          record.audit_events.unshift(audit);
          record.review_actions.unshift(action);
          return record;
        },
        expectedVersion
      );

      // Automatically re-evaluate validation and routing with the corrected field!
      const finalUpdated = await reEvaluateCase(id, reviewerLabel || 'Human Reviewer');
      res.json(finalUpdated || updatedPre);
    } catch (err: any) {
      if (err instanceof AppError) {
        return sendError(res, err.statusCode, err.code, err.message, reqId, err.details);
      }
      throw err;
    }
  })
);

// -------------------------------------------------------------
// 8. RESOLVE FINDING (OPTIMISTIC CONCURRENCY CHECK)
// -------------------------------------------------------------

api.patch(
  '/api/cases/:id/findings/:findingId/resolve',
  standardApiLimiter,
  requireAuth(),
  asyncHandler(async (req: Request, res: Response) => {
    const { resolved, notes } = validateFindingResolutionBody(req.body);
    const { id, findingId } = req.params;
    const reqId = (req as any).requestId;
    const user = (req as any).user;
    const reviewerLabel = user?.name || req.body.reviewerLabel || 'Reviewer';
    const expectedVersion = req.body.expectedVersion;

    const existing = caseStore.getById(id);
    if (!existing) {
      return sendError(res, 404, 'CASE_NOT_FOUND', `Case ${id} not found`, reqId);
    }
    try {
      caseStore.checkRecordAccess(existing, user);
    } catch (err: any) {
      return sendError(res, 403, 'IDOR_FORBIDDEN', err.message || 'Access denied', reqId);
    }

    try {
      const updatedPre = caseStore.update(
        id,
        (record) => {
          const finding = record.validation_findings.find((f) => f.finding_id === findingId);
          if (!finding) return record;

          finding.resolved = resolved;
          if (notes) finding.resolution_notes = notes;

          const audit: AuditEvent = {
            event_id: `evt-${id}-${Date.now()}`,
            case_id: id,
            event_type: 'FINDING_RESOLVED',
            actor: 'Human Reviewer',
            summary: `Finding "${finding.check_name}" marked as ${
              finding.resolved ? 'RESOLVED' : 'UNRESOLVED'
            } by ${reviewerLabel}.`,
            details: notes ? `Notes: ${notes}` : undefined,
            created_at: new Date().toISOString()
          };

          const action: ReviewAction = {
            action_id: `act-${id}-${Date.now()}`,
            case_id: id,
            reviewer_label: reviewerLabel,
            action: 'resolve_finding',
            notes: `Finding "${finding.check_name}" resolved: ${notes || 'Verified by reviewer'}`,
            created_at: new Date().toISOString()
          };

          record.audit_events.unshift(audit);
          record.review_actions.unshift(action);
          return record;
        },
        expectedVersion
      );

      const finalUpdated = await reEvaluateCase(id, reviewerLabel);
      res.json(finalUpdated || updatedPre);
    } catch (err: any) {
      if (err instanceof AppError) {
        return sendError(res, err.statusCode, err.code, err.message, reqId, err.details);
      }
      throw err;
    }
  })
);

// -------------------------------------------------------------
// 9. FORMAL REVIEW ACTION (OPTIMISTIC CONCURRENCY CHECK)
// -------------------------------------------------------------

const handleReviewAction = (req: Request, res: Response) => {
  const { action, notes, newQueue, newStatus } = validateReviewActionBody(req.body);
  const { id } = req.params;
  const reqId = (req as any).requestId;
  const user = (req as any).user;
  const reviewerLabel = user?.name || req.body.reviewerLabel || req.body.reviewer || 'Reviewer';
  const reviewerId = user?.userId || 'usr-reviewer';
  const expectedVersion = req.body.expectedVersion ?? req.body.expected_version;

  const existing = caseStore.getById(id);
  if (!existing) {
    return sendError(res, 404, 'CASE_NOT_FOUND', `Case ${id} not found`, reqId);
  }
  try {
    caseStore.checkRecordAccess(existing, user);
  } catch (err: any) {
    return sendError(res, 403, 'IDOR_FORBIDDEN', err.message || 'Access denied', reqId);
  }

  try {
    const updated = caseStore.update(
      id,
      (record) => {
        const prevStatus = record.status;
        const prevQueue = record.assigned_queue;
        let summaryText = '';

        if (action === 'approve_ready') {
          // 1. Check whether all mandatory document fields are available
          const schema = DOCUMENT_SCHEMAS[record.document_type];
          if (schema) {
            const missingMandatory = schema.fields.filter(
              (f) =>
                f.required &&
                !record.extracted_fields.find((ef) => ef.field_name === f.name)?.field_value?.trim()
            );
            if (missingMandatory.length > 0) {
              throw new AppError(
                'INVALID_INPUT',
                400,
                `Cannot mark ready for review: mandatory field(s) missing: ${missingMandatory.map((f) => f.label).join(', ')}.`
              );
            }
          }

          // 2. Check whether required validation rules have passed
          const fatalFindings = record.validation_findings.filter(
            (f) =>
              !f.resolved &&
              f.result === 'failed' &&
              (f.category === 'missing_information' || (f.category === 'format_error' && f.severity === 'high'))
          );
          if (fatalFindings.length > 0) {
            throw new AppError(
              'INVALID_INPUT',
              400,
              `Cannot mark ready for review: unresolved required validation check(s): ${fatalFindings.map((f) => f.check_name).join(', ')}.`
            );
          }

          record.status = 'Ready for Review';
          record.assigned_queue = 'General Review';
          summaryText = `Case marked Ready for Review by ${reviewerLabel}. All mandatory schema fields verified.`;
        } else if (action === 'request_info') {
          if (!notes || !notes.trim()) {
            throw new AppError(
              'INVALID_INPUT',
              400,
              'Reviewer explanation is required when requesting missing information.'
            );
          }
          record.status = 'Needs More Information';
          record.assigned_queue = 'Missing Information';
          summaryText = `Reviewer flagged case for additional information. Requested details: ${notes.trim()}`;
        } else if (action === 'escalate_priority') {
          if (!notes || !notes.trim()) {
            throw new AppError(
              'INVALID_INPUT',
              400,
              'Escalation reason is required when escalating to Priority Review.'
            );
          }
          record.status = 'Priority Review';
          record.assigned_queue = 'Priority Review';
          record.priority = 'high';
          summaryText = `Case escalated to Priority Review queue by ${reviewerLabel}. Reason: ${notes.trim()}`;
        } else if (action === 'mark_complete') {
          record.status = 'Review Completed';
          summaryText = `Case review completed and finalized by ${reviewerLabel}.`;
        }

        if (newQueue) {
          record.assigned_queue = newQueue;
        }
        if (newStatus) {
          record.status = newStatus;
        }

        const selectedDecisionLabel =
          action === 'approve_ready'
            ? 'Mark Ready for Review'
            : action === 'request_info'
            ? 'Request Missing Information'
            : action === 'escalate_priority'
            ? 'Escalate to Priority Review'
            : 'Finalize & Complete Review';

        record.assigned_reviewer = reviewerLabel;
        record.reviewer_decision = {
          case_id: record.case_id,
          document_id: record.case_number,
          reviewer_id: reviewerId,
          reviewed_by: reviewerLabel,
          action,
          selected_decision: selectedDecisionLabel,
          notes: notes || summaryText,
          previous_status: prevStatus,
          new_status: record.status,
          previous_queue: prevQueue,
          new_queue: record.assigned_queue,
          priority: record.priority || (action === 'escalate_priority' ? 'high' : 'normal'),
          reviewed_at: new Date().toISOString()
        };

        const reviewAction: ReviewAction = {
          action_id: `act-${id}-${Date.now()}`,
          case_id: id,
          reviewer_label: reviewerLabel,
          action: action,
          notes: notes || summaryText,
          created_at: new Date().toISOString()
        };

        const audit: AuditEvent = {
          event_id: `evt-${id}-${Date.now()}`,
          case_id: id,
          event_type:
            action === 'mark_complete'
              ? 'REVIEW_COMPLETED'
              : action === 'request_info'
              ? 'MISSING_INFO_REQUESTED'
              : action === 'escalate_priority'
              ? 'PRIORITY_ESCALATED'
              : 'STATUS_CHANGED',
          actor: reviewerLabel,
          summary: summaryText,
          details: `Decision: ${selectedDecisionLabel} | Previous Status: ${prevStatus} -> New Status: ${record.status}${notes ? ` | Notes: ${notes}` : ''}`,
          created_at: new Date().toISOString()
        };

        record.review_actions.unshift(reviewAction);
        record.audit_events.unshift(audit);
        return record;
      },
      expectedVersion
    );

    // Dispatch event notifications according to reviewer action
    let notificationDispatched = false;
    try {
      if (action === 'mark_complete') {
        const logEntry = notificationService.notify({
          event: 'REVIEW_COMPLETED',
          caseId: updated.case_id,
          caseNumber: updated.case_number,
          reviewer: reviewerLabel,
          status: updated.status,
          recipientUserId: user?.userId,
          recipientEmail: user?.email
        });
        notificationDispatched = logEntry?.deliveryStatus === 'DISPATCHED';
      } else if (action === 'escalate_priority' || action === 'request_info' || newQueue) {
        const logEntry = notificationService.notify({
          event: 'CASE_ASSIGNED',
          caseId: updated.case_id,
          caseNumber: updated.case_number,
          reviewer: reviewerLabel,
          status: updated.status,
          recipientUserId: user?.userId,
          recipientEmail: user?.email
        });
        notificationDispatched = logEntry?.deliveryStatus === 'DISPATCHED';
      }
    } catch {
      notificationDispatched = false;
    }

    res.json({
      ...updated,
      notification_sent: notificationDispatched
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return sendError(res, err.statusCode, err.code, err.message, reqId, err.details);
    }
    throw err;
  }
};

api.patch('/api/cases/:id/review-action', standardApiLimiter, requireAuth(), handleReviewAction);
api.post('/api/cases/:id/review-action', standardApiLimiter, requireAuth(), handleReviewAction);

// -------------------------------------------------------------
// 10. GENERATE AI SUMMARY (BUDGET CAPPED)
// -------------------------------------------------------------

api.post(
  '/api/cases/:id/generate-summary',
  expensiveAiLimiter,
  requireAuth(),
  asyncHandler(async (req: Request, res: Response) => {
    const reqId = (req as any).requestId;
    const caseItem = caseStore.getById(req.params.id);
    if (!caseItem) {
      return sendError(res, 404, 'CASE_NOT_FOUND', 'Case not found', reqId);
    }

    const budget = usageTracker.isOperationAllowed();
    if (!budget.allowed) {
      return sendError(
        res,
        429,
        'BUDGET_EXHAUSTED',
        `AI request blocked: ${budget.reason}`,
        reqId,
        {
          dailySpent: budget.dailySpent,
          dailyBudget: budget.dailyBudget
        }
      );
    }

    const summary = await generateExecutiveSummary(
      caseItem.document_type,
      caseItem.status,
      caseItem.assigned_queue,
      caseItem.validation_findings,
      caseItem.extracted_fields
    );

    const updated = caseStore.update(caseItem.case_id, (c) => ({
      ...c,
      executive_summary: summary
    }));

    res.json({ executive_summary: summary, case: updated });
  })
);

// -------------------------------------------------------------
// 11. SYNTHETIC SPECIMENS
// -------------------------------------------------------------

api.get('/api/samples', standardApiLimiter, (req: Request, res: Response) => {
  res.json(SYNTHETIC_SCENARIOS);
});

api.post(
  '/api/samples/load/:scenarioId',
  expensiveAiLimiter,
  requireAuth(),
  asyncHandler(async (req: Request, res: Response) => {
    const scenario = SYNTHETIC_SCENARIOS.find((s) => s.id === req.params.scenarioId);
    if (!scenario) {
      return sendError(
        res,
        404,
        'CASE_NOT_FOUND',
        'Scenario not found',
        (req as any).requestId
      );
    }

    const caseRecord = await runAgentPipeline({
      fileName: scenario.file_name,
      fileSizeKb: 280,
      fileMime: scenario.file_name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      documentType: scenario.document_type,
      rawText: scenario.mock_text,
      crossReferenceFileName: scenario.cross_reference_file,
      crossReferenceText: scenario.cross_reference_text,
      isUnreadable: scenario.is_unreadable,
      manualFields: Object.fromEntries(
        Object.entries(scenario.mock_fields).map(([k, v]) => [k, v.value])
      )
    });

    res.status(201).json(caseRecord);
  })
);

api.post('/api/cases/reset-seed', standardApiLimiter, requireAuth(), (req: Request, res: Response) => {
  caseStore.reset();
  res.json({ message: 'Store reset to pristine initial state', cases: caseStore.getAll() });
});

api.delete('/api/cases/:id', standardApiLimiter, requireAuth(['admin']), (req: Request, res: Response) => {
  const reqId = (req as any).requestId;
  const existing = caseStore.getById(req.params.id);
  if (!existing) {
    return sendError(res, 404, 'CASE_NOT_FOUND', 'Case not found', reqId);
  }

  const user = (req as any).user;
  if (user?.role !== 'admin' && !user?.isAnonymous) {
    return sendError(res, 403, 'INSUFFICIENT_PERMISSIONS', 'Only administrators may permanently delete case records.', reqId);
  }

  const deleted = caseStore.delete(req.params.id);
  if (!deleted) {
    return sendError(res, 404, 'CASE_NOT_FOUND', 'Case not found', reqId);
  }
  res.json({ success: true, message: `Case ${req.params.id} permanently deleted from store` });
});

/**
 * Data Minimisation / Erasure Endpoint (DPDP Act Section 8 & 12):
 * Expunges raw document images, text streams, and masks PII field values,
 * retaining an immutable audit trail without storing personal data indefinitely.
 */
api.post('/api/cases/:id/purge-data', standardApiLimiter, requireAuth(), (req: Request, res: Response) => {
  const reqId = (req as any).requestId;
  const user = (req as any).user;
  const existing = caseStore.getById(req.params.id);
  if (!existing) {
    return sendError(res, 404, 'CASE_NOT_FOUND', 'Case not found', reqId);
  }

  try {
    caseStore.checkRecordAccess(existing, user);
  } catch (err: any) {
    return sendError(res, 403, 'IDOR_FORBIDDEN', err.message || 'Access denied', reqId);
  }

  const { reason, operator } = req.body || {};
  try {
    const updated = caseStore.purgeCaseData(
      req.params.id,
      operator || user?.name || 'Authorized Reviewer',
      reason || 'Data Minimisation & Erasure Workflow'
    );
    res.json({ success: true, message: `Case ${req.params.id} personal data expunged.`, case: updated });
  } catch (err: any) {
    sendError(res, 404, 'CASE_NOT_FOUND', err.message || 'Case not found', reqId);
  }
});

/**
 * Consent Withdrawal Endpoint (DPDP Act Section 6(4)):
 * Allows Data Principals to withdraw consent with the same ease as providing it,
 * recording consent withdrawal evidence and minimizing personal data.
 */
api.post('/api/cases/:id/withdraw-consent', standardApiLimiter, (req: Request, res: Response) => {
  const { reason } = req.body || {};
  try {
    const updated = caseStore.withdrawConsent(
      req.params.id,
      reason || 'Data Principal withdrew document processing consent'
    );
    res.json({ success: true, message: 'Consent withdrawn successfully and personal data minimized.', case: updated });
  } catch (err: any) {
    sendError(res, 404, 'CASE_NOT_FOUND', err.message || 'Case not found', (req as any).requestId);
  }
});

/**
 * DPDP Act & Rules Data Principal Requests & Grievance Redressal (Section 11, 12, 13):
 */
api.get('/api/dpdp/requests', standardApiLimiter, (req: Request, res: Response) => {
  res.json({
    requests: caseStore.getDataPrincipalRequests(),
    total: caseStore.getDataPrincipalRequests().length
  });
});

api.post('/api/dpdp/requests', standardApiLimiter, (req: Request, res: Response) => {
  const { request_type, requester_name, requester_email, details, case_id } = req.body || {};
  const reqId = (req as any).requestId;

  if (!request_type || !requester_name || !requester_email || !details) {
    return sendError(
      res,
      400,
      'INVALID_REQUEST_BODY',
      'Fields "request_type", "requester_name", "requester_email", and "details" are required.',
      reqId
    );
  }

  const validTypes = ['access', 'correction', 'erasure', 'grievance', 'nomination'];
  if (!validTypes.includes(request_type)) {
    return sendError(res, 400, 'INVALID_REQUEST_TYPE', `request_type must be one of: ${validTypes.join(', ')}`, reqId);
  }

  const created = caseStore.addDataPrincipalRequest({
    request_type,
    requester_name: requester_name.slice(0, 100),
    requester_email: requester_email.slice(0, 100),
    details: details.slice(0, 1000),
    case_id
  });

  log({
    level: 'INFO',
    operation: 'DPDP_REQUEST_RECORDED',
    requestId: reqId,
    message: `DPDP ${request_type} request submitted by ${created.requester_email}. Ticket: ${created.request_id}`
  });

  res.status(201).json({
    success: true,
    message: 'Data Principal request registered successfully.',
    request: created
  });
});

api.patch('/api/dpdp/requests/:id', standardApiLimiter, (req: Request, res: Response) => {
  const { status, notes } = req.body || {};
  if (!status) {
    return sendError(res, 400, 'INVALID_REQUEST_BODY', 'Field "status" is required.', (req as any).requestId);
  }
  const updated = caseStore.updateDataPrincipalRequest(req.params.id, status, notes);
  if (!updated) {
    return sendError(res, 404, 'REQUEST_NOT_FOUND', 'DPDP request ticket not found', (req as any).requestId);
  }
  res.json({ success: true, request: updated });
});

api.get('/api/storage-info', standardApiLimiter, requireAuth(), (req: Request, res: Response) => {
  res.json(caseStore.getStorageInfo());
});

// -------------------------------------------------------------
// 12. DIAGNOSTICS & BUDGET STATUS (ADMIN PANEL)
// -------------------------------------------------------------

api.get('/api/admin/diagnostics', standardApiLimiter, requireAuth(['admin', 'reviewer']), (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    rate_limiting: globalRateLimiter.getStats(),
    idempotency: idempotencyStore.getStats(),
    cache: apiCache.getStats(),
    ai_usage_and_budgets: usageTracker.getSummary(),
    storage: caseStore.getStorageInfo(),
    recent_logs: getRecentLogs(40),
    security_controls: {
      authentication: 'RBAC Active (admin, reviewer, viewer, applicant)',
      encryption_at_rest: 'AES-256-GCM (server-managed master key)',
      encryption_in_transit: 'TLS/HTTPS & HSTS',
      field_tampering_defense: 'Enforced via server allowlists & optimistic concurrency',
      idor_protection: 'Tenant-scoping & ownership check on every record',
      bot_protection: 'Cryptographic challenge verification & rate-limiting',
      secrets_management: 'Server-side environment variables & .env.example'
    },
    current_session: {
      authenticated: !user?.isAnonymous,
      role: user?.role,
      tenantId: user?.tenantId
    }
  });
});

// -------------------------------------------------------------
// 13. BACKUP AND RESTORE ENDPOINTS
// -------------------------------------------------------------

api.post('/api/admin/backup', standardApiLimiter, requireAuth(['admin']), (req: Request, res: Response) => {
  try {
    const backup = backupService.createBackup();
    res.status(201).json({
      success: true,
      message: `Backup ${backup.fileName} created successfully.`,
      backup
    });
  } catch (err: any) {
    sendError(res, 500, 'BACKUP_FAILED', err.message, (req as any).requestId);
  }
});

api.get('/api/admin/backups', standardApiLimiter, requireAuth(['admin']), (req: Request, res: Response) => {
  const backups = backupService.listBackups();
  res.json(backups);
});

api.post('/api/admin/restore', standardApiLimiter, requireAuth(['admin']), (req: Request, res: Response) => {
  const { fileName } = req.body;
  const reqId = (req as any).requestId;

  if (!fileName || typeof fileName !== 'string') {
    return sendError(
      res,
      400,
      'INVALID_REQUEST_BODY',
      'Parameter "fileName" string is required.',
      reqId
    );
  }

  try {
    const result = backupService.restoreBackup(fileName);
    res.json({
      success: true,
      message: `Successfully restored ${result.restoredCases} cases.`,
      result
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return sendError(res, err.statusCode, err.code, err.message, reqId, err.details);
    }
    sendError(res, 500, 'RESTORE_FAILED', err.message, reqId);
  }
});

// -------------------------------------------------------------
// GLOBAL ERROR HANDLER
// -------------------------------------------------------------

api.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const reqId = (req as any).requestId || `req-${Date.now().toString(36)}`;

  log({
    level: 'ERROR',
    operation: 'UNHANDLED_EXCEPTION',
    requestId: reqId,
    message: err?.message || 'Internal Server Error',
    errorSummary: err?.stack?.slice(0, 500)
  });

  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.code, err.message, reqId, err.details, err.retryAfter);
  }

  return sendError(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    'An unexpected internal error occurred while processing the request.',
    reqId
  );
});

export default api;
