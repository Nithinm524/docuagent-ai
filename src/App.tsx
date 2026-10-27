import React, { useState, useEffect } from 'react';
import { Navbar, UserSession } from './components/Navbar.tsx';
import { LandingPageView } from './components/LandingPageView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { UploadView } from './components/UploadView.tsx';
import { CaseDetailView } from './components/CaseDetailView.tsx';
import { ReviewerQueuesView } from './components/ReviewerQueuesView.tsx';
import { ScreeningReportModal } from './components/ScreeningReportModal.tsx';
import { AuditReportsView } from './components/AuditReportsView.tsx';
import { DiagnosticsModal } from './components/DiagnosticsModal.tsx';
import { PrivacyPolicyView } from './components/PrivacyPolicyView.tsx';
import { TermsView } from './components/TermsView.tsx';
import { CookiePolicyView } from './components/CookiePolicyView.tsx';
import { DpdpReadinessView } from './components/DpdpReadinessView.tsx';
import { DataCollectionPrivacyView } from './components/DataCollectionPrivacyView.tsx';
import { PreLaunchLegalChecklistModal } from './components/PreLaunchLegalChecklistModal.tsx';
import { NotificationPreferencesModal } from './components/NotificationPreferencesModal.tsx';
import { SecurityPrivacyRiskModal } from './components/SecurityPrivacyRiskModal.tsx';
import { CookieConsentBanner } from './components/CookieConsentBanner.tsx';
import { NotFoundView } from './components/NotFoundView.tsx';
import { usePageMetadata, PAGE_METADATA } from './utils/usePageMetadata.ts';
import { CaseRecord, ReviewerQueue, CaseStatus } from './shared/types.ts';
import { APP_VERSION } from './shared/version.ts';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { AuthPage } from './components/auth/AuthPage.tsx';
import { AuthLoadingScreen } from './components/auth/AuthLoadingScreen.tsx';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  X,
  ArrowLeft
} from 'lucide-react';

interface NotificationState {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

function AppContent() {
  const [isLandingPage, setIsLandingPage] = useState<boolean>(() => {
    try {
      const pathname = window.location.pathname;
      const urlParams = new URLSearchParams(window.location.search);
      // Workspace deep routes
      if (pathname.startsWith('/app')) {
        return false;
      }
      if (
        urlParams.get('tab') ||
        urlParams.get('case') ||
        urlParams.get('page') ||
        urlParams.get('error') ||
        urlParams.get('workspace')
      ) {
        return false;
      }
      // Clean root route '/' defaults to public marketing landing page
      if (pathname === '/' || pathname === '') {
        return true;
      }
    } catch {}
    return false;
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'queues' | 'reports'>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab') as any;
      if (tabParam && ['dashboard', 'upload', 'queues', 'reports'].includes(tabParam)) {
        return tabParam;
      }
      const saved = localStorage.getItem('docuagent_active_tab') as any;
      if (saved && ['dashboard', 'upload', 'queues', 'reports'].includes(saved)) {
        return saved;
      }
    } catch {}
    return 'dashboard';
  });

