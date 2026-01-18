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
ALTER TABLE IF EXISTS "post_attachment" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "community_post" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "post_reaction" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "heart" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "post_comment" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Business/Expense tables
ALTER TABLE IF EXISTS "expense_request" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "expense_voucher" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "expense_voucher_line_item" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "expense_voucher_approval_history" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "expense_workflow_instance" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "expense_workflow_event" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "expense_workflow_notification_queue" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Daily Briefing tables
ALTER TABLE IF EXISTS "daily_briefing" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "briefing_version" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "briefing_schedule_preference" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "scheduled_briefing_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Call-related tables
ALTER TABLE IF EXISTS "call_record" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "call_disposition" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "call_task" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "call_recording" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "call_recording_retention_policy" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "call_recording_access_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "call_recording_encryption_key" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "call_summary" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "crm_call_log_sync" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- AI Conversation tables
ALTER TABLE IF EXISTS "ai_conversation" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "ai_message" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "ai_tool_call" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "ai_user_preference" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "ai_conversation_context" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Notification & Push tables
ALTER TABLE IF EXISTS "notification" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "device_token" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "push_message" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "delivery_tracking" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Prompt templates
ALTER TABLE IF EXISTS "prompt_template" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "prompt_template_usage" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Odoo integration tables
ALTER TABLE IF EXISTS "odoo_channel" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "odoo_message" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "odoo_discuss_subscription" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Contact sync tables
ALTER TABLE IF EXISTS "synced_contact" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "contact_sync_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "contact_sync_state" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- User/Phone verification & SIP
ALTER TABLE IF EXISTS "phone_verification" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "sip_credential" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "onboarding_session" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Reloadly tables
ALTER TABLE IF EXISTS "reloadly_transaction" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "reloadly_operator_cache" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Dashboard config
ALTER TABLE IF EXISTS "dashboard_config" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Messaging tables
ALTER TABLE IF EXISTS "conversation" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "message" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "unified_inbox_thread" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Wallet tables
ALTER TABLE IF EXISTS "user_wallet" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "wallet_transaction" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "wallet_audit_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Audit log
ALTER TABLE IF EXISTS "audit_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Chat approval tables
ALTER TABLE IF EXISTS "chat_approval_request" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "chat_approval_thread" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Task reminder tables
ALTER TABLE IF EXISTS "task_reminder_preference" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "task_reminder_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "task_reminder_state" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Feature flags tables
ALTER TABLE IF EXISTS "feature_flag" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "feature_flag_user_target" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "feature_flag_role_target" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- KYC tables
ALTER TABLE IF EXISTS "kyc_verification" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "kyc_document" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "kyc_verification_history" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "kyc_tier_config" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- QR Payment
ALTER TABLE IF EXISTS "qr_payment_request" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Job queue tables
ALTER TABLE IF EXISTS "job_queue" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "job_execution_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "dead_letter_queue" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Task automation tables
ALTER TABLE IF EXISTS "task_auto_creation_rule" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "task_rule_execution_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "task_conversation_link" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "task_suggestion" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "task_thread" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "task_thread_message" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "task_thread_participant" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Team capacity tables
ALTER TABLE IF EXISTS "team_member_capacity" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "team_assignment" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "capacity_alert" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "team_capacity_snapshot" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Workflow tables
ALTER TABLE IF EXISTS "workflow_definition" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "workflow_instance" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "workflow_step_execution" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "workflow_event_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "workflow_scheduled_run" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "workflow_approval" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- Demo tables
ALTER TABLE IF EXISTS "demo_session" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "demo_data_snapshot" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;
ALTER TABLE IF EXISTS "demo_activity_log" ADD COLUMN IF NOT EXISTS "tenant_id" text REFERENCES "tenant"("id") ON DELETE CASCADE;

-- =============================================================================
-- PART 3: Create indexes on tenant_id columns
-- =============================================================================

