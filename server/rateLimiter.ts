/**
 * Server-Side Sliding Window Rate Limiter
 * AI Document Review & Routing Agent
 *
 * NOTE ON IP IDENTIFICATION:
 * Client IP-based rate limiting is a best-effort defense mechanism against automated abuse.
 * It does NOT reliably identify individual human users because multiple users behind a
 * corporate proxy, VPN, or Carrier-Grade NAT (CGNAT) share a single public IP address,
 * while mobile clients frequently rotate IPs. When authenticated sessions exist,
 * limits should be keyed to authenticated user/session IDs.
 */

import { Request, Response, NextFunction } from 'express';
import { sendError } from './errors.ts';
import { log } from './logger.ts';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  routeLabel: string;
}

interface RequestRecord {
  timestamps: number[];
}

export class SlidingWindowRateLimiter {
  private store = new Map<string, RequestRecord>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Periodic garbage collection for stale IP keys every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 120000);
    // Unref so it doesn't hold open test runs
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < 300000); // retain max 5 min
      if (record.timestamps.length === 0) {
        this.store.delete(key);
      }
    }
  }

  public check(key: string, config: RateLimitConfig): {
    allowed: boolean;
    remaining: number;
    resetSeconds: number;
    totalLimit: number;
  } {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    let record = this.store.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.store.set(key, record);
    }

    // Filter to requests within current sliding window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    const count = record.timestamps.length;
    const allowed = count < config.maxRequests;

    let resetSeconds = Math.ceil(config.windowMs / 1000);
    if (record.timestamps.length > 0) {
      const oldestInWindow = record.timestamps[0];
      const timeUntilExpire = oldestInWindow + config.windowMs - now;
      resetSeconds = Math.max(1, Math.ceil(timeUntilExpire / 1000));
    }

    if (allowed) {
      record.timestamps.push(now);
    }

    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - (allowed ? count + 1 : count)),
      resetSeconds,
      totalLimit: config.maxRequests
    };
  }

  public resetKey(key: string): void {
    this.store.delete(key);
  }

  public clearAll(): void {
    this.store.clear();
  }

  public getStats() {
    return {
      tracked_clients: this.store.size,
      active_buckets: Array.from(this.store.keys()).length
    };
  }
}

export const globalRateLimiter = new SlidingWindowRateLimiter();

/**
 * Extracts client identifier from IP and optional session header.
 */
export function getClientIdentifier(req: Request): string {
  // Check optional session header if present
  const sessionHeader = req.headers['x-session-id'] || req.headers['x-user-id'];
  if (typeof sessionHeader === 'string' && sessionHeader.trim()) {
    return `session:${sessionHeader.trim()}`;
  }

  // Extract IP (handling potential proxy headers like X-Forwarded-For)
  const forwarded = req.headers['x-forwarded-for'];
  let ip = '';
  if (typeof forwarded === 'string') {
    ip = forwarded.split(',')[0].trim();
  } else if (req.socket && req.socket.remoteAddress) {
    ip = req.socket.remoteAddress;
  } else {
    ip = '127.0.0.1';
  }

  return `ip:${ip}`;
}

/**
 * Express middleware generator for rate limiting.
 */
export function createRateLimiter(options: {
  windowMs?: number;
  maxRequests?: number;
  routeLabel: string;
}) {
  const windowMs = options.windowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
  const maxRequests = options.maxRequests || parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10);
  const config: RateLimitConfig = {
    windowMs,
    maxRequests,
    routeLabel: options.routeLabel
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = getClientIdentifier(req);
    const key = `${config.routeLabel}:${clientId}`;

    const check = globalRateLimiter.check(key, config);

    // Set standard rate limit headers
    res.setHeader('X-RateLimit-Limit', check.totalLimit.toString());
    res.setHeader('X-RateLimit-Remaining', check.remaining.toString());
    res.setHeader('X-RateLimit-Reset', check.resetSeconds.toString());

    if (!check.allowed) {
      log({
        level: 'WARN',
        operation: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit of ${config.maxRequests} req/${config.windowMs / 1000}s exceeded on ${config.routeLabel}`,
        clientIp: clientId,
        details: { route: req.path, method: req.method, retryAfter: check.resetSeconds }
      });

      return sendError(
        res,
        429,
        'RATE_LIMIT_EXCEEDED',
        `Rate limit exceeded for ${config.routeLabel}. Please wait ${check.resetSeconds} seconds before retrying.`,
        (req as any).requestId,
        {
          limit: check.totalLimit,
          remaining: 0,
          retryAfterSeconds: check.resetSeconds,
          policy: 'Sliding window per client identifier'
        },
        check.resetSeconds
      );
    }

    next();
  };
}

// Pre-configured rate limiters
export const expensiveAiLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: parseInt(process.env.AI_RATE_LIMIT_MAX || '20', 10), // 20 uploads / processing calls per minute
  routeLabel: 'ai-processing'
});

export const standardApiLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: parseInt(process.env.STANDARD_RATE_LIMIT_MAX || '120', 10), // 120 reads per minute
  routeLabel: 'general-api'
});

export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15-minute sliding window
  maxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5', 10), // 5 login attempts per 15 minutes
  routeLabel: 'authentication'
});

export const dpdpLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 10, // 10 DPDP requests per minute
  routeLabel: 'dpdp-requests'
});

export const passwordResetLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15-minute sliding window
  maxRequests: 5, // 5 password reset attempts per 15 min
  routeLabel: 'password-reset'
});

export const accountActionLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15-minute sliding window
  maxRequests: 5, // 5 account management actions per 15 min
  routeLabel: 'account-actions'
});
