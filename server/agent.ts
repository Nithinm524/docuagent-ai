/**
 * DOCUAGENT AI — Document Extraction and Review Agent
 * File: server/agent.ts
 */

import { GoogleGenAI } from '@google/genai';
import {
  CaseRecord,
  DocumentType,
  ExtractedField,
  ValidationFinding,
  AuditEvent,
  AgentStepTrace
} from '../src/shared/types.ts';
import {
  DOCUMENT_SCHEMAS,
  detectDocumentType,
  runValidationChecks,
  evaluateAndRoute,
  buildAgentTrace,
  generateNeutralSummary
} from '../src/shared/validation.ts';
import { caseStore } from './store.ts';
import { usageTracker } from './usageTracker.ts';
import { validateUploadFile, sanitizeFileName } from './fileValidation.ts';
import { log } from './logger.ts';

type UploadInput = {
  fileName: string;
  fileSizeKb: number;
  fileMime: string;
  documentType?: string;
  rawText?: string;
  fileDataUrl?: string;
  crossReferenceFileName?: string;
  crossReferenceText?: string;
  isUnreadable?: boolean;
  manualFields?: Record<string, unknown>;
  consentRecord?: CaseRecord['consent_record'];
};

type StageCallback = (detail: {
  stage: string;
  message: string;
  detail?: Record<string, unknown>;
}) => void;

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return null;
  }

  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }

  return client;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function decodeDataUrl(dataUrl: string): {
  mimeType: string;
  base64: string;
} | null {
  const match = dataUrl.match(
    /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,([\s\S]+)$/i
  );

  if (!match) return null;

  return {
    mimeType: (match[1] || 'application/octet-stream').toLowerCase(),
    base64: match[2].replace(/\s/g, '')
  };
}

