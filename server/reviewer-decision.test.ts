import test from 'node:test';
import assert from 'node:assert/strict';
import { caseStore } from './store.ts';
import { DOCUMENT_SCHEMAS } from '../src/shared/validation.ts';
import type { CaseRecord } from '../src/shared/types.ts';

// Helper to seed a test case
function createTestCase(overrides: Partial<CaseRecord> = {}): CaseRecord {
  const caseId = `case-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const testCase: CaseRecord = {
    case_id: caseId,
    case_number: `DOC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    version: 1,
    document_type: 'passport',
    file_name: 'test_passport.pdf',
    file_size_kb: 150,
    file_mime: 'application/pdf',
    created_at: now,
    updated_at: now,
    status: 'Needs More Information',
    assigned_queue: 'Missing Information',
    routing_reason: 'Awaiting reviewer triage',
    extracted_fields: [
      {
        field_id: 'f1',
        case_id: caseId,
        field_name: 'passport_number',
        field_label: 'Passport Number',
        field_value: 'P12345678',
        confidence: 0.95,
        is_uncertain: false,
        is_edited: false
      },
      {
        field_id: 'f2',
        case_id: caseId,
        field_name: 'full_name',
        field_label: 'Full Name',
        field_value: 'Alex Rivera',
        confidence: 0.94,
        is_uncertain: false,
        is_edited: false
      },
      {
        field_id: 'f3',
        case_id: caseId,
        field_name: 'date_of_birth',
        field_label: 'Date of Birth',
        field_value: '1990-05-15',
        confidence: 0.92,
        is_uncertain: false,
        is_edited: false
      },
      {
        field_id: 'f4',
        case_id: caseId,
        field_name: 'expiration_date',
        field_label: 'Expiration Date',
        field_value: '2030-05-15',
        confidence: 0.93,
        is_uncertain: false,
        is_edited: false
      },
      {
        field_id: 'f5',
        case_id: caseId,
        field_name: 'nationality',
        field_label: 'Nationality / Country Code',
        field_value: 'USA',
        confidence: 0.91,
        is_uncertain: false,
        is_edited: false
      }
    ],
    validation_findings: [],
    review_actions: [],
    audit_events: [],
    agent_trace: [],
    ...overrides
  };
  return caseStore.add(testCase);
}

test('TEST 1: Mark Ready for Review updates status, queue, decision record, and creates audit entry', () => {
  const initial = createTestCase();
  const reviewerLabel = 'Lead Reviewer Sarah';
  const reviewerId = 'usr-reviewer-01';
  const notes = 'All passport credentials verified against sovereign standard.';

  const updated = caseStore.update(initial.case_id, (record) => {
    const prevStatus = record.status;
    const prevQueue = record.assigned_queue;

    // Check mandatory fields
    const schema = DOCUMENT_SCHEMAS[record.document_type];
    const missing = schema?.fields.filter(
      (f) => f.required && !record.extracted_fields.find((ef) => ef.field_name === f.name)?.field_value?.trim()
    );
    assert.equal(missing?.length || 0, 0, 'No missing mandatory fields');

    record.status = 'Ready for Review';
    record.assigned_queue = 'General Review';
    record.assigned_reviewer = reviewerLabel;
    record.reviewer_decision = {
      case_id: record.case_id,
      document_id: record.case_number,
      reviewer_id: reviewerId,
      reviewed_by: reviewerLabel,
      action: 'approve_ready',
      selected_decision: 'Mark Ready for Review',
      notes,
      previous_status: prevStatus,
      new_status: record.status,
      previous_queue: prevQueue,
      new_queue: record.assigned_queue,
      priority: record.priority || 'normal',
      reviewed_at: new Date().toISOString()
    };

    record.audit_events.unshift({
      event_id: `evt-${record.case_id}-${Date.now()}`,
      case_id: record.case_id,
      event_type: 'STATUS_CHANGED',
      actor: 'Human Reviewer',
      summary: `Case marked Ready for Review by ${reviewerLabel}. All mandatory schema fields verified.`,
      details: `Decision: Mark Ready for Review | Previous Status: ${prevStatus} -> New Status: ${record.status} | Notes: ${notes}`,
      created_at: new Date().toISOString()
    });

    return record;
  });

  assert.equal(updated.status, 'Ready for Review');
  assert.equal(updated.assigned_queue, 'General Review');
  assert.equal(updated.reviewer_decision?.action, 'approve_ready');
  assert.equal(updated.reviewer_decision?.notes, notes);
  assert.equal(updated.reviewer_decision?.reviewed_by, reviewerLabel);
  assert.ok(updated.audit_events.length > 0);
  assert.equal(updated.audit_events[0].actor, 'Human Reviewer');
  assert.match(updated.audit_events[0].summary, /marked Ready for Review/i);
});

