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

test('Pipeline: Invoice PDF extraction extracts all schema fields (Vendor, Client, Dates, Subtotal, Tax, Total)', async () => {
  const invoicePdfDataUrl = createSyntheticPdf([
    'COMMERCIAL TAX INVOICE',
    'Vendor Name: Apex Global Cloud Technologies Inc.',
    'Client Name: Nexus Frontier Systems LLC',
    'Invoice Number: INV-2026-88941',
    'Invoice Date: 2026-10-15',
    'Due Date: 2026-11-15',
    'Subtotal: $4,500.00',
    'Tax / GST: $450.00',
    'Total Payable: $4,950.00'
  ]);

  const result = await runAgentPipeline({
    fileName: 'commercial_invoice_sample.pdf',
    fileSizeKb: 140,
    fileMime: 'application/pdf',
    documentType: 'auto',
    fileDataUrl: invoicePdfDataUrl
  });

  assert.equal(result.is_selectable_pdf, true);
  assert.equal(result.document_type, 'invoice');

  // Verify all 8 fields are extracted
  const fieldMap = new Map(result.extracted_fields.map((f) => [f.field_name, f]));

  const invoiceNumber = fieldMap.get('invoice_number');
  assert.ok(invoiceNumber, 'invoice_number must exist');
  assert.equal(invoiceNumber.field_value, 'INV-2026-88941');
  assert.ok(invoiceNumber.confidence > 0.8);

  const vendorName = fieldMap.get('vendor_name');
  assert.ok(vendorName, 'vendor_name must exist');
  assert.equal(vendorName.field_value, 'Apex Global Cloud Technologies Inc.');
  assert.ok(vendorName.confidence > 0.8);

  const clientName = fieldMap.get('client_name');
  assert.ok(clientName, 'client_name must exist');
  assert.equal(clientName.field_value, 'Nexus Frontier Systems LLC');
  assert.ok(clientName.confidence > 0.8);

  const invoiceDate = fieldMap.get('invoice_date');
  assert.ok(invoiceDate, 'invoice_date must exist');
  assert.equal(invoiceDate.field_value, '2026-10-15');
  assert.ok(invoiceDate.confidence > 0.8);

  const dueDate = fieldMap.get('due_date');
  assert.ok(dueDate, 'due_date must exist');
  assert.equal(dueDate.field_value, '2026-11-15');
  assert.ok(dueDate.confidence > 0.8);

  const subtotal = fieldMap.get('subtotal');
  assert.ok(subtotal, 'subtotal must exist');
  assert.equal(subtotal.field_value, '$4,500.00');
  assert.ok(subtotal.confidence > 0.8);

  const taxAmount = fieldMap.get('tax_amount');
  assert.ok(taxAmount, 'tax_amount must exist');
  assert.equal(taxAmount.field_value, '$450.00');
  assert.ok(taxAmount.confidence > 0.8);

  const totalAmount = fieldMap.get('total_amount');
  assert.ok(totalAmount, 'total_amount must exist');
  assert.equal(totalAmount.field_value, '$4,950.00');
  assert.ok(totalAmount.confidence > 0.8);

  assert.equal(result.status, 'Ready for Review');
  assert.equal(result.assigned_queue, 'General Review');
});

test('Pipeline: Invoice image with label variations extracts all schema fields correctly', async () => {
  const result = await runAgentPipeline({
    fileName: 'scanned_vendor_bill.png',
    fileSizeKb: 280,
    fileMime: 'image/png',
    documentType: 'invoice',
    rawText: `TAX INVOICE
From: Vertex Cloud Services LLC
Billed To: Horizon Logistics Corp
Invoice #: INV-99014
Date: 24 Oct 2026
Payment Due: 24 Nov 2026
Sub Total: $8,000.00
GST (10%): $800.00
Total Amount Due: $8,800.00`
  });

  assert.equal(result.document_type, 'invoice');

  const fieldMap = new Map(result.extracted_fields.map((f) => [f.field_name, f]));

  assert.equal(fieldMap.get('invoice_number')?.field_value, 'INV-99014');
  assert.equal(fieldMap.get('vendor_name')?.field_value, 'Vertex Cloud Services LLC');
  assert.equal(fieldMap.get('client_name')?.field_value, 'Horizon Logistics Corp');
  assert.equal(fieldMap.get('invoice_date')?.field_value, '24 Oct 2026');
  assert.equal(fieldMap.get('due_date')?.field_value, '24 Nov 2026');
  assert.equal(fieldMap.get('subtotal')?.field_value, '$8,000.00');
  assert.equal(fieldMap.get('tax_amount')?.field_value, '$800.00');
  assert.equal(fieldMap.get('total_amount')?.field_value, '$8,800.00');

  // Verify non-empty fields have positive confidence
  for (const f of result.extracted_fields) {
    assert.ok(f.confidence > 0.7, `Field ${f.field_name} should have high confidence`);
    assert.equal(f.is_uncertain, false, `Field ${f.field_name} should not be uncertain`);
  }
});

