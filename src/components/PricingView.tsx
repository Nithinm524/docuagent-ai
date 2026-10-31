/**
 * SaaS Pricing & Subscription Plans Page (INR)
 * DOCUAGENT AI Document Intelligence Platform
 *
 * Implements:
 * - 4 core plans: Free (₹0), Starter (₹499), Professional (₹1,499), Business (₹3,999) + Enterprise
 * - Indian Rupee (INR) currency formatting
 * - Clear active plan indicator
 * - Feature comparison matrix
 * - Direct Razorpay Checkout initiation
 * - Enterprise inquiry drawer
 * - Transparent billing disclosures (No countdowns or fake discounts)
 */

import React, { useState, useEffect } from 'react';
import {
  Check,
  Shield,
  Zap,
  Sparkles,
  HelpCircle,
  Building,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Lock,
  Layers,
  FileCheck2,
  AlertCircle
} from 'lucide-react';
import {
  DEFAULT_PLANS,
  type PlanId,
  type PlanConfig,
  formatInrCurrency
} from '../shared/plans.ts';
import { authFetch } from '../utils/authFetch.ts';
import { openRazorpayCheckout } from '../utils/razorpay.ts';

interface PricingViewProps {
  currentPlanId?: PlanId;
  onUpgradeSuccess?: (newPlanId: PlanId) => void;
  onOpenAuth?: () => void;
  userEmail?: string;
  userName?: string;
  onNavigateTab?: (tab: any) => void;
}

