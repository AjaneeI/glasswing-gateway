'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  FileSearch,
  Globe2,
  ListChecks,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { ArchetypeCard } from './archetype-card';
import styles from './review.module.css';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  LoadingLabel,
  Select,
  StatusBadge,
} from '@/components/ui/primitives';
import { gatewayClient, gatewayRequest, type EnvironmentOption } from '@/lib/gateway/client';
import type { Archetype, Draft, Scenario, Scan } from '@/lib/gateway/schemas';
import { useGateway } from './provider';
import { ErrorNotice, errorMessage, FixtureBadge, ScanResults } from './shared';

type DraftSummary = Pick<
  Draft,
  'id' | 'merchantUrl' | 'revision' | 'approvedAt' | 'fixture' | 'createdAt'
>;
export function GatewayWorkflow({ shopperInterests = [] }: { shopperInterests?: string[] }) {
  const { execute, activeScan, error: runError } = useGateway();
  const [environments, setEnvironments] = useState<EnvironmentOption[]>([]);
  const [environmentId, setEnvironmentId] = useState('');
  const [url, setUrl] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedDrafts, setSavedDrafts] = useState<DraftSummary[]>([]);
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState('Loading environments…');
  const [error, setError] = useState('');
  const [scanId, setScanId] = useState<string | null>(null);
  const lock = useRef(false);
  const executionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scanId) executionRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [scanId]);
  function adoptDraft(value: Draft) {
    setDraft(value);
    setArchetypes(value.archetypes);
    setScenarios(value.scenarios);
    setReviewed(false);
    setEnvironmentId(value.environmentId);
    setUrl(value.merchantUrl);
    setScanId(null);
    const location = new URL(window.location.href);
    location.searchParams.set('draft', value.id);
    window.history.replaceState(null, '', location);
  }
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [envs, drafts] = await Promise.all([
          gatewayClient.environments(),
          gatewayClient.drafts(),
        ]);
        if (cancelled) return;
        setEnvironments(envs.items);
        setSavedDrafts(drafts.items);
        setEnvironmentId(envs.items[0]?.id || '');
        setUrl(envs.items[0]?.entryUrl || envs.items[0]?.origin || '');
        const id = new URLSearchParams(window.location.search).get('draft');
        if (id) {
          const value = await gatewayClient.draft(id);
          if (!cancelled) adoptDraft(value);
        }
      } catch (error) {
        if (!cancelled) setError(errorMessage(error));
      } finally {
        if (!cancelled) setBusy('');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    setReviewed(false);
  }, [archetypes, scenarios]);
  const dirty =
    !!draft &&
    (JSON.stringify(archetypes) !== JSON.stringify(draft.archetypes) ||
      JSON.stringify(scenarios) !== JSON.stringify(draft.scenarios));
  const running = !!activeScan && ['queued', 'running'].includes(activeScan.status);
  const inspecting = busy.startsWith('Inspecting storefront');
  const showingFinishedScan =
    !inspecting &&
    !!activeScan &&
    (scanId === activeScan.id || activeScan.draft.id === draft?.id) &&
    !['queued', 'running'].includes(activeScan.status);
  async function perform(label: string, task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    setError('');
    try {
      await task();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      lock.current = false;
      setBusy('');
    }
  }
  function changeTarget() {
    setDraft(null);
    setArchetypes([]);
    setScenarios([]);
    setReviewed(false);
    setScanId(null);
    const location = new URL(window.location.href);
    location.searchParams.delete('draft');
    window.history.replaceState(null, '', location);
  }
  const inspect = () =>
    perform('Inspecting storefront and generating a test plan…', async () => {
      const normalized = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
      const value = await gatewayRequest<Draft>('/drafts', {
        method: 'POST',
        body: { merchantUrl: normalized, environmentId, shopperInterests },
      });
      adoptDraft(value);
      setSavedDrafts((current) => [value, ...current.filter((item) => item.id !== value.id)]);
    });
  const save = (approved: boolean) =>
    perform(approved ? 'Approving test plan…' : 'Saving changes…', async () => {
      const value = await gatewayRequest<Draft>(`/drafts/${draft!.id}`, {
        method: 'PATCH',
        body: { revision: draft!.revision, archetypes, scenarios, approved },
      });
      adoptDraft(value);
      setSavedDrafts((current) => current.map((item) => (item.id === value.id ? value : item)));
    });
  const start = () =>
    perform('Creating scan…', async () => {
      const scan = await gatewayRequest<Scan>('/scans', {
        method: 'POST',
        body: { draftId: draft!.id, revision: draft!.revision },
      });
      setScanId(scan.id);
      execute(scan);
    });
  return (
    <div className="gateway-stack">
      <Card className={`gateway-panel ${styles.entry}`}>
        <div className={`gateway-entry-heading ${styles.entryHeading}`}>
          <span className={styles.entryIcon}>
            <Globe2 size={23} />
          </span>
          <div>
            <div className="eyebrow">NEW TEST RUN</div>
            <h2>Choose your storefront</h2>
            <p>Select an authorized environment and the page you want to explore.</p>
          </div>
        </div>
        <fieldset className="gateway-review" disabled={!!busy || running}>
          <div className={`gateway-form-row ${styles.targetFields}`}>
            <label>
              Test environment
              <Select
                label="Test environment"
                value={environmentId}
                options={environments.map((env) => ({
                  value: env.id,
                  label: `${env.id} · ${env.origin}`,
                }))}
                onChange={(id) => {
                  changeTarget();
                  setEnvironmentId(id);
                  const selected = environments.find((env) => env.id === id);
                  setUrl(selected?.entryUrl || selected?.origin || '');
                }}
              />
            </label>
            <label>
              Storefront URL
              <input
                aria-label="Storefront URL"
                placeholder="https://staging.example.com/"
                value={url}
                onChange={(event) => {
                  changeTarget();
                  const value = event.target.value;
                  setUrl(value);
                  try {
                    const origin = new URL(
                      /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`,
                    ).origin;
                    const matchingEnvironment = environments.find((item) => item.origin === origin);
                    if (matchingEnvironment) setEnvironmentId(matchingEnvironment.id);
                  } catch {
                    // Keep the selected environment while the URL is being typed.
                  }
                }}
              />
            </label>
            <Button
              onClick={() => void inspect()}
              disabled={!!busy || running || !url.trim() || !environmentId}
            >
              <FileSearch size={15} />
              Inspect storefront
            </Button>
          </div>
        </fieldset>
        <p className={styles.entryNote}>
          <ShieldCheck size={14} />
          You’ll review the shoppers and goals before any test runs.
        </p>
        {!busy && !environments.length && !error && (
          <EmptyState
            title="No test environments configured"
            description="Add your authorized storefront to GATEWAY_TEST_ENVIRONMENTS on the server, then reload this page."
          />
        )}
      </Card>
      <ErrorNotice message={error} />
      {error.includes('Sign in') && (
        <Button asChild variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      )}
      {inspecting ? (
        <section
          className={styles.inspectionLoading}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className={styles.loadingTop}>
            <span className={styles.loadingIcon}>
              <FileSearch size={25} />
            </span>
            <div>
              <span className={styles.loadingEyebrow}>PREPARING YOUR TEST PLAN</span>
              <h2>Getting to know your storefront</h2>
              <p>We’re reading your store and building shoppers and goals for you to review.</p>
            </div>
            <span className={styles.loadingPulse}>In progress</span>
          </div>
          <div className={styles.loadingTrack} aria-hidden="true">
            <span />
          </div>
          <div className={styles.loadingTasks}>
            <div>
              <Globe2 size={19} />
              <strong>Store evidence</strong>
              <span>Pages, products, and policies</span>
            </div>
            <div>
              <UsersRound size={19} />
              <strong>Shopper profiles</strong>
              <span>Behaviors grounded in your store</span>
            </div>
            <div>
              <ListChecks size={19} />
              <strong>Shopping goals</strong>
              <span>A proposed plan for your review</span>
            </div>
          </div>
          <p className={styles.loadingNote}>
            <ShieldCheck size={14} /> You’ll approve the plan before shoppers start their test runs.
          </p>
        </section>
      ) : (
        busy && (
          <div className="gateway-loading" role="status">
            <LoadingLabel>{busy}</LoadingLabel>
          </div>
        )
      )}
      {!inspecting &&
        activeScan &&
        (scanId === activeScan.id || activeScan.draft.id === draft?.id) && (
          <div ref={executionRef} className={`gateway-stack ${styles.executionAnchor}`}>
            <div className={styles.resultActions}>
              {showingFinishedScan && (
                <Button asChild>
                  <Link href="/dashboard">
                    Open dashboard <ArrowUpRight size={14} />
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href={`/scan?scanId=${activeScan.id}`}>Open saved scan</Link>
              </Button>
            </div>
            <ScanResults scan={activeScan} />
          </div>
        )}
      {!inspecting && !draft && savedDrafts.length > 0 && (
        <Card>
          <CardHeader title="Continue a saved test plan" />
          <div className="gateway-panel">
            {savedDrafts.map((item) => (
              <Button
                key={item.id}
                variant="outline"
                disabled={!!busy}
                onClick={() =>
                  void perform('Loading draft…', async () =>
                    adoptDraft(await gatewayClient.draft(item.id)),
                  )
                }
              >
                {item.merchantUrl} · revision {item.revision}
              </Button>
            ))}
          </div>
        </Card>
      )}
      {!inspecting && draft && (
        <>
          <Card className={styles.context}>
            <div className={styles.contextTop}>
              <span className={styles.siteIcon}>
                <Globe2 size={24} />
              </span>
              <div className={styles.siteTitle}>
                <span className={styles.kicker}>STOREFRONT INSIGHTS</span>
                <h2>{draft.context.merchantName.replace(/\s*\[[0-9a-f-]{36}\]/gi, '')}</h2>
                <a href={draft.merchantUrl} target="_blank" rel="noopener noreferrer">
                  {new URL(draft.merchantUrl).hostname}
                  <ArrowUpRight size={12} />
                </a>
              </div>
              <div className={styles.contextBadges}>
                <StatusBadge tone={draft.approvedAt && !dirty ? 'green' : 'amber'}>
                  {draft.approvedAt && !dirty ? 'Approved' : 'Review required'}
                </StatusBadge>
                <FixtureBadge fixture={draft.fixture} />
              </div>
            </div>
            <p className={styles.siteDescription}>
              {draft.context.description.replace(/\s*\[[0-9a-f-]{36}\]/gi, '')}
            </p>
            <div className={styles.summaryStats}>
              <span>
                <UsersRound size={16} />
                <strong>{archetypes.length}</strong>
                {archetypes.length === 1 ? 'shopper archetype' : 'shopper archetypes'}
              </span>
              <span>
                <ListChecks size={16} />
                <strong>{scenarios.length}</strong>shopping scenarios
              </span>
              <span>
                <BookOpen size={16} />
                <strong>{draft.evidence.length}</strong>sampled pages
              </span>
              <small>Revision {draft.revision}</small>
            </div>
            <div className={styles.evidenceBody}>
              <details>
                <summary className={styles.evidenceSummary}>
                  <BookOpen size={15} />
                  <span>Site evidence and sampling limits</span>
                  <ChevronDown size={15} />
                </summary>
                {draft.context.claims.map((claim, i) => (
                  <p key={i}>
                    {claim.claim}{' '}
                    <small>
                      Sources:{' '}
                      {claim.evidenceIds
                        .map((id) => draft.evidence.find((item) => item.id === id)?.title || id)
                        .join(', ')}
                    </small>
                  </p>
                ))}
                {draft.context.limitations.map((limit, i) => (
                  <p key={i}>{limit}</p>
                ))}
                {draft.evidence.map((evidence) => (
                  <details key={evidence.id}>
                    <summary>{evidence.title || evidence.url}</summary>
                    <a href={evidence.url} target="_blank" rel="noreferrer">
                      {evidence.url}
                    </a>
                    <pre className="gateway-observation">{evidence.text}</pre>
                  </details>
                ))}
              </details>
            </div>
          </Card>
          <fieldset className="gateway-review" disabled={!!busy || running}>
            <section className={styles.reviewSection} aria-labelledby="archetype-heading">
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.step}>01</span>
                  <div>
                    <h2 id="archetype-heading">Review customer archetypes</h2>
                    <p>Fine-tune how each shopper discovers, compares, and decides.</p>
                  </div>
                </div>
                <span className={styles.count}>
                  {archetypes.length} {archetypes.length === 1 ? 'shopper' : 'shoppers'}
                </span>
              </div>
              <div className={styles.hypothesisNote}>
                <span className={styles.noteDot} />
                <p>
                  Inferred from your storefront’s content. These are test hypotheses, not measured
                  customer demographics.
                </p>
              </div>
              <div className={styles.personaGrid}>
                {archetypes.map((archetype, index) => (
                  <ArchetypeCard
                    key={archetype.id}
                    archetype={archetype}
                    index={index}
                    onChange={(patch) =>
                      setArchetypes((all) =>
                        all.map((item, i) => (i === index ? { ...item, ...patch } : item)),
                      )
                    }
                  />
                ))}
              </div>
            </section>
            <section className={styles.reviewSection} aria-labelledby="scenario-heading">
              <div className={styles.sectionHeading}>
                <div>
                  <span className={styles.step}>02</span>
                  <div>
                    <h2 id="scenario-heading">Review shopping scenarios</h2>
                    <p>Give each shopper a goal, clear boundaries, and an expected outcome.</p>
                  </div>
                </div>
                <span className={styles.count}>{scenarios.length} scenarios</span>
              </div>
              <div className={styles.scenarioCoverage}>
                {(
                  [
                    ['legitimate', 'Everyday shopping'],
                    ['constraint', 'Constraint checks'],
                    ['red_team', 'Boundary checks'],
                  ] as const
                ).map(([mode, label]) => (
                  <span key={mode}>
                    <span className={styles.noteDot} />
                    {label}
                    <strong>{scenarios.filter((item) => item.mode === mode).length}</strong>
                  </span>
                ))}
                <span>
                  Expected declines
                  <strong>
                    {scenarios.filter((item) => item.expectedOutcome === 'decline').length}
                  </strong>
                </span>
              </div>
              <div className={styles.scenarioList}>
                {scenarios.map((scenario, index) => {
                  const update = (patch: Partial<Scenario>) =>
                    setScenarios((all) =>
                      all.map((item, i) => (i === index ? { ...item, ...patch } : item)),
                    );
                  return (
                    <section className={styles.scenarioCard} key={scenario.id}>
                      <div className={styles.scenarioHeader}>
                        <span className={styles.scenarioNumber}>
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <span className={styles.kicker}>SHOPPING SCENARIO</span>
                          <h3>
                            {archetypes.find((item) => item.id === scenario.archetypeId)?.name ||
                              'Shopper goal'}
                          </h3>
                        </div>
                        <span className={styles.scenarioMode} data-mode={scenario.mode}>
                          {scenario.mode === 'legitimate'
                            ? 'Everyday shopping'
                            : scenario.mode === 'constraint'
                              ? 'Constraint check'
                              : 'Boundary check'}
                        </span>
                      </div>
                      <label className={styles.scenarioGoal}>
                        Shopping goal
                        <textarea
                          aria-label={`Scenario ${index + 1} goal`}
                          value={scenario.goal}
                          onChange={(event) => update({ goal: event.target.value })}
                        />
                      </label>
                      <div className={`gateway-form-grid ${styles.scenarioSettings}`}>
                        <label>
                          Archetype
                          <Select
                            label={`Scenario ${index + 1} archetype`}
                            value={scenario.archetypeId}
                            options={archetypes.map((item) => ({
                              value: item.id,
                              label: item.name,
                            }))}
                            onChange={(archetypeId) => update({ archetypeId })}
                          />
                        </label>
                        <label>
                          Test mode
                          <Select
                            label={`Scenario ${index + 1} mode`}
                            value={scenario.mode}
                            options={[
                              { value: 'legitimate', label: 'Everyday shopping' },
                              { value: 'constraint', label: 'Constraint check' },
                              { value: 'red_team', label: 'Boundary check' },
                            ]}
                            onChange={(mode) => update({ mode: mode as Scenario['mode'] })}
                          />
                        </label>
                        <label>
                          Expected outcome
                          <Select
                            label={`Scenario ${index + 1} expected outcome`}
                            value={scenario.expectedOutcome}
                            options={[
                              { value: 'recommend', label: 'Recommend a product' },
                              { value: 'decline', label: 'Decline unsuitable options' },
                            ]}
                            onChange={(expectedOutcome) =>
                              update({
                                expectedOutcome: expectedOutcome as Scenario['expectedOutcome'],
                              })
                            }
                          />
                        </label>
                      </div>
                      <div className={styles.constraintSection}>
                        <div className={styles.constraintHeading}>
                          <ShieldCheck size={16} />
                          <h4>Must meet</h4>
                          <span>{scenario.hardConstraints.length} hard constraints</span>
                        </div>
                        <p className={styles.constraintHint}>
                          Shoppers must honor every constraint before recommending a product.
                        </p>
                        {scenario.hardConstraints.length === 0 && (
                          <p className={styles.constraintHint}>
                            No hard constraints added. Add a budget, currency, or product
                            requirement.
                          </p>
                        )}
                        {scenario.hardConstraints.map((constraint, ci) => (
                          <div className={styles.constraintRow} key={ci}>
                            <label>
                              Requirement
                              <Select
                                label={`Scenario ${index + 1} constraint ${ci + 1} type`}
                                value={constraint.kind}
                                options={[
                                  { value: 'max_price', label: 'Maximum price' },
                                  { value: 'currency', label: 'Currency' },
                                  { value: 'text_contains', label: 'Must include' },
                                  { value: 'text_excludes', label: 'Must exclude' },
                                ]}
                                onChange={(kind) =>
                                  update({
                                    hardConstraints: scenario.hardConstraints.map((item, i) =>
                                      i === ci ? { ...item, kind: kind as typeof item.kind } : item,
                                    ),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Value
                              <input
                                aria-label={`Scenario ${index + 1} constraint ${ci + 1} value`}
                                value={constraint.value}
                                onChange={(event) =>
                                  update({
                                    hardConstraints: scenario.hardConstraints.map((item, i) =>
                                      i === ci ? { ...item, value: event.target.value } : item,
                                    ),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Description
                              <input
                                aria-label={`Scenario ${index + 1} constraint ${ci + 1} description`}
                                value={constraint.description}
                                onChange={(event) =>
                                  update({
                                    hardConstraints: scenario.hardConstraints.map((item, i) =>
                                      i === ci
                                        ? { ...item, description: event.target.value }
                                        : item,
                                    ),
                                  })
                                }
                              />
                            </label>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                update({
                                  hardConstraints: scenario.hardConstraints.filter(
                                    (_, i) => i !== ci,
                                  ),
                                })
                              }
                            >
                              Remove constraint
                            </Button>
                          </div>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={scenario.hardConstraints.length >= 12}
                          onClick={() =>
                            update({
                              hardConstraints: [
                                ...scenario.hardConstraints,
                                {
                                  kind: 'max_price',
                                  value: '100',
                                  description: 'Maximum product price',
                                },
                              ],
                            })
                          }
                        >
                          + Add constraint
                        </Button>
                      </div>
                      <details className={styles.scenarioDetails}>
                        <summary>
                          Preferences &amp; allowed actions
                          <span>
                            {scenario.softPreferences.length} preferences ·{' '}
                            {scenario.permittedActions.length} actions
                            <ChevronDown size={14} />
                          </span>
                        </summary>
                        <div className={styles.scenarioDetailBody}>
                          <label>
                            Soft preferences <small>Optional · one per line</small>
                            <textarea
                              aria-label={`Scenario ${index + 1} soft preferences`}
                              value={scenario.softPreferences.join('\n')}
                              onChange={(event) =>
                                update({ softPreferences: event.target.value.split('\n') })
                              }
                              onBlur={() =>
                                update({
                                  softPreferences: scenario.softPreferences
                                    .map((value) => value.trim())
                                    .filter(Boolean),
                                })
                              }
                            />
                          </label>
                          <h4>Allowed actions</h4>
                          <div className={styles.scenarioActions}>
                            {(['navigate', 'search', 'inspect_product', 'stop'] as const).map(
                              (action) => (
                                <label className="gateway-checkbox" key={action}>
                                  <input
                                    type="checkbox"
                                    checked={scenario.permittedActions.includes(action)}
                                    onChange={(event) =>
                                      update({
                                        permittedActions: event.target.checked
                                          ? [...scenario.permittedActions, action]
                                          : scenario.permittedActions.filter(
                                              (item) => item !== action,
                                            ),
                                      })
                                    }
                                  />
                                  {action.replaceAll('_', ' ')}
                                </label>
                              ),
                            )}
                          </div>
                          <p className={styles.constraintHint}>
                            Each session ends with a recommendation or a decline.
                          </p>
                        </div>
                      </details>
                      <details className={styles.scenarioDetails}>
                        <summary>
                          <span className={styles.evidenceLabel}>
                            <BookOpen size={14} />
                            Why this scenario
                          </span>
                          <ChevronDown size={14} />
                        </summary>
                        <p className={styles.scenarioRationale}>{scenario.provenance.rationale}</p>
                      </details>
                    </section>
                  );
                })}
              </div>
            </section>
          </fieldset>
          <Card className="gateway-panel">
            <label className="gateway-checkbox">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(event) => setReviewed(event.target.checked)}
                disabled={!!busy || running}
              />
              I reviewed these archetypes, goals, constraints, and permitted actions.
            </label>
            <div className="gateway-toolbar">
              <Button
                variant="outline"
                disabled={!!busy || running || !dirty}
                onClick={() => void save(false)}
              >
                Save changes
              </Button>
              <Button disabled={!!busy || running || !reviewed} onClick={() => void save(true)}>
                Approve test plan
              </Button>
              <Button
                disabled={!!busy || running || dirty || !draft.approvedAt}
                onClick={() => void start()}
              >
                Run approved scan
              </Button>
              {error.includes('Reload') && (
                <Button
                  variant="outline"
                  onClick={() =>
                    void perform('Loading latest revision…', async () =>
                      adoptDraft(await gatewayClient.draft(draft.id)),
                    )
                  }
                >
                  Reload latest revision
                </Button>
              )}
            </div>
          </Card>
        </>
      )}
      <ErrorNotice message={runError} />
      {!showingFinishedScan && (
        <div className="gateway-toolbar">
          <Button asChild variant="outline">
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sessions">Browse sessions</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
