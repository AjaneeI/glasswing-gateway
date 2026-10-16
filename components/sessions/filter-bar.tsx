'use client';
import { Select } from '@/components/ui/primitives';
import { Search, SlidersHorizontal, X } from 'lucide-react';
export interface SessionFilters {
  search: string;
  status: string;
  goal: string;
  agent: string;
  environment: string;
  severity: string;
  date: string;
}
export const defaultFilters: SessionFilters = {
  search: '',
  status: 'All statuses',
  goal: 'All goals',
  agent: 'All agents',
  environment: 'All environments',
  severity: 'All severities',
  date: 'Last 7 days',
};
export function FilterBar({
  filters,
  onChange,
  agents,
}: {
  filters: SessionFilters;
  onChange: (filters: SessionFilters) => void;
  agents: string[];
}) {
  const update = (key: keyof SessionFilters, value: string) =>
    onChange({ ...filters, [key]: value });
  const active = Object.keys(defaultFilters).some(
    (k) => filters[k as keyof SessionFilters] !== defaultFilters[k as keyof SessionFilters],
  );
  return (
    <div className="filter-bar">
      <div className="filter-main-row">
        <div className="search-field">
          <Search size={15} />
          <input
            placeholder="Search sessions..."
            aria-label="Search sessions"
            value={filters.search}
            onChange={(e) => update('search', e.target.value)}
          />
          {filters.search && (
            <button aria-label="Clear search" onClick={() => update('search', '')}>
              <X size={13} />
            </button>
          )}
        </div>
        <div className="filter-group">
          <Select
            label="Status"
            value={filters.status}
            onChange={(v) => update('status', v)}
            options={['All statuses', 'Completed', 'Failed', 'Blocked']}
          />
          <Select
            label="Goal type"
            value={filters.goal}
            onChange={(v) => update('goal', v)}
            options={['All goals', 'Purchase', 'Discovery', 'Promotion', 'Comparison']}
          />
          <Select
            label="Agent profile"
            value={filters.agent}
            onChange={(v) => update('agent', v)}
            options={['All agents', ...agents]}
          />
          <Select
            label="Date range"
            value={filters.date}
            onChange={(v) => update('date', v)}
            options={['Last 7 days', 'Today', 'Yesterday']}
          />
        </div>
      </div>
      <div className="filter-secondary-row">
        <span>
          <SlidersHorizontal size={13} />
          Filter by
        </span>
        <Select
          label="Environment filter"
          value={filters.environment}
          onChange={(v) => update('environment', v)}
          options={['All environments', 'Production', 'Staging']}
        />
        <Select
          label="Severity"
          value={filters.severity}
          onChange={(v) => update('severity', v)}
          options={['All severities', 'Critical', 'High', 'Medium', 'No issues']}
        />
        {active && (
          <button className="clear-filters" onClick={() => onChange(defaultFilters)}>
            <X size={12} />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
