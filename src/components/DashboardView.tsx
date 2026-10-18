import React, { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Search,
  ArrowRight,
  ShieldAlert,
  Play,
  RotateCw,
  Plus,
  SlidersHorizontal,
  X
} from 'lucide-react';
import {
  CaseRecord,
  CaseStatus,
  ReviewerQueue,
  DocumentType
} from '../shared/types.ts';
import { SYNTHETIC_SCENARIOS } from '../shared/samples.ts';
import { MobileAccessCard } from './MobileAccessCard.tsx';

interface DashboardViewProps {
  cases: CaseRecord[];
  stats: {
    total: number;
    readyForReview: number;
    needsMoreInfo: number;
    priorityReview: number;
    completed: number;
    failed: number;
    queues: { general: number; missing_info: number; priority: number };
    byDocType: Record<string, number>;
  };
  onSelectCase: (caseId: string) => void;
  onOpenUpload: () => void;
  onRunSample: (scenarioId: string) => Promise<void>;
  loadingSampleId: string | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  cases,
  stats,
  onSelectCase,
  onOpenUpload,
  onRunSample,
  loadingSampleId
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [queueFilter, setQueueFilter] = useState<string>('all');
  const [docTypeFilter, setDocTypeFilter] = useState<string>('all');

  // Filter cases
  const filteredCases = cases.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (queueFilter !== 'all' && c.assigned_queue !== queueFilter) return false;
    if (docTypeFilter !== 'all' && c.document_type !== docTypeFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNumber = c.case_number.toLowerCase().includes(q);
      const matchFile = c.file_name.toLowerCase().includes(q);
      const matchFields = c.extracted_fields.some(
        (f) =>
          f.field_value.toLowerCase().includes(q) ||
          (f.reviewed_value && f.reviewed_value.toLowerCase().includes(q))
      );
      if (!matchNumber && !matchFile && !matchFields) return false;
    }

