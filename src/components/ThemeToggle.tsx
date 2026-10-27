/**
 * Theme Toggle Component (Light / Dark / System Mode)
 * AI Document Review & Routing Agent
 */

import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Laptop, ChevronDown } from 'lucide-react';
import { useTheme, ThemeMode } from '../context/ThemeContext.tsx';

interface ThemeToggleProps {
  compact?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ compact = false }) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const options: Array<{ mode: ThemeMode; label: string; icon: React.ElementType }> = [
    { mode: 'light', label: 'Light', icon: Sun },
    { mode: 'dark', label: 'Dark', icon: Moon },
    { mode: 'system', label: 'System', icon: Laptop }
  ];

  const CurrentIcon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Choose colour theme"
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={`Current theme: ${theme} (${resolvedTheme})`}
        className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-slate-300 dark:border-slate-800 transition-colors flex items-center space-x-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
      >
        <CurrentIcon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
        {!compact && (
          <>
            <span className="hidden sm:inline capitalize font-medium text-[11px] text-slate-700 dark:text-slate-300">
              {theme}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Theme options"
          className="absolute right-0 mt-2 w-36 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1 text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wider border-b border-slate-100 dark:border-slate-800/80 mb-1">
            Choose theme
          </div>
          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.mode;
            return (
              <button
                key={opt.mode}
                type="button"
                role="menuitem"
                onClick={() => {
                  setTheme(opt.mode);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left flex items-center space-x-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500 ${
                  isSelected
                    ? 'bg-cyan-50 dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'}`} />
                <span>{opt.label}</span>
                {isSelected && <span className="ml-auto text-[10px] text-cyan-600 dark:text-cyan-400">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
