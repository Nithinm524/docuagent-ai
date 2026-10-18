import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runValidationChecks,
  evaluateAndRoute,
  validateDateFormat,
  validateExpirationDate,
  validateRecentDate,
  compareNames,
  checkCrossDocumentAddress,
  detectDocumentType,
  DOCUMENT_SCHEMAS
} from './validation.ts';
import type { ExtractedField } from './types.ts';

test('DOCUMENT_SCHEMAS defines required schemas', () => {
  assert.ok(DOCUMENT_SCHEMAS.passport);
  assert.ok(DOCUMENT_SCHEMAS.national_id);
  assert.ok(DOCUMENT_SCHEMAS.utility_bill);
  assert.ok(DOCUMENT_SCHEMAS.bank_statement);
  assert.ok(DOCUMENT_SCHEMAS.employment_verification);
  assert.ok(DOCUMENT_SCHEMAS.invoice);
});

test('validateDateFormat rejects invalid dates and accepts valid dates', () => {
  assert.equal(validateDateFormat('2028-12-31').valid, true);
  assert.equal(validateDateFormat('10/24/2027').valid, true);
  assert.equal(validateDateFormat('').valid, false);
  assert.equal(validateDateFormat('not-a-date').valid, false);
});

test('validateExpirationDate detects past expiration', () => {
  const expired = validateExpirationDate('2023-05-15');
  assert.equal(expired.valid, false);
  assert.match(expired.reason || '', /expired/i);

  const validFuture = validateExpirationDate('2030-01-01');
  assert.equal(validFuture.valid, true);
});

test('validateRecentDate checks 90-day threshold', () => {
  // relative to 2026-10-16 reference date
  const recent = validateRecentDate('2026-09-01', 90);
  assert.equal(recent.valid, true);

  const stale = validateRecentDate('2025-01-01', 90);
  assert.equal(stale.valid, false);
  assert.match(stale.reason || '', /recency window/i);
});

test('compareNames correctly matches similar names and flags conflicts', () => {
  const match = compareNames('Alex J. Rivera', 'Alex Rivera');
  assert.equal(match.match, true);
  assert.ok(match.confidence >= 0.6);

  const conflict = compareNames('Alex Rivera', 'Jordan Katherine Smith');
  assert.equal(conflict.match, false);
  assert.ok(conflict.confidence < 0.4);
});

test('runValidationChecks passes clean passport with all required fields', () => {
  const fields: ExtractedField[] = [
    { field_id: '1', case_id: 'c1', field_name: 'full_name', field_label: 'Full Name', field_value: 'Alex Rivera', confidence: 0.98, is_uncertain: false, is_edited: false },
    { field_id: '2', case_id: 'c1', field_name: 'passport_number', field_label: 'Passport Number', field_value: 'P12345678', confidence: 0.99, is_uncertain: false, is_edited: false },
    { field_id: '3', case_id: 'c1', field_name: 'nationality', field_label: 'Nationality', field_value: 'USA', confidence: 0.95, is_uncertain: false, is_edited: false },
    { field_id: '4', case_id: 'c1', field_name: 'date_of_birth', field_label: 'Date of Birth', field_value: '1992-06-15', confidence: 0.97, is_uncertain: false, is_edited: false },
    { field_id: '5', case_id: 'c1', field_name: 'expiration_date', field_label: 'Expiration Date', field_value: '2031-08-20', confidence: 0.96, is_uncertain: false, is_edited: false }
  ];

  const findings = runValidationChecks('passport', fields);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].result, 'passed');

  const decision = evaluateAndRoute(findings);
  assert.equal(decision.status, 'Ready for Review');
  assert.equal(decision.assignedQueue, 'General Review');
});

