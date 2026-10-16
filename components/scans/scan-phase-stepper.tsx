import { latestScan } from '@/lib/mock-data/scans';
import { cn } from '@/lib/utils';
import { Check, CircleAlert } from 'lucide-react';
export function ScanPhaseStepper({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (value: string | null) => void;
}) {
  return (
    <div className="scan-phases">
      {latestScan.phases.map((phase, i) => (
        <button
          key={phase.name}
          onClick={() => onSelect(selected === phase.name ? null : phase.name)}
          className={cn('scan-phase', selected === phase.name && 'selected')}
          aria-pressed={selected === phase.name}
        >
          <span
            className={cn(
              'phase-icon',
              phase.issues === 0 ? 'green' : i === 0 || i === 3 ? 'red' : 'amber',
            )}
          >
            {phase.issues === 0 ? <Check size={18} /> : <CircleAlert size={18} />}
          </span>
          <span>
            <strong>{phase.name}</strong>
            <small className={phase.issues === 0 ? 'positive' : ''}>
              {phase.issues === 0 ? 'Passed all checks' : `${phase.issues} issues found`}
            </small>
          </span>
          {i < 4 && <span className="phase-connector" />}
        </button>
      ))}
    </div>
  );
}
