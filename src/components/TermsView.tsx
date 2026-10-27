import React from 'react';
import {
  Scale,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  FileCheck,
  ShieldAlert,
  BookOpen,
  Lock,
  Cpu,
  UserCheck,
  Ban,
  Clock,
  Trash2,
  HelpCircle,
  Mail,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { usePageMetadata, PAGE_METADATA } from '../utils/usePageMetadata.ts';

interface TermsViewProps {
  onBack: () => void;
  onOpenPrivacy: () => void;
  onOpenDataCollection?: () => void;
}

export const TermsView: React.FC<TermsViewProps> = ({
  onBack,
  onOpenPrivacy,
  onOpenDataCollection
}) => {
  usePageMetadata(PAGE_METADATA.terms || {
    title: 'Terms of Use | DOCUAGENT AI',
    description:
      'Terms and conditions governing the use of DOCUAGENT AI document intake, automated verification, reviewer triage, and human-in-the-loop workflows.',
    canonicalPath: '/?page=terms'
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 animate-fadeIn text-slate-800 dark:text-slate-200">
      {/* Header & Back navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center space-x-1.5 text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium mb-3 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Workspace</span>
          </button>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Terms of Use
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Operational Terms
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Governing the use of the <strong>DOCUAGENT AI</strong> Document Review &amp; Routing Agent platform.
          </p>
        </div>
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-medium w-fit">
          <Scale className="w-4 h-4 text-indigo-500" />
          <span>Requires Legal Counsel Review</span>
        </div>
      </div>

      {/* Legal Notice Callout */}
      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold block">Important Legal Notice:</span>
          <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
            These Terms of Use govern access to and usage of the DOCUAGENT AI software platform. The deploying organization must customize regional dispute resolution venues, governing law, and statutory liability limitations in consultation with licensed legal counsel before production commercial deployment.
          </p>
        </div>
      </div>

      {/* 20 Required Sections */}
      <div className="space-y-6 text-slate-700 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
        
        {/* Section 1: Introduction and Acceptance */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>1. Introduction and Acceptance</span>
          </h2>
          <p>
            Welcome to <strong>DOCUAGENT AI</strong>. By accessing this platform, creating an account, or submitting documents for processing, you agree to be legally bound by these Terms of Use, our Privacy Policy, and our Data Collection &amp; Privacy Transparency disclosures. If you do not agree to these terms, you must not use this application.
          </p>
        </section>

        {/* Section 2: Description of the Service */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>2. Description of the Service</span>
          </h2>
          <p>
            DOCUAGENT AI is an automated document review, optical character recognition (OCR), deterministic rule validation, and human-in-the-loop queue routing system. The service is designed to ingest digital identity documents, utility bills, bank statements, and general agreements; extract structured data fields; execute programmatic validation checks; and route cases to authorized operational reviewer queues.
          </p>
        </section>

        {/* Section 3: User Eligibility and Accounts */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>3. User Eligibility and Accounts</span>
          </h2>
          <p>
            Users must be at least 18 years of age and duly authorized by their sponsoring enterprise or institution to access the workspace. Account creation requires a valid organizational email address, affirmative acceptance of these Terms, and secure password creation. Accounts are role-governed:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600 dark:text-slate-400">
            <li><strong>Administrator:</strong> System configuration, retention job execution, and tenant audit oversight.</li>
            <li><strong>Reviewer:</strong> Operational triage, field correction, queue management, and case sign-off.</li>
            <li><strong>Viewer / Auditor:</strong> Read-only inspection of reports and non-sensitive case metadata.</li>
            <li><strong>Applicant:</strong> Self-service document submission restricted to their own submitted cases.</li>
          </ul>
        </section>

        {/* Section 4: Account Security */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>4. Account Security</span>
          </h2>
          <p>
            You are responsible for maintaining the confidentiality of your authentication credentials. Passwords are protected via salted scrypt hashing and sessions expire after 8 hours or 1 hour of sliding inactivity. You must immediately notify our security contacts if you suspect unauthorized access or session compromise.
          </p>
        </section>

        {/* Section 5: Permitted Use */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>5. Permitted Use</span>
          </h2>
          <p>
            DOCUAGENT AI may be used strictly for authorized organizational document intake, verification decision-support, regulatory compliance screening, and internal reviewer queue management within the bounds of your licensing agreement and applicable law.
          </p>
        </section>

        {/* Section 6: Prohibited Activities */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border border-rose-200 dark:border-rose-950/60 bg-rose-50/20 dark:bg-rose-950/10 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-rose-900 dark:text-rose-300 flex items-center gap-2">
            <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>6. Prohibited Activities</span>
          </h2>
          <p className="text-rose-950 dark:text-rose-200">
            You expressly agree NOT to engage in any of the following prohibited conduct:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2 text-rose-900 dark:text-rose-300">
            <li>Uploading documents without proper authorization or consent from the document owner.</li>
            <li>Attempting to bypass tenant isolation, IDOR controls, or Role-Based Access Controls to access cases belonging to another user or tenant.</li>
            <li>Uploading malicious code, viruses, corrupted payloads, or files exceeding the 15MB limit.</li>
            <li>Submitting falsified, synthetic, or altered government credentials to commit fraud, impersonation, or evade compliance scrutiny.</li>
            <li>Circumventing API rate limiters, token budgets, or bot velocity verification challenges.</li>
            <li>Reverse-engineering, decompiling, or extracting the proprietary deterministic validation algorithms.</li>
          </ul>
        </section>

        {/* Section 7: Uploaded Documents and User Responsibilities */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>7. Uploaded Documents and User Responsibilities</span>
          </h2>
          <p>
            You represent and warrant that you possess all necessary rights, legal authority, and statutory consents from data principals prior to submitting documents to DOCUAGENT AI. All submitted document contents remain the property of the submitting organization or original document subject; DOCUAGENT AI claims no ownership rights over uploaded documents.
          </p>
        </section>

        {/* Section 8: AI Processing and Limitations */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border-2 border-cyan-500/40 dark:border-cyan-500/30 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>8. AI Processing and Limitations</span>
          </h2>
          <div className="p-3.5 rounded-xl bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900/50 space-y-1.5 text-xs">
            <span className="font-bold text-slate-900 dark:text-white block">CRITICAL HEURISTIC LIMITATION NOTICE:</span>
            <ul className="list-disc list-inside space-y-1 pl-1 text-slate-700 dark:text-slate-300">
              <li><strong>OCR &amp; Text Extraction:</strong> Character recognition and key-value extraction may contain errors, character transposition, or misread degraded glyphs.</li>
              <li><strong>Classification:</strong> Automated classification (e.g., Passport vs. Driver License) relies on probabilistic heuristics and can misclassify unfamiliar or novel document layouts.</li>
              <li><strong>Assistive Nature:</strong> DOCUAGENT AI is an assistive decision-support platform, NOT an autonomous legal adjudicator. It does NOT guarantee authenticity, 100% fraud detection, or forensic validity.</li>
            </ul>
          </div>
        </section>

        {/* Section 9: Document Review and Routing Results */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>9. Document Review and Routing Results</span>
          </h2>
          <p>
            Queue assignments (such as "General Review", "Missing Information", or "Priority Review") and validation findings are recommendations for human reviewer evaluation. Institutional sign-off, approval, or rejection MUST be executed by an authorized human reviewer.
          </p>
        </section>

        {/* Section 10: Intellectual Property */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Scale className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>10. Intellectual Property</span>
          </h2>
          <p>
            The DOCUAGENT AI name, logo, original software code, user interface designs, and algorithmic validation rules are the intellectual property of the application authors. Third-party open-source libraries (e.g., React, Express, Lucide, Tailwind CSS) are licensed under their respective permissive open-source licenses (MIT, ISC, Apache-2.0). User-uploaded documents remain the exclusive property of their respective owners.
          </p>
        </section>

        {/* Section 11: Third-Party Services */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>11. Third-Party Services</span>
          </h2>
          <p>
            DOCUAGENT AI connects to Google Cloud Platform for server-side Gemini API multimodal extraction when configured. Processing is subject to Google Cloud’s Enterprise Terms and Data Processing Addendum. We do not use third-party analytics trackers, advertising networks, or data brokers.
          </p>
        </section>

        {/* Section 12: Privacy and Data Processing */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>12. Privacy and Data Processing</span>
          </h2>
          <p>
            Data collection, storage, and processing practices are governed by our{' '}
            <button
              onClick={onOpenPrivacy}
              className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold cursor-pointer"
            >
              Privacy Policy
            </button>
            {onOpenDataCollection && (
              <>
                {' '}and our detailed{' '}
                <button
                  onClick={onOpenDataCollection}
                  className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold cursor-pointer"
                >
                  Data Collection and Privacy Transparency
                </button>{' '}
                statement.
              </>
            )}
          </p>
        </section>

        {/* Section 13: Service Availability and Changes */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span>13. Service Availability and Changes</span>
          </h2>
          <p>
            We endeavor to maintain high operational availability, but do not warrant that service will be completely uninterrupted or error-free. We reserve the right to deploy security updates, schema enhancements, or system maintenance as required to maintain platform integrity.
          </p>
        </section>

        {/* Section 14: Disclaimers and Limitations of Liability */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>14. Disclaimers and Limitations of Liability</span>
          </h2>
          <p className="font-mono text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
            THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR ACCURACY OF OCR RECOGNITION.
          </p>
          <p className="text-slate-600 dark:text-slate-400">
            To the maximum extent permitted by applicable law, in no event shall the software authors, operators, or hosting providers be liable for indirect, incidental, special, or consequential damages resulting from document intake delays, optical recognition misreadings, or unflagged document discrepancies.
          </p>
        </section>

        {/* Section 15: Suspension and Termination */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>15. Suspension and Termination</span>
          </h2>
          <p>
            We reserve the right to suspend or terminate access for any user account that violates these Terms, attempts unauthorized security bypasses, or engages in fraudulent document submissions.
          </p>
        </section>

        {/* Section 16: Account Deletion and Right to Erasure */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>16. Account Deletion and Right to Erasure</span>
          </h2>
          <p>
            Users may permanently delete their accounts at any time via authenticated endpoint <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs">DELETE /api/auth/account</code> with password re-confirmation. Account deletion revokes all active sessions and permanently purges user-associated document records from the store.
          </p>
        </section>

        {/* Section 17: Complaints and Dispute Resolution */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>17. Complaints and Dispute Resolution</span>
          </h2>
          <p>
            Complaints regarding document review decisions or data processing should first be directed to the organizational Grievance Officer. Governing law, jurisdictional venue, and formal dispute mechanisms must be designated by the deploying enterprise upon deployment.
          </p>
        </section>

        {/* Section 18: Changes to These Terms */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>18. Changes to These Terms</span>
          </h2>
          <p>
            We may update these Terms to reflect operational improvements, statutory amendments, or technological updates. Updated terms will be posted with a revised Last Updated timestamp. Material changes will be communicated via the platform workspace.
          </p>
        </section>

        {/* Section 19: Contact Information */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>19. Contact Information</span>
          </h2>
          <p>
            For legal inquiries, terms interpretation, or trademark permissions:
          </p>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white">Legal Inquiries:</span>{' '}
              {import.meta.env.VITE_LEGAL_EMAIL ? (
                <a
                  href={`mailto:${import.meta.env.VITE_LEGAL_EMAIL}`}
                  className="text-cyan-600 dark:text-cyan-400 hover:underline font-mono"
                >
                  {import.meta.env.VITE_LEGAL_EMAIL}
                </a>
              ) : (
                <span className="text-slate-500 italic">Configurable via VITE_LEGAL_EMAIL</span>
              )}
            </div>
            <div>
              <span className="font-semibold text-slate-900 dark:text-white">Grievance Officer:</span>{' '}
              {import.meta.env.VITE_GRIEVANCE_EMAIL ? (
                <a
                  href={`mailto:${import.meta.env.VITE_GRIEVANCE_EMAIL}`}
                  className="text-cyan-600 dark:text-cyan-400 hover:underline font-mono"
                >
                  {import.meta.env.VITE_GRIEVANCE_EMAIL}
                </a>
              ) : (
                <span className="text-slate-500 italic">Configurable via VITE_GRIEVANCE_EMAIL</span>
              )}
            </div>
          </div>
        </section>

        {/* Section 20: Effective Date and Last Updated Date */}
        <section className="bg-white dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>20. Effective Date &amp; Subscription Terms Notice</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block">Document Version:</span>
              <span className="text-slate-600 dark:text-slate-400 font-mono">v2026.1 (Enterprise Review)</span>
            </div>
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block">Last Updated:</span>
              <span className="text-slate-600 dark:text-slate-400">October 23, 2026</span>
            </div>
          </div>
          <div className="pt-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
            <strong>Commercial Terms Disclosure:</strong> DOCUAGENT AI operates currently as a demonstration and private enterprise document agent. There are NO retail recurring subscriptions, paid consumer tiers, or credit card checkouts. Commercial licensing is governed by separate master enterprise contracts.
          </div>
        </section>

      </div>

      {/* Footer Return action */}
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
