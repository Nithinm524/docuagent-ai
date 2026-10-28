/**
 * DOCUAGENT AI — Stable PDF and Image Extraction Fix
 * Replace the corresponding extraction logic in server/agent.ts with this code.
 */

function normalizeDocumentDataUrl(
  fileDataUrl: string | undefined,
  fileMime: string,
  fileName: string
): string | undefined {
  if (!fileDataUrl?.trim()) return undefined;

  const value = fileDataUrl.trim();
  const existingDataUrl = value.match(/^data:([^;,]+);base64,([\s\S]*)$/i);

  if (existingDataUrl) {
    let mime = existingDataUrl[1].toLowerCase();
    if (mime === 'image/jpg') mime = 'image/jpeg';

    const supported = new Set([
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'image/tiff',
      'image/bmp'
    ]);

    if (!supported.has(mime)) return undefined;

    return `data:${mime};base64,${existingDataUrl[2].replace(/\s+/g, '')}`;
  }

  let mime = (fileMime || '').toLowerCase().trim();

  if (!mime || mime === 'application/octet-stream') {
    const name = fileName.toLowerCase();

    if (name.endsWith('.pdf')) mime = 'application/pdf';
    else if (name.endsWith('.png')) mime = 'image/png';
    else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mime = 'image/jpeg';
    else if (name.endsWith('.webp')) mime = 'image/webp';
    else if (name.endsWith('.gif')) mime = 'image/gif';
    else if (name.endsWith('.tif') || name.endsWith('.tiff')) mime = 'image/tiff';
    else if (name.endsWith('.bmp')) mime = 'image/bmp';
  }

  if (mime === 'image/jpg') mime = 'image/jpeg';

  const supported = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/tiff',
    'image/bmp'
  ]);

  if (!supported.has(mime)) return undefined;

  return `data:${mime};base64,${value.replace(/\s+/g, '')}`;
}

function getDocumentBase64(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',');

  if (dataUrl.startsWith('data:') && commaIndex >= 0) {
    return dataUrl.slice(commaIndex + 1).replace(/\s+/g, '');
  }

  return dataUrl.replace(/\s+/g, '');
}

function getDataUrlMime(
  dataUrl: string,
  fallbackMime: string,
  fileName: string
): string {
  const match = dataUrl.match(/^data:([^;,]+)/i);

  if (match?.[1]) {
    const mime = match[1].toLowerCase();
    return mime === 'image/jpg' ? 'image/jpeg' : mime;
  }

  const fallback = (fallbackMime || '').toLowerCase().trim();

  if (fallback && fallback !== 'application/octet-stream') {
    return fallback === 'image/jpg' ? 'image/jpeg' : fallback;
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

function findGeminiField(
  fields: Record<string, { value: string; confidence: number }> | null,
  fieldName: string,
  fieldLabel: string
): { value: string; confidence: number } | undefined {
  if (!fields) return undefined;

  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]/g, '');

  const expected = [normalize(fieldName), normalize(fieldLabel)].filter(Boolean);

  for (const [key, value] of Object.entries(fields)) {
    if (expected.includes(normalize(key))) return value;
  }

  for (const [key, value] of Object.entries(fields)) {
    const normalizedKey = normalize(key);

    if (
      expected.some(
        (name) =>
          normalizedKey.length > 2 &&
          name.length > 2 &&
          (normalizedKey.includes(name) || name.includes(normalizedKey))
      )
    ) {
      return value;
    }
  }

  return undefined;
}

/**
 * Extract text and fields from both PDF files and raster images using Gemini.
 */
