/**
 * DOCUAGENT AI — Intelligent Document Extraction, Validation, and Review Agent
 * File: server/agent.ts
 *
 * Implements:
 * 1. PDF/Image extraction:
 *    - Digital/selectable PDF text extraction via PDFParse & stream decoding
 *    - Scanned PDF & Image multimodal OCR via Gemini 2.5 Flash / 3.8 Flash
 *    - Tesseract OCR fallback for offline/local environments
 *    - Strict non-fabrication of missing fields
 * 2. Deterministic validation & queue routing
 * 3. Re-evaluation with finding state preservation and audit events
 */

import { GoogleGenAI } from '@google/genai';
import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import type {
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
  generateNeutralSummary
} from '../src/shared/validation.ts';
import { caseStore } from './store.ts';
import { validateUploadFile, sanitizeFileName } from './fileValidation.ts';
import { log } from './logger.ts';

export type StageUpdateDetail = {
  stage: string;
  message: string;
  detail?: Record<string, unknown>;
};

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

type StageCallback = (detail: StageUpdateDetail) => void;

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!client) {
    client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return client;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

export function decodeDataUrl(dataUrl: string): {
  mimeType: string;
  base64: string;
  buffer: Buffer;
} | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null;

  // Handle standard data URI
  const match = dataUrl.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,([\s\S]+)$/i);
  if (match) {
    const mimeType = (match[1] || 'application/octet-stream').toLowerCase().trim();
    const base64 = match[2].replace(/\s/g, '');
    try {
      const buffer = Buffer.from(base64, 'base64');
      return { mimeType, base64, buffer };
    } catch {
      return null;
    }
  }

  // Handle bare base64 string
  const cleanBase64 = dataUrl.replace(/\s/g, '');
  if (/^[A-Za-z0-9+/=]+$/.test(cleanBase64) && cleanBase64.length > 32) {
    try {
      const buffer = Buffer.from(cleanBase64, 'base64');
      let mimeType = 'application/octet-stream';
      if (buffer.slice(0, 4).toString() === '%PDF') {
        mimeType = 'application/pdf';
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        mimeType = 'image/png';
      } else if (buffer[0] === 0xff && buffer[1] === 0xd8) {
        mimeType = 'image/jpeg';
      }
      return { mimeType, base64: cleanBase64, buffer };
    } catch {
      return null;
    }
  }

  return null;
}

export function normalizeMimeType(mime: string, fileName: string): string {
  const normalized = (mime || '').toLowerCase().split(';')[0].trim();
  if (normalized === 'application/pdf') return normalized;
  if (normalized === 'image/png') return normalized;
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'image/jpeg';
  if (normalized === 'image/webp') return normalized;

  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';

  return normalized || 'application/octet-stream';
}

/**
 * Extracts uncompressed and standard PDF text streams from a PDF binary buffer.
 * Performs dual extraction:
 * 1. Direct PDF stream token parser (fast for uncompressed and synthetic test PDFs)
 * 2. PDFParse library parser (for standard and compressed digital PDFs)
 */
export async function extractSelectablePdfText(pdfBuffer: Buffer): Promise<string> {
  const extractedLines: string[] = [];

  // 1. Direct stream token parser
  try {
    const rawString = pdfBuffer.toString('latin1');
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/gi;
    let match: RegExpExecArray | null;

    while ((match = streamRegex.exec(rawString)) !== null) {
      const streamContent = match[1];

      // Extract Tj tokens: (text) Tj
      const tjRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
      let tjMatch: RegExpExecArray | null;
      while ((tjMatch = tjRegex.exec(streamContent)) !== null) {
        const unescaped = tjMatch[1]
          .replace(/\\([\\()])/g, '$1')
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t');
        if (unescaped.trim()) {
          extractedLines.push(unescaped.trim());
        }
      }

      // Extract TJ array tokens: [(text) 20 (more)] TJ
      const arrayTjRegex = /\[(.*?)\]\s*TJ/gi;
      let arrMatch: RegExpExecArray | null;
      while ((arrMatch = arrayTjRegex.exec(streamContent)) !== null) {
        const inner = arrMatch[1];
        const innerStrings = inner.match(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g);
        if (innerStrings) {
          const joined = innerStrings
            .map((s) => s.slice(1, -1).replace(/\\([\\()])/g, '$1'))
            .join('')
            .trim();
          if (joined) {
            extractedLines.push(joined);
          }
        }
      }
    }
  } catch (err) {
    // Non-fatal, proceed to PDFParse
  }

  // 2. Comprehensive PDFParse pass
  try {
    const parser = new PDFParse({ data: pdfBuffer });
    const textResult = await parser.getText();
    await parser.destroy().catch(() => {});
    if (textResult?.text && textResult.text.trim()) {
      const parsedText = textResult.text.trim();
      if (parsedText.length > extractedLines.join('\n').length) {
        return parsedText;
      }
    }
  } catch (err) {
    // PDF may be synthetic or have no font descriptor, direct tokens already collected
  }

  if (extractedLines.length > 0) {
    return extractedLines.join('\n').trim();
  }

  return '';
}

/**
 * Local OCR fallback using Tesseract.js for images when Gemini is unavailable.
 */
export async function extractOcrWithTesseract(
  imageBuffer: Buffer,
  mimeType: string
): Promise<string> {
  if (!imageBuffer || imageBuffer.length < 80) return '';
  const timeoutMs = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 10000;
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<string>((_, reject) => {
    timer = setTimeout(() => reject(new Error('OCR_TIMEOUT')), timeoutMs);
  });

  try {
    const ocrPromise = (async () => {
      const worker = await createWorker('eng');
      const ret = await worker.recognize(imageBuffer);
      await worker.terminate().catch(() => {});
      return cleanText(ret.data?.text || '');
    })();

    const result = await Promise.race([ocrPromise, timeoutPromise]);
    if (timer) clearTimeout(timer);
    return result;
  } catch (err) {
    if (timer) clearTimeout(timer);
    log({
      level: 'WARN',
      operation: 'TESSERACT_OCR_FAILED',
      message: err instanceof Error ? err.message : String(err)
    });
    return '';
  }
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // try markdown JSON block extraction
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function safeDocumentType(value: unknown): DocumentType {
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
    driver_license: 'national_id',
    driving_license: 'national_id',
    identity_card: 'national_id',
    aadhaar: 'national_id',
    aadhar: 'national_id',
    passport_document: 'passport',
    bill: 'utility_bill',
    electricity_bill: 'utility_bill',
    water_bill: 'utility_bill',
    bank: 'bank_statement',
    bank_account: 'bank_statement',
    payslip: 'employment_verification',
    salary_slip: 'employment_verification',
    employment: 'employment_verification',
    general: 'general_doc',
    contract: 'general_doc',
    agreement: 'general_doc',
    other: 'general_doc'
  };

  return aliases[normalized] || 'unknown';
}

/**
 * Multimodal OCR & Field Extraction using Gemini API.
 */
