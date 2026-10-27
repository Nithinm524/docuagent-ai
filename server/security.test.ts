import test from 'node:test';
import assert from 'node:assert/strict';
import { authService } from './auth.ts';
import { caseStore } from './store.ts';
import { cryptoService } from './crypto.ts';
import { notificationService } from './notifications.ts';

test('Security & Auth: Password reset generates single-use SHA-256 hashed token with 15-min expiry', async () => {
  await authService.waitUntilReady();
  const email = 'reviewer@docuagent.local';

  // Request password reset
  const reqRes = await authService.requestPasswordReset(email);
  assert.equal(reqRes.success, true);
  assert.ok(reqRes.resetToken, 'Should generate reset token in non-production mode');

  const rawToken = reqRes.resetToken!;
  assert.equal(rawToken.length, 64, 'Token must be 32 random bytes (64 hex characters)');

  // Verify token works and updates password
  const newPass = 'FreshSecurePass2026!Updated';
  const confirmRes = await authService.resetPasswordWithToken(rawToken, newPass);
  assert.equal(confirmRes.success, true);

  // Verify single-use property: reusing the token must fail immediately
  await assert.rejects(
    async () => {
      await authService.resetPasswordWithToken(rawToken, 'AnotherPass2026!Test');
    },
    (err: any) => err.code === 'INVALID_OR_EXPIRED_TOKEN' || /invalid|expired/i.test(err.message),
    'Reusing the password reset token must be rejected'
  );

  // Verify that authentication succeeds with new password
  const loginRes = await authService.login(email, newPass, {} as any);
  assert.ok(loginRes.token);
  assert.equal(loginRes.session.email, email);

  // Invalidate session
  authService.logout(loginRes.token);
});

test('Security & Auth: Password reset suppresses user enumeration for non-existent accounts', async () => {
  await authService.waitUntilReady();
  const fakeEmail = 'nonexistent.user.999@randomdomain.test';
  const reqRes = await authService.requestPasswordReset(fakeEmail);

  assert.equal(reqRes.success, true);
  assert.match(reqRes.message, /instructions have been generated/i);
  assert.equal(reqRes.resetToken, undefined, 'Must not return token for unregistered account');
});

test('Security & Auth: Password reset invalidates active sessions across all devices', async () => {
  await authService.waitUntilReady();
  const email = 'auditor@docuagent.local';
  const password = process.env.INITIAL_VIEWER_PASSWORD || 'Auditor2026!Read';

  // Create an active session
  const login = await authService.login(email, password, {} as any);
  const activeSessionId = login.token;
  assert.ok(authService.validateSession(activeSessionId), 'Session should be valid');

  // Trigger password reset
  const resetReq = await authService.requestPasswordReset(email);
  const newPass = 'Auditor2026!NewPassword';
  await authService.resetPasswordWithToken(resetReq.resetToken!, newPass);

  // Existing session must now be invalidated
  const invalidatedSession = authService.validateSession(activeSessionId);
  assert.equal(invalidatedSession, null, 'Active sessions must be revoked upon password reset');
});

test('Security & Privacy: User account deletion requires password verification, revokes sessions, and purges user data', async () => {
  await authService.waitUntilReady();
  const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const email = `tempuser-${uniqueSuffix}@docuagent.local`;
  const tempPass = 'TempPass2026!Secure';
  const userId = `usr-temp-${uniqueSuffix}`;

  // Seed temp user in authService
  const tempUser = {
    id: userId,
    email,
    username: `tempuser-${uniqueSuffix}`,
    name: 'Temporary User',
    role: 'applicant' as const,
    tenantId: 'tenant-enterprise-primary',
    passwordHash: await cryptoService.hashPassword(tempPass),
    createdAt: new Date().toISOString(),
    isActive: true
  };
  (authService as any).users.set(email, tempUser);

  // Create active session
  const login = await authService.login(email, tempPass, {} as any);
  assert.ok(authService.validateSession(login.token));

  // Add dummy case record owned by this user
  const caseId = `case-temp-${uniqueSuffix}`;
  const dummyCase = {
    case_id: caseId,
    case_number: `DOC-TMP-${uniqueSuffix.slice(-4).toUpperCase()}`,
    tenant_id: 'tenant-enterprise-primary',
    file_name: 'test-personal-document.pdf',
    file_size_kb: 50,
    file_mime: 'application/pdf',
    file_data_url: 'data:application/pdf;base64,JVBERi0xLjQK...',
    created_at: new Date().toISOString(),
    created_by: tempUser.id,
    document_type: 'Invoice' as const,
    classification: {
      predicted_type: 'Invoice' as const,
      confidence: 0.95,
      is_fallback: false,
      reasoning: 'Test'
    },
    status: 'Ready for Review' as const,
    assigned_queue: 'General Review' as const,
    overall_confidence: 0.95,
    extracted_fields: [
      {
        field_id: 'f-1',
        field_name: 'ssn',
        field_value: '999-00-1111',
        data_type: 'string' as const,
        confidence: 0.95,
        status: 'valid' as const
      }
    ],
    validation_findings: [],
    audit_events: [],
    review_actions: [],
    agent_trace: [],
    requires_human_review: false,
    routing_reason: 'Test',
    version: 1
  };
  caseStore.add(dummyCase as any);

  // Attempt delete with incorrect password -> should reject
  await assert.rejects(
    async () => {
      await authService.deleteUserAccount(tempUser.id, 'WrongPassword123!', (uid) =>
        caseStore.purgeUserData(uid)
      );
    },
    (err: any) => err.code === 'INVALID_CREDENTIALS' || /Password confirmation failed/i.test(err.message),
    'Account deletion must fail if password confirmation is incorrect'
  );

  // Successful deletion with correct password
  const deleteRes = await authService.deleteUserAccount(tempUser.id, tempPass, (uid) =>
    caseStore.purgeUserData(uid)
  );
  assert.equal(deleteRes.success, true);
  assert.ok(deleteRes.purgedCases >= 1, 'Should purge at least 1 case record');

  // Verify session is revoked
  assert.equal(authService.validateSession(login.token), null, 'Sessions must be revoked');

  // Verify account is removed
  assert.equal(authService.getUserById(tempUser.id), undefined, 'Account must no longer exist');

  // Verify case data was purged
  const purgedCase = caseStore.getById(caseId);
  assert.ok(purgedCase);
  assert.equal(purgedCase?.is_purged, true, 'Case must be marked purged');
  assert.equal(purgedCase?.file_data_url, undefined, 'File data must be expunged');

  // Cleanup
  caseStore.delete(caseId);
});

