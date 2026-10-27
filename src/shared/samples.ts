/**
 * Synthetic Sample Scenarios for DOCUAGENT AI
 * AI Document Review & Routing Agent
 */

import { SyntheticSampleScenario } from './types.ts';

export const SYNTHETIC_SCENARIOS: SyntheticSampleScenario[] = [
  {
    id: 'sample-clean-passport',
    title: 'Standard Passport (Alex Rivera)',
    description: 'Pristine passport scan with all required fields present, unexpired date, and valid alphanumeric identifier.',
    document_type: 'passport',
    file_name: 'synthetic_passport_alex_rivera.pdf',
    expected_status: 'Ready for Review',
    expected_queue: 'General Review',
    badge: 'Clean Submission',
    badge_color: 'emerald',
    mock_text: `PASSPORT / PASSEPORT / PASAPORTE
Type: P  Code of Issuing State: USA  Passport No: P928174028
Surname: RIVERA
Given Names: ALEX JULIAN
Nationality: UNITED STATES OF AMERICA
Date of birth: 15 JUN 1992
Sex: M  Place of birth: CALIFORNIA, U.S.A.
Date of issue: 20 AUG 2021
Date of expiration: 19 AUG 2031
Authority: United States Department of State
P<USARIVERA<<ALEX<JULIAN<<<<<<<<<<<<<<<<<<<<<
P9281740284USA9206155M3108198<<<<<<<<<<<<<<04`,
    mock_fields: {
      full_name: { value: 'Alex Julian Rivera', confidence: 0.98 },
      passport_number: { value: 'P928174028', confidence: 0.99 },
      nationality: { value: 'United States of America', confidence: 0.97 },
      date_of_birth: { value: '1992-06-15', confidence: 0.96 },
      expiration_date: { value: '2031-08-19', confidence: 0.98 },
      issuing_authority: { value: 'US Department of State', confidence: 0.94 }
    }
  },
  {
    id: 'sample-missing-fields-bill',
    title: 'Utility Bill (Missing Account No. & Low Confidence)',
    description: 'Electric utility bill where account number field was blurred/omitted and service address had OCR smudge.',
    document_type: 'utility_bill',
    file_name: 'synthetic_utility_bill_smudged.pdf',
    expected_status: 'Needs More Information',
    expected_queue: 'Missing Information',
    badge: 'Missing Info & Low OCR',
    badge_color: 'amber',
    mock_text: `PACIFIC POWER & LIGHT - MONTHLY RESIDENTIAL STATEMENT
Customer Name: Taylor Morgan
Service Address: 482 Elmwood Ave, Apt ??B, Seattle, WA
Provider: Pacific Power & Light
Account Number: [UNREADABLE / OMITTED]
Statement Date: 2026-09-12
Billing Period: 08/10/2026 - 09/10/2026
Total Balance Due: $142.85`,
    mock_fields: {
      account_holder_name: { value: 'Taylor Morgan', confidence: 0.92 },
      service_address: { value: '482 Elmwood Ave, Apt ??B, Seattle, WA', confidence: 0.58 }, // uncertain
      utility_provider: { value: 'Pacific Power & Light', confidence: 0.95 },
      account_number: { value: '', confidence: 0.1 }, // missing
      statement_date: { value: '2026-09-12', confidence: 0.91 },
      amount_due: { value: '$142.85', confidence: 0.93 }
    }
  },
  {
    id: 'sample-cross-conflict',
    title: 'Cross-Document Conflict (ID vs Proof of Address)',
    description: 'Submitted National ID under "Jordan Smith" paired with a secondary Utility Bill issued to an unrelated individual.',
    document_type: 'national_id',
    file_name: 'synthetic_id_jordan_smith.pdf',
    expected_status: 'Priority Review',
    expected_queue: 'Priority Review',
    badge: 'Identity Conflict',
    badge_color: 'rose',
    mock_text: `STATE OF OREGON - DRIVER LICENSE
DL NO: OR8829410A
NAME: JORDAN TAYLOR SMITH
DOB: 1989-11-20
EXP: 2029-11-20
ADDRESS: 1204 PINE CREST RD, PORTLAND OR 97201
CLASS: C  RESTRICTIONS: NONE`,
    mock_fields: {
      full_name: { value: 'Jordan Taylor Smith', confidence: 0.97 },
      id_number: { value: 'OR8829410A', confidence: 0.98 },
      date_of_birth: { value: '1989-11-20', confidence: 0.96 },
      expiration_date: { value: '2029-11-20', confidence: 0.98 },
      address: { value: '1204 Pine Crest Rd, Portland OR 97201', confidence: 0.94 }
    },
    cross_reference_file: 'secondary_gas_bill_vance.pdf',
    cross_reference_text: `NORTHWEST NATURAL GAS - BILLING STATEMENT
Customer: MARCUS G. VANCE
Service Address: 8990 HIGHLAND PARKWAY, PORTLAND OR
Account: #9921-4820-11
Statement Date: 2026-09-18
Amount: $84.20`
  },
  {
    id: 'sample-expired-id',
    title: 'Expired Driver License (Elena Rostova)',
    description: 'Driver license with clearly expired validity date (expired March 2024 vs current year 2026).',
    document_type: 'national_id',
    file_name: 'synthetic_dl_elena_expired.png',
    expected_status: 'Priority Review',
    expected_queue: 'Priority Review',
    badge: 'Expired Document',
    badge_color: 'rose',
    mock_text: `COMMONWEALTH OF MASSACHUSETTS - DRIVER LICENSE
LIC NO: S99104829
NAME: ELENA ROSTOVA
DOB: 1984-04-12
ISSUE DATE: 2019-03-15
EXPIRATION DATE: 2024-03-15
ADDRESS: 15 CAMBRIDGE PARKWAY, CAMBRIDGE MA
STATUS: EXPIRED UPON RECORD`,
    mock_fields: {
      full_name: { value: 'Elena Rostova', confidence: 0.98 },
      id_number: { value: 'S99104829', confidence: 0.98 },
      date_of_birth: { value: '1984-04-12', confidence: 0.97 },
      expiration_date: { value: '2024-03-15', confidence: 0.98 }, // Expired!
      address: { value: '15 Cambridge Parkway, Cambridge MA', confidence: 0.95 }
    }
  },
  {
    id: 'sample-unreadable-scan',
    title: 'Degraded / Unreadable Bank Statement',
    description: 'Photocopied document with severe compression artifacts, resolution < 72 DPI, and unresolvable glyphs.',
    document_type: 'bank_statement',
    file_name: 'synthetic_scan_severely_degraded.jpg',
    expected_status: 'Processing Failed',
    expected_queue: 'General Review',
    badge: 'Unreadable Quality',
    badge_color: 'slate',
    is_unreadable: true,
    mock_text: `[CORRUPTED OCR GLYPH MATRIX: 0x88 0xEF ... %%% ### @@ ??? ... UNABLE TO EXTRACT TEXT STREAM]`,
    mock_fields: {}
  },
  {
    id: 'sample-selectable-pdf',
    title: 'Selectable-Text PDF (Digital Bank Statement)',
    description: 'Digital vector PDF containing clean selectable text stream parsed without raster OCR.',
    document_type: 'bank_statement',
    file_name: 'digital_statement_morgan_sterling.pdf',
    expected_status: 'Ready for Review',
    expected_queue: 'General Review',
    badge: 'Selectable PDF',
    badge_color: 'cyan',
    mock_text: `FIRST NATIONAL HORIZON BANK - MONTHLY CHECKING STATEMENT
Account Holder: Morgan Avery Sterling
Account Number: 8821940129
Financial Institution: First National Horizon Bank NA
Statement Period: 2026-09-01 to 2026-09-30
Beginning Balance: $8,420.00
Ending Balance: $14,890.50
Total Deposits: $7,200.00   Total Withdrawals: $729.50`,
    mock_fields: {
      account_holder_name: { value: 'Morgan Avery Sterling', confidence: 0.99 },
      financial_institution: { value: 'First National Horizon Bank NA', confidence: 0.98 },
      account_number: { value: '8821940129', confidence: 0.99 },
      statement_period: { value: '2026-09-15', confidence: 0.96 },
      ending_balance: { value: '$14,890.50', confidence: 0.97 }
    }
  },
  {
    id: 'sample-general-doc',
    title: 'General Document (Master Services Agreement PDF)',
    description: 'Standard enterprise agreement PDF classified accurately as General Document without identity schema enforcement.',
    document_type: 'general_doc',
    file_name: 'master_services_agreement_2026.pdf',
    expected_status: 'Ready for Review',
    expected_queue: 'General Review',
    badge: 'General Document',
    badge_color: 'indigo',
    mock_text: `ENTERPRISE SOFTWARE LICENSE AND MASTER SERVICES AGREEMENT
Document Title: Master Services Agreement (MSA)
Document Date: 2026-06-15
Author / Organization: Apex Cloud Systems Technologies Inc.
Topic / Scope: Enterprise cloud infrastructure hosting and support terms
Section 1. Grant of License and Operational Parameters
This agreement outlines standard enterprise terms for SaaS deployment.
Governing Law: State of Delaware. All terms binding upon signature.`,
    mock_fields: {
      document_title: { value: 'Master Services Agreement (MSA)', confidence: 0.95 },
      document_date: { value: '2026-06-15', confidence: 0.92 },
      author_or_organization: { value: 'Apex Cloud Systems Technologies Inc.', confidence: 0.94 },
      summary_topic: { value: 'Enterprise cloud infrastructure hosting and support terms', confidence: 0.90 }
    }
  },
  {
    id: 'sample-image-doc',
    title: 'Image Document (Driver License PNG)',
    description: 'Standalone PNG raster image processed via optical character recognition.',
    document_type: 'national_id',
    file_name: 'synthetic_dl_elena_specimen.png',
    expected_status: 'Priority Review',
    expected_queue: 'Priority Review',
    badge: 'Image (PNG/OCR)',
    badge_color: 'indigo',
    mock_text: `MASSACHUSETTS DRIVER LICENSE
LIC NO: S99104829
NAME: ELENA ROSTOVA
DOB: 1984-04-12
ADDRESS: 15 CAMBRIDGE PARKWAY, CAMBRIDGE MA
EXPIRATION DATE: 2024-03-15`,
    mock_fields: {
      full_name: { value: 'Elena Rostova', confidence: 0.97 },
      id_number: { value: 'S99104829', confidence: 0.98 },
      date_of_birth: { value: '1984-04-12', confidence: 0.96 },
      expiration_date: { value: '2024-03-15', confidence: 0.98 },
      address: { value: '15 Cambridge Parkway, Cambridge MA', confidence: 0.94 }
    }
  },
  {
    id: 'sample-scanned-pdf',
    title: 'Scanned PDF (Utility Statement Raster)',
    description: 'Scanned PDF with zero selectable text tokens, routed through scanned document OCR.',
    document_type: 'utility_bill',
    file_name: 'scanned_utility_bill_seattle.pdf',
    expected_status: 'Needs More Information',
    expected_queue: 'Missing Information',
    badge: 'Scanned PDF / OCR',
    badge_color: 'amber',
    mock_text: `SEATTLE CITY LIGHT - RESIDENTIAL STATEMENT
Customer: Jordan Smith
Service Address: 1420 5th Ave, Seattle, WA
Provider: Seattle City Light
Statement Date: 2026-08-20
Amount Due: $94.20`,
    mock_fields: {
      account_holder_name: { value: 'Jordan Smith', confidence: 0.90 },
      service_address: { value: '1420 5th Ave, Seattle, WA', confidence: 0.88 },
      utility_provider: { value: 'Seattle City Light', confidence: 0.94 },
      account_number: { value: '', confidence: 0.0 }, // missing
      statement_date: { value: '2026-08-20', confidence: 0.89 },
      amount_due: { value: '$94.20', confidence: 0.91 }
    }
  }
];
