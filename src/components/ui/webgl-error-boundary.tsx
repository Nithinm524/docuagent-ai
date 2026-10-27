/**
 * WebGL Error Boundary & Graceful Visual Fallback
 * DOCUAGENT AI
 *
 * Catches WebGL initialization failures, shader compilation errors, or context loss,
 * seamlessly rendering a premium static atmospheric fallback without crashing the app.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';

interface WebGLErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface WebGLErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class WebGLErrorBoundary extends Component<
  WebGLErrorBoundaryProps,
  WebGLErrorBoundaryState
> {
  constructor(props: WebGLErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WebGLErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.warn('[WebGLErrorBoundary] WebGL rendering error captured:', error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <WebGLFallback className={this.props.className} />;
    }

    return this.props.children;
  }
}

interface WebGLFallbackProps {
  className?: string;
  title?: string;
  subtitle?: string;
}

export const WebGLFallback: React.FC<WebGLFallbackProps> = ({
  className = '',
  title = 'Document Intelligence Platform',
  subtitle = 'Deterministic Verification & Neural Screening'
}) => {
  return (
    <div
      className={`relative w-full h-full min-h-[300px] overflow-hidden rounded-2xl bg-gradient-to-br from-[#050b18] via-[#091224] to-[#030611] flex flex-col items-center justify-center p-6 text-slate-100 select-none ${className}`}
    >
      {/* Subtle background cyber grid */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#06b6d4 1px, transparent 1px), linear-gradient(90deg, #06b6d4 1px, transparent 1px)`,
          backgroundSize: '32px 32px'
        }}
      />

      {/* Radial cyan bloom */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute w-72 h-72 rounded-full bg-cyan-500/15 blur-[80px] -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2"
      />

      {/* Central Holographic Icon */}
      <div className="relative z-10 flex flex-col items-center space-y-4 text-center">
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900/90 border border-cyan-500/30 shadow-xl shadow-cyan-950/50">
          <div className="absolute inset-0 rounded-2xl border border-cyan-400/20 animate-pulse" />
          <ShieldCheck className="w-8 h-8 text-cyan-400 stroke-[1.75]" />
        </div>

        <div className="space-y-1 max-w-xs">
          <p className="text-sm font-semibold tracking-tight text-white">{title}</p>
          <p className="text-xs text-slate-400 leading-relaxed">{subtitle}</p>
        </div>

        {/* Status indicator */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700/60 text-[11px] text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-mono text-[10px] text-cyan-300">SYSTEM OPERATIONAL</span>
        </div>
      </div>
    </div>
  );
};