test('runValidationChecks flags missing required fields and routes to Missing Information queue', () => {
  const fields: ExtractedField[] = [
    { field_id: '1', case_id: 'c2', field_name: 'full_name', field_label: 'Full Name', field_value: 'Jordan Smith', confidence: 0.95, is_uncertain: false, is_edited: false },
    // missing passport_number!
    { field_id: '3', case_id: 'c2', field_name: 'nationality', field_label: 'Nationality', field_value: 'CAN', confidence: 0.92, is_uncertain: false, is_edited: false },
    { field_id: '4', case_id: 'c2', field_name: 'date_of_birth', field_label: 'Date of Birth', field_value: '1988-11-04', confidence: 0.95, is_uncertain: false, is_edited: false },
    { field_id: '5', case_id: 'c2', field_name: 'expiration_date', field_label: 'Expiration Date', field_value: '2029-01-10', confidence: 0.96, is_uncertain: false, is_edited: false }
  ];

  const findings = runValidationChecks('passport', fields);
  const missing = findings.filter((f) => f.category === 'missing_information' && f.result === 'failed');
  assert.ok(missing.length >= 1);
  assert.match(missing[0].explanation, /Passport Number/);

  const decision = evaluateAndRoute(findings);
  assert.equal(decision.status, 'Needs More Information');
  assert.equal(decision.assignedQueue, 'Missing Information');
});

test('runValidationChecks flags expired passport as high severity format error and routes to Priority Review', () => {
  const fields: ExtractedField[] = [
    { field_id: '1', case_id: 'c3', field_name: 'full_name', field_label: 'Full Name', field_value: 'Taylor Doe', confidence: 0.95, is_uncertain: false, is_edited: false },
    { field_id: '2', case_id: 'c3', field_name: 'passport_number', field_label: 'Passport Number', field_value: 'A98765432', confidence: 0.98, is_uncertain: false, is_edited: false },
    { field_id: '3', case_id: 'c3', field_name: 'nationality', field_label: 'Nationality', field_value: 'GBR', confidence: 0.94, is_uncertain: false, is_edited: false },
    { field_id: '4', case_id: 'c3', field_name: 'date_of_birth', field_label: 'Date of Birth', field_value: '1985-03-22', confidence: 0.97, is_uncertain: false, is_edited: false },
    { field_id: '5', case_id: 'c3', field_name: 'expiration_date', field_label: 'Expiration Date', field_value: '2022-04-10', confidence: 0.95, is_uncertain: false, is_edited: false }
  ];

  const findings = runValidationChecks('passport', fields);
  const expiredFinding = findings.find((f) => f.check_name.includes('Expiration Date'));
  assert.ok(expiredFinding);
  assert.equal(expiredFinding.result, 'failed');
  assert.equal(expiredFinding.severity, 'high');

  const decision = evaluateAndRoute(findings);
  assert.equal(decision.status, 'Priority Review');
  assert.equal(decision.assignedQueue, 'Priority Review');
});

test('runValidationChecks flags cross-document identity conflicts', () => {
  const fields: ExtractedField[] = [
    { field_id: '1', case_id: 'c4', field_name: 'full_name', field_label: 'Full Name', field_value: 'Alex Rivera', confidence: 0.98, is_uncertain: false, is_edited: false },
    { field_id: '2', case_id: 'c4', field_name: 'passport_number', field_label: 'Passport Number', field_value: 'P88371920', confidence: 0.98, is_uncertain: false, is_edited: false },
    { field_id: '3', case_id: 'c4', field_name: 'nationality', field_label: 'Nationality', field_value: 'USA', confidence: 0.95, is_uncertain: false, is_edited: false },
    { field_id: '4', case_id: 'c4', field_name: 'date_of_birth', field_label: 'Date of Birth', field_value: '1995-10-12', confidence: 0.97, is_uncertain: false, is_edited: false },
    { field_id: '5', case_id: 'c4', field_name: 'expiration_date', field_label: 'Expiration Date', field_value: '2030-05-15', confidence: 0.96, is_uncertain: false, is_edited: false }
  ];

  // Secondary document belongs to someone else
  const crossDocText = 'Electric Utility Bill. Customer: Morgan Vance. Service Address: 742 Evergreen Terrace, Springfield.';

  const findings = runValidationChecks('passport', fields, crossDocText);
  const conflictFinding = findings.find((f) => f.category === 'inconsistency');
  assert.ok(conflictFinding);
  assert.equal(conflictFinding.severity, 'high');

  const decision = evaluateAndRoute(findings);
  assert.equal(decision.status, 'Priority Review');
  assert.equal(decision.assignedQueue, 'Priority Review');
});

test('evaluateAndRoute routes unreadable document to Processing Failed', () => {
  const decision = evaluateAndRoute([], true);
  assert.equal(decision.status, 'Processing Failed');
  assert.match(decision.routingReason, /unreadable/i);
});

