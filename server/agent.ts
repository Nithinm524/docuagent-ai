/**
 * DOCUAGENT AI — server/agent.ts
 * Stable PDF and image extraction.
 */

import { GoogleGenAI } from '@google/genai';
import {
  CaseRecord,
  DocumentType,
  ExtractedField,
  ValidationFinding,
  AuditEvent
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey });
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

type AIField = { value: string; confidence: number };

type AIExtraction = {
  rawText: string;
  fields: Record<string, AIField>;
  isUnreadable: boolean;
  unreadableReason?: string;
  detectedDocumentType?: DocumentType;
};

function getMimeType(
  fileMime: string | undefined,
  fileName: string,
  dataUrl?: string
): string {
  const fromDataUrl = dataUrl?.match(/^data:([^;,]+)/i)?.[1]?.toLowerCase();

  if (fromDataUrl) {
    return fromDataUrl === 'image/jpg' ? 'image/jpeg' : fromDataUrl;
  }

  const supplied = (fileMime || '').toLowerCase().trim();

  if (supplied && supplied !== 'application/octet-stream') {
    return supplied === 'image/jpg' ? 'image/jpeg' : supplied;
  }

  const name = fileName.toLowerCase();

  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.tif') || name.endsWith('.tiff')) return 'image/tiff';
  if (name.endsWith('.bmp')) return 'image/bmp';

  return 'application/octet-stream';
}

function normalizeDocumentDataUrl(
  data: string | undefined,
  mime: string,
  fileName: string
): string | undefined {
  if (!data?.trim()) return undefined;

  const value = data.trim();
  const dataUrlMatch = value.match(/^data:([^,]+),([\s\S]*)$/i);

  if (dataUrlMatch) {
    const dataUrlMime = dataUrlMatch[1].split(';')[0].toLowerCase();
    const supported = new Set([
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'image/tiff',
      'image/bmp'
    ]);

    const normalizedMime =
      dataUrlMime === 'image/jpg' ? 'image/jpeg' : dataUrlMime;

    if (!supported.has(normalizedMime)) return undefined;

    return `data:${normalizedMime};base64,${dataUrlMatch[2].replace(/\s/g, '')}`;
  }

  const resolvedMime = getMimeType(mime, fileName);
  const supported = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/tiff',
    'image/bmp'
  ]);

  if (!supported.has(resolvedMime)) return undefined;

  const base64 = value.replace(/\s/g, '');
  if (!base64) return undefined;

  return `data:${resolvedMime};base64,${base64}`;
}

function getBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1).replace(/\s/g, '') : dataUrl;
}

function normalizeAIFields(value: unknown): Record<string, AIField> {
  const result: Record<string, AIField> = {};

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return result;
  }

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'string' || typeof raw === 'number') {
      result[key] = { value: String(raw).trim(), confidence: 0.7 };
      continue;
    }

    if (!raw || typeof raw !== 'object') continue;

    const item = raw as Record<string, unknown>;
    const rawValue = item.value ?? item.text ?? '';
    const confidence = Number(item.confidence ?? 0.7);

    result[key] = {
      value:
        typeof rawValue === 'string' || typeof rawValue === 'number'
          ? String(rawValue).trim()
          : '',
      confidence: Number.isFinite(confidence)
        ? Math.max(0, Math.min(1, confidence))
        : 0
    };
  }

  return result;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getAIField(
  fields: Record<string, AIField>,
  name: string,
  label: string
): AIField | undefined {
  const expected = [normalizeKey(name), normalizeKey(label)];

  for (const [key, field] of Object.entries(fields)) {
    if (expected.includes(normalizeKey(key))) return field;
  }

  return undefined;
}