test('Pipeline: Exact test invoice specimen PDF (INV-1001, ABC Technologies, XYZ Solutions, 5000)', async () => {
  const invoicePdf = createSyntheticPdf([
    'INVOICE',
    'Invoice Number: INV-1001',
    'Vendor: ABC Technologies',
    'Billed To: XYZ Solutions',
    'Invoice Date: 27 October 2026',
    'Description: Computer accessories',
    'Quantity: 10',
    'Unit Price: 500',
    'Total Payable Amount: 5000',
    'Payment Status: Pending'
  ]);

  const result = await runAgentPipeline({
    fileName: 'test_invoice_specimen.pdf',
    fileSizeKb: 110,
    fileMime: 'application/pdf',
    documentType: 'auto',
    fileDataUrl: invoicePdf
  });

  assert.equal(result.is_selectable_pdf, true);
  assert.equal(result.document_type, 'invoice');

  const fieldMap = new Map(result.extracted_fields.map((f) => [f.field_name, f]));

  const invNum = fieldMap.get('invoice_number');
  assert.ok(invNum, 'invoice_number must exist');
  assert.equal(invNum.field_value, 'INV-1001');
  assert.notEqual(invNum.field_value.toLowerCase(), 'technologies');
  assert.ok(invNum.confidence > 0.8);
  assert.equal(invNum.is_uncertain, false);

  const vendor = fieldMap.get('vendor_name');
  assert.ok(vendor, 'vendor_name must exist');
  assert.equal(vendor.field_value, 'ABC Technologies');
  assert.ok(vendor.confidence > 0.8);

  const client = fieldMap.get('client_name');
  assert.ok(client, 'client_name must exist');
  assert.equal(client.field_value, 'XYZ Solutions');
  assert.ok(client.confidence > 0.8);

  const date = fieldMap.get('invoice_date');
  assert.ok(date, 'invoice_date must exist');
  assert.equal(date.field_value, '27 October 2026');
  assert.ok(date.confidence > 0.8);

  const total = fieldMap.get('total_amount');
  assert.ok(total, 'total_amount must exist');
  assert.equal(total.field_value, '5000'); // Distinguished from unit price 500 and qty 10!
  assert.ok(total.confidence > 0.8);

  // Optional fields not present in test invoice must have 0 confidence and be marked uncertain without failing validation
  const subtotal = fieldMap.get('subtotal');
  assert.equal(subtotal?.field_value, '');
  assert.equal(subtotal?.confidence, 0.0);
  assert.equal(subtotal?.is_uncertain, true);

  assert.equal(result.status, 'Ready for Review');
  assert.equal(result.assigned_queue, 'General Review');
});

test('Pipeline: Exact test invoice specimen PNG image format', async () => {
  const result = await runAgentPipeline({
    fileName: 'test_invoice_specimen.png',
    fileSizeKb: 240,
    fileMime: 'image/png',
    documentType: 'invoice',
    rawText: `INVOICE
Invoice Number: INV-1001
Vendor: ABC Technologies
Billed To: XYZ Solutions
Invoice Date: 27 October 2026
Description: Computer accessories
Quantity: 10
Unit Price: 500
Total Payable Amount: 5000
Payment Status: Pending`
  });

  assert.equal(result.document_type, 'invoice');
  assert.equal(result.is_selectable_pdf, false);

  const fieldMap = new Map(result.extracted_fields.map((f) => [f.field_name, f]));
  assert.equal(fieldMap.get('invoice_number')?.field_value, 'INV-1001');
  assert.notEqual(fieldMap.get('invoice_number')?.field_value.toLowerCase(), 'technologies');
  assert.equal(fieldMap.get('vendor_name')?.field_value, 'ABC Technologies');
  assert.equal(fieldMap.get('client_name')?.field_value, 'XYZ Solutions');
  assert.equal(fieldMap.get('invoice_date')?.field_value, '27 October 2026');
  assert.equal(fieldMap.get('total_amount')?.field_value, '5000');

  assert.equal(result.status, 'Ready for Review');
  assert.equal(result.assigned_queue, 'General Review');
});

