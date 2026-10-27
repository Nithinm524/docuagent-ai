import test from 'node:test';
import assert from 'node:assert/strict';
import api from './api.ts';
import { authService } from './auth.ts';
import http from 'node:http';

let server: http.Server;
let port: number;
let baseUrl: string;

function createMinimalPdfBase64(): string {
  const raw = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj
4 0 obj<</Length 68>>stream
BT /F1 12 Tf 72 712 Td (National Bank Statement Balance 5000 USD) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000052 00000 n 
0000000101 00000 n 
0000000185 00000 n 
trailer<</Size 5/Root 1 0 R>>
startxref
305
%%EOF`;
  return 'data:application/pdf;base64,' + Buffer.from(raw).toString('base64');
}

function createMinimalPngBase64(): string {
  // 1x1 PNG
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
}

function createMinimalJpegBase64(): string {
  // Minimal valid JPEG header (SOI + DQT + SOF0 + EOI)
  const jpegBytes = Buffer.from([
    0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, ...new Array(64).fill(0x10),
    0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
    0xff, 0xd9
  ]);
  return 'data:image/jpeg;base64,' + jpegBytes.toString('base64');
}

test('Upload & Authentication End-to-End Suite', async (t) => {
  // Start ephemeral HTTP server on random open port
  await new Promise<void>((resolve) => {
    server = http.createServer(api);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      port = addr.port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  t.after(() => {
    server.close();
  });

  await authService.waitUntilReady();

  // Test 1: Upload without credentials returns 401 AUTHENTICATION_REQUIRED
  await t.test('POST /api/cases/process without credentials returns 401 AUTHENTICATION_REQUIRED', async () => {
    const res = await fetch(`${baseUrl}/api/cases/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'bank_statement.pdf',
        fileSizeKb: 50,
        fileMime: 'application/pdf',
        fileDataUrl: createMinimalPdfBase64()
      })
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'AUTHENTICATION_REQUIRED');
    assert.match(body.error, /Authentication credentials required/i);
  });

  // Test 2: Upload with Demo Reviewer token succeeds (200)
  await t.test('POST /api/cases/process with demo-reviewer-token processes valid PDF document', async () => {
    const res = await fetch(`${baseUrl}/api/cases/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer demo-reviewer-token'
      },
      body: JSON.stringify({
        fileName: 'commercial_bank_statement.pdf',
        fileSizeKb: 45,
        fileMime: 'application/pdf',
        documentType: 'bank_statement',
        fileDataUrl: createMinimalPdfBase64()
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.case_id);
    assert.ok(data.case_number);
    assert.equal(data.file_name, 'commercial_bank_statement.pdf');
    assert.ok(Array.isArray(data.extracted_fields));
  });

  // Test 3: Upload valid PNG image with demo token succeeds
  await t.test('POST /api/cases/process processes valid PNG image', async () => {
    const res = await fetch(`${baseUrl}/api/cases/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer demo-reviewer-token'
      },
      body: JSON.stringify({
        fileName: 'passport_id.png',
        fileSizeKb: 12,
        fileMime: 'image/png',
        documentType: 'passport',
        fileDataUrl: createMinimalPngBase64()
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.case_id);
    assert.equal(data.file_name, 'passport_id.png');
  });

  // Test 4: Upload valid JPEG image with demo token succeeds
  await t.test('POST /api/cases/process processes valid JPEG image', async () => {
    const res = await fetch(`${baseUrl}/api/cases/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer demo-reviewer-token'
      },
      body: JSON.stringify({
        fileName: 'drivers_license.jpeg',
        fileSizeKb: 15,
        fileMime: 'image/jpeg',
        documentType: 'drivers_license',
        fileDataUrl: createMinimalJpegBase64()
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.case_id);
    assert.equal(data.file_name, 'drivers_license.jpeg');
  });

  // Test 5: /api/auth/demo issues a working session token
  await t.test('POST /api/auth/demo returns a valid demo token that authenticates', async () => {
    const demoRes = await fetch(`${baseUrl}/api/auth/demo`, { method: 'POST' });
    assert.equal(demoRes.status, 200);
    const demoData = await demoRes.json();
    assert.equal(demoData.success, true);
    assert.ok(demoData.token);
    assert.equal(demoData.user.role, 'reviewer');

    // Use issued token on upload endpoint
    const uploadRes = await fetch(`${baseUrl}/api/cases/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${demoData.token}`
      },
      body: JSON.stringify({
        fileName: 'utility_verification.pdf',
        fileSizeKb: 30,
        fileMime: 'application/pdf',
        documentType: 'utility_bill',
        fileDataUrl: createMinimalPdfBase64()
      })
    });

    assert.equal(uploadRes.status, 200);
  });

  // Test 6: Rejection of unsupported file extension (.exe) returns 400 UNSUPPORTED_FILE_TYPE
  await t.test('POST /api/cases/process with unsupported extension returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/cases/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer demo-reviewer-token'
      },
      body: JSON.stringify({
        fileName: 'malicious_script.exe',
        fileSizeKb: 10,
        fileMime: 'application/x-msdownload',
        fileDataUrl: createMinimalPdfBase64()
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.code, 'UNSUPPORTED_FILE_TYPE');
    assert.match(data.error, /Unsupported file extension/i);
  });

  // Test 7: Rejection of oversized file (>15MB) returns 413 FILE_TOO_LARGE
  await t.test('POST /api/cases/process with oversized file returns 413 FILE_TOO_LARGE', async () => {
    const res = await fetch(`${baseUrl}/api/cases/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer demo-reviewer-token'
      },
      body: JSON.stringify({
        fileName: 'giant_archive.pdf',
        fileSizeKb: 16 * 1024, // 16MB declared
        fileMime: 'application/pdf',
        fileDataUrl: createMinimalPdfBase64()
      })
    });

    assert.equal(res.status, 413);
    const data = await res.json();
    assert.equal(data.code, 'FILE_TOO_LARGE');
    assert.match(data.error, /exceeds maximum allowed upload boundary/i);
  });
});