test('TEST 2: Request Missing Information requires explanation and routes to Missing Information queue', () => {
  const initial = createTestCase({ status: 'Ready for Review', assigned_queue: 'General Review' });
  const notes = 'Applicant image is blurry on MRZ line; please re-upload clear color scan.';
  const reviewerLabel = 'Compliance Officer Dave';

  const updated = caseStore.update(initial.case_id, (record) => {
    const prevStatus = record.status;
    const prevQueue = record.assigned_queue;

    assert.ok(notes && notes.trim().length > 0, 'Notes must be provided');

    record.status = 'Needs More Information';
    record.assigned_queue = 'Missing Information';
    record.assigned_reviewer = reviewerLabel;
    record.reviewer_decision = {
      case_id: record.case_id,
      document_id: record.case_number,
      reviewer_id: 'usr-reviewer-02',
      reviewed_by: reviewerLabel,
      action: 'request_info',
      selected_decision: 'Request Missing Information',
      notes,
      previous_status: prevStatus,
      new_status: record.status,
      previous_queue: prevQueue,
      new_queue: record.assigned_queue,
      priority: 'normal',
      reviewed_at: new Date().toISOString()
    };

    record.audit_events.unshift({
      event_id: `evt-${record.case_id}-${Date.now()}`,
      case_id: record.case_id,
      event_type: 'MISSING_INFO_REQUESTED',
      actor: 'Human Reviewer',
      summary: `Reviewer flagged case for additional information. Requested details: ${notes}`,
      details: `Decision: Request Missing Information | Previous Status: ${prevStatus} -> New Status: ${record.status} | Notes: ${notes}`,
      created_at: new Date().toISOString()
    });

    return record;
  });

  assert.equal(updated.status, 'Needs More Information');
  assert.equal(updated.assigned_queue, 'Missing Information');
  assert.equal(updated.reviewer_decision?.action, 'request_info');
  assert.equal(updated.reviewer_decision?.notes, notes);
  assert.equal(updated.audit_events[0].event_type, 'MISSING_INFO_REQUESTED');
});

test('TEST 3: Escalate to Priority Review sets High priority and routes to Priority Review queue', () => {
  const initial = createTestCase({ status: 'Ready for Review', assigned_queue: 'General Review' });
  const reason = 'High-value enterprise contract closing today requiring expedited KYC sign-off.';
  const reviewerLabel = 'Senior Specialist Marcus';

  const updated = caseStore.update(initial.case_id, (record) => {
    const prevStatus = record.status;
    const prevQueue = record.assigned_queue;

    assert.ok(reason && reason.trim().length > 0, 'Escalation reason is required');

    record.status = 'Priority Review';
    record.assigned_queue = 'Priority Review';
    record.priority = 'high';
    record.assigned_reviewer = reviewerLabel;
    record.reviewer_decision = {
      case_id: record.case_id,
      document_id: record.case_number,
      reviewer_id: 'usr-reviewer-03',
      reviewed_by: reviewerLabel,
      action: 'escalate_priority',
      selected_decision: 'Escalate to Priority Review',
      notes: reason,
      previous_status: prevStatus,
      new_status: record.status,
      previous_queue: prevQueue,
      new_queue: record.assigned_queue,
      priority: 'high',
      reviewed_at: new Date().toISOString()
    };

    record.audit_events.unshift({
      event_id: `evt-${record.case_id}-${Date.now()}`,
      case_id: record.case_id,
      event_type: 'PRIORITY_ESCALATED',
      actor: 'Human Reviewer',
      summary: `Case escalated to Priority Review queue by ${reviewerLabel}. Reason: ${reason}`,
      details: `Decision: Escalate to Priority Review | Previous Status: ${prevStatus} -> New Status: ${record.status} | Notes: ${reason}`,
      created_at: new Date().toISOString()
    });

    return record;
  });

  assert.equal(updated.status, 'Priority Review');
  assert.equal(updated.assigned_queue, 'Priority Review');
  assert.equal(updated.priority, 'high');
  assert.equal(updated.reviewer_decision?.action, 'escalate_priority');
  assert.equal(updated.reviewer_decision?.priority, 'high');
  assert.equal(updated.audit_events[0].event_type, 'PRIORITY_ESCALATED');
});

