'use client';
import { Globe2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { BuyerPersona } from '@/lib/agent/contracts';

const activities = [
  'Browsing the catalog…',
  'Reading structured data…',
  'Comparing products…',
  'Evaluating variants…',
  'Attempting checkout…',
  'Recording findings…',
];

const colorClass: Record<string, string> = {
  emerald: 'swarm-emerald',
  blue: 'swarm-blue',
  violet: 'swarm-violet',
  teal: 'swarm-teal',
};

export function BuyerSwarmLoading({
  storefront,
  personas,
}: {
  storefront: string;
  personas: BuyerPersona[];
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 900);
    return () => clearInterval(timer);
  }, []);
  const headline = activities[tick % activities.length];
  return (
    <div className="swarm" role="status" aria-live="polite">
      <div className="swarm-stage">
        <span className="swarm-ring" />
        <span className="swarm-ring swarm-ring-delay" />
        <div className="swarm-core">
          <Globe2 size={20} />
          <strong>{storefront}</strong>
          <small>{headline}</small>
        </div>
      </div>

      <div className="swarm-agents">
        {personas.map((persona, index) => (
          <div
            className={`swarm-agent ${colorClass[persona.color] ?? 'swarm-blue'}`}
            key={persona.id}
            style={{ animationDelay: `${index * 0.12}s` }}
          >
            <span className="swarm-avatar">{persona.short}</span>
            <div className="swarm-agent-body">
              <strong>{persona.name}</strong>
              <small>{activities[(tick + index) % activities.length]}</small>
              <span className="swarm-lane">
                <i style={{ animationDelay: `${index * 0.18}s` }} />
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="swarm-bar">
        <i />
      </div>
      <p className="swarm-note">
        {personas.length} buyer agents shopping {storefront} in parallel — each acting on the same
        context with a different strategy.
      </p>
    </div>
  );
}