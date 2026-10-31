/**
 * Centralized Feature Entitlement & Subscription Gatekeeper
 * DOCUAGENT AI SaaS Platform
 *
 * Enforces:
 * - Active plan lookup & subscription expiration check
 * - Granular feature entitlements per plan tier
 * - Document processing quotas per monthly billing cycle
 * - Structured HTTP 403 (PREMIUM_FEATURE_LOCKED) and HTTP 429 (QUOTA_EXCEEDED) responses
 */

import type { Request, Response, NextFunction } from 'express';
import { billingStore } from './billingStore.ts';
import { type FeatureKey, type PlanId, type PlanConfig } from '../src/shared/plans.ts';
import { sendError, AppError } from './errors.ts';

export interface UserEntitlementStatus {
  userId: string;
  planId: PlanId;
  plan: PlanConfig;
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  currentPeriodEnd: string;
  documentAllowance: number;
  documentsUsed: number;
  remainingAllowance: number;
  isQuotaExhausted: boolean;
  entitlements: FeatureKey[];
}

export function getUserEntitlementStatus(userId: string, tenantId?: string): UserEntitlementStatus {
  const subscription = billingStore.getSubscription(userId, tenantId);
  const isExpired = subscription.status === 'expired';
  // If subscription is expired or cancelled past end date, effective features fall back to free plan
  const effectivePlanId: PlanId = (subscription.status === 'active') ? subscription.plan_id : 'free';
  const plan = billingStore.getPlan(effectivePlanId);
  const usage = billingStore.getUsage(userId, tenantId);

  return {
    userId,
    planId: effectivePlanId,
    plan,
    status: subscription.status,
    currentPeriodEnd: subscription.current_period_end,
    documentAllowance: usage.document_allowance,
    documentsUsed: usage.documents_uploaded,
    remainingAllowance: usage.remaining_allowance,
    isQuotaExhausted: usage.documents_uploaded >= usage.document_allowance,
    entitlements: plan.entitlements
  };
}

export function checkFeatureEntitlement(userId: string, featureKey: FeatureKey, tenantId?: string): {
  allowed: boolean;
  currentPlan: PlanId;
  requiredPlan: PlanId;
  featureKey: FeatureKey;
} {
  const status = getUserEntitlementStatus(userId, tenantId);
  const isEntitled = status.entitlements.includes(featureKey);

  // Determine minimum required plan for this feature
  const plans = billingStore.getPlans();
  let requiredPlan: PlanId = 'free';
  if (plans.free.entitlements.includes(featureKey)) requiredPlan = 'free';
  else if (plans.starter.entitlements.includes(featureKey)) requiredPlan = 'starter';
  else if (plans.professional.entitlements.includes(featureKey)) requiredPlan = 'professional';
  else if (plans.business.entitlements.includes(featureKey)) requiredPlan = 'business';
  else if (plans.enterprise.entitlements.includes(featureKey)) requiredPlan = 'enterprise';

  return {
    allowed: isEntitled,
    currentPlan: status.planId,
    requiredPlan,
    featureKey
  };
}

/**
 * Express middleware to enforce a specific feature entitlement.
 * Blocks access with HTTP 403 and descriptive payload if the user's active plan does not include it.
 */
export function requireFeature(featureKey: FeatureKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const userId = user?.userId || 'guest_user';
    const tenantId = user?.tenantId;

    const check = checkFeatureEntitlement(userId, featureKey, tenantId);
    if (!check.allowed) {
      const planConfig = billingStore.getPlan(check.requiredPlan);
      return res.status(403).json({
        error: `Feature "${featureKey.replace(/_/g, ' ')}" is locked on your current plan (${check.currentPlan.toUpperCase()}).`,
        code: 'PREMIUM_FEATURE_LOCKED',
        featureKey,
        currentPlan: check.currentPlan,
        requiredPlan: check.requiredPlan,
        requiredPlanName: planConfig.name,
        priceInr: planConfig.priceInrMonthly,
        upgradeUrl: '/pricing'
      });
    }

    next();
  };
}

/**
 * Express middleware to check document processing quota before allowing intake.
 */
export function checkQuota() {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const userId = user?.userId || 'guest_user';
    const tenantId = user?.tenantId;

    const quota = billingStore.canProcessDocument(userId, tenantId);
    if (!quota.allowed) {
      const sub = billingStore.getSubscription(userId, tenantId);
      return res.status(429).json({
        error: quota.reason || 'Monthly document quota limit reached.',
        code: 'QUOTA_EXCEEDED',
        documentsUsed: quota.used,
        documentAllowance: quota.allowance,
        remainingAllowance: 0,
        planId: sub.plan_id,
        upgradeUrl: '/pricing'
      });
    }

    // Attach quota info to request
    (req as any).quotaInfo = quota;
    next();
  };
}
