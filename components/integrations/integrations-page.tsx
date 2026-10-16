'use client';
import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  LayoutGrid,
  Link2,
  Loader2,
  Search,
  Settings2,
  ShieldCheck,
  Unplug,
  X,
} from 'lucide-react';
import { PageHeading } from '@/components/ui/page-heading';
import { Button, Dialog } from '@/components/ui/primitives';
import { IntegrationCard } from '@/components/ui/integration-card';
import { BrandLogo } from './brand-logo';
import { useApp } from '@/components/layout/app-provider';
import {
  categories,
  integrations,
  normalizeDestination,
  readConnections,
  type Category,
  type Connection,
  type Connections,
  type Integration,
} from '@/lib/integrations/catalog';
import styles from './integrations.module.css';

export function IntegrationsPage() {
  const { notify } = useApp();
  const [connections, setConnections] = useState<Connections>({});
  const [storageKey, setStorageKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('All integrations');
  const [configuredOnly, setConfiguredOnly] = useState(false);
  const [editing, setEditing] = useState<Integration | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    fetch('/api/account', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load your account.');
        const { user } = await response.json();
        if (controller.signal.aborted) return;
        if (!user?.id) throw new Error('Could not identify your account.');
        const key = `gateway:integration-links:v1:${user.id}`;
        const saved = readConnections(localStorage.getItem(key));
        setConnections(saved);
        setStorageKey(key);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setLoadError('Your saved links could not be loaded. Please try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    if (!storageKey) return;
    const sync = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return;
      try {
        setConnections(readConnections(event.newValue));
      } catch {
        setLoadError('Saved links changed but could not be read. Please reload.');
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [storageKey]);
  function save(id: string, value?: Connection) {
    if (!storageKey) throw new Error('Wait for your account to load, then try again.');
    // Read the latest saved values so edits in another tab are preserved.
    const updated = readConnections(localStorage.getItem(storageKey));
    if (value) updated[id] = value;
    else delete updated[id];
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setConnections(updated);
    notify(value ? 'Integration link saved.' : 'Integration link removed.');
  }
  const configured = integrations.filter((item) => connections[item.id]);
  const visible = integrations.filter(
    (item) =>
      (category === 'All integrations' || item.category === category) &&
      (!configuredOnly || connections[item.id]) &&
      `${item.name} ${item.description} ${item.category} ${connections[item.id]?.name || ''}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <div className={styles.page}>
      <PageHeading
        title="Integrations"
        subtitle="Your commerce stack, a little more connected."
        action={
          <span className={styles.total}>
            <Link2 size={14} />
            {loading ? 'Loading your links…' : `${configured.length} configured`}
          </span>
        }
      />
      <section className={styles.overview} aria-label="Your integration links">
        <div className={styles.overviewCopy}>
          <span className={styles.eyebrow}>BUILT AROUND YOUR WORKFLOW</span>
          <h2>All your tools. One place to start.</h2>
          <p>
            Keep your storefront, payments, and developer tools close.
            <br />
            Add your workspace links and pick up right where you left off.
          </p>
          <div className={styles.overviewFoot}>
            <ShieldCheck size={14} />
            No API keys or passwords needed
          </div>
        </div>
        <div className={styles.logoStack} aria-hidden="true">
          {['shopify', 'stripe', 'github', 'vercel', 'cloudflare', 'datadog'].map((id) => (
            <BrandLogo key={id} integration={integrations.find((i) => i.id === id)!} />
          ))}
        </div>
      </section>
      {loadError && (
        <div className={styles.loadError} role="alert">
          <span>{loadError}</span>
          <button onClick={() => setRetry((n) => n + 1)}>Try again</button>
        </div>
      )}
      {!loading && configured.length > 0 && (
        <section className={styles.shortcuts} aria-label="Quick access">
          <span>QUICK ACCESS</span>
          {configured.map((item) => (
            <a
              key={item.id}
              href={connections[item.id].url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <BrandLogo integration={item} small />
              <span>{connections[item.id].name}</span>
              <ArrowUpRight size={14} />
            </a>
          ))}
        </section>
      )}
      <div className={styles.catalogHeading}>
        <div>
          <h2>
            Integration directory <span>{integrations.length}</span>
          </h2>
          <p>Choose a tool to configure your workspace link.</p>
        </div>
        <div className={styles.viewToggle}>
          <button aria-pressed={!configuredOnly} onClick={() => setConfiguredOnly(false)}>
            <LayoutGrid size={13} />
            All
          </button>
          <button aria-pressed={configuredOnly} onClick={() => setConfiguredOnly(true)}>
            <Check size={13} />
            Configured{configured.length > 0 && <span>{configured.length}</span>}
          </button>
        </div>
      </div>
      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="Integration category">
          {categories.map((item) => (
            <button key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>
              {item === 'All integrations' ? 'All tools' : item}
            </button>
          ))}
        </div>
        <div className={styles.search}>
          <Search size={15} />
          <input
            aria-label="Search integrations"
            placeholder="Search integrations…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <div className={styles.loading} role="status">
          <Loader2 size={18} />
          Loading your integrations…
        </div>
      ) : (
        <div className={styles.grid}>
          {visible.map((item) => (
            <IntegrationCard
              key={item.id}
              integration={item}
              connection={connections[item.id]}
              onConfigure={() => setEditing(item)}
              disabled={!storageKey || !!loadError}
            />
          ))}
        </div>
      )}
      {!loading && !visible.length && (
        <div className={styles.empty}>
          <Unplug size={28} />
          <h3>
            {configuredOnly && !configured.length
              ? 'Your tools belong here'
              : 'No integrations found'}
          </h3>
          <p>
            {configuredOnly && !configured.length
              ? 'Configure a workspace link to give your team’s tools a home.'
              : 'Try another search or category to find your tool.'}
          </p>
          <button
            onClick={() => {
              setQuery('');
              setCategory('All integrations');
              setConfiguredOnly(false);
            }}
          >
            Browse all integrations
            <ArrowRight size={14} />
          </button>
        </div>
      )}
      <footer className={styles.note}>
        <Link2 size={15} />
        <p>
          Configured links open your saved destinations. Links are saved for your account in this
          browser; data syncing is not enabled.
        </p>
      </footer>
      <section className={styles.developer}>
        <div className={styles.developerIcon}>
          <Settings2 size={21} />
        </div>
        <div>
          <h3>Build your own workflow</h3>
          <p>Explore GitHub Actions to connect your existing deployment pipeline.</p>
        </div>
        <a href="https://docs.github.com/en/actions" target="_blank" rel="noopener noreferrer">
          Explore Actions
          <ChevronRight size={15} />
        </a>
      </section>
      {editing && (
        <ConfigurationDialog
          key={editing.id}
          integration={editing}
          connection={connections[editing.id]}
          onClose={() => setEditing(null)}
          onSave={(value) => save(editing.id, value)}
        />
      )}
    </div>
  );
}
function ConfigurationDialog({
  integration,
  connection,
  onClose,
  onSave,
}: {
  integration: Integration;
  connection?: Connection;
  onClose: () => void;
  onSave: (value?: Connection) => void;
}) {
  const [name, setName] = useState(connection?.name || '');
  const [url, setUrl] = useState(connection?.url || '');
  const [error, setError] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      if (!name.trim()) throw new Error('Enter a name for this workspace.');
      const destination = normalizeDestination(url);
      onSave({ name: name.trim(), url: destination });
      onClose();
    } catch (error) {
      setError(
        error instanceof TypeError
          ? 'Enter a valid HTTPS URL, such as the example below.'
          : error instanceof Error && error.name !== 'QuotaExceededError'
            ? error.message
            : 'Your browser could not save this link. Check your storage settings and try again.',
      );
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Configure ${integration.name}`}
      description="Save a direct link to your workspace or project."
    >
      <div className={styles.dialogBrand}>
        <BrandLogo integration={integration} />
        <div>
          <strong>{integration.name}</strong>
          <a href={integration.website} target="_blank" rel="noopener noreferrer">
            Visit {integration.name}
            <ArrowUpRight size={12} />
          </a>
        </div>
      </div>
      <form className={`form-stack ${styles.configForm}`} onSubmit={submit}>
        <label>
          Connection name
          <input
            value={name}
            required
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            placeholder={`My ${integration.name} workspace`}
            autoComplete="off"
          />
        </label>
        <label>
          {integration.urlLabel}
          <input
            value={url}
            type="url"
            required
            maxLength={2048}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={integration.placeholder}
            autoComplete="off"
            aria-describedby="integration-url-help"
          />
        </label>
        <p id="integration-url-help" className={styles.hint}>
          Paste the HTTPS address from your browser. Use a dashboard link, not a secret webhook URL.
        </p>
        {error && (
          <p role="alert" className={styles.formError}>
            {error}
          </p>
        )}
        <div className={styles.dialogNote}>
          <ShieldCheck size={16} />
          <span>
            This saves a shortcut in this browser. It does not grant Gateway access to your account
            or enable data syncing.
          </span>
        </div>
        <div className={styles.dialogActions}>
          {connection && (
            <button
              type="button"
              className={styles.remove}
              onClick={() => {
                try {
                  onSave();
                  onClose();
                } catch {
                  setError('Could not remove this link. Please try again.');
                }
              }}
            >
              Remove link
            </button>
          )}
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            <Check size={14} />
            Save configuration
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
