/**
 * Agent Orchestration Engine
 * DOCUAGENT AI Document Intelligence Platform
 *
 * Implements multi-step agent workflow:
 * 1. Goal Identification & File Ingestion
 * 2. Tool Selection: Multimodal Gemini OCR & Text Extractor
 * 3. Tool Selection: Structured Schema Field Extractor
 * 4. Tool Selection: Deterministic Rule Validation Engine
 * 5. Tool Selection: Decision Matrix & Queue Router
 * 6. Tool Selection: LLM Neutral Executive Summary (Gemini 3.8 Flash)
 * 7. Tool Selection: Audit Persistence
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

// Gemini AI client initialization using official @google/genai pattern
let genAIClient: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    genAIClient = new GoogleGenAI();
  }
} catch (e) {
  console.warn('Gemini client initialization notice (will use deterministic fallback):', e);
}

export interface ProcessDocumentOptions {
  fileName: string;
  fileSizeKb: number;
  fileMime: string;
  documentType: DocumentType | 'auto';
  rawText?: string;
  fileDataUrl?: string;
  crossReferenceFileName?: string;
  crossReferenceText?: string;
  isUnreadable?: boolean;
  manualFields?: Record<string, string>;
}

/**
 * Real Multimodal Document OCR & Structured Extraction via Gemini 3.8 Flash
 */
async function extractDocumentWithGemini(
  documentType: DocumentType,
  fileMime: string,
  fileDataUrl: string
): Promise<{
  rawText: string;
  fields: Record<string, { value: string; confidence: number }>;
  isUnreadable: boolean;
  unreadableReason?: string;
} | null> {
  if (!genAIClient || !process.env.GEMINI_API_KEY) return null;

  try {
    const base64Data = fileDataUrl.includes('base64,')
      ? fileDataUrl.split('base64,')[1]
      : fileDataUrl;

    const schema = DOCUMENT_SCHEMAS[documentType];
    const prompt = `You are an automated document review and OCR extraction engine for enterprise intake.
Analyze this submitted document (${schema.title}).

Required Tasks:
1. Quality Check: Check if the document is unreadable, blurred, corrupted, or blank. If so, set "is_unreadable": true.
2. Full Text: Extract all legible printed or handwritten text tokens into "raw_text".
3. Field Extraction: Extract the following schema fields:
${schema.fields.map((f) => `- ${f.name} ("${f.label}", type: ${f.type}, required: ${f.required})`).join('\n')}

For each field, return the exact value found in the document and a confidence score between 0.0 and 1.0. If absent, set value to "" and confidence to 0.0.

Return valid JSON strictly matching this schema:
{
  "is_unreadable": boolean,
  "unreadable_reason": string,
  "raw_text": string,
  "fields": {
    "field_name": { "value": "extracted text", "confidence": 0.95 }
  }
}`;

    const validMime =
      fileMime.startsWith('image/') || fileMime === 'application/pdf'
        ? fileMime
        : 'image/jpeg';

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini OCR request timeout')), 5000)
    );

    const callPromise = genAIClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType: validMime,
            data: base64Data
          }
        },
        { text: prompt }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const response = (await Promise.race([callPromise, timeoutPromise])) as any;

    const parsed = JSON.parse(response.text || '{}');
    return {
      rawText: parsed.raw_text || '',
      fields: parsed.fields || {},
      isUnreadable: !!parsed.is_unreadable,
      unreadableReason: parsed.unreadable_reason
    };
  } catch (err) {
    console.warn('Gemini multimodal OCR fallback:', err);
    return null;
  }
}

/**
 * Extracts selectable text from digital PDF binary stream
 */
export async function extractSelectablePdfText(fileDataUrl: string): Promise<{ text: string; pageCount: number } | null> {
  try {
    const base64Data = fileDataUrl.includes('base64,')
      ? fileDataUrl.split('base64,')[1]
      : fileDataUrl;
    const buffer = Buffer.from(base64Data, 'base64');
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    const cleanText = (parsed.text || '').replace(/-- \d+ of \d+ --/g, '').trim();
    if (cleanText.length >= 15) {
      return { text: cleanText, pageCount: parsed.total || 1 };
    }
  } catch (err) {
    console.warn('PDF selectable text extraction notice:', err);
  }
  return null;
}