function normalizeMimeType(mime: string, fileName: string): string {
  const normalized = (mime || '').toLowerCase().split(';')[0].trim();

  if (normalized === 'application/pdf') return normalized;
  if (normalized === 'image/png') return normalized;
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') {
    return 'image/jpeg';
  }

  const extension = fileName.toLowerCase().split('.').pop();

  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';

  return normalized || 'application/octet-stream';
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // The model may have wrapped JSON in Markdown.
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');

  if (start < 0 || end <= start) return null;

  try {
    const parsed: unknown = JSON.parse(trimmed.slice(start, end + 1));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function safeDocumentType(value: unknown): DocumentType {
  const allowed: DocumentType[] = [
    'passport',
    'national_id',
    'utility_bill',
    'bank_statement',
    'employment_verification',
    'invoice',
    'general_doc',
    'unknown'
  ];

  if (typeof value !== 'string') return 'unknown';

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (allowed.includes(normalized as DocumentType)) {
    return normalized as DocumentType;
  }

  const aliases: Record<string, DocumentType> = {
    id: 'national_id',
    identity_card: 'national_id',
    national_identity_card: 'national_id',
    aadhaar: 'national_id',
    aadhar: 'national_id',
    passport_document: 'passport',
    bill: 'utility_bill',
    electricity_bill: 'utility_bill',
    bank: 'bank_statement',
    payslip: 'employment_verification',
    salary_slip: 'employment_verification',
    work_letter: 'employment_verification',
    general: 'general_doc',
    other: 'general_doc'
  };

  return aliases[normalized] || 'unknown';
}

function inferDocumentType(text: string): DocumentType {
  const value = text.toLowerCase();

  if (
    value.includes('passport') ||
    value.includes('passport no') ||
    value.includes('passport number')
  ) {
    return 'passport';
  }

  if (
    value.includes('aadhaar') ||
    value.includes('aadhar') ||
    value.includes('national identity') ||
    value.includes('national id') ||
    value.includes('identity card')
  ) {
    return 'national_id';
  }

  if (
    value.includes('utility bill') ||
    value.includes('electricity bill') ||
    value.includes('water bill') ||
    value.includes('gas bill') ||
    value.includes('consumer number')
  ) {
    return 'utility_bill';
  }

  if (
    value.includes('bank statement') ||
    value.includes('account number') ||
    value.includes('statement period') ||
    value.includes('available balance')
  ) {
    return 'bank_statement';
  }

  if (
    value.includes('employment verification') ||
    value.includes('employment certificate') ||
    value.includes('salary slip') ||
    value.includes('payslip') ||
    value.includes('designation')
  ) {
    return 'employment_verification';
  }

  if (
    value.includes('invoice') ||
    value.includes('invoice number') ||
    value.includes('amount due') ||
    value.includes('bill to')
  ) {
    return 'invoice';
  }

  if (value.length > 30) return 'general_doc';

  return 'unknown';
}

function parseExtractedFields(
  caseId: string,
  object: Record<string, unknown>
): ExtractedField[] {
  const source = object.fields;

  if (!Array.isArray(source)) return [];

  const fields: ExtractedField[] = [];

  for (const item of source) {
    if (!item || typeof item !== 'object') continue;

    const field = item as Record<string, unknown>;
    const name = cleanText(field.name || field.field_name || field.key);
    const label = cleanText(field.label || field.field_label || name);
    const value = cleanText(field.value);

    if (!name || !value) continue;

    const confidenceValue = Number(field.confidence ?? 0.7);
    const confidence = Number.isFinite(confidenceValue)
      ? Math.min(1, Math.max(0, confidenceValue))
      : 0.7;

    fields.push({
      field_id: newId('field'),
      case_id: caseId,
      field_name: name,
      field_label: label || name,
      field_value: value,
      confidence,
      is_uncertain: confidence < 0.65,
      is_edited: false
    });
  }

  return fields;
}

function extractFieldsWithoutAI(
  caseId: string,
  text: string
): ExtractedField[] {
  const fields: ExtractedField[] = [];
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9 _./()-]{1,45})\s*[:\-]\s*(.{1,250})$/);

    if (!match) continue;

    const name = match[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const value = match[2].trim();

    if (!name || !value) continue;

    fields.push({
      field_id: newId('field'),
      case_id: caseId,
      field_name: name,
      field_label: match[1].trim(),
      field_value: value,
      confidence: 0.55,
      is_uncertain: true,
      is_edited: false
    });
  }

  return fields.slice(0, 100);
}

async function extractTextWithGemini(
  fileDataUrl: string,
  fileName: string,
  fileMime: string,
  suppliedText = ''
): Promise<{
  text: string;
  documentType: DocumentType;
  fields: Record<string, unknown>;
  method: string;
}> {
  const existingText = cleanText(suppliedText);

  if (existingText.length > 20) {
    return {
      text: existingText,
      documentType: inferDocumentType(existingText),
      fields: {},
      method: 'Provided Text'
    };
  }

  const parsed = decodeDataUrl(fileDataUrl);

  if (!parsed) {
    return {
      text: '',
      documentType: 'unknown',
      fields: {},
      method: 'No Valid File Data'
    };
  }

  const ai = getGeminiClient();

  if (!ai) {
    return {
      text: '',
      documentType: 'unknown',
      fields: {},
      method: 'Gemini API Key Missing'
    };
  }

  const mimeType = normalizeMimeType(parsed.mimeType || fileMime, fileName);

  if (!['application/pdf', 'image/png', 'image/jpeg'].includes(mimeType)) {
    return {
      text: '',
      documentType: 'unknown',
      fields: {},
      method: 'Unsupported MIME Type'
    };
  }

  try {
    const prompt = `
You are a document text extraction engine.

Read the attached document carefully. Extract all readable text, preserving
important labels, values, dates, amounts, identifiers, and line breaks.

Do not invent missing information. If a value cannot be read, leave it blank.
Do not decide whether the document is genuine or fraudulent.

Return ONLY valid JSON using this structure:
{
  "documentType": "passport | national_id | utility_bill | bank_statement | employment_verification | invoice | general_doc | unknown",
  "text": "all readable text from the document",
  "fields": [
    {
      "name": "field_name",
      "label": "Human-readable label",
      "value": "exact extracted value",
      "confidence": 0.0
    }
  ]
}

File name: ${fileName}
`;

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: parsed.base64
              }
            }
          ]
        }
      ],
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    });

    const responseText = cleanText(response.text || '');
    const result = extractJsonObject(responseText);

    if (!result) {
      return {
        text: responseText,
        documentType: inferDocumentType(responseText),
        fields: {},
        method: 'Gemini Text Extraction'
      };
    }

    const extractedText = cleanText(result.text);
    const fields: Record<string, unknown> = {
      fields: Array.isArray(result.fields) ? result.fields : []
    };

    return {
      text: extractedText,
      documentType: safeDocumentType(result.documentType) === 'unknown'
        ? inferDocumentType(extractedText)
        : safeDocumentType(result.documentType),
      fields,
      method: 'Gemini Multimodal Extraction'
    };
  } catch (error) {
    log.error(
      'Gemini document extraction failed',
      error instanceof Error ? error.message : String(error)
    );

    return {
      text: '',
      documentType: 'unknown',
      fields: {},
      method: 'Gemini Extraction Failed'
    };
  }
}

