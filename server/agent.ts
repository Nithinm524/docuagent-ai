/**
 * Agent Orchestration Engine
 * DOCUAGENT AI Document Intelligence Platform
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

let genAIClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;

  if (!genAIClient) {
    try {
      genAIClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
      });
    } catch (error) {
      console.warn('Gemini client initialization failed:', error);
    }
  }

  return genAIClient;
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
  consentRecord?: {
    notice_version: string;
    timestamp: string;
    purpose: string;
    legal_basis:
      | 'consent'
      | 'legitimate_uses'
      | 'legal_obligation'
      | 'operator_assessment_pending';
    affirmative_action: boolean;
    user_declaration: boolean;
  };
}

type GeminiField = {
  value: string;
  confidence: number;
};

type GeminiResult = {
  rawText: string;
  fields: Record<string, GeminiField>;
  isUnreadable: boolean;
  unreadableReason?: string;
};

function resolveMime(
  fileMime: string,
  fileName: string,
  dataUrl?: string
): string {
  const dataUrlMime = dataUrl?.match(/^data:([^;,]+)/i)?.[1];

  if (dataUrlMime) return dataUrlMime;

  if (fileMime && fileMime !== 'application/octet-stream') {
    return fileMime;
  }

  const name = fileName.toLowerCase();

  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.tif') || name.endsWith('.tiff')) return 'image/tiff';

  return 'application/octet-stream';
}

function normalizeDataUrl(
  fileDataUrl: string | undefined,
  fileMime: string,
  fileName: string
): string | undefined {
  if (!fileDataUrl?.trim()) return undefined;

  const value = fileDataUrl.trim();

  if (value.startsWith('data:')) return value;

  const mime = resolveMime(fileMime, fileName);
  if (mime === 'application/octet-stream') return undefined;

  return `data:${mime};base64,${value.replace(/\s+/g, '')}`;
}

function getBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1).replace(/\s+/g, '') : dataUrl;
}

function normalizeGeminiFields(
  value: unknown
): Record<string, GeminiField> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, GeminiField> = {};

  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === 'string' || typeof item === 'number') {
      result[key] = {
        value: String(item).trim(),
        confidence: 0.7
      };
      continue;
    }

    if (!item || typeof item !== 'object') continue;

    const field = item as Record<string, unknown>;
    const fieldValue = field.value ?? field.text ?? '';
    const confidence = Number(field.confidence ?? 0.7);

    result[key] = {
      value:
        typeof fieldValue === 'string' || typeof fieldValue === 'number'
          ? String(fieldValue).trim()
          : '',
      confidence: Number.isFinite(confidence)
        ? Math.max(0, Math.min(1, confidence))
        : 0
    };
  }

  return result;
}

async function extractDocumentWithGemini(
  documentType: DocumentType,
  fileMime: string,
  fileDataUrl: string,
  fileName = 'document'
): Promise<GeminiResult | null> {
  const client = getGeminiClient();
  if (!client) return null;

  try {
    const normalized = normalizeDataUrl(fileDataUrl, fileMime, fileName);
    if (!normalized) return null;

    const mimeType = resolveMime(fileMime, fileName, normalized);
    const base64Data = getBase64(normalized);

    if (!base64Data || mimeType === 'application/octet-stream') {
      return null;
    }

    const schema = DOCUMENT_SCHEMAS[documentType];

    const prompt = `
You are a document OCR and structured extraction engine.

Document category: ${schema.title}

Read the entire uploaded document and extract every legible text value.
Do not invent missing values. Return empty strings for fields that are absent.
If the document is blank, corrupted, or unreadable, set is_unreadable to true.

Fields to extract:
${schema.fields
  .map(
    (field) =>
      `- ${field.name}; label: ${field.label}; type: ${field.type}; required: ${field.required}`
  )
  .join('\n')}

For invoices:
- Extract the vendor or supplier from the issuer section.
- Extract the customer from the Bill To or Billed To section.
- Extract invoice number only when it is explicitly labelled.
- Do not confuse invoice number with GSTIN, tax ID, phone number, purchase order,
  or company registration number.
- Extract invoice date and due date separately.
- Distinguish subtotal, tax, and final total.
- Preserve the currency and original value.

Return JSON only in this structure:
{
  "is_unreadable": false,
  "unreadable_reason": "",
  "raw_text": "all legible document text",
  "fields": {
    "field_name": {
      "value": "exact value",
      "confidence": 0.95
    }
  }
}
`;

    if (!usageTracker.isOperationAllowed().allowed) {
      return null;
    }

    const timeoutMs = Number.parseInt(
      process.env.AI_OCR_TIMEOUT_MS || '35000',
      10
    );

    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Gemini OCR timed out')),
          timeoutMs
        );
      });

      const request = client.models.generateContent({
        model: process.env.GEMINI_OCR_MODEL || 'gemini-2.5-flash',
        contents: [
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          },
          { text: prompt }
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });

      const response = await Promise.race([request, timeout]);

      usageTracker.recordCall(
        {
          promptTokens: response.usageMetadata?.promptTokenCount,
          completionTokens: response.usageMetadata?.candidatesTokenCount
        },
        true
      );

      const responseText = response.text?.trim();
      if (!responseText) return null;

      let parsed: Record<string, unknown>;

      try {
        parsed = JSON.parse(responseText);
      } catch {
        const match = responseText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('Gemini returned invalid JSON');
        parsed = JSON.parse(match[0]);
      }

      return {
        rawText:
          typeof parsed.raw_text === 'string' ? parsed.raw_text.trim() : '',
        fields: normalizeGeminiFields(parsed.fields),
        isUnreadable: parsed.is_unreadable === true,
        unreadableReason:
          typeof parsed.unreadable_reason === 'string'
            ? parsed.unreadable_reason
            : undefined
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (error: unknown) {
    usageTracker.recordCall(undefined, false);

    log({
      level: 'INFO',
      operation: 'GEMINI_OCR_FALLBACK',
      message: 'Gemini OCR failed; fallback extraction will be used',
      details: {
        reason: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    return null;
  }
}

export async function extractSelectablePdfText(
  fileDataUrl: string
): Promise<{ text: string; pageCount: number } | null> {
  try {
    const normalized = normalizeDataUrl(
      fileDataUrl,
      'application/pdf',
      'document.pdf'
    );

    if (!normalized) return null;

    const buffer = Buffer.from(getBase64(normalized), 'base64');
    if (!buffer.length) return null;

    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();

    const text = (result.text || '')
      .replace(/-- \d+ of \d+ --/g, '')
      .trim();

    return text.length >= 15
      ? { text, pageCount: result.total || 1 }
      : null;
  } catch (error) {
    console.warn('PDF text extraction failed:', error);
    return null;
  }
}

export async function extractOcrWithTesseract(
  fileDataUrl: string
): Promise<string | null> {
  if (!fileDataUrl.startsWith('data:image/')) return null;

  try {
    const buffer = Buffer.from(getBase64(fileDataUrl), 'base64');
    if (!buffer.length) return null;

    const tesseract = await import('tesseract.js');
    const recognize =
      (tesseract as any).recognize ||
      (tesseract as any).default?.recognize;

    if (typeof recognize !== 'function') return null;

    const result = await recognize(buffer, 'eng');
    const text = result?.data?.text?.trim();

    return text && text.length >= 10 ? text : null;
  } catch (error) {
    log({
      level: 'INFO',
      operation: 'TESSERACT_OCR_FALLBACK',
      message: 'Tesseract OCR failed',
      details: {
        reason: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    return null;
  }
}

export function extractFieldsFromText(
  documentType: DocumentType,
  text: string,
  manualFields?: Record<string, string>
): ExtractedField[] {
  const schema = DOCUMENT_SCHEMAS[documentType];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const normalize = (value: string) =>
    value.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();

  const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const findLabeledValue = (labels: string[]): string => {
    const sorted = [...labels].sort((a, b) => b.length - a.length);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const normalizedLine = normalize(line);

      for (const label of sorted) {
        const normalizedLabel = normalize(label);

        if (
          normalizedLine !== normalizedLabel &&
          !normalizedLine.startsWith(`${normalizedLabel}:`) &&
          !normalizedLine.startsWith(`${normalizedLabel} `) &&
          !normalizedLine.startsWith(`${normalizedLabel}-`) &&
          !normalizedLine.startsWith(`${normalizedLabel}#`)
        ) {
          continue;
        }

        const escaped = escapeRegExp(label);
        const match = line.match(
          new RegExp(`^\\s*${escaped}\\s*(?::|#|-)\\s*(.*?)\\s*$`, 'i')
        );

        if (match?.[1]?.trim()) return match[1].trim();

        const separated = line.match(
          new RegExp(`^\\s*${escaped}\\s+(.+?)\\s*$`, 'i')
        );

        if (separated?.[1]?.trim()) return separated[1].trim();

        if (normalizedLine === normalizedLabel && lines[i + 1]) {
          const nextLine = lines[i + 1];
          const nextNormalized = normalize(nextLine);

          const nextLooksLikeLabel = sorted.some((candidate) => {
            const candidateNormalized = normalize(candidate);
            return (
              nextNormalized === candidateNormalized ||
              nextNormalized.startsWith(`${candidateNormalized}:`) ||
              nextNormalized.startsWith(`${candidateNormalized} `)
            );
          });

          if (!nextLooksLikeLabel) return nextLine;
        }
      }
    }

    return '';
  };

  const findInvoiceNumber = (): string => {
    const patterns = [
      /\b(?:tax\s+)?invoice\s*(?:number|no\.?|#|id)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-\/._]*)/i,
      /\binv\s*(?:number|no\.?|#|id)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-\/._]*)/i
    ];

    for (const line of lines) {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match?.[1] && /\d/.test(match[1])) {
          return match[1].replace(/[.,;:]$/, '');
        }
      }
    }

    return '';
  };

  const findVendor = (): string => {
    const value = findLabeledValue([
      'supplier name',
      'supplier',
      'vendor name',
      'vendor',
      'seller name',
      'seller',
      'issued by',
      'from'
    ]);

    if (value) return value;

    const excluded = /^(invoice|tax invoice|invoice number|invoice no|date|due date|bill to|billed to|customer|total|subtotal|amount|description|quantity|qty|rate|gst|tax|phone|email|website)/i;

    for (const line of lines.slice(0, 8)) {
      if (excluded.test(line)) continue;
      if (/^[\d\s.,:/#\-]+$/.test(line)) continue;
      if (line.length >= 2 && line.length <= 100) return line;
    }

    return '';
  };

  const findAmount = (labels: string[]): string => {
    const value = findLabeledValue(labels);
    if (!value) return '';

    const match = value.match(
      /(?:₹|Rs\.?|INR|USD|\$|€|£)?\s*\d[\d,]*(?:\.\d{1,2})?/i
    );

    return match?.[0]?.trim() || value;
  };

  const findDate = (labels: string[]): string => {
    const value = findLabeledValue(labels);

    if (value) {
      const match = value.match(
        /\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/i
      );

      if (match) return match[0];
    }

    return '';
  };

  return schema.fields.map((definition) => {
    const manualValue = manualFields?.[definition.name];

    if (manualValue !== undefined) {
      return {
        field_id: `fld-${definition.name}`,
        case_id: 'temp',
        field_name: definition.name,
        field_label: definition.label,
        field_value: manualValue,
        confidence: manualValue.trim() ? 0.99 : 0,
        is_uncertain: Boolean(definition.required && !manualValue.trim()),
        is_edited: true
      };
    }

    const name = normalize(definition.name);
    const label = normalize(definition.label);
    const combined = `${name} ${label}`;
    let value = '';

    if (
      documentType === 'invoice' &&
      /invoice.*(number|no|id)|invoice #/.test(combined)
    ) {
      value = findInvoiceNumber();
    } else if (
      documentType === 'invoice' &&
      /(vendor|supplier|seller|issuer|company name)/.test(combined)
    ) {
      value = findVendor();
    } else if (
      documentType === 'invoice' &&
      /(billed to|bill to|customer|buyer|recipient|client)/.test(combined)
    ) {
      value = findLabeledValue([
        'billed to',
        'bill to',
        'customer name',
        'customer',
        'buyer',
        'recipient',
        'client'
      ]);
    } else if (
      documentType === 'invoice' &&
      /(invoice date|issue date|date issued)/.test(combined)
    ) {
      value = findDate(['invoice date', 'date of invoice', 'issue date']);
    } else if (
      documentType === 'invoice' &&
      /(due date|payment due)/.test(combined)
    ) {
      value = findDate(['due date', 'payment due', 'pay by']);
    } else if (
      documentType === 'invoice' &&
      /(grand total|total amount|invoice total|amount due|total due)/.test(combined)
    ) {
      value = findAmount([
        'grand total',
        'invoice total',
        'total due',
        'amount due',
        'total amount',
        'total'
      ]);
    } else {
      value = findLabeledValue([definition.label, definition.name.replace(/_/g, ' ')]);
    }

    return {
      field_id: `fld-${definition.name}`,
      case_id: 'temp',
      field_name: definition.name,
      field_label: definition.label,
      field_value: value,
      confidence: value ? 0.75 : 0,
      is_uncertain: Boolean(definition.required && !value),
      is_edited: false
    };
  });
}

function mapGeminiFields(
  documentType: DocumentType,
  aiFields: Record<string, GeminiField>,
  caseId: string,
  fallbackFields: ExtractedField[]
): ExtractedField[] {
  const schema = DOCUMENT_SCHEMAS[documentType];

  return schema.fields.map((definition) => {
    const normalizeKey = (value: string) =>
      value.toLowerCase().replace(/[^a-z0-9]/g, '');

    const expectedNames = [
      normalizeKey(definition.name),
      normalizeKey(definition.label)
    ];

    const found = Object.entries(aiFields).find(([key]) => {
      const normalized = normalizeKey(key);
      return expectedNames.includes(normalized);
    });

    const aiValue = found?.[1]?.value?.trim() || '';
    const fallback = fallbackFields.find(
      (field) => field.field_name === definition.name
    );

    const value = aiValue || fallback?.field_value || '';

    return {
      field_id: `fld-${caseId}-${definition.name}`,
      case_id: caseId,
      field_name: definition.name,
      field_label: definition.label,
      field_value: value,
      confidence: aiValue
        ? Math.max(0, Math.min(1, found?.[1]?.confidence ?? 0.7))
        : fallback?.confidence ?? 0,
      is_uncertain: Boolean(
        definition.required &&
        (!value || (aiValue && (found?.[1]?.confidence ?? 0) < 0.7))
      ),
      is_edited: false
    };
  });
}

export type PipelineStage =
  | 'uploaded'
  | 'scanning'
  | 'extracting'
  | 'analyzing'
  | 'validating'
  | 'ready';

export interface StageUpdateDetail {
  stage: PipelineStage;
  message: string;
  method?: 'pdf_text' | 'ocr';
  ocrMethodName?: string;
  subMessage?: string;
  documentType?: DocumentType;
}

export type StageUpdateCallback = (detail: StageUpdateDetail) => void;

export async function runAgentPipeline(
  options: ProcessDocumentOptions,
  onStageUpdate?: StageUpdateCallback
): Promise<CaseRecord> {
  const caseId = `case-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const caseNumber = `DOC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  const normalizedFileDataUrl = normalizeDataUrl(
    options.fileDataUrl,
    options.fileMime,
    options.fileName
  );

  let rawText = options.rawText?.trim() || '';
  let isUnreadable = Boolean(options.isUnreadable);
  let isSelectablePdf = false;
  let ocrMethod = 'Automated Text Extractor';
  let multimodalFields: Record<string, GeminiField> | null = null;

  const isPdf =
    resolveMime(options.fileMime, options.fileName, normalizedFileDataUrl) ===
    'application/pdf';

  onStageUpdate?.({
    stage: 'scanning',
    message: 'Preparing document and inspecting file structure...',
    subMessage: `Validating ${sanitizeFileName(options.fileName)} (${options.fileSizeKb} KB)`
  });

  const uploadValidation = validateUploadFile({
    fileName: options.fileName,
    fileSizeKb: options.fileSizeKb,
    fileMime: options.fileMime
  });

  if (!uploadValidation.valid) {
    log({
      level: 'WARN',
      operation: 'UPLOAD_VALIDATION_FAILED',
      message: uploadValidation.reason || 'Upload validation failed'
    });
  }

  if (isPdf && normalizedFileDataUrl && !rawText) {
    onStageUpdate?.({
      stage: 'extracting',
      method: 'pdf_text',
      message: 'Extracting selectable digital text from PDF...',
      ocrMethodName: 'Selectable PDF Text Parser'
    });

    const selectable = await extractSelectablePdfText(normalizedFileDataUrl);

    if (selectable?.text) {
      rawText = selectable.text;
      isSelectablePdf = true;
      ocrMethod = 'Selectable PDF Text Parser';
    }
  }

  if (
    (!rawText || rawText.length < 15) &&
    !isUnreadable &&
    normalizedFileDataUrl
  ) {
    onStageUpdate?.({
      stage: 'extracting',
      method: 'ocr',
      message: isPdf
        ? 'Running OCR on scanned PDF pages...'
        : 'Extracting text from document image...',
      ocrMethodName: 'Gemini Multimodal OCR'
    });

    const targetType =
      options.documentType === 'auto'
        ? ('general_doc' as DocumentType)
        : options.documentType;

    const result = await extractDocumentWithGemini(
      targetType,
      options.fileMime,
      normalizedFileDataUrl,
      options.fileName
    );

    if (result) {
      if (result.rawText.length >= 10) {
        rawText = result.rawText;
        ocrMethod = isPdf
          ? 'Scanned PDF OCR (Gemini Multimodal)'
          : 'Gemini Multimodal OCR';
      }

      if (Object.keys(result.fields).length) {
        multimodalFields = result.fields;
      }

      if (result.isUnreadable && !rawText) {
        isUnreadable = true;
      }
    }

    if (!rawText && !isPdf && normalizedFileDataUrl.startsWith('data:image/')) {
      const tesseractText = await extractOcrWithTesseract(normalizedFileDataUrl);

      if (tesseractText) {
        rawText = tesseractText;
        ocrMethod = 'Tesseract OCR';
      }
    }
  }

  const detection = detectDocumentType(
    options.fileName,
    rawText,
    options.fileMime
  );

  const finalDocumentType: DocumentType =
    options.documentType === 'auto'
      ? detection.documentType
      : options.documentType;

  const schema = DOCUMENT_SCHEMAS[finalDocumentType];

  if (normalizedFileDataUrl) {
    const hasTypedFields = Boolean(
      multimodalFields &&
      schema.fields.some((field) =>
        Object.prototype.hasOwnProperty.call(multimodalFields, field.name)
      )
    );

    if (!hasTypedFields || options.documentType === 'auto' || isSelectablePdf) {
      const typedResult = await extractDocumentWithGemini(
        finalDocumentType,
        options.fileMime,
        normalizedFileDataUrl,
        options.fileName
      );

      if (typedResult) {
        if (
          typedResult.rawText.length > rawText.length &&
          typedResult.rawText.length >= 10
        ) {
          rawText = typedResult.rawText;
          if (!isSelectablePdf) ocrMethod = 'Gemini Multimodal OCR';
        }

        if (Object.keys(typedResult.fields).length) {
          multimodalFields = typedResult.fields;
        }

        if (typedResult.isUnreadable && !rawText) {
          isUnreadable = true;
        }
      }
    }
  }

  onStageUpdate?.({
    stage: 'analyzing',
    message: 'Analyzing extracted information...',
    subMessage: 'Populating structured fields and confidence scores',
    documentType: finalDocumentType
  });

  const fallbackFields = extractFieldsFromText(
    finalDocumentType,
    rawText,
    options.manualFields
  );

  let extractedFields: ExtractedField[];

  if (multimodalFields && Object.keys(multimodalFields).length > 0) {
    extractedFields = mapGeminiFields(
      finalDocumentType,
      multimodalFields,
      caseId,
      fallbackFields
    );
  } else {
    extractedFields = fallbackFields.map((field) => ({
      ...field,
      field_id: `fld-${caseId}-${field.field_name}`,
      case_id: caseId
    }));
  }

  const hasExtractedFields = extractedFields.some(
    (field) => Boolean(field.field_value?.trim())
  );

  if (!rawText.trim() && !hasExtractedFields && !isUnreadable) {
    extractedFields = schema.fields.map((definition) => ({
      field_id: `fld-${caseId}-${definition.name}`,
      case_id: caseId,
      field_name: definition.name,
      field_label: definition.label,
      field_value: options.manualFields?.[definition.name] || '',
      confidence: options.manualFields?.[definition.name] ? 0.98 : 0,
      is_uncertain: Boolean(
        definition.required && !options.manualFields?.[definition.name]
      ),
      is_edited: Boolean(options.manualFields?.[definition.name])
    }));
  }

  onStageUpdate?.({
    stage: 'validating',
    message: 'Validating extracted information...',
    subMessage: 'Running deterministic validation rules'
  });

  const findings: ValidationFinding[] = isUnreadable
    ? [
        {
          finding_id: `find-unreadable-${caseId}`,
          case_id: caseId,
          check_name: 'Document Readability',
          category: 'format_error',
          result: 'failed',
          severity: 'high',
          explanation:
            'The document appears blank, corrupted, or unreadable. Manual review is required.',
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

  const decision = evaluateAndRoute(
    findings,
    isUnreadable,
    finalDocumentType
  );

  const trace = buildAgentTrace(
    finalDocumentType,
    options.fileName,
    extractedFields.filter((field) => Boolean(field.field_value)).length,
    findings.length,
    decision
  );

  const executiveSummary = generateNeutralSummary(
    finalDocumentType,
    decision.status,
    decision.assignedQueue,
    findings,
    extractedFields
  );

  const auditEvents: AuditEvent[] = [
    {
      event_id: `evt-${caseId}-created`,
      case_id: caseId,
      event_type: 'CASE_CREATED',
      actor: 'System',
      summary: `Document submitted: ${sanitizeFileName(options.fileName)}.`,
      details: `MIME: ${options.fileMime}; size: ${options.fileSizeKb} KB.`,
      created_at: now
    },
    {
      event_id: `evt-${caseId}-extract`,
      case_id: caseId,
      event_type: 'TEXT_EXTRACTED',
      actor: 'AI Agent',
      summary: `Extraction method: ${ocrMethod}. Text length: ${rawText.length}.`,
      created_at: new Date(Date.now() + 100).toISOString()
    },
    {
      event_id: `evt-${caseId}-validate`,
      case_id: caseId,
      event_type: 'VALIDATION_RUN',
      actor: 'AI Agent',
      summary: `Validation completed with ${findings.length} findings.`,
      created_at: new Date(Date.now() + 200).toISOString()
    },
    {
      event_id: `evt-${caseId}-route`,
      case_id: caseId,
      event_type: 'ROUTING_DECIDED',
      actor: 'AI Agent',
      summary: `Case routed to ${decision.assignedQueue} with status ${decision.status}.`,
      details: decision.routingReason,
      created_at: new Date(Date.now() + 300).toISOString()
    }
  ];

  let consentRecordObj:
    | import('../src/shared/types.ts').ConsentRecord
    | undefined;

  if (options.consentRecord) {
    consentRecordObj = {
      consent_id: `consent-${caseId}`,
      notice_version: options.consentRecord.notice_version || '2026.1',
      timestamp: options.consentRecord.timestamp || now,
      purpose:
        options.consentRecord.purpose ||
        'document_validation_and_review',
      legal_basis: options.consentRecord.legal_basis || 'consent',
      affirmative_action: Boolean(options.consentRecord.affirmative_action),
      user_declaration: Boolean(options.consentRecord.user_declaration),
      withdrawn: false
    };

    auditEvents.push({
      event_id: `evt-${caseId}-consent`,
      case_id: caseId,
      event_type: 'CONSENT_RECORDED',
      actor: 'Data Principal',
      summary: 'Consent record captured for document processing.',
      details: `Notice version: ${consentRecordObj.notice_version}`,
      created_at: now
    });
  }

  const caseRecord: CaseRecord = {
    case_id: caseId,
    case_number: caseNumber,
    version: 1,
    document_type: finalDocumentType,
    file_name: sanitizeFileName(options.fileName),
    file_size_kb: options.fileSizeKb,
    file_mime: options.fileMime,
    file_data_url: normalizedFileDataUrl,
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
    processing_error: isUnreadable ? 'Document unreadable' : undefined,
    extracted_fields: extractedFields,
    validation_findings: findings,
    review_actions: [],
    audit_events: auditEvents,
    agent_trace: trace,
    consent_record: consentRecordObj,
    retention_until: new Date(
      Date.now() + 90 * 24 * 60 * 60 * 1000
    ).toISOString(),
    is_purged: false
  };

  caseStore.add(caseRecord);

  onStageUpdate?.({
    stage: 'ready',
    message: 'Processing complete. Review ready.',
    subMessage: `Case ${caseNumber} routed to ${decision.assignedQueue}`
  });

  return caseRecord;
}

export async function reEvaluateCase(
  caseId: string,
  reviewerLabel = 'Reviewer'
): Promise<CaseRecord | undefined> {
  const existing = caseStore.getById(caseId);
  if (!existing) return undefined;

  const findings = runValidationChecks(
    existing.document_type,
    existing.extracted_fields,
    existing.cross_reference_text
  );

  for (const finding of findings) {
    const previous = existing.validation_findings.find(
      (item) => item.check_name === finding.check_name
    );

    if (previous?.resolved) {
      finding.resolved = true;
      finding.resolution_notes = previous.resolution_notes;
    }
  }

  const decision = evaluateAndRoute(
    findings,
    Boolean(existing.processing_error),
    existing.document_type
  );

  const trace = buildAgentTrace(
    existing.document_type,
    existing.file_name,
    existing.extracted_fields.filter((field) => Boolean(field.field_value)).length,
    findings.length,
    decision
  );

  const summary = generateNeutralSummary(
    existing.document_type,
    decision.status,
    decision.assignedQueue,
    findings,
    existing.extracted_fields
  );

  return caseStore.update(caseId, (record) => {
    const audit: AuditEvent = {
      event_id: `evt-${caseId}-${Date.now()}`,
      case_id: caseId,
      event_type: 'AGENT_RE_EVALUATED',
      actor: 'AI Agent',
      summary: `Automated re-evaluation triggered by ${reviewerLabel}.`,
      details: decision.routingReason,
      created_at: new Date().toISOString()
    };

    return {
      ...record,
      status: decision.status,
      assigned_queue: decision.assignedQueue,
      routing_reason: decision.routingReason,
      validation_findings: findings,
      executive_summary: summary,
      agent_trace: trace,
      audit_events: [audit, ...record.audit_events]
    };
  });
}
