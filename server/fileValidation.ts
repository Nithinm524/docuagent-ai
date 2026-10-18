/**
 * File Size, MIME, Magic Signature, and Path Traversal Validation
 * AI Document Review & Routing Agent
 */

import path from 'node:path';

export const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB boundary

export interface FileValidationResult {
  valid: boolean;
  detectedFormat: 'pdf' | 'png' | 'jpeg' | 'unknown';
  error?: string;
  sanitizedFileName: string;
}

/**
 * Sanitizes file name to prevent directory traversal attacks (e.g. ../../../etc/passwd).
 */
export function sanitizeFileName(rawFileName: string): string {
  if (!rawFileName || typeof rawFileName !== 'string') {
    return `document_${Date.now()}.pdf`;
  }

  // Remove path separators and null bytes
  const base = path.basename(rawFileName).replace(/[\/\\]/g, '').replace(/\0/g, '');
  // Replace dangerous characters
  const cleaned = base.replace(/[^a-zA-Z0-9_\-\. ]/g, '_').trim();

  // If empty after stripping, provide safe fallback
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return `document_${Date.now()}.pdf`;
  }

  return cleaned.slice(0, 150); // limit length to 150 chars
}

/**
 * Inspects buffer magic bytes (file signature) to detect real file format.
 */
export function inspectFileSignature(buffer: Buffer): 'pdf' | 'png' | 'jpeg' | 'unknown' {
  if (!buffer || buffer.length < 4) return 'unknown';

  // PDF: %PDF (0x25 0x50 0x44 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'pdf';
  }

  // PNG: \x89PNG (0x89 0x50 0x4E 0x47)
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47
  ) {
    return 'png';
  }

  // JPEG: \xFF\xD8\xFF (0xFF 0xD8 0xFF)
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'jpeg';
  }

  return 'unknown';
}

/**
 * Comprehensive file validation before expensive processing.
 */
export function validateUploadFile(options: {
  fileName: string;
  fileDataUrl?: string;
  fileMime?: string;
  fileSizeKb?: number;
}): FileValidationResult {
  const sanitized = sanitizeFileName(options.fileName);

  // 1. Check declared size
  if (options.fileSizeKb && options.fileSizeKb * 1024 > MAX_UPLOAD_SIZE_BYTES) {
    return {
      valid: false,
      detectedFormat: 'unknown',
      sanitizedFileName: sanitized,
      error: `File size (${Math.round(options.fileSizeKb / 1024)}MB) exceeds maximum allowed upload boundary of 15MB.`
    };
  }

  // 2. Check extension
  const ext = path.extname(sanitized).toLowerCase();
  const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg'];
  if (!allowedExts.includes(ext)) {
    return {
      valid: false,
      detectedFormat: 'unknown',
      sanitizedFileName: sanitized,
      error: `Unsupported file extension "${ext}". Allowed formats are PDF, PNG, JPG, and JPEG.`
    };
  }

  // 3. Inspect Data URL buffer if present
  if (options.fileDataUrl && options.fileDataUrl.startsWith('data:')) {
    const commaIndex = options.fileDataUrl.indexOf(',');
    if (commaIndex !== -1) {
      const base64Data = options.fileDataUrl.slice(commaIndex + 1);
      // Rough byte calculation from base64 string
      const byteLength = (base64Data.length * 3) / 4;
      if (byteLength > MAX_UPLOAD_SIZE_BYTES) {
        return {
          valid: false,
          detectedFormat: 'unknown',
          sanitizedFileName: sanitized,
          error: `Decoded file size (${Math.round(byteLength / (1024 * 1024))}MB) exceeds maximum boundary of 15MB.`
        };
      }

      // Check header signature bytes
      const headerBuffer = Buffer.from(base64Data.slice(0, 32), 'base64');
      const signature = inspectFileSignature(headerBuffer);

      if (signature === 'unknown') {
        // If extension says pdf/png/jpg but signature doesn't match
        return {
          valid: false,
          detectedFormat: 'unknown',
          sanitizedFileName: sanitized,
          error: `File signature mismatch. The file content does not match a valid PDF, PNG, or JPEG header.`
        };
      }

      return {
        valid: true,
        detectedFormat: signature,
        sanitizedFileName: sanitized
      };
    }
  }

  return {
    valid: true,
    detectedFormat: ext === '.pdf' ? 'pdf' : ext === '.png' ? 'png' : 'jpeg',
    sanitizedFileName: sanitized
  };
}
