/**
 * AI Document Review & Routing Agent - Shared Types
 * DOCUAGENT AI Document Intelligence Platform
 */

export type DocumentType =
  | 'passport'
  | 'national_id'
  | 'utility_bill'
  | 'bank_statement'
  | 'employment_verification'
  | 'invoice'
  | 'general_doc'
  | 'unknown';

export type CaseStatus =
  | 'Processing'
  | 'Ready for Review'
  | 'Needs More Information'
  | 'Priority Review'
  | 'Review Completed'
  | 'Processing Failed';

export type ReviewerQueue =
  | 'General Review'
  | 'Missing Information'
  | 'Priority Review';

export type FindingCategory =
  | 'missing_information'
  | 'format_error'
  | 'inconsistency';

export type FindingSeverity = 'low' | 'medium' | 'high';

export type FindingResult = 'passed' | 'warning' | 'failed';

export interface ExtractedField {
  field_id: string;
  case_id: string;
  field_name: string;
  field_label: string;
  field_value: string;
  confidence: number; // 0 to 1
  is_uncertain: boolean;
  reviewed_value?: string;
  is_edited: boolean;
  source_page?: number;
}

export interface ValidationFinding {
  finding_id: string;
  case_id: string;
  check_name: string;
  category: FindingCategory;
  result: FindingResult;
  severity: FindingSeverity;
  explanation: string;
  evidence_reference?: string;
  resolved: boolean;
  resolution_notes?: string;
}

export interface ReviewAction {
  action_id: string;
  case_id: string;
  reviewer_label: string;
  action:
    | 'approve_ready'
    | 'request_info'
    | 'escalate_priority'
    | 'correct_field'
    | 'resolve_finding'
    | 'mark_complete';
  notes: string;
  created_at: string;
}

export interface AuditEvent {
  event_id: string;
  case_id: string;
  event_type:
    | 'CASE_CREATED'
    | 'TEXT_EXTRACTED'
    | 'OCR_EXTRACTION_FAILED'
    | 'FIELDS_EXTRACTED'
    | 'SCHEMA_EXTRACTION_FAILED'
    | 'VALIDATION_RUN'
    | 'ROUTING_DECIDED'
    | 'REPORT_GENERATED'
    | 'FIELD_CORRECTED'
    | 'FINDING_RESOLVED'
    | 'QUEUE_TRANSFERRED'
    | 'REVIEW_COMPLETED'
    | 'AGENT_RE_EVALUATED'
    | 'DOCUMENT_TYPE_DETECTED';
  actor: 'AI Agent' | 'Human Reviewer' | 'System';
  summary: string;
  details?: string;
  created_at: string;
}

export interface AgentStepTrace {
  step_number: number;
  tool_name: string;
  tool_purpose: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  duration_ms: number;
  output_summary: string;
}

export interface CaseRecord {
  case_id: string;
  case_number: string;
  version?: number; // Monotonically increasing version counter for optimistic concurrency control
  document_type: DocumentType;
  file_name: string;
  file_size_kb: number;
  file_mime: string;
  file_data_url?: string; // synthetic document preview or uploaded data URL
  raw_text?: string;
  cross_reference_file_name?: string;
  cross_reference_text?: string;
  is_selectable_pdf?: boolean;
  extraction_method?: string;
  classification_reason?: string;
  detected_document_type?: DocumentType;
  created_at: string;
  updated_at: string;
  status: CaseStatus;
  assigned_queue: ReviewerQueue;
  assigned_reviewer?: string;
  routing_reason: string;
  executive_summary?: string;
  processing_error?: string;
  extracted_fields: ExtractedField[];
  validation_findings: ValidationFinding[];
  review_actions: ReviewAction[];
  audit_events: AuditEvent[];
  agent_trace: AgentStepTrace[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface SyntheticSampleScenario {
  id: string;
  title: string;
  description: string;
  document_type: DocumentType;
  file_name: string;
  expected_status: CaseStatus;
  expected_queue: ReviewerQueue;
  badge: string;
  badge_color: string;
  mock_text: string;
  mock_fields: Record<string, { value: string; confidence: number }>;
  cross_reference_file?: string;
  cross_reference_text?: string;
  is_unreadable?: boolean;
}
