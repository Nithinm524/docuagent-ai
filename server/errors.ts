/**
 * Structured Error Handling & Error Codes
 * AI Document Review & Routing Agent
 */

import { Response } from 'express';

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
  | 'INTERNAL_SERVER_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;
  public readonly retryAfter?: number;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode = 400,
    details?: Record<string, any>,
    retryAfter?: number
  ) {
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
  statusCode: number,
  code: ErrorCode,
  message: string,
  requestId = `req-${Date.now().toString(36)}`,
  details?: Record<string, any>,
  retryAfter?: number
): Response {
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
