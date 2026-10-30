/**
 * Strict Server-Side Input Validation and Field Tampering Defenses
 * AI Document Review & Routing Agent
 *
 * Implements:
 * - Strict schema allowlists for all mutating endpoints
 * - Rejection of unauthorized mass-assignment fields (risk_score, status, etc.)
 * - Email and string format sanitization
 * - Defense against prompt injection in document text
 */

import { AppError } from './errors.ts';
import type { DocumentType, ReviewerQueue, CaseStatus, ReviewAction } from '../src/shared/types.ts';

const VALID_DOC_TYPES: DocumentType[] = [
  'passport',
  'national_id',
  'utility_bill',
  'bank_statement',
  'employment_verification',
  'invoice',
  'general_doc',
  'unknown'
];

const VALID_QUEUES: ReviewerQueue[] = [
  'General Review',
  'Missing Information',
  'Priority Review'
];

const VALID_STATUSES: CaseStatus[] = [
  'Processing',
  'Ready for Review',
  'Needs More Information',
  'Priority Review',
  'Review Completed',
  'Processing Failed'
];

const VALID_REVIEW_ACTIONS: Array<ReviewAction['action']> = [
  'approve_ready',
  'request_info',
  'escalate_priority',
  'correct_field',
  'resolve_finding',
  'mark_complete'
];

/**
 * Validates and sanitizes email address format.
 */
export function validateEmail(email: any): string {
  if (typeof email !== 'string') {
    throw new AppError('INVALID_INPUT', 400, 'Email must be a string.');
  }
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
  if (!emailRegex.test(trimmed) || trimmed.length > 100) {
    throw new AppError('INVALID_INPUT', 400, 'Invalid email address format.');
  }
  return trimmed;
}

/**
 * Validates login payload.
 */
export function validateLoginBody(body: any): { email: string; password: string } {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST_BODY', 400, 'Request body must be a JSON object.');
  }

  // Reject unexpected keys
  const allowedKeys = ['email', 'password'];
  for (const key of Object.keys(body)) {
    if (!allowedKeys.includes(key)) {
      throw new AppError('INVALID_INPUT', 400, `Unexpected field "${key}" in login request.`);
    }
  }

  const email = validateEmail(body.email);
  if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
    throw new AppError('INVALID_INPUT', 400, 'Password must be between 8 and 128 characters.');
  }

  return { email, password: body.password };
}

/**
 * Validates and strictly filters field update payload.
 * Rejects any client attempt to tamper with confidence, is_uncertain, field_name, etc.
 */
export function validateFieldUpdateBody(body: any): { reviewedValue: string } {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST_BODY', 400, 'Request body must be a JSON object.');
  }

  const allowedKeys = ['reviewedValue', 'reviewed_value', 'reviewer', 'reviewerLabel', 'reviewer_label', 'expectedVersion', 'expected_version'];
  for (const key of Object.keys(body)) {
    if (!allowedKeys.includes(key)) {
      throw new AppError('TAMPERING_DETECTED', 400, `Unauthorized field "${key}". Only "reviewedValue" may be submitted.`);
    }
  }

  const val = body.reviewedValue ?? body.reviewed_value;
  if (typeof val !== 'string') {
    throw new AppError('INVALID_INPUT', 400, 'Field value must be a string.');
  }

  if (val.length > 500) {
    throw new AppError('INVALID_INPUT', 400, 'Field value exceeds maximum allowable length of 500 characters.');
  }

  return { reviewedValue: val.trim() };
}

/**
 * Validates and strictly filters finding resolution payload.
 */
export function validateFindingResolutionBody(body: any): { resolved: boolean; notes?: string } {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST_BODY', 400, 'Request body must be a JSON object.');
  }

  const allowedKeys = ['resolved', 'notes', 'reviewer', 'reviewerLabel', 'reviewer_label', 'expectedVersion', 'expected_version'];
  for (const key of Object.keys(body)) {
    if (!allowedKeys.includes(key)) {
      throw new AppError('TAMPERING_DETECTED', 400, `Unauthorized field "${key}" in finding resolution.`);
    }
  }

  if (typeof body.resolved !== 'boolean') {
    throw new AppError('INVALID_INPUT', 400, 'Field "resolved" must be a boolean.');
  }

  let notes: string | undefined;
  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string' || body.notes.length > 1000) {
      throw new AppError('INVALID_INPUT', 400, 'Notes must be a string up to 1000 characters.');
    }
    notes = body.notes.trim();
  }

  return { resolved: body.resolved, notes };
}

/**
 * Validates and strictly filters reviewer action payload.
 */
export function validateReviewActionBody(body: any): {
  action: ReviewAction['action'];
  notes: string;
  newQueue?: ReviewerQueue;
  newStatus?: CaseStatus;
} {
  if (!body || typeof body !== 'object') {
    throw new AppError('INVALID_REQUEST_BODY', 400, 'Request body must be a JSON object.');
  }

  const allowedKeys = [
    'action',
    'notes',
    'newQueue',
    'newStatus',
    'new_queue',
    'new_status',
    'reviewer',
    'reviewerLabel',
    'reviewer_label',
    'expectedVersion',
    'expected_version'
  ];
  for (const key of Object.keys(body)) {
    if (!allowedKeys.includes(key)) {
      throw new AppError('TAMPERING_DETECTED', 400, `Unauthorized field "${key}" in review action.`);
    }
  }

  if (typeof body.action !== 'string' || !body.action.trim()) {
    throw new AppError('INVALID_INPUT', 400, 'Review action is required.');
  }

  let normalizedAction = body.action.trim().toLowerCase();
  if (normalizedAction === 'ready') normalizedAction = 'approve_ready';
  if (normalizedAction === 'escalate') normalizedAction = 'escalate_priority';
  if (normalizedAction === 'finalize' || normalizedAction === 'complete') normalizedAction = 'mark_complete';
  if (normalizedAction === 'request_missing_info') normalizedAction = 'request_info';

  const actionStr = normalizedAction as ReviewAction['action'];
  if (!VALID_REVIEW_ACTIONS.includes(actionStr)) {
    throw new AppError('INVALID_INPUT', 400, `Invalid review action "${body.action}".`);
  }

  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 2000).trim() : '';

  const q = body.newQueue ?? body.new_queue;
  if (q && !VALID_QUEUES.includes(q)) {
    throw new AppError('INVALID_INPUT', 400, `Invalid queue name "${q}".`);
  }

  const s = body.newStatus ?? body.new_status;
  if (s && !VALID_STATUSES.includes(s)) {
    throw new AppError('INVALID_INPUT', 400, `Invalid status "${s}".`);
  }

  return {
    action: actionStr,
    notes,
    newQueue: q,
    newStatus: s
  };
}

/**
 * Defends against prompt injection by sanitizing document text before passing to LLM.
 */
export function sanitizeDocumentPromptText(rawText: string): string {
  if (!rawText) return '';
  // Limit to reasonable length (max 50,000 characters)
  const clipped = rawText.slice(0, 50000);
  // Neutralize common prompt jailbreak escape tags
  return clipped
    .replace(/<\/document_payload>/gi, '[CLEANED_TAG]')
    .replace(/<\|endoftext\|>/g, '')
    .replace(/\[SYSTEM_INSTRUCTION\]/gi, '');
}
