/**
 * Subscription Plans, Feature Entitlements & Pricing Configuration (INR)
 * DOCUAGENT AI SaaS Platform
 */

export type PlanId = 'free' | 'starter' | 'professional' | 'business' | 'enterprise';

export type FeatureKey =
  | 'basic_upload'
  | 'basic_extraction'
  | 'basic_validation'
  | 'basic_queue'
  | 'basic_audit'
  | 'basic_dashboard'
  | 'bulk_upload'
  | 'advanced_export'
  | 'custom_schemas_2'
  | 'auto_routing'
  | 'extended_audit'
  | 'ai_extraction'
  | 'line_item_extraction'
  | 'custom_schemas_10'
  | 'duplicate_detection'
  | 'advanced_validation'
  | 'advanced_analytics'
  | 'advanced_reviewer'
  | 'excel_export'
  | 'api_webhooks'
  | 'team_collaboration'
  | 'advanced_team_management'
  | 'workflow_automation'
  | 'custom_routing_rules'
  | 'advanced_audit_reporting'
  | 'business_integrations'
  | 'priority_support'
  | 'enterprise_volumes'
  | 'sso'
  | 'dedicated_sla';

export interface PlanConfig {
  id: PlanId;
  name: string;
  tagline: string;
  priceInrMonthly: number;
  documentAllowanceMonthly: number;
  userAllowance: number;
  features: string[];
  entitlements: FeatureKey[];
  isPopular?: boolean;
  badge?: string;
  ctaText: string;
  ctaAction: 'start_free' | 'upgrade' | 'contact_sales';
}

export const DEFAULT_PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free Plan',
    tagline: 'Ideal for solo specialists evaluating automated document review',
    priceInrMonthly: 0,
    documentAllowanceMonthly: 10,
    userAllowance: 1,
    features: [
      '10 documents per month',
      '1 active user',
      'Basic document upload (PDF, PNG, JPG)',
      'Basic invoice & ID data extraction',
      'Basic schema validation rules',
      'Document review queue',
      'Basic audit history',
      'Basic operational dashboard'
    ],
    entitlements: [
      'basic_upload',
      'basic_extraction',
      'basic_validation',
      'basic_queue',
      'basic_audit',
      'basic_dashboard'
    ],
    ctaText: 'Start Free',
    ctaAction: 'start_free'
  },
  starter: {
    id: 'starter',
    name: 'Starter Plan',
    tagline: 'For independent practitioners and small intake offices',
    priceInrMonthly: 499,
    documentAllowanceMonthly: 50,
    userAllowance: 1,
    features: [
      'Everything in Free',
      '50 documents per month',
      '1 active user',
      'Bulk document uploads',
      'Advanced document export',
      '2 custom extraction schemas',
      'Basic automatic document routing',
      'Extended audit history'
    ],
    entitlements: [
      'basic_upload',
      'basic_extraction',
      'basic_validation',
      'basic_queue',
      'basic_audit',
      'basic_dashboard',
      'bulk_upload',
      'advanced_export',
      'custom_schemas_2',
      'auto_routing',
      'extended_audit'
    ],
    badge: 'Starter',
    ctaText: 'Upgrade Now',
    ctaAction: 'upgrade'
  },
  professional: {
    id: 'professional',
    name: 'Professional Plan',
    tagline: 'For growing compliance, accounting, and review teams',
    priceInrMonthly: 1499,
    documentAllowanceMonthly: 250,
    userAllowance: 3,
    isPopular: true,
    features: [
      'Everything in Starter',
      '250 documents per month',
      '3 team members',
      'Advanced multimodal AI extraction',
      'Invoice line-item extraction',
      '10 custom schemas',
      'Duplicate invoice detection',
      'Advanced validation rules',
      'Advanced analytics & SLA tracking',
      'Advanced reviewer workflows',
      'Excel & PDF audit exports',
      'API & webhook access',
      'Team collaboration'
    ],
    entitlements: [
      'basic_upload',
      'basic_extraction',
      'basic_validation',
      'basic_queue',
      'basic_audit',
      'basic_dashboard',
      'bulk_upload',
      'advanced_export',
      'custom_schemas_2',
      'auto_routing',
      'extended_audit',
      'ai_extraction',
      'line_item_extraction',
      'custom_schemas_10',
      'duplicate_detection',
      'advanced_validation',
      'advanced_analytics',
      'advanced_reviewer',
      'excel_export',
      'api_webhooks',
      'team_collaboration'
    ],
    badge: 'Most Popular',
    ctaText: 'Upgrade Now',
    ctaAction: 'upgrade'
  },
  business: {
    id: 'business',
    name: 'Business Plan',
    tagline: 'For high-throughput organizations with automated pipelines',
    priceInrMonthly: 3999,
    documentAllowanceMonthly: 1000,
    userAllowance: 10,
    features: [
      'Everything in Professional',
      '1,000 documents per month',
      '10 team members',
      'Advanced team & role management',
      'Configurable workflow automation',
      'Custom routing rules & priority queues',
      'Advanced audit reporting',
      'Business ERP & CRM integrations',
      'Priority email & chat support'
    ],
    entitlements: [
      'basic_upload',
      'basic_extraction',
      'basic_validation',
      'basic_queue',
      'basic_audit',
      'basic_dashboard',
      'bulk_upload',
      'advanced_export',
      'custom_schemas_2',
      'auto_routing',
      'extended_audit',
      'ai_extraction',
      'line_item_extraction',
      'custom_schemas_10',
      'duplicate_detection',
      'advanced_validation',
      'advanced_analytics',
      'advanced_reviewer',
      'excel_export',
      'api_webhooks',
      'team_collaboration',
      'advanced_team_management',
      'workflow_automation',
      'custom_routing_rules',
      'advanced_audit_reporting',
      'business_integrations',
      'priority_support'
    ],
    badge: 'Scale',
    ctaText: 'Upgrade Now',
    ctaAction: 'upgrade'
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Tailored compliance infrastructure with enterprise guarantees',
    priceInrMonthly: 0, // Custom pricing
    documentAllowanceMonthly: 10000, // Custom configurable
    userAllowance: 100,
    features: [
      'Everything in Business',
      'Custom document processing volumes',
      'Custom ERP/SAP/Oracle integrations',
      'Enterprise Single Sign-On (SAML/Okta/Azure AD)',
      'Advanced data residency & access policies',
      'Dedicated compliance manager & 99.9% SLA',
      'Custom on-premise or VPC deployment options'
    ],
    entitlements: [
      'basic_upload',
      'basic_extraction',
      'basic_validation',
      'basic_queue',
      'basic_audit',
      'basic_dashboard',
      'bulk_upload',
      'advanced_export',
      'custom_schemas_2',
      'auto_routing',
      'extended_audit',
      'ai_extraction',
      'line_item_extraction',
      'custom_schemas_10',
      'duplicate_detection',
      'advanced_validation',
      'advanced_analytics',
      'advanced_reviewer',
      'excel_export',
      'api_webhooks',
      'team_collaboration',
      'advanced_team_management',
      'workflow_automation',
      'custom_routing_rules',
      'advanced_audit_reporting',
      'business_integrations',
      'priority_support',
      'enterprise_volumes',
      'sso',
      'dedicated_sla'
    ],
    badge: 'Enterprise',
    ctaText: 'Contact Sales',
    ctaAction: 'contact_sales'
  }
};

