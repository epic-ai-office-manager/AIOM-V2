/**
 * Action Protocol v1.1 - Production-Grade Autonomous Action Specification
 *
 * This is the strict contract for every autonomous action the AI COO can take.
 * Key improvements over v1.0:
 * - Diff-first approvals: proposed_changes[] shows exact before/after values
 * - Typed revalidation predicates: Machine-readable checks with severity levels
 * - Outreach anti-spam: External effects tracking with throttling
 * - Stricter type safety: Discriminated unions for operation inputs
 */

import { z } from 'zod';

// ============================================================================
// VERSION & ENUMS
// ============================================================================

export const ActionProtocolVersion = z.literal('1.1');

export const ActionType = z.enum([
  'follow_up_on_stale_deal',
  'send_invoice_reminder',
  'create_collection_task',
  'schedule_customer_check_in',
  'update_deal_stage',
  'flag_at_risk_project',
  'send_payment_confirmation',
  'create_follow_up_task',
  'send_deal_check_in',
  'escalate_overdue_invoice',
]);

export const SafeOperationType = z.enum([
  'send_email',
  'send_sms',
  'create_odoo_task',
  'update_odoo_stage',
  'log_odoo_activity',
  'create_internal_note',
  'schedule_follow_up',
]);

export const RiskLevel = z.enum(['low', 'medium', 'high', 'critical']);

export const ActionStatus = z.enum([
  'pending_approval',
  'approved',
  'rejected',
  'executing',
  'completed',
  'failed',
  'expired',
]);

export const Channel = z.enum(['in_app', 'email', 'sms']);

export const RollbackStrategy = z.enum([
  'none',
  'manual',
  'auto_undo_odoo_write',
  'send_correction_email',
]);

// ============================================================================
// DIFF-BASED APPROVALS
// ============================================================================

export const ProposedChangeSchema = z.object({
  path: z.string().min(1).describe('e.g. "crm.lead.stage_id" or "res.partner.email"'),
  before: z.unknown().nullable().describe('Current value (null if creating)'),
  after: z.unknown().nullable().describe('Proposed new value (null if deleting)'),
  change_type: z.enum(['set', 'add', 'remove']),
  human_label: z.string().optional().describe('e.g. "Stage: Qualified → Negotiation"'),
});

export type ProposedChange = z.infer<typeof ProposedChangeSchema>;

// ============================================================================
// AFFECTED RECORDS
// ============================================================================

export const AffectedRecordsSchema = z.object({
  odoo_model: z.string().optional().describe('e.g. "crm.lead", "account.move"'),
  odoo_ids: z.array(z.number().int().positive()).default([]),
  partner_id: z.number().int().positive().nullable().optional().describe('Odoo res.partner ID'),
  partner_name: z.string().optional(),
  record_name: z.string().optional().describe('e.g. "INV-2024-001"'),
});

export type AffectedRecords = z.infer<typeof AffectedRecordsSchema>;

// ============================================================================
// TYPED REVALIDATION PREDICATES
// ============================================================================

export const RevalidationCheckSchema = z.object({
  check_id: z.string().min(1).describe('Unique identifier for this check'),
  description: z.string().min(5).describe('Human-readable explanation'),
  severity_on_fail: z.enum(['block', 'require_reapproval']),
  predicate: z.discriminatedUnion('type', [
    // Check 1: Record still exists in Odoo
    z.object({
      type: z.literal('odoo_record_exists'),
      model: z.string().min(1),
      id: z.number().int().positive(),
    }),

    // Check 2: Field equals expected value
    z.object({
      type: z.literal('odoo_field_equals'),
      model: z.string().min(1),
      id: z.number().int().positive(),
      field: z.string().min(1),
      expected: z.unknown(),
    }),

    // Check 3: Field is in allowed set
    z.object({
      type: z.literal('odoo_field_in'),
      model: z.string().min(1),
      id: z.number().int().positive(),
      field: z.string().min(1),
      in: z.array(z.unknown()).min(1),
    }),

    // Check 4: No duplicate action in time window (anti-spam)
    z.object({
      type: z.literal('no_duplicate_action_in_window'),
      scope_key: z.string().min(1).describe('e.g. "partner_123:invoice_reminder"'),
      window_minutes: z.number().int().positive(),
    }),

    // Check 5: Quiet hours check
    z.object({
      type: z.literal('quiet_hours_ok'),
      timezone: z.string().default('America/New_York'),
      business_hours_start: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),
      business_hours_end: z.string().regex(/^\d{2}:\d{2}$/).default('17:00'),
    }),
  ]),
});

export type RevalidationCheck = z.infer<typeof RevalidationCheckSchema>;

export const RevalidationPlanSchema = z.object({
  checks: z.array(RevalidationCheckSchema).default([]),
});

export type RevalidationPlan = z.infer<typeof RevalidationPlanSchema>;

// ============================================================================
// EXTERNAL EFFECTS TRACKING
// ============================================================================

