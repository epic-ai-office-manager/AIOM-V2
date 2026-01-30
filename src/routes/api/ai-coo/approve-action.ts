/**
 * API Route: Approve and Execute Autonomous Action
 *
 * Handles approval of AI COO recommended actions and executes them via workflow engine.
 */

import { createFileRoute } from '@tanstack/react-router';
import { eq } from 'drizzle-orm';
import { database as db } from '~/db';
import { autonomousActions } from '~/db/ai-coo-schema';
import {
  approveAction,
  markActionAsExecuted,
  markActionAsFailed,
} from '~/data-access/ai-coo';
import { actionStepHandler } from '~/lib/workflow-automation-engine/step-handlers';
import type {
  WorkflowStepDefinition,
  WorkflowContext,
} from '~/lib/workflow-automation-engine/types';
import type { WorkflowActionType } from '~/db/schema';

export const Route = createFileRoute('/api/ai-coo/approve-action')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { actionId, userId } = body as { actionId: string; userId: string };

          // Validate input
          if (!actionId || !userId) {
            return Response.json(
              { error: 'Missing required fields: actionId, userId' },
              { status: 400 }
            );
          }

          // Fetch the action from database
          const [action] = await db
            .select()
            .from(autonomousActions)
            .where(eq(autonomousActions.id, actionId))
            .limit(1);

          if (!action) {
            return Response.json({ error: 'Action not found' }, { status: 404 });
          }

          // Check if action is already processed
          if (action.status !== 'pending') {
            return Response.json(
              {
                error: `Action already ${action.status}`,
                status: action.status,
              },
              { status: 400 }
            );
          }

          // Approve the action
          await approveAction(actionId, userId);

          console.log(`[AI COO] Action ${actionId} approved by ${userId}, executing...`);

          // Build workflow step from action parameters
          const step: WorkflowStepDefinition = {
            id: actionId,
            type: 'action',
            name: `Execute ${action.actionType}`,
            config: {
              actionType: action.actionType as WorkflowActionType,
              params: action.parameters as Record<string, unknown>,
            },
          };

          // Build workflow context
          const context: WorkflowContext = {
            workflowId: `ai-coo-action-${actionId}`,
            workflowRunId: `run-${Date.now()}`,
            instanceId: `ai-coo-action-${actionId}`,
            definitionId: `ai-coo-action-${actionId}`,
            startedAt: new Date(),
            triggerData: {},
            stepResults: {},
            trigger: {
              type: 'manual',
              payload: { approvedBy: userId },
              timestamp: new Date(),
            },
            variables: {
              actionId,
              userId,
              targetSystem: action.targetSystem,
              targetId: action.targetId,
            },
            metadata: {
              source: 'ai-coo-dashboard',
              decisionReasoning: action.decisionReasoning,
            },
          };

          // Execute the workflow step
          const result = await actionStepHandler.execute(step, context);

          if (result.success) {
            // Mark action as executed
            await markActionAsExecuted(actionId, result.output);

            console.log(
              `[AI COO] Action ${actionId} executed successfully:`,
              result.output
            );

            return Response.json({
              success: true,
              actionId,
              status: 'executed',
              result: result.output,
              message: 'Action approved and executed successfully',
            });
          } else {
            // Mark action as failed
            const errorMessage = result.error || 'Unknown execution error';
            await markActionAsFailed(actionId, errorMessage);

            console.error(`[AI COO] Action ${actionId} failed:`, errorMessage);

            return Response.json(
              {
                success: false,
                actionId,
                status: 'failed',
                error: errorMessage,
                message: 'Action approved but execution failed',
              },
              { status: 500 }
            );
          }
        } catch (error) {
          // Handle unexpected errors
          console.error('[AI COO] Approve action API error:', error);

          return Response.json(
            {
              error: 'Internal server error',
              details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
          );
        }
      },
    },
  },
});

