---
tags: [database]
summary: database implementation decisions and patterns
relevantTo: [database]
importance: 0.7
relatedFiles: []
usageStats:
  loaded: 42
  referenced: 2
  successfulFeatures: 2
---
# database

### Amount field stored as TEXT instead of NUMERIC/DECIMAL type (2026-01-16)
- **Context:** Representing financial amounts in database schema for expense requests
- **Why:** Preserves decimal precision without floating-point arithmetic errors that plague numeric types in databases
- **Rejected:** DECIMAL/NUMERIC types - while native, they can introduce rounding errors in certain database systems and require explicit scale/precision configuration
- **Trade-offs:** Easier: precision preservation, no configuration needed. Harder: requires application-level type conversion, cannot use native SQL arithmetic
- **Breaking if changed:** Changing to NUMERIC forces schema migration, breaks any SQL queries that do direct arithmetic on amount field, requires application code changes for conversions

### Asymmetric foreign key cascade behavior: requesterId cascades on delete, approverId sets to NULL (2026-01-16)
- **Context:** Handling user deletion when they have associated expense requests in both requester and approver roles
- **Why:** Distinguishes between operational users (requesters - whose deletion cascades to clean up their requests) vs. historical audit users (approvers - whose deletion preserves expense history for compliance)
- **Rejected:** Symmetric approach (both cascade or both null) - would either lose audit trail or force orphaned records
- **Trade-offs:** Easier: maintains expense history for audits even after approver deletion. Harder: increases complexity, requires understanding business logic difference between requester/approver roles
- **Breaking if changed:** Reversing the cascade direction violates audit requirements - approver history loss would break compliance, approver cascade would lose request traceability

### Multiple timestamp fields (createdAt, submittedAt, approvedAt, rejectedAt, disbursedAt) instead of single status transition timestamp (2026-01-16)
- **Context:** Tracking expense request workflow state changes across multiple stages
- **Why:** Enables querying by workflow stage timing (e.g., approval duration, disbursement delay), maintains complete state history without requiring separate audit log table
- **Rejected:** Single 'statusChangedAt' timestamp - loses granularity about specific workflow transitions, requires separate audit table for history
- **Trade-offs:** Easier: query performance for stage-specific analytics without joins. Harder: more columns, null management for conditional timestamps, discipline required to update correct field
- **Breaking if changed:** Removing any timestamp field loses ability to query that specific workflow stage duration, breaks reporting on approval latency or disbursement timing

### Selective indexing on requesterId, approverId, and status but NOT on timestamps (2026-01-16)
- **Context:** Optimizing query patterns for expense request lookups
- **Why:** Foreign key filtering (who requested, who approved) and status filtering are common WHERE clause patterns; timestamp range queries on createdAt less frequent than categorical filters
- **Rejected:** Index on all timestamp fields - adds write overhead without matching read patterns; index on every column - diminishing returns
- **Trade-offs:** Easier: faster user-centric queries and status transitions. Harder: date range queries full-table scan, requires application-level post-filtering for temporal queries
- **Breaking if changed:** Removing FK indexes severely degrades join performance with user table; removing status index breaks status-based reporting queries

#### [Pattern] Drizzle ORM dual-direction relations (table relations AND reverse relations on both sides) (2026-01-16)
- **Problem solved:** Querying expense requests from both user perspective (what expenses did I request/approve) and request perspective (who requested/approved this)
- **Why this works:** Enables bidirectional eager loading; allows 'user.expenseRequests' AND 'expenseRequest.requester' without query direction friction
- **Trade-offs:** Easier: intuitive query direction regardless of entry point. Harder: relationship definition duplication, synchronization required if relations change

### Currency field with default value 'USD' rather than NOT NULL without default (2026-01-16)
- **Context:** Storing currency as optional metadata on expense requests
- **Why:** Allows multi-currency support while defaulting to single currency for majority use case; prevents NULL handling in application code for single-currency scenarios
- **Rejected:** NOT NULL without default - forces every insert to specify currency even if always USD; NULL currency - creates application logic branching
- **Trade-offs:** Easier: optional column specification in inserts, no NULL coalescing needed. Harder: hidden assumption in code about default currency, migration risk if default changes
- **Breaking if changed:** Removing default forces all existing queries to handle NULL currency; changing default breaks existing multi-currency logic that relies on USD default

### Separate callTimestamp from createdAt/updatedAt timestamps in the call record schema (2026-01-16)
- **Context:** Call records need to capture when the actual call occurred (callTimestamp) vs when the record was created/updated in the system
- **Why:** Call data may be ingested asynchronously from a telephony provider. The callTimestamp represents the actual call event time, while createdAt represents when the record was persisted. This separation enables accurate historical analysis and prevents timezone/timing confusion when calls are backfilled or imported.
- **Rejected:** Using createdAt as the call time assumes synchronous call logging, which breaks for async integration patterns with third-party telephony systems
- **Trade-offs:** Requires more careful timestamp handling in queries and analytics, but enables accurate temporal ordering of calls regardless of system processing delays
- **Breaking if changed:** If removed, any analytics on call patterns by time-of-day will be shifted to system processing time rather than actual call time, making metrics meaningless

#### [Pattern] Optional AI-generated summary with separate summaryGeneratedAt timestamp for async processing (2026-01-16)
- **Problem solved:** AI summary generation is computationally expensive and shouldn't block call record creation
- **Why this works:** By making summary optional and adding summaryGeneratedAt, the system can create the call record immediately, then generate summaries asynchronously. The summaryGeneratedAt timestamp proves the summary was generated rather than assuming it exists.
- **Trade-offs:** Adds complexity of handling null summaries and requiring a separate batch job, but decouples record creation from summary generation processing

### Included externalCallId field to link to third-party telephony provider identifiers (2026-01-16)
- **Context:** Call records originate from external telephony systems that have their own call identifiers
- **Why:** Enables bidirectional linking to source system for debugging, webhook reconciliation, and audit trails. Critical for identifying which external call a record corresponds to, especially important for async reconciliation or when handling duplicate prevention.
- **Rejected:** Could have relied solely on internal ID, but this creates operational friction when debugging call issues with the telephony provider
- **Trade-offs:** Adds a field that's only used for integration scenarios, but eliminates the need for separate mapping tables or external lookups
- **Breaking if changed:** Without externalCallId, debugging call discrepancies with the provider requires complex joins or external tools, and duplicate detection becomes unreliable

#### [Pattern] Composite index on (userId, callTimestamp) instead of separate indexes (2026-01-16)
- **Problem solved:** Most common queries filter by user and then by time range for pagination/sorting
- **Why this works:** A composite index on (userId, callTimestamp) allows efficient filtering by user with built-in ordering by call time, making range queries on timestamps efficient. This is better than separate indexes because the query planner can use one index for both conditions.
- **Trade-offs:** The composite index is more specific and uses more storage, but dramatically improves performance for the common access pattern of 'get user's calls from date X to Y'

#### [Pattern] Filtering support for hasSummary and hasRecording boolean flags instead of just null checks (2026-01-16)
- **Problem solved:** Need to query for calls that need processing (missing summaries or recordings)
- **Why this works:** Boolean filter flags (hasSummary, hasRecording) in CallRecordFilters enable efficient batch queries without exposing null-handling logic to consumers. This supports async processing patterns where you need 'find all calls without summaries for batch processing'.
- **Trade-offs:** Data-access layer becomes more complex with helper methods, but consumers get cleaner, more expressive query APIs

### Content stored as JSON string in text column rather than native JSON type (2026-01-16)
- **Context:** Choosing storage format for briefing content that may contain complex structured data
- **Why:** Text column with JSON.parse() on retrieval provides cross-database compatibility and explicit serialization control. Native JSON types vary significantly between databases (PostgreSQL vs SQLite vs MySQL).
- **Rejected:** Native JSON column type would reduce parsing overhead but creates vendor lock-in and requires different queries per database
- **Trade-offs:** Slightly slower queries (requires parsing) but gains database agnostic schema and explicit control over serialization format
- **Breaking if changed:** Switching to native JSON types requires schema migration and changes all read queries; existing data needs conversion

#### [Pattern] Separate briefing_version table with snapshot pattern for versioning instead of audit log (2026-01-16)
- **Problem solved:** Tracking briefing regenerations and allowing users to view historical versions
- **Why this works:** Snapshot pattern stores complete briefing state at each version point. Enables efficient retrieval of any past version without reconstruction. Cleaner separation from mutable current briefing state.
- **Trade-offs:** Uses more storage per version but enables O(1) version retrieval vs O(n) replay. Simpler queries but requires explicit snapshot on each regeneration.

### expiresAt field marked required on briefing creation despite soft-expiry through status field (2026-01-16)
- **Context:** Managing briefing lifecycle with both expiration date and status flag (active/expired)
- **Why:** Forcing expiresAt on creation ensures every briefing has defined lifetime. Prevents accidental indefinite briefings. Status field allows soft-delete without removing data.
- **Rejected:** Making expiresAt optional would allow indefinite briefings, requiring separate mechanism to prevent unbounded data growth
- **Trade-offs:** Harder to create test briefings (must supply date) but cleaner data governance. Status field allows replay of expiration logic.
- **Breaking if changed:** Making expiresAt optional requires policy for handling briefings without expiration; queries must account for null case

#### [Pattern] Comprehensive foreign key constraints with cascade delete rather than soft deletes (2026-01-16)
- **Problem solved:** Managing data consistency when users or briefings are deleted
- **Why this works:** Cascade delete enforces referential integrity automatically. Simpler model: deletion is deletion. Avoids orphaned version records.
- **Trade-offs:** Data loss on user deletion cannot be recovered; soft deletes would allow recovery but add complexity to all queries

### Used text-based JSON storage for complex fields (inputArguments, outputResult, contextValue, responsePreferences, defaultSystemPrompt) rather than native JSON columns or separate tables (2026-01-16)
- **Context:** AI conversation system needs flexible, nested data structures for tool inputs/outputs and user preferences that vary significantly
- **Why:** JSON-as-text provides schema flexibility for evolving AI tool APIs and user preference structures without schema migrations; avoids over-normalization of highly variable data
- **Rejected:** Native JSON columns would be more queryable; separate tables for each preference type would enforce strict schemas
- **Trade-offs:** Easier schema evolution and reduced schema churn, but harder to query and filter nested properties; requires application-level deserialization
- **Breaking if changed:** If switching to native JSON columns, all parsing/serialization logic in application layer must be rewritten; existing data requires migration