async function extractDocumentWithGemini(
  documentType: DocumentType,
  fileMime: string,
  fileDataUrl: string,
  fileName = 'document'
): Promise<{
  rawText: string;
  fields: Record<string, { value: string; confidence: number }>;
  isUnreadable: boolean;
  unreadableReason?: string;
} | null> {
  const client = getGeminiClient();

  if (!client || !process.env.GEMINI_API_KEY) {
    log({
      level: 'WARN',
      operation: 'GEMINI_OCR_UNAVAILABLE',
      message: 'GEMINI_API_KEY is missing; OCR cannot use Gemini.'
    });
    return null;
  }

  try {
    const normalized = normalizeDocumentDataUrl(
      fileDataUrl,
      fileMime,
      fileName
    );

    if (!normalized) {
      throw new Error(`Unsupported or invalid upload: ${fileName}`);
    }

    const mimeType = getDataUrlMime(normalized, fileMime, fileName);
    const base64Data = getDocumentBase64(normalized);

    if (!base64Data) throw new Error('Document Base64 data is empty');

    const supported = new Set([
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'image/tiff',
      'image/bmp'
    ]);

    if (!supported.has(mimeType)) {
      throw new Error(`Unsupported MIME type: ${mimeType}`);
    }

    const schema = DOCUMENT_SCHEMAS[documentType];
    if (!schema) throw new Error(`Unknown document type: ${documentType}`);

    const prompt = `
You are an accurate document OCR and data extraction engine.

Read the attached document carefully. The attachment may be a PDF or an image.
Extract all visible text, including text in tables, headers, footers, and scanned pages.

Document type: ${schema.title}

Extract these schema fields:
${schema.fields
  .map(
    (field) =>
      `- ${field.name}: ${field.label}; type=${field.type}; required=${field.required}`
  )
  .join('\n')}

Instructions:
- For PDFs, inspect the document pages and read scanned as well as selectable text.
- For images, read all legible text regardless of layout.
- For invoices, identify the issuer/vendor separately from the billed-to/client.
- Extract an invoice number only when it is explicitly identifiable as an invoice number.
- Do not substitute a GST number, phone number, order number, or company registration number for an invoice number.
- Preserve names, dates, identifiers, and amounts as printed.
- Do not invent missing values.
- Return an empty string and confidence 0 when a field is absent.
- Return all readable text in raw_text.
- Set is_unreadable=true only if the attachment is genuinely unreadable or blank.

Return valid JSON only:
{
  "is_unreadable": false,
  "unreadable_reason": "",
  "raw_text": "all readable text",
  "fields": {
    "field_name": {
      "value": "extracted value",
      "confidence": 0.95
    }
  }
}`;

    const budget = usageTracker.isOperationAllowed();

    if (!budget.allowed) {
      log({
        level: 'WARN',
        operation: 'AI_BUDGET_CAP',
        message: `Gemini OCR skipped: ${budget.reason}`
      });
      return null;
    }

    const timeoutMs = Number.parseInt(
      process.env.AI_OCR_TIMEOUT_MS ||
        process.env.AI_REQUEST_TIMEOUT_MS ||
        '60000',
      10
    );

    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Gemini OCR timed out')),
          timeoutMs
        );
      });

      const requestPromise = client.models.generateContent({
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

      const response = await Promise.race([requestPromise, timeoutPromise]);
      const responseText = response.text?.trim();

      usageTracker.recordCall(
        {
          promptTokens: response.usageMetadata?.promptTokenCount,
          completionTokens: response.usageMetadata?.candidatesTokenCount
        },
        true
      );

      if (!responseText) throw new Error('Gemini returned an empty response');

      let parsed: any;

      try {
        parsed = JSON.parse(responseText);
      } catch {
        const match = responseText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('Gemini returned invalid JSON');
        parsed = JSON.parse(match[0]);
      }

      const fields: Record<string, { value: string; confidence: number }> = {};

      if (parsed.fields && typeof parsed.fields === 'object') {
        for (const [key, rawField] of Object.entries(parsed.fields)) {
          if (typeof rawField === 'string' || typeof rawField === 'number') {
            fields[key] = {
              value: String(rawField).trim(),
              confidence: 0.7
            };
            continue;
          }

          if (!rawField || typeof rawField !== 'object') continue;

          const item = rawField as Record<string, unknown>;
          const rawValue = item.value ?? item.text ?? '';
          const rawConfidence = Number(item.confidence ?? 0.7);

          fields[key] = {
            value:
              typeof rawValue === 'string' || typeof rawValue === 'number'
                ? String(rawValue).trim()
                : '',
            confidence: Number.isFinite(rawConfidence)
              ? Math.max(0, Math.min(1, rawConfidence))
              : 0
          };
        }
      }

      return {
        rawText: typeof parsed.raw_text === 'string' ? parsed.raw_text.trim() : '',
        fields,
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
      level: 'ERROR',
      operation: 'GEMINI_OCR_FAILED',
      message: 'Gemini could not extract this document.',
      details: {
        fileName,
        reason: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    return null;
  }
}

/**
 * Extract selectable text from a PDF. Scanned PDFs are handled by Gemini OCR.
 */
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

    const buffer = Buffer.from(getDocumentBase64(normalized), 'base64');
    if (!buffer.length) return null;

    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();

    const text = (parsed.text || '')
      .replace(/-- \d+ of \d+ --/g, '')
      .trim();

    if (text.length >= 15) {
      return {
        text,
        pageCount: parsed.total || 1
      };
    }
  } catch (error) {
    log({
      level: 'WARN',
      operation: 'PDF_TEXT_EXTRACTION_FAILED',
      message: 'Selectable PDF text extraction failed; trying Gemini OCR.',
      details: {
        reason: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }

  return null;
}

/**
 * OCR fallback for images only.
 */
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

    const buffer = Buffer.from(getDocumentBase64(normalized), 'base64');
    if (!buffer.length) return null;

    const module = await import('tesseract.js');
    const recognize =
      (module as any).recognize ||
      (module as any).default?.recognize;

    if (typeof recognize !== 'function') return null;

    const timeoutMs = Number.parseInt(
      process.env.TESSERACT_TIMEOUT_MS || '20000',
      10
    );

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Tesseract OCR timed out')),
        timeoutMs
      );
    });

    try {
      const result = await Promise.race([
        recognize(buffer, 'eng'),
        timeoutPromise
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
      message: 'Image OCR fallback failed.',
      details: {
        reason: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/*
 * In runAgentPipeline, use this extraction sequence.
 * Keep your existing validation, case-record creation, audit, and routing code.
 */

const normalizedFileDataUrl = normalizeDocumentDataUrl(
  options.fileDataUrl,
  options.fileMime,
  options.fileName
);

const resolvedMime = normalizedFileDataUrl
  ? getDataUrlMime(
      normalizedFileDataUrl,
      options.fileMime,
      options.fileName
    )
  : getDataUrlMime('', options.fileMime, options.fileName);

const isPdf =
  resolvedMime === 'application/pdf' ||
  options.fileName.toLowerCase().endsWith('.pdf');

let rawText = options.rawText || '';
let isSelectablePdf = false;
let ocrMethod = rawText ? 'Provided Text' : 'Automated Text Extractor';

let multimodalFields: Record<
  string,
  { value: string; confidence: number }
> | null = null;

if (isPdf && normalizedFileDataUrl && !rawText.trim()) {
  const pdfText = await extractSelectablePdfText(normalizedFileDataUrl);

  if (pdfText?.text) {
    rawText = pdfText.text;
    isSelectablePdf = true;
    ocrMethod = 'Selectable PDF Text Parser';
  }
}

if (normalizedFileDataUrl && !rawText.trim()) {
  const targetType: DocumentType =
    options.documentType === 'auto'
      ? ('general_doc' as DocumentType)
      : options.documentType;

  const result = await extractDocumentWithGemini(
    targetType,
    resolvedMime,
    normalizedFileDataUrl,
    options.fileName
  );

  if (result) {
    rawText = result.rawText.trim();
    multimodalFields = result.fields;

    if (rawText) {
      ocrMethod = isPdf
        ? 'Gemini PDF OCR'
        : 'Gemini Image OCR';
    }
  }

  if (!rawText.trim() && !isPdf) {
    const imageText = await extractOcrWithTesseract(normalizedFileDataUrl);

    if (imageText) {
      rawText = imageText;
      ocrMethod = 'Tesseract OCR';
    }
  }
}

/*
 * Important:
 * 1. Pass normalizedFileDataUrl to both Gemini calls.
 * 2. Pass resolvedMime, not a hard-coded image MIME type.
 * 3. Use GEMINI_OCR_MODEL=gemini-2.5-flash unless you have confirmed that
 *    your configured model ID is available to your API key.
 * 4. The frontend must send the actual PDF bytes as Base64 with
 *    application/pdf MIME type, not a preview URL or an empty payload.
 */
