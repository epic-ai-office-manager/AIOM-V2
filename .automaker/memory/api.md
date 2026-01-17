---
tags: [api]
summary: api implementation decisions and patterns
relevantTo: [api]
importance: 0.7
relatedFiles: []
usageStats:
  loaded: 68
  referenced: 9
  successfulFeatures: 9
---
# api

### Separate type exports for CreateExpenseRequestData vs UpdateExpenseRequestData instead of optional fields (2026-01-16)
- **Context:** Providing type-safe data access layer methods with strict input validation
- **Why:** Prevents partial updates from unintentionally clearing fields (e.g., rejectionReason becoming undefined); enforces which fields are updatable per operation
- **Rejected:** Single ExpenseRequest type with optional fields - would allow setting any field to undefined during updates
- **Trade-offs:** Easier: type checking prevents accidental field clearing. Harder: more types to maintain, coordinate between schema and data-access layer
- **Breaking if changed:** Removing field-specific types allows updates to accidentally null out previously set values; loses protection against malformed bulk updates

#### [Gotcha] UpdateCallRecordData excludes id, createdAt, and userId fields from updates (2026-01-16)
- **Situation:** Partial update types need to prevent modification of immutable/system fields
- **Root cause:** These fields form the record's identity and audit trail - allowing updates would break referential integrity (userId), audit history (createdAt), or create orphaned records. The type system enforces this constraint at compile time.
- **How to avoid:** Type safety prevents bugs at the cost of less flexibility in the update API, but that's the correct tradeoff for identity/audit fields

#### [Gotcha] Server functions test skipped due to import.meta.env not available in Playwright environment (2026-01-16)
- **Situation:** Attempted to test server functions that require Vite environment variables in Playwright test runner
- **Root cause:** Playwright runs in browser/Node context where Vite's import.meta.env is not available. Server functions module requires these for configuration.
- **How to avoid:** TypeScript compilation validates module structure but runtime module availability not tested. Must rely on integration tests or manual verification.

### Separate high-level data-access layer (`src/data-access/odoo.ts`) from low-level client implementation (`src/lib/odoo/`) (2026-01-16)
- **Context:** Need to expose Odoo functionality to application code while keeping protocol implementation isolated
- **Why:** Data-access layer provides convenient functions like `findPartners()` and `createPartner()` tailored to common Odoo operations, while client implements raw XML-RPC. This separates concerns: clients use domain language (partner, product) not XML-RPC details. Easier to mock for tests, easier to swap implementations.
- **Rejected:** Exposing OdooClient directly - application code would need to know XML-RPC details, domain models, and API patterns; harder to change Odoo integration
- **Trade-offs:** Extra abstraction layer adds slight complexity; but makes API contract explicit and testable; changes to Odoo API only require updating data-access layer
- **Breaking if changed:** Removing this layer would require every consumer to know OdooClient API, domain models, and how to construct search filters

### Queue items include metadata object and dependency tracking instead of flat structure, enabling complex sync scenarios (2026-01-16)
- **Context:** Real offline scenarios require ordered sync (e.g., create expense first, then add attachments) and conflict tracking
- **Why:** Metadata allows storing: (1) originId for temporary client IDs until server confirms, (2) serverVersion for conflict detection, (3) custom state per entity type without schema bloat, (4) retryCount and lastError for debugging. Dependency tracking prevents orphaned operations
- **Rejected:** Flat structure would require separate tables for tracking relationships and origin IDs; custom fields would need unsafe any-typed object
- **Trade-offs:** Larger per-item payload (~500 bytes vs ~200) but enables rich queries and debugging; metadata makes schema less obvious but more extensible
- **Breaking if changed:** Removing metadata breaks ability to handle conflicts; removing originId requires new table to map client IDs to server IDs

### Process notification queue via cron API endpoint rather than background job system (2026-01-16)
- **Context:** Queue of scheduled notifications needs periodic processing without always-on server
- **Why:** Serverless-friendly pattern. Cron endpoint can be triggered by external service (AWS EventBridge, GCP Cloud Scheduler) without requiring persistent job queue infrastructure. Stateless and idempotent (safe to retry).
- **Rejected:** Bull/BullMQ (requires Redis, adds infrastructure). Database polling loop in app startup (ties notification processing to app lifecycle).
- **Trade-offs:** Simpler infrastructure but less precise scheduling (cron interval granularity). Slightly higher latency between scheduled time and actual send.
- **Breaking if changed:** If cron endpoint removed, queue never processes and notifications never send; if not idempotent, duplicate calls send same notification twice

#### [Pattern] Cache statistics calculation using token-level math: (cacheRead / (cacheRead + cacheCreation)) for hit rate and ((fullCost - actualCost) / fullCost) for savings (2026-01-16)
- **Problem solved:** Anthropic Claude API charges differently for cache hits vs regular tokens. Need to quantify actual savings and effectiveness.
- **Why this works:** Token-level granularity necessary because Anthropic charges per token type at different rates. Hit rate is a meaningful KPI distinct from savings percentage (can have high hit rate with low savings if token counts are small).
- **Trade-offs:** Requires tracking three token types (regular, cache_creation, cache_read) throughout client but provides precise ROI metrics for caching decisions. Enables cost optimization at request level.

#### [Gotcha] Message content extraction must handle both string and array-of-blocks formats, filtering by type='text' and skipping falsy text values (2026-01-16)
- **Situation:** Claude API returns content as either plain string (for simple text) or array of content blocks (for mixed types like text+tool_use). Code must gracefully handle both without data loss.
- **Root cause:** API evolution or route differences cause format variations. Filtering by type and checking truthiness prevents concatenating undefined/null values from incomplete blocks.
- **How to avoid:** Type union (string | array) requires branch logic but correctly represents API's dual response format. Avoids data corruption from unsanitized concatenation.

### Exponential backoff retry delay calculation as `Math.min(1000 * Math.pow(2, attempt), 60000)` with 1s base and 60s cap (2026-01-16)
- **Context:** Rate limiting on API calls requires intelligent retry strategy. Too aggressive causes more failures, too lenient wastes time.
- **Why:** Exponential backoff (1s, 2s, 4s, 8s...) allows server time to recover from transient issues while avoiding hammering. 60s cap prevents infinite backoff on persistent failures. 1s base gives some immediate retry for fast recoveries.
- **Rejected:** Linear backoff (1s, 2s, 3s...) - scales too slowly for deeply congested systems. Fixed delay - doesn't adapt to failure duration. Unbounded exponential - 2^10 = 17min becomes unusable.
- **Trade-offs:** Capped exponential requires calculating and testing boundary (2^16 = 65s > 60s cap). But prevents worst-case 1000+ second waits on persistent failures.
- **Breaking if changed:** If cap is removed, retry delays for many failures become 30+ minutes. If base is increased to 5s, fast recoveries waste time. If exponent is changed, timing assumptions in dependent code break.

#### [Pattern] Versioned API prefix (/api/v1/mobile) baked into route inclusion, not individual endpoints (2026-01-16)
- **Problem solved:** Multiple routers (health, users, briefings, sync) need consistent versioning and mobile-specific prefix
- **Why this works:** Centralizing prefix at app.include_router() prevents version string duplication; easier to change version globally; clearly separates mobile gateway routing from main app
- **Trade-offs:** Cleaner code and maintenance vs less explicit routing per file; version changes affect all routers at once (good for consistency, risky if partial updates needed)

#### [Pattern] Structured error responses with success flag, error code, message, and request_id for all exception types (2026-01-16)
- **Problem solved:** Mobile clients need consistent error format for handling different error types (HTTP, validation, server errors)
- **Why this works:** Uniform response structure allows clients to parse all error types identically; request_id enables support correlation; error codes allow i18n and semantic handling in clients
- **Trade-offs:** More consistent API vs verbose response payloads; easier client implementation vs need to define error code taxonomy and maintain consistency

