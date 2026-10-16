'use client';
import { AgentTimeline } from '@/components/sessions/agent-timeline';
import { Card, CardHeader, SeverityBadge, StatusBadge } from '@/components/ui/primitives';
import type { AgentScanResult, AgentStep } from '@/lib/agent/types';
import type { SessionEvent } from '@/lib/types';
import { CircleAlert, Terminal } from 'lucide-react';

function isNegative(observation: string): boolean {
  return /"ok":\s*false|No purchasable|exceeds|Fetch failed|Invalid URL/.test(observation);
}

function eventType(tool: string, observation: string): SessionEvent['type'] {
  if (tool === 'attempt_checkout') return isNegative(observation) ? 'warning' : 'checkout';
  if (tool === 'get_policy') return /machineReadable":\s*false/.test(observation) ? 'warning' : 'browse';
  if (tool === 'search_products' || tool === 'fetch_page') return 'browse';
  if (tool === 'extract_structured_data') return 'compare';
  if (tool === 'submit_report') return 'complete';
  return 'browse';
}

function humanize(tool: string): string {
  return tool
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function stepToEvent(step: AgentStep): SessionEvent {
  const negative = isNegative(step.observation);
  const oneLine = step.observation.replace(/\s+/g, ' ').trim();
  const actionArgs = Object.entries(step.input)
    .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join(' · ');
  return {
    id: step.index,
    time: String(step.index),
    title: humanize(step.tool),
    type: eventType(step.tool, step.observation),
    summary: oneLine.length > 160 ? `${oneLine.slice(0, 160)}…` : oneLine,
    action: `${step.tool}(${actionArgs})`,
    details: step.observation,
    status: negative ? 'Warning' : 'Success',
  };
}

export function AgentResults({ results }: { results: AgentScanResult[] }) {
  return (
    <>
      {results.map((result) => {
        const events = result.steps.map(stepToEvent);
        return (
          <Card key={result.goal} className="agent-result">
            <CardHeader
              title={result.goal}
              subtitle={`${result.agent} · ${result.mode}${result.model ? ` · ${result.model}` : ''} · ${result.steps.length} tool calls · ${result.durationMs} ms`}
              action={
                <StatusBadge tone={result.success ? 'green' : 'red'}>
                  {result.success ? 'Goal completed' : 'Goal failed'}
                </StatusBadge>
              }
            />
            <p className="agent-result-summary">{result.summary}</p>
            {events.length > 0 && <AgentTimeline events={events} activeStep={events.length} />}
            {result.findings.length > 0 && (
              <div className="agent-findings">
                {result.findings.map((finding) => (
                  <div className="agent-finding" key={finding.title}>
                    <div className="agent-finding-head">
                      <SeverityBadge severity={finding.severity} />
                      <strong>{finding.title}</strong>
                      <span className="subtle-badge">{finding.category}</span>
                    </div>
                    <p>
                      <CircleAlert size={12} /> {finding.whyAgentsFail}
                    </p>
                    <p className="agent-finding-fix">
                      <Terminal size={12} /> {finding.suggestedFix}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
}