import { merchantActions } from '@/lib/mock-data/security';
import { cn } from '@/lib/utils';
import { Check, LockKeyhole } from 'lucide-react';
export function SecurityPolicyList({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('security-policy-list', compact && 'compact')}>
      {merchantActions.map((a) => (
        <div key={a.name}>
          <span className={a.status === 'Allowed' ? 'policy-check' : 'policy-limit'}>
            {a.status === 'Allowed' ? <Check size={12} /> : <LockKeyhole size={11} />}
          </span>
          <span>
            {a.name}
            <small>{a.time}</small>
          </span>
          <strong className={a.status === 'Allowed' ? 'positive' : 'warning-text'}>
            {a.status}
          </strong>
        </div>
      ))}
    </div>
  );
}