-- Indexes for tenant_id columns (guarded for missing tables)
DO $$
BEGIN
  IF to_regclass('public.post_attachment') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_post_attachment_tenant_id" ON "post_attachment" ("tenant_id");
  END IF;

  IF to_regclass('public.community_post') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_community_post_tenant_id" ON "community_post" ("tenant_id");
  END IF;

  IF to_regclass('public.post_reaction') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_post_reaction_tenant_id" ON "post_reaction" ("tenant_id");
  END IF;

  IF to_regclass('public.heart') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_heart_tenant_id" ON "heart" ("tenant_id");
  END IF;

  IF to_regclass('public.post_comment') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_post_comment_tenant_id" ON "post_comment" ("tenant_id");
  END IF;

  IF to_regclass('public.expense_request') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_expense_request_tenant_id" ON "expense_request" ("tenant_id");
  END IF;

  IF to_regclass('public.expense_voucher') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_expense_voucher_tenant_id" ON "expense_voucher" ("tenant_id");
  END IF;

  IF to_regclass('public.expense_voucher_line_item') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_expense_voucher_line_item_tenant_id" ON "expense_voucher_line_item" ("tenant_id");
  END IF;

  IF to_regclass('public.expense_voucher_approval_history') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_expense_voucher_approval_history_tenant_id" ON "expense_voucher_approval_history" ("tenant_id");
  END IF;

  IF to_regclass('public.expense_workflow_instance') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_expense_workflow_instance_tenant_id" ON "expense_workflow_instance" ("tenant_id");
  END IF;

  IF to_regclass('public.expense_workflow_event') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_expense_workflow_event_tenant_id" ON "expense_workflow_event" ("tenant_id");
  END IF;

  IF to_regclass('public.expense_workflow_notification_queue') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_expense_workflow_notification_queue_tenant_id" ON "expense_workflow_notification_queue" ("tenant_id");
  END IF;

  IF to_regclass('public.daily_briefing') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_daily_briefing_tenant_id" ON "daily_briefing" ("tenant_id");
  END IF;

  IF to_regclass('public.briefing_version') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_briefing_version_tenant_id" ON "briefing_version" ("tenant_id");
  END IF;

  IF to_regclass('public.briefing_schedule_preference') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_briefing_schedule_preference_tenant_id" ON "briefing_schedule_preference" ("tenant_id");
  END IF;

  IF to_regclass('public.scheduled_briefing_log') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_scheduled_briefing_log_tenant_id" ON "scheduled_briefing_log" ("tenant_id");
  END IF;

  IF to_regclass('public.call_record') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_call_record_tenant_id" ON "call_record" ("tenant_id");
  END IF;

  IF to_regclass('public.call_disposition') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_call_disposition_tenant_id" ON "call_disposition" ("tenant_id");
  END IF;

  IF to_regclass('public.call_task') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_call_task_tenant_id" ON "call_task" ("tenant_id");
  END IF;

  IF to_regclass('public.call_recording') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_call_recording_tenant_id" ON "call_recording" ("tenant_id");
  END IF;

  IF to_regclass('public.call_recording_retention_policy') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_call_recording_retention_policy_tenant_id" ON "call_recording_retention_policy" ("tenant_id");
  END IF;

  IF to_regclass('public.call_recording_access_log') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_call_recording_access_log_tenant_id" ON "call_recording_access_log" ("tenant_id");
  END IF;

  IF to_regclass('public.call_recording_encryption_key') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_call_recording_encryption_key_tenant_id" ON "call_recording_encryption_key" ("tenant_id");
  END IF;

  IF to_regclass('public.call_summary') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_call_summary_tenant_id" ON "call_summary" ("tenant_id");
  END IF;

  IF to_regclass('public.crm_call_log_sync') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_crm_call_log_sync_tenant_id" ON "crm_call_log_sync" ("tenant_id");
  END IF;

  IF to_regclass('public.ai_conversation') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_ai_conversation_tenant_id" ON "ai_conversation" ("tenant_id");
  END IF;

  IF to_regclass('public.ai_message') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_ai_message_tenant_id" ON "ai_message" ("tenant_id");
  END IF;

  IF to_regclass('public.ai_tool_call') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_ai_tool_call_tenant_id" ON "ai_tool_call" ("tenant_id");
  END IF;

  IF to_regclass('public.ai_user_preference') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_ai_user_preference_tenant_id" ON "ai_user_preference" ("tenant_id");
  END IF;

  IF to_regclass('public.ai_conversation_context') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_ai_conversation_context_tenant_id" ON "ai_conversation_context" ("tenant_id");
  END IF;

  IF to_regclass('public.notification') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_notification_tenant_id" ON "notification" ("tenant_id");
  END IF;

  IF to_regclass('public.device_token') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_device_token_tenant_id" ON "device_token" ("tenant_id");
  END IF;

  IF to_regclass('public.push_message') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_push_message_tenant_id" ON "push_message" ("tenant_id");
  END IF;

  IF to_regclass('public.delivery_tracking') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_delivery_tracking_tenant_id" ON "delivery_tracking" ("tenant_id");
  END IF;

  IF to_regclass('public.prompt_template') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_prompt_template_tenant_id" ON "prompt_template" ("tenant_id");
  END IF;

  IF to_regclass('public.prompt_template_usage') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_prompt_template_usage_tenant_id" ON "prompt_template_usage" ("tenant_id");
  END IF;

  IF to_regclass('public.odoo_channel') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_odoo_channel_tenant_id" ON "odoo_channel" ("tenant_id");
  END IF;

  IF to_regclass('public.odoo_message') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_odoo_message_tenant_id" ON "odoo_message" ("tenant_id");
  END IF;

  IF to_regclass('public.odoo_discuss_subscription') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_odoo_discuss_subscription_tenant_id" ON "odoo_discuss_subscription" ("tenant_id");
  END IF;

  IF to_regclass('public.synced_contact') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_synced_contact_tenant_id" ON "synced_contact" ("tenant_id");
  END IF;

  IF to_regclass('public.contact_sync_log') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_contact_sync_log_tenant_id" ON "contact_sync_log" ("tenant_id");
  END IF;

  IF to_regclass('public.contact_sync_state') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_contact_sync_state_tenant_id" ON "contact_sync_state" ("tenant_id");
  END IF;

  IF to_regclass('public.phone_verification') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_phone_verification_tenant_id" ON "phone_verification" ("tenant_id");
  END IF;

  IF to_regclass('public.sip_credential') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_sip_credential_tenant_id" ON "sip_credential" ("tenant_id");
  END IF;

  IF to_regclass('public.onboarding_session') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_onboarding_session_tenant_id" ON "onboarding_session" ("tenant_id");
  END IF;

  IF to_regclass('public.reloadly_transaction') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_reloadly_transaction_tenant_id" ON "reloadly_transaction" ("tenant_id");
  END IF;

  IF to_regclass('public.reloadly_operator_cache') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_reloadly_operator_cache_tenant_id" ON "reloadly_operator_cache" ("tenant_id");
  END IF;

  IF to_regclass('public.dashboard_config') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_dashboard_config_tenant_id" ON "dashboard_config" ("tenant_id");
  END IF;

  IF to_regclass('public.conversation') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_conversation_tenant_id" ON "conversation" ("tenant_id");
  END IF;

  IF to_regclass('public.message') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_message_tenant_id" ON "message" ("tenant_id");
  END IF;

  IF to_regclass('public.unified_inbox_thread') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_unified_inbox_thread_tenant_id" ON "unified_inbox_thread" ("tenant_id");
  END IF;

  IF to_regclass('public.user_wallet') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_user_wallet_tenant_id" ON "user_wallet" ("tenant_id");
  END IF;

  IF to_regclass('public.wallet_transaction') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_wallet_transaction_tenant_id" ON "wallet_transaction" ("tenant_id");
  END IF;

  IF to_regclass('public.wallet_audit_log') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_wallet_audit_log_tenant_id" ON "wallet_audit_log" ("tenant_id");
  END IF;

  IF to_regclass('public.audit_log') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_audit_log_tenant_id" ON "audit_log" ("tenant_id");
  END IF;

  IF to_regclass('public.chat_approval_request') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_chat_approval_request_tenant_id" ON "chat_approval_request" ("tenant_id");
  END IF;

  IF to_regclass('public.chat_approval_thread') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_chat_approval_thread_tenant_id" ON "chat_approval_thread" ("tenant_id");
  END IF;

  IF to_regclass('public.task_reminder_preference') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_task_reminder_preference_tenant_id" ON "task_reminder_preference" ("tenant_id");
  END IF;

  IF to_regclass('public.task_reminder_log') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_task_reminder_log_tenant_id" ON "task_reminder_log" ("tenant_id");
  END IF;

  IF to_regclass('public.task_reminder_state') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_task_reminder_state_tenant_id" ON "task_reminder_state" ("tenant_id");
  END IF;

  IF to_regclass('public.feature_flag') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_feature_flag_tenant_id" ON "feature_flag" ("tenant_id");
  END IF;

  IF to_regclass('public.feature_flag_user_target') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_feature_flag_user_target_tenant_id" ON "feature_flag_user_target" ("tenant_id");
  END IF;

  IF to_regclass('public.feature_flag_role_target') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_feature_flag_role_target_tenant_id" ON "feature_flag_role_target" ("tenant_id");
  END IF;

  IF to_regclass('public.kyc_verification') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_kyc_verification_tenant_id" ON "kyc_verification" ("tenant_id");
  END IF;

  IF to_regclass('public.kyc_document') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_kyc_document_tenant_id" ON "kyc_document" ("tenant_id");
  END IF;

  IF to_regclass('public.kyc_verification_history') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_kyc_verification_history_tenant_id" ON "kyc_verification_history" ("tenant_id");
  END IF;

  IF to_regclass('public.kyc_tier_config') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_kyc_tier_config_tenant_id" ON "kyc_tier_config" ("tenant_id");
  END IF;

  IF to_regclass('public.qr_payment_request') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_qr_payment_request_tenant_id" ON "qr_payment_request" ("tenant_id");
  END IF;

  IF to_regclass('public.job_queue') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_job_queue_tenant_id" ON "job_queue" ("tenant_id");
  END IF;

  IF to_regclass('public.job_execution_log') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_job_execution_log_tenant_id" ON "job_execution_log" ("tenant_id");
  END IF;

  IF to_regclass('public.dead_letter_queue') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_dead_letter_queue_tenant_id" ON "dead_letter_queue" ("tenant_id");
  END IF;

  IF to_regclass('public.task_auto_creation_rule') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_task_auto_creation_rule_tenant_id" ON "task_auto_creation_rule" ("tenant_id");
  END IF;

  IF to_regclass('public.task_rule_execution_log') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_task_rule_execution_log_tenant_id" ON "task_rule_execution_log" ("tenant_id");
  END IF;

  IF to_regclass('public.task_conversation_link') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_task_conversation_link_tenant_id" ON "task_conversation_link" ("tenant_id");
  END IF;

  IF to_regclass('public.task_suggestion') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_task_suggestion_tenant_id" ON "task_suggestion" ("tenant_id");
  END IF;

  IF to_regclass('public.task_thread') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_task_thread_tenant_id" ON "task_thread" ("tenant_id");
  END IF;

  IF to_regclass('public.task_thread_message') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_task_thread_message_tenant_id" ON "task_thread_message" ("tenant_id");
  END IF;

  IF to_regclass('public.task_thread_participant') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_task_thread_participant_tenant_id" ON "task_thread_participant" ("tenant_id");
  END IF;

  IF to_regclass('public.team_member_capacity') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_team_member_capacity_tenant_id" ON "team_member_capacity" ("tenant_id");
  END IF;

  IF to_regclass('public.team_assignment') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_team_assignment_tenant_id" ON "team_assignment" ("tenant_id");
  END IF;

  IF to_regclass('public.capacity_alert') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_capacity_alert_tenant_id" ON "capacity_alert" ("tenant_id");
  END IF;

  IF to_regclass('public.team_capacity_snapshot') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_team_capacity_snapshot_tenant_id" ON "team_capacity_snapshot" ("tenant_id");
  END IF;

  IF to_regclass('public.workflow_definition') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_workflow_definition_tenant_id" ON "workflow_definition" ("tenant_id");
  END IF;

  IF to_regclass('public.workflow_instance') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_workflow_instance_tenant_id" ON "workflow_instance" ("tenant_id");
  END IF;

  IF to_regclass('public.workflow_step_execution') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_workflow_step_execution_tenant_id" ON "workflow_step_execution" ("tenant_id");
  END IF;

  IF to_regclass('public.workflow_event_log') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_workflow_event_log_tenant_id" ON "workflow_event_log" ("tenant_id");
  END IF;

  IF to_regclass('public.workflow_scheduled_run') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_workflow_scheduled_run_tenant_id" ON "workflow_scheduled_run" ("tenant_id");
  END IF;

  IF to_regclass('public.workflow_approval') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_workflow_approval_tenant_id" ON "workflow_approval" ("tenant_id");
  END IF;

  IF to_regclass('public.demo_session') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_demo_session_tenant_id" ON "demo_session" ("tenant_id");
  END IF;

  IF to_regclass('public.demo_data_snapshot') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_demo_data_snapshot_tenant_id" ON "demo_data_snapshot" ("tenant_id");
  END IF;

  IF to_regclass('public.demo_activity_log') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "idx_demo_activity_log_tenant_id" ON "demo_activity_log" ("tenant_id");
  END IF;