export const ExternalEffectSchema = z.object({
  effect_type: z.enum(['email', 'sms', 'api_call', 'webhook']),
  recipient: z.string().optional().describe('Email or phone number'),
  recipient_partner_id: z.number().int().positive().nullable().optional(),
  subject: z.string().optional(),
  preview: z.string().max(200).optional().describe('First 200 chars of message'),
  estimated_delivery_at: z.coerce.date().optional(),
});

export type ExternalEffect = z.infer<typeof ExternalEffectSchema>;

// ============================================================================
// OPERATION INPUTS (Discriminated Union)
// ============================================================================

export const OperationWithInputsSchema = z.discriminatedUnion('type', [
  // Email operation
  z.object({
    type: z.literal('send_email'),
    inputs: z.object({
      to: z.string().email(),
      cc: z.array(z.string().email()).optional(),
      subject: z.string().min(1).max(200),
      body_text: z.string().min(1),
      body_html: z.string().optional(),
      template_id: z.string().optional(),
      template_vars: z.record(z.string(), z.unknown()).optional(),
    }),
  }),

  // SMS operation
  z.object({
    type: z.literal('send_sms'),
    inputs: z.object({
      to: z.string().regex(/^\+\d{10,15}$/),
      body: z.string().min(1).max(320),
      template_id: z.string().optional(),
    }),
  }),

  // Create Odoo task
  z.object({
    type: z.literal('create_odoo_task'),
    inputs: z.object({
      name: z.string().min(1).max(200),
      description: z.string().optional(),
      user_id: z.number().int().positive().optional(),
      date_deadline: z.coerce.date().optional(),
      priority: z.enum(['0', '1', '2', '3']).default('1'),
      partner_id: z.number().int().positive().optional(),
      project_id: z.number().int().positive().optional(),
    }),
  }),

  // Update Odoo stage
  z.object({
    type: z.literal('update_odoo_stage'),
    inputs: z.object({
      model: z.enum(['crm.lead', 'project.task', 'sale.order']),
      record_id: z.number().int().positive(),
      stage_id: z.number().int().positive(),
      reason: z.string().optional(),
    }),
  }),

  // Log Odoo activity
  z.object({
    type: z.literal('log_odoo_activity'),
    inputs: z.object({
      res_model: z.string().min(1),
      res_id: z.number().int().positive(),
      activity_type_id: z.number().int().positive(),
      summary: z.string().min(1).max(200),
      note: z.string().optional(),
      date_deadline: z.coerce.date().optional(),
      user_id: z.number().int().positive().optional(),
    }),
  }),

  // Create internal note
  z.object({
    type: z.literal('create_internal_note'),
    inputs: z.object({
      model: z.string().min(1),
      record_id: z.number().int().positive(),
      body: z.string().min(1),
      subtype: z.enum(['comment', 'notification']).default('comment'),
    }),
  }),

  // Schedule follow-up
  z.object({
    type: z.literal('schedule_follow_up'),
    inputs: z.object({
      context_type: z.enum(['deal', 'invoice', 'task', 'customer']),
      context_id: z.string().min(1),
      scheduled_for: z.coerce.date(),
      action_type: z.enum(['email', 'sms', 'call', 'task']),
      template_id: z.string().optional(),
      parameters: z.record(z.string(), z.unknown()).optional(),
    }),
  }),
]);

export type OperationWithInputs = z.infer<typeof OperationWithInputsSchema>;

// ============================================================================
// MAIN ACTION PROTOCOL SCHEMA
// ============================================================================

