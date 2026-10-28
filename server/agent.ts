/**
 * Agent Orchestration Engine
 * DOCUAGENT AI Document Intelligence Platform
 *
 * Implements multi-step agent workflow:
 * 1. Goal Identification & File Ingestion
 * 2. Multimodal Gemini OCR & Text Extraction
 * 3. Structured Schema Field Extraction
 * 4. Deterministic Rule Validation
 * 5. Decision Matrix & Queue Routing
 * 6. Executive Summary
 * 7. Audit Persistence
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
  if (!process.env.GEMINI_API_KEY) return null;

  if (!genAIClient) {
    try {
      genAIClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
    } catch (error) {
      console.warn(
        'Gemini client initialization notice; deterministic fallback will be used:',
        error
      );
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

type GeminiExtractedField = {
  value: string;
  confidence: number;
};

type GeminiExtractionResult = {
  rawText: string;
  fields: Record<string, GeminiExtractedField>;
  isUnreadable: boolean;
  unreadableReason?: string;
  detectedDocumentType?: DocumentType;
};

function resolveDocumentMime(
  fileMime?: string,
  fileName = '',
  dataUrl?: string
): string {
  const dataUrlMime = dataUrl?.match(/^data:([^;,]+)/i)?.[1];

  const candidates = [dataUrlMime, fileMime]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase().trim());

  for (const mime of candidates) {
    if (
      mime === 'application/pdf' ||
      mime === 'image/png' ||
      mime === 'image/jpeg' ||
      mime === 'image/webp' ||
      mime === 'image/gif' ||
      mime === 'image/tiff' ||
      mime === 'image/bmp'
    ) {
      return mime;
    }
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

/**
 * Accept both data URLs and bare Base64 strings.
 * A valid MIME type is required when sending binary document data to Gemini.
 */
function normalizeDocumentDataUrl(
  fileDataUrl?: string,
  fileMime?: string,
  fileName = ''
): string | undefined {
  if (!fileDataUrl || !fileDataUrl.trim()) return undefined;

  const value = fileDataUrl.trim();

  if (/^data:[^,]+,/i.test(value)) {
    return value;
  }

  const mime = resolveDocumentMime(fileMime, fileName);
  const base64 = value.replace(/\s+/g, '');

  if (!base64) return undefined;

  return `data:${mime};base64,${base64}`;
}

function getBase64Payload(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',');

  if (dataUrl.startsWith('data:') && commaIndex !== -1) {
    return dataUrl.slice(commaIndex + 1).replace(/\s+/g, '');
  }

  return dataUrl.replace(/\s+/g, '');
}

function getDocumentSchema(documentType: DocumentType) {
  return DOCUMENT_SCHEMAS[documentType];
}

function normalizeConfidence(value: unknown): number {
  const confidence = Number(value);

  if (!Number.isFinite(confidence)) return 0;
  return Math.max(0, Math.min(1, confidence));
}

function normalizeGeminiFields(
  fields: unknown
): Record<string, GeminiExtractedField> {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return {};
  }

  const normalized: Record<string, GeminiExtractedField> = {};

  for (const [key, rawValue] of Object.entries(
    fields as Record<string, unknown>
  )) {
    if (typeof rawValue === 'string' || typeof rawValue === 'number') {
      normalized[key] = {
        value: String(rawValue).trim(),
        confidence: 0.7
      };
      continue;
    }

    if (!rawValue || typeof rawValue !== 'object') {
      continue;
    }

    const field = rawValue as Record<string, unknown>;
    const value = field.value ?? field.text ?? '';

    normalized[key] = {
      value: typeof value === 'string' || typeof value === 'number'
        ? String(value).trim()
        : '',
      confidence: normalizeConfidence(field.confidence)
    };
  }

  return normalized;
}

/**
 * Multimodal document extraction with Gemini.
 * Returns null when AI extraction is unavailable so deterministic extraction
 * can continue instead of failing the entire document-processing pipeline.
 */
