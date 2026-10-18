import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  Copy,
  Check,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface MobileAccessCardProps {
  className?: string;
  defaultExpanded?: boolean;
}

const PUBLISHED_APP_URL = 'https://docuagent-ai.ai.studio';

export const MobileAccessCard: React.FC<MobileAccessCardProps> = ({
  className = '',
  defaultExpanded = true
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState<string>(PUBLISHED_APP_URL);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Configured environment variable override if valid remote HTTPS URL
      const envUrlRaw = (import.meta as any).env?.VITE_SHARED_APP_URL;
      const sharedEnvUrl = typeof envUrlRaw === 'string' ? envUrlRaw.trim() : '';

      // Never encode AI Studio editor / workspace / localhost URLs
      const isEditorOrLocalUrl = (url: string) =>
        url.includes('aistudio.google.com') ||
        url.includes('workspace') ||
        url.includes('localhost') ||
        url.includes('127.0.0.1') ||
        url.includes('0.0.0.0') ||
        url.startsWith('file://');

      let resolvedUrl = PUBLISHED_APP_URL;
      if (
        sharedEnvUrl &&
        sharedEnvUrl.startsWith('https://') &&
        !isEditorOrLocalUrl(sharedEnvUrl)
      ) {
        resolvedUrl = sharedEnvUrl;
      }

      setTargetUrl(resolvedUrl);

      // Generate scannable QR Code data URL with high contrast
      QRCode.toDataURL(resolvedUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: '#0A0F1D',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      })
        .then((url) => {
          setQrDataUrl(url);
          setErrorMsg(null);
        })
        .catch((err) => {
          console.error('QR generation error:', err);
          setErrorMsg('Unable to render QR code visual');
        });
    } catch (e: any) {
      console.warn('QR code generation error:', e);
      setErrorMsg('Failed to generate mobile QR code');
    }
  }, []);

  const handleCopyLink = async () => {
    if (!targetUrl) return;
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for clipboard access
      const ta = document.createElement('textarea');
      ta.value = targetUrl;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = 'docuagent-mobile-access-qr.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className={`rounded-xl border border-slate-800/80 bg-[#0B1120] p-4 transition-all ${className}`}
    >
      {/* Header with expand/collapse */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Smartphone className="w-4 h-4 stroke-[2]" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white tracking-tight flex items-center space-x-2">
              <span>Open on Mobile</span>
              <span className="text-[10px] font-normal text-slate-400">
                · Scan to test mobile review
              </span>
            </h3>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-slate-400 hover:text-slate-200 transition-colors"
            aria-label={isExpanded ? 'Collapse mobile access' : 'Expand mobile access'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded QR Panel */}
      {isExpanded && (
        <div className="mt-4 pt-3.5 border-t border-slate-800/80">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* White Background High-Contrast QR Code Container */}
            <div className="shrink-0 flex flex-col items-center">
              <div className="p-2.5 bg-white rounded-xl shadow-md border border-slate-200 flex items-center justify-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`DOCUAGENT AI Mobile QR Code for ${targetUrl}`}
                    className="w-36 h-36 object-contain block"
                  />
                ) : (
                  <div className="w-36 h-36 flex items-center justify-center text-xs text-slate-500 font-mono">
                    Generating QR...
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Camera scan enabled
              </span>
            </div>

            {/* Details & Action Controls */}
            <div className="flex-1 min-w-0 space-y-3 text-center sm:text-left">
              <div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Scan with your smartphone camera to open DOCUAGENT on mobile. The responsive interface adapts seamlessly for mobile document intake, OCR verification, and reviewer queue triage.
                </p>
              </div>

              {/* URL Display */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Published Application Link
                </label>
                <div className="flex items-center space-x-2 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs font-mono text-cyan-300/90 break-all select-all">
                  <span className="truncate">{targetUrl}</span>
                  <a
                    href={targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-cyan-300 shrink-0 ml-auto"
                    title="Open in new window"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Working Action Buttons: Copy Link & Download QR Code */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/80 flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Link Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>

                {qrDataUrl && (
                  <button
                    type="button"
                    onClick={handleDownloadQR}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/80 flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Download QR Code</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {errorMsg && (
            <p className="mt-2 text-[11px] text-rose-400">{errorMsg}</p>
          )}
        </div>
      )}
    </div>
  );
};

