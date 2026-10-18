import React, { useState, useRef } from 'react';
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
import { DocumentType } from '../shared/types.ts';
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

interface UploadViewProps {
  onCaseProcessed: (caseId: string) => void;
  onRunSample: (scenarioId: string) => Promise<void>;
  loadingSampleId: string | null;
}

export const UploadView: React.FC<UploadViewProps> = ({
  onCaseProcessed
}) => {
  const [documentType, setDocumentType] = useState<DocumentType | 'auto'>('auto');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContentText, setFileContentText] = useState<string>('');
  const [fileDataUrl, setFileDataUrl] = useState<string>('');
  const [includeCrossDoc, setIncludeCrossDoc] = useState(false);
  const [crossDocName, setCrossDocName] = useState('');
  const [crossDocText, setCrossDocText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

    setSelectedFile(file);
    setErrorMsg(null);

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

  const runPipeline = async () => {
    if (!selectedFile) {
      setErrorMsg('Please select or drag a document file to proceed.');
      return;
    }

    setIsProcessing(true);
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

      await new Promise((r) => setTimeout(r, 250));
      setPipelineStep(2);
      setLiveLogs((prev) => [...prev, `[Extraction] Parsing digital text stream and OCR tokens...`]);

      await new Promise((r) => setTimeout(r, 300));
      setPipelineStep(3);
      const schemaName =
        documentType === 'auto'
          ? 'Adaptive Schema Classifier'
          : DOCUMENT_SCHEMAS[documentType]?.title || 'Schema';
      setLiveLogs((prev) => [...prev, `[Schema] Extracting attributes for "${schemaName}"...`]);

      await new Promise((r) => setTimeout(r, 250));
      setPipelineStep(4);
      setLiveLogs((prev) => [...prev, `[Rules] Evaluating deterministic validity and expiration bounds...`]);

      await new Promise((r) => setTimeout(r, 250));
      setPipelineStep(5);
      setLiveLogs((prev) => [...prev, `[Routing] Evaluating findings and dispatching to reviewer queue...`]);

      // Call Backend API
      const res = await fetch('/api/cases/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileSizeKb: Math.round(selectedFile.size / 1024),
          fileMime: selectedFile.type || 'application/pdf',
          documentType,
          rawText: fileContentText || undefined,
          fileDataUrl: payloadDataUrl || undefined,
          crossReferenceFileName: includeCrossDoc ? crossDocName || 'secondary_doc.pdf' : undefined,
          crossReferenceText: includeCrossDoc ? crossDocText : undefined
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned status ${res.status}`);
      }

      const caseData = await res.json();

      setPipelineStep(6);
      setLiveLogs((prev) => [
        ...prev,
        `[Audit] Logged immutable record. Case ${caseData.case_number} routed to ${caseData.assigned_queue} (${caseData.status}).`
      ]);

      await new Promise((r) => setTimeout(r, 450));
      onCaseProcessed(caseData.case_id);
    } catch (err: any) {
      setErrorMsg(`Processing halted: ${err.message || 'Workflow error'}`);
      setIsProcessing(false);
    }
  };

  const currentSchema = documentType === 'auto' ? null : DOCUMENT_SCHEMAS[documentType];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Document Intake &amp; Ingestion
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-400">
          Upload PDF or image files for intelligent text extraction, deterministic rule validation, and routing.
        </p>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Ingestion Controls */}
        <div className="lg:col-span-2 space-y-5">
          {/* Step 1: Document Classification Schema */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white tracking-tight">
                Classification Schema
              </label>
              <span className="text-[11px] text-slate-400">
                Auto-detect or designate target format
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {/* Auto-Detect Button */}
              <button
                type="button"
                onClick={() => setDocumentType('auto')}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  documentType === 'auto'
                    ? 'bg-slate-800 border-cyan-500/80 text-cyan-300'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="font-medium text-xs flex items-center justify-between">
                  <span>Auto-Detect</span>
                  {documentType === 'auto' && <Check className="w-3 h-3 text-cyan-400" />}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
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
                    className={`p-2.5 rounded-lg border text-left transition-colors ${
                      isSelected
                        ? 'bg-slate-800 border-cyan-500/80 text-cyan-300'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-medium text-xs flex items-center justify-between">
                      <span className="truncate">{DOCUMENT_SCHEMAS[type].title.split('/')[0].trim()}</span>
                      {isSelected && <Check className="w-3 h-3 text-cyan-400 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {DOCUMENT_SCHEMAS[type].fields.length} schema fields
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Drag & Drop Zone */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white tracking-tight">
                Document File
              </label>
              <span className="text-[11px] text-slate-400">
                PDF, PNG, JPG, or JPEG · Up to 15 MB
              </span>
            </div>

            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                selectedFile
                  ? 'border-cyan-500/50 bg-cyan-950/10'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/70'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center space-y-2.5">
                <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400">
                  <UploadCloud className="w-5 h-5 stroke-[2]" />
                </div>

                {selectedFile ? (
                  <div>
                    <p className="text-xs font-semibold text-white">{selectedFile.name}</p>
                    <p className="text-[11px] text-cyan-400 font-mono mt-0.5">
                      {Math.round(selectedFile.size / 1024)} KB · {selectedFile.type || 'Document'}
                    </p>
                    <span className="inline-block mt-1 text-[11px] text-slate-400 underline hover:text-slate-200">
                      Click or drag to replace
                    </span>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium text-slate-200">
                      Drag and drop your file here, or <span className="text-cyan-400 underline">browse files</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Accepts digital or scanned PDF, PNG, JPG/JPEG (Max 15MB)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Test Document Specimens (Consistently Styled Buttons) */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                <span className="text-[11px] font-medium text-slate-300">
                  Load Test Document Specimen:
                </span>
                <span className="text-[10px] text-slate-500">
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
                  className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-medium transition-colors"
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
                  className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-medium transition-colors"
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
                  className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-medium transition-colors"
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
                  className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-medium transition-colors"
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
                  className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-medium transition-colors"
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
                  className="px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 text-[11px] font-medium transition-colors"
                >
                  + Degraded Scan (JPG)
                </button>
              </div>
            </div>
          </div>

          {/* Step 3: Optional Cross-Document Verification */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-white tracking-tight">
                  Cross-Document Consistency Verification
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Optionally attach a secondary document (e.g. proof of address or utility bill) to test cross-field consistency rules.
                </p>
              </div>
              <input
                type="checkbox"
                id="includeCrossDoc"
                checked={includeCrossDoc}
                onChange={(e) => setIncludeCrossDoc(e.target.checked)}
                className="w-4 h-4 rounded text-cyan-500 border-slate-700 bg-slate-900 focus:ring-cyan-500 focus:ring-offset-slate-900 cursor-pointer"
              />
            </div>

            {includeCrossDoc && (
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Secondary Document Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. secondary_utility_bill.pdf"
                    value={crossDocName}
                    onChange={(e) => setCrossDocName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Secondary Document Text Payload (for comparison)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Utility Bill issued to Jordan Taylor Smith at 1204 Pine Crest Rd..."
                    value={crossDocText}
                    onChange={(e) => setCrossDocText(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Prominent Run Button */}
          <div>
            <button
              type="button"
              onClick={runPipeline}
              disabled={isProcessing || !selectedFile}
              className="w-full py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs tracking-tight shadow-sm flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing Document Pipeline...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4 stroke-[2]" />
                  <span>Run Document Review &amp; Routing</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right 1 Col: Schema Expectations & Pipeline Trace */}
        <div className="space-y-5">
          {/* Schema Requirements Card */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-4 sm:p-5">
            <h2 className="text-xs font-semibold text-white tracking-tight mb-3 flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>{currentSchema ? `Schema Rules: ${currentSchema.title}` : 'Classification & Extraction'}</span>
            </h2>

            {currentSchema ? (
              <div className="space-y-1.5">
                {currentSchema.fields.map((f) => (
                  <div
                    key={f.name}
                    className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-medium text-slate-200">{f.label}</span>
                      <span className="text-[10px] text-slate-500 ml-1.5 font-mono">({f.type})</span>
                    </div>
                    {f.required ? (
                      <span className="text-[10px] font-medium text-rose-400">
                        Required
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">
                        Optional
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2 text-xs text-slate-400">
                <p className="leading-relaxed">
                  Automatic inspection identifies whether the document is a Passport, National ID, Bank Statement, Utility Bill, or General Document.
                </p>
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px] text-slate-400">
                  <div className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span><strong>Digital PDF:</strong> Direct selectable text parsing</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    <span><strong>General PDF:</strong> General Document schema</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span><strong>Scanned / Image:</strong> OCR token recognition</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Real-time Agent Execution Trace */}
          <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-4 sm:p-5">
            <h2 className="text-xs font-semibold text-white tracking-tight mb-3 flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
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
                        ? 'bg-slate-800 border-cyan-500/80 text-cyan-300'
                        : isDone
                        ? 'bg-slate-950/60 border-slate-800 text-emerald-400'
                        : 'bg-slate-950/30 border-slate-800/60 text-slate-500'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                        isCurrent
                          ? 'bg-cyan-500 text-slate-950'
                          : isDone
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-800 text-slate-400'
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
              <div className="mt-3 p-3 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono text-cyan-300/80 space-y-1 max-h-36 overflow-y-auto">
                {liveLogs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
