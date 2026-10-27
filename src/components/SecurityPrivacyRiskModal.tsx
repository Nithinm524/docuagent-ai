import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, X, CheckCircle2, ShieldAlert, Lock, Info, Filter, ExternalLink } from 'lucide-react';

interface SecurityPrivacyRiskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RiskItem {
  id: string;
  category: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  component: string;
  evidence: string;
  remediation: string;
  status: 'Remediated' | 'Compensating Control Active' | 'Requires External Infra';
}

const RISK_INVENTORY: RiskItem[] = [
  {
    id: 'RISK-01',
    category: 'Secrets & API Keys',
    severity: 'Critical',
    component: 'Frontend / Client Bundle',
    evidence: 'Audited all client TypeScript source and Vite bundles. Confirmed zero client-side API keys or secret tokens.',
    remediation: 'All Gemini AI calls routed through server-side proxy (`/server/agent.ts`). Client accesses only `/api/cases/process`.',
    status: 'Remediated'
  },
  {
    id: 'RISK-02',
    category: 'Data Minimisation & Logs',
    severity: 'High',
    component: 'Server Logger (`server/logger.ts`)',
    evidence: 'Unsanitized server logs could inadvertently log SSN, Aadhaar, PAN, and full document base64 payloads.',
    remediation: 'Implemented regex redaction for SSNs, Aadhaar, PAN, card numbers, and PII field keys in `sanitizeLogData()`.',
    status: 'Remediated'
  },
  {
    id: 'RISK-03',
    category: 'Consent & Legal Basis',
    severity: 'High',
    component: 'Document Intake (`UploadView.tsx`)',
    evidence: 'Document intake lacked affirmative consent and unbundled privacy notices prior to submission.',
    remediation: 'Added explicit Document Intake Privacy Notice (Notice v2026.1) with unbundled affirmative consent checkbox and legal basis flagging.',
    status: 'Remediated'
  },
  {
    id: 'RISK-04',
    category: 'Document Retention & Erasure',
    severity: 'High',
    component: 'Store & Case Management (`server/store.ts`)',
    evidence: 'Uploaded files and OCR extractions lacked automated data minimisation and formal deletion controls.',
    remediation: 'Added `purgeCaseData()` to expunge original files and mask PII fields, plus full case deletion with confirmation dialog.',
    status: 'Remediated'
  },
  {
    id: 'RISK-05',
    category: 'File Upload & Traversal',
    severity: 'High',
    component: 'File Ingest (`server/fileValidation.ts`)',
    evidence: 'Potential path traversal via malicious file names (e.g. `../../etc/passwd`) or spoofed file extensions.',
    remediation: 'Enforced `sanitizeFileName()` stripping separators and null bytes, plus buffer magic signature verification (`%PDF`, PNG, JPEG).',
    status: 'Remediated'
  },
  {
    id: 'RISK-06',
    category: 'Race Conditions & Lost Updates',
    severity: 'Medium',
    component: 'Store (`server/store.ts`)',
    evidence: 'Concurrent reviewer decisions on identical cases could cause lost update overwrites.',
    remediation: 'Implemented optimistic concurrency control with monotonic `version` counter check (HTTP 409 Conflict) and atomic tempfile rename.',
    status: 'Remediated'
  },
  {
    id: 'RISK-07',
    category: 'Network & Third-Party Trackers',
    severity: 'Medium',
    component: 'Frontend Scripts & Assets',
    evidence: 'Third-party tracking pixels or external CDNs could leak user IP addresses and document session metadata.',
    remediation: 'Audited network requests: zero external tracking scripts, local SVG icons (Lucide), self-contained bundle.',
    status: 'Remediated'
  },
  {
    id: 'RISK-08',
    category: 'Transport Security & HSTS',
    severity: 'Medium',
    component: 'HTTP Middleware (`server/api.ts`)',
    evidence: 'Unencrypted HTTP traffic exposes document tokens in transit.',
    remediation: 'Configured security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `HSTS`), with configurable HTTPS enforcement.',
    status: 'Compensating Control Active'
  },
  {
    id: 'RISK-09',
    category: 'Client Storage & Cookies',
    severity: 'Medium',
    component: 'Local Storage (`CookieConsentBanner.tsx`)',
    evidence: 'User storage preferences could be overwritten or unrecorded without clear audit timestamps.',
    remediation: 'Upgraded to `docuagent_cookie_consent_v2` with timestamped policy versioning, unbundled options, and withdrawal workflow.',
    status: 'Remediated'
  },
  {
    id: 'RISK-10',
    category: 'Access Control & Authentication',
    severity: 'High',
    component: 'API Endpoints (`/api/cases`)',
    evidence: 'Current prototype operates without multi-tenant role-based authentication (RBAC). Anyone with network access can view cases.',
    remediation: 'Deploying organization must place application behind corporate SSO, VPN, or OAuth gateway in production.',
    status: 'Requires External Infra'
  },
  {
    id: 'RISK-11',
    category: 'Denial of Service & Rate Limiting',
    severity: 'Medium',
    component: 'Rate Limiter (`server/rateLimiter.ts`)',
    evidence: 'Rapid repeated uploads could exhaust Gemini token budgets or server memory.',
    remediation: 'Implemented tiered rate limiters (expensive AI upload limiter vs standard API limiter) with in-memory tracking.',
    status: 'Remediated'
  },
  {
    id: 'RISK-12',
    category: 'Sub-Processor AI Data Sharing',
    severity: 'Medium',
    component: 'Google GenAI SDK Integration',
    evidence: 'Data sent to cloud AI services must not be used to train public machine learning models without enterprise agreements.',
    remediation: 'Disclosed AI sub-processor in Privacy Policy. Deployer must configure Gemini API under Google Cloud Enterprise Terms of Service.',
    status: 'Requires External Infra'
  }
];

