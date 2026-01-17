-- Multi-Tenant Schema Extension
-- Adds tenant_id to all relevant tables for multi-tenant data isolation with row-level security policies

-- =============================================================================
-- PART 1: Tenant Management Tables
-- =============================================================================

-- Tenant table - Core tenant/organization information
CREATE TABLE IF NOT EXISTS "tenant" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "domain" text UNIQUE,
  "logo_url" text,
  "settings" jsonb DEFAULT '{}',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Tenant Member table - Links users to tenants with roles
CREATE TABLE IF NOT EXISTS "tenant_member" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "tenant"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'member', -- owner, admin, member
  "is_default" boolean NOT NULL DEFAULT false, -- User's default tenant
  "joined_at" timestamp NOT NULL DEFAULT now(),
  "invited_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  UNIQUE("tenant_id", "user_id")
);

-- Indexes for tenant tables
CREATE INDEX IF NOT EXISTS "idx_tenant_slug" ON "tenant" ("slug");
CREATE INDEX IF NOT EXISTS "idx_tenant_is_active" ON "tenant" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_tenant_member_tenant_id" ON "tenant_member" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_member_user_id" ON "tenant_member" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_member_role" ON "tenant_member" ("role");
CREATE INDEX IF NOT EXISTS "idx_tenant_member_is_default" ON "tenant_member" ("user_id", "is_default");

-- =============================================================================
-- PART 2: Add tenant_id column to all relevant tables
-- =============================================================================

-- Content & Community tables
ALTER TABLE "post_attachment" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "community_post" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "post_reaction" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "heart" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "post_comment" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Business/Expense tables
ALTER TABLE "expense_request" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "expense_voucher" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "expense_voucher_line_item" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "expense_voucher_approval_history" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "expense_workflow_instance" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "expense_workflow_event" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "expense_workflow_notification_queue" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Daily Briefing tables
ALTER TABLE "daily_briefing" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "briefing_version" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "briefing_schedule_preference" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "scheduled_briefing_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Call-related tables
ALTER TABLE "call_record" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "call_disposition" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "call_task" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "call_recording" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "call_recording_retention_policy" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "call_recording_access_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "call_recording_encryption_key" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "call_summary" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "crm_call_log_sync" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- AI Conversation tables
ALTER TABLE "ai_conversation" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "ai_message" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "ai_tool_call" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "ai_user_preference" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "ai_conversation_context" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Notification & Push tables
ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "device_token" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "push_message" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "delivery_tracking" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Prompt templates
ALTER TABLE "prompt_template" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "prompt_template_usage" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Odoo integration tables
ALTER TABLE "odoo_channel" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "odoo_message" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "odoo_discuss_subscription" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Contact sync tables
ALTER TABLE "synced_contact" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "contact_sync_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "contact_sync_state" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- User/Phone verification & SIP
ALTER TABLE "phone_verification" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "sip_credential" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "onboarding_session" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Reloadly tables
ALTER TABLE "reloadly_transaction" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "reloadly_operator_cache" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Dashboard config
ALTER TABLE "dashboard_config" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Messaging tables
ALTER TABLE "conversation" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "message" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "unified_inbox_thread" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Wallet tables
ALTER TABLE "user_wallet" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "wallet_transaction" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "wallet_audit_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Audit log
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Chat approval tables
ALTER TABLE "chat_approval_request" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "chat_approval_thread" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Task reminder tables
ALTER TABLE "task_reminder_preference" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "task_reminder_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "task_reminder_state" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Feature flags tables
ALTER TABLE "feature_flag" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "feature_flag_user_target" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "feature_flag_role_target" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- KYC tables
ALTER TABLE "kyc_verification" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "kyc_document" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "kyc_verification_history" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "kyc_tier_config" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- QR Payment
ALTER TABLE "qr_payment_request" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Job queue tables
ALTER TABLE "job_queue" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "job_execution_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "dead_letter_queue" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Task automation tables
ALTER TABLE "task_auto_creation_rule" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "task_rule_execution_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "task_conversation_link" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "task_suggestion" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "task_thread" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "task_thread_message" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "task_thread_participant" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Team capacity tables
ALTER TABLE "team_member_capacity" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "team_assignment" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "capacity_alert" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "team_capacity_snapshot" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Workflow tables
ALTER TABLE "workflow_definition" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "workflow_instance" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "workflow_step_execution" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "workflow_event_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "workflow_scheduled_run" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "workflow_approval" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Demo tables
ALTER TABLE "demo_session" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "demo_data_snapshot" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE "demo_activity_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- =============================================================================
-- PART 3: Create indexes on tenant_id columns
-- =============================================================================

