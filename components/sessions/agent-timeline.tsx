'use client';
import { StatusBadge } from '@/components/ui/primitives';
import type { SessionEvent } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  CheckCheck,
  ChevronDown,
  CircleAlert,
  Compass,
  CreditCard,
  GitCompareArrows,
  ShoppingBag,
  Tag,
  Target,
  Terminal,
} from 'lucide-react';
import { useState } from 'react';
const icons = {
  goal: Target,
  browse: Compass,
  compare: GitCompareArrows,
  warning: CircleAlert,
  cart: ShoppingBag,
  promo: Tag,
  checkout: CreditCard,
  complete: CheckCheck,
};
export function AgentTimelineEvent({
  event,
  expanded,
  onToggle,
  active,
}: {
  event: SessionEvent;
  expanded: boolean;
  onToggle: () => void;
  active?: boolean;
}) {
  const Icon = icons[event.type];
  return (
    <div
      className={cn(
        'timeline-event',
        event.type === 'warning' && 'warning',
        active && 'playback-active',
      )}
    >
      <div className="timeline-time">
        <span>
          {event.time}
          <small>s</small>
        </span>
        <span
          className={cn(
            'timeline-icon',
            event.type === 'warning' ? 'amber' : event.type === 'complete' ? 'green' : '',
          )}
        >
          <Icon size={15} />
        </span>
      </div>
      <div className="timeline-event-main">
        <button className="timeline-event-heading" onClick={onToggle} aria-expanded={expanded}>
          <span>
            <small>STEP {event.id}</small>
            <strong>{event.title}</strong>
          </span>
          {event.status && <StatusBadge dot={false}>{event.status}</StatusBadge>}
          <ChevronDown size={14} className={cn(expanded && 'rotate-180')} />
        </button>
        <p>{event.summary}</p>
        {event.action && (
          <div className="request-path">
            <Terminal size={11} />
            <code>{event.action}</code>
            <span>{event.type === 'warning' ? 'policy check' : 'request'}</span>
          </div>
        )}
        {expanded && (
          <div className="timeline-details">
            <div>
              <Terminal size={12} />
              {event.type === 'goal' || event.type === 'compare'
                ? 'AGENT DECISION SUMMARY'
                : 'EVENT DETAILS'}
            </div>
            <pre>{event.details}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
export function AgentTimeline({
  events,
  activeStep,
}: {
  events: SessionEvent[];
  activeStep: number;
}) {
  const [expanded, setExpanded] = useState<number[]>([1, 4]);
  return (
    <div className="agent-timeline">
      {events.map((e) => (
        <AgentTimelineEvent
          key={e.id}
          event={e}
          active={activeStep === e.id}
          expanded={expanded.includes(e.id)}
          onToggle={() =>
            setExpanded((v) => (v.includes(e.id) ? v.filter((id) => id !== e.id) : [...v, e.id]))
          }
        />
      ))}
    </div>
  );
}
