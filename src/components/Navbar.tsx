/**
 * Responsive Top Navigation Bar
 * AI Document Review & Routing Agent
 *
 * Implements:
 * - Theme toggle (Light / Dark / System mode)
 * - Navigation tabs (Dashboard, Upload, Queues, Audit)
 * - Persistent storage indicator
 * - Diagnostics & administration modal trigger
 * - Mobile responsive drawer with theme switcher
 */

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
  Plus,
  Activity,
  Archive,
  Bell,
  Scale,
  User,
  LogIn,
  LogOut,
  ArrowRight,
  CreditCard,
  DollarSign,
  Sparkles
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle.tsx';

export interface UserSession {
  user_id: string;
  email: string;
  role: 'admin' | 'reviewer' | 'viewer' | 'applicant';
  full_name?: string;
}

interface NavbarProps {
  activeTab: 'dashboard' | 'upload' | 'queues' | 'reports';
  setActiveTab: (tab: 'dashboard' | 'upload' | 'queues' | 'reports') => void;
  isLandingPage?: boolean;
  onNavigateHome?: () => void;
  onOpenWorkspace?: (tab?: 'dashboard' | 'upload' | 'queues' | 'reports') => void;
  storageInfo?: { storage_type: string; case_count: number; status?: string };
  onResetSeed: () => void;
  isResetting: boolean;
  onOpenDiagnostics: () => void;
  currentUser?: UserSession | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
  onOpenNotifications?: () => void;
  onOpenLegalChecklist?: () => void;
  onOpenDataCollection?: () => void;
  onOpenPricing?: () => void;
  onOpenBilling?: () => void;
  onOpenAdminBilling?: () => void;
  userPlanId?: string;
  isPricingActive?: boolean;
  isBillingActive?: boolean;
  isAdminBillingActive?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isLandingPage = false,
  onNavigateHome,
  onOpenWorkspace,
  storageInfo,
  onResetSeed,
  isResetting,
  onOpenDiagnostics,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenNotifications,
  onOpenLegalChecklist,
  onOpenDataCollection,
  onOpenPricing,
  onOpenBilling,
  onOpenAdminBilling,
  userPlanId,
  isPricingActive = false,
  isBillingActive = false,
  isAdminBillingActive = false
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
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-[#090E1A]/95 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[72px]">
          {/* Left: DOCUAGENT Logo & Subtitle */}
          <div
            tabIndex={0}
            role="button"
            aria-label="DOCUAGENT AI logo, return to homepage"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (onNavigateHome) {
                  onNavigateHome();
                } else {
                  setActiveTab('dashboard');
                }
                setMobileMenuOpen(false);
              }
            }}
            className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer shrink-0 select-none group focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-lg p-1 transition-all"
            onClick={() => {
              if (onNavigateHome) {
                onNavigateHome();
              } else {
                setActiveTab('dashboard');
              }
              setMobileMenuOpen(false);
            }}
          >
            {/* Logo image container with high-contrast backing for seamless Light and Dark mode readability */}
            <div className="flex items-center justify-center rounded-lg bg-slate-900/95 dark:bg-slate-900/50 p-1 border border-slate-800/80 dark:border-slate-800 shadow-xs shrink-0 group-hover:border-cyan-500/50 transition-colors">
              <picture className="flex items-center">
                <source type="image/webp" srcSet="/docuagent-logo.webp" />
                <img
                  src="/docuagent-logo.png"
                  alt="DOCUAGENT AI logo"
                  width={180}
                  height={44}
                  loading="eager"
                  decoding="async"
                  className="h-[34px] sm:h-[38px] md:h-[44px] w-auto max-w-[180px] object-contain transition-transform group-hover:scale-[1.02]"
                  onError={(e) => {
                    // Fallback in the event of missing or delayed image asset
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    const fallback = target.closest('.group')?.querySelector('.logo-fallback-badge') as HTMLElement | null;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              </picture>
              <div
                className="logo-fallback-badge hidden w-9 h-9 items-center justify-center text-cyan-400"
                aria-hidden="true"
              >
                <ShieldCheck className="w-5 h-5 stroke-[2]" />
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1 leading-none">
                DOCUAGENT <span className="text-cyan-600 dark:text-cyan-400 font-extrabold text-xs sm:text-sm">AI</span>
              </span>
              <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                Document Intelligence
              </span>
            </div>
          </div>

          {/* Center: Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-1.5" aria-label="Main Navigation">
            {isLandingPage ? (
              <>
                <a
                  href="#capabilities"
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  Features
                </a>
                <a
                  href="#workflow"
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  How It Works
                </a>
                <a
                  href="#use-cases"
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  Schemas
                </a>
                <a
                  href="#trust"
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  Trust &amp; Oversight
                </a>
                <a
                  href="#faq"
                  className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  FAQ
                </a>
              </>
            ) : (
              <>
                {onNavigateHome && (
                  <button
                    onClick={onNavigateHome}
                    className="px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    Home
                  </button>
                )}
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center space-x-1.5 whitespace-nowrap cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                        isActive
                          ? 'bg-slate-100 dark:bg-slate-800/90 text-cyan-700 dark:text-cyan-300 font-semibold shadow-xs border border-slate-200 dark:border-slate-700/60'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`} aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
                {onOpenPricing && (
                  <button
                    onClick={onOpenPricing}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center space-x-1.5 whitespace-nowrap cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                      isPricingActive
                        ? 'bg-slate-100 dark:bg-slate-800/90 text-cyan-700 dark:text-cyan-300 font-semibold shadow-xs border border-slate-200 dark:border-slate-700/60'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-500" aria-hidden="true" />
                    <span>Pricing</span>
                  </button>
                )}
              </>
            )}
          </nav>

          {/* Right: Storage, Theme Toggle, Primary Action & Diagnostics */}
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            {/* Storage status indicator (in workspace) */}
            {!isLandingPage && (
              <div
                className="hidden lg:flex items-center space-x-1.5 text-[11px] text-slate-600 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-900/80 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                title="Persistent file storage state (click for diagnostics)"
                onClick={onOpenDiagnostics}
              >
                <Database className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                <span className="text-slate-700 dark:text-slate-300">Storage</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-slate-500 font-mono text-[10px]">
                  {storageInfo?.case_count ?? '...'} cases
                </span>
              </div>
            )}

            {/* Notifications Button */}
            {onOpenNotifications && (
              <button
                onClick={onOpenNotifications}
                title="Email Notification Preferences & History"
                aria-label="Notification Preferences"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-slate-300 dark:border-slate-800 transition-colors flex items-center justify-center cursor-pointer"
              >
                <Bell className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </button>
            )}

            {/* Pre-Launch Legal Checklist Button */}
            {onOpenLegalChecklist && (
              <button
                onClick={onOpenLegalChecklist}
                title="Pre-Launch Legal & Compliance Checklist"
                aria-label="Legal Checklist"
                className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-slate-300 dark:border-slate-800 transition-colors hidden sm:flex items-center justify-center cursor-pointer"
              >
                <Scale className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              </button>
            )}

            {/* Requirement 1: Light and Dark Theme Switch */}
            <ThemeToggle />

            {/* Diagnostics Quick Action */}
            <button
              onClick={onOpenDiagnostics}
              title="Open System Diagnostics & Budgets"
              aria-label="System Diagnostics"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-slate-300 dark:border-slate-800 transition-colors hidden sm:flex items-center justify-center"
            >
              <Activity className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </button>

            {/* User Session / Auth Trigger */}
            {currentUser ? (
              <div className="hidden sm:flex items-center space-x-1.5 pl-1">
                <div
                  className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300"
                  title={`Logged in as ${currentUser.email} (${currentUser.role})`}
                >
                  <User className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span className="font-medium max-w-[100px] truncate">{currentUser.full_name || currentUser.email.split('@')[0]}</span>
                  <span className="text-[10px] uppercase font-mono px-1 py-0.2 rounded bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300">
                    {currentUser.role}
                  </span>
                  <button
                    type="button"
                    onClick={onOpenBilling || onOpenPricing}
                    className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer shadow-2xs"
                    title="Current Subscription Plan (Click to manage)"
                  >
                    {userPlanId ? userPlanId.toUpperCase() : 'FREE'}
                  </button>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    title="Sign Out"
                    aria-label="Sign Out"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : null}

            {/* Primary Action Button */}
            {isLandingPage ? (
              <button
                onClick={() => {
                  if (onOpenWorkspace) {
                    onOpenWorkspace('dashboard');
                  } else {
                    setActiveTab('dashboard');
                  }
                  setMobileMenuOpen(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-semibold text-xs tracking-tight shadow-sm flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <span>Open Workspace</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            ) : (
              <button
                onClick={() => {
                  setActiveTab('upload');
                  setMobileMenuOpen(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-semibold text-xs tracking-tight shadow-sm flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>New Review</span>
              </button>
            )}

            {/* More Menu Dropdown (Secondary Actions) */}
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-300 dark:border-slate-800 transition-colors cursor-pointer"
                title="Application options"
                aria-label="More options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {moreMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-50 text-xs">
                  <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-slate-400 tracking-wider border-b border-slate-100 dark:border-slate-800/80">
                    SaaS Plans &amp; Billing (INR)
                  </div>

                  {onOpenPricing && (
                    <button
                      onClick={() => {
                        onOpenPricing();
                        setMoreMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      <span>Pricing &amp; Plans (₹0 - ₹3,999)</span>
                    </button>
                  )}

                  {onOpenBilling && (
                    <button
                      onClick={() => {
                        onOpenBilling();
                        setMoreMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      <span>Billing &amp; Tax Invoices</span>
                    </button>
                  )}

                  {currentUser?.role === 'admin' && onOpenAdminBilling && (
                    <button
                      onClick={() => {
                        onOpenAdminBilling();
                        setMoreMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-cyan-600 dark:text-cyan-400 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Admin Billing &amp; Quotas</span>
                    </button>
                  )}

                  <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-slate-400 tracking-wider border-b border-t border-slate-100 dark:border-slate-800/80 mt-1">
                    Compliance &amp; Governance
                  </div>

                  {onOpenLegalChecklist && (
                    <button
                      onClick={() => {
                        onOpenLegalChecklist();
                        setMoreMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <Scale className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      <span>Pre-Launch Legal Checklist</span>
                    </button>
                  )}

                  {onOpenDataCollection && (
                    <button
                      onClick={() => {
                        onOpenDataCollection();
                        setMoreMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <Database className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      <span>Data Collection &amp; Privacy</span>
                    </button>
                  )}

                  {onOpenNotifications && (
                    <button
                      onClick={() => {
                        onOpenNotifications();
                        setMoreMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <Bell className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      <span>Notification Preferences</span>
                    </button>
                  )}

                  <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-slate-400 tracking-wider border-b border-t border-slate-100 dark:border-slate-800/80 mt-1">
                    System Maintenance
                  </div>

                  <button
                    onClick={() => {
                      onOpenDiagnostics();
                      setMoreMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center space-x-2 transition-colors cursor-pointer"
                  >
                    <Activity className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>Diagnostics &amp; Budgets</span>
                  </button>

                  <button
                    onClick={() => {
                      onResetSeed();
                      setMoreMenuOpen(false);
                    }}
                    disabled={isResetting}
                    className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center space-x-2 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 ${isResetting ? 'animate-spin' : ''}`} />
                    <span>Reset Demo Dataset</span>
                  </button>

                  {currentUser ? (
                    <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="px-3 py-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Signed in as {currentUser.email}
                      </div>
                      {onLogout && (
                        <button
                          onClick={() => {
                            onLogout();
                            setMoreMenuOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center space-x-2 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      )}
                    </div>
                  ) : null}

                  <div className="px-3 py-1.5 text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800/80 mt-1">
                    Store: {storageInfo?.storage_type || 'JSON'} ({storageInfo?.case_count ?? 0} records)
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg md:hidden text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090E1A] px-4 pt-3 pb-4 space-y-2">
          {isLandingPage ? (
            <div className="space-y-1">
              <a
                href="#capabilities"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2"
              >
                Features &amp; Capabilities
              </a>
              <a
                href="#workflow"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2"
              >
                How It Works
              </a>
              <a
                href="#use-cases"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2"
              >
                Document Schemas
              </a>
              <a
                href="#trust"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2"
              >
                Trust &amp; Oversight
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2"
              >
                Frequently Asked Questions
              </a>
              <button
                type="button"
                onClick={() => {
                  if (onOpenWorkspace) {
                    onOpenWorkspace('dashboard');
                  } else {
                    setActiveTab('dashboard');
                  }
                  setMobileMenuOpen(false);
                }}
                className="w-full mt-2 px-3 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
              >
                <span>Open Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              {onNavigateHome && (
                <button
                  onClick={() => {
                    onNavigateHome();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850 flex items-center space-x-2.5 text-left cursor-pointer"
                >
                  <span>Home / Overview</span>
                </button>
              )}
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
                        ? 'bg-slate-100 dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 font-semibold border border-slate-200 dark:border-slate-700/60'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
              {onOpenPricing && (
                <button
                  onClick={() => {
                    onOpenPricing();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-lg text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2.5 text-left cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-cyan-500" />
                  <span>Pricing Plans (INR)</span>
                </button>
              )}
              {onOpenBilling && (
                <button
                  onClick={() => {
                    onOpenBilling();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2.5 text-left cursor-pointer"
                >
                  <CreditCard className="w-4 h-4 text-cyan-500" />
                  <span>Billing &amp; Invoices</span>
                </button>
              )}
            </>
          )}

          {/* Mobile Compliance & Settings */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-1">
            {onOpenLegalChecklist && (
              <button
                onClick={() => {
                  onOpenLegalChecklist();
                  setMobileMenuOpen(false);
                }}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2.5 text-left"
              >
                <Scale className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Pre-Launch Legal Checklist</span>
              </button>
            )}

            {onOpenDataCollection && (
              <button
                onClick={() => {
                  onOpenDataCollection();
                  setMobileMenuOpen(false);
                }}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2.5 text-left"
              >
                <Database className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Data Collection &amp; Privacy</span>
              </button>
            )}

            {onOpenNotifications && (
              <button
                onClick={() => {
                  onOpenNotifications();
                  setMobileMenuOpen(false);
                }}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2.5 text-left"
              >
                <Bell className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Notification Preferences</span>
              </button>
            )}

            {currentUser ? (
              <div className="px-3 py-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center space-x-2 truncate">
                  <User className="w-4 h-4 text-cyan-500" />
                  <span className="truncate">{currentUser.email}</span>
                </div>
                {onLogout && (
                  <button
                    onClick={() => {
                      onLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="text-rose-600 dark:text-rose-400 font-medium pl-2"
                  >
                    Logout
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {/* Mobile Theme Switcher */}
          <div className="pt-2 pb-1 border-t border-slate-200 dark:border-slate-800/80">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-3 mb-1.5 uppercase tracking-wider">
              Theme Mode
            </div>
            <div className="px-3">
              <ThemeToggle compact={false} />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-3 py-1.5">
            <button
              onClick={() => {
                onOpenDiagnostics();
                setMobileMenuOpen(false);
              }}
              className="flex items-center space-x-1.5 text-cyan-700 dark:text-cyan-400 font-medium"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Diagnostics &amp; Budgets</span>
            </button>
            <button
              onClick={() => {
                onResetSeed();
                setMobileMenuOpen(false);
              }}
              disabled={isResetting}
              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-[11px]"
            >
              Reset Data
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
