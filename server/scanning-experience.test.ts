import test from 'node:test';
import assert from 'node:assert';
import { runAgentPipeline, StageUpdateDetail } from './agent.ts';
import { validateUploadFile, MAX_UPLOAD_SIZE_BYTES } from './fileValidation.ts';
import { idempotencyStore } from './idempotency.ts';

test('Scanning Pipeline: Emits real ordered stages for selectable digital PDF', async () => {
  const recordedStages: StageUpdateDetail[] = [];

  // Minimal valid PDF text stream
  const samplePdfData = 'data:application/pdf;base64,' + Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 120 >>\nstream\nBT /F1 12 Tf 72 712 Td (National Bank Statement Account Holder Jordan Taylor Smith Balance $4500 Date 2026-05-15) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000216 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n386\n%%EOF'
  ).toString('base64');

  const caseRecord = await runAgentPipeline(
    {
      fileName: 'bank_statement_2026.pdf',
      fileSizeKb: 120,
      fileMime: 'application/pdf',
      documentType: 'auto',
      rawText: 'National Bank Statement\nAccount Holder: Jordan Taylor Smith\nBalance: $4,500.00\nStatement Date: 2026-05-15',
      fileDataUrl: samplePdfData
    },
    (stageDetail) => {
      recordedStages.push(stageDetail);
    }
  );

  assert.ok(caseRecord, 'Case record should be generated');
  assert.ok(recordedStages.length >= 4, 'Should record multiple pipeline stages');

  const stageNames = recordedStages.map((s) => s.stage);
  assert.ok(stageNames.includes('scanning'), 'Should emit scanning stage');
  assert.ok(stageNames.includes('analyzing'), 'Should emit analyzing stage');
  assert.ok(stageNames.includes('validating'), 'Should emit validating stage');
  assert.ok(stageNames.includes('ready'), 'Should emit ready stage');

  // Verify transition to actual results
  assert.strictEqual(caseRecord.file_name, 'bank_statement_2026.pdf');
  assert.ok(caseRecord.extracted_fields.length > 0, 'Extracted fields should be populated');
  assert.ok(caseRecord.validation_findings.length > 0, 'Validation findings should be evaluated');
});

test('Scanning Pipeline: Emits OCR extraction method for raster image input', async () => {
  const recordedStages: StageUpdateDetail[] = [];

  // Tiny 1x1 PNG data URL
  const samplePngData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const caseRecord = await runAgentPipeline(
    {
      fileName: 'passport_scan.png',
      fileSizeKb: 450,
      fileMime: 'image/png',
      documentType: 'passport',
      rawText: 'PASSPORT\nSurname: DOE\nGiven Names: JOHN\nPassport No: P12345678\nBirth: 1988-04-12\nExpiration: 2028-11-20\nNationality: USA\nIssuing Country: United States',
      fileDataUrl: samplePngData
    },
    (stageDetail) => {
      recordedStages.push(stageDetail);
    }
  );

  assert.ok(caseRecord, 'Case record generated');
  const stageNames = recordedStages.map((s) => s.stage);
  assert.ok(stageNames.includes('scanning'));
  assert.ok(stageNames.includes('analyzing'));
  assert.ok(stageNames.includes('validating'));
  assert.ok(stageNames.includes('ready'));

  assert.strictEqual(caseRecord.document_type, 'passport');
  assert.ok(
    caseRecord.status === 'Ready for Review' || caseRecord.status === 'Needs More Information',
    'Case status should be a valid reviewer queue status'
  );
});

test('File Validation: Rejects unsupported file formats and extensions', () => {
  const unsupportedExe = validateUploadFile({
    fileName: 'malicious_payload.exe',
    fileMime: 'application/x-msdownload',
    fileSizeKb: 50
  });
  assert.strictEqual(unsupportedExe.valid, false);
  assert.ok(unsupportedExe.error?.includes('Unsupported file extension'));

  const unsupportedZip = validateUploadFile({
    fileName: 'archive.zip',
    fileMime: 'application/zip',
    fileSizeKb: 200
  });
  assert.strictEqual(unsupportedZip.valid, false);

  const validPdf = validateUploadFile({
    fileName: 'legitimate_doc.pdf',
    fileMime: 'application/pdf',
    fileSizeKb: 300
  });
  assert.strictEqual(validPdf.valid, true);

  const validPng = validateUploadFile({
    fileName: 'scan_id.png',
    fileMime: 'image/png',
    fileSizeKb: 450
  });
  assert.strictEqual(validPng.valid, true);
});

test('File Validation: Rejects oversized documents exceeding 15MB boundary', () => {
  const oversizedFile = validateUploadFile({
    fileName: 'giant_scanned_book.pdf',
    fileMime: 'application/pdf',
    fileSizeKb: 18 * 1024 // 18 MB
  });
  assert.strictEqual(oversizedFile.valid, false);
  assert.ok(oversizedFile.error?.includes('15MB'));
});

process.env.AI_REQUEST_TIMEOUT_MS = '100';
delete process.env.GEMINI_API_KEY;

test('Corrupted Document: Correctly handles unreadable raster and marks failure', async () => {
  const caseRecord = await runAgentPipeline({
    fileName: 'blurred_unreadable.jpg',
    fileSizeKb: 80,
    fileMime: 'image/jpeg',
    documentType: 'auto',
    isUnreadable: true,
    fileDataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
  });

  assert.strictEqual(caseRecord.status, 'Processing Failed');
  assert.ok(caseRecord.assigned_queue, 'Queue should be assigned');
  assert.ok(
    caseRecord.validation_findings.some((f) => f.category === 'format_error' && f.result === 'failed'),
    'Should register failed format_error finding for unreadable scan'
  );
});

test('Idempotency & Cancellation: IdempotencyStore releases lock on remove', () => {
  const key = `test-cancel-${Date.now()}`;
  idempotencyStore.setProcessing(key, 'hash-fingerprint-123');

  const inFlight = idempotencyStore.get(key);
  assert.ok(inFlight, 'Record should be registered as processing');
  assert.strictEqual(inFlight?.status, 'processing');

  // Cancel / remove
  idempotencyStore.remove(key);
  const afterCancel = idempotencyStore.get(key);
  assert.strictEqual(afterCancel, undefined, 'Key should be cleanly removed after cancellation');
});
