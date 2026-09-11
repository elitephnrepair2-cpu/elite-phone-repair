
import type { Customer, RepairTicket } from '../types';

// ─── Merge Tag Registry ────────────────────────────────────────────────────────
// To add a new merge tag later:
//   1. Add one entry to MERGE_TAG_DEFINITIONS below.
//   2. Add one line in buildContextMap() to compute the value.
//   That's it — the insert UI and renderer pick it up automatically.

export interface MergeTagDefinition {
  key: string;
  label: string;
  description: string;
  requiresRepairHistory: boolean;
}

export const MERGE_TAG_DEFINITIONS: MergeTagDefinition[] = [
  {
    key: 'first_name',
    label: 'First Name',
    description: "Customer's first name",
    requiresRepairHistory: false,
  },
  {
    key: 'last_name',
    label: 'Last Name',
    description: "Customer's last name (if available)",
    requiresRepairHistory: false,
  },
  {
    key: 'last_device',
    label: 'Last Device',
    description: 'Device from most recent repair ticket',
    requiresRepairHistory: true,
  },
  {
    key: 'last_repair_date',
    label: 'Last Repair Date',
    description: 'Full date of most recent repair (e.g. January 17, 2026)',
    requiresRepairHistory: true,
  },
  {
    key: 'last_repair_month',
    label: 'Last Repair Month',
    description: 'Month of most recent repair (e.g. January)',
    requiresRepairHistory: true,
  },
  {
    key: 'last_repair_issue',
    label: 'Last Repair Issue',
    description: 'Issue description from most recent repair ticket',
    requiresRepairHistory: true,
  },
  {
    key: 'last_repair_location',
    label: 'Last Repair Location',
    description: 'Shop location from most recent repair ticket',
    requiresRepairHistory: true,
  },
];

/** Set of tag keys that require a repair ticket — used for smart audience filtering */
export const REPAIR_HISTORY_TAG_KEYS: ReadonlySet<string> = new Set(
  MERGE_TAG_DEFINITIONS.filter(d => d.requiresRepairHistory).map(d => d.key)
);

// ─── Merge Context ─────────────────────────────────────────────────────────────

export interface MergeContext {
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  // Repair-history fields — null when customer has no repair tickets
  last_device: string | null;
  last_repair_date: string | null;
  last_repair_month: string | null;
  last_repair_issue: string | null;
  last_repair_location: string | null;
  has_repair_history: boolean;
}

// ─── Context Builder ───────────────────────────────────────────────────────────

/**
 * Build a Map<customerId, MergeContext> for all given customers in one efficient pass.
 * Call this ONCE before any send loop — complexity is O(n_tickets + n_customers).
 * Uses the customer's MOST RECENT ticket (by created_at) for all last_repair_* fields.
 */
export function buildContextMap(
  customers: Customer[],
  allTickets: RepairTicket[]
): Map<string, MergeContext> {
  // Step 1: group tickets by customer_id — O(n_tickets)
  const ticketsByCustomer = new Map<string, RepairTicket[]>();
  for (const ticket of allTickets) {
    const existing = ticketsByCustomer.get(ticket.customer_id);
    if (existing) {
      existing.push(ticket);
    } else {
      ticketsByCustomer.set(ticket.customer_id, [ticket]);
    }
  }

  // Step 2: for each customer find their latest ticket and build context — O(n_customers)
  const contextMap = new Map<string, MergeContext>();

  for (const customer of customers) {
    const customerTickets = ticketsByCustomer.get(customer.id) ?? [];

    let latestTicket: RepairTicket | null = null;
    if (customerTickets.length === 1) {
      latestTicket = customerTickets[0];
    } else if (customerTickets.length > 1) {
      latestTicket = customerTickets.reduce((a, b) =>
        new Date(b.created_at).getTime() > new Date(a.created_at).getTime() ? b : a
      );
    }

    const nameParts = (customer.name ?? '').trim().split(/\s+/);
    const firstName = nameParts[0] ?? '';
    const lastName = nameParts.slice(1).join(' ');

    let lastRepairDate: string | null = null;
    let lastRepairMonth: string | null = null;
    if (latestTicket?.created_at) {
      const d = new Date(latestTicket.created_at);
      lastRepairDate = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      lastRepairMonth = d.toLocaleDateString('en-US', { month: 'long' });
    }

    contextMap.set(customer.id, {
      first_name: firstName,
      last_name: lastName,
      full_name: customer.name ?? '',
      phone: customer.phone ?? '',
      last_device: latestTicket?.device ?? null,
      last_repair_date: lastRepairDate,
      last_repair_month: lastRepairMonth,
      last_repair_issue: latestTicket?.problem_description ?? null,
      last_repair_location: latestTicket?.location ?? null,
      has_repair_history: !!latestTicket,
    });
  }

  return contextMap;
}