test('checkCrossDocumentAddress flags conflicting addresses', () => {
  const match = checkCrossDocumentAddress(
    '1204 Pine Crest Rd, Portland OR 97201',
    'UTILITY BILL: Customer Jordan Smith. Service Address: 1204 Pine Crest Road, Portland, Oregon'
  );
  assert.equal(match.match, true);

  const conflict = checkCrossDocumentAddress(
    '1204 Pine Crest Rd, Portland OR 97201',
    'GAS STATEMENT: Customer Marcus Vance. Service: 8990 Highland Parkway, Springfield IL'
  );
  assert.equal(conflict.match, false);
});

test('detectDocumentType classifies passport, driver license, bank statement, utility bill, general doc, and unknown', () => {
  // 1. Passport
  const passportRes = detectDocumentType('scan.pdf', 'PASSPORT / PASSEPORT\nType: P Country: USA\nPassport No: P928174028\nP<USARIVERA<<<<<<<<');
  assert.equal(passportRes.documentType, 'passport');

  // 2. National ID / Driver License
  const dlRes = detectDocumentType('id_scan.png', 'STATE OF OREGON DRIVER LICENSE\nDL NO: OR8829410A\nNAME: JORDAN SMITH\nCLASS: C');
  assert.equal(dlRes.documentType, 'national_id');

  // 3. Bank Statement
  const bankRes = detectDocumentType('statement.pdf', 'FIRST NATIONAL BANK\nAccount Number: 8821940129\nStatement Period: Sep 2026\nEnding Balance: $14,890.50\nChecking Account');
  assert.equal(bankRes.documentType, 'bank_statement');

  // 4. Utility Bill
  const utilityRes = detectDocumentType('bill.pdf', 'PACIFIC POWER & LIGHT\nCustomer: Taylor Morgan\nService Address: 482 Elmwood Ave\nMeter Number: 994012\nAmount Due: $142.85');
  assert.equal(utilityRes.documentType, 'utility_bill');

  // 5. General Document (PDF with readable contract/memo text, NOT an identity doc)
  const generalDocRes = detectDocumentType('agreement.pdf', 'ENTERPRISE MASTER SERVICES AGREEMENT\nEffective Date: 2026-06-15\nBetween: Cloud Corp and Client LLC\nScope: Cloud hosting services and software licensing.');
  assert.equal(generalDocRes.documentType, 'general_doc');

  // 6. Unknown (unreadable / corrupted text)
  const unknownRes = detectDocumentType('empty.pdf', '[CORRUPTED SCAN: 0x88 0xEF]');
  assert.equal(unknownRes.documentType, 'unknown');
});

test('general_doc passes validation cleanly without demanding identity fields', () => {
  const fields: ExtractedField[] = [
    { field_id: '1', case_id: 'g1', field_name: 'document_title', field_label: 'Document Title', field_value: 'Master Services Agreement', confidence: 0.95, is_uncertain: false, is_edited: false },
    { field_id: '2', case_id: 'g1', field_name: 'document_date', field_label: 'Document Date', field_value: '2026-06-15', confidence: 0.92, is_uncertain: false, is_edited: false },
    { field_id: '3', case_id: 'g1', field_name: 'author_or_organization', field_label: 'Author / Organization', field_value: 'Cloud Corp', confidence: 0.90, is_uncertain: false, is_edited: false }
  ];

  const findings = runValidationChecks('general_doc', fields);
  const decision = evaluateAndRoute(findings, false, 'general_doc');

  assert.equal(decision.status, 'Ready for Review');
  assert.equal(decision.assignedQueue, 'General Review');
  assert.match(decision.routingReason, /General document/i);
});

test('unknown document type produces warning finding and routes to Missing Information queue for triage', () => {
  const findings = runValidationChecks('unknown', []);
  const unknownFinding = findings.find((f) => f.check_name === 'Document Type Classification');
  assert.ok(unknownFinding);
  assert.equal(unknownFinding.result, 'warning');

  const decision = evaluateAndRoute(findings, false, 'unknown');
  assert.equal(decision.status, 'Needs More Information');
  assert.equal(decision.assignedQueue, 'Missing Information');
  assert.match(decision.routingReason, /Unknown/);
});

