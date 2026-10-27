/**
 * Resilient API Client with Exponential Backoff, Jitter, and Structured Errors
 * AI Document Review & Routing Agent
 */

export interface ApiErrorPayload {
  error: string;
  code?: string;
  requestId?: string;
  retryAfter?: number;
  statusCode?: number;
  details?: Record<string, any>;
}

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly requestId?: string;
  public readonly retryAfter?: number;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;

  constructor(payload: ApiErrorPayload, statusCode: number) {
    super(payload.error || 'API Request Failed');
    this.name = 'ApiClientError';
    this.code = payload.code || 'UNKNOWN_ERROR';
    this.requestId = payload.requestId;
    this.retryAfter = payload.retryAfter;
    this.statusCode = statusCode;
    this.details = payload.details;
  }
}

interface FetchOptions extends RequestInit {
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
}

/**
 * Executes a resilient fetch with configurable timeout and exponential backoff for idempotent requests.
 */
export async function apiFetch<T = any>(url: string, options: FetchOptions = {}): Promise<T> {
  const {
    maxRetries = options.method && options.method !== 'GET' ? 0 : 2, // Only retry idempotent GET requests by default
    baseDelayMs = 300,
    timeoutMs = 30000,
    ...fetchInit
  } = options;

  let attempt = 0;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchInit,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...fetchInit.headers
        }
      });

      clearTimeout(timer);

      // Handle successful responses
      if (response.ok) {
        return (await response.json()) as T;
      }

      // Parse structured error payload
      let errorPayload: ApiErrorPayload = { error: response.statusText, statusCode: response.status };
      try {
        errorPayload = await response.json();
      } catch {
        // Fallback if not JSON
      }

      // Handle 429 Rate Limit
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : errorPayload.retryAfter || 5;

        if (attempt < maxRetries && (!options.method || options.method === 'GET')) {
          await new Promise((r) => setTimeout(r, retryAfterSec * 1000));
          attempt++;
          continue;
        }

        throw new ApiClientError(
          {
            ...errorPayload,
            error: errorPayload.error || `Rate limit exceeded. Retry in ${retryAfterSec}s.`,
            retryAfter: retryAfterSec
          },
          429
        );
      }

      // Handle 409 Version Conflict
      if (response.status === 409) {
        throw new ApiClientError(
          {
            ...errorPayload,
            error: errorPayload.error || 'Conflict: Record was modified concurrently. Please refresh.'
          },
          409
        );
      }

      // If server error 5xx and retries remain for GET
      if (response.status >= 500 && attempt < maxRetries && (!options.method || options.method === 'GET')) {
        const jitter = Math.random() * 100;
        const delay = Math.pow(2, attempt) * baseDelayMs + jitter;
        await new Promise((r) => setTimeout(r, delay));
        attempt++;
        continue;
      }

      throw new ApiClientError(errorPayload, response.status);
    } catch (err: any) {
      clearTimeout(timer);

      if (err.name === 'AbortError') {
        throw new ApiClientError(
          {
            error: `Request timed out after ${timeoutMs / 1000} seconds.`,
            code: 'REQUEST_TIMEOUT'
          },
          408
        );
      }

      if (err instanceof ApiClientError) {
        throw err;
      }

      // Network failures
      if (attempt < maxRetries && (!options.method || options.method === 'GET')) {
        const jitter = Math.random() * 100;
        const delay = Math.pow(2, attempt) * baseDelayMs + jitter;
        await new Promise((r) => setTimeout(r, delay));
        attempt++;
        continue;
      }

      throw new ApiClientError(
        {
          error: err.message || 'Network connection failed. Please check your connection.',
          code: 'NETWORK_ERROR'
        },
        0
      );
    }
  }

  throw new ApiClientError({ error: 'Request exceeded maximum retry attempts' }, 0);
}