function buildFinding(
  caseId: string,
  checkName: string,
  explanation: string,
  severity: ValidationFinding['severity'] = 'medium'
): ValidationFinding {
  return {
    finding_id: newId('finding'),
    case_id: caseId,
    check_name: checkName,
    category: 'missing_information',
    result: 'warning',
    severity,
    explanation,
    resolved: false
  };
}

function makeAudit(
  caseId: string,
  eventType: AuditEvent['event_type'],
  summary: string,
  details?: string
): AuditEvent {
  return {
    event_id: newId('event'),
    case_id: caseId,
    event_type: eventType,
    actor: 'AI Agent',
    summary,
    details,
    created_at: new Date().toISOString()
  };
}

function createTrace(
  toolName: string,
  purpose: string,
  status: AgentStepTrace['status'],
  output: string,
  duration = 0
): AgentStepTrace {
  return {
    step_number: 0,
    tool_name: toolName,
    tool_purpose: purpose,
    status,
    duration_ms: duration,
    output_summary: output
  };
}

function summarizeCase(
  documentType: DocumentType,
  status: CaseRecord['status'],
  queue: CaseRecord['assigned_queue'],
  findings: ValidationFinding[],
  fields: ExtractedField[],
  rawText: string
): string {
  try {
    const summary = generateNeutralSummary(
      documentType,
      status,
      queue,
      findings,
      fields,
      rawText
    );

    if (typeof summary === 'string' && summary.trim()) {
      return summary;
    }
  } catch (error) {
    log.warn(
      'Neutral summary generation failed',
      error instanceof Error ? error.message : String(error)
    );
  }

  const textPreview = rawText.trim().slice(0, 300);

  return [
    `Document type: ${documentType}.`,
    `Current status: ${status}.`,
    `Assigned queue: ${queue}.`,
    `Extracted fields: ${fields.length}.`,
    `Validation findings: ${findings.length}.`,
    textPreview ? `Extracted text preview: ${textPreview}` : 'No readable text was extracted.',
    'A human reviewer must make the final decision.'
  ].join(' ');
}

export async function generateExecutiveSummary(
  documentType: DocumentType,
  status: CaseRecord['status'],
  queue: CaseRecord['assigned_queue'],
  findings: ValidationFinding[],
  fields: ExtractedField[],
  rawText?: string
): Promise<string> {
  return summarizeCase(
    documentType,
    status,
    queue,
    findings,
    fields,
    rawText || ''
  );
}