/**
 * Fallback OCR using Tesseract for scanned documents and raster images
 */
export async function extractOcrWithTesseract(fileDataUrl: string): Promise<string | null> {
  // Only attempt Tesseract on raster image formats (PNG/JPEG)
  if (!fileDataUrl.startsWith('data:image/')) {
    return null;
  }
  try {
    const base64Data = fileDataUrl.includes('base64,')
      ? fileDataUrl.split('base64,')[1]
      : fileDataUrl;
    const buffer = Buffer.from(base64Data, 'base64');
    const Tesseract = await import('tesseract.js');
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Tesseract OCR timeout')), 4000)
    );
    const recognizePromise = Tesseract.recognize(buffer, 'eng');
    const res = (await Promise.race([recognizePromise, timeoutPromise])) as any;
    const text = res?.data?.text?.trim();
    if (text && text.length >= 10) {
      return text;
    }
  } catch (err) {
    console.warn('Tesseract OCR fallback notice:', err);
  }
  return null;
}

/**
 * Extracts structured fields from raw text stream (heuristic rule fallback)
 */
export function extractFieldsFromText(
  documentType: DocumentType,
  text: string,
  manualFields?: Record<string, string>
): ExtractedField[] {
  const schema = DOCUMENT_SCHEMAS[documentType];
  const fields: ExtractedField[] = [];
  const caseDummyId = 'temp';

  for (const def of schema.fields) {
    // If manual field provided, use it
    if (manualFields && manualFields[def.name] !== undefined) {
      const val = manualFields[def.name];
      fields.push({
        field_id: `fld-${def.name}`,
        case_id: caseDummyId,
        field_name: def.name,
        field_label: def.label,
        field_value: val,
        confidence: 0.95,
        is_uncertain: val.trim().length === 0 && def.required,
        is_edited: false
      });
      continue;
    }

    // Heuristic regex extraction from text lines
    let extractedValue = '';
    let confidence = 0.85;

    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    if (def.type === 'date') {
      const dateRegex = /\b(\d{4}[-/.]\d{2}[-/.]\d{2}|\d{2}[-/.]\d{2}[-/.]\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/i;
      for (const line of lines) {
        if (
          line.toLowerCase().includes(def.label.toLowerCase()) ||
          line.toLowerCase().includes(def.name.replace(/_/g, ' '))
        ) {
          const m = line.match(dateRegex);
          if (m) {
            extractedValue = m[0];
            confidence = 0.92;
            break;
          }
        }
      }
      if (!extractedValue) {
        for (const line of lines) {
          const m = line.match(dateRegex);
          if (m && !line.toLowerCase().includes('birth') && def.name.includes('expir')) {
            extractedValue = m[0];
            confidence = 0.72;
            break;
          }
        }
      }
      if (!extractedValue && def.name === 'document_date') {
        for (const line of lines) {
          const m = line.match(dateRegex);
          if (m) {
            extractedValue = m[0];
            confidence = 0.85;
            break;
          }
        }
      }
    } else if (def.type === 'identifier') {
      for (const line of lines) {
        if (
          line.toLowerCase().includes('no') ||
          line.toLowerCase().includes('number') ||
          line.toLowerCase().includes('id:') ||
          line.toLowerCase().includes('dl:')
        ) {
          const match = line.match(/[:#]?\s*([A-Z0-9-]{6,15})\b/i);
          if (match) {
            extractedValue = match[1];
            confidence = 0.94;
            break;
          }
        }
      }
    } else if (def.name.includes('name')) {
      for (const line of lines) {
        if (
          line.toLowerCase().includes('name:') ||
          line.toLowerCase().includes('surname:') ||
          line.toLowerCase().includes('customer:') ||
          line.toLowerCase().includes('given names:')
        ) {
          const parts = line.split(/[:]/);
          if (parts.length > 1) {
            extractedValue = parts[1].trim();
            confidence = 0.93;
            break;
          }
        }
      }
    } else if (def.name.includes('address')) {
      for (const line of lines) {
        if (
          line.toLowerCase().includes('address:') ||
          /\b(st|ave|blvd|rd|way|court|parkway)\b/i.test(line)
        ) {
          extractedValue = line.replace(/address:\s*/i, '').trim();
          confidence = 0.88;
          break;
        }
      }
    } else if (def.name === 'document_title') {
      for (const line of lines) {
        if (/^(title|subject|re|document|contract|agreement|report):/i.test(line)) {
          extractedValue = line.replace(/^(title|subject|re|document|contract|agreement|report):\s*/i, '').trim();
          confidence = 0.94;
          break;
        }
      }
      if (!extractedValue && lines.length > 0) {
        // First significant line
        extractedValue = lines[0].slice(0, 80).trim();
        confidence = 0.88;
      }
    } else if (def.name === 'author_or_organization') {
      for (const line of lines) {
        if (/^(author|organization|company|issued by|prepared by|party|client):/i.test(line)) {
          extractedValue = line.replace(/^(author|organization|company|issued by|prepared by|party|client):\s*/i, '').trim();
          confidence = 0.90;
          break;
        }
      }
    } else if (def.name === 'summary_topic') {
      for (const line of lines) {
        if (/^(summary|topic|purpose|scope|overview):/i.test(line)) {
          extractedValue = line.replace(/^(summary|topic|purpose|scope|overview):\s*/i, '').trim();
          confidence = 0.89;
          break;
        }
      }
      if (!extractedValue && lines.length > 1) {
        extractedValue = lines.slice(1, 3).join(' ').slice(0, 100).trim();
        confidence = 0.80;
      }
    } else if (def.name === 'detected_content') {
      extractedValue = text.slice(0, 200).trim();
      confidence = 0.50;
    }

    const isUncertain =
      (def.required && !extractedValue) ||
      (extractedValue ? (confidence < 0.75 || extractedValue.includes('??') || extractedValue.toLowerCase().includes('unreadable')) : false);

    fields.push({
      field_id: `fld-${def.name}`,
      case_id: caseDummyId,
      field_name: def.name,
      field_label: def.label,
      field_value: extractedValue,
      confidence: extractedValue ? confidence : (def.required ? 0.2 : 0.8),
      is_uncertain: isUncertain,
      is_edited: false
    });
  }

  return fields;
}

/**
 * Generates an LLM-powered neutral executive summary using Gemini 3.8 Flash,
 * falling back to the deterministic template if the API key is not configured.
 */
export async function generateExecutiveSummary(
  documentType: DocumentType,
  caseStatus: string,
  assignedQueue: string,
  findings: ValidationFinding[],
  fields: ExtractedField[],
  rawText?: string
): Promise<string> {
  const deterministicFallback = generateNeutralSummary(
    documentType,
    caseStatus as any,
    assignedQueue as any,
    findings,
    fields
  );

  if (!genAIClient || !process.env.GEMINI_API_KEY) {
    return deterministicFallback;
  }

  try {
    const prompt = `You are a neutral, highly disciplined enterprise Document Review and Screening Agent supporting a human reviewer in an intake workflow.
Document Type: ${DOCUMENT_SCHEMAS[documentType].title}
Current Workflow Status: ${caseStatus}
Assigned Reviewer Queue: ${assignedQueue}

Extracted Fields:
${fields.map((f) => `- ${f.field_label}: "${f.field_value || 'EMPTY'}" (Confidence: ${Math.round(f.confidence * 100)}%)`).join('\n')}

Validation Engine Findings:
${findings.map((f) => `- [${f.category}] Severity: ${f.severity.toUpperCase()}, Result: ${f.result.toUpperCase()} -> ${f.explanation}`).join('\n')}

Raw Document Excerpt:
${(rawText || '').slice(0, 1000)}

RESPONSIBLE AI RULES:
1. NEVER declare or imply that the document or person is fraudulent, forged, or criminal.
2. Use strictly neutral, objective screening terminology (e.g. "discrepancy detected", "unconfirmed format", "missing mandatory field", "recommended reviewer verification").
3. Explicitly state that this is an automated decision-support assessment and final disposition rests with human reviewers.
4. Keep the summary under 250 words, structured into:
   - Brief Ingestion & Disposition Summary
   - Key Deterministic Observations
   - Suggested Next Step for the Assigned Queue Reviewer
   - Responsible AI Transparency Disclaimer.`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini summary timeout')), 4000)
    );
    const callPromise = genAIClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt
    });
    const response = (await Promise.race([callPromise, timeoutPromise])) as any;

    const text = response.text?.trim();
    if (text && text.length > 50) {
      return text;
    }
  } catch (err) {
    console.warn('Gemini summary generation warning, falling back to deterministic synthesis:', err);
  }

  return deterministicFallback;
}

