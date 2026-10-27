/**
 * Administrative & Diagnostics Modal
 * AI Document Review & Routing Agent
 *
 * Displays:
 * - Real-time system health & readiness
 * - AI usage metrics, token counts, and daily/monthly spending caps
 * - Rate limiting & cache performance metrics
 * - Backup and restore operations
 * - Architecture notes (JSON persistence, payment not applicable, auth notice)
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Activity,
  DollarSign,
  Database,
  RefreshCw,
  Archive,
  Download,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  ShieldAlert,
  Clock,
  Layers,
  FileCheck
} from 'lucide-react';
import { APP_VERSION, APP_BUILD_DATE } from '../shared/version.ts';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'budgets' | 'backups' | 'logs'>('overview');
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const [diagRes, backupRes] = await Promise.all([
        fetch('/api/admin/diagnostics'),
        fetch('/api/admin/backups')
      ]);
      if (diagRes.ok) {
        const diagData = await diagRes.json();
        setData(diagData);
      }
      if (backupRes.ok) {
        const backupData = await backupRes.json();
        setBackups(backupData);
      }
    } catch (err) {
      console.error('Failed fetching diagnostics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDiagnostics();
    }
  }, [isOpen]);

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    setBackupMessage(null);
    setBackupError(null);
    try {
      const res = await fetch('/api/admin/backup', { method: 'POST' });
      const result = await res.json();
      if (res.ok) {
        setBackupMessage(`Backup ${result.backup?.fileName} created successfully (${result.backup?.caseCount} cases).`);
        await fetchDiagnostics();
      } else {
        setBackupError(result.error || 'Backup creation failed.');
      }
    } catch (err: any) {
      setBackupError(err.message || 'Backup failed.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (fileName: string) => {
    if (!window.confirm(`Are you sure you want to restore from "${fileName}"? A pre-restore safety snapshot will automatically be created first.`)) {
      return;
    }
    setIsRestoring(true);
    setBackupMessage(null);
    setBackupError(null);
    try {
      const res = await fetch('/api/admin/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName })
      });
      const result = await res.json();
      if (res.ok) {
        setBackupMessage(`Restored ${result.result?.restoredCases} cases. Pre-restore safety snapshot saved as ${result.result?.preRestoreBackup}.`);
        await fetchDiagnostics();
      } else {
        setBackupError(result.error || 'Restore failed.');
      }
    } catch (err: any) {
      setBackupError(err.message || 'Restore failed.');
    } finally {
      setIsRestoring(false);
    }
  };

  if (!isOpen) return null;

  const usage = data?.ai_usage_and_budgets;
  const metrics = usage?.metrics;
  const budgets = usage?.budgets;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Activity className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  System Diagnostics &amp; Administration
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-950/80 border border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 font-semibold">
                  {APP_VERSION}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Operational telemetry, AI spending budgets, rate limits, and persistent backups
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchDiagnostics}
              disabled={loading}
              title="Refresh telemetry"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-500' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 px-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-cyan-600 dark:border-cyan-400 text-cyan-700 dark:text-cyan-300 font-semibold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Overview &amp; Health
          </button>
          <button
            onClick={() => setActiveTab('budgets')}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'budgets'
                ? 'border-cyan-600 dark:border-cyan-400 text-cyan-700 dark:text-cyan-300 font-semibold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            AI Usage &amp; Spending Caps
          </button>
          <button
            onClick={() => setActiveTab('backups')}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'backups'
                ? 'border-cyan-600 dark:border-cyan-400 text-cyan-700 dark:text-cyan-300 font-semibold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Backup &amp; Restore
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-cyan-600 dark:border-cyan-400 text-cyan-700 dark:text-cyan-300 font-semibold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Recent Server Logs
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Application Release & Version Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">DOCUAGENT AI</span>
                    <span className="text-slate-400 dark:text-slate-500 mx-2">·</span>
                    <span className="font-mono text-cyan-700 dark:text-cyan-400 font-bold">{APP_VERSION}</span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  Build: {APP_BUILD_DATE} · Release channel: production
                </div>
              </div>

              {/* Health Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Process Uptime</div>
                  <div className="mt-1 text-lg font-bold font-mono text-slate-900 dark:text-white">
                    {data?.uptime_seconds ? `${Math.floor(data.uptime_seconds / 60)}m ${data.uptime_seconds % 60}s` : '...'}
                  </div>
                  <div className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live &amp; Ready
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Persistent Records</div>
                  <div className="mt-1 text-lg font-bold font-mono text-slate-900 dark:text-white">
                    {data?.storage?.case_count ?? '...'} cases
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    Atomic file-backed
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Response Cache</div>
                  <div className="mt-1 text-lg font-bold font-mono text-slate-900 dark:text-white">
                    {data?.cache?.hit_ratio_pct ?? 0}% hits
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                    {data?.cache?.hits ?? 0} hits · {data?.cache?.misses ?? 0} misses
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Rate Limiter</div>
                  <div className="mt-1 text-lg font-bold font-mono text-slate-900 dark:text-white">
                    Active
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                    {data?.rate_limiting?.tracked_clients ?? 0} clients tracked
                  </div>
                </div>
              </div>

              {/* Architecture & Security Notice */}
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-300 space-y-2">
                <div className="flex items-center space-x-2 font-semibold">
                  <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Deployment Architecture &amp; Authentication Notice</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  {data?.auth_notice || 'Authentication is currently unconfigured. Local development mode enabled.'}
                </p>
                <div className="text-[11px] pt-1 text-slate-600 dark:text-slate-400">
                  <strong>Payment Feature Status:</strong> DOCUAGENT AI contains no payment system or transaction endpoints. Duplicate payment prevention is therefore documented as not applicable to the current architecture.
                </div>
              </div>

              {/* Endpoints Table */}
              <div>
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white mb-2">
                  Health &amp; Monitoring Endpoints
                </h3>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden overflow-x-auto text-xs">
                  <table className="w-full text-left min-w-[500px] sm:min-w-full">
                    <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2 px-3 font-medium">Endpoint</th>
                        <th className="py-2 px-3 font-medium">Method</th>
                        <th className="py-2 px-3 font-medium">Purpose</th>
                        <th className="py-2 px-3 font-medium">External Monitor Check</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                      <tr>
                        <td className="py-2 px-3 text-cyan-700 dark:text-cyan-300">/api/health/live</td>
                        <td className="py-2 px-3">GET</td>
                        <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">Liveness probe</td>
                        <td className="py-2 px-3 font-sans text-slate-500">Configure external ping for HTTP 200</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-cyan-700 dark:text-cyan-300">/api/health/ready</td>
                        <td className="py-2 px-3">GET</td>
                        <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">Readiness &amp; storage check</td>
                        <td className="py-2 px-3 font-sans text-slate-500">Returns 200 ready / 503 degraded</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-cyan-700 dark:text-cyan-300">/api/admin/diagnostics</td>
                        <td className="py-2 px-3">GET</td>
                        <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-300">Admin telemetry</td>
                        <td className="py-2 px-3 font-sans text-slate-500">Internal diagnostics &amp; spend view</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AI USAGE & BUDGETS */}
          {activeTab === 'budgets' && (
            <div className="space-y-5">
              {/* Budget Progress Bars */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                      Daily AI Spending Budget
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Cap: ${budgets?.dailyBudgetUsd?.toFixed(2)} USD / day
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono text-cyan-600 dark:text-cyan-400">
                      ${metrics?.dailySpentUsd?.toFixed(4) || '0.0000'}
                    </span>
                    <span className="text-xs text-slate-400"> / ${budgets?.dailyBudgetUsd?.toFixed(2)}</span>
                  </div>
                </div>

                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      (budgets?.dailyUsedPct || 0) > 80 ? 'bg-amber-500' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${Math.min(100, budgets?.dailyUsedPct || 0)}%` }}
                  />
                </div>
              </div>

              {/* Monthly Budget Card */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                      Monthly AI Spending Budget
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Cap: ${budgets?.monthlyBudgetUsd?.toFixed(2)} USD / month
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono text-cyan-600 dark:text-cyan-400">
                      ${metrics?.monthlySpentUsd?.toFixed(4) || '0.0000'}
                    </span>
                    <span className="text-xs text-slate-400"> / ${budgets?.monthlyBudgetUsd?.toFixed(2)}</span>
                  </div>
                </div>

                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-2.5 rounded-full bg-cyan-500 transition-all"
                    style={{ width: `${Math.min(100, budgets?.monthlyUsedPct || 0)}%` }}
                  />
                </div>
              </div>

              {/* Detailed Metrics Table */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Total AI Calls</div>
                  <div className="text-base font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                    {metrics?.totalRequests ?? 0}
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    {metrics?.successfulRequests ?? 0} successful
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Prompt Tokens</div>
                  <div className="text-base font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                    {metrics?.totalPromptTokens?.toLocaleString() ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-400">Input tokens</div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Completion Tokens</div>
                  <div className="text-base font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                    {metrics?.totalCompletionTokens?.toLocaleString() ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-400">Generated tokens</div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Cumulative Spend</div>
                  <div className="text-base font-bold font-mono text-cyan-600 dark:text-cyan-400 mt-0.5">
                    ${metrics?.estimatedCostUsd?.toFixed(4) ?? '0.0000'}
                  </div>
                  <div className="text-[10px] text-slate-400">Estimated cost</div>
                </div>
              </div>

              {/* Disclaimer */}
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                {usage?.disclaimer}
              </p>
            </div>
          )}

          {/* TAB 3: BACKUP AND RESTORE */}
          {activeTab === 'backups' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                    Persistent Case Snapshots
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Create atomic point-in-time backups of case records and audit trails
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCreateBackup}
                  disabled={isBackingUp}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-semibold text-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>{isBackingUp ? 'Creating...' : 'Create Backup Now'}</span>
                </button>
              </div>

              {backupMessage && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>{backupMessage}</span>
                </div>
              )}

              {backupError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{backupError}</span>
                </div>
              )}

              {/* Backups List */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[500px] sm:min-w-full">
                  <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Backup File</th>
                      <th className="py-2.5 px-3 font-medium">Timestamp</th>
                      <th className="py-2.5 px-3 font-medium">Records</th>
                      <th className="py-2.5 px-3 font-medium">Size</th>
                      <th className="py-2.5 px-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {backups.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          No backup snapshots recorded. Click &quot;Create Backup Now&quot; to snapshot current state.
                        </td>
                      </tr>
                    ) : (
                      backups.map((b) => (
                        <tr key={b.fileName} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-900 dark:text-slate-200">
                            {b.fileName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {new Date(b.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                            {b.caseCount} cases
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {Math.round(b.sizeBytes / 1024)} KB
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleRestore(b.fileName)}
                              disabled={isRestoring}
                              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-500 text-slate-700 dark:text-slate-300 text-[11px] font-medium transition-colors disabled:opacity-50"
                            >
                              Restore
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <div className="font-semibold text-slate-700 dark:text-slate-300">
                  Safe Restore Strategy:
                </div>
                <div>• Restoring automatically captures an atomic pre-restore safety snapshot before replacing data.</div>
                <div>• Incompatible or corrupted JSON backups are validated and rejected prior to disk application.</div>
                <div>• Test a backup by restoring into an isolated development environment before applying in production.</div>
              </div>
            </div>
          )}

          {/* TAB 4: RECENT LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Sanitized in-memory operational ring buffer (Secrets &amp; credentials redacted)</span>
                <span>{data?.recent_logs?.length || 0} events</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-96 overflow-y-auto space-y-1.5">
                {(!data?.recent_logs || data.recent_logs.length === 0) ? (
                  <div className="text-slate-500">No logs captured yet in memory ring buffer.</div>
                ) : (
                  data.recent_logs.map((l: any, i: number) => {
                    const isErr = l.level === 'ERROR';
                    const isWarn = l.level === 'WARN';
                    return (
                      <div key={i} className="leading-relaxed hover:bg-slate-800/40 p-1 rounded">
                        <span className="text-slate-500">[{l.timestamp.slice(11, 19)}]</span>{' '}
                        <span
                          className={`font-semibold ${
                            isErr ? 'text-rose-400' : isWarn ? 'text-amber-400' : 'text-cyan-400'
                          }`}
                        >
                          [{l.level}]
                        </span>{' '}
                        <span className="text-slate-400">[{l.operation}]</span>{' '}
                        <span>{l.message}</span>
                        {l.errorSummary && (
                          <div className="text-rose-300 pl-4 text-[10px]">⤷ {l.errorSummary}</div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div>
            Storage: <span className="font-mono text-slate-700 dark:text-slate-300">{data?.storage?.storage_type || 'JSON'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
