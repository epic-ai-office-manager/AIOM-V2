import { pgTable, text, timestamp, boolean, index, integer, real, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
export * from './ai-coo-schema';

// User table - Core user information for authentication
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  isAdmin: boolean("is_admin")
    .$default(() => false)
    .notNull(),
  // Role field - Role-based access control (md, field-tech, admin, sales)
  role: text("role"),
  // Subscription fields
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionId: text("subscription_id"),
  plan: text("plan")
    .$default(() => "free")
    .notNull(),
  subscriptionStatus: text("subscription_status"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Session table - Better Auth session management
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

// Account table - Better Auth OAuth provider accounts
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

// Verification table - Better Auth email verification
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
});

// =============================================================================
// Multi-Tenant Tables - Core tenant/organization management
// =============================================================================

// Tenant table - Core tenant/organization information
export const tenant = pgTable(
  "tenant",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    domain: text("domain").unique(),
    logoUrl: text("logo_url"),
    settings: jsonb("settings").$default(() => ({})),
    isActive: boolean("is_active")
      .$default(() => true)
      .notNull(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_tenant_slug").on(table.slug),
    index("idx_tenant_is_active").on(table.isActive),
  ]
);

// Tenant Member Role types
export type TenantMemberRole = "owner" | "admin" | "member";

// Array of valid tenant member roles for validation
export const TENANT_MEMBER_ROLES: readonly TenantMemberRole[] = ["owner", "admin", "member"] as const;

// Tenant Member table - Links users to tenants with roles
export const tenantMember = pgTable(
  "tenant_member",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role")
      .$default(() => "member")
      .notNull(), // owner, admin, member
    isDefault: boolean("is_default")
      .$default(() => false)
      .notNull(), // User's default tenant
    joinedAt: timestamp("joined_at")
      .$defaultFn(() => new Date())
      .notNull(),
    invitedBy: text("invited_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_tenant_member_tenant_id").on(table.tenantId),
    index("idx_tenant_member_user_id").on(table.userId),
    index("idx_tenant_member_role").on(table.role),
    index("idx_tenant_member_is_default").on(table.userId, table.isDefault),
  ]
);

// Tenant Relations
export const tenantRelations = relations(tenant, ({ many }) => ({
  members: many(tenantMember),
}));

export const tenantMemberRelations = relations(tenantMember, ({ one }) => ({
  tenant: one(tenant, {
    fields: [tenantMember.tenantId],
    references: [tenant.id],
  }),
  user: one(user, {
    fields: [tenantMember.userId],
    references: [user.id],
  }),
  invitedByUser: one(user, {
    fields: [tenantMember.invitedBy],
    references: [user.id],
  }),
}));

// Update user relations to include tenant memberships
export const userTenantRelations = relations(user, ({ many }) => ({
  tenantMemberships: many(tenantMember),
}));

// Tenant type exports
export type Tenant = typeof tenant.$inferSelect;
export type CreateTenantData = typeof tenant.$inferInsert;
export type UpdateTenantData = Partial<Omit<CreateTenantData, "id" | "createdAt">>;

export type TenantMember = typeof tenantMember.$inferSelect;
export type CreateTenantMemberData = typeof tenantMember.$inferInsert;
export type UpdateTenantMemberData = Partial<Omit<CreateTenantMemberData, "id" | "createdAt" | "tenantId" | "userId">>;

// Gateway Message - Multi-channel assistant gateway messages
export const gatewayMessage = pgTable(
  "gateway_message",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(), // "telegram" | "web" | "whatsapp" | "sms"
    externalChatId: text("external_chat_id").notNull(),
    externalUserId: text("external_user_id").notNull(),
    externalMessageId: text("external_message_id"), // nullable for non-message updates
    dedupeKey: text("dedupe_key").notNull().unique(), // unique constraint for idempotency
    text: text("text"), // nullable for non-text messages
    raw: jsonb("raw").notNull(), // raw payload from channel
    receivedAt: timestamp("received_at").notNull(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_gateway_message_tenant_channel_chat").on(
      table.tenantId,
      table.channel,
      table.externalChatId,
      table.receivedAt
    ),
    index("idx_gateway_message_dedupe_key").on(table.dedupeKey),
  ]
);

// Gateway Message Relations
export const gatewayMessageRelations = relations(gatewayMessage, ({ one }) => ({
  tenant: one(tenant, {
    fields: [gatewayMessage.tenantId],
    references: [tenant.id],
  }),
}));

// Gateway Message type exports
export type GatewayMessage = typeof gatewayMessage.$inferSelect;
export type CreateGatewayMessageData = typeof gatewayMessage.$inferInsert;

// User Profile - Extended profile information
export const userProfile = pgTable(
  "user_profile",
  {
    id: text("id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    bio: text("bio"),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("idx_user_profile_id").on(table.id)]
);

// Relations
export const userRelations = relations(user, ({ one }) => ({
  profile: one(userProfile, {
    fields: [user.id],
    references: [userProfile.id],
  }),
}));

export const userProfileRelations = relations(userProfile, ({ one }) => ({
  user: one(user, {
    fields: [userProfile.id],
    references: [user.id],
  }),
}));

// Type exports
export type User = typeof user.$inferSelect;
export type CreateUserData = typeof user.$inferInsert;
export type UpdateUserData = Partial<Omit<CreateUserData, "id" | "createdAt">>;

export type UserProfile = typeof userProfile.$inferSelect;
export type CreateUserProfileData = typeof userProfile.$inferInsert;
export type UpdateUserProfileData = Partial<Omit<CreateUserProfileData, "id">>;

// Subscription types
export type SubscriptionPlan = "free" | "basic" | "pro";
export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | null;

// User Role types - Role-based access control
export type UserRole = "md" | "field-tech" | "admin" | "sales";

// Array of valid roles for validation
export const USER_ROLES: readonly UserRole[] = ["md", "field-tech", "admin", "sales"] as const;

// Post Attachment table - Attachments for posts and comments
export const postAttachment = pgTable(
  "post_attachment",
  {
    id: text("id").primaryKey(),
    // Parent reference - either postId or commentId will be set
    postId: text("post_id"),
    commentId: text("comment_id"),
    // File information
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url").notNull(),
    fileType: text("file_type").notNull(), // MIME type
    fileSize: integer("file_size"), // Size in bytes
    // Display order
    position: integer("position").$default(() => 0).notNull(),
    // Timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_post_attachment_post_id").on(table.postId),
    index("idx_post_attachment_comment_id").on(table.commentId),
  ]
);

// Post Attachment type exports
export type PostAttachment = typeof postAttachment.$inferSelect;
export type CreatePostAttachmentData = typeof postAttachment.$inferInsert;

// Attachment type enum - Business category (not MIME type)
export const ATTACHMENT_TYPES = ["image", "video"] as const;
export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];

// Community Post table - For community forum posts
export const communityPost = pgTable(
  "community_post",
  {
    id: text("id").primaryKey(),
    title: text("title"),
    content: text("content").notNull(),
    category: text("category").$default(() => "general").notNull(),
    isPinned: boolean("is_pinned").$default(() => false).notNull(),
    isQuestion: boolean("is_question").$default(() => false).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Multi-tenant support
    tenantId: text("tenant_id").references(() => tenant.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("idx_community_post_user_id").on(table.userId),
    index("idx_community_post_category").on(table.category),
    index("idx_community_post_created_at").on(table.createdAt),
    index("idx_community_post_tenant_id").on(table.tenantId),
  ]
);

// Community Post type exports
export type CommunityPost = typeof communityPost.$inferSelect;
export type CreateCommunityPostData = typeof communityPost.$inferInsert;

// Post Reaction table - Reactions (likes) on posts and comments
export const postReaction = pgTable(
  "post_reaction",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    postId: text("post_id"),
    commentId: text("comment_id"),
    reactionType: text("reaction_type").$default(() => "like").notNull(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_post_reaction_user_id").on(table.userId),
    index("idx_post_reaction_post_id").on(table.postId),
    index("idx_post_reaction_comment_id").on(table.commentId),
  ]
);

// Post Reaction type exports
export type PostReaction = typeof postReaction.$inferSelect;
export type CreatePostReactionData = typeof postReaction.$inferInsert;

// Heart table - For song favorites/likes
export const heart = pgTable(
  "heart",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    songId: text("song_id").notNull(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_heart_user_id").on(table.userId),
    index("idx_heart_song_id").on(table.songId),
  ]
);

// Heart type exports
export type Heart = typeof heart.$inferSelect;
export type CreateHeartData = typeof heart.$inferInsert;

// Post Comment table - Comments on community posts
export const postComment = pgTable(
  "post_comment",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    parentCommentId: text("parent_comment_id"), // For nested replies
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("idx_post_comment_post_id").on(table.postId),
    index("idx_post_comment_user_id").on(table.userId),
    index("idx_post_comment_parent_id").on(table.parentCommentId),
  ]
);

// Post Comment type exports
export type PostComment = typeof postComment.$inferSelect;
export type CreatePostCommentData = typeof postComment.$inferInsert;

// Expense Request Status types
export type ExpenseRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "disbursed";

// Expense Request table - For tracking expense requests and approval workflow
export const expenseRequest = pgTable(
  "expense_request",
  {
    id: text("id").primaryKey(),
    // Core expense details
    amount: text("amount").notNull(), // Stored as text to preserve precision (e.g., "1234.56")
    currency: text("currency").$default(() => "USD").notNull(),
    purpose: text("purpose").notNull(),
    description: text("description"), // Optional detailed description

    // Requester and approver references
    requesterId: text("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    approverId: text("approver_id")
      .references(() => user.id, { onDelete: "set null" }), // Nullable - assigned when approved/rejected

    // Status tracking
    status: text("status").$default(() => "pending").notNull(),

    // Workflow timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    submittedAt: timestamp("submitted_at")
      .$defaultFn(() => new Date())
      .notNull(), // When the request was initially submitted
    approvedAt: timestamp("approved_at"), // When the request was approved
    rejectedAt: timestamp("rejected_at"), // When the request was rejected
    disbursedAt: timestamp("disbursed_at"), // When the funds were disbursed

    // Optional metadata
    rejectionReason: text("rejection_reason"), // Reason for rejection if applicable
    receiptUrl: text("receipt_url"), // URL to uploaded receipt/documentation
  },
  (table) => [
    index("idx_expense_request_requester_id").on(table.requesterId),
    index("idx_expense_request_approver_id").on(table.approverId),
    index("idx_expense_request_status").on(table.status),
    index("idx_expense_request_created_at").on(table.createdAt),
  ]
);

// Expense Request Relations
export const expenseRequestRelations = relations(expenseRequest, ({ one }) => ({
  requester: one(user, {
    fields: [expenseRequest.requesterId],
    references: [user.id],
    relationName: "expenseRequester",
  }),
  approver: one(user, {
    fields: [expenseRequest.approverId],
    references: [user.id],
    relationName: "expenseApprover",
  }),
}));

// Update user relations to include expense requests
export const userExpenseRelations = relations(user, ({ many }) => ({
  expenseRequestsAsRequester: many(expenseRequest, {
    relationName: "expenseRequester",
  }),
  expenseRequestsAsApprover: many(expenseRequest, {
    relationName: "expenseApprover",
  }),
}));

// Expense Request type exports
export type ExpenseRequest = typeof expenseRequest.$inferSelect;
export type CreateExpenseRequestData = typeof expenseRequest.$inferInsert;
export type UpdateExpenseRequestData = Partial<
  Omit<CreateExpenseRequestData, "id" | "createdAt" | "requesterId">
>;

// =============================================================================
// Daily Briefings - Generated daily content for users
// =============================================================================

// Briefing status types
export type BriefingStatus = "active" | "expired" | "archived";

// Daily Briefing table - Main table for storing generated briefings
export const dailyBriefing = pgTable(
  "daily_briefing",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Content stored as JSON string for flexibility
    content: text("content").notNull(),

    // Read status tracking
    isRead: boolean("is_read")
      .$default(() => false)
      .notNull(),
    readAt: timestamp("read_at"),

    // Versioning - tracks the current version number of the briefing
    versionNumber: integer("version_number")
      .$default(() => 1)
      .notNull(),

    // Status for lifecycle management
    status: text("status")
      .$default(() => "active")
      .notNull(),

    // Generation and expiration timestamps
    generatedAt: timestamp("generated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    expiresAt: timestamp("expires_at").notNull(),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_daily_briefing_user_id").on(table.userId),
    index("idx_daily_briefing_expires_at").on(table.expiresAt),
    index("idx_daily_briefing_generated_at").on(table.generatedAt),
    index("idx_daily_briefing_status").on(table.status),
    index("idx_daily_briefing_user_generated").on(table.userId, table.generatedAt),
  ]
);

// Briefing Version table - Stores historical versions for versioning/regeneration
export const briefingVersion = pgTable(
  "briefing_version",
  {
    id: text("id").primaryKey(),
    briefingId: text("briefing_id")
      .notNull()
      .references(() => dailyBriefing.id, { onDelete: "cascade" }),

    // Version content snapshot
    content: text("content").notNull(),
    versionNumber: integer("version_number").notNull(),

    // Reason for creating this version (regeneration, auto-update, etc.)
    reason: text("reason"),

    // When this version was created
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_briefing_version_briefing_id").on(table.briefingId),
    index("idx_briefing_version_number").on(table.briefingId, table.versionNumber),
  ]
);

// Daily Briefing Relations
export const dailyBriefingRelations = relations(dailyBriefing, ({ one, many }) => ({
  user: one(user, {
    fields: [dailyBriefing.userId],
    references: [user.id],
  }),
  versions: many(briefingVersion),
}));

export const briefingVersionRelations = relations(briefingVersion, ({ one }) => ({
  briefing: one(dailyBriefing, {
    fields: [briefingVersion.briefingId],
    references: [dailyBriefing.id],
  }),
}));

// Update user relations to include daily briefings
export const userBriefingRelations = relations(user, ({ many }) => ({
  dailyBriefings: many(dailyBriefing),
}));

// Daily Briefing type exports
export type DailyBriefing = typeof dailyBriefing.$inferSelect;
export type CreateDailyBriefingData = typeof dailyBriefing.$inferInsert;
export type UpdateDailyBriefingData = Partial<
  Omit<CreateDailyBriefingData, "id" | "createdAt" | "userId">
>;

export type BriefingVersion = typeof briefingVersion.$inferSelect;
export type CreateBriefingVersionData = typeof briefingVersion.$inferInsert;

// =============================================================================
// Call History - Records of voice/video calls with AI summaries
// =============================================================================

// Call direction types
export type CallDirection = "inbound" | "outbound";

// Call status types
export type CallStatus = "completed" | "missed" | "busy" | "failed" | "no_answer" | "cancelled";

// Call Record table - Stores call records with metadata and AI-generated summaries
export const callRecord = pgTable(
  "call_record",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Call direction - inbound or outbound
    direction: text("direction").notNull(), // "inbound" | "outbound"

    // Duration in seconds
    duration: integer("duration").notNull(),

    // Timestamp when the call occurred
    callTimestamp: timestamp("call_timestamp")
      .$defaultFn(() => new Date())
      .notNull(),

    // Caller/recipient identification
    callerId: text("caller_id").notNull(), // Phone number or identifier of the caller
    callerName: text("caller_name"), // Optional name if available
    recipientId: text("recipient_id"), // Phone number or identifier of the recipient
    recipientName: text("recipient_name"), // Optional name if available

    // Recording information
    recordingUrl: text("recording_url"), // URL to the call recording if available
    recordingDuration: integer("recording_duration"), // Duration of recording in seconds

    // AI-generated summary
    summary: text("summary"), // AI-generated summary of the call
    summaryGeneratedAt: timestamp("summary_generated_at"), // When the summary was generated

    // Call metadata
    status: text("status").$default(() => "completed").notNull(), // Call status
    externalCallId: text("external_call_id"), // External system's call ID for reference

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_call_record_user_id").on(table.userId),
    index("idx_call_record_call_timestamp").on(table.callTimestamp),
    index("idx_call_record_direction").on(table.direction),
    index("idx_call_record_status").on(table.status),
    index("idx_call_record_caller_id").on(table.callerId),
    index("idx_call_record_user_timestamp").on(table.userId, table.callTimestamp),
  ]
);

// Call Record Relations
export const callRecordRelations = relations(callRecord, ({ one }) => ({
  user: one(user, {
    fields: [callRecord.userId],
    references: [user.id],
  }),
}));

// Update user relations to include call records
export const userCallRecordRelations = relations(user, ({ many }) => ({
  callRecords: many(callRecord),
}));

// Call Record type exports
export type CallRecord = typeof callRecord.$inferSelect;
export type CreateCallRecordData = typeof callRecord.$inferInsert;
export type UpdateCallRecordData = Partial<
  Omit<CreateCallRecordData, "id" | "createdAt" | "userId">
>;

// =============================================================================
// Call Dispositions - Post-call interface for call outcome tracking
// =============================================================================

// Call disposition types
export type CallDispositionType = "resolved" | "follow_up_needed" | "escalate";

// Call task priority types
export type CallTaskPriority = "low" | "medium" | "high" | "urgent";

// Call task status types
export type CallTaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

// Call Disposition table - Stores post-call disposition data
export const callDisposition = pgTable(
  "call_disposition",
  {
    id: text("id").primaryKey(),
    callRecordId: text("call_record_id")
      .notNull()
      .references(() => callRecord.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Disposition type - resolved, follow_up_needed, escalate
    disposition: text("disposition").notNull(), // "resolved" | "follow_up_needed" | "escalate"

    // Notes and summary
    notes: text("notes"), // Agent notes about the call
    customerSentiment: text("customer_sentiment"), // positive, neutral, negative

    // Follow-up details
    followUpDate: timestamp("follow_up_date"), // When to follow up if needed
    followUpReason: text("follow_up_reason"), // Why follow-up is needed

    // Escalation details
    escalationReason: text("escalation_reason"), // Why call needs escalation
    escalationPriority: text("escalation_priority"), // Priority level for escalation
    escalatedTo: text("escalated_to"), // User ID or department

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_call_disposition_call_record_id").on(table.callRecordId),
    index("idx_call_disposition_user_id").on(table.userId),
    index("idx_call_disposition_disposition").on(table.disposition),
    index("idx_call_disposition_follow_up_date").on(table.followUpDate),
  ]
);

// Call Task table - Tasks created from post-call interface
export const callTask = pgTable(
  "call_task",
  {
    id: text("id").primaryKey(),
    callRecordId: text("call_record_id")
      .notNull()
      .references(() => callRecord.id, { onDelete: "cascade" }),
    callDispositionId: text("call_disposition_id")
      .references(() => callDisposition.id, { onDelete: "set null" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assignedTo: text("assigned_to")
      .references(() => user.id, { onDelete: "set null" }),

    // Task details
    title: text("title").notNull(),
    description: text("description"),
    priority: text("priority").$default(() => "medium").notNull(), // low, medium, high, urgent
    status: text("status").$default(() => "pending").notNull(), // pending, in_progress, completed, cancelled

    // Due date
    dueDate: timestamp("due_date"),

    // Completion details
    completedAt: timestamp("completed_at"),
    completedBy: text("completed_by")
      .references(() => user.id, { onDelete: "set null" }),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_call_task_call_record_id").on(table.callRecordId),
    index("idx_call_task_user_id").on(table.userId),
    index("idx_call_task_assigned_to").on(table.assignedTo),
    index("idx_call_task_status").on(table.status),
    index("idx_call_task_priority").on(table.priority),
    index("idx_call_task_due_date").on(table.dueDate),
  ]
);

// Call Disposition Relations
export const callDispositionRelations = relations(callDisposition, ({ one, many }) => ({
  callRecord: one(callRecord, {
    fields: [callDisposition.callRecordId],
    references: [callRecord.id],
  }),
  user: one(user, {
    fields: [callDisposition.userId],
    references: [user.id],
  }),
  tasks: many(callTask),
}));

// Call Task Relations
export const callTaskRelations = relations(callTask, ({ one }) => ({
  callRecord: one(callRecord, {
    fields: [callTask.callRecordId],
    references: [callRecord.id],
  }),
  callDisposition: one(callDisposition, {
    fields: [callTask.callDispositionId],
    references: [callDisposition.id],
  }),
  user: one(user, {
    fields: [callTask.userId],
    references: [user.id],
  }),
  assignedUser: one(user, {
    fields: [callTask.assignedTo],
    references: [user.id],
  }),
  completedByUser: one(user, {
    fields: [callTask.completedBy],
    references: [user.id],
  }),
}));

// Call Disposition type exports
export type CallDisposition = typeof callDisposition.$inferSelect;
export type CreateCallDispositionData = typeof callDisposition.$inferInsert;
export type UpdateCallDispositionData = Partial<
  Omit<CreateCallDispositionData, "id" | "createdAt" | "callRecordId" | "userId">
>;

// Call Task type exports
export type CallTask = typeof callTask.$inferSelect;
export type CreateCallTaskData = typeof callTask.$inferInsert;
export type UpdateCallTaskData = Partial<
  Omit<CreateCallTaskData, "id" | "createdAt" | "callRecordId" | "userId">
>;

// =============================================================================
// AI Conversations - Multi-turn conversation context for AIOM
// =============================================================================

// Conversation status types
export type ConversationStatus = "active" | "archived" | "deleted";

// Message role types
export type MessageRole = "user" | "assistant" | "system" | "tool";

// Tool call status types
export type ToolCallStatus = "proposed" | "pending" | "running" | "completed" | "failed";

// AI Conversation Session table - Main table for conversation sessions
export const aiConversation = pgTable(
  "ai_conversation",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Conversation metadata
    title: text("title"), // Optional title for the conversation (can be auto-generated)
    summary: text("summary"), // Brief summary of the conversation for quick reference

    // Session management
    status: text("status")
      .$default(() => "active")
      .notNull(),

    // Context and configuration stored as JSON strings
    systemPrompt: text("system_prompt"), // Custom system prompt for this conversation
    contextMetadata: text("context_metadata"), // JSON: Additional context like user preferences, settings

    // Token usage tracking
    totalInputTokens: integer("total_input_tokens")
      .$default(() => 0)
      .notNull(),
    totalOutputTokens: integer("total_output_tokens")
      .$default(() => 0)
      .notNull(),

    // Model configuration
    modelId: text("model_id"), // Which AI model was used (e.g., "gpt-4", "claude-3")

    // Timestamps
    lastMessageAt: timestamp("last_message_at"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    archivedAt: timestamp("archived_at"),
    deletedAt: timestamp("deleted_at"), // Soft delete support
  },
  (table) => [
    index("idx_ai_conversation_user_id").on(table.userId),
    index("idx_ai_conversation_status").on(table.status),
    index("idx_ai_conversation_created_at").on(table.createdAt),
    index("idx_ai_conversation_last_message_at").on(table.lastMessageAt),
    index("idx_ai_conversation_user_status").on(table.userId, table.status),
  ]
);

// AI Message table - Individual messages within a conversation
export const aiMessage = pgTable(
  "ai_message",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => aiConversation.id, { onDelete: "cascade" }),

    // Message content
    role: text("role").notNull(), // user, assistant, system, tool
    content: text("content").notNull(), // The actual message content

    // Message ordering
    sequenceNumber: integer("sequence_number").notNull(), // Order within conversation

    // Token tracking for this message
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),

    // Parent message for branching conversations
    parentMessageId: text("parent_message_id"),

    // Metadata stored as JSON string
    metadata: text("metadata"), // JSON: Additional data like attachments, formatting, etc.

    // Feedback tracking
    feedbackRating: integer("feedback_rating"), // 1-5 star rating
    feedbackText: text("feedback_text"), // Optional text feedback

    // Timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_ai_message_conversation_id").on(table.conversationId),
    index("idx_ai_message_sequence").on(table.conversationId, table.sequenceNumber),
    index("idx_ai_message_created_at").on(table.createdAt),
    index("idx_ai_message_role").on(table.role),
    index("idx_ai_message_parent").on(table.parentMessageId),
  ]
);

// AI Tool Call table - Tracking tool/function calls made during conversations
export const aiToolCall = pgTable(
  "ai_tool_call",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => aiMessage.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => aiConversation.id, { onDelete: "cascade" }),

    // Tool identification
    toolName: text("tool_name").notNull(), // Name of the tool called
    toolCallId: text("tool_call_id"), // External tool call ID from AI provider

    // Tool inputs and outputs as JSON strings
    inputArguments: text("input_arguments"), // JSON: Arguments passed to the tool
    outputResult: text("output_result"), // JSON: Result returned from the tool

    // Execution tracking
    status: text("status")
      .$default(() => "pending")
      .notNull(),
    errorMessage: text("error_message"), // Error message if the call failed

    // Timing
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    durationMs: integer("duration_ms"), // Execution duration in milliseconds

    // Timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_ai_tool_call_message_id").on(table.messageId),
    index("idx_ai_tool_call_conversation_id").on(table.conversationId),
    index("idx_ai_tool_call_tool_name").on(table.toolName),
    index("idx_ai_tool_call_status").on(table.status),
    index("idx_ai_tool_call_created_at").on(table.createdAt),
  ]
);

// AI User Preferences table - User-specific AI settings and preferences
export const aiUserPreference = pgTable(
  "ai_user_preference",
  {
    id: text("id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),

    // Model preferences
    preferredModel: text("preferred_model"), // User's preferred AI model
    defaultSystemPrompt: text("default_system_prompt"), // Default system prompt for new conversations

    // Response preferences as JSON string
    responsePreferences: text("response_preferences"), // JSON: tone, length, format preferences

    // Context preferences
    enableContextMemory: boolean("enable_context_memory")
      .$default(() => true)
      .notNull(),
    maxContextMessages: integer("max_context_messages")
      .$default(() => 50)
      .notNull(),

    // Privacy settings
    saveConversationHistory: boolean("save_conversation_history")
      .$default(() => true)
      .notNull(),
    allowDataTraining: boolean("allow_data_training")
      .$default(() => false)
      .notNull(),

    // Usage limits (for rate limiting or plan-based limits)
    dailyMessageLimit: integer("daily_message_limit"),
    monthlyTokenLimit: integer("monthly_token_limit"),

    // Timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("idx_ai_user_preference_id").on(table.id)]
);

// AI Conversation Context table - Stores contextual information for ongoing conversations
export const aiConversationContext = pgTable(
  "ai_conversation_context",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => aiConversation.id, { onDelete: "cascade" }),

    // Context type and key for organized storage
    contextType: text("context_type").notNull(), // e.g., "user_info", "document", "preference", "memory"
    contextKey: text("context_key").notNull(), // Unique key within the type

    // Context value as JSON string for flexibility
    contextValue: text("context_value").notNull(),

    // Priority for context inclusion (higher = more important)
    priority: integer("priority")
      .$default(() => 0)
      .notNull(),

    // Expiration for temporary context
    expiresAt: timestamp("expires_at"),

    // Timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_ai_context_conversation_id").on(table.conversationId),
    index("idx_ai_context_type").on(table.contextType),
    index("idx_ai_context_conversation_type").on(table.conversationId, table.contextType),
    index("idx_ai_context_priority").on(table.priority),
    index("idx_ai_context_expires_at").on(table.expiresAt),
  ]
);

// AI Conversation Relations
export const aiConversationRelations = relations(aiConversation, ({ one, many }) => ({
  user: one(user, {
    fields: [aiConversation.userId],
    references: [user.id],
  }),
  messages: many(aiMessage),
  toolCalls: many(aiToolCall),
  contexts: many(aiConversationContext),
}));

export const aiMessageRelations = relations(aiMessage, ({ one, many }) => ({
  conversation: one(aiConversation, {
    fields: [aiMessage.conversationId],
    references: [aiConversation.id],
  }),
  parentMessage: one(aiMessage, {
    fields: [aiMessage.parentMessageId],
    references: [aiMessage.id],
    relationName: "messageParent",
  }),
  childMessages: many(aiMessage, {
    relationName: "messageParent",
  }),
  toolCalls: many(aiToolCall),
}));

export const aiToolCallRelations = relations(aiToolCall, ({ one }) => ({
  message: one(aiMessage, {
    fields: [aiToolCall.messageId],
    references: [aiMessage.id],
  }),
  conversation: one(aiConversation, {
    fields: [aiToolCall.conversationId],
    references: [aiConversation.id],
  }),
}));

export const aiUserPreferenceRelations = relations(aiUserPreference, ({ one }) => ({
  user: one(user, {
    fields: [aiUserPreference.id],
    references: [user.id],
  }),
}));

export const aiConversationContextRelations = relations(aiConversationContext, ({ one }) => ({
  conversation: one(aiConversation, {
    fields: [aiConversationContext.conversationId],
    references: [aiConversation.id],
  }),
}));

// Update user relations to include AI conversations and preferences
export const userAIRelations = relations(user, ({ one, many }) => ({
  aiConversations: many(aiConversation),
  aiPreferences: one(aiUserPreference, {
    fields: [user.id],
    references: [aiUserPreference.id],
  }),
}));

// AI Conversation type exports
export type AIConversation = typeof aiConversation.$inferSelect;
export type CreateAIConversationData = typeof aiConversation.$inferInsert;
export type UpdateAIConversationData = Partial<
  Omit<CreateAIConversationData, "id" | "createdAt" | "userId">
>;

export type AIMessage = typeof aiMessage.$inferSelect;
export type CreateAIMessageData = typeof aiMessage.$inferInsert;
export type UpdateAIMessageData = Partial<
  Omit<CreateAIMessageData, "id" | "createdAt" | "conversationId">
>;

export type AIToolCall = typeof aiToolCall.$inferSelect;
export type CreateAIToolCallData = typeof aiToolCall.$inferInsert;
export type UpdateAIToolCallData = Partial<
  Omit<CreateAIToolCallData, "id" | "createdAt" | "messageId" | "conversationId">
>;