  const [specialPage, setSpecialPage] = useState<'privacy' | 'terms' | 'cookies' | 'dpdp' | 'data-collection' | null>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const pageParam = urlParams.get('page');
      if (pageParam === 'privacy' || pageParam === 'terms' || pageParam === 'cookies' || pageParam === 'dpdp' || pageParam === 'data-collection') {
        return pageParam as any;
      }
    } catch {}
    return null;
  });

  const [isNotFound, setIsNotFound] = useState<boolean>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const pageParam = urlParams.get('page');
      const tabParam = urlParams.get('tab');
      if (pageParam && !['privacy', 'terms', 'cookies', 'dpdp', 'data-collection'].includes(pageParam)) {
        return true;
      }
      if (tabParam && !['dashboard', 'upload', 'queues', 'reports'].includes(tabParam)) {
        return true;
      }
      if (urlParams.get('error') === 'not_found') {
        return true;
      }
    } catch {}
    return false;
  });

  const [isCookiePreferencesOpen, setIsCookiePreferencesOpen] = useState(false);
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [isLegalChecklistOpen, setIsLegalChecklistOpen] = useState(false);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const {
    currentUser: fbUser,
    userSession,
    loading: authLoading,
    signOutUser
  } = useAuth();
  const currentUser = userSession;

  // Capture unauthenticated deep link visits (e.g. ?tab=queues or ?case=xyz)
  useEffect(() => {
    if (!fbUser && !authLoading) {
      try {
        const search = window.location.search;
        if (search && (search.includes('tab=') || search.includes('case='))) {
          sessionStorage.setItem('docuagent_intended_redirect', search);
        }
      } catch {}
    }
  }, [fbUser, authLoading]);

  // Secure sign-out: clear state, wipe tokens, prevent browser history replay
  const handleLogout = async () => {
    try {
      await signOutUser();
      setSelectedCaseId(null);
      setActiveTab('dashboard');
      setIsLandingPage(false);
      localStorage.removeItem('docuagent_selected_case');
      sessionStorage.removeItem('docuagent_intended_redirect');
      window.history.replaceState(null, '', '/');
      notify('info', 'You have been signed out securely.');
    } catch (err: any) {
      console.error('Sign-out error:', err);
    }
  };

  // Restore deep link upon successful authentication
  const handleAuthSuccess = () => {
    try {
      const savedRedirect = sessionStorage.getItem('docuagent_intended_redirect');
      if (savedRedirect) {
        sessionStorage.removeItem('docuagent_intended_redirect');
        const params = new URLSearchParams(savedRedirect);
        const tabParam = params.get('tab') as any;
        const caseParam = params.get('case');
        if (tabParam && ['dashboard', 'upload', 'queues', 'reports'].includes(tabParam)) {
          setActiveTab(tabParam);
        }
        if (caseParam) {
          setSelectedCaseId(caseParam);
        }
        setIsLandingPage(false);
        window.history.replaceState(null, '', `/app${savedRedirect}`);
        notify('success', 'Access granted. Welcome to DOCUAGENT AI.');
        return;
      }
    } catch {}
    setIsLandingPage(false);
    window.history.replaceState(null, '', '/app');
    notify('success', 'Access granted. Welcome to DOCUAGENT AI.');
  };

  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const caseParam = urlParams.get('case');
      if (caseParam) return caseParam;
      return localStorage.getItem('docuagent_selected_case');
    } catch {}
    return null;
  });

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{ storage_type: string; case_count: number } | undefined>();
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const notify = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setNotification({
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      message
    });
  };

  // Auto-dismiss notifications after 6 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification((prev) => (prev?.id === notification.id ? null : prev));
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Handle popstate for browser forward/back navigation
  useEffect(() => {
    const handlePopState = () => {
      try {
        const pathname = window.location.pathname;
        const urlParams = new URLSearchParams(window.location.search);
        const pageParam = urlParams.get('page');
        const tabParam = urlParams.get('tab') as any;
        const caseParam = urlParams.get('case');
        const isErr = urlParams.get('error') === 'not_found';

        if (pathname === '/' && !urlParams.toString()) {
          setIsLandingPage(true);
          setSpecialPage(null);
          setSelectedCaseId(null);
          setIsNotFound(false);
          return;
        }

        setIsLandingPage(false);
        setIsNotFound(isErr);
        if (pageParam && ['privacy', 'terms', 'cookies', 'dpdp', 'data-collection'].includes(pageParam)) {
          setSpecialPage(pageParam as any);
        } else {
          setSpecialPage(null);
        }
        if (caseParam) {
          setSelectedCaseId(caseParam);
        } else {
          setSelectedCaseId(null);
        }
        if (tabParam && ['dashboard', 'upload', 'queues', 'reports'].includes(tabParam)) {
          setActiveTab(tabParam);
        }
      } catch {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync state to URL and localStorage for seamless refresh persistence
  useEffect(() => {
    try {
      localStorage.setItem('docuagent_active_tab', activeTab);
      if (selectedCaseId) {
        localStorage.setItem('docuagent_selected_case', selectedCaseId);
      } else {
        localStorage.removeItem('docuagent_selected_case');
      }

      if (isLandingPage) {
        if (window.location.pathname !== '/' || window.location.search) {
          window.history.replaceState(null, '', '/');
        }
        return;
      }

      // Update URL query parameters
      const params = new URLSearchParams();
      const targetPath = window.location.pathname.startsWith('/app') ? '/app' : '/';

      if (isNotFound) {
        params.set('error', 'not_found');
      } else if (specialPage) {
        params.set('page', specialPage);
      } else if (selectedCaseId) {
        params.set('case', selectedCaseId);
      } else {
        params.set('tab', activeTab);
      }
      const newUrl = `${targetPath}?${params.toString()}`;
      window.history.replaceState(null, '', newUrl);
    } catch (e) {
      console.warn('Storage/URL sync notice:', e);
    }
  }, [isLandingPage, activeTab, selectedCaseId, specialPage, isNotFound]);

  // Fetch initial cases and stats
  const fetchCases = async () => {
    try {
      const res = await fetch('/api/cases');
      if (res.ok) {
        const data = await res.json();
        setCases(data);
      }
      const storageRes = await fetch('/api/storage-info');
      if (storageRes.ok) {
        const sInfo = await storageRes.json();
        setStorageInfo(sInfo);
      }
    } catch (err: any) {
      console.error('Failed to fetch cases:', err);
      notify('error', 'Unable to reach the document service. Please verify your connection.');
    }
  };

  useEffect(() => {
    if (fbUser) {
      fetchCases();
    }
  }, [fbUser]);

  // Compute metrics
  const stats = {
    total: cases.length,
    readyForReview: cases.filter((c) => c.status === 'Ready for Review').length,
    needsMoreInfo: cases.filter((c) => c.status === 'Needs More Information').length,
    priorityReview: cases.filter((c) => c.status === 'Priority Review').length,
    completed: cases.filter((c) => c.status === 'Review Completed').length,
    failed: cases.filter((c) => c.status === 'Processing Failed').length,
    queues: {
      general: cases.filter((c) => c.assigned_queue === 'General Review' && c.status !== 'Review Completed').length,
      missing_info: cases.filter((c) => c.assigned_queue === 'Missing Information' && c.status !== 'Review Completed').length,
      priority: cases.filter((c) => c.assigned_queue === 'Priority Review' && c.status !== 'Review Completed').length
    },
    byDocType: cases.reduce((acc, c) => {
      acc[c.document_type] = (acc[c.document_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };

  const selectedCase = cases.find((c) => c.case_id === selectedCaseId);

  // Dynamic Page Title & SEO Meta Descriptions
  const currentMetadata = isNotFound
    ? PAGE_METADATA.notFound
    : isLandingPage
    ? PAGE_METADATA.home
    : specialPage === 'privacy'
    ? PAGE_METADATA.privacy
    : specialPage === 'terms'
    ? PAGE_METADATA.terms
    : specialPage === 'cookies'
    ? PAGE_METADATA.cookies
    : specialPage === 'dpdp'
    ? PAGE_METADATA.dpdp
    : specialPage === 'data-collection'
    ? PAGE_METADATA.dataCollection
    : selectedCase
    ? {
        title: `${selectedCase.case_number} · Case Review | DOCUAGENT AI`,
        description: `Inspect extracted fields, deterministic validation findings, and execute human review actions for case ${selectedCase.case_number}.`,
        canonicalPath: `/?case=${selectedCase.case_id}`
      }
    : PAGE_METADATA[activeTab] || PAGE_METADATA.dashboard;

  usePageMetadata(currentMetadata);

  const handleOpenWorkspace = (tab: 'dashboard' | 'upload' | 'queues' | 'reports' = 'dashboard') => {
    setIsLandingPage(false);
    setIsNotFound(false);
    setSpecialPage(null);
    setSelectedCaseId(null);
    setActiveTab(tab);
    window.history.pushState(null, '', `/app?tab=${tab}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateHome = () => {
    setIsLandingPage(true);
    setIsNotFound(false);
    setSpecialPage(null);
    setSelectedCaseId(null);
    window.history.pushState(null, '', '/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCase = (caseId: string) => {
    setIsLandingPage(false);
    setIsNotFound(false);
    setSpecialPage(null);
    setSelectedCaseId(caseId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCaseProcessed = async (caseId: string) => {
    await fetchCases();
    setIsNotFound(false);
    setSelectedCaseId(caseId);
    notify('success', 'Document uploaded and evaluated successfully. Ready for review.');
  };

  const handleRunSample = async (scenarioId: string) => {
    setLoadingSampleId(scenarioId);
    try {
      const res = await fetch(`/api/samples/load/${scenarioId}`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const newCase = await res.json();
      await fetchCases();
      setIsNotFound(false);
      setSelectedCaseId(newCase.case_id);
      notify('success', `Sample scenario loaded. Case ${newCase.case_number} ready for inspection.`);
    } catch (err: any) {
      notify('error', `Failed to execute sample scenario: ${err.message}`);
    } finally {
      setLoadingSampleId(null);
    }
  };

  const handleResetSeed = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/cases/reset-seed', { method: 'POST' });
      if (res.ok) {
        await fetchCases();
        setSelectedCaseId(null);
        setActiveTab('dashboard');
        notify('info', 'Database reset to default synthetic demo cases.');
      }
    } catch (err: any) {
      notify('error', 'Failed to reset test cases. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  // Field edit handler
  const handleFieldUpdated = async (fieldId: string, reviewedValue: string) => {
    if (!selectedCaseId) return;
    try {
      const res = await fetch(`/api/cases/${selectedCaseId}/fields/${fieldId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewedValue, reviewerLabel: 'Human Specialist' })
      });
      if (res.ok) {
        const updated = await res.json();
        setCases((prev) => prev.map((c) => (c.case_id === updated.case_id ? updated : c)));
        notify('success', 'Field attribute corrected and validation rules re-evaluated.');
      } else {
        throw new Error(`Server returned status ${res.status}`);
      }
    } catch (err: any) {
      notify('error', 'Failed to update field value. Please try again.');
    }
  };

  // Finding resolved handler
  const handleFindingResolved = async (findingId: string, resolved: boolean, notes?: string) => {
    if (!selectedCaseId) return;
    try {
      const res = await fetch(`/api/cases/${selectedCaseId}/findings/${findingId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved, notes, reviewerLabel: 'Human Specialist' })
      });
      if (res.ok) {
        const updated = await res.json();
        setCases((prev) => prev.map((c) => (c.case_id === updated.case_id ? updated : c)));
        notify('success', resolved ? 'Validation finding marked as resolved.' : 'Validation finding reopened.');
      } else {
        throw new Error(`Server returned status ${res.status}`);
      }
    } catch (err: any) {
      notify('error', 'Failed to update finding status. Please try again.');
    }
  };

  // Review action handler
  const handleReviewAction = async (
    targetCaseId: string,
    action: string,
    notes: string,
    newQueue?: ReviewerQueue,
    newStatus?: CaseStatus
  ) => {
    setIsProcessingAction(true);
    try {
      const res = await fetch(`/api/cases/${targetCaseId}/review-action`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          notes,
          reviewerLabel: 'Human Specialist',
          newQueue,
          newStatus
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setCases((prev) => prev.map((c) => (c.case_id === updated.case_id ? updated : c)));
        notify('success', 'Reviewer decision and notes saved successfully.');
      } else {
        throw new Error(`Server returned status ${res.status}`);
      }
    } catch (err: any) {
      notify('error', 'Failed to record reviewer decision.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Re-run agent workflow
  const handleReRunAgent = async () => {
    if (!selectedCaseId) return;
    setIsProcessingAction(true);
    try {
      const res = await fetch(`/api/cases/${selectedCaseId}/re-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer: 'Human Specialist' })
      });
      if (res.ok) {
        const updated = await res.json();
        setCases((prev) => prev.map((c) => (c.case_id === updated.case_id ? updated : c)));
        notify('success', 'Agent re-evaluation complete. Extracted fields and rules refreshed.');
      } else {
        throw new Error(`Server returned status ${res.status}`);
      }
    } catch (err: any) {
      notify('error', 'Agent re-evaluation failed. Please try again.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Regenerate Gemini summary
  const handleRegenerateSummary = async () => {
    if (!selectedCaseId) return;
    setIsProcessingAction(true);
    try {
      const res = await fetch(`/api/cases/${selectedCaseId}/generate-summary`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.case) {
          setCases((prev) => prev.map((c) => (c.case_id === data.case.case_id ? data.case : c)));
          notify('success', 'Executive screening summary updated.');
        }
      } else {
        throw new Error(`Server returned status ${res.status}`);
      }
    } catch (err: any) {
      notify('error', 'Failed to generate summary.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    try {
      const res = await fetch(`/api/cases/${caseId}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedCaseId(null);
        await fetchCases();
        notify('success', 'Case record deleted successfully.');
      } else {
        throw new Error(`Server returned status ${res.status}`);
      }
    } catch (err: any) {
      notify('error', 'Failed to delete case record.');
    }
  };

  const handlePurgeCaseData = async (caseId: string) => {
    try {
      const res = await fetch(`/api/cases/${caseId}/purge-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Data Minimisation & Erasure Workflow' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.case) {
          setCases((prev) => prev.map((c) => (c.case_id === data.case.case_id ? data.case : c)));
        }
        await fetchCases();
        notify('success', 'Document payload and personal identifiers expunged under data minimisation.');
      } else {
        throw new Error(`Server returned status ${res.status}`);
      }
    } catch (err: any) {
      notify('error', 'Failed to purge document data.');
    }
  };

  const handleWithdrawConsent = async (caseId: string) => {
    try {
      const res = await fetch(`/api/cases/${caseId}/withdraw-consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Data Principal requested consent withdrawal' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.case) {
          setCases((prev) => prev.map((c) => (c.case_id === data.case.case_id ? data.case : c)));
        }
        await fetchCases();
        notify('success', 'Consent withdrawal recorded and document payload permanently erased.');
      } else {
        throw new Error(`Server returned status ${res.status}`);
      }
    } catch (err: any) {
      notify('error', 'Failed to process consent withdrawal.');
    }
  };

  // 1. Loading gate: Show premium loading screen while resolving authentication
  if (authLoading) {
    return <AuthLoadingScreen message="Verifying secure access credentials..." />;
  }

  // 2. Unauthenticated visitors: Force authentication before accessing private application
  if (!fbUser) {
    // If visitor opened a public policy view (e.g. Terms, Privacy, Cookies, DPDP, Data Collection)
    if (specialPage) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col font-sans">
          <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0c1220]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <button
                onClick={() => setSpecialPage(null)}
                className="inline-flex items-center space-x-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Sign In</span>
              </button>
              <span className="text-xs font-bold tracking-tight text-slate-900 dark:text-white">
                DOCUAGENT AI
              </span>
            </div>
          </header>
          <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
            {specialPage === 'privacy' && <PrivacyPolicyView onBack={() => setSpecialPage(null)} />}
            {specialPage === 'terms' && <TermsView onBack={() => setSpecialPage(null)} onOpenPrivacy={() => setSpecialPage('privacy')} />}
            {specialPage === 'cookies' && <CookiePolicyView onBack={() => setSpecialPage(null)} onOpenPreferences={() => setIsCookiePreferencesOpen(true)} onOpenPrivacy={() => setSpecialPage('privacy')} />}
            {specialPage === 'dpdp' && <DpdpReadinessView onBack={() => setSpecialPage(null)} onOpenPrivacy={() => setSpecialPage('privacy')} onOpenCookies={() => setSpecialPage('cookies')} />}
            {specialPage === 'data-collection' && <DataCollectionPrivacyView onBack={() => setSpecialPage(null)} onOpenTerms={() => setSpecialPage('terms')} onOpenPrivacy={() => setSpecialPage('privacy')} onOpenCookies={() => setSpecialPage('cookies')} />}
          </main>
        </div>
      );
    }

    // Default unauthenticated view: Cinematic 3D Holographic Shield Auth Page
    return (
      <AuthPage
        onSuccess={handleAuthSuccess}
        onOpenPage={(page) => {
          setSpecialPage(page);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950 transition-colors">
      {/* Accessible Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-cyan-600 focus:text-white focus:rounded-lg focus:shadow-xl focus:outline-hidden text-xs font-semibold"
      >
        Skip to main content
      </a>

      {/* Sticky Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setIsLandingPage(false);
          setIsNotFound(false);
          setSpecialPage(null);
          setActiveTab(tab);
          setSelectedCaseId(null);
        }}
        isLandingPage={isLandingPage}
        onNavigateHome={handleNavigateHome}
        onOpenWorkspace={handleOpenWorkspace}
        storageInfo={storageInfo}
        onResetSeed={handleResetSeed}
        isResetting={isResetting}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenNotifications={() => setIsNotificationModalOpen(true)}
        onOpenLegalChecklist={() => setIsLegalChecklistOpen(true)}
        onOpenDataCollection={() => {
          setIsLandingPage(false);
          setIsNotFound(false);
          setSpecialPage('data-collection');
          setSelectedCaseId(null);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 outline-hidden">
        {/* Unified Accessible Notification Banner */}
        {notification && (
          <div
            role={notification.type === 'error' ? 'alert' : 'status'}
            aria-live={notification.type === 'error' ? 'assertive' : 'polite'}
            className={`mb-6 p-4 rounded-xl border flex items-center justify-between text-xs transition-all shadow-xs ${
              notification.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : notification.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                : notification.type === 'warning'
                ? 'bg-amber-50 dark:bg-amber-950/70 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                : 'bg-cyan-50 dark:bg-cyan-950/70 border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-200'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />}
              {notification.type === 'error' && <AlertOctagon className="w-4 h-4 text-rose-500 shrink-0" aria-hidden="true" />}
              {notification.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />}
              {notification.type === 'info' && <Info className="w-4 h-4 text-cyan-500 shrink-0" aria-hidden="true" />}
              <span className="font-medium">{notification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="ml-3 p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-current cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Not Found View */}
        {isNotFound ? (
          <NotFoundView
            onGoHome={() => {
              setIsNotFound(false);
              setSpecialPage(null);
              setSelectedCaseId(null);
              setActiveTab('dashboard');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onGoUpload={() => {
              setIsNotFound(false);
              setSpecialPage(null);
              setSelectedCaseId(null);
              setActiveTab('upload');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : specialPage === 'privacy' ? (
          <PrivacyPolicyView
            onBack={() => {
              setSpecialPage(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : specialPage === 'terms' ? (
          <TermsView
            onBack={() => {
              setSpecialPage(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenPrivacy={() => {
              setSpecialPage('privacy');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : specialPage === 'cookies' ? (
          <CookiePolicyView
            onBack={() => {
              setSpecialPage(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenPreferences={() => setIsCookiePreferencesOpen(true)}
            onOpenPrivacy={() => {
              setSpecialPage('privacy');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : specialPage === 'dpdp' ? (
          <DpdpReadinessView
            onBack={() => {
              setSpecialPage(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenPrivacy={() => {
              setSpecialPage('privacy');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenCookies={() => {
              setSpecialPage('cookies');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : specialPage === 'data-collection' ? (
          <DataCollectionPrivacyView
            onBack={() => {
              setSpecialPage(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenTerms={() => {
              setSpecialPage('terms');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenPrivacy={() => {
              setSpecialPage('privacy');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenCookies={() => {
              setSpecialPage('cookies');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : isLandingPage ? (
          <LandingPageView
            onOpenWorkspace={handleOpenWorkspace}
            onOpenPage={(p) => {
              setIsLandingPage(false);
              setIsNotFound(false);
              setSpecialPage(p);
              setSelectedCaseId(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenRiskReport={() => setIsRiskModalOpen(true)}
          />
        ) : selectedCase ? (
          <CaseDetailView
            caseData={selectedCase}
            onBack={() => setSelectedCaseId(null)}
            onFieldUpdated={handleFieldUpdated}
            onFindingResolved={handleFindingResolved}
            onReviewAction={(action, notes, newQueue, newStatus) =>
              handleReviewAction(selectedCase.case_id, action, notes, newQueue, newStatus)
            }
            onReRunAgent={handleReRunAgent}
            onOpenReport={() => setIsReportModalOpen(true)}
            onDeleteCase={handleDeleteCase}
            onPurgeCaseData={handlePurgeCaseData}
            onWithdrawConsent={handleWithdrawConsent}
            isProcessing={isProcessingAction}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                cases={cases}
                stats={stats}
                onSelectCase={handleSelectCase}
                onOpenUpload={() => setActiveTab('upload')}
                onRunSample={handleRunSample}
                loadingSampleId={loadingSampleId}
              />
            )}

            {activeTab === 'upload' && (
              <UploadView
                onCaseProcessed={handleCaseProcessed}
                onSelectCase={handleSelectCase}
                onViewQueue={() => {
                  setActiveTab('queues');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onRunSample={handleRunSample}
                loadingSampleId={loadingSampleId}
                onOpenPrivacy={() => {
                  setSpecialPage('privacy');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onOpenTerms={() => {
                  setSpecialPage('terms');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onOpenDataCollection={() => {
                  setSpecialPage('data-collection');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}

            {activeTab === 'queues' && (
              <ReviewerQueuesView
                cases={cases}
                onSelectCase={handleSelectCase}
                onReviewAction={handleReviewAction}
              />
            )}

            {activeTab === 'reports' && (
              <AuditReportsView
                cases={cases}
                onSelectCase={(id) => {
                  setSelectedCaseId(id);
                }}
                onOpenReportForCase={(c) => {
                  setSelectedCaseId(c.case_id);
                  setIsReportModalOpen(true);
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Full Screening Report Modal */}
      {isReportModalOpen && selectedCase && (
        <ScreeningReportModal
          caseData={selectedCase}
          onClose={() => setIsReportModalOpen(false)}
          onRegenerateSummary={handleRegenerateSummary}
          isRegenerating={isProcessingAction}
        />
      )}

      {/* Administrative & Diagnostics Modal */}
      <DiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />

      {/* Architecture Privacy & Security Risk Report Modal */}
      <SecurityPrivacyRiskModal
        isOpen={isRiskModalOpen}
        onClose={() => setIsRiskModalOpen(false)}
      />

      {/* Pre-Launch Legal & Compliance Checklist Modal */}
      <PreLaunchLegalChecklistModal
        isOpen={isLegalChecklistOpen}
        onClose={() => setIsLegalChecklistOpen(false)}
        onOpenPrivacy={() => {
          setIsLegalChecklistOpen(false);
          setIsNotFound(false);
          setSpecialPage('privacy');
          setSelectedCaseId(null);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenDataCollection={() => {
          setIsLegalChecklistOpen(false);
          setIsNotFound(false);
          setSpecialPage('data-collection');
          setSelectedCaseId(null);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenTerms={() => {
          setIsLegalChecklistOpen(false);
          setIsNotFound(false);
          setSpecialPage('terms');
          setSelectedCaseId(null);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Email Notification Preferences & History Modal */}
      <NotificationPreferencesModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        onNotify={(type, msg) => notify(type, msg)}
      />

      {/* Cookie Consent Banner & Preferences Modal */}
      <CookieConsentBanner
        isPreferencesModalOpen={isCookiePreferencesOpen}
        setIsPreferencesModalOpen={setIsCookiePreferencesOpen}
        onOpenPrivacy={() => {
          setIsNotFound(false);
          setSpecialPage('privacy');
          setSelectedCaseId(null);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenCookiePolicy={() => {
          setIsNotFound(false);
          setSpecialPage('cookies');
          setSelectedCaseId(null);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Redesigned Professional SaaS Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070b14] pt-10 pb-8 text-xs text-slate-500 dark:text-slate-400 transition-colors no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Main 3 Sections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            
            {/* Section A: Brand */}
            <div className="md:col-span-5 space-y-3.5">
              <div
                className="flex items-center space-x-2.5 cursor-pointer select-none group"
                onClick={handleNavigateHome}
                tabIndex={0}
                role="button"
                aria-label="DOCUAGENT AI logo, return to homepage"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleNavigateHome();
                  }
                }}
              >
                <div className="flex items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-900/60 p-1.5 border border-slate-800 shrink-0 shadow-xs">
                  <picture className="flex items-center">
                    <source type="image/webp" srcSet="/docuagent-logo.webp" />
                    <img
                      src="/docuagent-logo.png"
                      alt="DOCUAGENT AI logo"
                      width={100}
                      height={24}
                      loading="lazy"
                      decoding="async"
                      className="h-5 sm:h-6 w-auto object-contain"
                    />
                  </picture>
                </div>
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  DOCUAGENT AI
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-sm">
                AI-powered document review and routing.
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
                Assistive AI decision support with authorized human review.
              </p>
            </div>

            {/* Section B: Product & Resources */}
            <div className="md:col-span-3 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200">
                Product &amp; Resources
              </h3>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNotFound(false);
                      setSpecialPage(null);
                      setSelectedCaseId(null);
                      setActiveTab('dashboard');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 rounded text-left"
                  >
                    Dashboard
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNotFound(false);
                      setSpecialPage(null);
                      setSelectedCaseId(null);
                      setActiveTab('upload');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 rounded text-left"
                  >
                    Document Review &amp; Routing Agent
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNotFound(false);
                      setSpecialPage('data-collection');
                      setSelectedCaseId(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 rounded text-left"
                  >
                    Data Collection &amp; Privacy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setIsRiskModalOpen(true)}
                    className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 rounded text-left"
                  >
                    Architecture Risk Report
                  </button>
                </li>
              </ul>
            </div>

            {/* Section C: Legal & Compliance */}
            <div className="md:col-span-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200">
                Legal &amp; Compliance
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNotFound(false);
                      setSpecialPage('privacy');
                      setSelectedCaseId(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 rounded text-left"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNotFound(false);
                      setSpecialPage('cookies');
                      setSelectedCaseId(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 rounded text-left"
                  >
                    Cookie &amp; Storage Policy
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setIsCookiePreferencesOpen(true)}
                    className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 rounded text-left"
                  >
                    Cookie Preferences
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNotFound(false);
                      setSpecialPage('terms');
                      setSelectedCaseId(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 rounded text-left"
                  >
                    Terms of Use
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNotFound(false);
                      setSpecialPage('dpdp');
                      setSelectedCaseId(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 rounded text-left"
                  >
                    DPDP Readiness
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setIsLegalChecklistOpen(true)}
                    className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500 rounded text-left"
                  >
                    Legal Launch Checklist
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Footer Bottom Bar */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 gap-3 text-center sm:text-left">
            <div>
              &copy; {new Date().getFullYear()} DOCUAGENT AI &middot; {APP_VERSION} &middot; AI-assisted results require authorized human review.
            </div>
            <div className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
              Deterministic Schema Validation &middot; Human-in-the-Loop Triage
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