async function extractDocumentWithGemini(
  documentType: DocumentType,
  fileMime: string,
  fileDataUrl: string,
  fileName: string
): Promise<AIExtraction | null> {
  const client = getGeminiClient();
  if (!client) {
    log({
      level: 'ERROR',
      operation: 'GEMINI_API_KEY_MISSING',
      message: 'GEMINI_API_KEY is not configured.'
    });
    return null;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const normalized = normalizeDocumentDataUrl(
      fileDataUrl,
      fileMime,
      fileName
    );

    if (!normalized) {
      throw new Error('Invalid or unsupported document payload.');
    }

    const mimeType = getMimeType(fileMime, fileName, normalized);
    const base64Data = getBase64(normalized);

    if (!base64Data || mimeType === 'application/octet-stream') {
      throw new Error(`Invalid payload or MIME type: ${mimeType}`);
    }

    const schema = DOCUMENT_SCHEMAS[documentType];
    if (!schema) throw new Error(`Unknown document schema: ${documentType}`);

    const prompt = `
You are a document OCR and structured extraction engine.

Read the attached PDF or image. Extract all readable text from all visible
pages and return it in raw_text. The attachment can be a scanned PDF,
a text PDF, or a raster image.

Document schema: ${schema.title}

Extract these fields:
${schema.fields
  .map(
    (field) =>
      `- ${field.name}: "${field.label}", type=${field.type}, required=${field.required}`
  )
  .join('\n')}

Rules:
- Inspect the actual attachment, not just its filename.
- For invoices, extract vendor/supplier and billed-to/customer separately.
- Extract invoice number only when explicitly labelled as an invoice number.
- Never substitute GSTIN, phone number, tax ID, purchase order number, or
  registration number for the invoice number.
- Preserve the original values, dates, currency, and identifiers.
- Do not invent values.
- Return an empty value and confidence 0 for absent fields.
- Set is_unreadable true only when the document is blank, corrupted, or
  genuinely unreadable.
- Determine the actual document type from its contents.

Return valid JSON only:
{
  "is_unreadable": false,
  "unreadable_reason": "",
  "document_type": "${documentType}",
  "raw_text": "all readable text",
  "fields": {
    "field_name": {
      "value": "exact value",
      "confidence": 0.95
    }
  }
}`;

    const budget = usageTracker.isOperationAllowed();

    if (!budget.allowed) {
      log({
        level: 'WARN',
        operation: 'AI_BUDGET_CAP',
        message: `OCR skipped: ${budget.reason}`
      });
      return null;
    }

    const timeoutMs = Number.parseInt(
      process.env.AI_OCR_TIMEOUT_MS || '60000',
      10
    );

    const timeoutPromise = new Promise<never>((_, reject) => {
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
      config: { responseMimeType: 'application/json' }
    });

    const response = await Promise.race([request, timeoutPromise]);

    usageTracker.recordCall(
      {
        promptTokens: response.usageMetadata?.promptTokenCount,
        completionTokens: response.usageMetadata?.candidatesTokenCount
      },
      true
    );

    const responseText = response.text?.trim();
    if (!responseText) throw new Error('Gemini returned an empty response.');

    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Gemini returned invalid JSON.');
      parsed = JSON.parse(match[0]);
    }

    const detectedType =
      typeof parsed.document_type === 'string' &&
      Object.prototype.hasOwnProperty.call(
        DOCUMENT_SCHEMAS,
        parsed.document_type
      )
        ? (parsed.document_type as DocumentType)
        : undefined;

    return {
      rawText:
        typeof parsed.raw_text === 'string' ? parsed.raw_text.trim() : '',
      fields: normalizeAIFields(parsed.fields),
      isUnreadable: parsed.is_unreadable === true,
      unreadableReason:
        typeof parsed.unreadable_reason === 'string'
          ? parsed.unreadable_reason
          : undefined,
      detectedDocumentType: detectedType
    };
  } catch (error: unknown) {
    usageTracker.recordCall(undefined, false);

    log({
      level: 'ERROR',
      operation: 'GEMINI_OCR_FAILED',
      message: 'Document OCR failed.',
      details: {
        fileName,
        reason: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function extractSelectablePdfText(
  fileDataUrl: string
): Promise<{ text: string; pageCount: number } | null> {
  try {
    const normalized = normalizeDocumentDataUrl(
      fileDataUrl,
      'application/pdf',
      'document.pdf'
    );

    if (!normalized) return null;

    const buffer = Buffer.from(getBase64(normalized), 'base64');
    if (!buffer.length) return null;

    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    const text = (parsed.text || '')
      .replace(/-- \d+ of \d+ --/g, '')
      .trim();

    return text.length >= 15
      ? { text, pageCount: parsed.total || 1 }
      : null;
  } catch (error) {
    log({
      level: 'WARN',
      operation: 'PDF_TEXT_EXTRACTION_FAILED',
      message: 'PDF text extraction failed; Gemini OCR will be attempted.',
      details: {
        reason: error instanceof Error ? error.message : 'Unknown error'
      }
    });
    return null;
  }
}

export async function extractOcrWithTesseract(
  fileDataUrl: string
): Promise<string | null> {
  if (!fileDataUrl.startsWith('data:image/')) return null;

  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const normalized = normalizeDocumentDataUrl(
      fileDataUrl,
      'image/jpeg',
      'document.jpg'
    );
    if (!normalized) return null;

    const buffer = Buffer.from(getBase64(normalized), 'base64');
    if (!buffer.length) return null;

    const module = await import('tesseract.js');
    const recognize =
      (module as any).recognize ||
      (module as any).default?.recognize;

    if (typeof recognize !== 'function') return null;

    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Tesseract OCR timed out')),
        Number.parseInt(process.env.TESSERACT_TIMEOUT_MS || '20000', 10)
      );
    });

    try {
      const result = await Promise.race([
        recognize(buffer, 'eng'),
        timeout
      ]) as any;

      const text = result?.data?.text?.trim();
      return text && text.length >= 10 ? text : null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (error: unknown) {
    log({
      level: 'WARN',
      operation: 'TESSERACT_OCR_FAILED',
      message: 'Tesseract image OCR fallback failed.',
      details: {
        reason: error instanceof Error ? error.message : 'Unknown error'
      }
    });
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function extractFieldsFromText(
  documentType: DocumentType,
  text: string,
  manualFields?: Record<string, string>
): ExtractedField[] {
  const schema = DOCUMENT_SCHEMAS[documentType];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const normalize = (value: string) =>
    value.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();

  const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const findLabel = (labels: string[]): string => {
    const sorted = [...labels].sort((a, b) => b.length - a.length);

    for (let i = 0; i < lines.length; i++) {
      for (const label of sorted) {
        const line = lines[i];
        const normLine = normalize(line);
        const normLabel = normalize(label);

        if (
          normLine !== normLabel &&
          !normLine.startsWith(`${normLabel}:`) &&
          !normLine.startsWith(`${normLabel} `) &&
          !normLine.startsWith(`${normLabel}#`) &&
          !normLine.startsWith(`${normLabel}-`)
        ) {
          continue;
        }

        const escaped = escapeRegExp(label);
        const inline = line.match(
          new RegExp(`^\\s*${escaped}\\s*(?::|#|-)\\s*(.*?)\\s*$`, 'i')
        );

        if (inline?.[1]?.trim()) return inline[1].trim();

        const spaced = line.match(
          new RegExp(`^\\s*${escaped}\\s+(.+?)\\s*$`, 'i')
        );

        if (spaced?.[1]?.trim()) return spaced[1].trim();

        if (normLine === normLabel && lines[i + 1]) {
          const next = lines[i + 1];
          const nextNorm = normalize(next);

          const nextIsLabel = sorted.some((candidate) => {
            const n = normalize(candidate);
            return (
              nextNorm === n ||
              nextNorm.startsWith(`${n}:`) ||
              nextNorm.startsWith(`${n} `)
            );
          });

          if (!nextIsLabel) return next;
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

  const findAmount = (labels: string[]): string => {
    const candidate = findLabel(labels);
    if (!candidate) return '';

    return (
      candidate.match(/(?:₹|Rs\.?|INR|USD|\$|€|£)?\s*\d[\d,]*(?:\.\d{1,2})?/i)?.[0]
        ?.trim() || ''
    );
  };

  const findDate = (labels: string[]): string => {
    const candidate = findLabel(labels);
    const match = candidate.match(
      /\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/i
    );
    return match?.[0] || '';
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
        is_uncertain: definition.required && !manualValue.trim(),
        is_edited: true
      };
    }

    const combined = `${normalize(definition.name)} ${normalize(definition.label)}`;
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
      value = findLabel([
        'vendor name',
        'supplier name',
        'seller name',
        'issued by',
        'from',
        'supplier',
        'vendor',
        'seller'
      ]);
    } else if (
      documentType === 'invoice' &&
      /(billed to|bill to|customer|buyer|recipient|client)/.test(combined)
    ) {
      value = findLabel([
        'billed to',
        'bill to',
        'customer name',
        'client name',
        'customer',
        'client',
        'buyer',
        'recipient'
      ]);
    } else if (/(due date|invoice date|issue date|document date)/.test(combined)) {
      value = findDate([
        definition.label,
        definition.name.replace(/_/g, ' '),
        'invoice date',
        'date of invoice',
        'issue date',
        'due date',
        'date'
      ]);
    } else if (
      /(grand total|total amount|invoice total|amount due|total due|subtotal)/.test(combined)
    ) {
      value = findAmount([
        'grand total',
        'invoice total',
        'total due',
        'amount due',
        'total amount',
        'subtotal',
        'total'
      ]);
    } else {
      value = findLabel([
        definition.label,
        definition.name.replace(/_/g, ' ')
      ]);
    }

    return {
      field_id: `fld-${definition.name}`,
      case_id: 'temp',
      field_name: definition.name,
      field_label: definition.label,
      field_value: value,
      confidence: value ? 0.8 : 0,
      is_uncertain: Boolean(definition.required && !value),
      is_edited: false
    };
  });
}

export async function generateExecutiveSummary(
  documentType: DocumentType,
  caseStatus: string,
  assignedQueue: string,
  findings: ValidationFinding[],
  fields: ExtractedField[],
  rawText?: string
): Promise<string> {
  return generateNeutralSummary(
    documentType,
    caseStatus as any,
    assignedQueue as any,
    findings,
    fields
  );
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
  const caseId = `case-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const caseNumber = `DOC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  const normalizedDataUrl = normalizeDocumentDataUrl(
    options.fileDataUrl,
    options.fileMime,
    options.fileName
  );

  let rawText = options.rawText?.trim() || '';
  let isUnreadable = Boolean(options.isUnreadable);
  let isSelectablePdf = false;
  let ocrMethod = rawText ? 'Provided Text' : 'Automated Text Extractor';
  let aiFields: Record<string, AIField> | null = null;

  const mimeType = getMimeType(
    options.fileMime,
    options.fileName,
    normalizedDataUrl
  );

  const isPdf =
    mimeType === 'application/pdf' ||
    options.fileName.toLowerCase().endsWith('.pdf');

  onStageUpdate?.({
    stage: 'scanning',
    message: 'Preparing document...',
    subMessage: `Validating ${sanitizeFileName(options.fileName)}`
  });

  const uploadValidation = validateUploadFile({
    fileName: options.fileName,
    fileSizeKb: options.fileSizeKb,
    fileMime: mimeType
  });

  if (!uploadValidation.valid) {
    log({
      level: 'WARN',
      operation: 'UPLOAD_VALIDATION_FAILED',
      message: uploadValidation.reason || 'Upload validation failed'
    });
  }

  if (isPdf && normalizedDataUrl && !rawText) {
    onStageUpdate?.({
      stage: 'extracting',
      method: 'pdf_text',
      message: 'Extracting selectable PDF text...',
      ocrMethodName: 'PDF Text Parser'
    });

    const pdfResult = await extractSelectablePdfText(normalizedDataUrl);

    if (pdfResult?.text) {
      rawText = pdfResult.text;
      isSelectablePdf = true;
      ocrMethod = 'Selectable PDF Text Parser';
    }
  }

  /*
   * Critical fix:
   * Run multimodal OCR when PDF text extraction returns nothing.
   * Always pass a normalized data URL and its actual MIME type.
   */
  if (!rawText.trim() && normalizedDataUrl && !isUnreadable) {
    onStageUpdate?.({
      stage: 'extracting',
      method: 'ocr',
      message: isPdf
        ? 'Reading scanned PDF pages...'
        : 'Reading uploaded image...',
      ocrMethodName: 'Gemini Multimodal OCR'
    });

    const firstType: DocumentType =
      options.documentType === 'auto'
        ? ('general_doc' as DocumentType)
        : options.documentType;

    const firstResult = await extractDocumentWithGemini(
      firstType,
      mimeType,
      normalizedDataUrl,
      options.fileName
    );

    if (firstResult) {
      rawText = firstResult.rawText.trim();
      aiFields = firstResult.fields;

      if (rawText) {
        ocrMethod = isPdf
          ? 'Scanned PDF OCR (Gemini)'
          : 'Gemini Image OCR';
      }

      if (firstResult.isUnreadable && !rawText && !Object.keys(aiFields).length) {
        isUnreadable = true;
      }
    }

    if (!rawText.trim() && !isPdf) {
      const imageText = await extractOcrWithTesseract(normalizedDataUrl);

      if (imageText) {
        rawText = imageText;
        ocrMethod = 'Tesseract OCR';
      }
    }
  }

  const detection = detectDocumentType(
    options.fileName,
    rawText,
    mimeType
  );

  const finalDocumentType: DocumentType =
    options.documentType === 'auto'
      ? (aiFields && detection.documentType === 'general_doc'
          ? detection.documentType
          : detection.documentType)
      : options.documentType;

  /*
   * Schema-specific second pass. This is also performed for scanned PDFs
   * when the PDF text layer is empty.
   */
  if (normalizedDataUrl && !isUnreadable) {
    const schema = DOCUMENT_SCHEMAS[finalDocumentType];
    const hasSchemaFields = Boolean(
      aiFields &&
      schema.fields.some((field) =>
        Object.prototype.hasOwnProperty.call(aiFields, field.name)
      )
    );

    if (!hasSchemaFields || options.documentType === 'auto' || isSelectablePdf) {
      const secondResult = await extractDocumentWithGemini(
        finalDocumentType,
        mimeType,
        normalizedDataUrl,
        options.fileName
      );

      if (secondResult) {
        if (
          secondResult.rawText.trim().length > rawText.length &&
          secondResult.rawText.trim().length >= 10
        ) {
          rawText = secondResult.rawText.trim();
          if (!isSelectablePdf) {
            ocrMethod = isPdf
              ? 'Scanned PDF OCR (Gemini)'
              : 'Gemini Image OCR';
          }
        }

        if (Object.keys(secondResult.fields).length) {
          aiFields = secondResult.fields;
        }

        if (
          secondResult.isUnreadable &&
          !rawText &&
          !Object.keys(secondResult.fields).length
        ) {
          isUnreadable = true;
        }
      }
    }
  }

  onStageUpdate?.({
    stage: 'analyzing',
    message: 'Analyzing extracted fields...',
    documentType: finalDocumentType,
    subMessage: `Document type: ${DOCUMENT_SCHEMAS[finalDocumentType].title}`
  });

  const schema = DOCUMENT_SCHEMAS[finalDocumentType];
  const fallbackFields = extractFieldsFromText(
    finalDocumentType,
    rawText,
    options.manualFields
  );

  const hasAIValues = Boolean(
    aiFields &&
    Object.values(aiFields).some((field) => field.value.trim())
  );

  const hasReadableText = rawText.trim().length >= 10;
  const ocrFailed = !isUnreadable && !hasReadableText && !hasAIValues;

  let extractedFields: ExtractedField[];

  if (aiFields && hasAIValues) {
    extractedFields = schema.fields.map((definition) => {
      const aiField = getAIField(
        aiFields || {},
        definition.name,
        definition.label
      );

      const fallback = fallbackFields.find(
        (field) => field.field_name === definition.name
      );

      const manualValue = options.manualFields?.[definition.name];
      const aiValue = aiField?.value?.trim() || '';
      const fallbackValue = fallback?.field_value?.trim() || '';

      const value =
        manualValue !== undefined
          ? manualValue
          : aiValue || fallbackValue;

      const confidence =
        manualValue !== undefined
          ? manualValue.trim()
            ? 0.99
            : 0
          : aiValue
            ? Math.max(0, Math.min(1, aiField?.confidence ?? 0.75))
            : fallbackValue
              ? fallback?.confidence ?? 0.75
              : 0;

      return {
        field_id: `fld-${caseId}-${definition.name}`,
        case_id: caseId,
        field_name: definition.name,
        field_label: definition.label,
        field_value: value,
        confidence,
        is_uncertain: Boolean(
          definition.required && (!value.trim() || confidence < 0.65)
        ),
        is_edited: manualValue !== undefined
      };
    });
  } else {
    extractedFields = fallbackFields.map((field) => ({
      ...field,
      field_id: `fld-${caseId}-${field.field_name}`,
      case_id: caseId
    }));
  }

  if (ocrFailed || isUnreadable) {
    extractedFields = schema.fields.map((definition) => {
      const manualValue = options.manualFields?.[definition.name] || '';

      return {
        field_id: `fld-${caseId}-${definition.name}`,
        case_id: caseId,
        field_name: definition.name,
        field_label: definition.label,
        field_value: manualValue,
        confidence: manualValue ? 0.99 : 0,
        is_uncertain: Boolean(definition.required && !manualValue),
        is_edited: Boolean(manualValue)
      };
    });
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
            'The document appears unreadable or corrupted. Manual review is required.',
          evidence_reference: `File: ${options.fileName}`,
          resolved: false
        }
      ]
    : runValidationChecks(
        finalDocumentType,
        extractedFields,
        options.crossReferenceText
      );

  for (const finding of findings) finding.case_id = caseId;

  const decision = evaluateAndRoute(
    findings,
    isUnreadable,
    finalDocumentType
  );

  const trace = buildAgentTrace(
    finalDocumentType,
    options.fileName,
    extractedFields.filter((field) => Boolean(field.field_value.trim())).length,
    findings.length,
    decision,
    { isUnreadable, ocrFailed, ocrMethod }
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
      details: `MIME: ${mimeType}; size: ${options.fileSizeKb} KB.`,
      created_at: now
    },
    {
      event_id: `evt-${caseId}-extraction`,
      case_id: caseId,
      event_type: ocrFailed ? 'OCR_EXTRACTION_FAILED' : 'TEXT_EXTRACTED',
      actor: 'AI Agent',
      summary: ocrFailed
        ? 'OCR did not recover readable text or structured fields.'
        : `Extraction method: ${ocrMethod}; text length: ${rawText.length}.`,
      created_at: new Date(Date.now() + 100).toISOString()
    },
    {
      event_id: `evt-${caseId}-validation`,
      case_id: caseId,
      event_type: 'VALIDATION_RUN',
      actor: 'AI Agent',
      summary: `Validation completed with ${findings.length} findings.`,
      created_at: new Date(Date.now() + 200).toISOString()
    },
    {
      event_id: `evt-${caseId}-routing`,
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
    file_mime: mimeType,
    file_data_url: normalizedDataUrl,
    raw_text: rawText || (ocrFailed ? '[NO OCR TEXT RECOVERED]' : ''),
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
    processing_error: isUnreadable
      ? 'Document unreadable'
      : ocrFailed
        ? 'No readable text or structured fields were extracted'
        : undefined,
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
    message: 'Processing complete.',
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

  const updatedTrace = buildAgentTrace(
    existing.document_type,
    existing.file_name,
    existing.extracted_fields.filter((field) => Boolean(field.field_value)).length,
    findings.length,
    decision,
    {
      isUnreadable: Boolean(existing.processing_error),
      ocrFailed: Boolean(existing.processing_error),
      ocrMethod: 'Human Verified & Re-evaluated'
    }
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
      agent_trace: updatedTrace,
      audit_events: [audit, ...record.audit_events]
    };
  });
}
