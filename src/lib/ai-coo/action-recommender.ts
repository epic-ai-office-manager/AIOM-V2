/**
 * Action Recommender - Generates autonomous actions from analysis results
 *
 * This module uses Claude AI to analyze business insights and generate
 * Action Protocol v1.1 actions that the AI COO can execute.
 *
 * Key Features:
 * - Analyzes financial, sales, operations data
 * - Generates diff-based approvals (proposed_changes)
 * - Creates typed revalidation predicates
 * - Tracks external effects (emails, SMS)
 * - Outputs Action Protocol v1.1 format
 */

import { nanoid } from 'nanoid';
import { getClaudeSDKClient } from '~/lib/claude/sdk-client';
import { getOdooClient } from '~/data-access/odoo';
import {
  ActionProtocolV11Schema,
  generateIdempotencyKey,
  type ActionProtocolV11,
  type ActionTypeEnum,
  type RiskLevelEnum,
  ACTION_TYPE_TO_SAFE_OPERATION,
  ACTION_TYPE_DEFAULT_RISK,
} from './action-protocol.v1_1';
import { createAutonomousAction } from '~/data-access/ai-coo';
import { analysisResults } from '~/db/ai-coo-schema';

// ============================================================================
// TYPES
// ============================================================================

export interface ActionRecommendation {
  action: ActionProtocolV11;
  reasoning: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ActionRecommenderInput {
  analysisResult: any; // AnalysisResult from database
  orgId?: string;
  userId?: string;
  guardrails?: GuardrailConfig;
}

export interface GuardrailConfig {
  autoApproveFinancialActions: boolean;
  maxEmailRecipientsPerAction: number;
  maxSMSPerDay: number;
  allowActionsOutsideBusinessHours: boolean;
  requireApprovalForBulkActions: boolean;
}

// ============================================================================
// DEFAULT GUARDRAILS (Ultra-Conservative)
// ============================================================================

const DEFAULT_GUARDRAILS: GuardrailConfig = {
  autoApproveFinancialActions: false, // Require approval for financial actions
  maxEmailRecipientsPerAction: 10,
  maxSMSPerDay: 50,
  allowActionsOutsideBusinessHours: false,
  requireApprovalForBulkActions: true,
};

// ============================================================================
// MAIN RECOMMENDER FUNCTION
// ============================================================================

/**
 * Generate action recommendations from analysis results
 *
 * @param input - Analysis results and configuration
 * @returns Array of recommended actions in v1.1 format
 */
export async function recommendActions(
  input: ActionRecommenderInput
): Promise<ActionRecommendation[]> {
  const startTime = Date.now();
  const { analysisResult, orgId = 'default-org', userId = 'system:ai-coo' } = input;
  const guardrails = { ...DEFAULT_GUARDRAILS, ...input.guardrails };

  console.log('[Action Recommender] Generating recommendations for analysis:', {
    analysisId: analysisResult.id,
    analyzerType: analysisResult.jobId,
  });

  try {
    // Step 1: Generate action recommendations using Claude
    const aiRecommendations = await generateRecommendationsWithClaude(
      analysisResult,
      guardrails
    );

    console.log(
      `[Action Recommender] Claude generated ${aiRecommendations.length} recommendations`
    );

    // Step 2: Convert AI recommendations to Action Protocol v1.1 format
    const actions: ActionRecommendation[] = [];

    for (const aiRec of aiRecommendations) {
      try {
        const action = await buildActionProtocol(aiRec, analysisResult, orgId, userId);

        // Validate action protocol
        const validated = ActionProtocolV11Schema.parse(action);

        actions.push({
          action: validated,
          reasoning: aiRec.reasoning,
          priority: aiRec.priority,
        });

        console.log(`[Action Recommender] Created action: ${action.action_type}`);
      } catch (error) {
        console.error(
          `[Action Recommender] Failed to build action:`,
          error,
          aiRec
        );
        // Continue with other actions
      }
    }

    // Step 3: Store actions in database
    for (const { action, priority } of actions) {
      await storeActionInDatabase(action, analysisResult.id);
      console.log(
        `[Action Recommender] Stored action ${action.action_id} (${priority} priority)`
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[Action Recommender] Generated ${actions.length} actions in ${duration}ms`);

    return actions;
  } catch (error) {
    console.error('[Action Recommender] Failed to generate recommendations:', error);
    throw error;
  }
}

// ============================================================================
// CLAUDE AI INTEGRATION
// ============================================================================

interface AIRecommendation {
  action_type: ActionTypeEnum;
  reasoning: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  affected_records: {
    odoo_model?: string;
    odoo_ids?: number[];
    partner_id?: number;
    partner_name?: string;
    record_name?: string;
  };
  operation_details: {
    type: string;
    to?: string;
    subject?: string;
    message?: string;
    task_name?: string;
    description?: string;
  };
}

/**
 * Use Claude AI to analyze results and generate action recommendations
 */
async function generateRecommendationsWithClaude(
  analysisResult: any,
  guardrails: GuardrailConfig
): Promise<AIRecommendation[]> {
  const claude = getClaudeSDKClient();

  // Build prompt for Claude
  const prompt = `You are the AI COO analyzing business data to recommend autonomous actions.

# Analysis Results

${JSON.stringify(analysisResult.metrics, null, 2)}

# Insights
${analysisResult.insights?.join('\n- ') || 'None'}

# Your Task

Analyze the above data and recommend specific autonomous actions following these rules:

1. **Be Specific**: Don't just say "follow up on invoice" - specify which invoice, which customer, what to say
2. **Be Conservative**: Only recommend actions that are safe and have clear business value
3. **Prioritize Impact**: Focus on high-value actions (overdue invoices, stalled high-value deals)
4. **Consider Timing**: Respect business hours and communication frequency

# Available Actions

- send_invoice_reminder: Email reminder for overdue invoices
- create_collection_task: Create task for collections team
- send_deal_check_in: Email check-in for stalled deals
- create_follow_up_task: Create follow-up task for sales team

# Output Format

Return a JSON array of recommendations:

\`\`\`json
[
  {
    "action_type": "send_invoice_reminder",
    "reasoning": "Invoice INV-001 is 45 days overdue ($5,000 from Acme Corp). Customer has been responsive in the past.",
    "priority": "high",
    "affected_records": {
      "odoo_model": "account.move",
      "odoo_ids": [123],
      "partner_id": 456,
      "partner_name": "Acme Corp",
      "record_name": "INV-001"
    },
    "operation_details": {
      "type": "send_email",
      "to": "billing@acmecorp.com",
      "subject": "Payment Reminder: Invoice INV-001",
      "message": "Your invoice INV-001 for $5,000 is now 45 days overdue. Please remit payment at your earliest convenience."
    }
  }
]
\`\`\`

# Guardrails

- Maximum ${guardrails.maxEmailRecipientsPerAction} email recipients per action
- Business hours only: ${guardrails.allowActionsOutsideBusinessHours ? 'No' : 'Yes'}
- Bulk actions require approval: ${guardrails.requireApprovalForBulkActions ? 'Yes' : 'No'}

# Important

- Only recommend actions with clear data to support them
- If no actions are needed, return an empty array []
- Focus on high-impact, low-risk actions
- Provide specific details for each action`;

  try {
    const response = await claude.complete(prompt, {
      useCase: 'action_recommendation',
      maxTokens: 2000,
    });

    // Parse JSON response
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      console.warn('[Action Recommender] Claude response did not contain JSON block');
      console.log('Response:', response.substring(0, 500));
      return [];
    }

    const recommendations = JSON.parse(jsonMatch[1]);

    if (!Array.isArray(recommendations)) {
      console.warn('[Action Recommender] Claude response is not an array');
      return [];
    }

    return recommendations;
  } catch (error) {
    console.error('[Action Recommender] Failed to parse Claude response:', error);
    return [];
  }
}

// ============================================================================
// ACTION PROTOCOL BUILDER
// ============================================================================

/**
 * Build Action Protocol v1.1 from AI recommendation
 */
async function buildActionProtocol(
  aiRec: AIRecommendation,
  analysisResult: any,
  orgId: string,
  userId: string
): Promise<ActionProtocolV11> {
  const actionId = nanoid();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  // Get safe operation for this action type
  const safeOperation = ACTION_TYPE_TO_SAFE_OPERATION[aiRec.action_type];
  const riskLevel = ACTION_TYPE_DEFAULT_RISK[aiRec.action_type];

  // Generate idempotency key
  const scope = aiRec.affected_records.record_name || aiRec.affected_records.partner_name || 'unknown';
  const idempotencyKey = generateIdempotencyKey(orgId, aiRec.action_type, scope);

  // Build proposed changes (diff-based approval)
  const proposedChanges = await generateProposedChanges(aiRec);

  // Build revalidation plan
  const revalidationPlan = generateRevalidationPlan(aiRec);

  // Build external effects
  const externalEffects = generateExternalEffects(aiRec);

  // Build operation with inputs
  const operation = buildOperation(aiRec);

  // Determine if requires approval (ultra-conservative: almost everything needs approval)
  const requiresApproval = determineRequiresApproval(aiRec, riskLevel);

  const action: ActionProtocolV11 = {
    version: '1.1',
    action_id: actionId,
    org_id: orgId,
    created_by: userId,
    created_at: now,

    action_type: aiRec.action_type,
    safe_operation: safeOperation,

    risk_level: riskLevel,
    status: requiresApproval ? 'pending_approval' : 'approved',

    requires_approval: requiresApproval,
    approval: requiresApproval
      ? {
          channels: ['in_app', 'email'], // Notify via dashboard and email
        }
      : undefined,

    expires_at: expiresAt,
    idempotency_key: idempotencyKey,

    analysis_id: analysisResult.id,
    expected_effect: `${aiRec.action_type}: ${aiRec.reasoning.substring(0, 100)}`,
    reasoning: aiRec.reasoning,

    affected_records: {
      odoo_model: aiRec.affected_records.odoo_model,
      odoo_ids: aiRec.affected_records.odoo_ids || [],
      partner_id: aiRec.affected_records.partner_id,
      partner_name: aiRec.affected_records.partner_name,
      record_name: aiRec.affected_records.record_name,
    },

    proposed_changes: proposedChanges,
    revalidation_plan: revalidationPlan,
    external_effects: externalEffects,

    operation,

    rollback_strategy: 'manual',
  };

  return action;
}

// ============================================================================
// PROPOSED CHANGES GENERATOR (Diff-Based Approval)
// ============================================================================

/**
 * Generate proposed_changes array showing before/after diff
 */
async function generateProposedChanges(aiRec: AIRecommendation): Promise<any[]> {
  const changes = [];

  // For email actions, show what will be sent
  if (aiRec.operation_details.type === 'send_email') {
    changes.push({
      path: 'communication.last_contact',
      before: null,
      after: new Date().toISOString(),
      change_type: 'set',
      human_label: 'Last Contact Date',
    });

    changes.push({
      path: 'communication.email_sent',
      before: null,
      after: aiRec.operation_details.to,
      change_type: 'set',
      human_label: `Email to ${aiRec.operation_details.to}`,
    });
  }

  // For task creation, show what task will be created
  if (aiRec.operation_details.type === 'create_odoo_task') {
    changes.push({
      path: 'project.task.new',
      before: null,
      after: {
        name: aiRec.operation_details.task_name,
        description: aiRec.operation_details.description,
      },
      change_type: 'add',
      human_label: 'New Task Creation',
    });
  }

  // Try to get actual Odoo record state for more accurate diff
  if (aiRec.affected_records.odoo_model && aiRec.affected_records.odoo_ids?.length) {
    try {
      const odoo = await getOdooClient();
      const records = await odoo.read(
        aiRec.affected_records.odoo_model,
        aiRec.affected_records.odoo_ids,
        { fields: ['name', 'stage_id', 'activity_date_deadline'] }
      );

      if (records.length > 0) {
        const record = records[0];
        // Add actual current state
        changes.push({
          path: `${aiRec.affected_records.odoo_model}.current_state`,
          before: record,
          after: record, // Will be updated by action
          change_type: 'set',
          human_label: 'Current Record State',
        });
      }
    } catch (error) {
      console.warn('[Action Recommender] Could not fetch Odoo record for diff:', error);
    }
  }

  return changes;
}

// ============================================================================
// REVALIDATION PLAN GENERATOR
// ============================================================================

/**
 * Generate revalidation_plan with typed predicates
 */
function generateRevalidationPlan(aiRec: AIRecommendation): any {
  const checks = [];

  // Check 1: Odoo record still exists
  if (aiRec.affected_records.odoo_model && aiRec.affected_records.odoo_ids?.length) {
    checks.push({
      check_id: 'record_exists',
      description: `Verify ${aiRec.affected_records.odoo_model} record still exists`,
      severity_on_fail: 'block' as const,
      predicate: {
        type: 'odoo_record_exists' as const,
        model: aiRec.affected_records.odoo_model,
        id: aiRec.affected_records.odoo_ids[0],
      },
    });
  }

  // Check 2: For invoice reminders, verify still unpaid
  if (
    aiRec.action_type === 'send_invoice_reminder' &&
    aiRec.affected_records.odoo_model === 'account.move'
  ) {
    checks.push({
      check_id: 'invoice_still_unpaid',
      description: 'Verify invoice is still unpaid',
      severity_on_fail: 'block' as const,
      predicate: {
        type: 'odoo_field_in' as const,
        model: 'account.move',
        id: aiRec.affected_records.odoo_ids![0],
        field: 'payment_state',
        in: ['not_paid', 'partial'],
      },
    });
  }

  // Check 3: Anti-spam - no duplicate communication in last 4 hours
  if (aiRec.operation_details.type === 'send_email') {
    const scopeKey = `partner_${aiRec.affected_records.partner_id}:${aiRec.action_type}`;
    checks.push({
      check_id: 'no_duplicate_email',
      description: 'Ensure no email sent to this partner in last 4 hours',
      severity_on_fail: 'block' as const,
      predicate: {
        type: 'no_duplicate_action_in_window' as const,
        scope_key: scopeKey,
        window_minutes: 240, // 4 hours
      },
    });
  }

  // Check 4: Business hours check
  checks.push({
    check_id: 'business_hours',
    description: 'Verify action is during business hours',
    severity_on_fail: 'require_reapproval' as const,
    predicate: {
      type: 'quiet_hours_ok' as const,
      timezone: 'America/New_York',
      business_hours_start: '09:00',
      business_hours_end: '17:00',
    },
  });

  return { checks };
}

// ============================================================================
// EXTERNAL EFFECTS GENERATOR
// ============================================================================

/**
 * Generate external_effects array (who gets contacted)
 * GRACEFUL DEGRADATION: Only add effects if we have valid recipient info
 */
function generateExternalEffects(aiRec: AIRecommendation): any[] {
  const effects = [];

  // Validate we have recipient info before creating external effect
  const hasValidRecipient = aiRec.operation_details.to &&
                           aiRec.operation_details.to.includes('@') ||
                           aiRec.operation_details.to?.match(/^\+?\d+$/);

  if (aiRec.operation_details.type === 'send_email' && hasValidRecipient) {
    effects.push({
      effect_type: 'email' as const,
      recipient: aiRec.operation_details.to,
      recipient_partner_id: aiRec.affected_records.partner_id || null,
      subject: aiRec.operation_details.subject,
      preview: aiRec.operation_details.message?.substring(0, 200),
    });
  } else if (aiRec.operation_details.type === 'send_email') {
    console.warn('[Action Recommender] Skipping email effect - no valid recipient:', aiRec.affected_records.partner_name);
  }

  if (aiRec.operation_details.type === 'send_sms' && hasValidRecipient) {
    effects.push({
      effect_type: 'sms' as const,
      recipient: aiRec.operation_details.to,
      recipient_partner_id: aiRec.affected_records.partner_id || null,
      preview: aiRec.operation_details.message?.substring(0, 160),
    });
  } else if (aiRec.operation_details.type === 'send_sms') {
    console.warn('[Action Recommender] Skipping SMS effect - no valid recipient:', aiRec.affected_records.partner_name);
  }

  return effects;
}

// ============================================================================
// OPERATION BUILDER (Discriminated Union)
// ============================================================================

/**
 * Build operation with typed inputs (discriminated union)
 * GRACEFUL DEGRADATION: Convert to internal task if external comm lacks recipient
 */
function buildOperation(aiRec: AIRecommendation): any {
  const { operation_details: details } = aiRec;

  // Normalize operation type (handle variations from Claude)
  const normalizedType = details.type
    .replace('create_task', 'create_odoo_task')
    .replace('_task', '_odoo_task');

  // Validate recipient info for external communications
  const hasValidRecipient = details.to &&
                           (details.to.includes('@') || details.to.match(/^\+?\d+$/));

  switch (normalizedType) {
    case 'send_email':
      if (!hasValidRecipient) {
        // FALLBACK: Create internal task instead
        console.warn('[Action Recommender] No valid email recipient, creating task instead');
        return {
          type: 'create_odoo_task' as const,
          inputs: {
            name: `MANUAL: ${details.subject || 'Contact customer'}`,
            description: `NEEDS MANUAL FOLLOW-UP\n\nPartner: ${aiRec.affected_records.partner_name}\nReason: ${details.message}\n\n⚠️ Could not auto-send email (missing contact info)`,
            priority: '1',
          },
        };
      }
      return {
        type: 'send_email' as const,
        inputs: {
          to: details.to,
          subject: details.subject!,
          body_text: details.message!,
          body_html: `<p>${details.message!.replace(/\n/g, '<br>')}</p>`,
        },
      };

    case 'send_sms':
      if (!hasValidRecipient) {
        // FALLBACK: Create internal task instead
        console.warn('[Action Recommender] No valid SMS recipient, creating task instead');
        return {
          type: 'create_odoo_task' as const,
          inputs: {
            name: `MANUAL: Contact ${aiRec.affected_records.partner_name}`,
            description: `NEEDS MANUAL FOLLOW-UP\n\nPartner: ${aiRec.affected_records.partner_name}\nMessage: ${details.message}\n\n⚠️ Could not auto-send SMS (missing phone number)`,
            priority: '1',
          },
        };
      }
      return {
        type: 'send_sms' as const,
        inputs: {
          to: details.to,
          body: details.message!,
        },
      };

    case 'create_odoo_task':
      return {
        type: 'create_odoo_task' as const,
        inputs: {
          name: details.task_name!,
          description: details.description || details.message,
          priority: '1',
        },
      };

    default:
      throw new Error(`Unknown operation type: ${details.type} (normalized: ${normalizedType})`);
  }
}

// ============================================================================
// APPROVAL LOGIC
// ============================================================================

/**
 * Determine if action requires approval (ultra-conservative by default)
 */
function determineRequiresApproval(
  aiRec: AIRecommendation,
  riskLevel: RiskLevelEnum
): boolean {
  // Critical and high risk always require approval
  if (riskLevel === 'critical' || riskLevel === 'high') {
    return true;
  }

  // Financial actions require approval
  if (aiRec.action_type.includes('invoice') || aiRec.action_type.includes('payment')) {
    return true;
  }

  // External communications require approval
  if (aiRec.operation_details.type === 'send_email' || aiRec.operation_details.type === 'send_sms') {
    return true;
  }

  // Low risk internal actions (like creating tasks) could auto-approve
  // But with ultra-conservative guardrails, we approve everything
  return true;
}

// ============================================================================
// DATABASE STORAGE
// ============================================================================

/**
 * Store action in autonomous_actions table
 */
async function storeActionInDatabase(
  action: ActionProtocolV11,
  analysisId: string
): Promise<void> {
  await createAutonomousAction({
    id: action.action_id,
    actionType: action.action_type,
    targetSystem: 'odoo',
    targetId: action.affected_records.odoo_ids[0]?.toString() || null,
    description: action.expected_effect,
    parameters: {},
    decisionReasoning: action.reasoning,
    requiresApproval: action.requires_approval,
    status: action.status,
    createdAt: action.created_at,

    // v1.1 fields
    actionProtocol: action as any,
    orgId: action.org_id,
    idempotencyKey: action.idempotency_key,
    expiresAt: action.expires_at,
    riskLevel: action.risk_level,
    safeOperation: action.safe_operation,
    analysisId,
  });
}
