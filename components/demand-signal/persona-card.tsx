'use client';
import { StatusBadge } from '@/components/ui/primitives';
import type { ConsumerPersona, PersonaReaction, PersonaVerdict } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ChevronDown, CircleDollarSign } from 'lucide-react';

function verdictTone(verdict: PersonaVerdict): 'green' | 'amber' | 'red' {
  if (verdict === 'Would buy') return 'green';
  if (verdict === 'Would not buy') return 'red';
  return 'amber';
}

export function PersonaCard({
  persona,
  reaction,
  expanded,
  onToggle,
}: {
  persona: ConsumerPersona;
  reaction: PersonaReaction;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={cn('persona-card', expanded && 'expanded')}>
      <button className="persona-card-row" aria-expanded={expanded} onClick={onToggle}>
        <span className="persona-avatar">
          {persona.name
            .split(' ')
            .map((part) => part[0])
            .join('')}
        </span>
        <span className="persona-card-main">
          <strong>{persona.name}</strong>
          <small>{persona.segment}</small>
          <p>{reaction.statedReasoning}</p>
        </span>
        <StatusBadge tone={verdictTone(reaction.verdict)} dot={false}>
          {reaction.verdict}
        </StatusBadge>
        <ChevronDown size={14} className={cn('persona-chevron', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="persona-card-details">
          <div className="persona-card-facts">
            <span>
              Age {persona.age} · {persona.incomeBand}
            </span>
            <span>Prior purchases: {persona.priorPurchases.join(', ')}</span>
          </div>
          <p>{reaction.statedReasoning}</p>
          <div className="persona-price-sensitivity">
            <CircleDollarSign size={13} />
            Price sensitivity: {reaction.priceSensitivity}
          </div>
          {reaction.objections.length > 0 && (
            <ul className="persona-objections">
              {reaction.objections.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
