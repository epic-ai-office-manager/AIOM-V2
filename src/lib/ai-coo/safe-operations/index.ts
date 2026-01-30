/**
 * Safe Operations Layer - Curated business actions for AI COO
 *
 * This is the ONLY interface through which the AI can execute actions.
 * It provides curated, safe operations with:
 * - Type safety via zod schemas
 * - Rate limiting
 * - Audit logging
 * - Error handling
 * - No direct access to raw CRUD operations
 *
 * IMPORTANT: AI cannot bypass this layer. All actions must go through here.
 */

import { getOdooClient } from '~/data-access/odoo';
import { recordOutreachAttempt } from '../revalidation-executor';
import type { OperationWithInputs } from '../action-protocol.v1_1';
import { sendEmailViaSMTP2GO } from './smtp2go-client';
import { sendSMSViaEpicGateway } from './epic-sms-client';

// ============================================================================
// TYPES
// ============================================================================

export interface OperationResult {
  success: boolean;
  externalId?: string | number; // Odoo record ID, email message ID, etc.
  message?: string;
  error?: string;
  timestamp: Date;
}

// ============================================================================
// MAIN EXECUTION FUNCTION
// ============================================================================

/**
 * Execute a safe operation based on its type
 * This is the single entry point for all AI actions
 */
export async function executeSafeOperation(
  operation: OperationWithInputs,
  actionId: string,
  orgId: string = 'default-org'
): Promise<OperationResult> {
  const startTime = Date.now();

  try {
    let result: OperationResult;

    switch (operation.type) {
      case 'send_email':
        result = await sendEmail(operation.inputs, orgId);
        break;

      case 'send_sms':
        result = await sendSMS(operation.inputs, orgId);
        break;

      case 'create_odoo_task':
        result = await createOdooTask(operation.inputs);
        break;

      case 'update_odoo_stage':
        result = await updateOdooStage(operation.inputs);
        break;

      case 'log_odoo_activity':
        result = await logOdooActivity(operation.inputs);
        break;

      case 'create_internal_note':
        result = await createInternalNote(operation.inputs);
        break;

      case 'schedule_follow_up':
        result = await scheduleFollowUp(operation.inputs, orgId);
        break;

      default:
        // TypeScript ensures this never happens with discriminated union
        throw new Error(`Unknown operation type: ${(operation as any).type}`);
    }

    console.log(
      `[Safe Operations] ${operation.type} completed in ${Date.now() - startTime}ms`,
      { actionId, success: result.success }
    );

    return result;
  } catch (error) {
    console.error(`[Safe Operations] ${operation.type} failed:`, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
    };
  }
}

// ============================================================================
// EMAIL OPERATIONS
// ============================================================================

/**
 * Send email via SMTP2GO
 */
