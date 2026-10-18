import React, { useState } from 'react';
import {
  ClipboardList,
  ShieldCheck,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  User,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  FileText,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { CaseRecord, AuditEvent } from '../shared/types.ts';
import { DOCUMENT_SCHEMAS } from '../shared/validation.ts';

interface AuditReportsViewProps {
  cases: CaseRecord[];
  onSelectCase: (caseId: string) => void;
  onOpenReportForCase: (caseRecord: CaseRecord) => void;
}

export const AuditReportsView: React.FC<AuditReportsViewProps> = ({
  cases,
  onSelectCase,
  onOpenReportForCase
}) => {
  const [selectedCaseFilter, setSelectedCaseFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Collect all audit events from all cases
  const allEvents: (AuditEvent & { case_number: string; document_type: string })[] = [];
  for (const c of cases) {
    for (const evt of c.audit_events) {
      allEvents.push({
        ...evt,
        case_number: c.case_number,
        document_type: c.document_type
      });
    }
  }

  // Sort events newest first
  allEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Filter events
  const filteredEvents = allEvents.filter((evt) => {
    if (selectedCaseFilter !== 'all' && evt.case_id !== selectedCaseFilter) return false;
    if (eventTypeFilter !== 'all' && evt.event_type !== eventTypeFilter) return false;
    if (actorFilter !== 'all' && evt.actor !== actorFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchSum = evt.summary.toLowerCase().includes(q);
      const matchDet = evt.details?.toLowerCase().includes(q);
      const matchCase = evt.case_number.toLowerCase().includes(q);
      if (!matchSum && !matchDet && !matchCase) return false;
    }
    return true;
  });

  const exportAllAuditEvents = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(allEvents, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `system_audit_log_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <ClipboardList className="w-4 h-4" />
            <span>Audit Trail &amp; Screening Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Screening Reports &amp; Audit History
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Immutable system logs, agent decisions, reviewer overrides, and printable screening records.
          </p>
        </div>

        <button
          onClick={exportAllAuditEvents}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-semibold text-xs flex items-center space-x-2 transition-all shadow-sm"
        >
          <Download className="w-4 h-4" />
          <span>Export Complete Audit Log (JSON)</span>
        </button>
      </div>

      {/* Case Screening Reports Quick Access */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center space-x-2">
          <FileText className="w-4 h-4 text-cyan-400" />
          <span>Screening Reports Directory ({cases.length} cases)</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {cases.map((c) => {
            const nameField = c.extracted_fields.find(
              (f) =>
                f.field_name === 'full_name' ||
                f.field_name === 'account_holder_name' ||
                f.field_name === 'employee_name'
            );
            const name = nameField?.reviewed_value || nameField?.field_value || 'Subject';

            return (
              <div
                key={c.case_id}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-xs text-cyan-400">{c.case_number}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        c.status === 'Ready for Review'
                          ? 'bg-emerald-950 text-emerald-300'
                          : c.status === 'Needs More Information'
                          ? 'bg-amber-950 text-amber-300'
                          : c.status === 'Priority Review'
                          ? 'bg-rose-950 text-rose-300'
                          : c.status === 'Review Completed'
                          ? 'bg-cyan-950 text-cyan-300'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-white mt-1">{name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {DOCUMENT_SCHEMAS[c.document_type]?.title.split('/')[0].trim()}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onOpenReportForCase(c)}
                    className="p-2 rounded-lg bg-slate-900 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200 border border-slate-700 hover:border-cyan-500/40 transition-colors"
                    title="View & Print Official Screening Report"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onSelectCase(c.case_id)}
                    className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                    title="Open Case Details"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Global Audit Log Stream */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        {/* Filters Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Immutable Audit Event Stream</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Showing {filteredEvents.length} events across all intake workflows
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search audit details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Filter by Case */}
            <select
              value={selectedCaseFilter}
              onChange={(e) => setSelectedCaseFilter(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Cases</option>
              {cases.map((c) => (
                <option key={c.case_id} value={c.case_id}>
                  {c.case_number}
                </option>
              ))}
            </select>

            {/* Filter by Event Type */}
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Event Types</option>
              <option value="CASE_CREATED">CASE_CREATED</option>
              <option value="TEXT_EXTRACTED">TEXT_EXTRACTED</option>
              <option value="FIELDS_EXTRACTED">FIELDS_EXTRACTED</option>
              <option value="VALIDATION_RUN">VALIDATION_RUN</option>
              <option value="ROUTING_DECIDED">ROUTING_DECIDED</option>
              <option value="FIELD_CORRECTED">FIELD_CORRECTED</option>
              <option value="FINDING_RESOLVED">FINDING_RESOLVED</option>
              <option value="QUEUE_TRANSFERRED">QUEUE_TRANSFERRED</option>
              <option value="REVIEW_COMPLETED">REVIEW_COMPLETED</option>
              <option value="AGENT_RE_EVALUATED">AGENT_RE_EVALUATED</option>
            </select>

            {/* Filter by Actor */}
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Actors</option>
              <option value="AI Agent">AI Agent</option>
              <option value="Human Reviewer">Human Reviewer</option>
              <option value="System">System</option>
            </select>
          </div>
        </div>

        {/* Timeline List */}
        <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800 max-h-[550px] overflow-y-auto pr-2">
          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No audit events found matching the specified filters.
            </div>
          ) : (
            filteredEvents.map((evt) => (
              <div key={evt.event_id} className="relative group">
                <div
                  className={`absolute -left-6 top-2 w-2.5 h-2.5 rounded-full border-2 ${
                    evt.actor === 'AI Agent'
                      ? 'bg-cyan-500 border-slate-950'
                      : evt.actor === 'Human Reviewer'
                      ? 'bg-emerald-400 border-slate-950'
                      : 'bg-slate-400 border-slate-950'
                  }`}
                />

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-cyan-400 text-xs font-bold">
                        {evt.case_number}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          evt.actor === 'AI Agent'
                            ? 'bg-cyan-950 text-cyan-300'
                            : evt.actor === 'Human Reviewer'
                            ? 'bg-emerald-950 text-emerald-300'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {evt.actor}
                      </span>
                      <span className="text-xs font-semibold text-slate-200">{evt.event_type}</span>
                    </div>

                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(evt.created_at).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-1">{evt.summary}</p>
                  {evt.details && (
                    <div className="mt-1 text-[11px] text-slate-400 font-mono bg-slate-900/80 p-2 rounded border border-slate-800/60">
                      {evt.details}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