    return true;
  });

  const getStatusBadge = (status: CaseStatus) => {
    switch (status) {
      case 'Ready for Review':
        return (
          <span className="inline-flex items-center text-xs font-medium text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2 shrink-0" />
            Ready for Review
          </span>
        );
      case 'Needs More Information':
        return (
          <span className="inline-flex items-center text-xs font-medium text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-2 shrink-0" />
            Needs Information
          </span>
        );
      case 'Priority Review':
        return (
          <span className="inline-flex items-center text-xs font-medium text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-2 shrink-0" />
            Priority Review
          </span>
        );
      case 'Review Completed':
        return (
          <span className="inline-flex items-center text-xs font-medium text-teal-300">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mr-2 shrink-0" />
            Completed
          </span>
        );
      case 'Processing Failed':
        return (
          <span className="inline-flex items-center text-xs font-medium text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-2 shrink-0" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-xs font-medium text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-2 shrink-0" />
            {status}
          </span>
        );
    }
  };

  const getDocTypeLabel = (dt: DocumentType) => {
    switch (dt) {
      case 'passport':
        return 'Passport';
      case 'national_id':
        return 'National ID / DL';
      case 'utility_bill':
        return 'Utility Bill';
      case 'bank_statement':
        return 'Bank Statement';
      case 'employment_verification':
        return 'Employment Letter';
      case 'invoice':
        return 'Invoice';
      case 'general_doc':
        return 'General Document';
      case 'unknown':
        return 'Unknown';
      default:
        return dt;
    }
  };

  const getSubjectName = (c: CaseRecord) => {
    const f = c.extracted_fields.find(
      (field) =>
        field.field_name === 'full_name' ||
        field.field_name === 'account_holder_name' ||
        field.field_name === 'employee_name' ||
        field.field_name === 'document_title'
    );
    return (
      f?.reviewed_value ||
      f?.field_value ||
      (c.processing_error
        ? 'Unreadable Scan'
        : c.document_type === 'general_doc'
        ? 'General Document'
        : c.document_type === 'unknown'
        ? 'Unclassified'
        : 'Unextracted')
    );
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'all' ||
    queueFilter !== 'all' ||
    docTypeFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setQueueFilter('all');
    setDocTypeFilter('all');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Compact Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Document Intelligence
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-2xl">
            Review documents, identify inconsistencies, and manage verification workflows.
          </p>
        </div>

        <div className="shrink-0">
          <button
            onClick={onOpenUpload}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs tracking-tight shadow-sm flex items-center justify-center space-x-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* 2. Compact Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Documents */}
        <div className="bg-[#0B1120] border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400">Total Documents</div>
          <div className="mt-2 text-2xl font-semibold font-mono text-white tracking-tight">
            {stats.total}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">Across all intakes</div>
        </div>

        {/* Ready for Review */}
        <div className="bg-[#0B1120] border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-emerald-400/90 flex items-center justify-between">
            <span>Ready for Review</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono text-emerald-400 tracking-tight">
            {stats.readyForReview}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">General Review queue</div>
        </div>

        {/* Needs Information */}
        <div className="bg-[#0B1120] border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-amber-400/90 flex items-center justify-between">
            <span>Needs Information</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono text-amber-400 tracking-tight">
            {stats.needsMoreInfo}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">Missing or low confidence</div>
        </div>

        {/* Priority Review */}
        <div className="bg-[#0B1120] border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-rose-400/90 flex items-center justify-between">
            <span>Priority Review</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono text-rose-400 tracking-tight">
            {stats.priorityReview}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">Format or identity conflicts</div>
        </div>

        {/* Completed Reviews */}
        <div className="col-span-2 lg:col-span-1 bg-[#0B1120] border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-teal-300 flex items-center justify-between">
            <span>Completed Reviews</span>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono text-teal-300 tracking-tight">
            {stats.completed}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">Signed off by reviewer</div>
        </div>
      </div>

      {/* 3. Dedicated "Open on Mobile" QR Code Access Panel */}
      <MobileAccessCard />

      {/* 4. Interactive Test Scenarios */}
      <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3.5">
          <div>
            <h2 className="text-xs font-semibold text-white tracking-tight flex items-center space-x-1.5">
              <span>Test Scenarios</span>
              <span className="text-[10px] font-normal text-slate-400">
                · One-click pipeline verification
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Run end-to-end extraction, validation, and queue routing on pre-configured test files.
            </p>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {SYNTHETIC_SCENARIOS.length} specimens available
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
          {SYNTHETIC_SCENARIOS.map((scenario) => {
            const isLoading = loadingSampleId === scenario.id;
            return (
              <div
                key={scenario.id}
                className="group rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/60 p-3 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[10px] font-medium text-slate-400 truncate">
                      {scenario.badge}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-slate-600 group-hover:bg-cyan-400 transition-colors" />
                  </div>
                  <h3 className="text-xs font-medium text-slate-200 line-clamp-2 leading-snug">
                    {scenario.title}
                  </h3>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400 truncate max-w-[90px]">
                    {scenario.expected_queue}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRunSample(scenario.id)}
                    disabled={isLoading}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 text-[11px] font-medium transition-colors flex items-center space-x-1 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <RotateCw className="w-3 h-3 animate-spin text-cyan-400" />
                        <span>Running</span>
                      </>
                    ) : (
                      <>
                        <span>Run</span>
                        <ArrowRight className="w-3 h-3" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Document Intake & Case Table */}
      <div className="rounded-xl border border-slate-800/80 bg-[#0B1120] overflow-hidden">
        {/* Table Filters & Search Header */}
        <div className="p-4 border-b border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <h2 className="text-xs font-semibold text-white tracking-tight">
              Intake Cases
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              ({filteredCases.length} of {cases.length})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:flex-none">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search case, file, or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Statuses</option>
              <option value="Ready for Review">Ready for Review</option>
              <option value="Needs More Information">Needs Information</option>
              <option value="Priority Review">Priority Review</option>
              <option value="Review Completed">Completed</option>
              <option value="Processing Failed">Failed</option>
            </select>

            {/* Queue Filter */}
            <select
              value={queueFilter}
              onChange={(e) => setQueueFilter(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Queues</option>
              <option value="General Review">General Review</option>
              <option value="Missing Information">Missing Information</option>
              <option value="Priority Review">Priority Review</option>
            </select>

            {/* Document Type Filter */}
            <select
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Document Types</option>
              <option value="general_doc">General Document</option>
              <option value="passport">Passport</option>
              <option value="national_id">National ID / DL</option>
              <option value="utility_bill">Utility Bill</option>
              <option value="bank_statement">Bank Statement</option>
              <option value="employment_verification">Employment Letter</option>
              <option value="invoice">Invoice</option>
              <option value="unknown">Unknown</option>
            </select>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs hover:bg-slate-850 flex items-center space-x-1 transition-colors"
                title="Clear all filters"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-medium border-b border-slate-800/80">
              <tr>
                <th className="py-2.5 px-4 font-normal">Case</th>
                <th className="py-2.5 px-4 font-normal">Document</th>
                <th className="py-2.5 px-4 font-normal">Subject</th>
                <th className="py-2.5 px-4 font-normal">Workflow Status</th>
                <th className="py-2.5 px-4 font-normal">Queue</th>
                <th className="py-2.5 px-4 font-normal">Findings</th>
                <th className="py-2.5 px-4 font-normal">Time</th>
                <th className="py-2.5 px-4 font-normal text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <p className="text-xs">No cases match the specified filters.</p>
                    {hasActiveFilters && (
                      <button
                        onClick={resetFilters}
                        className="mt-2 text-xs text-cyan-400 hover:underline"
                      >
                        Clear active filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => {
                  const subjectName = getSubjectName(c);
                  const activeFindings = c.validation_findings.filter(
                    (f) => !f.resolved && f.result !== 'passed'
                  );
                  const inconsistencies = activeFindings.filter((f) => f.category === 'inconsistency').length;
                  const missingFields = activeFindings.filter((f) => f.category === 'missing_information').length;
                  const formatErrors = activeFindings.filter((f) => f.category === 'format_error').length;

                  return (
                    <tr
                      key={c.case_id}
                      className="hover:bg-slate-800/30 transition-colors cursor-pointer group"
                      onClick={() => onSelectCase(c.case_id)}
                    >
                      {/* Case Number */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-200 group-hover:text-cyan-300 transition-colors">
                        {c.case_number}
                      </td>

                      {/* Document Type & File Name */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-200">
                          {getDocTypeLabel(c.document_type)}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[170px]" title={c.file_name}>
                          {c.file_name}
                        </div>
                      </td>

                      {/* Subject Name */}
                      <td className="py-3 px-4 font-medium text-slate-200 truncate max-w-[160px]">
                        {subjectName}
                      </td>

                      {/* Workflow Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getStatusBadge(c.status)}
                      </td>

                      {/* Assigned Queue */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-300">
                        {c.assigned_queue}
                      </td>

                      {/* Active Findings */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {activeFindings.length === 0 ? (
                          <span className="text-emerald-400/90 text-xs flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <div className="flex items-center space-x-1 text-[11px]">
                            {inconsistencies > 0 && (
                              <span className="text-rose-400 font-medium">
                                {inconsistencies} conflict
                              </span>
                            )}
                            {inconsistencies > 0 && (missingFields > 0 || formatErrors > 0) && (
                              <span className="text-slate-600">·</span>
                            )}
                            {missingFields > 0 && (
                              <span className="text-amber-400 font-medium">
                                {missingFields} missing
                              </span>
                            )}
                            {missingFields > 0 && formatErrors > 0 && (
                              <span className="text-slate-600">·</span>
                            )}
                            {formatErrors > 0 && (
                              <span className="text-yellow-400 font-medium">
                                {formatErrors} format
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Time */}
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                        {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCase(c.case_id);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 text-xs font-medium transition-colors inline-flex items-center space-x-1"
                        >
                          <span>Review</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