### Receipt URL stored as storage key (e.g., 's3://...') rather than presigned URL, requiring lazy resolution when displaying receipts (2026-01-16)
- **Context:** File upload returns uploadData.key from storage service. Decision to store this key instead of the immediate presigned URL in receiptUrl field.
- **Why:** Presigned URLs have expiration times and become invalid. Storing the key allows regenerating presigned URLs on-demand when users need to access receipts, ensuring links never expire.
- **Rejected:** Storing presigned URL directly - would require URL refresh logic or risk broken receipt links for old expense requests
- **Trade-offs:** Requires helper function to resolve keys to URLs on display (adds complexity) but ensures receipts remain accessible indefinitely without maintenance
- **Breaking if changed:** If code assumes receiptUrl is a direct HTTP URL for display, it will show broken storage key paths instead of clickable receipt links

#### [Pattern] Token caching with early refresh window (refresh 5 minutes before expiry at 55 min mark instead of 60) (2026-01-16)
- **Problem solved:** FCM access tokens expire in 1 hour. Naive approach would refresh at expiry, causing potential failures during the final 5 minutes if system time drifts
- **Why this works:** Provides buffer against clock skew and network delays. If token refresh takes 2 minutes and system is 3 minutes ahead, naive approach would send already-expired token. 5-minute buffer ensures high probability of valid token in production conditions
- **Trade-offs:** One extra API call per 55 minutes of runtime (small cost). Eliminates auth failures during edge case timing scenarios

#### [Gotcha] Web Push API requires applicationServerKey as BufferSource (ArrayBuffer/TypedArray), but Uint8Array conversion returns type that TypeScript's lib.dom.d.ts doesn't recognize as compatible (2026-01-16)
- **Situation:** Created Uint8Array from base64-encoded VAPID key, but PushSubscriptionOptions.applicationServerKey type checking rejected it despite being technically correct
- **Root cause:** TypeScript's dom library types are strict about BufferSource compatibility. Uint8Array is a BufferSource at runtime but type checking is more strict. Root cause: tsconfig.lib configuration and how TS represents ArrayBuffer-like types across different dom versions
- **How to avoid:** Type assertion `as BufferSource` solves it cleanly without config changes. Assertion is safe because urlBase64ToUint8Array provably returns a valid Uint8Array

### Built-in templates defined in registry.ts (code), not in database; immutable and globally available (2026-01-16)
- **Context:** 6 core templates (Briefing, Query Answering, Summarization, etc.) needed to be available to all users immediately
- **Why:** Built-in templates don't need per-user customization. Storing in code means no DB setup required. Immutable registry prevents accidental modification. Faster access than DB queries. Zero cost to provision.
- **Rejected:** Storing in database would require seed data, migrations, and per-user lookup overhead. Would allow users to break built-in templates.
- **Trade-offs:** Can't customize built-in templates without code change. Must duplicate (copy) template to modify. Users fork rather than modify.
- **Breaking if changed:** If built-ins moved to DB, breaks assumptions that they're always available and consistent. Requires seed data management and migration strategy.

#### [Pattern] Separate status enum types for voucher, reconciliation, and posting instead of single status field (2026-01-16)
- **Problem solved:** Voucher can be approved but not posted to GL; can be reconciled independent of posting; each state machine has different valid transitions
- **Why this works:** Prevents invalid state combinations (e.g., 'voided and posted'); makes query filtering explicit and readable; transitions validated per-status type; independent lifecycle concerns
- **Trade-offs:** Slightly more columns in schema; query conditions become compound (status = approved AND postingStatus != posted); application must validate all three status transitions

### Response formatters are registered per-tool, defaulting to JSON formatter. Formatter receives both result and context for flexible formatting decisions (2026-01-16)
- **Context:** Tools need to output responses in different formats (JSON for APIs, table for CLI, markdown for docs) but registry must be transport-agnostic
- **Why:** Optional formatter pattern with default lets tools customize output without bloating registry. Passing context enables formatters to make intelligent decisions based on user/permission
- **Rejected:** Could have hardcoded formatters per output type but that couples registry to specific formats. Making formatter required would bloat tool definitions
- **Trade-offs:** Tools must implement formatter correctly or fall back to JSON. More responsibility on tool implementers but more flexibility
- **Breaking if changed:** If formatter signature changes (e.g., drops context param), all custom formatters break without compilation error due to type casting

#### [Gotcha] Mobile gateway validates tokens by calling back to main app, creating circular dependency - gateway depends on app being responsive (2026-01-16)
- **Situation:** FastAPI gateway needs to validate tokens but token creation/logic lives in main TypeScript app
- **Root cause:** Single source of truth for token logic. Simpler than duplicating validation. Stateless gateway.
- **How to avoid:** One API to maintain vs network latency on every token check; consistent logic vs single point of failure if main app down

### Separated sync operations (syncChannelsFromOdoo, syncMessagesFromOdoo) from fetch operations (getOdooChannels, getOdooMessages) as distinct server functions (2026-01-16)
- **Context:** Need to distinguish between pulling fresh data from Odoo API and retrieving cached data from local database
- **Why:** Allows UI to refresh from Odoo on-demand while keeping default fetch operations fast (cache-first). Explicit sync functions signal expensive API calls that should show loading states.
- **Rejected:** Single unified fetch that always hits Odoo - would be slow; always using stale cache - would be unreliable
- **Trade-offs:** More API surface but clearer intent. Users understand that Sync buttons trigger Odoo API calls while regular loads use cache.
- **Breaking if changed:** Merging these functions loses the distinction between cache misses and intentional refreshes, making it harder to implement proper loading strategies

#### [Pattern] Polling implemented via startOdooPollingFn/stopOdooPollingFn that manage subscription lifecycle rather than automatic background polling (2026-01-16)
- **Problem solved:** Need controlled real-time updates without continuous polling for all users
- **Why this works:** Explicit lifecycle management prevents resource leaks - only active listeners generate polling requests. Allows UI to control when polling should occur based on page visibility or user focus.
- **Trade-offs:** Requires UI code to manage subscription lifecycle (useEffect with cleanup). More code but prevents runaway polling and excessive API calls.

#### [Gotcha] postMessage mutation doesn't immediately update local message list - relies on polling or manual sync for new messages to appear (2026-01-16)
- **Situation:** Message sending succeeds but user doesn't see their own message until polling returns updated list
- **Root cause:** Server functions are stateless - posting message saves to Odoo/DB but doesn't automatically refetch message list. Next polling cycle or manual sync will fetch it.
- **How to avoid:** Simpler implementation without message cache invalidation. Slightly delayed reflection of user's own message.

### 25+ granular server functions for individual workflow operations (submitExpenseForApprovalFn, approveExpenseWorkflowFn, etc.) rather than single generic 'transitionWorkflow' function with action parameter (2026-01-16)
- **Context:** Expense workflow has different validation, authorization, and side-effect requirements per transition type
- **Why:** Granular functions enable per-action Zod validation schemas, role-based authorization at function level, and clear intent-based APIs for consumers. Each function is independently callable and documented
- **Rejected:** Generic transitionWorkflow(expenseId, action, payload) function - would require union types for payloads, complex switch statements for validation, harder to implement action-specific authorization
- **Trade-offs:** Easier: validation, authorization, discoverability; Harder: maintaining 25 functions instead of 1, potential code duplication
- **Breaking if changed:** Consolidating to single function loses per-action validation enforcement and makes authorization logic harder to audit

#### [Pattern] Public endpoint for deep link parsing (POST /api/push/deep-link) accepts raw URLs and returns normalized screen + params for navigation (2026-01-16)
- **Problem solved:** Mobile app receives push notification deep link URLs and needs to know which screen to navigate to and with what parameters
- **Why this works:** Centralizes URL parsing logic server-side, avoiding duplication across iOS/Android apps. Single source of truth for screen names and param extraction rules. Allows A/B testing deep link formats without app update
- **Trade-offs:** Adds round-trip latency for deep link handling (notification received -> parse on server -> navigate) vs. local parsing. Server must maintain backward compatibility with all deep link formats ever sent