/**
 * Executes the full agent review and routing pipeline
 */
export async function runAgentPipeline(options: ProcessDocumentOptions): Promise<CaseRecord> {
  const caseId = `case-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const caseNumber = `DOC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  let rawText = options.rawText || '';
  let isUnreadable = !!options.isUnreadable;
  let isSelectablePdf = false;
  let ocrMethod = 'Automated Text Extractor';
  let multimodalFields: Record<string, { value: string; confidence: number }> | null = null;

  const isPdf = options.fileMime === 'application/pdf' || options.fileName.toLowerCase().endsWith('.pdf');

  // Step 1A: For PDFs, attempt selectable digital text extraction first!
  if (isPdf && options.fileDataUrl && !rawText) {
    const selectable = await extractSelectablePdfText(options.fileDataUrl);
    if (selectable && selectable.text.length >= 15) {
      rawText = selectable.text;
      isSelectablePdf = true;
      ocrMethod = 'Selectable PDF Text Parser';
    }
  }

  // Step 1B: If no selectable text (scanned PDF or image), use OCR
  if (!rawText && options.fileDataUrl && options.fileDataUrl.startsWith('data:')) {
    const targetType = options.documentType === 'auto' ? 'general_doc' : options.documentType;
    const aiResult = await extractDocumentWithGemini(
      targetType,
      options.fileMime,
      options.fileDataUrl
    );
    if (aiResult && aiResult.rawText && aiResult.rawText.trim().length >= 15) {
      rawText = aiResult.rawText;
      if (aiResult.isUnreadable) isUnreadable = true;
      multimodalFields = aiResult.fields;
      ocrMethod = isPdf ? 'Scanned PDF OCR (Gemini Multimodal)' : 'Gemini 3.8 Flash Multimodal OCR';
    } else {
      // Local Tesseract OCR fallback
      const tesseractText = await extractOcrWithTesseract(options.fileDataUrl);
      if (tesseractText && tesseractText.trim().length >= 10) {
        rawText = tesseractText;
        ocrMethod = isPdf ? 'Scanned PDF OCR (Tesseract)' : 'Tesseract Optical Character Recognition';
      }
    }
  }

  if (rawText && !isSelectablePdf && !ocrMethod.includes('OCR')) {
    ocrMethod = isPdf ? 'Selectable PDF Text Parser' : 'Digital Text Parser';
  }

  // Step 2: Accurate Document Type Detection
  // Detect whether file is passport, national_id, bank_statement, utility_bill, general_doc, or unknown
  const detection = detectDocumentType(options.fileName, rawText, options.fileMime);
  let finalDocumentType: DocumentType;

  if (options.documentType === 'auto' || !options.documentType) {
    finalDocumentType = detection.documentType;
  } else if (options.documentType === 'passport' && detection.documentType !== 'passport') {
    // Prevent defaulting every PDF to passport!
    finalDocumentType = detection.documentType;
  } else {
    finalDocumentType = options.documentType;
  }

  const ocrFailed = isUnreadable || !rawText || rawText.startsWith('[NO OCR') || rawText.startsWith('[CORRUPTED');

  if (!rawText) {
    rawText = isUnreadable
      ? '[CORRUPTED SCAN: UNREADABLE MATRIX]'
      : `[NO OCR TEXT RECOVERED: File "${options.fileName}" contained no selectable digital text or legible OCR tokens. Manual data entry required.]`;
  }

  // Step 3: Field Extraction appropriate to detected document type
  let extractedFields: ExtractedField[] = [];
  const schema = DOCUMENT_SCHEMAS[finalDocumentType];

  if (!isUnreadable && !ocrFailed) {
    if (multimodalFields && Object.keys(multimodalFields).length > 0 && finalDocumentType === options.documentType) {
      for (const def of schema.fields) {
        const item = multimodalFields[def.name];
        const val = item ? item.value : '';
        const conf = item ? item.confidence : (def.required ? 0.2 : 0.85);
        const uncertain = def.required ? (!val || conf < 0.7) : false;

        extractedFields.push({
          field_id: `fld-${caseId}-${def.name}`,
          case_id: caseId,
          field_name: def.name,
          field_label: def.label,
          field_value: val,
          confidence: conf,
          is_uncertain: uncertain,
          is_edited: false
        });
      }
    } else {
      extractedFields = extractFieldsFromText(finalDocumentType, rawText, options.manualFields);
      for (const f of extractedFields) {
        f.case_id = caseId;
        f.field_id = `fld-${caseId}-${f.field_name}`;
      }
    }
  } else {
    // Empty fields for unreadable or failed OCR
    extractedFields = schema.fields.map((def) => ({
      field_id: `fld-${caseId}-${def.name}`,
      case_id: caseId,
      field_name: def.name,
      field_label: def.label,
      field_value: options.manualFields?.[def.name] || '',
      confidence: options.manualFields?.[def.name] ? 0.9 : 0.0,
      is_uncertain: !options.manualFields?.[def.name] && def.required,
      is_edited: false
    }));
  }

  // Step 4: Run Deterministic Validation Checks Appropriate to Document Type
  const findings: ValidationFinding[] = isUnreadable
    ? [
        {
          finding_id: `find-unreadable-${caseId}`,
          case_id: caseId,
          check_name: 'Raster Quality & Glyph Resolution',
          category: 'format_error',
          result: 'failed',
          severity: 'high',
          explanation: 'The submitted document scan is illegible or severely degraded. Automated token recognition failed to extract readable content.',
          evidence_reference: `File: ${options.fileName}`,
          resolved: false
        }
      ]
    : runValidationChecks(
        finalDocumentType,
        extractedFields,
        options.crossReferenceText
      );

  for (const finding of findings) {
    finding.case_id = caseId;
  }

  // Step 5: Decision Matrix & Routing
  const decision = evaluateAndRoute(findings, isUnreadable, finalDocumentType);

  // Step 6: Agent Step Trace
  const trace = buildAgentTrace(
    finalDocumentType,
    options.fileName,
    extractedFields.filter((f) => !!f.field_value).length,
    findings.length,
    decision,
    {
      isUnreadable,
      ocrFailed,
      ocrMethod
    }
  );

  // Step 7: Executive Summary (Gemini or deterministic)
  const executiveSummary = await generateExecutiveSummary(
    finalDocumentType,
    decision.status,
    decision.assignedQueue,
    findings,
    extractedFields,
    rawText
  );

  // Step 8: Audit Events
  const auditEvents: AuditEvent[] = [
    {
      event_id: `evt-${caseId}-1`,
      case_id: caseId,
      event_type: 'CASE_CREATED',
      actor: 'System',
      summary: `Document submitted: "${options.fileName}" (${options.fileSizeKb} KB). Assigned Case Number ${caseNumber}.`,
      details: `Initial Target: ${options.documentType}, MIME: ${options.fileMime}`,
      created_at: now
    },
    {
      event_id: `evt-${caseId}-dt`,
      case_id: caseId,
      event_type: 'DOCUMENT_TYPE_DETECTED',
      actor: 'AI Agent',
      summary: `Document classified as "${DOCUMENT_SCHEMAS[finalDocumentType].title}" (${Math.round(detection.confidence * 100)}% confidence).`,
      details: detection.reason,
      created_at: new Date(Date.now() + 100).toISOString()
    },
    {
      event_id: `evt-${caseId}-2`,
      case_id: caseId,
      event_type: ocrFailed ? 'OCR_EXTRACTION_FAILED' : 'TEXT_EXTRACTED',
      actor: 'AI Agent',
      summary: isUnreadable
        ? 'OCR text stream halted due to degraded raster quality.'
        : ocrFailed
        ? 'Automated extraction recovered 0 legible characters. Manual reviewer inspection required.'
        : `Extracted ${rawText.length} text characters using ${ocrMethod}. (Selectable PDF Text: ${isSelectablePdf ? 'YES' : 'NO'}).`,
      created_at: new Date(Date.now() + 200).toISOString()
    },
    {
      event_id: `evt-${caseId}-3`,
      case_id: caseId,
      event_type: ocrFailed ? 'SCHEMA_EXTRACTION_FAILED' : 'FIELDS_EXTRACTED',
      actor: 'AI Agent',
      summary: ocrFailed
        ? 'Schema extraction could not populate fields due to unrecovered text stream.'
        : `Extracted ${extractedFields.filter((f) => !!f.field_value).length} schema fields for ${DOCUMENT_SCHEMAS[finalDocumentType].title}.`,
      created_at: new Date(Date.now() + 400).toISOString()
    },
    {
      event_id: `evt-${caseId}-4`,
      case_id: caseId,
      event_type: 'VALIDATION_RUN',
      actor: 'AI Agent',
      summary: `Validation rules executed: ${findings.filter((f) => f.result !== 'passed').length} active flags generated.`,
      created_at: new Date(Date.now() + 600).toISOString()
    },
    {
      event_id: `evt-${caseId}-5`,
      case_id: caseId,
      event_type: 'ROUTING_DECIDED',
      actor: 'AI Agent',
      summary: `Case routed to "${decision.assignedQueue}" with status "${decision.status}".`,
      details: decision.routingReason,
      created_at: new Date(Date.now() + 800).toISOString()
    }
  ];

  const caseRecord: CaseRecord = {
    case_id: caseId,
    case_number: caseNumber,
    document_type: finalDocumentType,
    file_name: options.fileName,
    file_size_kb: options.fileSizeKb,
    file_mime: options.fileMime,
    file_data_url: options.fileDataUrl,
    raw_text: rawText,
    cross_reference_file_name: options.crossReferenceFileName,
    cross_reference_text: options.crossReferenceText,
    is_selectable_pdf: isSelectablePdf,
    extraction_method: ocrMethod,
    classification_reason: detection.reason,
    detected_document_type: detection.documentType,
    created_at: now,
    updated_at: now,
    status: decision.status,
    assigned_queue: decision.assignedQueue,
    routing_reason: decision.routingReason,
    executive_summary: executiveSummary,
    processing_error: isUnreadable ? 'Document raster glyphs unreadable' : undefined,
    extracted_fields: extractedFields,
    validation_findings: findings,
    review_actions: [],
    audit_events: auditEvents,
    agent_trace: trace
  };

  caseStore.add(caseRecord);
  return caseRecord;
}

