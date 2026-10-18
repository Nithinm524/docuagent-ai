import test from 'node:test';
import assert from 'node:assert/strict';
import { runAgentPipeline } from './agent.ts';
import { caseStore } from './store.ts';

// Helper to create synthetic digital PDF data URL
function createSyntheticPdf(lines: string[]): string {
  const content = lines
    .map((l, i) => `BT /F1 12 Tf 50 ${700 - i * 20} Td (${l.replace(/([\\()])/g, '\\$1')}) Tj ET`)
    .join('\n');
  const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${content.length} >>
stream
${content}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000280 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
${350 + content.length}
%%EOF`;
  return 'data:application/pdf;base64,' + Buffer.from(pdfString).toString('base64');
}

test('Pipeline: Selectable-Text PDF extraction detects selectable text and classifies appropriately', async () => {
  const pdfDataUrl = createSyntheticPdf([
    'FIRST NATIONAL HORIZON BANK - MONTHLY STATEMENT',
    'Account Holder: Morgan Sterling',
    'Account Number: 8821940129',
    'Statement Period: 2026-09-01 to 2026-09-30',
    'Beginning Balance: $8,420.00',
    'Ending Balance: $14,890.50'
  ]);

  const result = await runAgentPipeline({
    fileName: 'digital_bank_statement.pdf',
    fileSizeKb: 120,
    fileMime: 'application/pdf',
    documentType: 'auto',
    fileDataUrl: pdfDataUrl
  });

  assert.equal(result.is_selectable_pdf, true);
  assert.equal(result.document_type, 'bank_statement');
  assert.ok(result.raw_text.includes('Morgan Sterling'));
  assert.match(result.extraction_method || '', /Selectable PDF/i);
});

test('Pipeline: General document PDF classifies as General Document and avoids passport misclassification', async () => {
  const generalDocDataUrl = createSyntheticPdf([
    'ENTERPRISE SOFTWARE LICENSE AND MASTER SERVICES AGREEMENT',
    'Document Title: Master Services Agreement (MSA)',
    'Document Date: 2026-06-15',
    'Author: Apex Cloud Systems Technologies Inc.',
    'Topic: Enterprise cloud infrastructure hosting terms',
    'Section 1. Terms of engagement and service level guarantees.'
  ]);

  const result = await runAgentPipeline({
    fileName: 'master_services_agreement.pdf',
    fileSizeKb: 95,
    fileMime: 'application/pdf',
    documentType: 'auto',
    fileDataUrl: generalDocDataUrl
  });

  assert.equal(result.is_selectable_pdf, true);
  assert.equal(result.document_type, 'general_doc');
  assert.notEqual(result.document_type, 'passport');
  assert.equal(result.status, 'Ready for Review');
  assert.equal(result.assigned_queue, 'General Review');
  // Should NOT report OCR quality failure or missing passport fields!
  const hasOcrFailFinding = result.validation_findings.some(
    (f) => f.check_name.toLowerCase().includes('raster') || f.check_name.toLowerCase().includes('ocr quality')
  );
  assert.equal(hasOcrFailFinding, false);
});

test('Pipeline: Scanned PDF without selectable text does not report selectable PDF', async () => {
  // Scanned flat PDF with no text stream
  const emptyPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 3 >>
stream
q Q
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000215 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
280
%%EOF`;
  const scannedPdfDataUrl = 'data:application/pdf;base64,' + Buffer.from(emptyPdf).toString('base64');

  const result = await runAgentPipeline({
    fileName: 'flat_scanned_receipt.pdf',
    fileSizeKb: 450,
    fileMime: 'application/pdf',
    documentType: 'auto',
    fileDataUrl: scannedPdfDataUrl
  });

  assert.equal(result.is_selectable_pdf, false);
  // Without selectable text or OCR text tokens, document is labeled Unknown requiring human review
  assert.equal(result.document_type, 'unknown');
  assert.equal(result.status, 'Needs More Information');
  assert.equal(result.assigned_queue, 'Missing Information');
  assert.match(result.routing_reason, /Unknown/i);
});

test('Pipeline: Image document (PNG/JPG) routes with appropriate document schema', async () => {
  const result = await runAgentPipeline({
    fileName: 'synthetic_dl_elena_specimen.png',
    fileSizeKb: 340,
    fileMime: 'image/png',
    documentType: 'national_id',
    rawText: `MASSACHUSETTS DRIVER LICENSE\nLIC NO: S99104829\nNAME: ELENA ROSTOVA\nDOB: 1984-04-12\nADDRESS: 15 CAMBRIDGE PARKWAY, CAMBRIDGE MA\nEXPIRATION DATE: 2024-03-15`
  });

  assert.equal(result.document_type, 'national_id');
  assert.equal(result.is_selectable_pdf, false);
  assert.equal(result.status, 'Priority Review'); // Expired!
  assert.equal(result.assigned_queue, 'Priority Review');
  assert.ok(result.audit_events.length >= 4);
});