export const PricingView: React.FC<PricingViewProps> = ({
  currentPlanId = 'free',
  onUpgradeSuccess,
  onOpenAuth,
  userEmail,
  userName,
  onNavigateTab
}) => {
  const [plans, setPlans] = useState<Record<PlanId, PlanConfig>>(DEFAULT_PLANS);
  const [activePlanId, setActivePlanId] = useState<PlanId>(currentPlanId);
  const [isProcessingPlan, setIsProcessingPlan] = useState<PlanId | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);
  const [enterpriseForm, setEnterpriseForm] = useState({
    name: userName || '',
    email: userEmail || '',
    company: '',
    estimatedVolume: '10,000+ docs/mo',
    notes: ''
  });
  const [enterpriseSubmitted, setEnterpriseSubmitted] = useState(false);
  const [comparisonExpanded, setComparisonExpanded] = useState(true);

  // Fetch live plan definitions and active user subscription from server
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [plansRes, subRes] = await Promise.all([
          authFetch('/api/billing/plans').catch(() => null),
          authFetch('/api/billing/my-subscription').catch(() => null)
        ]);

        if (plansRes && plansRes.ok) {
          const plansData = await plansRes.json();
          if (plansData.plans && isMounted) {
            setPlans(plansData.plans);
          }
        }

        if (subRes && subRes.ok) {
          const subData = await subRes.json();
          if (subData.subscription?.plan_id && isMounted) {
            setActivePlanId(subData.subscription.plan_id);
          }
        }
      } catch (err) {
        console.warn('[PricingView] Failed to load remote plans or subscription:', err);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectPlan = async (plan: PlanConfig) => {
    setStatusMessage(null);

    if (plan.id === 'free') {
      if (activePlanId === 'free') return;
      setStatusMessage({
        type: 'success',
        message: 'You are on the Free Plan. Basic document intake and review features are permanently active.'
      });
      return;
    }

    if (plan.id === 'enterprise') {
      setShowEnterpriseModal(true);
      return;
    }

    if (!userEmail) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    setIsProcessingPlan(plan.id);

    try {
      // 1. Create trusted order on server
      const orderRes = await authFetch('/api/billing/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id })
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json().catch(() => ({}));
        throw new Error(errData.error || `Server order creation failed with status ${orderRes.status}`);
      }

      const orderData = await orderRes.json();

      // 2. Open Razorpay Checkout modal
      await openRazorpayCheckout({
        orderId: orderData.orderId,
        amountPaisa: orderData.amountPaisa,
        amountInr: orderData.amountInr,
        keyId: orderData.keyId,
        planId: plan.id,
        planName: plan.name,
        userName: userName || 'Valued Specialist',
        userEmail: userEmail || 'user@docuagent.local',
        isTestMode: orderData.isTestMode,
        onSuccess: async (paymentData) => {
          try {
            // 3. Verify cryptographic payment signature on server
            const verifyRes = await authFetch('/api/billing/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: paymentData.razorpay_order_id,
                razorpay_payment_id: paymentData.razorpay_payment_id,
                razorpay_signature: paymentData.razorpay_signature,
                plan_id: plan.id
              })
            });

            if (!verifyRes.ok) {
              const vErr = await verifyRes.json().catch(() => ({}));
              throw new Error(vErr.error || 'Payment signature verification failed.');
            }

            setActivePlanId(plan.id);
            setStatusMessage({
              type: 'success',
              message: `Payment successful! Your ${plan.name} is now active. Document allowance has been upgraded.`
            });

            if (onUpgradeSuccess) {
              onUpgradeSuccess(plan.id);
            }
          } catch (vErr: any) {
            setStatusMessage({
              type: 'error',
              message: vErr.message || 'Verification failed. Please contact support if your account was debited.'
            });
          } finally {
            setIsProcessingPlan(null);
          }
        },
        onFailure: async (err) => {
          setIsProcessingPlan(null);
          await authFetch('/api/billing/payment-failed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: orderData.orderId,
              planId: plan.id,
              errorCode: err.code,
              errorDescription: err.description
            })
          }).catch(() => {});

          setStatusMessage({
            type: 'error',
            message: err.description || 'Payment was not completed. No charges were incurred.'
          });
        },
        onDismiss: () => {
          setIsProcessingPlan(null);
        }
      });
    } catch (err: any) {
      setIsProcessingPlan(null);
      setStatusMessage({
        type: 'error',
        message: err.message || 'Unable to initiate checkout. Please try again.'
      });
    }
  };

  const handleEnterpriseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEnterpriseSubmitted(true);
    setTimeout(() => {
      setShowEnterpriseModal(false);
      setEnterpriseSubmitted(false);
      setStatusMessage({
        type: 'success',
        message: 'Thank you for your enterprise inquiry. Our solutions engineering team will reach out within 1 business day.'
      });
    }, 1500);
  };

  const planList: PlanConfig[] = [
    plans.free,
    plans.starter,
    plans.professional,
    plans.business
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070B14] text-slate-900 dark:text-slate-100 py-12 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20 mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Transparent Pricing in Indian Rupees (INR)</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Simple, Predictable Plans for <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-cyan-600 to-indigo-600 dark:from-cyan-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Automated Document Review
            </span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-400">
            Start for free with 10 documents every month. Upgrade as your intake volume scales with instant activation via UPI, Cards, and Netbanking.
          </p>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`max-w-3xl mx-auto mb-8 p-4 rounded-xl border flex items-start gap-3 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="text-sm font-medium">{statusMessage.message}</div>
          </div>
        )}

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 items-stretch mb-16">
          {planList.map((plan) => {
            const isCurrent = activePlanId === plan.id;
            const isPopular = plan.isPopular;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl bg-white dark:bg-slate-900/90 border transition-all duration-200 shadow-sm hover:shadow-md ${
                  isPopular
                    ? 'border-cyan-500 dark:border-cyan-500/80 ring-2 ring-cyan-500/20 dark:ring-cyan-500/30'
                    : 'border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                } ${isCurrent ? 'bg-cyan-50/20 dark:bg-cyan-950/10' : ''}`}
              >
                {/* Popular Badge */}
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-xs">
                    Most Popular
                  </div>
                )}

                {/* Card Header */}
                <div className="p-6 sm:p-7 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                    {isCurrent && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        Current Plan
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 min-h-[36px]">{plan.tagline}</p>

                  {/* Price */}
                  <div className="mt-5 flex items-baseline">
                    <span className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                      {formatInrCurrency(plan.priceInrMonthly)}
                    </span>
                    <span className="ml-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">/ month</span>
                  </div>

                  {/* Quotas Pill */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-100 dark:bg-slate-800/60 p-2 rounded-lg text-center">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{plan.documentAllowanceMonthly}</div>
                      <div className="text-[10px] text-slate-500">docs/month</div>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800/60 p-2 rounded-lg text-center">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{plan.userAllowance}</div>
                      <div className="text-[10px] text-slate-500">{plan.userAllowance === 1 ? 'user' : 'users'}</div>
                    </div>
                  </div>
                </div>

                {/* Features List */}
                <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                        <Check className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <div>
                    <button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={isProcessingPlan === plan.id || (isCurrent && plan.id === 'free')}
                      className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        isCurrent
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-default border border-slate-200 dark:border-slate-700'
                          : isPopular
                          ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-sm hover:shadow-md cursor-pointer'
                          : 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 cursor-pointer shadow-xs'
                      }`}
                    >
                      {isProcessingPlan === plan.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          <span>Initiating Checkout...</span>
                        </>
                      ) : isCurrent ? (
                        'Active Plan'
                      ) : (
                        plan.ctaText
                      )}
                    </button>
                    <p className="mt-2 text-center text-[10px] text-slate-400 dark:text-slate-500">
                      {plan.priceInrMonthly > 0 ? 'Prepaid monthly • Non-recurring renewal' : 'No credit card required'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Enterprise Banner */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white p-8 sm:p-10 mb-16 shadow-md relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-1/4 -translate-y-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 mb-3">
                <Building className="w-3.5 h-3.5" />
                <span>Enterprise Grade</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Need Custom Document Volumes or Dedicated SLA?</h2>
              <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
                We support high-throughput financial institutions and enterprise compliance departments with custom ERP integrations, Single Sign-On (SAML/Okta), VPC deployment, and 99.9% uptime guarantees.
              </p>
            </div>
            <div className="shrink-0">
              <button
                onClick={() => setShowEnterpriseModal(true)}
                className="px-6 py-3 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Contact Enterprise Sales</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Feature Comparison Matrix */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 sm:p-8 mb-16 shadow-xs">
          <button
            onClick={() => setComparisonExpanded(!comparisonExpanded)}
            className="w-full flex items-center justify-between text-left cursor-pointer group"
          >
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                Detailed Plan Feature Matrix
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Compare document intake, AI extraction, validation rules, and export capabilities.
              </p>
            </div>
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {comparisonExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </button>

          {comparisonExpanded && (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-4 font-semibold text-slate-500 dark:text-slate-400">Feature</th>
                    <th className="py-3 px-4 font-semibold text-slate-900 dark:text-white">Free (₹0)</th>
                    <th className="py-3 px-4 font-semibold text-slate-900 dark:text-white">Starter (₹499)</th>
                    <th className="py-3 px-4 font-semibold text-cyan-600 dark:text-cyan-400 font-bold">Professional (₹1,499)</th>
                    <th className="py-3 px-4 font-semibold text-slate-900 dark:text-white">Business (₹3,999)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  <tr>
                    <td className="py-3 px-4 font-medium">Monthly Documents</td>
                    <td className="py-3 px-4">10 / mo</td>
                    <td className="py-3 px-4">50 / mo</td>
                    <td className="py-3 px-4 font-semibold text-cyan-600 dark:text-cyan-400">250 / mo</td>
                    <td className="py-3 px-4 font-semibold">1,000 / mo</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium">Included Specialist Users</td>
                    <td className="py-3 px-4">1 user</td>
                    <td className="py-3 px-4">1 user</td>
                    <td className="py-3 px-4">3 users</td>
                    <td className="py-3 px-4 font-semibold">10 users</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium">Document Uploads (PDF/JPG/PNG)</td>
                    <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-500" /></td>
                    <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-500" /></td>
                    <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-500" /></td>
                    <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-500" /></td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium">Bulk Upload Batch Processing</td>
                    <td className="py-3 px-4 text-slate-400">—</td>
                    <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-500" /></td>
                    <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-500" /></td>
                    <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-500" /></td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium">Multimodal AI Vision & Line Items</td>
                    <td className="py-3 px-4 text-slate-400">—</td>
                    <td className="py-3 px-4 text-slate-400">—</td>
                    <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-500" /></td>
                    <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-500" /></td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium">Custom Extraction Schemas</td>
                    <td className="py-3 px-4 text-slate-400">Standard</td>
                    <td className="py-3 px-4">Up to 2</td>
                    <td className="py-3 px-4">Up to 10</td>
                    <td className="py-3 px-4 font-semibold">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium">Duplicate Invoice Detection</td>
                    <td className="py-3 px-4 text-slate-400">—</td>
                    <td className="py-3 px-4 text-slate-400">—</td>
                    <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-500" /></td>
                    <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-500" /></td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium">Review Queues & Escalations</td>
                    <td className="py-3 px-4">Basic</td>
                    <td className="py-3 px-4">Basic Auto-route</td>
                    <td className="py-3 px-4">Advanced Workflows</td>
                    <td className="py-3 px-4 font-semibold">Custom Routing Rules</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium">Audit Reports & Export Formats</td>
                    <td className="py-3 px-4">JSON export</td>
                    <td className="py-3 px-4">JSON + PDF</td>
                    <td className="py-3 px-4">Excel + PDF + JSON</td>
                    <td className="py-3 px-4 font-semibold">Full Analytics Suite</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium">Data Protection & DPDP Rights</td>
                    <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-500" /></td>
                    <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-500" /></td>
                    <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-500" /></td>
                    <td className="py-3 px-4"><Check className="w-4 h-4 text-emerald-500" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payment Assurance & FAQ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="p-2 w-fit rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 mb-4">
              <CreditCard className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white">Razorpay Secure Checkout</h4>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              We accept UPI (GPay, PhonePe, Paytm), Visa, Mastercard, RuPay, and Netbanking. All payments are verified with cryptographic HMAC SHA-256 signatures.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="p-2 w-fit rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-4">
              <Shield className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white">Indian Data Privacy Assured</h4>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Full DPDP compliance, zero unauthorized document training, AES-256 payload encryption, and verifiable audit logging apply equally across all plans, including Free.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="p-2 w-fit rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-4">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white">Instant Activation & Easy Renewal</h4>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Subscriptions activate immediately upon payment verification. Upgraded quotas and AI capabilities become available without restarting your browser.
            </p>
          </div>
        </div>
      </div>

      {/* Enterprise Contact Modal */}
      {showEnterpriseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Contact Enterprise Solutions</h3>
              <button
                onClick={() => setShowEnterpriseModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                ✕
              </button>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-6">
              Connect with our enterprise architecture team for volume licensing, custom schemas, and compliance SLAs.
            </p>

            {enterpriseSubmitted ? (
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6" />
                </div>
                <div className="font-bold text-lg text-slate-900 dark:text-white">Request Received</div>
                <p className="text-xs text-slate-500 mt-1">Our technical sales lead will contact you promptly.</p>
              </div>
            ) : (
              <form onSubmit={handleEnterpriseSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Your Full Name</label>
                  <input
                    type="text"
                    required
                    value={enterpriseForm.name}
                    onChange={(e) => setEnterpriseForm({ ...enterpriseForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Corporate Email Address</label>
                  <input
                    type="email"
                    required
                    value={enterpriseForm.email}
                    onChange={(e) => setEnterpriseForm({ ...enterpriseForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Organization / Department</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Financial Services"
                    value={enterpriseForm.company}
                    onChange={(e) => setEnterpriseForm({ ...enterpriseForm, company: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Estimated Document Volume</label>
                  <select
                    value={enterpriseForm.estimatedVolume}
                    onChange={(e) => setEnterpriseForm({ ...enterpriseForm, estimatedVolume: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="5,000 - 20,000 docs/mo">5,000 - 20,000 docs/month</option>
                    <option value="20,000 - 100,000 docs/mo">20,000 - 100,000 docs/month</option>
                    <option value="100,000+ docs/mo">100,000+ docs/month</option>
                    <option value="Custom VPC / On-Premise">Custom VPC / On-Premise Deployment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Requirements & Integration Scope</label>
                  <textarea
                    rows={3}
                    placeholder="Describe your document types, systems (SAP, Oracle, ERP), and compliance needs..."
                    value={enterpriseForm.notes}
                    onChange={(e) => setEnterpriseForm({ ...enterpriseForm, notes: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEnterpriseModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg shadow-sm"
                  >
                    Submit Enterprise Inquiry
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
