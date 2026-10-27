import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ArrowLeft,
  AlertCircle,
  FileText,
  UserCheck,
  Scale,
  Lock,
  RefreshCw,
  Send,
  CheckCircle2,
  Clock,
  HelpCircle,
  Eye,
  Trash2,
  FileCheck
} from 'lucide-react';
import { DataPrincipalRequest } from '../shared/types.ts';

interface DpdpReadinessViewProps {
  onBack: () => void;
  onOpenPrivacy: () => void;
  onOpenCookies: () => void;
}

export const DpdpReadinessView: React.FC<DpdpReadinessViewProps> = ({
  onBack,
  onOpenPrivacy,
  onOpenCookies
}) => {
  // Grievance / Data Principal Request Form State
  const [requestType, setRequestType] = useState<'access' | 'correction' | 'erasure' | 'grievance' | 'nomination'>('access');
  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [caseIdInput, setCaseIdInput] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Request history list
  const [requestsList, setRequestsList] = useState<DataPrincipalRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  const fetchRequests = async () => {
    setIsLoadingRequests(true);
    try {
      const res = await fetch('/api/dpdp/requests');
      if (res.ok) {
        const data = await res.json();
        setRequestsList(data.requests || []);
      }
    } catch {}
    setIsLoadingRequests(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitSuccess(null);

    if (!requesterName.trim() || !requesterEmail.trim() || !details.trim()) {
      setFormError('Please fill in your name, email, and request details.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/dpdp/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_type: requestType,
          requester_name: requesterName.trim(),
          requester_email: requesterEmail.trim(),
          case_id: caseIdInput.trim() || undefined,
          details: details.trim()
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server returned ${res.status}`);
      }

      const data = await res.json();
      setSubmitSuccess(
        `Your ${requestType.toUpperCase()} request has been registered under Ticket ID: ${data.request?.request_id || 'Registered'}. The Grievance Redressal team will acknowledge receipt within 48 hours.`
      );
      setRequesterName('');
      setRequesterEmail('');
      setCaseIdInput('');
      setDetails('');
      fetchRequests();
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 animate-fadeIn">
      {/* Header & Back button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center space-x-1.5 text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium mb-3 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Workspace</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            DPDP Act, 2023 &amp; DPDP Rules, 2025 Readiness
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Digital Personal Data Protection Compliance Framework · Operational Notice &amp; Exercise of Rights
          </p>
        </div>
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-xs font-semibold w-fit">
          <ShieldCheck className="w-4 h-4 text-cyan-500" />
          <span>India DPDP Act Alignment</span>
        </div>
      </div>

      {/* Deployer Notice & Legal Review Disclaimer */}
      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold block">Deployer Legal Review &amp; Commencement Disclosure:</span>
          <p className="text-amber-800 dark:text-amber-300">
            This module implements the architectural and functional requirements necessary for compliance with India's <strong>Digital Personal Data Protection Act, 2023</strong> and the <strong>Digital Personal Data Protection Rules, 2025</strong>. 
            Provisions of the DPDP Act and Rules come into force on dates appointed by the Central Government through official gazette notifications. 
            Deploying entities must appoint a qualified Grievance Officer, configure organizational contact variables (such as <code className="bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded font-mono text-[11px]">VITE_GRIEVANCE_EMAIL</code>), and conduct formal legal review before claiming certified compliance.
          </p>
        </div>
      </div>

      {/* Main Framework Sections */}
      <div className="space-y-8 text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
        {/* Section 1: Notice & Purpose Limitation */}
        <section className="space-y-3 bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">1. Notice Requirements (Section 5)</h2>
          </div>
          <p>
            Under Section 5 of the DPDP Act, every request for consent must be accompanied or preceded by an itemized notice written in clear, plain language stating:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
            <li><strong>Specified Purpose:</strong> Document intake, OCR text extraction, schema classification, deterministic validation rule evaluation, and human reviewer routing.</li>
            <li><strong>Categories of Digital Personal Data:</strong> Personal identifiers contained in submitted documents (e.g., full name, address, identity numbers, dates, issuer metadata).</li>
            <li><strong>Manner of Exercising Rights:</strong> Clear pathways to access, correct, or erase personal data under Section 11 &amp; 12.</li>
            <li><strong>Grievance Mechanism:</strong> Contact details of the Data Fiduciary's Grievance Officer and information regarding complaints to the Data Protection Board of India (DPBI).</li>
          </ul>
        </section>

        {/* Section 2: Consent & Ease of Withdrawal */}
        <section className="space-y-3 bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">2. Consent Standard &amp; Withdrawal (Section 6)</h2>
          </div>
          <p>
            DOCUAGENT AI enforces affirmative, non-preselected consent for all document uploads:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
            <li><strong>Affirmative Action:</strong> Checkboxes are never preselected. Consent must be freely given, specific, informed, and unambiguous.</li>
            <li><strong>Unbundled:</strong> Optional analytics or feedback telemetry are never bundled with or made a condition for document verification.</li>
            <li><strong>Ease of Withdrawal (Section 6(4)):</strong> Data Principals have the right to withdraw consent with the same ease with which it was given. When consent is withdrawn, the application records a timestamped audit event and initiates immediate personal data minimisation and file purging.</li>
          </ul>
        </section>

        {/* Section 3: General Obligations of Data Fiduciary */}
        <section className="space-y-3 bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Scale className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">3. Data Fiduciary Obligations (Section 8)</h2>
          </div>
          <div className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            <p>
              <strong>Reasonable Security Safeguards:</strong> Server-side API key isolation, HTTPS-only transport, strict file magic byte validation, automated PII sanitization in server logs, and bounded memory buffers.
            </p>
            <p>
              <strong>Personal Data Breach Protocol:</strong> In the event of a verified personal data breach, the Data Fiduciary is mandated under Section 8(6) to notify the Data Protection Board of India (DPBI) and each affected Data Principal in the prescribed form and manner.
            </p>
            <p>
              <strong>Storage Limitation &amp; Erasure:</strong> Personal data must be erased when the specified purpose has been served or when consent is withdrawn, unless retention is strictly required by applicable law. DOCUAGENT AI implements a configurable 90-day retention schedule with one-click data purging.
            </p>
          </div>
        </section>

        {/* Section 4: Children's Personal Data */}
        <section className="space-y-3 bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">4. Processing of Children's Personal Data (Section 9)</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            DOCUAGENT AI is an enterprise document verification workspace not directed toward individuals under the age of 18. Under Section 9 of the DPDP Act:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
            <li>Where documents belonging to minors (such as child passports or birth certificates) are processed, verifiable parental consent must be obtained by the deploying organization prior to intake.</li>
            <li>The system performs zero tracking, behavioral monitoring, or targeted advertising directed at children.</li>
            <li>No processing is conducted that could cause detrimental effects on the well-being of a child.</li>
          </ul>
        </section>

        {/* Section 5: Interactive Data Principal Request & Grievance Workflow */}
        <section className="space-y-4 bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Send className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">5. Exercise Your Rights as a Data Principal (Sections 11, 12, &amp; 13)</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Under the DPDP Act, you have the right to request access to a summary of your digital personal data, request correction of inaccurate data, request erasure, nominate a representative, or lodge a grievance. Use the form below to submit a formal request:
          </p>

          <form onSubmit={handleSubmitRequest} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Request Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                >
                  <option value="access">Access: Summary of Personal Data &amp; Processing (Section 11)</option>
                  <option value="correction">Correction: Update Inaccurate or Incomplete Data (Section 12)</option>
                  <option value="erasure">Erasure: Purge Document &amp; Personal Identifiers (Section 12)</option>
                  <option value="grievance">Grievance: Report Data Handling Concern (Section 13)</option>
                  <option value="nomination">Nomination: Designate Representative (Section 14)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Related Case / Document ID <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. DOC-2026-1048 or case ID"
                  value={caseIdInput}
                  onChange={(e) => setCaseIdInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Your Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex Rivera"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Contact Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. alex.rivera@example.com"
                  value={requesterEmail}
                  onChange={(e) => setRequesterEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Details of Request or Grievance <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Describe your request, specific data points to correct or erase, or grievance details..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                required
              />
            </div>

            {formError && (
              <div role="alert" className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            {submitSuccess && (
              <div role="status" className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{submitSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Registering Request...' : 'Submit Data Principal Request'}</span>
            </button>
          </form>

          {/* Registered Requests Table */}
          {requestsList.length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                Recent Data Principal Inquiries &amp; Tickets ({requestsList.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white font-semibold">
                    <tr>
                      <th className="p-2">Ticket ID</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Requester</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Registered At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                    {requestsList.map((req) => (
                      <tr key={req.request_id}>
                        <td className="p-2 text-cyan-700 dark:text-cyan-300">{req.request_id}</td>
                        <td className="p-2 uppercase font-sans font-medium">{req.request_type}</td>
                        <td className="p-2 font-sans">{req.requester_name}</td>
                        <td className="p-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                            {req.status}
                          </span>
                        </td>
                        <td className="p-2">{new Date(req.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Section 6: Grievance Officer & Data Protection Board Details */}
        <section className="space-y-3 bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">6. Designated Grievance Officer &amp; Regulatory Recourse</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            In accordance with Section 13 of the DPDP Act, the deploying entity must designate a Grievance Officer responsible for redressing grievances of Data Principals within the prescribed timeline:
          </p>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
            <span className="font-semibold text-slate-900 dark:text-white block">Deploying Entity Grievance Redressal Office:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600 dark:text-slate-400">
              <div>
                <span className="block font-medium text-slate-700 dark:text-slate-300">Data Fiduciary:</span>
                <span>Self-Hosted Enterprise Instance / Operating Licensee</span>
              </div>
              <div>
                <span className="block font-medium text-slate-700 dark:text-slate-300">Designated Grievance Officer:</span>
                <span>Designated pursuant to enterprise operating contract</span>
              </div>
              <div>
                <span className="block font-medium text-slate-700 dark:text-slate-300">Office Jurisdiction:</span>
                <span>Operating Jurisdiction specified in enterprise agreement</span>
              </div>
              <div>
                <span className="block font-medium text-slate-700 dark:text-slate-300">Grievance Email:</span>
                {import.meta.env.VITE_GRIEVANCE_EMAIL ? (
                  <a
                    href={`mailto:${import.meta.env.VITE_GRIEVANCE_EMAIL}`}
                    className="text-cyan-600 dark:text-cyan-400 hover:underline font-mono focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
                    aria-label={`Send grievance email to ${import.meta.env.VITE_GRIEVANCE_EMAIL}`}
                  >
                    {import.meta.env.VITE_GRIEVANCE_EMAIL}
                  </a>
                ) : (
                  <span className="text-slate-500 italic">
                    Configurable via deployment environment (VITE_GRIEVANCE_EMAIL). Inquiries can also be filed using the ticket form above.
                  </span>
                )}
              </div>
              <div className="sm:col-span-2 text-[11px] text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-800">
                Acknowledgement Timeline: <span className="font-medium text-slate-800 dark:text-slate-200">Within 48 hours</span> · Resolution: <span className="font-medium text-slate-800 dark:text-slate-200">Within 30 calendar days</span>
              </div>
            </div>
          </div>

          <div className="pt-2 text-xs text-slate-600 dark:text-slate-400">
            <p>
              <strong>Data Protection Board of India (DPBI):</strong> If you do not receive a response from our Grievance Officer within 30 days, or if you are dissatisfied with the resolution, you have the right under Section 13(3) of the Act to lodge a formal complaint with the Data Protection Board of India established under Section 18.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
