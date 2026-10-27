/**
 * Dashboard Overview & Document Intake Queue View
 * AI Document Review & Routing Agent
 *
 * Implements:
 * - Theme-aware light & dark design tokens
 * - Bounded pagination with page size controls
 * - Filter & search state preservation
 * - Unobtrusive loading skeletons & rich empty states
 * - Interactive synthetic test scenarios
 * - Mobile QR Access Card
 */

import React, { useState, useMemo } from 'react';
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
  X,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Calendar,
  Filter
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
  isLoading?: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  cases,
  stats,
  onSelectCase,
  onOpenUpload,
  onRunSample,
  loadingSampleId,
  isLoading = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [queueFilter, setQueueFilter] = useState<string>('all');
  const [docTypeFilter, setDocTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Advanced Search & Filter States
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);
  const [documentIdFilter, setDocumentIdFilter] = useState<string>('');
  const [reviewerFilter, setReviewerFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [findingCategoryFilter, setFindingCategoryFilter] = useState<string>('all');
  const [findingSeverityFilter, setFindingSeverityFilter] = useState<string>('all');
  const [extractedFieldFilter, setExtractedFieldFilter] = useState<string>('');

  // Filter cases
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (queueFilter !== 'all' && c.assigned_queue !== queueFilter) return false;
      if (docTypeFilter !== 'all' && c.document_type !== docTypeFilter) return false;

      // Quick Search
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

      // Advanced Search: Document / Case ID
      if (documentIdFilter.trim()) {
        const idQ = documentIdFilter.toLowerCase().trim();
        const matchesId =
          c.case_id.toLowerCase().includes(idQ) || c.case_number.toLowerCase().includes(idQ);
        if (!matchesId) return false;
      }

      // Advanced Search: Reviewer
      if (reviewerFilter !== 'all') {
        const assigned = c.assigned_reviewer || c.reviewer_decision?.reviewed_by || '';
        if (reviewerFilter === 'unassigned') {
          if (assigned) return false;
        } else if (!assigned.toLowerCase().includes(reviewerFilter.toLowerCase())) {
          return false;
        }
      }

      // Advanced Search: Date Range
      if (startDate) {
        if (new Date(c.created_at) < new Date(startDate)) return false;
      }
      if (endDate) {
        const endD = new Date(endDate);
        endD.setHours(23, 59, 59, 999);
        if (new Date(c.created_at) > endD) return false;
      }

      // Advanced Search: Finding Category
      if (findingCategoryFilter !== 'all') {
        const hasCategory =
          c.validation_findings &&
          c.validation_findings.some(
            (f) =>
              f.category === findingCategoryFilter ||
              f.check_name.toLowerCase().includes(findingCategoryFilter.toLowerCase())
          );
        if (!hasCategory) return false;
      }

      // Advanced Search: Finding Severity
      if (findingSeverityFilter !== 'all') {
        const hasSeverity =
          c.validation_findings &&
          c.validation_findings.some(
            (f) =>
              f.severity === findingSeverityFilter ||
              (findingSeverityFilter === 'Critical' && f.severity === 'high') ||
              (findingSeverityFilter === 'Warning' && f.severity === 'medium') ||
              (findingSeverityFilter === 'Info' && f.severity === 'low')
          );
        if (!hasSeverity) return false;
      }

      // Advanced Search: Extracted Field Value
      if (extractedFieldFilter.trim()) {
        const efQ = extractedFieldFilter.toLowerCase().trim();
        const hasFieldMatch = c.extracted_fields.some(
          (f) =>
            f.field_name.toLowerCase().includes(efQ) ||
            f.field_value.toLowerCase().includes(efQ) ||
            (f.reviewed_value && f.reviewed_value.toLowerCase().includes(efQ))
        );
        if (!hasFieldMatch) return false;
      }

      return true;
    });
  }, [
    cases,
    statusFilter,
    queueFilter,
    docTypeFilter,
    searchQuery,
    documentIdFilter,
    reviewerFilter,
    startDate,
    endDate,
    findingCategoryFilter,
    findingSeverityFilter,
    extractedFieldFilter
  ]);

  // Reset page when filters change
  const handleFilterChange = (setter: (val: string) => void, val: string) => {
    setter(val);
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filteredCases.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const paginatedCases = filteredCases.slice(startIndex, startIndex + pageSize);

  const getStatusBadge = (status: CaseStatus) => {
    switch (status) {
      case 'Ready for Review':
        return (
          <span className="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 shrink-0" />
            Ready for Review
          </span>
        );
      case 'Needs More Information':
        return (
          <span className="inline-flex items-center text-xs font-medium text-amber-600 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2 shrink-0" />
            Needs Information
          </span>
        );
      case 'Priority Review':
        return (
          <span className="inline-flex items-center text-xs font-medium text-rose-600 dark:text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-2 shrink-0" />
            Priority Review
          </span>
        );
      case 'Review Completed':
        return (
          <span className="inline-flex items-center text-xs font-medium text-teal-600 dark:text-teal-300">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mr-2 shrink-0" />
            Completed
          </span>
        );
      case 'Processing Failed':
        return (
          <span className="inline-flex items-center text-xs font-medium text-rose-600 dark:text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-2 shrink-0" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-2 shrink-0" />
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

  const advancedFilterCount =
    (documentIdFilter.trim() ? 1 : 0) +
    (reviewerFilter !== 'all' ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0) +
    (findingCategoryFilter !== 'all' ? 1 : 0) +
    (findingSeverityFilter !== 'all' ? 1 : 0) +
    (extractedFieldFilter.trim() ? 1 : 0);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'all' ||
    queueFilter !== 'all' ||
    docTypeFilter !== 'all' ||
    advancedFilterCount > 0;

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setQueueFilter('all');
    setDocTypeFilter('all');
    setDocumentIdFilter('');
    setReviewerFilter('all');
    setStartDate('');
    setEndDate('');
    setFindingCategoryFilter('all');
    setFindingSeverityFilter('all');
    setExtractedFieldFilter('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Document Review and Verification Workspace
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            Extract document information, identify missing fields and inconsistencies, and route cases to the appropriate review queue.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('demo-scenarios-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full sm:w-auto px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs tracking-tight transition-colors cursor-pointer"
          >
            View Demo
          </button>
          <button
            type="button"
            onClick={onOpenUpload}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-semibold text-xs tracking-tight shadow-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Start Document Review</span>
          </button>
        </div>
      </div>

      {/* 2. Compact Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Documents */}
        <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Documents</div>
          <div className="mt-2 text-2xl font-semibold font-mono text-slate-900 dark:text-white tracking-tight">
            {stats.total}
          </div>
          <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">Across all intakes</div>
        </div>

        {/* Ready for Review */}
        <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
            <span>Ready for Review</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
            {stats.readyForReview}
          </div>
          <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">General Review queue</div>
        </div>

        {/* Needs Information */}
        <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center justify-between">
            <span>Needs Information</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono text-amber-600 dark:text-amber-400 tracking-tight">
            {stats.needsMoreInfo}
          </div>
          <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">Missing or low confidence</div>
        </div>

        {/* Priority Review */}
        <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center justify-between">
            <span>Priority Review</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono text-rose-600 dark:text-rose-400 tracking-tight">
            {stats.priorityReview}
          </div>
          <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">Format or identity conflicts</div>
        </div>

        {/* Completed Reviews */}
        <div className="col-span-2 lg:col-span-1 bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="text-[11px] font-medium text-teal-600 dark:text-teal-300 flex items-center justify-between">
            <span>Completed Reviews</span>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
          </div>
          <div className="mt-2 text-2xl font-semibold font-mono text-teal-600 dark:text-teal-300 tracking-tight">
            {stats.completed}
          </div>
          <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">Signed off by reviewer</div>
        </div>
      </div>

      {/* 3. Dedicated "Open on Mobile" QR Code Access Panel */}
      <MobileAccessCard />

      {/* 4. Interactive Test Scenarios (Demo Data) */}
      <div id="demo-scenarios-section" className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B1120] p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xs font-semibold text-slate-900 dark:text-white tracking-tight">
                Functional Demo Scenarios
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                Demo Data
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Run end-to-end extraction, deterministic validation, and queue routing on fictional test documents.
            </p>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
            {SYNTHETIC_SCENARIOS.length} specimens available
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
          {SYNTHETIC_SCENARIOS.map((scenario) => {
            const isLoadingThis = loadingSampleId === scenario.id;
            return (
              <div
                key={scenario.id}
                className="group rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/70 dark:bg-slate-950/60 p-3 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate">
                      {scenario.badge}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-slate-400 dark:bg-slate-600 group-hover:bg-cyan-500 dark:group-hover:bg-cyan-400 transition-colors" />
                  </div>
                  <h3 className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug">
                    {scenario.title}
                  </h3>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[90px]">
                    {scenario.expected_queue}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRunSample(scenario.id)}
                    disabled={isLoadingThis}
                    className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-cyan-600 hover:text-white dark:hover:bg-cyan-500 dark:hover:text-slate-950 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition-colors flex items-center space-x-1 disabled:opacity-50 cursor-pointer"
                  >
                    {isLoadingThis ? (
                      <>
                        <RotateCw className="w-3 h-3 animate-spin text-cyan-600 dark:text-cyan-400" />
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

      {/* 5. Document Intake & Case Table with Pagination */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B1120] overflow-hidden shadow-xs">
        {/* Table Filters & Search Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <h2 className="text-xs font-semibold text-slate-900 dark:text-white tracking-tight">
              Intake Cases
            </h2>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              ({filteredCases.length} records)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative w-full sm:w-auto sm:min-w-[200px] max-w-full flex-1 sm:flex-none">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search case, file, or name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
              className="py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500"
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
              onChange={(e) => handleFilterChange(setQueueFilter, e.target.value)}
              className="py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Queues</option>
              <option value="General Review">General Review</option>
              <option value="Missing Information">Missing Information</option>
              <option value="Priority Review">Priority Review</option>
            </select>

            {/* Document Type Filter */}
            <select
              value={docTypeFilter}
              onChange={(e) => handleFilterChange(setDocTypeFilter, e.target.value)}
              className="py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500"
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

            {/* Advanced Filters Toggle Button */}
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center space-x-1.5 transition-colors cursor-pointer ${
                isAdvancedOpen || advancedFilterCount > 0
                  ? 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-400 dark:border-cyan-700 text-cyan-800 dark:text-cyan-300'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Advanced</span>
              {advancedFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-cyan-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {advancedFilterCount}
                </span>
              )}
            </button>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="px-2.5 py-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-xs hover:bg-slate-100 dark:hover:bg-slate-850 flex items-center space-x-1 transition-colors cursor-pointer"
                title="Clear all filters"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Advanced Search & Filter Tray */}
        {isAdvancedOpen && (
          <div className="p-4 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800/80 text-xs space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                Advanced Intake Filters &amp; Query Parameters
              </span>
              <button
                type="button"
                onClick={() => setIsAdvancedOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[11px]"
              >
                Hide
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Document ID / Case Number */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Document / Case ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. CASE-2026-001 or UUID"
                  value={documentIdFilter}
                  onChange={(e) => {
                    setDocumentIdFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Reviewer Filter */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Assigned Reviewer
                </label>
                <select
                  value={reviewerFilter}
                  onChange={(e) => {
                    setReviewerFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Reviewers</option>
                  <option value="unassigned">Unassigned (Pending Review)</option>
                  <option value="Sarah Chen">Sarah Chen</option>
                  <option value="Alex Mercer">Alex Mercer</option>
                  <option value="Priya Sharma">Priya Sharma</option>
                  <option value="David Kim">David Kim</option>
                </select>
              </div>

              {/* Date Range Start */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Intake Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Date Range End */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Intake End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Finding Category */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Finding Category
                </label>
                <select
                  value={findingCategoryFilter}
                  onChange={(e) => {
                    setFindingCategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Finding Categories</option>
                  <option value="Missing Field">Missing Field</option>
                  <option value="Schema Inconsistency">Schema Inconsistency</option>
                  <option value="Format Mismatch">Format Mismatch</option>
                  <option value="Expiration Alert">Expiration Alert</option>
                  <option value="Cross-Document Discrepancy">Cross-Document Discrepancy</option>
                </select>
              </div>

              {/* Finding Severity */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Finding Severity
                </label>
                <select
                  value={findingSeverityFilter}
                  onChange={(e) => {
                    setFindingSeverityFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Severities</option>
                  <option value="Critical">Critical</option>
                  <option value="Warning">Warning</option>
                  <option value="Info">Info</option>
                </select>
              </div>

              {/* Extracted Field Value Query */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Extracted Field Name or Value
                </label>
                <input
                  type="text"
                  placeholder="e.g. passport_number, expiration_date, California..."
                  value={extractedFieldFilter}
                  onChange={(e) => {
                    setExtractedFieldFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-800/80">
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {isLoading ? (
                // Loading Skeleton Rows
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3.5 px-4"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded"></div></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded"></div></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded"></div></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded"></div></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded"></div></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded"></div></td>
                    <td className="py-3.5 px-4"><div className="h-4 w-12 bg-slate-200 dark:bg-slate-800 rounded"></div></td>
                    <td className="py-3.5 px-4 text-right"><div className="h-6 w-14 bg-slate-200 dark:bg-slate-800 rounded ml-auto"></div></td>
                  </tr>
                ))
              ) : filteredCases.length === 0 ? (
                // Requirement 5: Rich Empty State
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <Inbox className="w-5 h-5 stroke-[1.5]" />
                      </div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {cases.length === 0 ? 'No documents ingested yet' : 'No cases match the specified filters'}
                      </p>
                      <p className="text-[11px] text-slate-500 max-w-sm">
                        {cases.length === 0
                          ? 'Upload your first document or click any synthetic scenario specimen above to start verification.'
                          : 'Try modifying your search query or clearing active status and queue filters.'}
                      </p>
                      {hasActiveFilters && (
                        <button
                          onClick={resetFilters}
                          className="mt-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
                        >
                          Clear active filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedCases.map((c) => {
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
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group"
                      onClick={() => onSelectCase(c.case_id)}
                    >
                      {/* Case Number */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                        {c.case_number}
                      </td>

                      {/* Document Type & File Name */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-200">
                          {getDocTypeLabel(c.document_type)}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[170px]" title={c.file_name}>
                          {c.file_name}
                        </div>
                      </td>

                      {/* Subject Name */}
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                        {subjectName}
                      </td>

                      {/* Workflow Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getStatusBadge(c.status)}
                      </td>

                      {/* Assigned Queue */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {c.assigned_queue}
                      </td>

                      {/* Active Findings */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {activeFindings.length === 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 text-xs flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <div className="flex items-center space-x-1 text-[11px]">
                            {inconsistencies > 0 && (
                              <span className="text-rose-600 dark:text-rose-400 font-medium">
                                {inconsistencies} conflict
                              </span>
                            )}
                            {inconsistencies > 0 && (missingFields > 0 || formatErrors > 0) && (
                              <span className="text-slate-400">·</span>
                            )}
                            {missingFields > 0 && (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                {missingFields} missing
                              </span>
                            )}
                            {missingFields > 0 && formatErrors > 0 && (
                              <span className="text-slate-400">·</span>
                            )}
                            {formatErrors > 0 && (
                              <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                                {formatErrors} format
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Time */}
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono text-[11px]">
                        {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCase(c.case_id);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-cyan-600 hover:text-white dark:bg-slate-800 dark:hover:bg-cyan-500 dark:hover:text-slate-950 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors inline-flex items-center space-x-1 cursor-pointer"
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

        {/* Requirement 10: Server & Client-side Pagination Footer */}
        {filteredCases.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center space-x-2">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value, 10));
                  setCurrentPage(1);
                }}
                className="py-1 px-2 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="font-mono">
                Showing {startIndex + 1}–{Math.min(startIndex + pageSize, filteredCases.length)} of {filteredCases.length}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={validPage <= 1}
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                Page {validPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={validPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