END $$;

-- =============================================================================
-- PART 4: Enable Row-Level Security (RLS) on tables
-- =============================================================================

-- Enable RLS on tenant tables
ALTER TABLE IF EXISTS "tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "tenant_member" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on all tenant-scoped tables
ALTER TABLE IF EXISTS "post_attachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "community_post" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "post_reaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "heart" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "post_comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "expense_request" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "expense_voucher" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "expense_voucher_line_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "expense_voucher_approval_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "expense_workflow_instance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "expense_workflow_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "expense_workflow_notification_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "daily_briefing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "briefing_version" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "briefing_schedule_preference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "scheduled_briefing_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "call_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "call_disposition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "call_task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "call_recording" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "call_recording_retention_policy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "call_recording_access_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "call_recording_encryption_key" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "call_summary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "crm_call_log_sync" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ai_conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ai_message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ai_tool_call" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ai_user_preference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ai_conversation_context" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "device_token" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "push_message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "delivery_tracking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "prompt_template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "prompt_template_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "odoo_channel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "odoo_message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "odoo_discuss_subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "synced_contact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "contact_sync_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "contact_sync_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "phone_verification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "sip_credential" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "onboarding_session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "reloadly_transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "reloadly_operator_cache" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "dashboard_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "unified_inbox_thread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "user_wallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "wallet_transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "wallet_audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "chat_approval_request" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "chat_approval_thread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "task_reminder_preference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "task_reminder_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "task_reminder_state" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "feature_flag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "feature_flag_user_target" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "feature_flag_role_target" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "kyc_verification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "kyc_document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "kyc_verification_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "kyc_tier_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "qr_payment_request" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "job_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "job_execution_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "dead_letter_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "task_auto_creation_rule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "task_rule_execution_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "task_conversation_link" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "task_suggestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "task_thread" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "task_thread_message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "task_thread_participant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "team_member_capacity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "team_assignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "capacity_alert" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "team_capacity_snapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "workflow_definition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "workflow_instance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "workflow_step_execution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "workflow_event_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "workflow_scheduled_run" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "workflow_approval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "demo_session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "demo_data_snapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "demo_activity_log" ENABLE ROW LEVEL SECURITY;

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