test('TEST 4: Incomplete document missing mandatory fields is blocked from Mark Ready for Review', () => {
  // Document missing mandatory expiration_date
  const incompleteCase = createTestCase({
    extracted_fields: [
      {
        field_id: 'f1',
        case_id: 'c-inc',
        field_name: 'passport_number',
        field_label: 'Passport Number',
        field_value: 'P99999',
        confidence: 0.9,
        is_uncertain: false,
        is_edited: false
      },
      {
        field_id: 'f2',
        case_id: 'c-inc',
        field_name: 'full_name',
        field_label: 'Full Name',
        field_value: '', // EMPTY MANDATORY!
        confidence: 0.0,
        is_uncertain: true,
        is_edited: false
      }
    ]
  });

  const schema = DOCUMENT_SCHEMAS[incompleteCase.document_type];
  const missingMandatory = schema?.fields.filter(
    (f) => f.required && !incompleteCase.extracted_fields.find((ef) => ef.field_name === f.name)?.field_value?.trim()
  );

  assert.ok(missingMandatory && missingMandatory.length > 0, 'Should detect missing mandatory fields');
  assert.ok(missingMandatory.some((f) => f.name === 'full_name'));
});

test('TEST 5: Data persistence: Saved decision and notes are preserved across reloads', () => {
  const created = createTestCase();
  const notes = 'Detailed verification audit notes that must persist on re-inspection.';

  caseStore.update(created.case_id, (record) => {
    record.status = 'Ready for Review';
    record.assigned_queue = 'General Review';
    record.reviewer_decision = {
      case_id: record.case_id,
      document_id: record.case_number,
      reviewer_id: 'usr-persisted',
      reviewed_by: 'Persisted Reviewer',
      action: 'approve_ready',
      selected_decision: 'Mark Ready for Review',
      notes,
      previous_status: 'Needs More Information',
      new_status: 'Ready for Review',
      reviewed_at: new Date().toISOString()
    };
    return record;
  });

  // Re-read directly from store to verify persistence
  const reloaded = caseStore.getById(created.case_id);
  assert.ok(reloaded);
  assert.equal(reloaded?.status, 'Ready for Review');
  assert.equal(reloaded?.reviewer_decision?.notes, notes);
  assert.equal(reloaded?.reviewer_decision?.selected_decision, 'Mark Ready for Review');
});

test('TEST 6: Audit history does not log entries for failed operations', () => {
  const testCase = createTestCase();
  const auditCountBefore = testCase.audit_events.length;

  try {
    caseStore.update(testCase.case_id, () => {
      throw new Error('Simulated validation failure');
    });
  } catch {
    // Expected error
  }

  const unchanged = caseStore.getById(testCase.case_id);
  assert.equal(unchanged?.audit_events.length, auditCountBefore, 'No audit entries created for failed operation');
});

