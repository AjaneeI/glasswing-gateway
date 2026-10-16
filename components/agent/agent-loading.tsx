'use client';
import { Bot } from 'lucide-react';
import { useEffect, useState } from 'react';

const phases = [
  'Resolving storefront…',
  'Discovering product catalog…',
  'Reading structured data…',
  'Evaluating shipping & returns policies…',
  'Attempting checkout…',
  'Generating findings…',
];

export function AgentLoading({ storefront }: { storefront: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((value) => (value + 1) % phases.length), 850);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="agent-loading" role="status" aria-live="polite">
      <div className="agent-loading-orb">
        <Bot size={22} />
        <span className="agent-loading-pulse" />
      </div>
      <div className="agent-loading-main">
        <strong>Testing {storefront}</strong>
        <span>{phases[step]}</span>
        <div className="agent-loading-bar">
          <i />
        </div>
      </div>
      <ol className="agent-loading-phases">
        {phases.map((phase, index) => (
          <li
            key={phase}
            className={index < step ? 'done' : index === step ? 'active' : 'pending'}
          >
            <span className="agent-loading-tick">{index < step ? '✓' : index === step ? '•' : ''}</span>
            {phase}
          </li>
        ))}
      </ol>
    </div>
  );
}