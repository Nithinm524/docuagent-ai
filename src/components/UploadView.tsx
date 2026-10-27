import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  FileCheck,
  ShieldCheck,
  Zap,
  Info,
  Download,
  FileSpreadsheet,
  Check
} from 'lucide-react';
import { CaseRecord, DocumentType } from '../shared/types.ts';
import { DOCUMENT_SCHEMAS } from '../shared/validation.ts';
import {
  generateSamplePassportImage,
  generateSampleExpiredDLImage,
  generateSampleDegradedScan,
  generateSampleSelectablePDF,
  generateSampleGeneralDocPDF,
  generateSampleScannedPDF,
  dataURLtoFile
} from '../utils/sampleGenerator.ts';
import {
  DocumentScanningAnimation,
  ScanningStage,
  StageDetail
} from './DocumentScanningAnimation.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { authFetch, ensureAuthToken } from '../utils/authFetch.ts';

interface UploadViewProps {
  onCaseProcessed: (caseId: string) => void;
  onSelectCase?: (caseId: string) => void;
  onViewQueue?: (queue: string) => void;
  onRunSample: (scenarioId: string) => Promise<void>;
  loadingSampleId: string | null;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
  onOpenDataCollection?: () => void;
}

export const UploadView: React.FC<UploadViewProps> = ({
  onCaseProcessed,
  onSelectCase,
  onViewQueue,
  onOpenPrivacy,
  onOpenTerms,
  onOpenDataCollection
}) => {
  const { userSession } = useAuth();
  const [documentType, setDocumentType] = useState<DocumentType | 'auto'>('auto');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContentText, setFileContentText] = useState<string>('');
  const [fileDataUrl, setFileDataUrl] = useState<string>('');
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Scanning Animation State
  const [isScanningActive, setIsScanningActive] = useState(false);
  const [scanningStage, setScanningStage] = useState<ScanningStage>('uploaded');
  const [stageDetail, setStageDetail] = useState<StageDetail | null>(null);
  const [scanningStatusMessage, setScanningStatusMessage] = useState<string>('Upload validated');
  const [completedCase, setCompletedCase] = useState<CaseRecord | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const uploadRequestCounterRef = useRef<number>(0);

  // Clean up Object URL and in-flight request on unmount or file reset
  useEffect(() => {
    return () => {
      uploadRequestCounterRef.current++;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [previewObjectUrl]);

  // Mandatory Affirmative Consent & Terms Acceptance (Unchecked by default)
  const [consentGiven, setConsentGiven] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const consentCheckboxRef = useRef<HTMLInputElement>(null);
  const termsCheckboxRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPdf = !!(
    selectedFile &&
    (selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf'))
  );

  const processSelectedFile = (file: File) => {
    // Validate format
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|png|jpe?g)$/i)) {
      setErrorMsg('Unsupported format. Please upload a PDF, PNG, or JPG/JPEG document.');
      return;
    }

    // Validate size (max 15MB)
    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('File exceeds 15MB maximum size boundary.');
      return;
    }

    // Revoke previous object URL if any
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      setPreviewObjectUrl(null);
    }

    // Create safe Object URL for thumbnail preview
    let newPreviewUrl: string | null = null;
    try {
      newPreviewUrl = URL.createObjectURL(file);
      setPreviewObjectUrl(newPreviewUrl);
    } catch {
      setPreviewObjectUrl(null);
    }

    setSelectedFile(file);
    setErrorMsg(null);
    setIsScanningActive(false);
    setCompletedCase(null);
    setScanningStage('uploaded');
    setScanningStatusMessage('Upload validated');

    // Read Data URL for preview and multimodal extraction
    const dataReader = new FileReader();
    dataReader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setFileDataUrl(dataUrl || '');
    };
    dataReader.readAsDataURL(file);

    // If text file, read text
    if (file.type.includes('text')) {
      const textReader = new FileReader();
      textReader.onload = (e) => setFileContentText((e.target?.result as string) || '');
      textReader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleCancel = () => {
    uploadRequestCounterRef.current++;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setIsScanningActive(false);
    setScanningStage('uploaded');
    setScanningStatusMessage('Document processing was cancelled.');
    setLiveLogs((prev) => [...prev, '[Cancellation] Document review workflow cancelled by user.']);
  };

  const handleReset = () => {
    uploadRequestCounterRef.current++;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      setPreviewObjectUrl(null);
    }
    setSelectedFile(null);
    setFileDataUrl('');
    setFileContentText('');
    setIsProcessing(false);
    setIsScanningActive(false);
    setCompletedCase(null);
    setScanningStage('uploaded');
    setErrorMsg(null);
    setStageDetail(null);
    setLiveLogs([]);
  };

  const runPipeline = async () => {
    // Prevent duplicate upload submissions
    if (isProcessing) return;

    if (!selectedFile) {
      setErrorMsg('Please select or drag a document file to proceed.');
      return;
    }

    if (!consentGiven) {
      setErrorMsg('Affirmative consent is required to process this document. Please review the Document Intake Privacy Notice and check the consent box below.');
      consentCheckboxRef.current?.focus();
      return;
    }

    if (!termsAccepted) {
      setErrorMsg('Acceptance of the DOCUAGENT AI Terms of Use is required to process this document. Please review and check the Terms box below.');
      termsCheckboxRef.current?.focus();
      return;
    }

    // Monotonic request ID to prevent race conditions from asynchronous events
    const currentRequestId = ++uploadRequestCounterRef.current;

    // Initialize Scanning Experience & Abort Controller
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsProcessing(true);
    setIsScanningActive(true);
    setScanningStage('uploaded');
    setScanningStatusMessage('Upload validated');
    setErrorMsg(null);
    setCompletedCase(null);

    setPipelineStep(1);
    setLiveLogs([
      `[Ingest] Ingesting "${selectedFile.name}" (${Math.round(selectedFile.size / 1024)} KB) · MIME: ${selectedFile.type || 'application/pdf'}`
    ]);

    try {
      let payloadDataUrl = fileDataUrl;
      if (!payloadDataUrl && selectedFile) {
        payloadDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string) || '');
          reader.onerror = () => resolve('');
          reader.readAsDataURL(selectedFile);
        });
      }

      if (uploadRequestCounterRef.current !== currentRequestId) return;

      // Pre-acquire authentication token to guarantee session credentials
      await ensureAuthToken();

      // Call Backend API with streaming event stream using authFetch
      const res = await authFetch('/api/cases/process?stream=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        signal: controller.signal,
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileSizeKb: Math.round(selectedFile.size / 1024),
          fileMime: selectedFile.type || 'application/pdf',
          documentType,
          rawText: fileContentText || undefined,
          fileDataUrl: payloadDataUrl || undefined,
          consentRecord: {
            notice_version: '2026.1',
            timestamp: new Date().toISOString(),
            purpose: 'document_validation_and_review',
            legal_basis: 'consent',
            affirmative_action: true,
            user_declaration: true
          },
          termsRecord: {
            terms_version: '2026.1',
            accepted_at: new Date().toISOString(),
            affirmative_action: true
          }
        })
      });

      if (uploadRequestCounterRef.current !== currentRequestId) return;

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        let humanMessage = errorData.error;
        if (res.status === 401) {
          humanMessage = errorData.error || 'Authentication credentials required for this endpoint. Please verify your session credentials or switch to Demo Reviewer mode.';
        } else if (res.status === 413) {
          humanMessage = errorData.error || 'File size limit exceeded. The uploaded document exceeds the 15MB maximum boundary.';
        } else if (res.status === 400 && errorData.code === 'UNSUPPORTED_FILE_TYPE') {
          humanMessage = errorData.error || 'Unsupported document format. Allowed formats are PDF, PNG, and JPEG.';
        } else if (res.status === 409) {
          humanMessage = errorData.error || 'A document with matching contents is currently processing. Please wait a moment.';
        } else if (res.status >= 500) {
          humanMessage = 'Document extraction service encountered an unexpected error. Automatic fallback has been engaged.';
        }
        throw new Error(humanMessage || `Server returned status ${res.status}`);
      }

      const contentType = res.headers.get('content-type') || '';

      // If Server-Sent Events stream returned:
      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let completedReceived = false;

        const processMessageBlock = (msg: string) => {
          if (!msg.trim()) return;
          const lines = msg.split('\n');
          let eventType = '';
          let dataStr = '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.replace('event:', '').trim();
            } else if (line.startsWith('data:')) {
              dataStr = line.replace('data:', '').trim();
            }
          }

          if (!dataStr) return;

          try {
            const data = JSON.parse(dataStr);
            if (uploadRequestCounterRef.current !== currentRequestId) return;

            if (eventType === 'stage') {
              const stage = data.stage as ScanningStage;
              setScanningStage(stage);
              setStageDetail(data);

              if (stage === 'uploaded') {
                setPipelineStep(1);
                setScanningStatusMessage('Upload validated');
              } else if (stage === 'scanning') {
                setPipelineStep(2);
                setScanningStatusMessage('Preparing document...');
                setLiveLogs((prev) => [...prev, '[Scanning] Inspecting file structure and signatures...']);
              } else if (stage === 'extracting') {
                setPipelineStep(3);
                const isPdfStream = data.method === 'pdf_text';
                setScanningStatusMessage(
                  isPdfStream
                    ? 'Extracting text (PDF stream parser)...'
                    : 'Extracting text (OCR engine)...'
                );
                setLiveLogs((prev) => [
                  ...prev,
                  `[Extraction] Running ${data.ocrMethodName || 'character recognition'}...`
                ]);
              } else if (stage === 'analyzing') {
                setPipelineStep(4);
                setScanningStatusMessage('Analyzing document fields...');
                setLiveLogs((prev) => [
                  ...prev,
                  `[Analysis] Classification schema mapping: ${data.subMessage || 'running'}...`
                ]);
              } else if (stage === 'validating') {
                setPipelineStep(5);
                setScanningStatusMessage('Checking for inconsistencies...');
                setLiveLogs((prev) => [
                  ...prev,
                  '[Validation] Evaluating deterministic validity and rules...'
                ]);
              }
            } else if (eventType === 'complete') {
              completedReceived = true;
              const caseData: CaseRecord = data.caseRecord;
              setCompletedCase(caseData);
              setScanningStage('ready');
              setScanningStatusMessage('Processing complete');
              setPipelineStep(6);
              setLiveLogs((prev) => [
                ...prev,
                `[Audit] Case ${caseData.case_number} routed to ${caseData.assigned_queue} (${caseData.status}).`
              ]);
              setIsProcessing(false);
            } else if (eventType === 'error') {
              throw new Error(data.error || 'Server processing error');
            }
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes('JSON')) {
              throw parseErr;
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (uploadRequestCounterRef.current !== currentRequestId) {
            try { await reader.cancel(); } catch { /* ignore */ }
            return;
          }

          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const messages = buffer.split('\n\n');
            buffer = messages.pop() || '';
            for (const msg of messages) {
              processMessageBlock(msg);
            }
          }

          if (done) {
            buffer += decoder.decode();
            if (buffer.trim()) {
              const remaining = buffer.split('\n\n');
              for (const msg of remaining) {
                processMessageBlock(msg);
              }
            }
            break;
          }
        }

        if (!completedReceived && uploadRequestCounterRef.current === currentRequestId) {
          setIsProcessing(false);
          setScanningStage('ready');
          setScanningStatusMessage('Processing complete');
        }
      } else {
        // Standard JSON fallback
        const caseData = await res.json();
        if (uploadRequestCounterRef.current !== currentRequestId) return;
        setCompletedCase(caseData);
        setScanningStage('ready');
        setScanningStatusMessage('Processing complete');
        setPipelineStep(6);
        setLiveLogs((prev) => [
          ...prev,
          `[Audit] Case ${caseData.case_number} routed to ${caseData.assigned_queue} (${caseData.status}).`
        ]);
        setIsProcessing(false);
      }
    } catch (err: any) {
      if (uploadRequestCounterRef.current !== currentRequestId) return;
      if (err.name === 'AbortError') {
        setIsProcessing(false);
        setIsScanningActive(false);
        setScanningStage('uploaded');
        setScanningStatusMessage('Document processing was cancelled.');
        return;
      }
      setErrorMsg(`Processing halted: ${err.message || 'Workflow error'}`);
      setScanningStage('error');
      setScanningStatusMessage("We couldn't process this file. Please try again.");
      setIsProcessing(false);
    } finally {
      if (uploadRequestCounterRef.current === currentRequestId) {
        abortControllerRef.current = null;
        setIsProcessing(false);
      }
    }
  };

  const currentSchema = documentType === 'auto' ? null : DOCUMENT_SCHEMAS[documentType];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Document Intake &amp; Ingestion
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Upload PDF or image files for intelligent text extraction, deterministic rule validation, and routing.
        </p>
      </div>

      {/* Session & Pipeline Health Status Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Authenticated Reviewer:
          </span>
          <span className="font-mono text-cyan-700 dark:text-cyan-300">
            {userSession ? `${userSession.email} (${userSession.role})` : 'Lead Reviewer (Sandbox Session)'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-500 dark:text-slate-400">
            Intake Pipeline: <strong className="text-slate-700 dark:text-slate-200">Active</strong> &middot; Max 15MB (PDF, PNG, JPEG)
          </span>
        </div>
      </div>

      {/* Animated Document Scanning Experience & Results */}
      {isScanningActive && selectedFile ? (
        <DocumentScanningAnimation
          file={selectedFile}
          previewUrl={previewObjectUrl}
          currentStage={scanningStage}
          stageDetail={stageDetail}
          statusMessage={scanningStatusMessage}
          isPdf={isPdf}
          onCancel={handleCancel}
          error={errorMsg}
          onRetry={runPipeline}
          onReset={handleReset}
          completedCase={completedCase}
          onOpenDetails={(caseId) => onCaseProcessed(caseId)}
          onViewQueue={(queue) => onViewQueue?.(queue)}
        />
      ) : (
        /* Main 2-Column Ingestion Layout */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Ingestion Controls */}
        <div className="lg:col-span-2 space-y-5">
          {/* Step 1: Document Classification Schema */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B1120] p-4 sm:p-5 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-900 dark:text-white tracking-tight">
                Classification Schema
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Auto-detect or designate target format
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {/* Auto-Detect Button */}
              <button
                type="button"
                onClick={() => setDocumentType('auto')}
                className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                  documentType === 'auto'
                    ? 'bg-cyan-50 dark:bg-slate-800 border-cyan-500 text-cyan-800 dark:text-cyan-300 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="font-medium text-xs flex items-center justify-between">
                  <span>Auto-Detect</span>
                  {documentType === 'auto' && <Check className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                  Adaptive classification
                </div>
              </button>

              {(Object.keys(DOCUMENT_SCHEMAS) as DocumentType[]).map((type) => {
                const isSelected = documentType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setDocumentType(type)}
                    className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-50 dark:bg-slate-800 border-cyan-500 text-cyan-800 dark:text-cyan-300 font-semibold'
                        : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="font-medium text-xs flex items-center justify-between">
                      <span className="truncate">{DOCUMENT_SCHEMAS[type].title.split('/')[0].trim()}</span>
                      {isSelected && <Check className="w-3 h-3 text-cyan-600 dark:text-cyan-400 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {DOCUMENT_SCHEMAS[type].fields.length} schema fields
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Drag & Drop Zone */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B1120] p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-900 dark:text-white tracking-tight">
                Document File
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                PDF, PNG, JPG, or JPEG · Up to 15 MB
              </span>
            </div>

            {/* Pre-Upload Privacy & Data Transparency Notice */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 text-[11px] text-slate-600 dark:text-slate-400">
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 mt-0.5 shrink-0" />
                <p>
                  <strong>Pre-Upload Privacy Notice:</strong> Uploaded documents are processed strictly for data extraction, deterministic validation checks, and routing to human reviewers. Payloads are encrypted at rest with AES-256-GCM and retained for 90 days. Documents are never used to train public AI models.
                </p>
              </div>
              {onOpenDataCollection && (
                <button
                  type="button"
                  onClick={onOpenDataCollection}
                  className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline shrink-0 cursor-pointer"
                >
                  Data Inventory →
                </button>
              )}
            </div>

            <div
              tabIndex={0}
              role="button"
              aria-label="Upload document file dropzone. Press Enter or Space to choose a file."
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-hidden ${
                selectedFile
                  ? 'border-cyan-500/50 bg-cyan-50/50 dark:bg-cyan-950/10'
                  : 'border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 bg-slate-50/60 dark:bg-slate-950/40 hover:bg-slate-100/70 dark:hover:bg-slate-950/70'
              }`}
            >
              <input
                id="document-file-input"
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                className="sr-only"
                aria-label="Choose document file"
              />

              <div className="flex flex-col items-center justify-center space-y-2.5">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                  <UploadCloud className="w-5 h-5 stroke-[2]" aria-hidden="true" />
                </div>

                {selectedFile ? (
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">{selectedFile.name}</p>
                    <p className="text-[11px] text-cyan-600 dark:text-cyan-400 font-mono mt-0.5">
                      {Math.round(selectedFile.size / 1024)} KB · {selectedFile.type || 'Document'}
                    </p>
                    <span className="inline-block mt-1 text-[11px] text-slate-500 dark:text-slate-400 underline hover:text-slate-800 dark:hover:text-slate-200">
                      Click or press Enter to replace file
                    </span>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      Drag and drop your file here, or <span className="text-cyan-600 dark:text-cyan-400 underline font-semibold">browse files</span>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Accepts digital or scanned PDF, PNG, JPG/JPEG (Max 15MB)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Test Document Specimens (Consistently Styled Buttons) */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  Load Test Document Specimen:
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  Loads test file directly into uploader
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const url = generateSampleSelectablePDF();
                    const file = dataURLtoFile(url, 'digital_bank_statement.pdf');
                    setDocumentType('auto');
                    processSelectedFile(file);
                  }}
                  className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  + Selectable PDF (Bank Statement)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const url = generateSampleGeneralDocPDF();
                    const file = dataURLtoFile(url, 'master_services_agreement.pdf');
                    setDocumentType('auto');
                    processSelectedFile(file);
                  }}
                  className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  + General Document (Agreement PDF)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const url = generateSampleScannedPDF();
                    const file = dataURLtoFile(url, 'scanned_utility_raster.pdf');
                    setDocumentType('auto');
                    processSelectedFile(file);
                  }}
                  className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  + Scanned PDF (Raster)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const url = generateSamplePassportImage();
                    const file = dataURLtoFile(url, 'alex_rivera_passport.png');
                    setDocumentType('auto');
                    processSelectedFile(file);
                  }}
                  className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  + Passport Image (PNG)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const url = generateSampleExpiredDLImage();
                    const file = dataURLtoFile(url, 'elena_rostova_dl_expired.png');
                    setDocumentType('auto');
                    processSelectedFile(file);
                  }}
                  className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  + Expired DL (PNG)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const url = generateSampleDegradedScan();
                    const file = dataURLtoFile(url, 'degraded_scan.jpg');
                    setDocumentType('auto');
                    processSelectedFile(file);
                  }}
                  className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-400 border border-slate-200 dark:border-slate-800 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  + Degraded Scan (JPG)
                </button>
              </div>
            </div>
          </div>

          {/* Step 3: Document Intake Privacy Notice & Affirmative Consent (DPDP Ready) */}
          <div className="rounded-xl border border-cyan-200 dark:border-cyan-950/70 bg-cyan-50/40 dark:bg-[#071322] p-4 sm:p-5 space-y-3.5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center space-x-2 text-cyan-800 dark:text-cyan-300">
                <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" aria-hidden="true" />
                <h3 className="text-xs font-bold tracking-tight">
                  Document Intake Privacy Notice &amp; Consent Declaration
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-cyan-200 dark:border-slate-800 text-cyan-700 dark:text-cyan-300 shrink-0">
                Notice v2026.1
              </span>
            </div>

            <div className="text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
              <p>
                <strong>Personal Data Processed:</strong> Extracted document values including full names, dates, identification numbers, addresses, and issuer metadata.
              </p>
              <p>
                <strong>Purpose &amp; AI Processing:</strong> Data is extracted, classified, and checked against deterministic rules to route the case to appropriate human reviewer queues. Multimodal AI processing runs server-side via Google Gemini over encrypted HTTPS. Files are not used to train public machine learning models.
              </p>
              <p>
                <strong>Retention &amp; Deletion:</strong> Retained for a default 90-day lifecycle. You may request data erasure or withdraw consent at any time via the audit workspace.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-0.5">
                {onOpenPrivacy && (
                  <button
                    type="button"
                    onClick={onOpenPrivacy}
                    className="text-cyan-700 dark:text-cyan-400 hover:underline font-semibold cursor-pointer text-xs"
                  >
                    Privacy Policy &amp; DPDP Disclosures →
                  </button>
                )}
                {onOpenDataCollection && (
                  <button
                    type="button"
                    onClick={onOpenDataCollection}
                    className="text-cyan-700 dark:text-cyan-400 hover:underline font-semibold cursor-pointer text-xs"
                  >
                    Data Collection Inventory →
                  </button>
                )}
                {onOpenTerms && (
                  <button
                    type="button"
                    onClick={onOpenTerms}
                    className="text-cyan-700 dark:text-cyan-400 hover:underline font-semibold cursor-pointer text-xs"
                  >
                    Terms of Use →
                  </button>
                )}
              </div>
            </div>

            {/* Mandatory Affirmative Consent & Terms Acceptance Checkboxes (NOT preselected) */}
            <div className="pt-2 border-t border-cyan-200 dark:border-slate-800 space-y-3">
              {/* Consent Checkbox */}
              <div className="flex items-start space-x-2.5">
                <input
                  type="checkbox"
                  id="affirmative-consent-checkbox"
                  ref={consentCheckboxRef}
                  checked={consentGiven}
                  aria-invalid={!consentGiven && !!errorMsg}
                  aria-describedby={errorMsg ? 'upload-error-alert' : undefined}
                  onChange={(e) => {
                    setConsentGiven(e.target.checked);
                    if (e.target.checked) setErrorMsg(null);
                  }}
                  className="w-4 h-4 mt-0.5 rounded text-cyan-600 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-cyan-500 cursor-pointer shrink-0"
                />
                <label
                  htmlFor="affirmative-consent-checkbox"
                  className="text-xs text-slate-900 dark:text-slate-200 cursor-pointer font-medium leading-snug"
                >
                  I confirm that I am authorized to submit this document and grant consent to process the contained personal data for automated extraction and human reviewer triage under Notice v2026.1.
                </label>
              </div>

              {/* Terms Acceptance Checkbox (Affirmative, Unselected by default) */}
              <div className="flex items-start space-x-2.5 pt-1 border-t border-cyan-200/50 dark:border-slate-800/60">
                <input
                  type="checkbox"
                  id="affirmative-terms-checkbox"
                  ref={termsCheckboxRef}
                  checked={termsAccepted}
                  aria-invalid={!termsAccepted && !!errorMsg}
                  aria-describedby={errorMsg ? 'upload-error-alert' : undefined}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    if (e.target.checked) setErrorMsg(null);
                  }}
                  className="w-4 h-4 mt-0.5 rounded text-cyan-600 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-cyan-500 cursor-pointer shrink-0"
                />
                <label
                  htmlFor="affirmative-terms-checkbox"
                  className="text-xs text-slate-900 dark:text-slate-200 cursor-pointer font-medium leading-snug"
                >
                  I have read and agree to the{' '}
                  <button
                    type="button"
                    onClick={onOpenTerms}
                    className="text-cyan-700 dark:text-cyan-400 font-bold hover:underline inline-block cursor-pointer"
                  >
                    DOCUAGENT AI Terms of Use (v2026.1)
                  </button>{' '}
                  governing document intake, automated validation heuristics, reviewer queues, and assistive decision support.
                </label>
              </div>

              {/* Legal Basis Flag for Institutional Review */}
              <p className="text-[10px] text-slate-500 dark:text-slate-400 italic pt-1">
                Compliance Note: Deploying organizations should confirm with legal counsel whether consent, legitimate uses (e.g., employment onboarding), or legal obligation is the appropriate legal basis under the DPDP Act, 2023.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div
              id="upload-error-alert"
              role="alert"
              aria-live="assertive"
              className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/80 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between shadow-xs"
            >
              <div className="flex items-center space-x-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" aria-hidden="true" />
                <span className="font-medium">{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="ml-2 text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 underline cursor-pointer text-[11px]"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Prominent Action Button with Clear, Descriptive Label */}
          <div>
            <button
              type="button"
              onClick={runPipeline}
              disabled={isProcessing || !selectedFile}
              className="w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-semibold text-xs tracking-tight shadow-sm flex items-center justify-center space-x-2 transition-colors disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              {isProcessing ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>Processing Document Pipeline...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4 stroke-[2]" aria-hidden="true" />
                  <span>Upload and Start Document Review</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right 1 Col: Schema Expectations & Pipeline Trace */}
        <div className="space-y-5">
          {/* Schema Requirements Card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B1120] p-4 sm:p-5 shadow-xs">
            <h2 className="text-xs font-semibold text-slate-900 dark:text-white tracking-tight mb-3 flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>{currentSchema ? `Schema Rules: ${currentSchema.title}` : 'Classification & Extraction'}</span>
            </h2>

            {currentSchema ? (
              <div className="space-y-1.5">
                {currentSchema.fields.map((f) => (
                  <div
                    key={f.name}
                    className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{f.label}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1.5 font-mono">({f.type})</span>
                    </div>
                    {f.required ? (
                      <span className="text-[10px] font-medium text-rose-600 dark:text-rose-400">
                        Required
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        Optional
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <p className="leading-relaxed">
                  Automatic inspection identifies whether the document is a Passport, National ID, Bank Statement, Utility Bill, or General Document.
                </p>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                  <div className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400" />
                    <span><strong>Digital PDF:</strong> Direct selectable text parsing</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                    <span><strong>General PDF:</strong> General Document schema</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                    <span><strong>Scanned / Image:</strong> OCR token recognition</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Real-time Agent Execution Trace */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B1120] p-4 sm:p-5 shadow-xs">
            <h2 className="text-xs font-semibold text-slate-900 dark:text-white tracking-tight mb-3 flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Processing Pipeline Status</span>
            </h2>

            <div className="space-y-1.5">
              {[
                { num: 1, name: 'File Ingestion & MIME Security' },
                { num: 2, name: 'OCR & Text Stream Extraction' },
                { num: 3, name: 'Structured Schema Mapping' },
                { num: 4, name: 'Deterministic Rule Validation' },
                { num: 5, name: 'Queue Decision Matrix' },
                { num: 6, name: 'Screening Synthesis & Audit Log' }
              ].map((step) => {
                const isCurrent = isProcessing && pipelineStep === step.num;
                const isDone = pipelineStep > step.num;

                return (
                  <div
                    key={step.num}
                    className={`p-2 rounded-lg border text-xs flex items-center space-x-2.5 transition-colors ${
                      isCurrent
                        ? 'bg-cyan-50 dark:bg-slate-800 border-cyan-500/80 text-cyan-800 dark:text-cyan-300 font-medium'
                        : isDone
                        ? 'bg-emerald-50 dark:bg-slate-950/60 border-emerald-200 dark:border-slate-800 text-emerald-700 dark:text-emerald-400'
                        : 'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800/60 text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                        isCurrent
                          ? 'bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950'
                          : isDone
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {isDone ? '✓' : step.num}
                    </div>
                    <span className="font-medium truncate">{step.name}</span>
                  </div>
                );
              })}
            </div>

            {/* Live Log Terminal Output */}
            {liveLogs.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-slate-900 dark:bg-slate-950 border border-slate-800 text-[10px] font-mono text-cyan-300 space-y-1 max-h-36 overflow-y-auto">
                {liveLogs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
