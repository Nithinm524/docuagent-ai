/**
 * Express API Endpoints for AI Document Review & Routing Agent
 */

import express, { Request, Response, NextFunction } from 'express';
import { caseStore } from './store.ts';
import { runAgentPipeline, reEvaluateCase, generateExecutiveSummary } from './agent.ts';
import { SYNTHETIC_SCENARIOS } from '../src/shared/samples.ts';
import { AuditEvent, ReviewAction } from '../src/shared/types.ts';

const api = express();
api.use(express.json({ limit: '15mb' }));

// Helper to log errors safely
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// GET /api/stats - Dashboard metrics
api.get('/api/stats', (req: Request, res: Response) => {
  const cases = caseStore.getAll();
  const total = cases.length;
  const readyForReview = cases.filter((c) => c.status === 'Ready for Review').length;
  const needsMoreInfo = cases.filter((c) => c.status === 'Needs More Information').length;
  const priorityReview = cases.filter((c) => c.status === 'Priority Review').length;
  const completed = cases.filter((c) => c.status === 'Review Completed').length;
  const failed = cases.filter((c) => c.status === 'Processing Failed').length;

  const queues = {
    general: cases.filter((c) => c.assigned_queue === 'General Review' && c.status !== 'Review Completed').length,
    missing_info: cases.filter((c) => c.assigned_queue === 'Missing Information' && c.status !== 'Review Completed').length,
    priority: cases.filter((c) => c.assigned_queue === 'Priority Review' && c.status !== 'Review Completed').length
  };

  const byDocType = cases.reduce((acc, c) => {
    acc[c.document_type] = (acc[c.document_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  res.json({
    total,
    readyForReview,
    needsMoreInfo,
    priorityReview,
    completed,
    failed,
    queues,
    byDocType
  });
});

// GET /api/cases - List cases with optional filtering
api.get('/api/cases', (req: Request, res: Response) => {
  let cases = caseStore.getAll();
  const { status, queue, search, docType } = req.query;

  if (status && typeof status === 'string' && status !== 'all') {
    cases = cases.filter((c) => c.status.toLowerCase() === status.toLowerCase());
  }

  if (queue && typeof queue === 'string' && queue !== 'all') {
    cases = cases.filter((c) => c.assigned_queue.toLowerCase() === queue.toLowerCase());
  }

  if (docType && typeof docType === 'string' && docType !== 'all') {
    cases = cases.filter((c) => c.document_type.toLowerCase() === docType.toLowerCase());
  }

  if (search && typeof search === 'string' && search.trim()) {
    const q = search.toLowerCase().trim();
    cases = cases.filter(
      (c) =>
        c.case_number.toLowerCase().includes(q) ||
        c.case_id.toLowerCase().includes(q) ||
        c.file_name.toLowerCase().includes(q) ||
        c.extracted_fields.some((f) => f.field_value.toLowerCase().includes(q) || (f.reviewed_value && f.reviewed_value.toLowerCase().includes(q)))
    );
  }

  res.json(cases);
});

// GET /api/cases/:id - Get single case
api.get('/api/cases/:id', (req: Request, res: Response) => {
  const caseItem = caseStore.getById(req.params.id);
  if (!caseItem) {
    return res.status(404).json({ error: 'Case not found' });
  }
  res.json(caseItem);
});

// POST /api/cases/process - Ingest & process new document
api.post('/api/cases/process', asyncHandler(async (req: Request, res: Response) => {
  const {
    fileName,
    fileSizeKb,
    fileMime,
    documentType,
    rawText,
    fileDataUrl,
    crossReferenceFileName,
    crossReferenceText,
    isUnreadable,
    manualFields
  } = req.body;

  if (!fileName) {
    return res.status(400).json({ error: 'fileName is required' });
  }

  const caseRecord = await runAgentPipeline({
    fileName,
    fileSizeKb: fileSizeKb || 150,
    fileMime: fileMime || 'application/pdf',
    documentType: documentType || 'auto',
    rawText,
    fileDataUrl,
    crossReferenceFileName,
    crossReferenceText,
    isUnreadable: !!isUnreadable,
    manualFields
  });

  res.status(201).json(caseRecord);
}));

// POST /api/cases/:id/re-run - Re-evaluate agent workflow
api.post('/api/cases/:id/re-run', asyncHandler(async (req: Request, res: Response) => {
  const reviewer = req.body.reviewer || 'Reviewer';
  const updated = await reEvaluateCase(req.params.id, reviewer);
  if (!updated) {
    return res.status(404).json({ error: 'Case not found' });
  }
  res.json(updated);
}));

// PATCH /api/cases/:id/fields/:fieldId - Human reviewer edits extracted field
api.patch('/api/cases/:id/fields/:fieldId', asyncHandler(async (req: Request, res: Response) => {
  const { reviewedValue, reviewerLabel } = req.body;
  const { id, fieldId } = req.params;

  if (typeof reviewedValue !== 'string') {
    return res.status(400).json({ error: 'reviewedValue string is required' });
  }

  const updatedPre = caseStore.update(id, (record) => {
    const fieldIndex = record.extracted_fields.findIndex((f) => f.field_id === fieldId);
    if (fieldIndex === -1) return record;

    const oldVal = record.extracted_fields[fieldIndex].reviewed_value ?? record.extracted_fields[fieldIndex].field_value;
    record.extracted_fields[fieldIndex].reviewed_value = reviewedValue;
    record.extracted_fields[fieldIndex].is_edited = true;
    record.extracted_fields[fieldIndex].is_uncertain = false;

    const audit: AuditEvent = {
      event_id: `evt-${id}-${Date.now()}`,
      case_id: id,
      event_type: 'FIELD_CORRECTED',
      actor: 'Human Reviewer',
      summary: `Field "${record.extracted_fields[fieldIndex].field_label}" corrected by ${reviewerLabel || 'Reviewer'}.`,
      details: `Previous: "${oldVal}" -> Revised: "${reviewedValue}"`,
      created_at: new Date().toISOString()
    };

    const action: ReviewAction = {
      action_id: `act-${id}-${Date.now()}`,
      case_id: id,
      reviewer_label: reviewerLabel || 'Reviewer',
      action: 'correct_field',
      notes: `Corrected "${record.extracted_fields[fieldIndex].field_label}" to "${reviewedValue}"`,
      created_at: new Date().toISOString()
    };

    record.audit_events.unshift(audit);
    record.review_actions.unshift(action);
    return record;
  });

  if (!updatedPre) {
    return res.status(404).json({ error: 'Case or field not found' });
  }

  // Automatically re-evaluate validation and routing with the corrected field!
  const finalUpdated = await reEvaluateCase(id, reviewerLabel || 'Human Reviewer');
  res.json(finalUpdated || updatedPre);
}));

// PATCH /api/cases/:id/findings/:findingId/resolve - Reviewer resolves or updates finding
api.patch('/api/cases/:id/findings/:findingId/resolve', asyncHandler(async (req: Request, res: Response) => {
  const { resolved, notes, reviewerLabel } = req.body;
  const { id, findingId } = req.params;

  const updatedPre = caseStore.update(id, (record) => {
    const finding = record.validation_findings.find((f) => f.finding_id === findingId);
    if (!finding) return record;

    finding.resolved = resolved !== undefined ? !!resolved : true;
    if (notes) finding.resolution_notes = notes;

    const audit: AuditEvent = {
      event_id: `evt-${id}-${Date.now()}`,
      case_id: id,
      event_type: 'FINDING_RESOLVED',
      actor: 'Human Reviewer',
      summary: `Finding "${finding.check_name}" marked as ${finding.resolved ? 'RESOLVED' : 'UNRESOLVED'} by ${reviewerLabel || 'Reviewer'}.`,
      details: notes ? `Notes: ${notes}` : undefined,
      created_at: new Date().toISOString()
    };

    const action: ReviewAction = {
      action_id: `act-${id}-${Date.now()}`,
      case_id: id,
      reviewer_label: reviewerLabel || 'Reviewer',
      action: 'resolve_finding',
      notes: `Finding "${finding.check_name}" resolved: ${notes || 'Verified by reviewer'}`,
      created_at: new Date().toISOString()
    };

    record.audit_events.unshift(audit);
    record.review_actions.unshift(action);
    return record;
  });

  if (!updatedPre) {
    return res.status(404).json({ error: 'Case or finding not found' });
  }

  const finalUpdated = await reEvaluateCase(id, reviewerLabel || 'Human Reviewer');
  res.json(finalUpdated || updatedPre);
}));

// POST /api/cases/:id/review-action - Human reviewer records formal action
api.patch('/api/cases/:id/review-action', (req: Request, res: Response) => {
  const { action, notes, reviewerLabel, newQueue, newStatus } = req.body;
  const { id } = req.params;

  if (!action) {
    return res.status(400).json({ error: 'Action is required' });
  }

  const updated = caseStore.update(id, (record) => {
    let summaryText = '';

    if (action === 'mark_complete') {
      record.status = 'Review Completed';
      summaryText = `Case review completed and finalized by ${reviewerLabel || 'Reviewer'}.`;
    } else if (action === 'request_info') {
      record.status = 'Needs More Information';
      record.assigned_queue = 'Missing Information';
      summaryText = `Human reviewer flagged case for additional information intake. Notes: ${notes || 'Information requested.'}`;
    } else if (action === 'escalate_priority') {
      record.status = 'Priority Review';
      record.assigned_queue = 'Priority Review';
      summaryText = `Case escalated to Priority Review queue by ${reviewerLabel || 'Reviewer'}.`;
    } else if (action === 'approve_ready') {
      record.status = 'Ready for Review';
      summaryText = `Case marked Ready for Review by ${reviewerLabel || 'Reviewer'}.`;
    }

    if (newQueue) {
      record.assigned_queue = newQueue;
    }
    if (newStatus) {
      record.status = newStatus;
    }

    const reviewAction: ReviewAction = {
      action_id: `act-${id}-${Date.now()}`,
      case_id: id,
      reviewer_label: reviewerLabel || 'Reviewer',
      action: action,
      notes: notes || summaryText,
      created_at: new Date().toISOString()
    };

    const audit: AuditEvent = {
      event_id: `evt-${id}-${Date.now()}`,
      case_id: id,
      event_type: action === 'mark_complete' ? 'REVIEW_COMPLETED' : 'QUEUE_TRANSFERRED',
      actor: 'Human Reviewer',
      summary: summaryText,
      details: notes,
      created_at: new Date().toISOString()
    };

    record.review_actions.unshift(reviewAction);
    record.audit_events.unshift(audit);
    return record;
  });

  if (!updated) {
    return res.status(404).json({ error: 'Case not found' });
  }

  res.json(updated);
});

// POST /api/cases/:id/generate-summary - Trigger Gemini summary generation
api.post('/api/cases/:id/generate-summary', asyncHandler(async (req: Request, res: Response) => {
  const caseItem = caseStore.getById(req.params.id);
  if (!caseItem) {
    return res.status(404).json({ error: 'Case not found' });
  }

  const summary = await generateExecutiveSummary(
    caseItem.document_type,
    caseItem.status,
    caseItem.assigned_queue,
    caseItem.validation_findings,
    caseItem.extracted_fields,
    caseItem.raw_text
  );

  const updated = caseStore.update(caseItem.case_id, (c) => ({
    ...c,
    executive_summary: summary
  }));

  res.json({ executive_summary: summary, case: updated });
}));

// GET /api/samples - Get all synthetic test scenarios
api.get('/api/samples', (req: Request, res: Response) => {
  res.json(SYNTHETIC_SCENARIOS);
});

// POST /api/samples/load/:scenarioId - 1-Click execute a synthetic scenario
api.post('/api/samples/load/:scenarioId', asyncHandler(async (req: Request, res: Response) => {
  const scenario = SYNTHETIC_SCENARIOS.find((s) => s.id === req.params.scenarioId);
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }

  const caseRecord = await runAgentPipeline({
    fileName: scenario.file_name,
    fileSizeKb: 280,
    fileMime: scenario.file_name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
    documentType: scenario.document_type,
    rawText: scenario.mock_text,
    crossReferenceFileName: scenario.cross_reference_file,
    crossReferenceText: scenario.cross_reference_text,
    isUnreadable: scenario.is_unreadable,
    manualFields: Object.fromEntries(
      Object.entries(scenario.mock_fields).map(([k, v]) => [k, v.value])
    )
  });

  res.status(201).json(caseRecord);
}));

// POST /api/cases/reset-seed - Reset demo dataset to original seed
api.post('/api/cases/reset-seed', (req: Request, res: Response) => {
  caseStore.reset();
  res.json({ message: 'Store reset to pristine initial state', cases: caseStore.getAll() });
});

// DELETE /api/cases/:id - Delete a case
api.delete('/api/cases/:id', (req: Request, res: Response) => {
  const deleted = caseStore.delete(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Case not found' });
  }
  res.json({ success: true, message: `Case ${req.params.id} deleted` });
});

// GET /api/storage-info - Returns persistent storage status
api.get('/api/storage-info', (req: Request, res: Response) => {
  res.json(caseStore.getStorageInfo());
});

export default api;