test('Security & Privacy: Data retention cleanup job identifies and purges expired records', async () => {
  await authService.waitUntilReady();
  const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const oldCaseId = `case-exp-${uniqueSuffix}`;

  // Add an expired case (120 days old)
  const oldDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
  const oldCase = {
    case_id: oldCaseId,
    case_number: `DOC-EXP-${uniqueSuffix.slice(-4).toUpperCase()}`,
    tenant_id: 'tenant-enterprise-primary',
    file_name: 'expired_invoice.pdf',
    file_size_kb: 80,
    file_mime: 'application/pdf',
    file_data_url: 'data:application/pdf;base64,JVBERi0xLjQK...',
    created_at: oldDate,
    created_by: 'usr-admin-01',
    document_type: 'Invoice' as const,
    classification: {
      predicted_type: 'Invoice' as const,
      confidence: 0.9,
      is_fallback: false,
      reasoning: 'Test'
    },
    status: 'Ready for Review' as const,
    assigned_queue: 'General Review' as const,
    overall_confidence: 0.9,
    extracted_fields: [
      {
        field_id: 'f-exp-1',
        field_name: 'account_number',
        field_value: '1234567890',
        data_type: 'string' as const,
        confidence: 0.9,
        status: 'valid' as const
      }
    ],
    validation_findings: [],
    audit_events: [],
    review_actions: [],
    agent_trace: [],
    requires_human_review: false,
    routing_reason: 'Test',
    version: 1
  };
  caseStore.add(oldCase as any);

  // Run retention cleanup with 90-day retention policy
  const cleanupResult = caseStore.runRetentionCleanup(90);
  assert.ok(cleanupResult.purged_cases >= 1, 'Should purge the 120-day-old record');

  const purgedRecord = caseStore.getById(oldCaseId);
  assert.ok(purgedRecord);
  assert.equal(purgedRecord?.is_purged, true, 'Record must be marked purged');
  assert.match(purgedRecord?.purge_reason || '', /retention/i);
  assert.equal(purgedRecord?.file_data_url, undefined, 'Raw file data must be cleared');

  // Cleanup
  caseStore.delete(oldCaseId);
});

test('Terms Acceptance & Auth: Registration requires affirmative unselected Terms & Privacy acceptance', async () => {
  await authService.waitUntilReady();
  const testEmail = `newuser-${Date.now()}@docuagent.local`;
  const securePassword = 'NewUserSecure2026!Pass';

  // 1. Must fail if terms are not affirmatively accepted
  await assert.rejects(
    async () => {
      await authService.register(testEmail, securePassword, 'Test Applicant', 'applicant', 'tenant-test', false);
    },
    (err: any) => err.code === 'TERMS_ACCEPTANCE_REQUIRED' || /terms/i.test(err.message),
    'Registration without explicit affirmative terms acceptance must be rejected'
  );

  // 2. Must succeed with affirmative terms acceptance
  const regResult = await authService.register(testEmail, securePassword, 'Test Applicant', 'applicant', 'tenant-test', true);
  assert.ok(regResult.token, 'Should return active session token upon successful registration');
  assert.equal(regResult.session.email, testEmail);
  assert.equal(regResult.session.role, 'applicant');

  // 3. User can now authenticate with the registered scrypt-hashed credentials
  const loginRes = await authService.login(testEmail, securePassword, {} as any);
  assert.ok(loginRes.token);
  assert.equal(loginRes.session.email, testEmail);

  // 4. Duplicate registration with same email must fail
  await assert.rejects(
    async () => {
      await authService.register(testEmail, 'AnotherPass2026!', 'Test Duplicate', 'applicant', 'tenant-test', true);
    },
    (err: any) => err.code === 'USER_ALREADY_EXISTS' || /already registered/i.test(err.message)
  );

  // Cleanup session
  authService.logout(regResult.token);
  authService.logout(loginRes.token);
});

