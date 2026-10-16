import { cn } from '@/lib/utils';
export function ScoreRing({
  score,
  compact = false,
  label = 'Agent Ready',
  ariaLabel,
}: {
  score: number | null;
  compact?: boolean;
  label?: string;
  ariaLabel?: string;
}) {
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      className={cn('score-ring', compact && 'compact')}
      role="img"
      aria-label={
        ariaLabel ||
        (score === null ? `${label}: not yet measured` : `${label}: ${score} out of 100`)
      }
    >
      <svg viewBox="0 0 144 144">
        <circle cx="72" cy="72" r={radius} fill="none" stroke="#eaf0f5" strokeWidth="9" />
        <circle
          cx="72"
          cy="72"
          r={radius}
          fill="none"
          stroke="#2ca98b"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(circumference * (score ?? 0)) / 100} ${circumference}`}
          transform="rotate(-90 72 72)"
        />
        <circle cx="72" cy="10" r="2" fill="#fff" />
      </svg>
      <div className="score-ring-label">
        <div>
          <strong>{score ?? '—'}</strong>
          <span>/ 100</span>
        </div>
        <span>{label}</span>
      </div>
    </div>
  );
}