async function extractDocumentWithGemini(
  documentType: DocumentType,
  fileMime: string,
  fileDataUrl: string,
  fileName = ''
): Promise<GeminiExtractionResult | null> {
  const client = getGeminiClient();

  if (!client || !process.env.GEMINI_API_KEY) {
    return null;
  }

  const normalizedDataUrl = normalizeDocumentDataUrl(
    fileDataUrl,
    fileMime,
    fileName
  );

  if (!normalizedDataUrl) {
    return null;
  }

  try {
    const base64Data = getBase64Payload(normalizedDataUrl);
    const validMime = resolveDocumentMime(
      fileMime,
      fileName,
      normalizedDataUrl
    );

    if (
      !base64Data ||
      validMime === 'application/octet-stream'
    ) {
      throw new Error('Unsupported or empty document payload');
    }

    const schema = getDocumentSchema(documentType);

    const prompt = `
You are a document OCR and structured data extraction engine.

Analyze the uploaded document for the requested category:
${schema.title}

Tasks:
1. Read all legible printed and handwritten text.
2. Do not invent information or fill missing fields with guesses.
3. Determine whether the document is blank, corrupted, severely blurred,
   or otherwise unreadable.
4. Independently classify the actual document type using only one of these
   available keys:
   ${Object.keys(DOCUMENT_SCHEMAS).join(', ')}
5. Extract the fields defined for the requested document schema.

Requested fields:
${schema.fields
  .map(
    (field) =>
      `- ${field.name} (label: "${field.label}", type: ${field.type}, required: ${field.required})`
  )
  .join('\n')}

Important invoice extraction rules:
- Extract the supplier/vendor name from the issuer or seller section.
- Extract the billed-to/customer name from the buyer or recipient section.
- Extract the invoice number only from an explicit invoice number, invoice ID,
  tax invoice number, or equivalent identifier label.
- Do not use a company registration number, GSTIN, tax ID, phone number,
  purchase order number, or random digit sequence as the invoice number.
- Extract the invoice date separately from the due date.
- Extract the final total amount separately from subtotal, tax, and balance
  when those fields are available.
- Preserve the original value and currency as printed.
- If a field cannot be found, return an empty string and confidence 0.
- If any text is legible, include it in raw_text even if some fields are missing.
- Use exact field names from the schema when returning fields.

Return valid JSON only, using this structure:
{
  "is_unreadable": false,
  "unreadable_reason": "",
  "document_type": "one available schema key",
  "raw_text": "all legible document text",
  "fields": {
    "field_name": {
      "value": "extracted value",
      "confidence": 0.95
    }
  }
}
`;

    const budgetCheck = usageTracker.isOperationAllowed();

    if (!budgetCheck.allowed) {
      log({
        level: 'INFO',
        operation: 'AI_BUDGET_CAP',
        message: `Skipping Gemini OCR: ${budgetCheck.reason}`
      });
      return null;
    }

    const timeoutMs = Number.parseInt(
      process.env.AI_OCR_TIMEOUT_MS ||
        process.env.AI_REQUEST_TIMEOUT_MS ||
        '35000',
      10
    );

    let timer: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Gemini OCR request timed out')),
        timeoutMs
      );
    });

    const callPromise = client.models.generateContent({
      model: process.env.GEMINI_OCR_MODEL || 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: validMime,
            data: base64Data
          }
        },
        {
          text: prompt
        }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    let response: any;

    try {
      response = await Promise.race([callPromise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }

    usageTracker.recordCall(
      {
        promptTokens: response?.usageMetadata?.promptTokenCount,
        completionTokens: response?.usageMetadata?.candidatesTokenCount
      },
      true
    );

    const responseText =
      typeof response?.text === 'string' ? response.text : '';

    if (!responseText.trim()) {
      throw new Error('Gemini returned an empty response');
    }

    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('Gemini returned invalid JSON');
      }

      parsed = JSON.parse(jsonMatch[0]);
    }

    const detectedTypeValue = parsed.document_type;
    const detectedDocumentType =
      typeof detectedTypeValue === 'string' &&
      Object.prototype.hasOwnProperty.call(
        DOCUMENT_SCHEMAS,
        detectedTypeValue
      )
        ? detectedTypeValue as DocumentType
        : undefined;

    return {
      rawText: typeof parsed.raw_text === 'string'
        ? parsed.raw_text.trim()
        : '',
      fields: normalizeGeminiFields(parsed.fields),
      isUnreadable: parsed.is_unreadable === true,
      unreadableReason:
        typeof parsed.unreadable_reason === 'string'
          ? parsed.unreadable_reason
          : undefined,
      detectedDocumentType
    };
  } catch (error: any) {
    usageTracker.recordCall(undefined, false);

    log({
      level: 'INFO',
      operation: 'GEMINI_OCR_FALLBACK',
      message: 'Gemini document extraction failed; fallback extraction will be used',
      details: {
        reason: error?.message || 'Unknown Gemini extraction error',
        fileName
      }
    });

    return null;
  }
}

/**
 * Extract selectable text from a digital PDF.
 */
export async function extractSelectablePdfText(
  fileDataUrl: string
): Promise<{ text: string; pageCount: number } | null> {
  try {
    const normalizedDataUrl = normalizeDocumentDataUrl(
      fileDataUrl,
      'application/pdf',
      'document.pdf'
    );

    if (!normalizedDataUrl) return null;

    const base64Data = getBase64Payload(normalizedDataUrl);
    const buffer = Buffer.from(base64Data, 'base64');

    if (!buffer.length) return null;

    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();

    const cleanText = (parsed.text || '')
      .replace(/-- \d+ of \d+ --/g, '')
      .trim();

    if (cleanText.length >= 15) {
      return {
        text: cleanText,
        pageCount: parsed.total || 1
      };
    }
  } catch (error) {
    console.warn('PDF selectable text extraction notice:', error);
  }

  return null;
}

/**
 * Fallback OCR using Tesseract for raster images.
 * PDF files are handled by Gemini when selectable PDF text is unavailable.
 */
