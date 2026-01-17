-- Workflow Automation Engine Tables
-- Creates core workflow automation tables for managing workflow definitions,
-- instances, executions, and approvals

-- =============================================================================
-- Workflow Definition Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS "workflow_definition" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "description" text,
  "created_by" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'draft', -- draft, active, paused, archived
  "trigger_type" text NOT NULL, -- manual, schedule, event, webhook, api
  "trigger_config" jsonb NOT NULL DEFAULT '{}',
  "steps" jsonb NOT NULL DEFAULT '[]',
  "variables" jsonb DEFAULT '{}',
  "max_concurrent_instances" integer DEFAULT 10,
  "timeout_minutes" integer,
  "retry_on_failure" boolean DEFAULT false,
  "max_retries" integer DEFAULT 3,
  "tags" text[],
  "version" integer NOT NULL DEFAULT 1,
  "is_latest" boolean NOT NULL DEFAULT true,
  "previous_version_id" text REFERENCES "workflow_definition"("id") ON DELETE SET NULL,
  "total_executions" integer NOT NULL DEFAULT 0,
  "successful_executions" integer NOT NULL DEFAULT 0,
  "failed_executions" integer NOT NULL DEFAULT 0,
  "last_executed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Indexes for workflow_definition
CREATE INDEX IF NOT EXISTS "idx_workflow_definition_created_by" ON "workflow_definition" ("created_by");
CREATE INDEX IF NOT EXISTS "idx_workflow_definition_status" ON "workflow_definition" ("status");
CREATE INDEX IF NOT EXISTS "idx_workflow_definition_trigger_type" ON "workflow_definition" ("trigger_type");
CREATE INDEX IF NOT EXISTS "idx_workflow_definition_is_latest" ON "workflow_definition" ("is_latest");
CREATE INDEX IF NOT EXISTS "idx_workflow_definition_tags" ON "workflow_definition" USING GIN("tags");

-- =============================================================================
-- Workflow Instance Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS "workflow_instance" (
  "id" text PRIMARY KEY,
  "definition_id" text NOT NULL REFERENCES "workflow_definition"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'pending', -- pending, running, paused, completed, failed, cancelled
  "triggered_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "trigger_data" jsonb,
  "current_step_index" integer,
  "current_step_id" text,
  "context" jsonb DEFAULT '{}',
  "output" text,
  "error_message" text,
  "error_details" text,
  "retry_count" integer NOT NULL DEFAULT 0,
  "last_retry_at" timestamp,
  "started_at" timestamp,
  "completed_at" timestamp,
  "paused_at" timestamp,
  "due_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Indexes for workflow_instance
CREATE INDEX IF NOT EXISTS "idx_workflow_instance_definition_id" ON "workflow_instance" ("definition_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_instance_status" ON "workflow_instance" ("status");
CREATE INDEX IF NOT EXISTS "idx_workflow_instance_triggered_by" ON "workflow_instance" ("triggered_by");
CREATE INDEX IF NOT EXISTS "idx_workflow_instance_due_at" ON "workflow_instance" ("due_at");
CREATE INDEX IF NOT EXISTS "idx_workflow_instance_created_at" ON "workflow_instance" ("created_at");

-- =============================================================================
-- Workflow Step Execution Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS "workflow_step_execution" (
  "id" text PRIMARY KEY,
  "instance_id" text NOT NULL REFERENCES "workflow_instance"("id") ON DELETE CASCADE,
  "step_id" text NOT NULL,
  "step_name" text NOT NULL,
  "step_index" integer NOT NULL,
  "step_type" text NOT NULL, -- action, condition, branch, wait, loop, parallel, approval, notification, integration
  "status" text NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, skipped, waiting
  "input" text,
  "output" text,
  "error_message" text,
  "error_details" text,
  "retry_count" integer NOT NULL DEFAULT 0,
  "execution_duration_ms" integer,
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Indexes for workflow_step_execution
CREATE INDEX IF NOT EXISTS "idx_workflow_step_execution_instance_id" ON "workflow_step_execution" ("instance_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_step_execution_status" ON "workflow_step_execution" ("status");
CREATE INDEX IF NOT EXISTS "idx_workflow_step_execution_step_index" ON "workflow_step_execution" ("step_index");

-- =============================================================================
-- Workflow Event Log Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS "workflow_event_log" (
  "id" text PRIMARY KEY,
  "instance_id" text NOT NULL REFERENCES "workflow_instance"("id") ON DELETE CASCADE,
  "step_execution_id" text REFERENCES "workflow_step_execution"("id") ON DELETE SET NULL,
  "event_type" text NOT NULL, -- instance_created, instance_started, instance_completed, step_started, step_completed, etc.
  "event_data" text,
  "actor_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "actor_type" text NOT NULL DEFAULT 'system', -- system, user
  "occurred_at" timestamp NOT NULL DEFAULT now()
);

-- Indexes for workflow_event_log
CREATE INDEX IF NOT EXISTS "idx_workflow_event_log_instance_id" ON "workflow_event_log" ("instance_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_event_log_step_execution_id" ON "workflow_event_log" ("step_execution_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_event_log_event_type" ON "workflow_event_log" ("event_type");
CREATE INDEX IF NOT EXISTS "idx_workflow_event_log_occurred_at" ON "workflow_event_log" ("occurred_at");

-- =============================================================================
-- Workflow Scheduled Run Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS "workflow_scheduled_run" (
  "id" text PRIMARY KEY,
  "definition_id" text NOT NULL REFERENCES "workflow_definition"("id") ON DELETE CASCADE,
  "cron_expression" text NOT NULL,
  "scheduled_for" timestamp NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_run_at" timestamp,
  "last_run_instance_id" text REFERENCES "workflow_instance"("id") ON DELETE SET NULL,
  "next_run_at" timestamp,
  "timezone" text DEFAULT 'UTC',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Indexes for workflow_scheduled_run
CREATE INDEX IF NOT EXISTS "idx_workflow_scheduled_run_definition_id" ON "workflow_scheduled_run" ("definition_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_scheduled_run_scheduled_for" ON "workflow_scheduled_run" ("scheduled_for");
CREATE INDEX IF NOT EXISTS "idx_workflow_scheduled_run_is_active" ON "workflow_scheduled_run" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_workflow_scheduled_run_next_run_at" ON "workflow_scheduled_run" ("next_run_at");

-- =============================================================================
-- Workflow Approval Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS "workflow_approval" (
  "id" text PRIMARY KEY,
  "instance_id" text NOT NULL REFERENCES "workflow_instance"("id") ON DELETE CASCADE,
  "step_execution_id" text REFERENCES "workflow_step_execution"("id") ON DELETE CASCADE,
  "approver_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'pending', -- pending, approved, rejected, cancelled
  "decision" text, -- approved, rejected
  "comments" text,
  "requested_at" timestamp NOT NULL DEFAULT now(),
  "decided_at" timestamp,
  "due_at" timestamp,
  "notified_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Indexes for workflow_approval
CREATE INDEX IF NOT EXISTS "idx_workflow_approval_instance_id" ON "workflow_approval" ("instance_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_approval_step_execution_id" ON "workflow_approval" ("step_execution_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_approval_approver_id" ON "workflow_approval" ("approver_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_approval_status" ON "workflow_approval" ("status");
CREATE INDEX IF NOT EXISTS "idx_workflow_approval_due_at" ON "workflow_approval" ("due_at");