export const SecurityPrivacyRiskModal: React.FC<SecurityPrivacyRiskModalProps> = ({ isOpen, onClose }) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  if (!isOpen) return null;

  const filteredRisks = filterSeverity === 'all'
    ? RISK_INVENTORY
    : RISK_INVENTORY.filter((r) => r.severity.toLowerCase() === filterSeverity.toLowerCase());

  const getSeverityBadge = (sev: RiskItem['severity']) => {
    switch (sev) {
      case 'Critical':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800';
      case 'High':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/80 dark:text-yellow-300 border-yellow-300 dark:border-yellow-800';
      case 'Low':
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    }
  };

  const getStatusBadge = (status: RiskItem['status']) => {
    switch (status) {
      case 'Remediated':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      case 'Compensating Control Active':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800';
      case 'Requires External Infra':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="risk-report-title"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <ShieldAlert className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="risk-report-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Privacy &amp; Security Architecture Risk Report
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Technical assessment of potential vulnerabilities, findings evidence, and mitigation controls
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500"
            aria-label="Close risk report dialog"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Severity Filter & Summary Stats */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">Filter by Severity:</span>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">All Severities ({RISK_INVENTORY.length})</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
          </div>

          <div className="flex items-center space-x-2 text-[11px] font-mono">
            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              {RISK_INVENTORY.filter((r) => r.status === 'Remediated').length} Remediated
            </span>
            <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
              {RISK_INVENTORY.filter((r) => r.status === 'Compensating Control Active').length} Compensating
            </span>
            <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
              {RISK_INVENTORY.filter((r) => r.status === 'Requires External Infra').length} External Config
            </span>
          </div>
        </div>

        {/* Risk Items Scrollable List */}
        <div className="overflow-y-auto space-y-3 pr-1 divide-y divide-slate-100 dark:divide-slate-800/60">
          {filteredRisks.map((risk) => (
            <div key={risk.id} className="pt-3 first:pt-0 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-cyan-700 dark:text-cyan-400 font-bold">{risk.id}</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{risk.category}</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">({risk.component})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSeverityBadge(risk.severity)}`}>
                    {risk.severity}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getStatusBadge(risk.status)}`}>
                    {risk.status}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-3 border border-slate-200 dark:border-slate-800 space-y-1.5 text-slate-600 dark:text-slate-400">
                <p>
                  <strong className="text-slate-800 dark:text-slate-200 font-semibold">Evidence:</strong> {risk.evidence}
                </p>
                <p>
                  <strong className="text-slate-800 dark:text-slate-200 font-semibold">Remediation / Mitigation:</strong> {risk.remediation}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Security Audit Target: WCAG 2.2 AA / DPDP Act, 2023 Architecture Readiness</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