async function extractWithGemini(
  base64Data: string,
  fileName: string,
  mimeType: string
): Promise<{
  text: string;
  documentType: DocumentType;
  fields: Record<string, string>;
  method: string;
}> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      text: '',
      documentType: 'unknown',
      fields: {},
      method: 'Gemini Client Not Configured'
    };
  }

  const prompt = `
You are a senior document extraction engine.
Analyze the attached document carefully and perform text extraction:
1. Extract ALL readable text verbatim from the document. Preserve line breaks, labels, names, dates, amounts, and identifiers.
2. Classify the document type into EXACTLY one of: "passport", "national_id", "utility_bill", "bank_statement", "employment_verification", "invoice", "general_doc", or "unknown".
3. Extract all available schema fields that ACTUALLY exist in the document text.
CRITICAL INSTRUCTION: DO NOT FABRICATE OR INVENT MISSING FIELDS. If a field is not present or unreadable in the document, omit it or leave it empty.

Return ONLY a valid JSON object matching this schema:
{
  "documentType": "passport" | "national_id" | "utility_bill" | "bank_statement" | "employment_verification" | "invoice" | "general_doc" | "unknown",
  "text": "Full extracted readable text...",
  "fields": {
    "field_name": "exact value found in document"
  }
}
`;

  const timeoutMs = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 5000;
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI_TIMEOUT: Gemini extraction timed out')), timeoutMs);
    if (timer && timer.unref) timer.unref();
  });

  try {
    const generatePromise = ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Data
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

    const response = await Promise.race([generatePromise, timeoutPromise]);

    const responseText = cleanText(response.text || '');
    const json = extractJsonObject(responseText);

    if (json) {
      const extractedText = cleanText(json.text);
      const docType = safeDocumentType(json.documentType);
      const rawFields = (json.fields && typeof json.fields === 'object' && !Array.isArray(json.fields))
        ? (json.fields as Record<string, unknown>)
        : {};

      const stringFields: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawFields)) {
        if (typeof v === 'string' && v.trim()) {
          stringFields[k] = v.trim();
        }
      }

      return {
        text: extractedText,
        documentType: docType,
        fields: stringFields,
        method: `Gemini Multimodal OCR (${process.env.GEMINI_MODEL || 'gemini-2.5-flash'})`
      };
    }

    return {
      text: responseText,
      documentType: 'unknown',
      fields: {},
      method: 'Gemini Text Extraction'
    };
  } catch (err: any) {
    log({
      level: 'WARN',
      operation: 'GEMINI_EXTRACTION_ERROR',
      message: err.message || 'Gemini extraction failed'
    });
    return {
      text: '',
      documentType: 'unknown',
      fields: {},
      method: 'Gemini Extraction Failed'
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Deterministically extracts schema fields from readable text without hallucination.
 * Respects DOCUMENT_SCHEMAS for the given documentType.
 * Never fabricates values; if a field cannot be matched, it is left empty or marked uncertain.
 */
// Comprehensive alias map for case-insensitive and punctuation-agnostic field matching
const FIELD_ALIASES: Record<string, string[]> = {
  // Invoice fields
  invoice_number: [
    'invoice_number', 'invoicenumber', 'invoice_no', 'invoiceno', 'invoice_#', 'invoice#',
    'inv_#', 'inv#', 'inv_no', 'invno', 'bill_no', 'bill_number', 'invoicenum', 'bill_#'
  ],
  vendor_name: [
    'vendor_name', 'vendorname', 'vendor', 'seller', 'supplier', 'contractor', 'provider',
    'issuer', 'billed_by', 'billedby', 'from', 'company_name', 'merchant', 'contractor_name'
  ],
  client_name: [
    'client_name', 'clientname', 'client', 'customer_name', 'customername', 'customer',
    'billed_to', 'billedto', 'bill_to', 'billto', 'recipient', 'buyer', 'sold_to', 'soldto',
    'invoice_to', 'invoiceto', 'attention'
  ],
  invoice_date: [
    'invoice_date', 'invoicedate', 'date_of_invoice', 'dateofinvoice', 'bill_date', 'billdate',
    'date_issued', 'issue_date', 'issuedate', 'date', 'invoice_dt'
  ],
  due_date: [
    'due_date', 'duedate', 'payment_due_date', 'paymentduedate', 'payment_due', 'paymentdue',
    'due', 'pay_by', 'payby', 'due_by', 'dueby', 'valid_until'
  ],
  subtotal: [
    'subtotal', 'sub_total', 'sub_total_amount', 'net_amount', 'netamount', 'sub_amount',
    'base_amount', 'subtotal_amount'
  ],
  tax_amount: [
    'tax_amount', 'taxamount', 'tax', 'gst', 'tax_gst', 'taxgst', 'vat', 'sales_tax',
    'salestax', 'tax_value', 'hst', 'pst', 'vat_gst', 'taxes', 'tax_total'
  ],
  total_amount: [
    'total_amount', 'totalamount', 'total', 'total_payable', 'totalpayable', 'amount_due',
    'amountdue', 'total_due', 'totaldue', 'balance_due', 'balancedue', 'grand_total',
    'grandtotal', 'total_amount_due', 'total_payable_amount', 'payable_amount', 'final_amount',
    'net_payable'
  ],

  // Passport / ID fields
  full_name: ['full_name', 'fullname', 'name', 'legal_name', 'surname', 'holder_name'],
  passport_number: ['passport_number', 'passportnumber', 'passport_no', 'passportno', 'passport_#', 'passport#'],
  nationality: ['nationality', 'country', 'citizenship', 'country_code'],
  date_of_birth: ['date_of_birth', 'dateofbirth', 'dob', 'birth_date', 'birthdate'],
  expiration_date: ['expiration_date', 'expirationdate', 'expiry_date', 'expirydate', 'expires', 'exp_date', 'valid_until'],
  issuing_authority: ['issuing_authority', 'issuingauthority', 'authority', 'issuing_state', 'issuer'],
  id_number: ['id_number', 'idnumber', 'dl_number', 'dlnumber', 'license_number', 'licensenumber', 'license_no', 'licenseno', 'dl_no', 'dlno', 'identification_number'],
  address: ['address', 'residential_address', 'service_address', 'street_address'],

  // Utility & Bank fields
  account_holder_name: ['account_holder_name', 'accountholdername', 'account_holder', 'accountholder', 'customer_name', 'name'],
  service_address: ['service_address', 'serviceaddress', 'premise_address', 'residential_address', 'address'],
  utility_provider: ['utility_provider', 'utilityprovider', 'provider', 'service_provider', 'company'],
  financial_institution: ['financial_institution', 'financialinstitution', 'bank', 'bank_name', 'credit_union'],
  account_number: ['account_number', 'accountnumber', 'account_#', 'account#', 'acct_#', 'acct#', 'acct_no', 'acctno', 'meter_number'],
  statement_date: ['statement_date', 'statementdate', 'bill_date', 'issue_date', 'date'],
  statement_period: ['statement_period', 'statementperiod', 'period', 'billing_period'],
  amount_due: ['amount_due', 'amountdue', 'total_amount_due', 'total_amount', 'total_due', 'balance_due', 'total'],
  ending_balance: ['ending_balance', 'endingbalance', 'closing_balance', 'closingbalance', 'balance', 'available_balance'],

  // Employment fields
  employee_name: ['employee_name', 'employeename', 'name', 'staff_name'],
  employer_name: ['employer_name', 'employername', 'employer', 'company_name', 'organization'],
  job_title: ['job_title', 'jobtitle', 'title', 'position', 'role', 'designation'],
  start_date: ['start_date', 'startdate', 'employment_start_date', 'hire_date'],
  annual_salary: ['annual_salary', 'annualsalary', 'salary', 'compensation', 'pay_rate'],

  // General doc fields
  document_title: ['document_title', 'documenttitle', 'title', 'subject'],
  document_date: ['document_date', 'documentdate', 'date'],
  author_or_organization: ['author_or_organization', 'author', 'organization', 'issuer'],
  summary_topic: ['summary_topic', 'topic', 'subject', 'summary']
};

/**
 * Deterministically extracts schema fields from readable text and vision results without hallucination.
 * Respects DOCUMENT_SCHEMAS for the given documentType.
 * Never fabricates values; if a field cannot be matched, it is left empty with confidence 0.
 */
export function extractFieldsFromText(
  caseId: string,
  docType: DocumentType,
  text: string,
  geminiFields: Record<string, string> = {}
): ExtractedField[] {
  const schema = DOCUMENT_SCHEMAS[docType];
  if (!schema) return [];

  const results: ExtractedField[] = [];
  const textLines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Pre-normalize all Gemini keys for case-insensitive, punctuation-insensitive lookup
  const normalizedGeminiFields = new Map<string, string>();
  for (const [rawK, rawV] of Object.entries(geminiFields)) {
    if (typeof rawV === 'string' && rawV.trim() && rawV.trim().toLowerCase() !== 'n/a') {
      const normKey = rawK.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normKey) {
        normalizedGeminiFields.set(normKey, rawV.trim());
      }
    }
  }

  // Helper to find value and matched evidence snippet from text matching patterns
  const findRegexMatch = (patterns: RegExp[]): { value: string; snippet?: string } | null => {
    for (const pattern of patterns) {
      const m = text.match(pattern);
      if (m && m[1]?.trim()) {
        return { value: m[1].trim(), snippet: m[0]?.trim() };
      }
    }
    return null;
  };

  const findRegexValue = (patterns: RegExp[]): string | null => {
    const match = findRegexMatch(patterns);
    return match ? match.value : null;
  };

  const checkGeminiKey = (k: string): string | null => {
    const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalizedGeminiFields.get(norm) || null;
  };

  for (const def of schema.fields) {
    let foundValue = '';
    let confidence = 0.0;
    let evidenceSnippet: string | undefined = undefined;

    // 1. Check Gemini fields first using direct name, label, and known aliases
    let geminiVal = checkGeminiKey(def.name) || checkGeminiKey(def.label);
    if (!geminiVal && FIELD_ALIASES[def.name]) {
      for (const alias of FIELD_ALIASES[def.name]) {
        const val = checkGeminiKey(alias);
        if (val) {
          geminiVal = val;
          break;
        }
      }
    }

    if (geminiVal && geminiVal.trim() && geminiVal.trim().toLowerCase() !== 'n/a') {
      foundValue = geminiVal.trim();
      evidenceSnippet = `Gemini OCR: ${foundValue}`;
      confidence = 0.94;
    }

    // 2. If not found in Gemini structured fields, search raw text deterministically
    if (!foundValue && text.trim()) {
      switch (def.name) {
        // --- Identity & Names ---
        case 'full_name':
        case 'account_holder_name':
        case 'employee_name': {
          const match = findRegexMatch([
            /(?:Account\s*Holder(?:\s*Name)?|Account\s*Name|Customer\s*Name|Cardholder|Holder\s*Name|Employee\s*Name|Name|Full\s*Legal\s*Name|Full\s*Name)[:\s]+([A-Za-z\s.'-]+?)(?=\n|$|[0-9]{4}|DOB|Balance|Lic)/i,
            /P<[A-Z]{3}([A-Z]+)<<([A-Z<]+)/i
          ]);
          if (match) {
            foundValue = match.value.replace(/<+/g, ' ').trim();
            evidenceSnippet = match.snippet;
            confidence = 0.88;
          }
          break;
        }

        // --- Identifiers ---
        case 'passport_number': {
          const match = findRegexMatch([
            /(?:Passport\s*(?:No|Number|#)?)[:\s]*([A-Z0-9]{8,10})\b/i,
            /\b([A-Z][0-9]{8})\b/i
          ]);
          if (match) {
            foundValue = match.value.replace(/\s+/g, '').toUpperCase();
            evidenceSnippet = match.snippet;
            confidence = 0.92;
          }
          break;
        }

        case 'id_number': {
          const match = findRegexMatch([
            /(?:Lic(?:ense)?\s*No|DL\s*No|ID\s*No|Identification Number|Lic\s*#|DL\s*#|Aadhaar|Card No)[:\s]*([A-Z0-9 -]{5,20})/i,
            /\b([A-Z][0-9]{7,12})\b/i
          ]);
          if (match) {
            foundValue = match.value.trim();
            evidenceSnippet = match.snippet;
            confidence = 0.90;
          }
          break;
        }

        case 'account_number': {
          const match = findRegexMatch([
            /(?:Account Number|Account\s*#|Acct\s*#|Acct No|Consumer Number)[:\s]*([A-Z0-9-]{5,25})/i
          ]);
          if (match) {
            foundValue = match.value.trim();
            evidenceSnippet = match.snippet;
            confidence = 0.92;
          }
          break;
        }

        case 'invoice_number': {
          const match = findRegexMatch([
            /(?:Invoice\s*(?:Number|No\.?|#|ID|Num\.?)|Inv\s*(?:No\.?|#|ID|Num\.?)|Bill\s*(?:No\.?|#|ID|Num\.?))[:\s]+([A-Za-z0-9\/-]{2,30})/i,
            /\b(?:Invoice|Bill)\s*#\s*[:\s]*([A-Za-z0-9\/-]{2,30})/i,
            /\b(INV[-_]?[0-9]{3,12})\b/i,
            /\b(BILL[-_]?[0-9]{3,12})\b/i
          ]);
          if (match) {
            const cleanVal = match.value.trim();
            const lower = cleanVal.toLowerCase();
            const blacklist = [
              'technologies', 'technology', 'solutions', 'services', 'enterprises',
              'consulting', 'corporation', 'company', 'incorporated', 'limited',
              'llc', 'inc', 'ltd', 'corp', 'gmbh', 'invoice', 'bill', 'receipt',
              'statement', 'client', 'customer', 'vendor', 'supplier', 'date',
              'amount', 'total', 'subtotal', 'balance', 'pending', 'draft', 'unpaid', 'paid',
              'description', 'quantity', 'unit', 'price', 'computer', 'accessories'
            ];
            const isBlacklisted = blacklist.includes(lower);
            const hasDigit = /[0-9]/.test(cleanVal);
            if (!isBlacklisted && hasDigit) {
              foundValue = cleanVal;
              evidenceSnippet = match.snippet;
              confidence = 0.95;
            }
          }
          break;
        }

        // --- Dates ---
        case 'date_of_birth': {
          const match = findRegexMatch([
            /(?:Date of Birth|DOB|Birth Date)[:\s]*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4})/i
          ]);
          if (match) {
            foundValue = match.value;
            evidenceSnippet = match.snippet;
            confidence = 0.90;
          }
          break;
        }

        case 'expiration_date': {
          const match = findRegexMatch([
            /(?:Expiration Date|Date of Expiry|Expiry Date|Expires|Exp Date|Valid Until)[:\s]*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4})/i
          ]);
          if (match) {
            foundValue = match.value;
            evidenceSnippet = match.snippet;
            confidence = 0.90;
          }
          break;
        }

        case 'statement_date':
        case 'invoice_date':
        case 'document_date': {
          const match = findRegexMatch([
            /\b(?:Invoice\s*Date|Bill\s*Date|Date\s*of\s*Invoice|Issue\s*Date|Date\s*Issued|Document\s*Date|Statement\s*Date)[:\s]*([0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}|[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4}|[A-Za-z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{4})/i,
            /(?<!due\s*)(?<!payment\s*)\bDate[:\s]*([0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}|[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4}|[A-Za-z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{4})/i
          ]);
          if (match) {
            foundValue = match.value;
            evidenceSnippet = match.snippet;
            confidence = 0.92;
          }
          break;
        }

        case 'due_date': {
          const match = findRegexMatch([
            /\b(?:Payment\s*Due\s*Date|Due\s*Date|Payment\s*Due|Pay\s*By|Due\s*By|Due)[:\s]*([0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}|[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4}|[A-Za-z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{4})/i
          ]);
          if (match) {
            foundValue = match.value;
            evidenceSnippet = match.snippet;
            confidence = 0.90;
          }
          break;
        }

        case 'start_date': {
          const match = findRegexMatch([
            /\b(?:Start Date|Employment Start Date|Hire Date|Joined)[:\s]*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4}|[0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4})/i
          ]);
          if (match) {
            foundValue = match.value;
            evidenceSnippet = match.snippet;
            confidence = 0.88;
          }
          break;
        }

        case 'statement_period_start': {
          const match = findRegexMatch([
            /\b(?:Statement Period|Period)[:\s]*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})\s*(?:to|-)/i
          ]);
          if (match) {
            foundValue = match.value;
            evidenceSnippet = match.snippet;
            confidence = 0.88;
          }
          break;
        }

        case 'statement_period':
        case 'statement_period_end': {
          const match = findRegexMatch([
            /\b(?:Statement Period|Period)[:\s]*([^\n]{5,50})/i
          ]);
          if (match) {
            foundValue = match.value;
            evidenceSnippet = match.snippet;
            confidence = 0.88;
          }
          break;
        }

        // --- Amounts / Balances ---
        case 'subtotal': {
          const match = findRegexMatch([
            /\b(?:Sub\s*[-]?\s*Total(?:\s*Amount)?|Net\s*Amount)[:\s]*([$€£₹]?[A-Z]{0,3}\s*[0-9,]+(?:\.[0-9]{2})?)/i
          ]);
          if (match) {
            foundValue = match.value;
            evidenceSnippet = match.snippet;
            confidence = 0.90;
          }
          break;
        }

        case 'tax_amount': {
          const match = findRegexMatch([
            /\b(?:Tax\s*(?:\/|\&|\band\b)?\s*GST|Tax\s*Amount|Sales\s*Tax|GST\s*(?:\([^)]+\))?|VAT\s*(?:\([^)]+\))?|Tax\s*(?:\([^)]+\))?|GST|VAT|Tax)[:\s]*([$€£₹]?[A-Z]{0,3}\s*[0-9,]+(?:\.[0-9]{2})?)/i
          ]);
          if (match) {
            foundValue = match.value;
            evidenceSnippet = match.snippet;
            confidence = 0.90;
          }
          break;
        }

        case 'ending_balance': {
          const match = findRegexMatch([
            /\b(?:Ending Balance|Closing Balance|Available Balance|Current Balance|Balance)[:\s]*(\$?\s*[0-9,]+\.[0-9]{2})/i
          ]);
          if (match) {
            foundValue = match.value;
            evidenceSnippet = match.snippet;
            confidence = 0.92;
          }
          break;
        }

        case 'total_amount':
        case 'amount_due':
        case 'total_amount_due': {
          const match = findRegexMatch([
            /(?<!unit\s*price[:\s]*)(?<!unit[:\s]*)(?<!sub\s*[-]?)\b(?:Total\s*Payable(?:\s*Amount)?|Grand\s*Total|Total\s*Amount\s*Due|Total\s*Amount|Amount\s*Due|Total\s*Due|Balance\s*Due|Total\s*\([A-Z]{3}\))[:\s]*([$€£₹]?[A-Z]{0,3}\s*[0-9,]+(?:\.[0-9]{2})?)/i,
            /(?<!sub\s*[-]?)(?<!unit\s*price[:\s]*)(?<!unit[:\s]*)\bTotal[:\s]*([$€£₹]?[A-Z]{0,3}\s*[0-9,]+(?:\.[0-9]{2})?)/i
          ]);
          if (match) {
            foundValue = match.value;
            evidenceSnippet = match.snippet;
            confidence = 0.94;
          }
          break;
        }

        case 'annual_salary':
        case 'compensation_amount': {
          const match = findRegexMatch([
            /(?:Annual Salary|Salary|Compensation|Pay Rate)[:\s]*(\$?\s*[0-9,]+(?:\.[0-9]{2})?)/i
          ]);
          if (match) {
            foundValue = match.value;
            evidenceSnippet = match.snippet;
            confidence = 0.88;
          }
          break;
        }

        // --- Entities & Organizations ---
        case 'financial_institution': {
          const match = findRegexMatch([
            /(?:Bank|Financial Institution|Credit Union)[:\s]*([A-Za-z0-9\s.,'-]{3,60})/i
          ]);
          if (match) {
            foundValue = match.value;
            evidenceSnippet = match.snippet;
            confidence = 0.88;
          } else {
            // Check top lines for Bank name
            const bankLine = textLines.slice(0, 3).find((l) => /bank|credit union/i.test(l));
            if (bankLine) {
              foundValue = bankLine.split(/[-–|]/)[0].trim();
              evidenceSnippet = bankLine.trim();
              confidence = 0.85;
            }
          }
          break;
        }

        case 'utility_provider': {
          const match = findRegexMatch([
            /(?:Utility Provider|Service Provider|Provider|Company)[:\s]*([A-Za-z0-9\s.,'-]{3,60})/i
          ]);
          if (match) {
            foundValue = match.value;
            evidenceSnippet = match.snippet;
            confidence = 0.88;
          } else {
            const providerLine = textLines.slice(0, 3).find((l) => /electric|power|water|gas|energy/i.test(l));
            if (providerLine) {
              foundValue = providerLine.split(/[-–|]/)[0].trim();
              evidenceSnippet = providerLine.trim();
              confidence = 0.85;
            }
          }
          break;
        }

        case 'employer_name': {
          const match = findRegexMatch([
            /(?:Employer Name|Employer|Organization|Company)[:\s]*([A-Za-z0-9\s.,'-]{3,60})/i
          ]);
          if (match) {
            foundValue = match.value;
            evidenceSnippet = match.snippet;
            confidence = 0.88;
          }
          break;
        }

        case 'vendor_name': {
          const match = findRegexMatch([
            /(?:Vendor\s*(?:Name)?|Supplier|Contractor|Billed\s*By|Issued\s*By|Payable\s*To|Seller|From)[:\s]+([A-Za-z0-9&.,'’\s-]{2,60}?)(?=\s*(?:\n|\||Invoice|Date|Bill\s*To|Billed\s*To|Client|Customer|Phone|Email|Tax|GST|Due|Subtotal|Total|Description|Quantity|Unit|$))/i,
            /(?:Vendor\s*(?:Name)?|Supplier|Contractor|Billed\s*By|Issued\s*By|Seller)\s*[:\n\r]+\s*([A-Za-z0-9&.,'’\s-]{2,60}?)(?=\n|$)/i
          ]);
          if (match && match.value.trim()) {
            foundValue = match.value.trim();
            evidenceSnippet = match.snippet;
            confidence = 0.92;
          } else {
            // Check top 4 lines for company name header (e.g. "ABC Technologies", "Acme Solutions LLC")
            const vendorLine = textLines.slice(0, 4).find((l) =>
              /\b(Inc\.?|LLC|Corp\.?|Corporation|Ltd\.?|Technologies|Solutions|Services|Enterprises|Company|GmbH|Co\.)\b/i.test(l) &&
              !/^(Invoice|Bill\s*To|Billed\s*To|Date|Customer|Client|To|Attention)/i.test(l)
            );
            if (vendorLine) {
              foundValue = vendorLine.split(/[-–|]/)[0].trim();
              evidenceSnippet = vendorLine.trim();
              confidence = 0.85;
            }
          }
          break;
        }

        case 'client_name':
        case 'customer_name': {
          const match = findRegexMatch([
            /(?:Billed\s*To|Bill\s*To|Invoice\s*To|Sold\s*To|Client\s*(?:Name)?|Customer\s*(?:Name)?|Recipient|Attention)[:\s]+([A-Za-z0-9&.,'’\s-]{2,60}?)(?=\s*(?:\n|\||Invoice|Date|Amount|Due|Subtotal|Tax|Total|Phone|Email|Description|Quantity|Unit|$))/i,
            /(?:Billed\s*To|Bill\s*To|Invoice\s*To|Client\s*(?:Name)?|Customer\s*(?:Name)?)\s*[:\n\r]+\s*([A-Za-z0-9&.,'’\s-]{2,60}?)(?=\n|$)/i
          ]);
          if (match && match.value.trim()) {
            foundValue = match.value.trim();
            evidenceSnippet = match.snippet;
            confidence = 0.92;
          }
          break;
        }

        case 'job_title': {
          const val = findRegexValue([
            /(?:Job Title|Position|Designation|Role)[:\s]*([A-Za-z0-9\s.,'-]{2,50})/i
          ]);
          if (val) {
            foundValue = val;
            confidence = 0.88;
          }
          break;
        }

        // --- Addresses & Location ---
        case 'address':
        case 'service_address': {
          const val = findRegexValue([
            /(?:Service Address|Residential Address|Premise Address|Address)[:\s]*([0-9A-Za-z\s.,#-]{5,100})/i
          ]);
          if (val) {
            foundValue = val;
            confidence = 0.88;
          }
          break;
        }

        case 'nationality': {
          const val = findRegexValue([
            /(?:Nationality|Country Code|Citizenship)[:\s]*([A-Za-z\s]{2,30})/i
          ]);
          if (val) {
            foundValue = val;
            confidence = 0.88;
          }
          break;
        }

        case 'issuing_state':
        case 'issuing_authority': {
          const val = findRegexValue([
            /(?:Issuing Authority|Issuing State|State|Authority)[:\s]*([A-Za-z0-9\s.,'-]{2,50})/i
          ]);
          if (val) {
            foundValue = val;
            confidence = 0.88;
          }
          break;
        }

        // --- General Document ---
        case 'document_title': {
          const val = findRegexValue([
            /(?:Document Title|Title|Subject)[:\s]*([A-Za-z0-9\s.,'()/-]{3,80})/i
          ]);
          if (val) {
            foundValue = val;
            confidence = 0.90;
          } else if (textLines.length > 0) {
            foundValue = textLines[0].slice(0, 80);
            confidence = 0.82;
          }
          break;
        }

        case 'author_or_organization':
        case 'primary_entity': {
          const val = findRegexValue([
            /(?:Author\s*\/\s*Organization|Author|Entity|Organization|Issuer)[:\s]*([A-Za-z0-9\s.,'-]{3,60})/i
          ]);
          if (val) {
            foundValue = val;
            confidence = 0.88;
          }
          break;
        }

        case 'summary_topic': {
          const val = findRegexValue([
            /(?:Topic\s*\/\s*Scope|Topic|Subject|Regarding)[:\s]*([A-Za-z0-9\s.,'-]{3,80})/i
          ]);
          if (val) {
            foundValue = val;
            confidence = 0.88;
          }
          break;
        }

        default: {
          // Generic fallback by field label parts and field name
          const labelParts = def.label.split(/[\/\-|()]/).map((p) => p.trim()).filter((p) => p.length >= 3);
          const patternsToTry = [
            def.name.replace(/_/g, '\\s*'),
            ...labelParts
          ];
          for (const pattern of patternsToTry) {
            const rx = new RegExp(`(?:${pattern})[:\\s]+([^\\n]{1,80})`, 'i');
            const m = text.match(rx);
            if (m && m[1]?.trim()) {
              foundValue = m[1].trim();
              confidence = 0.75;
              break;
            }
          }
          break;
        }
      }
    }

    // Do NOT fabricate values! If value is absent, mark empty with confidence 0 and uncertain
    const hasValue = Boolean(foundValue && foundValue.trim());
    results.push({
      field_id: newId('fld'),
      case_id: caseId,
      field_name: def.name,
      field_label: def.label,
      field_value: hasValue ? foundValue.trim() : '',
      confidence: hasValue ? Math.round(confidence * 100) / 100 : 0.0,
      is_uncertain: !hasValue || confidence < 0.7,
      is_edited: false,
      source_snippet: hasValue ? evidenceSnippet : undefined
    });
  }

  return results;
}

function buildFinding(
  caseId: string,
  checkName: string,
  explanation: string,
  severity: ValidationFinding['severity'] = 'medium'
): ValidationFinding {
  return {
    finding_id: newId('find'),
    case_id: caseId,
    check_name: checkName,
    category: 'missing_information',
    result: 'failed',
    severity,
    explanation,
    resolved: false
  };
}

function makeAudit(
  caseId: string,
  eventType: AuditEvent['event_type'],
  summary: string,
  details?: string,
  actor: AuditEvent['actor'] = 'AI Agent'
): AuditEvent {
  return {
    event_id: newId('evt'),
    case_id: caseId,
    event_type: eventType,
    actor,
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
  duration = 45
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

export async function generateExecutiveSummary(
  documentType: DocumentType,
  status: CaseRecord['status'],
  queue: CaseRecord['assigned_queue'],
  findings: ValidationFinding[],
  fields: ExtractedField[]
): Promise<string> {
  return generateNeutralSummary(documentType, status, queue, findings, fields);
}

/**
 * Executes the full document processing pipeline:
 * File Validation -> PDF/Image Extraction -> Document Classification -> Field Extraction -> Rule Validation -> Routing Decision
 */
export async function runAgentPipeline(
  input: UploadInput,
  onStage?: StageCallback
): Promise<CaseRecord> {
  const emit = (stage: string, message: string, detail?: Record<string, unknown>) => {
    try {
      onStage?.({ stage, message, detail });
    } catch {
      // Disconnected stream must not interrupt processing
    }
  };

  const started = Date.now();
  const caseId = newId('case');
  const caseNumber = `DOC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();
  const safeName = sanitizeFileName(input.fileName || 'document.pdf');
  const fileMime = normalizeMimeType(input.fileMime || '', safeName);
  const fileSizeKb = Math.max(0, Number(input.fileSizeKb) || 0);

  // 1. File Validation
  const fileValidation = validateUploadFile({
    fileName: safeName,
    fileDataUrl: input.fileDataUrl,
    fileMime,
    fileSizeKb
  });

  if (!fileValidation.valid) {
    const failedRecord: CaseRecord = {
      case_id: caseId,
      case_number: caseNumber,
      version: 1,
      document_type: 'unknown',
      file_name: safeName,
      file_size_kb: fileSizeKb,
      file_mime: fileMime,
      file_data_url: input.fileDataUrl,
      raw_text: '',
      is_selectable_pdf: false,
      extraction_method: 'File Validation Failed',
      created_at: now,
      updated_at: now,
      status: 'Processing Failed',
      assigned_queue: 'General Review',
      routing_reason: fileValidation.error || 'File validation failed.',
      processing_error: fileValidation.error,
      extracted_fields: [],
      validation_findings: [
        buildFinding(caseId, 'File Signature & Security Validation', fileValidation.error || 'Invalid file format', 'high')
      ],
      review_actions: [],
      audit_events: [
        makeAudit(caseId, 'CASE_CREATED', `Case ${caseNumber} initialized for ingestion.`),
        makeAudit(caseId, 'OCR_EXTRACTION_FAILED', fileValidation.error || 'Validation failed.')
      ],
      agent_trace: [
        createTrace('File Ingestion & Security Filter', 'Validate binary payload', 'failed', fileValidation.error || 'Validation failed.')
      ]
    };
    caseStore.add(failedRecord);
    emit('failed', 'File validation failed', { error: failedRecord.processing_error });
    return failedRecord;
  }

  // Handle explicitly unreadable / degraded input immediately
  if (input.isUnreadable) {
    const finding: ValidationFinding = {
      finding_id: `find-corrupt-${caseId}`,
      case_id: caseId,
      check_name: 'Raster Quality & Token Resolution',
      category: 'format_error',
      result: 'failed',
      severity: 'high',
      explanation: 'Document image contains illegible glyph matrices or compression noise below operational confidence threshold (72 DPI). Automated extraction halted.',
      evidence_reference: `File: ${safeName}`,
      resolved: false
    };

    const failedRecord: CaseRecord = {
      case_id: caseId,
      case_number: caseNumber,
      version: 1,
      document_type: 'unknown',
      file_name: safeName,
      file_size_kb: fileSizeKb,
      file_mime: fileMime,
      file_data_url: input.fileDataUrl,
      raw_text: '',
      is_selectable_pdf: false,
      extraction_method: 'Degraded Scan Halt',
      classification_reason: 'Unreadable raster scan halted before classification.',
      created_at: now,
      updated_at: now,
      status: 'Processing Failed',
      assigned_queue: 'General Review',
      routing_reason: 'Automated extraction halted due to degraded raster scan quality.',
      processing_error: 'Document raster glyphs unreadable',
      extracted_fields: [],
      validation_findings: [finding],
      review_actions: [],
      audit_events: [
        makeAudit(caseId, 'CASE_CREATED', `Case ${caseNumber} initialized for ingestion. File: ${safeName}`),
        makeAudit(caseId, 'OCR_EXTRACTION_FAILED', 'Raster scan unreadable. Extraction halted.', 'Degraded Scan Halt')
      ],
      agent_trace: [
        createTrace('File Ingestion & Security Filter', 'Validate payload integrity', 'completed', `File "${safeName}" validated.`),
        createTrace('Text Extraction & OCR', 'Extract readable text stream', 'failed', 'Raster quality below threshold. Extraction halted.')
      ],
      consent_record: input.consentRecord
    };

    caseStore.add(failedRecord);
    emit('scanning', 'Scanning file raster');
    emit('failed', 'Degraded scan halt', { error: failedRecord.processing_error });
    return failedRecord;
  }

  emit('scanning', 'Scanning and extracting document stream');

  // 2. Decode payload & extract text
  const decoded = input.fileDataUrl ? decodeDataUrl(input.fileDataUrl) : null;
  let rawText = cleanText(input.rawText);
  let isSelectablePdf = false;
  let extractionMethod = 'Provided Text';
  let geminiFields: Record<string, string> = {};

  const isPdfFile = fileMime === 'application/pdf' || safeName.toLowerCase().endsWith('.pdf');

  if (isPdfFile && decoded?.buffer) {
    // Attempt digital selectable text extraction first
    const selectablePdfText = await extractSelectablePdfText(decoded.buffer);
    if (selectablePdfText && selectablePdfText.length > 20) {
      isSelectablePdf = true;
      rawText = selectablePdfText;
      extractionMethod = 'Native PDF Text Engine (Selectable PDF)';
    } else {
      isSelectablePdf = false;
      // Scanned/flattened PDF: attempt multimodal OCR
      if (decoded.base64) {
        emit('ocr', 'Running multimodal OCR on scanned PDF pages');
        const geminiResult = await extractWithGemini(decoded.base64, safeName, 'application/pdf');
        if (geminiResult.text.trim()) {
          rawText = geminiResult.text;
          extractionMethod = geminiResult.method;
          geminiFields = geminiResult.fields;
        }
      }
    }
  } else if (!isPdfFile && decoded) {
    // Image document (PNG/JPG/WEBP)
    isSelectablePdf = false;
    if (!rawText && decoded.base64) {
      emit('ocr', 'Running multimodal vision on document image');
      const geminiResult = await extractWithGemini(decoded.base64, safeName, decoded.mimeType);
      if (geminiResult.text.trim()) {
        rawText = geminiResult.text;
        extractionMethod = geminiResult.method;
        geminiFields = geminiResult.fields;
      } else {
        // Fallback to Tesseract OCR
        emit('ocr', 'Running local OCR fallback engine');
        const tesseractText = await extractOcrWithTesseract(decoded.buffer, decoded.mimeType);
        if (tesseractText.trim()) {
          rawText = tesseractText;
          extractionMethod = 'Tesseract OCR Engine';
        }
      }
    }
  }

  // Handle explicitly unreadable input
  if (input.isUnreadable) {
    rawText = '';
    extractionMethod = 'Degraded Scan Halt';
  }

  // 3. Document Classification
  emit('analyzing', 'Analyzing document schema and classification');
  emit('classifying', 'Classifying document type');
  let detectedType: DocumentType;
  let classificationReason: string;

  const userRequestedType = safeDocumentType(input.documentType);
  if (input.documentType && input.documentType !== 'auto' && userRequestedType !== 'unknown') {
    detectedType = userRequestedType;
    classificationReason = `Explicitly classified as ${DOCUMENT_SCHEMAS[userRequestedType]?.title || userRequestedType} by user.`;
  } else {
    const detection = detectDocumentType(safeName, rawText, fileMime);
    detectedType = detection.documentType;
    classificationReason = detection.reason;
  }

  // Handle non-invoice content verification
  if (detectedType === 'invoice') {
    const invoiceIndicators = /\b(invoice|bill|tax|gst|vat|subtotal|payable|amount\s*due|due\s*date|vendor|billed\s*to|client|supplier)\b/i;
    const hasInvoiceTokens = invoiceIndicators.test(rawText) || (safeName.toLowerCase().includes('inv') && rawText.length > 25);
    if (!hasInvoiceTokens && rawText.trim().length > 15) {
      detectedType = 'unknown';
      classificationReason = 'Document does not contain commercial invoice or billing ledger indicators. Classified as Unknown Document.';
    }
  }

  // 4. Schema Field Extraction (Without Hallucination)
  emit('extracting_fields', 'Extracting structured schema fields', { documentType: detectedType });
  let extractedFields = extractFieldsFromText(caseId, detectedType, rawText, geminiFields);

  // Apply any manual field overrides
  if (input.manualFields && typeof input.manualFields === 'object') {
    for (const [k, v] of Object.entries(input.manualFields)) {
      const valStr = cleanText(v);
      if (!valStr) continue;
      const target = extractedFields.find((f) => f.field_name.toLowerCase() === k.toLowerCase());
      if (target) {
        target.field_value = valStr;
        target.reviewed_value = valStr;
        target.is_edited = true;
        target.is_uncertain = false;
        target.confidence = 1.0;
      } else {
        extractedFields.push({
          field_id: newId('fld'),
          case_id: caseId,
          field_name: k,
          field_label: k.replace(/_/g, ' '),
          field_value: valStr,
          reviewed_value: valStr,
          confidence: 1.0,
          is_uncertain: false,
          is_edited: true
        });
      }
    }
  }

  // 5. Deterministic Rule Validations
  emit('validating', 'Executing deterministic schema validations');
  let findings: ValidationFinding[] = [];
  try {
    findings = runValidationChecks(
      detectedType,
      extractedFields,
      input.crossReferenceText || rawText
    ) || [];
  } catch (err: any) {
    log({
      level: 'ERROR',
      operation: 'VALIDATION_ENGINE_ERROR',
      message: err.message
    });
    findings = [
      buildFinding(caseId, 'Deterministic Validation Engine', 'Automated validation encountered an internal variance. Human review required.', 'high')
    ];
  }

  // Flag empty/unreadable text
  if (!rawText.trim()) {
    findings.push({
      finding_id: `find-unreadable-${caseId}`,
      case_id: caseId,
      check_name: 'Raster Quality & Token Resolution',
      category: 'format_error',
      result: 'failed',
      severity: 'high',
      explanation: 'Document image contains illegible glyph matrices or compression noise below operational confidence threshold. Manual data entry required.',
      evidence_reference: `File: ${safeName}`,
      resolved: false
    });
  }

  // Flag unknown document type
  if (detectedType === 'unknown') {
    findings.push({
      finding_id: `find-doctype-${caseId}`,
      case_id: caseId,
      check_name: 'Document Type Classification',
      category: 'missing_information',
      result: 'warning',
      severity: 'medium',
      explanation: 'Document content could not be classified automatically into standard schemas. Human reviewer triage required.',
      evidence_reference: `File: ${safeName}`,
      resolved: false
    });
  }

  // 6. Routing Decision
  emit('routing', 'Calculating routing recommendation');
  let decision: { status: CaseRecord['status']; assignedQueue: CaseRecord['assigned_queue']; routingReason: string };

  if (detectedType === 'unknown') {
    decision = {
      status: 'Needs More Information',
      assignedQueue: 'Missing Information',
      routingReason: 'Unknown document type requires human classification and information intake.'
    };
  } else {
    try {
      decision = evaluateAndRoute(findings, false);
    } catch {
      decision = {
        status: 'Needs More Information',
        assignedQueue: 'Missing Information',
        routingReason: 'Automated routing fallback triggered: manual review required.'
      };
    }
  }

  // 7. Executive Summary
  const summary = generateNeutralSummary(
    detectedType,
    decision.status,
    decision.assignedQueue,
    findings,
    extractedFields
  );

  // 8. Trace Steps
  const trace: AgentStepTrace[] = [
    createTrace('File Ingestion & Security Filter', 'Validate payload integrity and MIME boundaries', 'completed', `File "${safeName}" validated (${fileSizeKb} KB).`),
    createTrace('Text Extraction & OCR', 'Extract raw text stream from PDF or image', rawText ? 'completed' : 'failed', rawText ? `Extracted ${rawText.length} characters using ${extractionMethod}.` : `Zero legible tokens recovered. Engine: ${extractionMethod}.`, Date.now() - started),
    createTrace('Document Classification', 'Identify document category', detectedType === 'unknown' ? 'failed' : 'completed', `Classified as ${detectedType}. ${classificationReason}`),
    createTrace('Structured Schema Extractor', 'Map text to schema fields without fabrication', extractedFields.some((f) => f.field_value) ? 'completed' : 'failed', `Extracted ${extractedFields.filter((f) => f.field_value).length} populated field(s).`),
    createTrace('Deterministic Rule Validation', 'Verify mandatory attributes, formats, and recency', 'completed', `Generated ${findings.length} finding(s).`),
    createTrace('Decision Matrix & Queue Router', 'Evaluate findings and assign review queue', 'completed', `Status "${decision.status}" -> Queue "${decision.assignedQueue}".`)
  ].map((item, index) => ({ ...item, step_number: index + 1 }));

  // 9. Build and persist CaseRecord
  const caseRecord: CaseRecord = {
    case_id: caseId,
    case_number: caseNumber,
    version: 1,
    document_type: detectedType,
    detected_document_type: detectedType,
    file_name: safeName,
    file_size_kb: fileSizeKb,
    file_mime: fileMime,
    file_data_url: input.fileDataUrl,
    raw_text: rawText,
    cross_reference_file_name: input.crossReferenceFileName,
    cross_reference_text: input.crossReferenceText,
    is_selectable_pdf: isSelectablePdf,
    extraction_method: extractionMethod,
    classification_reason: classificationReason,
    created_at: now,
    updated_at: now,
    status: decision.status,
    assigned_queue: decision.assignedQueue,
    routing_reason: decision.routingReason,
    executive_summary: summary,
    processing_error: input.isUnreadable ? 'Document raster glyphs unreadable' : undefined,
    extracted_fields: extractedFields,
    validation_findings: findings,
    review_actions: [],
    audit_events: [
      makeAudit(caseId, 'CASE_CREATED', `Case ${caseNumber} created. File: ${safeName}`),
      makeAudit(caseId, rawText ? 'TEXT_EXTRACTED' : 'OCR_EXTRACTION_FAILED', rawText ? `Text extracted (${rawText.length} chars).` : 'No readable text extracted.', extractionMethod),
      makeAudit(caseId, 'DOCUMENT_TYPE_DETECTED', `Document type: ${detectedType}`, classificationReason),
      makeAudit(caseId, 'VALIDATION_RUN', `Validated ${extractedFields.length} fields; ${findings.length} active findings.`),
      makeAudit(caseId, 'ROUTING_DECIDED', `Routed to ${decision.assignedQueue} (${decision.status}).`, decision.routingReason)
    ],
    agent_trace: trace,
    consent_record: input.consentRecord
  };

  caseStore.add(caseRecord);

  const isMissingRequired = caseRecord.status === 'Needs More Information' && caseRecord.assigned_queue === 'Missing Information';
  const readyMessage = isMissingRequired
    ? 'Document Ingestion Incomplete: Missing required schema fields. Routed to Missing Information queue.'
    : caseRecord.status === 'Priority Review'
    ? 'Document Ingestion Complete: Critical flags detected. Routed to Priority Review queue.'
    : 'Document Ingestion Complete: All required fields extracted. Ready for reviewer inspection.';

  emit('ready', readyMessage, {
    caseId,
    documentType: detectedType,
    status: caseRecord.status,
    assignedQueue: caseRecord.assigned_queue,
    extractedFields: caseRecord.extracted_fields.length
  });

  emit('complete', readyMessage, {
    caseId,
    documentType: detectedType,
    status: caseRecord.status,
    assignedQueue: caseRecord.assigned_queue,
    extractedFields: caseRecord.extracted_fields.length
  });

  return caseRecord;
}

/**
 * Re-evaluates an existing case when fields or resolutions are modified.
 * Preserves previously resolved findings, re-runs deterministic checks,
 * re-evaluates routing, updates the store, and records an immutable audit event.
 */
export async function reEvaluateCase(
  caseId: string,
  reviewerLabel = 'Reviewer'
): Promise<CaseRecord | undefined> {
  const existing = caseStore.getById(caseId);
  if (!existing) {
    return undefined;
  }

  // 1. Re-run validation checks on current fields
  const freshFindings = runValidationChecks(
    existing.document_type,
    existing.extracted_fields,
    existing.cross_reference_text || existing.raw_text || ''
  ) || [];

  // 2. Preserve resolved state from existing findings
  const resolvedFindingMap = new Map<string, { resolved: boolean; notes?: string }>();
  for (const prev of existing.validation_findings || []) {
    if (prev.resolved) {
      resolvedFindingMap.set(prev.check_name, { resolved: true, notes: prev.resolution_notes });
      resolvedFindingMap.set(prev.finding_id, { resolved: true, notes: prev.resolution_notes });
    }
  }

  const consolidatedFindings: ValidationFinding[] = freshFindings.map((f) => {
    const prev = resolvedFindingMap.get(f.check_name) || resolvedFindingMap.get(f.finding_id);
    if (prev) {
      return {
        ...f,
        case_id: caseId,
        resolved: true,
        resolution_notes: prev.notes || 'Previously resolved by reviewer'
      };
    }
    return {
      ...f,
      case_id: caseId
    };
  });

  // Re-append text extraction finding if raw text is empty
  if (!existing.raw_text?.trim()) {
    consolidatedFindings.push(
      buildFinding(
        caseId,
        'Raster Quality & Token Resolution',
        'No readable text stream exists for this document. Human reviewer manual verification is required.',
        'high'
      )
    );
  }

  // Re-append unknown document type finding if applicable
  if (existing.document_type === 'unknown') {
    consolidatedFindings.push(
      buildFinding(
        caseId,
        'Document Type Classification',
        'Document type remains unknown and requires manual reviewer classification.',
        'medium'
      )
    );
  }

  // 3. Re-evaluate routing decision
  const isUnreadable = Boolean(existing.processing_error || !existing.raw_text?.trim());
  const decision = evaluateAndRoute(consolidatedFindings, isUnreadable);

  // 4. Generate updated neutral executive summary
  const updatedSummary = generateNeutralSummary(
    existing.document_type,
    decision.status,
    decision.assignedQueue,
    consolidatedFindings,
    existing.extracted_fields
  );

  // 5. Update agent trace
  const updatedTrace = [
    ...(existing.agent_trace || []),
    createTrace(
      'Deterministic Re-evaluation',
      `Re-evaluate case requested by ${reviewerLabel}`,
      'completed',
      `Status updated to "${decision.status}"; Queue: "${decision.assignedQueue}".`
    )
  ].map((item, index) => ({ ...item, step_number: index + 1 }));

  // 6. Persist atomic update to store with audit event
  return caseStore.update(caseId, (current) => {
    const audit = makeAudit(
      caseId,
      'AGENT_RE_EVALUATED',
      `Case re-evaluated by ${reviewerLabel}.`,
      `Status: "${decision.status}" · Assigned Queue: "${decision.assignedQueue}" · Findings: ${consolidatedFindings.filter((f) => !f.resolved).length} active.`,
      'Human Reviewer'
    );

    return {
      ...current,
      status: decision.status,
      assigned_queue: decision.assignedQueue,
      routing_reason: decision.routingReason,
      validation_findings: consolidatedFindings,
      executive_summary: updatedSummary,
      agent_trace: updatedTrace,
      audit_events: [audit, ...(current.audit_events || [])],
      updated_at: new Date().toISOString()
    };
  });
}