CREATE INDEX IF NOT EXISTS "idx_post_attachment_tenant_id" ON "post_attachment" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_community_post_tenant_id" ON "community_post" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_post_reaction_tenant_id" ON "post_reaction" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_heart_tenant_id" ON "heart" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_post_comment_tenant_id" ON "post_comment" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_expense_request_tenant_id" ON "expense_request" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_expense_voucher_tenant_id" ON "expense_voucher" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_expense_voucher_line_item_tenant_id" ON "expense_voucher_line_item" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_expense_voucher_approval_history_tenant_id" ON "expense_voucher_approval_history" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_expense_workflow_instance_tenant_id" ON "expense_workflow_instance" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_expense_workflow_event_tenant_id" ON "expense_workflow_event" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_expense_workflow_notification_queue_tenant_id" ON "expense_workflow_notification_queue" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_daily_briefing_tenant_id" ON "daily_briefing" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_briefing_version_tenant_id" ON "briefing_version" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_briefing_schedule_preference_tenant_id" ON "briefing_schedule_preference" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_scheduled_briefing_log_tenant_id" ON "scheduled_briefing_log" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_call_record_tenant_id" ON "call_record" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_call_disposition_tenant_id" ON "call_disposition" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_call_task_tenant_id" ON "call_task" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_call_recording_tenant_id" ON "call_recording" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_call_recording_retention_policy_tenant_id" ON "call_recording_retention_policy" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_call_recording_access_log_tenant_id" ON "call_recording_access_log" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_call_recording_encryption_key_tenant_id" ON "call_recording_encryption_key" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_call_summary_tenant_id" ON "call_summary" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_crm_call_log_sync_tenant_id" ON "crm_call_log_sync" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_ai_conversation_tenant_id" ON "ai_conversation" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_ai_message_tenant_id" ON "ai_message" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_ai_tool_call_tenant_id" ON "ai_tool_call" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_ai_user_preference_tenant_id" ON "ai_user_preference" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_ai_conversation_context_tenant_id" ON "ai_conversation_context" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_notification_tenant_id" ON "notification" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_device_token_tenant_id" ON "device_token" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_push_message_tenant_id" ON "push_message" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_delivery_tracking_tenant_id" ON "delivery_tracking" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_prompt_template_tenant_id" ON "prompt_template" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_prompt_template_usage_tenant_id" ON "prompt_template_usage" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_odoo_channel_tenant_id" ON "odoo_channel" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_odoo_message_tenant_id" ON "odoo_message" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_odoo_discuss_subscription_tenant_id" ON "odoo_discuss_subscription" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_synced_contact_tenant_id" ON "synced_contact" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_contact_sync_log_tenant_id" ON "contact_sync_log" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_contact_sync_state_tenant_id" ON "contact_sync_state" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_phone_verification_tenant_id" ON "phone_verification" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_sip_credential_tenant_id" ON "sip_credential" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_onboarding_session_tenant_id" ON "onboarding_session" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_reloadly_transaction_tenant_id" ON "reloadly_transaction" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_reloadly_operator_cache_tenant_id" ON "reloadly_operator_cache" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_dashboard_config_tenant_id" ON "dashboard_config" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_conversation_tenant_id" ON "conversation" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_message_tenant_id" ON "message" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_unified_inbox_thread_tenant_id" ON "unified_inbox_thread" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_user_wallet_tenant_id" ON "user_wallet" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_wallet_transaction_tenant_id" ON "wallet_transaction" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_wallet_audit_log_tenant_id" ON "wallet_audit_log" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_audit_log_tenant_id" ON "audit_log" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_chat_approval_request_tenant_id" ON "chat_approval_request" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_chat_approval_thread_tenant_id" ON "chat_approval_thread" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_task_reminder_preference_tenant_id" ON "task_reminder_preference" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_task_reminder_log_tenant_id" ON "task_reminder_log" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_task_reminder_state_tenant_id" ON "task_reminder_state" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_feature_flag_tenant_id" ON "feature_flag" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_feature_flag_user_target_tenant_id" ON "feature_flag_user_target" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_feature_flag_role_target_tenant_id" ON "feature_flag_role_target" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_kyc_verification_tenant_id" ON "kyc_verification" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_kyc_document_tenant_id" ON "kyc_document" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_kyc_verification_history_tenant_id" ON "kyc_verification_history" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_kyc_tier_config_tenant_id" ON "kyc_tier_config" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_qr_payment_request_tenant_id" ON "qr_payment_request" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_job_queue_tenant_id" ON "job_queue" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_job_execution_log_tenant_id" ON "job_execution_log" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_dead_letter_queue_tenant_id" ON "dead_letter_queue" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_task_auto_creation_rule_tenant_id" ON "task_auto_creation_rule" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_task_rule_execution_log_tenant_id" ON "task_rule_execution_log" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_task_conversation_link_tenant_id" ON "task_conversation_link" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_task_suggestion_tenant_id" ON "task_suggestion" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_task_thread_tenant_id" ON "task_thread" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_task_thread_message_tenant_id" ON "task_thread_message" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_task_thread_participant_tenant_id" ON "task_thread_participant" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_team_member_capacity_tenant_id" ON "team_member_capacity" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_team_assignment_tenant_id" ON "team_assignment" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_capacity_alert_tenant_id" ON "capacity_alert" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_team_capacity_snapshot_tenant_id" ON "team_capacity_snapshot" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_definition_tenant_id" ON "workflow_definition" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_instance_tenant_id" ON "workflow_instance" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_step_execution_tenant_id" ON "workflow_step_execution" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_event_log_tenant_id" ON "workflow_event_log" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_scheduled_run_tenant_id" ON "workflow_scheduled_run" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_approval_tenant_id" ON "workflow_approval" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_demo_session_tenant_id" ON "demo_session" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_demo_data_snapshot_tenant_id" ON "demo_data_snapshot" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_demo_activity_log_tenant_id" ON "demo_activity_log" ("tenant_id");

