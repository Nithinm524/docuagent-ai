import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Edit3,
  RotateCw,
  Printer,
  Sparkles,
  Layers,
  Activity,
  Check,
  X,
  UserCheck,
  HelpCircle,
  ChevronRight,
  ExternalLink,
  Trash2,
  Download,
  Lock
} from 'lucide-react';
import {
  CaseRecord,
  ExtractedField,
  ValidationFinding,
  CaseStatus,
  ReviewerQueue
} from '../shared/types.ts';
import { DOCUMENT_SCHEMAS } from '../shared/validation.ts';

interface CaseDetailViewProps {
  caseData: CaseRecord;
  onBack: () => void;
  onFieldUpdated: (fieldId: string, reviewedValue: string) => Promise<void>;
  onFindingResolved: (findingId: string, resolved: boolean, notes?: string) => Promise<void>;
  onReviewAction: (action: string, notes: string, newQueue?: ReviewerQueue, newStatus?: CaseStatus) => Promise<void>;
  onReRunAgent: () => Promise<void>;
  onOpenReport: () => void;
  onDeleteCase?: (caseId: string) => Promise<void>;
  onPurgeCaseData?: (caseId: string) => Promise<void>;
  onWithdrawConsent?: (caseId: string) => Promise<void>;
  isProcessing: boolean;
}