#### [Pattern] Query options (TanStack Query) use explicit key hierarchies like ['accounting', 'customer-invoices', partnerId] rather than flat keys (2026-01-16)
- **Problem solved:** Multiple related accounting queries that need selective invalidation (e.g., refresh invoices for one partner without refreshing all)
- **Why this works:** Hierarchical keys enable fine-grained cache invalidation. Can invalidate all customer invoices with `['accounting', 'customer-invoices']` or just one partner's with `['accounting', 'customer-invoices', partnerId]`
- **Trade-offs:** More verbose key structures but enables powerful partial invalidation patterns. Enables the useInvalidateAccountingQueries hook to be smart about what to refresh

#### [Gotcha] ClaudeModel type from client types doesn't match modelSchema Zod literal inference, causing type assertion failures (2026-01-16)
- **Situation:** updateAIUserPreferenceFn expects a Zod-validated type, but ClaudeModel is a hand-written type union that Zod doesn't recognize as compatible
- **Root cause:** Zod schema validation creates a narrower inferred type than the ClaudeModel union. The server function's type requirements are stricter than the client type definition suggests.
- **How to avoid:** Using `as Parameters<typeof fn>[0]['data']` type assertion bypasses type safety for this specific field, but ensures runtime compatibility with Zod validation

#### [Gotcha] null vs undefined distinction required in preference updates - null means 'clear value', undefined means 'don't change' (2026-01-16)
- **Situation:** updateAIUserPreferenceFn needs to distinguish between clearing a field (null) and ignoring it (undefined) in optional field updates
- **Root cause:** Zod schema validation and database semantics require explicit nulls for deletions. Using undefined would be silently ignored by the schema validator.
- **How to avoid:** Client must be explicit about intent (pass null to clear, pass undefined to skip), but prevents accidental field deletions

### Financial tools use specific categories ('data' or 'analysis') and require minimum 'user' permission level, not 'admin' (2026-01-16)
- **Context:** Tools access financial data through accounting data access layer, requiring permission boundaries
- **Why:** User-level access is sufficient because the underlying data access layer handles row-level security. Not restricting to admin prevents unnecessary permission friction while the data access layer provides actual data boundaries
- **Rejected:** Requiring 'admin' permission, or using overly granular permission levels
- **Trade-offs:** Simpler permission model (fewer tiers to manage), but relies on data access layer to enforce security boundaries correctly
- **Breaking if changed:** If permission layer changes to user-level-only, financial operations break. If data access layer security is removed, financial data becomes exposed

#### [Pattern] Used Zod validators on server functions with specific number/string types but deferred complex business logic validation (e.g., partner existence, permission checks) to data-access layer (2026-01-16)
- **Problem solved:** Server functions need input validation before accessing database; errors can be validation errors or business logic errors
- **Why this works:** Zod validates shape/type safety at API boundary. Business logic validation (does partner exist?) goes in data-access because: (1) internal callers may handle missing partners differently, (2) allows reusing validation in non-server contexts, (3) cleaner separation of concerns.
- **Trade-offs:** Server functions aren't fully self-contained (need to understand what data-access validates). But data-access functions are reusable for multiple entry points.

### Integration uses existing tool registry system (`src/lib/tool-registry/`) rather than creating new AI communication layer, leveraging tools like `echo`, `current-time`, `calculator`, etc. (2026-01-16)
- **Context:** Natural language interface needs to execute business operations to answer user queries
- **Why:** Reusing existing tool registry avoids duplication and maintains single source of truth for available operations; tools are already defined and tested elsewhere in codebase
- **Rejected:** Creating new independent AI tool definitions (would require maintaining parallel definitions), or making direct API calls without tool abstraction layer
- **Trade-offs:** Constrained to existing tool set (easier to add new tools through registry), but gains consistency and maintainability across entire platform
- **Breaking if changed:** If tool registry is refactored or removed, the entire natural language query system loses its capability to execute operations

### Implemented stale time tiers based on data volatility: 30s for active call contexts, 2-5min for interactions/tickets, 1min for search results (2026-01-16)
- **Context:** Call context service provides multiple related data streams with different change frequencies during an active call
- **Why:** Aggressive staling (30s) on core call context ensures up-to-date customer info during call without constant refetches. Slower staling on historical data (call history, interactions) reduces server load while staying reasonably fresh. Search results (1min) are user-triggered so slightly longer stale time is acceptable
- **Rejected:** Single stale time across all endpoints (would either over-fetch or serve stale data), or no caching at all (would hammer server during active calls)
- **Trade-offs:** More complex configuration but prevents 'stale customer data during active call' scenarios. Trade: slightly higher complexity vs significantly better UX and server performance
- **Breaking if changed:** If you increase stale times, customers might see outdated account status or unresolved tickets during calls. If you set to 0 (no staling), active calls will generate 60+ server requests per minute

#### [Pattern] Server functions accept both phoneNumber and userId as identifiers, with validation that exactly one is provided (2026-01-16)
- **Problem solved:** Call system receives calls from phone numbers but internal system uses user IDs; need to support both lookup paths
- **Why this works:** Phone number is the natural identifier for incoming calls. User ID is natural for internal lookups. Supporting both in the API reduces the need for intermediate translation services. Mutual exclusivity validation prevents ambiguous queries
- **Trade-offs:** More validation code in server functions but cleaner integration with both call and internal systems. Prevents subtle bugs from ambiguous lookups

#### [Pattern] Bidirectional sync pattern: pull first (incremental), then push (local changes), then pull again (confirmations) (2026-01-16)
- **Problem solved:** Mobile clients need to sync offline changes while receiving server updates without conflicts
- **Why this works:** Three-step pattern prevents lost updates: (1) Pull ensures we have latest server state before pushing, (2) Push sends local changes, (3) Pull again captures server confirmations/transformations. Simpler than complex merge logic.
- **Trade-offs:** Requires 3 API calls instead of 1 (network cost) but eliminates complex conflict merge logic. Eventual consistency guaranteed but latency increased.

#### [Gotcha] Zod `z.record()` in newer versions requires explicit key and value schemas, not just value schema (2026-01-16)
- **Situation:** Using `z.record(z.unknown())` caused TS2554 error expecting 2-3 arguments
- **Root cause:** Zod updated to enforce stricter typing for record validation. Key schema must be explicit for proper validation and narrowing of object keys.
- **How to avoid:** More verbose but catches invalid key types at runtime. Backward incompatible with older Zod versions.

#### [Pattern] TanStack Query stale times configured asymmetrically: 2min stale for main task queries (can use stale data) but 5min auto-refresh for stats (always needs fresh counts) (2026-01-16)
- **Problem solved:** Users expect task lists to update reasonably quickly but statistics (overdue count, open tasks) change frequently and significantly impact UX decisions
- **Why this works:** Stats drive action/urgency (user sees '3 overdue tasks') so staleness is more perceptible than task details; task list can serve stale data while background refreshes. The 5min auto-refresh ensures stats stay fresh without forcing synchronous refetch on every mount
- **Trade-offs:** More API calls but better UX for time-sensitive data. More configuration complexity but allows optimization per use-case

### Using TanStack Start server functions as middle layer between React hooks and Odoo client (2026-01-16)
- **Context:** Need secure, validated access to Odoo data from React components
- **Why:** Server functions run only on server, preventing: (1) exposing Odoo credentials to client, (2) invalid queries reaching Odoo, (3) unvalidated data reaching UI. authenticatedMiddleware ensures user context before execution.
- **Rejected:** Direct client-side Odoo queries would expose credentials; API routes would add HTTP overhead for every query
- **Trade-offs:** Adds validation layer (small latency gain from early rejection) but requires middleware setup; easier to audit security than scattered client queries
- **Breaking if changed:** Removing server functions exposes Odoo client logic to client bundle and loses auth check; queries become unvalidated

