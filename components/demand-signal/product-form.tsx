'use client';
import { Button, Card, CardHeader } from '@/components/ui/primitives';
import type { ProductUnderTest } from '@/lib/types';
import { FlaskConical } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Runs its own short fake-progress timer, matching the pattern of
 * components/layout/app-shell.tsx's ScanButton/AppProvider.runScan — but kept
 * entirely local to this page rather than shared app state, since Demand
 * Signal doesn't need its "last run" status to persist across navigation.
 */
export function ProductForm({
  initialProduct,
  lastRunLabel,
  onRunComplete,
}: {
  initialProduct: ProductUnderTest;
  lastRunLabel: string;
  onRunComplete: () => void;
}) {
  const [product, setProduct] = useState(initialProduct);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);
  const runSimulation = () => {
    if (running) return;
    setRunning(true);
    setProgress(0);
    let progressValue = 0;
    timer.current = setInterval(() => {
      progressValue += 20;
      setProgress(progressValue);
      if (progressValue >= 100) {
        if (timer.current) clearInterval(timer.current);
        setRunning(false);
        onRunComplete();
      }
    }, 1100);
  };
  return (
    <Card className="demand-form">
      <CardHeader
        title="Product concept"
        subtitle="Describe what you're testing, then simulate persona reactions."
        action={<span className="table-subtext">Last run: {lastRunLabel}</span>}
      />
      <div className="demand-form-fields">
        <label>
          Product name
          <input
            value={product.name}
            onChange={(e) => setProduct((p) => ({ ...p, name: e.target.value }))}
          />
        </label>
        <label>
          Price (USD)
          <input
            type="number"
            min={0}
            value={product.price}
            onChange={(e) => setProduct((p) => ({ ...p, price: Number(e.target.value) }))}
          />
        </label>
        <label className="demand-form-description">
          Description
          <input
            value={product.description}
            onChange={(e) => setProduct((p) => ({ ...p, description: e.target.value }))}
          />
        </label>
      </div>
      <div className="demand-form-footer">
        <Button onClick={runSimulation} disabled={running}>
          <FlaskConical size={14} />
          {running ? 'Simulating personas…' : 'Run simulation'}
        </Button>
      </div>
      {running && (
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Demand signal simulation progress"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
    </Card>
  );
}