export async function runAgentPipeline(
  input: UploadInput,
  onStage?: StageCallback
): Promise<CaseRecord> {
  const emit = (
    stage: string,
    message: string,
    detail?: Record<string, unknown>
  ) => {
    try {
      onStage?.({ stage, message, detail });
    } catch {
      // A disconnected client must not crash document processing.
    }
  };

  const started = Date.now();
  const caseId = newId('case');
  const now = new Date().toISOString();
  const safeName = sanitizeFileName(input.fileName || 'document.pdf');
  const fileMime = normalizeMimeType(input.fileMime || '', safeName);
  const fileSizeKb = Math.max(0, Number(input.fileSizeKb) || 0);

  const base: CaseRecord = {
    case_id: caseId,
    case_number: `DOC-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`,
    version: 1,
    document_type: 'unknown',
    file_name: safeName,
    file_size_kb: fileSizeKb,
    file_mime: fileMime,
    file_data_url: input.fileDataUrl,
    raw_text: '',
    cross_reference_file_name: input.crossReferenceFileName,
    cross_reference_text: input.crossReferenceText,
    is_selectable_pdf: false,
    extraction_method: 'Not Started',
    classification_reason: 'Document has not been classified.',
    created_at: now,
    updated_at: now,
    status: 'Processing',
    assigned_queue: 'General Review',
    routing_reason: 'Document is being processed.',
    extracted_fields: [],
    validation_findings: [],
    review_actions: [],
    audit_events: [],
    agent_trace: [],
    consent_record: input.consentRecord
  };

  const validation = validateUploadFile({
    fileName: safeName,
    fileDataUrl: input.fileDataUrl,
    fileMime,
    fileSizeKb
  });

  if (!validation.valid) {
    const failed: CaseRecord = {
      ...base,
      status: 'Processing Failed',
      processing_error: validation.error || 'File validation failed.',
      routing_reason: 'The uploaded file did not pass file validation.',
      audit_events: [
        makeAudit(
          caseId,
          'OCR_EXTRACTION_FAILED',
          'File validation failed.',
          validation.error
        )
      ],
      agent_trace: [
        createTrace(
          'File Validation',
          'Validate uploaded file type and size',
          'failed',
          validation.error || 'File validation failed.'
        )
      ]
    };

    caseStore.create(failed);
    emit('failed', 'File validation failed', { error: failed.processing_error });
    return failed;
  }

  emit('extracting', 'Extracting document text');

  const extraction = await extractTextWithGemini(
    input.fileDataUrl || '',
    safeName,
    fileMime,
    input.rawText || ''
  );

  let rawText = cleanText(input.rawText) || cleanText(extraction.text);
  let documentType: DocumentType;

  const requestedType = safeDocumentType(input.documentType);

  if (input.documentType && input.documentType !== 'auto' && requestedType !== 'unknown') {
    documentType = requestedType;
  } else if (extraction.documentType !== 'unknown') {
    documentType = extraction.documentType;
  } else {
    try {
      documentType = safeDocumentType(detectDocumentType(rawText));
    } catch {
      documentType = inferDocumentType(rawText);
    }
  }

  if (documentType === 'unknown') {
    documentType = inferDocumentType(rawText);
  }

  if (!rawText && input.isUnreadable) {
    rawText = '';
  }

  emit('classifying', 'Classifying document', {
    documentType,
    extractionMethod: extraction.method
  });

  let extractedFields = parseExtractedFields(caseId, extraction.fields);

  if (extractedFields.length === 0 && rawText) {
    extractedFields = extractFieldsWithoutAI(caseId, rawText);
  }

  if (input.manualFields && typeof input.manualFields === 'object') {
    for (const [key, rawValue] of Object.entries(input.manualFields)) {
      const value = cleanText(rawValue);
      if (!value) continue;

      const existing = extractedFields.find(
        (field) => field.field_name.toLowerCase() === key.toLowerCase()
      );

      if (existing) {
        existing.field_value = value;
        existing.confidence = 1;
        existing.is_uncertain = false;
        existing.is_edited = true;
        existing.reviewed_value = value;
      } else {
        extractedFields.push({
          field_id: newId('field'),
          case_id: caseId,
          field_name: key,
          field_label: key.replace(/_/g, ' '),
          field_value: value,
          confidence: 1,
          is_uncertain: false,
          is_edited: true,
          reviewed_value: value
        });
      }
    }
  }

  emit('validating', 'Running document validation');

  let findings: ValidationFinding[] = [];

  try {
    findings = runValidationChecks(
      documentType,
      extractedFields,
      rawText
    ) || [];
  } catch (error) {
    log.error(
      'Validation engine failed',
      error instanceof Error ? error.message : String(error)
    );

    findings = [
      buildFinding(
        caseId,
        'Validation Engine',
        'Automatic validation could not complete. Human review is required.',
        'high'
      )
    ];
  }

  findings = findings.map((finding) => ({
    ...finding,
    case_id: caseId,
    finding_id: finding.finding_id || newId('finding')
  }));

  if (!rawText) {
    findings.push(
      buildFinding(
        caseId,
        'Text Extraction',
        'No readable text was extracted. Try a clearer scan or a text-based PDF.',
        'high'
      )
    );
  }

  if (documentType === 'unknown') {
    findings.push(
      buildFinding(
        caseId,
        'Document Type Classification',
        'The document could not be classified automatically. A human reviewer must determine its type.',
        'medium'
      )
    );
  }

  let decision: {
    status: CaseRecord['status'];
    assignedQueue: CaseRecord['assigned_queue'];
    routingReason: string;
  };

  try {
    decision = evaluateAndRoute(
      findings,
      Boolean(!rawText || documentType === 'unknown')
    );
  } catch {
    decision = {
      status: 'Needs More Information',
      assignedQueue: 'Missing Information',
      routingReason: 'Automatic routing could not finish; manual review is required.'
    };
  }

  if (!rawText || documentType === 'unknown') {
    decision = {
      status: 'Needs More Information',
      assignedQueue: 'Missing Information',
      routingReason: !rawText
        ? 'No usable text was extracted. Request a clearer or supported document file.'
        : 'Document type is uncertain and requires human classification.'
    };
  }

  const trace: AgentStepTrace[] = [
    createTrace(
      'File Validation',
      'Check file extension, size and signature',
      'completed',
      'File passed initial validation.'
    ),
    createTrace(
      'Multimodal Text Extraction',
      'Read text from the uploaded PDF or image',
      rawText ? 'completed' : 'failed',
      rawText
        ? `Extracted ${rawText.length} characters using ${extraction.method}.`,
        Date.now() - started
      : `No readable text returned. Method: ${extraction.method}.`,
      Date.now() - started
    ),
    createTrace(
      'Document Classification',
      'Identify the likely document category',
      documentType === 'unknown' ? 'failed' : 'completed',
      `Detected type: ${documentType}.`
    ),
    createTrace(
      'Schema Field Extraction',
      'Extract structured fields from document content',
      extractedFields.length ? 'completed' : 'failed',
      `${extractedFields.length} field(s) extracted.`
    ),
    createTrace(
      'Validation Engine',
      'Check extracted data for missing information',
      'completed',
      `${findings.length} finding(s) generated.`
    ),
    createTrace(
      'Decision and Routing',
      'Route the case to the appropriate review queue',
      'completed',
      decision.routingReason
    )
  ].map((item, index) => ({ ...item, step_number: index + 1 }));

  let summary = summarizeCase(
    documentType,
    decision.status,
    decision.assignedQueue,
    findings,
    extractedFields,
    rawText
  );

  const record: CaseRecord = {
    ...base,
    document_type: documentType,
    detected_document_type: documentType,
    raw_text: rawText,
    extraction_method: extraction.method,
    classification_reason: documentType === 'unknown'
      ? 'The extracted content did not provide enough evidence for automatic classification.'
      : `Classification was based on extracted text and document patterns.`,
    status: decision.status,
    assigned_queue: decision.assignedQueue,
    routing_reason: decision.routingReason,
    executive_summary: summary,
    extracted_fields: extractedFields,
    validation_findings: findings,
    audit_events: [
      makeAudit(caseId, 'CASE_CREATED', 'Document case created.'),
      makeAudit(
        caseId,
        rawText ? 'TEXT_EXTRACTED' : 'OCR_EXTRACTION_FAILED',
        rawText ? 'Document text extracted.' : 'No readable document text extracted.',
        `${extraction.method}; ${rawText.length} characters.`
      ),
      makeAudit(
        caseId,
        'DOCUMENT_TYPE_DETECTED',
        `Document type: ${documentType}.`,
        recordClassificationReason(documentType)
      ),
      makeAudit(
        caseId,
        'VALIDATION_RUN',
        'Document validation completed.',
        `${findings.length} validation finding(s).`
      ),
      makeAudit(
        caseId,
        'ROUTING_DECIDED',
        `Case routed to ${decision.assignedQueue}.`,
        decision.routingReason
      )
    ],
    agent_trace: trace,
    updated_at: new Date().toISOString()
  };

  try {
    caseStore.create(record);
  } catch (error) {
    log.error(
      'Failed to persist case',
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }

  emit('complete', 'Document processing complete', {
    caseId,
    documentType,
    status: record.status,
    assignedQueue: record.assigned_queue,
    extractedFields: record.extracted_fields.length
  });

  return record;
}

function recordClassificationReason(type: DocumentType): string {
  return type === 'unknown'
    ? 'Classification confidence was insufficient.'
    : `Document content matched the ${type} category.`;
}

export async function reEvaluateCase(
  caseId: string,
  reviewerLabel = 'Reviewer'
): Promise<CaseRecord | undefined> {
  const existing = caseStore.get(caseId);

  if (!existing) return undefined;

  let findings = existing.validation_findings || [];

  try {
    findings = runValidationChecks(
      existing.document_type,
      existing.extracted_fields,
      existing.raw_text || ''
    ) || [];
  } catch (error) {
    log.error(
      'Re-evaluation validation failed',
      error instanceof Error ? error.message : String(error)
    );
  }

  if (!existing.raw_text?.trim()) {
    findings.push(
      buildFinding(
        caseId,
        'Text Extraction',
        'No readable text was extracted. Human review is required.',
        'high'
      )
    );
  }

  if (existing.document_type === 'unknown') {
    findings.push(
      buildFinding(
        caseId,
        'Document Type Classification',
        'The document type remains unknown and requires manual classification.'
      )
    );
  }

  let decision: {
    status: CaseRecord['status'];
    assignedQueue: CaseRecord['assigned_queue'];
    routingReason: string;
  };

  try {
    decision = evaluateAndRoute(
      findings,
      Boolean(existing.processing_error || !existing.raw_text?.trim())
    );
  } catch {
    decision = {
      status: 'Needs More Information',
      assignedQueue: 'Missing Information',
      routingReason: 'Manual review is required because automated re-evaluation failed.'
    };
  }

  const summary = summarizeCase(
    existing.document_type,
    decision.status,
    decision.assignedQueue,
    findings,
    existing.extracted_fields,
    existing.raw_text || ''
  );

  const updatedTrace = [
    ...(existing.agent_trace || []),
    createTrace(
      'Manual Re-evaluation',
      `Re-evaluate case requested by ${reviewerLabel}`,
      'completed',
      `Status: ${decision.status}; queue: ${decision.assignedQueue}.`
    )
  ].map((item, index) => ({ ...item, step_number: index + 1 }));

  return caseStore.update(caseId, (current) => {
    const audit = makeAudit(
      caseId,
      'AGENT_RE_EVALUATED',
      `Case re-evaluated by ${reviewerLabel}.`,
      `Status: ${decision.status}; queue: ${decision.assignedQueue}.`
    );

    return {
      ...current,
      status: decision.status,
      assigned_queue: decision.assignedQueue,
      routing_reason: decision.routingReason,
      validation_findings: findings,
      executive_summary: summary,
      agent_trace: updatedTrace,
      audit_events: [audit, ...(current.audit_events || [])],
      updated_at: new Date().toISOString(),
      version: (current.version || 0) + 1
    };
  });
}