test('HTTP API: End-to-End Reviewer Decision Endpoints', async (t) => {
  const http = await import('node:http');
  const { default: api } = await import('./api.ts');

  // Start test server
  let server: any;
  let baseUrl: string;
  await new Promise<void>((resolve) => {
    server = http.createServer(api);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  t.after(() => {
    server?.close();
  });

  // 1. Authenticate demo user to get session cookie
  const authRes = await fetch(`${baseUrl}/api/auth/demo`, { method: 'POST' });
  assert.equal(authRes.status, 200);
  const setCookie = authRes.headers.get('set-cookie') || '';
  const cookieHeader = setCookie.split(';')[0];
  assert.ok(cookieHeader.includes('docuagent_session='), 'Must receive session cookie');

  // TEST 7: Mark Ready for Review via HTTP API on complete document
  const testCase = createTestCase({
    status: 'Needs More Information',
    assigned_queue: 'Missing Information'
  });

  const readyRes = await fetch(`${baseUrl}/api/cases/${testCase.case_id}/review-action`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader
    },
    body: JSON.stringify({
      action: 'approve_ready',
      notes: 'Human reviewer validated credentials against official registry.'
    })
  });

  assert.equal(readyRes.status, 200);
  const readyData = await readyRes.json();
  assert.equal(readyData.status, 'Ready for Review');
  assert.equal(readyData.assigned_queue, 'General Review');
  assert.equal(readyData.reviewer_decision.action, 'approve_ready');
  assert.equal(readyData.reviewer_decision.selected_decision, 'Mark Ready for Review');
  assert.ok(readyData.audit_events.some((e: any) => e.summary.includes('marked Ready for Review')));

  // TEST 8: Mark Ready for Review on Incomplete Document returns HTTP 400
  const incompleteCase = createTestCase({
    document_type: 'invoice',
    extracted_fields: [
      {
        field_id: 'f1',
        case_id: 'inv-inc',
        field_name: 'invoice_number',
        field_label: 'Invoice Number',
        field_value: 'INV-999',
        confidence: 0.9,
        is_uncertain: false,
        is_edited: false
      }
      // Missing mandatory fields: client_name, vendor_name, total_amount, invoice_date
    ]
  });

  const blockRes = await fetch(`${baseUrl}/api/cases/${incompleteCase.case_id}/review-action`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader
    },
    body: JSON.stringify({
      action: 'approve_ready',
      notes: 'Attempting to mark incomplete document as ready'
    })
  });

  assert.equal(blockRes.status, 400);
  const blockData = await blockRes.json();
  assert.match(blockData.error || blockData.message, /mandatory field\(s\) missing/i);

  // TEST 9: Request Missing Information without notes returns HTTP 400
  const missingInfoEmptyRes = await fetch(`${baseUrl}/api/cases/${testCase.case_id}/review-action`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader
    },
    body: JSON.stringify({
      action: 'request_info',
      notes: '' // Empty notes
    })
  });

  assert.equal(missingInfoEmptyRes.status, 400);
  const emptyNotesData = await missingInfoEmptyRes.json();
  assert.match(emptyNotesData.error || emptyNotesData.message, /explanation is required/i);

  // TEST 10: Request Missing Information with notes succeeds and routes to Missing Information
  const reqInfoRes = await fetch(`${baseUrl}/api/cases/${testCase.case_id}/review-action`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader
    },
    body: JSON.stringify({
      action: 'request_info',
      notes: 'Passport signature page missing; please provide second page.'
    })
  });

  assert.equal(reqInfoRes.status, 200);
  const reqInfoData = await reqInfoRes.json();
  assert.equal(reqInfoData.status, 'Needs More Information');
  assert.equal(reqInfoData.assigned_queue, 'Missing Information');
  assert.equal(reqInfoData.reviewer_decision.action, 'request_info');
  assert.equal(reqInfoData.reviewer_decision.notes, 'Passport signature page missing; please provide second page.');
  assert.ok(reqInfoData.audit_events.some((e: any) => e.event_type === 'MISSING_INFO_REQUESTED'));

  // TEST 11: Escalate to Priority Review without notes returns HTTP 400
  const escalateEmptyRes = await fetch(`${baseUrl}/api/cases/${testCase.case_id}/review-action`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader
    },
    body: JSON.stringify({
      action: 'escalate_priority',
      notes: '' // Empty
    })
  });

  assert.equal(escalateEmptyRes.status, 400);
  const escalateEmptyData = await escalateEmptyRes.json();
  assert.match(escalateEmptyData.error || escalateEmptyData.message, /escalation reason is required/i);

  // TEST 12: Escalate to Priority Review with notes succeeds and sets priority High
  const escalateRes = await fetch(`${baseUrl}/api/cases/${testCase.case_id}/review-action`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader
    },
    body: JSON.stringify({
      action: 'escalate_priority',
      notes: 'Urgent closing timeline requires tier-1 compliance review today.'
    })
  });

  assert.equal(escalateRes.status, 200);
  const escalateData = await escalateRes.json();
  assert.equal(escalateData.status, 'Priority Review');
  assert.equal(escalateData.assigned_queue, 'Priority Review');
  assert.equal(escalateData.priority, 'high');
  assert.equal(escalateData.reviewer_decision.action, 'escalate_priority');
  assert.equal(escalateData.reviewer_decision.priority, 'high');
  assert.ok(escalateData.audit_events.some((e: any) => e.event_type === 'PRIORITY_ESCALATED'));

  // TEST 13: Finalize review action (mark_complete) succeeds
  const finalizeRes = await fetch(`${baseUrl}/api/cases/${testCase.case_id}/review-action`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader
    },
    body: JSON.stringify({
      action: 'mark_complete',
      notes: 'Final sign-off complete.'
    })
  });

  assert.equal(finalizeRes.status, 200);
  const finalizeData = await finalizeRes.json();
  assert.equal(finalizeData.status, 'Review Completed');
  assert.equal(finalizeData.reviewer_decision.action, 'mark_complete');
  assert.ok(finalizeData.audit_events.some((e: any) => e.event_type === 'REVIEW_COMPLETED'));
});

