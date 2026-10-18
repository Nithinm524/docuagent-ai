import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { UploadView } from './components/UploadView.tsx';
import { CaseDetailView } from './components/CaseDetailView.tsx';
import { ReviewerQueuesView } from './components/ReviewerQueuesView.tsx';
import { ScreeningReportModal } from './components/ScreeningReportModal.tsx';
import { AuditReportsView } from './components/AuditReportsView.tsx';
import { CaseRecord, ReviewerQueue, CaseStatus } from './shared/types.ts';

export default function App() {
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
  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{ storage_type: string; case_count: number } | undefined>();
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Sync tab & selected case to localStorage for refresh persistence
  useEffect(() => {
    try {
      localStorage.setItem('docuagent_active_tab', activeTab);
      if (selectedCaseId) {
        localStorage.setItem('docuagent_selected_case', selectedCaseId);
      } else {
        localStorage.removeItem('docuagent_selected_case');
      }
    } catch (e) {
      console.warn('Storage sync error:', e);
    }
  }, [activeTab, selectedCaseId]);

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
    } catch (err) {
      console.error('Failed to fetch cases:', err);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

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

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
  };

  const handleCaseProcessed = async (caseId: string) => {
    await fetchCases();
    setSelectedCaseId(caseId);
  };

  const handleRunSample = async (scenarioId: string) => {
    setLoadingSampleId(scenarioId);
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/samples/load/${scenarioId}`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const newCase = await res.json();
      await fetchCases();
      setSelectedCaseId(newCase.case_id);
    } catch (err: any) {
      setErrorBanner(`Failed to execute sample scenario: ${err.message}`);
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
      }
    } catch (err) {
      console.error(err);
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
      }
    } catch (err) {
      console.error(err);
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
      }
    } catch (err) {
      console.error(err);
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
      }
    } catch (err) {
      console.error(err);
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
      }
    } catch (err) {
      console.error(err);
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
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleDeleteCase = async (caseId: string) => {
    if (!confirm('Are you sure you want to delete this case?')) return;
    try {
      const res = await fetch(`/api/cases/${caseId}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedCaseId(null);
        await fetchCases();
      }
    } catch (err) {
      console.error('Failed to delete case:', err);
    }
  };

  const selectedCase = cases.find((c) => c.case_id === selectedCaseId);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Sticky Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedCaseId(null);
        }}
        storageInfo={storageInfo}
        onResetSeed={handleResetSeed}
        isResetting={isResetting}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {errorBanner && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center justify-between">
            <span>{errorBanner}</span>
            <button onClick={() => setErrorBanner(null)} className="underline hover:text-white">
              Dismiss
            </button>
          </div>
        )}

        {/* Selected Case Detail View */}
        {selectedCase ? (
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
                onRunSample={handleRunSample}
                loadingSampleId={loadingSampleId}
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

      {/* Minimal Professional Footer */}
      <footer className="border-t border-slate-800/80 bg-[#070b14] py-5 text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center space-x-2 text-slate-400">
            <span className="font-bold tracking-tight text-slate-200">DOCUAGENT</span>
            <span className="text-slate-600">·</span>
            <span>Document Intelligence &amp; Review</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Human-reviewed decisions
          </div>
        </div>
      </footer>
    </div>
  );
}
