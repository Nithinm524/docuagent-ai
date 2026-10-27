import React from 'react';
import { ShieldCheck, ArrowLeft, AlertCircle, FileText, Lock, Eye, Server, RefreshCw, Mail } from 'lucide-react';

interface PrivacyPolicyViewProps {
  onBack: () => void;
}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ onBack }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 animate-fadeIn">
      {/* Header & Back button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center space-x-1.5 text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium mb-3 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Workspace</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Last Updated: October 2026 · Document Review &amp; Processing Compliance Notice
          </p>
        </div>
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-xs font-medium w-fit">
          <ShieldCheck className="w-4 h-4 text-cyan-500" />
          <span>Operator Verification Required</span>
        </div>
      </div>

      {/* Legal & Notice Banner */}
      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold block">Notice to System Administrators &amp; Application Deployers:</span>
          <p className="text-amber-800 dark:text-amber-300">
            This document outlines the standard data handling practices of the DOCUAGENT AI software. Contact details and organizational privacy designations are configured via environment variables (such as <code className="bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded font-mono text-[11px]">VITE_PRIVACY_EMAIL</code>) or your enterprise deployment agreement.
          </p>
        </div>
      </div>

      {/* Main Privacy Sections */}
      <div className="space-y-8 text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
        {/* Section 1 */}
        <section className="space-y-3 bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">1. Information Collected</h2>
          </div>
          <p>
            When utilizing <strong>DOCUAGENT AI</strong>, the system collects and processes the following categories of information:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600 dark:text-slate-400 text-sm">
            <li><strong>Uploaded Document Content:</strong> Digital files, images, PDFs, and plain text submitted through the upload interface or programmatic API endpoints.</li>
            <li><strong>Extracted Entity &amp; Attribute Data:</strong> Optical Character Recognition (OCR) tokens, personal identification fields (e.g., names, addresses, document ID numbers, validity dates), and financial metadata extracted from uploaded files.</li>
            <li><strong>Reviewer Actions &amp; Audit Logs:</strong> Reviewer notes, case disposition statuses, manual field corrections, timestamps, IP addresses, and user-agent information recorded for compliance and audit trail integrity.</li>
            <li><strong>Technical Diagnostics:</strong> Browser user-agent strings, request execution latency, token utilization metrics, error codes, and operational telemetry.</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="space-y-3 bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Eye className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">2. Purpose of Document Processing</h2>
          </div>
          <p>
            Uploaded materials are strictly processed to fulfill the operational document review workflow requested by authorized operators, specifically:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600 dark:text-slate-400 text-sm">
            <li>Classifying document categories (e.g., Government Passports, Driver Licenses, Utility Bills, Proof of Address, Bank Statements).</li>
            <li>Extracting structured schema values required for compliance verification.</li>
            <li>Executing deterministic cross-field and expiration date validation rules.</li>
            <li>Generating automated routing recommendations for human triage and review.</li>
            <li>Maintaining immutable audit logs for regulatory accountability.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="space-y-3 bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">3. AI-Assisted Processing &amp; Third-Party Services</h2>
          </div>
          <p>
            DOCUAGENT AI incorporates dual-mode processing architecture:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
              <span className="font-semibold text-slate-900 dark:text-slate-100 block mb-1">Local / Offline Mode</span>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                When operated without cloud vision credentials, document parsing and rule verification execute entirely locally inside the server instance without sending document contents to third-party AI APIs.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
              <span className="font-semibold text-slate-900 dark:text-slate-100 block mb-1">Multimodal Vision Processing</span>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                When an operator enables the server-side Google Gemini Vision API key, document image payloads may be transmitted over TLS encryption to Google Cloud / Gemini APIs strictly to perform optical character extraction and structured summary synthesis.
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            AI recommendations, extracted token confidences, and summary text generated by the model are auxiliary aids and require human verification.
          </p>
        </section>

        {/* Section 4 */}
        <section className="space-y-3 bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">4. Data Storage, Retention &amp; Security</h2>
          </div>
          <p>
            Case records, audit events, and document references are stored in the server instance's persistent JSON store or configured relational database.
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600 dark:text-slate-400 text-sm">
            <li><strong>Retention Schedule:</strong> Records remain stored until explicitly purged through administrative tools, automated retention policies, or individual case deletion by authorized operators.</li>
            <li><strong>Transport Security:</strong> All data in transit between the client browser and the server API is encrypted using TLS (HTTPS) with Strict-Transport-Security (HSTS) headers enabled.</li>
            <li><strong>Rate Limiting &amp; Access Controls:</strong> Endpoints are protected by IP sliding-window rate limiters, payload size limits (15MB maximum per upload), and MIME file signature validation to prevent malicious uploads.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="space-y-3 bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">5. Cookies &amp; Local Storage</h2>
          </div>
          <p>
            DOCUAGENT AI uses browser <code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">localStorage</code> solely for essential interface state:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600 dark:text-slate-400 text-sm">
            <li><strong>Theme Preference:</strong> Storing user selection of Light, Dark, or System mode (<code className="text-xs font-mono">docuagent_theme</code>).</li>
            <li><strong>Navigation State:</strong> Retaining the active tab and currently open case across page refreshes.</li>
            <li><strong>Consent Status:</strong> Remembering cookie and privacy consent choices (<code className="text-xs font-mono">docuagent_cookie_consent</code>).</li>
          </ul>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No third-party cross-site advertising or tracking cookies are placed by this application.
          </p>
        </section>

        {/* Section 6 */}
        <section className="space-y-3 bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Mail className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">6. Data Subject Rights &amp; Contact Details</h2>
          </div>
          <p>
            Depending on your jurisdiction (such as GDPR in the European Union or CCPA/CPRA in California), document subjects may have the right to request access to, rectification of, or deletion of their personal information processed by this platform.
          </p>
          <div className="mt-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-3">
            <span className="font-semibold text-slate-900 dark:text-slate-100 block text-xs uppercase tracking-wider">
              Data Protection &amp; Contact Notice
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400">
              <div>
                <span className="block font-medium text-slate-700 dark:text-slate-300">Deployment Architecture:</span>
                <span>Self-hosted / Private Enterprise Instance</span>
              </div>
              <div>
                <span className="block font-medium text-slate-700 dark:text-slate-300">Privacy &amp; Compliance Inquiries:</span>
                {import.meta.env.VITE_PRIVACY_EMAIL ? (
                  <a
                    href={`mailto:${import.meta.env.VITE_PRIVACY_EMAIL}`}
                    className="text-cyan-600 dark:text-cyan-400 hover:underline font-mono focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
                    aria-label={`Send email to ${import.meta.env.VITE_PRIVACY_EMAIL}`}
                  >
                    {import.meta.env.VITE_PRIVACY_EMAIL}
                  </a>
                ) : (
                  <span className="text-slate-500 italic">
                    Configurable via deployment environment (VITE_PRIVACY_EMAIL). Inquiries can be lodged through the Data Principal portal.
                  </span>
                )}
              </div>
              <div className="sm:col-span-2">
                <span className="block font-medium text-slate-700 dark:text-slate-300">Data Subject Rights Processing:</span>
                <span>
                  Requests for data access, rectification, or complete erasure are supported directly in-app via the Data Minimisation &amp; DPDP compliance workflows.
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer Back action */}
      <div className="pt-4 flex justify-between items-center border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold transition-colors cursor-pointer shadow-xs"
        >
          Return to Dashboard
        </button>
        <span className="text-xs text-slate-400">
          DOCUAGENT AI · Document Review Platform
        </span>
      </div>
    </div>
  );
};
