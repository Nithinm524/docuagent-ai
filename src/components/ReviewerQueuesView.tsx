import React, { useState } from 'react';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ArrowRight,
  Search,
  Check,
  RotateCw
} from 'lucide-react';
import { CaseRecord, ReviewerQueue, CaseStatus } from '../shared/types.ts';
import { DOCUMENT_SCHEMAS } from '../shared/validation.ts';

interface ReviewerQueuesViewProps {
  cases: CaseRecord[];
  onSelectCase: (caseId: string) => void;
  onReviewAction: (
    caseId: string,
    action: string,
    notes: string,
    newQueue?: ReviewerQueue,
    newStatus?: CaseStatus
  ) => Promise<void>;
}

export const ReviewerQueuesView: React.FC<ReviewerQueuesViewProps> = ({
  cases,
  onSelectCase,
  onReviewAction
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('all');

  const filteredCases = cases.filter((c) => {
    if (docTypeFilter !== 'all' && c.document_type !== docTypeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNum = c.case_number.toLowerCase().includes(q);
      const matchName = c.extracted_fields.some((f) => f.field_value.toLowerCase().includes(q));
      if (!matchNum && !matchName) return false;
    }
    return true;
  });

  const priorityCases = filteredCases.filter(
    (c) => c.assigned_queue === 'Priority Review' && c.status !== 'Review Completed'
  );
  const missingCases = filteredCases.filter(
    (c) => c.assigned_queue === 'Missing Information' && c.status !== 'Review Completed'
  );
  const generalCases = filteredCases.filter(
    (c) => c.assigned_queue === 'General Review' && c.status !== 'Review Completed'
  );
  const completedCases = filteredCases.filter((c) => c.status === 'Review Completed');

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
        ? 'Unclassified Document'
        : 'Unextracted Subject')
    );
  };

  const renderCaseCard = (c: CaseRecord) => {
    const subject = getSubjectName(c);
    const activeFindings = c.validation_findings.filter((f) => !f.resolved && f.result !== 'passed');
    const inconsistencies = activeFindings.filter((f) => f.category === 'inconsistency').length;
    const missing = activeFindings.filter((f) => f.category === 'missing_information').length;
    const format = activeFindings.filter((f) => f.category === 'format_error').length;

    return (
      <div
        key={c.case_id}
        onClick={() => onSelectCase(c.case_id)}
        className="rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/60 dark:bg-slate-950/80 p-3.5 transition-colors cursor-pointer group flex flex-col justify-between space-y-3 shadow-xs"
      >
        <div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-mono font-medium text-slate-800 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
              {c.case_number}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="mt-1 font-semibold text-xs text-slate-900 dark:text-white truncate">
            {subject}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {DOCUMENT_SCHEMAS[c.document_type]?.title.split('/')[0].trim() || c.document_type}
          </div>

          {/* Finding Badges */}
          <div className="mt-2.5">
            {activeFindings.length === 0 ? (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Verified Clean</span>
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                {inconsistencies > 0 && (
                  <span className="text-rose-600 dark:text-rose-400 font-medium">
                    {inconsistencies} conflict
                  </span>
                )}
                {inconsistencies > 0 && (missing > 0 || format > 0) && (
                  <span className="text-slate-400 dark:text-slate-600">·</span>
                )}
                {missing > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {missing} missing
                  </span>
                )}
                {missing > 0 && format > 0 && (
                  <span className="text-slate-400 dark:text-slate-600">·</span>
                )}
                {format > 0 && (
                  <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                    {format} format
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Row */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[110px]">
            {c.assigned_reviewer || 'Unassigned'}
          </span>

          <div className="flex items-center space-x-1.5">
            {c.status !== 'Review Completed' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReviewAction(
                    c.case_id,
                    'mark_complete',
                    'Quick sign-off from queue',
                    c.assigned_queue,
                    'Review Completed'
                  );
                }}
                className="p-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                title="Mark review completed"
              >
                <Check className="w-3 h-3" />
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectCase(c.case_id);
              }}
              className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-cyan-600 hover:text-white dark:hover:bg-cyan-500 dark:hover:text-slate-950 text-slate-700 dark:text-slate-200 text-[11px] font-medium transition-colors flex items-center space-x-1 cursor-pointer"
            >
              <span>Inspect</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Review Queues
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Partitioned workflows across Priority Review, Missing Information, and General Review.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search queue cases..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <select
            value={docTypeFilter}
            onChange={(e) => setDocTypeFilter(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Types</option>
            <option value="general_doc">General Document</option>
            <option value="passport">Passport</option>
            <option value="national_id">National ID</option>
            <option value="utility_bill">Utility Bill</option>
            <option value="bank_statement">Bank Statement</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
      </div>

      {/* 4-Column Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Column 1: Priority Review */}
        <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 flex flex-col h-[calc(100vh-250px)] min-h-[480px] shadow-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <h2 className="text-xs font-semibold text-rose-600 dark:text-rose-300">
                Priority Review
              </h2>
            </div>
            <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
              {priorityCases.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 mb-3">
            Inconsistencies, expired documents, and critical format flags.
          </p>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {priorityCases.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                No priority cases pending
              </div>
            ) : (
              priorityCases.map(renderCaseCard)
            )}
          </div>
        </div>

        {/* Column 2: Missing Information */}
        <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 flex flex-col h-[calc(100vh-250px)] min-h-[480px] shadow-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <h2 className="text-xs font-semibold text-amber-600 dark:text-amber-300">
                Missing Information
              </h2>
            </div>
            <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
              {missingCases.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 mb-3">
            Omitted required fields and low confidence extractions.
          </p>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {missingCases.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                No missing information cases
              </div>
            ) : (
              missingCases.map(renderCaseCard)
            )}
          </div>
        </div>

        {/* Column 3: General Review */}
        <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 flex flex-col h-[calc(100vh-250px)] min-h-[480px] shadow-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500" />
              <h2 className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                General Review
              </h2>
            </div>
            <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
              {generalCases.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 mb-3">
            Verified submissions ready for standard human sign-off.
          </p>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {generalCases.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                No general review cases
              </div>
            ) : (
              generalCases.map(renderCaseCard)
            )}
          </div>
        </div>

        {/* Column 4: Completed Archive */}
        <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 flex flex-col h-[calc(100vh-250px)] min-h-[480px] shadow-xs">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              <h2 className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                Completed Reviews
              </h2>
            </div>
            <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
              {completedCases.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 mb-3">
            Finalized and signed-off by review specialist.
          </p>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {completedCases.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                No completed reviews yet
              </div>
            ) : (
              completedCases.map(renderCaseCard)
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