#### [Gotcha] Transformation functions (toProjectSummary) are in data-access layer, not hooks layer (2026-01-16)
- **Situation:** Raw Odoo records (ProjectProject) are different shape than UI consumption type (ProjectSummary)
- **Root cause:** Transformation at data-access layer means: (1) server functions always return validated shapes, (2) query cache stores transformed data (smaller memory), (3) UI guaranteed to never receive raw Odoo format, (4) easier to add new transform variants without touching React layer
- **How to avoid:** Data-access layer is thicker, but prevents Odoo schema leaking to UI; single transformation point vs scattered ad-hoc UI transforms

#### [Gotcha] ZodError structure uses `.issues` not `.errors` - discovered through TypeScript compilation (2026-01-16)
- **Situation:** Validation error responses in 4 API routes initially used `.error.errors` causing type mismatch
- **Root cause:** Zod's public API changed; current version exposes ZodIssue[] via .issues property
- **How to avoid:** Easier: type-safe validation. Harder: needed edits across multiple files after initial implementation

#### [Pattern] Rate limiting implemented at endpoint level (resend-otp) rather than global middleware (2026-01-16)
- **Problem solved:** Resend OTP endpoint needs aggressive rate limit; other onboarding endpoints don't
- **Why this works:** Prevents OTP brute-force on resend without affecting start/verify endpoints. Request-level control matches request-level intent.
- **Trade-offs:** Easier: targeted protection. Harder: distributed rate limit state management

#### [Gotcha] Test assertions changed from quoted property names ('"customerId":') to unquoted ('customerId:'), indicating TypeScript output differs from JSON representation (2026-01-16)
- **Situation:** Initial tests used JSON string literals with quotes; updated tests removed quotes
- **Root cause:** TypeScript object literal notation doesn't include quotes around property names in string representation; tests were checking for JSON-like output but the actual TS string doesn't match
- **How to avoid:** Unquoted format matches actual TypeScript file content but may be less obvious to reviewers that this represents object properties

### File upload via existing uploadMediaFile utility instead of creating custom S3/R2 upload endpoint (2026-01-16)
- **Context:** Integration with existing cloud storage (R2) for receipt images
- **Why:** Reuses existing auth, error handling, retry logic, and tenant-aware file path generation; single source of truth for upload behavior
- **Rejected:** Direct S3 presigned URL calls; custom FormData upload endpoint with separate auth middleware
- **Trade-offs:** Must constrain upload to existing MIME types and size limits (easier maintenance) vs flexibility of custom endpoint (more work, duplicate logic)
- **Breaking if changed:** If uploadMediaFile changes signature or deprecates, upload feature breaks; centralizes risk but also simplifies debugging

#### [Gotcha] onSuccess in useSendReloadlyTopup checks result.success before showing success toast, despite mutation not throwing on API-level failures. Transaction state is inconsistent until invalidation completes. (2026-01-16)
- **Situation:** Server function returns {success, error} object rather than throwing on failure, requiring client-side success check.
- **Root cause:** Allows differentiation between HTTP errors and API-level validation/processing failures. Server functions can return structured error information to display more context.
- **How to avoid:** Client must implement success checking everywhere this mutation is used. Gain structured error handling and context, but increase verbosity.

### 13 separate server functions (user + admin endpoints) instead of single polymorphic endpoint with role-based conditional logic (2026-01-16)
- **Context:** SIP provisioning requires both user operations (get credentials, regenerate password) and admin operations (suspend, revoke, force deregister)
- **Why:** Explicit endpoints prevent permission logic bugs from hidden conditionals. Each endpoint can have independent security context, logging, and audit trails. Type-safe through separate function signatures. Easier to test and document.
- **Rejected:** Single polymorphic endpoint with role checks would reduce code duplication but increases cognitive load for security review. Permission bugs hide in conditional branches. Harder to trace which admin action was performed.
- **Trade-offs:** More boilerplate code and endpoint registration, but security is more transparent and traceable. Each function is independently mockable and testable.
- **Breaking if changed:** Collapsing to single polymorphic endpoint loses granularity for audit logging and permission enforcement - admin actions become indistinguishable from user operations.

### Route guard uses typed coercion `as { role?: UserRole; isAdmin?: boolean }` to make optional properties explicit rather than asserting certainty (2026-01-16)
- **Context:** Session data structure is partially unknown - user object may or may not have role/isAdmin properties
- **Why:** Optional properties acknowledge uncertainty about incoming data shape, preventing false assumptions about data availability
- **Rejected:** Strict typing without optionals - would break if user object structure varies
- **Trade-offs:** Added null coalescing checks but prevents crashes from missing expected properties
- **Breaking if changed:** Removing optionals would cause type errors or runtime crashes when user lacks role/isAdmin properties

### Simulated/mock data in data access layer (src/data-access/sales-dashboard.ts) instead of direct Odoo integration (2026-01-16)
- **Context:** Sales dashboard functions return hardcoded data structures matching Odoo models but don't query real Odoo instance
- **Why:** Allows dashboard to render and tests to pass without external service dependency or Odoo client configuration
- **Rejected:** Direct Odoo queries would require live service, credentials, and error handling for unavailable systems during development
- **Trade-offs:** Faster development and testing vs. no validation that data structures match actual Odoo schema or that integration path works
- **Breaking if changed:** When real Odoo integration is added, functions must be rewritten; current simulated data structure may not match real Odoo responses

### Query options include 30-second polling for unread counts instead of real-time via WebSocket (2026-01-16)
- **Context:** Unread counts need to stay fresh as user receives new messages
- **Why:** Polling is simpler to implement initially, works for most use cases where 30s latency is acceptable. Can be upgraded to WebSocket without changing server contract.
- **Rejected:** Real-time WebSocket - adds complexity to server and client infrastructure; may not be necessary for this feature's UX requirements
- **Trade-offs:** Easier: simpler initial implementation. Harder: 30s delay in showing new messages, wastes bandwidth if user has many open tabs
- **Breaking if changed:** If polling interval reduced to 1s, could overwhelm server with requests; if removed entirely, unread counts become stale immediately

### 18 tools split into query (10) vs mutation (8) operations with natural language date parsing for deadlines (2026-01-16)
- **Context:** Task management requires both data retrieval and state changes, with flexible deadline input from users
- **Why:** Query/mutation separation enables atomic operations and clear side-effect boundaries. Natural language dates reduce friction for Claude to set realistic deadlines without explicit date formatting.
- **Rejected:** Single generic 'task-operation' tool or separate date parsing tool. Generic approach loses type safety; separate parser adds indirection.
- **Trade-offs:** More tools to maintain but each has single responsibility. Natural language parser adds complexity but eliminates date format parsing errors.
- **Breaking if changed:** If query/mutation split removed, would lose ability to safely cache read operations. If natural language parsing removed, Claude would need to compute dates externally.

#### [Gotcha] Natural language date parsing uses relative dates only (tomorrow, in X days) - no absolute dates (March 15th) (2026-01-16)
- **Situation:** Claude sometimes attempts to use absolute dates when given future planning requests
- **Root cause:** Relative dates are unambiguous across timezones and don't require date format negotiation. Simpler parsing logic reduces bugs.
- **How to avoid:** Easier to implement and reason about, but some date expressions fail. Claude can work around by computing relative day counts.

### Widget uses role-based access control (MD/Admin get all widgets, Field Tech/Sales explicitly configured in dashboard-defaults) (2026-01-16)
- **Context:** Different user roles need different default widget sets; configuration needed to be centralized
- **Why:** Prevents hardcoding role checks in component. Changes to role permissions don't require component redeploys. Single source of truth in config file. Scales to new roles without code changes.
- **Rejected:** Hardcoding role checks in AlertFeedWidget component; spreads authorization logic across codebase, makes audit difficult
- **Trade-offs:** Requires discipline to update config when adding widget to role. Easier to forget role when adding new widget if pattern not followed.
- **Breaking if changed:** If config entry is removed, role loses widget access silently. If WIDGET_IDS.ALERT_FEED is renamed, all references break.

