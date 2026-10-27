import React, { useState } from 'react';
import {
  X,
  User,
  Lock,
  Mail,
  Shield,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  LogOut,
  ExternalLink,
  KeyRound
} from 'lucide-react';
import { UserRole } from '../shared/types.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: {
    userId?: string;
    email?: string;
    name?: string;
    role?: string;
    tenantId?: string;
    isAnonymous?: boolean;
  } | null;
  onAuthSuccess: (user: any) => void;
  onLogout: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onOpenDataCollection: () => void;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAuthSuccess,
  onLogout,
  onOpenTerms,
  onOpenPrivacy,
  onOpenDataCollection,
  onNotify
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('reviewer');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Password reset state
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onNotify('success', `Welcome back, ${data.user.name} (${data.user.role}).`);
      onAuthSuccess(data.user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!termsAccepted) {
      setErrorMsg('You must review and accept the Terms of Use and Data Collection & Privacy Transparency disclosures.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name,
          role,
          termsAccepted: true
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      onNotify('success', `Account created successfully. Welcome, ${data.user.name}.`);
      onAuthSuccess(data.user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to register account.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      setResetSent(true);
      onNotify('info', data.message || 'If registered, reset instructions have been generated.');
    } catch (err: any) {
      setErrorMsg('Failed to request password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  const isAuthenticated = currentUser && !currentUser.isAnonymous;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-md flex flex-col rounded-2xl bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-slate-800 dark:text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {isAuthenticated
                  ? 'Operator Profile & Session'
                  : isResetMode
                  ? 'Reset Password'
                  : tab === 'login'
                  ? 'Sign In to DOCUAGENT AI'
                  : 'Create Operator Account'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Role-governed document workspace access
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isAuthenticated ? (
            /* Logged in view */
            <div className="space-y-4 text-xs sm:text-sm">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-white text-base">
                    {currentUser.name}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                    {currentUser.role}
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                  {currentUser.email}
                </div>
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-800">
                  Tenant: <span className="font-mono text-slate-700 dark:text-slate-300">{currentUser.tenantId}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="w-full py-2 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out of Session</span>
                </button>
              </div>
            </div>
          ) : isResetMode ? (
            /* Reset Password Form */
            <form onSubmit={handlePasswordReset} className="space-y-3.5 text-xs sm:text-sm">
              {resetSent ? (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 space-y-2">
                  <span className="font-semibold text-emerald-900 dark:text-emerald-200 block">
                    Password Reset Instructions Sent
                  </span>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">
                    If an account is associated with that email, a single-use 15-minute reset token has been generated. In development mode, check your server console or admin logs.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(false);
                      setResetSent(false);
                    }}
                    className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold underline cursor-pointer mt-2"
                  >
                    Return to Sign In
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Enter your registered email address to receive secure password reset instructions.
                  </p>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Account Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="reviewer@docuagent.local"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setIsResetMode(false)}
                      className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                    >
                      Back to Sign In
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                  </div>
                </>
              )}
            </form>
          ) : (
            /* Tabbed Login / Register */
            <div className="space-y-4">
              {/* Tabs */}
              <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setErrorMsg(null);
                  }}
                  className={`py-1.5 rounded-lg transition-colors cursor-pointer ${
                    tab === 'login'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setErrorMsg(null);
                  }}
                  className={`py-1.5 rounded-lg transition-colors cursor-pointer ${
                    tab === 'register'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {tab === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-3.5 text-xs sm:text-sm">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Work Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="reviewer@docuagent.local"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsResetMode(true)}
                        className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                      >
                        Forgot?
                      </button>
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs tracking-tight transition-colors cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      {isLoading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>Sign In</span>
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-400 text-center pt-1">
                    Default demo reviewer: <code className="font-mono text-slate-600 dark:text-slate-300">reviewer@docuagent.local</code>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-3 text-xs sm:text-sm">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Morgan Vance"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Work Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="m.vance@enterprise.com"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Password (8+ chars)
                      </label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Role
                      </label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as UserRole)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
                      >
                        <option value="reviewer">Reviewer</option>
                        <option value="viewer">Auditor / Viewer</option>
                        <option value="applicant">Applicant</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>
                  </div>

                  {/* Mandatory Affirmative Terms Acceptance Checkbox */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <label className="flex items-start space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => {
                          setTermsAccepted(e.target.checked);
                          if (e.target.checked) setErrorMsg(null);
                        }}
                        className="w-4 h-4 mt-0.5 rounded text-cyan-600 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-cyan-500 cursor-pointer shrink-0"
                      />
                      <span className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                        I agree to the{' '}
                        <button
                          type="button"
                          onClick={onOpenTerms}
                          className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold cursor-pointer"
                        >
                          Terms of Use
                        </button>{' '}
                        and acknowledge the{' '}
                        <button
                          type="button"
                          onClick={onOpenDataCollection}
                          className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold cursor-pointer"
                        >
                          Data Collection &amp; Privacy Transparency
                        </button>{' '}
                        disclosures.
                      </span>
                    </label>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isLoading || !termsAccepted}
                      className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs tracking-tight transition-colors cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      {isLoading && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>Create Account</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