/**
 * Re-evaluates an existing case (e.g. after a reviewer edits fields or resolves findings)
 */
export async function reEvaluateCase(caseId: string, reviewerLabel = 'Reviewer'): Promise<CaseRecord | undefined> {
  const existing = caseStore.getById(caseId);
  if (!existing) return undefined;

  const findings = runValidationChecks(
    existing.document_type,
    existing.extracted_fields,
    existing.cross_reference_text
  );

  // Preserve resolved states of existing findings if check matches
  for (const f of findings) {
    const prev = existing.validation_findings.find((pf) => pf.check_name === f.check_name);
    if (prev && prev.resolved) {
      f.resolved = true;
      f.resolution_notes = prev.resolution_notes;
    }
  }

  const decision = evaluateAndRoute(findings, !!existing.processing_error);

  const updatedTrace = buildAgentTrace(
    existing.document_type,
    existing.file_name,
    existing.extracted_fields.filter((f) => !!f.field_value).length,
    findings.length,
    decision,
    {
      isUnreadable: !!existing.processing_error,
      ocrFailed: !!existing.processing_error,
      ocrMethod: 'Human Verified & Re-evaluated'
    }
  );

  const summary = await generateExecutiveSummary(
    existing.document_type,
    decision.status,
    decision.assignedQueue,
    findings,
    existing.extracted_fields,
    existing.raw_text
  );

  return caseStore.update(caseId, (c) => {
    const audit: AuditEvent = {
      event_id: `evt-${caseId}-${Date.now()}`,
      case_id: caseId,
      event_type: 'AGENT_RE_EVALUATED',
      actor: 'AI Agent',
      summary: `Automated re-evaluation triggered by ${reviewerLabel}. Status: "${decision.status}", Queue: "${decision.assignedQueue}".`,
      details: decision.routingReason,
      created_at: new Date().toISOString()
    };

    return {
      ...c,
      status: decision.status,
      assigned_queue: decision.assignedQueue,
      routing_reason: decision.routingReason,
      validation_findings: findings,
      executive_summary: summary,
      agent_trace: updatedTrace,
      audit_events: [audit, ...c.audit_events]
    };
  });
}
