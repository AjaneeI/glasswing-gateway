'use client';
import { useRouter } from 'next/navigation';
import { useGateway } from '@/components/gateway/provider';
import { securityPolicies } from '@/lib/mock-data/security';
import { getSecurityPoliciesReport } from '@/lib/security-policies';
import type { ScannedSite } from '@/lib/agent/types';
import type { ScanConfig } from '@/lib/agent/contracts';
import { defaultScanConfig } from '@/lib/agent/intake';
import type { Environment, SecurityPolicy } from '@/lib/types';
import { CheckCircle2, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
interface AppState {
  environment: Environment;
  setEnvironment: (v: Environment) => void;
  scanning: boolean;
  scanProgress: number;
  runScan: () => void;
  lastScanned: string;
  scanNumber: number;
  notify: (message: string) => void;
  policies: SecurityPolicy[];
  savePolicy: (policy: SecurityPolicy) => void;
  resolved: string[];
  resolve: (id: string) => void;
  verified: string[];
  verify: (id: string) => void;
  scanSite: ScannedSite | null;
  setScanSite: (site: ScannedSite | null) => void;
  scanConfig: ScanConfig;
  setScanConfig: (config: ScanConfig) => void;
}
const AppContext = createContext<AppState | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [environment, setEnvironment] = useState<Environment>('Production');
  const router = useRouter();
  const { activeScan, dashboard } = useGateway();
  const scanning = activeScan?.status === 'running' || activeScan?.status === 'queued';
  const scanProgress = activeScan?.sessions.length
    ? Math.round(
        (activeScan.sessions.filter((session) => !['queued', 'running'].includes(session.status))
          .length /
          activeScan.sessions.length) *
          100,
      )
    : 0;
  const latest = dashboard?.scans[0];
  const lastScanned = latest?.completedAt
    ? new Date(latest.completedAt).toLocaleString()
    : 'No completed scans';
  const scanNumber = dashboard?.totalScans || 0;
  const [toast, setToast] = useState('');
  const [policies, setPolicies] = useState(securityPolicies);
  const [resolved, setResolved] = useState<string[]>([]);
  const [verified, setVerified] = useState<string[]>([]);
  const [scanSite, setScanSite] = useState<ScannedSite | null>(null);
  const [scanConfig, setScanConfig] = useState<ScanConfig>(defaultScanConfig);
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 5500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    let cancelled = false;
    getSecurityPoliciesReport().then((result) => {
      if (!cancelled) setPolicies(result.policies);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const runScan = () => router.push('/discover');
  return (
    <AppContext.Provider
      value={{
        environment,
        setEnvironment,
        scanning,
        scanProgress,
        runScan,
        lastScanned,
        scanNumber,
        notify,
        policies,
        savePolicy: (p) =>
          setPolicies((current) =>
            current.some((item) => item.id === p.id)
              ? current.map((item) => (item.id === p.id ? p : item))
              : [...current, p],
          ),
        resolved,
        resolve: (id) => setResolved((ids) => (ids.includes(id) ? ids : [...ids, id])),
        verified,
        verify: (id) => setVerified((ids) => (ids.includes(id) ? ids : [...ids, id])),
        scanSite,
        setScanSite,
        scanConfig,
        setScanConfig,
      }}
    >
      {children}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          <span>{toast}</span>
          <button onClick={() => setToast('')} aria-label="Dismiss notification">
            <X size={15} />
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp requires AppProvider');
  return value;
}