export const ActionProtocolV11Schema = z.object({
  // Version & Identity
  version: ActionProtocolVersion,
  action_id: z.string().min(10).describe('Unique action identifier (nanoid or uuid)'),
  org_id: z.string().min(1).describe('Organization/tenant ID'),
  created_by: z.string().min(1).describe('User ID or "system:ai-coo"'),
  created_at: z.coerce.date(),

  // Action Classification
  action_type: ActionType,
  safe_operation: SafeOperationType,

  // Risk & Status
  risk_level: RiskLevel,
  status: ActionStatus,

  // Approval Workflow
  requires_approval: z.boolean(),
  approval: z.object({
    channels: z.array(Channel).min(1).default(['in_app']),
    approved_by: z.string().optional(),
    approved_at: z.coerce.date().optional(),
    rejected_by: z.string().optional(),
    rejected_at: z.coerce.date().optional(),
    rejection_reason: z.string().optional(),
  }).optional(),

  // Expiration & Idempotency
  expires_at: z.coerce.date().describe('Actions expire after 24h by default'),
  idempotency_key: z.string().min(1).describe('Format: org_id:action_type:scope:yyyy-mm-dd'),

  // Context & Reasoning
  analysis_id: z.string().optional().describe('Link to AI COO analysis that triggered this'),
  expected_effect: z.string().min(10).max(600).describe('What we expect to happen'),
  reasoning: z.string().min(10).max(2000).describe('Why the AI recommends this action'),

  // Change Tracking (v1.1 Key Feature)
  affected_records: AffectedRecordsSchema,
  proposed_changes: z.array(ProposedChangeSchema).default([]).describe('Diff-first approvals'),
  revalidation_plan: RevalidationPlanSchema.default({ checks: [] }),
  external_effects: z.array(ExternalEffectSchema).default([]).describe('Outbound communications'),

  // Operation Details (Discriminated Union)
  operation: OperationWithInputsSchema,

  // Impact Estimation
  estimated_impact: z.object({
    revenue_change: z.number().optional().describe('Expected revenue impact in dollars'),
    cash_runway_change_days: z.number().optional().describe('Impact on cash runway'),
    time_saved_hours: z.number().optional().describe('Estimated time saved'),
    risk_reduction_score: z.number().min(0).max(100).optional(),
  }).optional(),

  // Rollback & Safety
  rollback_strategy: RollbackStrategy,

  // Execution Tracking
  executed_at: z.coerce.date().optional(),
  execution_duration_ms: z.number().int().optional(),
  execution_result: z.object({
    success: z.boolean(),
    error_message: z.string().optional(),
    external_id: z.unknown().optional().describe('e.g. Odoo record ID, email message ID'),
    side_effects: z.array(z.string()).optional().describe('Unintended side effects'),
  }).optional(),

  // Extensibility
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ActionProtocolV11 = z.infer<typeof ActionProtocolV11Schema>;

// ============================================================================
// HELPER TYPES & UTILITIES
// ============================================================================

export type ActionTypeEnum = z.infer<typeof ActionType>;
export type SafeOperationTypeEnum = z.infer<typeof SafeOperationType>;
export type RiskLevelEnum = z.infer<typeof RiskLevel>;
export type ActionStatusEnum = z.infer<typeof ActionStatus>;
export type ChannelEnum = z.infer<typeof Channel>;
export type RollbackStrategyEnum = z.infer<typeof RollbackStrategy>;

/**
 * Strict 1:1 mapping between action_type and safe_operation
 * This ensures AI cannot mix incompatible actions and operations
 */
export const ACTION_TYPE_TO_SAFE_OPERATION: Record<ActionTypeEnum, SafeOperationTypeEnum> = {
  follow_up_on_stale_deal: 'send_email',
  send_invoice_reminder: 'send_email',
  create_collection_task: 'create_odoo_task',
  schedule_customer_check_in: 'schedule_follow_up',
  update_deal_stage: 'update_odoo_stage',
  flag_at_risk_project: 'create_odoo_task',
  send_payment_confirmation: 'send_email',
  create_follow_up_task: 'create_odoo_task',
  send_deal_check_in: 'send_email',
  escalate_overdue_invoice: 'create_odoo_task',
};

/**
 * Default risk levels per action type
 */
export const ACTION_TYPE_DEFAULT_RISK: Record<ActionTypeEnum, RiskLevelEnum> = {
  follow_up_on_stale_deal: 'low',
  send_invoice_reminder: 'low',
  create_collection_task: 'medium',
  schedule_customer_check_in: 'low',
  update_deal_stage: 'medium',
  flag_at_risk_project: 'low',
  send_payment_confirmation: 'low',
  create_follow_up_task: 'low',
  send_deal_check_in: 'low',
  escalate_overdue_invoice: 'high',
};

/**
 * Generate idempotency key following org-scoped format
 * Format: org_id:action_type:scope:yyyy-mm-dd
 */
export function generateIdempotencyKey(
  orgId: string,
  actionType: ActionTypeEnum,
  scope: string
): string {
  const date = new Date().toISOString().split('T')[0]; // yyyy-mm-dd
  return `${orgId}:${actionType}:${scope}:${date}`;
}

/**
 * Validate action protocol at runtime
 * Throws ZodError if invalid
 */
export function validateActionProtocol(action: unknown): ActionProtocolV11 {
  return ActionProtocolV11Schema.parse(action);
}

/**
 * Check if action has expired
 */
export function isActionExpired(action: ActionProtocolV11): boolean {
  return new Date() > new Date(action.expires_at);
}

/**
 * Check if action requires approval
 */
export function requiresApproval(action: ActionProtocolV11): boolean {
  return action.requires_approval && action.status === 'pending_approval';
}

/**
 * Check if action is approved and ready to execute
 */
export function isReadyToExecute(action: ActionProtocolV11): boolean {
  return (
    action.status === 'approved' &&
    !isActionExpired(action) &&
    action.approval?.approved_at !== undefined
  );
}

/**
 * Get human-readable action description
 */
export function getActionDescription(action: ActionProtocolV11): string {
  const target = action.affected_records.record_name || action.affected_records.partner_name || 'Unknown';
  return `${action.action_type}: ${target}`;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const DEFAULT_ACTION_EXPIRY_HOURS = 24;
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 5000;

/**
 * Rate limits for external communications (anti-spam)
 */
export const RATE_LIMITS = {
  email: {
    per_hour: 100,
    per_day: 500,
    per_partner_per_day: 3,
  },
  sms: {
    per_hour: 20,
    per_day: 50,
    per_partner_per_day: 2,
  },
} as const;
