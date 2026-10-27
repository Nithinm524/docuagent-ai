import React, { useState, useEffect, useRef } from 'react';
import { Cookie, Shield, Check, X, Sliders, Info, FileText } from 'lucide-react';

export interface CookieConsentState {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version: string;
}

const STORAGE_KEY = 'docuagent_cookie_consent_v2';
const CURRENT_POLICY_VERSION = '2026.1';

export function getStoredCookieConsent(): CookieConsentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as CookieConsentState;
      }
    }
  } catch {}
  return null;
}

export function saveCookieConsent(state: { analytics: boolean; marketing?: boolean }) {
  const consent: CookieConsentState = {
    essential: true,
    analytics: state.analytics,
    marketing: false, // Explicitly false: No marketing trackers exist in DOCUAGENT
    timestamp: new Date().toISOString(),
    version: CURRENT_POLICY_VERSION
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    // Dispatch custom event for real-time tracking scripts alignment
    window.dispatchEvent(new CustomEvent('docuagent-consent-updated', { detail: consent }));
  } catch {}
  return consent;
}

interface CookieConsentBannerProps {
  isPreferencesModalOpen: boolean;
  setIsPreferencesModalOpen: (open: boolean) => void;
  onOpenPrivacy: () => void;
  onOpenCookiePolicy?: () => void;
}

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({
  isPreferencesModalOpen,
  setIsPreferencesModalOpen,
  onOpenPrivacy,
  onOpenCookiePolicy
}) => {
  const [consent, setConsent] = useState<CookieConsentState | null>(() => getStoredCookieConsent());
  const [showBanner, setShowBanner] = useState(false);
  const [customAnalytics, setCustomAnalytics] = useState(false);
  const [saveAnnouncement, setSaveAnnouncement] = useState<string>('');

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only show banner if no valid consent has been recorded
    if (!consent) {
      const timer = setTimeout(() => setShowBanner(true), 350);
      return () => clearTimeout(timer);
    }
  }, [consent]);

  // Handle escape key to close preferences modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPreferencesModalOpen) {
        setIsPreferencesModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreferencesModalOpen, setIsPreferencesModalOpen]);

  const announceAndClose = (msg: string) => {
    setSaveAnnouncement(msg);
    setShowBanner(false);
    setIsPreferencesModalOpen(false);
    setTimeout(() => setSaveAnnouncement(''), 4000);
  };

  const handleAcceptAll = () => {
    const saved = saveCookieConsent({ analytics: true });
    setConsent(saved);
    announceAndClose('All storage preferences accepted. Analytics enabled.');
  };

  const handleRejectOptional = () => {
    const saved = saveCookieConsent({ analytics: false });
    setConsent(saved);
    announceAndClose('Optional storage rejected. Only essential local storage is active.');
  };

  const handleSaveCustom = () => {
    const saved = saveCookieConsent({ analytics: customAnalytics });
    setConsent(saved);
    announceAndClose(
      `Preferences saved. Essential: enabled, Analytics: ${customAnalytics ? 'enabled' : 'disabled'}.`
    );
  };

  const openCustomizeModal = () => {
    setCustomAnalytics(consent ? consent.analytics : false);
    setIsPreferencesModalOpen(true);
  };

  return (
    <>
      {/* Screen Reader Live Announcement */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {saveAnnouncement}
      </div>

      {/* Floating Bottom Cookie Consent Banner */}
      {showBanner && !isPreferencesModalOpen && (
        <section
          role="region"
          aria-label="Privacy and Storage Consent Notice"
          className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4 pointer-events-none no-print animate-slideUp"
        >
          <div className="max-w-4xl mx-auto bg-white dark:bg-[#0B1120] border border-slate-300 dark:border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-5 pointer-events-auto backdrop-blur-md transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start space-x-3.5">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5 border border-cyan-500/20">
                  <Cookie className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Privacy &amp; Local Storage Consent</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-normal">
                      v{CURRENT_POLICY_VERSION}
                    </span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-2xl">
                    DOCUAGENT AI uses essential browser LocalStorage to remember your display theme and maintain session stability. Optional performance diagnostics help measure OCR latency. Optional storage is disabled until you choose to accept.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                    <button
                      type="button"
                      onClick={onOpenPrivacy}
                      className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
                    >
                      Privacy Policy →
                    </button>
                    {onOpenCookiePolicy && (
                      <button
                        type="button"
                        onClick={onOpenCookiePolicy}
                        className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
                      >
                        Cookie &amp; Storage Policy →
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 self-end md:self-center">
                <button
                  type="button"
                  onClick={openCustomizeModal}
                  className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  Customize Preferences
                </button>
                <button
                  type="button"
                  onClick={handleRejectOptional}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  Reject Optional
                </button>
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  Accept All
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Customize Preferences Modal */}
      {isPreferencesModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-modal-title"
          aria-describedby="cookie-modal-desc"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            ref={modalRef}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-2.5">
                <Sliders className="w-5 h-5 text-cyan-500" aria-hidden="true" />
                <h2 id="cookie-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
                  Cookie &amp; Storage Preferences
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsPreferencesModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500"
                aria-label="Close preferences dialog"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <p id="cookie-modal-desc" className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              Configure your local storage preferences below. Essential storage cannot be disabled because it is necessary to render your chosen visual theme and maintain session integrity.
            </p>

            <div className="space-y-4">
              {/* Essential Storage */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">Essential Local Storage</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-500/20">
                      Always Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Stores active theme selection ('light', 'dark', 'system') and your saved consent state. Does not track your activity across websites.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={true}
                  disabled={true}
                  aria-label="Essential Local Storage (Always Active)"
                  className="rounded text-cyan-600 w-4 h-4 mt-1 opacity-70 cursor-not-allowed"
                />
              </div>

              {/* Optional Analytics */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">Analytics &amp; Performance</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      Optional
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Collects anonymous OCR extraction throughput and system response latency to assist with server tuning. Disabled by default.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={customAnalytics}
                    onChange={(e) => setCustomAnalytics(e.target.checked)}
                    aria-label="Enable optional analytics and performance storage"
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
                </label>
              </div>

              {/* Marketing Trackers: Explicitly None */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30 flex items-start justify-between gap-3 opacity-80">
                <div className="space-y-0.5">
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">Marketing &amp; Advertising Trackers</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    None used. DOCUAGENT AI has zero advertising pixels, cross-site trackers, or profiling cookies.
                  </p>
                </div>
                <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
                  Not Applicable
                </span>
              </div>
            </div>

            {consent?.timestamp && (
              <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <Info className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span>Last updated: {new Date(consent.timestamp).toLocaleDateString()} (Notice v{consent.version || CURRENT_POLICY_VERSION})</span>
              </div>
            )}

            {/* Modal actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              {onOpenCookiePolicy && (
                <button
                  type="button"
                  onClick={() => {
                    setIsPreferencesModalOpen(false);
                    onOpenCookiePolicy();
                  }}
                  className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline font-medium"
                >
                  View Full Cookie Policy
                </button>
              )}
              <div className="flex items-center space-x-2 ml-auto">
                <button
                  type="button"
                  onClick={handleRejectOptional}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  Reject Optional
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustom}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