export type AIUserPreference = typeof aiUserPreference.$inferSelect;
export type CreateAIUserPreferenceData = typeof aiUserPreference.$inferInsert;
export type UpdateAIUserPreferenceData = Partial<Omit<CreateAIUserPreferenceData, "id" | "createdAt">>;

export type AIConversationContext = typeof aiConversationContext.$inferSelect;
export type CreateAIConversationContextData = typeof aiConversationContext.$inferInsert;
export type UpdateAIConversationContextData = Partial<
  Omit<CreateAIConversationContextData, "id" | "createdAt" | "conversationId">
>;

// =============================================================================
// Push Notifications - Device tokens, message queue, and delivery tracking
// =============================================================================

// Device token type (web push vs FCM for mobile)
export type DeviceTokenType = "web_push" | "fcm";

// Push message status
export type PushMessageStatus = "pending" | "queued" | "sent" | "delivered" | "failed";

// Delivery status
export type DeliveryStatusType = "pending" | "delivered" | "failed" | "expired";

// Notification table - Core notification storage
export const notification = pgTable(
  "notification",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // e.g., "comment", "reaction", "message", "system"
    title: text("title").notNull(),
    content: text("content"),
    relatedId: text("related_id"), // ID of related entity (post, comment, etc.)
    relatedType: text("related_type"), // Type of related entity
    isRead: boolean("is_read")
      .$default(() => false)
      .notNull(),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_notification_user_id").on(table.userId),
    index("idx_notification_is_read").on(table.userId, table.isRead),
    index("idx_notification_created_at").on(table.createdAt),
  ]
);

// Device Token table - Stores push notification subscriptions (web push and FCM)
export const deviceToken = pgTable(
  "device_token",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Token type: "web_push" or "fcm"
    tokenType: text("token_type").notNull(),

    // For FCM: the registration token
    // For Web Push: the subscription endpoint
    token: text("token").notNull(),

    // Web Push specific fields (stored as JSON strings)
    // Contains p256dh and auth keys for web push
    webPushKeys: text("web_push_keys"), // JSON: { p256dh: string, auth: string }

    // Device metadata
    deviceName: text("device_name"),
    devicePlatform: text("device_platform"), // "web", "ios", "android"
    browserInfo: text("browser_info"), // User agent or browser name

    // Status tracking
    isActive: boolean("is_active")
      .$default(() => true)
      .notNull(),
    lastUsedAt: timestamp("last_used_at")
      .$defaultFn(() => new Date())
      .notNull(),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_device_token_user_id").on(table.userId),
    index("idx_device_token_type").on(table.tokenType),
    index("idx_device_token_active").on(table.userId, table.isActive),
    index("idx_device_token_token").on(table.token),
  ]
);

// Push Message table - Message queue for push notifications
export const pushMessage = pgTable(
  "push_message",
  {
    id: text("id").primaryKey(),

    // Target user (can be null for broadcast messages)
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" }),

    // Related notification (optional)
    notificationId: text("notification_id")
      .references(() => notification.id, { onDelete: "set null" }),

    // Message content
    title: text("title").notNull(),
    body: text("body").notNull(),
    icon: text("icon"), // URL to notification icon
    badge: text("badge"), // URL to badge icon
    image: text("image"), // URL to large image

    // Action handling
    clickAction: text("click_action"), // URL to open on click
    data: text("data"), // JSON string for custom data payload

    // Scheduling
    scheduledAt: timestamp("scheduled_at"), // For delayed sending

    // Status tracking
    status: text("status")
      .$default(() => "pending")
      .notNull(),
    priority: text("priority")
      .$default(() => "normal")
      .notNull(), // "high" or "normal"

    // Processing tracking
    processedAt: timestamp("processed_at"),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count")
      .$default(() => 0)
      .notNull(),
    maxRetries: integer("max_retries")
      .$default(() => 3)
      .notNull(),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_push_message_user_id").on(table.userId),
    index("idx_push_message_status").on(table.status),
    index("idx_push_message_scheduled").on(table.scheduledAt),
    index("idx_push_message_notification").on(table.notificationId),
  ]
);

// Delivery Tracking table - Tracks delivery status per device
export const deliveryTracking = pgTable(
  "delivery_tracking",
  {
    id: text("id").primaryKey(),

    // References
    pushMessageId: text("push_message_id")
      .notNull()
      .references(() => pushMessage.id, { onDelete: "cascade" }),
    deviceTokenId: text("device_token_id")
      .notNull()
      .references(() => deviceToken.id, { onDelete: "cascade" }),

    // Delivery status
    status: text("status")
      .$default(() => "pending")
      .notNull(),

    // Provider response
    providerMessageId: text("provider_message_id"), // FCM message ID or web push response
    providerResponse: text("provider_response"), // JSON string of full response

    // Timing
    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    failedAt: timestamp("failed_at"),

    // Error tracking
    errorCode: text("error_code"),
    errorMessage: text("error_message"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_delivery_tracking_message").on(table.pushMessageId),
    index("idx_delivery_tracking_device").on(table.deviceTokenId),
    index("idx_delivery_tracking_status").on(table.status),
  ]
);

// Push Notification Relations
export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(user, {
    fields: [notification.userId],
    references: [user.id],
  }),
}));

export const deviceTokenRelations = relations(deviceToken, ({ one, many }) => ({
  user: one(user, {
    fields: [deviceToken.userId],
    references: [user.id],
  }),
  deliveryTrackings: many(deliveryTracking),
}));

export const pushMessageRelations = relations(pushMessage, ({ one, many }) => ({
  user: one(user, {
    fields: [pushMessage.userId],
    references: [user.id],
  }),
  notification: one(notification, {
    fields: [pushMessage.notificationId],
    references: [notification.id],
  }),
  deliveryTrackings: many(deliveryTracking),
}));

export const deliveryTrackingRelations = relations(deliveryTracking, ({ one }) => ({
  pushMessage: one(pushMessage, {
    fields: [deliveryTracking.pushMessageId],
    references: [pushMessage.id],
  }),
  deviceToken: one(deviceToken, {
    fields: [deliveryTracking.deviceTokenId],
    references: [deviceToken.id],
  }),
}));

// Update user relations to include push notifications
export const userPushNotificationRelations = relations(user, ({ many }) => ({
  notifications: many(notification),
  deviceTokens: many(deviceToken),
  pushMessages: many(pushMessage),
}));

// Push Notification type exports
export type Notification = typeof notification.$inferSelect;
export type CreateNotificationData = typeof notification.$inferInsert;
export type UpdateNotificationData = Partial<Omit<CreateNotificationData, "id" | "createdAt" | "userId">>;

export type DeviceToken = typeof deviceToken.$inferSelect;
export type CreateDeviceTokenData = typeof deviceToken.$inferInsert;
export type UpdateDeviceTokenData = Partial<Omit<CreateDeviceTokenData, "id" | "createdAt" | "userId">>;

export type PushMessage = typeof pushMessage.$inferSelect;
export type CreatePushMessageData = typeof pushMessage.$inferInsert;
export type UpdatePushMessageData = Partial<Omit<CreatePushMessageData, "id" | "createdAt">>;

export type DeliveryTracking = typeof deliveryTracking.$inferSelect;
export type CreateDeliveryTrackingData = typeof deliveryTracking.$inferInsert;
export type UpdateDeliveryTrackingData = Partial<Omit<CreateDeliveryTrackingData, "id" | "createdAt">>;

// Web Push subscription keys type
export type WebPushKeys = {
  p256dh: string;
  auth: string;
};

// =============================================================================
// Expense Vouchers - For expense vouchers with receipts, GL mapping, and approval chain
// =============================================================================

// Expense Voucher Status types
export type ExpenseVoucherStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "posted"
  | "voided";

// Reconciliation Status types
export type ReconciliationStatus =
  | "unreconciled"
  | "partially_reconciled"
  | "reconciled"
  | "disputed";

// Posting Status types
export type PostingStatus =
  | "not_posted"
  | "pending"
  | "posted"
  | "failed"
  | "reversed";

// Expense Voucher table - Main table for expense vouchers
export const expenseVoucher = pgTable(
  "expense_voucher",
  {
    id: text("id").primaryKey(),
    voucherNumber: text("voucher_number").notNull().unique(), // Auto-generated voucher number (e.g., EV-2024-00001)

    // Link to expense request (optional - voucher can be standalone or linked)
    expenseRequestId: text("expense_request_id")
      .references(() => expenseRequest.id, { onDelete: "set null" }),

    // Core voucher details
    amount: text("amount").notNull(), // Stored as text to preserve precision (e.g., "1234.56")
    currency: text("currency").$default(() => "USD").notNull(),
    description: text("description").notNull(),
    vendorName: text("vendor_name"), // Vendor/payee name
    vendorId: text("vendor_id"), // External vendor ID (e.g., from Odoo)

    // GL Account mapping
    glAccountCode: text("gl_account_code"), // General Ledger account code (e.g., "6010")
    glAccountName: text("gl_account_name"), // GL account description
    costCenter: text("cost_center"), // Cost center code
    department: text("department"), // Department code
    projectCode: text("project_code"), // Project code for project-based accounting

    // Workflow participants
    submitterId: text("submitter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    currentApproverId: text("current_approver_id")
      .references(() => user.id, { onDelete: "set null" }), // Current approver in chain
    finalApproverId: text("final_approver_id")
      .references(() => user.id, { onDelete: "set null" }), // Final approver who approved

    // Approval chain stored as JSON array
    // Format: [{ userId: string, name: string, role: string, order: number, status: "pending" | "approved" | "rejected", actionAt?: Date, comments?: string }]
    approvalChain: text("approval_chain"), // JSON string of approval chain
    currentApprovalStep: integer("current_approval_step").$default(() => 0).notNull(),
    totalApprovalSteps: integer("total_approval_steps").$default(() => 1).notNull(),

    // Status tracking
    status: text("status").$default(() => "draft").notNull(),
    reconciliationStatus: text("reconciliation_status").$default(() => "unreconciled").notNull(),
    postingStatus: text("posting_status").$default(() => "not_posted").notNull(),

    // GL Posting details
    glPostingDate: timestamp("gl_posting_date"), // When posted to GL
    glJournalEntryId: text("gl_journal_entry_id"), // External journal entry ID (e.g., from Odoo)
    glPostingReference: text("gl_posting_reference"), // Posting reference number
    glPostingError: text("gl_posting_error"), // Error message if posting failed

    // Reconciliation details
    reconciliationDate: timestamp("reconciliation_date"),
    reconciliationReference: text("reconciliation_reference"),
    reconciledById: text("reconciled_by_id")
      .references(() => user.id, { onDelete: "set null" }),
    reconciliationNotes: text("reconciliation_notes"),

    // Payment details
    paymentMethod: text("payment_method"), // cash, check, wire, credit_card, etc.
    paymentReference: text("payment_reference"), // Check number, transaction ID, etc.
    paymentDate: timestamp("payment_date"),
    bankAccountId: text("bank_account_id"), // Bank account used for payment

    // Receipt attachments stored as JSON array
    // Format: [{ id: string, fileName: string, fileUrl: string, fileSize: number, mimeType: string, uploadedAt: Date, uploadedBy: string }]
    receiptAttachments: text("receipt_attachments"), // JSON string of attachments array

    // Additional metadata
    notes: text("notes"), // Internal notes
    externalReference: text("external_reference"), // Reference to external system
    tags: text("tags"), // JSON array of tags for categorization

    // Rejection tracking
    rejectionReason: text("rejection_reason"),
    rejectedById: text("rejected_by_id")
      .references(() => user.id, { onDelete: "set null" }),
    rejectedAt: timestamp("rejected_at"),

    // Voiding tracking
    voidedById: text("voided_by_id")
      .references(() => user.id, { onDelete: "set null" }),
    voidedAt: timestamp("voided_at"),
    voidReason: text("void_reason"),

    // Workflow timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    submittedAt: timestamp("submitted_at"), // When submitted for approval
    approvedAt: timestamp("approved_at"), // When finally approved
    postedAt: timestamp("posted_at"), // When posted to GL
  },
  (table) => [
    index("idx_expense_voucher_voucher_number").on(table.voucherNumber),
    index("idx_expense_voucher_expense_request_id").on(table.expenseRequestId),
    index("idx_expense_voucher_submitter_id").on(table.submitterId),
    index("idx_expense_voucher_current_approver_id").on(table.currentApproverId),
    index("idx_expense_voucher_status").on(table.status),
    index("idx_expense_voucher_reconciliation_status").on(table.reconciliationStatus),
    index("idx_expense_voucher_posting_status").on(table.postingStatus),
    index("idx_expense_voucher_gl_account_code").on(table.glAccountCode),
    index("idx_expense_voucher_created_at").on(table.createdAt),
    index("idx_expense_voucher_vendor_id").on(table.vendorId),
  ]
);

// Expense Voucher Line Items table - For multi-line vouchers
export const expenseVoucherLineItem = pgTable(
  "expense_voucher_line_item",
  {
    id: text("id").primaryKey(),
    voucherId: text("voucher_id")
      .notNull()
      .references(() => expenseVoucher.id, { onDelete: "cascade" }),

    // Line item details
    lineNumber: integer("line_number").notNull(), // Order within voucher
    description: text("description").notNull(),
    amount: text("amount").notNull(), // Stored as text to preserve precision
    quantity: text("quantity").$default(() => "1").notNull(), // Quantity (default 1)
    unitPrice: text("unit_price"), // Unit price if applicable

    // GL mapping for this line
    glAccountCode: text("gl_account_code"),
    glAccountName: text("gl_account_name"),
    costCenter: text("cost_center"),
    department: text("department"),
    projectCode: text("project_code"),

    // Tax information
    taxCode: text("tax_code"),
    taxAmount: text("tax_amount"),
    taxRate: text("tax_rate"),

    // Category and classification
    expenseCategory: text("expense_category"), // travel, supplies, equipment, etc.

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_expense_voucher_line_item_voucher_id").on(table.voucherId),
    index("idx_expense_voucher_line_item_gl_account").on(table.glAccountCode),
    index("idx_expense_voucher_line_item_line_number").on(table.voucherId, table.lineNumber),
  ]
);

// Expense Voucher Approval History table - Tracks all approval actions
export const expenseVoucherApprovalHistory = pgTable(
  "expense_voucher_approval_history",
  {
    id: text("id").primaryKey(),
    voucherId: text("voucher_id")
      .notNull()
      .references(() => expenseVoucher.id, { onDelete: "cascade" }),

    // Approver info
    approverId: text("approver_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    approverRole: text("approver_role"), // manager, finance, director, etc.

    // Action details
    action: text("action").notNull(), // submitted, approved, rejected, returned, escalated
    stepNumber: integer("step_number").notNull(), // Which step in approval chain

    // Comments and notes
    comments: text("comments"),

    // Previous and new status
    previousStatus: text("previous_status"),
    newStatus: text("new_status"),

    // Timestamp
    actionAt: timestamp("action_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_expense_voucher_approval_history_voucher_id").on(table.voucherId),
    index("idx_expense_voucher_approval_history_approver_id").on(table.approverId),
    index("idx_expense_voucher_approval_history_action_at").on(table.actionAt),
  ]
);

// Expense Voucher Relations
export const expenseVoucherRelations = relations(expenseVoucher, ({ one, many }) => ({
  expenseRequest: one(expenseRequest, {
    fields: [expenseVoucher.expenseRequestId],
    references: [expenseRequest.id],
  }),
  submitter: one(user, {
    fields: [expenseVoucher.submitterId],
    references: [user.id],
    relationName: "voucherSubmitter",
  }),
  currentApprover: one(user, {
    fields: [expenseVoucher.currentApproverId],
    references: [user.id],
    relationName: "voucherCurrentApprover",
  }),
  finalApprover: one(user, {
    fields: [expenseVoucher.finalApproverId],
    references: [user.id],
    relationName: "voucherFinalApprover",
  }),
  reconciledBy: one(user, {
    fields: [expenseVoucher.reconciledById],
    references: [user.id],
    relationName: "voucherReconciledBy",
  }),
  rejectedBy: one(user, {
    fields: [expenseVoucher.rejectedById],
    references: [user.id],
    relationName: "voucherRejectedBy",
  }),
  voidedBy: one(user, {
    fields: [expenseVoucher.voidedById],
    references: [user.id],
    relationName: "voucherVoidedBy",
  }),
  lineItems: many(expenseVoucherLineItem),
  approvalHistory: many(expenseVoucherApprovalHistory),
}));

export const expenseVoucherLineItemRelations = relations(expenseVoucherLineItem, ({ one }) => ({
  voucher: one(expenseVoucher, {
    fields: [expenseVoucherLineItem.voucherId],
    references: [expenseVoucher.id],
  }),
}));

export const expenseVoucherApprovalHistoryRelations = relations(expenseVoucherApprovalHistory, ({ one }) => ({
  voucher: one(expenseVoucher, {
    fields: [expenseVoucherApprovalHistory.voucherId],
    references: [expenseVoucher.id],
  }),
  approver: one(user, {
    fields: [expenseVoucherApprovalHistory.approverId],
    references: [user.id],
  }),
}));

// Update expense request relations to include vouchers
export const expenseRequestVoucherRelations = relations(expenseRequest, ({ many }) => ({
  vouchers: many(expenseVoucher),
}));

// Update user relations to include expense vouchers
export const userExpenseVoucherRelations = relations(user, ({ many }) => ({
  expenseVouchersAsSubmitter: many(expenseVoucher, {
    relationName: "voucherSubmitter",
  }),
  expenseVouchersAsCurrentApprover: many(expenseVoucher, {
    relationName: "voucherCurrentApprover",
  }),
  expenseVouchersAsFinalApprover: many(expenseVoucher, {
    relationName: "voucherFinalApprover",
  }),
  expenseVoucherApprovalHistory: many(expenseVoucherApprovalHistory),
}));

// Expense Voucher type exports
export type ExpenseVoucher = typeof expenseVoucher.$inferSelect;
export type CreateExpenseVoucherData = typeof expenseVoucher.$inferInsert;
export type UpdateExpenseVoucherData = Partial<
  Omit<CreateExpenseVoucherData, "id" | "createdAt" | "submitterId" | "voucherNumber">
>;

export type ExpenseVoucherLineItem = typeof expenseVoucherLineItem.$inferSelect;
export type CreateExpenseVoucherLineItemData = typeof expenseVoucherLineItem.$inferInsert;
export type UpdateExpenseVoucherLineItemData = Partial<
  Omit<CreateExpenseVoucherLineItemData, "id" | "createdAt" | "voucherId">
>;

export type ExpenseVoucherApprovalHistory = typeof expenseVoucherApprovalHistory.$inferSelect;
export type CreateExpenseVoucherApprovalHistoryData = typeof expenseVoucherApprovalHistory.$inferInsert;

// Receipt Attachment type for JSON storage
export type ReceiptAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string; // ISO date string
  uploadedBy: string; // User ID
};

// Approval Chain Step type for JSON storage
export type ApprovalChainStep = {
  userId: string;
  name: string;
  email: string;
  role: string;
  order: number;
  status: "pending" | "approved" | "rejected" | "skipped";
  actionAt?: string; // ISO date string
  comments?: string;
};

// =============================================================================
// Prompt Templates - Optimized AI prompt templates library with caching
// =============================================================================

// Prompt Template Category types
export type PromptTemplateCategoryType =
  | "briefing_generation"
  | "query_answering"
  | "summarization"
  | "data_extraction"
  | "content_creation"
  | "analysis"
  | "custom";

// Prompt Template Status types
export type PromptTemplateStatusType = "active" | "deprecated" | "draft" | "archived";

// Prompt Template table - Stores custom and built-in prompt templates
export const promptTemplate = pgTable(
  "prompt_template",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),

    // Category and status
    category: text("category").$default(() => "custom").notNull(),
    status: text("status").$default(() => "active").notNull(),
    version: text("version").$default(() => "1.0.0").notNull(),

    // Template content
    systemPrompt: text("system_prompt").notNull(),
    userPromptPrefix: text("user_prompt_prefix"),
    userPromptSuffix: text("user_prompt_suffix"),

    // Variable definitions (JSON array)
    variables: text("variables").$default(() => "[]").notNull(),

    // Caching configuration (JSON object)
    caching: text("caching").$default(() => JSON.stringify({
      enablePromptCaching: true,
      enableMemoryCache: true,
      memoryCacheTTL: 300000,
      minTokensForCaching: 1024,
    })).notNull(),

    // Model recommendations
    recommendedModel: text("recommended_model"),
    recommendedTemperature: text("recommended_temperature"),
    recommendedMaxTokens: integer("recommended_max_tokens"),

    // Token estimates (JSON object)
    tokenEstimate: text("token_estimate"),

    // Metadata
    tags: text("tags"), // JSON array
    author: text("author"),
    isBuiltIn: boolean("is_built_in").$default(() => false).notNull(),

    // Ownership (null for built-in templates)
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" }),

    // Timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_prompt_template_user_id").on(table.userId),
    index("idx_prompt_template_category").on(table.category),
    index("idx_prompt_template_status").on(table.status),
    index("idx_prompt_template_is_built_in").on(table.isBuiltIn),
    index("idx_prompt_template_created_at").on(table.createdAt),
  ]
);

// Prompt Template Usage table - Tracks template usage for analytics and cost tracking
export const promptTemplateUsage = pgTable(
  "prompt_template_usage",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => promptTemplate.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Token usage
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    cacheReadTokens: integer("cache_read_tokens"),
    cacheCreationTokens: integer("cache_creation_tokens"),

    // Performance
    responseTimeMs: integer("response_time_ms").notNull(),
    model: text("model").notNull(),

    // Status
    success: boolean("success").notNull(),
    errorMessage: text("error_message"),

    // Timestamp
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_prompt_template_usage_template_id").on(table.templateId),
    index("idx_prompt_template_usage_user_id").on(table.userId),
    index("idx_prompt_template_usage_created_at").on(table.createdAt),
    index("idx_prompt_template_usage_success").on(table.success),
    index("idx_prompt_template_usage_user_template").on(table.userId, table.templateId),
  ]
);

// Prompt Template Relations
export const promptTemplateRelations = relations(promptTemplate, ({ one, many }) => ({
  user: one(user, {
    fields: [promptTemplate.userId],
    references: [user.id],
  }),
  usageRecords: many(promptTemplateUsage),
}));

export const promptTemplateUsageRelations = relations(promptTemplateUsage, ({ one }) => ({
  template: one(promptTemplate, {
    fields: [promptTemplateUsage.templateId],
    references: [promptTemplate.id],
  }),
  user: one(user, {
    fields: [promptTemplateUsage.userId],
    references: [user.id],
  }),
}));

// Update user relations to include prompt templates
export const userPromptTemplateRelations = relations(user, ({ many }) => ({
  promptTemplates: many(promptTemplate),
  promptTemplateUsage: many(promptTemplateUsage),
}));

// Prompt Template type exports
export type PromptTemplateRecord = typeof promptTemplate.$inferSelect;
export type CreatePromptTemplateData = typeof promptTemplate.$inferInsert;
export type UpdatePromptTemplateData = Partial<
  Omit<CreatePromptTemplateData, "id" | "createdAt" | "userId" | "isBuiltIn">
>;

export type PromptTemplateUsageRecord = typeof promptTemplateUsage.$inferSelect;
export type CreatePromptTemplateUsageData = typeof promptTemplateUsage.$inferInsert;

// =============================================================================
// Odoo Discuss - Channels and Messages synced from Odoo Discuss module
// =============================================================================

// Channel sync status types
export type OdooChannelSyncStatus = "synced" | "syncing" | "error" | "pending";

// Channel type from Odoo
export type OdooChannelType = "chat" | "channel" | "group";