-- =============================================================================
-- PART 4: Enable Row-Level Security (RLS) on tables
-- =============================================================================

-- Enable RLS on tenant tables
ALTER TABLE "tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_member" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on all tenant-scoped tables
ALTER TABLE "post_attachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "community_post" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "post_reaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "heart" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "post_comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expense_request" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expense_voucher" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expense_voucher_line_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expense_voucher_approval_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expense_workflow_instance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expense_workflow_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expense_workflow_notification_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_briefing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "briefing_version" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "briefing_schedule_preference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduled_briefing_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "call_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "call_disposition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "call_task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "call_recording" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "call_recording_retention_policy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "call_recording_access_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "call_recording_encryption_key" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "call_summary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_call_log_sync" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_tool_call" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_user_preference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_conversation_context" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "device_token" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "delivery_tracking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prompt_template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prompt_template_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "odoo_channel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "odoo_message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "odoo_discuss_subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "synced_contact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_sync_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_sync_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "phone_verification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sip_credential" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "onboarding_session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reloadly_transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reloadly_operator_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dashboard_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "unified_inbox_thread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_wallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallet_transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wallet_audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_approval_request" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_approval_thread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_reminder_preference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_reminder_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_reminder_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feature_flag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feature_flag_user_target" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feature_flag_role_target" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kyc_verification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kyc_document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kyc_verification_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kyc_tier_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "qr_payment_request" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_execution_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dead_letter_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_auto_creation_rule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_rule_execution_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_conversation_link" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_suggestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_thread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_thread_message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_thread_participant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_member_capacity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_assignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "capacity_alert" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_capacity_snapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_definition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_instance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_step_execution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_event_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_scheduled_run" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_approval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "demo_session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "demo_data_snapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "demo_activity_log" ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PART 5: Create RLS Policies
-- =============================================================================

-- Helper function to get current tenant ID from session variable
CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS text AS $$
BEGIN
  RETURN current_setting('app.current_tenant_id', true);
EXCEPTION
  WHEN undefined_object THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is member of tenant
CREATE OR REPLACE FUNCTION is_tenant_member(p_tenant_id text, p_user_id text) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenant_member
    WHERE tenant_id = p_tenant_id
    AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin of tenant
CREATE OR REPLACE FUNCTION is_tenant_admin(p_tenant_id text, p_user_id text) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenant_member
    WHERE tenant_id = p_tenant_id
    AND user_id = p_user_id
    AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tenant table policies
CREATE POLICY "tenant_select_policy" ON "tenant"
  FOR SELECT USING (
    id = get_current_tenant_id() OR
    is_tenant_member(id, current_setting('app.current_user_id', true))
  );

CREATE POLICY "tenant_insert_policy" ON "tenant"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "tenant_update_policy" ON "tenant"
  FOR UPDATE USING (
    is_tenant_admin(id, current_setting('app.current_user_id', true))
  );

CREATE POLICY "tenant_delete_policy" ON "tenant"
  FOR DELETE USING (
    is_tenant_admin(id, current_setting('app.current_user_id', true))
  );

