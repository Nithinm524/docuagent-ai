import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  Mail,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Send,
  Clock,
  Settings
} from 'lucide-react';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

interface PreferencesData {
  userId: string;
  emailNotificationsEnabled: boolean;
  notifyOnUpload: boolean;
  notifyOnAssignment: boolean;
  notifyOnCompletion: boolean;
  destinationEmail: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  event: string;
  recipientEmail: string;
  subject: string;
  deliveryStatus: string;
}

export const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
  isOpen,
  onClose,
  onNotify
}) => {
  const [prefs, setPrefs] = useState<PreferencesData>({
    userId: 'usr-reviewer-01',
    emailNotificationsEnabled: true,
    notifyOnUpload: true,
    notifyOnAssignment: true,
    notifyOnCompletion: true,
    destinationEmail: 'reviewer@docuagent.local'
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/notifications/preferences');
      if (res.ok) {
        const data = await res.json();
        if (data.preferences) {
          setPrefs(data.preferences);
        }
      }

      const logRes = await fetch('/api/notifications/logs');
      if (logRes.ok) {
        const logData = await logRes.json();
        if (logData.logs) {
          setLogs(logData.logs);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load notification preferences:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs)
      });
      if (res.ok) {
        onNotify('success', 'Email notification preferences saved successfully.');
        onClose();
      } else {
        throw new Error('Failed to update preferences');
      }
    } catch (err: any) {
      onNotify('error', 'Unable to save notification preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setIsTesting(true);
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        onNotify('success', `Test notification generated (${data.entry.subject}).`);
        // Refresh logs
        const logRes = await fetch('/api/notifications/logs');
        if (logRes.ok) {
          const logData = await logRes.json();
          if (logData.logs) setLogs(logData.logs);
        }
      }
    } catch (err) {
      onNotify('error', 'Failed to trigger test notification.');
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-modal-title"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-800 dark:text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 id="notification-modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Email Notification Preferences
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure event alerts for document uploads, assignments, and review completions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            aria-label="Close notification settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs sm:text-sm">
          {/* Master Email Notifications Switch */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
            <div>
              <span className="font-bold text-slate-900 dark:text-white block text-sm">
                Enable Email Notifications
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                Allow DOCUAGENT AI to send operational email dispatches for document events
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.emailNotificationsEnabled}
                onChange={(e) =>
                  setPrefs({ ...prefs, emailNotificationsEnabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
            </label>
          </div>

          {/* Destination Email */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Notification Destination Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={prefs.destinationEmail}
                onChange={(e) => setPrefs({ ...prefs, destinationEmail: e.target.value })}
                placeholder="reviewer@example.com"
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Event Triggers */}
          <div className="space-y-2.5">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Notification Triggers
            </span>

            <div className="space-y-2">
              <label className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">
                <input
                  type="checkbox"
                  checked={prefs.notifyOnUpload}
                  disabled={!prefs.emailNotificationsEnabled}
                  onChange={(e) => setPrefs({ ...prefs, notifyOnUpload: e.target.checked })}
                  className="w-4 h-4 mt-0.5 rounded text-cyan-600 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-cyan-500 cursor-pointer"
                />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white block text-xs sm:text-sm">
                    New Document Ingestion (DOCUMENT_UPLOADED)
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                    Receive alert whenever a user or applicant ingests a new document into the processing pipeline
                  </span>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">
                <input
                  type="checkbox"
                  checked={prefs.notifyOnAssignment}
                  disabled={!prefs.emailNotificationsEnabled}
                  onChange={(e) => setPrefs({ ...prefs, notifyOnAssignment: e.target.checked })}
                  className="w-4 h-4 mt-0.5 rounded text-cyan-600 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-cyan-500 cursor-pointer"
                />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white block text-xs sm:text-sm">
                    Case Assignment &amp; Queue Transfer (CASE_ASSIGNED)
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                    Receive alert when a case is escalated or assigned to your reviewer queue for compliance triage
                  </span>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">
                <input
                  type="checkbox"
                  checked={prefs.notifyOnCompletion}
                  disabled={!prefs.emailNotificationsEnabled}
                  onChange={(e) => setPrefs({ ...prefs, notifyOnCompletion: e.target.checked })}
                  className="w-4 h-4 mt-0.5 rounded text-cyan-600 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-cyan-500 cursor-pointer"
                />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white block text-xs sm:text-sm">
                    Review Completion Sign-off (REVIEW_COMPLETED)
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                    Receive alert when a reviewer marks a case as finalized, approved, or closed
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Test Trigger Button */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block text-xs">
                Test Dispatch Engine
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Simulates an event notification to verify delivery formatting
              </span>
            </div>
            <button
              onClick={handleTestNotification}
              disabled={isTesting}
              className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {isTesting ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              )}
              <span>Send Test Alert</span>
            </button>
          </div>

          {/* Recent Delivery History */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Recent Notification Dispatches ({logs.length})
            </span>
            {logs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No notifications dispatched yet.</p>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-slate-50/50 dark:bg-slate-950/40">
                {logs.slice(0, 5).map((l) => (
                  <div key={l.id} className="text-[11px] flex items-center justify-between p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850">
                    <div className="truncate max-w-[70%]">
                      <span className="font-medium text-slate-900 dark:text-white block truncate">{l.subject}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{new Date(l.timestamp).toLocaleTimeString()} · To: {l.recipientEmail}</span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                      l.deliveryStatus === 'DISPATCHED' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {l.deliveryStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end space-x-2 text-xs">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
          >
            {isSaving && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
            <span>Save Preferences</span>
          </button>
        </div>
      </div>
    </div>
  );
};