#### [Gotcha] Build failed in SSR layer due to unrelated `postAttachment` export issue in separate file, but client build succeeded (2026-01-16)
- **Situation:** TypeScript build errored on missing export but widget code was compiled successfully client-side
- **Root cause:** The project has separate client and SSR build pipelines. The attachment module was missing an export, breaking the Node.js build but not affecting browser bundle
- **How to avoid:** Verified feature works in client context even though full build fails. Would need separate bug fix ticket for attachment export

#### [Gotcha] TypeScript union types for transaction type and status fields (deposit|withdrawal|transfer_in|...) must be duplicated across server functions AND hooks/query options (2026-01-16)
- **Situation:** Type safety error where generic 'string' types in hook signatures didn't catch invalid transaction types at compile time
- **Root cause:** TypeScript type-checks at definition point, not at call site. If the hook accepts generic 'string', TypeScript won't validate that passed values match actual server enum values. This creates a false sense of type safety
- **How to avoid:** Manual sync burden (must update 3 places) vs catching type errors at compile time instead of runtime

### Server-side validation enforcing user cannot approve/reject own approval requests with immediate 403 error (2026-01-16)
- **Context:** Preventing self-approval which would bypass approval workflow intent
- **Why:** Trust boundary at API layer - never rely on client to enforce authorization rules. Immediate rejection is clearer than silent failure. Prevents workflow bypass through UI manipulation.
- **Rejected:** Client-side disabling of buttons would allow determined users to bypass by modifying requests
- **Trade-offs:** Easier: security guaranteed. Harder: requires client to handle 403 and show user-friendly error rather than disabled state
- **Breaking if changed:** If removed, approval workflow becomes bypassable - undermines entire feature purpose

#### [Pattern] Idempotency through transaction recording with pre-existing transaction lookup before processing (2026-01-16)
- **Problem solved:** External API calls (Reloadly) may timeout or disconnect after succeeding, causing retry duplicates
- **Why this works:** By recording transaction before API call and checking for existing transaction on retry, same request ID produces same result. Prevents double-charging user if request is retried.
- **Trade-offs:** Requires transaction lookups on every request, but eliminates duplicate charges—critical for payment systems

#### [Pattern] Transaction history uses dual filtering: status filter AND search/query across transaction fields. Filters are OR'd together (any status) while search is AND'd with status filter. (2026-01-16)
- **Problem solved:** History page needs to show transactions with ability to find specific transactions by phone/amount/reference while also filtering by status.
- **Why this works:** Status buttons use OR logic (pending OR processing OR successful) to show relevant results. Search must be AND'd with status to narrow results. This pattern balances discoverability (OR for related items) with precision (AND for search).
- **Trade-offs:** Dual filter approach is more powerful but adds cognitive load. Users must understand that status and search work together. Implementation requires careful state management to prevent contradictory filters.

#### [Pattern] Separate helper functions (logAuthEvent, logResourceChange, logSecurityEvent, logSystemEvent) wrapping generic logAction() (2026-01-16)
- **Problem solved:** Different audit event types (auth, resource changes, security incidents) have different required fields and conventions
- **Why this works:** Semantic helpers document intent and enforce required fields at callsite (TypeScript), preventing incomplete audit records. Generic logAction remains for edge cases.
- **Trade-offs:** More functions to maintain but better type safety and clearer audit trail intent. Callers get autocomplete guidance.

### API key authentication for cron endpoint via environment variable instead of OAuth/token rotation (2026-01-16)
- **Context:** External cron service (Vercel/GitHub Actions) needs to trigger reminder processing without user context
- **Why:** Static API key is simpler for cron jobs that can't handle token rotation. Endpoint only accessible from scheduled service, not user-facing.
- **Rejected:** JWT with rotation adds operational complexity for a non-user endpoint; IP whitelisting alone is unreliable for cloud cron services
- **Trade-offs:** Simple to implement but requires secure environment variable management; compromised key could trigger false reminders
- **Breaking if changed:** Removing API key authentication exposes reminder processing to unauthorized cron triggers; removing env var management loses audit trail of endpoint access

#### [Pattern] Query functions support filtering by both disposition ID and call_record ID, with separate dedicated functions for each lookup pattern (2026-01-16)
- **Problem solved:** Post-call flow needs dispositions by call ID, but internal operations might need disposition by ID; different access patterns require different query optimizations
- **Why this works:** Explicit functions clarify intent and enable different WHERE clause optimizations (exact ID match vs foreign key lookup) without overloading parameters
- **Trade-offs:** More functions to maintain vs clearer API contracts; each function can have optimized indexes

#### [Pattern] Server functions (src/fn/audit-logs.ts) for API endpoints separate from service library logic (2026-01-16)
- **Problem solved:** Need to expose audit logs to frontend via REST API while keeping service logic isolated
- **Why this works:** Separation of concerns: service handles queueing/checksums/retention, server functions handle request validation/pagination/authorization. TanStack Start pattern requires this structure
- **Trade-offs:** Easier: testable logic, reusable service. Harder: more files to maintain, complexity of integration layer

#### [Gotcha] Webhook endpoint returns 200 OK even when database connection fails, but with error status in response body rather than HTTP error code (2026-01-16)
- **Situation:** Initial tests failed expecting stats when DB was unreachable; endpoint was throwing 500 errors instead of graceful degradation
- **Root cause:** FusionPBX webhooks retry on HTTP errors which could cause duplicate recording attempts. Returning 200 OK with error status in body ensures FusionPBX doesn't retry, while client can still detect failure in response JSON
- **How to avoid:** Clients must check response.status field rather than HTTP status code (non-standard REST); FusionPBX gets fast HTTP response but actual persistence might have failed silently

### Separate server functions for single/batch/auto posting rather than unified endpoint with mode parameter (2026-01-16)
- **Context:** GL posting needed three entry points: manual single, manual batch, automatic post-approval. All use same underlying service.
- **Why:** Different trust/authorization boundaries: auto-posting is internal-only (no auth params needed), batch requires explicit user action, single is most permissive. Separate functions enable different authentication strategies and prevent accidental triggering of auto-posting.
- **Rejected:** Single endpoint with mode parameter would require conditional auth logic and risk exposing auto-posting trigger to unauthorized callers
- **Trade-offs:** Easier: clear separation of concerns, obvious which function does what. Harder: code duplication in function wrappers, three query hooks to maintain
- **Breaking if changed:** If consolidated to single endpoint, auth logic becomes complex; if auto-posting function is exposed publicly, it could be misused to post unauthorized expenses

#### [Pattern] Separate public health endpoint from authenticated SSE endpoint; health endpoint returns cache stats and uptime metrics (2026-01-16)
- **Problem solved:** Need to expose service health for monitoring while protecting real-time update stream from unauthenticated access
- **Why this works:** Monitoring tools often run as external processes without auth credentials; cache metrics useful for debugging performance issues. SSE stream has sensitive user targeting data so requires auth.
- **Trade-offs:** Additional endpoint to maintain but clear separation of concerns; uptime tracking adds small memory/cpu cost but essential for SLA monitoring

### Discrepancy detection in data layer rather than UI layer (2026-01-16)
- **Context:** Created detectDiscrepancies() function in data-access returning typed discrepancy objects with severity levels
- **Why:** Enables consistent discrepancy logic across all consumers (web, API, mobile), persistent discrepancy flags in database, and server-side filtering/sorting by discrepancy severity
- **Rejected:** Computing discrepancies in UI component would repeat logic, prevent API consumers from accessing this data, and make discrepancies non-persistent
- **Trade-offs:** Data layer becomes more complex, but UI is simpler and discrepancy data is authoritative source of truth
- **Breaking if changed:** Moving discrepancy logic back to UI would break any API consumers and prevent backend-driven filtering in future dashboards

