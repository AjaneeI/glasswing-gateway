/**
 * Shared ROI assumptions and math, used by both the per-scan economics panel
 * and the /roi overview so the two can never disagree.
 *
 * The cost side of every figure here is measured (recorded per model call).
 * The manual-QA baseline is the only assumption, and it is deliberately the
 * one thing a reader can challenge — keep it sourced.
 */

/**
 * What the same coverage costs when a person does it by hand.
 *
 * Both values are 0 until someone supplies numbers they can defend: time a
 * real manual pass through one scenario, and use a loaded rate you can cite.
 * While they are 0, every comparison that depends on them stays hidden rather
 * than showing an invented figure.
 */
export const manualQaBaseline = {
  minutesPerScenario: 0,
  loadedHourlyRateUsd: 0,
};

export const baselineIsSet = () =>
  manualQaBaseline.minutesPerScenario > 0 && manualQaBaseline.loadedHourlyRateUsd > 0;

export function manualEquivalent(scenarioCount: number) {
  const minutes = scenarioCount * manualQaBaseline.minutesPerScenario;
  return { minutes, costUsd: (minutes / 60) * manualQaBaseline.loadedHourlyRateUsd };
}

export function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