### Implemented soft-delete pattern via deletedAt timestamp on ai_conversation rather than hard delete or separate archive table (2026-01-16)
- **Context:** Conversation history must be retained for user replay/audit while supporting logical deletion from active queries
- **Why:** Soft deletes preserve historical data for compliance and recovery, avoid orphaning child records (messages, tool calls), and allow simple WHERE clause filtering
- **Rejected:** Hard delete would lose conversation history; separate archive table creates maintenance burden and schema complexity
- **Trade-offs:** Simpler queries with archive table, but more complex migrations when data ages; soft deletes require defensive filtering on every query
- **Breaking if changed:** Adding index on (deletedAt, userId) is critical - without it, queries will scan archived records; forgetting deletedAt in WHERE clauses returns deleted data

#### [Pattern] Message sequencing via sequenceNumber within conversation scope rather than global timestamps for ordering (2026-01-16)
- **Problem solved:** Conversations must maintain stable message order even with concurrent writes; timestamps are unreliable for ordering due to clock skew and concurrent inserts
- **Why this works:** Sequence numbers provide deterministic, immutable ordering independent of timing; enables reliable pagination and branching via parentMessageId
- **Trade-offs:** Requires application logic to increment sequences on insert (risk of gaps), but provides portable solution across databases

#### [Gotcha] Token usage fields (totalTokensUsed, totalInputTokens, totalOutputTokens on ai_conversation, plus inputTokenCount/outputTokenCount on ai_message) create redundancy and consistency risk (2026-01-16)
- **Situation:** Need to track token usage for cost allocation and rate limiting across both individual messages and conversations
- **Root cause:** Conversation-level totals provide quick access for rate limiting without aggregating; message-level counts enable detailed billing analysis
- **How to avoid:** Redundant data enables fast queries but requires triggers or application logic to keep totals synchronized

### Separated ai_user_preference as dedicated table rather than embedding preferences in users table or storing as JSON blob on user record (2026-01-16)
- **Context:** AI-specific settings (enableContextMemory, maxContextMessages, saveConversationHistory, allowDataTraining) are optional and frequently updated
- **Why:** Dedicated table allows nullable preferences for users who never touch AI settings; future preferences can be added without schema migration; changes are tracked via updatedAt
- **Rejected:** Embedding in users table would require NOT NULL defaults and bloat user queries; JSON blob loses individual field updateability
- **Trade-offs:** Additional JOIN required on every preference query, but preferences are independent of user entity lifecycle
- **Breaking if changed:** Deleting users must handle preference cascade delete; missing preference record means defaults must be hardcoded in application

#### [Pattern] Context metadata via separate ai_conversation_context table with contextType/contextKey/priority organization rather than storing context in single JSON field on ai_conversation (2026-01-16)
- **Problem solved:** Conversations need multiple heterogeneous context items (user_info, system_settings, chat_state, etc.) with individual expiration and priority
- **Why this works:** Separate table enables querying contexts by type, expiring contexts independently via expiresAt, and ordering by priority without parsing JSON; scales better than monolithic blob
- **Trade-offs:** More queries to load full context state, but enables fine-grained control and better garbage collection

#### [Gotcha] Tool call status field allows 'pending' -> 'running' -> 'completed'/'failed' transitions, but no enforcement prevents invalid state transitions (e.g., 'completed' -> 'running') (2026-01-16)
- **Situation:** Tool calls must track execution lifecycle from initial invocation through completion or failure
- **Root cause:** Simple string status enum is flexible for retries and error recovery; database constraints on state transitions would be complex
- **How to avoid:** Simpler schema and more operational flexibility, but application must enforce valid transitions

