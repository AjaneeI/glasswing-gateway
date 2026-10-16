'use client';
import { PersonaGrid } from '@/components/demand-signal/persona-grid';
import { ProductForm } from '@/components/demand-signal/product-form';
import { ResultsSummary } from '@/components/demand-signal/results-summary';
import { PageHeading } from '@/components/ui/page-heading';
import {
  consumerPersonas,
  demandSignalRun,
  personaReactions,
  productUnderTest,
} from '@/lib/mock-data/demand-signal';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
export default function DemandSignalPage() {
  const [lastRunLabel, setLastRunLabel] = useState(demandSignalRun.date);
  return (
    <>
      <PageHeading
        title="Demand Signal"
        subtitle="Demo simulation using fixture persona reactions and scores."
      />
      <ProductForm
        initialProduct={productUnderTest}
        lastRunLabel={lastRunLabel}
        onRunComplete={() => setLastRunLabel('Just now')}
      />
      <ResultsSummary run={demandSignalRun} reactions={personaReactions} />
      <PersonaGrid personas={consumerPersonas} reactions={personaReactions} />
      <div className="scan-bottom-note">
        <CheckCircle2 size={14} />
        Directional signal from simulated personas grounded in your target segments. This estimates
        reaction and stated intent — it is not a sales forecast. Validate pricing and positioning
        decisions that matter with real customers before committing.
      </div>
    </>
  );
}