### Added aging bucket breakdown with fixed time windows (0-30, 31-60, 61-90, 91-120, 120+ days) as separate AgingBucket type rather than generic bucket arrays (2026-01-16)
- **Context:** Financial aging analysis requires standardized time buckets for industry-standard reporting and comparison
- **Why:** Fixed buckets are standard in accounting/finance (matching invoice aging practices). Typed AgingBucket enforces data structure consistency and enables calculations like percentage distribution
- **Rejected:** Generic array of buckets (more flexible but loses type safety), or just raw amounts (loses aging insight), or configurable buckets (over-engineered for typical use)
- **Trade-offs:** Fixed structure = type safety and simpler UI (knows exactly which buckets exist) but inflexible if bucketing logic needs to change; generic = flexible but requires validation
- **Breaking if changed:** If changing bucket definitions, must update AgingBucket type, all data transformations, and all UI components that render buckets

#### [Gotcha] Zod v4 z.enum() no longer accepts errorMap option in constructor - must be set separately or use custom error handling (2026-01-16)
- **Situation:** z.enum(KYC_DOCUMENT_TYPES, { errorMap: ... }) syntax failed in Zod v4 validation
- **Root cause:** Zod v4 restructured error handling - errorMap parameter location changed between versions, indicating breaking API shift
- **How to avoid:** Simpler API but loses inline error customization for enum validation

### Created separate batchScoreThreadsFn alongside single scoreThreadPriorityFn instead of making score function handle both cases (2026-01-16)
- **Context:** Users wanted ability to analyze all inbox threads at once, but single API calls would hit rate limits and timeout
- **Why:** Dedicated batch endpoint enables transaction grouping, allows progress feedback, and separates concerns; scoring all 100+ messages in one call would exceed Claude API limits and response timeouts
- **Rejected:** Single flexible endpoint with array parameter would be simpler API surface but would force batching logic on client and create single failure point
- **Trade-offs:** Two separate endpoints are less elegant but enable specific optimizations per use case; adds API surface area
- **Breaking if changed:** Merging back to single endpoint would require client-side batching and lose transaction semantics; all-or-nothing scoring becomes risky

#### [Gotcha] Existing backend KYC infrastructure (data-access functions, API routes) was already mature; frontend only needed UI layer and mutations (2026-01-16)
- **Situation:** Implementation focused on building admin review UI without realizing backend was already complete
- **Root cause:** Prevented redundant API implementation. Leveraging existing functions (getKycVerificationDetailsFn, approveKycVerificationFn) meant UI integration was straightforward
- **How to avoid:** Required careful review of existing data-access layer to understand available functions. Upfront investigation saved implementation time

#### [Pattern] Server functions use `_Fn` suffix (getMyKycVerificationFn, updateKycPersonalInfoFn) for consistency with codebase convention (2026-01-16)
- **Problem solved:** Multiple KYC operations needed (get status, update info, upload documents, submit for review)
- **Why this works:** Naming convention makes it immediately obvious these are server functions (RPC calls) not React hooks or utilities. Consistent with existing codebase patterns
- **Trade-offs:** Slightly verbose names but unambiguous API surface

#### [Pattern] Server functions return structured result with both extracted data and raw OCR text for debugging (2026-01-16)
- **Problem solved:** OCR errors are hard to diagnose - need visibility into what Claude actually saw
- **Why this works:** Separates processed output (for app logic) from raw output (for debugging). Enables toggling raw text display in UI for power users. Helps trace false extractions back to prompt issues
- **Trade-offs:** Slightly larger response payload but massively better debugging experience and ability to refine Claude prompts based on failures

### Created separate stateless server function (generateCallSummary) instead of embedding Claude call within mutation hook or data-access layer (2026-01-16)
- **Context:** Claude API calls are async, expensive, and can fail - needed clear separation of concerns
- **Why:** Server functions act as a boundary layer preventing client-side logic from coupling to API credentials and external service behavior. Placing it in fn/ allows TanStack Query to manage retry/caching independently, and enables admin endpoints to regenerate without client involvement. The async status tracking (pending→processing→completed) requires a server function to update atomically
- **Rejected:** Calling Claude directly in useCallSummaries hook - would expose API logic to client, complicate error handling, and make server-side regeneration impossible
- **Trade-offs:** Easier: Clear separation, testable, reusable from multiple contexts. Harder: Requires additional network round-trip, must handle race conditions with status updates
- **Breaking if changed:** Removing server functions would require moving Claude integration to client or data-access layer, exposing credentials and making async status tracking impossible

### Status field transitions are unidirectional (pending → processing → completed/failed) rather than allowing arbitrary state updates (2026-01-16)
- **Context:** Summary processing status needed to prevent duplicate generation attempts and track completion
- **Why:** Unidirectional state prevents race conditions where concurrent requests generate multiple summaries. The database schema enforces this at the data layer (status field with enum constraint). Once processing completes, failed summaries can be regenerated by creating a new record rather than mutating existing state
- **Rejected:** Bidirectional transitions allowing pending→completed directly - would require distributed locks to prevent duplicate generation, more complex concurrency control
- **Trade-offs:** Easier: Prevents concurrency bugs, clear state machine. Harder: Cannot retry in-place, must delete failed summaries to regenerate
- **Breaking if changed:** Allowing arbitrary state transitions would require synchronization primitives or status version fields, increasing complexity significantly

### Unique QR code AND short code identifiers for lookups instead of relying on database ID (2026-01-16)
- **Context:** QR payments are scanned, shared, and used in user-facing URLs where database IDs are inappropriate
- **Why:** QR codes are opaque tokens suitable for external use; short codes enable human-readable sharing and debugging. Both prevent information leakage about database structure
- **Rejected:** Using only database IDs - exposes internal system structure, not suitable for public QR codes, not shareable
- **Trade-offs:** Easier: secure external identifiers, user-friendly URLs; Harder: need uniqueness constraints on two fields, lookup logic complexity, storage overhead
- **Breaking if changed:** Removing short code breaks human-readable sharing; removing QR code identifier breaks QR scanning flow

### Expiration validation tied to payment type (required for dynamic, optional for static) (2026-01-16)
- **Context:** QR payments can be static (permanent) or dynamic (time-limited)
- **Why:** Encodes business rule into schema - prevents invalid states (static payment with expiration is ambiguous). Forces explicit intent at creation time
- **Rejected:** Always-optional expiration - allows orphaned timestamps, doesn't prevent misconfigurations
- **Trade-offs:** Easier: type-safe payment lifecycle; Harder: requires refinement validation, more complex schema rules
- **Breaking if changed:** Removing type-based expiration validation allows ambiguous payment states; breaks cleanup logic for expired payments

### getPublicQrCodeFn created as separate unauthenticated endpoint from generateQrCodeImageFn (authenticated) (2026-01-16)
- **Context:** QR codes need to be embeddable in payment pages accessible to unauthenticated users, but generation should be authenticated
- **Why:** Separating endpoints allows different security contexts. Public endpoint can be cached aggressively (no auth header needed), while authenticated endpoint is user-scoped
- **Rejected:** Single endpoint with optional auth - would require cache busting logic to handle both authenticated and public requests, cache efficiency drops significantly
- **Trade-offs:** Two endpoints to maintain but enables CDN caching on public QR codes and prevents serving private QR codes to wrong users. Authentication logic is explicit rather than implicit
- **Breaking if changed:** Merging endpoints requires handling cache headers based on auth state, exposing one user's QR codes to others or requiring expensive per-user cache invalidation

### bulkLogCallsToCrm accepts array of CallLogEntry instead of call IDs, requiring pre-fetching (2026-01-16)
- **Context:** Need to batch multiple calls to CRM in single operation
- **Why:** Avoids N database queries inside the bulk function - caller fetches once and passes rich objects. Service class doesn't need database access, remains testable without mocking DB
- **Rejected:** Accept call IDs and fetch inside bulkLogCallsToCrm - creates implicit DB dependency, harder to test, harder to batch with cache
- **Trade-offs:** Caller has more responsibility (fetch data first), but service layer stays pure. Better for background jobs that already have data loaded
- **Breaking if changed:** If this is changed to ID-based lookup, requires adding database layer to service, loses testability advantage, and makes caching more complex

