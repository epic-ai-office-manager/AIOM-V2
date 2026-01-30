/**
 * Revalidation Executor - Validates action protocol checks before execution
 *
 * This module executes typed revalidation predicates to ensure actions are still valid
 * and safe to execute. It supports 5 predicate types:
 * 1. odoo_record_exists - Check if Odoo record still exists
 * 2. odoo_field_equals - Check if field has expected value
 * 3. odoo_field_in - Check if field is in allowed set
 * 4. no_duplicate_action_in_window - Anti-spam check
 * 5. quiet_hours_ok - Business hours check
 */

import { getOdooClient } from '~/data-access/odoo';
import { database as db } from '~/db';
import { outreachState } from '~/db/ai-coo-schema';
import { and, eq, gte } from 'drizzle-orm';
import type {
  ActionProtocolV11,
  RevalidationCheck,
} from './action-protocol.v1_1';

// ============================================================================
// TYPES
// ============================================================================

export interface RevalidationResult {
  success: boolean;
  failedChecks: FailedCheck[];
  shouldBlock: boolean;
  shouldRequireReapproval: boolean;
}

export interface FailedCheck {
  checkId: string;
  description: string;
  severity: 'block' | 'require_reapproval';
  reason: string;
  predicateType: string;
}

// ============================================================================
// MAIN EXECUTION FUNCTION
// ============================================================================

/**
 * Execute all revalidation checks for an action
 * Returns result indicating if action should proceed, block, or require reapproval
 */
