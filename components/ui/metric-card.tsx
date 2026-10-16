import { ArrowUpRight } from 'lucide-react';
import { Card } from './primitives';
export function MetricCard({
  label,
  value,
  unit,
  change,
  detail,
}: {
  label: string;
  value: string;
  unit?: string;
  change?: string;
  detail?: string;
}) {
  return (
    <Card className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        {value}
        {unit && <span>{unit}</span>}
      </div>
      <div className="metric-foot">
        {change && (
          <span className="positive">
            <ArrowUpRight size={12} />
            {change}
          </span>
        )}
        <span>{detail}</span>
      </div>
    </Card>
  );
}