// Odoo Discuss Channel table - Cached channels from Odoo Discuss
export const odooChannel = pgTable(
  "odoo_channel",
  {
    id: text("id").primaryKey(),
    odooId: integer("odoo_id").notNull().unique(), // Odoo channel ID
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Channel details from Odoo
    name: text("name").notNull(),
    description: text("description"),
    channelType: text("channel_type").$default(() => "channel").notNull(), // chat, channel, group
    memberCount: integer("member_count").$default(() => 0).notNull(),
    unreadCount: integer("unread_count").$default(() => 0).notNull(),
    isMember: boolean("is_member").$default(() => true).notNull(),

    // Channel image (base64 or URL)
    image: text("image"),

    // Sync tracking
    syncStatus: text("sync_status").$default(() => "synced").notNull(),
    lastSyncedAt: timestamp("last_synced_at")
      .$defaultFn(() => new Date())
      .notNull(),
    lastMessageOdooId: integer("last_message_odoo_id"), // Last synced message ID from Odoo
    syncError: text("sync_error"),

    // Odoo timestamps
    odooCreatedAt: timestamp("odoo_created_at"),
    odooUpdatedAt: timestamp("odoo_updated_at"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_odoo_channel_user_id").on(table.userId),
    index("idx_odoo_channel_odoo_id").on(table.odooId),
    index("idx_odoo_channel_sync_status").on(table.syncStatus),
    index("idx_odoo_channel_user_odoo").on(table.userId, table.odooId),
    index("idx_odoo_channel_updated_at").on(table.updatedAt),
  ]
);

// Odoo Discuss Message table - Cached messages from Odoo Discuss
export const odooMessage = pgTable(
  "odoo_message",
  {
    id: text("id").primaryKey(),
    odooId: integer("odoo_id").notNull().unique(), // Odoo message ID
    channelId: text("channel_id")
      .notNull()
      .references(() => odooChannel.id, { onDelete: "cascade" }),

    // Message content
    body: text("body").notNull(), // HTML content from Odoo
    messageType: text("message_type").$default(() => "comment").notNull(), // comment, notification

    // Author info (from Odoo)
    authorOdooId: integer("author_odoo_id"),
    authorName: text("author_name"),
    authorEmail: text("author_email"),

    // Message metadata
    isStarred: boolean("is_starred").$default(() => false).notNull(),
    hasAttachments: boolean("has_attachments").$default(() => false).notNull(),
    attachmentCount: integer("attachment_count").$default(() => 0).notNull(),

    // Attachments stored as JSON array
    // Format: [{ id: number, name: string, mimetype: string, fileSize: number, url: string }]
    attachments: text("attachments"),

    // Odoo timestamps
    odooCreatedAt: timestamp("odoo_created_at"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_odoo_message_channel_id").on(table.channelId),
    index("idx_odoo_message_odoo_id").on(table.odooId),
    index("idx_odoo_message_author_odoo_id").on(table.authorOdooId),
    index("idx_odoo_message_created_at").on(table.createdAt),
    index("idx_odoo_message_channel_created").on(table.channelId, table.createdAt),
  ]
);

// Odoo Discuss Subscription table - Tracks long-polling subscriptions
export const odooDiscussSubscription = pgTable(
  "odoo_discuss_subscription",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Polling state
    isActive: boolean("is_active").$default(() => true).notNull(),
    lastPollingId: integer("last_polling_id").$default(() => 0).notNull(),
    pollingInterval: integer("polling_interval").$default(() => 5000).notNull(), // ms

    // Connection info
    lastPollAt: timestamp("last_poll_at"),
    lastNotificationAt: timestamp("last_notification_at"),
    errorCount: integer("error_count").$default(() => 0).notNull(),
    lastError: text("last_error"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_odoo_discuss_subscription_user_id").on(table.userId),
    index("idx_odoo_discuss_subscription_active").on(table.isActive),
  ]
);

// Odoo Discuss Relations
export const odooChannelRelations = relations(odooChannel, ({ one, many }) => ({
  user: one(user, {
    fields: [odooChannel.userId],
    references: [user.id],
  }),
  messages: many(odooMessage),
}));

export const odooMessageRelations = relations(odooMessage, ({ one }) => ({
  channel: one(odooChannel, {
    fields: [odooMessage.channelId],
    references: [odooChannel.id],
  }),
}));

export const odooDiscussSubscriptionRelations = relations(odooDiscussSubscription, ({ one }) => ({
  user: one(user, {
    fields: [odooDiscussSubscription.userId],
    references: [user.id],
  }),
}));

// Update user relations to include Odoo Discuss
export const userOdooDiscussRelations = relations(user, ({ many, one }) => ({
  odooChannels: many(odooChannel),
  odooDiscussSubscription: one(odooDiscussSubscription, {
    fields: [user.id],
    references: [odooDiscussSubscription.userId],
  }),
}));

// Odoo Discuss type exports
export type OdooChannel = typeof odooChannel.$inferSelect;
export type CreateOdooChannelData = typeof odooChannel.$inferInsert;
export type UpdateOdooChannelData = Partial<
  Omit<CreateOdooChannelData, "id" | "createdAt" | "userId" | "odooId">
>;

export type OdooMessage = typeof odooMessage.$inferSelect;
export type CreateOdooMessageData = typeof odooMessage.$inferInsert;

export type OdooDiscussSubscription = typeof odooDiscussSubscription.$inferSelect;
export type CreateOdooDiscussSubscriptionData = typeof odooDiscussSubscription.$inferInsert;
export type UpdateOdooDiscussSubscriptionData = Partial<
  Omit<CreateOdooDiscussSubscriptionData, "id" | "createdAt" | "userId">
>;

// Odoo Message Attachment type for JSON storage
export type OdooMessageAttachment = {
  id: number;
  name: string;
  mimetype: string;
  fileSize: number;
  url: string;
};

// =============================================================================
// Expense Workflow Engine - State machine for expense lifecycle management
// =============================================================================

// Workflow state types for the expense lifecycle
export type ExpenseWorkflowState =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "disbursement_pending"
  | "disbursed"
  | "receipt_pending"
  | "receipt_captured"
  | "reconciliation_pending"
  | "reconciled"
  | "gl_posting_pending"
  | "posted"
  | "voided";

// Workflow event types
export type ExpenseWorkflowEventType =
  | "created"
  | "submitted"
  | "approved"
  | "rejected"
  | "returned_for_revision"
  | "disbursement_initiated"
  | "disbursed"
  | "receipt_requested"
  | "receipt_uploaded"
  | "receipt_verified"
  | "reconciliation_started"
  | "reconciled"
  | "gl_posting_initiated"
  | "gl_posted"
  | "gl_posting_failed"
  | "voided"
  | "escalated"
  | "comment_added"
  | "reminder_sent";

// Expense Workflow Instance table - Tracks the state machine for each expense
export const expenseWorkflowInstance = pgTable(
  "expense_workflow_instance",
  {
    id: text("id").primaryKey(),

    // Reference to the expense voucher
    voucherId: text("voucher_id")
      .notNull()
      .references(() => expenseVoucher.id, { onDelete: "cascade" }),

    // Current workflow state
    currentState: text("current_state").$default(() => "draft").notNull(),
    previousState: text("previous_state"),

    // State timestamps
    stateEnteredAt: timestamp("state_entered_at")
      .$defaultFn(() => new Date())
      .notNull(),

    // Workflow configuration (JSON object)
    // Contains rules like: auto-approve thresholds, required approvers, etc.
    workflowConfig: text("workflow_config"),

    // Current assignee for action
    currentAssigneeId: text("current_assignee_id")
      .references(() => user.id, { onDelete: "set null" }),

    // Escalation tracking
    escalationLevel: integer("escalation_level").$default(() => 0).notNull(),
    escalatedAt: timestamp("escalated_at"),
    escalationReason: text("escalation_reason"),

    // Due dates and SLA
    dueDate: timestamp("due_date"),
    slaBreached: boolean("sla_breached").$default(() => false).notNull(),
    slaDurations: text("sla_durations"), // JSON: { approval: 48h, disbursement: 24h, etc. }

    // Retry tracking for failed operations
    retryCount: integer("retry_count").$default(() => 0).notNull(),
    lastRetryAt: timestamp("last_retry_at"),
    lastError: text("last_error"),

    // Completion tracking
    isCompleted: boolean("is_completed").$default(() => false).notNull(),
    completedAt: timestamp("completed_at"),
    completionResult: text("completion_result"), // "success" | "rejected" | "voided"

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_expense_workflow_instance_voucher_id").on(table.voucherId),
    index("idx_expense_workflow_instance_current_state").on(table.currentState),
    index("idx_expense_workflow_instance_assignee").on(table.currentAssigneeId),
    index("idx_expense_workflow_instance_is_completed").on(table.isCompleted),
    index("idx_expense_workflow_instance_due_date").on(table.dueDate),
  ]
);

// Expense Workflow Event table - Audit trail of all workflow events
export const expenseWorkflowEvent = pgTable(
  "expense_workflow_event",
  {
    id: text("id").primaryKey(),

    // Reference to workflow instance
    workflowInstanceId: text("workflow_instance_id")
      .notNull()
      .references(() => expenseWorkflowInstance.id, { onDelete: "cascade" }),

    // Reference to voucher (for direct querying)
    voucherId: text("voucher_id")
      .notNull()
      .references(() => expenseVoucher.id, { onDelete: "cascade" }),

    // Event details
    eventType: text("event_type").notNull(),
    fromState: text("from_state"),
    toState: text("to_state"),

    // Who triggered the event
    triggeredById: text("triggered_by_id")
      .references(() => user.id, { onDelete: "set null" }),

    // Event data (JSON object with event-specific data)
    eventData: text("event_data"),

    // Comments or notes
    comments: text("comments"),

    // For notifications that were sent as part of this event
    notificationsSent: text("notifications_sent"), // JSON array of notification IDs

    // Metadata
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    // Timestamp
    occurredAt: timestamp("occurred_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_expense_workflow_event_instance_id").on(table.workflowInstanceId),
    index("idx_expense_workflow_event_voucher_id").on(table.voucherId),
    index("idx_expense_workflow_event_type").on(table.eventType),
    index("idx_expense_workflow_event_occurred_at").on(table.occurredAt),
    index("idx_expense_workflow_event_triggered_by").on(table.triggeredById),
  ]
);

// Expense Workflow Notification Queue - Queue for workflow notifications
export const expenseWorkflowNotificationQueue = pgTable(
  "expense_workflow_notification_queue",
  {
    id: text("id").primaryKey(),

    // References
    workflowInstanceId: text("workflow_instance_id")
      .notNull()
      .references(() => expenseWorkflowInstance.id, { onDelete: "cascade" }),
    voucherId: text("voucher_id")
      .notNull()
      .references(() => expenseVoucher.id, { onDelete: "cascade" }),

    // Recipient
    recipientId: text("recipient_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Notification content
    notificationType: text("notification_type").notNull(), // approval_request, reminder, escalation, etc.
    title: text("title").notNull(),
    body: text("body").notNull(),
    actionUrl: text("action_url"),

    // Priority
    priority: text("priority").$default(() => "normal").notNull(), // low, normal, high, urgent

    // Scheduling
    scheduledFor: timestamp("scheduled_for")
      .$defaultFn(() => new Date())
      .notNull(),

    // Status tracking
    status: text("status").$default(() => "pending").notNull(), // pending, sent, delivered, failed, cancelled
    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    failedAt: timestamp("failed_at"),
    errorMessage: text("error_message"),

    // Retry tracking
    retryCount: integer("retry_count").$default(() => 0).notNull(),
    maxRetries: integer("max_retries").$default(() => 3).notNull(),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_expense_workflow_notification_queue_instance").on(table.workflowInstanceId),
    index("idx_expense_workflow_notification_queue_recipient").on(table.recipientId),
    index("idx_expense_workflow_notification_queue_status").on(table.status),
    index("idx_expense_workflow_notification_queue_scheduled").on(table.scheduledFor),
  ]
);

// Expense Workflow Relations
export const expenseWorkflowInstanceRelations = relations(expenseWorkflowInstance, ({ one, many }) => ({
  voucher: one(expenseVoucher, {
    fields: [expenseWorkflowInstance.voucherId],
    references: [expenseVoucher.id],
  }),
  currentAssignee: one(user, {
    fields: [expenseWorkflowInstance.currentAssigneeId],
    references: [user.id],
  }),
  events: many(expenseWorkflowEvent),
  notificationQueue: many(expenseWorkflowNotificationQueue),
}));

export const expenseWorkflowEventRelations = relations(expenseWorkflowEvent, ({ one }) => ({
  workflowInstance: one(expenseWorkflowInstance, {
    fields: [expenseWorkflowEvent.workflowInstanceId],
    references: [expenseWorkflowInstance.id],
  }),
  voucher: one(expenseVoucher, {
    fields: [expenseWorkflowEvent.voucherId],
    references: [expenseVoucher.id],
  }),
  triggeredBy: one(user, {
    fields: [expenseWorkflowEvent.triggeredById],
    references: [user.id],
  }),
}));

export const expenseWorkflowNotificationQueueRelations = relations(expenseWorkflowNotificationQueue, ({ one }) => ({
  workflowInstance: one(expenseWorkflowInstance, {
    fields: [expenseWorkflowNotificationQueue.workflowInstanceId],
    references: [expenseWorkflowInstance.id],
  }),
  voucher: one(expenseVoucher, {
    fields: [expenseWorkflowNotificationQueue.voucherId],
    references: [expenseVoucher.id],
  }),
  recipient: one(user, {
    fields: [expenseWorkflowNotificationQueue.recipientId],
    references: [user.id],
  }),
}));

// Update expense voucher relations to include workflow
export const expenseVoucherWorkflowRelations = relations(expenseVoucher, ({ one }) => ({
  workflowInstance: one(expenseWorkflowInstance, {
    fields: [expenseVoucher.id],
    references: [expenseWorkflowInstance.voucherId],
  }),
}));

// Expense Workflow type exports
export type ExpenseWorkflowInstance = typeof expenseWorkflowInstance.$inferSelect;
export type CreateExpenseWorkflowInstanceData = typeof expenseWorkflowInstance.$inferInsert;
export type UpdateExpenseWorkflowInstanceData = Partial<
  Omit<CreateExpenseWorkflowInstanceData, "id" | "createdAt" | "voucherId">
>;

export type ExpenseWorkflowEvent = typeof expenseWorkflowEvent.$inferSelect;
export type CreateExpenseWorkflowEventData = typeof expenseWorkflowEvent.$inferInsert;

export type ExpenseWorkflowNotificationQueue = typeof expenseWorkflowNotificationQueue.$inferSelect;
export type CreateExpenseWorkflowNotificationQueueData = typeof expenseWorkflowNotificationQueue.$inferInsert;
export type UpdateExpenseWorkflowNotificationQueueData = Partial<
  Omit<CreateExpenseWorkflowNotificationQueueData, "id" | "createdAt">
>;

// Workflow configuration type for JSON storage
export type WorkflowConfig = {
  autoApproveThreshold?: number; // Amount below which auto-approval is enabled
  requireReceiptAbove?: number; // Amount above which receipt is required
  approvalLevels?: {
    amount: number;
    approverRoles: string[];
  }[];
  slaDurations?: {
    approval?: number; // hours
    disbursement?: number; // hours
    receiptCapture?: number; // hours
    reconciliation?: number; // hours
    glPosting?: number; // hours
  };
  escalationRules?: {
    afterHours: number;
    escalateTo: string; // user ID or role
  }[];
  reminderSchedule?: {
    firstReminder: number; // hours after due
    subsequentReminders: number; // hours between reminders
    maxReminders: number;
  };
};

// =============================================================================
// Contact Sync - Odoo contacts synced to mobile devices
// =============================================================================

// Contact sync status types
export type ContactSyncStatus = "synced" | "pending" | "conflict" | "error";

// Conflict resolution types for contacts
export type ContactConflictResolution = "client_wins" | "server_wins" | "merge" | "manual";

// Synced Contact table - Stores contacts synced from Odoo
export const syncedContact = pgTable(
  "synced_contact",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Odoo reference
    odooPartnerId: integer("odoo_partner_id").notNull(),

    // Contact basic info
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    mobile: text("mobile"),
    website: text("website"),

    // Address info
    street: text("street"),
    street2: text("street2"),
    city: text("city"),
    stateId: integer("state_id"),
    stateName: text("state_name"),
    zip: text("zip"),
    countryId: integer("country_id"),
    countryName: text("country_name"),

    // Company/organization info
    isCompany: boolean("is_company").$default(() => false).notNull(),
    companyType: text("company_type"), // "company" | "person"
    parentId: integer("parent_id"), // Parent company Odoo ID
    parentName: text("parent_name"),
    jobTitle: text("job_title"), // function field in Odoo
    vat: text("vat"),
    ref: text("ref"),

    // Customer/Vendor flags
    isCustomer: boolean("is_customer").$default(() => false).notNull(),
    isVendor: boolean("is_vendor").$default(() => false).notNull(),

    // Sync tracking
    syncStatus: text("sync_status").$default(() => "synced").notNull(),
    lastSyncedAt: timestamp("last_synced_at")
      .$defaultFn(() => new Date())
      .notNull(),
    odooWriteDate: timestamp("odoo_write_date"), // write_date from Odoo for change detection
    localVersion: integer("local_version").$default(() => 1).notNull(),
    serverVersion: integer("server_version").$default(() => 1).notNull(),

    // Conflict tracking
    hasConflict: boolean("has_conflict").$default(() => false).notNull(),
    conflictData: text("conflict_data"), // JSON: stores both versions if conflict exists

    // Full contact data stored as JSON for offline access
    fullContactData: text("full_contact_data"), // JSON: complete partner data from Odoo

    // Local changes pending sync (JSON)
    pendingChanges: text("pending_changes"), // JSON: fields modified locally

    // Favorites and categories
    isFavorite: boolean("is_favorite").$default(() => false).notNull(),
    tags: text("tags"), // JSON array of tag IDs/names

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_synced_contact_user_id").on(table.userId),
    index("idx_synced_contact_odoo_partner_id").on(table.odooPartnerId),
    index("idx_synced_contact_user_odoo").on(table.userId, table.odooPartnerId),
    index("idx_synced_contact_sync_status").on(table.syncStatus),
    index("idx_synced_contact_is_customer").on(table.isCustomer),
    index("idx_synced_contact_is_vendor").on(table.isVendor),
    index("idx_synced_contact_has_conflict").on(table.hasConflict),
    index("idx_synced_contact_name").on(table.name),
    index("idx_synced_contact_updated_at").on(table.updatedAt),
  ]
);

// Contact Sync Log table - Tracks sync operations history
export const contactSyncLog = pgTable(
  "contact_sync_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Sync operation type
    operationType: text("operation_type").notNull(), // "full_sync" | "incremental" | "push" | "pull" | "conflict_resolution"

    // Sync timing
    startedAt: timestamp("started_at")
      .$defaultFn(() => new Date())
      .notNull(),
    completedAt: timestamp("completed_at"),

    // Sync results
    status: text("status").$default(() => "in_progress").notNull(), // "in_progress" | "completed" | "failed"
    contactsSynced: integer("contacts_synced").$default(() => 0).notNull(),
    contactsCreated: integer("contacts_created").$default(() => 0).notNull(),
    contactsUpdated: integer("contacts_updated").$default(() => 0).notNull(),
    contactsDeleted: integer("contacts_deleted").$default(() => 0).notNull(),
    conflictsDetected: integer("conflicts_detected").$default(() => 0).notNull(),
    conflictsResolved: integer("conflicts_resolved").$default(() => 0).notNull(),

    // Error tracking
    errorMessage: text("error_message"),
    errorDetails: text("error_details"), // JSON: detailed error info

    // Sync metadata
    syncMetadata: text("sync_metadata"), // JSON: additional sync info (device, network, etc.)
  },
  (table) => [
    index("idx_contact_sync_log_user_id").on(table.userId),
    index("idx_contact_sync_log_status").on(table.status),
    index("idx_contact_sync_log_started_at").on(table.startedAt),
    index("idx_contact_sync_log_operation_type").on(table.operationType),
  ]
);

// Contact Sync State table - Tracks user's sync state
export const contactSyncState = pgTable(
  "contact_sync_state",
  {
    id: text("id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),

    // Last successful sync
    lastFullSyncAt: timestamp("last_full_sync_at"),
    lastIncrementalSyncAt: timestamp("last_incremental_sync_at"),
    lastSyncToken: text("last_sync_token"), // For cursor-based pagination

    // Sync preferences
    autoSyncEnabled: boolean("auto_sync_enabled").$default(() => true).notNull(),
    syncIntervalMinutes: integer("sync_interval_minutes").$default(() => 15).notNull(),
    syncOnWifiOnly: boolean("sync_on_wifi_only").$default(() => false).notNull(),

    // Filter preferences
    syncCustomers: boolean("sync_customers").$default(() => true).notNull(),
    syncVendors: boolean("sync_vendors").$default(() => true).notNull(),
    syncCompaniesOnly: boolean("sync_companies_only").$default(() => false).notNull(),

    // Stats
    totalContactsSynced: integer("total_contacts_synced").$default(() => 0).notNull(),
    pendingConflicts: integer("pending_conflicts").$default(() => 0).notNull(),
    pendingChanges: integer("pending_changes").$default(() => 0).notNull(),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [index("idx_contact_sync_state_id").on(table.id)]
);

// Contact Sync Relations
export const syncedContactRelations = relations(syncedContact, ({ one }) => ({
  user: one(user, {
    fields: [syncedContact.userId],
    references: [user.id],
  }),
}));

export const contactSyncLogRelations = relations(contactSyncLog, ({ one }) => ({
  user: one(user, {
    fields: [contactSyncLog.userId],
    references: [user.id],
  }),
}));

export const contactSyncStateRelations = relations(contactSyncState, ({ one }) => ({
  user: one(user, {
    fields: [contactSyncState.id],
    references: [user.id],
  }),
}));

// Update user relations to include contact sync
export const userContactSyncRelations = relations(user, ({ many, one }) => ({
  syncedContacts: many(syncedContact),
  contactSyncLogs: many(contactSyncLog),
  contactSyncState: one(contactSyncState, {
    fields: [user.id],
    references: [contactSyncState.id],
  }),
}));

// Contact Sync type exports
export type SyncedContact = typeof syncedContact.$inferSelect;
export type CreateSyncedContactData = typeof syncedContact.$inferInsert;
export type UpdateSyncedContactData = Partial<
  Omit<CreateSyncedContactData, "id" | "createdAt" | "userId" | "odooPartnerId">
>;

export type ContactSyncLog = typeof contactSyncLog.$inferSelect;
export type CreateContactSyncLogData = typeof contactSyncLog.$inferInsert;

export type ContactSyncState = typeof contactSyncState.$inferSelect;
export type CreateContactSyncStateData = typeof contactSyncState.$inferInsert;
export type UpdateContactSyncStateData = Partial<
  Omit<CreateContactSyncStateData, "id" | "createdAt">
>;

// Contact conflict data type for JSON storage
export type ContactConflictData = {
  clientVersion: {
    data: Partial<SyncedContact>;
    modifiedAt: string;
    modifiedFields: string[];
  };
  serverVersion: {
    data: Partial<SyncedContact>;
    modifiedAt: string;
  };
  conflictFields: string[];
  detectedAt: string;
};

// Full contact data type for JSON storage (matches Odoo structure)
export type FullOdooContactData = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  website: string | null;
  street: string | null;
  street2: string | null;
  city: string | null;
  state_id: [number, string] | null;
  zip: string | null;
  country_id: [number, string] | null;
  is_company: boolean;
  company_type: string | null;
  parent_id: [number, string] | null;
  child_ids: number[];
  function: string | null;
  vat: string | null;
  ref: string | null;
  lang: string | null;
  tz: string | null;
  customer_rank: number;
  supplier_rank: number;
  create_date: string;
  write_date: string;
  active: boolean;
  comment: string | null;
  credit_limit: number | null;
  title: [number, string] | null;
  category_id: number[];
  user_id: [number, string] | null;
  industry_id: [number, string] | null;
};

// =============================================================================
// Phone Onboarding - OTP verification and SIP credential provisioning
// =============================================================================

// Phone verification status types
export type PhoneVerificationStatus = "pending" | "verified" | "expired" | "failed";

// SIP credential status types
export type SipCredentialStatus = "active" | "suspended" | "revoked";

// Phone Verification table - Stores OTP codes for phone verification
export const phoneVerification = pgTable(
  "phone_verification",
  {
    id: text("id").primaryKey(),

    // Phone number to verify (E.164 format)
    phoneNumber: text("phone_number").notNull(),

    // OTP code (6 digits)
    otpCode: text("otp_code").notNull(),

    // Optional user link (for linking to existing account)
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" }),

    // Verification status
    status: text("status").$default(() => "pending").notNull(),

    // Attempt tracking
    attemptCount: integer("attempt_count").$default(() => 0).notNull(),
    maxAttempts: integer("max_attempts").$default(() => 3).notNull(),

    // Expiration (OTP typically expires in 5-10 minutes)
    expiresAt: timestamp("expires_at").notNull(),

    // Verification timestamp
    verifiedAt: timestamp("verified_at"),

    // Device info for security tracking
    deviceId: text("device_id"),
    devicePlatform: text("device_platform"), // "ios" | "android" | "web"
    ipAddress: text("ip_address"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_phone_verification_phone_number").on(table.phoneNumber),
    index("idx_phone_verification_user_id").on(table.userId),
    index("idx_phone_verification_status").on(table.status),
    index("idx_phone_verification_expires_at").on(table.expiresAt),
    index("idx_phone_verification_created_at").on(table.createdAt),
  ]
);

// SIP Credentials table - Stores SIP credentials for VoIP functionality
export const sipCredential = pgTable(
  "sip_credential",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // SIP account details
    sipUsername: text("sip_username").notNull().unique(),
    sipPassword: text("sip_password").notNull(), // Encrypted/hashed
    sipDomain: text("sip_domain").notNull(), // SIP server domain
    sipUri: text("sip_uri").notNull(), // Full SIP URI (e.g., sip:user@domain.com)

    // Associated phone number (E.164 format)
    phoneNumber: text("phone_number").notNull(),

    // Display name for caller ID
    displayName: text("display_name"),

    // Status
    status: text("status").$default(() => "active").notNull(),

    // Transport preferences
    transportProtocol: text("transport_protocol").$default(() => "TLS").notNull(), // UDP, TCP, TLS

    // Registration info
    registrationExpiresSeconds: integer("registration_expires_seconds").$default(() => 3600).notNull(),

    // Codec preferences stored as JSON array
    // Format: ["OPUS", "G722", "PCMU", "PCMA"]
    codecPreferences: text("codec_preferences").$default(() => '["OPUS", "G722", "PCMU"]').notNull(),

    // STUN/TURN server configuration as JSON
    stunTurnConfig: text("stun_turn_config"),

    // Device associations (JSON array of device IDs)
    associatedDevices: text("associated_devices"),

    // Provisioning info
    provisionedAt: timestamp("provisioned_at")
      .$defaultFn(() => new Date())
      .notNull(),
    provisionedBy: text("provisioned_by"), // System or admin user ID

    // Last registration tracking
    lastRegistrationAt: timestamp("last_registration_at"),
    lastRegistrationIp: text("last_registration_ip"),
    lastRegistrationUserAgent: text("last_registration_user_agent"),

    // Suspension/revocation tracking
    suspendedAt: timestamp("suspended_at"),
    suspendedReason: text("suspended_reason"),
    revokedAt: timestamp("revoked_at"),
    revokedReason: text("revoked_reason"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_sip_credential_user_id").on(table.userId),
    index("idx_sip_credential_sip_username").on(table.sipUsername),
    index("idx_sip_credential_phone_number").on(table.phoneNumber),
    index("idx_sip_credential_status").on(table.status),
    index("idx_sip_credential_created_at").on(table.createdAt),
  ]
);

// Onboarding Session table - Tracks multi-step onboarding flow state
export const onboardingSession = pgTable(
  "onboarding_session",
  {
    id: text("id").primaryKey(),

    // Optional user link (can start before user exists)
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" }),

    // Current step in the flow
    currentStep: text("current_step").$default(() => "phone_input").notNull(),
    // Steps: phone_input -> otp_verification -> account_link -> sip_provisioning -> complete

    // Phone number being verified
    phoneNumber: text("phone_number"),

    // Reference to phone verification
    phoneVerificationId: text("phone_verification_id")
      .references(() => phoneVerification.id, { onDelete: "set null" }),

    // Reference to SIP credential (created at end)
    sipCredentialId: text("sip_credential_id")
      .references(() => sipCredential.id, { onDelete: "set null" }),

    // Device info
    deviceId: text("device_id"),
    devicePlatform: text("device_platform"),
    deviceName: text("device_name"),

    // Session state data stored as JSON
    sessionData: text("session_data"),

    // Completion status
    isCompleted: boolean("is_completed").$default(() => false).notNull(),
    completedAt: timestamp("completed_at"),

    // Expiration (session should expire after inactivity)
    expiresAt: timestamp("expires_at").notNull(),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_onboarding_session_user_id").on(table.userId),
    index("idx_onboarding_session_phone_number").on(table.phoneNumber),
    index("idx_onboarding_session_device_id").on(table.deviceId),
    index("idx_onboarding_session_current_step").on(table.currentStep),
    index("idx_onboarding_session_is_completed").on(table.isCompleted),
    index("idx_onboarding_session_expires_at").on(table.expiresAt),
  ]
);

// Phone Onboarding Relations
export const phoneVerificationRelations = relations(phoneVerification, ({ one }) => ({
  user: one(user, {
    fields: [phoneVerification.userId],
    references: [user.id],
  }),
}));

export const sipCredentialRelations = relations(sipCredential, ({ one }) => ({
  user: one(user, {
    fields: [sipCredential.userId],
    references: [user.id],
  }),
}));

export const onboardingSessionRelations = relations(onboardingSession, ({ one }) => ({
  user: one(user, {
    fields: [onboardingSession.userId],
    references: [user.id],
  }),
  phoneVerification: one(phoneVerification, {
    fields: [onboardingSession.phoneVerificationId],
    references: [phoneVerification.id],
  }),
  sipCredential: one(sipCredential, {
    fields: [onboardingSession.sipCredentialId],
    references: [sipCredential.id],
  }),
}));

// Update user relations to include phone onboarding
export const userPhoneOnboardingRelations = relations(user, ({ many }) => ({
  phoneVerifications: many(phoneVerification),
  sipCredentials: many(sipCredential),
  onboardingSessions: many(onboardingSession),
}));

// Phone Onboarding type exports
export type PhoneVerification = typeof phoneVerification.$inferSelect;
export type CreatePhoneVerificationData = typeof phoneVerification.$inferInsert;
export type UpdatePhoneVerificationData = Partial<
  Omit<CreatePhoneVerificationData, "id" | "createdAt" | "phoneNumber">
>;

export type SipCredential = typeof sipCredential.$inferSelect;
export type CreateSipCredentialData = typeof sipCredential.$inferInsert;
export type UpdateSipCredentialData = Partial<
  Omit<CreateSipCredentialData, "id" | "createdAt" | "userId" | "sipUsername">
>;

export type OnboardingSession = typeof onboardingSession.$inferSelect;
export type CreateOnboardingSessionData = typeof onboardingSession.$inferInsert;
export type UpdateOnboardingSessionData = Partial<
  Omit<CreateOnboardingSessionData, "id" | "createdAt">
>;

// Onboarding step types
export type OnboardingStep =
  | "phone_input"
  | "otp_verification"
  | "account_link"
  | "sip_provisioning"
  | "complete";

// STUN/TURN config type for JSON storage
export type StunTurnConfig = {
  stunServers: string[];
  turnServers?: {
    url: string;
    username: string;
    credential: string;
  }[];
};

// =============================================================================
// Reloadly - Mobile Airtime & Data Top-ups
// =============================================================================

// Transaction status types for Reloadly top-ups
export type ReloadlyTransactionStatusType =
  | "pending"
  | "processing"
  | "successful"
  | "failed"
  | "refunded";

// Reloadly Transaction table - Stores all top-up transactions
export const reloadlyTransaction = pgTable(
  "reloadly_transaction",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Reloadly's transaction ID (external reference)
    reloadlyTransactionId: text("reloadly_transaction_id"),

    // Custom identifier for tracking (used for idempotency)
    customIdentifier: text("custom_identifier").unique(),

    // Operator details
    operatorId: integer("operator_id").notNull(),
    operatorName: text("operator_name").notNull(),

    // Country and currency info
    countryCode: text("country_code").notNull(),

    // Recipient phone number
    recipientPhone: text("recipient_phone").notNull(),
    recipientCountryCode: text("recipient_country_code").notNull(),

    // Sender phone (optional)
    senderPhone: text("sender_phone"),
    senderCountryCode: text("sender_country_code"),

    // Amount details
    requestedAmount: text("requested_amount").notNull(), // In sender currency
    requestedAmountCurrency: text("requested_amount_currency").notNull(),
    deliveredAmount: text("delivered_amount"), // In recipient currency
    deliveredAmountCurrency: text("delivered_amount_currency"),

    // Whether local amount was used
    useLocalAmount: boolean("use_local_amount").$default(() => false).notNull(),

    // Discount info
    discount: text("discount"),
    discountCurrency: text("discount_currency"),

    // Transaction status
    status: text("status").$default(() => "pending").notNull(),

    // Error details (if failed)
    errorCode: text("error_code"),
    errorMessage: text("error_message"),

    // PIN details (for PIN-based operators) - stored as JSON
    pinDetails: text("pin_details"), // JSON: { serial, code, info1, info2, info3, ivr, validity }

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("idx_reloadly_transaction_user_id").on(table.userId),
    index("idx_reloadly_transaction_reloadly_id").on(table.reloadlyTransactionId),
    index("idx_reloadly_transaction_custom_id").on(table.customIdentifier),
    index("idx_reloadly_transaction_status").on(table.status),
    index("idx_reloadly_transaction_recipient_phone").on(table.recipientPhone),
    index("idx_reloadly_transaction_created_at").on(table.createdAt),
    index("idx_reloadly_transaction_user_status").on(table.userId, table.status),
  ]
);

// Reloadly Operator Cache table - Caches operator data for faster lookups
export const reloadlyOperatorCache = pgTable(
  "reloadly_operator_cache",
  {
    id: text("id").primaryKey(),

    // Operator ID from Reloadly
    operatorId: integer("operator_id").notNull().unique(),

    // Operator details
    name: text("name").notNull(),
    countryCode: text("country_code").notNull(),
    countryName: text("country_name").notNull(),

    // Type flags
    bundle: boolean("bundle").$default(() => false).notNull(),
    data: boolean("data").$default(() => false).notNull(),
    pin: boolean("pin").$default(() => false).notNull(),

    // Amount type
    denominationType: text("denomination_type").notNull(), // FIXED or RANGE

    // Currency info
    senderCurrencyCode: text("sender_currency_code").notNull(),
    destinationCurrencyCode: text("destination_currency_code").notNull(),

    // Amount ranges (for RANGE type)
    minAmount: text("min_amount"),
    maxAmount: text("max_amount"),
    localMinAmount: text("local_min_amount"),
    localMaxAmount: text("local_max_amount"),

    // Fixed amounts (stored as JSON array)
    fixedAmounts: text("fixed_amounts"), // JSON: number[]
    localFixedAmounts: text("local_fixed_amounts"), // JSON: number[]

    // FX rate info
    fxRate: text("fx_rate"),

    // Commission and discount
    commission: text("commission"),
    internationalDiscount: text("international_discount"),

    // Logo URLs (JSON array)
    logoUrls: text("logo_urls"), // JSON: string[]

    // Full operator data (JSON for flexibility)
    fullData: text("full_data"), // JSON: complete operator object

    // Cache metadata
    lastUpdatedAt: timestamp("last_updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [
    index("idx_reloadly_operator_cache_operator_id").on(table.operatorId),
    index("idx_reloadly_operator_cache_country_code").on(table.countryCode),
    index("idx_reloadly_operator_cache_expires_at").on(table.expiresAt),
    index("idx_reloadly_operator_cache_name").on(table.name),
  ]
);

// Reloadly Transaction Relations
export const reloadlyTransactionRelations = relations(reloadlyTransaction, ({ one }) => ({
  user: one(user, {
    fields: [reloadlyTransaction.userId],
    references: [user.id],
  }),
}));

// Update user relations to include Reloadly transactions
export const userReloadlyRelations = relations(user, ({ many }) => ({
  reloadlyTransactions: many(reloadlyTransaction),
}));

// Reloadly Transaction type exports
export type ReloadlyTransaction = typeof reloadlyTransaction.$inferSelect;
export type CreateReloadlyTransactionData = typeof reloadlyTransaction.$inferInsert;
export type UpdateReloadlyTransactionData = Partial<
  Omit<CreateReloadlyTransactionData, "id" | "createdAt" | "userId">
>;

export type ReloadlyOperatorCache = typeof reloadlyOperatorCache.$inferSelect;
export type CreateReloadlyOperatorCacheData = typeof reloadlyOperatorCache.$inferInsert;
export type UpdateReloadlyOperatorCacheData = Partial<
  Omit<CreateReloadlyOperatorCacheData, "id" | "operatorId">
>;

// ============================================
// Dashboard Configuration Tables
// ============================================

/**
 * Dashboard Layout Configuration
 * Stores user-specific and role-based default dashboard configurations
 *
 * This table supports:
 * - Role-based default layouts (widgets, positions, settings)
 * - User-specific customizations that override role defaults
 * - Data source mappings for each widget
 */
export const dashboardConfig = pgTable(
  "dashboard_config",
  {
    id: text("id").primaryKey(),

    // Either userId (for user-specific config) or role (for role-based defaults)
    // If userId is set, this is a user-specific override
    // If role is set and userId is null, this is a role-based default
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    role: text("role"), // UserRole: "md" | "field-tech" | "admin" | "sales"

    // Configuration name for identification
    name: text("name").notNull(),
    description: text("description"),

    // Widget instances configuration (JSON array of WidgetInstance objects)
    // Structure: [{ instanceId, widgetId, size, position, config, visible, title? }]
    widgets: text("widgets").notNull(), // JSON string

    // Layout configuration (grid settings, breakpoints, etc.)
    // Structure: { columns, gap, responsive: { sm, md, lg, xl } }
    layoutConfig: text("layout_config"), // JSON string

    // Data source mappings for widgets
    // Structure: { [widgetInstanceId]: { sourceType, sourceId, refreshInterval?, filters? } }
    dataSources: text("data_sources"), // JSON string

    // Allowed widgets for this role (widget IDs that can be added)
    // If null, all widgets are allowed
    allowedWidgets: text("allowed_widgets"), // JSON array of widget IDs

    // Whether this is the default configuration for the role
    isDefault: boolean("is_default").$default(() => false).notNull(),

    // Whether the user has customized from the role default
    isCustomized: boolean("is_customized").$default(() => false).notNull(),

    // Ordering for multiple configs per user/role
    displayOrder: integer("display_order").$default(() => 0).notNull(),

    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_dashboard_config_user_id").on(table.userId),
    index("idx_dashboard_config_role").on(table.role),
    index("idx_dashboard_config_is_default").on(table.isDefault),
    index("idx_dashboard_config_user_role").on(table.userId, table.role),
  ]
);

// Dashboard Config Relations
export const dashboardConfigRelations = relations(dashboardConfig, ({ one }) => ({
  user: one(user, {
    fields: [dashboardConfig.userId],
    references: [user.id],
  }),
}));

// Dashboard Config type exports
export type DashboardConfig = typeof dashboardConfig.$inferSelect;
export type CreateDashboardConfigData = typeof dashboardConfig.$inferInsert;
export type UpdateDashboardConfigData = Partial<
  Omit<CreateDashboardConfigData, "id" | "createdAt">
>;

// =============================================================================
// Direct Messaging - Internal conversation and message system
// =============================================================================

// Conversation table - Direct message conversations between two users
export const conversation = pgTable(
  "conversation",
  {
    id: text("id").primaryKey(),

    // Participants (two-way direct messaging)
    participant1Id: text("participant1_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    participant2Id: text("participant2_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Timestamps
    lastMessageAt: timestamp("last_message_at"),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_conversation_participant1_id").on(table.participant1Id),
    index("idx_conversation_participant2_id").on(table.participant2Id),
    index("idx_conversation_last_message_at").on(table.lastMessageAt),
    index("idx_conversation_participants").on(table.participant1Id, table.participant2Id),
  ]
);

// Message table - Individual messages within a conversation
export const message = pgTable(
  "message",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),

    // Message content
    senderId: text("sender_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),

    // Read status
    isRead: boolean("is_read")
      .$default(() => false)
      .notNull(),
    readAt: timestamp("read_at"),

    // Timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_message_conversation_id").on(table.conversationId),
    index("idx_message_sender_id").on(table.senderId),
    index("idx_message_created_at").on(table.createdAt),
    index("idx_message_is_read").on(table.isRead),
    index("idx_message_conversation_created").on(table.conversationId, table.createdAt),
  ]
);

// Direct Messaging Relations
export const conversationRelations = relations(conversation, ({ one, many }) => ({
  participant1: one(user, {
    fields: [conversation.participant1Id],
    references: [user.id],
    relationName: "conversationParticipant1",
  }),
  participant2: one(user, {
    fields: [conversation.participant2Id],
    references: [user.id],
    relationName: "conversationParticipant2",
  }),
  messages: many(message),
}));

export const messageRelations = relations(message, ({ one }) => ({
  conversation: one(conversation, {
    fields: [message.conversationId],
    references: [conversation.id],
  }),
  sender: one(user, {
    fields: [message.senderId],
    references: [user.id],
  }),
}));

// Update user relations to include direct messaging
export const userDirectMessageRelations = relations(user, ({ many }) => ({
  conversationsAsParticipant1: many(conversation, {
    relationName: "conversationParticipant1",
  }),
  conversationsAsParticipant2: many(conversation, {
    relationName: "conversationParticipant2",
  }),
  sentMessages: many(message),
}));

// Direct Messaging type exports
export type Conversation = typeof conversation.$inferSelect;
export type CreateConversationData = typeof conversation.$inferInsert;
export type UpdateConversationData = Partial<
  Omit<CreateConversationData, "id" | "createdAt">
>;

export type Message = typeof message.$inferSelect;
export type CreateMessageData = typeof message.$inferInsert;
export type UpdateMessageData = Partial<
  Omit<CreateMessageData, "id" | "createdAt" | "conversationId" | "senderId">
>;

// =============================================================================
// Unified Inbox - Aggregates messages from all sources
// =============================================================================

// Source types for unified inbox messages
export type UnifiedInboxSourceType =
  | "direct_message"    // Internal direct messages
  | "odoo_discuss"      // Odoo Discuss channels
  | "system_notification" // System notifications
  | "push_notification"; // Push notifications

// Thread status for unified inbox
export type UnifiedInboxThreadStatus = "active" | "archived" | "muted";

// Unified Inbox Thread table - Groups messages by source for thread view
export const unifiedInboxThread = pgTable(
  "unified_inbox_thread",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Source identification
    sourceType: text("source_type").notNull(), // UnifiedInboxSourceType
    sourceId: text("source_id").notNull(), // ID in the source table (conversation.id, odooChannel.id, etc.)

    // Thread metadata (cached for performance)
    title: text("title").notNull(), // Display title (participant name, channel name, notification type)
    subtitle: text("subtitle"), // Secondary info (last message preview, etc.)
    avatarUrl: text("avatar_url"), // Avatar/image URL for the thread

    // Status and read tracking
    status: text("status").$default(() => "active").notNull(), // UnifiedInboxThreadStatus
    unreadCount: integer("unread_count").$default(() => 0).notNull(),
    lastMessageAt: timestamp("last_message_at"),
    lastMessagePreview: text("last_message_preview"), // Truncated last message content

    // User preferences for this thread
    isPinned: boolean("is_pinned").$default(() => false).notNull(),
    isMuted: boolean("is_muted").$default(() => false).notNull(),

    // Priority scoring (AI-powered)
    priorityScore: real("priority_score").$default(() => 0), // 0-100 importance score
    priorityLevel: text("priority_level").$default(() => "normal"), // "critical" | "high" | "normal" | "low"
    priorityFactors: jsonb("priority_factors").$type<PriorityFactors>(), // JSON object with scoring factors breakdown
    priorityReason: text("priority_reason"), // Human-readable explanation of priority
    scoredAt: timestamp("scored_at"), // When the score was last calculated
    isHighPriority: boolean("is_high_priority").$default(() => false).notNull(), // Computed flag for UI filtering

    // Sync tracking
    lastSyncedAt: timestamp("last_synced_at")
      .$defaultFn(() => new Date())
      .notNull(),

    // Timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_unified_inbox_thread_user_id").on(table.userId),
    index("idx_unified_inbox_thread_source").on(table.sourceType, table.sourceId),
    index("idx_unified_inbox_thread_user_source").on(table.userId, table.sourceType),
    index("idx_unified_inbox_thread_status").on(table.status),
    index("idx_unified_inbox_thread_last_message").on(table.lastMessageAt),
    index("idx_unified_inbox_thread_user_pinned").on(table.userId, table.isPinned),
    index("idx_unified_inbox_thread_unread").on(table.userId, table.unreadCount),
    index("idx_unified_inbox_thread_priority").on(table.userId, table.priorityScore),
    index("idx_unified_inbox_thread_high_priority").on(table.userId, table.isHighPriority),
  ]
);

// Unified Inbox Relations
export const unifiedInboxThreadRelations = relations(unifiedInboxThread, ({ one }) => ({
  user: one(user, {
    fields: [unifiedInboxThread.userId],
    references: [user.id],
  }),
}));

// Update user relations to include unified inbox
export const userUnifiedInboxRelations = relations(user, ({ many }) => ({
  unifiedInboxThreads: many(unifiedInboxThread),
}));

// Unified Inbox type exports
export type UnifiedInboxThread = typeof unifiedInboxThread.$inferSelect;
export type CreateUnifiedInboxThreadData = typeof unifiedInboxThread.$inferInsert;
export type UpdateUnifiedInboxThreadData = Partial<
  Omit<CreateUnifiedInboxThreadData, "id" | "createdAt" | "userId">
>;

// Priority level types for unified inbox
export type PriorityLevel = "critical" | "high" | "normal" | "low";

// Priority factors breakdown (what contributed to the score)
export type PriorityFactors = {
  senderImportance: number; // 0-100: Based on sender role, frequency, relationship
  contentUrgency: number; // 0-100: Urgency keywords, action items, deadlines
  keywordRelevance: number; // 0-100: Keywords matching user preferences/patterns
  contextRelevance: number; // 0-100: Time sensitivity, response expectations
  overallScore: number; // 0-100: Weighted average of all factors
  keywords: string[]; // Keywords that triggered priority boost
  reasoning: string; // AI-generated explanation
};

// =============================================================================
// Unified Inbox Types - TypeScript types for aggregated message handling
// =============================================================================

/**
 * Represents a single message from any source in the unified inbox.
 * This is a union type that aggregates messages from different sources.
 */
export type UnifiedInboxMessage = {
  id: string;
  threadId: string; // Reference to UnifiedInboxThread
  sourceType: UnifiedInboxSourceType;
  sourceMessageId: string; // ID in the original source table

  // Content
  content: string;
  contentHtml?: string; // HTML content for rich text (Odoo messages)

  // Author info
  authorId: string;
  authorName: string;
  authorEmail?: string;
  authorAvatarUrl?: string;
  isOwnMessage: boolean; // Whether the current user sent this message

  // Status
  isRead: boolean;
  readAt?: Date;

  // Attachments (JSON-serialized array)
  attachments?: UnifiedInboxAttachment[];
  hasAttachments: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt?: Date;
};

/**
 * Attachment type for unified inbox messages
 */
export type UnifiedInboxAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
};

/**
 * Thread with messages for the unified inbox view
 */
export type UnifiedInboxThreadWithMessages = UnifiedInboxThread & {
  messages: UnifiedInboxMessage[];
  participant?: {
    id: string;
    name: string;
    image?: string | null;
  };
};

/**
 * Summary of unified inbox for dashboard widgets
 */
export type UnifiedInboxSummary = {
  totalUnreadCount: number;
  directMessageUnreadCount: number;
  odooDiscussUnreadCount: number;
  notificationUnreadCount: number;
  recentThreads: {
    id: string;
    sourceType: UnifiedInboxSourceType;
    title: string;
    unreadCount: number;
    lastMessagePreview?: string;
    lastMessageAt?: Date;
  }[];
};

/**
 * Filter options for unified inbox queries
 */
export type UnifiedInboxFilter = {
  sourceTypes?: UnifiedInboxSourceType[];
  status?: UnifiedInboxThreadStatus[];
  unreadOnly?: boolean;
  pinnedOnly?: boolean;
  searchQuery?: string;
  limit?: number;
  offset?: number;
};

// =============================================================================
// User Wallet - Wallet accounts with balance, currency, and KYC verification
// =============================================================================

// Wallet Status types
export type WalletStatus = "active" | "frozen" | "suspended" | "closed";

// KYC Level types (tiered verification levels)
export type KycLevel = "none" | "basic" | "intermediate" | "advanced";

// Wallet Transaction types
export type WalletTransactionType =
  | "deposit"
  | "withdrawal"
  | "transfer_in"
  | "transfer_out"
  | "expense_disbursement"
  | "expense_refund"
  | "airtime_purchase"
  | "adjustment"
  | "fee"
  | "reversal";

// Wallet Transaction Status types
export type WalletTransactionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "reversed"
  | "cancelled";

// Audit Action types
export type WalletAuditAction =
  | "wallet_created"
  | "wallet_activated"
  | "wallet_frozen"
  | "wallet_unfrozen"
  | "wallet_suspended"
  | "wallet_closed"
  | "balance_updated"
  | "kyc_submitted"
  | "kyc_approved"
  | "kyc_rejected"
  | "kyc_expired"
  | "transaction_created"
  | "transaction_completed"
  | "transaction_failed"
  | "transaction_reversed"
  | "limit_updated"
  | "currency_changed"
  | "settings_updated";

// User Wallet table - Main wallet account for users
export const userWallet = pgTable(
  "user_wallet",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
      .unique(), // One wallet per user

    // Balance stored as text to preserve decimal precision (e.g., "1234.56")
    balance: text("balance")
      .$default(() => "0.00")
      .notNull(),

    // Available balance (balance minus pending transactions)
    availableBalance: text("available_balance")
      .$default(() => "0.00")
      .notNull(),

    // Pending balance (sum of pending incoming transactions)
    pendingBalance: text("pending_balance")
      .$default(() => "0.00")
      .notNull(),

    // Currency (ISO 4217 code)
    currency: text("currency")
      .$default(() => "USD")
      .notNull(),

    // Wallet status
    status: text("status")
      .$default(() => "active")
      .notNull(),

    // KYC Verification
    kycStatus: text("kyc_status")
      .$default(() => "not_started")
      .notNull(),
    kycLevel: text("kyc_level")
      .$default(() => "none")
      .notNull(),
    kycSubmittedAt: timestamp("kyc_submitted_at"),
    kycApprovedAt: timestamp("kyc_approved_at"),
    kycExpiresAt: timestamp("kyc_expires_at"),
    kycDocuments: text("kyc_documents"), // JSON: Array of document references

    // Transaction limits based on KYC level (stored as text for precision)
    dailyTransactionLimit: text("daily_transaction_limit"),
    monthlyTransactionLimit: text("monthly_transaction_limit"),
    singleTransactionLimit: text("single_transaction_limit"),

    // Running totals for limit tracking
    dailyTransactionTotal: text("daily_transaction_total")
      .$default(() => "0.00")
      .notNull(),
    monthlyTransactionTotal: text("monthly_transaction_total")
      .$default(() => "0.00")
      .notNull(),
    lastLimitResetDate: timestamp("last_limit_reset_date"),

    // Wallet settings (JSON for flexibility)
    settings: text("settings"), // JSON: { notifications, defaultPaymentMethod, etc. }

    // Status change tracking
    statusChangedAt: timestamp("status_changed_at"),
    statusChangeReason: text("status_change_reason"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_user_wallet_user_id").on(table.userId),
    index("idx_user_wallet_status").on(table.status),
    index("idx_user_wallet_kyc_status").on(table.kycStatus),
    index("idx_user_wallet_currency").on(table.currency),
  ]
);

// Wallet Transaction table - Transaction ledger for audit trail
export const walletTransaction = pgTable(
  "wallet_transaction",
  {
    id: text("id").primaryKey(),
    walletId: text("wallet_id")
      .notNull()
      .references(() => userWallet.id, { onDelete: "cascade" }),

    // Transaction type and status
    type: text("type").notNull(),
    status: text("status")
      .$default(() => "pending")
      .notNull(),

    // Amount details (stored as text for precision)
    amount: text("amount").notNull(),
    currency: text("currency").notNull(),

    // Fee information
    fee: text("fee").$default(() => "0.00").notNull(),
    feeCurrency: text("fee_currency"),

    // Net amount after fees
    netAmount: text("net_amount").notNull(),

    // Balance snapshots for reconciliation
    balanceBefore: text("balance_before").notNull(),
    balanceAfter: text("balance_after").notNull(),

    // Description and reference
    description: text("description"),
    reference: text("reference"), // External reference number

    // Idempotency key to prevent duplicate transactions
    idempotencyKey: text("idempotency_key").unique(),

    // Related entity references (for linking to other transactions)
    relatedExpenseRequestId: text("related_expense_request_id")
      .references(() => expenseRequest.id, { onDelete: "set null" }),
    relatedExpenseVoucherId: text("related_expense_voucher_id")
      .references(() => expenseVoucher.id, { onDelete: "set null" }),
    relatedReloadlyTransactionId: text("related_reloadly_transaction_id")
      .references(() => reloadlyTransaction.id, { onDelete: "set null" }),

    // For transfer transactions - counterpart wallet
    counterpartWalletId: text("counterpart_wallet_id")
      .references(() => userWallet.id, { onDelete: "set null" }),
    counterpartTransactionId: text("counterpart_transaction_id"), // Link to the other side of transfer

    // Payment method details (JSON for flexibility)
    paymentMethod: text("payment_method"), // JSON: { type, provider, lastFour, etc. }

    // Metadata for additional context
    metadata: text("metadata"), // JSON: Additional transaction-specific data

    // Error handling
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    failedAt: timestamp("failed_at"),

    // Reversal tracking
    reversedAt: timestamp("reversed_at"),
    reversalReason: text("reversal_reason"),
    originalTransactionId: text("original_transaction_id"), // For reversal transactions

    // Processing timestamps
    initiatedAt: timestamp("initiated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    processedAt: timestamp("processed_at"),
    completedAt: timestamp("completed_at"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_wallet_transaction_wallet_id").on(table.walletId),
    index("idx_wallet_transaction_type").on(table.type),
    index("idx_wallet_transaction_status").on(table.status),
    index("idx_wallet_transaction_created_at").on(table.createdAt),
    index("idx_wallet_transaction_reference").on(table.reference),
    index("idx_wallet_transaction_idempotency").on(table.idempotencyKey),
    index("idx_wallet_transaction_wallet_status").on(table.walletId, table.status),
    index("idx_wallet_transaction_wallet_created").on(table.walletId, table.createdAt),
    index("idx_wallet_transaction_expense_request").on(table.relatedExpenseRequestId),
    index("idx_wallet_transaction_expense_voucher").on(table.relatedExpenseVoucherId),
    index("idx_wallet_transaction_reloadly").on(table.relatedReloadlyTransactionId),
  ]
);

// Wallet Audit Log table - Comprehensive audit trail for all wallet changes
export const walletAuditLog = pgTable(
  "wallet_audit_log",
  {
    id: text("id").primaryKey(),
    walletId: text("wallet_id")
      .notNull()
      .references(() => userWallet.id, { onDelete: "cascade" }),

    // Action performed
    action: text("action").notNull(),

    // Actor who performed the action
    actorId: text("actor_id")
      .references(() => user.id, { onDelete: "set null" }),
    actorType: text("actor_type").notNull(), // "user" | "system" | "admin" | "api"

    // IP address and user agent for security tracking
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    // Related transaction (if applicable)
    transactionId: text("transaction_id")
      .references(() => walletTransaction.id, { onDelete: "set null" }),

    // Change details
    previousValue: text("previous_value"), // JSON: Previous state
    newValue: text("new_value"), // JSON: New state
    changeDescription: text("change_description"),

    // Additional context
    metadata: text("metadata"), // JSON: Additional audit context

    // Timestamp
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_wallet_audit_log_wallet_id").on(table.walletId),
    index("idx_wallet_audit_log_action").on(table.action),
    index("idx_wallet_audit_log_actor_id").on(table.actorId),
    index("idx_wallet_audit_log_created_at").on(table.createdAt),
    index("idx_wallet_audit_log_transaction_id").on(table.transactionId),
    index("idx_wallet_audit_log_wallet_created").on(table.walletId, table.createdAt),
  ]
);

// Wallet Relations
export const userWalletRelations = relations(userWallet, ({ one, many }) => ({
  user: one(user, {
    fields: [userWallet.userId],
    references: [user.id],
  }),
  transactions: many(walletTransaction),
  auditLogs: many(walletAuditLog),
}));

export const walletTransactionRelations = relations(walletTransaction, ({ one }) => ({
  wallet: one(userWallet, {
    fields: [walletTransaction.walletId],
    references: [userWallet.id],
  }),
  expenseRequest: one(expenseRequest, {
    fields: [walletTransaction.relatedExpenseRequestId],
    references: [expenseRequest.id],
  }),
  expenseVoucher: one(expenseVoucher, {
    fields: [walletTransaction.relatedExpenseVoucherId],
    references: [expenseVoucher.id],
  }),
  reloadlyTransaction: one(reloadlyTransaction, {
    fields: [walletTransaction.relatedReloadlyTransactionId],
    references: [reloadlyTransaction.id],
  }),
  counterpartWallet: one(userWallet, {
    fields: [walletTransaction.counterpartWalletId],
    references: [userWallet.id],
    relationName: "counterpartWallet",
  }),
}));

export const walletAuditLogRelations = relations(walletAuditLog, ({ one }) => ({
  wallet: one(userWallet, {
    fields: [walletAuditLog.walletId],
    references: [userWallet.id],
  }),
  actor: one(user, {
    fields: [walletAuditLog.actorId],
    references: [user.id],
  }),
  transaction: one(walletTransaction, {
    fields: [walletAuditLog.transactionId],
    references: [walletTransaction.id],
  }),
}));

// Update user relations to include wallet
export const userWalletUserRelations = relations(user, ({ one }) => ({
  wallet: one(userWallet, {
    fields: [user.id],
    references: [userWallet.userId],
  }),
}));

// Wallet type exports
export type UserWallet = typeof userWallet.$inferSelect;
export type CreateUserWalletData = typeof userWallet.$inferInsert;
export type UpdateUserWalletData = Partial<
  Omit<CreateUserWalletData, "id" | "createdAt" | "userId">
>;

export type WalletTransaction = typeof walletTransaction.$inferSelect;
export type CreateWalletTransactionData = typeof walletTransaction.$inferInsert;
export type UpdateWalletTransactionData = Partial<
  Omit<CreateWalletTransactionData, "id" | "createdAt" | "walletId">
>;

export type WalletAuditLog = typeof walletAuditLog.$inferSelect;
export type CreateWalletAuditLogData = typeof walletAuditLog.$inferInsert;

// =============================================================================
// COMPREHENSIVE AUDIT LOG SCHEMA
// General-purpose audit logging for tracking all significant actions across the system
// =============================================================================

// Audit Log Action Categories
export type AuditLogCategory =
  | "authentication"    // Login, logout, password changes
  | "authorization"     // Role changes, permission updates
  | "user_management"   // User CRUD operations
  | "resource_access"   // Data access and modifications
  | "financial"         // Transactions, transfers, payments
  | "approval"          // Approval workflow actions
  | "configuration"     // System settings changes
  | "security"          // Security-related events
  | "integration"       // External API calls, webhooks
  | "system";           // System-level operations

// Actor types - who performed the action
export type AuditActorType =
  | "user"              // Regular authenticated user
  | "admin"             // Administrator
  | "system"            // Automated system process
  | "api"               // External API client
  | "scheduler"         // Scheduled job/cron
  | "webhook";          // Webhook trigger

// Severity levels for audit entries
export type AuditSeverity =
  | "info"              // Informational, routine operations
  | "warning"           // Potential issues or unusual activity
  | "critical";         // Security-sensitive or high-impact changes

// Audit Log table - Comprehensive audit trail for all significant system actions
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),

    // === ACTION DETAILS ===
    // The action that was performed (e.g., "user.created", "expense.approved", "login.success")
    action: text("action").notNull(),

    // Category for grouping and filtering
    category: text("category").notNull(), // AuditLogCategory

    // Severity level
    severity: text("severity")
      .$default(() => "info")
      .notNull(), // AuditSeverity

    // === RESOURCE INFORMATION ===
    // The type of resource affected (e.g., "user", "expense_request", "wallet")
    resourceType: text("resource_type").notNull(),

    // The unique identifier of the affected resource
    resourceId: text("resource_id").notNull(),

    // Optional: Parent resource for nested resources (e.g., expense item's parent voucher)
    parentResourceType: text("parent_resource_type"),
    parentResourceId: text("parent_resource_id"),

    // === ACTOR INFORMATION ===
    // The user who performed the action (null for system actions)
    actorId: text("actor_id")
      .references(() => user.id, { onDelete: "set null" }),

    // Type of actor
    actorType: text("actor_type").notNull(), // AuditActorType

    // Actor's display name at the time of action (for historical accuracy)
    actorName: text("actor_name"),

    // Actor's email at the time of action
    actorEmail: text("actor_email"),

    // === REQUEST CONTEXT ===
    // IP address of the request
    ipAddress: text("ip_address"),

    // User agent string
    userAgent: text("user_agent"),

    // Session ID if applicable
    sessionId: text("session_id"),

    // Request ID for tracing
    requestId: text("request_id"),

    // === STATE SNAPSHOTS ===
    // State of the resource BEFORE the action (JSON)
    previousState: text("previous_state"),

    // State of the resource AFTER the action (JSON)
    newState: text("new_state"),

    // Summary of what changed (JSON array of field changes)
    changedFields: text("changed_fields"),

    // Human-readable description of the change
    description: text("description"),

    // === ADDITIONAL CONTEXT ===
    // Additional metadata for context (JSON)
    metadata: text("metadata"),

    // Tags for easier categorization and searching (JSON array)
    tags: text("tags"),

    // Success/failure status of the action
    success: boolean("success")
      .$default(() => true)
      .notNull(),

    // Error details if action failed (JSON)
    errorDetails: text("error_details"),

    // === TIMESTAMPS ===
    // When the action occurred
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),

    // Duration of the action in milliseconds (if applicable)
    durationMs: integer("duration_ms"),
  },
  (table) => [
    // Primary lookup indexes
    index("idx_audit_log_action").on(table.action),
    index("idx_audit_log_category").on(table.category),
    index("idx_audit_log_severity").on(table.severity),

    // Resource-based lookups
    index("idx_audit_log_resource").on(table.resourceType, table.resourceId),
    index("idx_audit_log_resource_type").on(table.resourceType),

    // Actor-based lookups
    index("idx_audit_log_actor_id").on(table.actorId),
    index("idx_audit_log_actor_type").on(table.actorType),

    // Time-based queries
    index("idx_audit_log_created_at").on(table.createdAt),

    // Compound indexes for common query patterns
    index("idx_audit_log_resource_created").on(table.resourceType, table.resourceId, table.createdAt),
    index("idx_audit_log_actor_created").on(table.actorId, table.createdAt),
    index("idx_audit_log_category_created").on(table.category, table.createdAt),
    index("idx_audit_log_success").on(table.success),

    // Security and compliance queries
    index("idx_audit_log_ip_address").on(table.ipAddress),
    index("idx_audit_log_session_id").on(table.sessionId),
  ]
);

