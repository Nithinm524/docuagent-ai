/**
 * Structured Error Handling & Error Codes
 * AI Document Review & Routing Agent
 */

import type { Response } from 'express';

export type ErrorCode =
  | 'RATE_LIMIT_EXCEEDED'
  | 'BUDGET_EXHAUSTED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'INVALID_REQUEST_BODY'
  | 'CASE_NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'REQUEST_TIMEOUT'
  | 'AI_TIMEOUT'
  | 'AI_SERVICE_UNAVAILABLE'
  | 'BACKUP_FAILED'
  | 'RESTORE_FAILED'
  | 'STORAGE_ERROR'
  | 'INVALID_REQUEST_TYPE'
  | 'REQUEST_NOT_FOUND'
  | 'AUTHENTICATION_REQUIRED'
  | 'SESSION_EXPIRED'
  | 'INVALID_CREDENTIALS'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'CSRF_VERIFICATION_FAILED'
  | 'TAMPERING_DETECTED'
  | 'INVALID_INPUT'
  | 'IDOR_FORBIDDEN'
  | 'BOT_CHALLENGE_FAILED'
  | 'INTERNAL_SERVER_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;
  public readonly retryAfter?: number;

  constructor(
    arg1: string | ErrorCode,
    arg2?: ErrorCode | number,
    arg3?: number | string,
    details?: Record<string, any>,
    retryAfter?: number
  ) {
    // Handle both new AppError(code, statusCode, message) and new AppError(message, code, statusCode)
    let message = 'An error occurred';
    let code: ErrorCode = 'INTERNAL_SERVER_ERROR';
    let statusCode = 400;

    if (typeof arg2 === 'number') {
      // Form: (code, statusCode, message)
      code = arg1 as ErrorCode;
      statusCode = arg2;
      message = (typeof arg3 === 'string' ? arg3 : arg1) as string;
    } else {
      // Form: (message, code, statusCode)
      message = arg1 as string;
      code = (arg2 || 'INTERNAL_SERVER_ERROR') as ErrorCode;
      statusCode = typeof arg3 === 'number' ? arg3 : 400;
    }

    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

export interface StructuredErrorResponse {
  error: string;
  code: ErrorCode;
  requestId: string;
  timestamp: string;
  statusCode: number;
  retryAfter?: number;
  details?: Record<string, any>;
}

export function sendError(
  res: Response,
  arg1: number | AppError,
  arg2?: ErrorCode | string,
  arg3?: string,
  arg4?: string,
  details?: Record<string, any>,
  retryAfter?: number
): Response {
  let statusCode = 400;
  let code: ErrorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An error occurred';
  let requestId = `req-${Date.now().toString(36)}`;

  if (typeof arg1 === 'number') {
    statusCode = arg1;
    code = (arg2 || 'INTERNAL_SERVER_ERROR') as ErrorCode;
    message = arg3 || 'An error occurred';
    requestId = arg4 || `req-${Date.now().toString(36)}`;
  } else if (arg1 instanceof AppError || (arg1 && typeof arg1 === 'object' && 'statusCode' in arg1)) {
    const err = arg1 as AppError;
    statusCode = err.statusCode || 400;
    code = err.code || 'INTERNAL_SERVER_ERROR';
    message = err.message || 'An error occurred';
    requestId = (arg2 as string) || `req-${Date.now().toString(36)}`;
    details = err.details || details;
    retryAfter = err.retryAfter || retryAfter;
  }

  if (retryAfter) {
    res.setHeader('Retry-After', retryAfter.toString());
  }

  const payload: StructuredErrorResponse = {
    error: message,
    code,
    requestId,
    timestamp: new Date().toISOString(),
    statusCode,
    ...(retryAfter !== undefined ? { retryAfter } : {}),
    ...(details ? { details } : {})
  };

  return res.status(statusCode).json(payload);
}
