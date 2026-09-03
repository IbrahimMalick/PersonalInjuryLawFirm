// The integrations framework. Same philosophy as the channels: a CRM is either
// really configured or visibly simulated, and a provider outage can never block
// lead processing (syncs run as queue jobs beside the pipeline, not inside it).

import type { FirmRow, IntegrationProvider, IntegrationRow, LeadRow } from "../db/schema";
import type { CaseFile } from "../schema";

export type IntegrationConfig = Record<string, unknown>;

export interface SyncLeadContext {
  firm: FirmRow;
  lead: LeadRow;
  /** The triaged case file, or null when automatic triage failed. */
  caseFile: CaseFile | null;
}

export interface SyncResult {
  status: "sent" | "simulated" | "skipped";
  /** Provider-side id of whatever was created, when the API returns one. */
  externalId?: string;
  detail: string;
}

export interface ConfigField {
  key: string;
  label: string;
  /** Secrets render as password inputs and display only set/unset. */
  secret?: boolean;
  placeholder?: string;
  help?: string;
}

export interface OutboundAdapter {
  provider: IntegrationProvider;
  label: string;
  /** token: paste-a-key setup · oauth: connect-button flow · inbound: sends to us */
  kind: "token" | "oauth" | "inbound";
  blurb: string;
  configFields: ConfigField[];
  /** True when this row has everything it needs to talk to the provider. */
  configured(config: IntegrationConfig): boolean;
  /**
   * Push one lead. Return simulated when unconfigured (log, don't send).
   * Throw on transient provider failure — the queue retries with backoff.
   */
  pushLead(integration: IntegrationRow, ctx: SyncLeadContext): Promise<SyncResult>;
}

export const str = (config: IntegrationConfig, key: string): string | null => {
  const v = config[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};
