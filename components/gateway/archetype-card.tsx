'use client';
import { BookOpen, ChevronDown, SlidersHorizontal, UserRound } from 'lucide-react';
import { Select } from '@/components/ui/primitives';
import type { Archetype } from '@/lib/gateway/schemas';
import styles from './review.module.css';
const traits = [
  ['expertise', 'Product knowledge', ['novice', 'intermediate', 'expert']],
  ['budgetSensitivity', 'Budget sensitivity', ['low', 'medium', 'high']],
  ['comparisonDepth', 'Comparison depth', ['shallow', 'moderate', 'deep']],
  ['patience', 'Patience', ['low', 'medium', 'high']],
  ['substitutionTolerance', 'Openness to alternatives', ['none', 'low', 'high']],
  ['discoveryStrategy', 'Discovery style', ['search', 'browse', 'mixed']],
] as const;
export function ArchetypeCard({
  archetype,
  index,
  onChange,
}: {
  archetype: Archetype;
  index: number;
  onChange: (patch: Partial<Archetype>) => void;
}) {
  return (
    <section
      className={`${styles.persona} ${styles[`tone${index % 3}`]}`}
      aria-label={`Shopper archetype ${index + 1}`}
    >
      <div className={styles.personaTop}>
        <span className={styles.avatar}>
          <UserRound size={23} strokeWidth={1.6} />
        </span>
        <div>
          <span className={styles.kicker}>SHOPPER {String(index + 1).padStart(2, '0')}</span>
          <span className={styles.personaType}>Behavioral archetype</span>
        </div>
        <span className={styles.editable}>Editable</span>
      </div>
      <label className={styles.nameLabel}>
        <span>Archetype name</span>
        <input
          aria-label={`Archetype ${index + 1} name`}
          value={archetype.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </label>
      <label className={styles.hypothesis}>
        <span>How they shop</span>
        <textarea
          aria-label={`Archetype ${index + 1} behavioral hypothesis`}
          value={archetype.hypothesis}
          onChange={(event) => onChange({ hypothesis: event.target.value })}
          rows={5}
        />
      </label>
      <div className={styles.traitsTitle}>
        <SlidersHorizontal size={13} />
        <span>Shopping behavior</span>
      </div>
      <div className={styles.traits}>
        {traits.map(([key, label, options]) => (
          <label key={key}>
            <span>{label}</span>
            <Select
              label={`${archetype.name} ${label}`}
              options={options.map((value) => ({
                value,
                label: value[0].toUpperCase() + value.slice(1),
              }))}
              value={archetype[key]}
              onChange={(value) => onChange({ [key]: value } as Partial<Archetype>)}
            />
          </label>
        ))}
      </div>
      <details className={styles.personaEvidence}>
        <summary>
          <BookOpen size={14} />
          <span>Why this shopper?</span>
          <ChevronDown size={14} />
        </summary>
        <p>{archetype.provenance.rationale}</p>
      </details>
    </section>
  );
}
