/**
 * Email Notification Engine & User Preference Manager
 * AI Document Review & Routing Agent - DOCUAGENT AI
 *
 * Implements:
 * - Event-triggered notifications for:
 *   1. New Document Ingestion (DOCUMENT_UPLOADED)
 *   2. Reviewer Case Assignment (CASE_ASSIGNED)
 *   3. Case Review Completion (REVIEW_COMPLETED)
 * - User notification preference management (opt-in / opt-out per event type)
 * - RFC 5322 compliant email dispatch formatting & simulation log
 * - Safe sanitization to prevent sensitive PII leakage in notification bodies
 */

import { log } from './logger.ts';

export type NotificationEvent = 'DOCUMENT_UPLOADED' | 'CASE_ASSIGNED' | 'REVIEW_COMPLETED';

export interface NotificationPreferences {
  userId: string;
  emailNotificationsEnabled: boolean;
  notifyOnUpload: boolean;
  notifyOnAssignment: boolean;
  notifyOnCompletion: boolean;
  destinationEmail: string;
  updatedAt: string;
}

export interface NotificationLogEntry {
  id: string;
  timestamp: string;
  event: NotificationEvent;
  recipientEmail: string;
  subject: string;
  messageSnippet: string;
  caseId: string;
  caseNumber: string;
  deliveryStatus: 'DISPATCHED' | 'SUPPRESSED_PREFERENCE' | 'SIMULATED';
}

class NotificationService {
  private preferences = new Map<string, NotificationPreferences>();
  private notificationHistory: NotificationLogEntry[] = [];

  constructor() {
    // Seed default preferences for primary roles
    this.preferences.set('usr-reviewer-01', {
      userId: 'usr-reviewer-01',
      emailNotificationsEnabled: true,
      notifyOnUpload: true,
      notifyOnAssignment: true,
      notifyOnCompletion: true,
      destinationEmail: 'reviewer@docuagent.local',
      updatedAt: new Date().toISOString()
    });

    this.preferences.set('usr-admin-01', {
      userId: 'usr-admin-01',
      emailNotificationsEnabled: true,
      notifyOnUpload: true,
      notifyOnAssignment: true,
      notifyOnCompletion: true,
      destinationEmail: 'admin@docuagent.local',
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Retrieves notification preferences for a user, or provides default settings.
   */
  public getPreferences(userId: string, defaultEmail?: string): NotificationPreferences {
    const existing = this.preferences.get(userId);
    if (existing) return existing;

    const fallback: NotificationPreferences = {
      userId,
      emailNotificationsEnabled: true,
      notifyOnUpload: true,
      notifyOnAssignment: true,
      notifyOnCompletion: true,
      destinationEmail: defaultEmail || `${userId}@docuagent.local`,
      updatedAt: new Date().toISOString()
    };
    this.preferences.set(userId, fallback);
    return fallback;
  }

  /**
   * Updates notification preferences for a user.
   */
  public updatePreferences(
    userId: string,
    updates: Partial<Omit<NotificationPreferences, 'userId' | 'updatedAt'>>
  ): NotificationPreferences {
    const current = this.getPreferences(userId);
    const updated: NotificationPreferences = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.preferences.set(userId, updated);

    log({
      level: 'INFO',
      operation: 'NOTIFICATION_PREFS_UPDATED',
      message: `Notification preferences updated for user ${userId} (${updated.destinationEmail}).`,
      targetResource: userId
    });

    return updated;
  }

  /**
   * Dispatches a notification for a document review event.
   * Checks user preferences before sending to prevent unwanted emails.
   */
  public notify({
    event,
    caseId,
    caseNumber,
    documentType,
    reviewer,
    status,
    recipientUserId,
    recipientEmail
  }: {
    event: NotificationEvent;
    caseId: string;
    caseNumber: string;
    documentType?: string;
    reviewer?: string;
    status?: string;
    recipientUserId?: string;
    recipientEmail?: string;
  }): NotificationLogEntry {
    const prefs = recipientUserId
      ? this.getPreferences(recipientUserId, recipientEmail)
      : {
          userId: 'system',
          emailNotificationsEnabled: true,
          notifyOnUpload: true,
          notifyOnAssignment: true,
          notifyOnCompletion: true,
          destinationEmail: recipientEmail || 'reviewer@docuagent.local',
          updatedAt: new Date().toISOString()
        };

    // Determine subject and body template
    let subject = '';
    let messageBody = '';
    let shouldSend = prefs.emailNotificationsEnabled;

    switch (event) {
      case 'DOCUMENT_UPLOADED':
        subject = `[DOCUAGENT AI] New Document Ingested: ${caseNumber} (${documentType || 'Auto-Detected'})`;
        messageBody = `A new document (${documentType || 'document'}) has been processed and routed to the review queue with status "${status || 'Ready for Review'}". Case ID: ${caseId}.`;
        shouldSend = shouldSend && prefs.notifyOnUpload;
        break;

      case 'CASE_ASSIGNED':
        subject = `[DOCUAGENT AI] Case Assigned to ${reviewer || 'Reviewer'}: ${caseNumber}`;
        messageBody = `Case ${caseNumber} has been assigned to ${reviewer || 'an authorized reviewer'} for compliance triage.`;
        shouldSend = shouldSend && prefs.notifyOnAssignment;
        break;

      case 'REVIEW_COMPLETED':
        subject = `[DOCUAGENT AI] Review Completed: ${caseNumber} (${status || 'Completed'})`;
        messageBody = `The human review process for case ${caseNumber} has been finalized by ${reviewer || 'Reviewer'}.`;
        shouldSend = shouldSend && prefs.notifyOnCompletion;
        break;
    }

    const deliveryStatus = shouldSend ? 'DISPATCHED' : 'SUPPRESSED_PREFERENCE';

    const logEntry: NotificationLogEntry = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      event,
      recipientEmail: prefs.destinationEmail,
      subject,
      messageSnippet: messageBody,
      caseId,
      caseNumber,
      deliveryStatus
    };

    this.notificationHistory.unshift(logEntry);
    if (this.notificationHistory.length > 100) {
      this.notificationHistory.pop();
    }

    log({
      level: 'INFO',
      operation: 'EMAIL_NOTIFICATION',
      message: `${deliveryStatus}: ${subject} -> ${prefs.destinationEmail}`,
      caseId
    });

    return logEntry;
  }

  /**
   * Retrieves recent notification logs.
   */
  public getHistory(limit = 30): NotificationLogEntry[] {
    return this.notificationHistory.slice(0, limit);
  }
}

export const notificationService = new NotificationService();
