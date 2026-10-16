import { ScoreRing } from '@/components/dashboard/score-ring';
import { Card, CardHeader } from '@/components/ui/primitives';
import type { DemandSignalRun, PersonaReaction, PriceSensitivity } from '@/lib/types';
import { MessageSquareWarning } from 'lucide-react';

const priceSensitivityOrder: PriceSensitivity[] = ['Underpriced', 'Fair', 'Overpriced'];

export function ResultsSummary({
  run,
  reactions,
}: {
  run: DemandSignalRun;
  reactions: PersonaReaction[];
}) {
  const priceSensitivityCounts = priceSensitivityOrder.map((label) => ({
    label,
    count: reactions.filter((r) => r.priceSensitivity === label).length,
  }));
  return (
    <Card className="demand-results">
      <CardHeader
        title="Interest signal"
        subtitle={`Based on ${run.personaCount} simulated persona reactions`}
        action={<span className="subtle-badge">{run.date}</span>}
      />
      <div className="demand-results-body">
        <ScoreRing
          score={run.interestScore}
          compact
          label="Interest Score"
          ariaLabel={`Interest score: ${run.interestScore} out of 100`}
        />
        <div className="demand-verdict">
          <div className="demand-verdict-bar">
            <span className="buy" style={{ width: `${run.wouldBuyPct}%` }} />
            <span className="consider" style={{ width: `${run.wouldConsiderPct}%` }} />
            <span className="not-buy" style={{ width: `${run.wouldNotBuyPct}%` }} />
          </div>
          <div className="demand-verdict-legend">
            <span>
              <i className="buy" />
              Would buy <strong>{run.wouldBuyPct}%</strong>
            </span>
            <span>
              <i className="consider" />
              Would consider <strong>{run.wouldConsiderPct}%</strong>
            </span>
            <span>
              <i className="not-buy" />
              Would not buy <strong>{run.wouldNotBuyPct}%</strong>
            </span>
          </div>
          <p className="demand-validation-note">{run.validationNote}</p>
        </div>
      </div>
      <div className="demand-results-lower">
        <div className="demand-objections">
          <h3>
            <MessageSquareWarning size={14} />
            Top objections
          </h3>
          {run.topObjections.map((o) => (
            <div key={o.objection} className="demand-objection-row">
              <span>{o.objection}</span>
              <span className="subtle-badge">{o.count} personas</span>
            </div>
          ))}
        </div>
        <div className="demand-price-sensitivity">
          <h3>Price sensitivity</h3>
          <div className="demand-price-chips">
            {priceSensitivityCounts.map((p) => (
              <span key={p.label} className={`demand-price-chip ${p.label.toLowerCase()}`}>
                <strong>{p.count}</strong>
                {p.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