-- Tenant member policies
CREATE POLICY "tenant_member_select_policy" ON "tenant_member"
  FOR SELECT USING (
    tenant_id = get_current_tenant_id() OR
    user_id = current_setting('app.current_user_id', true)
  );

CREATE POLICY "tenant_member_insert_policy" ON "tenant_member"
  FOR INSERT WITH CHECK (
    is_tenant_admin(tenant_id, current_setting('app.current_user_id', true))
  );

CREATE POLICY "tenant_member_update_policy" ON "tenant_member"
  FOR UPDATE USING (
    is_tenant_admin(tenant_id, current_setting('app.current_user_id', true))
  );

CREATE POLICY "tenant_member_delete_policy" ON "tenant_member"
  FOR DELETE USING (
    is_tenant_admin(tenant_id, current_setting('app.current_user_id', true)) OR
    user_id = current_setting('app.current_user_id', true)
  );

-- Generic tenant isolation policy template for all tenant-scoped tables
-- This policy allows access only to rows where tenant_id matches the current tenant

-- Create a reusable function for basic tenant isolation policy
CREATE OR REPLACE FUNCTION create_tenant_isolation_policies(table_name text) RETURNS void AS $$
BEGIN
  -- SELECT policy
  EXECUTE format('
    CREATE POLICY "%s_tenant_select" ON %I
    FOR SELECT USING (tenant_id = get_current_tenant_id() OR tenant_id IS NULL)
  ', table_name, table_name);

  -- INSERT policy
  EXECUTE format('
    CREATE POLICY "%s_tenant_insert" ON %I
    FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id() OR tenant_id IS NULL)
  ', table_name, table_name);

  -- UPDATE policy
  EXECUTE format('
    CREATE POLICY "%s_tenant_update" ON %I
    FOR UPDATE USING (tenant_id = get_current_tenant_id() OR tenant_id IS NULL)
  ', table_name, table_name);

  -- DELETE policy
  EXECUTE format('
    CREATE POLICY "%s_tenant_delete" ON %I
    FOR DELETE USING (tenant_id = get_current_tenant_id() OR tenant_id IS NULL)
  ', table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Apply tenant isolation policies to all tenant-scoped tables
SELECT create_tenant_isolation_policies('post_attachment');
SELECT create_tenant_isolation_policies('community_post');
SELECT create_tenant_isolation_policies('post_reaction');
SELECT create_tenant_isolation_policies('heart');
SELECT create_tenant_isolation_policies('post_comment');
SELECT create_tenant_isolation_policies('expense_request');
SELECT create_tenant_isolation_policies('expense_voucher');
SELECT create_tenant_isolation_policies('expense_voucher_line_item');
SELECT create_tenant_isolation_policies('expense_voucher_approval_history');
SELECT create_tenant_isolation_policies('expense_workflow_instance');
SELECT create_tenant_isolation_policies('expense_workflow_event');
SELECT create_tenant_isolation_policies('expense_workflow_notification_queue');
SELECT create_tenant_isolation_policies('daily_briefing');
SELECT create_tenant_isolation_policies('briefing_version');
SELECT create_tenant_isolation_policies('briefing_schedule_preference');
SELECT create_tenant_isolation_policies('scheduled_briefing_log');
SELECT create_tenant_isolation_policies('call_record');
SELECT create_tenant_isolation_policies('call_disposition');
SELECT create_tenant_isolation_policies('call_task');
SELECT create_tenant_isolation_policies('call_recording');
SELECT create_tenant_isolation_policies('call_recording_retention_policy');
SELECT create_tenant_isolation_policies('call_recording_access_log');
SELECT create_tenant_isolation_policies('call_recording_encryption_key');
SELECT create_tenant_isolation_policies('call_summary');
SELECT create_tenant_isolation_policies('crm_call_log_sync');
SELECT create_tenant_isolation_policies('ai_conversation');
SELECT create_tenant_isolation_policies('ai_message');
SELECT create_tenant_isolation_policies('ai_tool_call');
SELECT create_tenant_isolation_policies('ai_user_preference');
SELECT create_tenant_isolation_policies('ai_conversation_context');
SELECT create_tenant_isolation_policies('notification');
SELECT create_tenant_isolation_policies('device_token');
SELECT create_tenant_isolation_policies('push_message');
SELECT create_tenant_isolation_policies('delivery_tracking');
SELECT create_tenant_isolation_policies('prompt_template');
SELECT create_tenant_isolation_policies('prompt_template_usage');
SELECT create_tenant_isolation_policies('odoo_channel');
SELECT create_tenant_isolation_policies('odoo_message');
SELECT create_tenant_isolation_policies('odoo_discuss_subscription');
SELECT create_tenant_isolation_policies('synced_contact');
SELECT create_tenant_isolation_policies('contact_sync_log');
SELECT create_tenant_isolation_policies('contact_sync_state');
SELECT create_tenant_isolation_policies('phone_verification');
SELECT create_tenant_isolation_policies('sip_credential');
SELECT create_tenant_isolation_policies('onboarding_session');
SELECT create_tenant_isolation_policies('reloadly_transaction');
SELECT create_tenant_isolation_policies('reloadly_operator_cache');
SELECT create_tenant_isolation_policies('dashboard_config');
SELECT create_tenant_isolation_policies('conversation');
SELECT create_tenant_isolation_policies('message');
SELECT create_tenant_isolation_policies('unified_inbox_thread');
SELECT create_tenant_isolation_policies('user_wallet');
SELECT create_tenant_isolation_policies('wallet_transaction');
SELECT create_tenant_isolation_policies('wallet_audit_log');
SELECT create_tenant_isolation_policies('audit_log');
SELECT create_tenant_isolation_policies('chat_approval_request');
SELECT create_tenant_isolation_policies('chat_approval_thread');
SELECT create_tenant_isolation_policies('task_reminder_preference');
SELECT create_tenant_isolation_policies('task_reminder_log');
SELECT create_tenant_isolation_policies('task_reminder_state');
SELECT create_tenant_isolation_policies('feature_flag');
SELECT create_tenant_isolation_policies('feature_flag_user_target');
SELECT create_tenant_isolation_policies('feature_flag_role_target');
SELECT create_tenant_isolation_policies('kyc_verification');
SELECT create_tenant_isolation_policies('kyc_document');
SELECT create_tenant_isolation_policies('kyc_verification_history');
SELECT create_tenant_isolation_policies('kyc_tier_config');
SELECT create_tenant_isolation_policies('qr_payment_request');
SELECT create_tenant_isolation_policies('job_queue');
SELECT create_tenant_isolation_policies('job_execution_log');
SELECT create_tenant_isolation_policies('dead_letter_queue');
SELECT create_tenant_isolation_policies('task_auto_creation_rule');
SELECT create_tenant_isolation_policies('task_rule_execution_log');
SELECT create_tenant_isolation_policies('task_conversation_link');
SELECT create_tenant_isolation_policies('task_suggestion');
SELECT create_tenant_isolation_policies('task_thread');
SELECT create_tenant_isolation_policies('task_thread_message');
SELECT create_tenant_isolation_policies('task_thread_participant');
SELECT create_tenant_isolation_policies('team_member_capacity');
SELECT create_tenant_isolation_policies('team_assignment');
SELECT create_tenant_isolation_policies('capacity_alert');
SELECT create_tenant_isolation_policies('team_capacity_snapshot');
SELECT create_tenant_isolation_policies('workflow_definition');
SELECT create_tenant_isolation_policies('workflow_instance');
SELECT create_tenant_isolation_policies('workflow_step_execution');
SELECT create_tenant_isolation_policies('workflow_event_log');
SELECT create_tenant_isolation_policies('workflow_scheduled_run');
SELECT create_tenant_isolation_policies('workflow_approval');
SELECT create_tenant_isolation_policies('demo_session');
SELECT create_tenant_isolation_policies('demo_data_snapshot');
SELECT create_tenant_isolation_policies('demo_activity_log');

-- =============================================================================
-- PART 6: Comments for documentation
-- =============================================================================

COMMENT ON TABLE "tenant" IS 'Multi-tenant organization/company records';
COMMENT ON TABLE "tenant_member" IS 'Links users to tenants with role-based access';
COMMENT ON COLUMN "tenant"."slug" IS 'URL-friendly unique identifier for the tenant';
COMMENT ON COLUMN "tenant"."settings" IS 'JSON configuration for tenant-specific settings';
COMMENT ON COLUMN "tenant_member"."role" IS 'Role within tenant: owner, admin, or member';
COMMENT ON COLUMN "tenant_member"."is_default" IS 'Whether this is the user''s default/primary tenant';
COMMENT ON FUNCTION get_current_tenant_id() IS 'Returns the current tenant ID from session variable app.current_tenant_id';
COMMENT ON FUNCTION is_tenant_member(text, text) IS 'Checks if a user is a member of a specific tenant';
COMMENT ON FUNCTION is_tenant_admin(text, text) IS 'Checks if a user is an admin or owner of a specific tenant';