### Stored toolCallId as separate field from internal id despite both being unique identifiers for tool calls (2026-01-16)
- **Context:** Tool invocations have both an internal database ID and an external AI provider ID (e.g., OpenAI's tool_call_id)
- **Why:** Maintaining both allows correlating provider responses back to database records; external ID may not be stable or available at insert time
- **Rejected:** Using only external toolCallId would create dependency on provider's ID scheme; using only internal id loses ability to match provider callbacks
- **Trade-offs:** Extra field and potential uniqueness constraints, but enables bidirectional mapping to external systems
- **Breaking if changed:** Application must populate toolCallId from provider response; missing toolCallId makes it impossible to correlate tool outputs with invocations

#### [Pattern] Tool call timing tracked via startedAt/completedAt timestamps and computed durationMs rather than relying on timestamps alone (2026-01-16)
- **Problem solved:** Need to understand tool execution duration for performance optimization and debugging
- **Why this works:** Explicit durationMs field avoids time calculation errors and clock skew issues; supports queries on slow tools without date arithmetic
- **Trade-offs:** Redundant data but queryable without functions; durationMs must be computed and stored by application

### Used IndexedDB as client-side persistent storage for offline queue instead of memory-only or localStorage (2026-01-16)
- **Context:** Needed durable queue that survives page refreshes and handles large datasets during offline periods
- **Why:** IndexedDB provides: (1) Larger storage quota (~50MB+) vs localStorage (~5-10MB), (2) Structured queries via indexes for efficient filtering/sorting by status/priority/timestamp, (3) Transactions for atomicity when batch-processing queue items, (4) Doesn't block main thread unlike synchronous localStorage
- **Rejected:** localStorage would overflow quickly with typical queue sizes; in-memory would lose state on refresh; SQLite.js would add unnecessary complexity for client-side-only data
- **Trade-offs:** Added complexity of managing async database lifecycle vs simplicity of memory storage; requires origin (file:// protocol needed special handling in tests); query capabilities gained outweigh async API overhead
- **Breaking if changed:** Switching to localStorage would fail with queues >100 items; using memory-only would require full resync on every page load/crash

### Queue uses priority + FIFO ordering within same priority instead of pure timestamp ordering (2026-01-16)
- **Context:** Offline queue must respect both urgency (critical fixes before normal operations) and order within same priority level
- **Why:** Priority levels prevent starvation of critical operations while FIFO within priority maintains causality (e.g., all normal-priority expense updates sync in order received)
- **Rejected:** Pure timestamp would make critical operations wait behind older normal operations; pure priority without FIFO could reorder causally-related operations
- **Trade-offs:** Sorting complexity slightly higher; requires maintaining both priority and insertedAt; but prevents both starvation and ordering bugs
- **Breaking if changed:** Removing priority would require different conflict resolution for concurrent operations; removing FIFO within priority could cause race conditions in dependent operations

#### [Pattern] Data-access layer provides entity-specific helpers (queueCreate, queueUpdate, queueDelete) wrapping generic add/update/delete with type safety (2026-01-16)
- **Problem solved:** Needed safe API that prevents adding invalid operations or forgetting required fields
- **Why this works:** Helpers: (1) Type-safe - TypeScript catches wrong entity types, (2) Default values - automatically sets timestamps, sync status, priority, (3) Validation - checks required fields, (4) Single source of truth for operation creation
- **Trade-offs:** More boilerplate but prevents entire classes of bugs; easier to add validation rules later in one place

#### [Pattern] Separate deliveryTracking table instead of storing status on pushMessage records (2026-01-16)
- **Problem solved:** Push notifications sent to multiple devices; need per-device delivery tracking
- **Why this works:** One pushMessage → many devices. Storing status per device on pushMessage would require JSON arrays or duplicating entire message per device. Separate table enables efficient querying ('show messages delivered to 50% of devices'), atomic updates, and proper indexing by device.
- **Trade-offs:** Extra table/joins needed but eliminates N+1 queries and enables granular retry logic per device

#### [Gotcha] Urgency field is included in form validation schema but NOT persisted to database - schema validates it but server functions don't store it (2026-01-16)
- **Situation:** Form collects urgency level (low/medium/high/critical) and validates against EXPENSE_URGENCY_LEVELS enum, but the database schema for expense_request table doesn't have an urgency column.
- **Root cause:** Implementation follows form-first approach without confirming database schema alignment. Validation schema was created comprehensively before verifying all fields were actually persisted.
- **How to avoid:** Form validates unnecessary data (technical correctness) vs silently discarding user input (user experience issue). Requires database migration to become functional.

### Separate tables for deviceToken, pushMessage, and deliveryTracking instead of single notification table with denormalized data (2026-01-16)
- **Context:** Push notifications need to track which devices received which messages, handle delivery retries, and audit trails
- **Why:** Normalization allows independent scaling: devices table grows with users, pushMessage grows with campaigns, deliveryTracking grows with devices×messages. Separate tables allow indexing strategies per table (e.g., index deliveryTracking by status and timestamp for retry queries)
- **Rejected:** Single notifications table with JSONB device array and status array. Simple for small scale but becomes inefficient at scale when querying 'all failed deliveries in last hour' - must scan entire table
- **Trade-offs:** 3 joins required for full notification audit. Simpler queries get more complex. But retry queries become fast indexes instead of JSONB scans
- **Breaking if changed:** If you collapse deliveryTracking into pushMessage, retry processing becomes O(n×m) scans. If you collapse deviceToken into notifications, adding a device to user becomes O(total notifications) instead of single insert

### Separate promptTemplateUsage table instead of storing stats as JSON in promptTemplate (2026-01-16)
- **Context:** Templates can be executed dozens of times; need to track usage patterns and calculate cost savings
- **Why:** Enables efficient querying by time period, cost ranges, usage frequency. Allows analytical queries without parsing JSON. Separate table allows indexing on frequently-queried fields (templateId, createdAt, cost).
- **Rejected:** Storing usage as JSON array in template record would bloat the row and make queries slow. Analytics queries would require expensive JSON parsing.
- **Trade-offs:** More tables and joins. Slightly more complex data access layer. But dramatic improvement in query performance for analytics use cases.
- **Breaking if changed:** Removing usage table loses all historical analytics. Cannot retroactively calculate cost savings or usage trends.

### Used JSON array for receipt attachments instead of separate relational table (2026-01-16)
- **Context:** Storing multiple receipt files per voucher with metadata (filename, upload date, size)
- **Why:** Receipts are denormalized data with variable structure; receipts rarely queried independently; reduces join complexity for common voucher retrieval patterns; simpler schema maintenance
- **Rejected:** Separate expense_voucher_receipts table with foreign key - would require JOIN operations and complicate voucher updates
- **Trade-offs:** Easier for reads/writes of complete voucher; harder to query across receipts independently or enforce referential integrity; cannot index receipt properties directly
- **Breaking if changed:** Switching to relational table requires schema migration, affects all queries that currently access receipts, changes API response structure

### Generated voucher number (EV-YYYY-XXXXX) stored in database rather than computed at query time (2026-01-16)
- **Context:** Voucher number serves as external reference for GL systems and audit trails
- **Why:** Must be stable/immutable reference; GL systems expect consistent identifiers; enables efficient lookup by voucher number; prevents race conditions in auto-increment generation
- **Rejected:** Compute from ID at query time - risks inconsistency if generation logic changes; breaks GL system references; harder to index for external system lookups
- **Trade-offs:** Storage cost minimal (string column); guarantees audit trail integrity; requires migration logic to handle retroactive generation
- **Breaking if changed:** Changing format breaks GL system integrations expecting EV-YYYY-XXXXX pattern; existing references become invalid

#### [Gotcha] GL mapping fields (glAccountCode, glAccountName, costCenter, department, projectCode) stored redundantly in voucher record (2026-01-16)
- **Situation:** Data copied from expense request at voucher creation time; GL account master changes over time but voucher must preserve original mapping for audit/posting
- **Root cause:** Prevents ghost references if GL account deleted later; preserves audit trail of what was posted; GL posting system needs consistent account codes regardless of master changes; separate journal entry table may not exist when reconciling
- **How to avoid:** Storage redundancy; requires validation that GL codes exist at creation time; reconciliation must compare against GL account master carefully

#### [Gotcha] Multi-currency support with fixed enum values (USD, EUR, GBP, CAD, AUD, JPY, CHF) rather than reference table (2026-01-16)
- **Situation:** Business operates in multiple currencies; exchange rates change constantly; GL posting requires currency code stability
- **Root cause:** Fixed enum prevents invalid currency codes in GL system; simpler schema than currency reference table; covers 80% of actual use cases; avoids N+1 query on currency lookups
- **How to avoid:** Cannot add new currency without schema migration; slightly less flexible; requires code deployment to support new currency

### Used upsert operations (upsertChannel, upsertMessage) instead of separate insert/update logic (2026-01-16)
- **Context:** Syncing data from external Odoo API where records may already exist locally with potentially updated values
- **Why:** Upsert is idempotent - safe to call multiple times without checking existence first. Reduces race conditions where record might be inserted between existence check and insert attempt.
- **Rejected:** Check-then-insert pattern - vulnerable to race conditions; separate insert/update branches - more complex error handling
- **Trade-offs:** Requires appropriate unique constraints (likely on Odoo's remote_id). Single database operation instead of two reduces latency.
- **Breaking if changed:** If unique constraints aren't properly defined, upserts will fail silently or create duplicates instead of updating

### Three-table decomposition for workflow management: separate instance, event, and notification queue tables rather than storing all state in a single denormalized expense record (2026-01-16)
- **Context:** Expense workflow requires tracking state transitions, audit trail, and asynchronous notifications with retry logic
- **Why:** Separation of concerns allows independent scaling of audit logs, enables event sourcing patterns for compliance, and provides isolated retry logic for notifications without blocking state transitions
- **Rejected:** Single table with JSON event array or event field - would require full table updates on each transition and complex query logic for notification processing
- **Trade-offs:** Easier: auditing, notifications, compliance; Harder: single query to get full expense state (requires joins), slightly higher storage
- **Breaking if changed:** Removing event table breaks audit trail and compliance requirements; removing notification queue breaks asynchronous notification retry guarantees

#### [Pattern] SLA tracking columns (sla_due_at, escalated_at) at the instance level with configurable defaults per workflow stage rather than computed on-the-fly (2026-01-16)
- **Problem solved:** Workflow requires monitoring overdue approvals and escalating to supervisors
- **Why this works:** Pre-computing SLA deadlines at transition time enables efficient queries for 'overdue items' without scanning all workflow events, and provides historical SLA data for compliance. Escalation state is persistent and queryable
- **Trade-offs:** Easier: escalation queries, compliance reporting; Harder: updating SLA if policies change retroactively

### AI conversation context stored in separate table with expiration tracking rather than as JSON field in conversations table (2026-01-16)
- **Context:** Need to support dynamic metadata attachment to conversations with lifecycle management (cache expiration, cleanup)
- **Why:** Separate table allows: (1) independent expiration scheduling without full conversation updates, (2) multiple context entries per conversation, (3) efficient queries for expired contexts, (4) clean separation of concerns
- **Rejected:** Store context as JSON in conversations table - easier initially but prevents efficient expiration queries and makes partial updates complex
- **Trade-offs:** Requires JOIN for context retrieval but enables independent context lifecycle management. Query complexity increases slightly for context lookups.
- **Breaking if changed:** Merging back to JSON field requires migrating per-conversation context into JSON documents and losing ability to expire individual contexts

#### [Pattern] Created field constant arrays (PARTNER_SUMMARY_FIELDS, PARTNER_DETAIL_FIELDS, PARTNER_CONTACT_FIELDS) to control which Odoo model fields are fetched in each query (2026-01-16)
- **Problem solved:** Odoo res.partner model has 100+ fields; different use cases need different field subsets
- **Why this works:** Prevents over-fetching data from Odoo (improves query performance, reduces network load). Centralizes field management - changes to what summary includes happen in one place. Makes query intent explicit.
- **Trade-offs:** Requires maintaining three separate field lists (overhead), but provides performance and clarity. Must update constants when Odoo schema changes.

### Implemented dual versioning system (`serverVersion` and `localVersion`) for conflict detection rather than single timestamp (2026-01-16)
- **Context:** Contact sync needed to detect conflicts when both server and client modify the same record offline
- **Why:** Version numbers allow detection of 'lost updates' - when both sides modify independently. Timestamps alone cannot distinguish between local edits and server pushes. Versions explicitly track how many times each side has modified the record.
- **Rejected:** Single write_date timestamp - would only show last write, not whether both sides changed independently
- **Trade-offs:** Requires atomic version increments on every update (simpler conflict detection vs. more complex mutation logic). Type casting needed (`as unknown as number`) due to Drizzle's SQL expression typing constraints.
- **Breaking if changed:** Removing version tracking breaks conflict detection entirely - syncs would silently overwrite conflicting changes

#### [Gotcha] Drizzle ORM's typed update API rejects SQL expressions in set objects - requires casting through `unknown` (2026-01-16)
- **Situation:** Attempting `sql<number>\`${val} + 1\`` in `.set()` caused TypeScript errors
- **Root cause:** Drizzle's type system tries to ensure values match column types at compile time, but SQL expressions are runtime-evaluated. The workaround (`as unknown as number`) bypasses this safety to allow SQL generation.
- **How to avoid:** Type safety reduced locally but runtime behavior guaranteed correct. SQL query optimization preserved (single increment operation vs. multiple round trips).

#### [Pattern] Incremental sync strategy: track `lastSyncTimestamp` per user, fetch records where `write_date > lastSyncTimestamp` (2026-01-16)
- **Problem solved:** Mobile devices with intermittent connectivity need efficient sync avoiding full contact list transfer
- **Why this works:** Odoo's `write_date` provides server-side ordering of changes. Using watermark prevents fetching unchanged records. Scales to millions of contacts - only transfers deltas.
- **Trade-offs:** Requires clock synchronization between mobile and server (mitigation: use server time in response). More complex to handle deletions (need tombstones or separate delete log). Simpler for adds/updates.

#### [Gotcha] Attempt tracking requires counter increment, not just status flag - OTP retry limits need precise count (2026-01-16)
- **Situation:** Phone verification table includes attempts field to track failed verification attempts
- **Root cause:** Supports enforcement of max attempt limits (typically 3-5) before locking out user; single boolean insufficient
- **How to avoid:** Easier: clear enforcement of security policy. Harder: needs application logic to check limit before responding

### Reconciliation linking to expense requests made optional (not required field) (2026-01-16)
- **Context:** Vouchers can exist independently of expense requests, but can also reference them for tracking
- **Why:** Optional linking prevents blocking voucher creation on pre-requisite expense request existence, while enabling reconciliation when reference exists
- **Rejected:** Required expense request reference would force additional lookup before voucher creation or require creating dummy expense requests
- **Trade-offs:** More flexible workflow but requires handling both reconciled and unreconciled vouchers in reporting/analytics
- **Breaking if changed:** If reconciliation becomes required, all existing independent vouchers become invalid; if removed entirely, lose audit trail linking expenses to original requests

### Made role field nullable instead of required with default value (2026-01-16)
- **Context:** Extending existing user schema with new role field for backward compatibility
- **Why:** Allows existing users without assigned roles to continue functioning. Prevents need for complex data migration logic to assign default roles to all existing records
- **Rejected:** Adding NOT NULL constraint with DEFAULT 'md' - would force a role assignment strategy immediately and require UPDATE statements for all existing users
- **Trade-offs:** Easier: Gradual rollout without data migration; Harder: Must handle null case in all role-checking logic, cannot assume every user has a role
- **Breaking if changed:** If changed to NOT NULL, all queries expecting nullable roles will fail; existing users without roles would violate constraint

#### [Pattern] Added both application-level validation (isValidRole function) AND database-level CHECK constraint (2026-01-16)
- **Problem solved:** Ensuring only valid roles (md, field-tech, admin, sales) are stored in database
- **Why this works:** Defense in depth - application logic can be bypassed via direct SQL or other clients; CHECK constraint provides invariant guarantee at storage layer regardless of application version
- **Trade-offs:** Easier: Type safety and consistency guaranteed at multiple layers; Harder: Maintenance burden - must update both application constants AND database constraint when roles change

### Added index on role field alongside nullable column and CHECK constraint (2026-01-16)
- **Context:** New findUsersByRole() function needs to query users by their role efficiently
- **Why:** Without index, querying users by role becomes O(n) table scan. Index enables O(log n) lookups. Nullable columns can be indexed (NULL values are included)
- **Rejected:** Skipping index - acceptable if role queries are rare, but became necessary once findUsersByRole() was added as public function
- **Trade-offs:** Easier: Fast role-based queries; Harder: Index must be maintained on every INSERT/UPDATE/DELETE, increases storage footprint
- **Breaking if changed:** If index is removed, findUsersByRole() performance degrades significantly with large user tables; queries that were sub-second become seconds

### Encryption applied at data-access layer, not database layer (2026-01-16)
- **Context:** Could have used database-level encryption (transparent) or handled at application layer
- **Why:** Application-layer encryption gives explicit control over which fields are encrypted and allows key rotation without database re-encryption. Secrets never visible in database logs or backups unencrypted.
- **Rejected:** Database transparent encryption hides complexity but couples key management to database vendor. Column-level encryption requires database support.
- **Trade-offs:** Application layer requires code changes everywhere password is touched. Database layer is transparent but less flexible for key rotation.
- **Breaking if changed:** Removing application-layer encryption would mean passwords stored plaintext - any database access or backup exposure compromises all credentials.

### Encryption at rest for SIP passwords using AES-256-GCM before database storage, decrypted on retrieval rather than stored plaintext (2026-01-16)
- **Context:** SIP credentials stored in `sipCredential` table need protection against database compromise
- **Why:** Database breaches are common; encryption provides defense-in-depth. AES-256-GCM provides authenticated encryption (prevents tampering). Keys managed separately from data (through environment variables). Decryption happens in-process, not in SQL queries.
- **Rejected:** Plaintext storage would violate compliance requirements. Database-level encryption (TDE) provides less control - keys often managed by DB admin. Hashing passwords is irreversible (can't regenerate SIP credentials client-side).
- **Trade-offs:** Encryption adds CPU cost on read/write but negligible for typical workloads. Requires key rotation strategy. Database backups are useless without encryption key.
- **Breaking if changed:** If encryption key is lost or rotated without proper migration, all stored credentials become unreadable. If decryption is removed, credentials can't be used for SIP operations.

### Widget configurations stored as JSON in single column rather than normalized relational tables (2026-01-16)
- **Context:** Dashboard has variable number of widgets per role, each with different configurations (sizing, data sources, filters)
- **Why:** JSON allows flexible widget composition without schema changes for each new widget type. Avoids N+1 queries for loading widget instances. Dashboard config is typically read as a unit, not queried individually by widget
- **Rejected:** Normalized schema with dashboardWidgets junction table (requires joins, schema migrations for new widget properties, complicates updates)
- **Trade-offs:** Simpler writes and reads for full config, but harder to query 'find all dashboards with this widget type' or update single widget across dashboards. Cannot use database constraints on widget properties
- **Breaking if changed:** Switching to relational storage would require migrations and query rewrites; JSON indexing strategies would be lost

#### [Pattern] Call history service stores full call details locally with separate backend sync operation rather than always syncing immediately or only storing after call ends (2026-01-16)
- **Problem solved:** Call state changes frequently during active call; backend sync is expensive; history must be available instantly locally but eventually consistent remotely
- **Why this works:** Immediate local storage ensures history is available for display/statistics even if backend is unavailable or slow. Decoupled sync operation allows batching and retry logic. Supports offline operation
- **Trade-offs:** Requires dual-write logic and eventual consistency handling; simple sync logic; supports offline mode; transient inconsistency between local and backend is acceptable

#### [Pattern] Denormalized thread metadata (title, subtitle, avatar, lastMessagePreview) in unified inbox table rather than computing on read (2026-01-16)
- **Problem solved:** Inbox lists show 100+ threads requiring fast rendering with metadata
- **Why this works:** Reading thread list is much more frequent than writing. Denormalization eliminates joins to source tables on every list query. Pre-computed values like 'avatar' avoid N+1 queries to get participant info.
- **Trade-offs:** Easier: O(1) metadata access. Harder: sync functions must keep denormalized data fresh, adds storage overhead

#### [Gotcha] unreadCount stored as INTEGER column that must be manually kept in sync via sync functions (2026-01-16)
- **Situation:** Unread count aggregation requires reading message state from source tables
- **Root cause:** Direct COUNT query across sources on every inbox load would be expensive. Denormalizing allows O(1) access.
- **How to avoid:** Easier: fast inbox loads. Harder: unreadCount can drift if sync functions fail; requires careful handling in message update flows

#### [Gotcha] Role-based priority configuration embedded as constants in data-access module rather than database-driven (2026-01-16)
- **Situation:** Briefing data sources have different importance per user role (managers prioritize approvals, engineers prioritize tasks)
- **Root cause:** Avoids additional database lookups and configuration complexity. Role mappings are part of product logic, not per-user settings
- **How to avoid:** Easier performance and deployment, but role changes require code changes. Acceptable because role definitions are organizational structure, not user preference

### Store all monetary amounts as TEXT type rather than DECIMAL/NUMERIC for balance tracking, pending balance, and transaction amounts (2026-01-16)
- **Context:** Wallet system requires precise decimal handling for financial transactions across different currencies and conversion scenarios
- **Why:** TEXT storage preserves arbitrary decimal precision without database-specific rounding behavior. Avoids floating-point arithmetic errors that compound across transaction ledgers. Enables consistent precision across different database backends (PostgreSQL DECIMAL vs MySQL DECIMAL handling differs)
- **Rejected:** DECIMAL/NUMERIC types with fixed precision would require choosing a specific scale upfront, risking precision loss during currency conversions or when integrating with Reloadly (third-party transaction provider with variable decimal places)
- **Trade-offs:** Easier: decimal precision guaranteed, easier integration with external providers. Harder: requires application-layer parsing/validation, potential performance impact on large ledger queries needing SUM aggregations, no database-level type safety for amount fields
- **Breaking if changed:** Changing to DECIMAL would require data migration and application code changes to handle type conversions. SUM queries on text amounts would fail without explicit casting.

#### [Pattern] Balance snapshots (beforeBalance/afterBalance) stored on every transaction with running totals for daily/monthly limits (2026-01-16)
- **Problem solved:** Wallet must track transaction limits per KYC level while maintaining accurate reconciliation and preventing limit bypasses across distributed systems
- **Why this works:** Snapshots enable post-hoc audit verification without replaying transactions. Running totals (dailySpent, monthlySpent, singleTransactionUsed) prevent race conditions in concurrent transaction scenarios. If multiple transactions execute simultaneously, each captures its own balance state rather than relying on current wallet state which could be stale
- **Trade-offs:** Easier: O(1) limit checks, reconciliation via snapshots, audit trail preserved. Harder: more storage per transaction, must maintain consistency between wallet balances and transaction snapshots, requires careful ordering in distributed systems

### Use idempotency key (UUID) on transactions rather than relying on database-level uniqueness or timestamps (2026-01-16)
- **Context:** Integrating with external providers (Reloadly) and distributed transaction systems where exact-once processing is critical
- **Why:** Idempotency keys allow safe retries of failed API calls without duplicate transactions. Decouples transaction deduplication from implementation details (timestamp precision, clock skew, network delays). Enables idempotent API design where calling create-transaction twice with same idempotencyKey returns same result
- **Rejected:** Relying on timestamps would be vulnerable to clock skew. Relying on database INSERT UNIQUE constraints would prevent safe retries (second identical transaction would violate constraint rather than return idempotent result). Relying on applicationId alone insufficient if same external system ID can arrive via multiple paths
- **Trade-offs:** Easier: safe retries, idempotent APIs, integrates well with webhook retries from external providers. Harder: application must manage idempotency key lifecycle, requires database index on idempotencyKey for lookup performance
- **Breaking if changed:** Removing idempotency keys would make webhook retries from Reloadly create duplicate transactions. Would require circuit breaker logic at API level to prevent re-submission.

#### [Pattern] Separate counterpartWalletId field enabling same wallet to track incoming/outgoing transfers with linked transaction records (2026-01-16)
- **Problem solved:** Supporting peer-to-peer wallet transfers and internal transfers between user accounts without creating duplicate or orphaned transaction records
- **Why this works:** Bidirectional linking prevents orphaned transactions. Single transaction record (not two separate records) ensures atomicity—if one side fails, both fail; prevents state where money disappeared or appeared mysteriously. CounterpartWalletId enables querying 'who did I transfer to' without joining to another transaction record
- **Trade-offs:** Easier: atomic transfers at application level, clean reconciliation (sum of wallet transactions = actual balance). Harder: requires application logic to validate counterpart exists, cannot enforce foreign key integrity at database level if transfers can occur after wallet closure

#### [Gotcha] KYC level and transaction limits stored redundantly in both userWallet table AND enforced via separate kycLevel column instead of reference table (2026-01-16)
- **Situation:** Wallet schema design encountered ambiguity about whether KYC is mutable state or immutable level tier
- **Root cause:** KYC level (none/basic/intermediate/advanced) is immutable tier that determines transaction limits. Having it on userWallet table enables direct limit checks without joins. Storing limits themselves (dailyLimit, monthlyLimit, singleLimit) as dependent on kycLevel avoids join during transaction processing—critical path for every debit operation
- **How to avoid:** Easier: fast limit enforcement, no joins on critical path. Harder: must update limits when kycLevel changes (not automatic via reference), risk of inconsistency if limits diverge from level definition

#### [Pattern] Settings stored as JSON in userWallet instead of separate columns for extensibility and backwards compatibility (2026-01-16)
- **Problem solved:** Wallet settings (notifications, auto-freeze rules, spending alerts) may evolve differently across user cohorts or business rules may change frequently
- **Why this works:** JSON storage allows adding new settings without schema migration. Backwards compatible—old settings survive schema changes. Can vary per user (some enable auto-freeze, others don't) without requiring NULL-heavy schema. Query language can filter by settings without schema changes
- **Trade-offs:** Easier: extensible without migrations, per-user customization, backwards compatible. Harder: cannot index on settings (need functional indexes), queries more complex (JSON operators), no type safety at database level, settings documentation lives in code not schema

### Amount fields use TEXT type instead of DECIMAL/NUMERIC for transaction amounts (2026-01-16)
- **Context:** Wallet transactions require precise decimal handling across multiple currency types and fractional amounts
- **Why:** TEXT type preserves arbitrary decimal precision without floating-point rounding errors. Critical for financial transactions where even microsatoshi-level precision matters. Avoids database-specific decimal behaviors across different systems
- **Rejected:** DECIMAL/NUMERIC types which have precision limits and database-specific implementations (PostgreSQL vs SQLite vs MySQL handle decimals differently)
- **Trade-offs:** Gained: unlimited precision, portability, no rounding errors. Lost: native database arithmetic (must parse to decimal library in application), no built-in validation of numeric format, slightly larger storage footprint
- **Breaking if changed:** Changing to NUMERIC would cause: silent precision loss on existing amounts, incompatibility with high-precision cryptocurrencies, potential balance discrepancies in reconciliation

#### [Pattern] Idempotency implemented via unique constraint on idempotencyKey field rather than database-level deduplication or application-only checks (2026-01-16)
- **Problem solved:** Preventing duplicate wallet transactions when network retries or concurrent requests occur
- **Why this works:** Unique constraint is database-enforced, guarantees atomicity, prevents race conditions, and provides a single source of truth. Requires application to check before creation using findTransactionByIdempotencyKey(), but database constraint is the ultimate safeguard
- **Trade-offs:** Gained: atomic guarantee, race-condition proof, simple to verify. Lost: must pre-check before insert (two queries instead of one), idempotencyKey generation responsibility falls on caller

### Multiple timestamp fields (initiatedAt, processedAt, completedAt, createdAt, updatedAt) rather than single timestamp with state machine (2026-01-16)
- **Context:** Transaction lifecycle has distinct phases (submission, processing, completion) that need temporal tracking
- **Why:** Each timestamp captures when a specific state was entered, enabling precise timing analysis and debugging. Allows simultaneous tracking of business time (when initiated) vs system time (when created). Supports complex queries like 'transactions pending for >5 minutes'
- **Rejected:** Single createdAt + state field (loses transition timing), event-sourcing pattern (overly complex for this use case), calculated timestamps from status change events (harder to query)
- **Trade-offs:** Gained: precise phase timing, independent state/timestamp tracking, easier analytics. Lost: more fields to manage, requires discipline to set correct timestamps, potential inconsistencies if timestamps set incorrectly
- **Breaking if changed:** Removing initiatedAt would lose submission timing (can't distinguish between slow processing vs late completion). Removing processedAt loses processing duration metrics critical for SLA monitoring

#### [Pattern] Balance snapshots (balanceBefore, balanceAfter) stored denormalized in transaction record instead of calculated from transaction history (2026-01-16)
- **Problem solved:** Need to verify reconciliation and detect balance errors without replaying entire transaction history
- **Why this works:** Denormalization provides O(1) verification: can compare stored snapshots against current balance to detect errors. Replaying history is O(n) and fragile if transactions are modified. Snapshots are immutable proof of balance state at that moment
- **Trade-offs:** Gained: instant reconciliation verification, immutable proof, fast auditing. Lost: storage cost for duplicate data, must maintain data integrity (balanceAfter of transaction N must equal balanceBefore of transaction N+1)

### Separate reversal tracking fields (reversedAt, reversalReason, originalTransactionId) instead of creating new transaction with opposite amount (2026-01-16)
- **Context:** Wallet transactions may need to be reversed, requiring audit trail of the reversal event
- **Why:** Preserving original transaction with reversal metadata maintains immutability and audit chain. Reverse transactions create confusing double-entry accounting semantics. Links original→reversal via originalTransactionId forms clear lineage
- **Rejected:** Creating opposite-amount transactions (breaks ledger semantics, confusing for accounting), soft-delete pattern (loses original data visibility), reversal table join (more complex queries)
- **Trade-offs:** Gained: clear audit trail, immutable original record, transactional integrity. Lost: nullable fields for non-reversed transactions, must handle reversal logic explicitly
- **Breaking if changed:** Removing reversal fields would lose proof that transaction was intentionally reversed vs actually failed. Changing to opposite-transaction pattern would break double-entry accounting and make reconciliation ambiguous

#### [Gotcha] Transfer transactions require bidirectional tracking via counterpartWalletId and counterpartTransactionId, not just opposite-amount transactions (2026-01-16)
- **Situation:** Transfers between wallets appear as separate transactions in each wallet's ledger but must be linked
- **Root cause:** Each wallet needs complete transaction record (debit from sender, credit to receiver). Links via counterpart fields enable validation that both sides match and reconciliation of transfer pairs
- **How to avoid:** Gained: each wallet has complete ledger, transfer integrity validated. Lost: must maintain bidirectional consistency (if one transfer fails, must mark both sides)

#### [Gotcha] API route returns 500 error before database migration is run, even though endpoint code is correct (2026-01-16)
- **Situation:** Tests fail with 500 on POST /api/briefing/schedule before running drizzle migrations, making it look like the implementation is broken
- **Root cause:** Drizzle ORM queries against non-existent `briefingSchedulePreference` table throw database errors immediately. Schema changes are compiled but tables don't exist until migration is executed
- **How to avoid:** Must run migrations as separate step after code deployment. Safety vs developer convenience

### Used Drizzle ORM's database.transaction() with row-level locking (for('update')) for all balance-changing operations (2026-01-16)
- **Context:** Preventing race conditions and concurrent modification issues in wallet balance updates where multiple requests could debit/credit simultaneously
- **Why:** Row-level locking ensures serialized access to a specific wallet record during the entire transaction scope. This prevents dirty reads and lost updates that could occur with optimistic concurrency or without explicit locking
- **Rejected:** Optimistic locking with version counters would require retry logic and could cause transaction storms under high concurrency; pessimistic locking at application level would be error-prone
- **Trade-offs:** Increased lock contention under high concurrent load (slower) vs guaranteed correctness; requires careful transaction scope management to avoid deadlocks
- **Breaking if changed:** Removing the for('update') lock would allow race conditions where two concurrent requests could both read stale availableBalance and process debits that should fail; transfer operations could leave wallets in inconsistent states

#### [Gotcha] Zod z.record() requires 2 arguments (keySchema, valueSchema), not 1 - z.record(z.unknown()) fails to compile (2026-01-16)
- **Situation:** Schema validation for wallet metadata field that can contain arbitrary key-value pairs
- **Root cause:** Zod's record validator needs to know both the type of keys AND values to properly validate. This mirrors TypeScript's Record<K, V> generic syntax which also requires two type parameters
- **How to avoid:** Requires explicit declaration (z.record(z.string(), z.unknown())) vs simpler syntax; but provides better type safety

### Separate chatApprovalRequest and chatApprovalThread tables instead of storing approval status within messageHistory (2026-01-16)
- **Context:** Need to track approval lifecycle (pending/approved/rejected) without modifying original messages
- **Why:** Preserves message immutability - original message is unaltered. Allows multiple concurrent approvals on same message. Thread table enables notification tracking (read/unread) without denormalization. Supports audit trails of approval history.
- **Rejected:** Storing approval state in messageHistory would require updates to immutable messages and complicate concurrent approval scenarios
- **Trade-offs:** Easier: approval state management, audit trails, multi-approval support. Harder: extra join operations, data consistency between tables
- **Breaking if changed:** If merged into messageHistory, lose ability to track when approvals were completed vs when message was sent; audit becomes lossy

### Custom error classes (MobileTopupError hierarchy) mapped to database transaction state enum values (2026-01-16)
- **Context:** Service needs to record transaction failures with semantic meaning while maintaining database schema consistency
- **Why:** Error types (InsufficientFundsError, TopupFailedError, etc.) directly map to transaction statuses. This allows database queries to find failed transactions by type without parsing error messages. Provides type safety in error handling.
- **Rejected:** 1) String-based error messages (non-queryable), 2) Generic Error type (loses semantics), 3) Separate error log table (duplicate data, sync issues)
- **Trade-offs:** Requires maintaining error class hierarchy in sync with transaction status enum, but enables semantic queries and type-safe error handling throughout codebase
- **Breaking if changed:** Removing error hierarchy would lose type information during transaction recording, making it impossible to distinguish failure reasons in queries

### Store actor name and email as denormalized fields in audit_log table rather than relying on FK join to users table (2026-01-16)
- **Context:** Audit logs need to preserve historical accuracy of who performed actions, but user details (name, email) can change over time
- **Why:** If actor name/email are only stored via FK, historical queries would show current user values, not values at time of action. This violates audit trail immutability principle.
- **Rejected:** Pure FK approach with joins to users table - would lose historical context of actor identity
- **Trade-offs:** Slightly larger table size but complete historical audit trails. Avoids query complexity of temporal user data lookups.
- **Breaking if changed:** Removing actorName/actorEmail fields would make audit logs unreliable for historical accountability and compliance reporting

### Use JSON columns for previousState/newState/changedFields instead of separate change tracking tables (2026-01-16)
- **Context:** Need to capture what changed in resources during audit-worthy events, but change structure varies by resource type
- **Why:** JSON fields avoid schema explosion from creating separate tracking tables per resource type. Single flexible column handles any resource type changes without schema modifications.
- **Rejected:** Separate change_tracking table per resource type - creates maintenance burden and tight coupling to resource schemas
- **Trade-offs:** JSON fields are less queryable (no direct indexing on JSON properties) but vastly simpler and more maintainable. parseAuditLogFields() helper mitigates query friction.
- **Breaking if changed:** Switching to separate tracking tables would require schema redesign and data migration affecting all audit-dependent features

#### [Pattern] 14 optimized indexes including compound indexes for common query patterns (action+category, severity+resourceType, createdAt ranges) (2026-01-16)
- **Problem solved:** Audit logs are write-heavy and read-heavy, needing fast filtering by multiple dimensions and time ranges
- **Why this works:** Compound indexes on frequently co-filtered columns prevent full table scans. Separate indexes on time ranges enable efficient historical queries. This mirrors the rejected anti-pattern of single bloated index.
- **Trade-offs:** Higher write overhead (indexes must update on every insert) but dramatically faster reads. Audit logs are append-mostly so write cost is minimal.

### Three separate tables (preference, log, state) instead of single unified reminder record (2026-01-16)
- **Context:** Managing user settings, audit trail, and per-task runtime state without bloating a single table
- **Why:** Separation of concerns: preferences are slow-changing user settings, logs are immutable audit records, state is frequently mutated. Avoids N+1 queries and table bloat.
- **Rejected:** Single table with JSON columns would simplify schema but makes auditing harder and creates problematic hot rows during state mutations (snooze/mute)
- **Trade-offs:** Three tables require careful JOIN logic but give clean separation; could query any aspect independently without loading unneeded data
- **Breaking if changed:** Merging tables into single record makes snooze/mute updates block audit log writes; audit trail becomes mixed with transient state

#### [Pattern] call_task table includes priority enum (low, medium, high, urgent) and status tracking (pending, completed) with separate completion flow (2026-01-16)
- **Problem solved:** Tasks created from post-call need priority indication and completion tracking without soft-delete
- **Why this works:** Explicit status field enables filtering tasks by state without database queries; completion is tracked separately from deletion to maintain audit trail
- **Trade-offs:** Status enum requires careful migration if types change vs flexibility of string status; separate completed_at timestamp adds storage cost

#### [Pattern] Category-specific retention policies (financial=2555 days, auth=365 days) stored in types rather than config file (2026-01-16)
- **Problem solved:** Regulatory requirements differ by event type (7-year financial record hold vs 1-year auth logs)
- **Why this works:** Hardcoded in types makes retention policy immutable and auditable in version control. Prevents accidental regulatory violations from config changes. Category-specific allows compliance per log type
- **Trade-offs:** Easier: compliance-by-code-review, immutable across app versions. Harder: changing retention requires code deploy; less flexible for operational tweaks

### Recording metadata stored separately from encrypted audio blob locations; encryption happens before cloud storage upload with metadata indexed for efficient querying (2026-01-16)
- **Context:** Encrypted recordings stored in cloud (R2/S3) but need fast queries for retention policies (find recordings older than 90 days for user X). Querying encrypted data directly is impossible
- **Why:** Metadata table allows efficient SQL queries while encrypted blobs remain in object storage. This splits concerns: database has unencrypted searchable metadata, cloud storage has encrypted immutable blobs. Prevents database from becoming bottleneck for large audio files
- **Rejected:** Storing full encrypted recordings in database - would cause massive database bloat and slow queries; Encrypting metadata - would prevent retention policy queries from working
- **Trade-offs:** Metadata queries are fast but require cloud storage roundtrip for actual audio; metadata in database could theoretically leak non-encrypted information (timestamps, call participants) though should be treated as sensitive anyway
- **Breaking if changed:** If metadata is deleted but blobs remain in cloud storage, recordings become orphaned and untrackable; deletion must always happen in correct order or add orphan cleanup job

#### [Pattern] Default GL account fallback chain: header GL code → default expense account (6000) → search by liability type (2026-01-16)
- **Problem solved:** Expense lines need GL accounts for posting, but may not have explicit line-item coding; chart of accounts structure varies by implementation
- **Why this works:** Avoids posting failures due to missing accounts while supporting flexible chart-of-accounts designs. Chain prioritizes explicit coding (most specific) before searching (most flexible). Matches real-world accounting: most lines use voucher header account, some override on line items.
- **Trade-offs:** Easier: handles incomplete data gracefully. Harder: fallback search adds query complexity, account resolution order must be documented to prevent surprises

### Three-table design for feature flags: base featureFlag table + separate featureFlagUserTarget and featureFlagRoleTarget junction tables for targeting (2026-01-16)
- **Context:** Need to support multiple targeting dimensions (global rollout, user-specific, role-based) without denormalization
- **Why:** Normalized approach allows independent targeting rules to coexist. Separate junction tables prevent nullable columns and cartesian product issues when a flag targets both specific users AND roles simultaneously
- **Rejected:** Monolithic single table with user_id/role columns would require multiple rows per flag or nullable fields, making queries complex for flags with mixed targeting
- **Trade-offs:** More joins required during evaluation but cleaner model semantics and easier to add new targeting dimensions (e.g., team, region) without schema changes
- **Breaking if changed:** Evaluation logic depends on proper foreign key relationships; removing junction tables would require moving targeting data back to base table as arrays/JSON

### rolloutPercentage as simple 0-100 integer with rolloutStrategy enum, not combined percentage+strategy field (2026-01-16)
- **Context:** Need to store both which strategy is active and its percentage parameter
- **Why:** Separate fields are explicit and queryable. Prevents invalid states like strategy='percentage' but no percentage value. Makes schema self-documenting
- **Rejected:** Could use JSON object {'strategy': 'percentage', 'value': 50} but loses type safety and makes filtering by strategy harder
- **Trade-offs:** Unused field when strategy is 'all' or 'none' (minor storage waste) but clear semantics and efficient queries
- **Breaking if changed:** If strategy and percentage are merged into single JSON, existing queries and type safety break

#### [Pattern] Query option factory pattern with separate factories for user evaluation vs admin management vs batch operations (2026-01-16)
- **Problem solved:** Different query patterns (single eval, batch eval, admin list/detail) have different cache strategies and stale times
- **Why this works:** Separate factories allow tuning stale times: user evals can be staler (user targeting stable), admin detail needs fresh (targeting just changed), list queries can be aggressive caching. Consistent query keys prevent cache collision.
- **Trade-offs:** Multiple factories slightly more boilerplate but enables fine-grained cache control; consistent naming prevents bugs from typos in query keys

### Separated KycDocument type into KycDocumentRecord to distinguish between ORM entity and API return types (2026-01-16)
- **Context:** Initial implementation used KycDocument for both database schema entity and function return types, causing type mismatches when Zod validation inferred different type unions
- **Why:** Prevents type inference pollution from Zod schemas affecting database layer contracts. ORM entities and API validation have different type requirements - need strict separation for type safety
- **Rejected:** Using single KycDocument type throughout - would couple Zod schema changes to data access layer signatures
- **Trade-offs:** Requires maintaining two related types but gains clear separation of concerns and prevents cascading type errors across layers
- **Breaking if changed:** Changing back to single type would reintroduce type mismatches between Zod inferred types and database function return types

#### [Gotcha] Zod v4 migration: z.record(z.any()) no longer valid - requires z.record(z.string(), z.unknown()) (2026-01-16)
- **Situation:** TypeScript compilation failed with z.record(z.any()) syntax when migrating to Zod v4
- **Root cause:** Zod v4 enforces stricter type safety - z.record requires explicit key and value types. z.any() doesn't provide key type constraint
- **How to avoid:** Slightly more verbose but provides better type inference and prevents accidental type holes

### Added isHighPriority boolean flag alongside priorityLevel and priorityScore instead of computing from score (2026-01-16)
- **Context:** Need to efficiently query high-priority threads without scanning all threads and applying logic filters
- **Why:** Boolean flag enables single-column index for fast high-priority queries; avoids expensive WHERE clause evaluations on numeric comparisons across millions of rows
- **Rejected:** Computing high-priority status from priorityScore/priorityLevel at query time would require INDEX on computed values or full table scans
- **Trade-offs:** Adds data redundancy and requires synchronization between isHighPriority and actual score, but dramatically improves query performance for common inbox filtering
- **Breaking if changed:** Removing this flag would force queries to use expensive WHERE priorityLevel = 'high' OR priorityLevel = 'critical' predicates

### KYC tier configuration stored in database (kycTierConfig table) rather than hardcoded constants (2026-01-16)
- **Context:** Five tiers (none, basic, intermediate, advanced, premium) with dynamic transaction limits ($0→$500k daily, $0→$2M monthly)
- **Why:** Allows operations team to adjust tier limits without code deployment. Business policies evolve; limits may need real-time changes based on risk/compliance
- **Rejected:** Hardcoded enum/constants would require code changes and redeployment to adjust transaction limits
- **Trade-offs:** Adds database query overhead (mitigated by caching) but enables runtime configuration. Requires seed data and migration management
- **Breaking if changed:** If converted to constants, tier limit changes become deployment-dependent and can't respond to compliance updates without releases

### KYC_DOCUMENT_TYPES constants exported from fn/kyc.ts instead of database seed or separate config file (2026-01-16)
- **Context:** Document types needed in form UI, API validation, and potentially database schema
- **Why:** Single source of truth prevents enum duplication. Server functions are module boundary for shared constants. UI imports from fn layer for validation consistency.
- **Rejected:** Separate config file adds import path indirection; seed data approach makes runtime changes impossible; hardcoding in components breaks DRY
- **Trade-offs:** Slightly unconventional (constants in fn file) but eliminates sync issues between UI and API validation
- **Breaking if changed:** If constants move or fn module restructured, all component imports break

### Receipt correction submissions stored as immutable records with original extraction - enables learning from corrections (2026-01-16)
- **Context:** Manual corrections are valuable training signal for improving OCR accuracy
- **Why:** Can analyze patterns in corrections to identify weak areas in Claude prompt. Enables measuring OCR accuracy improvements over time. Legal/audit trail of what was corrected
- **Rejected:** Overwriting original extraction (loses training signal, no audit trail)
- **Trade-offs:** Requires storing both original and corrected data, slight storage overhead. But enables continuous improvement
- **Breaking if changed:** If originals not retained, impossible to measure OCR accuracy or improve prompts based on user corrections

### shouldEscalate computed in query with explicit state transitions (disbursed→receipt_overdue, posted→reconciliation_overdue) rather than single overdue flag (2026-01-16)
- **Context:** Vouchers have multiple stages with different overdue thresholds; need to determine escalation eligibility
- **Why:** Explicit state transitions make business rules visible in data access layer, threshold logic is centralized in one place, easier to audit and modify rules
- **Rejected:** Single isOverdue column - loses context about which stage is overdue, harder to distinguish receipt vs reconciliation issues
- **Trade-offs:** More verbose query logic vs clearer business rules and better auditability
- **Breaking if changed:** Removing state-specific thresholds would treat all voucher types with same escalation timing, breaking business requirements

#### [Gotcha] Token usage tracking stored as separate count columns (inputTokens, outputTokens) instead of a single JSON object, despite following JSON-heavy pattern elsewhere (2026-01-16)
- **Situation:** Initially designed sentimentDetails as JSON but token counts as separate columns
- **Root cause:** Token counts are frequently aggregated (SUM for billing) and filtered (WHERE outputTokens > threshold). Storing as separate columns allows efficient database indexing and SQL aggregation. JSON fields block these operations without expensive SQL function calls. This is a pragmatic exception to the overall JSON strategy
- **How to avoid:** Easier: Analytics queries. Harder: Schema evolution if token tracking structure changes

### Text-based storage for monetary amounts instead of numeric types (2026-01-16)
- **Context:** QR payment system needs to store currency amounts with precision across multiple currencies
- **Why:** Prevents floating-point precision errors in financial calculations. Enables exact decimal representation for arbitrary currencies without rounding artifacts
- **Rejected:** Numeric types (DECIMAL, FLOAT) - while native to databases, lose precision in distributed systems and currency conversions
- **Trade-offs:** Easier: prevents financial calculation bugs; Harder: requires parsing/validation on read, type safety at schema level, explicit amount validation
- **Breaking if changed:** Moving to numeric types would silently corrupt financial data; requires data migration and all calculations need recalibration

### JSON text storage for complex nested types (metadata, merchant info) rather than separate normalized tables (2026-01-16)
- **Context:** Optional, variable-structure data like merchant addresses, custom fields, and payment metadata
- **Why:** Avoids premature normalization for semi-structured data. Allows flexible, extensible metadata without schema migrations. Merchant info and custom fields vary across use cases
- **Rejected:** Separate normalized tables - creates rigid schema, requires JOINs for every query, painful schema evolution for optional fields
- **Trade-offs:** Easier: flexible, no migrations for new fields; Harder: querying nested data, indexing strategy, type safety requires Zod validation at application layer
- **Breaking if changed:** Converting to normalized tables loses ability to add arbitrary merchant fields/custom data without migrations; queryability changes significantly

### Tracking payment attempts as count rather than separate table with attempt records (2026-01-16)
- **Context:** Need to track if a payment has been attempted multiple times for retry logic
- **Why:** Reduces query complexity for common case (how many attempts?). Avoids JOIN overhead for simple increment operation. Attempt history not critical for business logic
- **Rejected:** Separate `qr_payment_attempts` table - required JOINs, more complex queries, unnecessary normalization for simple counter
- **Trade-offs:** Easier: simple counters, fast queries; Harder: no granular attempt history, cannot track individual attempt timestamps/errors
- **Breaking if changed:** Converting to separate table enables historical analysis but requires migration and changes query patterns; removing attempts loses retry safety signals

#### [Pattern] Notification preferences stored as JSON in QR payment record rather than separate notification config table (2026-01-16)
- **Problem solved:** Each QR payment has optional notification settings (email, webhook)
- **Why this works:** Captures notification intent with the payment request. Avoids table joins for default notification behavior. Immutable after creation (set once, read multiple times)
- **Trade-offs:** Easier: simple lookups, fewer JOINs; Harder: cannot change notifications after creation without update logic

### Created separate crmCallLogSync table instead of storing sync state in call_summary table (2026-01-16)
- **Context:** Need to track CRM integration state, retry attempts, and sync status independently from call data
- **Why:** Separation of concerns - call data is immutable, but sync state changes multiple times (pending→in-progress→success/failed→retry). Allows independent cleanup policies and prevents bloating call_summary with CRM-specific metadata
- **Rejected:** Adding crm_status, crm_retry_count, crm_error columns to call_summary table - would couple call record lifecycle to CRM integration lifecycle
- **Trade-offs:** Added join complexity in queries, but gained ability to retry/skip syncs without modifying original call records. Enables independent archival policies for failed syncs
- **Breaking if changed:** Removing this table loses all retry history and sync state tracking - makes distinguishing between 'never attempted', 'failed once', 'failed 3 times' impossible

#### [Pattern] Risk profile calculation separated into dedicated function - queries escalation history, open duration, and customer patterns independently (2026-01-16)
- **Problem solved:** Dashboard needs to show 'high risk customers' but shouldn't load all issue details. Risk scoring requires aggregating multiple data signals
- **Why this works:** Allows efficient risk calculation without N+1 queries on full issue history. Risk filtering happens at query level, not in application memory
- **Trade-offs:** Requires database-side aggregation (grouping by customer, counting patterns). Benefit: scales to large issue volumes without memory overhead

#### [Gotcha] Cash position calculations depend on transaction history existing and being correctly categorized - no error handling for missing data (2026-01-16)
- **Situation:** Implementation assumes transaction table exists with proper entries and expense/income categorization, but this data could be incomplete or missing
- **Root cause:** Data-access layer directly queries transactions without validation. If transaction history is empty or malformed, burn rate calculation returns 0 or NaN without alerting user
- **How to avoid:** Simpler initial implementation but risks incorrect financial decisions based on silent calculation failures. Should add: minimum data validation, NaN checks in calculations, fallback messaging in UI

#### [Pattern] Compliance checks performed on existing expense data without creating separate compliance audit tables - violations computed on-demand from transaction history (2026-01-16)
- **Problem solved:** Need to track compliance violations but avoid creating duplicate data structures and maintain single source of truth
- **Why this works:** Computing violations from original expense records eliminates data synchronization problems and keeps the audit trail clean. If expense is corrected, compliance state automatically updates. Simpler than maintaining separate violation history
- **Trade-offs:** Gained: Single source of truth, self-healing on corrections. Lost: Must compute violations on every check rather than storing cached results

### Implemented model-aware TTL strategy for Odoo queries - static models (res.partner, res.company) use longer TTL (1800s) while dynamic models use shorter TTL (300s) (2026-01-16)
- **Context:** Odoo data consistency vs caching efficiency tradeoff - some models change rarely, others frequently
- **Why:** Avoids cache staleness for frequently-changing data while reducing Redis load for stable reference data. Reduces unnecessary Odoo API calls without risking stale user-facing data.
- **Rejected:** Uniform TTL across all models would either be too aggressive (serving stale data) or too conservative (defeating cache benefits). Per-query configuration would require runtime overhead.
- **Trade-offs:** Adds complexity to TTL logic but significantly improves cache hit rates and data freshness. Requires maintaining a list of model types.
- **Breaking if changed:** Removing model awareness would require either accepting stale data or reducing cache effectiveness by 60-70% for stable models.

### Implemented write-through helper functions (onOdooWrite, setOdooQueryCache) rather than cache-aside-only pattern for Odoo integration (2026-01-16)
- **Context:** Odoo write operations happen through API but need to invalidate cache. Without explicit write handling, cache becomes stale until TTL expiry.
- **Why:** Write-through pattern gives application visibility into invalidation logic. Explicit functions document what should be cached/invalidated. Enables cleanup helpers that batch-invalidate related keys (all queries for a model).
- **Rejected:** Pure cache-aside forces waiting for TTL expiry to see updated data, creating inconsistency windows. Write-around avoids caching writes but misses read-after-write benefits.
- **Trade-offs:** Requires caller discipline to invoke write helpers after Odoo operations. Better consistency than pure cache-aside. Could add event listeners for automation but adds coupling.
- **Breaking if changed:** Without explicit invalidation helpers, stale Odoo data persists for entire TTL duration after writes, breaking data consistency assumptions in audit logs or reports.

### Used atomic Lua scripts in Redis instead of multi-command transactions for token bucket checks (2026-01-16)
- **Context:** Token bucket algorithm requires: read current tokens, check if enough, decrement if yes - three operations that must be atomic.
- **Why:** Lua scripts execute atomically on Redis server. Prevents race conditions where two concurrent requests both see sufficient tokens before either decrements. Multi-command transactions would have check-then-act gaps.
- **Rejected:** WATCH/MULTI/EXEC transactions - possible but less efficient, requires client-side retry logic for conflicts
- **Trade-offs:** Gain: True atomicity, no race conditions, single round-trip. Lose: Lua script complexity, harder to debug.
- **Breaking if changed:** If replaced with non-atomic reads/writes, rate limit can be exceeded under concurrent load. Multiple users could exceed bucket limits simultaneously.

### Dead Letter Queue (DLQ) table separate from main job_queue table, distinct from job_execution_log (2026-01-17)
- **Context:** Failed jobs need investigation and replay without polluting main queue or execution history
- **Why:** DLQ isolation allows: (1) failed jobs don't block normal operations, (2) separate retention policies, (3) can investigate failure patterns without scanning millions of execution logs, (4) enables replay of specific failed jobs to production without full re-enqueue
- **Rejected:** Mark failed in job_queue with status='failed' (wastes storage, slows status queries), merge with execution_log (execution_log becomes write-heavy, bloats historical records)
- **Trade-offs:** Three tables instead of one (more joins) vs. table-specific optimization (DLQ can be aggressively archived/purged, execution_log is immutable historical record)
- **Breaking if changed:** Merging DLQ into job_queue forces filtering in every status query. Removing execution_log loses audit trail needed for compliance/debugging

### Stored trigger configuration as JSON blobs rather than normalized schema with separate condition and task template tables (2026-01-17)
- **Context:** Rules have flexible condition structures (different operators, nested fields) and task templates (dynamic placeholders) that vary by trigger type
- **Why:** JSON flexibility allows schema to evolve without migrations when new trigger types or operators are added. Condition structure is query-able but not queried relationally
- **Rejected:** Normalized schema with foreign keys would require schema changes for each new operator type or condition pattern, causing migrations
- **Trade-offs:** Query complexity for filtering rules by specific conditions becomes harder (would need JSON path queries), but schema stability and deployment ease improved significantly
- **Breaking if changed:** If converted to normalized tables, must handle backfill of existing rule data and migration strategy for deployed instances

#### [Pattern] Separate taskSuggestion table with reviewer tracking and status enum (2026-01-17)
- **Problem solved:** Needed to store AI-generated task suggestions with approval workflow before linking to conversations
- **Why this works:** Decouples suggestion generation from actual task linking. Allows tracking reviewer identity and acceptance decision independently. Status enum (pending/accepted/dismissed) enables workflow validation without additional tables.
- **Trade-offs:** Extra table adds query complexity but provides separation of concerns: suggestion generation vs task linking. Enables rejection/review workflows without modifying taskConversationLink records.

### externalTaskId + taskSource pattern vs single task reference field (2026-01-17)
- **Context:** Need to link conversations to tasks from different external systems (Jira, Linear, custom, etc.)
- **Why:** Two-field pattern (externalTaskId + taskSource enum) enables polymorphic task references without database schema changes. Can add new task sources by adding enum values, not modifying table structure.
- **Rejected:** Single taskId field would force choosing one task system; would need migration each time adding new task source
- **Trade-offs:** Query logic must handle different task sources (might need source-specific lookups), but enables multiple task system support in one table without migrations.
- **Breaking if changed:** Without source field, can only support one task system; adding new sources requires schema migration

### Created multiple snapshot tables (teamMemberCapacity, teamAssignment, capacityAlert, teamCapacitySnapshot) instead of a single denormalized table. Each tracks different aspects of capacity. (2026-01-17)
- **Context:** Team capacity monitoring requires tracking assignments, alerts, and historical snapshots independently
- **Why:** Normalized structure allows independent querying of assignments vs alerts vs snapshots. Avoids data duplication and maintains referential integrity. Snapshots can be archived separately.
- **Rejected:** Single denormalized table would simplify writes but make historical queries and alert management complex
- **Trade-offs:** More joins required for comprehensive reports; easier to maintain data consistency; simpler to archive old snapshots
- **Breaking if changed:** If queries assume all capacity data is in one table, they'll fail when trying to correlate assignments with alerts across multiple tables

### Implemented workflow state as separate WorkflowInstance and StepExecution tables instead of storing entire execution context in single record (2026-01-17)
- **Context:** Workflows can have 10+ steps with multiple parallel branches, conditional paths, and nested loops - complex state tree
- **Why:** Normalized schema enables querying step-level status, resuming from specific steps, handling partial failures, and auditing execution history without parsing complex JSON
- **Rejected:** Storing entire execution context as JSON in WorkflowInstance would simplify schema but make it impossible to query step status, filter by step type, or resume from intermediate points
- **Trade-offs:** More complex queries and schema migration but enables sophisticated workflow management features (step-level retry, branching visualization, conditional resume)
- **Breaking if changed:** Removing StepExecution table would lose ability to track individual step status and would require re-executing all previous steps on resume

### Variable resolution in conditions uses explicit context object passed through execution chain rather than implicit global scope (2026-01-17)
- **Context:** Conditions reference variables from workflow context, step outputs, and approval data - can get complex with nested conditionals
- **Why:** Explicit context object prevents variable shadowing bugs, makes execution traceable, and allows different variables at different execution stages
- **Rejected:** Using global or eval() would be simpler to implement but creates security risks and makes debugging harder due to implicit scope
- **Trade-offs:** Requires threading context through all handlers but provides clear data flow and easy auditing
- **Breaking if changed:** Removing context parameter would require reimplementing variable resolution as global lookup, losing auditability

#### [Gotcha] Approval step requires separate ApprovalGate table instead of storing approvers inline in StepExecution because multiple people may approve same step (2026-01-17)
- **Situation:** Workflow can require approval from multiple users, tracking who approved and when
- **Root cause:** Inline approvers would make it impossible to query "steps awaiting approval by user X" or handle partial approvals gracefully
- **How to avoid:** Slightly more complex schema but enables approval auditing and partial approval scenarios

### Separated metricBaseline and metricDataPoint into distinct tables rather than embedding statistics in alert records (2026-01-17)
- **Context:** Anomaly detection requires historical baselines (mean, std, quartiles) but anomaly alerts need to reference these without storing redundantly
- **Why:** Baselines are computed once and reused across many detections. Storing separately enables: (1) efficient baseline updates, (2) reanalysis of historical data with new baselines, (3) independent scaling of baseline computation vs detection volume
- **Rejected:** Embedding baselines in alerts would require recomputation on each detection and prevents baseline versioning
- **Trade-offs:** One extra join for detection queries but enables sophisticated baseline evolution tracking and retraining workflows
- **Breaking if changed:** Removing baseline tracking breaks ability to understand detection rationale or retrain models with historical data

### detectionRun table logs each run of anomaly detection with results, separate from alerts table (2026-01-17)
- **Context:** Auditing and retraining requires understanding what was analyzed, what baselines were used, what was detected
- **Why:** Enables: (1) understanding why alert was/wasn't triggered for specific run, (2) ablation analysis of algorithm effectiveness, (3) baseline tuning validation
- **Rejected:** Could skip logging runs, but loses audit trail for false positive root-cause analysis
- **Trade-offs:** Additional storage cost but provides forensic capability for detection failures
- **Breaking if changed:** Removing run logs makes impossible to trace why system missed an anomaly or why false positive occurred

### SQL window functions (ROW_NUMBER, RANK) used in data access layer instead of application-level sorting (2026-01-17)
- **Context:** Response time statistics and ranking require top-N queries across time windows
- **Why:** Window functions execute on database reducing network transfer and memory overhead. Database can leverage indexes for efficient computation.
- **Rejected:** Fetch all records and sort in JavaScript - simpler code but O(n) memory and slower with large datasets
- **Trade-offs:** Gains: scalability, efficiency. Loses: database-specific SQL, requires SQL knowledge in data layer
- **Breaking if changed:** Switching to different database (MongoDB, etc) would require rewriting aggregation logic or accepting performance hit

#### [Pattern] New JobType union member 'data.export' added to schema rather than using generic job type with string discrimination (2026-01-17)
- **Problem solved:** Need to handle data export jobs in queue without polluting schema with service-specific types everywhere
- **Why this works:** Type safety at compile time. Generic string-based discrimination would require runtime validation everywhere jobs are processed. Discriminated union catches errors early
- **Trade-offs:** Schema file becomes slightly more coupled to features, but provides strong typing throughout job system

#### [Gotcha] Demo database tables (demoSession, demoDataSnapshot, demoActivityLog) must be distinct from production schema to prevent accidental data pollution (2026-01-17)
- **Situation:** Building demo feature into existing production application without separate database
- **Root cause:** Isolated tables provide clear separation at database level - queries can't accidentally fetch real user data when in demo mode. Acts as a physical boundary
- **How to avoid:** Separate tables add schema complexity but provide data integrity guarantee; application-level filtering is less reliable and harder to audit

### Made tenant_id columns NULLABLE instead of NOT NULL to support backward compatibility during migration (2026-01-17)
- **Context:** Adding tenant_id to 90+ existing tables with existing data
- **Why:** Allows incremental migration without breaking existing queries. New records can have tenant_id while legacy data remains functional. NULL tenant_id acts as 'no tenant' state during transition period.
- **Rejected:** Making tenant_id NOT NULL with defaults would have forced immediate full data migration and broken compatibility with existing code paths
- **Trade-offs:** RLS policies must explicitly handle NULL checks. Query performance slightly decreased due to null checks. Adds complexity to determine when tenant_id is required vs optional.
- **Breaking if changed:** If changed to NOT NULL without migration: existing queries would fail, existing data would be invalid, application would crash on tables without default tenant_id values

#### [Gotcha] RLS policies must allow NULL tenant_id for backward compatibility, but this creates a security gap if not handled correctly in application logic (2026-01-17)
- **Situation:** Legacy data without tenant_id exists alongside new multi-tenant data
- **Root cause:** Null-permitting RLS policies prevent accidental data loss during migration but require application layer to validate tenant_id is actually set before using data
- **How to avoid:** Security boundary shifts from database to application. Database no longer enforces tenant isolation for legacy records. Requires additional application-level validation.

### Added tenant_id indexes on all 90+ modified tables rather than relying on composite indexes with other columns (2026-01-17)
- **Context:** RLS queries filter by tenant_id and other conditions; queries need to access tenant-scoped subsets efficiently
- **Why:** Dedicated tenant_id indexes allow RLS policies to quickly filter to tenant scope before applying other predicates. Simplifies query planner decisions. Effective for 'tenant_id = X' fast path common in multi-tenant apps.
- **Rejected:** Composite indexes (tenant_id, other_columns) would be more space-efficient but would not help queries filtering only by other columns, creating query plan inconsistency across the codebase
- **Trade-offs:** Uses more storage and index maintenance overhead. Simpler query plans but less optimal for queries not filtering by tenant_id. Index bloat risk if application code doesn't consistently filter by tenant_id.
- **Breaking if changed:** Removing tenant_id indexes causes RLS policy execution to do sequential scans on 90+ tables, causing severe performance degradation in multi-tenant scenarios with large datasets

#### [Pattern] Placed migration in separate file (0016_multi_tenant_schema.sql) with structured sections (tenant tables, columns, indexes, RLS enabling, RLS policies, docs) rather than modifying existing migrations (2026-01-17)
- **Problem solved:** Large architectural change affecting 90+ tables; existing migrations already applied to databases
- **Why this works:** Immutable audit trail of when multi-tenancy was added. Existing migrations can't be safely modified after deployment. Structured sections make migration maintainable and partially rollbackable. Single file contains all multi-tenant infrastructure.
- **Trade-offs:** Single large migration file is harder to test incrementally. Rollback is all-or-nothing. Harder to partially apply if some tables have custom logic.

### Tenant context set via session variables (SET app.current_tenant_id) rather than application-level connection pooling or middleware (2026-01-17)
- **Context:** RLS policies need to know current tenant to enforce isolation on each query
- **Why:** PostgreSQL session variables work at connection level, transparent to Drizzle ORM. Policies reference variables consistently. No ORM library changes needed.
- **Rejected:** Application middleware to tag each query would require Drizzle interceptor layers and explicit tenant passing through entire codebase. More invasive but explicit.
- **Trade-offs:** Session variable approach is implicit - easy to forget to set on new connections. Harder to trace through application code where tenant context is established. Hidden dependency in SQL layer.
- **Breaking if changed:** If application fails to SET app.current_tenant_id before queries, RLS policies receive NULL, potentially exposing all tenant data or blocking legitimate queries

### reportSnapshot table designed to store pre-calculated aggregated data rather than raw metrics (2026-01-17)
- **Context:** Reports use snapshots (expense totals, revenue sums, task counts) taken at schedule intervals
- **Why:** Snapshots decouple report generation from live data changes - a report generated Monday shows Monday's data even if underlying records are later deleted/modified. Enables historical trend analysis.
- **Rejected:** Could query live data on-demand from transaction/task tables but loses audit trail of what data existed when report was generated
- **Trade-offs:** Gained: immutable historical records, fast report retrieval (pre-aggregated), accurate historical trends. Lost: storage (duplicate data), staleness if schedule interval is long
- **Breaking if changed:** If requirements shift to 'real-time reports reflecting current state', snapshot approach becomes wrong - must switch to on-demand live aggregation

#### [Pattern] withTenantScope utility automatically injects tenant_id into new objects, while validateAndGetTenant validates existing resources (2026-01-17)
- **Problem solved:** Two different database operations need different tenant handling: CREATE (must inject) vs READ (must validate)
- **Why this works:** Separates concerns cleanly. withTenantScope is fool-proof - impossible to forget tenant_id on insert. validateAndGetTenant ensures retrieved data matches expected tenant. Different error conditions (missing tenant_id vs wrong tenant)
- **Trade-offs:** Requires two different utilities but each has clear purpose. More type-safe than alternatives

#### [Gotcha] Migration order matters critically - workflow tables must be created before multi-tenant schema attempts to modify them with tenant_id columns (2026-01-17)
- **Situation:** Initial migration numbering had 0016_multi_tenant_schema before 0017_workflow_automation_tables, causing schema dependency violations
- **Root cause:** Multi-tenant migration alters existing tables to add tenant_id; those tables must exist first. Foreign key constraints and CASCADE operations depend on table creation order
- **How to avoid:** Stricter ordering reduces flexibility but eliminates silent failures and data corruption risks. Requires discipline in naming/numbering

#### [Pattern] Workflow approval status uses text enum with documented values (pending, approved, rejected, cancelled) plus separate decision field rather than single composite status (2026-01-17)
- **Problem solved:** Approval lifecycle has multiple terminal and interim states, needs to track which user made decision
- **Why this works:** Separating status (workflow state machine) from decision (user choice) allows: tracking approval cycles that get restarted, distinguishing cancelled by system vs rejected by user, easier state machine queries
- **Trade-offs:** Two fields instead of one, but semantic clarity on what each field means. Queries for 'approvals awaiting decision' become explicit rather than status wildcards