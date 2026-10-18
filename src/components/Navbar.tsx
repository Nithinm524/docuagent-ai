import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  LayoutDashboard,
  UploadCloud,
  Layers,
  FileCheck2,
  Database,
  RotateCcw,
  MoreVertical,
  Menu,
  X,
  Plus
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'dashboard' | 'upload' | 'queues' | 'reports';
  setActiveTab: (tab: 'dashboard' | 'upload' | 'queues' | 'reports') => void;
  storageInfo?: { storage_type: string; case_count: number };
  onResetSeed: () => void;
  isResetting: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  storageInfo,
  onResetSeed,
  isResetting
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems: Array<{
    id: 'dashboard' | 'upload' | 'queues' | 'reports';
    label: string;
    icon: React.ElementType;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload Documents', icon: UploadCloud },
    { id: 'queues', label: 'Review Queue', icon: Layers },
    { id: 'reports', label: 'Audit & Reports', icon: FileCheck2 }
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090E1A]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[72px]">
          {/* Left: DOCUAGENT Logo & Subtitle */}
          <div
            className="flex items-center space-x-3 cursor-pointer shrink-0 select-none group"
            onClick={() => {
              setActiveTab('dashboard');
              setMobileMenuOpen(false);
            }}
          >
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:border-cyan-400/60 transition-colors">
              <ShieldCheck className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white flex items-center gap-1 leading-none">
                DOCUAGENT
              </span>
              <span className="text-[11px] font-normal text-slate-400 leading-tight mt-0.5">
                Document Intelligence
              </span>
            </div>
          </div>

          {/* Center: Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-800/90 text-cyan-300 font-semibold shadow-sm border border-slate-700/60'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Storage indicator & Primary "New Review" Action */}
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            {/* Storage status indicator */}
            <div
              className="hidden lg:flex items-center space-x-1.5 text-[11px] text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-md border border-slate-800"
              title="Persistent file storage state"
            >
              <Database className="w-3 h-3 text-cyan-400" />
              <span className="text-slate-300">Storage</span>
              <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
              <span className="text-slate-500 font-mono">
                {storageInfo?.case_count ?? '...'} cases
              </span>
            </div>

            {/* Subtle Primary "New Review" action */}
            <button
              onClick={() => {
                setActiveTab('upload');
                setMobileMenuOpen(false);
              }}
              className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs tracking-tight shadow-sm flex items-center space-x-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New Review</span>
            </button>

            {/* More Menu Dropdown (Secondary Actions) */}
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-850 border border-slate-800 transition-colors"
                title="Application options"
                aria-label="More options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {moreMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-xl py-1.5 z-50 text-xs">
                  <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-slate-400 tracking-wider border-b border-slate-800/80">
                    System Maintenance
                  </div>
                  <button
                    onClick={() => {
                      onResetSeed();
                      setMoreMenuOpen(false);
                    }}
                    disabled={isResetting}
                    className="w-full px-3 py-2 text-left text-slate-300 hover:text-white hover:bg-slate-800/80 flex items-center space-x-2 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 text-cyan-400 ${isResetting ? 'animate-spin' : ''}`} />
                    <span>Reset Demo Dataset</span>
                  </button>
                  <div className="px-3 py-1.5 text-[10px] text-slate-500 border-t border-slate-800/80 mt-1">
                    Store: {storageInfo?.storage_type || 'JSON'} ({storageInfo?.case_count ?? 0} records)
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg md:hidden text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-[#090E1A] px-4 pt-3 pb-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-lg text-xs font-medium transition-colors flex items-center space-x-2.5 text-left ${
                  isActive
                    ? 'bg-slate-800 text-cyan-300 font-semibold border border-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 px-3 py-1.5">
            <div className="flex items-center space-x-1.5">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>Storage: {storageInfo?.case_count ?? 0} cases</span>
            </div>
            <button
              onClick={() => {
                onResetSeed();
                setMobileMenuOpen(false);
              }}
              disabled={isResetting}
              className="text-cyan-400 hover:underline text-[11px]"
            >
              Reset Data
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
