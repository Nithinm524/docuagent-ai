import React from 'react';
import { Cookie, ArrowLeft, AlertCircle, Shield, Sliders, Database, Eye, RefreshCw, Lock } from 'lucide-react';

interface CookiePolicyViewProps {
  onBack: () => void;
  onOpenPreferences: () => void;
  onOpenPrivacy: () => void;
}

export const CookiePolicyView: React.FC<CookiePolicyViewProps> = ({
  onBack,
  onOpenPreferences,
  onOpenPrivacy
}) => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 animate-fadeIn">
      {/* Header & Back button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center space-x-1.5 text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium mb-3 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-hidden rounded"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Workspace</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Cookie &amp; Local Storage Policy
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Last Updated: October 2026 · Technical Storage &amp; Privacy Notice (Policy v2026.1)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenPreferences}
            className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Manage Preferences</span>
          </button>
        </div>
      </div>

      {/* Deployer Notice Banner */}
      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold block">Notice to Application Deployers:</span>
          <p className="text-amber-800 dark:text-amber-300">
            This technical policy documents the actual storage mechanisms utilized by DOCUAGENT AI. Contact details and organizational privacy designations are configured via environment variables (such as <code className="bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded font-mono text-[11px]">VITE_PRIVACY_EMAIL</code>) or your enterprise deployment agreement.
          </p>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="space-y-8 text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
        {/* Section 1: Overview */}
        <section className="space-y-3 bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Cookie className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">1. What Technologies Are Used</h2>
          </div>
          <p>
            Unlike traditional websites that use HTTP tracking cookies transmitted across domains, <strong>DOCUAGENT AI primarily utilizes browser Web Storage (specifically LocalStorage and SessionStorage)</strong>. These client-side storage technologies maintain your interface preferences directly on your local device without sending tracking headers to third-party advertising or profiling networks.
          </p>
          <p>
            When you interact with the application, key-value entries are saved locally to provide seamless operation, remember your theme selection, and record your consent choices.
          </p>
        </section>

        {/* Section 2: Technical Inventory */}
        <section className="space-y-4 bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">2. Technical Storage Inventory</h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            The table below provides a full audit of all storage keys utilized in the client browser, their category, data stored, purpose, and retention lifespan:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white font-semibold">
                <tr>
                  <th className="p-2.5">Key Name</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5">What is Stored</th>
                  <th className="p-2.5">Purpose</th>
                  <th className="p-2.5">Retention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <td className="p-2.5 font-mono text-cyan-700 dark:text-cyan-300">docuagent_theme</td>
                  <td className="p-2.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                      Essential
                    </span>
                  </td>
                  <td className="p-2.5">Selected theme ('light', 'dark', or 'system')</td>
                  <td className="p-2.5">Maintains high-contrast visual display and user appearance choices</td>
                  <td className="p-2.5">Persistent until cleared by user</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-mono text-cyan-700 dark:text-cyan-300">docuagent_cookie_consent_v2</td>
                  <td className="p-2.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                      Essential
                    </span>
                  </td>
                  <td className="p-2.5">JSON: consent status, policy version ('2026.1'), and timestamp</td>
                  <td className="p-2.5">Stores user privacy choices and prevents repetitive banner popups</td>
                  <td className="p-2.5">365 days or until updated</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-mono text-cyan-700 dark:text-cyan-300">docuagent_saved_filters</td>
                  <td className="p-2.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                      Functional
                    </span>
                  </td>
                  <td className="p-2.5">Reviewer queue filter states (status, queue, document type)</td>
                  <td className="p-2.5">Preserves reviewer workspace context across page reloads</td>
                  <td className="p-2.5">Session / 30 days</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-mono text-cyan-700 dark:text-cyan-300">docuagent_perf_metrics</td>
                  <td className="p-2.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300">
                      Optional Analytics
                    </span>
                  </td>
                  <td className="p-2.5">Client-side rendering latency and OCR throughput stats</td>
                  <td className="p-2.5">Evaluates processing performance (strictly opt-in, disabled by default)</td>
                  <td className="p-2.5">Session / cleared on tab close</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Essential vs Optional */}
        <section className="space-y-3 bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">3. Essential vs. Optional Technologies</h2>
          </div>
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">A. Strictly Essential Storage</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                Essential storage is required for core system stability, accessible UI contrast (theme switching), and recording your privacy preferences. Disabling essential storage would break the visual interface and prevent the app from remembering whether you accepted or declined optional cookies. Essential storage is exempt from opt-in consent requirements under global privacy regulations.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">B. Optional Performance &amp; Analytics</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                Optional analytics collect anonymous processing latency and system error diagnostics. <strong>Optional storage is disabled by default</strong> and will never initialize unless you affirmatively choose "Accept All" or toggle Analytics to "Enabled" in the preference manager.
              </p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium text-emerald-700 dark:text-emerald-400">
                Rejecting optional storage does not restrict or degrade any document upload, extraction, validation, or reviewer queue functionality.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Third-Party Services Audit */}
        <section className="space-y-3 bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Eye className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">4. Third-Party Services &amp; Network Requests Audit</h2>
          </div>
          <p>
            DOCUAGENT AI has been architected to minimize external network requests and eliminate third-party cross-site trackers:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-slate-600 dark:text-slate-400 text-sm">
            <li><strong>Zero Advertising Trackers:</strong> No marketing pixels, Google Ads, Meta pixels, or third-party behavioral profiling scripts are included.</li>
            <li><strong>Zero Third-Party Analytics Trackers:</strong> No external client trackers (e.g., Google Analytics or Hotjar) run on client browsers without explicit configuration by the deploying entity.</li>
            <li><strong>AI Model Processing:</strong> When AI-assisted extraction is enabled, document text and tokens are processed by Google Gemini via server-to-server proxy APIs using private server environment credentials. <em>Google does not set browser cookies on client devices during this process.</em></li>
            <li><strong>Self-Contained Fonts &amp; Icons:</strong> UI icons are rendered locally through bundled SVG components (Lucide React) rather than external third-party CDN fonts.</li>
          </ul>
        </section>

        {/* Section 5: Managing and Withdrawing Consent */}
        <section className="space-y-3 bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">5. How to Modify or Withdraw Your Preferences</h2>
          </div>
          <p>
            You have the right to modify or withdraw your storage preferences at any time with the same ease as providing consent:
          </p>
          <div className="space-y-2 pt-2">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <button
                type="button"
                onClick={onOpenPreferences}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                <Sliders className="w-4 h-4" />
                <span>Open Cookie &amp; Storage Preferences Modal</span>
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                You can also reopen preferences anytime via the footer link on every page.
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 pt-2">
              Alternatively, you can clear LocalStorage directly through your web browser developer tools (Application &gt; Local Storage) or browser privacy settings.
            </p>
          </div>
        </section>

        {/* Section 6: Contact & Questions */}
        <section className="space-y-3 bg-white dark:bg-slate-900/70 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">6. Questions &amp; Legal Disclosures</h2>
          </div>
          <p>
            For questions regarding this Cookie &amp; Storage Policy or our data protection practices, please consult our{' '}
            <button
              type="button"
              onClick={onOpenPrivacy}
              className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline cursor-pointer"
            >
              Privacy Policy
            </button>{' '}
            or contact the designated privacy representative for your deployment:
          </p>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
            <span className="font-semibold text-slate-900 dark:text-white block">Deploying Organization Privacy Office:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600 dark:text-slate-400">
              <div>
                <span className="block font-medium text-slate-700 dark:text-slate-300">Deployment Entity:</span>
                <span>Self-Hosted Enterprise Instance / Operating Licensee</span>
              </div>
              <div>
                <span className="block font-medium text-slate-700 dark:text-slate-300">Privacy Representative:</span>
                <span>Designated pursuant to enterprise operating contract</span>
              </div>
              <div className="sm:col-span-2">
                <span className="block font-medium text-slate-700 dark:text-slate-300">Contact Email:</span>
                {import.meta.env.VITE_PRIVACY_EMAIL ? (
                  <a
                    href={`mailto:${import.meta.env.VITE_PRIVACY_EMAIL}`}
                    className="text-cyan-600 dark:text-cyan-400 hover:underline font-mono focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
                    aria-label={`Send email to ${import.meta.env.VITE_PRIVACY_EMAIL}`}
                  >
                    {import.meta.env.VITE_PRIVACY_EMAIL}
                  </a>
                ) : (
                  <span className="text-slate-500 italic">
                    Configurable via deployment environment (VITE_PRIVACY_EMAIL). Direct inquiries to your local system administrator.
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
