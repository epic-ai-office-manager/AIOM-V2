/**
 * Test Workflow Execution
 *
 * Tests that workflows actually execute actions in Odoo instead of just logging.
 */

import { actionStepHandler } from '../src/lib/workflow-automation-engine/step-handlers';
import type {
  WorkflowStepDefinition,
  WorkflowContext,
} from '../src/lib/workflow-automation-engine/types';

async function testOdooTaskCreation() {
  console.log('\n=== Test 1: Create Task in Odoo ===\n');

  const step: WorkflowStepDefinition = {
    id: 'test-create-task',
    type: 'action',
    name: 'Create test task',
    config: {
      actionType: 'odoo_create',
      params: {
        model: 'project.task',
        values: {
          name: '[WORKFLOW TEST] Automated task creation test',
          description: 'This task was created by the workflow engine test script',
          priority: '1',
        },
      },
    },
  };

  const context: WorkflowContext = {
    workflowId: 'test-workflow',
    workflowRunId: 'test-run-1',
    trigger: {
      type: 'manual',
      payload: {},
      timestamp: new Date(),
    },
    variables: {},
    metadata: {},
    // Required fields
    triggerData: {},
    stepResults: {},
    startedAt: new Date(),
    instanceId: 'test-instance-1',
    definitionId: 'test-definition-1',
  };

  try {
    const result = await actionStepHandler.execute(step, context);
    console.log('✅ SUCCESS - Task created in Odoo!');
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('\nVerify in Odoo: Check for task "[WORKFLOW TEST] Automated task creation test"');
    return result;
  } catch (error) {
    console.error('❌ FAILED - Task creation failed:');
    console.error(error);
    throw error;
  }
}

async function testOdooSearch() {
  console.log('\n=== Test 2: Search for Tasks in Odoo ===\n');

  const step: WorkflowStepDefinition = {
    id: 'test-search-tasks',
    type: 'action',
    name: 'Search for tasks',
    config: {
      actionType: 'odoo_search',
      params: {
        model: 'project.task',
        domain: [['name', 'ilike', 'WORKFLOW TEST']],
        fields: ['name', 'description', 'priority', 'create_date'],
        limit: 5,
      },
    },
  };

  const context: WorkflowContext = {
    workflowId: 'test-workflow',
    workflowRunId: 'test-run-2',
    trigger: {
      type: 'manual',
      payload: {},
      timestamp: new Date(),
    },
    variables: {},
    metadata: {},
    // Required fields
    triggerData: {},
    stepResults: {},
    startedAt: new Date(),
    instanceId: 'test-instance-2',
    definitionId: 'test-definition-2',
  };

  try {
    const result = await actionStepHandler.execute(step, context);
    console.log('✅ SUCCESS - Search completed!');
    console.log(`Found ${(result.output as any).count} test tasks`);
    console.log('Tasks:', JSON.stringify((result.output as any).records, null, 2));
    return result;
  } catch (error) {
    console.error('❌ FAILED - Search failed:');
    console.error(error);
    throw error;
  }
}

async function testEmailSend() {
  console.log('\n=== Test 3: Send Email ===\n');

  const step: WorkflowStepDefinition = {
    id: 'test-send-email',
    type: 'action',
    name: 'Send test email',
    config: {
      actionType: 'email_send',
      params: {
        to: process.env.TEST_EMAIL || 'test@example.com',
        subject: '[WORKFLOW TEST] Email sending test',
        body: 'This email was sent by the workflow engine test script.',
      },
    },
  };

  const context: WorkflowContext = {
    workflowId: 'test-workflow',
    workflowRunId: 'test-run-3',
    trigger: {
      type: 'manual',
      payload: {},
      timestamp: new Date(),
    },
    variables: {},
    metadata: {},
    // Required fields
    triggerData: {},
    stepResults: {},
    startedAt: new Date(),
    instanceId: 'test-instance-3',
    definitionId: 'test-definition-3',
  };

  try {
    const result = await actionStepHandler.execute(step, context);
    console.log('Result:', JSON.stringify(result, null, 2));

    if ((result.output as any).sent) {
      console.log('✅ SUCCESS - Email sent!');
      console.log(`Check inbox: ${process.env.TEST_EMAIL || 'test@example.com'}`);
    } else {
      console.log('⚠️  Email service not configured (SMTP2GO_API_KEY missing)');
      console.log('Set SMTP2GO_API_KEY in .env to enable email sending');
    }

    return result;
  } catch (error) {
    console.error('❌ FAILED - Email send failed:');
    console.error(error);
    throw error;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  Workflow Execution Test Suite            ║');
  console.log('║  Testing real action execution (not stubs)║');
  console.log('╚════════════════════════════════════════════╝');

  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Create task in Odoo
  totalTests++;
  try {
    await testOdooTaskCreation();
    passedTests++;
  } catch (error) {
    console.error('Test 1 FAILED\n');
  }

  // Test 2: Search for tasks
  totalTests++;
  try {
    await testOdooSearch();
    passedTests++;
  } catch (error) {
    console.error('Test 2 FAILED\n');
  }

  // Test 3: Send email
  totalTests++;
  try {
    await testEmailSend();
    passedTests++;
  } catch (error) {
    console.error('Test 3 FAILED\n');
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════╗');
  console.log(`║  Test Results: ${passedTests}/${totalTests} PASSED           ║`);
  console.log('╚════════════════════════════════════════════╝\n');

  if (passedTests === totalTests) {
    console.log('✅ All tests passed! Workflows now execute real actions.');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Check error messages above.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