// ─── Template Analysis ─────────────────────────────────────────────────────────

/** Returns true if the template contains any repair-history merge tags */
export function templateUsesRepairTags(template: string): boolean {
  for (const key of REPAIR_HISTORY_TAG_KEYS) {
    if (template.includes('{{' + key + '}}')) return true;
  }
  return false;
}

/** Returns the list of repair-history tag keys actually used in the template */
export function getUsedRepairTags(template: string): string[] {
  const used: string[] = [];
  for (const key of REPAIR_HISTORY_TAG_KEYS) {
    if (template.includes('{{' + key + '}}')) used.push(key);
  }
  return used;
}

/**
 * Returns true if the context has non-null values for every repair tag in the template.
 */
export function contextSatisfiesTemplate(template: string, context: MergeContext): boolean {
  const usedTags = getUsedRepairTags(template);
  if (usedTags.length === 0) return true;
  return usedTags.every(tag => {
    const val = (context as unknown as Record<string, unknown>)[tag];
    return val !== null && val !== undefined && val !== '';
  });
}

// ─── Template Renderer ─────────────────────────────────────────────────────────

/**
 * Render a template string with a MergeContext.
 *
 * - No generic fallbacks for repair fields — null/missing values produce empty strings.
 *   The caller is responsible for filtering recipients that don't satisfy the template.
 * - Supports both new {{tag}} format and legacy {name}/{device} single-brace format
 *   so existing campaigns without merge tags keep working exactly as before.
 */
export function renderTemplate(template: string, context: MergeContext): string {
  let out = template;

  // New {{tag}} format
  out = out.replace(/\{\{first_name\}\}/gi, context.first_name);
  out = out.replace(/\{\{last_name\}\}/gi, context.last_name ?? '');
  out = out.replace(/\{\{last_device\}\}/gi, context.last_device ?? '');
  out = out.replace(/\{\{last_repair_date\}\}/gi, context.last_repair_date ?? '');
  out = out.replace(/\{\{last_repair_month\}\}/gi, context.last_repair_month ?? '');
  out = out.replace(/\{\{last_repair_issue\}\}/gi, context.last_repair_issue ?? '');
  out = out.replace(/\{\{last_repair_location\}\}/gi, context.last_repair_location ?? '');

  // Legacy single-brace format (backward compatibility — existing campaigns unchanged)
  out = out.replace(/\{name\}/g, context.full_name);
  out = out.replace(/\{device\}/g, context.last_device ?? '');

  return out;
}

// ─── Audience Quality Stats ────────────────────────────────────────────────────

export const DATA_QUALITY_WARNING_THRESHOLD = 0.25;
export const DATA_QUALITY_WARNING_MIN_COUNT = 5;

export interface RepairAudienceStats {
  total: number;
  withHistory: number;
  missingHistory: number;
  missingPercent: number;
  isDataQualityWarning: boolean;
  usesRepairTags: boolean;
}

/**
 * Compute repair-history audience breakdown for the pre-flight panel.
 */
export function computeRepairAudienceStats(
  recipients: Customer[],
  contextMap: Map<string, MergeContext>,
  template: string
): RepairAudienceStats {
  const usesRepairTagsFlag = templateUsesRepairTags(template);
  const withHistory = recipients.filter(c => contextMap.get(c.id)?.has_repair_history).length;
  const missingHistory = recipients.length - withHistory;
  const missingPercent = recipients.length > 0 ? missingHistory / recipients.length : 0;

  return {
    total: recipients.length,
    withHistory,
    missingHistory,
    missingPercent,
    isDataQualityWarning:
      usesRepairTagsFlag &&
      missingHistory >= DATA_QUALITY_WARNING_MIN_COUNT &&
      missingPercent >= DATA_QUALITY_WARNING_THRESHOLD,
    usesRepairTags: usesRepairTagsFlag,
  };
}
