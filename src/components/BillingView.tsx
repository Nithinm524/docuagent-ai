/**
 * Billing & Subscription Management Portal
 * DOCUAGENT AI SaaS Platform
 *
 * Implements:
 * - Current subscription status (Active, Expired, Cancelled)
 * - Monthly quota progress & renewal dates
 * - Plan upgrade / downgrade / renewal triggers
 * - Subscription cancellation workflow
 * - Payment transaction history with verifiable Razorpay transaction IDs
 * - GST-compliant printable tax receipt / invoice generation
 */

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Download,
  ArrowUpRight,
  RefreshCw,
  XCircle,
  FileText,
  Clock,
  Printer
} from 'lucide-react';
import {
  type PlanId,
  type SubscriptionRecord,
  type PaymentTransactionRecord,
  formatInrCurrency,
  DEFAULT_PLANS
} from '../shared/plans.ts';
import { authFetch } from '../utils/authFetch.ts';

interface BillingViewProps {
  onOpenPricing: () => void;
  onPlanChanged?: () => void;
  userEmail?: string;
  userName?: string;
}

export const BillingView: React.FC<BillingViewProps> = ({
  onOpenPricing,
  onPlanChanged,
  userEmail,
  userName
}) => {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [usage, setUsage] = useState<any>(null);
  const [transactions, setTransactions] = useState<PaymentTransactionRecord[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentTransactionRecord | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadBillingData = async () => {
    setLoading(true);
    try {
      const [subRes, txRes] = await Promise.all([
        authFetch('/api/billing/my-subscription'),
        authFetch('/api/billing/transactions')
      ]);

      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscription(subData.subscription);
        setUsage(subData.usage);
      }

      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.transactions || []);
      }
    } catch (err) {
      console.error('[BillingView] Error loading billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, []);

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    setFeedbackMessage(null);
    try {
      const res = await authFetch('/api/billing/cancel-subscription', {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription);
        setFeedbackMessage({
          type: 'success',
          text: 'Subscription cancelled. You retain full access until the end of your prepaid period.'
        });
        setCancelModalOpen(false);
        if (onPlanChanged) onPlanChanged();
      } else {
        throw new Error('Failed to cancel subscription.');
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Unable to cancel subscription. Please contact support.'
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const planId = (subscription?.plan_id || 'free') as PlanId;
  const planConfig = DEFAULT_PLANS[planId] || DEFAULT_PLANS.free;
  const isPaidPlan = planId !== 'free';

  const usedDocs = usage?.documentsUploaded ?? 0;
  const maxDocs = usage?.documentAllowance ?? planConfig.documentAllowanceMonthly;
  const remainingDocs = Math.max(0, maxDocs - usedDocs);
  const usagePct = maxDocs > 0 ? Math.min(100, Math.round((usedDocs / maxDocs) * 100)) : 100;

  // Determine usage meter color
  let progressColor = 'bg-cyan-500';
  let badgeColor = 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300';
  if (usagePct >= 100) {
    progressColor = 'bg-rose-500';
    badgeColor = 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300';
  } else if (usagePct >= 90) {
    progressColor = 'bg-amber-500';
    badgeColor = 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300';
  } else if (usagePct >= 70) {
    progressColor = 'bg-indigo-500';
  }

  const renewalDateStr = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : 'Ongoing (Free Plan)';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070B14] text-slate-900 dark:text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              Billing & Subscription Management
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage your plan tier, document usage meters, payment receipts, and renewals in INR.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadBillingData}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-cyan-500 cursor-pointer transition-colors"
              title="Refresh billing data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onOpenPricing}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs flex items-center gap-2 cursor-pointer transition-all"
            >
              <span>{isPaidPlan ? 'Change or Upgrade Plan' : 'Upgrade to Paid Plan'}</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="text-sm">{feedbackMessage.text}</div>
          </div>
        )}

        {/* Top Grid: Plan Card & Usage Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Active Plan Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Current Subscription
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    subscription?.status === 'active'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                      : subscription?.status === 'cancelled'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {subscription?.status || 'Active'}
                </span>
              </div>

              <div className="flex items-baseline gap-2 mb-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">{planConfig.name}</h3>
                <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                  {formatInrCurrency(planConfig.priceInrMonthly)}
                </span>
                <span className="text-xs text-slate-400">/ month</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{planConfig.tagline}</p>

              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Next Billing / Renewal:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{renewalDateStr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Billing Currency:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">INR (₹) via Razorpay</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Included Team Seats:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {planConfig.userAllowance} {planConfig.userAllowance === 1 ? 'specialist' : 'specialists'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {isPaidPlan && subscription?.status === 'active' ? (
                <button
                  onClick={() => setCancelModalOpen(true)}
                  className="text-xs text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Cancel subscription
                </button>
              ) : (
                <span className="text-xs text-slate-400">Free forever tier</span>
              )}

              <button
                onClick={onOpenPricing}
                className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 flex items-center gap-1 cursor-pointer"
              >
                <span>{isPaidPlan ? 'Change Plan' : 'Upgrade Plan'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Usage Meter Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Monthly Document Quota
                </span>
                <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${badgeColor}`}>
                  {usagePct}% Consumed
                </span>
              </div>

              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-black text-slate-900 dark:text-white">{usedDocs}</span>
                <span className="text-slate-400 text-sm">/ {maxDocs} documents</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                {remainingDocs > 0
                  ? `${remainingDocs} document intakes remaining this cycle.`
                  : 'Document limit reached. Upgrade to process additional documents.'}
              </p>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mb-4 overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>

              {/* Threshold Warnings */}
              {usagePct >= 100 ? (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>100% quota exhausted. Upgrades activate additional document capacity immediately.</span>
                </div>
              ) : usagePct >= 90 ? (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Approaching limit (90%+). Upgrade before your monthly intake is paused.</span>
                </div>
              ) : usagePct >= 70 ? (
                <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-xs text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>70% of monthly document quota utilized.</span>
                </div>
              ) : null}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Cycle resets on {renewalDateStr}</span>
              {remainingDocs === 0 && (
                <button
                  onClick={onOpenPricing}
                  className="font-bold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  Upgrade Limit Now
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Payment History & Tax Invoices */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Payment Transactions & Tax Invoices</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verified Razorpay payments, transaction IDs, and downloadable tax receipts.
              </p>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <div className="text-sm font-medium">No payment transactions recorded yet</div>
              <p className="text-xs text-slate-500 mt-1">Paid plans upgraded through Razorpay will list official receipts here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Transaction / Order ID</th>
                    <th className="py-3 px-3">Plan</th>
                    <th className="py-3 px-3">Amount (INR)</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {transactions.map((tx) => (
                    <tr key={tx.transaction_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                        {new Date(tx.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono text-xs text-slate-700 dark:text-slate-300">{tx.payment_id}</div>
                        <div className="text-[10px] text-slate-400">{tx.order_id}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold capitalize text-slate-800 dark:text-slate-200">
                        {tx.plan_id}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                        {formatInrCurrency(tx.amount_inr)}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            tx.status === 'succeeded'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {tx.status === 'succeeded' ? (
                          <button
                            onClick={() => setSelectedReceipt(tx)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Tax Receipt</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Confirm Subscription Cancellation</h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-4">
              Are you sure you want to cancel your {planConfig.name}? You will retain all premium features until your prepaid cycle ends on {renewalDateStr}, after which your account will smoothly revert to the Free Plan.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                Keep Subscription
              </button>
              <button
                type="button"
                onClick={handleCancelSubscription}
                disabled={isCancelling}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg cursor-pointer"
              >
                {isCancelling ? 'Processing...' : 'Yes, Cancel at Cycle End'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tax Receipt Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-600 text-white font-bold flex items-center justify-center text-sm">
                    DA
                  </div>
                  <span className="font-bold text-lg text-slate-900 dark:text-white">DOCUAGENT AI</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">Tax Invoice & Payment Receipt</div>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl space-y-2 text-xs mb-6 border border-slate-100 dark:border-slate-700/60">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice Number:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedReceipt.receipt_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment ID:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{selectedReceipt.payment_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Order ID:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{selectedReceipt.order_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Gateway:</span>
                <span className="text-slate-700 dark:text-slate-300">Razorpay (HMAC Verified)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">SAC Code:</span>
                <span className="text-slate-700 dark:text-slate-300">998313 (IT & Document Processing Services)</span>
              </div>
            </div>

            <div className="border-t border-b border-slate-200 dark:border-slate-800 py-3 mb-6 text-xs space-y-1">
              <div className="flex justify-between font-semibold text-slate-900 dark:text-white">
                <span>{selectedReceipt.plan_id.toUpperCase()} Monthly Subscription</span>
                <span>{formatInrCurrency(selectedReceipt.amount_inr)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Base Subscription Fee</span>
                <span>{formatInrCurrency(Math.round(selectedReceipt.amount_inr / 1.18))}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>GST (18% Integrated Goods and Services Tax)</span>
                <span>{formatInrCurrency(selectedReceipt.amount_inr - Math.round(selectedReceipt.amount_inr / 1.18))}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-slate-800">
                <span>Total Amount Paid (INR)</span>
                <span className="text-cyan-600 dark:text-cyan-400">{formatInrCurrency(selectedReceipt.amount_inr)}</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Status: <span className="text-emerald-500 font-semibold">Payment Succeeded</span></span>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