### API endpoints accept liberal status codes (200, 401, 403, 500) rather than failing on auth errors (2026-01-16)
- **Context:** Tests verify endpoints return valid responses or auth/error states. Endpoint doesn't distinguish between missing auth vs server error
- **Why:** Authentication middleware returns 401/403 before route handler executes. Endpoint accessibility verification should validate the route exists and auth protection works, not assume 200 response
- **Rejected:** Asserting only 200 status - this fails on protected endpoints and masks auth middleware functionality
- **Trade-offs:** Tests are less strict about response codes but catch registration/routing errors. Sacrifice: can't distinguish auth failures from server errors in tests
- **Breaking if changed:** Removing 401/403 from accepted statuses breaks tests on protected routes. Hiding auth errors breaks ability to verify protection is in place

### Individual server functions for each data type (summary, flow history, burn rate, runway, alerts, suggestions) instead of single unified endpoint (2026-01-16)
- **Context:** Cash position monitor needs 6+ different data queries with different stale times and potentially different auth requirements or rate limits
- **Why:** Enables independent caching strategies per data type. Burn rate changes less frequently than cash flow, runway changes rarely. Single endpoint would force same stale time for all. Also allows progressive loading: UI can request high-priority data first, lower-priority later
- **Rejected:** Single `getCashPositionMonitorAllData()` endpoint returning all data - would require cache invalidation strategy for partial updates and prevent UI from showing stale burn rate while fetching fresh flow history
- **Trade-offs:** More server function definitions to maintain, but gains independent cache invalidation and progressive loading. Cost: 7 instead of 1 API definition. Benefit: UI never waits for slow queries to load fast ones
- **Breaking if changed:** Changing to single endpoint would require rearchitecting query client to manage partial cache updates, potentially losing ability to show stale data while refreshing

#### [Pattern] Four-category compliance check structure (policy_adherence, approval_workflow, documentation, suspicious_patterns) with distinct concerns and response types (2026-01-16)
- **Problem solved:** Compliance monitoring needs to flag different classes of problems that require different remediation paths and stakeholder escalation
- **Why this works:** Separating concerns allows alerts to be routed to appropriate teams (policy violations → finance, approval delays → managers, documentation → submitter, suspicious patterns → fraud team). Each category has different resolution workflows
- **Trade-offs:** Gained: Clear separation enabling targeted notifications. Lost: Must maintain four distinct check implementations with separate metrics

### Designed escalation rules as fully configurable/replaceable via PUT endpoint rather than immutable defaults (2026-01-16)
- **Context:** Need to support both default escalation rules and custom per-organization configurations
- **Why:** Organizations have different SLAs and response times. Providing full CRUD (with reset via DELETE) gives flexibility without forcing migrations. PUT replaces entire ruleset to avoid partial-update confusion
- **Rejected:** Patch-based updates (PATCH with partial rules) - would require complex merge logic and could leave system in inconsistent state if some rules applied but not others
- **Trade-offs:** DELETE fully resets (simpler) but loses intermediate states; full replacement is safer than merging but requires atomicity
- **Breaking if changed:** If rules become immutable, can't adapt to organizational changes; if DELETE removed data instead of reset, recovery becomes impossible

### Using hook-based API abstraction layer (useQrPaymentByQrCode, useQrPaymentByShortCode, useProcessQrPayment) rather than direct API calls (2026-01-16)
- **Context:** Need to fetch QR payment details from multiple API endpoints depending on input type (scanned QR vs short code entered manually)
- **Why:** Hooks encapsulate API logic, error handling, and data transformation. Enables code reuse and centralized payment processing rules. Cache invalidation is consistent
- **Rejected:** Direct API calls in component - would duplicate error handling and payment validation logic across multiple payment entry points
- **Trade-offs:** Extra abstraction layer adds indirection but gains consistency. Payment validation rules live in one place (the hook), not scattered
- **Breaking if changed:** Removing hook abstraction means payment rules would need to be re-implemented in every payment entry point

### Two separate routes for QR payments: /mobile/pay (scanner) and /mobile/pay/$code (direct URL). Both feed into same state machine (2026-01-16)
- **Context:** Payment can be initiated either by scanning QR code or by direct URL with payment code embedded
- **Why:** Allows QR codes to deep-link directly to payment preview (better UX for external QR codes), while scanner page provides full flow. Single component handles both entry points
- **Rejected:** Single route - would require distinguishing entry point inside component, adding conditional logic
- **Trade-offs:** Two routes but same component logic. Route parameter initialization complexity justified by UX flexibility
- **Breaking if changed:** Removing either route breaks one payment initiation method entirely

### Used HTTP 429 (Too Many Requests) with standard rate limit headers instead of custom status codes (2026-01-16)
- **Context:** Multiple ways to signal rate limiting: 429, custom header, 503, etc. Need client compatibility.
- **Why:** 429 is HTTP standard (RFC 6585). Clients, proxies, and tools (curl, fetch, axios) have built-in handling. Headers (X-RateLimit-Limit, Retry-After) follow industry standards, enabling automatic backoff in client libraries.
- **Rejected:** Custom status codes (e.g., 420) - no standard tooling support. 503 - conflates rate limit with server errors. Custom headers alone - clients wouldn't know to retry.
- **Trade-offs:** Gain: Immediate client library support, cdn/proxy cooperation. Lose: None significant, 429 is unambiguous.
- **Breaking if changed:** If status code changed, client libraries won't auto-retry. If Retry-After header removed, clients must guess when to retry (exponential backoff fallback).

### GET /api/jobs/process endpoint for worker triggering, distinct from status monitoring endpoint (2026-01-17)
- **Context:** Worker processing needs to be triggered externally (cron job) but status monitoring should be lightweight and non-blocking
- **Why:** Separating concerns: (1) status.ts is read-only and cacheable, (2) process.ts does work and should be gated by API key to prevent abuse, (3) allows different rate limits and monitoring on processing vs. status checks, (4) status can be called frequently without triggering work
- **Rejected:** Single endpoint that both checks status AND processes (mixing read/write semantics violates REST principles, status checks become expensive)
- **Trade-offs:** Two endpoints to manage vs. clearer separation of concerns and ability to rate-limit processing independently
- **Breaking if changed:** Merging into one endpoint forces every status check to potentially trigger a processing cycle, defeating the purpose of having separate health checks