export async function extractOcrWithTesseract(
  fileDataUrl: string
): Promise<string | null> {
  if (!fileDataUrl.startsWith('data:image/')) {
    return null;
  }

  let timer: NodeJS.Timeout | undefined;

  try {
    const base64Data = getBase64Payload(fileDataUrl);
    const buffer = Buffer.from(base64Data, 'base64');

    if (!buffer.length) return null;

    const timeoutMs = Number.parseInt(
      process.env.TESSERACT_TIMEOUT_MS || '25000',
      10
    );

    const { createWorker } = await import('tesseract.js');

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Tesseract OCR request timed out')),
        timeoutMs
      );
    });

    const ocrPromise = (async () => {
      const worker = await createWorker('eng');

      try {
        const result = await worker.recognize(buffer);
        return result.data.text?.trim() || '';
      } finally {
        await worker.terminate();
      }
    })();

    const text = await Promise.race([ocrPromise, timeoutPromise]);

    return text.trim() || null;
  } catch (error) {
    console.warn('Tesseract OCR fallback notice:', error);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Extract fields from text using schema labels and conservative patterns.
 */
export function extractFieldsFromText(
  documentType: DocumentType,
  rawText: string,
  manualFields?: Record<string, string>
): ExtractedField[] {
  const schema = DOCUMENT_SCHEMAS[documentType];
  const normalizedText = rawText.replace(/\r/g, '\n');
  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const lowerText = normalizedText.toLowerCase();

  const invoiceNumberPatterns = [
    /\b(?:invoice\s*(?:number|no\.?|#|id)|tax\s*invoice\s*(?:number|no\.?|#|id)|inv\s*(?:number|no\.?|#|id))\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-\/._]{1,})/i,
    /\b(?:invoice|tax invoice)\s*[:#]\s*([A-Z0-9][A-Z0-9\-\/._]{1,})/i
  ];

  const findInvoiceNumber = (): string => {
    for (const pattern of invoiceNumberPatterns) {
      const match = normalizedText.match(pattern);

      if (match?.[1]) {
        const candidate = match[1].trim();

        if (/\d/.test(candidate)) {
          return candidate.replace(/[.,;:]$/, '');
        }
      }
    }

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      if (
        /\b(invoice\s*(?:number|no\.?|#|id)|tax\s*invoice\s*(?:number|no\.?|#|id)|inv\s*(?:number|no\.?|#|id))\b/i.test(
          line
        )
      ) {
        const afterLabel = line
          .replace(
            /\b(?:tax\s*)?invoice\s*(?:number|no\.?|#|id)\b/i,
            ''
          )
          .replace(/^[\s:#\-]+/, '')
          .trim();

        if (afterLabel && /\d/.test(afterLabel)) {
          const token = afterLabel.match(/[A-Z0-9][A-Z0-9\-\/._]*/i)?.[0];

          if (token && /\d/.test(token)) {
            return token.replace(/[.,;:]$/, '');
          }
        }

        const nextLine = lines[index + 1];

        if (nextLine && /\d/.test(nextLine)) {
          const token = nextLine.match(/[A-Z0-9][A-Z0-9\-\/._]*/i)?.[0];

          if (token && /\d/.test(token)) {
            return token.replace(/[.,;:]$/, '');
          }
        }
      }
    }

    return '';
  };

  const findLabeledValue = (
    labels: string[],
    options?: {
      allowNextLine?: boolean;
      rejectLabels?: string[];
    }
  ): string => {
    const escapedLabels = labels.map((label) =>
      label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );

    const labelPattern = new RegExp(
      `(?:${escapedLabels.join('|')})`,
      'i'
    );

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      if (!labelPattern.test(line)) continue;

      if (
        options?.rejectLabels?.some((label) =>
          new RegExp(label, 'i').test(line)
        )
      ) {
        continue;
      }

      const colonIndex = line.indexOf(':');

      if (colonIndex >= 0) {
        const afterColon = line.slice(colonIndex + 1).trim();

        if (afterColon && !labelPattern.test(afterColon)) {
          return afterColon.replace(/\s{2,}/g, ' ').trim();
        }
      }

      const cleaned = line
        .replace(labelPattern, '')
        .replace(/^[\s:#\-]+/, '')
        .trim();

      if (cleaned && !labelPattern.test(cleaned)) {
        return cleaned.replace(/\s{2,}/g, ' ').trim();
      }

      if (options?.allowNextLine && lines[index + 1]) {
        const nextLine = lines[index + 1].trim();

        if (
          nextLine &&
          !/^(invoice|date|due date|total|subtotal|tax|amount|bill to|billed to|ship to)\b/i.test(
            nextLine
          )
        ) {
          return nextLine;
        }
      }
    }

    return '';
  };

  const findVendorName = (): string => {
    const explicit = findLabeledValue(
      [
        'supplier name',
        'supplier',
        'vendor name',
        'vendor',
        'seller name',
        'seller',
        'issued by',
        'from'
      ],
      {
        allowNextLine: true,
        rejectLabels: [
          'billed to',
          'bill to',
          'customer',
          'buyer',
          'ship to'
        ]
      }
    );

    if (explicit) return explicit;

    const rejectLine = /^(invoice|tax invoice|receipt|bill to|billed to|ship to|sold to|customer|buyer|supplier|vendor|seller|invoice number|invoice no|invoice date|date|due date|total|subtotal|tax|gst|amount|description|quantity|qty|unit price|rate|terms|payment|phone|email|website|www\.|https?:\/\/)/i;

    for (const line of lines.slice(0, 8)) {
      if (rejectLine.test(line)) continue;
      if (/^[\d\s.,:/#\-]+$/.test(line)) continue;
      if (line.length < 2 || line.length > 100) continue;

      if (
        /\b(?:private limited|pvt\.?\s*ltd|limited|ltd\.?|llp|inc\.?|corp\.?|corporation|technologies|technology|solutions|services|enterprises|company|co\.?)\b/i.test(
          line
        )
      ) {
        return line;
      }
    }

    for (const line of lines.slice(0, 5)) {
      if (rejectLine.test(line)) continue;
      if (/^[\d\s.,:/#\-]+$/.test(line)) continue;
      if (line.length < 2 || line.length > 100) continue;

      return line;
    }

    return '';
  };

  const findBilledTo = (): string => {
    const explicit = findLabeledValue(
      [
        'billed to',
        'bill to',
        'bill-to',
        'customer name',
        'customer',
        'buyer',
        'recipient',
        'sold to',
        'client name',
        'client'
      ],
      {
        allowNextLine: true,
        rejectLabels: ['supplier', 'vendor', 'seller']
      }
    );

    if (explicit) return explicit;

    return '';
  };

  const findDate = (labels: string[]): string => {
    const explicit = findLabeledValue(labels, {
      allowNextLine: true
    });

    if (explicit) {
      const dateMatch = explicit.match(
        /\b(?:\d{1,4}[\/.-]\d{1,2}[\/.-]\d{1,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?,?\s+\d{2,4})\b/i
      );

      if (dateMatch) return dateMatch[0];
    }

    const dateMatch = normalizedText.match(
      /\b(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4})\b/i
    );

    return dateMatch?.[0] || '';
  };

  const findAmount = (labels: string[]): string => {
    const explicit = findLabeledValue(labels, {
      allowNextLine: true
    });

    if (explicit) {
      const amountMatch = explicit.match(
        /(?:[$₹€£]\s*)?[\d,]+(?:\.\d{1,2})?(?:\s*(?:INR|USD|EUR|GBP|Rs\.?|Rupees))?/i
      );

      if (amountMatch) return amountMatch[0].trim();
    }

    return '';
  };

  const invoiceNumber = findInvoiceNumber();
  const vendorName = findVendorName();
  const billedTo = findBilledTo();
  const invoiceDate = findDate([
    'invoice date',
    'date of invoice',
    'issued on',
    'issue date'
  ]);
  const dueDate = findDate([
    'due date',
    'payment due',
    'pay by',
    'due on'
  ]);
  const totalAmount = findAmount([
    'grand total',
    'invoice total',
    'total due',
    'amount due',
    'total amount',
    'total'
  ]);

  const values: Record<string, string> = {};

  for (const definition of schema.fields) {
    const fieldName = definition.name.toLowerCase();
    const fieldLabel = definition.label.toLowerCase();
    let value = '';

    if (manualFields?.[definition.name]) {
      value = manualFields[definition.name];
    } else if (
      documentType === 'invoice' &&
      /invoice.?number|invoice.?no|invoice.?id|invoice.?identifier/.test(
        `${fieldName} ${fieldLabel}`.replace(/\s+/g, '')
      )
    ) {
      value = invoiceNumber;
    } else if (
      documentType === 'invoice' &&
      /(vendor|supplier|seller|issuer|company.?name)/.test(
        `${fieldName} ${fieldLabel}`.replace(/\s+/g, '')
      )
    ) {
      value = vendorName;
    } else if (
      documentType === 'invoice' &&
      /(billed.?to|bill.?to|customer|buyer|recipient|client)/.test(
        `${fieldName} ${fieldLabel}`.replace(/\s+/g, '')
      )
    ) {
      value = billedTo;
    } else if (
      documentType === 'invoice' &&
      /(invoice.?date|issue.?date|date.?issued)/.test(
        `${fieldName} ${fieldLabel}`.replace(/\s+/g, '')
      )
    ) {
      value = invoiceDate;
    } else if (
      documentType === 'invoice' &&
      /(due.?date|payment.?due)/.test(
        `${fieldName} ${fieldLabel}`.replace(/\s+/g, '')
      )
    ) {
      value = dueDate;
    } else if (
      documentType === 'invoice' &&
      /(total.?amount|grand.?total|invoice.?total|amount.?due|total.?due)/.test(
        `${fieldName} ${fieldLabel}`.replace(/\s+/g, '')
      )
    ) {
      value = totalAmount;
    } else {
      const escapedLabel = definition.label.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

      const escapedName = definition.name.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

      const pattern = new RegExp(
        `(?:${escapedLabel}|${escapedName})\\s*[:#\\-]?\\s*([^\\n]+)`,
        'i'
      );

      const match = normalizedText.match(pattern);

      if (match?.[1]) {
        value = match[1].trim();
      } else if (definition.type === 'date') {
        value = findDate([definition.label, definition.name]);
      } else if (definition.type === 'currency' || /amount|total|price|cost|fee/i.test(`${definition.name} ${definition.label}`)) {
        value = findAmount([definition.label, definition.name]);
      } else {
        value = findLabeledValue([
          definition.label,
          definition.name.replace(/_/g, ' ')
        ]);
      }
    }

    values[definition.name] = value.trim();
  }

  return schema.fields.map((definition) => {
    const value = values[definition.name] || '';
    const manuallyProvided = Boolean(manualFields?.[definition.name]);

    return {
      field_id: '',
      case_id: '',
      field_name: definition.name,
      field_label: definition.label,
      field_value: value,
      confidence: manuallyProvided ? 0.98 : value ? 0.65 : 0,
      is_uncertain: Boolean(definition.required && !value),
      is_edited: manuallyProvided
    };
  });
}

/**
 * Build a consistent extraction result from Gemini fields and schema fields.
 */
function mapGeminiFieldsToSchema(
  documentType: DocumentType,
  aiFields: Record<string, GeminiExtractedField>,
  caseId: string,
  manualFields?: Record<string, string>
): ExtractedField[] {
  const schema = DOCUMENT_SCHEMAS[documentType];

  return schema.fields.map((definition) => {
    const normalizedName = definition.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedLabel = definition.label.toLowerCase().replace(/[^a-z0-9]/g, '');

    const matchingEntry = Object.entries(aiFields).find(([key]) => {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');

      return (
        normalizedKey === normalizedName ||
        normalizedKey === normalizedLabel ||
        normalizedKey.includes(normalizedName) ||
        normalizedName.includes(normalizedKey)
      );
    });

    const aiField = matchingEntry?.[1];
    const manualValue = manualFields?.[definition.name];
    const aiValue = aiField?.value?.trim() || '';

    const value = manualValue || aiValue;
    const confidence = manualValue
      ? 0.98
      : aiValue
        ? normalizeConfidence(aiField?.confidence)
        : 0;

    return {
      field_id: `fld-${caseId}-${definition.name}`,
      case_id: caseId,
      field_name: definition.name,
      field_label: definition.label,
      field_value: value,
      confidence,
      is_uncertain: Boolean(
        definition.required && (!value || confidence < 0.7)
      ),
      is_edited: Boolean(manualValue)
    };
  });
}

/**
 * Create a conservative document classification fallback.
 */
function inferDocumentTypeFromText(
  fileName: string,
  rawText: string,
  fileMime: string
): DocumentType | undefined {
  const detected = detectDocumentType(fileName, rawText, fileMime);

  if (
    detected &&
    typeof detected === 'object' &&
    'documentType' in detected &&
    detected.documentType &&
    Object.prototype.hasOwnProperty.call(
      DOCUMENT_SCHEMAS,
      detected.documentType
    )
  ) {
    return detected.documentType as DocumentType;
  }

  return undefined;
}

async function generateExecutiveSummary(
  documentType: DocumentType,
  status: string,
  assignedQueue: string,
  findings: ValidationFinding[],
  fields: ExtractedField[],
  rawText: string
): Promise<string> {
  try {
    const client = getGeminiClient();

    if (client && process.env.GEMINI_API_KEY && usageTracker.isOperationAllowed().allowed) {
      const prompt = `
Create a concise, neutral internal review summary for this document case.

Document type: ${DOCUMENT_SCHEMAS[documentType].title}
Status: ${status}
Assigned queue: ${assignedQueue}

Extracted fields:
${fields
  .map((field) => `${field.field_label}: ${field.field_value || 'Not found'}`)
  .join('\n')}

Validation findings:
${findings
  .map(
    (finding) =>
      `${finding.severity} - ${finding.check_name}: ${finding.explanation}`
  )
  .join('\n')}

Document text excerpt:
${rawText.slice(0, 2500)}

Rules:
- Do not claim fraud or wrongdoing without evidence.
- Distinguish missing information from a failed check.
- State the next review action clearly.
- Keep the summary under 120 words.
`;

      const response = await client.models.generateContent({
        model: process.env.GEMINI_SUMMARY_MODEL || 'gemini-2.5-flash',
        contents: [{ text: prompt }]
      });

      const summary = response.text?.trim();

      if (summary) {
        usageTracker.recordCall(
          {
            promptTokens: response.usageMetadata?.promptTokenCount,
            completionTokens: response.usageMetadata?.candidatesTokenCount
          },
          true
        );

        return summary;
      }
    }
  } catch (error: any) {
    usageTracker.recordCall(undefined, false);

    log({
      level: 'INFO',
      operation: 'EXECUTIVE_SUMMARY_FALLBACK',
      message: 'Using deterministic executive summary',
      details: { reason: error?.message || 'fallback' }
    });
  }

  return generateNeutralSummary(
    documentType,
    status,
    assignedQueue,
    findings,
    fields
  );
}

export async function runAgentPipeline(
  options: ProcessDocumentOptions,
  onStageUpdate?: (stage: {
    stage: string;
    message: string;
    subMessage?: string;
  }) => void
): Promise<CaseRecord> {
  const now = new Date().toISOString();
  const caseId = `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const caseNumber = `DOC-${new Date().getFullYear()}-${Math.floor(
    100000 + Math.random() * 900000
  )}`;

  const normalizedFileDataUrl = normalizeDocumentDataUrl(
    options.fileDataUrl,
    options.fileMime,
    options.fileName
  );

  const workingOptions: ProcessDocumentOptions = {
    ...options,
    fileDataUrl: normalizedFileDataUrl
  };

  const uploadValidation = validateUploadFile({
    fileName: options.fileName,
    fileSizeKb: options.fileSizeKb,
    fileMime: options.fileMime
  });

  let rawText = options.rawText?.trim() || '';
  let isUnreadable = Boolean(options.isUnreadable);
  let isSelectablePdf = false;
  let ocrMethod = rawText ? 'Provided Text' : 'Automated Text Extractor';
  let multimodalFields: Record<string, GeminiExtractedField> | null = null;
  let ocrFailed = false;

  const isPdf =
    resolveDocumentMime(
      options.fileMime,
      options.fileName,
      normalizedFileDataUrl
    ) === 'application/pdf';

  onStageUpdate?.({
    stage: 'ingesting',
    message: 'Validating and ingesting uploaded document...',
    subMessage: 'Checking file metadata and preparing extraction'
  });

  if (!uploadValidation.valid) {
    log({
      level: 'WARN',
      operation: 'UPLOAD_VALIDATION_FAILED',
      message: uploadValidation.reason || 'Upload validation failed',
      details: { fileName: options.fileName }
    });
  }

  /*
   * Step 1A: Try extracting selectable text from a PDF first.
   * Scanned PDFs usually have little or no selectable text and continue to OCR.
   */
  if (isPdf && normalizedFileDataUrl && !rawText) {
    onStageUpdate?.({
      stage: 'extracting',
      message: 'Checking PDF text layer...',
      subMessage: 'Extracting selectable text before running OCR'
    });

    const selectable = await extractSelectablePdfText(normalizedFileDataUrl);

    if (selectable?.text) {
      rawText = selectable.text;
      isSelectablePdf = true;
      ocrMethod = 'PDF Text Layer';
    }
  }

  /*
   * Step 1B: Multimodal OCR for image uploads and scanned PDFs.
   * This does not require the payload to have arrived as a data URL because
   * the upload is normalized before this step.
   */
  if (
    !rawText ||
    rawText.length < 15 ||
    options.documentType === 'auto'
  ) {
    if (normalizedFileDataUrl) {
      onStageUpdate?.({
        stage: 'extracting',
        message: 'Extracting document text and fields...',
        subMessage: 'Using multimodal OCR when available'
      });

      const initialType =
        options.documentType !== 'auto'
          ? options.documentType
          : inferDocumentTypeFromText(
              options.fileName,
              rawText,
              options.fileMime
            ) || (Object.keys(DOCUMENT_SCHEMAS)[0] as DocumentType);

      const aiResult = await extractDocumentWithGemini(
        initialType,
        options.fileMime,
        normalizedFileDataUrl,
        options.fileName
      );

      if (aiResult) {
        if (aiResult.rawText.trim().length > rawText.trim().length) {
          rawText = aiResult.rawText.trim();
          ocrMethod = 'Gemini Multimodal OCR';
        }

        if (Object.keys(aiResult.fields).length > 0) {
          multimodalFields = aiResult.fields;
        }

        if (aiResult.isUnreadable && !rawText) {
          isUnreadable = true;
        }

        if (
          options.documentType === 'auto' &&
          aiResult.detectedDocumentType
        ) {
          log({
            level: 'INFO',
            operation: 'AI_DOCUMENT_CLASSIFICATION',
            message: `Gemini identified document as ${aiResult.detectedDocumentType}`
          });
        }
      }
    }
  }

  /*
   * Step 1C: Image OCR fallback.
   * This runs only when text remains unavailable and the payload is an image.
   */
  if (
    !rawText &&
    normalizedFileDataUrl?.startsWith('data:image/') &&
    !isUnreadable
  ) {
    const tesseractText = await extractOcrWithTesseract(
      normalizedFileDataUrl
    );

    if (tesseractText) {
      rawText = tesseractText;
      ocrMethod = 'Tesseract OCR';
    }
  }

  /*
   * Step 2: Detect document type using filename and extracted text.
   */
  onStageUpdate?.({
    stage: 'classifying',
    message: 'Classifying document type...',
    subMessage: 'Comparing document text against supported schemas'
  });

  const detection = detectDocumentType(
    options.fileName,
    rawText,
    options.fileMime
  );

  let finalDocumentType: DocumentType =
    options.documentType !== 'auto'
      ? options.documentType
      : detection.documentType;

  if (
    options.documentType === 'auto' &&
    multimodalFields &&
    normalizedFileDataUrl
  ) {
    const classificationResult = await extractDocumentWithGemini(
      finalDocumentType,
      options.fileMime,
      normalizedFileDataUrl,
      options.fileName
    );

    if (
      classificationResult?.detectedDocumentType &&
      Object.prototype.hasOwnProperty.call(
        DOCUMENT_SCHEMAS,
        classificationResult.detectedDocumentType
      )
    ) {
      finalDocumentType = classificationResult.detectedDocumentType;
    }

    if (
      classificationResult?.rawText &&
      classificationResult.rawText.length > rawText.length
    ) {
      rawText = classificationResult.rawText;
      ocrMethod = 'Gemini Multimodal OCR';
    }

    if (classificationResult?.fields) {
      multimodalFields = classificationResult.fields;
    }
  }

  const schema = DOCUMENT_SCHEMAS[finalDocumentType];

  /*
   * Step 2B: Schema-specific extraction.
   * This second pass uses the final document type so invoice fields are
   * extracted against the invoice schema rather than a generic schema.
   */
  const shouldRunTypedExtraction =
    Boolean(normalizedFileDataUrl) &&
    (
      !multimodalFields ||
      Object.keys(multimodalFields).length === 0 ||
      options.documentType === 'auto' ||
      (isPdf && !isSelectablePdf)
    );

  if (shouldRunTypedExtraction && normalizedFileDataUrl) {
    onStageUpdate?.({
      stage: 'extracting',
      message: `Extracting ${schema.title} fields...`,
      subMessage: 'Matching the document against the selected schema'
    });

    const typedResult = await extractDocumentWithGemini(
      finalDocumentType,
      options.fileMime,
      normalizedFileDataUrl,
      options.fileName
    );

    if (typedResult) {
      if (
        typedResult.rawText &&
        typedResult.rawText.length > rawText.length
      ) {
        rawText = typedResult.rawText;
        ocrMethod = 'Gemini Multimodal OCR';
      }

      if (Object.keys(typedResult.fields).length > 0) {
        multimodalFields = typedResult.fields;
      }

      if (typedResult.isUnreadable && !rawText) {
        isUnreadable = true;
      }
    }
  }

  /*
   * Step 3: Extract schema fields.
   * Prefer Gemini's schema-specific fields but use text-based extraction
   * for any fields Gemini did not return.
   */
  onStageUpdate?.({
    stage: 'analyzing',
    message: 'Analyzing extracted information...',
    subMessage: 'Populating structured fields and confidence scores'
  });

  let extractedFields: ExtractedField[];

  if (rawText.trim() || (multimodalFields && Object.keys(multimodalFields).length)) {
    const fallbackFields = extractFieldsFromText(
      finalDocumentType,
      rawText,
      options.manualFields
    );

    if (multimodalFields && Object.keys(multimodalFields).length > 0) {
      const mappedAiFields = mapGeminiFieldsToSchema(
        finalDocumentType,
        multimodalFields,
        caseId,
        options.manualFields
      );

      extractedFields = mappedAiFields.map((aiField) => {
        const fallback = fallbackFields.find(
          (field) => field.field_name === aiField.field_name
        );

        if (!aiField.field_value && fallback?.field_value) {
          return {
            ...aiField,
            field_value: fallback.field_value,
            confidence: fallback.confidence,
            is_uncertain: fallback.is_uncertain
          };
        }

        return aiField;
      });

      for (const field of extractedFields) {
        field.case_id = caseId;
        field.field_id = `fld-${caseId}-${field.field_name}`;
      }
    } else {
      extractedFields = fallbackFields;

      for (const field of extractedFields) {
        field.case_id = caseId;
        field.field_id = `fld-${caseId}-${field.field_name}`;
      }
    }
  } else {
    isUnreadable = isUnreadable || Boolean(options.isUnreadable);
    ocrFailed = !isUnreadable;

    extractedFields = schema.fields.map((definition) => {
      const manualValue = options.manualFields?.[definition.name] || '';

      return {
        field_id: `fld-${caseId}-${definition.name}`,
        case_id: caseId,
        field_name: definition.name,
        field_label: definition.label,
        field_value: manualValue,
        confidence: manualValue ? 0.98 : 0,
        is_uncertain: Boolean(definition.required && !manualValue),
        is_edited: Boolean(manualValue)
      };
    });
  }

  /*
   * If extraction found no text but did return useful fields, do not mark the
   * document unreadable solely because the OCR text stream is empty.
   */
  if (
    !rawText.trim() &&
    (!multimodalFields || Object.keys(multimodalFields).length === 0) &&
    !isUnreadable
  ) {
    ocrFailed = true;
  }

  /*
   * Step 4: Deterministic validation.
   */
  onStageUpdate?.({
    stage: 'validating',
    message: 'Validating extracted information...',
    subMessage: 'Running schema rules and consistency checks'
  });

  const findings: ValidationFinding[] = isUnreadable
    ? [
        {
          finding_id: `find-unreadable-${caseId}`,
          case_id: caseId,
          check_name: 'Raster Quality & Glyph Resolution',
          category: 'format_error',
          result: 'failed',
          severity: 'high',
          explanation:
            'The submitted document appears illegible, blank, corrupted, or severely degraded. Automated extraction could not recover readable content.',
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

  /*
   * Step 5: Routing decision.
   */
  const decision = evaluateAndRoute(
    findings,
    isUnreadable,
    finalDocumentType
  );

  /*
   * Step 6: Agent trace.
   */
  const trace = buildAgentTrace(
    finalDocumentType,
    options.fileName,
    extractedFields.filter((field) => Boolean(field.field_value)).length,
    findings.length,
    decision,
    {
      isUnreadable,
      ocrFailed,
      ocrMethod
    }
  );

  /*
   * Step 7: Executive summary.
   */
  onStageUpdate?.({
    stage: 'summarizing',
    message: 'Preparing case summary...',
    subMessage: 'Generating a neutral review summary'
  });

  const executiveSummary = await generateExecutiveSummary(
    finalDocumentType,
    decision.status,
    decision.assignedQueue,
    findings,
    extractedFields,
    rawText
  );

  /*
   * Step 8: Audit events.
   */
  const auditEvents: AuditEvent[] = [
    {
      event_id: `evt-${caseId}-1`,
      case_id: caseId,
      event_type: 'CASE_CREATED',
      actor: 'System',
      summary: `Document submitted: "${sanitizeFileName(options.fileName)}" (${options.fileSizeKb} KB). Assigned Case Number ${caseNumber}.`,
      details: `Initial Target: ${options.documentType}, MIME: ${options.fileMime}`,
      created_at: now
    },
    {
      event_id: `evt-${caseId}-dt`,
      case_id: caseId,
      event_type: 'DOCUMENT_TYPE_DETECTED',
      actor: 'AI Agent',
      summary: `Document classified as "${schema.title}" (${Math.round(detection.confidence * 100)}% confidence).`,
      details: detection.reason,
      created_at: new Date(Date.now() + 100).toISOString()
    },
    {
      event_id: `evt-${caseId}-2`,
      case_id: caseId,
      event_type: ocrFailed ? 'OCR_EXTRACTION_FAILED' : 'TEXT_EXTRACTED',
      actor: 'AI Agent',
      summary: isUnreadable
        ? 'OCR text stream halted because the document was marked unreadable.'
        : ocrFailed
          ? 'Automated extraction recovered no usable text or fields. Manual review is required.'
          : `Extracted ${rawText.length} text characters using ${ocrMethod}. Selectable PDF text: ${isSelectablePdf ? 'YES' : 'NO'}.`,
      created_at: new Date(Date.now() + 200).toISOString()
    },
    {
      event_id: `evt-${caseId}-3`,
      case_id: caseId,
      event_type: ocrFailed ? 'SCHEMA_EXTRACTION_FAILED' : 'FIELDS_EXTRACTED',
      actor: 'AI Agent',
      summary: ocrFailed
        ? 'Schema extraction could not populate fields from the submitted document.'
        : `Extracted ${extractedFields.filter((field) => Boolean(field.field_value)).length} schema fields for ${schema.title}.`,
      created_at: new Date(Date.now() + 400).toISOString()
    },
    {
      event_id: `evt-${caseId}-4`,
      case_id: caseId,
      event_type: 'VALIDATION_RUN',
      actor: 'AI Agent',
      summary: `Validation rules executed: ${findings.filter((finding) => finding.result !== 'passed').length} active flags generated.`,
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
      summary: `Affirmative consent captured for document processing under Notice v${consentRecordObj.notice_version}.`,
      details: `Legal basis flagged: "${consentRecordObj.legal_basis}". Purpose: "${consentRecordObj.purpose}".`,
      created_at: now
    });
  }

  const retentionUntil = new Date(
    Date.now() + 90 * 24 * 60 * 60 * 1000
  ).toISOString();

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
    processing_error: isUnreadable
      ? 'Document raster glyphs unreadable'
      : undefined,
    extracted_fields: extractedFields,
    validation_findings: findings,
    review_actions: [],
    audit_events: auditEvents,
    agent_trace: trace,
    consent_record: consentRecordObj,
    retention_until: retentionUntil,
    is_purged: false
  };

  caseStore.add(caseRecord);

  onStageUpdate?.({
    stage: 'ready',
    message: 'Processing complete. Review ready.',
    subMessage: `Case ${caseNumber} routed to ${decision.assignedQueue} (${decision.status})`
  });

  return caseRecord;
}

/**
 * Re-evaluates an existing case after a reviewer edits fields or resolves
 * validation findings.
 */
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
      (previousFinding) =>
        previousFinding.check_name === finding.check_name
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

  const summary = await generateExecutiveSummary(
    existing.document_type,
    decision.status,
    decision.assignedQueue,
    findings,
    existing.extracted_fields,
    existing.raw_text
  );

  return caseStore.update(caseId, (record) => {
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
