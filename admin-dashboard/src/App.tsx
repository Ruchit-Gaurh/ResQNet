import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { apiService } from './services/api';
import { DisasterCase, MatchCandidate, DisasterZone, FacilityLocation, MeshNodeStatus, VerificationAuditEntry, PhoneMeshCluster } from './types';
import { Navbar } from './components/layout/Navbar';
import { CommandTabBar } from './components/layout/CommandTabBar';
import { CommandExecutiveBanner } from './components/layout/CommandExecutiveBanner';
import { IncidentDispatchPanel } from './components/layout/IncidentDispatchPanel';
import { NavTab } from './components/layout/Sidebar';
import { VerificationQueue } from './pages/VerificationQueue';
import { DuplicateConsolidation } from './pages/DuplicateConsolidation';
import { DisasterMapPage } from './pages/DisasterMapPage';
import { NetworkStatusPage } from './pages/NetworkStatusPage';
import { GoldenDemoPage } from './pages/GoldenDemoPage';
import { AdminLoginScreen } from './components/auth/AdminLoginScreen';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('map');
  const [cases, setCases] = useState<DisasterCase[]>([]);
  const [matches, setMatches] = useState<MatchCandidate[]>([]);
  const [zones, setZones] = useState<DisasterZone[]>([]);
  const [facilities, setFacilities] = useState<FacilityLocation[]>([]);
  const [meshNodes, setMeshNodes] = useState<MeshNodeStatus[]>([]);
  const [auditLogs, setAuditLogs] = useState<VerificationAuditEntry[]>([]);
  const [phoneClusters, setPhoneClusters] = useState<PhoneMeshCluster[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [authenticated, setAuthenticated] = useState(
    !apiService.isLive() || apiService.isAdminAuthenticated()
  );
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>();
  const [loadError, setLoadError] = useState<string>();

  const loadData = async () => {
    try {
      const [c, m, z, f, n, a, p] = await Promise.all([
        apiService.getCases(),
        apiService.getAllMatches(),
        apiService.getZones(),
        apiService.getFacilities(),
        apiService.getMeshNodes(),
        apiService.getAuditLogs(),
        apiService.getPhoneClusters()
      ]);
      setCases(c);
      setMatches(m);
      setZones(z);
      setFacilities(f);
      setMeshNodes(n);
      setAuditLogs(a);
      setPhoneClusters(p);
      setSelectedCaseId((current) => current || c[0]?.caseId || '');
      setLastUpdatedAt(new Date());
      setLoadError(undefined);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Live data refresh failed.');
    }
  };

  useEffect(() => {
    const unsubscribe = apiService.subscribe(() => {
      setAuthenticated(!apiService.isLive() || apiService.isAdminAuthenticated());
    });
    if (!authenticated) return unsubscribe;

    void loadData();
    const pollingTimer = window.setInterval(() => void loadData(), 5_000);
    return () => {
      window.clearInterval(pollingTimer);
      unsubscribe();
    };
  }, [authenticated]);

  const handleVerify = async (
    matchId: string,
    reviewerName: string,
    notes?: string,
    evidenceUsed?: string[]
  ) => {
    await apiService.verifyMatch(matchId, reviewerName, notes, evidenceUsed);
    loadData();
  };

  const handleReject = async (matchId: string, reviewerName: string, notes?: string) => {
    await apiService.rejectMatch(matchId, reviewerName, notes);
    loadData();
  };

  const handleMerge = async (canonicalCaseId: string, duplicateCaseIds: string[], reason: string) => {
    await apiService.mergeCases(canonicalCaseId, duplicateCaseIds, reason);
    loadData();
  };

  const pendingMatchesCount = matches.filter((m) => m.status === 'PENDING_REVIEW').length;

  if (apiService.isLive() && !authenticated) {
    return (
      <AdminLoginScreen
        onAuthenticated={() => setAuthenticated(true)}
        onUseDemo={() => {
          apiService.setMode(false);
          setAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-slate-900 flex flex-col selection:bg-blue-600 selection:text-white antialiased">
      {/* 1. macOS Command Window Header */}
      <Navbar
        onRefresh={loadData}
        onLogout={() => apiService.logoutAdmin()}
        lastUpdatedAt={lastUpdatedAt}
        loadError={loadError}
      />

      <main className="flex-1 p-3 md:p-4 max-w-[1780px] w-full mx-auto space-y-3">
        {/* 2. Top Executive Telemetry Banner (3 Cards: Severity, Decision, Key Biomarkers) */}
        <CommandExecutiveBanner
          cases={cases}
          matches={matches}
          onNavigateToVerification={() => setCurrentTab('verification')}
          onNavigateToDemo={() => setCurrentTab('demo')}
        />

        {/* 3. Horizontal Command Tab Navigation Bar */}
        <CommandTabBar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          pendingMatchesCount={pendingMatchesCount}
        />

        {/* 4. Operational Workspace: Left Parameters Rail + Main Viewport */}
        <div className="flex flex-col lg:flex-row gap-3 items-start">
          {/* Left Dispatch & Input Rail */}
          <IncidentDispatchPanel
            cases={cases}
            selectedCaseId={selectedCaseId}
            onSelectCase={(id) => setSelectedCaseId(id)}
            onTriggerRunMatch={() => setCurrentTab('verification')}
            onExportReport={() => alert('Exporting ResQNet Situation Report (PDF / JSON Schema v1.0)...')}
            onReset={() => loadData()}
          />

          {/* Main Operational Viewport with Smooth Page Transitions */}
          <div className="flex-1 w-full min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {currentTab === 'map' && (
                  <DisasterMapPage
                    zones={zones}
                    facilities={facilities}
                    meshNodes={meshNodes}
                    cases={cases}
                    phoneClusters={phoneClusters}
                  />
                )}

                {currentTab === 'verification' && (
                  <VerificationQueue
                    matches={matches}
                    cases={cases}
                    onVerify={handleVerify}
                    onReject={handleReject}
                  />
                )}

                {currentTab === 'duplicates' && (
                  <DuplicateConsolidation cases={cases} onMerge={handleMerge} />
                )}

                {currentTab === 'network' && (
                  <NetworkStatusPage nodes={meshNodes} />
                )}

                {currentTab === 'demo' && (
                  <GoldenDemoPage
                    onNavigateToVerification={() => setCurrentTab('verification')}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