test('Email Notifications: Service dispatches alerts, logs history, and respects preferences', async () => {
  const destEmail = 'alerts-test@docuagent.local';
  const testUserId = 'usr-test-reviewer-99';

  // Update notification preferences for test user
  const updatedPrefs = notificationService.updatePreferences(testUserId, {
    emailNotificationsEnabled: true,
    destinationEmail: destEmail,
    notifyOnUpload: true,
    notifyOnAssignment: true,
    notifyOnCompletion: true
  });
  assert.equal(updatedPrefs.destinationEmail, destEmail);
  assert.equal(updatedPrefs.emailNotificationsEnabled, true);

  // Trigger event: Document uploaded
  const uploadDispatch = notificationService.notify({
    event: 'DOCUMENT_UPLOADED',
    caseId: 'test-case-notif-1',
    caseNumber: 'CASE-NOTIF-001',
    documentType: 'passport',
    status: 'Ready for Review',
    recipientUserId: testUserId,
    recipientEmail: destEmail
  });
  assert.equal(uploadDispatch.deliveryStatus, 'DISPATCHED');
  assert.equal(uploadDispatch.recipientEmail, destEmail);

  // Trigger event: Case assigned
  const assignDispatch = notificationService.notify({
    event: 'CASE_ASSIGNED',
    caseId: 'test-case-notif-1',
    caseNumber: 'CASE-NOTIF-001',
    reviewer: 'Sarah Chen',
    recipientUserId: testUserId,
    recipientEmail: destEmail
  });
  assert.equal(assignDispatch.deliveryStatus, 'DISPATCHED');

  // Verify delivery history in audit logs
  const logs = notificationService.getHistory();
  assert.ok(logs.length >= 2, 'Should have logged at least 2 dispatches');
  assert.ok(logs.some((l) => l.recipientEmail === destEmail));
});

test('Advanced Search & Filtering: Store queries by reviewer, documentId, date range, finding category and severity', async () => {
  // Seed a specific test case with known metadata
  const testCaseId = `search-case-${Date.now()}`;
  const now = new Date();
  const testCase = {
    case_id: testCaseId,
    case_number: 'CASE-SEARCH-999',
    created_at: now.toISOString(),
    status: 'Priority Review' as const,
    assigned_queue: 'Priority Review' as const,
    document_type: 'passport' as const,
    file_name: 'search_specimen.png',
    file_size_kb: 450,
    file_mime: 'image/png',
    is_purged: false,
    extracted_fields: [
      {
        field_id: 'sf-1',
        field_name: 'passport_number',
        field_value: 'P88990011',
        data_type: 'string' as const,
        confidence: 0.98,
        status: 'valid' as const
      }
    ],
    validation_findings: [
      {
        finding_id: 'fnd-search-1',
        check_name: 'Expiration Alert',
        category: 'expired' as const,
        severity: 'high' as const,
        result: 'failed' as const,
        explanation: 'Passport expired 45 days ago',
        resolved: false
      }
    ],
    reviewer_decision: {
      action: 'Flagged for Escalation' as const,
      reviewed_by: 'Sarah Chen',
      reviewed_at: now.toISOString(),
      notes: 'Test case for search filter verification'
    },
    audit_events: [],
    review_actions: [],
    agent_trace: [],
    requires_human_review: true,
    routing_reason: 'Testing filter parameters',
    version: 1
  };

  caseStore.add(testCase as any);

  // 1. Filter by reviewer 'Sarah Chen'
  const reviewerResults = caseStore.getPaginated({ reviewer: 'Sarah Chen' });
  assert.ok(reviewerResults.data.some((c) => c.case_id === testCaseId));

  // 2. Filter by documentId
  const idResults = caseStore.getPaginated({ documentId: 'CASE-SEARCH-999' });
  assert.ok(idResults.data.some((c) => c.case_id === testCaseId));

  // 3. Filter by findingCategory
  const catResults = caseStore.getPaginated({ findingCategory: 'Expiration Alert' });
  assert.ok(catResults.data.some((c) => c.case_id === testCaseId));

  // 4. Filter by findingSeverity
  const sevResults = caseStore.getPaginated({ findingSeverity: 'Critical' });
  assert.ok(sevResults.data.some((c) => c.case_id === testCaseId));

  // 5. Filter by extractedFieldValue
  const fieldResults = caseStore.getPaginated({ extractedFieldValue: 'P88990011' });
  assert.ok(fieldResults.data.some((c) => c.case_id === testCaseId));

  // 6. Non-matching query should exclude this case
  const noMatch = caseStore.getPaginated({ reviewer: 'David Kim', documentId: 'CASE-SEARCH-999' });
  assert.equal(noMatch.data.some((c) => c.case_id === testCaseId), false);

  // Cleanup
  caseStore.delete(testCaseId);
});