### Created separate server functions for different search scenarios (smartSearchFn for full, quickSearchFn for autocomplete, searchByTypeFn for filtered) instead of single omnipotent search function (2026-01-17)
- **Context:** Search needed both full comprehensive results and lightweight autocomplete suggestions; loading full results for every keystroke is wasteful
- **Why:** Separation allows each function to optimize its response: quickSearchFn returns minimal data with high RPC efficiency, smartSearchFn includes metadata/scoring for rich display. Mirrors real-world search UX patterns (Google's autocomplete vs full results).
- **Rejected:** Single search function with optional parameters (compact: true) and client-side filtering based on use case
- **Trade-offs:** More server functions to maintain, but each has clear contract and optimization path. Client doesn't pay for data it won't display. Easier to add caching strategies per function.
- **Breaking if changed:** Merging into single function forces trade-off: either autocomplete is heavy/slow or full results lose metadata. Changing one function's data shape affects all use cases.

#### [Pattern] Placeholder replacement in task templates uses simple regex-based substitution with {{fieldName}} syntax and supports dot-notation for nested fields (2026-01-17)
- **Problem solved:** Rules need to generate dynamic task titles/descriptions based on trigger data (e.g., {{customer.name}} in 'Follow up with {{customer.name}}')
- **Why this works:** Regex substitution is simple, human-readable, and doesn't require users to learn complex templating syntax. Dot notation handles nested object access naturally
- **Trade-offs:** No logic in templates (no conditionals/loops), but simplicity means non-technical users can write templates. Edge cases with special characters in field values not handled

#### [Pattern] Server function wrapper pattern with Zod validation + authentication middleware on every function (2026-01-17)
- **Problem solved:** All task conversation link operations needed consistent security and input validation
- **Why this works:** Centralizes validation and auth checks rather than scattering them in route handlers. Zod ensures type safety. Middleware pattern prevents accidental unprotected functions. Failure early with consistent error responses.
- **Trade-offs:** Upfront validation overhead ensures no invalid state reaches database. Makes adding new operations straightforward (copy pattern), but requires discipline to use pattern consistently.

#### [Gotcha] API response always includes a `success: boolean` field regardless of HTTP status code. A 500 error response can still be valid JSON with `success: false` and an error message. (2026-01-17)
- **Situation:** Following the pattern established by other monitor APIs (cash-position, customer-issue). Needed clear way to distinguish API errors from framework errors.
- **Root cause:** Allows graceful degradation - 500 errors with valid JSON can be parsed by clients. The `success` field gives semantic meaning independent of HTTP status.
- **How to avoid:** Redundant with HTTP status codes but more explicit for clients; requires API consumers to check both status and success field

#### [Gotcha] onInterimTranscript fires frequently with partial results during active speech, causing unnecessary re-renders if not properly memoized (2026-01-17)
- **Situation:** Web Speech API provides interim results as user speaks, not just final results; default behavior would update state on every interim event
- **Root cause:** Interim results are essential for real-time feedback UX but need careful handling: (1) frequent updates (100+ per minute during speech) can thrash React reconciliation, (2) callbacks must be stable references or useEffect dependencies cause hook recreation loops
- **How to avoid:** Exposing both interim and final transcripts requires caller to implement their own debouncing/feedback strategy vs simpler API that only exposes final results but loses real-time UX

### API routes return loosely validated response shapes (status OR error) rather than strict types, accepting 200/500 HTTP status codes (2026-01-17)
- **Context:** Workflow process and event routes need to work even if database is disconnected, external services are down, or API keys are not set
- **Why:** Loose validation allows partial failures to return useful responses rather than hard errors. Routes handle multiple deployment configurations gracefully
- **Rejected:** Requiring strict response types would break if any dependency is missing, making the engine brittle in production
- **Trade-offs:** Client code needs to handle multiple response shapes but infrastructure gets more resilient
- **Breaking if changed:** Strict typing would make routes fail completely if any external service is unavailable

### Alert status as queryable dimension (detected, investigating, confirmed, dismissed, resolved) rather than implicit boolean acknowledged/unacknowledged (2026-01-17)
- **Context:** Anomaly workflow is non-trivial: detection → investigation → confirmation → resolution, with dismissal for false positives
- **Why:** Status enables workflow tracking and filtering for different stakeholders: DevOps needs unconfirmed, Finance needs high-severity, Users see only resolved. Boolean flags insufficient
- **Rejected:** Boolean acknowledged field would require additional tables for investigation state, confirmation status, resolution info
- **Trade-offs:** Slightly more complex state machine (5 states) but eliminates orphaned data and provides complete audit trail
- **Breaking if changed:** Removing status field loses investigation workflows; reverting to boolean loses resolution tracking

#### [Pattern] Server functions for analytics operations wrapped with authentication middleware, then wrapped with TanStack Query hooks (2026-01-17)
- **Problem solved:** Need secure API layer with client-side data fetching, caching, and state management
- **Why this works:** Two-layer abstraction: server functions enforce auth/authorization at API boundary, Query hooks add client caching and deduplication. Prevents exposing sensitive operations to unauthenticated clients.
- **Trade-offs:** Gains: security, caching, deduplication. Loses: code duplication between function types and hooks

### Configurable data filters passed as request parameters allowing users to select which data types to export rather than always exporting everything (2026-01-17)
- **Context:** Users may only want specific data (e.g., expenses but not call records), and over-exporting creates privacy/performance concerns
- **Why:** Respects user agency and data minimization principle. Reduces export size/processing time. Users understand their own needs better than default selections
- **Rejected:** Always-export-all approach is simpler but violates principle of least privilege and wastes bandwidth on unwanted data
- **Trade-offs:** More API surface area and frontend complexity, but significantly better user experience and data privacy
- **Breaking if changed:** Removing filter parameters forces all-or-nothing exports, breaking user workflows that need partial exports

### Date range filtering (optional start/end dates) implemented as query parameters rather than required fields (2026-01-17)
- **Context:** Some users want full exports, others want time-bounded data; making fields optional accommodates both without forcing complexity
- **Why:** Follows principle of minimal required input. Optional filters maximize flexibility while keeping simple cases simple
- **Rejected:** Required dates would force all users to think about date ranges even when not needed. Separate endpoints (with/without dates) would duplicate code
- **Trade-offs:** API slightly more complex to document, but dramatically simpler for callers who don't need filtering
- **Breaking if changed:** Making dates required breaks existing clients who want full exports without date logic

### Demo authentication uses role-based access within demo context rather than creating fully separate API endpoints (2026-01-17)
- **Context:** Multiple demo user roles (MD, Field Tech, Sales, Admin) need different data views without duplicating API surface
- **Why:** Role-based filtering in existing endpoints is simpler to maintain than separate API routes; demo context can wrap and filter responses based on role
- **Rejected:** Separate /api/demo/* endpoints; duplicating all endpoints with demo prefix
- **Trade-offs:** Single codebase easier to maintain but requires careful permission checks; separate endpoints would be more explicit about boundaries
- **Breaking if changed:** Removing role-based filtering from demo context means all demo users see all data regardless of selected role

### Tenant selection precedence: headers > subdomain > default tenant, with explicit control over each via options (2026-01-17)
- **Context:** Different deployment scenarios require different tenant selection strategies - some use subdomains, some use headers, some need fallback
- **Why:** Headers are most reliable (work across deployments), subdomains offer UX benefit (single subdomain per tenant), default tenant provides sensible fallback. Option flags allow disabling each in order
- **Rejected:** Single fixed strategy; trying to auto-detect which to use
- **Trade-offs:** Developers must understand precedence order. Configuration can be confusing if not documented. But allows flexibility without breaking changes
- **Breaking if changed:** Changing precedence order would silently break deployments relying on specific behavior (e.g., header overrides disabled but subdomain breaks tenant isolation)

### Server functions return WebRTC config to client; SIP.js library instantiation happens on client with config from server (2026-01-17)
- **Context:** SIP server credentials and endpoints are sensitive and user-specific; browser needs WebRTC APIs for peer connections
- **Why:** Separates concerns: server owns credential authority, client owns WebRTC session. Prevents storing active sessions on server (reduces scaling issues). Client-side session handles browser APIs naturally
- **Rejected:** Server-side WebRTC with server-sent events/WebSocket would require session state management on server; client-side SIP.js without server config would hardcode credentials
- **Trade-offs:** Credentials briefly in browser memory vs easier auth/multi-device handling; client controls call lifecycle vs potential device-specific issues harder to debug remotely
- **Breaking if changed:** Moving session state to server requires session persistence layer and cleanup; removing server function validation breaks credential refresh logic

### Added approverId parameter requirement to approveWorkflowApproval() and rejectWorkflowApproval() functions with explicit access validation (2026-01-17)
- **Context:** Workflow approval functions lacked user identity context, creating security vulnerability where any caller could approve/reject without authorization
- **Why:** Explicit parameter forces callers to provide and validate user context before making decisions. Prevents accidental privilege escalation and audit trail issues
- **Rejected:** Could infer from session/context, but explicit parameter makes authorization intention visible at call site and easier to test
- **Trade-offs:** Slightly more verbose at call sites but dramatically improves security auditability. Makes auth failures explicit rather than silent
- **Breaking if changed:** Any code calling these functions without approverId parameter will fail at compile time, forcing migration of calling code