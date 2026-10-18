/**
 * Synthetic Sample Document File Generator
 * Creates realistic synthetic document images (PNG/JPG) client-side
 * allowing users to test real file drag-and-drop and OCR workflows.
 */

export function generateSamplePassportImage(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 520;
  const ctx = canvas.getContext('2d')!;

  // Background gradient (official security guilloche tone)
  const bg = ctx.createLinearGradient(0, 0, 800, 520);
  bg.addColorStop(0, '#0f172a');
  bg.addColorStop(0.5, '#1e293b');
  bg.addColorStop(1, '#0f172a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 800, 520);

  // Security border
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 16, 768, 488);

  // Gold header banner
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(20, 20, 760, 60);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('UNITED STATES OF AMERICA  /  PASSPORT', 40, 56);

  // Photo box
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(40, 110, 180, 230);
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 110, 180, 230);

  // Avatar silhouette
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.arc(130, 190, 45, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(130, 290, 65, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.fillText('SYNTHETIC SPECIMEN', 75, 330);

  // Details fields
  const drawField = (label: string, val: string, x: number, y: number) => {
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(label.toUpperCase(), x, y);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    ctx.fillText(val, x, y + 20);
  };

  drawField('Surname', 'RIVERA', 250, 125);
  drawField('Given Names', 'ALEX JULIAN', 250, 175);
  drawField('Nationality', 'UNITED STATES OF AMERICA', 250, 225);
  drawField('Date of Birth', '15 JUN 1992', 250, 275);
  drawField('Passport Number', 'P928174028', 520, 125);
  drawField('Date of Expiration', '19 AUG 2031', 520, 225);
  drawField('Authority', 'US DEPARTMENT OF STATE', 520, 275);

  // Machine Readable Zone (MRZ)
  ctx.fillStyle = '#090d16';
  ctx.fillRect(20, 390, 760, 100);
  ctx.fillStyle = '#22d3ee';
  ctx.font = '17px "JetBrains Mono", monospace';
  ctx.fillText('P<USARIVERA<<ALEX<JULIAN<<<<<<<<<<<<<<<<<<<<<<<<', 40, 430);
  ctx.fillText('P9281740284USA9206155M3108198<<<<<<<<<<<<<<<<<04', 40, 465);

  return canvas.toDataURL('image/png');
}

export function generateSampleExpiredDLImage(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 750;
  canvas.height = 460;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(0, 0, 750, 460);

  // Header
  ctx.fillStyle = '#312e81';
  ctx.fillRect(0, 0, 750, 65);
  ctx.fillStyle = '#f43f5e';
  ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('MASSACHUSETTS DRIVER LICENSE', 30, 40);

  ctx.fillStyle = '#f43f5e';
  ctx.fillRect(520, 15, 200, 35);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('EXPIRED SPECIMEN', 545, 38);

  // Photo
  ctx.fillStyle = '#312e81';
  ctx.fillRect(35, 95, 160, 200);
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 2;
  ctx.strokeRect(35, 95, 160, 200);

  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.arc(115, 170, 40, 0, Math.PI * 2);
  ctx.fill();

  const drawField = (label: string, val: string, x: number, y: number, highlight = false) => {
    ctx.fillStyle = highlight ? '#f43f5e' : '#a5b4fc';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(label.toUpperCase(), x, y);
    ctx.fillStyle = highlight ? '#fda4af' : '#ffffff';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(val, x, y + 18);
  };

  drawField('License Number', 'S99104829', 220, 115);
  drawField('Name', 'ELENA ROSTOVA', 220, 165);
  drawField('Date of Birth', '1984-04-12', 220, 215);
  drawField('Address', '15 Cambridge Parkway, Cambridge MA', 220, 265);
  drawField('Expiration Date (EXPIRED)', '2024-03-15', 220, 320, true);

  return canvas.toDataURL('image/png');
}

export function generateSampleDegradedScan(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 600, 400);

  // Add severe compression noise
  for (let i = 0; i < 2000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#1e293b' : '#64748b';
    ctx.fillRect(Math.random() * 600, Math.random() * 400, 4, 4);
  }

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('%%% UNREADABLE SCAN RESOLUTION < 72 DPI %%%', 100, 180);
  ctx.fillText('CORRUPTED MATRIX - ILLOGICAL GLYPH STREAM', 110, 220);

  return canvas.toDataURL('image/jpeg', 0.15); // low quality degraded
}

export function buildDataUrlPDF(lines: string[]): string {
  const streamLines = lines
    .map((line, idx) => {
      const escaped = line.replace(/([\\()])/g, '\\$1');
      return `BT /F1 12 Tf 40 ${740 - idx * 24} Td (${escaped}) Tj ET`;
    })
    .join('\n');

  const content = streamLines;
  const contentLen = content.length;

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
<< /Length ${contentLen} >>
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
${350 + contentLen}
%%EOF`;

  return 'data:application/pdf;base64,' + btoa(unescape(encodeURIComponent(pdfString)));
}

export function generateSampleSelectablePDF(): string {
  return buildDataUrlPDF([
    'FIRST NATIONAL HORIZON BANK - MONTHLY CHECKING STATEMENT',
    'Customer Name: Morgan Avery Sterling',
    'Account Number: 8821940129',
    'Financial Institution: First National Horizon Bank NA',
    'Statement Period: 2026-09-01 to 2026-09-30',
    'Beginning Balance: $8,420.00',
    'Ending Balance: $14,890.50',
    'Total Deposits: $7,200.00   Total Withdrawals: $729.50',
    'Status: Verified Active Account'
  ]);
}

export function generateSampleGeneralDocPDF(): string {
  return buildDataUrlPDF([
    'ENTERPRISE SOFTWARE LICENSE AND MASTER SERVICES AGREEMENT',
    'Document Title: Master Services Agreement (MSA)',
    'Document Date: 2026-06-15',
    'Author / Organization: Apex Cloud Systems Technologies Inc.',
    'Topic / Scope: Enterprise cloud infrastructure hosting and support terms',
    'Section 1. Grant of License and Operational Parameters',
    'This agreement outlines standard enterprise terms for SaaS deployment.',
    'Governing Law: State of Delaware. All terms binding upon signature.'
  ]);
}

export function generateSampleScannedPDF(): string {
  // Scanned PDF with no digital text stream (simulating pure raster/flat PDF)
  const emptyStream = 'q Q';
  const pdfString = `%PDF-1.4
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
<< /Length ${emptyStream.length} >>
stream
${emptyStream}
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
300
%%EOF`;

  return 'data:application/pdf;base64,' + btoa(pdfString);
}

export function downloadBase64File(dataUrl: string, fileName: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function dataURLtoFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}