-- Apply tenant isolation policies to all tenant-scoped tables (guarded for missing tables)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'post_attachment',
    'community_post',
    'post_reaction',
    'heart',
    'post_comment',
    'expense_request',
    'expense_voucher',
    'expense_voucher_line_item',
    'expense_voucher_approval_history',
    'expense_workflow_instance',
    'expense_workflow_event',
    'expense_workflow_notification_queue',
    'daily_briefing',
    'briefing_version',
    'briefing_schedule_preference',
    'scheduled_briefing_log',
    'call_record',
    'call_disposition',
    'call_task',
    'call_recording',
    'call_recording_retention_policy',
    'call_recording_access_log',
    'call_recording_encryption_key',
    'call_summary',
    'crm_call_log_sync',
    'ai_conversation',
    'ai_message',
    'ai_tool_call',
    'ai_user_preference',
    'ai_conversation_context',
    'notification',
    'device_token',
    'push_message',
    'delivery_tracking',
    'prompt_template',
    'prompt_template_usage',
    'odoo_channel',
    'odoo_message',
    'odoo_discuss_subscription',
    'synced_contact',
    'contact_sync_log',
    'contact_sync_state',
    'phone_verification',
    'sip_credential',
    'onboarding_session',
    'reloadly_transaction',
    'reloadly_operator_cache',
    'dashboard_config',
    'conversation',
    'message',
    'unified_inbox_thread',
    'user_wallet',
    'wallet_transaction',
    'wallet_audit_log',
    'audit_log',
    'chat_approval_request',
    'chat_approval_thread',
    'task_reminder_preference',
    'task_reminder_log',
    'task_reminder_state',
    'feature_flag',
    'feature_flag_user_target',
    'feature_flag_role_target',
    'kyc_verification',
    'kyc_document',
    'kyc_verification_history',
    'kyc_tier_config',
    'qr_payment_request',
    'job_queue',
    'job_execution_log',
    'dead_letter_queue',
    'task_auto_creation_rule',
    'task_rule_execution_log',
    'task_conversation_link',
    'task_suggestion',
    'task_thread',
    'task_thread_message',
    'task_thread_participant',
    'team_member_capacity',
    'team_assignment',
    'capacity_alert',
    'team_capacity_snapshot',
    'workflow_definition',
    'workflow_instance',
    'workflow_step_execution',
    'workflow_event_log',
    'workflow_scheduled_run',
    'workflow_approval',
    'demo_session',
    'demo_data_snapshot',
    'demo_activity_log'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      PERFORM create_tenant_isolation_policies(t);
    END IF;
  END LOOP;
END $$;

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
