'use client';
import { useApp } from '@/components/layout/app-provider';
import { MetricCard } from '@/components/ui/metric-card';
import { PageHeading } from '@/components/ui/page-heading';
import {
  Button,
  Card,
  CardHeader,
  Dialog,
  Select,
  SeverityBadge,
  StatusBadge,
} from '@/components/ui/primitives';
import { getSecurityPoliciesReport, mockSecurityPoliciesResult } from '@/lib/security-policies';
import type { SecurityPoliciesScanResult, SecurityPolicy } from '@/lib/types';
import { Check, ChevronRight, LockKeyhole, Pencil, Plus, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
export default function SecurityPage() {
  const { policies, savePolicy, notify } = useApp();
  const [report, setReport] = useState<SecurityPoliciesScanResult>(mockSecurityPoliciesResult);
  useEffect(() => {
    let cancelled = false;
    getSecurityPoliciesReport().then((result) => {
      if (!cancelled) setReport(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const { metrics: securityMetrics, events: securityEvents } = report;
  const [editing, setEditing] = useState<SecurityPolicy | null>(null);
  const [name, setName] = useState('');
  const [scope, setScope] = useState('All sessions');
  const [enforcement, setEnforcement] = useState('Block');
  const [enabled, setEnabled] = useState(true);
  const openEditor = (p?: SecurityPolicy) => {
    setEditing(
      p || {
        id: `POL-${String(policies.length + 1).padStart(3, '0')}`,
        name: '',
        scope: 'All sessions',
        enforcement: 'Block',
        violations: 0,
        enabled: true,
      },
    );
    setName(p?.name || '');
    setScope(p?.scope || 'All sessions');
    setEnforcement(p?.enforcement || 'Block');
    setEnabled(p?.enabled ?? true);
  };
  return (
    <>
      <PageHeading
        title="Security"
        subtitle="Control what autonomous shopping systems are allowed to do."
        action={
          <Button onClick={() => openEditor()}>
            <Plus size={15} />
            New policy
          </Button>
        }
      />
      <div className="metrics-grid">
        {securityMetrics.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>
      <div className="security-banner">
        <span className="security-banner-icon">
          <ShieldCheck size={24} />
        </span>
        <div>
          <strong>Guardrails that understand purchasing intent.</strong>
          <p>
            Evaluate agent identity, spending limits, and merchant permissions before an action is
            executed.
          </p>
        </div>
        <StatusBadge tone="green">Enforcement active</StatusBadge>
      </div>
      <Card>
        <CardHeader
          title="Security policies"
          subtitle="Rules applied to autonomous shopping sessions."
          action={<span className="subtle-badge">{policies.length} policies</span>}
        />
        <div className="table-scroll">
          <table className="data-table policy-table">
            <thead>
              <tr>
                {['Policy', 'Scope', 'Enforcement', 'Violations', 'Status', ''].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="policy-name">
                      <LockKeyhole size={14} />
                      <div>
                        <strong>{p.name}</strong>
                        <span className="table-subtext mono">{p.id}</span>
                      </div>
                    </div>
                  </td>
                  <td>{p.scope}</td>
                  <td>
                    <span className="enforcement-tag">{p.enforcement}</span>
                  </td>
                  <td className="mono">{p.violations}</td>
                  <td>
                    <StatusBadge>
                      {!p.enabled ? 'Disabled' : p.warning ? 'Warning' : 'Enabled'}
                    </StatusBadge>
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit policy: ${p.name}`}
                      onClick={() => openEditor(p)}
                    >
                      <Pencil size={13} />
                      Edit policy
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>
            <ShieldCheck size={13} />
            Policies are evaluated before every protected action.
          </span>
          <span>Policy version 1.4</span>
        </div>
      </Card>
      <Card className="security-events-card">
        <CardHeader
          title="Recent security events"
          subtitle="Actions intercepted by your merchant policies."
          action={<StatusBadge tone="neutral">Last 7 days</StatusBadge>}
        />
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {['Event', 'Enforcement', 'Severity', 'Session', 'Timestamp', ''].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {securityEvents.map((e) => (
                <tr key={e.id}>
                  <td>
                    <strong>{e.title}</strong>
                    <span className="table-subtext">
                      {e.id} · {e.policy}
                    </span>
                  </td>
                  <td>
                    <StatusBadge tone="green">Blocked</StatusBadge>
                  </td>
                  <td>
                    <SeverityBadge severity={e.severity} />
                  </td>
                  <td>
                    <Link className="session-id" href={`/replays/${e.sessionId}`}>
                      {e.sessionId}
                    </Link>
                  </td>
                  <td className="muted mono">{e.time}</td>
                  <td>
                    <Link href={`/replays/${e.sessionId}`} aria-label={`View ${e.sessionId}`}>
                      <ChevronRight size={15} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Dialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        title={editing?.name ? 'Edit security policy' : 'New security policy'}
        description="Configure how simulated shopping sessions are permitted to act."
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editing || !name.trim() || !enforcement.trim()) return;
            savePolicy({
              ...editing,
              name: name.trim(),
              scope,
              enforcement: enforcement.trim(),
              enabled,
              warning: false,
            });
            setEditing(null);
            notify('Security policy saved for this demo workspace.');
          }}
        >
          <label>
            Policy name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Require verified agent identity"
            />
          </label>
          <label>
            Scope
            <Select
              label="Policy scope"
              value={scope}
              onChange={setScope}
              options={['All sessions', 'Checkout', 'Cart', 'Orders > $250', 'Product catalog']}
            />
          </label>
          <label>
            Enforcement
            <input
              required
              value={enforcement}
              onChange={(e) => setEnforcement(e.target.value)}
              placeholder="e.g. Block, 3 attempts, $500"
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Enable this policy
          </label>
          <div className="dialog-actions">
            <Button variant="outline" type="button" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit">
              <Check size={14} />
              Save policy
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
