import { useEffect } from 'react';

export interface PageMetadataConfig {
  title: string;
  description: string;
  canonicalPath?: string;
}

export const PAGE_METADATA: Record<string, PageMetadataConfig> = {
  home: {
    title: 'AI Document Review & Screening | DOCUAGENT AI',
    description:
      'Review and route documents with DOCUAGENT AI. Organize identity and document screening, human review queues, and auditable decisions in one workflow.',
    canonicalPath: '/'
  },
  dashboard: {
    title: 'Dashboard | DOCUAGENT AI',
    description:
      'Review, validate, and route documents with DOCUAGENT AI. Extract document information, identify validation issues, and manage document review workflows.',
    canonicalPath: '/?tab=dashboard'
  },
  upload: {
    title: 'Document Upload | DOCUAGENT AI',
    description:
      'Upload identity credentials, financial statements, and business agreements for automated extraction, OCR parsing, deterministic checks, and routing.',
    canonicalPath: '/?tab=upload'
  },
  queues: {
    title: 'Reviewer Queues | DOCUAGENT AI',
    description:
      'Triage and review documents routed to General Review, Missing Information, and Priority Review queues with human-in-the-loop controls.',
    canonicalPath: '/?tab=queues'
  },
  reports: {
    title: 'Screening and Audit | DOCUAGENT AI',
    description:
      'Access immutable audit trails, verification summaries, event logs, and operational screening reports for enterprise document intake.',
    canonicalPath: '/?tab=reports'
  },
  caseDetail: {
    title: 'Document Case Review | DOCUAGENT AI',
    description:
      'Inspect extracted document fields, evaluate deterministic rule validation findings, and execute human-in-the-loop reviewer sign-off.',
    canonicalPath: '/?case=detail'
  },
  privacy: {
    title: 'Privacy Policy | DOCUAGENT AI',
    description:
      'Learn how DOCUAGENT AI handles personal data, data minimization, 90-day retention lifecycles, and data subject rights under DPDP and GDPR.',
    canonicalPath: '/?page=privacy'
  },
  cookies: {
    title: 'Cookie Policy | DOCUAGENT AI',
    description:
      'Review technical storage disclosures, strictly necessary session cookies, client-side preferences, and consent controls in DOCUAGENT AI.',
    canonicalPath: '/?page=cookies'
  },
  terms: {
    title: 'Terms of Service | DOCUAGENT AI',
    description:
      'Read the terms and conditions governing the use of DOCUAGENT AI document intake, verification decision support, and reviewer triage.',
    canonicalPath: '/?page=terms'
  },
  dataCollection: {
    title: 'Data Collection and Privacy | DOCUAGENT AI',
    description:
      'Comprehensive inventory of 10 data categories collected, AES-256-GCM encryption, 90-day retention policies, and privacy rights in DOCUAGENT AI.',
    canonicalPath: '/?page=data-collection'
  },
  legalChecklist: {
    title: 'Pre-Launch Legal Checklist | DOCUAGENT AI',
    description:
      'Pre-launch verification audit of data collection practices, DOCUAGENT AI trademark protection, and 20-section Terms of Use.',
    canonicalPath: '/?page=legal-checklist'
  },
  dpdp: {
    title: 'DPDP Act Readiness | DOCUAGENT AI',
    description:
      'Technical readiness assessment, data principal rights, grievance redressal, and compliance framework for India’s Digital Personal Data Protection Act.',
    canonicalPath: '/?page=dpdp'
  },
  pricing: {
    title: 'Subscription Plans & Pricing | DOCUAGENT AI',
    description:
      'Predictable monthly subscription plans in Indian Rupees (INR) for automated document review, AI extraction, and compliance workflows.',
    canonicalPath: '/?page=pricing'
  },
  billing: {
    title: 'Billing & Subscriptions | DOCUAGENT AI',
    description:
      'Manage your DOCUAGENT AI plan tier, document usage allowances, Razorpay payment receipts, and GST invoices.',
    canonicalPath: '/?page=billing'
  },
  adminBilling: {
    title: 'Admin Billing & Revenue Console | DOCUAGENT AI',
    description:
      'Administrator dashboard for subscriber counts, verified INR revenue, and dynamic server quota configuration.',
    canonicalPath: '/?page=admin-billing'
  },
  notFound: {
    title: 'Page Not Found | DOCUAGENT AI',
    description:
      'The requested page or document workflow route could not be found. Return to the DOCUAGENT AI dashboard to manage active document intake.',
    canonicalPath: '/404'
  }
};

export function updatePageMetadata(config: PageMetadataConfig) {
  // Update browser document title
  document.title = config.title;

  // Helper to set or create meta tag
  const setMeta = (attrName: 'name' | 'property', attrVal: string, content: string) => {
    let el = document.head.querySelector(`meta[${attrName}="${attrVal}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrVal);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  // Primary Meta Description
  setMeta('name', 'description', config.description);
  setMeta('name', 'robots', 'index, follow');

  // OpenGraph Tags
  setMeta('property', 'og:title', config.title);
  setMeta('property', 'og:description', config.description);
  setMeta('property', 'og:site_name', 'DOCUAGENT AI');

  // Twitter Tags
  setMeta('name', 'twitter:title', config.title);
  setMeta('name', 'twitter:description', config.description);

  // Canonical Link
  const canonicalUrl =
    config.canonicalPath === '/' || !config.canonicalPath
      ? 'https://docuagent-ai.ai.studio/'
      : `https://docuagent-ai.ai.studio${config.canonicalPath.startsWith('/') ? config.canonicalPath : `/${config.canonicalPath}`}`;

  setMeta('property', 'og:url', canonicalUrl);

  let linkCanonical = document.head.querySelector('link[rel="canonical"]');
  if (!linkCanonical) {
    linkCanonical = document.createElement('link');
    linkCanonical.setAttribute('rel', 'canonical');
    document.head.appendChild(linkCanonical);
  }
  linkCanonical.setAttribute('href', canonicalUrl);
}

export function usePageMetadata(config: PageMetadataConfig) {
  useEffect(() => {
    updatePageMetadata(config);
  }, [config.title, config.description, config.canonicalPath]);
}
