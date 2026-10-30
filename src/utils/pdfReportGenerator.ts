/**
 * DOCUAGENT AI — Professional PDF Report Generator
 * Generates and downloads a clean, multi-page vector PDF containing:
 * - Official Header & Case Metadata
 * - Status & Queue Routing
 * - Executive Screening Synthesis
 * - Extracted Fields Table
 * - Validation Findings (active & resolved)
 * - Human Reviewer Decisions & Actions
 * - Immutable Audit Trail
 */

import { jsPDF } from 'jspdf';
import type { CaseRecord } from '../shared/types.ts';
import { DOCUMENT_SCHEMAS } from '../shared/validation.ts';

export function generateCasePdfReport(caseData: CaseRecord): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 16) {
      doc.addPage();
      y = margin;
      drawHeader();
    }
  };

  const drawHeader = () => {
    // Header banner line
    doc.setDrawColor(2, 132, 199); // cyan-600
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
  };

  // --- 1. COVER / HEADER ---
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, y, contentWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('DOCUAGENT AI', margin + 6, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('DOCUMENT INTELLIGENCE & VERIFICATION REPORT', margin + 6, y + 16);

  // Case Number on top right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(56, 189, 248); // sky-400
  doc.text(caseData.case_number, pageWidth - margin - 6, y + 9, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  const generatedTime = new Date().toLocaleString();
  doc.text(`Generated: ${generatedTime}`, pageWidth - margin - 6, y + 16, { align: 'right' });

  y += 26;

  // --- 2. CASE METADATA GRID ---
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(margin, y, contentWidth, 34, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105); // slate-600

  const col1X = margin + 4;
  const col2X = margin + 52;
  const col3X = margin + 115;

  const metadataRows = [
    {
      c1Label: 'DOCUMENT TYPE',
      c1Val: DOCUMENT_SCHEMAS[caseData.document_type]?.title || caseData.document_type,
      c2Label: 'WORKFLOW STATUS',
      c2Val: caseData.status,
      c3Label: 'ASSIGNED QUEUE',
      c3Val: caseData.assigned_queue
    },
    {
      c1Label: 'INTAKE FILE',
      c1Val: `${caseData.file_name} (${caseData.file_size_kb || 0} KB)`,
      c2Label: 'ASSIGNED REVIEWER',
      c2Val: caseData.assigned_reviewer || caseData.reviewer_decision?.reviewed_by || 'Unassigned (Pool)',
      c3Label: 'EXTRACTION ENGINE',
      c3Val: caseData.extraction_method || (caseData.is_selectable_pdf ? 'Selectable PDF Text' : 'OCR Multimodal')
    },
    {
      c1Label: 'INTAKE TIMESTAMP',
      c1Val: new Date(caseData.created_at).toLocaleString(),
      c2Label: 'PAYLOAD FORMAT',
      c2Val: `${caseData.file_mime} ${caseData.is_selectable_pdf ? '(Digital PDF)' : '(Scanned/Raster)'}`,
      c3Label: 'ACTIVE FINDINGS',
      c3Val: `${caseData.validation_findings.filter((f) => !f.resolved && f.result !== 'passed').length} Open Flag(s)`
    }
  ];

  let metaY = y + 5;
  for (const row of metadataRows) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(row.c1Label, col1X, metaY);
    doc.text(row.c2Label, col2X, metaY);
    doc.text(row.c3Label, col3X, metaY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(String(row.c1Val).slice(0, 32), col1X, metaY + 4);
    doc.text(String(row.c2Val).slice(0, 34), col2X, metaY + 4);
    doc.text(String(row.c3Val).slice(0, 36), col3X, metaY + 4);

    metaY += 9.5;
  }

  y += 38;

  // --- 3. EXECUTIVE SCREENING SYNTHESIS ---
  if (caseData.executive_summary) {
    checkPageBreak(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('EXECUTIVE SCREENING SYNTHESIS', margin, y);
    y += 3;

    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(255, 255, 255);
    const splitSummary = doc.splitTextToSize(caseData.executive_summary, contentWidth - 8);
    const boxHeight = Math.min(65, splitSummary.length * 3.8 + 6);
    doc.roundedRect(margin, y, contentWidth, boxHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(splitSummary.slice(0, 16), margin + 4, y + 4.5);
    y += boxHeight + 5;
  }

  // --- 4. EXTRACTED DOCUMENT FIELDS TABLE ---
  checkPageBreak(25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`EXTRACTED SCHEMA FIELDS (${caseData.extracted_fields.length})`, margin, y);
  y += 3;

  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('FIELD LABEL', margin + 3, y + 4);
  doc.text('EXTRACTED VALUE', margin + 55, y + 4);
  doc.text('REVIEWED / FINAL VALUE', margin + 115, y + 4);
  doc.text('CONFIDENCE', pageWidth - margin - 3, y + 4, { align: 'right' });
  y += 7;

  if (caseData.extracted_fields.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('No structured fields were extracted.', margin + 4, y + 3);
    y += 8;
  } else {
    for (const f of caseData.extracted_fields) {
      checkPageBreak(7);
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + 5.5, pageWidth - margin, y + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text(f.field_label || f.field_name, margin + 3, y + 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      const rawVal = f.field_value ? f.field_value : '(Not Extracted)';
      doc.text(doc.splitTextToSize(rawVal, 56)[0] || '', margin + 55, y + 4);

      if (f.reviewed_value && f.reviewed_value !== f.field_value) {
        doc.setTextColor(2, 132, 199); // edited color
        doc.setFont('helvetica', 'bold');
        doc.text(`${doc.splitTextToSize(f.reviewed_value, 54)[0]} [Edited]`, margin + 115, y + 4);
      } else {
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'normal');
        doc.text(f.reviewed_value ? doc.splitTextToSize(f.reviewed_value, 54)[0] : '—', margin + 115, y + 4);
      }

      // Confidence badge
      doc.setFont('helvetica', f.is_uncertain ? 'italic' : 'normal');
      doc.setFontSize(7);
      if (f.is_uncertain) {
        doc.setTextColor(217, 119, 6);
        doc.text(`${Math.round(f.confidence * 100)}% (Uncertain)`, pageWidth - margin - 3, y + 4, { align: 'right' });
      } else {
        doc.setTextColor(16, 185, 129);
        doc.text(`${Math.round(f.confidence * 100)}%`, pageWidth - margin - 3, y + 4, { align: 'right' });
      }

      y += 6.5;
    }
  }

  y += 4;

  // --- 5. VALIDATION FINDINGS ---
  checkPageBreak(25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`VALIDATION FINDINGS (${caseData.validation_findings.length})`, margin, y);
  y += 3;

  if (caseData.validation_findings.length === 0) {
    doc.setFillColor(236, 253, 245); // emerald-50
    doc.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(4, 120, 87);
    doc.text('No active validation anomalies or required field deficiencies detected.', margin + 4, y + 5);
    y += 12;
  } else {
    for (const finding of caseData.validation_findings) {
      checkPageBreak(12);

      const isResolved = finding.resolved;
      const isFailed = finding.result === 'failed';

      // Finding card
      doc.setFillColor(
        isResolved ? 248 : isFailed ? 254 : 255,
        isResolved ? 250 : isFailed ? 242 : 251,
        isResolved ? 252 : isFailed ? 242 : 235
      );
      doc.setDrawColor(
        isResolved ? 203 : isFailed ? 254 : 253,
        isResolved ? 213 : isFailed ? 202 : 230,
        isResolved ? 225 : isFailed ? 202 : 138
      );
      doc.roundedRect(margin, y, contentWidth, 10.5, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(isResolved ? 100 : isFailed ? 225 : 217, isResolved ? 116 : isFailed ? 29 : 119, isResolved ? 139 : isFailed ? 72 : 6);
      doc.text(`[${(finding.category || 'CHECK').toUpperCase()}] ${finding.check_name}`, margin + 3, y + 4);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text(
        isResolved ? 'RESOLVED' : `${(finding.severity || 'MEDIUM').toUpperCase()} SEVERITY`,
        pageWidth - margin - 3,
        y + 4,
        { align: 'right' }
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(51, 65, 85);
      const expl = doc.splitTextToSize(finding.explanation, contentWidth - 6)[0] || '';
      doc.text(expl, margin + 3, y + 8);

      y += 12.5;
    }
  }

  y += 3;

  // --- 6. REVIEWER DECISIONS & ACTIONS ---
  checkPageBreak(25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('REVIEWER DECISIONS & ACTIONS', margin, y);
  y += 3;

  if (caseData.review_actions.length === 0 && !caseData.reviewer_decision) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No human reviewer actions recorded yet. Case pending triage.', margin + 4, y + 5);
    y += 12;
  } else {
    // Current Decision summary box if present
    if (caseData.reviewer_decision) {
      checkPageBreak(14);
      doc.setFillColor(240, 249, 255); // sky-50
      doc.setDrawColor(186, 230, 253);
      doc.roundedRect(margin, y, contentWidth, 12, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(3, 105, 161);
      doc.text(`Official Decision: ${caseData.reviewer_decision.action.toUpperCase().replace(/_/g, ' ')}`, margin + 3, y + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      doc.text(
        `Reviewed By: ${caseData.reviewer_decision.reviewed_by} · ${new Date(caseData.reviewer_decision.reviewed_at).toLocaleString()}`,
        margin + 3,
        y + 8.5
      );

      if (caseData.reviewer_decision.notes) {
        doc.text(`Notes: ${caseData.reviewer_decision.notes.slice(0, 80)}`, margin + 3, y + 12);
      }
      y += 15;
    }

    // Historical review action entries
    for (const action of caseData.review_actions.slice(0, 6)) {
      checkPageBreak(9);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text(`• ${action.action.toUpperCase().replace(/_/g, ' ')} by ${action.reviewer_label}`, margin + 3, y + 3.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(new Date(action.created_at).toLocaleString(), pageWidth - margin - 3, y + 3.5, { align: 'right' });

      if (action.notes) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(71, 85, 105);
        doc.text(doc.splitTextToSize(action.notes, contentWidth - 10)[0] || '', margin + 7, y + 7.5);
        y += 9.5;
      } else {
        y += 6;
      }
    }
  }

  y += 3;

  // --- 7. IMMUTABLE AUDIT TRAIL EXCERPT ---
  checkPageBreak(25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`AUDIT TRAIL (${caseData.audit_events.length} Events)`, margin, y);
  y += 3;

  for (const event of caseData.audit_events.slice(0, 8)) {
    checkPageBreak(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`[${event.event_type}] ${event.summary}`, margin + 3, y + 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(`${event.actor} · ${new Date(event.created_at).toLocaleTimeString()}`, pageWidth - margin - 3, y + 3, { align: 'right' });

    y += 5.5;
  }

  // --- FOOTER ON ALL PAGES ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('DOCUAGENT AI · Automated Decision-Support Report · Authorized Intake Personnel Only', margin, pageHeight - 6.5);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6.5, { align: 'right' });
  }

  return doc;
}

export function downloadCasePdfReport(caseData: CaseRecord): void {
  const doc = generateCasePdfReport(caseData);
  const safeCaseNum = (caseData.case_number || caseData.case_id || 'case').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`DOCUAGENT_Report_${safeCaseNum}.pdf`);
}
