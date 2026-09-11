import { useState, useEffect } from 'react';
import { apiService } from './services/api';
import { DisasterCase, MatchCandidate, DisasterZone, FacilityLocation, MeshNodeStatus, VerificationAuditEntry } from './types';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { DashboardOverview } from './pages/DashboardOverview';
import { VerificationQueue } from './pages/VerificationQueue';
import { DuplicateConsolidation } from './pages/DuplicateConsolidation';
import { DisasterMapPage } from './pages/DisasterMapPage';
import { NetworkStatusPage } from './pages/NetworkStatusPage';
import { GoldenDemoPage } from './pages/GoldenDemoPage';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [cases, setCases] = useState<DisasterCase[]>([]);
  const [matches, setMatches] = useState<MatchCandidate[]>([]);
  const [zones, setZones] = useState<DisasterZone[]>([]);
  const [facilities, setFacilities] = useState<FacilityLocation[]>([]);
  const [meshNodes, setMeshNodes] = useState<MeshNodeStatus[]>([]);
  const [auditLogs, setAuditLogs] = useState<VerificationAuditEntry[]>([]);

  const loadData = async () => {
    const [c, m, z, f, n, a] = await Promise.all([
      apiService.getCases(),
      apiService.getAllMatches(),
      apiService.getZones(),
      apiService.getFacilities(),
      apiService.getMeshNodes(),
      apiService.getAuditLogs()
    ]);
    setCases(c);
    setMatches(m);
    setZones(z);
    setFacilities(f);
    setMeshNodes(n);
    setAuditLogs(a);
  };

  useEffect(() => {
    loadData();
    return apiService.subscribe(() => {
      loadData();
    });
  }, []);

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

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Fixed Command Navbar */}
      <Navbar onRefresh={loadData} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          pendingMatchesCount={pendingMatchesCount}
        />

        {/* Main Operational Workspace */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {currentTab === 'overview' && (
            <DashboardOverview
              cases={cases}
              matches={matches}
              auditLogs={auditLogs}
              onNavigateToVerification={() => setCurrentTab('verification')}
              onNavigateToDemo={() => setCurrentTab('demo')}
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

          {currentTab === 'map' && (
            <DisasterMapPage
              zones={zones}
              facilities={facilities}
              meshNodes={meshNodes}
              cases={cases}
            />
          )}

          {currentTab === 'network' && (
            <NetworkStatusPage nodes={meshNodes} />
          )}

          {currentTab === 'demo' && (
            <GoldenDemoPage
              onNavigateToVerification={() => setCurrentTab('verification')}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