export async function runRevalidationChecks(
  action: ActionProtocolV11
): Promise<RevalidationResult> {
  const failedChecks: FailedCheck[] = [];

  // Execute each check
  for (const check of action.revalidation_plan.checks) {
    try {
      const passed = await executeCheck(check, action);

      if (!passed) {
        failedChecks.push({
          checkId: check.check_id,
          description: check.description,
          severity: check.severity_on_fail,
          reason: `Check failed: ${check.description}`,
          predicateType: check.predicate.type,
        });
      }
    } catch (error) {
      // If check execution fails, treat as failed check with block severity
      failedChecks.push({
        checkId: check.check_id,
        description: check.description,
        severity: 'block',
        reason: `Check execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        predicateType: check.predicate.type,
      });
    }
  }

  // Determine overall result
  const shouldBlock = failedChecks.some((fc) => fc.severity === 'block');
  const shouldRequireReapproval = failedChecks.some(
    (fc) => fc.severity === 'require_reapproval'
  );

  return {
    success: failedChecks.length === 0,
    failedChecks,
    shouldBlock,
    shouldRequireReapproval,
  };
}

// ============================================================================
// CHECK EXECUTORS
// ============================================================================

/**
 * Execute a single revalidation check based on its predicate type
 */
async function executeCheck(
  check: RevalidationCheck,
  action: ActionProtocolV11
): Promise<boolean> {
  const { predicate } = check;

  switch (predicate.type) {
    case 'odoo_record_exists':
      return await checkOdooRecordExists(predicate.model, predicate.id);

    case 'odoo_field_equals':
      return await checkOdooFieldEquals(
        predicate.model,
        predicate.id,
        predicate.field,
        predicate.expected
      );

    case 'odoo_field_in':
      return await checkOdooFieldIn(
        predicate.model,
        predicate.id,
        predicate.field,
        predicate.in
      );

    case 'no_duplicate_action_in_window':
      return await checkNoDuplicateAction(
        predicate.scope_key,
        predicate.window_minutes,
        action.org_id
      );

    case 'quiet_hours_ok':
      return checkQuietHours(
        predicate.timezone,
        predicate.business_hours_start,
        predicate.business_hours_end
      );

    default:
      // TypeScript should ensure this never happens with discriminated union
      throw new Error(`Unknown predicate type: ${(predicate as any).type}`);
  }
}

// ============================================================================
// ODOO PREDICATES
// ============================================================================

/**
 * Check if an Odoo record still exists
 */
async function checkOdooRecordExists(model: string, id: number): Promise<boolean> {
  try {
    const odooClient = await getOdooClient();
    const records = await odooClient.read(model, [id], { fields: ['id'] });
    return records.length > 0;
  } catch (error) {
    console.error(`[Revalidation] Failed to check Odoo record exists:`, error);
    return false;
  }
}

/**
 * Check if an Odoo field equals expected value
 */
async function checkOdooFieldEquals(
  model: string,
  id: number,
  field: string,
  expected: unknown
): Promise<boolean> {
  try {
    const odooClient = await getOdooClient();
    const records = await odooClient.read(model, [id], { fields: [field] });

    if (records.length === 0) {
      return false; // Record doesn't exist
    }

    const actualValue = records[0][field];

    // Handle Odoo many2one fields (arrays like [id, "name"])
    if (Array.isArray(actualValue) && typeof expected === 'number') {
      return actualValue[0] === expected;
    }

    return actualValue === expected;
  } catch (error) {
    console.error(`[Revalidation] Failed to check Odoo field equals:`, error);
    return false;
  }
}

/**
 * Check if an Odoo field is in allowed set
 */
async function checkOdooFieldIn(
  model: string,
  id: number,
  field: string,
  allowedValues: unknown[]
): Promise<boolean> {
  try {
    const odooClient = await getOdooClient();
    const records = await odooClient.read(model, [id], { fields: [field] });

    if (records.length === 0) {
      return false; // Record doesn't exist
    }

    const actualValue = records[0][field];

    // Handle Odoo many2one fields
    if (Array.isArray(actualValue)) {
      return allowedValues.includes(actualValue[0]);
    }

    return allowedValues.includes(actualValue);
  } catch (error) {
    console.error(`[Revalidation] Failed to check Odoo field in:`, error);
    return false;
  }
}

// ============================================================================
// ANTI-SPAM PREDICATE
// ============================================================================

/**
 * Check if no duplicate action has occurred within time window
 * Uses outreach_state table for tracking
 */
async function checkNoDuplicateAction(
  scopeKey: string,
  windowMinutes: number,
  orgId: string
): Promise<boolean> {
  try {
    // Parse scope key: "partner_123:invoice_reminder" → partnerId=123, contextType=invoice_reminder
    const [partnerPart, ...contextParts] = scopeKey.split(':');
    const partnerId = partnerPart.replace('partner_', '');
    const contextType = contextParts.join(':');

    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    // Check if there's a recent outreach in this window
    const recentOutreach = await db
      .select()
      .from(outreachState)
      .where(
        and(
          eq(outreachState.orgId, orgId),
          eq(outreachState.partnerId, partnerId),
          eq(outreachState.contextType, contextType),
          gte(outreachState.lastSentAt, windowStart)
        )
      )
      .limit(1);

    // If no recent outreach found, check passes
    return recentOutreach.length === 0;
  } catch (error) {
    console.error(`[Revalidation] Failed to check duplicate action:`, error);
    // On error, fail safe by blocking
    return false;
  }
}

// ============================================================================
// QUIET HOURS PREDICATE
// ============================================================================

/**
 * Check if current time is within business hours
 */
function checkQuietHours(
  timezone: string,
  businessHoursStart: string,
  businessHoursEnd: string
): boolean {
  try {
    const now = new Date();

    // Convert to target timezone
    const timeString = now.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });

    const [hours, minutes] = timeString.split(':').map(Number);
    const currentMinutes = hours * 60 + minutes;

    // Parse business hours
    const [startHours, startMinutes] = businessHoursStart.split(':').map(Number);
    const startMinutesTotal = startHours * 60 + startMinutes;

    const [endHours, endMinutes] = businessHoursEnd.split(':').map(Number);
    const endMinutesTotal = endHours * 60 + endMinutes;

    // Check if within business hours
    return currentMinutes >= startMinutesTotal && currentMinutes <= endMinutesTotal;
  } catch (error) {
    console.error(`[Revalidation] Failed to check quiet hours:`, error);
    // On error, fail safe by blocking (don't send outside hours if uncertain)
    return false;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Record outreach attempt in outreach_state table
 * Call this AFTER successful action execution
 */
export async function recordOutreachAttempt(
  orgId: string,
  partnerId: string,
  contextType: string,
  contextId: string,
  nextAllowedMinutes?: number
): Promise<void> {
  try {
    const now = new Date();
    const nextAllowedAt = nextAllowedMinutes
      ? new Date(now.getTime() + nextAllowedMinutes * 60 * 1000)
      : null;

    // Check if record exists
    const existing = await db
      .select()
      .from(outreachState)
      .where(
        and(
          eq(outreachState.orgId, orgId),
          eq(outreachState.partnerId, partnerId),
          eq(outreachState.contextType, contextType),
          eq(outreachState.contextId, contextId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing record
      await db
        .update(outreachState)
        .set({
          lastSentAt: now,
          nextAllowedAt,
          attemptCount: existing[0].attemptCount + 1,
          updatedAt: now,
        })
        .where(eq(outreachState.id, existing[0].id));
    } else {
      // Create new record
      const { nanoid } = await import('nanoid');
      await db.insert(outreachState).values({
        id: nanoid(),
        orgId,
        partnerId,
        contextType,
        contextId,
        lastSentAt: now,
        nextAllowedAt,
        attemptCount: 1,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (error) {
    console.error(`[Revalidation] Failed to record outreach attempt:`, error);
    // Don't throw - outreach tracking is important but not critical
  }
}

/**
 * Get human-readable summary of revalidation results
 */
export function formatRevalidationResult(result: RevalidationResult): string {
  if (result.success) {
    return 'All revalidation checks passed';
  }

  const messages: string[] = [];

  if (result.shouldBlock) {
    messages.push('🛑 Action BLOCKED due to failed checks:');
  } else if (result.shouldRequireReapproval) {
    messages.push('⚠️ Action requires re-approval due to failed checks:');
  }

  for (const check of result.failedChecks) {
    messages.push(`  - [${check.severity}] ${check.description}: ${check.reason}`);
  }

  return messages.join('\n');
}
