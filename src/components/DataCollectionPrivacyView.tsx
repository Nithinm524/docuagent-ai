import React, { useState } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  Database,
  Cpu,
  Lock,
  Clock,
  ExternalLink,
  Cookie,
  UserCheck,
  Mail,
  AlertTriangle,
  FileText,
  Search,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { usePageMetadata, PAGE_METADATA } from '../utils/usePageMetadata.ts';

interface DataCollectionPrivacyViewProps {
  onBack: () => void;
  onOpenTerms: () => void;
  onOpenCookies: () => void;
  onOpenPrivacy: () => void;
}

interface InventoryCategory {
  id: string;
  category: string;
  whatIsCollected: string;
  whyCollected: string;
  isRequired: 'Required' | 'Optional' | 'Context-Dependent';
  storageLocation: string;
  retentionPeriod: string;
  thirdPartySharing: string;
  deletionRights: string;
  verificationStatus: 'Verified in Codebase' | 'External Configuration Required';
}

export const DataCollectionPrivacyView: React.FC<DataCollectionPrivacyViewProps> = ({
  onBack,
  onOpenTerms,
  onOpenCookies,
  onOpenPrivacy
}) => {
  usePageMetadata(PAGE_METADATA.dataCollection || {
    title: 'Data Collection and Privacy | DOCUAGENT AI',
    description:
      'Inventory of personal and technical data collected by DOCUAGENT AI, processing purposes, storage, retention lifecycles, and user rights.',
    canonicalPath: '/?page=data-collection'
  });

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const inventoryData: InventoryCategory[] = [
    {
      id: 'auth-data',
      category: '1. Account & Authentication Information',
      whatIsCollected:
        'Email address, username, full name, role (Admin, Reviewer, Viewer, Applicant), tenant ID, salted scrypt password hashes, and session cookies.',
      whyCollected:
        'To authenticate authorized human operators, enforce Role-Based Access Control (RBAC), and isolate tenant cases.',
      isRequired: 'Required',
      storageLocation: 'In-memory authenticated user registry and server session memory cache.',
      retentionPeriod: 'Session lifetime (8-hour maximum age with 1-hour sliding inactivity timeout); user accounts retained until deleted.',
      thirdPartySharing: 'No. Authentication credentials and password hashes are never transmitted to external services.',
      deletionRights: 'Self-service account deletion via DELETE /api/auth/account completely purges the user profile and revokes sessions.',
      verificationStatus: 'Verified in Codebase'
    },
    {
      id: 'document-files',
      category: '2. Uploaded Identity Documents & Files',
      whatIsCollected:
        'Uploaded PDF documents, JPEG/PNG images, filenames, MIME types, file sizes (max 15MB), and optional cross-reference documents.',
      whyCollected:
        'Core application functionality: to perform multimodal OCR, classify document formats, and extract identity/financial attributes.',
      isRequired: 'Required',
      storageLocation: 'Server persistent JSON store (.data/cases_store.json) with AES-256-GCM authenticated encryption at rest.',
      retentionPeriod: 'Default 90-day retention policy cycle; purged within 24 hours upon affirmative consent withdrawal.',
      thirdPartySharing: 'Sent server-to-server over encrypted TLS to Google Gemini API when server-side AI processing is enabled.',
      deletionRights: 'Data Principal may withdraw consent or operators may trigger case data purge via Case Detail view.',
      verificationStatus: 'Verified in Codebase'
    },
    {
      id: 'ocr-text',
      category: '3. Extracted Text & OCR Tokens',
      whatIsCollected:
        'Raw text streams parsed from PDF layers, OCR token coordinates, extracted key-value fields (e.g., passport numbers, names, addresses), and confidence scores.',
      whyCollected:
        'To evaluate deterministic document validation rules and generate review recommendations.',
      isRequired: 'Required',
      storageLocation: 'Server datastore, encrypted with AES-256-GCM. Unprivileged roles receive masked/redacted PII in responses.',
      retentionPeriod: 'Retained alongside case record for 90 days or expunged upon manual/automated data minimization.',
      thirdPartySharing: 'Heuristic text parsed locally or via Google Gemini multimodal processing.',
      deletionRights: 'Case deletion or data minimization scrubs the raw text and replaces field values with [PURGED_UNDER_DATA_MINIMISATION].',
      verificationStatus: 'Verified in Codebase'
    },
    {
      id: 'validation-results',
      category: '4. Document Metadata & Validation Results',
      whatIsCollected:
        'Predicted document types, classification reasoning, rule findings (missing fields, format errors, expiration alerts, cross-document conflicts).',
      whyCollected:
        'To triage documents into operational queues (General Review, Missing Information, Priority Review) and assist human reviewers.',
      isRequired: 'Required',
      storageLocation: 'Server case record within .data/cases_store.json.',
      retentionPeriod: 'Maintained for compliance tracking during the active 90-day lifecycle.',
      thirdPartySharing: 'No. Deterministic validation rules run strictly on the local backend server without external transmission.',
      deletionRights: 'Purged or expunged with parent case record.',
      verificationStatus: 'Verified in Codebase'
    },
    {
      id: 'form-corrections',
      category: '5. User-Submitted Form Information & Corrections',
      whatIsCollected:
        'Human reviewer corrections to OCR values, manual field entries, resolution notes on findings, and operational comments.',
      whyCollected:
        'To record human-in-the-loop verification, resolve OCR ambiguities, and document human sign-off.',
      isRequired: 'Optional',
      storageLocation: 'Server case record in .data/cases_store.json.',
      retentionPeriod: 'Retained for 90 days as part of the case review trail.',
      thirdPartySharing: 'No external sharing.',
      deletionRights: 'Can be updated during active review or expunged through case data purge.',
      verificationStatus: 'Verified in Codebase'
    },
    {
      id: 'reviewer-decisions',
      category: '6. Reviewer Decisions & Routing History',
      whatIsCollected:
        'Reviewer action logs (Approve, Request Information, Escalate Priority, Mark Complete), assigned queues, reviewer names, and timestamps.',
      whyCollected:
        'To enforce accountability, maintain reviewer operational queues, and record supervisory audit history.',
      isRequired: 'Required',
      storageLocation: 'Server review_actions array in .data/cases_store.json.',
      retentionPeriod: 'Retained as part of regulatory audit trail; operational history preserved even when underlying PII is minimized.',
      thirdPartySharing: 'No external sharing.',
      deletionRights: 'Audit event records are immutable for regulatory compliance; associated personal identifiers are masked upon erasure.',
      verificationStatus: 'Verified in Codebase'
    },
    {
      id: 'security-audit',
      category: '7. Security & Audit Logs',
      whatIsCollected:
        'Audit trail events (CASE_CREATED, TEXT_EXTRACTED, VALIDATION_RUN, CONSENT_RECORDED, DATA_PURGED), request IDs, bot challenge timestamps, and rate limit states.',
      whyCollected:
        'To detect security anomalies, prevent automated abuse, defend against IDOR/tampering, and maintain non-repudiation.',
      isRequired: 'Required',
      storageLocation: 'Server audit_events array and server-side log rotation.',
      retentionPeriod: 'In-memory ring buffer (100 recent entries) and persistent case audit records.',
      thirdPartySharing: 'No external sharing.',
      deletionRights: 'System audit logs are security records; personal data within events is redacted during data erasure.',
      verificationStatus: 'Verified in Codebase'
    },
    {
      id: 'consent-preferences',
      category: '8. Cookie & Consent Preferences',
      whatIsCollected:
        'Affirmative document intake consent records (Notice version, timestamp, purpose, declaration), cookie preferences (essential vs operational), and theme setting.',
      whyCollected:
        'To prove statutory compliance under DPDP Section 6 and GDPR Article 7, and respect user cookie choices.',
      isRequired: 'Required',
      storageLocation: 'Client-side localStorage (docuagent_cookie_consent) and server-side consent_record on each case.',
      retentionPeriod: 'Consent evidence is retained alongside case records for audit defense; client preferences persist until cleared.',
      thirdPartySharing: 'No external sharing.',
      deletionRights: 'Consent can be withdrawn via the Case Detail workspace; cookies can be reset via Cookie Preferences.',
      verificationStatus: 'Verified in Codebase'
    },
    {
      id: 'technical-info',
      category: '9. Technical Telemetry & Connection Data',
      whatIsCollected:
        'Client IP addresses (evaluated in sliding-window rate limiters; not permanently logged), HTTP User-Agent, request correlation IDs, and response durations.',
      whyCollected:
        'To enforce sliding-window rate limiting (20 AI req/min, 120 API req/min), track service health, and diagnose network failures.',
      isRequired: 'Required',
      storageLocation: 'Volatile in-memory rate limiter sliding window (garbage-collected every 2 minutes).',
      retentionPeriod: 'Transient: 60 seconds to 15 minutes max lifetime in volatile memory; never written to persistent disk.',
      thirdPartySharing: 'No external sharing.',
      deletionRights: 'Automatically flushed from memory upon window expiration.',
      verificationStatus: 'Verified in Codebase'
    },
    {
      id: 'third-party-info',
      category: '10. Information Shared with Third-Party Providers',
      whatIsCollected:
        'Document image or text payloads sent to Google Gemini API when server-side AI extraction is configured; Google Fonts stylesheet requests.',
      whyCollected:
        'High-accuracy multimodal character recognition, complex document classification, and web typography.',
      isRequired: 'Context-Dependent',
      storageLocation: 'Processed in transit over HTTPS. Subject to Google Cloud Enterprise data protection terms (no model training).',
      retentionPeriod: 'Determined by external enterprise Cloud agreement; flagged below for enterprise legal review.',
      thirdPartySharing: 'Google Cloud Platform (AI Studio / Vertex AI Gemini API). Zero advertising, marketing, or tracking networks.',
      deletionRights: 'Governed by enterprise Google Cloud Data Processing Addendum (DPA).',
      verificationStatus: 'External Configuration Required'
    }
  ];

  const filteredCategories = inventoryData.filter((item) => {
    const matchesFilter =
      activeCategoryFilter === 'all' ||
      (activeCategoryFilter === 'required' && item.isRequired === 'Required') ||
      (activeCategoryFilter === 'optional' && item.isRequired === 'Optional') ||
      (activeCategoryFilter === '3p' && item.thirdPartySharing.toLowerCase().includes('google'));

    const matchesSearch =
      searchTerm === '' ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.whatIsCollected.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.whyCollected.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10 animate-fadeIn text-slate-800 dark:text-slate-200">
      {/* Header & Back Navigation */}
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
              Data Collection and Privacy
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
              Transparency Disclosure
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
            Complete data inventory and transparency statement for <strong>DOCUAGENT AI</strong>. This page details every data category our application collects, why it is processed, where it is stored, and how data subjects can exercise privacy rights.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400">Effective:</span>
          <span className="font-semibold text-slate-900 dark:text-white">October 2026</span>
        </div>
      </div>

      {/* Sensitive Document Warning Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start space-x-3 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold block">Important Document Intake Notice:</span>
          <p className="leading-relaxed text-amber-800 dark:text-amber-300">
            Uploaded identity documents, bank statements, and business agreements contain sensitive personal identifiable information (PII). You must only upload documents that you are legally authorized to submit. DOCUAGENT AI applies server-side encryption and human-in-the-loop controls, but cannot replace your organization’s internal data governance and access control obligations.
          </p>
        </div>
      </div>

      {/* Section 1: Information We Collect (Interactive Inventory) */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <span>1. Information We Collect (Data Inventory)</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Derived directly from inspection of the DOCUAGENT AI codebase and active data stores.
            </p>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search data inventory..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 w-44 sm:w-56"
              />
            </div>
            <select
              value={activeCategoryFilter}
              onChange={(e) => setActiveCategoryFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">All Categories ({inventoryData.length})</option>
              <option value="required">Required Only</option>
              <option value="optional">Optional Only</option>
              <option value="3p">Third-Party Shared</option>
            </select>
          </div>
        </div>

        {/* Inventory Cards */}
        <div className="space-y-3">
          {filteredCategories.map((item) => (
            <div
              key={item.id}
              className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-3 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                <span className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  {item.category}
                </span>
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      item.isRequired === 'Required'
                        ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                        : item.isRequired === 'Optional'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                        : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
                    }`}
                  >
                    {item.isRequired}
                  </span>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      item.verificationStatus === 'Verified in Codebase'
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                    }`}
                  >
                    {item.verificationStatus}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    What is Collected:
                  </span>
                  <p className="text-slate-800 dark:text-slate-200">{item.whatIsCollected}</p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    Why it is Collected:
                  </span>
                  <p className="text-slate-800 dark:text-slate-200">{item.whyCollected}</p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    Storage &amp; Retention:
                  </span>
                  <p className="text-slate-700 dark:text-slate-300">
                    <span className="font-medium text-slate-900 dark:text-slate-100">Storage:</span>{' '}
                    {item.storageLocation}
                    <br />
                    <span className="font-medium text-slate-900 dark:text-slate-100">Retention:</span>{' '}
                    {item.retentionPeriod}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    Third-Party Sharing &amp; Deletion Rights:
                  </span>
                  <p className="text-slate-700 dark:text-slate-300">
                    <span className="font-medium text-slate-900 dark:text-slate-100">Third Parties:</span>{' '}
                    {item.thirdPartySharing}
                    <br />
                    <span className="font-medium text-slate-900 dark:text-slate-100">Deletion:</span>{' '}
                    {item.deletionRights}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Why We Collect It */}
      <section className="space-y-3 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span>2. Why We Collect It (Processing Purposes)</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <span className="font-bold text-slate-900 dark:text-white block">Document Review Workflow</span>
            <p className="text-slate-600 dark:text-slate-400">
              Extract structured information, detect formatting deficiencies, cross-reference multiple documents, and assign cases to specialized reviewer queues.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <span className="font-bold text-slate-900 dark:text-white block">Human-in-the-Loop Triage</span>
            <p className="text-slate-600 dark:text-slate-400">
              Enable trained human compliance operators to review OCR uncertainty, resolve rule conflicts, and finalize institutional decisions.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <span className="font-bold text-slate-900 dark:text-white block">Regulatory Audit Trail</span>
            <p className="text-slate-600 dark:text-slate-400">
              Maintain an immutable timeline of document actions, operator interventions, and affirmative consent notices required under DPDP and GDPR.
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: How Document Processing Works */}
      <section className="space-y-3 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Cpu className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          <span>3. How Document Processing Works</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          DOCUAGENT AI executes an automated five-stage pipeline:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 pl-1">
          <li>
            <strong>Ingestion &amp; Security Validation:</strong> Validates file signatures (magic bytes), checks MIME types, enforces the 15MB size ceiling, and locks idempotency tokens to prevent duplicate submissions.
          </li>
          <li>
            <strong>Multimodal Text &amp; OCR Parsing:</strong> Digital PDF text streams are parsed; raster scans and image files are extracted via Google Gemini multimodal processing or local Tesseract OCR fallback.
          </li>
          <li>
            <strong>Adaptive Schema Extraction:</strong> Document type is either designated by the user or classified via predictive heuristics into one of six supported schemas (Passport, Driver License, Bank Statement, Utility Bill, General Document, Unknown).
          </li>
          <li>
            <strong>Deterministic Rule Evaluation:</strong> Field values are evaluated against deterministic cross-field checks: mandatory presence, format regex, expiration dates, 90-day recency, name similarity, and address consistency.
          </li>
          <li>
            <strong>Queue Routing &amp; Human Handoff:</strong> Based on validation findings, the case is routed to General Review, Missing Information, or Priority Review.
          </li>
        </ol>
      </section>

      {/* Section 4: How We Protect Information */}
      <section className="space-y-3 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span>4. How We Protect Information</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="font-semibold text-slate-900 dark:text-white">Encryption-at-Rest</span>
            <p className="text-slate-600 dark:text-slate-400">
              Sensitive payloads (file data URLs, raw OCR text, cross-document text) are encrypted using authenticated AES-256-GCM. The master encryption key is maintained in a protected local keyfile (mode 0600) or injected via environment variable.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="font-semibold text-slate-900 dark:text-white">Encryption-in-Transit</span>
            <p className="text-slate-600 dark:text-slate-400">
              All communications between the browser and backend are secured over HTTPS with Strict-Transport-Security (HSTS) headers enabled.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="font-semibold text-slate-900 dark:text-white">Tenant &amp; Ownership Isolation (IDOR Defense)</span>
            <p className="text-slate-600 dark:text-slate-400">
              Every read, update, or deletion operation verifies tenant ownership and role permissions. Applicant accounts can only access their own submissions.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="font-semibold text-slate-900 dark:text-white">CSRF &amp; Session Defense</span>
            <p className="text-slate-600 dark:text-slate-400">
              State-changing endpoints require matching double-submit CSRF headers. Cryptographically random session identifiers expire after 8 hours or 1 hour of inactivity.
            </p>
          </div>
        </div>
      </section>

      {/* Section 5: Data Retention and Deletion */}
      <section className="space-y-3 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span>5. Data Retention and Deletion</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          We enforce strict data minimization and statutory retention periods:
        </p>
        <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 pl-1">
          <li><strong>90-Day Operational Lifecycle:</strong> Document records, uploaded files, and extracted fields are automatically purged upon reaching the 90-day threshold via our server retention cleanup job.</li>
          <li><strong>Consent Withdrawal Purge:</strong> When a Data Principal withdraws consent, personal data is expunged within 24 hours.</li>
          <li><strong>Permanent Account Erasure:</strong> Users may invoke <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs">DELETE /api/auth/account</code> to permanently delete their account credentials and purge all associated document records.</li>
          <li><strong>Audit Trail Preservation:</strong> To comply with statutory non-repudiation mandates, a masked audit event (<code className="text-xs">DATA_PURGED_MINIMISED</code>) is preserved, recording the purge timestamp and legal justification without retaining original document files or PII.</li>
        </ul>
      </section>

      {/* Section 6: Third-Party Services */}
      <section className="space-y-3 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ExternalLink className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span>6. Third-Party Services</span>
        </h2>
        <div className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <p>
            DOCUAGENT AI engages the following third-party sub-processors:
          </p>
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-50 dark:bg-slate-950 p-3 font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800">
              Sub-Processor Disclosures
            </div>
            <div className="p-3 space-y-2">
              <div>
                <span className="font-bold text-slate-900 dark:text-white">Google Gemini API (@google/genai):</span>
                <span className="text-slate-600 dark:text-slate-400 block mt-0.5">
                  Used for OCR extraction and document classification. Requests originate exclusively from our backend server over encrypted TLS. Per Google Cloud terms, customer data processed via standard API quotas is not used to train base foundation models.
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-900 dark:text-white">Google Fonts:</span>
                <span className="text-slate-600 dark:text-slate-400 block mt-0.5">
                  Serves Plus Jakarta Sans and JetBrains Mono typefaces. The browser directly retrieves font assets from fonts.googleapis.com.
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
            Notice: No third-party behavioral advertising, analytics tracking pixels, or cross-site fingerprinting libraries are installed.
          </p>
        </div>
      </section>

      {/* Section 7: Cookies and Tracking */}
      <section className="space-y-3 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Cookie className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span>7. Cookies and Technical Storage</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          We use strictly necessary first-party cookies to provide essential security and authentication functions:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">docuagent_session</span>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              HttpOnly, SameSite=Lax. Stores the cryptographic session token for authenticated users. Expires after 8 hours.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">docuagent_csrf</span>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              SameSite=Lax. Stores double-submit CSRF token to prevent cross-site request forgery attacks on state-changing API actions.
            </p>
          </div>
        </div>
        <div className="pt-1">
          <button
            onClick={onOpenCookies}
            className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline font-semibold cursor-pointer"
          >
            Review complete Cookie Policy &amp; Storage Mechanics →
          </button>
        </div>
      </section>

      {/* Section 8: User Rights and Privacy Requests */}
      <section className="space-y-3 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span>8. User Rights and Privacy Requests</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          In accordance with the Digital Personal Data Protection Act (DPDP Act 2023) and General Data Protection Regulation (GDPR), Data Principals enjoy:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <strong>Right to Access:</strong> View all extracted fields, metadata, and routing decisions in the workspace.
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <strong>Right to Correction:</strong> Reviewers and applicants can correct OCR misinterpretations in the Case Detail view.
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <strong>Right to Erasure:</strong> Permanently scrub document contents and extracted PII at any time.
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <strong>Right to Withdraw Consent:</strong> Withdraw document processing consent with the same ease as granting it.
          </div>
        </div>
      </section>

      {/* Section 9: Contact and Grievance Information */}
      <section className="space-y-3 bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Mail className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          <span>9. Contact and Grievance Redressal</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          For privacy inquiries, rights requests, or grievance redressal, please contact our authorized officers:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="font-semibold text-slate-900 dark:text-white block">Privacy Officer:</span>
            {import.meta.env.VITE_PRIVACY_EMAIL ? (
              <a
                href={`mailto:${import.meta.env.VITE_PRIVACY_EMAIL}`}
                className="text-cyan-600 dark:text-cyan-400 hover:underline font-mono mt-1 block"
              >
                {import.meta.env.VITE_PRIVACY_EMAIL}
              </a>
            ) : (
              <span className="text-slate-500 italic block mt-1">
                Configurable via VITE_PRIVACY_EMAIL
              </span>
            )}
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="font-semibold text-slate-900 dark:text-white block">Legal &amp; Trademark Counsel:</span>
            {import.meta.env.VITE_LEGAL_EMAIL ? (
              <a
                href={`mailto:${import.meta.env.VITE_LEGAL_EMAIL}`}
                className="text-cyan-600 dark:text-cyan-400 hover:underline font-mono mt-1 block"
              >
                {import.meta.env.VITE_LEGAL_EMAIL}
              </a>
            ) : (
              <span className="text-slate-500 italic block mt-1">
                Configurable via VITE_LEGAL_EMAIL
              </span>
            )}
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <span className="font-semibold text-slate-900 dark:text-white block">Grievance Officer (DPDP):</span>
            {import.meta.env.VITE_GRIEVANCE_EMAIL ? (
              <a
                href={`mailto:${import.meta.env.VITE_GRIEVANCE_EMAIL}`}
                className="text-cyan-600 dark:text-cyan-400 hover:underline font-mono mt-1 block"
              >
                {import.meta.env.VITE_GRIEVANCE_EMAIL}
              </a>
            ) : (
              <span className="text-slate-500 italic block mt-1">
                Configurable via VITE_GRIEVANCE_EMAIL
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Footer Navigation Action */}
      <div className="pt-4 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold transition-colors cursor-pointer shadow-xs"
        >
          Return to Dashboard
        </button>
        <div className="flex items-center space-x-3 text-xs">
          <button onClick={onOpenTerms} className="text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 cursor-pointer">
            Terms of Use
          </button>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <button onClick={onOpenPrivacy} className="text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 cursor-pointer">
            Privacy Policy
          </button>
          <span className="text-slate-300 dark:text-slate-700">·</span>
          <button onClick={onOpenCookies} className="text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 cursor-pointer">
            Cookie Policy
          </button>
        </div>
      </div>
    </div>
  );
};
