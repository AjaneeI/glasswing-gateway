'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import {
  gatewayClient,
  gatewayRequest,
  terminalScan,
  type DashboardData,
} from '@/lib/gateway/client';
import type { Scan } from '@/lib/gateway/schemas';

interface WorkflowState {
  dashboard: DashboardData | null;
  loading: boolean;
  error: string;
  activeScan: Scan | null;
  refresh: () => Promise<void>;
  execute: (scan: Scan) => void;
}
const Context = createContext<WorkflowState | null>(null);
export function GatewayProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [activeScan, setActiveScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [executionError, setExecutionError] = useState('');
  const epoch = useRef(0);
  const pathname = usePathname();
  const enabled = !['/', '/login', '/signup'].includes(pathname) && !pathname.startsWith('/auth/');
  const mounted = useRef(true);
  const running = useRef<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const refresh = useCallback(async () => {
    const currentEpoch = epoch.current;
    setLoading(true);
    try {
      const data = await gatewayClient.dashboard();
      if (mounted.current && epoch.current === currentEpoch) {
        setDashboard(data);
        setError('');
      }
    } catch (error) {
      if (mounted.current && epoch.current === currentEpoch)
        setError(error instanceof Error ? error.message : 'Unable to load scans.');
    } finally {
      if (mounted.current && epoch.current === currentEpoch) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (enabled) void refresh();
    else {
      epoch.current++;
      running.current = null;
      setDashboard(null);
      setActiveScan(null);
      setError('');
      setExecutionError('');
    }
  }, [enabled, refresh]);
  const execute = useCallback(
    (scan: Scan) => {
      if (running.current) return;
      const currentEpoch = epoch.current;
      running.current = scan.id;
      setActiveScan(scan);
      setExecutionError('');
      // Keep this request at the root so navigating to sessions does not cancel the scan.
      void gatewayRequest<Scan>(`/scans/${scan.id}/run`, { method: 'POST' })
        .then((result) => {
          if (mounted.current && epoch.current === currentEpoch) setActiveScan(result);
        })
        .catch((error) => {
          if (mounted.current && epoch.current === currentEpoch)
            setExecutionError(
              `${error instanceof Error ? error.message : 'Execution request disconnected.'} Check the saved scan before retrying.`,
            );
        })
        .finally(() => {
          if (running.current === scan.id) running.current = null;
          if (mounted.current && epoch.current === currentEpoch) void refresh();
        });
    },
    [refresh],
  );
  // On refresh/revisit, reattach to persisted running scans without re-executing them.
  useEffect(() => {
    if (activeScan && !terminalScan(activeScan)) return;
    const runningScan = dashboard?.scans.find((scan) => scan.status === 'running');
    if (!runningScan || runningScan.id === activeScan?.id) return;
    let cancelled = false;
    void gatewayClient
      .scan(runningScan.id)
      .then((scan) => {
        if (!cancelled) setActiveScan(scan);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dashboard, activeScan]);
  useEffect(() => {
    if (!enabled || !activeScan || terminalScan(activeScan)) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const scan = await gatewayClient.scan(activeScan.id, controller.signal);
        if (controller.signal.aborted) return;
        setActiveScan(scan);
        if (terminalScan(scan)) {
          void refresh();
          return;
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setError(error instanceof Error ? error.message : 'Unable to refresh scan progress.');
      }
      timer = setTimeout(poll, 1500);
    };
    timer = setTimeout(poll, 800);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [enabled, activeScan?.id, activeScan?.status, refresh]);
  return (
    <Context.Provider
      value={{ dashboard, loading, error: executionError || error, activeScan, refresh, execute }}
    >
      {children}
    </Context.Provider>
  );
}
export function useGateway() {
  const value = useContext(Context);
  if (!value) throw new Error('GatewayProvider is required.');
  return value;
}
