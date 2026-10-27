import React, { useState } from 'react';
import {
  X,
  Scale,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  FileText,
  Bookmark,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface PreLaunchLegalChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onOpenDataCollection: () => void;
}

export type ChecklistStatus = 'Verified' | 'Needs Review' | 'Not Configured' | 'Not Applicable';

interface ChecklistItem {
  id: string;
  category: 'data-privacy' | 'branding' | 'terms-rights';
  title: string;
  requirement: string;
  status: ChecklistStatus;
  findingSummary: string;
  remediationAction: string;
  technicalReference: string;
}

export const PreLaunchLegalChecklistModal: React.FC<PreLaunchLegalChecklistModalProps> = ({
  isOpen,
  onClose,
  onOpenPrivacy,
  onOpenTerms,
  onOpenDataCollection
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'data-privacy' | 'branding' | 'terms-rights'>('all');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  if (!isOpen) return null;

  const checklistItems: ChecklistItem[] = [
    // DATA AND PRIVACY
    {
      id: 'dp-1',
      category: 'data-privacy',
      title: 'Actual Data Collection Inventoried',
      requirement: 'Inspect the actual application and document all personal and technical data categories.',
      status: 'Verified',
      findingSummary:
        'All 10 categories (account credentials, uploaded files, extracted text, metadata, reviewer decisions, audit logs, cookies, technical IPs, and 3P payloads) are mapped in DataCollectionPrivacyView.',
      remediationAction: 'Keep inventory synchronized whenever new document schemas or backend stores are introduced.',
      technicalReference: 'src/components/DataCollectionPrivacyView.tsx & server/store.ts'
    },
    {
      id: 'dp-2',
      category: 'data-privacy',
      title: 'Processing Purposes Documented',
      requirement: 'Document why each category of information is collected without vague or catch-all legal phrasing.',
      status: 'Verified',
      findingSummary:
        'Purposes are strictly limited to OCR text extraction, deterministic validation, reviewer queue triage, security rate limiting, and regulatory audit non-repudiation.',
      remediationAction: 'Verified. No secondary marketing, ad profiling, or automated consumer profiling occurs.',
      technicalReference: 'PrivacyPolicyView.tsx Section 3 & DataCollectionPrivacyView.tsx'
    },
    {
      id: 'dp-3',
      category: 'data-privacy',
      title: 'Retention Periods Confirmed',
      requirement: 'Confirm and enforce statutory data retention schedules in application code.',
      status: 'Verified',
      findingSummary:
        '90-day retention schedule enforced via server/store.ts runRetentionCleanup() and 24-hour consent withdrawal expiry.',
      remediationAction: 'Schedule automated daily cron job against POST /api/admin/retention/cleanup in production.',
      technicalReference: 'server/store.ts lines 570-610 & server/api.ts line 415'
    },
    {
      id: 'dp-4',
      category: 'data-privacy',
      title: 'Deletion Procedures Reviewed',
      requirement: 'Provide functional deletion and data minimization mechanisms for data principals and operators.',
      status: 'Verified',
      findingSummary:
        'Implemented DELETE /api/auth/account (purges user account & records) and CaseDetailView "Expunge Personal Data" button (caseStore.purgeCaseData).',
      remediationAction: 'Verified. Raw files are stripped and extracted PII is replaced with [PURGED_UNDER_DATA_MINIMISATION].',
      technicalReference: 'server/api.ts lines 360-390 & CaseDetailView.tsx'
    },
    {
      id: 'dp-5',
      category: 'data-privacy',
      title: 'Third-Party Data Transfers Identified',
      requirement: 'Identify external AI, OCR, or cloud hosting endpoints that receive personal data payloads.',
      status: 'Needs Review',
      findingSummary:
        'Google Gemini API receives document images and text streams over HTTPS when server-side AI is enabled. Google Cloud DPA must be executed by deploying enterprise.',
      remediationAction: 'Enterprise legal team must sign Google Cloud Enterprise Data Processing Addendum (DPA) and BAA if processing HIPAA data.',
      technicalReference: 'server/geminiService.ts & DataCollectionPrivacyView.tsx Section 6'
    },
    {
      id: 'dp-6',
      category: 'data-privacy',
      title: 'Cookie and Tracking Behavior Checked',
      requirement: 'Verify that non-essential trackers are opt-in and cookies are accurately declared.',
      status: 'Verified',
      findingSummary:
        'Only strictly necessary first-party cookies (docuagent_session, docuagent_csrf) are set. Zero third-party ad networks or tracking pixels are loaded.',
      remediationAction: 'Verified in CookiePolicyView and CookieConsentBanner components.',
      technicalReference: 'CookiePolicyView.tsx & CookieConsentBanner.tsx'
    },
    {
      id: 'dp-7',
      category: 'data-privacy',
      title: 'Privacy Notices Match Actual Behavior',
      requirement: 'Ensure that pre-upload privacy notices accurately reflect actual storage and processing.',
      status: 'Verified',
      findingSummary:
        'UploadView features Document Intake Notice v2026.1 with affirmative consent checkbox and explicit links to full disclosures before file submission.',
      remediationAction: 'Verified. Notice describes 90-day retention and server-side processing accurately.',
      technicalReference: 'src/components/UploadView.tsx lines 490-550'
    },

    // BRANDING AND TRADEMARK
    {
      id: 'bm-1',
      category: 'branding',
      title: 'Product Name Consistency Checked',
      requirement: 'Enforce consistent, uniform use of "DOCUAGENT AI" across all headers, footers, titles, and legal pages.',
      status: 'Verified',
      findingSummary:
        'Uniformly applied across Navbar, Footer, Page Metadata ("Page Name | DOCUAGENT AI"), Terms, Privacy, and DPDP readiness views.',
      remediationAction: 'Verified. No divergent product names or placeholders exist.',
      technicalReference: 'src/utils/usePageMetadata.ts & Navbar.tsx'
    },
    {
      id: 'bm-2',
      category: 'branding',
      title: 'Logo and Image Rights Reviewed',
      requirement: 'Ensure original brand assets are used and do not infringe third-party visual trademarks.',
      status: 'Verified',
      findingSummary:
        'Original DOCUAGENT AI vector/raster logo (/public/docuagent-logo.webp and PNG) utilized with proper contrast backing, explicit dimensions, and alt text.',
      remediationAction: 'Verified. Asset source files documented in public/ folder.',
      technicalReference: 'public/docuagent-logo.webp & src/components/Navbar.tsx'
    },
    {
      id: 'bm-3',
      category: 'branding',
      title: 'Trademark Searches Completed / Outstanding',
      requirement: 'Conduct trademark clearance search in USPTO TESS, EUIPO, and IP India before claiming legal rights.',
      status: 'Needs Review',
      findingSummary:
        'Formal trademark availability search has NOT been verified. Application does NOT display the registered symbol (®) or make false availability claims.',
      remediationAction: 'Retain intellectual property counsel to execute formal comprehensive trademark clearance across International Class 9 and 42.',
      technicalReference: 'Brand & Trademark Checklist Section 2'
    },
    {
      id: 'bm-4',
      category: 'branding',
      title: 'Unsupported Endorsement Claims Removed',
      requirement: 'Scrub all claims of guaranteed 100% accuracy, regulatory certification, or government partnerships.',
      status: 'Verified',
      findingSummary:
        'Automated quality tests (quality-seo.test.ts) enforce that no false accuracy claims, fake certifications, or unverified claims appear.',
      remediationAction: 'Verified. Assistive AI disclaimer is clearly published in footer and Terms of Use.',
      technicalReference: 'src/shared/quality-seo.test.ts lines 40-45'
    },

    // TERMS AND USER RIGHTS
    {
      id: 'tr-1',
      category: 'terms-rights',
      title: 'Terms of Use Accurately Describe Service',
      requirement: 'Reflect the actual capabilities, file limitations, and review routing functions of the platform.',
      status: 'Verified',
      findingSummary:
        '20-section Terms of Use accurately describes 15MB file boundary, supported schemas, deterministic checks, and human sign-off mandate.',
      remediationAction: 'Verified in src/components/TermsView.tsx.',
      technicalReference: 'src/components/TermsView.tsx'
    },
    {
      id: 'tr-2',
      category: 'terms-rights',
      title: 'AI Limitations Disclosed',
      requirement: 'Clearly disclose heuristic OCR errors, classification uncertainty, and prohibition of autonomous final legal decisions.',
      status: 'Verified',
      findingSummary:
        'Disclosed in Terms Section 8, UploadView Intake Notice, and CaseDetailView screening report.',
      remediationAction: 'Verified. Assistive nature is highlighted in high-contrast callout boxes.',
      technicalReference: 'src/components/TermsView.tsx Section 8'
    },
    {
      id: 'tr-3',
      category: 'terms-rights',
      title: 'Upload Responsibilities & Misuse Prohibited',
      requirement: 'Warrant that users must have legal authority to upload documents and strictly prohibit malicious abuse.',
      status: 'Verified',
      findingSummary:
        'Terms Section 6 and Section 7 prohibit unauthorized uploads, IDOR bypass attempts, submitting malicious files, and falsified credentials.',
      remediationAction: 'Affirmative upload consent declaration enforces confirmation before file ingestion.',
      technicalReference: 'src/components/UploadView.tsx & TermsView.tsx'
    },
    {
      id: 'tr-4',
      category: 'terms-rights',
      title: 'Account Deletion & Privacy Requests Documented',
      requirement: 'Provide clear instructions for exercising right to erasure and submitting DPDP / GDPR grievances.',
      status: 'Verified',
      findingSummary:
        'Full self-service account deletion (DELETE /api/auth/account), consent withdrawal, and DPDP ticket submission (/api/dpdp/requests) are operational.',
      remediationAction: 'Verified in DpdpReadinessView.tsx and TermsView.tsx Section 16.',
      technicalReference: 'server/api.ts lines 360-390 & DpdpReadinessView.tsx'
    },
    {
      id: 'tr-5',
      category: 'terms-rights',
      title: 'Subscription & Cancellation Terms Evaluated',
      requirement: 'Include accurate billing terms if paid plans exist; do NOT invent prices or checkout features if absent.',
      status: 'Not Applicable',
      findingSummary:
        'DOCUAGENT AI has no payment processing, retail subscription tiers, or recurring billing checkouts. Verified as NOT APPLICABLE.',
      remediationAction: 'Terms Section 20 clearly discloses that no consumer subscriptions or cardholder checkouts exist.',
      technicalReference: 'TermsView.tsx Section 20'
    },
    {
      id: 'tr-6',
      category: 'terms-rights',
      title: 'Missing Legal Contact Information Identified',
      requirement: 'Verify presence of real organizational contact emails or provide explicit environment variable configuration.',
      status: 'Not Configured',
      findingSummary:
        'Legal, Privacy, and Grievance contact emails default to local dev addresses until configured via VITE_LEGAL_EMAIL, VITE_PRIVACY_EMAIL, and VITE_GRIEVANCE_EMAIL.',
      remediationAction: 'Configure corporate contact center emails in deployment environment (.env) before public DNS launch.',
      technicalReference: '.env.example & TermsView.tsx Section 19'
    }
  ];

  const filteredItems = checklistItems.filter((item) => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  const counts = {
    verified: checklistItems.filter((i) => i.status === 'Verified').length,
    needsReview: checklistItems.filter((i) => i.status === 'Needs Review').length,
    notConfigured: checklistItems.filter((i) => i.status === 'Not Configured').length,
    notApplicable: checklistItems.filter((i) => i.status === 'Not Applicable').length
  };

  const getStatusBadge = (status: ChecklistStatus) => {
    switch (status) {
      case 'Verified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Verified</span>
          </span>
        );
      case 'Needs Review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Needs Review</span>
          </span>
        );
      case 'Not Configured':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Not Configured</span>
          </span>
        );
      case 'Not Applicable':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <span>Not Applicable</span>
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-checklist-title"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-[#090E1A] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-800 dark:text-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 id="legal-checklist-title" className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Internal Pre-Launch Legal &amp; Compliance Checklist
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                DOCUAGENT AI · Pre-Deployment Readiness Review &amp; Statutory Assessment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            aria-label="Close legal checklist"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Scorecard */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090E1A] space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between">
              <span className="font-medium text-emerald-900 dark:text-emerald-200">Verified</span>
              <span className="font-mono font-bold text-base text-emerald-700 dark:text-emerald-300">{counts.verified}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between">
              <span className="font-medium text-amber-900 dark:text-amber-200">Needs Review</span>
              <span className="font-mono font-bold text-base text-amber-700 dark:text-amber-300">{counts.needsReview}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 flex items-center justify-between">
              <span className="font-medium text-blue-900 dark:text-blue-200">Not Configured</span>
              <span className="font-mono font-bold text-base text-blue-700 dark:text-blue-300">{counts.notConfigured}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-medium text-slate-700 dark:text-slate-300">Not Applicable</span>
              <span className="font-mono font-bold text-base text-slate-700 dark:text-slate-300">{counts.notApplicable}</span>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950 font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All Items ({checklistItems.length})
            </button>
            <button
              onClick={() => setSelectedCategory('data-privacy')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                selectedCategory === 'data-privacy'
                  ? 'bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950 font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Data &amp; Privacy (7)
            </button>
            <button
              onClick={() => setSelectedCategory('branding')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                selectedCategory === 'branding'
                  ? 'bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950 font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Branding &amp; Trademark (4)
            </button>
            <button
              onClick={() => setSelectedCategory('terms-rights')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                selectedCategory === 'terms-rights'
                  ? 'bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950 font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Terms &amp; User Rights (6)
            </button>
          </div>
        </div>

        {/* Scrollable Checklist Items */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {filteredItems.map((item) => {
            const isExpanded = expandedItemId === item.id;
            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 overflow-hidden transition-all"
              >
                <div
                  onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                  className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-xs font-semibold text-slate-400 w-8">{item.id.toUpperCase()}</span>
                    <div>
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white block">
                        {item.title}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {item.requirement}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {getStatusBadge(item.status)}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 pt-1 border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#070b14] space-y-2.5 text-xs">
                    <div>
                      <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                        Technical Finding &amp; Implementation Status:
                      </span>
                      <p className="text-slate-800 dark:text-slate-200 leading-relaxed">{item.findingSummary}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                        Required Action / External Remediation:
                      </span>
                      <p className="text-amber-800 dark:text-amber-300 font-medium leading-relaxed">{item.remediationAction}</p>
                    </div>
                    <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/60">
                      <span>Code Reference: <code className="font-mono text-slate-700 dark:text-slate-300">{item.technicalReference}</code></span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-500">
            <span>External Review Actions:</span>
            <button
              onClick={() => {
                onClose();
                onOpenDataCollection();
              }}
              className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold cursor-pointer"
            >
              Data Inventory
            </button>
            <span>·</span>
            <button
              onClick={() => {
                onClose();
                onOpenTerms();
              }}
              className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold cursor-pointer"
            >
              Terms of Use
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold cursor-pointer transition-colors"
          >
            Close Checklist
          </button>
        </div>
      </div>
    </div>
  );
};
