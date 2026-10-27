import React, { useState } from 'react';
import {
  FileCheck2,
  ShieldCheck,
  Layers,
  ArrowRight,
  UploadCloud,
  CheckCircle2,
  Clock,
  Eye,
  Lock,
  Scale,
  FileText,
  ChevronDown,
  Sparkles,
  Search,
  Database,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { APP_VERSION } from '../shared/version.ts';

interface LandingPageViewProps {
  onOpenWorkspace: (tab?: 'dashboard' | 'upload' | 'queues' | 'reports') => void;
  onOpenPage: (page: 'privacy' | 'terms' | 'cookies' | 'dpdp' | 'data-collection') => void;
  onOpenRiskReport: () => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onOpenWorkspace,
  onOpenPage,
  onOpenRiskReport
}) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  const capabilities = [
    {
      icon: UploadCloud,
      title: 'Document Intake & Classification',
      description:
        'Upload PDF files and raster images (PNG, JPEG) with automated format validation and schema classification for identity, financial, and address documents.'
    },
    {
      icon: ShieldCheck,
      title: 'Identity & Document Screening',
      description:
        'Execute deterministic cross-field validation rules, check expiration dates, evaluate 90-day recency criteria, and flag identity inconsistencies.'
    },
    {
      icon: Layers,
      title: 'Human Reviewer Queues & Routing',
      description:
        'Automatically triage documents into designated queues—General Review, Missing Information, and Priority Review—for authorized human decision sign-off.'
    },
    {
      icon: FileCheck2,
      title: 'Audit Trails & Decision History',
      description:
        'Maintain permanent, chronological audit logs with cryptographic SHA-256 verification hashes, tracking field corrections, reviewer actions, and routing timestamps.'
    }
  ];

  const workflowSteps = [
    {
      step: '01',
      title: 'Submit Intake Document',
      description:
        'Select or drag-and-drop a supported PDF or image credential, provide affirmative consent, and attach optional cross-reference documents for comparison.'
    },
    {
      step: '02',
      title: 'Screen & Inspect Findings',
      description:
        'Examine extracted schema attributes with confidence scores, view automated validation rule findings, and identify missing or expired information.'
    },
    {
      step: '03',
      title: 'Human Review & Auditable Sign-Off',
      description:
        'Authorized reviewers inspect cases, correct field values, resolve findings, make final decisions, and record auditable entries in the permanent log.'
    }
  ];

  const useCases = [
    {
      badge: 'Identity',
      title: 'Passports',
      description:
        'Screen international passport credentials for expiration dates, name consistency, issuing country, and machine-readable data zones.',
      sampleFields: ['Passport Number', 'Full Name', 'Date of Birth', 'Expiration Date']
    },
    {
      badge: 'Identity',
      title: 'Driver Licenses',
      description:
        'Validate domestic driving credentials, verify state or regional issuance, check license numbers, and ensure credential validity.',
      sampleFields: ['License Number', 'Holder Name', 'Issue Date', 'Expiry Date']
    },
    {
      badge: 'Financial',
      title: 'Bank Statements',
      description:
        'Verify account holder identity, financial institution details, account numbers, and statement date recency within 90-day compliance windows.',
      sampleFields: ['Account Holder', 'Bank Name', 'Account Number', 'Statement Date']
    },
    {
      badge: 'Address Verification',
      title: 'Utility Bills',
      description:
        'Verify physical address consistency, utility provider authentication, customer billing records, and recent proof of address.',
      sampleFields: ['Customer Name', 'Billing Address', 'Provider Name', 'Bill Date']
    },
    {
      badge: 'Business Records',
      title: 'General Documents',
      description:
        'Structured ingestion for contracts, corporate filings, certificates, and unclassified agreements routed to triage queues for classification.',
      sampleFields: ['Document Title', 'Signatory Name', 'Document Date', 'Reference ID']
    }
  ];

  const faqs = [
    {
      question: 'What is AI document review?',
      answer:
        'AI document review is an assistive technology that combines automated optical character recognition (OCR), multimodal field extraction, and deterministic validation rules to help human review teams screen, verify, and route high-volume document submissions efficiently.'
    },
    {
      question: 'How does DOCUAGENT AI support document screening?',
      answer:
        'DOCUAGENT AI extracts structured fields from uploaded PDFs and images, checks them against predefined schema rules (such as expiration dates, cross-document name matches, and required field completeness), and calculates confidence scores to flag potential issues for reviewer attention.'
    },
    {
      question: 'Can a reviewer inspect a case before making a decision?',
      answer:
        'Yes. Human reviewers have complete access to inspect original documents, verify extracted field values, correct any OCR discrepancies, review rule findings with explanatory details, and enter reviewer notes before approving, rejecting, or re-routing a case.'
    },
    {
      question: 'What information appears in the audit trail?',
      answer:
        'The immutable audit trail captures file metadata, upload timestamp, classification type, automated rule outcomes, field corrections with reviewer attribution, queue transitions, final approval or rejection decisions, and SHA-256 cryptographic hashes for tamper verification.'
    },
    {
      question: 'Which document types are supported?',
      answer:
        'DOCUAGENT AI currently supports Passports, Driver Licenses, Bank Statements, Utility Bills, and General Business Documents in PDF, PNG, and JPEG/JPG formats up to 15MB.'
    }
  ];

  return (
    <div className="space-y-16 sm:space-y-24 py-4 sm:py-8">
      {/* 1. Hero Section */}
      <section
        aria-labelledby="hero-heading"
        className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-white via-slate-50 to-slate-100/70 dark:from-[#0B1120] dark:via-[#070B14] dark:to-[#040711] p-6 sm:p-12 lg:p-16 shadow-xl"
      >
        {/* Subtle Decorative Glow Background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-cyan-500/10 dark:bg-cyan-500/15 blur-3xl"
        />

        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800/80 text-cyan-800 dark:text-cyan-300 text-xs font-semibold tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
            <span>Enterprise Document Intake &amp; Screening</span>
            <span className="text-cyan-400 dark:text-cyan-600">·</span>
            <span className="font-mono text-[11px]">{APP_VERSION}</span>
          </div>

          {/* Primary H1 */}
          <h1
            id="hero-heading"
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight"
          >
            AI Document Review, Screening &amp; Routing in One Workflow
          </h1>

          {/* Hero Subtitle */}
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            DOCUAGENT AI supports enterprise document intake, automated text extraction, deterministic screening rules, and human-in-the-loop reviewer triage—delivering transparent decisions with verifiable audit trails.
          </p>

          {/* CTA Button Group */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => onOpenWorkspace('dashboard')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <span>Open Workspace</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>

            <a
              href="#capabilities"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm transition-all flex items-center justify-center space-x-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <span>Explore Features</span>
            </a>
          </div>

          {/* Transparent Human-in-the-loop Disclaimer Notice */}
          <div className="pt-4 flex items-center justify-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            <span>Assistive AI decision support · Final decisions require authorized human review</span>
          </div>
        </div>

        {/* Hero Interactive Preview Card */}
        <div className="mt-10 sm:mt-12 max-w-3xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#070B14]/90 backdrop-blur-sm p-4 sm:p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 text-xs">
            <div className="flex items-center space-x-2 font-semibold text-slate-900 dark:text-slate-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Screening Pipeline Preview</span>
            </div>
            <span className="font-mono text-[11px] text-cyan-600 dark:text-cyan-400">
              Case DOC-2026-0814 · Passport Intake
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">1. Extraction</span>
              <p className="font-semibold text-slate-900 dark:text-white">Multimodal OCR &amp; PDF</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">96% average field confidence</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">2. Validation</span>
              <p className="font-semibold text-slate-900 dark:text-white">Deterministic Rules</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">All consistency checks passed</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">3. Routing</span>
              <p className="font-semibold text-slate-900 dark:text-white">General Review Queue</p>
              <p className="text-[11px] text-cyan-600 dark:text-cyan-400 font-medium">Ready for specialist sign-off</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. What DOCUAGENT AI Does (Capabilities) */}
      <section id="capabilities" aria-labelledby="capabilities-heading" className="space-y-8 scroll-mt-24">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 id="capabilities-heading" className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Comprehensive Document Review Capabilities
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Built to organize intake screening, identify missing or conflicting data, and maintain verifiable records across your document lifecycle.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {capabilities.map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.title}
                className="p-6 sm:p-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120] hover:border-cyan-500/50 transition-all space-y-3.5 shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800/80 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                  <Icon className="w-5 h-5 stroke-[2]" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  {cap.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {cap.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. How It Works (Three-Step Workflow) */}
      <section aria-labelledby="how-it-works-heading" className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 id="how-it-works-heading" className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            How DOCUAGENT AI Works
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            A three-step intake workflow that links automated extraction with authorized human reviewer oversight.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {workflowSteps.map((step) => (
            <div
              key={step.step}
              className="relative p-6 sm:p-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120] space-y-3 shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-3">
                <span className="font-mono text-2xl sm:text-3xl font-extrabold text-cyan-600 dark:text-cyan-400">
                  {step.step}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  {step.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Supported Use Cases */}
      <section aria-labelledby="use-cases-heading" className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 id="use-cases-heading" className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Supported Document Schemas
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            DOCUAGENT AI includes preconfigured schemas and deterministic validation checks tailored for common enterprise intake scenarios.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {useCases.map((uc) => (
            <div
              key={uc.title}
              className="p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120] space-y-3 shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {uc.badge}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  {uc.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {uc.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">
                  Extracted Attributes:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {uc.sampleFields.map((field) => (
                    <span
                      key={field}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/60 text-cyan-800 dark:text-cyan-300"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Trust, Privacy & Human Oversight */}
      <section
        aria-labelledby="trust-heading"
        className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1120] p-6 sm:p-10 lg:p-12 space-y-8"
      >
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center space-x-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Governance &amp; Oversight</span>
          </div>
          <h2 id="trust-heading" className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Trust, Privacy, and Human Oversight
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            DOCUAGENT AI is designed as assistive decision support—not an autonomous authority. Every determination remains auditable and under human control.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#070B14] border border-slate-200 dark:border-slate-800/80 space-y-2">
            <UserCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Human-in-the-Loop</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Screening outputs provide guidance; final case approvals, rejections, or escalations require authorized human specialist sign-off.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#070B14] border border-slate-200 dark:border-slate-800/80 space-y-2">
            <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">90-Day Retention</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Automated data retention lifecycle purges non-active documents past 90 days to adhere to strict data minimization principles.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#070B14] border border-slate-200 dark:border-slate-800/80 space-y-2">
            <Scale className="w-5 h-5 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">DPDP &amp; Privacy Alignment</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Mandatory affirmative consent prior to upload, data principal grievance mechanisms, and an exhaustive inventory of 10 data categories.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#070B14] border border-slate-200 dark:border-slate-800/80 space-y-2">
            <Database className="w-5 h-5 text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Verifiable Auditability</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Every field correction, rule evaluation, and review decision is cryptographically fingerprinted with SHA-256 integrity hashes.
            </p>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs">
          <button
            type="button"
            onClick={() => onOpenPage('data-collection')}
            className="text-cyan-700 dark:text-cyan-400 hover:underline font-semibold cursor-pointer"
          >
            Review Data Collection Inventory &rarr;
          </button>
          <span className="text-slate-400">·</span>
          <button
            type="button"
            onClick={() => onOpenPage('dpdp')}
            className="text-cyan-700 dark:text-cyan-400 hover:underline font-semibold cursor-pointer"
          >
            Read DPDP Readiness Assessment &rarr;
          </button>
          <span className="text-slate-400">·</span>
          <button
            type="button"
            onClick={onOpenRiskReport}
            className="text-cyan-700 dark:text-cyan-400 hover:underline font-semibold cursor-pointer"
          >
            Inspect Architecture Risk Report &rarr;
          </button>
        </div>
      </section>

      {/* 6. Frequently Asked Questions (FAQ) */}
      <section aria-labelledby="faq-heading" className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-3">
          <h2 id="faq-heading" className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Essential answers about DOCUAGENT AI's capabilities, review workflows, and governance.
          </p>
        </div>

        <div className="space-y-3" role="region" aria-label="FAQ Accordion">
          {faqs.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div
                key={faq.question}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1120] overflow-hidden shadow-xs transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  aria-expanded={isOpen}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left gap-4 cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                      isOpen ? 'rotate-180 text-cyan-600 dark:text-cyan-400' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/80">
                    <p className="pt-3">{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. Final Call to Action */}
      <section
        aria-labelledby="cta-heading"
        className="rounded-3xl border border-cyan-300 dark:border-cyan-800/80 bg-gradient-to-r from-cyan-900/20 via-[#0B1120] to-cyan-950/30 p-8 sm:p-12 text-center space-y-5 shadow-xl"
      >
        <h2 id="cta-heading" className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          Ready to Streamline Your Document Intake Workflow?
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
          Explore automated document classification, deterministic rule validation, reviewer queues, and verifiable audit reports with DOCUAGENT AI.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onOpenWorkspace('upload')}
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <span>Start Ingesting Documents</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onOpenWorkspace('dashboard')}
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm transition-all cursor-pointer"
          >
            <span>View Reviewer Dashboard</span>
          </button>
        </div>
      </section>
    </div>
  );
};
