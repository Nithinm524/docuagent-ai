/**
 * Premium Feature Locked & Quota Exceeded Upgrade Modal
 * DOCUAGENT AI SaaS Platform
 */

import React, { useState } from 'react';
import {
  Lock,
  Sparkles,
  ArrowRight,
  Check,
  X,
  CreditCard,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import {
  DEFAULT_PLANS,
  type PlanId,
  formatInrCurrency
} from '../shared/plans.ts';
import { authFetch } from '../utils/authFetch.ts';
import { openRazorpayCheckout } from '../utils/razorpay.ts';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  featureName?: string;
  explanation?: string;
  recommendedPlanId?: PlanId;
  onOpenPricing: () => void;
  userEmail?: string;
  userName?: string;
  onUpgradeSuccess?: (planId: PlanId) => void;
  isQuotaExceeded?: boolean;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  title,
  featureName = 'Multimodal AI Extraction',
  explanation,
  recommendedPlanId = 'professional',
  onOpenPricing,
  userEmail,
  userName,
  onUpgradeSuccess,
  isQuotaExceeded = false
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const targetPlan = DEFAULT_PLANS[recommendedPlanId] || DEFAULT_PLANS.professional;

  const handleQuickUpgrade = async () => {
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      // 1. Create trusted order on server
      const orderRes = await authFetch('/api/billing/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: targetPlan.id })
      });

      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to initialize payment order.');
      }

      const orderData = await orderRes.json();

      // 2. Open Razorpay Checkout
      await openRazorpayCheckout({
        orderId: orderData.orderId,
        amountPaisa: orderData.amountPaisa,
        amountInr: orderData.amountInr,
        keyId: orderData.keyId,
        planId: targetPlan.id,
        planName: targetPlan.name,
        userName: userName || 'Valued Specialist',
        userEmail: userEmail || 'user@docuagent.local',
        isTestMode: orderData.isTestMode,
        onSuccess: async (paymentData) => {
          try {
            // 3. Cryptographic signature verification
            const verifyRes = await authFetch('/api/billing/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: paymentData.razorpay_order_id,
                razorpay_payment_id: paymentData.razorpay_payment_id,
                razorpay_signature: paymentData.razorpay_signature,
                plan_id: targetPlan.id
              })
            });

            if (!verifyRes.ok) {
              const vErr = await verifyRes.json().catch(() => ({}));
              throw new Error(vErr.error || 'Payment signature verification failed.');
            }

            if (onUpgradeSuccess) {
              onUpgradeSuccess(targetPlan.id);
            }
            onClose();
          } catch (vErr: any) {
            setErrorMsg(vErr.message || 'Payment signature verification failed.');
          } finally {
            setIsProcessing(false);
          }
        },
        onFailure: (err) => {
          setIsProcessing(false);
          setErrorMsg(err.description || 'Payment was not completed.');
        },
        onDismiss: () => {
          setIsProcessing(false);
        }
      });
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMsg(err.message || 'Unable to start checkout.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative corner glow */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-48 h-48 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              isQuotaExceeded
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
            }`}
          >
            {isQuotaExceeded ? <AlertTriangle className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isQuotaExceeded ? 'Monthly Quota Exhausted' : 'Premium Feature Locked'}</span>
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {title || (isQuotaExceeded ? 'Document Intake Limit Reached' : `Unlock ${featureName}`)}
            </h3>
          </div>
        </div>

        {/* Explanation */}
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
          {explanation ||
            (isQuotaExceeded
              ? 'You have reached your 10 documents allowance for this monthly cycle on the Free Plan. Upgrade your subscription to continue automated intake and validation.'
              : `The "${featureName}" feature is reserved for specialists on our paid tiers. Upgrading enables higher throughput, advanced validation checks, and line-item extraction.`)}
        </p>

        {/* Error message */}
        {errorMsg && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* Recommended Plan Highlight Box */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300">
                Recommended Tier
              </span>
              <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1">{targetPlan.name}</h4>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-slate-900 dark:text-white">
                {formatInrCurrency(targetPlan.priceInrMonthly)}
              </div>
              <div className="text-[10px] text-slate-400">/ month</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg text-slate-700 dark:text-slate-300">
              <span className="font-bold text-slate-900 dark:text-white">{targetPlan.documentAllowanceMonthly}</span> docs/month
            </div>
            <div className="bg-white dark:bg-slate-900 p-2 rounded-lg text-slate-700 dark:text-slate-300">
              <span className="font-bold text-slate-900 dark:text-white">{targetPlan.userAllowance}</span> team seats
            </div>
          </div>

          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Full access to {featureName}</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Advanced schema rules & export formats</span>
            </li>
          </ul>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={handleQuickUpgrade}
            disabled={isProcessing}
            className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Opening Razorpay Checkout...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                <span>Upgrade to {targetPlan.name} ({formatInrCurrency(targetPlan.priceInrMonthly)})</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenPricing();
            }}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Compare all four subscription plans</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Razorpay Verified • UPI, RuPay, Cards • Instant Activation</span>
        </div>
      </div>
    </div>
  );
};
