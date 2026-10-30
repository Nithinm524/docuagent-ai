import React, { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  X,
  RotateCw,
  ArrowRight,
  ShieldCheck,
  Eye,
  Layers,
  Inbox,
  AlertCircle
} from 'lucide-react';
import { CaseRecord, DocumentType } from '../shared/types.ts';
import { DOCUMENT_SCHEMAS } from '../shared/validation.ts';

export type ScanningStage =
  | 'uploaded'
  | 'scanning'
  | 'extracting'
  | 'analyzing'
  | 'validating'
  | 'ready'
  | 'error';

export interface StageDetail {
  message: string;
  method?: 'pdf_text' | 'ocr';
  ocrMethodName?: string;
  subMessage?: string;
  documentType?: DocumentType;
}

export interface DocumentScanningAnimationProps {
  file: File;
  previewUrl: string | null;
  currentStage: ScanningStage;
  stageDetail: StageDetail | null;
  statusMessage: string;
  isPdf: boolean;
  onCancel: () => void;
  error: string | null;
  onRetry: () => void;
  onReset: () => void;
  completedCase: CaseRecord | null;
  onOpenDetails: (caseId: string) => void;
  onViewQueue?: (queue: string) => void;
}

interface PipelineStageConfig {
  id: ScanningStage;
  stepNumber: number;
  label: string;
  description: string;
}

