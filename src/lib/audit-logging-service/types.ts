import type {
  AuditLogCategory,
  AuditActorType,
  AuditSeverity,
} from "~/db/schema";

// =============================================================================
// Audit Event Types - Actions that should be automatically logged
// =============================================================================

export type AuditEventType =
  // Authentication Events
  | "auth.login.success"
  | "auth.login.failure"
  | "auth.logout"
  | "auth.password_change"
  | "auth.password_reset_request"
  | "auth.password_reset_complete"
  | "auth.mfa_enabled"
  | "auth.mfa_disabled"
  | "auth.session_invalidated"

  // Authorization Events
  | "authz.permission_denied"
  | "authz.role_elevated"
  | "authz.role_demoted"

  // User Management Events
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "user.deactivated"
  | "user.reactivated"
  | "user.role_changed"
  | "user.profile_updated"

  // Approval Workflow Events
  | "approval.requested"
  | "approval.approved"
  | "approval.rejected"
  | "approval.escalated"
  | "approval.delegated"
  | "approval.cancelled"
  | "approval.auto_approved"

  // Financial Events
  | "financial.expense_submitted"
  | "financial.expense_approved"
  | "financial.expense_rejected"
  | "financial.expense_disbursed"
  | "financial.voucher_created"
  | "financial.voucher_approved"
  | "financial.voucher_rejected"
  | "financial.voucher_posted"
  | "financial.voucher_voided"
  | "financial.wallet_credited"
  | "financial.wallet_debited"
  | "financial.transfer_initiated"
  | "financial.transfer_completed"
  | "financial.transfer_failed"
  | "expense.gl_posted"
  | "expense.gl_posting_failed"
  | "expense.gl_reversed"

  // Configuration Events
  | "config.settings_updated"
  | "config.feature_enabled"
  | "config.feature_disabled"
  | "config.integration_configured"

  // Security Events
  | "security.suspicious_activity"
  | "security.rate_limit_exceeded"
  | "security.invalid_token"
  | "security.ip_blocked"
  | "security.data_export"
  | "security.bulk_operation"

  // System Events
  | "system.cron_started"
  | "system.cron_completed"
  | "system.cron_failed"
  | "system.maintenance_started"
  | "system.maintenance_completed"
  | "system.backup_created"
  | "system.data_migrated"

  // Integration Events
  | "integration.webhook_received"
  | "integration.api_call_made"
  | "integration.sync_started"
  | "integration.sync_completed"
  | "integration.sync_failed";

// =============================================================================
// Actor Context - Information about who performed the action
// =============================================================================

export interface ActorContext {
  actorId: string | null;
  actorType: AuditActorType;
  actorName?: string;
  actorEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
}

// =============================================================================
// Resource Context - Information about the affected resource
// =============================================================================

export interface ResourceContext {
  resourceType: string;
  resourceId: string;
  parentResourceType?: string;
  parentResourceId?: string;
}

// =============================================================================
// Change Context - Information about state changes
// =============================================================================

export interface ChangeContext {
  previousState?: unknown;
  newState?: unknown;
  changedFields?: string[];
  description?: string;
}

// =============================================================================
// Audit Event - Full event information for logging
// =============================================================================

export interface AuditEvent {
  eventType: AuditEventType;
  category: AuditLogCategory;
  severity?: AuditSeverity;
  actor: ActorContext;
  resource: ResourceContext;
  change?: ChangeContext;
  metadata?: Record<string, unknown>;
  tags?: string[];
  success?: boolean;
  errorDetails?: Record<string, unknown>;
  durationMs?: number;
}

// =============================================================================
// Retention Policy Configuration
// =============================================================================

export interface RetentionPolicy {
  // Category-specific retention in days
  categoryRetention: {
    [K in AuditLogCategory]?: number;
  };

  // Severity-based minimum retention in days
  severityMinRetention: {
    [K in AuditSeverity]?: number;
  };

  // Default retention period in days
  defaultRetentionDays: number;

  // Maximum retention period in days (for compliance)
  maxRetentionDays: number;

  // Archive to cold storage instead of deleting
  archiveBeforeDelete: boolean;

  // Preserve failed action logs longer
  preserveFailedActions: boolean;
  preserveFailedActionDays: number;
}

// =============================================================================
// Default Retention Policy - Configured for compliance requirements
// =============================================================================

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  categoryRetention: {
    authentication: 365,      // 1 year for auth logs
    authorization: 365,       // 1 year for authorization logs
    user_management: 730,     // 2 years for user management
    resource_access: 90,      // 90 days for general resource access
    financial: 2555,          // 7 years for financial records (compliance)
    approval: 2555,           // 7 years for approval records (compliance)
    configuration: 365,       // 1 year for config changes
    security: 730,            // 2 years for security events
    integration: 180,         // 6 months for integration logs
    system: 90,               // 90 days for system logs
  },
  severityMinRetention: {
    info: 90,                 // 90 days minimum for info
    warning: 365,             // 1 year minimum for warnings
    critical: 730,            // 2 years minimum for critical events
  },
  defaultRetentionDays: 365,  // 1 year default
  maxRetentionDays: 2555,     // 7 years maximum
  archiveBeforeDelete: true,  // Archive to cold storage
  preserveFailedActions: true,
  preserveFailedActionDays: 730, // 2 years for failed actions
};

// =============================================================================
// Tamper Detection
// =============================================================================

export interface TamperProofChecksum {
  logId: string;
  timestamp: Date;
  checksum: string;
  previousChecksum: string | null;
}

// =============================================================================
// Audit Service Configuration
// =============================================================================

export interface AuditServiceConfig {
  // Enable/disable audit logging
  enabled: boolean;

  // Retention policy
  retentionPolicy: RetentionPolicy;

  // Enable tamper-proof checksums
  enableChecksums: boolean;

  // Batch writing for performance
  batchSize: number;
  batchFlushIntervalMs: number;

  // Async writing (non-blocking)
  asyncWrite: boolean;

  // Events to skip logging (for performance)
  skipEvents: AuditEventType[];

  // Minimum severity to log
  minSeverity: AuditSeverity;
}

// =============================================================================
// Default Service Configuration
// =============================================================================

export const DEFAULT_AUDIT_CONFIG: AuditServiceConfig = {
  enabled: true,
  retentionPolicy: DEFAULT_RETENTION_POLICY,
  enableChecksums: true,
  batchSize: 10,
  batchFlushIntervalMs: 1000,
  asyncWrite: true,
  skipEvents: [],
  minSeverity: "info",
};