export interface SubscriptionRecord {
  subscription_id: string;
  user_id: string;
  tenant_id: string;
  plan_id: PlanId;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  billing_interval: 'monthly';
  current_period_start: string;
  current_period_end: string;
  auto_renew: boolean;
  cancelled_at?: string;
  last_order_id?: string;
  last_payment_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransactionRecord {
  transaction_id: string;
  order_id: string;
  payment_id: string;
  user_id: string;
  user_email: string;
  tenant_id: string;
  plan_id: PlanId;
  amount_paisa: number;
  amount_inr: number;
  currency: 'INR';
  status: 'succeeded' | 'failed' | 'refunded';
  payment_method?: string;
  razorpay_signature?: string;
  error_code?: string;
  error_description?: string;
  created_at: string;
  verified_at?: string;
  receipt_number: string;
}

export interface MonthlyUsageRecord {
  user_id: string;
  tenant_id: string;
  cycle_month: string; // YYYY-MM
  documents_uploaded: number;
  pages_processed: number;
  successful_jobs: number;
  failed_jobs: number;
  premium_features_used: Record<string, number>;
  document_allowance: number;
  remaining_allowance: number;
  last_processed_at?: string;
}

export interface BillingOverviewStats {
  totalUsers: number;
  freeUsers: number;
  starterUsers: number;
  professionalUsers: number;
  businessUsers: number;
  enterpriseUsers: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  cancelledSubscriptions: number;
  paymentFailures: number;
  totalVerifiedRevenueInr: number;
  revenueByPlanInr: Record<PlanId, number>;
}

export function formatInrCurrency(amount: number): string {
  if (amount === 0) return '₹0';
  return '₹' + amount.toLocaleString('en-IN');
}
