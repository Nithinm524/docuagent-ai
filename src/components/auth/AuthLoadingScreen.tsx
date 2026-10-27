/**
 * Cinematic Authentication Loading Screen
 * DOCUAGENT AI
 *
 * Prevents flashing protected views while Firebase Authentication initializes.
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const AuthLoadingScreen: React.FC<{ message?: string }> = ({
  message = 'Verifying security credentials & session...'
}) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#030712] text-slate-100 select-none overflow-hidden font-sans">
      {/* Ambient background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[120px] -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2"
      />

      <div className="relative flex flex-col items-center space-y-6 max-w-sm px-6 text-center">
        {/* Animated Orbital Shield Indicator */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          {/* Outer rotating ring */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 border-r-cyan-500/40 animate-spin" />
          
          {/* Counter-rotating inner ring */}
          <div
            className="absolute inset-2 rounded-full border-2 border-transparent border-b-teal-400 border-l-teal-500/30 animate-spin"
            style={{ animationDirection: 'reverse', animationDuration: '1.8s' }}
          />

          {/* Glowing central icon container */}
          <div className="w-12 h-12 rounded-xl bg-slate-900/90 border border-cyan-500/40 shadow-lg shadow-cyan-500/20 flex items-center justify-center text-cyan-400">
            <ShieldCheck className="w-6 h-6 stroke-[2]" />
          </div>
        </div>

        {/* Branding & Status message */}
        <div className="space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <span className="text-base font-bold tracking-tight text-white">
              DOCUAGENT <span className="text-cyan-400 font-extrabold text-xs">AI</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium tracking-wide">
            {message}
          </p>
        </div>

        {/* Subtle Progress Rail */}
        <div className="w-36 h-1 rounded-full bg-slate-800 overflow-hidden">
          <div className="w-full h-full bg-gradient-to-r from-cyan-500 to-teal-400 animate-pulse" />
        </div>
      </div>
    </div>
  );
};