export const CaseDetailView: React.FC<CaseDetailViewProps> = ({
  caseData,
  onBack,
  onFieldUpdated,
  onFindingResolved,
  onReviewAction,
  onReRunAgent,
  onOpenReport,
  onDeleteCase,
  onPurgeCaseData,
  onWithdrawConsent,
  isProcessing
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'fields' | 'findings' | 'document' | 'trace' | 'audit'>('overview');

  // Deletion & Data Minimisation Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPurgingData, setIsPurgingData] = useState(false);
  const [isDeletingPermanently, setIsDeletingPermanently] = useState(false);
  const [isWithdrawingConsent, setIsWithdrawingConsent] = useState(false);
  const [statusAnnouncement, setStatusAnnouncement] = useState('');

  // Field Edit Modal State
  const [editingField, setEditingField] = useState<ExtractedField | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSavingField, setIsSavingField] = useState(false);

  // Finding Resolve State
  const [resolvingFinding, setResolvingFinding] = useState<ValidationFinding | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isSavingFinding, setIsSavingFinding] = useState(false);

  // Review Action Drawer
  const [actionNotes, setActionNotes] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const openEditField = (field: ExtractedField) => {
    setEditingField(field);
    setEditValue(field.reviewed_value ?? field.field_value);
  };

  const handleSaveField = async () => {
    if (!editingField) return;
    setIsSavingField(true);
    try {
      await onFieldUpdated(editingField.field_id, editValue);
      setEditingField(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingField(false);
    }
  };

  const handleSaveFinding = async () => {
    if (!resolvingFinding) return;
    setIsSavingFinding(true);
    try {
      await onFindingResolved(resolvingFinding.finding_id, !resolvingFinding.resolved, resolutionNotes);
      setResolvingFinding(null);
      setResolutionNotes('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingFinding(false);
    }
  };

  const handleAction = async (action: string, newQueue?: ReviewerQueue, newStatus?: CaseStatus) => {
    setIsSubmittingAction(true);
    try {
      await onReviewAction(action, actionNotes, newQueue, newStatus);
      setActionNotes('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const getStatusBadge = (status: CaseStatus) => {
    switch (status) {
      case 'Ready for Review':
        return (
          <span className="inline-flex items-center text-xs font-medium text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 shrink-0" />
            Ready for Review
          </span>
        );
      case 'Needs More Information':
        return (
          <span className="inline-flex items-center text-xs font-medium text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 shrink-0" />
            Needs Information
          </span>
        );
      case 'Priority Review':
        return (
          <span className="inline-flex items-center text-xs font-medium text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5 shrink-0" />
            Priority Review
          </span>
        );
      case 'Review Completed':
        return (
          <span className="inline-flex items-center text-xs font-medium text-teal-300">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mr-1.5 shrink-0" />
            Review Completed
          </span>
        );
      case 'Processing Failed':
        return (
          <span className="inline-flex items-center text-xs font-medium text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 shrink-0" />
            Processing Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-xs font-medium text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-1.5 shrink-0" />
            {status}
          </span>
        );
    }
  };

  const activeFindings = caseData.validation_findings.filter(
    (f) => !f.resolved && f.result !== 'passed'
  );
  const resolvedFindings = caseData.validation_findings.filter((f) => f.resolved);

  return (
    <div className="space-y-5 pb-16">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white border border-slate-300 dark:border-slate-800 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
            aria-label="Return to Dashboard"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-mono tracking-tight">
                {caseData.case_number}
              </h1>
              {getStatusBadge(caseData.status)}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>File: <span className="text-slate-800 dark:text-slate-200 font-medium">{caseData.file_name}</span></span>
              <span>• Type: <span className="text-cyan-700 dark:text-cyan-400 font-medium">{DOCUMENT_SCHEMAS[caseData.document_type]?.title || caseData.document_type}</span></span>
              {caseData.extraction_method && (
                <span>• Extraction: <span className="text-slate-700 dark:text-slate-300 font-medium">{caseData.extraction_method}</span></span>
              )}
              {caseData.is_selectable_pdf !== undefined && (
                <span>• <span className={caseData.is_selectable_pdf ? "text-emerald-700 dark:text-emerald-400 font-medium" : "text-amber-700 dark:text-amber-400 font-medium"}>
                  {caseData.is_selectable_pdf ? "✓ Selectable PDF Text" : "Scanned / Raster OCR"}
                </span></span>
              )}
              <span>• Intake: {new Date(caseData.created_at).toLocaleString()}</span>
            </p>
            {caseData.classification_reason && (
              <div className="mt-1.5 text-[11px] text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900/80 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 flex items-center space-x-1.5">
                <span className="font-semibold text-cyan-700 dark:text-cyan-400">Classification:</span>
                <span>{caseData.classification_reason}</span>
              </div>
            )}
          </div>
        </div>

        {/* Live Region for Screen Readers */}
        <div aria-live="polite" className="sr-only">
          {statusAnnouncement}
        </div>

        {/* Action Buttons with Clear Labels */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onReRunAgent}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
            title="Re-run deterministic rules on updated fields"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin text-cyan-600 dark:text-cyan-400' : ''}`} aria-hidden="true" />
            <span>Re-evaluate Case</span>
          </button>

          <button
            type="button"
            onClick={onOpenReport}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
            <span>Download Report</span>
          </button>

          {(onDeleteCase || onPurgeCaseData) && (
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 dark:bg-slate-900 dark:hover:bg-rose-950/40 border border-slate-300 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-800 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-500"
              title="Open document deletion and data minimisation options"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
              <span>Delete Document</span>
            </button>
          )}

          {/* Quick Review Decisions */}
          {caseData.status !== 'Review Completed' && (
            <button
              type="button"
              onClick={() => handleAction('mark_complete')}
              disabled={isSubmittingAction}
              className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-slate-950 text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
              <span>Finalize Review</span>
            </button>
          )}
        </div>
      </div>

      {/* Responsible AI Notice Banner */}
      <div className="p-3 rounded-lg bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-start space-x-2.5">
        <ShieldAlert className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-800 dark:text-slate-300 font-medium">Decision-Support Standard:</strong> This system assists human intake specialists with field extraction, schema rule validation, and routing recommendations. Final disposition authority remains with authorized human reviewers.
        </div>
      </div>

      {/* Agent Routing Recommendation Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B1120] p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800/80">
          <div>
            <div className="flex items-center space-x-2 text-cyan-600 dark:text-cyan-400 text-[11px] font-semibold uppercase tracking-wider mb-0.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Automated Agent Routing</span>
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
              <span>Recommended Queue:</span>
              <span className="text-cyan-700 dark:text-cyan-400">
                {caseData.assigned_queue}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
              {caseData.routing_reason}
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-xs text-slate-500 dark:text-slate-400">Active Findings:</span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${
                activeFindings.length > 0
                  ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              }`}
            >
              {activeFindings.length} open
            </span>
          </div>
        </div>

        {/* Executive Summary Excerpt */}
        {caseData.executive_summary && (
          <div className="pt-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              <span className="flex items-center space-x-1.5 text-cyan-700 dark:text-cyan-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Executive Screening Synthesis</span>
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line bg-slate-50 dark:bg-slate-950/70 p-3 rounded-lg border border-slate-200 dark:border-slate-800 font-sans">
              {caseData.executive_summary}
            </p>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2 sm:space-x-4 overflow-x-auto">
        {[
          { id: 'overview', label: 'Case Summary', count: null },
          { id: 'fields', label: 'Extracted Fields', count: caseData.extracted_fields.length },
          { id: 'findings', label: 'Validation Findings', count: activeFindings.length },
          { id: 'document', label: 'Original Payload', count: null },
          { id: 'trace', label: 'Agent Workflow Trace', count: caseData.agent_trace.length },
          { id: 'audit', label: 'Audit Trail', count: caseData.audit_events.length }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-2 text-xs font-semibold border-b-2 transition-all flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'border-cyan-600 dark:border-cyan-400 text-cyan-700 dark:text-cyan-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeTab === tab.id
                    ? 'bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview Summary */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Fields & Key Findings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Structured Fields Snapshot */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span>Key Extracted Fields</span>
                </h3>
                <button
                  onClick={() => setActiveTab('fields')}
                  className="text-xs text-cyan-700 dark:text-cyan-400 hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <span>View all &amp; edit</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {caseData.extracted_fields.slice(0, 6).map((f) => {
                  const val = f.reviewed_value ?? f.field_value;
                  const isEdited = f.is_edited;
                  return (
                    <div
                      key={f.field_id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{f.field_label}</span>
                        {f.is_uncertain && !isEdited ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Uncertain
                          </span>
                        ) : isEdited ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                            Edited
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                            {Math.round(f.confidence * 100)}% conf
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white mt-1.5 truncate">
                        {val || <span className="text-slate-400 dark:text-slate-500 italic">Not extracted</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Findings Preview */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <AlertOctagon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span>Validation Findings Overview</span>
                </h3>
                <button
                  onClick={() => setActiveTab('findings')}
                  className="text-xs text-cyan-700 dark:text-cyan-400 hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <span>Manage findings</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {activeFindings.length === 0 ? (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>All deterministic schema validations and format bounds passed without active flags.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeFindings.map((finding) => (
                    <div
                      key={finding.finding_id}
                      className={`p-3.5 rounded-xl border text-xs flex flex-col space-y-1.5 ${
                        finding.category === 'inconsistency'
                          ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200'
                          : finding.category === 'missing_information'
                          ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200'
                          : 'bg-yellow-50/70 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900/50 text-yellow-900 dark:text-yellow-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center space-x-1.5">
                          {finding.category === 'inconsistency' && <AlertOctagon className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />}
                          {finding.category === 'missing_information' && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                          {finding.category === 'format_error' && <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />}
                          <span>{finding.check_name}</span>
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                          {finding.severity} Severity
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                        {finding.explanation}
                      </p>
                      {finding.evidence_reference && (
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          Evidence: {finding.evidence_reference}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Consent & Data Protection Lifecycle Card (DPDP Ready) */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
                  <span>Data Protection &amp; Consent Lifecycle</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                  DPDP Act Ready
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Consent Evidence</span>
                  <div className="flex items-center space-x-1.5">
                    {caseData.consent_record?.withdrawn ? (
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                        Consent Withdrawn
                      </span>
                    ) : caseData.consent_record ? (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        Consent Active (v{caseData.consent_record.notice_version})
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Synthetic Demo Intake (Simulated)
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Retention Expiration</span>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-mono">
                    {caseData.retention_until ? new Date(caseData.retention_until).toLocaleDateString() : '90-Day Policy Window'}
                  </div>
                </div>
              </div>

              {caseData.is_purged && (
                <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 flex items-center space-x-2">
                  <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" aria-hidden="true" />
                  <span>Document payload and personal identifiers have been expunged under data minimisation policy.</span>
                </div>
              )}

              {/* Action Controls for Consent Withdrawal & Data Purging */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                {!caseData.consent_record?.withdrawn && onWithdrawConsent && (
                  <button
                    type="button"
                    onClick={async () => {
                      setIsWithdrawingConsent(true);
                      await onWithdrawConsent(caseData.case_id);
                      setIsWithdrawingConsent(false);
                      setStatusAnnouncement('Document processing consent withdrawn and personal data minimised.');
                    }}
                    disabled={isWithdrawingConsent}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isWithdrawingConsent ? 'Recording Withdrawal...' : 'Withdraw Consent (DPDP Sec 6)'}
                  </button>
                )}
                {(onPurgeCaseData || onDeleteCase) && (
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-xs font-semibold text-rose-700 dark:text-rose-400 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    Delete Document / Purge Data
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right 1 Col: Reviewer Action Panel */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Reviewer Decision Panel</span>
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Reviewer Notes / Rationale
                </label>
                <textarea
                  rows={3}
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Record verification notes, submitter outreach comments, or resolution details..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleAction('approve_ready', 'General Review', 'Ready for Review')}
                  disabled={isSubmittingAction}
                  className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 flex items-center justify-center space-x-2 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Mark Ready for Review</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAction('request_info', 'Missing Information', 'Needs More Information')}
                  disabled={isSubmittingAction}
                  className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 flex items-center justify-center space-x-2 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Request Missing Information</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAction('escalate_priority', 'Priority Review', 'Priority Review')}
                  disabled={isSubmittingAction}
                  className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 flex items-center justify-center space-x-2 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Escalate to Priority Review</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAction('mark_complete', caseData.assigned_queue, 'Review Completed')}
                  disabled={isSubmittingAction}
                  className="w-full py-2.5 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 text-xs font-bold shadow-xs flex items-center justify-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>Finalize &amp; Complete Review</span>
                </button>
              </div>
            </div>

            {/* Quick Metadata Box */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs space-y-2 text-slate-600 dark:text-slate-400 shadow-xs">
              <div className="flex justify-between">
                <span>Case ID:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{caseData.case_id}</span>
              </div>
              <div className="flex justify-between">
                <span>File Size:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{caseData.file_size_kb} KB</span>
              </div>
              <div className="flex justify-between">
                <span>MIME Type:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{caseData.file_mime}</span>
              </div>
              <div className="flex justify-between">
                <span>Assigned Reviewer:</span>
                <span className="text-cyan-700 dark:text-cyan-400 font-medium">{caseData.assigned_reviewer || 'Unassigned (Pool)'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Extracted Fields (with Human-in-the-Loop Edit Modal) */}
      {activeTab === 'fields' && (
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Extracted Document Fields</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Human reviewers can correct any field value. Edits are recorded immediately in the immutable audit log.
              </p>
            </div>
            <button
              onClick={onReRunAgent}
              disabled={isProcessing}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-300 text-xs font-semibold border border-slate-300 dark:border-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Re-run Validation</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-[#0B1120] text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Field Attribute</th>
                  <th className="py-3 px-4">Extracted Value</th>
                  <th className="py-3 px-4">OCR Confidence</th>
                  <th className="py-3 px-4">Uncertainty State</th>
                  <th className="py-3 px-4">Reviewed / Corrected Value</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                {caseData.extracted_fields.map((f) => {
                  const hasReviewed = f.is_edited && f.reviewed_value !== undefined;
                  return (
                    <tr key={f.field_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-200">
                        {f.field_label}
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{f.field_name}</div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {f.field_value ? (
                          <span className="text-slate-800 dark:text-slate-200">{f.field_value}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">[Empty / Unextracted]</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full ${
                                f.confidence >= 0.8
                                  ? 'bg-emerald-500'
                                  : f.confidence >= 0.6
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.round(f.confidence * 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {Math.round(f.confidence * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {f.is_uncertain ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <AlertTriangle className="w-3 h-3 mr-1 text-amber-500" />
                            Uncertain
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Confident
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {hasReviewed ? (
                          <span className="text-cyan-700 dark:text-cyan-300 font-semibold px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/60">
                            {f.reviewed_value}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">Unchanged</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openEditField(f)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-cyan-50 dark:bg-slate-800 dark:hover:bg-cyan-500 dark:hover:text-slate-950 text-cyan-700 dark:text-cyan-400 text-xs font-medium border border-slate-300 dark:border-slate-700 hover:border-cyan-400 transition-colors inline-flex items-center space-x-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Correct</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Validation Findings Matrix */}
      {activeTab === 'findings' && (
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Validation Findings &amp; Rule Engine</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Checks executed by deterministic rules. Reviewers can mark findings as resolved or add resolution notes.
              </p>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {caseData.validation_findings.length} total checks performed
            </div>
          </div>

          <div className="space-y-3">
            {caseData.validation_findings.map((finding) => (
              <div
                key={finding.finding_id}
                className={`p-4 rounded-xl border text-xs transition-all ${
                  finding.resolved
                    ? 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 opacity-80'
                    : finding.category === 'inconsistency'
                    ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 text-slate-800 dark:text-slate-200'
                    : finding.category === 'missing_information'
                    ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60 text-slate-800 dark:text-slate-200'
                    : 'bg-yellow-50/70 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900/60 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        finding.category === 'inconsistency'
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                          : finding.category === 'missing_information'
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                          : 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-800'
                      }`}
                    >
                      {finding.category.replace('_', ' ')}
                    </span>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{finding.check_name}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {finding.resolved ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[11px] font-semibold flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Resolved</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[11px] font-semibold">
                        Severity: {finding.severity.toUpperCase()}
                      </span>
                    )}

                    <button
                      onClick={() => {
                        setResolvingFinding(finding);
                        setResolutionNotes(finding.resolution_notes || '');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      {finding.resolved ? 'Edit Resolution' : 'Resolve Finding'}
                    </button>
                  </div>
                </div>

                <p className="mt-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {finding.explanation}
                </p>

                {finding.evidence_reference && (
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Evidence Reference: <span className="text-cyan-700 dark:text-cyan-300">{finding.evidence_reference}</span>
                  </div>
                )}

                {finding.resolution_notes && (
                  <div className="mt-2 p-2 rounded-lg bg-emerald-50/70 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800/80 text-[11px] text-emerald-800 dark:text-emerald-300">
                    <strong>Reviewer Note:</strong> {finding.resolution_notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Original Document & Raw OCR Text */}
      {activeTab === 'document' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Document File Card */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <FileText className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Primary Document Submission</span>
            </h3>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-50 dark:bg-cyan-950 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-700 dark:text-cyan-400 font-bold text-xs uppercase">
                  {caseData.file_name.split('.').pop() || 'DOC'}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{caseData.file_name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    {caseData.file_size_kb} KB • {caseData.file_mime}
                  </div>
                </div>
              </div>
            </div>

            {/* Uploaded Image Graphic Preview */}
            {caseData.file_data_url && caseData.file_mime.startsWith('image/') && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mb-2 font-mono uppercase tracking-wider">
                  Original Uploaded Image Preview
                </span>
                <img
                  src={caseData.file_data_url}
                  alt={`Document preview of ${caseData.file_name} for case ${caseData.case_number}`}
                  className="max-h-[260px] w-auto rounded-lg object-contain border border-slate-300 dark:border-slate-700 shadow-md"
                />
              </div>
            )}

            {/* Uploaded PDF Preview */}
            {caseData.file_data_url && caseData.file_mime === 'application/pdf' && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase tracking-wider">
                    Uploaded Digital PDF Preview
                  </span>
                  <a
                    href={caseData.file_data_url}
                    download={caseData.file_name}
                    className="text-xs text-cyan-700 dark:text-cyan-400 hover:underline flex items-center space-x-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download PDF</span>
                  </a>
                </div>
                <iframe
                  src={caseData.file_data_url}
                  title="PDF Preview"
                  className="w-full h-[300px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white"
                />
              </div>
            )}

            {/* Simulated Document Preview Canvas */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/90 font-mono text-[11px] text-slate-800 dark:text-slate-300 leading-relaxed max-h-[380px] overflow-y-auto whitespace-pre-line border-l-4 border-l-cyan-600 dark:border-l-cyan-500">
              {caseData.raw_text || (
                <span className="text-slate-400 dark:text-slate-500 italic">No raw text stream extracted.</span>
              )}
            </div>
          </div>

          {/* Secondary Cross-Document Card (if present) */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Secondary Cross-Reference Document</span>
            </h3>

            {caseData.cross_reference_text ? (
              <>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-400 font-bold text-xs uppercase">
                    REF
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {caseData.cross_reference_file_name || 'cross_reference_payload.pdf'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Cross-Document Consistency Source
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/90 font-mono text-[11px] text-slate-800 dark:text-slate-300 leading-relaxed max-h-[380px] overflow-y-auto whitespace-pre-line border-l-4 border-l-amber-600 dark:border-l-amber-500">
                  {caseData.cross_reference_text}
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                No secondary cross-reference document was attached to this case. Single-document rules applied.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Agent Workflow Trace */}
      {activeTab === 'trace' && (
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Activity className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Agentic Execution Trace &amp; Tool History</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Autonomous agent workflow steps demonstrating goal setting, tool selection, rule evaluation, and routing.
              </p>
            </div>
            <div className="text-xs text-cyan-700 dark:text-cyan-400 font-mono font-semibold">
              Total execution: ~{caseData.agent_trace.reduce((acc, t) => acc + t.duration_ms, 0)} ms
            </div>
          </div>

          <div className="space-y-3">
            {caseData.agent_trace.map((step) => (
              <div
                key={step.step_number}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-lg bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    {step.step_number}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                      <span>{step.tool_name}</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">({step.status})</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{step.tool_purpose}</p>
                    <div className="mt-2 text-xs text-slate-800 dark:text-slate-200 font-mono bg-white dark:bg-slate-900/90 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      {step.output_summary}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                    {step.duration_ms} ms
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 6: Complete Audit Trail */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Immutable Case Audit History</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Every agent extraction, deterministic validation, reviewer correction, and status change is immutably logged.
              </p>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {caseData.audit_events.length} audit entries
            </div>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {caseData.audit_events.map((evt) => (
              <div key={evt.event_id} className="relative group">
                {/* Dot */}
                <div
                  className={`absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full border-2 ${
                    evt.actor === 'AI Agent'
                      ? 'bg-cyan-500 border-white dark:border-slate-950'
                      : evt.actor === 'Human Reviewer'
                      ? 'bg-emerald-500 border-white dark:border-slate-950'
                      : 'bg-slate-400 border-white dark:border-slate-950'
                  }`}
                />

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          evt.actor === 'AI Agent'
                            ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300'
                            : evt.actor === 'Human Reviewer'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {evt.actor}
                      </span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{evt.event_type}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                      {new Date(evt.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{evt.summary}</p>
                  {evt.details && (
                    <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 font-mono bg-white dark:bg-slate-900/70 p-2 rounded border border-slate-200 dark:border-slate-800/60">
                      {evt.details}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Field Correction Modal */}
      {editingField && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-field-title"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 id="edit-field-title" className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Correct Extracted Field</span>
              </h3>
              <button
                onClick={() => setEditingField(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1">
                Field: <span className="text-slate-900 dark:text-white">{editingField.field_label}</span>
              </label>
              <div className="text-[11px] text-slate-500 mb-2">
                Original extracted value: "{editingField.field_value || 'None'}"
              </div>
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 font-mono"
                autoFocus
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveField}
                disabled={isSavingField}
                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSavingField ? 'Saving...' : 'Save Correction'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Finding Modal */}
      {resolvingFinding && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="resolve-finding-title"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 id="resolve-finding-title" className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>
                  {resolvingFinding.resolved ? 'Update Finding Resolution' : 'Resolve Finding'}
                </span>
              </h3>
              <button
                onClick={() => setResolvingFinding(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">{resolvingFinding.check_name}</div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                {resolvingFinding.explanation}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-400 mb-1">
                Resolution Explanation / Reviewer Notes
              </label>
              <textarea
                rows={3}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="e.g. Verified with primary document scan, manual identity match confirmed..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setResolvingFinding(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFinding}
                disabled={isSavingFinding}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSavingFinding ? 'Saving...' : 'Confirm Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accessible Deletion & Data Minimisation Confirmation Modal */}
      {isDeleteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400">
                <Trash2 className="w-5 h-5" aria-hidden="true" />
                <h2 id="delete-dialog-title" className="text-base font-bold text-slate-900 dark:text-white">
                  Document Deletion &amp; Data Minimisation
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-cyan-500"
                aria-label="Close deletion options dialog"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              Select how you would like to handle case <strong className="font-mono text-slate-900 dark:text-white">{caseData.case_number}</strong>:
            </p>

            <div className="space-y-3">
              {/* Option A: Purge Data (Data Minimisation) */}
              <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-indigo-950 dark:text-indigo-200">
                    Option A: Purge Personal Data &amp; Files (Data Minimisation)
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                    DPDP Recommended
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Permanently deletes uploaded document file images, raw text streams, and masks extracted personal values. Retains case metadata and the immutable audit trail for compliance.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    if (onPurgeCaseData) {
                      setIsPurgingData(true);
                      await onPurgeCaseData(caseData.case_id);
                      setIsPurgingData(false);
                      setIsDeleteModalOpen(false);
                      setStatusAnnouncement('Document personal data successfully purged.');
                    }
                  }}
                  disabled={isPurgingData || caseData.is_purged}
                  className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {isPurgingData ? 'Purging Personal Data...' : 'Purge Document Data'}
                </button>
              </div>

              {/* Option B: Complete Permanent Deletion */}
              <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-rose-950 dark:text-rose-200">
                    Option B: Permanently Delete Entire Case
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                    Irreversible
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Permanently expunges this case record, findings, file previews, and all associated audit events from the storage database. Cannot be recovered.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    if (onDeleteCase) {
                      setIsDeletingPermanently(true);
                      await onDeleteCase(caseData.case_id);
                      setIsDeletingPermanently(false);
                      setIsDeleteModalOpen(false);
                    }
                  }}
                  disabled={isDeletingPermanently}
                  className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  {isDeletingPermanently ? 'Expunging Case...' : 'Permanently Delete Case'}
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
