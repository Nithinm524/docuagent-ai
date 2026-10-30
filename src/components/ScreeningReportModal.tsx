import React, { useState } from 'react';
import {
  X,
  Printer,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Sparkles,
  RotateCw,
  FileText,
  Clock,
  Download
} from 'lucide-react';
import { CaseRecord } from '../shared/types.ts';
import { DOCUMENT_SCHEMAS } from '../shared/validation.ts';
import { downloadCasePdfReport } from '../utils/pdfReportGenerator.ts';

interface ScreeningReportModalProps {
  caseData: CaseRecord;
  onClose: () => void;
  onRegenerateSummary: () => Promise<void>;
  isRegenerating: boolean;
}

export const ScreeningReportModal: React.FC<ScreeningReportModalProps> = ({
  caseData,
  onClose,
  onRegenerateSummary,
  isRegenerating
}) => {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    setIsDownloadingPdf(true);
    try {
      downloadCasePdfReport(caseData);
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setTimeout(() => setIsDownloadingPdf(false), 800);
    }
  };

  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(caseData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `screening_report_${caseData.case_number}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const subjectField = caseData.extracted_fields.find(
    (f) =>
      f.field_name === 'full_name' ||
      f.field_name === 'account_holder_name' ||
      f.field_name === 'employee_name'
  );
  const subjectName = subjectField?.reviewed_value || subjectField?.field_value || 'Subject';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-800 dark:text-slate-200">
        {/* Modal Top Bar (Hidden in Print) */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex items-center justify-between no-print">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <span className="font-bold text-sm text-slate-900 dark:text-white">
              Official Document Screening Report • {caseData.case_number}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onRegenerateSummary}
              disabled={isRegenerating}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-300 text-xs font-medium border border-slate-300 dark:border-slate-700 flex items-center space-x-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              title="Regenerate neutral summary using Gemini 3.8 Flash"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-cyan-600 dark:text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">Refresh AI Summary</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              title="Generate and download vector PDF screening report"
            >
              <Download className={`w-3.5 h-3.5 ${isDownloadingPdf ? 'animate-bounce' : ''}`} />
              <span>{isDownloadingPdf ? 'Downloading...' : 'Download PDF'}</span>
            </button>

            <button
              onClick={handleDownloadJson}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-300 dark:border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export JSON</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-300 dark:border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Report Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-800 dark:text-slate-200 font-sans print:text-black print:bg-white print:p-0">
          {/* Official Document Header */}
          <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 print:text-blue-700">
                  DOCUAGENT · Document Intelligence &amp; Review
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white print:text-slate-900 tracking-tight mt-0.5">
                  Document Screening &amp; Verification Report
                </h1>
              </div>
              <div className="text-left sm:text-right font-mono text-xs text-slate-500 dark:text-slate-400 print:text-slate-600">
                <div>Case ID: <span className="text-slate-900 dark:text-white print:text-black font-bold">{caseData.case_number}</span></div>
                <div>Generated: {new Date().toLocaleString()}</div>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 print:bg-slate-100 border border-slate-200 dark:border-slate-800 print:border-slate-300 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 print:text-slate-500 block text-[10px] uppercase font-semibold">Document Type</span>
                <span className="font-bold text-slate-900 dark:text-white print:text-black">
                  {DOCUMENT_SCHEMAS[caseData.document_type]?.title || caseData.document_type}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 print:text-slate-500 block text-[10px] uppercase font-semibold">Screening Status</span>
                <span className="font-bold text-cyan-700 dark:text-cyan-400 print:text-blue-800">{caseData.status}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 print:text-slate-500 block text-[10px] uppercase font-semibold">Assigned Queue</span>
                <span className="font-bold text-slate-900 dark:text-white print:text-black">{caseData.assigned_queue}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 print:text-slate-500 block text-[10px] uppercase font-semibold">Subject Identity</span>
                <span className="font-bold text-slate-900 dark:text-white print:text-black">{subjectName}</span>
              </div>
            </div>
          </div>

          {/* Section 1: Executive AI Screening Synthesis */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 print:text-blue-800 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>1. Executive Screening Synthesis</span>
            </h2>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 print:bg-slate-50 border border-slate-200 dark:border-slate-800 print:border-slate-200 text-xs leading-relaxed text-slate-800 dark:text-slate-300 print:text-slate-800 whitespace-pre-line">
              {caseData.executive_summary || caseData.routing_reason}
            </div>
          </div>

          {/* Section 2: Extracted Fields & Confidence */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 print:text-blue-800">
              2. Structured Fields &amp; Extraction Confidence
            </h2>
            <div className="border border-slate-200 dark:border-slate-800 print:border-slate-300 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[500px] sm:min-w-full">
                <thead className="bg-slate-100 dark:bg-[#0B1120] print:bg-slate-200 text-slate-700 dark:text-slate-400 print:text-slate-700 font-semibold border-b border-slate-200 dark:border-slate-800 print:border-slate-300">
                  <tr>
                    <th className="py-2.5 px-3">Field Name</th>
                    <th className="py-2.5 px-3">Extracted Value</th>
                    <th className="py-2.5 px-3">Confidence</th>
                    <th className="py-2.5 px-3">Reviewer Corrected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 print:divide-slate-200 text-slate-800 dark:text-slate-300 print:text-slate-800">
                  {caseData.extracted_fields.map((f) => (
                    <tr key={f.field_id}>
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-200">{f.field_label}</td>
                      <td className="py-2 px-3 font-mono">
                        {f.field_value || <span className="text-slate-400 dark:text-slate-500 italic">[Empty]</span>}
                      </td>
                      <td className="py-2 px-3 font-mono">{Math.round(f.confidence * 100)}%</td>
                      <td className="py-2 px-3 font-mono">
                        {f.is_edited && f.reviewed_value ? (
                          <span className="text-cyan-700 dark:text-cyan-400 print:text-blue-700 font-bold">{f.reviewed_value}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Deterministic Validation Checks */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 print:text-blue-800">
              3. Deterministic Validation Findings
            </h2>
            <div className="border border-slate-200 dark:border-slate-800 print:border-slate-300 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[600px] sm:min-w-full">
                <thead className="bg-slate-100 dark:bg-[#0B1120] print:bg-slate-200 text-slate-700 dark:text-slate-400 print:text-slate-700 font-semibold border-b border-slate-200 dark:border-slate-800 print:border-slate-300">
                  <tr>
                    <th className="py-2.5 px-3">Check Specification</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Result</th>
                    <th className="py-2.5 px-3">Explanation &amp; Evidence</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 print:divide-slate-200 text-slate-800 dark:text-slate-300 print:text-slate-800">
                  {caseData.validation_findings.map((f) => (
                    <tr key={f.finding_id}>
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-200">{f.check_name}</td>
                      <td className="py-2 px-3 uppercase text-[10px] text-slate-500 dark:text-slate-400">{f.category.replace('_', ' ')}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`font-bold ${
                            f.result === 'passed'
                              ? 'text-emerald-600 dark:text-emerald-400 print:text-green-700'
                              : f.result === 'warning'
                              ? 'text-amber-600 dark:text-amber-400 print:text-yellow-700'
                              : 'text-rose-600 dark:text-rose-400 print:text-red-700'
                          }`}
                        >
                          {f.result.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[11px] max-w-xs">{f.explanation}</td>
                      <td className="py-2 px-3 text-[11px]">
                        {f.resolved ? (
                          <span className="text-emerald-600 dark:text-emerald-400 print:text-green-700 font-semibold">Resolved</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 print:text-yellow-700 font-medium">Open</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Audit Trail Summary */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 print:text-blue-800">
              4. Chronological Audit History
            </h2>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 print:bg-slate-50 border border-slate-200 dark:border-slate-800 print:border-slate-200 text-[11px] font-mono space-y-1.5 max-h-48 overflow-y-auto">
              {caseData.audit_events.map((evt) => (
                <div key={evt.event_id} className="flex items-start space-x-2 text-slate-700 dark:text-slate-300 print:text-slate-800">
                  <span className="text-slate-400 dark:text-slate-500 shrink-0">
                    [{new Date(evt.created_at).toLocaleTimeString()}]
                  </span>
                  <span className="text-cyan-700 dark:text-cyan-400 print:text-blue-700 shrink-0 font-semibold">[{evt.actor}]</span>
                  <span>{evt.summary}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Responsible AI Standard Statement */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 print:text-slate-500 leading-relaxed">
            <strong>Responsible AI &amp; Legal Disclaimer:</strong> This screening report is produced by an automated decision-support pipeline (DOCUAGENT). Extracted confidence values and screening flags do not constitute a legal identity verification or fraud determination. Consequential intake decisions require sign-off by an authorized human reviewer.
          </div>
        </div>
      </div>
    </div>
  );
};