test('Pipeline: Exact test invoice specimen JPEG image format', async () => {
  const result = await runAgentPipeline({
    fileName: 'test_invoice_specimen.jpg',
    fileSizeKb: 195,
    fileMime: 'image/jpeg',
    documentType: 'invoice',
    rawText: `INVOICE
Invoice Number: INV-1001
Vendor: ABC Technologies
Billed To: XYZ Solutions
Invoice Date: 27 October 2026
Description: Computer accessories
Quantity: 10
Unit Price: 500
Total Payable Amount: 5000
Payment Status: Pending`
  });

  assert.equal(result.document_type, 'invoice');
  const fieldMap = new Map(result.extracted_fields.map((f) => [f.field_name, f]));
  assert.equal(fieldMap.get('invoice_number')?.field_value, 'INV-1001');
  assert.equal(fieldMap.get('vendor_name')?.field_value, 'ABC Technologies');
  assert.equal(fieldMap.get('client_name')?.field_value, 'XYZ Solutions');
  assert.equal(fieldMap.get('invoice_date')?.field_value, '27 October 2026');
  assert.equal(fieldMap.get('total_amount')?.field_value, '5000');

  assert.equal(result.status, 'Ready for Review');
});

test('Pipeline: Document missing required fields routes to Missing Information with honest confidence', async () => {
  const incompletePdf = createSyntheticPdf([
    'INVOICE DRAFT - INCOMPLETE',
    'Vendor: ABC Technologies',
    'Invoice Date: 27 October 2026',
    'Description: Computer accessories',
    'Quantity: 10'
    // Missing: Invoice Number, Billed To / Client Name, Total Payable Amount
  ]);

  const result = await runAgentPipeline({
    fileName: 'incomplete_invoice.pdf',
    fileSizeKb: 85,
    fileMime: 'application/pdf',
    documentType: 'invoice',
    fileDataUrl: incompletePdf
  });

  assert.equal(result.status, 'Needs More Information');
  assert.equal(result.assigned_queue, 'Missing Information');

  const fieldMap = new Map(result.extracted_fields.map((f) => [f.field_name, f]));
  const invNum = fieldMap.get('invoice_number');
  assert.equal(invNum?.field_value, '');
  assert.equal(invNum?.confidence, 0.0); // Never 20% or non-zero for empty!
  assert.equal(invNum?.is_uncertain, true);

  const client = fieldMap.get('client_name');
  assert.equal(client?.field_value, '');
  assert.equal(client?.confidence, 0.0);
  assert.equal(client?.is_uncertain, true);

  // Missing fields must be clearly identified in findings
  const missingFindings = result.validation_findings.filter(
    (f) => f.category === 'missing_information' && f.result === 'failed'
  );
  assert.ok(missingFindings.length >= 2, 'Should identify missing mandatory fields');
  assert.ok(missingFindings.some((f) => f.check_name.includes('Invoice Number')));
  assert.ok(missingFindings.some((f) => f.check_name.includes('Client Name')));
});

test('Pipeline: Anti-fabrication check: company word Technologies is never assigned to invoice_number', async () => {
  const result = await runAgentPipeline({
    fileName: 'vendor_letterhead_bill.pdf',
    fileSizeKb: 110,
    fileMime: 'application/pdf',
    documentType: 'invoice',
    rawText: `INVOICE
ABC Technologies Inc.
Billed To: XYZ Solutions
Invoice Date: 27 October 2026
Total Payable Amount: 5000`
  });

  const fieldMap = new Map(result.extracted_fields.map((f) => [f.field_name, f]));
  const invNum = fieldMap.get('invoice_number');
  // Must NOT assign "Technologies" or "ABC Technologies" or "Inc" to invoice number
  assert.notEqual(invNum?.field_value.toLowerCase(), 'technologies');
  assert.notEqual(invNum?.field_value.toLowerCase(), 'abc');
  assert.notEqual(invNum?.field_value.toLowerCase(), 'inc');
  // Since no valid invoice number exists, it must be empty with confidence 0.0
  assert.equal(invNum?.field_value, '');
  assert.equal(invNum?.confidence, 0.0);
});

test('Pipeline: Non-invoice document content does not invent invoice fields', async () => {
  const result = await runAgentPipeline({
    fileName: 'system_architecture_diagram.png',
    fileSizeKb: 310,
    fileMime: 'image/png',
    documentType: 'auto',
    rawText: `SYSTEM ARCHITECTURE OVERVIEW
API Gateway -> Load Balancer -> Worker Pool -> Redis Cache -> PostgreSQL
This diagram illustrates the cloud infrastructure topology.`
  });

  // Must not be classified as invoice
  assert.notEqual(result.document_type, 'invoice');
  // Must not fabricate invoice fields
  const hasInvNum = result.extracted_fields.some((f) => f.field_name === 'invoice_number');
  assert.equal(hasInvNum, false, 'Non-invoice document must not have invoice_number schema field');
});

test('Pipeline: Completed', () => {
  setTimeout(() => process.exit(0), 100).unref();
});