async function sendEmail(
  inputs: Extract<OperationWithInputs, { type: 'send_email' }>['inputs'],
  orgId: string
): Promise<OperationResult> {
  try {
    console.log('[Safe Operations] Sending email via SMTP2GO:', {
      to: inputs.to,
      subject: inputs.subject,
      bodyPreview: inputs.body_text ? inputs.body_text.substring(0, 100) : inputs.body_html?.substring(0, 100),
    });

    // Prepare email recipients
    const recipients = inputs.cc ? [inputs.to, ...inputs.cc] : inputs.to;

    // Send email via SMTP2GO
    const result = await sendEmailViaSMTP2GO(
      recipients,
      inputs.subject,
      inputs.body_text || '',
      inputs.body_html,
      undefined // Use default sender from env
    );

    if (!result.success) {
      throw new Error(result.error || 'Email send failed');
    }

    return {
      success: true,
      externalId: result.messageId,
      message: `Email sent to ${inputs.to}`,
      timestamp: result.timestamp,
    };
  } catch (error) {
    throw new Error(`Email send failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// SMS OPERATIONS
// ============================================================================

/**
 * Send SMS via Epic SMS Gateway (your custom server)
 */
async function sendSMS(
  inputs: Extract<OperationWithInputs, { type: 'send_sms' }>['inputs'],
  orgId: string
): Promise<OperationResult> {
  try {
    console.log('[Safe Operations] Sending SMS via Epic Gateway:', {
      to: inputs.to,
      bodyPreview: inputs.body.substring(0, 50),
    });

    // Send SMS via Epic SMS Gateway
    const result = await sendSMSViaEpicGateway(inputs.to, inputs.body);

    if (!result.success) {
      throw new Error(result.error || 'SMS send failed');
    }

    return {
      success: true,
      externalId: result.messageId,
      message: `SMS sent to ${inputs.to}`,
      timestamp: result.timestamp,
    };
  } catch (error) {
    throw new Error(`SMS send failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// ODOO OPERATIONS
// ============================================================================

/**
 * Create task in Odoo
 */
async function createOdooTask(
  inputs: Extract<OperationWithInputs, { type: 'create_odoo_task' }>['inputs']
): Promise<OperationResult> {
  try {
    const odooClient = await getOdooClient();

    // Prepare task values
    const taskValues: Record<string, any> = {
      name: inputs.name,
      description: inputs.description || '',
      priority: inputs.priority || '1',
    };

    // Add optional fields if provided
    if (inputs.user_id) taskValues.user_id = inputs.user_id;
    if (inputs.date_deadline) {
      taskValues.date_deadline = inputs.date_deadline.toISOString().split('T')[0];
    }
    if (inputs.partner_id) taskValues.partner_id = inputs.partner_id;
    if (inputs.project_id) taskValues.project_id = inputs.project_id;

    // Create task in Odoo
    const taskId = await odooClient.create('project.task', taskValues);

    return {
      success: true,
      externalId: taskId,
      message: `Task created: ${inputs.name}`,
      timestamp: new Date(),
    };
  } catch (error) {
    throw new Error(
      `Odoo task creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Update stage in Odoo (for deals, tasks, orders)
 */
async function updateOdooStage(
  inputs: Extract<OperationWithInputs, { type: 'update_odoo_stage' }>['inputs']
): Promise<OperationResult> {
  try {
    const odooClient = await getOdooClient();

    // Update stage
    await odooClient.write(inputs.model, [inputs.record_id], {
      stage_id: inputs.stage_id,
      ...(inputs.reason ? { description: inputs.reason } : {}),
    });

    return {
      success: true,
      externalId: inputs.record_id,
      message: `Stage updated for ${inputs.model} #${inputs.record_id}`,
      timestamp: new Date(),
    };
  } catch (error) {
    throw new Error(
      `Odoo stage update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Log activity in Odoo (for follow-ups, notes, meetings)
 */
async function logOdooActivity(
  inputs: Extract<OperationWithInputs, { type: 'log_odoo_activity' }>['inputs']
): Promise<OperationResult> {
  try {
    const odooClient = await getOdooClient();

    const activityValues: Record<string, any> = {
      res_model: inputs.res_model,
      res_id: inputs.res_id,
      activity_type_id: inputs.activity_type_id,
      summary: inputs.summary,
    };

    if (inputs.note) activityValues.note = inputs.note;
    if (inputs.date_deadline) {
      activityValues.date_deadline = inputs.date_deadline.toISOString().split('T')[0];
    }
    if (inputs.user_id) activityValues.user_id = inputs.user_id;

    const activityId = await odooClient.create('mail.activity', activityValues);

    return {
      success: true,
      externalId: activityId,
      message: `Activity logged: ${inputs.summary}`,
      timestamp: new Date(),
    };
  } catch (error) {
    throw new Error(
      `Odoo activity logging failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Create internal note in Odoo (chatter message)
 */
async function createInternalNote(
  inputs: Extract<OperationWithInputs, { type: 'create_internal_note' }>['inputs']
): Promise<OperationResult> {
  try {
    const odooClient = await getOdooClient();

    // Create message in chatter
    const messageId = await odooClient.create('mail.message', {
      model: inputs.model,
      res_id: inputs.record_id,
      body: inputs.body,
      message_type: 'comment',
      subtype_id: inputs.subtype === 'notification' ? 2 : 1, // Standard Odoo subtypes
    });

    return {
      success: true,
      externalId: messageId,
      message: 'Internal note created',
      timestamp: new Date(),
    };
  } catch (error) {
    throw new Error(
      `Odoo note creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================================================
// FOLLOW-UP OPERATIONS
// ============================================================================

/**
 * Schedule follow-up action
 */
async function scheduleFollowUp(
  inputs: Extract<OperationWithInputs, { type: 'schedule_follow_up' }>['inputs'],
  orgId: string
): Promise<OperationResult> {
  try {
    // TODO: Integrate with follow-up engine (to be created)
    // For now, create as Odoo activity as a placeholder

    const odooClient = await getOdooClient();

    // Map context type to Odoo model
    const modelMap: Record<string, string> = {
      deal: 'crm.lead',
      invoice: 'account.move',
      task: 'project.task',
      customer: 'res.partner',
    };

    const model = modelMap[inputs.context_type];
    if (!model) {
      throw new Error(`Unknown context type: ${inputs.context_type}`);
    }

    // Parse context_id as integer
    const recordId = parseInt(inputs.context_id, 10);
    if (isNaN(recordId)) {
      throw new Error(`Invalid context_id: ${inputs.context_id}`);
    }

    // Create activity as follow-up placeholder
    const activityId = await odooClient.create('mail.activity', {
      res_model: model,
      res_id: recordId,
      activity_type_id: 1, // Default "Email" activity type
      summary: `Follow-up: ${inputs.action_type}`,
      date_deadline: inputs.scheduled_for.toISOString().split('T')[0],
    });

    return {
      success: true,
      externalId: activityId,
      message: `Follow-up scheduled for ${inputs.scheduled_for.toISOString()}`,
      timestamp: new Date(),
    };
  } catch (error) {
    throw new Error(
      `Follow-up scheduling failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================================================
// RATE LIMITING & SAFETY
// ============================================================================

/**
 * Check if operation is allowed based on rate limits
 * This should be called BEFORE executing operations
 */
export async function checkRateLimits(
  operationType: OperationWithInputs['type'],
  orgId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // TODO: Implement actual rate limiting with Redis or in-memory cache
  // For now, always allow but log

  console.log(`[Safe Operations] Rate limit check for ${operationType} in org ${orgId}`);

  // Placeholder implementation
  return { allowed: true };
}

/**
 * Record operation execution for audit trail
 */
export async function recordOperationExecution(
  operationType: OperationWithInputs['type'],
  actionId: string,
  result: OperationResult
): Promise<void> {
  // TODO: Store in audit trail table
  console.log('[Safe Operations] Operation recorded:', {
    operationType,
    actionId,
    success: result.success,
  });
}