// Audit Log Relations
export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(user, {
    fields: [auditLog.actorId],
    references: [user.id],
  }),
}));

// Audit Log type exports
export type AuditLog = typeof auditLog.$inferSelect;
export type CreateAuditLogData = typeof auditLog.$inferInsert;
export type UpdateAuditLogData = Partial<Omit<CreateAuditLogData, "id" | "createdAt">>;

// Utility type for audit log with actor details
export type AuditLogWithActor = AuditLog & {
  actor: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
};

// Filter interface for querying audit logs
export interface AuditLogFilters {
  action?: string;
  category?: AuditLogCategory;
  severity?: AuditSeverity;
  resourceType?: string;
  resourceId?: string;
  actorId?: string;
  actorType?: AuditActorType;
  ipAddress?: string;
  sessionId?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// Payload for creating a new audit log entry
export interface CreateAuditLogPayload {
  action: string;
  category: AuditLogCategory;
  severity?: AuditSeverity;
  resourceType: string;
  resourceId: string;
  parentResourceType?: string;
  parentResourceId?: string;
  actorId?: string | null;
  actorType: AuditActorType;
  actorName?: string;
  actorEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  previousState?: unknown;
  newState?: unknown;
  changedFields?: string[];
  description?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  success?: boolean;
  errorDetails?: Record<string, unknown>;
  durationMs?: number;
}

export type WalletWithTransactions = UserWallet & {
  transactions: WalletTransaction[];
};

export type WalletWithAuditLogs = UserWallet & {
  auditLogs: WalletAuditLog[];
};

export type WalletSummary = {
  id: string;
  userId: string;
  balance: string;
  availableBalance: string;
  pendingBalance: string;
  currency: string;
  status: WalletStatus;
  kycStatus: KycVerificationStatus;
  kycLevel: KycLevel;
  recentTransactions: {
    id: string;
    type: WalletTransactionType;
    amount: string;
    status: WalletTransactionStatus;
    createdAt: Date;
  }[];
};

// KYC Document type for wallet KYC verification
export type KycDocument = {
  id: string;
  type: "passport" | "national_id" | "drivers_license" | "utility_bill" | "bank_statement" | "other";
  status: "pending" | "verified" | "rejected";
  uploadedAt: Date;
  verifiedAt?: Date;
  expiresAt?: Date;
  url: string;
  rejectionReason?: string;
};

// Wallet settings type
export type WalletSettings = {
  notifications: {
    transactionAlerts: boolean;
    lowBalanceAlert: boolean;
    lowBalanceThreshold?: string;
    kycReminders: boolean;
  };
  defaultPaymentMethod?: {
    type: string;
    id: string;
    lastFour?: string;
  };
  autoConvertCurrency?: boolean;
  twoFactorForTransactions?: boolean;
};

// =============================================================================
// Briefing Schedule Preferences - User preferences for scheduled briefing delivery
// =============================================================================

// Delivery method types
export type BriefingDeliveryMethod = "push" | "email" | "both" | "in_app";

// Briefing Schedule Preference table - Stores user preferences for scheduled briefings
export const briefingSchedulePreference = pgTable(
  "briefing_schedule_preference",
  {
    id: text("id").primaryKey(), // Same as userId for 1:1 relationship
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
      .unique(),

    // Enable/disable scheduled briefings
    isEnabled: boolean("is_enabled")
      .$default(() => true)
      .notNull(),

    // Delivery time in HH:mm format (24-hour)
    deliveryTime: text("delivery_time")
      .$default(() => "08:00")
      .notNull(),

    // User's timezone (IANA format e.g., "Asia/Manila", "America/New_York")
    timezone: text("timezone")
      .$default(() => "UTC")
      .notNull(),

    // Delivery method preference
    deliveryMethod: text("delivery_method")
      .$default(() => "push")
      .notNull(),

    // Days of week to deliver (JSON array: [0,1,2,3,4,5,6] where 0=Sunday)
    // Default: weekdays only [1,2,3,4,5]
    daysOfWeek: text("days_of_week")
      .$default(() => "[1,2,3,4,5]")
      .notNull(),

    // Skip if no updates (don't send if nothing new to report)
    skipIfNoUpdates: boolean("skip_if_no_updates")
      .$default(() => false)
      .notNull(),

    // Last successful delivery timestamp
    lastDeliveredAt: timestamp("last_delivered_at"),

    // Last attempted delivery timestamp
    lastAttemptedAt: timestamp("last_attempted_at"),

    // Count of consecutive failures (for monitoring)
    consecutiveFailures: integer("consecutive_failures")
      .$default(() => 0)
      .notNull(),

    // Last error message if delivery failed
    lastErrorMessage: text("last_error_message"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_briefing_pref_user_id").on(table.userId),
    index("idx_briefing_pref_enabled").on(table.isEnabled),
    index("idx_briefing_pref_delivery_time").on(table.deliveryTime),
    index("idx_briefing_pref_timezone").on(table.timezone),
  ]
);

// Scheduled Briefing Log table - Tracks delivery history for scheduled briefings
export const scheduledBriefingLog = pgTable(
  "scheduled_briefing_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Reference to the generated briefing
    briefingId: text("briefing_id")
      .references(() => dailyBriefing.id, { onDelete: "set null" }),

    // Scheduled vs actual delivery time
    scheduledFor: timestamp("scheduled_for").notNull(),
    deliveredAt: timestamp("delivered_at"),

    // Delivery status
    status: text("status")
      .$default(() => "pending")
      .notNull(), // "pending", "delivered", "failed", "skipped"

    // Delivery method used
    deliveryMethod: text("delivery_method").notNull(),

    // Push message ID if delivered via push
    pushMessageId: text("push_message_id")
      .references(() => pushMessage.id, { onDelete: "set null" }),

    // Error details if failed
    errorMessage: text("error_message"),

    // Skip reason if skipped
    skipReason: text("skip_reason"),

    // Metadata (JSON string for additional info)
    metadata: text("metadata"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_scheduled_briefing_log_user_id").on(table.userId),
    index("idx_scheduled_briefing_log_scheduled_for").on(table.scheduledFor),
    index("idx_scheduled_briefing_log_status").on(table.status),
    index("idx_scheduled_briefing_log_user_scheduled").on(table.userId, table.scheduledFor),
  ]
);

// Briefing Schedule Preference Relations
export const briefingSchedulePreferenceRelations = relations(briefingSchedulePreference, ({ one }) => ({
  user: one(user, {
    fields: [briefingSchedulePreference.userId],
    references: [user.id],
  }),
}));

export const scheduledBriefingLogRelations = relations(scheduledBriefingLog, ({ one }) => ({
  user: one(user, {
    fields: [scheduledBriefingLog.userId],
    references: [user.id],
  }),
  briefing: one(dailyBriefing, {
    fields: [scheduledBriefingLog.briefingId],
    references: [dailyBriefing.id],
  }),
  pushMessage: one(pushMessage, {
    fields: [scheduledBriefingLog.pushMessageId],
    references: [pushMessage.id],
  }),
}));

// Update user relations to include briefing schedule preferences
export const userBriefingScheduleRelations = relations(user, ({ one, many }) => ({
  briefingSchedulePreference: one(briefingSchedulePreference, {
    fields: [user.id],
    references: [briefingSchedulePreference.userId],
  }),
  scheduledBriefingLogs: many(scheduledBriefingLog),
}));

// Briefing Schedule Preference type exports
export type BriefingSchedulePreference = typeof briefingSchedulePreference.$inferSelect;
export type CreateBriefingSchedulePreferenceData = typeof briefingSchedulePreference.$inferInsert;
export type UpdateBriefingSchedulePreferenceData = Partial<
  Omit<CreateBriefingSchedulePreferenceData, "id" | "createdAt" | "userId">
>;

export type ScheduledBriefingLog = typeof scheduledBriefingLog.$inferSelect;
export type CreateScheduledBriefingLogData = typeof scheduledBriefingLog.$inferInsert;
export type UpdateScheduledBriefingLogData = Partial<
  Omit<CreateScheduledBriefingLogData, "id" | "createdAt" | "userId">
>;

// Status types for scheduled briefing log
export type ScheduledBriefingStatus = "pending" | "delivered" | "failed" | "skipped";

// =============================================================================
// Chat Approval Requests - Approval workflow integrated into conversations
// =============================================================================

// Approval request status types
export type ChatApprovalStatus = "pending" | "approved" | "rejected";

// Approval request types (extensible for different approval use cases)
export type ChatApprovalType = "expense" | "time_off" | "purchase" | "document" | "general";

// Chat Approval Request table - Approval requests embedded in chat conversations
export const chatApprovalRequest = pgTable(
  "chat_approval_request",
  {
    id: text("id").primaryKey(),

    // Link to conversation where this approval request was made
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),

    // The message ID that contains this approval request
    messageId: text("message_id")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),

    // Requester and approver
    requesterId: text("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    approverId: text("approver_id")
      .references(() => user.id, { onDelete: "set null" }),

    // Approval type and details
    approvalType: text("approval_type")
      .$default(() => "general")
      .notNull(),
    title: text("title").notNull(),
    description: text("description"),

    // For expense-related approvals
    amount: text("amount"), // Stored as text to preserve precision
    currency: text("currency").$default(() => "USD"),

    // Status tracking
    status: text("status")
      .$default(() => "pending")
      .notNull(),

    // Response details
    responseComment: text("response_comment"),
    respondedAt: timestamp("responded_at"),

    // Optional metadata as JSON (for extensibility)
    metadata: text("metadata"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    expiresAt: timestamp("expires_at"), // Optional expiration
  },
  (table) => [
    index("idx_chat_approval_conversation_id").on(table.conversationId),
    index("idx_chat_approval_message_id").on(table.messageId),
    index("idx_chat_approval_requester_id").on(table.requesterId),
    index("idx_chat_approval_approver_id").on(table.approverId),
    index("idx_chat_approval_status").on(table.status),
    index("idx_chat_approval_type").on(table.approvalType),
    index("idx_chat_approval_created_at").on(table.createdAt),
  ]
);

// Chat Approval Thread - Notification threading for approval requests
export const chatApprovalThread = pgTable(
  "chat_approval_thread",
  {
    id: text("id").primaryKey(),

    // Link to the approval request
    approvalRequestId: text("approval_request_id")
      .notNull()
      .references(() => chatApprovalRequest.id, { onDelete: "cascade" }),

    // User receiving this notification
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Thread status
    isRead: boolean("is_read")
      .$default(() => false)
      .notNull(),
    readAt: timestamp("read_at"),

    // Notification type (request_received, status_changed, reminder)
    notificationType: text("notification_type")
      .$default(() => "request_received")
      .notNull(),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_chat_approval_thread_request_id").on(table.approvalRequestId),
    index("idx_chat_approval_thread_user_id").on(table.userId),
    index("idx_chat_approval_thread_is_read").on(table.userId, table.isRead),
  ]
);

// Chat Approval Request Relations
export const chatApprovalRequestRelations = relations(chatApprovalRequest, ({ one, many }) => ({
  conversation: one(conversation, {
    fields: [chatApprovalRequest.conversationId],
    references: [conversation.id],
  }),
  message: one(message, {
    fields: [chatApprovalRequest.messageId],
    references: [message.id],
  }),
  requester: one(user, {
    fields: [chatApprovalRequest.requesterId],
    references: [user.id],
    relationName: "chatApprovalRequester",
  }),
  approver: one(user, {
    fields: [chatApprovalRequest.approverId],
    references: [user.id],
    relationName: "chatApprovalApprover",
  }),
  threads: many(chatApprovalThread),
}));

export const chatApprovalThreadRelations = relations(chatApprovalThread, ({ one }) => ({
  approvalRequest: one(chatApprovalRequest, {
    fields: [chatApprovalThread.approvalRequestId],
    references: [chatApprovalRequest.id],
  }),
  user: one(user, {
    fields: [chatApprovalThread.userId],
    references: [user.id],
  }),
}));

// Update user relations to include chat approval requests
export const userChatApprovalRelations = relations(user, ({ many }) => ({
  chatApprovalRequestsAsRequester: many(chatApprovalRequest, {
    relationName: "chatApprovalRequester",
  }),
  chatApprovalRequestsAsApprover: many(chatApprovalRequest, {
    relationName: "chatApprovalApprover",
  }),
  chatApprovalThreads: many(chatApprovalThread),
}));

// Chat Approval Request type exports
export type ChatApprovalRequest = typeof chatApprovalRequest.$inferSelect;
export type CreateChatApprovalRequestData = typeof chatApprovalRequest.$inferInsert;
export type UpdateChatApprovalRequestData = Partial<
  Omit<CreateChatApprovalRequestData, "id" | "createdAt" | "conversationId" | "messageId" | "requesterId">
>;

export type ChatApprovalThread = typeof chatApprovalThread.$inferSelect;
export type CreateChatApprovalThreadData = typeof chatApprovalThread.$inferInsert;

// =============================================================================
// Task Reminders - Automated smart reminders for upcoming and overdue tasks
// =============================================================================

// Reminder status types
export type TaskReminderStatus = "pending" | "sent" | "failed" | "cancelled";

// Reminder type (what triggered the reminder)
export type TaskReminderType = "upcoming" | "overdue" | "escalation";

// Escalation level for supervisor notifications
export type EscalationLevel = 0 | 1 | 2 | 3; // 0 = user, 1 = first supervisor, 2 = second level, 3 = max

// Task Reminder Preference table - User preferences for task reminders
export const taskReminderPreference = pgTable(
  "task_reminder_preference",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
      .unique(),

    // Enable/disable task reminders
    isEnabled: boolean("is_enabled")
      .$default(() => true)
      .notNull(),

    // Reminder timing preferences (in hours before deadline)
    upcomingReminderHours: integer("upcoming_reminder_hours")
      .$default(() => 24)
      .notNull(), // Default: 24 hours before deadline

    // Overdue reminder frequency (in hours)
    overdueReminderFrequency: integer("overdue_reminder_frequency")
      .$default(() => 24)
      .notNull(), // Default: every 24 hours

    // Maximum reminders to send per task
    maxRemindersPerTask: integer("max_reminders_per_task")
      .$default(() => 5)
      .notNull(),

    // User's timezone for context-aware timing
    timezone: text("timezone")
      .$default(() => "UTC")
      .notNull(),

    // Quiet hours - don't send reminders during these hours (JSON: { start: "22:00", end: "07:00" })
    quietHours: text("quiet_hours").$default(() => '{"start":"22:00","end":"07:00"}'),

    // Working days preference (JSON array: [1,2,3,4,5] where 0=Sunday)
    workingDays: text("working_days")
      .$default(() => "[1,2,3,4,5]")
      .notNull(),

    // Escalation settings
    enableEscalation: boolean("enable_escalation")
      .$default(() => true)
      .notNull(),
    escalationAfterHours: integer("escalation_after_hours")
      .$default(() => 48)
      .notNull(), // Escalate after 48 hours overdue

    // Supervisor user ID for escalation (optional)
    supervisorId: text("supervisor_id")
      .references(() => user.id, { onDelete: "set null" }),

    // Delivery method preference
    deliveryMethod: text("delivery_method")
      .$default(() => "push")
      .notNull(), // "push" | "email" | "both" | "in_app"

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_task_reminder_pref_user_id").on(table.userId),
    index("idx_task_reminder_pref_enabled").on(table.isEnabled),
    index("idx_task_reminder_pref_supervisor_id").on(table.supervisorId),
  ]
);

// Task Reminder Log table - Tracks sent reminders for each task
export const taskReminderLog = pgTable(
  "task_reminder_log",
  {
    id: text("id").primaryKey(),

    // User who receives the reminder
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // External task ID (from Odoo)
    taskId: integer("task_id").notNull(),
    taskName: text("task_name").notNull(),
    taskDeadline: timestamp("task_deadline"),

    // Project context
    projectId: integer("project_id"),
    projectName: text("project_name"),

    // Reminder details
    reminderType: text("reminder_type").notNull(), // "upcoming" | "overdue" | "escalation"
    status: text("status")
      .$default(() => "pending")
      .notNull(), // "pending" | "sent" | "failed" | "cancelled"

    // Escalation tracking
    escalationLevel: integer("escalation_level")
      .$default(() => 0)
      .notNull(),
    escalatedToUserId: text("escalated_to_user_id")
      .references(() => user.id, { onDelete: "set null" }),

    // Hours overdue at time of reminder (for context)
    hoursOverdue: integer("hours_overdue"),

    // Delivery tracking
    scheduledFor: timestamp("scheduled_for").notNull(),
    sentAt: timestamp("sent_at"),
    pushMessageId: text("push_message_id")
      .references(() => pushMessage.id, { onDelete: "set null" }),

    // Error tracking
    errorMessage: text("error_message"),
    retryCount: integer("retry_count")
      .$default(() => 0)
      .notNull(),

    // Context metadata (JSON: additional task details, assignees, etc.)
    metadata: text("metadata"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_task_reminder_log_user_id").on(table.userId),
    index("idx_task_reminder_log_task_id").on(table.taskId),
    index("idx_task_reminder_log_status").on(table.status),
    index("idx_task_reminder_log_type").on(table.reminderType),
    index("idx_task_reminder_log_scheduled_for").on(table.scheduledFor),
    index("idx_task_reminder_log_user_task").on(table.userId, table.taskId),
    index("idx_task_reminder_log_escalation").on(table.escalatedToUserId),
  ]
);

// Task Reminder State table - Tracks reminder state per task to avoid duplicates
export const taskReminderState = pgTable(
  "task_reminder_state",
  {
    id: text("id").primaryKey(),

    // User-task combination (unique per user-task pair)
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    taskId: integer("task_id").notNull(),

    // Tracking
    remindersSent: integer("reminders_sent")
      .$default(() => 0)
      .notNull(),
    lastReminderAt: timestamp("last_reminder_at"),
    lastReminderType: text("last_reminder_type"),

    // Escalation tracking
    currentEscalationLevel: integer("current_escalation_level")
      .$default(() => 0)
      .notNull(),
    lastEscalationAt: timestamp("last_escalation_at"),

    // Snooze support
    snoozedUntil: timestamp("snoozed_until"),

    // Whether to stop sending reminders for this task
    isMuted: boolean("is_muted")
      .$default(() => false)
      .notNull(),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_task_reminder_state_user_id").on(table.userId),
    index("idx_task_reminder_state_task_id").on(table.taskId),
    index("idx_task_reminder_state_user_task").on(table.userId, table.taskId),
    index("idx_task_reminder_state_snoozed").on(table.snoozedUntil),
    index("idx_task_reminder_state_muted").on(table.isMuted),
  ]
);

// Task Reminder Preference Relations
export const taskReminderPreferenceRelations = relations(taskReminderPreference, ({ one }) => ({
  user: one(user, {
    fields: [taskReminderPreference.userId],
    references: [user.id],
  }),
  supervisor: one(user, {
    fields: [taskReminderPreference.supervisorId],
    references: [user.id],
    relationName: "taskReminderSupervisor",
  }),
}));

export const taskReminderLogRelations = relations(taskReminderLog, ({ one }) => ({
  user: one(user, {
    fields: [taskReminderLog.userId],
    references: [user.id],
  }),
  escalatedToUser: one(user, {
    fields: [taskReminderLog.escalatedToUserId],
    references: [user.id],
    relationName: "taskReminderEscalation",
  }),
  pushMessage: one(pushMessage, {
    fields: [taskReminderLog.pushMessageId],
    references: [pushMessage.id],
  }),
}));

export const taskReminderStateRelations = relations(taskReminderState, ({ one }) => ({
  user: one(user, {
    fields: [taskReminderState.userId],
    references: [user.id],
  }),
}));

// Update user relations to include task reminder preferences
export const userTaskReminderRelations = relations(user, ({ one, many }) => ({
  taskReminderPreference: one(taskReminderPreference, {
    fields: [user.id],
    references: [taskReminderPreference.userId],
  }),
  taskReminderLogs: many(taskReminderLog),
  taskReminderStates: many(taskReminderState),
  supervisedTaskReminders: many(taskReminderPreference, {
    relationName: "taskReminderSupervisor",
  }),
  escalatedTaskReminders: many(taskReminderLog, {
    relationName: "taskReminderEscalation",
  }),
}));

// Task Reminder Preference type exports
export type TaskReminderPreference = typeof taskReminderPreference.$inferSelect;
export type CreateTaskReminderPreferenceData = typeof taskReminderPreference.$inferInsert;
export type UpdateTaskReminderPreferenceData = Partial<
  Omit<CreateTaskReminderPreferenceData, "id" | "createdAt" | "userId">
>;

export type TaskReminderLog = typeof taskReminderLog.$inferSelect;
export type CreateTaskReminderLogData = typeof taskReminderLog.$inferInsert;
export type UpdateTaskReminderLogData = Partial<
  Omit<CreateTaskReminderLogData, "id" | "createdAt" | "userId" | "taskId">
>;

export type TaskReminderState = typeof taskReminderState.$inferSelect;
export type CreateTaskReminderStateData = typeof taskReminderState.$inferInsert;
export type UpdateTaskReminderStateData = Partial<
  Omit<CreateTaskReminderStateData, "id" | "createdAt" | "userId" | "taskId">
>;

// =============================================================================
// FusionPBX Call Recording Service - Encrypted call recordings with retention policies
// =============================================================================

// Recording status types
export type RecordingStatus = "pending" | "processing" | "encrypted" | "stored" | "failed" | "expired" | "deleted";

// Storage provider types
export type StorageProvider = "r2" | "s3" | "gcs" | "azure";

// Recording access types
export type RecordingAccessType = "download" | "stream" | "view_metadata" | "delete" | "decrypt";

// Call Recording table - Stores encrypted recording metadata
export const callRecording = pgTable(
  "call_recording",
  {
    id: text("id").primaryKey(),
    callRecordId: text("call_record_id")
      .notNull()
      .references(() => callRecord.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // FusionPBX reference
    fusionpbxRecordingId: text("fusionpbx_recording_id"),
    fusionpbxCallUuid: text("fusionpbx_call_uuid"),

    // Storage information
    storageProvider: text("storage_provider").notNull(), // r2, s3, gcs, azure
    storageKey: text("storage_key").notNull(),
    storageBucket: text("storage_bucket"),
    originalFilename: text("original_filename"),
    fileSize: integer("file_size"), // Using integer for file size (up to ~2GB)
    fileFormat: text("file_format"), // wav, mp3, ogg
    durationSeconds: integer("duration_seconds"),
    sampleRate: integer("sample_rate"),
    channels: integer("channels"),

    // Encryption information
    isEncrypted: boolean("is_encrypted")
      .$default(() => true)
      .notNull(),
    encryptionAlgorithm: text("encryption_algorithm"), // aes-256-gcm
    encryptionKeyId: text("encryption_key_id")
      .references(() => callRecordingEncryptionKey.id, { onDelete: "set null" }),
    encryptionIv: text("encryption_iv"), // Base64 encoded IV
    contentHash: text("content_hash"), // SHA-256 hash for integrity

    // Processing status
    status: text("status")
      .$default(() => "pending")
      .notNull(),
    processingStartedAt: timestamp("processing_started_at"),
    processingCompletedAt: timestamp("processing_completed_at"),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count")
      .$default(() => 0)
      .notNull(),

    // Retention policy
    retentionPolicyId: text("retention_policy_id")
      .references(() => callRecordingRetentionPolicy.id, { onDelete: "set null" }),
    retentionDays: integer("retention_days").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    deletionScheduledAt: timestamp("deletion_scheduled_at"),
    deletedAt: timestamp("deleted_at"),

    // Metadata
    metadata: text("metadata"), // JSON blob
    tags: text("tags"), // Comma-separated tags

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_call_recording_call_record_id").on(table.callRecordId),
    index("idx_call_recording_user_id").on(table.userId),
    index("idx_call_recording_status").on(table.status),
    index("idx_call_recording_expires_at").on(table.expiresAt),
    index("idx_call_recording_fusionpbx_call_uuid").on(table.fusionpbxCallUuid),
    index("idx_call_recording_storage_key").on(table.storageKey),
    index("idx_call_recording_created_at").on(table.createdAt),
    index("idx_call_recording_retention_policy").on(table.retentionPolicyId),
    index("idx_call_recording_deletion_scheduled").on(table.deletionScheduledAt),
    index("idx_call_recording_user_status").on(table.userId, table.status),
  ]
);

// Retention Policy Configuration table
export const callRecordingRetentionPolicy = pgTable(
  "call_recording_retention_policy",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),

    // Policy rules
    retentionDays: integer("retention_days").notNull(),
    autoDelete: boolean("auto_delete")
      .$default(() => true)
      .notNull(),
    archiveBeforeDelete: boolean("archive_before_delete")
      .$default(() => false)
      .notNull(),

    // Applicable conditions (JSON)
    conditions: text("conditions"),

    // Policy priority (lower = higher priority)
    priority: integer("priority")
      .$default(() => 100)
      .notNull(),
    isDefault: boolean("is_default")
      .$default(() => false)
      .notNull(),
    isActive: boolean("is_active")
      .$default(() => true)
      .notNull(),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_retention_policy_active").on(table.isActive),
    index("idx_retention_policy_default").on(table.isDefault),
    index("idx_retention_policy_priority").on(table.priority),
  ]
);

// Recording Access Log - Audit trail
export const callRecordingAccessLog = pgTable(
  "call_recording_access_log",
  {
    id: text("id").primaryKey(),
    recordingId: text("recording_id")
      .notNull()
      .references(() => callRecording.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .references(() => user.id, { onDelete: "set null" }),

    // Access details
    accessType: text("access_type").notNull(), // download, stream, view_metadata, delete, decrypt
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    success: boolean("success").notNull(),
    errorMessage: text("error_message"),

    // Timestamps
    accessedAt: timestamp("accessed_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_access_log_recording_id").on(table.recordingId),
    index("idx_access_log_user_id").on(table.userId),
    index("idx_access_log_accessed_at").on(table.accessedAt),
    index("idx_access_log_access_type").on(table.accessType),
  ]
);

// Encryption Key Registry - For key rotation and management
export const callRecordingEncryptionKey = pgTable(
  "call_recording_encryption_key",
  {
    id: text("id").primaryKey(),
    keyVersion: integer("key_version").notNull(),

    // Key material (encrypted with master key)
    encryptedKey: text("encrypted_key").notNull(),
    keyHash: text("key_hash").notNull(), // Hash for quick lookup

    // Status
    isActive: boolean("is_active")
      .$default(() => true)
      .notNull(),
    isPrimary: boolean("is_primary")
      .$default(() => false)
      .notNull(), // Primary key for new encryptions
    rotatedAt: timestamp("rotated_at"),
    rotatedBy: text("rotated_by"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    expiresAt: timestamp("expires_at"),
  },
  (table) => [
    index("idx_encryption_key_active").on(table.isActive),
    index("idx_encryption_key_primary").on(table.isPrimary),
    index("idx_encryption_key_version").on(table.keyVersion),
  ]
);

// Call Recording Relations
export const callRecordingRelations = relations(callRecording, ({ one, many }) => ({
  callRecord: one(callRecord, {
    fields: [callRecording.callRecordId],
    references: [callRecord.id],
  }),
  user: one(user, {
    fields: [callRecording.userId],
    references: [user.id],
  }),
  retentionPolicy: one(callRecordingRetentionPolicy, {
    fields: [callRecording.retentionPolicyId],
    references: [callRecordingRetentionPolicy.id],
  }),
  encryptionKey: one(callRecordingEncryptionKey, {
    fields: [callRecording.encryptionKeyId],
    references: [callRecordingEncryptionKey.id],
  }),
  accessLogs: many(callRecordingAccessLog),
}));

export const callRecordingRetentionPolicyRelations = relations(callRecordingRetentionPolicy, ({ many }) => ({
  recordings: many(callRecording),
}));

export const callRecordingAccessLogRelations = relations(callRecordingAccessLog, ({ one }) => ({
  recording: one(callRecording, {
    fields: [callRecordingAccessLog.recordingId],
    references: [callRecording.id],
  }),
  user: one(user, {
    fields: [callRecordingAccessLog.userId],
    references: [user.id],
  }),
}));

export const callRecordingEncryptionKeyRelations = relations(callRecordingEncryptionKey, ({ many }) => ({
  recordings: many(callRecording),
}));

// Update user relations to include call recordings
export const userCallRecordingRelations = relations(user, ({ many }) => ({
  callRecordings: many(callRecording),
  callRecordingAccessLogs: many(callRecordingAccessLog),
}));

// Call Recording type exports
export type CallRecording = typeof callRecording.$inferSelect;
export type CreateCallRecordingData = typeof callRecording.$inferInsert;
export type UpdateCallRecordingData = Partial<
  Omit<CreateCallRecordingData, "id" | "createdAt" | "callRecordId" | "userId">
>;

export type CallRecordingRetentionPolicy = typeof callRecordingRetentionPolicy.$inferSelect;
export type CreateCallRecordingRetentionPolicyData = typeof callRecordingRetentionPolicy.$inferInsert;
export type UpdateCallRecordingRetentionPolicyData = Partial<
  Omit<CreateCallRecordingRetentionPolicyData, "id" | "createdAt">
>;

export type CallRecordingAccessLog = typeof callRecordingAccessLog.$inferSelect;
export type CreateCallRecordingAccessLogData = typeof callRecordingAccessLog.$inferInsert;

export type CallRecordingEncryptionKey = typeof callRecordingEncryptionKey.$inferSelect;
export type CreateCallRecordingEncryptionKeyData = typeof callRecordingEncryptionKey.$inferInsert;
export type UpdateCallRecordingEncryptionKeyData = Partial<
  Omit<CreateCallRecordingEncryptionKeyData, "id" | "createdAt" | "keyVersion">
>;

// =============================================================================
// Feature Flags - Feature flag management with targeting and rollout support
// =============================================================================

/**
 * Feature Flag
 * Core feature flag definition with enabled status and rollout configuration
 *
 * This table supports:
 * - Global feature flags (enabled/disabled)
 * - Percentage-based rollout (gradual rollout to a percentage of users)
 * - User and role targeting (override flags for specific users/roles)
 */
export const featureFlag = pgTable(
  "feature_flag",
  {
    id: text("id").primaryKey(),

    // Flag identification
    flagName: text("flag_name").notNull().unique(),
    description: text("description"),

    // Global enabled status (can be overridden by targeting rules)
    enabled: boolean("enabled")
      .$default(() => false)
      .notNull(),

    // Percentage rollout configuration (0-100)
    // When set, this enables the flag for a percentage of users
    // based on consistent hashing of userId + flagName
    rolloutPercentage: integer("rollout_percentage")
      .$default(() => 0)
      .notNull(),

    // Rollout strategy: "percentage" | "all" | "none" | "targeted"
    // - "percentage": Use rolloutPercentage to determine eligibility
    // - "all": Enable for all users when enabled=true
    // - "none": Disable for all users (overrides enabled)
    // - "targeted": Only enable for specifically targeted users/roles
    rolloutStrategy: text("rollout_strategy")
      .$default(() => "all")
      .notNull(),

    // Optional metadata for the flag (JSON string)
    // Can include: tags, owner, environment, etc.
    metadata: text("metadata"),

    // Timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_feature_flag_flag_name").on(table.flagName),
    index("idx_feature_flag_enabled").on(table.enabled),
    index("idx_feature_flag_rollout_strategy").on(table.rolloutStrategy),
  ]
);

/**
 * Feature Flag User Targeting
 * Explicit user-level targeting for feature flags
 * Users in this table will have the flag enabled regardless of global settings
 */
export const featureFlagUserTarget = pgTable(
  "feature_flag_user_target",
  {
    id: text("id").primaryKey(),

    // Foreign key to feature flag
    featureFlagId: text("feature_flag_id")
      .notNull()
      .references(() => featureFlag.id, { onDelete: "cascade" }),

    // Target user
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Whether this target enables or disables the flag for this user
    // true = enable for this user, false = disable for this user
    enabled: boolean("enabled")
      .$default(() => true)
      .notNull(),

    // Timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_feature_flag_user_target_flag_id").on(table.featureFlagId),
    index("idx_feature_flag_user_target_user_id").on(table.userId),
    index("idx_feature_flag_user_target_flag_user").on(table.featureFlagId, table.userId),
  ]
);

/**
 * Feature Flag Role Targeting
 * Role-level targeting for feature flags
 * Users with roles in this table will have the flag enabled/disabled based on the targeting
 */
export const featureFlagRoleTarget = pgTable(
  "feature_flag_role_target",
  {
    id: text("id").primaryKey(),

    // Foreign key to feature flag
    featureFlagId: text("feature_flag_id")
      .notNull()
      .references(() => featureFlag.id, { onDelete: "cascade" }),

    // Target role (md, field-tech, admin, sales)
    role: text("role").notNull(),

    // Whether this target enables or disables the flag for this role
    // true = enable for this role, false = disable for this role
    enabled: boolean("enabled")
      .$default(() => true)
      .notNull(),

    // Timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_feature_flag_role_target_flag_id").on(table.featureFlagId),
    index("idx_feature_flag_role_target_role").on(table.role),
    index("idx_feature_flag_role_target_flag_role").on(table.featureFlagId, table.role),
  ]
);

// Feature Flag Relations
export const featureFlagRelations = relations(featureFlag, ({ many }) => ({
  userTargets: many(featureFlagUserTarget),
  roleTargets: many(featureFlagRoleTarget),
}));

export const featureFlagUserTargetRelations = relations(featureFlagUserTarget, ({ one }) => ({
  featureFlag: one(featureFlag, {
    fields: [featureFlagUserTarget.featureFlagId],
    references: [featureFlag.id],
  }),
  user: one(user, {
    fields: [featureFlagUserTarget.userId],
    references: [user.id],
  }),
}));

export const featureFlagRoleTargetRelations = relations(featureFlagRoleTarget, ({ one }) => ({
  featureFlag: one(featureFlag, {
    fields: [featureFlagRoleTarget.featureFlagId],
    references: [featureFlag.id],
  }),
}));

// Update user relations to include feature flag targeting
export const userFeatureFlagRelations = relations(user, ({ many }) => ({
  featureFlagTargets: many(featureFlagUserTarget),
}));

// Feature Flag Constants
export const ROLLOUT_STRATEGIES = ["percentage", "all", "none", "targeted"] as const;
export type RolloutStrategy = (typeof ROLLOUT_STRATEGIES)[number];

// Feature Flag type exports
export type FeatureFlag = typeof featureFlag.$inferSelect;
export type CreateFeatureFlagData = typeof featureFlag.$inferInsert;
export type UpdateFeatureFlagData = Partial<
  Omit<CreateFeatureFlagData, "id" | "createdAt">
>;

export type FeatureFlagUserTarget = typeof featureFlagUserTarget.$inferSelect;
export type CreateFeatureFlagUserTargetData = typeof featureFlagUserTarget.$inferInsert;

export type FeatureFlagRoleTarget = typeof featureFlagRoleTarget.$inferSelect;
export type CreateFeatureFlagRoleTargetData = typeof featureFlagRoleTarget.$inferInsert;

// ==========================================
// KYC VERIFICATION SCHEMA
// ==========================================

/**
 * KYC Document Types
 * Types of identity documents that can be submitted for verification
 */
export const KYC_DOCUMENT_TYPES = [
  "passport",
  "national_id",
  "drivers_license",
  "utility_bill",
  "bank_statement",
  "proof_of_address",
  "selfie",
  "other",
] as const;
export type KycDocumentType = (typeof KYC_DOCUMENT_TYPES)[number];

/**
 * KYC Verification Status
 * Status of the overall KYC verification process
 */
export const KYC_VERIFICATION_STATUSES = [
  "not_started",
  "pending",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "expired",
  "suspended",
] as const;
export type KycVerificationStatus = (typeof KYC_VERIFICATION_STATUSES)[number];

/**
 * KYC Document Status
 * Status of individual document verification
 */
export const KYC_DOCUMENT_STATUSES = [
  "pending",
  "verified",
  "rejected",
  "expired",
] as const;
export type KycDocumentStatus = (typeof KYC_DOCUMENT_STATUSES)[number];

/**
 * KYC Tier Levels
 * Different verification tiers with increasing limits
 */
export const KYC_TIER_LEVELS = [
  "none",
  "basic",
  "intermediate",
  "advanced",
  "premium",
] as const;
export type KycTierLevel = (typeof KYC_TIER_LEVELS)[number];

/**
 * KYC Verification
 * Main table storing KYC verification data for users
 */
export const kycVerification = pgTable(
  "kyc_verification",
  {
    id: text("id").primaryKey(),

    // User reference
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
      .unique(), // One KYC verification per user

    // Verification status
    status: text("status")
      .$default(() => "not_started")
      .notNull(),

    // KYC tier level
    tierLevel: text("tier_level")
      .$default(() => "none")
      .notNull(),

    // Personal information (encrypted at rest recommended)
    firstName: text("first_name"),
    lastName: text("last_name"),
    middleName: text("middle_name"),
    dateOfBirth: text("date_of_birth"), // Stored as YYYY-MM-DD string for safety
    nationality: text("nationality"),
    countryOfResidence: text("country_of_residence"),

    // Address information
    addressLine1: text("address_line_1"),
    addressLine2: text("address_line_2"),
    city: text("city"),
    stateProvince: text("state_province"),
    postalCode: text("postal_code"),
    country: text("country"),

    // Contact information
    phoneNumber: text("phone_number"), // E.164 format
    phoneVerified: boolean("phone_verified")
      .$default(() => false)
      .notNull(),

    // Tax information
    taxId: text("tax_id"), // SSN, TIN, etc. (encrypted)
    taxIdType: text("tax_id_type"), // ssn, tin, ein, etc.
    taxIdCountry: text("tax_id_country"),

    // Documents stored as JSON array
    // Format: [{ id, type, status, fileName, fileUrl, fileSize, mimeType, uploadedAt, verifiedAt, expiresAt, rejectionReason }]
    documents: text("documents"), // JSON string

    // Tier limits (stored as text for decimal precision)
    dailyTransactionLimit: text("daily_transaction_limit"),
    weeklyTransactionLimit: text("weekly_transaction_limit"),
    monthlyTransactionLimit: text("monthly_transaction_limit"),
    singleTransactionLimit: text("single_transaction_limit"),
    annualTransactionLimit: text("annual_transaction_limit"),

    // Running totals for limit tracking
    dailyTransactionTotal: text("daily_transaction_total")
      .$default(() => "0.00")
      .notNull(),
    weeklyTransactionTotal: text("weekly_transaction_total")
      .$default(() => "0.00")
      .notNull(),
    monthlyTransactionTotal: text("monthly_transaction_total")
      .$default(() => "0.00")
      .notNull(),
    annualTransactionTotal: text("annual_transaction_total")
      .$default(() => "0.00")
      .notNull(),
    lastLimitResetDate: timestamp("last_limit_reset_date"),

    // Risk assessment
    riskScore: integer("risk_score"), // 0-100, higher = more risk
    riskLevel: text("risk_level"), // low, medium, high, critical
    riskFactors: text("risk_factors"), // JSON array of risk factors

    // External verification provider info
    externalVerificationId: text("external_verification_id"),
    externalProvider: text("external_provider"), // e.g., "jumio", "onfido", "veriff"
    externalVerificationData: text("external_verification_data"), // JSON response from provider

    // Workflow tracking
    submittedAt: timestamp("submitted_at"),
    reviewStartedAt: timestamp("review_started_at"),
    approvedAt: timestamp("approved_at"),
    rejectedAt: timestamp("rejected_at"),
    expiresAt: timestamp("expires_at"),
    suspendedAt: timestamp("suspended_at"),

    // Review details
    reviewedById: text("reviewed_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    approvedById: text("approved_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    rejectedById: text("rejected_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    rejectionReason: text("rejection_reason"),
    rejectionDetails: text("rejection_details"), // JSON with detailed reasons

    // Notes and comments
    internalNotes: text("internal_notes"),
    reviewNotes: text("review_notes"),

    // Audit trail
    lastActivityAt: timestamp("last_activity_at"),
    lastStatusChangeAt: timestamp("last_status_change_at"),
    previousStatus: text("previous_status"),

    // Device and session tracking
    submissionIpAddress: text("submission_ip_address"),
    submissionDeviceId: text("submission_device_id"),
    submissionUserAgent: text("submission_user_agent"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_kyc_verification_user_id").on(table.userId),
    index("idx_kyc_verification_status").on(table.status),
    index("idx_kyc_verification_tier_level").on(table.tierLevel),
    index("idx_kyc_verification_submitted_at").on(table.submittedAt),
    index("idx_kyc_verification_approved_at").on(table.approvedAt),
    index("idx_kyc_verification_expires_at").on(table.expiresAt),
    index("idx_kyc_verification_reviewed_by").on(table.reviewedById),
    index("idx_kyc_verification_risk_level").on(table.riskLevel),
    index("idx_kyc_verification_external_id").on(table.externalVerificationId),
    index("idx_kyc_verification_created_at").on(table.createdAt),
  ]
);

/**
 * KYC Document
 * Individual identity document uploads and their verification status
 */
export const kycDocument = pgTable(
  "kyc_document",
  {
    id: text("id").primaryKey(),

    // Reference to KYC verification
    kycVerificationId: text("kyc_verification_id")
      .notNull()
      .references(() => kycVerification.id, { onDelete: "cascade" }),

    // User reference for quick access
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Document type
    documentType: text("document_type").notNull(),

    // Document status
    status: text("status")
      .$default(() => "pending")
      .notNull(),

    // File information
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url").notNull(), // S3/R2 URL
    fileSize: integer("file_size"), // in bytes
    mimeType: text("mime_type"),
    fileHash: text("file_hash"), // SHA-256 hash for integrity

    // Document details
    documentNumber: text("document_number"), // ID number on document
    issuingCountry: text("issuing_country"),
    issuingAuthority: text("issuing_authority"),
    issueDate: text("issue_date"), // YYYY-MM-DD
    expiryDate: text("expiry_date"), // YYYY-MM-DD

    // Extraction data from OCR/AI
    extractedData: text("extracted_data"), // JSON with OCR results

    // Verification details
    verifiedAt: timestamp("verified_at"),
    verifiedById: text("verified_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    rejectedAt: timestamp("rejected_at"),
    rejectedById: text("rejected_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    rejectionReason: text("rejection_reason"),

    // External verification
    externalCheckId: text("external_check_id"),
    externalCheckResult: text("external_check_result"), // JSON

    // Flags
    isFrontSide: boolean("is_front_side").$default(() => true),
    isBackSide: boolean("is_back_side").$default(() => false),
    requiresManualReview: boolean("requires_manual_review").$default(
      () => false
    ),

    // Upload tracking
    uploadedAt: timestamp("uploaded_at")
      .$defaultFn(() => new Date())
      .notNull(),
    uploadIpAddress: text("upload_ip_address"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_kyc_document_verification_id").on(table.kycVerificationId),
    index("idx_kyc_document_user_id").on(table.userId),
    index("idx_kyc_document_type").on(table.documentType),
    index("idx_kyc_document_status").on(table.status),
    index("idx_kyc_document_uploaded_at").on(table.uploadedAt),
    index("idx_kyc_document_verified_at").on(table.verifiedAt),
  ]
);

/**
 * KYC Verification History
 * Audit trail for all KYC verification actions
 */
export const kycVerificationHistory = pgTable(
  "kyc_verification_history",
  {
    id: text("id").primaryKey(),

    // Reference to KYC verification
    kycVerificationId: text("kyc_verification_id")
      .notNull()
      .references(() => kycVerification.id, { onDelete: "cascade" }),

    // Action details
    action: text("action").notNull(), // submitted, approved, rejected, document_uploaded, tier_upgraded, etc.
    actionById: text("action_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actionByRole: text("action_by_role"), // admin, reviewer, system, user

    // Status change
    previousStatus: text("previous_status"),
    newStatus: text("new_status"),

    // Tier change
    previousTier: text("previous_tier"),
    newTier: text("new_tier"),

    // Additional data
    details: text("details"), // JSON with action-specific details
    comments: text("comments"),

    // Reference to specific document if action is document-related
    documentId: text("document_id"),
    documentType: text("document_type"),

    // Metadata
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    // Timestamp
    actionAt: timestamp("action_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_kyc_verification_history_verification_id").on(
      table.kycVerificationId
    ),
    index("idx_kyc_verification_history_action").on(table.action),
    index("idx_kyc_verification_history_action_by").on(table.actionById),
    index("idx_kyc_verification_history_action_at").on(table.actionAt),
  ]
);

/**
 * KYC Tier Configuration
 * Configuration for different KYC verification tiers and their limits
 */
export const kycTierConfig = pgTable(
  "kyc_tier_config",
  {
    id: text("id").primaryKey(),

    // Tier level
    tierLevel: text("tier_level").notNull().unique(),

    // Display information
    name: text("name").notNull(),
    description: text("description"),

    // Required documents (JSON array of document types)
    requiredDocuments: text("required_documents").notNull(), // JSON: ["passport", "proof_of_address"]

    // Transaction limits (stored as text for precision)
    dailyTransactionLimit: text("daily_transaction_limit"),
    weeklyTransactionLimit: text("weekly_transaction_limit"),
    monthlyTransactionLimit: text("monthly_transaction_limit"),
    singleTransactionLimit: text("single_transaction_limit"),
    annualTransactionLimit: text("annual_transaction_limit"),

    // Feature flags
    canWithdraw: boolean("can_withdraw").$default(() => false).notNull(),
    canDeposit: boolean("can_deposit").$default(() => true).notNull(),
    canTransfer: boolean("can_transfer").$default(() => false).notNull(),
    canTrade: boolean("can_trade").$default(() => false).notNull(),

    // Verification requirements
    requiresPhoneVerification: boolean("requires_phone_verification")
      .$default(() => false)
      .notNull(),
    requiresEmailVerification: boolean("requires_email_verification")
      .$default(() => true)
      .notNull(),
    requiresAddressVerification: boolean("requires_address_verification")
      .$default(() => false)
      .notNull(),
    requiresManualReview: boolean("requires_manual_review")
      .$default(() => false)
      .notNull(),

    // Validity period
    validityDays: integer("validity_days"), // null = never expires

    // Priority (for upgrade path)
    priority: integer("priority").$default(() => 0).notNull(),

    // Status
    isActive: boolean("is_active").$default(() => true).notNull(),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_kyc_tier_config_tier_level").on(table.tierLevel),
    index("idx_kyc_tier_config_is_active").on(table.isActive),
    index("idx_kyc_tier_config_priority").on(table.priority),
  ]
);

// KYC Verification Relations
export const kycVerificationRelations = relations(
  kycVerification,
  ({ one, many }) => ({
    user: one(user, {
      fields: [kycVerification.userId],
      references: [user.id],
    }),
    reviewer: one(user, {
      fields: [kycVerification.reviewedById],
      references: [user.id],
      relationName: "kycReviewer",
    }),
    approver: one(user, {
      fields: [kycVerification.approvedById],
      references: [user.id],
      relationName: "kycApprover",
    }),
    rejecter: one(user, {
      fields: [kycVerification.rejectedById],
      references: [user.id],
      relationName: "kycRejecter",
    }),
    documents: many(kycDocument),
    history: many(kycVerificationHistory),
  })
);

export const kycDocumentRelations = relations(kycDocument, ({ one }) => ({
  kycVerification: one(kycVerification, {
    fields: [kycDocument.kycVerificationId],
    references: [kycVerification.id],
  }),
  user: one(user, {
    fields: [kycDocument.userId],
    references: [user.id],
  }),
  verifier: one(user, {
    fields: [kycDocument.verifiedById],
    references: [user.id],
    relationName: "documentVerifier",
  }),
  rejecter: one(user, {
    fields: [kycDocument.rejectedById],
    references: [user.id],
    relationName: "documentRejecter",
  }),
}));

export const kycVerificationHistoryRelations = relations(
  kycVerificationHistory,
  ({ one }) => ({
    kycVerification: one(kycVerification, {
      fields: [kycVerificationHistory.kycVerificationId],
      references: [kycVerification.id],
    }),
    actionBy: one(user, {
      fields: [kycVerificationHistory.actionById],
      references: [user.id],
    }),
  })
);

// KYC Type Exports
export type KycVerification = typeof kycVerification.$inferSelect;
export type CreateKycVerificationData = typeof kycVerification.$inferInsert;
export type UpdateKycVerificationData = Partial<
  Omit<CreateKycVerificationData, "id" | "createdAt" | "userId">
>;

export type KycDocumentRecord = typeof kycDocument.$inferSelect;
export type CreateKycDocumentData = typeof kycDocument.$inferInsert;
export type UpdateKycDocumentData = Partial<
  Omit<CreateKycDocumentData, "id" | "createdAt" | "kycVerificationId" | "userId">
>;

export type KycVerificationHistory = typeof kycVerificationHistory.$inferSelect;
export type CreateKycVerificationHistoryData =
  typeof kycVerificationHistory.$inferInsert;

export type KycTierConfig = typeof kycTierConfig.$inferSelect;
export type CreateKycTierConfigData = typeof kycTierConfig.$inferInsert;
export type UpdateKycTierConfigData = Partial<
  Omit<CreateKycTierConfigData, "id" | "createdAt">
>;

/**
 * KYC Document Upload Metadata Type
 * For storing document metadata in JSON format
 */
export type KycDocumentMetadata = {
  id: string;
  type: KycDocumentType;
  status: KycDocumentStatus;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt: Date;
  verifiedAt?: Date;
  expiresAt?: Date;
  rejectionReason?: string;
};

// =============================================================================
// Call Summary - AI-generated call summaries with key points and sentiment
// =============================================================================

// Sentiment types for call summary
export type CallSentiment = "positive" | "neutral" | "negative" | "mixed";

// Summary status types
export type CallSummaryStatus = "pending" | "processing" | "completed" | "failed";

// Key point type for structured storage
export type CallKeyPoint = {
  id: string;
  content: string;
  importance: "high" | "medium" | "low";
  timestamp?: number; // Optional timestamp in seconds where this point was discussed
};

// Action item type for structured storage
export type CallActionItem = {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
  priority: "high" | "medium" | "low";
  completed: boolean;
};

// Sentiment details for detailed analysis
export type CallSentimentDetails = {
  overall: CallSentiment;
  score: number; // -1.0 to 1.0
  confidence: number; // 0.0 to 1.0
  customerMood?: string;
  agentMood?: string;
  emotions: string[];
  keywords: string[];
  segments?: {
    startTime: number;
    endTime: number;
    sentiment: CallSentiment;
    score: number;
  }[];
};

// Call Summary table - Stores AI-generated call summaries
export const callSummary = pgTable(
  "call_summary",
  {
    id: text("id").primaryKey(),
    callRecordId: text("call_record_id")
      .notNull()
      .references(() => callRecord.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Summary content
    summary: text("summary").notNull(), // Main AI-generated summary
    keyPoints: text("key_points"), // JSON array of CallKeyPoint
    actionItems: text("action_items"), // JSON array of CallActionItem

    // Sentiment analysis
    sentiment: text("sentiment"), // overall sentiment: positive, neutral, negative, mixed
    sentimentScore: real("sentiment_score"), // -1.0 to 1.0 (negative to positive)
    sentimentDetails: text("sentiment_details"), // JSON of CallSentimentDetails

    // Transcription (optional)
    transcription: text("transcription"), // Full call transcription if available

    // Generation metadata
    status: text("status")
      .$default(() => "completed")
      .notNull(), // pending, processing, completed, failed
    model: text("model"), // Claude model used for generation
    tokensUsed: integer("tokens_used"), // Total tokens used in generation
    generationTimeMs: integer("generation_time_ms"), // Time taken to generate in milliseconds
    errorMessage: text("error_message"), // Error message if generation failed

    // Source information
    sourceType: text("source_type"), // recording, notes, both
    recordingUrl: text("recording_url"), // Reference to recording used
    notesUsed: text("notes_used"), // Notes provided for summarization

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_call_summary_call_record_id").on(table.callRecordId),
    index("idx_call_summary_user_id").on(table.userId),
    index("idx_call_summary_status").on(table.status),
    index("idx_call_summary_sentiment").on(table.sentiment),
    index("idx_call_summary_created_at").on(table.createdAt),
    index("idx_call_summary_user_created").on(table.userId, table.createdAt),
  ]
);

// Call Summary Relations
export const callSummaryRelations = relations(callSummary, ({ one }) => ({
  callRecord: one(callRecord, {
    fields: [callSummary.callRecordId],
    references: [callRecord.id],
  }),
  user: one(user, {
    fields: [callSummary.userId],
    references: [user.id],
  }),
}));

// Update callRecord relations to include summary
export const callRecordSummaryRelations = relations(callRecord, ({ many }) => ({
  summaries: many(callSummary),
}));

// Call Summary Type Exports
export type CallSummary = typeof callSummary.$inferSelect;
export type CreateCallSummaryData = typeof callSummary.$inferInsert;
export type UpdateCallSummaryData = Partial<
  Omit<CreateCallSummaryData, "id" | "createdAt" | "callRecordId" | "userId">
>;

// =============================================================================
// QR Payment Request - QR code-based payment requests for merchant transactions
// =============================================================================

/**
 * QR Payment Status Types
 * - pending: Payment request created, awaiting payment
 * - processing: Payment is being processed
 * - completed: Payment successfully completed
 * - expired: Payment request has expired
 * - cancelled: Payment request was cancelled by merchant
 * - failed: Payment attempt failed
 * - refunded: Payment was refunded after completion
 */
export type QrPaymentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "expired"
  | "cancelled"
  | "failed"
  | "refunded";

/**
 * QR Payment Type
 * - static: Reusable QR code (typically for donations or fixed-price items)
 * - dynamic: Single-use QR code with specific amount and expiration
 */
export type QrPaymentType = "static" | "dynamic";

/**
 * Merchant Information Type
 * Stores merchant details associated with a QR payment request
 */
export type QrMerchantInfo = {
  merchantId: string;
  merchantName: string;
  merchantLogo?: string;
  businessType?: string;
  taxId?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country: string;
  };
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
};

/**
 * Payment Metadata Type
 * Additional payment context and tracking information
 */
export type QrPaymentMetadata = {
  orderId?: string;
  invoiceNumber?: string;
  productDescription?: string;
  customerNote?: string;
  merchantNote?: string;
  callbackUrl?: string;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  customFields?: Record<string, string | number | boolean>;
};

/**
 * Payment Attempt Record Type
 * Tracks individual payment attempts for a QR payment request
 */
export type QrPaymentAttempt = {
  id: string;
  attemptedAt: string; // ISO date string
  status: "initiated" | "processing" | "completed" | "failed";
  payerWalletId?: string;
  payerId?: string;
  paymentMethod?: string;
  errorCode?: string;
  errorMessage?: string;
  processingTimeMs?: number;
  transactionId?: string;
};

/**
 * Refund Record Type
 * Tracks refund information for completed payments
 */
export type QrPaymentRefund = {
  id: string;
  refundedAt: string; // ISO date string
  amount: string; // Amount refunded (text for precision)
  reason: string;
  initiatedBy: string; // User ID who initiated the refund
  transactionId?: string;
  status: "pending" | "completed" | "failed";
};

// QR Payment Request table - QR code-based payment requests
export const qrPaymentRequest = pgTable(
  "qr_payment_request",
  {
    id: text("id").primaryKey(),

    // Unique QR code identifier (used in QR code payload)
    qrCode: text("qr_code").notNull().unique(),

    // Short code for manual entry (e.g., "PAY-A1B2C3")
    shortCode: text("short_code").unique(),

    // QR payment type
    type: text("type")
      .$default(() => "dynamic")
      .notNull(), // static or dynamic

    // Merchant who created the payment request
    merchantId: text("merchant_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Merchant information snapshot (JSON for historical record)
    merchantInfo: text("merchant_info").notNull(), // JSON: QrMerchantInfo

    // Amount details (stored as text for decimal precision)
    amount: text("amount").notNull(), // e.g., "100.50"
    currency: text("currency")
      .$default(() => "USD")
      .notNull(), // ISO 4217 currency code

    // Optional: Minimum and maximum amounts for flexible payments
    minAmount: text("min_amount"), // Minimum acceptable amount
    maxAmount: text("max_amount"), // Maximum acceptable amount

    // Fee configuration
    feeAmount: text("fee_amount").$default(() => "0.00").notNull(),
    feeType: text("fee_type").$default(() => "fixed").notNull(), // fixed, percentage
    feePercentage: text("fee_percentage"), // If fee_type is percentage

    // Payment status
    status: text("status")
      .$default(() => "pending")
      .notNull(), // QrPaymentStatus

    // Expiration (null for static QR codes)
    expiresAt: timestamp("expires_at"),
    isExpired: boolean("is_expired").$default(() => false).notNull(),

    // Description and reference
    description: text("description"), // Payment description shown to payer
    reference: text("reference"), // Merchant's internal reference

    // Payment attempts tracking (JSON array)
    paymentAttempts: text("payment_attempts"), // JSON: QrPaymentAttempt[]
    attemptCount: integer("attempt_count").$default(() => 0).notNull(),

    // Successful payment details
    paidAt: timestamp("paid_at"),
    paidBy: text("paid_by").references(() => user.id, { onDelete: "set null" }), // User who made the payment
    payerWalletId: text("payer_wallet_id").references(() => userWallet.id, { onDelete: "set null" }),
    transactionId: text("transaction_id").references(() => walletTransaction.id, { onDelete: "set null" }),

    // Actual amount paid (may differ from requested for flexible payments)
    paidAmount: text("paid_amount"),
    paidCurrency: text("paid_currency"),

    // Refund tracking
    refundedAmount: text("refunded_amount").$default(() => "0.00").notNull(),
    refunds: text("refunds"), // JSON: QrPaymentRefund[]
    isFullyRefunded: boolean("is_fully_refunded").$default(() => false).notNull(),

    // Additional metadata (JSON)
    metadata: text("metadata"), // JSON: QrPaymentMetadata

    // Idempotency key to prevent duplicate payment processing
    idempotencyKey: text("idempotency_key").unique(),

    // QR code display settings
    qrCodeImageUrl: text("qr_code_image_url"), // Pre-generated QR code image URL
    qrCodeFormat: text("qr_code_format").$default(() => "png").notNull(), // png, svg

    // Notification settings
    notifyMerchantOnPayment: boolean("notify_merchant_on_payment").$default(() => true).notNull(),
    notifyPayerOnPayment: boolean("notify_payer_on_payment").$default(() => true).notNull(),
    merchantNotifiedAt: timestamp("merchant_notified_at"),
    payerNotifiedAt: timestamp("payer_notified_at"),

    // Cancellation tracking
    cancelledAt: timestamp("cancelled_at"),
    cancelledBy: text("cancelled_by").references(() => user.id, { onDelete: "set null" }),
    cancellationReason: text("cancellation_reason"),

    // Error tracking
    lastError: text("last_error"),
    lastErrorAt: timestamp("last_error_at"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    // Primary lookups
    index("idx_qr_payment_qr_code").on(table.qrCode),
    index("idx_qr_payment_short_code").on(table.shortCode),

    // Merchant queries
    index("idx_qr_payment_merchant_id").on(table.merchantId),
    index("idx_qr_payment_merchant_status").on(table.merchantId, table.status),
    index("idx_qr_payment_merchant_created").on(table.merchantId, table.createdAt),

    // Status and expiration queries
    index("idx_qr_payment_status").on(table.status),
    index("idx_qr_payment_expires_at").on(table.expiresAt),
    index("idx_qr_payment_status_expires").on(table.status, table.expiresAt),

    // Payer queries
    index("idx_qr_payment_paid_by").on(table.paidBy),
    index("idx_qr_payment_payer_wallet").on(table.payerWalletId),

    // Transaction lookup
    index("idx_qr_payment_transaction_id").on(table.transactionId),

    // Time-based queries
    index("idx_qr_payment_created_at").on(table.createdAt),
    index("idx_qr_payment_paid_at").on(table.paidAt),

    // Reference lookup
    index("idx_qr_payment_reference").on(table.reference),
  ]
);

// QR Payment Request Relations
export const qrPaymentRequestRelations = relations(qrPaymentRequest, ({ one }) => ({
  merchant: one(user, {
    fields: [qrPaymentRequest.merchantId],
    references: [user.id],
  }),
  payer: one(user, {
    fields: [qrPaymentRequest.paidBy],
    references: [user.id],
  }),
  payerWallet: one(userWallet, {
    fields: [qrPaymentRequest.payerWalletId],
    references: [userWallet.id],
  }),
  transaction: one(walletTransaction, {
    fields: [qrPaymentRequest.transactionId],
    references: [walletTransaction.id],
  }),
}));

// QR Payment Request Type Exports
export type QrPaymentRequest = typeof qrPaymentRequest.$inferSelect;
export type CreateQrPaymentRequestData = typeof qrPaymentRequest.$inferInsert;
export type UpdateQrPaymentRequestData = Partial<
  Omit<CreateQrPaymentRequestData, "id" | "createdAt" | "qrCode" | "merchantId">
>;

// =============================================================================
// QR Payment Constants
// =============================================================================

export const QR_PAYMENT_STATUSES = [
  "pending",
  "processing",
  "completed",
  "expired",
  "cancelled",
  "failed",
  "refunded",
] as const;

export const QR_PAYMENT_TYPES = ["static", "dynamic"] as const;

export const QR_PAYMENT_FEE_TYPES = ["fixed", "percentage"] as const;

export const QR_CODE_FORMATS = ["png", "svg"] as const;

export const QR_PAYMENT_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "NGN",
  "KES",
  "GHS",
  "ZAR",
  "INR",
  "PHP",
] as const;

// =============================================================================
// CRM Call Log Sync - Tracks call logs synced to Odoo CRM
// =============================================================================

/**
 * CRM Call Log Sync Status Types
 * - pending: Call record created, awaiting sync to CRM
 * - syncing: Sync in progress
 * - synced: Successfully synced to Odoo CRM
 * - failed: Sync failed
 * - skipped: Skipped (e.g., no matching partner found)
 */
export type CrmCallLogSyncStatus = "pending" | "syncing" | "synced" | "failed" | "skipped";

/**
 * CRM Call Log Sync table - Tracks the sync status of call records to Odoo CRM
 */
export const crmCallLogSync = pgTable(
  "crm_call_log_sync",
  {
    id: text("id").primaryKey(),
    
    // Reference to local call record
    callRecordId: text("call_record_id")
      .notNull()
      .references(() => callRecord.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    
    // Sync status
    status: text("status")
      .$default(() => "pending")
      .notNull(), // pending, syncing, synced, failed, skipped
    
    // Odoo references (populated after successful sync)
    odooPartnerId: integer("odoo_partner_id"), // res.partner ID
    odooLeadId: integer("odoo_lead_id"), // crm.lead ID
    odooActivityId: integer("odoo_activity_id"), // mail.activity ID
    odooMessageId: integer("odoo_message_id"), // mail.message ID
    
    // Partner details cached for reference
    partnerName: text("partner_name"),
    partnerPhone: text("partner_phone"),
    partnerEmail: text("partner_email"),
    
    // Lead details cached for reference
    leadName: text("lead_name"),
    
    // Sync metadata
    syncAttempts: integer("sync_attempts")
      .$default(() => 0)
      .notNull(),
    lastSyncAttempt: timestamp("last_sync_attempt"),
    syncedAt: timestamp("synced_at"),
    
    // Error handling
    lastError: text("last_error"),
    lastErrorCode: text("last_error_code"),
    
    // Options used during sync
    syncOptions: text("sync_options"), // JSON of options used
    
    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    // Primary lookups
    index("idx_crm_call_log_sync_call_record_id").on(table.callRecordId),
    index("idx_crm_call_log_sync_user_id").on(table.userId),
    
    // Status queries
    index("idx_crm_call_log_sync_status").on(table.status),
    index("idx_crm_call_log_sync_user_status").on(table.userId, table.status),
    
    // Odoo reference lookups
    index("idx_crm_call_log_sync_odoo_partner_id").on(table.odooPartnerId),
    index("idx_crm_call_log_sync_odoo_lead_id").on(table.odooLeadId),
    
    // Time-based queries
    index("idx_crm_call_log_sync_created_at").on(table.createdAt),
    index("idx_crm_call_log_sync_synced_at").on(table.syncedAt),
    
    // Pending sync queries for batch processing
    index("idx_crm_call_log_sync_pending").on(table.status, table.syncAttempts),
  ]
);

// CRM Call Log Sync Relations
export const crmCallLogSyncRelations = relations(crmCallLogSync, ({ one }) => ({
  callRecord: one(callRecord, {
    fields: [crmCallLogSync.callRecordId],
    references: [callRecord.id],
  }),
  user: one(user, {
    fields: [crmCallLogSync.userId],
    references: [user.id],
  }),
}));

// CRM Call Log Sync Type Exports
export type CrmCallLogSync = typeof crmCallLogSync.$inferSelect;
export type CreateCrmCallLogSyncData = typeof crmCallLogSync.$inferInsert;
export type UpdateCrmCallLogSyncData = Partial<
  Omit<CreateCrmCallLogSyncData, "id" | "createdAt" | "callRecordId" | "userId">
>;

// CRM Call Log Sync Status Constants
export const CRM_CALL_LOG_SYNC_STATUSES = [
  "pending",
  "syncing",
  "synced",
  "failed",
  "skipped",
] as const;

// =============================================================================
// Job Queue - Redis-backed job queue for background processing
// =============================================================================

/**
 * Job Status Types
 * - pending: Job created, waiting to be processed
 * - processing: Job is currently being processed
 * - completed: Job completed successfully
 * - failed: Job failed after all retries
 * - cancelled: Job was cancelled
 * - delayed: Job is delayed for future processing
 */
export type JobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled" | "delayed";

/**
 * Job Types - Different types of background jobs
 */
export type JobType =
  | "briefing.generate"
  | "briefing.deliver"
  | "notification.push"
  | "notification.email"
  | "sync.contacts"
  | "sync.crm"
  | "cleanup.expired"
  | "report.generate"
  | "data.export"
  | "custom";

/**
 * Job Priority Levels
 */
export type JobPriority = "critical" | "high" | "normal" | "low";

/**
 * Job Queue table - Stores job definitions and state for background processing
 */
export const jobQueue = pgTable(
  "job_queue",
  {
    id: text("id").primaryKey(),

    // Job type and name for routing to handlers
    type: text("type").notNull(), // Job type (briefing.generate, notification.push, etc.)
    name: text("name").notNull(), // Human-readable job name

    // Job payload stored as JSON
    payload: text("payload").notNull(), // JSON stringified job data

    // Priority and scheduling
    priority: text("priority")
      .$default(() => "normal")
      .notNull(), // critical, high, normal, low
    scheduledFor: timestamp("scheduled_for"), // When to process (null = immediately)

    // Status tracking
    status: text("status")
      .$default(() => "pending")
      .notNull(), // pending, processing, completed, failed, cancelled, delayed

    // Retry configuration
    maxRetries: integer("max_retries")
      .$default(() => 3)
      .notNull(),
    retryCount: integer("retry_count")
      .$default(() => 0)
      .notNull(),
    retryDelay: integer("retry_delay")
      .$default(() => 5000)
      .notNull(), // Delay between retries in ms

    // Processing metadata
    lockedBy: text("locked_by"), // Worker ID that locked this job
    lockedAt: timestamp("locked_at"), // When job was locked
    processingTimeout: integer("processing_timeout")
      .$default(() => 30000)
      .notNull(), // Timeout in ms

    // Result and error tracking
    result: text("result"), // JSON stringified result on success
    lastError: text("last_error"), // Last error message
    errorStack: text("error_stack"), // Error stack trace

    // Progress tracking
    progress: integer("progress")
      .$default(() => 0)
      .notNull(), // 0-100 percentage
    progressMessage: text("progress_message"), // Current progress message

    // Reference fields for linking to related entities
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"), // ID of related entity (briefingId, etc.)
    referenceType: text("reference_type"), // Type of related entity

    // Timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
    startedAt: timestamp("started_at"), // When processing started
    completedAt: timestamp("completed_at"), // When processing completed
  },
  (table) => [
    // Primary lookups
    index("idx_job_queue_type").on(table.type),
    index("idx_job_queue_status").on(table.status),
    index("idx_job_queue_user_id").on(table.userId),

    // Priority and scheduling queries
    index("idx_job_queue_priority").on(table.priority),
    index("idx_job_queue_scheduled_for").on(table.scheduledFor),
    index("idx_job_queue_status_priority").on(table.status, table.priority),

    // Processing queries
    index("idx_job_queue_locked_by").on(table.lockedBy),
    index("idx_job_queue_locked_at").on(table.lockedAt),

    // Pending jobs query (most important for job processing)
    index("idx_job_queue_pending").on(table.status, table.priority, table.scheduledFor),

    // Reference lookups
    index("idx_job_queue_reference").on(table.referenceType, table.referenceId),

    // Time-based queries
    index("idx_job_queue_created_at").on(table.createdAt),
    index("idx_job_queue_completed_at").on(table.completedAt),
  ]
);

/**
 * Job Execution Log table - Stores history of job executions
 */
export const jobExecutionLog = pgTable(
  "job_execution_log",
  {
    id: text("id").primaryKey(),

    // Reference to job
    jobId: text("job_id")
      .notNull()
      .references(() => jobQueue.id, { onDelete: "cascade" }),

    // Execution details
    workerId: text("worker_id").notNull(), // Worker that processed this execution
    attemptNumber: integer("attempt_number").notNull(), // Which attempt this was

    // Status of this execution
    status: text("status").notNull(), // success, failure

    // Timing
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at").notNull(),
    duration: integer("duration").notNull(), // Duration in ms

    // Result or error
    result: text("result"), // JSON stringified result
    error: text("error"), // Error message if failed
    errorStack: text("error_stack"), // Error stack trace

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_job_execution_log_job_id").on(table.jobId),
    index("idx_job_execution_log_worker_id").on(table.workerId),
    index("idx_job_execution_log_status").on(table.status),
    index("idx_job_execution_log_created_at").on(table.createdAt),
    index("idx_job_execution_log_started_at").on(table.startedAt),
  ]
);

/**
 * Dead Letter Queue table - Stores failed jobs for later analysis
 */
export const deadLetterQueue = pgTable(
  "dead_letter_queue",
  {
    id: text("id").primaryKey(),

    // Original job data
    originalJobId: text("original_job_id").notNull(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    payload: text("payload").notNull(),

    // Failure details
    failedAt: timestamp("failed_at").notNull(),
    failureReason: text("failure_reason").notNull(),
    totalAttempts: integer("total_attempts").notNull(),

    // Execution history summary
    executionHistory: text("execution_history"), // JSON array of execution summaries

    // Resolution tracking
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: text("resolved_by"), // User ID who resolved
    resolution: text("resolution"), // retry, discard, manual_fix

    // Reference fields preserved from original job
    userId: text("user_id"),
    referenceId: text("reference_id"),
    referenceType: text("reference_type"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_dead_letter_queue_type").on(table.type),
    index("idx_dead_letter_queue_failed_at").on(table.failedAt),
    index("idx_dead_letter_queue_resolved_at").on(table.resolvedAt),
    index("idx_dead_letter_queue_user_id").on(table.userId),
    index("idx_dead_letter_queue_reference").on(table.referenceType, table.referenceId),
  ]
);

// Job Queue Relations
export const jobQueueRelations = relations(jobQueue, ({ one, many }) => ({
  user: one(user, {
    fields: [jobQueue.userId],
    references: [user.id],
  }),
  executions: many(jobExecutionLog),
}));

export const jobExecutionLogRelations = relations(jobExecutionLog, ({ one }) => ({
  job: one(jobQueue, {
    fields: [jobExecutionLog.jobId],
    references: [jobQueue.id],
  }),
}));

// Job Queue Type Exports
export type JobQueue = typeof jobQueue.$inferSelect;
export type CreateJobQueueData = typeof jobQueue.$inferInsert;
export type UpdateJobQueueData = Partial<
  Omit<CreateJobQueueData, "id" | "createdAt">
>;

export type JobExecutionLog = typeof jobExecutionLog.$inferSelect;
export type CreateJobExecutionLogData = typeof jobExecutionLog.$inferInsert;

export type DeadLetterQueue = typeof deadLetterQueue.$inferSelect;
export type CreateDeadLetterQueueData = typeof deadLetterQueue.$inferInsert;
export type UpdateDeadLetterQueueData = Partial<
  Omit<CreateDeadLetterQueueData, "id" | "createdAt">
>;

// Job Queue Status Constants
export const JOB_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "delayed",
] as const;

export const JOB_TYPES = [
  "briefing.generate",
  "briefing.deliver",
  "notification.push",
  "notification.email",
  "sync.contacts",
  "sync.crm",
  "cleanup.expired",
  "report.generate",
  "custom",
] as const;

export const JOB_PRIORITIES = [
  "critical",
  "high",
  "normal",
  "low",
] as const;

// =============================================================================
// Task Auto-Creation Rules - Rule engine for automatically creating tasks
// =============================================================================

// Trigger Types - Events that can trigger task creation
export type TaskRuleTriggerType =
  | "new_customer"
  | "overdue_invoice"
  | "low_inventory"
  | "expense_approved"
  | "expense_rejected"
  | "call_completed"
  | "customer_inactive"
  | "subscription_expiring"
  | "manual"
  | "scheduled"
  | "custom";

// Rule Status types
export type TaskRuleStatus = "active" | "paused" | "disabled" | "archived";

// Condition Operator types
export type TaskRuleConditionOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equals"
  | "less_than_or_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  | "in"
  | "not_in";

// Task Rule table - Main table for storing task creation rules
export const taskAutoCreationRule = pgTable(
  "task_auto_creation_rule",
  {
    id: text("id").primaryKey(),

    // Rule identification
    name: text("name").notNull(),
    description: text("description"),

    // Owner and assignment
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Trigger configuration
    triggerType: text("trigger_type").notNull(), // TaskRuleTriggerType

    // Conditions stored as JSON string
    // Format: { conditions: [{ field, operator, value }], logic: "and" | "or" }
    conditions: text("conditions"),

    // Task template configuration stored as JSON string
    // Format: { title, description, priority, dueInDays, assigneeId, assigneeRole, tags }
    taskTemplate: text("task_template").notNull(),

    // Rule status and scheduling
    status: text("status")
      .$default(() => "active")
      .notNull(),

    // Scheduled rules configuration
    schedule: text("schedule"), // Cron expression for scheduled rules
    lastTriggeredAt: timestamp("last_triggered_at"),
    nextScheduledAt: timestamp("next_scheduled_at"),

    // Rate limiting
    cooldownMinutes: integer("cooldown_minutes").$default(() => 0),
    maxTriggersPerDay: integer("max_triggers_per_day"),
    triggersToday: integer("triggers_today").$default(() => 0),
    triggersResetAt: timestamp("triggers_reset_at"),

    // Priority and ordering
    priority: integer("priority").$default(() => 0), // Higher = runs first

    // Statistics
    totalTriggered: integer("total_triggered").$default(() => 0),
    totalTasksCreated: integer("total_tasks_created").$default(() => 0),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_task_auto_creation_rule_created_by").on(table.createdBy),
    index("idx_task_auto_creation_rule_trigger_type").on(table.triggerType),
    index("idx_task_auto_creation_rule_status").on(table.status),
    index("idx_task_auto_creation_rule_next_scheduled").on(table.nextScheduledAt),
  ]
);

// Task Rule Execution Log - Tracks when rules are triggered
export const taskRuleExecutionLog = pgTable(
  "task_rule_execution_log",
  {
    id: text("id").primaryKey(),

    // Rule reference
    ruleId: text("rule_id")
      .notNull()
      .references(() => taskAutoCreationRule.id, { onDelete: "cascade" }),

    // Execution details
    triggerData: text("trigger_data"), // JSON: The data that triggered the rule

    // Result
    success: boolean("success").notNull(),
    taskCreatedId: text("task_created_id"), // Reference to created task if applicable
    errorMessage: text("error_message"),

    // Execution timing
    executedAt: timestamp("executed_at")
      .$defaultFn(() => new Date())
      .notNull(),
    executionDurationMs: integer("execution_duration_ms"),
  },
  (table) => [
    index("idx_task_rule_execution_log_rule_id").on(table.ruleId),
    index("idx_task_rule_execution_log_executed_at").on(table.executedAt),
    index("idx_task_rule_execution_log_success").on(table.success),
  ]
);

// Task Rule Relations
export const taskAutoCreationRuleRelations = relations(taskAutoCreationRule, ({ one, many }) => ({
  creator: one(user, {
    fields: [taskAutoCreationRule.createdBy],
    references: [user.id],
  }),
  executionLogs: many(taskRuleExecutionLog),
}));

export const taskRuleExecutionLogRelations = relations(taskRuleExecutionLog, ({ one }) => ({
  rule: one(taskAutoCreationRule, {
    fields: [taskRuleExecutionLog.ruleId],
    references: [taskAutoCreationRule.id],
  }),
}));

// Task Rule Type Exports
export type TaskAutoCreationRule = typeof taskAutoCreationRule.$inferSelect;
export type CreateTaskAutoCreationRuleData = typeof taskAutoCreationRule.$inferInsert;
export type UpdateTaskAutoCreationRuleData = Partial<
  Omit<CreateTaskAutoCreationRuleData, "id" | "createdAt" | "createdBy">
>;

export type TaskRuleExecutionLog = typeof taskRuleExecutionLog.$inferSelect;
export type CreateTaskRuleExecutionLogData = typeof taskRuleExecutionLog.$inferInsert;

// Task Rule Trigger Types Constants
export const TASK_RULE_TRIGGER_TYPES = [
  "new_customer",
  "overdue_invoice",
  "low_inventory",
  "expense_approved",
  "expense_rejected",
  "call_completed",
  "customer_inactive",
  "subscription_expiring",
  "manual",
  "scheduled",
  "custom",
] as const;

// Task Rule Status Constants
export const TASK_RULE_STATUSES = [
  "active",
  "paused",
  "disabled",
  "archived",
] as const;

// Task Rule Condition Operators Constants
export const TASK_RULE_CONDITION_OPERATORS = [
  "equals",
  "not_equals",
  "greater_than",
  "less_than",
  "greater_than_or_equals",
  "less_than_or_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "is_empty",
  "is_not_empty",
  "in",
  "not_in",
] as const;

// Task Template Interface (for JSON structure)
export interface TaskTemplateConfig {
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  dueInDays?: number;
  dueInHours?: number;
  assigneeId?: string;
  assigneeRole?: string; // Assign to users with this role
  tags?: string[];
}

// Rule Condition Interface (for JSON structure)
export interface TaskRuleCondition {
  field: string;
  operator: TaskRuleConditionOperator;
  value: string | number | boolean | string[] | number[];
}

// Rule Conditions Configuration Interface
export interface TaskRuleConditionsConfig {
  conditions: TaskRuleCondition[];
  logic: "and" | "or";
}

// =============================================================================
// Task-Conversation Linking - Service for linking conversations to tasks/projects
// =============================================================================

// Task Link Status types
export type TaskLinkStatus = "active" | "completed" | "archived";

// Task Suggestion Status types
export type TaskSuggestionStatus = "pending" | "accepted" | "dismissed";

// Task Thread Status types
export type TaskThreadStatus = "open" | "closed" | "resolved";

// Task Conversation Link table - Links conversations to external tasks/projects
export const taskConversationLink = pgTable(
  "task_conversation_link",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),

    // External task reference (from Odoo or other systems)
    externalTaskId: text("external_task_id").notNull(),
    externalProjectId: text("external_project_id"),
    taskSource: text("task_source").$default(() => "odoo").notNull(), // odoo, manual, ai_suggested

    // Link metadata
    linkedById: text("linked_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    linkReason: text("link_reason"), // Why this link was created

    // Status tracking
    status: text("status").$default(() => "active").notNull(),

    // Timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_task_conv_link_conversation_id").on(table.conversationId),
    index("idx_task_conv_link_external_task_id").on(table.externalTaskId),
    index("idx_task_conv_link_external_project_id").on(table.externalProjectId),
    index("idx_task_conv_link_linked_by_id").on(table.linkedById),
    index("idx_task_conv_link_status").on(table.status),
    index("idx_task_conv_link_created_at").on(table.createdAt),
  ]
);

// Task Suggestion table - AI-suggested tasks based on conversation content
export const taskSuggestion = pgTable(
  "task_suggestion",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),

    // Suggested task details
    suggestedTaskId: text("suggested_task_id"), // External task ID if matching existing task
    suggestedProjectId: text("suggested_project_id"),

    // Suggestion metadata
    suggestionReason: text("suggestion_reason").notNull(), // Why this task was suggested
    confidenceScore: real("confidence_score"), // AI confidence score (0-1)
    relevanceKeywords: text("relevance_keywords"), // Keywords that triggered the suggestion (JSON array)

    // Task preview data (cached from external source)
    taskTitle: text("task_title"),
    taskDescription: text("task_description"),
    taskPriority: text("task_priority"),
    taskDeadline: timestamp("task_deadline"),

    // Status tracking
    status: text("status").$default(() => "pending").notNull(),
    reviewedById: text("reviewed_by_id")
      .references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at"),

    // Timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_task_suggestion_conversation_id").on(table.conversationId),
    index("idx_task_suggestion_suggested_task_id").on(table.suggestedTaskId),
    index("idx_task_suggestion_status").on(table.status),
    index("idx_task_suggestion_confidence_score").on(table.confidenceScore),
    index("idx_task_suggestion_created_at").on(table.createdAt),
  ]
);

// Task Thread table - Discussion threads created for specific tasks
export const taskThread = pgTable(
  "task_thread",
  {
    id: text("id").primaryKey(),

    // External task reference
    externalTaskId: text("external_task_id").notNull(),
    externalProjectId: text("external_project_id"),
    taskSource: text("task_source").$default(() => "odoo").notNull(),

    // Thread metadata
    title: text("title").notNull(),
    description: text("description"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Status tracking
    status: text("status").$default(() => "open").notNull(),
    closedById: text("closed_by_id")
      .references(() => user.id, { onDelete: "set null" }),
    closedAt: timestamp("closed_at"),
    closedReason: text("closed_reason"),

    // Cached task data
    taskTitle: text("task_title"),
    taskDeadline: timestamp("task_deadline"),

    // Thread statistics
    participantCount: integer("participant_count").$default(() => 1),
    messageCount: integer("message_count").$default(() => 0),
    lastActivityAt: timestamp("last_activity_at")
      .$defaultFn(() => new Date())
      .notNull(),

    // Timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_task_thread_external_task_id").on(table.externalTaskId),
    index("idx_task_thread_external_project_id").on(table.externalProjectId),
    index("idx_task_thread_created_by_id").on(table.createdById),
    index("idx_task_thread_status").on(table.status),
    index("idx_task_thread_last_activity_at").on(table.lastActivityAt),
    index("idx_task_thread_created_at").on(table.createdAt),
  ]
);

// Task Thread Message table - Messages within a task thread
export const taskThreadMessage = pgTable(
  "task_thread_message",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => taskThread.id, { onDelete: "cascade" }),

    // Message content
    senderId: text("sender_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),

    // Optional reference to conversation message
    originalMessageId: text("original_message_id")
      .references(() => message.id, { onDelete: "set null" }),

    // Message metadata
    isSystemMessage: boolean("is_system_message")
      .$default(() => false)
      .notNull(),

    // Read status tracking (JSON: { [userId]: timestamp })
    readBy: text("read_by"),

    // Timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_task_thread_message_thread_id").on(table.threadId),
    index("idx_task_thread_message_sender_id").on(table.senderId),
    index("idx_task_thread_message_created_at").on(table.createdAt),
    index("idx_task_thread_message_thread_created").on(table.threadId, table.createdAt),
  ]
);

// Task Thread Participant table - Users participating in a task thread
export const taskThreadParticipant = pgTable(
  "task_thread_participant",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => taskThread.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Participation metadata
    joinedAt: timestamp("joined_at")
      .$defaultFn(() => new Date())
      .notNull(),
    lastReadAt: timestamp("last_read_at"),
    isMuted: boolean("is_muted")
      .$default(() => false)
      .notNull(),

    // Timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_task_thread_participant_thread_id").on(table.threadId),
    index("idx_task_thread_participant_user_id").on(table.userId),
    index("idx_task_thread_participant_thread_user").on(table.threadId, table.userId),
  ]
);

// Task-Conversation Linking Relations
export const taskConversationLinkRelations = relations(taskConversationLink, ({ one }) => ({
  conversation: one(conversation, {
    fields: [taskConversationLink.conversationId],
    references: [conversation.id],
  }),
  linkedBy: one(user, {
    fields: [taskConversationLink.linkedById],
    references: [user.id],
    relationName: "taskLinkCreator",
  }),
}));

export const taskSuggestionRelations = relations(taskSuggestion, ({ one }) => ({
  conversation: one(conversation, {
    fields: [taskSuggestion.conversationId],
    references: [conversation.id],
  }),
  reviewedBy: one(user, {
    fields: [taskSuggestion.reviewedById],
    references: [user.id],
    relationName: "taskSuggestionReviewer",
  }),
}));

export const taskThreadRelations = relations(taskThread, ({ one, many }) => ({
  createdBy: one(user, {
    fields: [taskThread.createdById],
    references: [user.id],
    relationName: "taskThreadCreator",
  }),
  closedBy: one(user, {
    fields: [taskThread.closedById],
    references: [user.id],
    relationName: "taskThreadCloser",
  }),
  messages: many(taskThreadMessage),
  participants: many(taskThreadParticipant),
}));

export const taskThreadMessageRelations = relations(taskThreadMessage, ({ one }) => ({
  thread: one(taskThread, {
    fields: [taskThreadMessage.threadId],
    references: [taskThread.id],
  }),
  sender: one(user, {
    fields: [taskThreadMessage.senderId],
    references: [user.id],
  }),
  originalMessage: one(message, {
    fields: [taskThreadMessage.originalMessageId],
    references: [message.id],
  }),
}));

export const taskThreadParticipantRelations = relations(taskThreadParticipant, ({ one }) => ({
  thread: one(taskThread, {
    fields: [taskThreadParticipant.threadId],
    references: [taskThread.id],
  }),
  user: one(user, {
    fields: [taskThreadParticipant.userId],
    references: [user.id],
  }),
}));

// Update conversation relations to include task links and suggestions
export const conversationTaskRelations = relations(conversation, ({ many }) => ({
  taskLinks: many(taskConversationLink),
  taskSuggestions: many(taskSuggestion),
}));

// Update user relations to include task-conversation linking
export const userTaskConversationRelations = relations(user, ({ many }) => ({
  createdTaskLinks: many(taskConversationLink, {
    relationName: "taskLinkCreator",
  }),
  reviewedTaskSuggestions: many(taskSuggestion, {
    relationName: "taskSuggestionReviewer",
  }),
  createdTaskThreads: many(taskThread, {
    relationName: "taskThreadCreator",
  }),
  closedTaskThreads: many(taskThread, {
    relationName: "taskThreadCloser",
  }),
  taskThreadMessages: many(taskThreadMessage),
  taskThreadParticipations: many(taskThreadParticipant),
}));

// Task-Conversation Linking Type Exports
export type TaskConversationLink = typeof taskConversationLink.$inferSelect;
export type CreateTaskConversationLinkData = typeof taskConversationLink.$inferInsert;
export type UpdateTaskConversationLinkData = Partial<
  Omit<CreateTaskConversationLinkData, "id" | "createdAt" | "linkedById">
>;

export type TaskSuggestion = typeof taskSuggestion.$inferSelect;
export type CreateTaskSuggestionData = typeof taskSuggestion.$inferInsert;
export type UpdateTaskSuggestionData = Partial<
  Omit<CreateTaskSuggestionData, "id" | "createdAt" | "conversationId">
>;

export type TaskThread = typeof taskThread.$inferSelect;
export type CreateTaskThreadData = typeof taskThread.$inferInsert;
export type UpdateTaskThreadData = Partial<
  Omit<CreateTaskThreadData, "id" | "createdAt" | "createdById">
>;

export type TaskThreadMessage = typeof taskThreadMessage.$inferSelect;
export type CreateTaskThreadMessageData = typeof taskThreadMessage.$inferInsert;
export type UpdateTaskThreadMessageData = Partial<
  Omit<CreateTaskThreadMessageData, "id" | "createdAt" | "threadId" | "senderId">
>;

export type TaskThreadParticipant = typeof taskThreadParticipant.$inferSelect;
export type CreateTaskThreadParticipantData = typeof taskThreadParticipant.$inferInsert;

// Task-Conversation Linking Status Constants
export const TASK_LINK_STATUSES = ["active", "completed", "archived"] as const;
export const TASK_SUGGESTION_STATUSES = ["pending", "accepted", "dismissed"] as const;
export const TASK_THREAD_STATUSES = ["open", "closed", "resolved"] as const;

// =============================================================================
// Team Capacity Monitor - Tracks team workload, assignment balance, and capacity
// =============================================================================

// Team Member Capacity Status types
export type CapacityStatus = "available" | "busy" | "overloaded" | "away" | "offline";

// Capacity Alert Severity types
export type CapacityAlertSeverity = "info" | "warning" | "critical";

// Capacity Alert types
export type CapacityAlertType =
  | "member_overloaded"
  | "member_underutilized"
  | "team_capacity_critical"
  | "unbalanced_workload"
  | "deadline_risk"
  | "availability_gap";

// Team Member Capacity table - Tracks individual team member capacity and workload
export const teamMemberCapacity = pgTable(
  "team_member_capacity",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Capacity configuration
    maxWeeklyHours: real("max_weekly_hours").$default(() => 40).notNull(),
    maxConcurrentTasks: integer("max_concurrent_tasks").$default(() => 5).notNull(),
    maxActiveProjects: integer("max_active_projects").$default(() => 3).notNull(),

    // Current workload tracking
    currentTasks: integer("current_tasks").$default(() => 0).notNull(),
    currentProjects: integer("current_projects").$default(() => 0).notNull(),
    currentWeeklyHours: real("current_weekly_hours").$default(() => 0).notNull(),
    currentUtilization: real("current_utilization").$default(() => 0).notNull(), // 0-100%

    // Status
    status: text("status").$default(() => "available").notNull(),
    statusNote: text("status_note"),
    statusUpdatedAt: timestamp("status_updated_at")
      .$defaultFn(() => new Date())
      .notNull(),

    // Availability settings
    availableFrom: timestamp("available_from"),
    availableUntil: timestamp("available_until"),
    timezone: text("timezone").$default(() => "UTC").notNull(),

    // Skills and specializations (JSON array)
    skills: text("skills"), // JSON array of skill names
    specializations: text("specializations"), // JSON array of specialization areas

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_team_member_capacity_user_id").on(table.userId),
    index("idx_team_member_capacity_status").on(table.status),
    index("idx_team_member_capacity_utilization").on(table.currentUtilization),
  ]
);

// Team Assignment table - Tracks task/project assignments for workload calculation
export const teamAssignment = pgTable(
  "team_assignment",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Assignment details
    assignmentType: text("assignment_type").notNull(), // "task" | "project" | "support" | "meeting"
    referenceId: text("reference_id"), // External reference (task ID, project ID, etc.)
    referenceSource: text("reference_source").$default(() => "internal").notNull(), // "odoo", "internal", "manual"

    // Assignment metadata
    title: text("title").notNull(),
    description: text("description"),
    priority: text("priority").$default(() => "medium").notNull(), // "low" | "medium" | "high" | "urgent"

    // Time tracking
    estimatedHours: real("estimated_hours"),
    actualHours: real("actual_hours"),
    startDate: timestamp("start_date"),
    dueDate: timestamp("due_date"),
    completedAt: timestamp("completed_at"),

    // Status
    status: text("status").$default(() => "assigned").notNull(), // "assigned" | "in_progress" | "completed" | "cancelled"

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_team_assignment_user_id").on(table.userId),
    index("idx_team_assignment_status").on(table.status),
    index("idx_team_assignment_type").on(table.assignmentType),
    index("idx_team_assignment_due_date").on(table.dueDate),
    index("idx_team_assignment_user_status").on(table.userId, table.status),
  ]
);

// Capacity Alert table - Stores alerts for capacity issues
export const capacityAlert = pgTable(
  "capacity_alert",
  {
    id: text("id").primaryKey(),

    // Alert details
    type: text("type").notNull(),
    severity: text("severity").$default(() => "warning").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),

    // Related entities
    userId: text("user_id")
      .references(() => user.id, { onDelete: "cascade" }),
    teamId: text("team_id"), // For future team grouping

    // Alert values
    currentValue: real("current_value"),
    thresholdValue: real("threshold_value"),

    // Status tracking
    acknowledged: boolean("acknowledged").$default(() => false).notNull(),
    acknowledgedById: text("acknowledged_by_id")
      .references(() => user.id, { onDelete: "set null" }),
    acknowledgedAt: timestamp("acknowledged_at"),
    resolvedAt: timestamp("resolved_at"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    expiresAt: timestamp("expires_at"),
  },
  (table) => [
    index("idx_capacity_alert_type").on(table.type),
    index("idx_capacity_alert_severity").on(table.severity),
    index("idx_capacity_alert_user_id").on(table.userId),
    index("idx_capacity_alert_acknowledged").on(table.acknowledged),
    index("idx_capacity_alert_created_at").on(table.createdAt),
  ]
);

// Team Capacity Snapshot table - Historical capacity data for trending
export const teamCapacitySnapshot = pgTable(
  "team_capacity_snapshot",
  {
    id: text("id").primaryKey(),

    // Snapshot date
    snapshotDate: timestamp("snapshot_date").notNull(),

    // Team-level metrics
    totalMembers: integer("total_members").notNull(),
    availableMembers: integer("available_members").notNull(),
    overloadedMembers: integer("overloaded_members").$default(() => 0).notNull(),
    underutilizedMembers: integer("underutilized_members").$default(() => 0).notNull(),

    // Aggregate metrics
    averageUtilization: real("average_utilization").notNull(),
    totalCapacityHours: real("total_capacity_hours").notNull(),
    usedCapacityHours: real("used_capacity_hours").notNull(),
    availableCapacityHours: real("available_capacity_hours").notNull(),

    // Assignment metrics
    totalOpenAssignments: integer("total_open_assignments").$default(() => 0).notNull(),
    assignmentsAtRisk: integer("assignments_at_risk").$default(() => 0).notNull(),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_team_capacity_snapshot_date").on(table.snapshotDate),
    index("idx_team_capacity_snapshot_created_at").on(table.createdAt),
  ]
);

// Team Capacity Relations
export const teamMemberCapacityRelations = relations(teamMemberCapacity, ({ one }) => ({
  user: one(user, {
    fields: [teamMemberCapacity.userId],
    references: [user.id],
  }),
}));

export const teamAssignmentRelations = relations(teamAssignment, ({ one }) => ({
  user: one(user, {
    fields: [teamAssignment.userId],
    references: [user.id],
  }),
}));

export const capacityAlertRelations = relations(capacityAlert, ({ one }) => ({
  user: one(user, {
    fields: [capacityAlert.userId],
    references: [user.id],
    relationName: "capacityAlertSubject",
  }),
  acknowledgedBy: one(user, {
    fields: [capacityAlert.acknowledgedById],
    references: [user.id],
    relationName: "capacityAlertAcknowledger",
  }),
}));

// Team Capacity Type Exports
export type TeamMemberCapacity = typeof teamMemberCapacity.$inferSelect;
export type CreateTeamMemberCapacityData = typeof teamMemberCapacity.$inferInsert;
export type UpdateTeamMemberCapacityData = Partial<
  Omit<CreateTeamMemberCapacityData, "id" | "createdAt" | "userId">
>;

export type TeamAssignment = typeof teamAssignment.$inferSelect;
export type CreateTeamAssignmentData = typeof teamAssignment.$inferInsert;
export type UpdateTeamAssignmentData = Partial<
  Omit<CreateTeamAssignmentData, "id" | "createdAt" | "userId">
>;

export type CapacityAlert = typeof capacityAlert.$inferSelect;
export type CreateCapacityAlertData = typeof capacityAlert.$inferInsert;
export type UpdateCapacityAlertData = Partial<
  Omit<CreateCapacityAlertData, "id" | "createdAt">
>;

export type TeamCapacitySnapshot = typeof teamCapacitySnapshot.$inferSelect;
export type CreateTeamCapacitySnapshotData = typeof teamCapacitySnapshot.$inferInsert;

// Team Capacity Status Constants
export const CAPACITY_STATUSES = ["available", "busy", "overloaded", "away", "offline"] as const;
export const CAPACITY_ALERT_SEVERITIES = ["info", "warning", "critical"] as const;
export const CAPACITY_ALERT_TYPES = [
  "member_overloaded",
  "member_underutilized",
  "team_capacity_critical",
  "unbalanced_workload",
  "deadline_risk",
  "availability_gap",
] as const;
export const ASSIGNMENT_STATUSES = ["assigned", "in_progress", "completed", "cancelled"] as const;
export const ASSIGNMENT_TYPES = ["task", "project", "support", "meeting"] as const;
export const ASSIGNMENT_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

// =============================================================================
// Workflow Automation Engine - General-purpose workflow for multi-step automations
// =============================================================================

// Workflow definition status types
export type WorkflowDefinitionStatus = "draft" | "active" | "paused" | "archived";

// Workflow instance status types
export type WorkflowInstanceStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

// Workflow step types
export type WorkflowStepType =
  | "action"
  | "condition"
  | "branch"
  | "wait"
  | "loop"
  | "parallel"
  | "approval"
  | "notification"
  | "integration";

// Workflow step status types
export type WorkflowStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "waiting";

// Workflow trigger types
export type WorkflowTriggerType =
  | "manual"
  | "schedule"
  | "event"
  | "webhook"
  | "api";

// Workflow action types for Odoo and AIOM integrations
export type WorkflowActionType =
  | "odoo_create"
  | "odoo_update"
  | "odoo_delete"
  | "odoo_search"
  | "aiom_task_create"
  | "aiom_notification"
  | "aiom_expense_approve"
  | "aiom_expense_reject"
  | "http_request"
  | "email_send"
  | "delay"
  | "set_variable"
  | "custom_script";

// Condition operator types
export type WorkflowConditionOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equals"
  | "less_than_or_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  | "in"
  | "not_in"
  | "regex_match";

// Workflow Definition table - Stores workflow blueprints
export const workflowDefinition = pgTable(
  "workflow_definition",
  {
    id: text("id").primaryKey(),

    // Basic info
    name: text("name").notNull(),
    description: text("description"),

    // Creator
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Status
    status: text("status").$default(() => "draft").notNull(),

    // Trigger configuration
    triggerType: text("trigger_type").notNull(),
    triggerConfig: text("trigger_config"), // JSON: trigger-specific configuration

    // Workflow steps (JSON array of step definitions)
    steps: text("steps").notNull(), // JSON: WorkflowStepDefinition[]

    // Variables and context (JSON)
    variables: text("variables"), // JSON: default variable values

    // Execution settings
    maxConcurrentInstances: integer("max_concurrent_instances").$default(() => 10).notNull(),
    timeoutMinutes: integer("timeout_minutes").$default(() => 60).notNull(),
    retryOnFailure: boolean("retry_on_failure").$default(() => false).notNull(),
    maxRetries: integer("max_retries").$default(() => 3).notNull(),

    // Tags for categorization
    tags: text("tags"), // JSON array of tags

    // Version tracking
    version: integer("version").$default(() => 1).notNull(),
    isLatest: boolean("is_latest").$default(() => true).notNull(),
    previousVersionId: text("previous_version_id"),

    // Statistics
    totalExecutions: integer("total_executions").$default(() => 0).notNull(),
    successfulExecutions: integer("successful_executions").$default(() => 0).notNull(),
    failedExecutions: integer("failed_executions").$default(() => 0).notNull(),
    lastExecutedAt: timestamp("last_executed_at"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_workflow_definition_created_by").on(table.createdBy),
    index("idx_workflow_definition_status").on(table.status),
    index("idx_workflow_definition_trigger_type").on(table.triggerType),
    index("idx_workflow_definition_is_latest").on(table.isLatest),
    index("idx_workflow_definition_name").on(table.name),
  ]
);

// Workflow Instance table - Tracks running/completed workflow executions
export const workflowInstance = pgTable(
  "workflow_instance",
  {
    id: text("id").primaryKey(),

    // Reference to definition
    definitionId: text("definition_id")
      .notNull()
      .references(() => workflowDefinition.id, { onDelete: "cascade" }),

    // Current status
    status: text("status").$default(() => "pending").notNull(),

    // Who triggered it
    triggeredBy: text("triggered_by")
      .references(() => user.id, { onDelete: "set null" }),

    // Trigger data
    triggerData: text("trigger_data"), // JSON: data that triggered the workflow

    // Current step tracking
    currentStepIndex: integer("current_step_index").$default(() => 0).notNull(),
    currentStepId: text("current_step_id"),

    // Workflow context/variables (JSON)
    context: text("context"), // JSON: runtime variables and state

    // Execution results
    output: text("output"), // JSON: final output data
    errorMessage: text("error_message"),
    errorDetails: text("error_details"), // JSON: detailed error info

    // Retry tracking
    retryCount: integer("retry_count").$default(() => 0).notNull(),
    lastRetryAt: timestamp("last_retry_at"),

    // Timing
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    pausedAt: timestamp("paused_at"),
    dueAt: timestamp("due_at"), // Timeout deadline

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_workflow_instance_definition_id").on(table.definitionId),
    index("idx_workflow_instance_status").on(table.status),
    index("idx_workflow_instance_triggered_by").on(table.triggeredBy),
    index("idx_workflow_instance_started_at").on(table.startedAt),
    index("idx_workflow_instance_current_step").on(table.currentStepIndex),
  ]
);

// Workflow Step Execution table - Tracks individual step executions
export const workflowStepExecution = pgTable(
  "workflow_step_execution",
  {
    id: text("id").primaryKey(),

    // References
    instanceId: text("instance_id")
      .notNull()
      .references(() => workflowInstance.id, { onDelete: "cascade" }),

    // Step identification
    stepId: text("step_id").notNull(),
    stepIndex: integer("step_index").notNull(),
    stepType: text("step_type").notNull(),
    stepName: text("step_name"),

    // Status
    status: text("status").$default(() => "pending").notNull(),

    // Input/Output
    input: text("input"), // JSON: step input data
    output: text("output"), // JSON: step output data

    // Error tracking
    errorMessage: text("error_message"),
    errorDetails: text("error_details"), // JSON

    // Retry tracking
    retryCount: integer("retry_count").$default(() => 0).notNull(),

    // Timing
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    executionDurationMs: integer("execution_duration_ms"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_workflow_step_execution_instance_id").on(table.instanceId),
    index("idx_workflow_step_execution_step_id").on(table.stepId),
    index("idx_workflow_step_execution_status").on(table.status),
    index("idx_workflow_step_execution_step_type").on(table.stepType),
  ]
);

// Workflow Event Log table - Audit trail for workflow events
export const workflowEventLog = pgTable(
  "workflow_event_log",
  {
    id: text("id").primaryKey(),

    // References
    instanceId: text("instance_id")
      .notNull()
      .references(() => workflowInstance.id, { onDelete: "cascade" }),
    stepExecutionId: text("step_execution_id")
      .references(() => workflowStepExecution.id, { onDelete: "set null" }),

    // Event details
    eventType: text("event_type").notNull(), // started, completed, failed, paused, resumed, step_completed, etc.
    eventData: text("event_data"), // JSON: additional event data

    // Actor (could be system or user)
    actorId: text("actor_id")
      .references(() => user.id, { onDelete: "set null" }),
    actorType: text("actor_type").$default(() => "system").notNull(), // "system" | "user"

    // Timestamp
    occurredAt: timestamp("occurred_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_workflow_event_log_instance_id").on(table.instanceId),
    index("idx_workflow_event_log_step_execution_id").on(table.stepExecutionId),
    index("idx_workflow_event_log_event_type").on(table.eventType),
    index("idx_workflow_event_log_occurred_at").on(table.occurredAt),
  ]
);

// Workflow Scheduled Run table - For scheduled workflow triggers
export const workflowScheduledRun = pgTable(
  "workflow_scheduled_run",
  {
    id: text("id").primaryKey(),

    // Reference to definition
    definitionId: text("definition_id")
      .notNull()
      .references(() => workflowDefinition.id, { onDelete: "cascade" }),

    // Schedule configuration
    cronExpression: text("cron_expression"), // For recurring schedules
    scheduledFor: timestamp("scheduled_for").notNull(), // Next run time

    // Status
    isActive: boolean("is_active").$default(() => true).notNull(),

    // Execution tracking
    lastRunAt: timestamp("last_run_at"),
    lastRunInstanceId: text("last_run_instance_id")
      .references(() => workflowInstance.id, { onDelete: "set null" }),
    nextRunAt: timestamp("next_run_at"),

    // Trigger data to pass when scheduled run executes
    triggerData: text("trigger_data"), // JSON

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_workflow_scheduled_run_definition_id").on(table.definitionId),
    index("idx_workflow_scheduled_run_scheduled_for").on(table.scheduledFor),
    index("idx_workflow_scheduled_run_is_active").on(table.isActive),
    index("idx_workflow_scheduled_run_next_run_at").on(table.nextRunAt),
  ]
);

// Workflow Approval table - For approval steps in workflows
export const workflowApproval = pgTable(
  "workflow_approval",
  {
    id: text("id").primaryKey(),

    // References
    instanceId: text("instance_id")
      .notNull()
      .references(() => workflowInstance.id, { onDelete: "cascade" }),
    stepExecutionId: text("step_execution_id")
      .notNull()
      .references(() => workflowStepExecution.id, { onDelete: "cascade" }),

    // Approval details
    approverId: text("approver_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Status
    status: text("status").$default(() => "pending").notNull(), // pending, approved, rejected

    // Decision details
    decision: text("decision"), // approved, rejected
    comments: text("comments"),
    decidedAt: timestamp("decided_at"),

    // Due date for approval
    dueAt: timestamp("due_at"),

    // Standard timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_workflow_approval_instance_id").on(table.instanceId),
    index("idx_workflow_approval_step_execution_id").on(table.stepExecutionId),
    index("idx_workflow_approval_approver_id").on(table.approverId),
    index("idx_workflow_approval_status").on(table.status),
    index("idx_workflow_approval_due_at").on(table.dueAt),
  ]
);

// Workflow Relations
export const workflowDefinitionRelations = relations(workflowDefinition, ({ one, many }) => ({
  creator: one(user, {
    fields: [workflowDefinition.createdBy],
    references: [user.id],
  }),
  instances: many(workflowInstance),
  scheduledRuns: many(workflowScheduledRun),
  previousVersion: one(workflowDefinition, {
    fields: [workflowDefinition.previousVersionId],
    references: [workflowDefinition.id],
    relationName: "versionHistory",
  }),
}));

export const workflowInstanceRelations = relations(workflowInstance, ({ one, many }) => ({
  definition: one(workflowDefinition, {
    fields: [workflowInstance.definitionId],
    references: [workflowDefinition.id],
  }),
  triggeredByUser: one(user, {
    fields: [workflowInstance.triggeredBy],
    references: [user.id],
  }),
  stepExecutions: many(workflowStepExecution),
  eventLogs: many(workflowEventLog),
  approvals: many(workflowApproval),
}));

export const workflowStepExecutionRelations = relations(workflowStepExecution, ({ one, many }) => ({
  instance: one(workflowInstance, {
    fields: [workflowStepExecution.instanceId],
    references: [workflowInstance.id],
  }),
  eventLogs: many(workflowEventLog),
  approval: one(workflowApproval, {
    fields: [workflowStepExecution.id],
    references: [workflowApproval.stepExecutionId],
  }),
}));

export const workflowEventLogRelations = relations(workflowEventLog, ({ one }) => ({
  instance: one(workflowInstance, {
    fields: [workflowEventLog.instanceId],
    references: [workflowInstance.id],
  }),
  stepExecution: one(workflowStepExecution, {
    fields: [workflowEventLog.stepExecutionId],
    references: [workflowStepExecution.id],
  }),
  actor: one(user, {
    fields: [workflowEventLog.actorId],
    references: [user.id],
  }),
}));

export const workflowScheduledRunRelations = relations(workflowScheduledRun, ({ one }) => ({
  definition: one(workflowDefinition, {
    fields: [workflowScheduledRun.definitionId],
    references: [workflowDefinition.id],
  }),
  lastRunInstance: one(workflowInstance, {
    fields: [workflowScheduledRun.lastRunInstanceId],
    references: [workflowInstance.id],
  }),
}));

export const workflowApprovalRelations = relations(workflowApproval, ({ one }) => ({
  instance: one(workflowInstance, {
    fields: [workflowApproval.instanceId],
    references: [workflowInstance.id],
  }),
  stepExecution: one(workflowStepExecution, {
    fields: [workflowApproval.stepExecutionId],
    references: [workflowStepExecution.id],
  }),
  approver: one(user, {
    fields: [workflowApproval.approverId],
    references: [user.id],
  }),
}));

// Workflow Type Exports
export type WorkflowDefinition = typeof workflowDefinition.$inferSelect;
export type CreateWorkflowDefinitionData = typeof workflowDefinition.$inferInsert;
export type UpdateWorkflowDefinitionData = Partial<
  Omit<CreateWorkflowDefinitionData, "id" | "createdAt" | "createdBy">
>;

export type WorkflowInstance = typeof workflowInstance.$inferSelect;
export type CreateWorkflowInstanceData = typeof workflowInstance.$inferInsert;
export type UpdateWorkflowInstanceData = Partial<
  Omit<CreateWorkflowInstanceData, "id" | "createdAt" | "definitionId">
>;

export type WorkflowStepExecution = typeof workflowStepExecution.$inferSelect;
export type CreateWorkflowStepExecutionData = typeof workflowStepExecution.$inferInsert;
export type UpdateWorkflowStepExecutionData = Partial<
  Omit<CreateWorkflowStepExecutionData, "id" | "createdAt" | "instanceId">
>;

export type WorkflowEventLog = typeof workflowEventLog.$inferSelect;
export type CreateWorkflowEventLogData = typeof workflowEventLog.$inferInsert;

export type WorkflowScheduledRun = typeof workflowScheduledRun.$inferSelect;
export type CreateWorkflowScheduledRunData = typeof workflowScheduledRun.$inferInsert;
export type UpdateWorkflowScheduledRunData = Partial<
  Omit<CreateWorkflowScheduledRunData, "id" | "createdAt" | "definitionId">
>;

export type WorkflowApproval = typeof workflowApproval.$inferSelect;
export type CreateWorkflowApprovalData = typeof workflowApproval.$inferInsert;
export type UpdateWorkflowApprovalData = Partial<
  Omit<CreateWorkflowApprovalData, "id" | "createdAt" | "instanceId" | "stepExecutionId">
>;

// Workflow Step Definition Type (stored as JSON in workflowDefinition.steps)
export type WorkflowStepDefinition = {
  id: string;
  name: string;
  type: WorkflowStepType;
  config: WorkflowStepConfig;
  onSuccess?: string; // Next step ID on success
  onFailure?: string; // Next step ID on failure (or "fail" to fail the workflow)
  timeout?: number; // Step timeout in seconds
  retryConfig?: {
    maxRetries: number;
    retryDelaySeconds: number;
  };
};

// Step configuration types
export type WorkflowStepConfig =
  | WorkflowActionConfig
  | WorkflowConditionConfig
  | WorkflowBranchConfig
  | WorkflowWaitConfig
  | WorkflowLoopConfig
  | WorkflowParallelConfig
  | WorkflowApprovalConfig
  | WorkflowNotificationConfig
  | WorkflowIntegrationConfig;

export type WorkflowActionConfig = {
  actionType: WorkflowActionType;
  params: Record<string, unknown>;
};

export type WorkflowConditionConfig = {
  conditions: Array<{
    field: string;
    operator: WorkflowConditionOperator;
    value: unknown;
  }>;
  logic: "and" | "or";
  onTrue: string; // Step ID to go to if true
  onFalse: string; // Step ID to go to if false
};

export type WorkflowBranchConfig = {
  branches: Array<{
    name: string;
    conditions: Array<{
      field: string;
      operator: WorkflowConditionOperator;
      value: unknown;
    }>;
    logic: "and" | "or";
    targetStepId: string;
  }>;
  defaultBranch: string; // Default step ID if no branch matches
};

export type WorkflowWaitConfig = {
  waitType: "duration" | "until_date" | "until_condition";
  durationSeconds?: number;
  untilDate?: string; // ISO date string or variable reference
  untilCondition?: {
    field: string;
    operator: WorkflowConditionOperator;
    value: unknown;
  };
};

export type WorkflowLoopConfig = {
  loopType: "for_each" | "while";
  collection?: string; // Variable path to iterate over
  condition?: {
    field: string;
    operator: WorkflowConditionOperator;
    value: unknown;
  };
  maxIterations: number;
  loopSteps: string[]; // Step IDs to execute in loop
};

export type WorkflowParallelConfig = {
  parallelSteps: string[]; // Step IDs to execute in parallel
  waitForAll: boolean; // Wait for all to complete or just one
};

export type WorkflowApprovalConfig = {
  approverIds: string[]; // User IDs of potential approvers
  approverRole?: string; // Or role-based approval
  requiredApprovals: number; // How many approvals needed
  timeoutHours: number;
  onTimeout: "approve" | "reject" | "escalate";
  escalateTo?: string; // User ID for escalation
};

export type WorkflowNotificationConfig = {
  channel: "email" | "push" | "in_app" | "sms";
  recipientType: "user" | "role" | "variable";
  recipientValue: string;
  template: string;
  variables?: Record<string, string>;
};

export type WorkflowIntegrationConfig = {
  integrationType: "odoo" | "aiom" | "http";
  operation: string;
  params: Record<string, unknown>;
};

// Workflow Constants
export const WORKFLOW_DEFINITION_STATUSES = ["draft", "active", "paused", "archived"] as const;
export const WORKFLOW_INSTANCE_STATUSES = ["pending", "running", "paused", "completed", "failed", "cancelled"] as const;
export const WORKFLOW_STEP_TYPES = ["action", "condition", "branch", "wait", "loop", "parallel", "approval", "notification", "integration"] as const;
export const WORKFLOW_STEP_STATUSES = ["pending", "running", "completed", "failed", "skipped", "waiting"] as const;
export const WORKFLOW_TRIGGER_TYPES = ["manual", "schedule", "event", "webhook", "api"] as const;
export const WORKFLOW_ACTION_TYPES = [
  "odoo_create", "odoo_update", "odoo_delete", "odoo_search",
  "aiom_task_create", "aiom_notification", "aiom_expense_approve", "aiom_expense_reject",
  "http_request", "email_send", "delay", "set_variable", "custom_script"
] as const;
export const WORKFLOW_CONDITION_OPERATORS = [
  "equals", "not_equals", "greater_than", "less_than",
  "greater_than_or_equals", "less_than_or_equals",
  "contains", "not_contains", "starts_with", "ends_with",
  "is_empty", "is_not_empty", "in", "not_in", "regex_match"
] as const;

// =============================================================================
// Demo Environment - Isolated sandbox with synthetic data
// =============================================================================

// Demo User Role types - mirrors production roles
export type DemoUserRole = "md" | "field-tech" | "admin" | "sales";
export const DEMO_USER_ROLES: readonly DemoUserRole[] = ["md", "field-tech", "admin", "sales"] as const;

// Demo Session table - For managing demo user sessions (separate from production)
export const demoSession = pgTable(
  "demo_session",
  {
    id: text("id").primaryKey(),
    // Demo user identification
    demoUserEmail: text("demo_user_email").notNull(),
    demoUserName: text("demo_user_name").notNull(),
    demoUserRole: text("demo_user_role").notNull(),

    // Session token for authentication
    token: text("token").notNull().unique(),

    // Session validity
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    lastAccessedAt: timestamp("last_accessed_at")
      .$defaultFn(() => new Date())
      .notNull(),

    // Session metadata
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    // Track demo activity
    actionsCount: integer("actions_count")
      .$default(() => 0)
      .notNull(),
  },
  (table) => [
    index("idx_demo_session_token").on(table.token),
    index("idx_demo_session_email").on(table.demoUserEmail),
    index("idx_demo_session_expires").on(table.expiresAt),
  ]
);

// Demo Session type exports
export type DemoSession = typeof demoSession.$inferSelect;
export type CreateDemoSessionData = typeof demoSession.$inferInsert;
export type UpdateDemoSessionData = Partial<Omit<CreateDemoSessionData, "id" | "createdAt">>;

// Demo Data Snapshot table - Tracks synthetic data states
export const demoDataSnapshot = pgTable(
  "demo_data_snapshot",
  {
    id: text("id").primaryKey(),
    // Snapshot identification
    snapshotName: text("snapshot_name").notNull(),
    description: text("description"),

    // Data content (JSON serialized)
    dataContent: jsonb("data_content").notNull(),
    dataType: text("data_type").notNull(), // e.g., "expenses", "work_orders", "customers"

    // Version tracking
    version: integer("version")
      .$default(() => 1)
      .notNull(),

    // Timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),

    // Active flag for selecting which snapshot to use
    isActive: boolean("is_active")
      .$default(() => false)
      .notNull(),
  },
  (table) => [
    index("idx_demo_data_snapshot_name").on(table.snapshotName),
    index("idx_demo_data_snapshot_type").on(table.dataType),
    index("idx_demo_data_snapshot_active").on(table.isActive),
  ]
);

// Demo Data Snapshot type exports
export type DemoDataSnapshot = typeof demoDataSnapshot.$inferSelect;
export type CreateDemoDataSnapshotData = typeof demoDataSnapshot.$inferInsert;
export type UpdateDemoDataSnapshotData = Partial<Omit<CreateDemoDataSnapshotData, "id" | "createdAt">>;

// Demo Activity Log table - Track demo user activities for analytics
export const demoActivityLog = pgTable(
  "demo_activity_log",
  {
    id: text("id").primaryKey(),
    // Session reference
    sessionId: text("session_id")
      .notNull()
      .references(() => demoSession.id, { onDelete: "cascade" }),

    // Activity details
    action: text("action").notNull(), // e.g., "view_dashboard", "create_expense", "approve_request"
    resourceType: text("resource_type"), // e.g., "expense", "work_order", "customer"
    resourceId: text("resource_id"),

    // Additional context
    metadata: jsonb("metadata"),

    // Timestamp
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_demo_activity_session").on(table.sessionId),
    index("idx_demo_activity_action").on(table.action),
    index("idx_demo_activity_created").on(table.createdAt),
  ]
);

// Demo Activity Log type exports
export type DemoActivityLog = typeof demoActivityLog.$inferSelect;
export type CreateDemoActivityLogData = typeof demoActivityLog.$inferInsert;

// Demo Session Relations
export const demoSessionRelations = relations(demoSession, ({ many }) => ({
  activityLogs: many(demoActivityLog),
}));

export const demoActivityLogRelations = relations(demoActivityLog, ({ one }) => ({
  session: one(demoSession, {
    fields: [demoActivityLog.sessionId],
    references: [demoSession.id],
  }),
}));

// ============================================================================
// Events / Calendar Table
// ============================================================================

// Event table - Calendar events and meetings
export const event = pgTable(
  "event",
  {
    id: text("id")
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),

    // Event details
    title: text("title").notNull(),
    description: text("description"),

    // Timing
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),

    // Optional meeting link
    eventLink: text("event_link"),

    // Event type/category
    eventType: text("event_type").notNull(), // e.g., "meeting", "call", "deadline", etc.

    // Creator tracking
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),

    // Timestamps
    createdAt: timestamp("created_at")
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at")
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_event_start_time").on(table.startTime),
    index("idx_event_created_by").on(table.createdBy),
    index("idx_event_type").on(table.eventType),
  ]
);

// Event type exports
export type Event = typeof event.$inferSelect;
export type CreateEventData = typeof event.$inferInsert;
export type UpdateEventData = Partial<Omit<CreateEventData, "id" | "createdAt">>;

// Event Relations
export const eventRelations = relations(event, ({ one }) => ({
  creator: one(user, {
    fields: [event.createdBy],
    references: [user.id],
  }),
}));