export const DocumentScanningAnimation: React.FC<DocumentScanningAnimationProps> = ({
  file,
  previewUrl,
  currentStage,
  stageDetail,
  statusMessage,
  isPdf,
  onCancel,
  error,
  onRetry,
  onReset,
  completedCase,
  onOpenDetails,
  onViewQueue
}) => {
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  // Determine stage index (0 to 5)
  const getStageIndex = (stage: ScanningStage): number => {
    switch (stage) {
      case 'uploaded':
        return 0;
      case 'scanning':
        return 1;
      case 'extracting':
        return 2;
      case 'analyzing':
        return 3;
      case 'validating':
        return 4;
      case 'ready':
        return 5;
      case 'error':
      default:
        return -1;
    }
  };

  const currentStageIndex = getStageIndex(currentStage);

  // Dynamic label for extraction stage based on real method
  const extractionMethodLabel = isPdf && stageDetail?.method === 'pdf_text'
    ? 'Digital PDF text stream parsing'
    : isPdf
    ? 'Scanned PDF OCR token extraction'
    : 'Image optical character recognition';

  const stages: PipelineStageConfig[] = [
    {
      id: 'uploaded',
      stepNumber: 1,
      label: 'File Uploaded',
      description: 'Passed initial upload, signature, and size validation'
    },
    {
      id: 'scanning',
      stepNumber: 2,
      label: 'Scanning Document',
      description: 'Preparing document structure and payload headers'
    },
    {
      id: 'extracting',
      stepNumber: 3,
      label: 'Extracting Text',
      description: extractionMethodLabel
    },
    {
      id: 'analyzing',
      stepNumber: 4,
      label: 'Analyzing Document',
      description: 'Classifying document schema and extracting structured attributes'
    },
    {
      id: 'validating',
      stepNumber: 5,
      label: 'Validating Information',
      description: 'Evaluating deterministic business rules, dates, and consistency'
    },
    {
      id: 'ready',
      stepNumber: 6,
      label: 'Review Ready',
      description: 'Synthesis complete and routed to human reviewer queue'
    }
  ];

  // Dynamic progress calculated from actual completed stages - never hardcoded to 42%
  const getStageProgress = (stage: ScanningStage): number => {
    switch (stage) {
      case 'uploaded':
        return 15;
      case 'scanning':
        return 30;
      case 'extracting':
        return 60;
      case 'analyzing':
        return 80;
      case 'validating':
        return 92;
      case 'ready':
        return 100;
      case 'error':
      default:
        return 0;
    }
  };

  const progressPercent = getStageProgress(currentStage);
  const isActivelyScanning = currentStage !== 'ready' && currentStage !== 'error' && !error;

  return (
    <div
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070b14] overflow-hidden shadow-xl transition-all"
      role="region"
      aria-label="Document scanning and review workspace"
    >
      {/* Live Region for Screen-Reader Status Updates */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
        aria-atomic="true"
      >
        {statusMessage || 'Processing document...'}
      </div>

      {/* Top Header Bar */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#0B1120] flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/60 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
            {isPdf ? (
              <FileText className="w-5 h-5 stroke-[2]" aria-hidden="true" />
            ) : (
              <ImageIcon className="w-5 h-5 stroke-[2]" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {file.name}
            </h2>
            <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              <span>{Math.round(file.size / 1024)} KB</span>
              <span>·</span>
              <span>{file.type || (isPdf ? 'application/pdf' : 'image/jpeg')}</span>
              <span>·</span>
              <span className="text-cyan-600 dark:text-cyan-400">
                {isPdf ? 'PDF Document' : 'Raster Image'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 shrink-0">
          {currentStage !== 'ready' && !error && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center space-x-1.5 focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Cancel</span>
            </button>
          )}

          {(currentStage === 'ready' || error) && (
            <button
              type="button"
              onClick={onReset}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center space-x-1.5 focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <span>Upload Another File</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Stage Body */}
      <div className="p-5 sm:p-7">
        {/* Error State */}
        {error ? (
          <div
            role="alert"
            className="p-6 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 space-y-4"
          >
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-rose-900 dark:text-rose-100">
                  Document Processing Halted
                </h3>
                <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
                  {error}
                </p>
                <p className="text-[11px] text-rose-700 dark:text-rose-400 pt-1">
                  {error.includes('credentials') || error.includes('Authentication')
                    ? 'How to resolve: Verify your session credentials or use the 1-Click Demo Reviewer mode to proceed.'
                    : error.includes('15MB') || error.includes('size')
                    ? 'How to resolve: Compress the document or split pages so the file is under the 15MB upload boundary.'
                    : error.includes('format') || error.includes('extension')
                    ? 'How to resolve: Ensure the document is in PDF, PNG, or JPEG format.'
                    : 'How to resolve: Ensure the file is not password-protected, does not exceed 15MB, and contains legible printed or digital text.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onRetry}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center space-x-1.5 focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Try Again</span>
              </button>
              <button
                type="button"
                onClick={onReset}
                className="px-4 py-2 rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
              >
                Choose Another Document
              </button>
            </div>
          </div>
        ) : currentStage === 'ready' && completedCase ? (
          /* Real Results View (Smoothly Transitioned from Scanning) */
          <div className="space-y-6">
            {/* Header Banner */}
            <div className={`p-4 sm:p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              completedCase.status === 'Needs More Information'
                ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/70 dark:bg-[#1a1408]'
                : completedCase.status === 'Priority Review'
                ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/70 dark:bg-[#1a0808]'
                : completedCase.status === 'Processing Failed'
                ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/70 dark:bg-[#1a0808]'
                : 'border-emerald-300 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-[#071912]'
            }`}>
              <div className="flex items-start space-x-3.5">
                <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm ${
                  completedCase.status === 'Needs More Information'
                    ? 'bg-amber-600'
                    : completedCase.status === 'Priority Review'
                    ? 'bg-rose-600'
                    : completedCase.status === 'Processing Failed'
                    ? 'bg-rose-700'
                    : 'bg-emerald-600'
                }`}>
                  {completedCase.status === 'Needs More Information' ? (
                    <AlertTriangle className="w-6 h-6 stroke-[2]" aria-hidden="true" />
                  ) : completedCase.status === 'Priority Review' || completedCase.status === 'Processing Failed' ? (
                    <AlertCircle className="w-6 h-6 stroke-[2]" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 stroke-[2]" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      {completedCase.status === 'Needs More Information'
                        ? 'Document Ingestion Incomplete: Missing Required Information'
                        : completedCase.status === 'Priority Review'
                        ? 'Document Ingestion Complete: Escalated to Priority Review'
                        : completedCase.status === 'Processing Failed'
                        ? 'Document Ingestion Failed'
                        : 'Document Ingestion & Validation Complete'}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800">
                      Case {completedCase.case_number}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    {completedCase.status === 'Needs More Information'
                      ? `Required schema fields were missing or incomplete. Routed to ${completedCase.assigned_queue} queue for manual intake.`
                      : `Document classified as ${DOCUMENT_SCHEMAS[completedCase.document_type]?.title || completedCase.document_type} and routed to ${completedCase.assigned_queue}.`}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenDetails(completedCase.case_id)}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs tracking-tight transition-colors shadow-sm cursor-pointer flex items-center space-x-1.5 focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Inspect Case &amp; Review</span>
                </button>
              </div>
            </div>

            {/* Results Grid: Extracted Fields & Validation Findings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Left Column: Extracted Fields */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Extracted Schema Fields ({completedCase.extracted_fields.length})
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    Method: {completedCase.extraction_method}
                  </span>
                </div>

                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {completedCase.extracted_fields.map((f) => (
                    <div
                      key={f.field_name}
                      className="p-2 rounded-lg bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] block">
                          {f.field_label}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate block font-mono">
                          {f.field_value ? (
                            f.field_value
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                              Missing Field
                            </span>
                          )}
                        </span>
                        {f.source_snippet && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block font-mono mt-0.5">
                            Evidence: {f.source_snippet}
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {f.field_value ? (
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                              f.confidence >= 0.85
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                                : f.confidence >= 0.6
                                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {Math.round(f.confidence * 100)}% conf
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                            N/A (Missing)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Validation Findings */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Validation Rules ({completedCase.validation_findings.length})
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Status: <strong>{completedCase.status}</strong>
                  </span>
                </div>

                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {completedCase.validation_findings.map((finding) => (
                    <div
                      key={finding.finding_id}
                      className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                        finding.result === 'passed'
                          ? 'bg-white dark:bg-[#0B1120] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                          : finding.severity === 'high'
                          ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200'
                          : 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[11px]">{finding.check_name}</span>
                        <span
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            finding.result === 'passed'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                              : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {finding.result}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                        {finding.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Decision Disclaimer & Bottom Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
              <p className="text-[11px] leading-relaxed">
                <strong>Decision Support Notice:</strong> DOCUAGENT AI provides assistive document intake screening. Final approval or rejection rests exclusively with authorized human reviewer specialists.
              </p>
              <div className="flex items-center space-x-2.5 shrink-0">
                {onViewQueue && (
                  <button
                    type="button"
                    onClick={() => onViewQueue(completedCase.assigned_queue)}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <Inbox className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>View in {completedCase.assigned_queue}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenDetails(completedCase.case_id)}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center space-x-1.5"
                >
                  <span>Open Full Detail View</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Active Clean Realistic Scanning Visualization & Pipeline Trace */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column: Realistic Document Inspection Graphic (7 cols) */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center">
              {/* Document Frame Container */}
              <div className="relative w-full max-w-[320px] sm:max-w-[360px]">
                {/* Clean Realistic Document Card Frame */}
                <div className="relative aspect-[3/4] w-full rounded-2xl bg-slate-900/90 dark:bg-[#0B1120] border border-cyan-500/30 dark:border-cyan-500/20 shadow-2xl p-4 sm:p-5 flex flex-col overflow-hidden select-none">
                  
                  {/* Subtle Moving Scan Line with Gentle Glow (Active during processing) */}
                  {isActivelyScanning && (
                    <div
                      aria-hidden="true"
                      className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_rgba(6,182,212,0.5)] animate-scan-beam z-20 pointer-events-none"
                    >
                      <div className="absolute -top-2 left-0 right-0 h-4 bg-gradient-to-b from-cyan-400/10 to-transparent pointer-events-none" />
                    </div>
                  )}

                  {/* Document Page Canvas */}
                  <div className="relative flex-1 rounded-xl bg-white dark:bg-[#070b14] border border-slate-200 dark:border-slate-800/80 p-4 flex flex-col justify-between overflow-hidden shadow-inner">
                    
                    {!isPdf && previewUrl && !imageLoadFailed ? (
                      /* Realistic Image Document Preview with Detection Highlights */
                      <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-lg">
                        <img
                          src={previewUrl}
                          alt="Uploaded document preview"
                          onError={() => setImageLoadFailed(true)}
                          className="max-h-full max-w-full object-contain rounded opacity-90"
                        />
                        {/* Detection Highlights Overlaid on Thumbnail */}
                        <div
                          aria-hidden="true"
                          className="absolute top-4 left-4 right-8 h-6 rounded border border-cyan-400/50 bg-cyan-400/10 pointer-events-none animate-pulse-subtle"
                        />
                        <div
                          aria-hidden="true"
                          className="absolute bottom-8 left-6 w-36 h-5 rounded border border-teal-400/50 bg-teal-400/10 pointer-events-none"
                        />
                      </div>
                    ) : (
                      /* Realistic Document Page Mockup with Document Structure & Detection Highlights */
                      <div className="w-full h-full flex flex-col justify-between space-y-3">
                        {/* Document Letterhead / Top Zone */}
                        <div className="space-y-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="w-6 h-6 rounded bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/50 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                                <FileText className="w-3.5 h-3.5" />
                              </div>
                              <div className="h-2.5 w-24 rounded bg-slate-300 dark:bg-slate-700 font-semibold" />
                            </div>
                            <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400">
                              {file.type ? file.type.split('/')[1]?.toUpperCase() : (isPdf ? 'PDF' : 'DOC')}
                            </span>
                          </div>
                          <div className="h-1.5 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
                        </div>

                        {/* Document Content Lines & Structured Highlights */}
                        <div className="space-y-2.5 flex-1 pt-1">
                          {/* Highlight Zone 1: Document Identifier */}
                          <div className="p-1.5 rounded-lg border border-cyan-400/40 bg-cyan-50/60 dark:bg-cyan-950/30 space-y-1">
                            <div className="flex items-center justify-between text-[9px] font-mono text-cyan-700 dark:text-cyan-300">
                              <span>DOCUMENT IDENTIFIER</span>
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                            </div>
                            <div className="h-2 w-4/5 rounded bg-cyan-300/50 dark:bg-cyan-700/50" />
                          </div>

                          {/* Standard Body Lines */}
                          <div className="space-y-1.5 py-1">
                            <div className="h-1.5 w-full rounded bg-slate-200 dark:bg-slate-800/80" />
                            <div className="h-1.5 w-11/12 rounded bg-slate-200 dark:bg-slate-800/80" />
                            <div className="h-1.5 w-4/5 rounded bg-slate-200 dark:bg-slate-800/80" />
                          </div>

                          {/* Highlight Zone 2: Validity / Date Zone */}
                          <div className="p-1.5 rounded-lg border border-teal-400/40 bg-teal-50/60 dark:bg-teal-950/30 space-y-1">
                            <div className="flex items-center justify-between text-[9px] font-mono text-teal-700 dark:text-teal-300">
                              <span>METADATA &amp; DATES</span>
                            </div>
                            <div className="h-2 w-3/5 rounded bg-teal-300/50 dark:bg-teal-700/50" />
                          </div>

                          {/* Secondary Text Lines */}
                          <div className="space-y-1.5">
                            <div className="h-1.5 w-full rounded bg-slate-200 dark:bg-slate-800/80" />
                            <div className="h-1.5 w-3/4 rounded bg-slate-200 dark:bg-slate-800/80" />
                          </div>
                        </div>

                        {/* Realistic Document Bottom Bar */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 font-mono">
                          <span className="truncate max-w-[130px]">{file.name}</span>
                          <span>{Math.round(file.size / 1024)} KB</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Inspection Frame Footer Status */}
                  <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-300">
                    <span className="truncate max-w-[180px] text-slate-400">{file.name}</span>
                    <span className="text-cyan-400 font-semibold">{progressPercent}%</span>
                  </div>
                </div>
              </div>

              {/* Status Label Beneath the Graphic */}
              <div className="mt-4 text-center space-y-1 max-w-sm">
                <div className="inline-flex items-center space-x-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-cyan-300">
                  <RotateCw className="w-3.5 h-3.5 animate-spin text-cyan-500 dark:text-cyan-400" aria-hidden="true" />
                  <span>{statusMessage}</span>
                </div>
                {stageDetail?.subMessage && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {stageDetail.subMessage}
                  </p>
                )}
              </div>

              {/* Progress Indicator */}
              <div className="w-full max-w-xs mt-3">
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1 font-mono">
                  <span>Stage {currentStageIndex >= 0 ? currentStageIndex + 1 : 1} of {stages.length}</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-cyan-500 h-1.5 rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Real Processing Stages Sequence (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Automated Intake Pipeline
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Stages update directly from real agent backend events
                </p>
              </div>

              <div className="space-y-2">
                {stages.map((stageItem, index) => {
                  const isCurrent = currentStageIndex === index;
                  const isDone = currentStageIndex > index;

                  return (
                    <div
                      key={stageItem.id}
                      className={`p-3 rounded-xl border text-xs transition-all ${
                        isCurrent
                          ? 'bg-cyan-50/80 dark:bg-cyan-950/30 border-cyan-500/80 dark:border-cyan-500/50 shadow-sm'
                          : isDone
                          ? 'bg-slate-50/60 dark:bg-slate-900/30 border-emerald-200 dark:border-emerald-900/40 text-slate-700 dark:text-slate-300'
                          : 'bg-transparent border-slate-200 dark:border-slate-800/60 text-slate-400 dark:text-slate-600'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        {/* Step Marker */}
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 ${
                            isCurrent
                              ? 'bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 animate-pulse'
                              : isDone
                              ? 'bg-emerald-600 dark:bg-emerald-500 text-white'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
                          ) : (
                            stageItem.stepNumber
                          )}
                        </div>

                        {/* Title and Detail */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span
                              className={`font-semibold ${
                                isCurrent
                                  ? 'text-cyan-900 dark:text-cyan-300'
                                  : isDone
                                  ? 'text-slate-900 dark:text-slate-200'
                                  : 'text-slate-400 dark:text-slate-500'
                              }`}
                            >
                              {stageItem.label}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 animate-pulse font-semibold">
                                Running...
                              </span>
                            )}
                            {isDone && (
                              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                                Done
                              </span>
                            )}
                          </div>
                          <p
                            className={`text-[11px] mt-0.5 leading-relaxed ${
                              isCurrent
                                ? 'text-cyan-800 dark:text-cyan-200'
                                : isDone
                                ? 'text-slate-500 dark:text-slate-400'
                                : 'text-slate-400 dark:text-slate-600'
                            }`}
                          >
                            {stageItem.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Informational Guidance */}
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <p>
                  Documents are evaluated strictly against deterministic schema constraints and assigned to specialist reviewer queues.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
