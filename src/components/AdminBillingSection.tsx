/**
 * Administrator Subscription, Revenue & Quota Management Console
 * DOCUAGENT AI SaaS Platform
 */

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Users,
  CreditCard,
  AlertOctagon,
  TrendingUp,
  Settings,
  RefreshCw,
  CheckCircle,
  XCircle,
  Edit2,
  Save,
  X,
  ShieldAlert,
  Search
} from 'lucide-react';
import {
  type PlanId,
  type PlanConfig,
  type SubscriptionRecord,
  type PaymentTransactionRecord,
  type BillingOverviewStats,
  formatInrCurrency,
  DEFAULT_PLANS
} from '../shared/plans.ts';
import { authFetch } from '../utils/authFetch.ts';

export const AdminBillingSection: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<BillingOverviewStats | null>(null);
  const [plans, setPlans] = useState<Record<PlanId, PlanConfig>>(DEFAULT_PLANS);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransactionRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'subscribers' | 'transactions' | 'plan_editor'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPlanId, setEditingPlanId] = useState<PlanId | null>(null);
  const [planForm, setPlanForm] = useState<{
    priceInrMonthly: number;
    documentAllowanceMonthly: number;
    userAllowance: number;
  }>({
    priceInrMonthly: 0,
    documentAllowanceMonthly: 10,
    userAllowance: 1
  });
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadAdminData = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      const [overviewRes, plansRes, subsRes, txsRes] = await Promise.all([
        authFetch('/api/admin/billing/overview'),
        authFetch('/api/billing/plans'),
        authFetch('/api/admin/billing/subscriptions'),
        authFetch('/api/admin/billing/transactions')
      ]);

      if (overviewRes.ok) {
        const oData = await overviewRes.json();
        setStats(oData);
      }

      if (plansRes.ok) {
        const pData = await plansRes.json();
        if (pData.plans) setPlans(pData.plans);
      }

      if (subsRes.ok) {
        const sData = await subsRes.json();
        setSubscriptions(sData.subscriptions || []);
      }

      if (txsRes.ok) {
        const tData = await txsRes.json();
        setTransactions(tData.transactions || []);
      }
    } catch (err: any) {
      console.error('[AdminBillingSection] Error fetching billing stats:', err);
      setActionMessage({ type: 'error', text: 'Failed to fetch admin billing data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleStartEditPlan = (plan: PlanConfig) => {
    setEditingPlanId(plan.id);
    setPlanForm({
      priceInrMonthly: plan.priceInrMonthly,
      documentAllowanceMonthly: plan.documentAllowanceMonthly,
      userAllowance: plan.userAllowance
    });
  };

  const handleSavePlan = async (planId: PlanId) => {
    try {
      const res = await authFetch('/api/admin/billing/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          updates: {
            priceInrMonthly: Number(planForm.priceInrMonthly),
            documentAllowanceMonthly: Number(planForm.documentAllowanceMonthly),
            userAllowance: Number(planForm.userAllowance)
          }
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update plan.');
      }

      const data = await res.json();
      setPlans((prev) => ({
        ...prev,
        [planId]: data.plan
      }));
      setEditingPlanId(null);
      setActionMessage({ type: 'success', text: `Plan limits for ${planId} updated on the live server.` });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Error updating plan limits.' });
    }
  };

  const handleToggleSuspendUser = async (userId: string, currentStatus: string, planId: PlanId) => {
    const nextStatus = currentStatus === 'active' ? 'cancelled' : 'active';
    try {
      const res = await authFetch('/api/admin/billing/user-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          planId,
          status: nextStatus
        })
      });

      if (res.ok) {
        setSubscriptions((prev) =>
          prev.map((s) => (s.user_id === userId ? { ...s, status: nextStatus } : s))
        );
        setActionMessage({
          type: 'success',
          text: `User ${userId} subscription status changed to ${nextStatus}.`
        });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: 'Failed to update user subscription status.' });
    }
  };

  const filteredSubs = subscriptions.filter(
    (s) =>
      s.user_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.plan_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <span>Administrator Billing & Revenue Console</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time subscriber metrics, verified INR revenue, and dynamic server quota management.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAdminData}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl border text-xs sm:text-sm ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 text-xs font-bold uppercase tracking-wider">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 cursor-pointer border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Overview & Revenue
        </button>
        <button
          onClick={() => setActiveTab('subscribers')}
          className={`pb-3 cursor-pointer border-b-2 transition-colors ${
            activeTab === 'subscribers'
              ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Subscribers ({subscriptions.length})
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`pb-3 cursor-pointer border-b-2 transition-colors ${
            activeTab === 'transactions'
              ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Transactions ({transactions.length})
        </button>
        <button
          onClick={() => setActiveTab('plan_editor')}
          className={`pb-3 cursor-pointer border-b-2 transition-colors ${
            activeTab === 'plan_editor'
              ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Plan Quotas & Pricing
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-xs text-slate-500">Verified Revenue (INR)</div>
              <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1">
                {formatInrCurrency(stats.totalVerifiedRevenueInr)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">HMAC Verified Razorpay</div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-xs text-slate-500">Active Paid Subscriptions</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {stats.activeSubscriptions}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {stats.cancelledSubscriptions} cancelled • {stats.expiredSubscriptions} expired
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-xs text-slate-500">Registered Users</div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.totalUsers}</div>
              <div className="text-[10px] text-slate-400 mt-1">{stats.freeUsers} Free tier accounts</div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-xs text-slate-500">Payment Failures</div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                {stats.paymentFailures}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Tracked in failure audit</div>
            </div>
          </div>

          {/* Plan Breakdown & Revenue Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Subscriber Distribution by Tier</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">Free Plan (₹0)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{stats.freeUsers} users</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">Starter Plan (₹499)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{stats.starterUsers} users</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-cyan-600 dark:text-cyan-400 font-semibold">Professional Plan (₹1,499)</span>
                  <span className="font-bold text-cyan-600 dark:text-cyan-400">{stats.professionalUsers} users</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">Business Plan (₹3,999)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{stats.businessUsers} users</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Revenue Realized by Plan</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">Starter Plan</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {formatInrCurrency(stats.revenueByPlanInr.starter || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-cyan-600 dark:text-cyan-400 font-semibold">Professional Plan</span>
                  <span className="font-bold text-cyan-600 dark:text-cyan-400">
                    {formatInrCurrency(stats.revenueByPlanInr.professional || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">Business Plan</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {formatInrCurrency(stats.revenueByPlanInr.business || 0)}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center font-bold">
                  <span>Total Verified Collections</span>
                  <span className="text-cyan-600 dark:text-cyan-400">{formatInrCurrency(stats.totalVerifiedRevenueInr)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SUBSCRIBERS */}
      {activeTab === 'subscribers' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search user ID, plan, or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500">
                  <th className="py-2.5 px-3">User ID</th>
                  <th className="py-2.5 px-3">Plan</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Period End</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredSubs.map((sub) => (
                  <tr key={sub.subscription_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono">{sub.user_id}</td>
                    <td className="py-2.5 px-3 font-semibold capitalize">{sub.plan_id}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          sub.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {new Date(sub.current_period_end).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {sub.plan_id !== 'free' && (
                        <button
                          onClick={() => handleToggleSuspendUser(sub.user_id, sub.status, sub.plan_id)}
                          className="px-2 py-1 rounded text-[11px] font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          {sub.status === 'active' ? 'Suspend' : 'Restore'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TRANSACTIONS */}
      {activeTab === 'transactions' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-500">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Payment ID</th>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Plan</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {transactions.map((tx) => (
                  <tr key={tx.transaction_id}>
                    <td className="py-2.5 px-3 text-slate-500">
                      {new Date(tx.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 font-mono">{tx.payment_id}</td>
                    <td className="py-2.5 px-3">{tx.user_email || tx.user_id}</td>
                    <td className="py-2.5 px-3 capitalize font-semibold">{tx.plan_id}</td>
                    <td className="py-2.5 px-3 font-bold">{formatInrCurrency(tx.amount_inr)}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.status === 'succeeded'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PLAN QUOTAS & PRICING EDITOR */}
      {activeTab === 'plan_editor' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Dynamic Plan & Quota Configuration</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Modify monthly pricing in INR and document allowances without editing code or rebuilding the frontend.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.values(plans).map((plan) => {
              const isEditing = editingPlanId === plan.id;

              return (
                <div
                  key={plan.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{plan.name}</h4>
                      <span className="text-[10px] font-bold uppercase text-slate-400">{plan.id}</span>
                    </div>

                    {isEditing ? (
                      <div className="space-y-3 mt-3">
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">Price (₹/mo):</label>
                          <input
                            type="number"
                            value={planForm.priceInrMonthly}
                            onChange={(e) =>
                              setPlanForm({ ...planForm, priceInrMonthly: Number(e.target.value) })
                            }
                            className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">Doc Allowance / mo:</label>
                          <input
                            type="number"
                            value={planForm.documentAllowanceMonthly}
                            onChange={(e) =>
                              setPlanForm({ ...planForm, documentAllowanceMonthly: Number(e.target.value) })
                            }
                            className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">Team Seats:</label>
                          <input
                            type="number"
                            value={planForm.userAllowance}
                            onChange={(e) =>
                              setPlanForm({ ...planForm, userAllowance: Number(e.target.value) })
                            }
                            className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 mt-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Monthly Price:</span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {formatInrCurrency(plan.priceInrMonthly)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Monthly Allowance:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {plan.documentAllowanceMonthly} docs
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Team Allowance:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {plan.userAllowance} users
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/60 flex justify-end gap-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => setEditingPlanId(null)}
                          className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSavePlan(plan.id)}
                          className="px-3 py-1 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded cursor-pointer"
                        >
                          Save
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleStartEditPlan(plan)}
                        className="px-2.5 py-1 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit Limits</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
