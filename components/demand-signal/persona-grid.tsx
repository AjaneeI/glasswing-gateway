'use client';
import { Card, CardHeader } from '@/components/ui/primitives';
import type { ConsumerPersona, PersonaReaction } from '@/lib/types';
import { useState } from 'react';
import { PersonaCard } from './persona-card';

export function PersonaGrid({
  personas,
  reactions,
}: {
  personas: ConsumerPersona[];
  reactions: PersonaReaction[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return (
    <Card className="persona-grid-card">
      <CardHeader
        title="Persona reactions"
        subtitle="Click a persona to see their full reasoning and objections."
        action={<span className="subtle-badge">{personas.length} personas</span>}
      />
      <div className="persona-grid">
        {personas.map((persona) => {
          const reaction = reactions.find((r) => r.personaId === persona.id);
          if (!reaction) return null;
          return (
            <PersonaCard
              key={persona.id}
              persona={persona}
              reaction={reaction}
              expanded={expandedId === persona.id}
              onToggle={() => setExpandedId((id) => (id === persona.id ? null : persona.id))}
            />
          );
        })}
      </div>
    </Card>
  );
}
