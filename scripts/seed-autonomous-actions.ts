import { database as db } from '~/db';
import { autonomousActions } from '~/db/ai-coo-schema';
import { nanoid } from 'nanoid';

async function seedActions() {
  console.log('🌱 Seeding autonomous actions for dashboard testing...\n');

  const actions = [
    // Pending approval - will show in decision cards
    {
      id: nanoid(),
      actionType: 'send_invoice_reminder',
      targetSystem: 'odoo' as const,
      targetId: 'INV-2024-001',
      description: 'Send payment reminder for overdue invoice from Acme Corp ($5,000, 95 days overdue)',
      parameters: {
        invoice_id: 1,
        partner_name: 'Acme Corp',
        amount: 5000,
        days_overdue: 95,
      },
      decisionReasoning: 'Critical cash flow situation with only 54 days runway. This invoice represents significant overdue amount.',
      requiresApproval: true,
      status: 'pending_approval' as const,
      riskLevel: 'low' as const,
      safeOperation: null,
      createdAt: new Date(),
      actionProtocol: {
        action_type: 'send_invoice_reminder',
        reasoning: 'Send payment reminder for overdue invoice',
        priority: 'high' as const,
        risk_level: 'low' as const,
        estimated_impact: {
          financial: '$5,000 receivable collection',
          operational: 'Improved cash flow',
          customer_satisfaction: 'Neutral - standard reminder',
        },
        affected_records: {
          odoo_model: 'account.move',
          odoo_ids: [1],
          partner_id: 123,
          partner_name: 'Acme Corp',
          record_name: 'INV-2024-001',
          record_count: 1,
        },
        data_sources: ['odoo_invoices', 'financial_analyzer'],
        operations: [
          {
            type: 'send_email',
            target_system: 'email',
            parameters: {
              to: 'billing@acmecorp.com',
              subject: 'Payment Reminder: Invoice INV-2024-001',
              body: 'Your payment of $5,000 is 95 days overdue...',
            },
            safe_operation: true,
          },
        ],
      },
    },
    {
      id: nanoid(),
      actionType: 'create_collection_task',
      targetSystem: 'odoo' as const,
      targetId: 'INV-2024-002',
      description: 'Create urgent collection task for Tech Solutions Inc invoice ($3,000, 59 days overdue)',
      parameters: {
        invoice_id: 2,
        partner_name: 'Tech Solutions Inc',
        amount: 3000,
        days_overdue: 59,
      },
      decisionReasoning: 'Invoice approaching 60 days - requires collection team intervention before it becomes critical.',
      requiresApproval: true,
      status: 'pending_approval' as const,
      riskLevel: 'low' as const,
      safeOperation: null,
      createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
      actionProtocol: {
        action_type: 'create_collection_task',
        reasoning: 'Create collection task to prevent invoice from becoming critical',
        priority: 'medium' as const,
        risk_level: 'low' as const,
        estimated_impact: {
          financial: '$3,000 receivable collection',
          operational: 'Prevents aging deterioration',
          customer_satisfaction: 'Neutral',
        },
        affected_records: {
          odoo_model: 'account.move',
          odoo_ids: [2],
          partner_id: 124,
          partner_name: 'Tech Solutions Inc',
          record_name: 'INV-2024-002',
          record_count: 1,
        },
        data_sources: ['odoo_invoices', 'financial_analyzer'],
        operations: [
          {
            type: 'create_task',
            target_system: 'odoo',
            parameters: {
              model: 'mail.activity',
              subject: 'Follow up on invoice INV-2024-002',
              assigned_to: 'collections_team',
              due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            },
            safe_operation: true,
          },
        ],
      },
    },
    // Approved - will show in upcoming
    {
      id: nanoid(),
      actionType: 'send_invoice_reminder',
      targetSystem: 'odoo' as const,
      targetId: 'INV-2024-003',
      description: 'Send payment reminder for Global Services invoice ($2,000, 48 days overdue)',
      parameters: {
        invoice_id: 3,
        partner_name: 'Global Services',
        amount: 2000,
        days_overdue: 48,
      },
      decisionReasoning: 'Proactive reminder before invoice reaches 60 days.',
      requiresApproval: true,
      status: 'approved' as const,
      approvedAt: new Date(),
      riskLevel: 'low' as const,
      safeOperation: null,
      createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      actionProtocol: {
        action_type: 'send_invoice_reminder',
        reasoning: 'Proactive collections management',
        priority: 'medium' as const,
        risk_level: 'low' as const,
        estimated_impact: {
          financial: '$2,000 receivable collection',
          operational: 'Maintains collection discipline',
          customer_satisfaction: 'Neutral',
        },
        affected_records: {
          odoo_model: 'account.move',
          odoo_ids: [3],
          partner_id: 125,
          partner_name: 'Global Services',
          record_name: 'INV-2024-003',
          record_count: 1,
        },
        data_sources: ['odoo_invoices'],
        operations: [
          {
            type: 'send_email',
            target_system: 'email',
            parameters: {
              to: 'ap@globalservices.com',
              subject: 'Payment Reminder: Invoice INV-2024-003',
            },
            safe_operation: true,
          },
        ],
      },
    },
    // Executed - will show in recent activity
    {
      id: nanoid(),
      actionType: 'send_invoice_reminder',
      targetSystem: 'odoo' as const,
      targetId: 'INV-2024-004',
      description: 'Sent payment reminder for Enterprise Co invoice ($8,500, 35 days overdue)',
      parameters: {
        invoice_id: 4,
        partner_name: 'Enterprise Co',
        amount: 8500,
        days_overdue: 35,
      },
      decisionReasoning: 'Standard 30-day follow-up reminder.',
      requiresApproval: false,
      status: 'executed' as const,
      executedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 min ago
      riskLevel: 'low' as const,
      safeOperation: null,
      createdAt: new Date(Date.now() - 90 * 60 * 1000),
      result: { success: true, emailSent: true, messageId: 'msg_12345' },
      actionProtocol: {
        action_type: 'send_invoice_reminder',
        reasoning: 'Automated collections workflow',
        priority: 'low' as const,
        risk_level: 'low' as const,
        estimated_impact: {
          financial: '$8,500 receivable collection',
        },
        affected_records: {
          odoo_model: 'account.move',
          odoo_ids: [4],
          partner_id: 126,
          partner_name: 'Enterprise Co',
          record_name: 'INV-2024-004',
          record_count: 1,
        },
        data_sources: ['odoo_invoices'],
        operations: [
          {
            type: 'send_email',
            target_system: 'email',
            parameters: {},
            safe_operation: true,
          },
        ],
      },
    },
    {
      id: nanoid(),
      actionType: 'send_invoice_reminder',
      targetSystem: 'odoo' as const,
      targetId: 'INV-2024-005',
      description: 'Sent payment reminder for StartupXYZ invoice ($1,200, 31 days overdue)',
      parameters: {
        invoice_id: 5,
        partner_name: 'StartupXYZ',
        amount: 1200,
        days_overdue: 31,
      },
      decisionReasoning: 'Automated reminder for invoices over 30 days.',
      requiresApproval: false,
      status: 'executed' as const,
      executedAt: new Date(Date.now() - 45 * 60 * 1000), // 45 min ago
      riskLevel: 'low' as const,
      safeOperation: null,
      createdAt: new Date(Date.now() - 120 * 60 * 1000),
      result: { success: true, emailSent: true, messageId: 'msg_12346' },
      actionProtocol: {
        action_type: 'send_invoice_reminder',
        reasoning: 'Automated collections workflow',
        priority: 'low' as const,
        risk_level: 'low' as const,
        estimated_impact: {
          financial: '$1,200 receivable collection',
        },
        affected_records: {
          odoo_model: 'account.move',
          odoo_ids: [5],
          partner_id: 127,
          partner_name: 'StartupXYZ',
          record_name: 'INV-2024-005',
          record_count: 1,
        },
        data_sources: ['odoo_invoices'],
        operations: [
          {
            type: 'send_email',
            target_system: 'email',
            parameters: {},
            safe_operation: true,
          },
        ],
      },
    },
  ];

  for (const action of actions) {
    await db.insert(autonomousActions).values(action);
    console.log(`✅ Created ${action.status} action: ${action.description}`);
  }

  console.log('\n✅ Successfully seeded 5 autonomous actions!');
  console.log('\nDashboard should now show:');
  console.log('  - 2 pending decision cards (left column)');
  console.log('  - 1 upcoming action (center column)');
  console.log('  - 2 recent executed actions (center column)');
  console.log('\nOpen http://localhost:3000/dashboard/ai-coo to see the results!');

  process.exit(0);
}

seedActions().catch(console.error);
