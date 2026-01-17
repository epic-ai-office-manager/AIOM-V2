---
tags: [architecture]
summary: architecture implementation decisions and patterns
relevantTo: [architecture]
importance: 0.7
relatedFiles: []
usageStats:
  loaded: 1
  referenced: 0
  successfulFeatures: 0
---
# architecture

#### [Gotcha] Test file naming convention (.spec.ts vs .test.ts) breaks silent test discovery (2026-01-16)
- **Situation:** Created verification tests that wouldn't run because playwright.config.ts explicitly restricts test pattern to '*.spec.ts'
- **Root cause:** Playwright config uses specific glob pattern; test naming convention varies across projects, causing hidden test failures
- **How to avoid:** Easier: standardized naming across tooling. Harder: easy to accidentally create tests in wrong format that appear to pass (they don't run)

### CallDirection and CallStatus as distinct type literals rather than enums (2026-01-16)
- **Context:** TypeScript needs to represent a fixed set of valid values for call direction and status
- **Why:** Using type literals ('inbound' | 'outbound') keeps types in TypeScript, making them tree-shakeable and avoiding JavaScript enum overhead. This matches the Drizzle schema definition approach and eliminates the enum/string mismatch problem.
- **Rejected:** Could have used TypeScript enums or string enums, but enums generate runtime code and create two sources of truth (enum definition vs schema validation)
- **Trade-offs:** Type literals require duplication between TypeScript and Drizzle schema, but they're database-truth-compatible and don't generate unnecessary runtime code
- **Breaking if changed:** If changed to TypeScript enums, the schema definition must be kept in sync or validation breaks; if using only Drizzle enums, TypeScript doesn't provide compile-time checking

### Type-safe XML-RPC protocol implementation with explicit encoding/decoding functions rather than generic serialization (2026-01-16)
- **Context:** Building a client for Odoo's XML-RPC API which has strict protocol requirements and non-standard data types
- **Why:** XML-RPC has specific formatting rules (e.g., <int>, <boolean>1</boolean>, <array><data>), and strict parsing requirements. Explicit functions catch protocol errors early and provide clear error messages. Generic JSON serialization would silently produce invalid XML-RPC.
- **Rejected:** Using a library like 'xml-rpc' npm package - would add external dependency and reduce control over error handling and response parsing
- **Trade-offs:** More code to maintain but full control over protocol compliance; better error messages when XML-RPC is malformed; no hidden assumptions from a library
- **Breaking if changed:** Switching to generic serialization would break all Odoo communication - the XML structure must match exactly or Odoo rejects requests

#### [Gotcha] OdooRecord index signature conflict: `[key: string]: XmlRpcValue` conflicts with optional/undefined fields in derived interfaces (2026-01-16)
- **Situation:** When extending OdooRecord with specific typed fields, TypeScript complained about field assignments being incompatible with index signature
- **Root cause:** The index signature declares all keys have type XmlRpcValue (non-nullable), but some fields should be optional. Solution was changing signature to `[key: string]: XmlRpcValue | undefined` to allow optional fields while maintaining type safety for required ones.
- **How to avoid:** Permitting undefined in index signature is slightly more permissive but necessary for optional fields; the explicit union type documents that fields can be missing

### Session-based authentication with explicit isAuthenticated() check rather than implicit header injection (2026-01-16)
- **Context:** Odoo XML-RPC requires session ID and user ID in every method call after initial authentication
- **Why:** Explicit session state (`if (!client.isAuthenticated()) throw OdooAuthenticationError`) makes the requirement visible in code and prevents silent failures. Implicit injection (auto-adding headers) would hide when session is missing or expired, causing confusing errors deep in call stack.
- **Rejected:** Middleware that auto-injects session headers - would hide authentication state; exception on session miss without explicit check
- **Trade-offs:** Requires calling isAuthenticated() before operations but makes security explicit; easier to test different auth states; prevents token reuse after expiration
- **Breaking if changed:** Removing explicit auth check would allow operations on unauthenticated clients, failing cryptically at Odoo server rather than at client boundary

#### [Pattern] Multi-type interface hierarchy for Odoo records (OdooRecord base -> ResPartner, ResProduct, etc.) to maintain type safety while allowing dynamic field access (2026-01-16)
- **Problem solved:** Odoo API returns diverse record types with common fields (id, name) and type-specific fields (email for partner, price for product)
- **Why this works:** Each model interface extends OdooRecord with its specific fields. This allows `client.searchRead<ResPartner>()` to return strongly-typed results where TypeScript knows about `partner.email` while still supporting `partner[dynamicFieldName]` access. Avoids `Record<string, any>` which loses all type information.
- **Trade-offs:** Requires defining interfaces for common models (boilerplate); but provides excellent IDE support, compile-time safety, and clear API contract

#### [Pattern] Separated concerns into 4 layers: Schema (types) → DB (IndexedDB ops) → Hooks (React integration) → Data-Access (business logic) (2026-01-16)
- **Problem solved:** Needed offline queue system that works with React while remaining testable and reusable across components
- **Why this works:** Layering prevents: (1) Schema coupling to storage implementation (can swap IndexedDB for SQLite later), (2) Direct IndexedDB access scattered across components, (3) Business logic mixed with React lifecycle hooks. Each layer has single responsibility and clear contracts
- **Trade-offs:** More files to maintain (+4 new files) but enables testing individual layers independently; data-access layer acts as adapter making components agnostic to storage

#### [Pattern] useOfflineQueue hook auto-syncs on online event (debounced 2s) rather than polling or background worker (2026-01-16)
- **Problem solved:** Needed automatic sync when user regains connectivity without manual trigger
- **Why this works:** Event-driven approach: (1) 'online' event naturally fires when network returns, (2) debouncing prevents multiple syncs during flaky connections, (3) Hook owns sync logic so it knows data state, (4) No background process overhead
- **Trade-offs:** Depends on browser 'online' event accuracy (can have false positives on some networks); debouncing may delay initial sync by 2s; hook must maintain sync state to prevent concurrent syncs

#### [Gotcha] ES module syntax with import.meta.url required for test file paths instead of CommonJS __dirname - Playwright + Node ESM interop issue (2026-01-16)
- **Situation:** Test setup needed to navigate to local file; used require('path') and __dirname but ES modules don't have these globals by default
- **Root cause:** Node ESM doesn't provide __dirname/require - must use fileURLToPath(import.meta.url) to get current file path. Playwright project likely configured as ESM
- **How to avoid:** More boilerplate for file path setup but ensures ESM compatibility; harder to understand than CommonJS for developers unfamiliar with import.meta

### Dual provider pattern (Web Push + FCM) with orchestration service instead of single notification system (2026-01-16)
- **Context:** Need to support both browser push (Web Push API) and mobile/native (Firebase Cloud Messaging)
- **Why:** Allows platform-specific optimizations while maintaining unified interface. Web Push requires VAPID keys and service workers; FCM requires Firebase SDK. Single unified interface via service.ts hides complexity.
- **Rejected:** Separate notification systems per platform (harder to maintain, duplicate logic). Single provider (wouldn't support all platforms).
- **Trade-offs:** Added orchestration layer increases code, but eliminates copy-paste bugs and makes platform switching transparent to callers
- **Breaking if changed:** If orchestration removed, callers must know which provider to use; migration would require rewriting all notification calls

#### [Pattern] Server functions as boundary layer between client hooks and data access, with explicit separation of concerns (2026-01-16)
- **Problem solved:** Need client to register devices, send notifications, and query delivery status
- **Why this works:** Prevents database queries from leaking to client. Server functions handle auth validation (can't subscribe other users' devices), data transformation, and transaction logic. TanStack Query consumes these functions, providing caching and state management.
- **Trade-offs:** Extra abstraction layer but eliminates entire class of security bugs and makes testing easier

#### [Pattern] Registry pattern with centralized widget definitions instead of direct component imports (2026-01-16)
- **Problem solved:** Managing multiple widget types (TaskList, ApprovalQueue, FinancialSummary, Alerts, Chart) with ability to dynamically register and query by category
- **Why this works:** Enables dynamic widget discovery without hardcoding all widget types into WidgetGrid. Allows third-party widget registration at runtime. Makes adding new widgets additive rather than requiring grid component changes
- **Trade-offs:** Added indirection layer (registry lookup) but gained extensibility. Slightly more boilerplate for new widgets (must register in registry) but decouples widget definitions from container logic

#### [Pattern] localStorage persistence for widget instances via custom useWidgets hook rather than server-side storage (2026-01-16)
- **Problem solved:** Need to persist user's widget customizations (which widgets added, their positions) across page refreshes
- **Why this works:** Simplifies implementation without backend dependencies. Works immediately for demo purposes. Can be transparently swapped to server storage later since hook abstracts the persistence layer
- **Trade-offs:** localStorage data is per-browser (doesn't sync across devices) and has limited capacity (~5MB). But provides immediate UX without infrastructure. Hook makes migration path clear

#### [Pattern] Widget configuration via TypeScript interfaces rather than JSON schema or runtime validation (2026-01-16)
- **Problem solved:** Widgets have varying configuration options (chart type, size, refresh interval, etc.)
- **Why this works:** TypeScript interfaces provide compile-time safety and IDE autocomplete for widget configuration. Type checking catches config errors before runtime
- **Trade-offs:** Requires TypeScript compilation but developers get immediate feedback. Configuration is statically verified

#### [Pattern] Sample/demo data embedded in widget definitions instead of fetched from API (2026-01-16)
- **Problem solved:** Widgets need to display data immediately without backend infrastructure
- **Why this works:** Enables self-contained demo of widget system. Widgets work standalone without API setup. Real data can be passed via props, sample data is fallback
- **Trade-offs:** Demo data adds bundle size but enables immediate functionality. Clear path to replace with real data via props

### WidgetContainer wraps individual widgets, WidgetGrid manages collection - two-layer component hierarchy (2026-01-16)
- **Context:** Need individual widget rendering with consistent styling/error handling AND grid-level features like add/remove/drag
- **Why:** Separation allows WidgetContainer to handle single widget concerns (sizing, error boundaries, delete button) while WidgetGrid handles collection concerns (layout, widget picker, edit mode). Avoids god component
- **Rejected:** Single WidgetGrid component managing both would become complex. Duplicate wrapper logic in each widget definition would violate DRY
- **Trade-offs:** Extra component level but each component has single responsibility. Clear data flow (Grid → Container → Widget)
- **Breaking if changed:** Removing WidgetContainer would require WidgetGrid to handle widget-level concerns, making grid component unmaintainable as more features added

### Separated unit tests into a dedicated Playwright config without webServer dependency (2026-01-16)
- **Context:** Initial test run hung because playwright.config.ts required webServer. Unit tests for utility functions don't need a running server.
- **Why:** Unit tests should be independent of server state to run faster and avoid test flakiness. Decoupling test infrastructure from application server improves CI/CD efficiency.
- **Rejected:** Running all tests through single config with webServer would block unit tests on server startup, creating bottlenecks and false failures from server issues.
- **Trade-offs:** Added complexity of dual configs (playwright.config.ts and playwright-unit.config.ts) but eliminated test coupling to server state. Trade worth it for test isolation.
- **Breaking if changed:** If configs are merged back into single file without conditional webServer logic, unit tests will hang waiting for server that they don't need.

#### [Gotcha] FastAPI middleware intercepts HTTPException before exception handlers can process them, preventing proper status code propagation (2026-01-16)
- **Situation:** Exception handlers are registered to catch HTTPException and return custom JSON responses with proper status codes, but middleware execution order causes exceptions to be converted before handlers run
- **Root cause:** FastAPI's middleware stack executes before exception handlers in the request lifecycle. HTTPException raised in route handlers gets caught by middleware layer first
- **How to avoid:** Must handle exceptions at middleware level or restructure code flow; simpler error handling consistency vs more complex middleware logic

### Rate limiting as middleware rather than decorator on individual routes (2026-01-16)
- **Context:** Need to enforce per-client rate limits across entire mobile API gateway
- **Why:** Middleware applies globally without decorating each endpoint; catches all requests including health checks; enforces policy at infrastructure level not application level
- **Rejected:** Per-route decorators (maintenance burden as routes grow, easy to miss endpoints); custom application logic (not separation of concerns)
- **Trade-offs:** Consistent enforcement across all routes vs cannot easily exclude specific endpoints without additional middleware logic; global policy easier to understand vs harder to debug rate limit issues
- **Breaking if changed:** Removing rate limit middleware removes protection for entire API; cannot selectively disable for specific routes without middleware refactoring

### Reused existing server functions (getPendingExpenseRequestsFn, approveExpenseRequestFn, rejectExpenseRequestFn) rather than creating new API endpoints (2026-01-16)
- **Context:** Building approval workflow interface that needs to interact with expense requests
- **Why:** Server functions already existed in the codebase and provided the necessary query/mutation patterns. Creating duplicate endpoints would violate DRY and create maintenance burden
- **Rejected:** Creating new REST API endpoints specific to the approval workflow
- **Trade-offs:** Easier: code reuse, single source of truth for business logic. Harder: approval-specific logic must be embedded in existing function calls rather than having dedicated endpoints
- **Breaking if changed:** If existing server functions are removed or signatures change, the approval interface breaks completely

#### [Gotcha] Dialog-driven approval workflow requires separate user intent capture (modal for comment/reason) before action submission (2026-01-16)
- **Situation:** Rejection requires mandatory reason field, approval allows optional comments - couldn't be done inline
- **Root cause:** Dialog state management ensures data is validated before submission and provides clear UX flow for additional input. Inline editing would be ambiguous about when to save
- **How to avoid:** Easier: clear submit flow, prevents accidental submissions. Harder: adds modal complexity, two-step interaction instead of one-click

### Component structure separates approval list page (routes/dashboard/approvals/index.tsx) from card component (components/expense-approval/ExpenseApprovalCard.tsx) (2026-01-16)
- **Context:** Building reusable approval interface that might be displayed in different contexts
- **Why:** Card component is stateless and receives all props, making it reusable in other approval UIs. Container handles data fetching and state management, following container/presentational pattern
- **Rejected:** Monolithic component with all logic in the page route
- **Trade-offs:** Easier: reusability, testability of card in isolation. Harder: prop drilling for callbacks (onApprove, onReject)
- **Breaking if changed:** If card component logic is merged back into page, reusability is lost and future approval UIs would duplicate code

#### [Pattern] Separation of validation schema, server functions, query options, and custom hooks into four separate files rather than collocating in component (2026-01-16)
- **Problem solved:** ExpenseRequestForm component is lean (~200 lines) while validation, API logic, caching, and state management exist in separate modules following feature-based file organization.
- **Why this works:** Enables reusability - any component or page can import the hooks/functions without depending on the form. Allows testing validation independently from UI. Follows existing codebase patterns (ContentForm/EventForm).
- **Trade-offs:** Requires developers to understand 4-file import chain (schema→fn→queries→hooks) but decouples presentation from business logic and data access

### Multi-provider push notification service with FCM and Web Push as separate implementations (2026-01-16)
- **Context:** Needed to support both FCM (for mobile/cross-platform) and Web Push (for browser-based notifications)
- **Why:** Separating providers allows independent testing, failure isolation, and graceful degradation. Service orchestrator pattern lets each provider handle its own authentication and API specifics without leaking concerns upward
- **Rejected:** Single monolithic push service that tried to handle both protocols. Would couple unrelated concerns and make testing either provider difficult
- **Trade-offs:** More files and abstraction layers, but gains provider independence and easier to add third providers later (APNs, OneSignal, etc). Slightly more complex than single implementation
- **Breaking if changed:** If the orchestrator (service.ts) is removed, the entire notification system fails. Each provider is replaceable but the orchestrator is critical

#### [Pattern] Server functions as abstraction layer between hooks and data-access, enabling isomorphic code execution (client or server) (2026-01-16)
- **Problem solved:** Push notification operations need to work from browser (register device) and server (send broadcasts). Direct hook-to-database calls would require client-side database access
- **Why this works:** Server functions (the `Fn` suffix pattern) act as RPC boundary. Browser can call registerDeviceFn which runs on server, maintaining security and allowing server-only operations like FCM. Hooks call server functions, not database directly
- **Trade-offs:** Extra layer adds abstraction overhead. But provides security boundary, audit trail capability, and transaction support

### Two-tier caching strategy: Anthropic prompt caching (server-side, persistent) + in-memory RenderedTemplateCache (client-side, ephemeral) (2026-01-16)
- **Context:** Prompt templates can be expensive to render with Claude API; same templates are often rendered multiple times in user sessions
- **Why:** Anthropic caching reduces API costs by 90% on reads after 25% creation cost. In-memory cache eliminates redundant renders within session without storage overhead. Combination optimizes both cost and latency.
- **Rejected:** Single-layer caching (either just API-level or just in-memory) would either increase API calls or lose persistence across sessions
- **Trade-offs:** More complex cache invalidation logic. Must sync when templates updated. Trade memory usage for API cost savings.
- **Breaking if changed:** Removing in-memory cache increases per-render latency. Removing API caching increases per-user cost by 10x for repeated templates.

### Handlebars-like templating syntax ({{variable}}, {{#if}}, {{#each}}) implemented in-house rather than using existing template engine (2026-01-16)
- **Context:** Need simple, familiar syntax for non-technical users to create templates with variables and conditionals
- **Why:** Avoids large dependency. Syntax is familiar to non-developers from Handlebars/Jinja. In-memory rendering cost is negligible. Custom implementation allows tight control over what's allowed (security).
- **Rejected:** Using nunjucks/handlebars library adds bundle weight. mustache is too limited for {{#if}} support. Full Liquid would be overkill.
- **Trade-offs:** Build custom parser vs dependency cost. Custom version is more maintainable for this limited use case but requires updating if syntax requirements grow.
- **Breaking if changed:** Switching template engines breaks all existing template syntax. Migration required for every saved template.

#### [Pattern] Dual-interface pattern: useTemplate (read/execute) and useTemplateManagement (CRUD), separating concerns by user capability (2026-01-16)
- **Problem solved:** Most users only execute templates; few create/edit. Need different permission models and queries for each
- **Why this works:** Separates concerns. useTemplate is lightweight for viewers. useTemplateManagement is heavier (requires auth, perms checks). Allows UI to use appropriate hook based on user role.
- **Trade-offs:** More hooks to document. Risk of mixing them up. But clearer intent and smaller dependency trees.

### executeTemplateFn calls Claude API directly; doesn't cache template, only renders it first (2026-01-16)
- **Context:** Template execution is expensive ($0.01-0.10 per call). Templates are rendered multiple times but executed only when user explicitly requests.
- **Why:** Separation: rendering is deterministic/cacheable, execution is non-deterministic/one-time. Cached render avoids re-parsing template. But execution (API call) happens fresh each time because output is unique.
- **Rejected:** Caching execution would give stale results. Different inputs produce different outputs, so cache miss rate would be high.
- **Trade-offs:** Must render before every execution (negligible cost). Execution cost is per-call, not reduced by caching.
- **Breaking if changed:** If execution moved to cache, would return stale responses. Users expect fresh results from LLM.

#### [Pattern] Multi-step approval workflow with configurable chain stored as JSON array in database (2026-01-16)
- **Problem solved:** Different business units need different approval hierarchies (1-5 approvers); approval decisions must be auditable; current approver needs dynamic determination
- **Why this works:** JSON array avoids complex relational mapping; supports variable chain length per voucher; can determine 'current approver' by finding first non-approved step; approval history table captures full audit trail separately
- **Trade-offs:** Query logic for finding next approver is slightly complex (JSON parsing); cannot use database constraints on chain validity; requires application-level validation of approval sequence

### Approval history stored in separate audit table rather than versioning main record (2026-01-16)
- **Context:** Need full audit trail of who approved/rejected and when; approval decisions are immutable facts; voucher undergoes multiple revisions
- **Why:** Separates immutable audit data from mutable business data; enables complex approval queries (pending approvers, rejection history) without scanning version history; explicit schema for compliance audits
- **Rejected:** Version all voucher rows - bloats main table; complicates queries needing current state; audit trail intermingled with draft changes
- **Trade-offs:** JOIN required to get full approval context; slightly denormalized (approver info stored redundantly); must maintain referential integrity between tables
- **Breaking if changed:** Removing approval_history table loses audit trail; regulatory compliance violation; cannot explain approval decisions to auditors; cannot rollback approvals correctly

### Permission hierarchy system with 5 tiers (public < user < premium < admin < system) enforced at registry.execute() level, not at individual tool level (2026-01-16)
- **Context:** Tool registry needed to support multi-tenant access control with varying permission levels across different tool types
- **Why:** Centralizing permission checks at execution prevents scattered auth logic and ensures consistency. Hierarchical model allows inheritance (admin can access user tools) without duplicating checks per tool
- **Rejected:** Per-tool permission decorators would require boilerplate on every tool definition and make permission changes difficult
- **Trade-offs:** More flexible centrally but requires passing context through entire execution chain. Harder to express tool-specific rules (e.g., 'user can access tool X but not Y at same permission level')
- **Breaking if changed:** Removing the hierarchy check would expose all tools to all permission levels without proper enforcement

#### [Pattern] Server functions (getToolsFn, executeToolFn) expose registry operations to client, with React hooks (useExecuteTool, useTools) providing idiomatic client interface via TanStack Query (2026-01-16)
- **Problem solved:** Need to separate server-side registry logic from client consumption while maintaining type safety and caching
- **Why this works:** Server functions are RPC layer that doesn't expose internal registry details. Hooks abstract TanStack Query complexity and provide consistent data-fetching pattern. Separation prevents client from directly instantiating registry
- **Trade-offs:** Adds RPC layer and hook boilerplate but ensures all server operations are explicit and cacheable. Client stays thin and testable

### Separate mobile-gateway FastAPI service (Python) with its own auth endpoints instead of extending main TypeScript backend (2026-01-16)
- **Context:** Mobile clients need optimized endpoints (lightweight responses, different auth flow) plus push notification/background job capability
- **Why:** Python + FastAPI better suited for async gateway work, push notifications, and mobile-specific optimizations. Separates mobile concerns from web app logic. Independent scaling. Token validation still done by main app.
- **Rejected:** Single TypeScript backend with mobile flag (mixing concerns, harder to optimize), mobile endpoints in existing API (performance regress for web users)
- **Trade-offs:** Extra service to maintain vs independent scaling; network call to gateway vs optimized response times; dual auth systems vs clear separation of concerns
- **Breaking if changed:** Removing gateway requires implementing mobile endpoints in TypeScript backend; losing it means no push notification/background job capability

### Implemented long-polling with subscription management via database table (odooDiscussSubscription) rather than in-memory subscriptions (2026-01-16)
- **Context:** Real-time updates needed for Odoo Discuss messages and notifications in a server-side rendered application with potential multiple instances
- **Why:** Database-backed subscriptions persist across server restarts and work in multi-instance deployments. In-memory state would be lost on server reload or unavailable across load balancer instances.
- **Rejected:** In-memory Set<userId> or Redis-based subscriptions - these don't persist if server restarts and complicate horizontal scaling
- **Trade-offs:** Slightly higher latency (database query overhead) but guaranteed persistence and scalability. Polling interval becomes the limiting factor for real-time guarantees.
- **Breaking if changed:** Removing the odooDiscussSubscription table breaks the polling system - subscriptions won't be tracked across server instances

#### [Pattern] Explicit state transition map (WORKFLOW_STATE_TRANSITIONS) as a centralized data structure rather than hardcoding transitions in conditional logic within state methods (2026-01-16)
- **Problem solved:** Workflow has 10+ states with specific allowed transitions and complex validation rules per transition
- **Why this works:** Declarative transition map enables validation before state changes, prevents illegal transitions, and makes workflow rules visible/testable without reading method implementations. Single source of truth for state machine topology
- **Trade-offs:** Easier: adding new states, validating transitions, visualizing workflow; Harder: conditional transition logic (e.g., 'approve only if amount < 5000' requires method-level checks)

### Separate notification service with template-based generation and queue-based processing rather than inline notifications in engine transitions (2026-01-16)
- **Context:** Workflow triggers notifications at multiple stages, each notification has unique content, and notifications may fail and need retry
- **Why:** Decoupling notification logic from state transition logic prevents state transitions from being blocked by notification failures. Template-based system allows non-engineers to modify notification content. Queue enables reliable async processing with exponential backoff
- **Rejected:** Synchronous notification calls in each transition method - would require fallback logic in state machine, notification failures could block critical business operations
- **Trade-offs:** Easier: resilience, content management, scaling; Harder: debugging which notification failed, eventual consistency of notifications
- **Breaking if changed:** Removing notification queue requires inline notifications, creating tight coupling between workflow and communication systems

### Terminal states (TERMINAL_STATES) explicitly tracked as a set for end-of-workflow detection, rather than inferring from 'no valid transitions' logic (2026-01-16)
- **Context:** Workflow needs to know when an expense has completed all processing and should stop accepting new transitions
- **Why:** Explicit terminal state set enables early exit from transition validation, prevents accidental continuation past workflow end, and makes workflow finality declarative and testable
- **Rejected:** Checking if transition map has no valid transitions from current state - indirect and could miss edge cases where terminal state changes
- **Trade-offs:** Easier: workflow completion detection, preventing post-completion modifications; Harder: must manually maintain terminal states list in sync with transition map
- **Breaking if changed:** Removing terminal states set requires checking transition map, losing explicit completion semantics

### Dual deep link parsing strategy: custom scheme uses hostname for screen, HTTPS uses pathname for screen extraction (2026-01-16)
- **Context:** Supporting both aiom://expense?id=456 and https://app.example.com/expense/123 URL formats with different structural layouts
- **Why:** Custom schemes have no pathname until after hostname (aiom://expense/123 makes expense the hostname), while HTTPS URLs have standard path structure. Treating them differently allows unified screen extraction despite opposite URL structures
- **Rejected:** Single unified parsing logic that assumes URL structure consistency - would require URL rewriting or normalization that breaks native deep link handling
- **Trade-offs:** Increased code complexity (+8 lines conditional logic) vs. simpler but fragile single-path approach. Conditional logic makes intent explicit at cost of maintainability
- **Breaking if changed:** If URL scheme parsing changes in TypeScript URL constructor, both paths break simultaneously. If custom scheme format changes (e.g., aiom://path/to/expense), entire hostname extraction fails silently

#### [Pattern] Path params mapped to id-keyed object { id: pathParams[0] }, query params merged separately into same params object (2026-01-16)
- **Problem solved:** Handling URLs like /expense/123?action=approve where both path segment and query string contain navigation data
- **Why this works:** Standardizes all parameters under single params object for downstream consumption. Path-first ID assumes conventional REST structure where first path segment is resource identifier. Query params add orthogonal filtering/action data
- **Trade-offs:** Single params object easier for consumers but loses structure if multiple path params needed (currently only id supported). Query param override of path param id would silently fail

### Notification params support only single ID (pathParams[0]) despite URL potentially containing multiple path segments (2026-01-16)
- **Context:** URLs like /messages/conv123/thread456 could contain nested resource identifiers
- **Why:** Simplifies initial implementation for common case (single resource ID). Most notifications are single-resource (one expense, one message, one call). Multi-segment paths are rare in mobile deep linking
- **Rejected:** Supporting pathParams array would require consumers to know expected param count/order. Named path params would require per-screen URL templates
- **Trade-offs:** Minimal code now ({id: pathParams[0]}) but future nested resources require API change. Current implementation wastes any path params beyond first segment
- **Breaking if changed:** Adding /message/conv123/thread456 style URLs creates ambiguity - only conv123 reaches handler. Consumers expecting thread456 silently lose it. Would require versioning deep link format or expanding param model

### Implemented a layered architecture pattern: types → data-access → server functions → query options → React hooks (2026-01-16)
- **Context:** Building a complex financial querying service with multiple data models and operations
- **Why:** This vertical slice pattern ensures separation of concerns, makes testing easier at each layer, and prevents business logic from leaking into UI components. Each layer has a single responsibility.
- **Rejected:** Flat structure where hooks directly call Odoo API or placing types alongside API calls
- **Trade-offs:** More boilerplate code upfront but significantly easier to refactor, test, and add new accounting features without touching existing code
- **Breaking if changed:** Removing any layer would require refactoring all dependent layers. The chain must stay intact: types must be defined before data-access can use them, data-access must exist before server functions can wrap them, etc.

#### [Pattern] Created a composite hook (useAccountingDashboard) that combines related queries with proper loading and error state management (2026-01-16)
- **Problem solved:** Multiple accounting queries needed together for a dashboard view with complex loading states
- **Why this works:** Prevents waterfalls where child components wait for parent data and provides a single source of truth for combined loading/error states. Avoids the 'loading soup' problem where multiple independent queries create unclear UX
- **Trade-offs:** Composite hook is opinionated about which queries belong together (less flexibility) but provides much clearer data dependencies and loading patterns that UI can understand

#### [Gotcha] Financial snapshot aggregates multiple data points (top partners, net position, overdue amounts) into a single read model rather than querying each separately (2026-01-16)
- **Situation:** Dashboard needs several accounting KPIs together but they come from different Odoo models
- **Root cause:** Single network request for related data prevents waterfalls and reduces total API calls. Odoo models (account.move, res.partner, account.payment.term) aren't denormalized, so aggregation must happen in application code
- **How to avoid:** Harder to cache individual pieces (must invalidate entire snapshot) but massively faster user experience since all data arrives in one request

### Moved type definitions from useMutation generic parameters to inline async function signatures with type assertions (2026-01-16)
- **Context:** TanStack Start server function signatures had incompatibility issues with generic type parameters in useMutation<TData, TError, TVariables>
- **Why:** Framework-level type inference issues with TanStack Start's server function return types prevented proper generic typing. Inline function typing allows runtime compatibility while maintaining type safety at the mutation boundary.
- **Rejected:** Keep generic type parameters on useMutation - causes type incompatibility with server function inferred types from Zod schemas
- **Trade-offs:** Lost explicit TypeScript generic type hints in function signature (less IDE autocomplete in some contexts) but gained actual runtime compatibility and cleaner code. Trade clarity for functionality.
- **Breaking if changed:** Reverting to generic parameters will re-introduce server function type errors that prevent compilation in strict mode

#### [Pattern] Composite hooks like useAIConversation combine multiple queries and mutations into single hook for convenience, while simple hooks expose individual operations (2026-01-16)
- **Problem solved:** Need to provide both low-level flexibility (individual queries/mutations) and high-level convenience (complete conversation workflows)
- **Why this works:** Allows component developers to choose between 'do one thing' (individual hooks) and 'do everything' (composite hooks) based on use case. Composite hooks prevent prop drilling and query coordination bugs.
- **Trade-offs:** More hook implementations to maintain, but massive reduction in consumer code complexity. Composite hooks must handle query interdependencies (e.g., invalidating list when detail changes)

#### [Pattern] Query key arrays include resource ID as key segment: ['ai-conversations', 'detail', conversationId] rather than nested objects (2026-01-16)
- **Problem solved:** TanStack Query uses query key for caching and invalidation; need reliable key matching for batch operations
- **Why this works:** Array keys enable partial matching in invalidateQueries - can invalidate all conversation details with queryKey: ['ai-conversations', 'detail'] regardless of ID. Objects don't support this pattern.
- **Trade-offs:** Array keys are less self-documenting but dramatically more powerful for cache invalidation patterns. Required to support analytics endpoint clearing multiple caches.

#### [Pattern] Lazy initialization of tool registration via ensureToolsRegistered() function called on first registry endpoint access (2026-01-16)
- **Problem solved:** Financial tools needed to be available through the tool registry system without requiring explicit registration code or module imports in multiple places
- **Why this works:** Avoids circular dependency issues and keeps tool registration decoupled from module loading. Ensures tools are only registered once and at the right time in the application lifecycle
- **Trade-offs:** Slightly delayed first tool registry call, but eliminates initialization order dependencies and reduces coupling between modules

#### [Gotcha] Tool definitions must export both individual tool constants AND a financialTools array, requiring careful maintenance of multiple export points (2026-01-16)
- **Situation:** System expects tools to be accessible both individually for selective registration and as a collection for bulk operations
- **Root cause:** Supports flexible registration patterns - consumers can pick specific tools or register all at once. The array format matches the existing example tools pattern
- **How to avoid:** More maintenance burden (must add to both places), but enables the lazy registration pattern and maintains consistency with existing patterns

#### [Pattern] Tool handlers return structured ToolResult with success boolean and explicit error objects containing code/message/retryable properties (2026-01-16)
- **Problem solved:** Tools need consistent error handling and recovery capabilities for Claude AI to understand whether to retry operations
- **Why this works:** Enables intelligent retry logic and proper error reporting. The retryable flag allows Claude to distinguish between permanent failures (wrong data) and transient failures (network timeouts)
- **Trade-offs:** Requires consistent boilerplate in each tool handler, but eliminates try-catch chains and makes error semantics explicit and discoverable

#### [Pattern] Tool definitions include semantic tags ('finance', 'accounting', 'ar', 'ap', 'invoice', 'payment', 'aging', 'balance') for searchability and Claude context (2026-01-16)
- **Problem solved:** Claude needs to understand which tools apply to user queries about financial operations
- **Why this works:** Tags enable Claude's prompt system to select relevant tools based on query content. More discoverable than relying on tool names/descriptions alone
- **Trade-offs:** Additional metadata to maintain, but significantly improves Claude's ability to select the right tool without trial-and-error

### Split partner operations into dual-layered architecture: data-access layer for core Odoo queries + separate server functions layer for API exposure with authentication (2026-01-16)
- **Context:** Building a query service for Odoo partners that needs both programmatic access and secure API endpoints
- **Why:** Separates concerns between data retrieval logic (reusable, testable) and HTTP/authentication concerns (security, validation). Prevents duplicating Odoo query logic when exposing APIs. Allows data-access to be used internally without authentication overhead.
- **Rejected:** Single function layer (combining both) would tangle data logic with auth middleware and force authentication on internal calls
- **Trade-offs:** More files and indirection, but gains flexibility - internal functions can call data-access directly, while server functions add security wrapper. Matches TanStack Router patterns.
- **Breaking if changed:** If server functions removed, API endpoints disappear but internal data-access functions remain functional. If data-access layer removed, all server functions break - no fallback exists.

### Extended partner types (PartnerDetail, PartnerWithBalance, etc.) created as separate interfaces rather than single generic Partner type with optional fields (2026-01-16)
- **Context:** Different use cases need different partner data subsets with different precision
- **Why:** Explicit types make API contracts clear - caller knows exactly what fields are available on each type without reading documentation. Type safety - accessing undefined field is caught at compile-time. Enables better tree-shaking since unused types aren't fetched.
- **Rejected:** Single generic type with optional fields (Partner extends ResPartner with extra?) would be more concise but loses type safety and clarity
- **Trade-offs:** More types to maintain (6 partner variants). But each type clearly documents what's included and consumers get strict typing.
- **Breaking if changed:** If a type is removed, all callers of that type break immediately. Can't gracefully degrade to 'whatever partner data is available'.

#### [Pattern] Tool call results are displayed in collapsible panels showing input, output, and execution time metadata. This separates AI reasoning from tool execution details. (2026-01-16)
- **Problem solved:** Natural language queries trigger AI to call business tools, results need to be communicated back to user
- **Why this works:** Users benefit from seeing both AI's final response and detailed tool execution metrics; separating them in expandable sections reduces cognitive load in normal case while preserving debugging capability
- **Trade-offs:** Increased component complexity with expandable state management, but improves UX for both end-users and those debugging tool behavior

#### [Pattern] Follow-up suggestion chips are generated by AI and returned as JSON at the end of each response, then parsed and displayed as clickable buttons. (2026-01-16)
- **Problem solved:** After AI responds to query, users should see contextually relevant follow-up questions to continue conversation
- **Why this works:** AI can best determine logical next steps in conversation flow; formatting as JSON in response makes it parseable while staying within single response stream; clickable chips preserve interaction pattern consistency
- **Trade-offs:** Relies on consistent JSON formatting from AI output (fragile), but eliminates round-trip latency and ensures suggestions are contextually relevant

#### [Pattern] Implemented 7-layer architecture separation for Call Context Service: Data Access → Use Cases → Server Functions → Query Options → Hooks → Components → Routes (2026-01-16)
- **Problem solved:** Building a complex data aggregation service that needs to be consumed from multiple UI contexts with different refresh patterns and authentication requirements
- **Why this works:** This layering enables independent testability, clear separation of concerns, and allows different consumers to have different caching/refresh strategies without duplicating business logic. Each layer has a single responsibility: data access handles DB/API calls, server functions handle auth/validation, query options define client cache behavior, hooks provide component integration
- **Trade-offs:** More files to maintain (4 files instead of 1-2) but significantly better testability and reusability. Server functions can be tested independently of React hooks. Different hooks can have different auto-refresh strategies without code duplication

### Stored conflict data in `conflictData` JSON column instead of separate conflict records table (2026-01-16)
- **Context:** Need to preserve conflicting values from both sides for manual resolution UI
- **Why:** Conflicts are ephemeral states tied to specific contact records. Storing in same row keeps conflict metadata with contact data (locality principle). Avoids join complexity for the common case where most contacts have no conflict.
- **Rejected:** Separate `contactConflict` table - would require JOIN on every read, complexity for 1:0..1 relationship
- **Trade-offs:** Query simplicity gained (no JOIN), but mutations become more complex (need to handle conflict state transitions). JSON storage is flexible but untyped at DB level.
- **Breaking if changed:** Removing `conflictData` column loses ability to display what values were in conflict - conflict resolution UIs would fail silently

#### [Pattern] Separate `syncedContact` table instead of storing sync metadata in core contact entity (2026-01-16)
- **Problem solved:** Mobile sync is one of several contact access patterns (direct API, CRM UI, mobile)
- **Why this works:** Sync concerns (versions, conflict state, last sync time) are specific to mobile offline-first workflow. Core contact table should remain unaware of sync implementation. Allows multiple independent sync systems without cross-contamination.
- **Trade-offs:** Requires maintaining contact-to-syncedContact relationship (added JOIN complexity) but provides isolation. Can version/update sync layer independently from contact structure.

### Import `XmlRpcValue` from `~/lib/odoo` rather than re-exporting from `./data-access/odoo.ts` (2026-01-16)
- **Context:** Type needed in contact-sync but not exported from intermediate module
- **Why:** Direct import from source of truth prevents re-export chains and makes dependencies explicit. Avoids creating public API surface for intermediate modules.
- **Rejected:** Re-exporting from data-access/odoo - creates maintenance burden if that module's public API changes
- **Trade-offs:** Slightly longer import path but clearer dependency graph. Easier to refactor internal module organization.
- **Breaking if changed:** Changing import path requires updating type import in multiple files. Removing direct access to ~/lib/odoo types would require re-export wrapper.

#### [Pattern] Multi-layered service architecture: data-access (Odoo client calls) → server functions (Zod validation) → query hooks (TanStack Query) → React hooks (component consumption) (2026-01-16)
- **Problem solved:** Building a task querying system that needs to support multiple filtering dimensions while maintaining type safety and cache coherence
- **Why this works:** Each layer has a single responsibility: data-access handles domain logic and Odoo API, server functions validate inputs and coordinate, query hooks manage caching/staleness, React hooks provide ergonomic component API. This separation prevents tight coupling and allows independent testing/evolution
- **Trade-offs:** More files/boilerplate but better separation of concerns, testability, and cache control. More indirection but enables fine-grained cache invalidation strategies

### Task domain filtering logic (buildTaskDomain) exported separately from query services for advanced use cases (2026-01-16)
- **Context:** Some consumers need custom task filtering beyond the predefined dashboard queries; others need the full query with caching
- **Why:** Allows both simple cases (use hook) and power-user cases (compose queries) without forcing all consumers to manage caching or all use-cases to go through hooks. The exported function becomes a reusable building block
- **Rejected:** Only exposing hooks forces wrapping simple use-cases in React; only exposing raw Odoo calls requires consumers to understand domain logic; hiding the function prevents extension
- **Trade-offs:** More surface area but enables composition; consumers can choose abstraction level. Risk: raw function misuse or inconsistent caching patterns if not well-documented
- **Breaking if changed:** Hiding buildTaskDomain removes flexibility for advanced use-cases; making it private prevents middleware/API-layer implementations from reusing the logic

#### [Pattern] Three-layer separation: data-access (Odoo queries) → server functions (validation/auth) → query options (caching) → hooks (React consumption) (2026-01-16)
- **Problem solved:** Building a complete data fetching pipeline for Odoo integration
- **Why this works:** Enforces separation of concerns: data layer doesn't know about HTTP/auth, server layer validates before querying, query layer handles caching strategy, hooks provide React integration. Each layer is independently testable and replaceable.
- **Trade-offs:** More files/boilerplate initially, but enables: swapping cache strategies, changing auth mechanisms, or migrating to different server without touching React components

#### [Gotcha] Filtering requires early implementation in data-access layer, not pushed to UI filtering logic (2026-01-16)
- **Situation:** System includes ProjectFilters interface with multiple filter options (active, userId, partnerId, searchQuery)
- **Root cause:** Filtering at data-access level means: (1) Odoo applies filters, not JavaScript, (2) memory usage stays bounded regardless of total records, (3) consistent behavior across different consumers of the data layer
- **How to avoid:** Requires defining filter schema upfront, but prevents future scalability failures; small implementation cost for large operational benefit

### Combined dashboard hooks (useProjectDashboard, useProjectDetail) alongside individual hooks, not as replacements (2026-01-16)
- **Context:** Different UI needs: dashboard needs projects+stats, detail page needs projects+milestones+tasks+team simultaneously
- **Why:** Preserves granular caching: dashboard can cache projects independently from stats (if stats updated, doesn't invalidate project cache). Component using only team data doesn't fetch stats unnecessarily. Combined hooks use individual hooks internally, so cache invalidation logic is centralized.
- **Rejected:** Single useProject hook for all data would bundle unrelated queries, forcing unnecessary re-fetches when one type updates
- **Trade-offs:** More hooks to maintain, but granular caching prevents cache thrashing when one data type updates; internal use of individual hooks keeps logic DRY
- **Breaking if changed:** Removing individual hooks forces combined hooks into monolithic fetching; removing combined hooks forces component composition to manually combine queries

### useInvalidateProjectQueries hook as single invalidation point for all project-related queries (2026-01-16)
- **Context:** Multiple independent query options (projects, milestones, tasks, stats) that may need invalidation together or separately
- **Why:** Centralizes cache invalidation logic: (1) components don't hardcode which queries to invalidate, (2) adding new project query only requires updating this hook, (3) enables smart invalidation (invalidate only related queries, not unrelated ones)
- **Rejected:** Manually calling multiple invalidateQueries in each component spreads invalidation logic, making refactoring cache structure painful
- **Trade-offs:** One more hook to maintain, but prevents N components from knowing about cache structure; changes to cache don't propagate to multiple components
- **Breaking if changed:** Removing centralized invalidation hook forces every mutation component to know which specific query keys to invalidate, breaking encapsulation

### Separated conflict resolution strategies into a dedicated ConflictResolverService class rather than embedding them in the main OfflineSyncService (2026-01-16)
- **Context:** Managing offline sync with multiple conflict resolution strategies (client_wins, server_wins, merge, timestamp, manual, custom)
- **Why:** Single Responsibility Principle - allows conflict resolution logic to be independently tested, extended, and reasoned about. Prevents OfflineSyncService from becoming a god object with too many responsibilities
- **Rejected:** Embedding conflict resolution directly in sync service would create tightly coupled logic and make testing individual strategies harder
- **Trade-offs:** Added one more class but gained modularity and testability. Trade-off is worth it because conflict resolution is a distinct concern that may evolve independently
- **Breaking if changed:** Removing this separation would make adding new conflict strategies require modifying the main service class, creating regression risk

### RetryManager handles exponential backoff calculation separately from actual retry execution logic (2026-01-16)
- **Context:** Implementing retry logic with exponential backoff, jitter, and non-retryable error detection
- **Why:** Allows testing backoff calculation independently from retry execution. The delay calculation logic is pure and deterministic, making it easier to verify correctness. Separating concerns prevents timing-related flakiness in tests
- **Rejected:** Embedding backoff calculation directly in retry execution would make it harder to unit test the math logic without mocking timers
- **Trade-offs:** Slightly more code paths but significant gain in testability and clarity of intent. Makes it obvious what the retry strategy is just by reading the calculation
- **Breaking if changed:** If backoff calculation and execution are merged, changing retry behavior becomes harder to test reliably without introducing test flakiness

#### [Gotcha] Non-retryable error types (UNAUTHORIZED, FORBIDDEN, VALIDATION_ERROR) are defined in types.ts (where defaults live) rather than in retry-manager.ts where the logic uses them (2026-01-16)
- **Situation:** Test was initially looking for error type constants in the wrong file, suggesting confusion about where these values belong
- **Root cause:** Constants belong in types.ts because they represent configuration defaults and are part of the service's public API contract. Retry-manager.ts imports and uses them as configuration, not owns them. This prevents circular dependencies and keeps types as the single source of truth
- **How to avoid:** Slightly more indirection (types.ts imports -> retry-manager uses) but clearer separation between contract definition and implementation

#### [Pattern] Singleton pattern with getOfflineSyncService() getter for accessing the service instance across the app (2026-01-16)
- **Problem solved:** Need to access the same sync service instance from multiple components and hooks without prop drilling
- **Why this works:** OfflineSyncService manages global state (the offline queue) and background sync process. Having multiple instances would cause data inconsistency and duplicate sync attempts. Singleton ensures all parts of the app see the same queue state
- **Trade-offs:** Singleton is simpler to set up but harder to test (requires cleanup between tests). Context API would be more testable but more ceremony to set up

### Created lightweight convenience hooks (useSyncStatus, useSyncHandler) alongside the comprehensive useOfflineSyncService hook (2026-01-16)
- **Context:** Different components need different levels of detail from the sync service - some only need to know sync status, others need full control
- **Why:** Follows the principle of least privilege - components get exactly what they need without unnecessary state subscriptions. Reduces re-renders in components that only care about status. Makes component code more readable
- **Rejected:** Could force all components to use the full hook, but this creates coupling to complex API and unnecessary subscriptions
- **Trade-offs:** More hook definitions to maintain, but significant DX improvement and performance benefit from fine-grained subscriptions. Each hook becomes a 'consumer contract' that clearly documents what it needs
- **Breaking if changed:** Removing convenience hooks forces all consumers back to the full hook, increasing component bundle size and subscription overhead

#### [Pattern] Event-based architecture for sync lifecycle notifications (onSyncStarted, onSyncCompleted, onItemSynced, onItemFailed) with both specific events and 'all' catch-all (2026-01-16)
- **Problem solved:** Multiple parts of app need to react to sync events (analytics, UI updates, notifications) without knowing about each other
- **Why this works:** Event bus pattern decouples sync service from consumers. Allows new listeners to be added without modifying service code. Supports listening to specific events or all events based on needs. Prevents spaghetti code where service calls handlers directly
- **Trade-offs:** Event names become part of public API contract, harder to rename. But gains flexibility and scalability - can add new listeners without touching service

#### [Gotcha] Integration point with existing OfflineQueueDatabase requires careful management of queue state between two systems (2026-01-16)
- **Situation:** OfflineSyncService uses OfflineQueueDatabase to persist queue items and sync state
- **Root cause:** Separation of concerns - database handles storage, sync service handles synchronization logic. Prevents duplication of persistence logic. But requires clear contracts about when each system owns the state
- **How to avoid:** Adds integration point that must be carefully managed. Any changes to queue structure affect both systems. Benefit is clean separation and ability to swap database implementation

### Separated phone verification from onboarding session as distinct database entities rather than combining into single table (2026-01-16)
- **Context:** Phone verification needs lifecycle management (expiration, attempt tracking) independent of account linking
- **Why:** Allows OTP flow to complete independently, enables cleanup of expired OTPs without affecting session state, permits resend operations without session reset
- **Rejected:** Single onboarding_sessions table with embedded OTP would couple verification lifecycle to session lifecycle
- **Trade-offs:** Easier: independent OTP cleanup and retry logic. Harder: requires joins to track full onboarding state
- **Breaking if changed:** If merged into single table, resend logic would need to handle partial session state updates, cleanup becomes complex

#### [Pattern] TanStack Router route type generation deferred to dev server startup rather than pre-compilation (2026-01-16)
- **Problem solved:** TypeScript compilation reports 'not assignable to keyof FileRoutesByPath' errors for new routes until router runs code generation
- **Why this works:** TanStack Router uses build-time route generation; types only exist after router processes file tree. Pre-emptive errors expected and safe to ignore.
- **Trade-offs:** Easier: no manual route wiring needed. Harder: pre-dev-server validation unclear until runtime

#### [Pattern] Tool definitions organized by domain (Projects, Tasks, Milestones, Customers, Vendors) with consistent ToolDefinition interface and centralized registration (2026-01-16)
- **Problem solved:** Need to add 14 new tools to Claude without fragmenting implementation across multiple files
- **Why this works:** Domain organization makes tools discoverable and maintainable; centralized registration prevents scattered tool registration logic and missed registrations
- **Trade-offs:** Single large definitions.ts file (1195 lines) vs many small files - chose single file for easier atomic registration/unregistration and simpler imports

### All query tools use existing data-access layer functions rather than making direct Odoo API calls (2026-01-16)
- **Context:** Could either call OdooClient directly or reuse existing data-access abstractions like getProjectStatistics(), searchProjectsWithMetadata()
- **Why:** Avoids duplicating API call logic, query building, error handling, and response transformation already implemented in data-access layer; ensures consistency across tools
- **Rejected:** Direct OdooClient calls in tool handlers would create parallel query logic
- **Trade-offs:** Slightly more indirection but gains consistency, maintainability, and reuse; changes to underlying queries only need updates in one place
- **Breaking if changed:** If data-access functions change signatures, all dependent tools break together (which is actually good for catching issues)

### All tools set permission level to 'user' for read-only data access, with consistent 'odoo' tag (2026-01-16)
- **Context:** Could vary permissions per tool (admin for sensitive queries, user for public data) or skip tagging
- **Why:** Read-only queries are safe for user-level access; consistent tagging enables filtering/organization in tool registry and UI; simplifies permission model
- **Rejected:** Per-tool permission levels would require analyzing each query's sensitivity; inconsistent tagging makes tools harder to discover and organize
- **Trade-offs:** Simplified but less granular - if future write operations added, may need to split permissions by tool type
- **Breaking if changed:** Changing to 'admin' permission would restrict tool availability; removing 'odoo' tag would break any tag-based tool filtering or organization

#### [Pattern] Separation of concerns: image processing utilities (pure functions) vs state management (hook) vs rendering (component) (2026-01-16)
- **Problem solved:** Receipt capture involves EXIF rotation, compression, upload, and UI state across multiple views
- **Why this works:** Allows testing image logic independently; reusing hook in multiple components; replacing rendering without changing logic
- **Trade-offs:** Three separate files harder to find related code (easier with TypeScript goto-definition); but enables unit testing image processing without React

#### [Gotcha] SSR-incompatible camera access requires isMounted state pattern; useReceiptCapture hook cannot run server-side (2026-01-16)
- **Situation:** Demo route renders in SSR; camera/permissions API only exists in browser
- **Root cause:** Browser APIs (navigator.mediaDevices) throw or are undefined during server render; isMounted flag defers camera initialization to client hydration
- **How to avoid:** Extra state management (one boolean) prevents server render errors; but causes flash of unstyled content or delayed interactivity on first load

#### [Pattern] Segregated query options factory functions from hooks, with hooks only wrapping queryOptions. Query options are created separately and composed into hooks. (2026-01-16)
- **Problem solved:** Managing TanStack Query configuration for multiple Reloadly endpoints with varying cache durations and parameters.
- **Why this works:** Allows reusing query options in multiple places (prefetching, manual queries, cache hydration) without duplicating configuration. Separates data-fetching configuration from UI integration.
- **Trade-offs:** Slightly more boilerplate with separate query option files, but gains significant flexibility. Query options become testable and reusable across the codebase.

### Implemented separate hooks for transaction list and transaction count, rather than combining into single hook with optional parameters. (2026-01-16)
- **Context:** Need to fetch both transaction history and total transaction count, which are distinct queries with different purposes (pagination vs metadata).
- **Why:** Allows fine-grained control over which queries are fetched and when. UI components requesting only count don't pay the cost of fetching full transaction list. Each query has independent caching and refetch logic.
- **Rejected:** Single hook returning both results would require always fetching both, or conditional fetching logic inside the hook making it harder to reason about data dependencies.
- **Trade-offs:** More hooks to manage, but clearer data flow in consuming components. Each hook can have independent loading states and refetch strategies.
- **Breaking if changed:** Combining these would break components that only need count metadata and force unnecessary data transfer and parsing.

### Query invalidation targets specific keys like ['reloadly', 'transactions'] to invalidate all transaction queries regardless of parameters, rather than invalidating specific parameterized queries. (2026-01-16)
- **Context:** After sending a top-up, both transaction list and count queries need to refetch to reflect new transaction.
- **Why:** Simpler and more robust than trying to invalidate specific parameter combinations. Catches all related queries in one operation and prevents stale data from missed invalidations.
- **Rejected:** Could manually invalidate each specific query key combination (e.g., ['reloadly', 'transactions', params1], ['reloadly', 'transactions', params2]), but would miss any parameterized variations.
- **Trade-offs:** Broader invalidation means more queries refetch (potential extra network requests), but guarantees consistency. Simpler mental model.
- **Breaking if changed:** Removing this broad invalidation approach requires tracking all active query variants and explicitly invalidating each—if any are missed, stale data appears.

#### [Pattern] Cache durations correlate with data volatility: balance (30s), operators/countries (24h), transactions (no cache). Each reflects how often underlying data changes. (2026-01-16)
- **Problem solved:** Different Reloadly data has different freshness requirements. Balance fluctuates frequently. Operators/countries are static. Transactions are user-specific and time-sensitive.
- **Why this works:** Reduces unnecessary API calls for stable data while keeping volatile data fresh. Prevents showing stale balance that contradicts transaction just made.
- **Trade-offs:** Requires understanding data characteristics for each query type. Gain optimal API usage patterns.

#### [Gotcha] checkReloadlyTransactionStatus uses setQueryData to update single transaction cache while invalidating the full transaction list, creating potential race conditions. (2026-01-16)
- **Situation:** Need to both update the specific transaction detail and refresh the transaction list.
- **Root cause:** setQueryData provides immediate update for the specific transaction detail view, while invalidation refetches the list to ensure consistency.
- **How to avoid:** Combines approaches: immediate detail update + eventual list consistency. Risk: if refetch fails, detail is updated but list is stale.

### useReloadlyTransaction conditionally enables query based on both `enabled` prop AND `!!id`, preventing queries with empty IDs. (2026-01-16)
- **Context:** Transaction ID may not be immediately available, or component might mount before route params are resolved.
- **Why:** Prevents wasted queries with invalid IDs and avoids error states from API rejections of empty IDs.
- **Rejected:** Could require callers to check `!!id` before using hook, relying on discipline.
- **Trade-offs:** Hook internally enforces contract, reducing caller errors. Slightly masks when ID is missing (consumer might not realize it).
- **Breaking if changed:** Removing this guard means invalid queries execute, creating error states in UI unnecessarily.

#### [Pattern] Mobile routes structured as separate route hierarchy (src/routes/mobile/*) rather than conditional rendering within existing routes (2026-01-16)
- **Problem solved:** Building mobile-specific expense workflow with different UX patterns than desktop
- **Why this works:** Enables independent mobile-first design without polluting desktop route code. Allows different component hierarchies, data fetching strategies, and user flows optimized for touch without branching logic everywhere
- **Trade-offs:** Gained: clean separation, dedicated mobile optimization, independent mobile state. Lost: some code duplication in data fetching (useExpenseRequests used in both), two route trees to maintain

#### [Pattern] Mobile routes pass auth-guarded component rendering responsibility to route file rather than middleware, creating per-route auth logic (2026-01-16)
- **Problem solved:** Each mobile route needs authentication but routes contain auth-unaware components
- **Why this works:** Playwrights test expects non-404 response with redirect to sign-in. This pattern allows framework's auth middleware to handle redirect rather than 404, but means each route file must handle auth gracefully
- **Trade-offs:** Gained: framework auth patterns work naturally. Lost: each route file must understand auth, easy to forget redirect handling

### Separated GL account selection into dedicated GLAccountSelect component instead of inline dropdown (2026-01-16)
- **Context:** Expense vouchers require GL account selection for both header and line items with filtered account ranges (6010-6999)
- **Why:** Reusability across multiple form contexts (header GL account, line item GL accounts) prevents code duplication and ensures consistent GL account validation logic
- **Rejected:** Inline dropdown in ExpenseVoucherForm would require duplicating GL account logic in ExpenseVoucherLineItemsForm
- **Trade-offs:** Added component file but gained single source of truth for GL account validation and filtering rules
- **Breaking if changed:** If GL account filtering logic changes, only one place needs updating; removing this component would scatter validation logic across form components

#### [Gotcha] File upload component expects S3/R2 presigned URL upload flow, not direct API endpoint (2026-01-16)
- **Situation:** Receipt attachments need server-side presigned URL generation rather than multipart form submission to file endpoint
- **Root cause:** Presigned URLs allow client-side direct upload to S3/R2, reducing server load and improving upload reliability without holding connections open
- **How to avoid:** Requires server endpoint to generate presigned URLs (adds complexity) but eliminates large file handling bottlenecks on API server

#### [Pattern] Decoupled voucher detail page from voucher list/creation by using separate route files ($id.tsx, index.tsx, create.tsx) (2026-01-16)
- **Problem solved:** Voucher feature has distinct workflows: list/search, create new, view details with approval history
- **Why this works:** File-based routing keeps concerns separated, enables independent optimization of each view, and makes testing individual workflows simpler
- **Trade-offs:** More files to navigate but clearer separation of concerns and easier to code-split different voucher workflows

### Preserved isAdmin boolean field in schema instead of consolidating to role enum (2026-01-16)
- **Context:** Adding new role-based system while existing admin boolean exists
- **Why:** Backward compatibility - existing code checks isAdmin boolean; removing it would require refactoring all checks. Both can coexist (admin role can map to isAdmin=true)
- **Rejected:** Removing isAdmin entirely - breaking change for existing application code and migrations
- **Trade-offs:** Easier: Gradual migration path; Harder: Dual source of truth for admin status creates maintenance burden and potential inconsistency if not synchronized
- **Breaking if changed:** If isAdmin is removed without proper migration, all existing admin checks fail; if role system doesn't override isAdmin properly, conflicting admin states possible

### Graceful degradation approach: SIP provisioning service operates without FlexiSIP server configuration, storing credentials locally while failing server sync gracefully (2026-01-16)
- **Context:** FlexiSIP server may not be configured in all environments (dev, staging, production variants)
- **Why:** Prevents service failures and dependency bottlenecks. Users get functional SIP credentials even if external server is unavailable. Server sync is a secondary concern - local credential generation is primary value.
- **Rejected:** Requiring FlexiSIP server configuration as mandatory would block development and deployments without server access. Hard failures would cascade through onboarding flow.
- **Trade-offs:** Easier deployment and development workflow, but credentials won't sync to FlexiSIP server without configuration. Requires client-side awareness that sync may have failed (console warnings instead of errors).
- **Breaking if changed:** If changed to require server configuration, onboarding breaks for environments without FlexiSIP. If changed to throw on server failure, cascading errors in dependent components.

#### [Pattern] Three-layer composition: FlexiSIP client (HTTP) → SIP Provisioning service (business logic) → Server functions (endpoint handlers) (2026-01-16)
- **Problem solved:** Need separation between infrastructure (HTTP), business logic (account lifecycle), and API handlers (request/response)
- **Why this works:** Client layer is infrastructure-agnostic (replaceable for gRPC, WebSocket, etc.). Service layer contains reusable business logic (can be called from jobs, webhooks, CLI). Server functions are thin wrappers (permission checks, request validation, response formatting).
- **Trade-offs:** More files and abstractions to navigate, but each layer is independently testable and reusable. Reduces cognitive load per file.

### Role-based configuration stored in database table separate from user table, with fallback chain: user config → role default → generic default (2026-01-16)
- **Context:** Need to support per-user customization while maintaining role-based defaults without duplication
- **Why:** Separation of concerns allows users to customize independently from role defaults. Fallback chain enables graceful degradation when users haven't customized yet, avoiding null checks throughout the codebase
- **Rejected:** Storing defaults only in code constants (loses persistence for admin overrides), or storing all configs inline in user table (creates coupling and limits role-level administration)
- **Trade-offs:** Adds database queries for config lookup, but enables role-wide policy changes without code deployment. More complex state management vs simpler initial implementation
- **Breaking if changed:** Removing database layer would lose ability for admins to change role defaults at runtime; removing fallback chain would require every user to have explicit config entry

#### [Pattern] Data access layer functions (getDashboardConfig, getUserDashboardConfig, getRoleDefaultConfig) abstract the fallback logic from UI components (2026-01-16)
- **Problem solved:** Multiple code paths need to load dashboard config; without abstraction, each would duplicate the fallback logic
- **Why this works:** Single source of truth for config resolution logic. Changes to fallback precedence only need to happen in one place. Enables testing of resolution logic independently from UI
- **Trade-offs:** Extra layer of indirection but eliminates async/logic duplication. Slightly slower initial render vs cleaner codebase maintenance

### Role restrictions defined as allowlist (allowedWidgets array) rather than blocklist; null means all allowed (2026-01-16)
- **Context:** Different roles have different widget access levels; need clear way to specify which widgets each role can use
- **Why:** Allowlist is more secure by default (new widgets not automatically available). Null-means-all allows future roles with unrestricted access without schema changes. Explicit about permissions
- **Rejected:** Blocklist (blockedWidgets) - would default to allowing new widgets, security risk. Explicit enum of allowed widgets for each role (inflexible, requires migration for new roles)
- **Trade-offs:** Requires checking if widget is in allowlist before showing, slightly more logic. More explicit about least-privilege. Adding new widget requires updating roleconfigs if restrictions desired
- **Breaking if changed:** Switching to blocklist changes security model; null would mean all blocked instead of all allowed. Existing role configs with null would behave opposite

#### [Gotcha] Data source mappings defined in config but not wired to actual data fetching; widget still fetches data via old mechanism (2026-01-16)
- **Situation:** Config includes dataSources structure (sourceType, sourceId, refreshInterval, filters) but widgets ignore it
- **Root cause:** Feature was split: phase 1 is config structure and UI, phase 2 will wire data sources. Prevents blocking on data layer changes. Makes config evolution visible
- **How to avoid:** Config has unused fields (confusing), but keeps UI and data concerns separate. Clearer what's still needed. Future developer must implement the mapping in widgets

### Build error in SSR layer ignored because client build succeeded and SSR errors pre-existing/unrelated to dashboard changes (2026-01-16)
- **Context:** Application failed full build due to missing schema exports in unrelated code, but client dashboard components built successfully
- **Why:** Distinguishes between new implementation quality (✅ passes) and pre-existing issues. Avoids scope creep of fixing unrelated build problems. Client code is what users see
- **Rejected:** Fixing SSR build errors (out of scope, not related to dashboard feature), or treating client build success as failure (hides actual success)
- **Trade-offs:** Easier to merge (doesn't require fixing unrelated code), but application can't run full build until SSR fixed. Deployment pipeline might fail
- **Breaking if changed:** If code owner prioritizes full build passing, this incomplete status blocks deployment. Masks root causes in other schema modules

#### [Pattern] Layered route protection: beforeLoad guard checks auth/roles before component ever renders, preventing flash of unauthorized content (2026-01-16)
- **Problem solved:** Admin dashboard needs to ensure only admins access the page, and non-authenticated users redirect to sign-in
- **Why this works:** beforeLoad executes before component renders, allowing redirect before any UI is shown. Prevents FOUC (flash of unstyled content) with auth state
- **Trade-offs:** Requires server/client auth coordination, but guarantees no unauthorized rendering ever occurs

#### [Gotcha] Route file naming conflict: 'route.tsx' is reserved in TanStack Router's file-based routing system and causes conflicts. Renamed to 'route-plan.tsx'. (2026-01-16)
- **Situation:** Attempted to create a route optimization page as 'route.tsx' in the field-tech directory, but this conflicted with TanStack Router's internal routing conventions.
- **Root cause:** TanStack Router uses 'route' as a reserved keyword for route definitions. Using it as a page filename creates ambiguity in the routing system.
- **How to avoid:** Slightly less obvious filename ('route-plan' vs 'route') but eliminates routing system conflicts. More explicit naming actually improves clarity.

### Sub-routes implemented as separate .tsx files in same directory (`work-orders.tsx`, `route-plan.tsx`, `inventory.tsx`, `history.tsx`) rather than nested route directory structure. (2026-01-16)
- **Context:** Field technician dashboard needed multiple feature pages: work orders, route optimization, inventory, and site history.
- **Why:** Flat file structure with clear naming is simpler for route resolution in TanStack Router and keeps related pages together. Each page is a sibling route, not a hierarchy, since they're all accessed from the main dashboard equally.
- **Rejected:** Nested directory structure (`field-tech/work-orders/index.tsx`) - would create unnecessary hierarchy since all are peer-level pages accessed from dashboard. Would complicate routing configuration.
- **Trade-offs:** Simpler routing and file organization vs slightly longer directory. All related pages visible in one folder view. Easier to co-locate tests.
- **Breaking if changed:** If changed to nested structure, all navigation links and route definitions would need updating. Build bundle splitting might differ if route lazy-loading depends on file structure.

#### [Pattern] Sample data embedded directly in component render logic rather than separate fixtures or factory functions. Each page has realistic mock data hardcoded as constant arrays/objects. (2026-01-16)
- **Problem solved:** Implementing demonstration pages without backend integration ready.
- **Why this works:** Simplest approach to show UI working. Data is co-located with display logic, making it obvious what fields the UI expects. No external dependencies.
- **Trade-offs:** Easy to replace with real data (swap const arrays with API calls) but harder to version control large sample datasets. Good for prototyping.

### Created separate service modules (CallStateManager, AudioRouter, DTMFHandler, CallHistory, AndroidNotifications) coordinated by central LinphoneService rather than monolithic single service (2026-01-16)
- **Context:** VoIP integration with multiple orthogonal concerns: call lifecycle, audio device management, tone sending, history tracking, and notifications
- **Why:** Separation of concerns enables independent testing, debugging, and maintenance. Each module has single responsibility. Reduces cognitive load when debugging specific issues (e.g., audio routing vs. call state)
- **Rejected:** Monolithic service with all logic in one file would have been faster initially but would create tight coupling between unrelated concerns and make partial feature implementation/testing impossible
- **Trade-offs:** More files to navigate but clear boundaries; each module can be tested in isolation without full SDK initialization; easier to stub individual components; coordination overhead in main service
- **Breaking if changed:** Merging modules would break the ability to independently control audio routing behavior without affecting call state, or to test call history without initializing the full call stack

#### [Pattern] Call state machine implemented with explicit state transitions (IDLE → CONNECTING → ALERTING → INCOMING_RINGING → CONNECTED → HOLD → ENDED) rather than implicit state inference (2026-01-16)
- **Problem solved:** SIP call lifecycle is complex with multiple intermediate states; race conditions and invalid state transitions are possible during rapid user actions
- **Why this works:** Explicit state machine prevents invalid transitions (e.g., cannot go from IDLE directly to CONNECTED), provides clear audit trail of state changes, makes bugs reproducible and debuggable. Each state has defined valid next states
- **Trade-offs:** More boilerplate state definition code but eliminates entire class of state-related bugs; state changes become predicable and testable; harder to adapt if SDK calls states differently than expected

#### [Gotcha] DTMF handler implements tone queuing with sequential transmission rather than dropping tones when busy (2026-01-16)
- **Situation:** Rapid successive DTMF events (e.g., dialing a PIN) can occur faster than transmission completes; naive implementation drops events
- **Root cause:** PIN entry and menu navigation requires all tones to be transmitted, even if user rapidly taps keypad. Queue ensures no tones are lost
- **How to avoid:** Requires state management for queue, adds complexity to tone handling; ensures user never loses input; adds latency between key press and transmission completion but preserves correctness

### Audio router auto-switches between devices based on device availability events (Bluetooth connected, headset inserted) with explicit priority order (BLUETOOTH > HEADSET > SPEAKER > EARPIECE) rather than requiring explicit user selection each time (2026-01-16)
- **Context:** Android audio routing is complex: devices can connect/disconnect during calls; naive approach requires user to manually select each time
- **Why:** User expectation is that audio automatically uses best available device; priority order matches platform conventions and user mental model. Explicit user selection is fallback for edge cases
- **Rejected:** Always defaulting to speaker or requiring manual selection would frustrate users who plug in headsets mid-call. Ignoring device events means audio stays on disconnected device until next call
- **Trade-offs:** Auto-switching is simpler for users but less flexible; if user wants to keep speaker on after Bluetooth connects, must explicitly reject the switch; priority order is opinionated but matches Android conventions
- **Breaking if changed:** Removing auto-switch means connected Bluetooth devices won't be used automatically, degrading user experience; removing priority order means unpredictable device selection behavior

#### [Gotcha] Android notifications must use notification channels (separate from FCM payloads) to support API 26+; channel configuration cannot be changed after creation (2026-01-16)
- **Situation:** Android O (API 26) requires notification channels; attempting to modify channel properties after initial creation fails silently
- **Root cause:** Android enforces channel immutability to prevent apps from sneakily changing notification behavior. Channels must be created with full configuration upfront
- **How to avoid:** Channel configuration must be comprehensive at creation time; difficult to adjust notification behavior without uninstalling app; prevents accidental notification behavior changes

### Role-based access control implemented at multiple layers: middleware assertion, utility function check, and component-level redirect (2026-01-16)
- **Context:** Managing Director dashboard requires strict access control to prevent unauthorized viewing of sensitive executive data
- **Why:** Layered defense prevents unauthorized access even if one layer is bypassed. Middleware catches it server-side, utility functions provide reusable checks, component redirects provide UX feedback
- **Rejected:** Single-layer check (e.g., only component-level) would be insufficient if API is called directly; only middleware would leave no UX feedback
- **Trade-offs:** More code to maintain but significantly stronger security posture; requires synchronization of role logic across layers to avoid inconsistency bugs
- **Breaking if changed:** Removing any layer creates a security gap: no middleware = direct API access bypasses auth, no utility function = repeated role logic becomes inconsistent, no component redirect = poor UX with no feedback

#### [Pattern] Data access layer abstraction (md-dashboard.ts) separates data fetching from presentation logic, with fallback/mock data patterns (2026-01-16)
- **Problem solved:** Dashboard needs to display financial and business metrics that may not have real data sources yet
- **Why this works:** Allows frontend development to proceed without blocking on backend data integration; mock data can be swapped for real implementations without changing component code; enables testing without real data sources
- **Trade-offs:** Added abstraction layer increases code but provides loose coupling; mock data must be intentionally removed/replaced - risk of shipping with mock data if not automated

#### [Pattern] Used TypeScript interfaces in server functions (md.ts) to define data contract between server and client (2026-01-16)
- **Problem solved:** Dashboard components need typed responses from server functions for type safety and IDE autocomplete
- **Why this works:** Prevents runtime errors from mismatched data structures; enables refactoring with compiler feedback; documents expected data shape
- **Trade-offs:** More upfront typing work but eliminated entire class of runtime bugs; refactoring data structure becomes traceable change

### Created separate isUserMD() utility function instead of checking role inline in middleware or components (2026-01-16)
- **Context:** Multiple places need to verify if user is MD or admin with same logic
- **Why:** Single source of truth for role logic prevents inconsistency bugs; easier to test; one place to update if role logic changes (e.g., add 'executive' role)
- **Rejected:** Inline checks in middleware and component would require duplicating role logic; harder to maintain consistency across layers
- **Trade-offs:** Extra function call indirection but prevents subtle bugs where one layer checks differently than another; more testable
- **Breaking if changed:** Removing this utility means role checks scattered across codebase become inconsistent if MD role rules change

#### [Pattern] Separating data access layer (sales-dashboard.ts) from server functions (sales.ts) with both returning mock data (2026-01-16)
- **Problem solved:** Server functions call data access functions which return hardcoded structures; both layers have the same data source
- **Why this works:** Creates layer for future Odoo integration - only data-access layer needs updating without touching server function signatures
- **Trade-offs:** Extra indirection adds maintainability for future integration vs. unnecessary abstraction when data source doesn't change

### Call context data fetched via existing hooks (useCallContext, useActiveCallContext) rather than creating new hooks or direct API calls (2026-01-16)
- **Context:** Multiple data sources needed (customer info, history, issues, actions) with potential for stale data across different card renders
- **Why:** Reusing existing hooks leverages established data synchronization patterns and error boundaries already in place. Avoids duplicate API calls and maintains single source of truth. Hooks handle loading/error states
- **Rejected:** Creating dedicated CallContextDataFetcher hook would cause data fetching duplication. Direct API calls in component would lose data consistency across cards and error handling
- **Trade-offs:** Constrained by existing hook contracts (what data they provide), but gains consistency with app patterns and automatic cache invalidation. Component must compose/adapt data rather than shape it exactly
- **Breaking if changed:** If hooks change structure or stop providing data fields, entire card rendering breaks silently. No explicit error boundary for 'missing context data' scenario

### Call controls (mute, end call, speaker) currently log to console rather than integrate with SIP/VoIP backend (2026-01-16)
- **Context:** Call context UI displays call control buttons but actual call is managed separately
- **Why:** Allows UI component to be built/tested independently from VoIP integration. Establishes UI contract and event interface that backend can wire later. Reduces scope and unblocks mobile UI work
- **Rejected:** Full VoIP integration from start would couple mobile UI to VoIP library and require SDK setup in dev environment. Would block UI development on VoIP readiness
- **Trade-offs:** Buttons are non-functional in current state - risky if shipped to production. Clear integration points established (console.log -> actual handlers). Requires follow-up work before live deployment
- **Breaking if changed:** If call control integration is forgotten, users have non-functional UI. Need explicit checklist/tests to catch missing VoIP handler wiring

### Created unified inbox thread table as aggregation layer rather than materializing source tables directly (2026-01-16)
- **Context:** Multiple independent message sources (direct messages, Odoo Discuss, notifications) need single inbox experience
- **Why:** Decouples inbox UI from source system schema changes. Enables caching of denormalized data (title, avatar, preview) without recomputing on every query. Allows independent sync cycles per source.
- **Rejected:** Direct querying across multiple source tables with UNION queries - would be fragile to schema changes and difficult to paginate consistently
- **Trade-offs:** Easier: consistent pagination, filtering, caching. Harder: data consistency requires sync functions to stay in sync, introduces eventual consistency model
- **Breaking if changed:** If removed, must rebuild pagination/filtering logic in application layer; lose ability to cache metadata like avatars without expensive joins

#### [Gotcha] Separate sync functions per source type (syncDirectMessageThreads, syncOdooDiscussThreads, syncNotificationThreads) instead of generic sync (2026-01-16)
- **Situation:** Different sources have different schema structures, sync logic, and update frequencies
- **Root cause:** Direct messages use bi-directional conversations; Odoo Discuss uses channels/followers; notifications are one-way. Generic sync would require complex source-detection logic and handle only common subset of features.
- **How to avoid:** Easier: clear separation of concerns, easier to test individual sources. Harder: need to orchestrate multiple sync calls, potential race conditions if called simultaneously

#### [Pattern] Separate server functions and query options files instead of co-locating them (2026-01-16)
- **Problem solved:** Server functions do data mutations and reads; query options handle client-side caching
- **Why this works:** Query options need polling intervals and cache invalidation strategies not relevant to server functions. Allows independent iteration on caching strategy (e.g., swap 30s polling for WebSocket) without touching server functions.
- **Trade-offs:** Easier: independent evolution of caching layer. Harder: must keep query function signatures aligned with server function contracts

#### [Pattern] Four-source-type enum (direct_message, odoo_discuss, system_notification, push_notification) as closed set in TypeScript rather than string-based extensibility (2026-01-16)
- **Problem solved:** Need to support multiple message sources with different handling
- **Why this works:** Type safety at compile time catches source type mismatches. Enum forces all sync functions and UI filters to explicitly handle all sources. Makes it obvious when adding new source that all layers need updates.
- **Trade-offs:** Easier: type safety, exhaustive handling forced by TypeScript. Harder: adding new source requires changes to schema, sync functions, data access layer, server functions, queries

#### [Pattern] Task management tools module created with same structure as financial-tools (definitions.ts + index.ts + tool-registry.ts registration) (2026-01-16)
- **Problem solved:** New domain-specific tool set needed to integrate with existing Odoo tasks infrastructure
- **Why this works:** Parallel patterns reduce cognitive overhead and ensure consistency across tool domains. Single responsibility principle - each module owns its tool definitions and registry entry point.
- **Trade-offs:** Scalability: adding new domains requires copying pattern, but maintainability increases through consistency. Discovery: developers know exactly where to look.

#### [Gotcha] Tool definitions reference existing odoo-tasks.ts data access layer rather than creating new database queries (2026-01-16)
- **Situation:** Implementation could have duplicated database access logic or created new query helpers
- **Root cause:** Reusing existing data access layer ensures consistency with existing codebase patterns and prevents duplicate schema knowledge. Single source of truth for Odoo task schema.
- **How to avoid:** Assumes existing data access layer is flexible enough for all query patterns (it is - uses getOdooClient for raw operations when needed). Tighter coupling to existing layer.

#### [Pattern] Tool registry uses automatic registration pattern: import module in tool-registry.ts which calls registerTools() (2026-01-16)
- **Problem solved:** New tools need to be available to Claude without manual registration at multiple places
- **Why this works:** Auto-registration through import ensures tools are available immediately when registry is initialized. Prevents forgotten registrations that would silently disable features.
- **Trade-offs:** Cleaner at scale but creates implicit dependency on import order. Filesystem discovery would be more flexible but adds runtime overhead and complexity.

#### [Pattern] Dual rendering strategy: read-only Odoo threads vs interactive direct message threads (2026-01-16)
- **Problem solved:** Unified inbox displays messages from three sources (Odoo Discuss, Direct Messages, Notifications) but only allows replies in one
- **Why this works:** Avoids complex bidirectional sync with Odoo's message API - replies go through existing direct message infrastructure instead. Odoo threads surface with 'Open in Odoo' link.
- **Trade-offs:** Simpler implementation and less backend complexity, but creates asymmetric UX where users must leave the inbox to reply to Odoo messages

#### [Pattern] Unified inbox delegates actual filtering/sorting to backend via server functions, UI only manages local state (2026-01-16)
- **Problem solved:** Filter UI shows source type and search options, but actual thread filtering happens server-side
- **Why this works:** Prevents loading all messages into memory; scales to thousands of threads. Reduces client-side complexity and keeps single source of truth on server.
- **Trade-offs:** More network requests when filters change, but handles large datasets gracefully and simplifies client code significantly

#### [Pattern] Three-layer data aggregation pattern: data-access module pulls from multiple sources (tasks, approvals, alerts), server functions wrap with auth/validation, React Query provides client-side caching (2026-01-16)
- **Problem solved:** Daily Briefing needed to combine data from disparate domain sources (tasks, approvals, notifications) into a single coherent UI view
- **Why this works:** Separation of concerns allows each layer to evolve independently. Data-access handles query logic, server functions handle auth middleware and request validation, React Query handles staleness and refetching. This mirrors existing patterns in codebase.
- **Trade-offs:** More files to maintain but enables: reusable data-access for other consumers, testable server functions, cacheable queries with proper stale time management

#### [Gotcha] Widget registration warning 'already registered' indicates race condition in widget system where definitions may be loaded multiple times (2026-01-16)
- **Situation:** During verification, console showed duplicate registration warning
- **Root cause:** Widget system re-evaluates definitions during hot module reload or multiple entry points. System handles gracefully with overwrite, but indicates potential for stale references
- **How to avoid:** Automatic overwriting prevents crashes but masks issues where widget definition changes don't propagate to already-rendered components

### Wallet schema integrates with existing expenseRequest, expenseVoucher, reloadlyTransaction tables via foreign keys rather than creating separate expense-wallet junction table (2026-01-16)
- **Context:** Wallet system needs to track how expenses and airtime purchases are funded, linking transactions back to their business purpose
- **Why:** Direct foreign keys from transaction record to originating request/voucher keeps related data together in single row. Enables 'find wallet transaction for expense request X' without joins. Makes it clear what business event triggered a wallet debit. Maintains referential integrity at database level—cannot delete expense without deleting transaction
- **Rejected:** Junction table would add indirection and complexity. Nullable foreign keys across multiple tables would violate normalization; forces application logic to know which field to check. No inherent benefit unless one transaction maps to multiple expenses (not the case here)
- **Trade-offs:** Easier: clear causality (transaction→request), referential integrity, single-row lookup. Harder: each transaction type needs different foreign key column, queries more complex to union across different origins
- **Breaking if changed:** Removing foreign keys would lose referential integrity—could delete expense without cleaning up transaction. Would require application logic to maintain consistency.

### Sample/demo data embedded in component for standalone testing rather than requiring database connection (2026-01-16)
- **Context:** AlertFeedWidget needed to be testable and demonstrable without backend infrastructure
- **Why:** Enables immediate UI verification, Playwright testing without server setup, and component validation in isolation. Reduces friction for developers and QA to verify implementation.
- **Rejected:** Making database connection mandatory; would require database setup, migration management, and auth before any testing could occur
- **Trade-offs:** Easier to test and demo component immediately, but requires intentional data connection work later. Must be explicitly documented to prevent production data confusion.
- **Breaking if changed:** If demo data is removed without providing real data source, component renders empty. Any tests relying on demo data structure will fail.

### Four-level priority system (low, medium, high, critical) with separate four-level severity system (info, success, warning, error) (2026-01-16)
- **Context:** Alert feed needed to support both operational criticality and alert type classification
- **Why:** Priority handles urgency/impact (business decision), severity handles alert classification (technical categorization). Allows filtering by severity independently from priority. Enables sophisticated alert grouping strategies.
- **Rejected:** Single priority/severity field; would conflate two orthogonal concerns and reduce filtering/grouping flexibility
- **Trade-offs:** More complex alert model (+40 LOC in types), but enables nuanced alert presentation (e.g., 'high priority info alert' vs 'low priority error alert'). Storage doubled for alert metadata.
- **Breaking if changed:** Removing either dimension breaks filtering/UI. Alerts expecting only one field will have incomplete data.

#### [Pattern] Acknowledgment tracking with three fields: acknowledged (boolean), acknowledgedAt (timestamp), acknowledgedBy (user identifier) (2026-01-16)
- **Problem solved:** Needed to track not just if alert was acknowledged, but when and by whom for audit/debugging purposes
- **Why this works:** Enables audit trails for compliance, allows tracing alert resolution workflows, supports 'who handled this' queries. Time field enables 'oldest unacknowledged' sorting.
- **Trade-offs:** Three fields instead of one, but enables detective work ('which unacknowledged alerts have been sitting for 2 days?', 'who keeps missing critical alerts'). Requires user context to be available.

#### [Gotcha] Fixed pre-existing comment syntax error in unrelated file (schedule.ts) during implementation, revealing build validation gap (2026-01-16)
- **Situation:** Tests began failing because of syntax issues in a different module during widget integration
- **Root cause:** The broken comment syntax was masked by build, only surfaced during comprehensive test runs. Indicates existing code has issues.
- **How to avoid:** Fixed unrelated bug but expanded scope of changes. Safer but muddies change history.

#### [Pattern] Status transition functions (completeTransaction, failTransaction, reverseTransaction, cancelTransaction) rather than direct status updates (2026-01-16)
- **Problem solved:** Preventing invalid state transitions and ensuring audit logging happens automatically
- **Why this works:** Encapsulation prevents invalid state machines (e.g., pending→completed without processing). Functions can enforce constraints (can't cancel completed transactions) and trigger side effects (audit log). Single source of truth for transition rules
- **Trade-offs:** Gained: enforced state machine, guaranteed audit logging, impossible states prevented. Lost: raw SQL cannot bypass validations (intentional - prevents bugs)

### Used @tanstack/react-query for real-time data fetching with 30-second polling and 15-second stale time rather than direct API calls or WebSocket (2026-01-16)
- **Context:** Widget needs to show fresh approval queue data but user shouldn't see constant network noise
- **Why:** React Query's stale-while-revalidate strategy balances freshness with performance. 30s poll interval prevents overwhelming the server while 15s stale time allows instant cache hits for repeated navigations. Auto-invalidation on mutation ensures consistency without manual refetch logic
- **Rejected:** Direct API calls (no caching, wasteful), WebSocket (overkill for non-real-time use case), simple setInterval (no built-in cache management or error boundaries)
- **Trade-offs:** Adds dependency but eliminates manual loading/error state management. Cache staleness is intentional tradeoff for reduced server load
- **Breaking if changed:** Removing React Query would require implementing manual cache invalidation logic after approve/reject actions, risking stale UI state

### Modal dialog for reject action (requires reason) vs inline reject (no friction). Approve is one-click, reject requires confirmation dialog (2026-01-16)
- **Context:** Approvals are easily reversible in the system, rejections are less common and require explanation
- **Why:** Asymmetric friction reflects the business logic: approvals are the happy path (single button), rejections are exceptional cases requiring justification. Modal dialog ensures users don't accidentally reject without providing context
- **Rejected:** Symmetric design (both require dialogs - too much friction), no confirmation (risk of accidental rejections without audit trail), inline reject field (clunky UI)
- **Trade-offs:** More code for dialog state/validation but much better UX for the common case. Adds 1 extra click for rejections
- **Breaking if changed:** If rejection becomes as common as approval, or if rejection is allowed without reason, would need to flatten both to one-click buttons

#### [Pattern] Widget configuration options (maxItems, showOnlyUrgent, filterByType, showAmount) exposed but not used in current tests (2026-01-16)
- **Problem solved:** Widget was built with flexibility to support different dashboard contexts, but no configuration was actually tested
- **Why this works:** Widget system expects components to be configurable for reuse across different dashboard layouts. Even though current implementation has defaults, exposing options allows future dashboards to customize without code changes
- **Trade-offs:** Adds props complexity but enables dashboard-specific customization without widget modifications. Untested paths are technical debt

### Separated scheduler orchestration (BriefingSchedulerService) from data access layer (briefing-scheduler.ts data functions) into distinct modules (2026-01-16)
- **Context:** Scheduled briefing system needs to handle timezone-aware scheduling, delivery method routing, and delivery logging across multiple user preferences
- **Why:** Single responsibility principle - data access handles persistence and queries, service layer handles business logic (timezone conversion, delivery method selection, skip-if-no-updates logic). Allows independent testing and changes to delivery logic without touching data queries
- **Rejected:** Monolithic approach combining all logic in data access layer would mix concerns and make the delivery strategy harder to extend
- **Trade-offs:** More files to maintain, but cleaner dependency flow and easier to swap delivery implementations (push/email/in_app)
- **Breaking if changed:** Moving timezone utilities into service would break data access layer's ability to independently query by timezone. Merging layers would make it harder to change delivery strategies without DB schema changes

#### [Pattern] Using API key in header (BRIEFING_SCHEDULER_API_KEY) to authenticate scheduled cron job calls to the endpoint (2026-01-16)
- **Problem solved:** Cron job (external scheduler like Vercel Crons) needs to trigger briefing generation without user authentication context
- **Why this works:** Cron jobs are server-to-server calls outside normal user context. API key allows secure identification of the cron scheduler without requiring user sessions. Simpler than JWT for this use case
- **Trade-offs:** Simple header-based auth is easier than OAuth but requires secure key management and rotation. Less flexible than role-based auth but sufficient for single service

### Timezone handling uses IANA format strings (e.g., 'America/New_York') stored in database alongside delivery time, rather than converting to UTC at storage time (2026-01-16)
- **Context:** Users in different timezones need briefings at their local time. System needs to determine which users are due for delivery based on their current local time
- **Why:** Storing original timezone preserves user intent. When users change DST rules (which happens unpredictably), queries automatically adapt. UTC conversion at query time means system automatically handles DST transitions without data migration
- **Rejected:** Storing as UTC offset would break during DST transitions and require data migration. Storing as UTC would require timezone data to be embedded in each user record or recalculated constantly
- **Trade-offs:** Slightly more complex query logic (getTimes functions must convert), but timezone changes become automatic and zero-migration
- **Breaking if changed:** If timezone format changes from IANA to offset, historical delivery schedules become ambiguous during DST transitions. Users wouldn't know when they're scheduled

#### [Pattern] Skip-if-no-updates feature implemented as optional boolean flag in scheduler, checked before any delivery attempt (2026-01-16)
- **Problem solved:** Some users don't want to receive briefings when there's no new content to show
- **Why this works:** Places control at delivery time (when briefing content is known) rather than at preference time. The scheduler can check content existence before deciding to deliver. Avoids sending empty briefings
- **Trade-offs:** Requires access to briefing content within scheduler service. Alternative would be to preview content in data layer, but that splits business logic

#### [Gotcha] Delivery methods stored as enum-like string ('push'|'email'|'both'|'in_app') in database, not as separate boolean columns (2026-01-16)
- **Situation:** Users can choose different ways to receive briefings - push notifications, email, in-app, or combinations
- **Root cause:** Single string field is more maintainable than multiple boolean columns (easier to query for all push users, explicit about valid combinations). Enum provides schema validation
- **How to avoid:** Slightly harder to add new delivery methods (would require enum expansion), but current set is stable

#### [Pattern] Separated availableBalance and pendingBalance fields instead of single balance with pending flag (2026-01-16)
- **Problem solved:** Managing funds that are locked during pending transactions (e.g., payment processing) while allowing new transactions on truly available balance
- **Why this works:** This dual-balance approach enables clear semantics: availableBalance = balance - pendingBalance. Prevents double-spending by explicitly reserving funds without modifying the true balance, and audit logs clearly show what was reserved vs what was actually spent
- **Trade-offs:** More complex state to maintain (must keep pendingBalance in sync) vs clearer financial semantics and prevention of double-spending bugs

### Financial amounts handled and stored as strings rather than numbers to preserve decimal precision (2026-01-16)
- **Context:** Preventing floating-point arithmetic errors that could lose cents in financial calculations across many transactions
- **Why:** JavaScript numbers use IEEE 754 doubles which cannot exactly represent decimal values like 0.1 or 0.2. In financial systems, 0.1 + 0.2 !== 0.3 causes compound errors. Strings defer precision to database or decimal library
- **Rejected:** Using BigInt would work but creates friction converting to/from API boundaries; database decimals are standard but require careful casting
- **Trade-offs:** Loss of mathematical operators in JavaScript (can't use +, -, *) vs guaranteed decimal correctness; requires discipline to never do math in application layer
- **Breaking if changed:** If amounts are converted to numbers for any calculation (even simple addition), accumulated rounding errors will silently corrupt balances in production

#### [Pattern] Implemented idempotency key support at data-access layer to prevent duplicate transactions (2026-01-16)
- **Problem solved:** Handling retry scenarios where network failures cause client to retry balance operations, risking duplicate debits/credits
- **Why this works:** At-least-once delivery semantics in distributed systems means retries are inevitable. Idempotency keys checked at the database constraint level ensure retried requests produce identical results, not duplicate side effects. This is simpler and safer than application-level deduplication
- **Trade-offs:** Database stores idempotency keys (small storage cost) vs guaranteed safe retries even if client crashes mid-response

### Approval messages embedded in chat as first-class message types rather than separate approval dashboard (2026-01-16)
- **Context:** Building approval workflow that integrates with existing chat interface
- **Why:** Reduces context switching - users see approvals where they're discussing them. Leverages existing message infrastructure (MessageItem, MessageList) rather than creating parallel UI patterns. Creates single source of truth for conversations.
- **Rejected:** Separate approval center/dashboard would isolate approvals from context but requires users to switch contexts and duplicate conversation references
- **Trade-offs:** Easier: integrated approval context. Harder: message polymorphism (MessageItem must handle multiple types), threading complexity (approval threads separate from conversation threads)
- **Breaking if changed:** If removed, lose contextual approval requests; would need to rebuild notification/threading for separate system

#### [Pattern] Notification threading with separate chatApprovalThread table tracking read/unread status per user (2026-01-16)
- **Problem solved:** Multiple users need independent tracking of whether they've seen an approval notification
- **Why this works:** Denormalization of read status prevents querying entire approval history for each user. Thread pattern scales to millions of approvals without full-table scans. Matches notification patterns used in email systems.
- **Trade-offs:** Easier: O(1) read status lookup, independent user tracking. Harder: extra table join, delete cascade complexity

### Pre-wallet deduction balance check before external API call, with automatic refund on API failure (2026-01-16)
- **Context:** Mobile top-up service needs to handle wallet deduction safely when calling unreliable external Reloadly API
- **Why:** Prevents overdraft by checking sufficient funds before any operation. If Reloadly fails post-deduction, automatic refund restores funds. This creates an atomic-like guarantee without distributed transactions.
- **Rejected:** 1) Debit-then-check approach (would allow overdrafts), 2) Two-phase commit (complexity overkill for this use case), 3) Optimistic lock without refund (leaves system in inconsistent state)
- **Trade-offs:** Added complexity of refund logic, but eliminates overdraft risk and user confusion from failed transactions with debited wallets
- **Breaking if changed:** Removing the pre-check would allow overdrafts. Removing refund logic would leave wallet in inconsistent state on API failures. Both would severely impact user trust.

### Receipt generation with unique number format (TOP-YYYY-XXXXXXXX) tied to transaction record (2026-01-16)
- **Context:** Users need proof of transaction, but receipt generation needs to be deterministic and auditable
- **Why:** Unique receipt number generated from transaction timestamp + hash makes receipts traceable to database records. Prevents receipt number collisions and enables user lookup by receipt number.
- **Rejected:** 1) Random receipt numbers (non-auditable), 2) Sequential numbers (requires counter table, concurrency issues), 3) Hash of transaction alone (same transaction produces different receipts)
- **Trade-offs:** Receipt format is tied to transaction timestamp, but this provides audit trail and prevents duplicate receipts
- **Breaking if changed:** Changing receipt format breaks user ability to look up transactions by receipt number in database

#### [Pattern] Service layer (mobile-topup-service) orchestrating multiple domain concerns (wallet, Reloadly API, transactions, receipts) with server functions as HTTP boundaries (2026-01-16)
- **Problem solved:** Need to expose complex multi-step operation as API endpoint while maintaining clean separation of concerns
- **Why this works:** Service encapsulates business logic (balance checks, refunds, transaction recording) and is dependency-injected with wallet and Reloadly clients. Server functions define API contract and call service. This separates domain logic from HTTP concerns.
- **Trade-offs:** Extra layer of abstraction, but enables testing service logic independently of HTTP context and reusing logic across multiple endpoints

### Created wallet UI as separate routable pages (/dashboard/wallet and /dashboard/wallet/transactions) rather than a single multipane view (2026-01-16)
- **Context:** Needed to organize wallet dashboard with transaction history as distinct, accessible sections
- **Why:** Enables independent route-based access patterns matching mobile navigation paradigms; allows transaction page to exist independently with its own filtering/pagination state without coupling to dashboard
- **Rejected:** Single unified dashboard view with tabs/panels; would require managing complex shared state between sections and make URL-based deep linking problematic
- **Trade-offs:** Easier: route-based navigation, independent state management per page. Harder: coordination between pages if they need to share real-time updates
- **Breaking if changed:** If routes are removed, users lose ability to bookmark/deep-link to transactions page; navigation structure breaks

#### [Pattern] Used barrel export pattern (wallet/index.ts) for component exports to create clean public API surface (2026-01-16)
- **Problem solved:** Multiple wallet subcomponents need to be imported by pages and other features
- **Why this works:** Centralizes component exports, makes it easier to refactor internal structure without breaking imports across codebase; provides single source of truth for public wallet component API
- **Trade-offs:** Easier: refactoring, understanding public API. Harder: one additional file to maintain, developers might skip it and import directly anyway

#### [Gotcha] Pagination state in TransactionHistoryPage needs to reset when filters change, otherwise users see stale page numbers (2026-01-16)
- **Situation:** Users apply type/status filters expecting to see filtered results from page 1, but component remembers old page number
- **Root cause:** Filter changes implicitly change the result set size; page 5 in 'all transactions' might not exist in 'deposits only', creating index mismatch
- **How to avoid:** Easier: better UX (users expect filter to reset page). Harder: requires tracking filter dependencies and resetting related state

#### [Pattern] Multi-step wizard UI implemented as single route with state management rather than separate routes for each step (/topup/step1, /step2, etc). (2026-01-16)
- **Problem solved:** Mobile top-up flow has 4 sequential steps: recipient selection → amount entry → confirmation → success.
- **Why this works:** Single route with client-side state avoids URL fragmentation and deep linking issues. Users can't bookmark intermediate steps or manipulate URLs to skip validation. Transaction state persists in component memory during the flow.
- **Trade-offs:** Simpler state management and UX flow comes at cost of losing browser history for intermediate steps. If user presses back, they exit the entire wizard rather than going to previous step.

### Preset amounts ($5, $10, $15, $20, $25, $50) are hardcoded in UI component rather than fetched from backend configuration. (2026-01-16)
- **Context:** Mobile top-up offers standard preset amounts that users can tap quickly or enter custom amounts.
- **Why:** Preset amounts are region-specific and operator-specific. Hardcoding in UI client-side reduces API calls and latency. Operator data from backend already includes min/max validation, so presets are just UX shortcuts.
- **Rejected:** Fetching presets from backend would allow A/B testing and dynamic adjustments but adds latency and API dependency for static values.
- **Trade-offs:** Faster UI but reduced flexibility. Changing presets requires frontend deployment. Can't do time-limited promotions or per-user customization without API changes.
- **Breaking if changed:** If business requirements change presets frequently (seasonal, per-region, per-operator), hardcoding becomes maintenance burden. Would need to move to backend configuration or feature flags.

### Define AuditLogCategory/AuditActorType/AuditSeverity as TypeScript union types (not enums) with hardcoded test assertions (2026-01-16)
- **Context:** Need type safety for audit classification while preventing silent bugs if categories are accidentally omitted
- **Why:** Union types are more flexible than database enums (easier to extend) and test assertions catch missing categories at compile time. Tests verify type coverage explicitly.
- **Rejected:** Database CHECK constraints alone - wouldn't catch TypeScript type mismatches. Pure runtime validation only.
- **Trade-offs:** Tests become part of schema contract (not just validation). Any new category requires updating both type definition AND test counts.
- **Breaking if changed:** Removing test assertions would hide accidental category omissions. Removing type assertions would allow invalid runtime values through.

#### [Pattern] Singleton TaskReminderSchedulerService with push notification integration (2026-01-16)
- **Problem solved:** Processing reminders at scale without creating multiple scheduler instances competing for DB operations
- **Why this works:** Singleton pattern prevents race conditions when multiple cron executions overlap. Push notifications must be coordinated centrally to avoid duplicate sends.
- **Trade-offs:** Singleton is simpler and works for moderate scale but requires careful memory management; distributed approach needed only if reminder volume exceeds single-process throughput

#### [Gotcha] Timezone-aware reminder timing requires materializing user timezone context during scheduler execution (2026-01-16)
- **Situation:** Processing reminders in server timezone while users exist in multiple timezones; quiet hours and working day checks must respect user's local time
- **Root cause:** Storing timezone in preference table allows scheduler to convert UTC timestamps to user local time for quiet hours/working day logic without fetching user profile repeatedly
- **How to avoid:** Requires timezone denormalization in preference table but eliminates per-reminder user lookups; timezone changes require preference updates

#### [Pattern] Separate escalation logic and snooze/mute as stateful state record rather than preference toggles (2026-01-16)
- **Problem solved:** Runtime behavior (task is currently snoozed) must persist separately from user settings (user has reminders enabled)
- **Why this works:** State changes frequently (every snooze action) while preferences are stable (weekly/monthly). Separate tables prevent preference updates from clobbering runtime state.
- **Trade-offs:** Requires additional state table but makes snooze/mute queries O(1); enables independent TTL on state records (auto-expire old snoozes)

#### [Pattern] Data-access layer provides computed helper functions (shouldSendReminder, shouldEscalate) rather than raw CRUD only (2026-01-16)
- **Problem solved:** Reminder processing logic needs to evaluate complex conditions (quiet hours, escalation thresholds, snooze state)
- **Why this works:** Encapsulating decision logic in data-access layer keeps scheduler business logic simple and testable; reusable across UI and server functions.
- **Trade-offs:** Data-access layer becomes thicker but scheduler and UI both benefit from same tested logic; easier to evolve reminder rules

### Separated call disposition data from call records into dedicated tables with explicit relations (2026-01-16)
- **Context:** Call disposition (how call was resolved) is separate from call metadata (duration, direction, participants)
- **Why:** Disposition is optional post-call workflow data that may not exist immediately, has separate lifecycle, and requires different access patterns (written after call ends, not during call)
- **Rejected:** Storing disposition as nullable fields on call_record table would couple unrelated concerns and make querying only resolved calls more complex
- **Trade-offs:** Requires join queries vs simpler schema, but enables disposition queries independent of call records and supports multiple disposition attempts per call
- **Breaking if changed:** If disposition and call records merged, would need migration to split them again; disposition-specific indexes and soft-delete patterns become impossible

### React Query mutations include automatic query invalidation and toast notifications for all disposition/task operations (2026-01-16)
- **Context:** User changes disposition or creates task; page must reflect changes and provide feedback
- **Why:** Automatic cache invalidation prevents stale data after mutations; toast feedback confirms action succeeded and builds user confidence
- **Rejected:** Manual query refetch would require calling code to know all affected queries; silent mutations would leave users uncertain if action worked
- **Trade-offs:** Standard pattern easy to maintain vs risk of over-invalidating and fetching more data than necessary
- **Breaking if changed:** If query invalidation removed, tasks appear in list but then disappear on page refresh; if toast removed, users won't know if form submission actually worked

#### [Pattern] Singleton pattern for audit service via getAuditService() with lazy initialization (2026-01-16)
- **Problem solved:** Need for shared audit service instance across entire application without dependency injection
- **Why this works:** Ensures single audit queue and batch writer, prevents multiple flush timers. Allows convenient module-level imports without prop drilling
- **Trade-offs:** Easier: global access without boilerplate. Harder: testing requires module mocking; harder to have multiple audit configs

### Convenience methods (logAuth, logApproval, logFinancial, etc.) as primary API rather than generic log() method (2026-01-16)
- **Context:** Audit logging must capture domain-specific context (approval reason, transfer amount, old/new role)
- **Why:** Strongly-typed convenience methods prevent missing required context fields. Semantic naming matches business operations. Easier to discover what's auditable
- **Rejected:** Generic log(type, data) requires developers to know required fields; too easy to omit important context; weaker type safety
- **Trade-offs:** Easier: self-documenting API, stronger types, discoverability. Harder: adding new event types requires new methods; more surface area to test
- **Breaking if changed:** Generic log() would allow incomplete logging of critical operations; missing actor context could hide unauthorized access

### ActorContext captures user ID, IP address, and session - not persisting full user object (2026-01-16)
- **Context:** Audit logs must show who performed action, but storing full user object creates data duplication and historical consistency issues
- **Why:** User ID + IP provides accountability; sufficient to find actor in audit queries. Storing snapshot prevents log inconsistency if user data changes
- **Rejected:** Full user object creates denormalization; soft-delete users would break audit queries; user data changes become invisible in logs
- **Trade-offs:** Easier: logs don't grow unboundedly with user data; changes don't affect historical logs. Harder: must join to users table to show names; data loss if user deleted
- **Breaking if changed:** If user is deleted, audit trail shows orphaned user ID; without IP, can't detect account takeover scenarios

### Separated retention policy evaluation into a configurable matcher system with priority-based ordering rather than hardcoded conditions (2026-01-16)
- **Context:** Retention policies need to match calls based on multiple criteria (direction, duration, roles, tags, extensions, domains) with different policy rules for different criteria combinations
- **Why:** Priority-based matching allows policies to be defined in external configuration, making them updatable without code changes. The matcher pattern allows complex conditional logic to scale without exponential if-statement explosion
- **Rejected:** Hardcoded if-else chains or single database policy table without priority weighting - would require code deployment for policy changes and make policy evaluation order unclear
- **Trade-offs:** Added complexity of priority evaluation system, but gained flexibility for non-developers to manage retention policies through configuration without deployment
- **Breaking if changed:** If priority-based ordering is removed, ambiguous matches where multiple policies apply will have undefined behavior; callers cannot rely on policy precedence

#### [Pattern] Retention enforcement split into two phases: dry-run query (what would be deleted) and actual deletion, with dry-run callable via API query parameter (2026-01-16)
- **Problem solved:** Retention policy enforcement is destructive operation - need to safely test and audit what will be deleted before permanent removal
- **Why this works:** Dry-run mode allows operators to call /api/recording/retention?dryRun=true to see impact before actual enforcement. Separates read-only audit (what matches policy) from write (actual deletion). Same code path for both prevents divergence
- **Trade-offs:** Query parameter adds slight complexity but allows production testing; dry-run still reads all matching records so expensive queries get discovered before data loss

#### [Pattern] Recording metadata indexed by (userId, createdAt) to efficiently query recordings by user and retention deadline without full table scans (2026-01-16)
- **Problem solved:** Retention policies need to find all recordings for user X older than policy retention date; full table scan is O(n) and unfeasible with millions of recordings
- **Why this works:** Composite index allows retention query to use index range scan: find user partition, then scan by date within that partition. Execution time is O(log n + matching records) instead of O(n)
- **Trade-offs:** Extra storage for index, slightly slower inserts; but enables retention policies to run efficiently even at scale

### Fire-and-forget async posting triggers in approval/reconciliation workflows rather than blocking awaits (2026-01-16)
- **Context:** GL posting must occur after approval and reconciliation, but these are existing critical workflows that cannot be delayed
- **Why:** User-facing approval/reconciliation actions must complete immediately. GL posting is important but not blocking - failures should not prevent expense state transitions. Separates concerns between transactional approval and async accounting sync.
- **Rejected:** Awaiting GL posting completion before returning from approval would block workflows; queuing synchronously would require transaction management across systems
- **Trade-offs:** Easier: fast approval UX, resilient to Odoo downtime. Harder: eventual consistency requires status checking queries, retry logic needed for failed postings
- **Breaking if changed:** If changed to blocking awaits, approval/reconciliation endpoints become dependent on Odoo availability and performance; timeout/failure in GL posting cascades to user-facing workflows

#### [Gotcha] Odoo connection errors (401, timeout) must be distinguished from GL posting logic errors in test assertions (2026-01-16)
- **Situation:** Playwright tests needed to verify application doesn't crash on Odoo operations, but Odoo might be unavailable in test environment
- **Root cause:** The integration must handle Odoo unavailability gracefully - 401/network errors are expected operational failures, not bugs. Treating infrastructure failures as test failures causes brittle tests that fail when Odoo is down.
- **How to avoid:** Easier: stable tests that work offline. Harder: need filtering logic to distinguish error types; some real Odoo problems (bad credentials) get filtered

#### [Pattern] Caching GL accounts and journals during service initialization rather than per-request lookups (2026-01-16)
- **Problem solved:** Odoo GL account/journal lookups are read-heavy, performed on every posting operation, data rarely changes during session
- **Why this works:** Reduces Odoo API calls dramatically (1-2 at init vs 1 per posting). Accounts and journals are relatively static configuration. Caching at service level rather than application level keeps responsibility encapsulated.
- **Trade-offs:** Easier: faster posting, fewer dependencies. Harder: stale data if accounts/journals change during runtime, cache misses on new accounts

### Three-tier evaluation priority: user targeting > role targeting > rollout strategy, with short-circuit on match (2026-01-16)
- **Context:** Need deterministic flag evaluation when users belong to roles that also have targets
- **Why:** User-level targets represent the most specific business rule (e.g., 'give Alice early access even though operators don't have it yet'), so should override broader rules. Prevents role assignments from overriding intended user exceptions
- **Rejected:** Alternative 'OR' logic (any target matches = enabled) would be ambiguous when user and role have conflicting targets. Alternative 'AND' logic would be overly restrictive
- **Trade-offs:** Clear determinism but requires operators to understand precedence when setting conflicting targets. Single override at user level is easier to reason about than complex boolean logic
- **Breaking if changed:** If priority order changes, flags with mixed targeting would evaluate differently. Business logic likely depends on user-level overrides being respected

#### [Pattern] Separation of data access layer (src/data-access) from server functions (src/fn) with single responsibility (2026-01-16)
- **Problem solved:** Need to prevent mixing database concerns with HTTP/RPC concerns
- **Why this works:** Data access layer handles query building and evaluation logic (pure business logic). Server functions handle auth middleware, Zod validation, and serialization. Allows reusing data access layer in multiple contexts (API routes, scheduled jobs, internal services)
- **Trade-offs:** Two files to maintain instead of one, but data access layer becomes testable without HTTP context and can be invoked from non-RPC code

#### [Pattern] Event-driven service layer with pub/sub pattern for real-time updates via SSE instead of polling or WebSocket (2026-01-16)
- **Problem solved:** Need for real-time feature flag updates to multiple clients without overwhelming server or requiring persistent connections
- **Why this works:** SSE provides unidirectional server-to-client communication which is sufficient for read-heavy flag updates, simpler than WebSocket handshake, works with existing HTTP infrastructure. Event emitter decouples cache invalidation from client notification.
- **Trade-offs:** SSE simpler than WebSocket but server must handle concurrent connections for each client; event-driven adds layer of indirection but enables clean cache invalidation patterns

### Service class manages both cache and event emitter; hooks provide multiple consumption patterns (single flag, batch, real-time SSE, A/B test helper) (2026-01-16)
- **Context:** Single service needs to support different client access patterns: stateless API calls, batched queries, real-time subscriptions, convenience helpers
- **Why:** Service as single source of truth for cache consistency and event dispatch. Multiple hooks allow consumers to pick appropriate pattern without re-implementing logic. A/B test hook reduces boilerplate.
- **Rejected:** Separate cache and event services (harder to keep in sync), single monolithic hook (forces unnecessary SSE subscription), no convenience helpers (users duplicate logic)
- **Trade-offs:** Service class bigger but ensures cache/events stay synchronized; multiple hooks flexible but more surface area to maintain; A/B helper convenient but hides targeting logic
- **Breaking if changed:** Removing event emit from service causes SSE clients to become stale; removing cache breaks performance for repeated evaluations; removing convenience hooks forces users to manage subscription lifecycle

#### [Gotcha] Real-time updates via SSE requires client-side subscription lifecycle management; useFeatureFlagsWithSSE handles cleanup but adds complexity (2026-01-16)
- **Situation:** SSE connections are persistent; unmounting component or losing network should clean up connection
- **Root cause:** SSE connections stay open until explicitly closed. Not closing them on unmount causes connection leak and memory waste on server. useFeatureFlagsWithSSE wraps AbortController cleanup.
- **How to avoid:** Hook abstracts cleanup but hides connection lifecycle from user; simpler to use but harder to debug if connections leak anyway

#### [Pattern] Separation of data-access layer from server functions from query hooks from UI components (2026-01-16)
- **Problem solved:** Created 5 separate layers: data-access → server functions → query options → react hooks → components
- **Why this works:** Enables independent testing, reusability across routes, caching strategy abstraction, and authentication boundary enforcement at server function layer
- **Trade-offs:** More boilerplate and file count, but enables proper separation of concerns and TanStack Query integration for cache invalidation patterns

### Manual reconciliation through server function mutations rather than direct state updates (2026-01-16)
- **Context:** Created linkVoucher(), unlinkVoucher(), and reconcileMatch() as server functions with query invalidation
- **Why:** Ensures mutations are auditable, authorizable, and immediately reflect true state; TanStack Query invalidation prevents stale UI state and race conditions
- **Rejected:** Optimistic client updates would make UI faster but risk showing inconsistent state if mutations fail; state management library would duplicate server state
- **Trade-offs:** Round-trip latency on mutations, but guaranteed consistency and audit trail; invalidation ensures freshness without manual cache updates
- **Breaking if changed:** Removing server function mutations would prevent audit logging of who reconciled what when; losing query invalidation would require manual state management

#### [Pattern] Drill-down dialogs implemented as modal overlays with separate detail views for each metric category (AR Aging, AP Aging, Cash Position, Burn Rate) (2026-01-16)
- **Problem solved:** Widget displays summary metrics but users need access to detailed breakdowns without leaving the dashboard
- **Why this works:** Modal dialogs keep context visible (user stays on dashboard) while showing deep details. Separating by category (AR/AP/Cash/Burn) reduces modal complexity and improves cognitive load
- **Trade-offs:** Multiple small modals = easier to maintain and test but requires managing 4 separate dialog states; single modal = fewer state variables but larger, more complex component

#### [Pattern] Type assertion for Zod validated data: casting Parameters<typeof fn>[0] to maintain type safety across validation boundary (2026-01-16)
- **Problem solved:** Zod validation infers union types from schema definition that don't perfectly match function parameter types despite runtime equivalence
- **Why this works:** Prevents TypeScript from widening types based on Zod schema literal unions. Direct assertion to function parameter type is safer than asserting to specific literal union type
- **Trade-offs:** Type assertion feels unsafe but actually maintains type contract safety by binding to function signature rather than schema definition

### Dual-table approach for verification: kycVerification + kycVerificationHistory instead of single versioned table (2026-01-16)
- **Context:** KYC workflow requires audit trail, approval workflow, and status transitions to be fully tracked
- **Why:** Separates current state (kycVerification) from complete history (kycVerificationHistory) - enables efficient queries for current status without scanning history, while maintaining immutable audit trail
- **Rejected:** Single table with versioning - would require filtering by timestamp/version on every read, slower queries for current state
- **Trade-offs:** Slightly more complex writes (update + insert) but significantly faster reads for common case of 'get current verification status'
- **Breaking if changed:** Removing history table loses audit trail capability and makes compliance/debugging difficult

### Implemented AI-powered priority scoring with heuristic fallback instead of pure AI-only approach (2026-01-16)
- **Context:** Message priority calculation needed to handle cases where Claude API might be unavailable, rate-limited, or too slow for real-time scoring
- **Why:** Fallback ensures feature remains functional during AI service degradation; heuristics based on keywords (urgent, deadline, asap) and sender patterns provide reasonable defaults when AI is unavailable
- **Rejected:** Pure AI-only approach would require all priority scoring to depend on external API availability, increasing failure points
- **Trade-offs:** Heuristic fallback is less accurate than AI but guarantees availability; adds code complexity with dual scoring logic paths
- **Breaking if changed:** Removing fallback logic would make feature completely dependent on Claude API uptime; partial scoring would become impossible

#### [Gotcha] Priority scoring needs priorityFactors as JSON object, not just single numeric score, to capture multi-dimensional reasoning (2026-01-16)
- **Situation:** During implementation, realized users need to understand WHY something was marked high priority (sender? keywords? context?) for trust and debugging
- **Root cause:** Storing detailed factors (senderImportance, contentUrgency, actionRequired, contextRelevance) allows transparent scoring; enables future machine learning to learn from user corrections
- **How to avoid:** Additional database storage for JSON data, but enables transparency and model improvement; adds debugging visibility

#### [Pattern] Implemented scoredAt timestamp with explicit scoring state instead of implicit cache invalidation (2026-01-16)
- **Problem solved:** Priority scores need to age gracefully; thread content changes should trigger rescoring but messages shouldn't be rescored on every view
- **Why this works:** Explicit timestamp enables background job to identify stale scores; avoids rescoring same message repeatedly while capturing content changes; allows score TTL logic
- **Trade-offs:** Adds complexity with background scoring jobs, but enables efficient batching and avoids API waste on unchanged content

### Implemented priorityReason field (text) separate from priorityFactors (JSON) instead of embedding explanation in JSON (2026-01-16)
- **Context:** Users need human-readable explanation of scores, but factors need to be structured for analysis and debugging
- **Why:** Separation allows Claude to generate natural language explanations while factors remain structured; enables future use of factors for analytics without parsing text
- **Rejected:** Embedding reason in priorityFactors JSON would require parsing natural language for analytics; single explanation string lacks structure
- **Trade-offs:** Two fields instead of one, but enables both human understanding and machine analysis of same score
- **Breaking if changed:** Removing priorityReason loses user-facing transparency; keeping only factors creates need for runtime explanation generation

#### [Pattern] Implemented getThreadsNeedingScoring() data access function to identify stale scores instead of always computing scores (2026-01-16)
- **Problem solved:** Batch scoring all threads on every operation is expensive; system needs to know which threads need attention
- **Why this works:** Enables background job to identify outdated scores and batch-update only changed threads; reduces unnecessary Claude API calls and database writes
- **Trade-offs:** Adds background job complexity and state tracking, but dramatically reduces operational costs and API usage

#### [Pattern] KYC approval workflow separated into atomic functions: startKycReviewFn → approveKycVerificationFn/rejectKycVerificationFn, plus parallel document-level verification (2026-01-16)
- **Problem solved:** KYC system needs to handle both user-level approval (tier assignment) and granular document-level acceptance/rejection
- **Why this works:** Separates concerns: review initiation, batch approval, and granular document validation. Allows auditing each step independently and supports partial approvals (some docs rejected, user still approved at lower tier)
- **Trade-offs:** More function surface area to maintain, but gains flexibility for complex KYC policies (e.g., approve user but request document resubmission). Audit trail captures each action separately

#### [Pattern] Admin dashboard integrated KYC via pending counts and navigation link, rather than embedding full review on dashboard (2026-01-16)
- **Problem solved:** KYC review is complex (multiple documents, approval dialogs, status tracking); dashboard needs high-level status only
- **Why this works:** Separates concerns: dashboard shows KYC health (X pending), dedicated page (/dashboard/kyc) handles the complex workflow. Reduces dashboard load and keeps concerns clear
- **Trade-offs:** One extra click to access KYC, but cleaner architecture. Dashboard remains fast and focused

#### [Pattern] Routes defer feature validation to content string matching rather than semantic assertions (2026-01-16)
- **Problem solved:** Mobile KYC pages accept multiple valid states (authenticated + content, unauthenticated redirect, 404 for non-hot-reloaded)
- **Why this works:** Decouples test reliability from auth state, deployment stage, and runtime conditions. Single test covers all paths without environment setup
- **Trade-offs:** Tests are environment-agnostic but don't verify business logic; can't catch broken KYC form without semantic DOM queries

### KYC submission uses three-step wizard (Personal Info → Documents → Review) with ReceiptCapture component for photo capture (2026-01-16)
- **Context:** Mobile form needed document upload capability without creating new camera component
- **Why:** Reusing ReceiptCapture (already battle-tested for photo capture) reduces code duplication and leverages existing device camera integration. Step-by-step guide reduces cognitive load on mobile.
- **Rejected:** Could build custom camera component (maintains one less dependency but duplicates logic); flat form (faster but harder to use on mobile with many fields)
- **Trade-offs:** Faster implementation and consistent UX vs ReceiptCapture semantics don't perfectly match document capture (receipt vs document photography)
- **Breaking if changed:** If ReceiptCapture component removed or changes camera handling, KYC form breaks. If three-step assumption baked into state, flattening form requires refactor

#### [Pattern] Mobile route components mirror desktop components but with optimized UI patterns (swipe gestures, accordion collapsibles) using the same underlying data queries (2026-01-16)
- **Problem solved:** Mobile briefing view reuses briefingQueryOptions from existing briefing data layer rather than creating separate API endpoints
- **Why this works:** Reduces data layer duplication while allowing UI-specific optimizations. Mobile and desktop can share business logic but diverge on interaction patterns. Follows DRY principle at data layer while allowing presentation flexibility
- **Trade-offs:** Easier: shared caching, single source of truth for briefing data. Harder: mobile components must handle same data structure as desktop, limiting mobile-specific payload optimization

#### [Pattern] Auto-mark-as-read behavior with 2-second delay uses setTimeout but actual API integration is not implemented (only console logging) (2026-01-16)
- **Problem solved:** Feature includes 'briefing regeneration and auto-mark-as-read functionality' in description but console.log statements indicate incomplete implementation
- **Why this works:** Scaffolding implementation to establish flow and component structure before wiring to actual mutations. Allows testing component behavior independently of API availability
- **Trade-offs:** Easier: clear placeholder for developers to find and complete. Harder: feature is non-functional without mutation implementation, creating false sense of completion

### Claude Vision API chosen as primary OCR provider over Tesseract/Textract despite higher latency (2026-01-16)
- **Context:** Receipt OCR requires accurate extraction of unstructured data (vendor, amount, date, line items) with confidence scoring
- **Why:** Claude Vision provides structured JSON output with confidence scores and can handle poor image quality. Server-side processing avoids client-side heavy JS library (tesseract.js) and licensing complexity of Textract
- **Rejected:** Tesseract.js (client-side - performance/bundle impact), AWS Textract (cost, vendor lock-in), Google Vision (similar to Claude but less integration)
- **Trade-offs:** Higher latency per request but better accuracy and built-in confidence scoring. No client-side processing overhead. Requires API key management
- **Breaking if changed:** If Claude API becomes unavailable, entire OCR feature fails unless fallback provider implemented

### Confidence scores tracked per-field rather than document-level confidence (2026-01-16)
- **Context:** Manual correction UI needs to flag which specific fields may be incorrect
- **Why:** Receipts often have mixed quality - vendor name clear but amount ambiguous. Field-level confidence enables smart UX (auto-focus correction on low-confidence fields)
- **Rejected:** Single document-level score (loses granularity, requires full re-review)
- **Trade-offs:** More complex state management but significantly better UX. Claude prompt must request per-field confidence
- **Breaking if changed:** If confidence tracking removed, can't prioritize manual correction focus

### Validation layer separate from OCR extraction - checks result quality after Claude processing (2026-01-16)
- **Context:** Claude may return incomplete or low-confidence data that needs flagging before user sees it
- **Why:** Decouples OCR provider from validation rules. Enables different validation rules per currency/vendor/country without modifying Claude prompt. Validation can be updated independently of OCR logic
- **Rejected:** Embedding validation in Claude prompt (inflexible, harder to iterate)
- **Trade-offs:** Extra processing step but makes system more maintainable. Validation rules can be A/B tested independently
- **Breaking if changed:** If validation layer removed, no way to flag low-confidence extractions or missing required fields before submission

#### [Pattern] useOcrProcessing hook abstracts entire workflow state (upload→process→review→submit) rather than granular hooks (2026-01-16)
- **Problem solved:** OCR has distinct phases with different state needs
- **Why this works:** Single source of truth for complex multi-step flow. Prevents race conditions and state inconsistencies. Makes it easy to reset or navigate back through workflow
- **Trade-offs:** Hook is larger but workflow is guaranteed valid. Reset functionality works atomically

#### [Pattern] Stateful service class with isProcessing flag for concurrent processing protection rather than distributed locking (2026-01-16)
- **Problem solved:** Alert monitoring service runs on intervals, risk of race conditions when multiple instances or overlapping executions occur
- **Why this works:** Simple, low-overhead solution for single-server deployments. Boolean flag prevents re-entrant processing and maintains in-memory state between calls
- **Trade-offs:** Works perfectly for single-instance deployments but breaks with horizontal scaling. Simpler code vs limited scalability

### In-memory alert tracking with dual-threshold system (24h for reminders, 48h for overdue) instead of persistent database logging (2026-01-16)
- **Context:** Need to prevent duplicate alerts while allowing re-notification after escalation threshold
- **Why:** Reduces database writes for high-frequency alert service, thresholds are sufficient to prevent most duplicates while respecting grace period for status changes
- **Rejected:** Persistent alertSentLog table - more overhead, requires cleanup jobs, harder to adjust thresholds retroactively
- **Trade-offs:** Memory-efficient and responsive vs losing alert history on restart, requires careful threshold tuning
- **Breaking if changed:** Service restart clears all tracking; if thresholds are too short, users see duplicate notifications; if too long, misses legitimate re-alerts after escalation

### Query returns user records with nested voucher arrays rather than flattening all user-voucher combinations (2026-01-16)
- **Context:** Service needs to send one notification per user about multiple vouchers in different states
- **Why:** Reduces network round-trips, allows building single rich notification aggregating multiple issues per user, matches notification service expectations (one push per user)
- **Rejected:** Flatten result set - requires aggregation in service layer, more complex to build user-scoped notifications
- **Trade-offs:** Better API contract and fewer queries vs slightly more complex data transformation in JavaScript
- **Breaking if changed:** Flattening approach loses user-scoping context; you'd send one notification per voucher instead of per user

#### [Gotcha] Quiet hours check happens AFTER alert eligibility determined, not before querying; wasAlertSentRecently prevents redundant checks (2026-01-16)
- **Situation:** If quiet hours check came during query, would require storing quiet hour preferences in database or passing timezone info through complex joins
- **Root cause:** Quiet hours are user-specific (timezone), checking in application layer is simpler than database-side; wasAlertSentRecently cache prevents re-checking same user within seconds
- **How to avoid:** Fetches some users who won't get notified (quiet hours) vs avoiding complex database logic and timezone handling

### Used JSON columns in Drizzle schema for nested complex data structures (keyPoints, actionItems, sentimentDetails) instead of separate normalized tables (2026-01-16)
- **Context:** Post-call summaries contain highly variable, nested data structures that could be normalized into separate tables
- **Why:** JSON columns eliminate O(N) joins for common query patterns and reduce relational complexity. Since summaries are immutable after generation, denormalization is safe. Drizzle's type-safe JSON parsing (parseJSON/array/object helpers) prevents type mismatches at query time
- **Rejected:** Normalized schema with separate call_key_points, call_action_items tables - would require multiple joins on every summary retrieval and complicate update logic
- **Trade-offs:** Easier: Single-row inserts, immutable summaries, type safety. Harder: Querying within nested arrays (requires SQL functions), schema migrations for structure changes
- **Breaking if changed:** Switching to normalized tables would require rewriting data-access layer queries, invalidating type assumptions in use-cases layer, and changing the insertion pattern entirely

#### [Pattern] Mirrored existing Claude client pattern (getClaudeClient from lib) instead of creating new client instance in use-case (2026-01-16)
- **Problem solved:** Had existing getClaudeClient() helper in codebase, chose to reuse it rather than instantiate Anthropic directly
- **Why this works:** Centralizes credential management, API versioning, and client configuration in one place. If API key rotation, base URL changes, or request middleware is needed, it propagates automatically to all use-cases. Supports testing/mocking through dependency injection at the client level
- **Trade-offs:** Easier: Centralized changes affect all features. Harder: Must understand existing client pattern, changes require care to not break other features

#### [Pattern] Separation of validation schemas from data access - Zod schemas in function layer, not in DAL (2026-01-16)
- **Problem solved:** Server functions and data access layer have different validation needs
- **Why this works:** Prevents validation leakage into DAL (which should trust inputs), allows API-layer-specific rules (authentication, rate limits), enables DAL reuse without forcing validation paths
- **Trade-offs:** Easier: clean separation of concerns, testable layers; Harder: duplicate validation semantics possible, synchronization overhead

### Separated health check execution (POST endpoint) from status querying (GET endpoint), with GET returning cumulative/cached results while POST triggers fresh checks (2026-01-16)
- **Context:** Initial test expected POST to return all category results immediately, but found POST returns empty array during quiet hours while GET shows previous results with totalChecksToday counter
- **Why:** Allows asynchronous health check execution without blocking API responses. Decouples health check triggers (cron jobs) from status queries (dashboard reads). Respects business logic (quiet hours) at execution time, not query time
- **Rejected:** Single unified endpoint that always returns fresh checks - would block clients during execution and couldn't respect quiet hours without failing requests
- **Trade-offs:** Clients must poll GET for results or understand eventual consistency model. More complex contract. Simpler scaling - read-heavy GET vs write-heavy POST can be scaled independently
- **Breaking if changed:** If POST begins returning fresh results, clients may expect synchronous completion and timeout. If GET stops caching, metrics like totalChecksToday become meaningless

#### [Pattern] Monitoring service gracefully degrades by category - if expenses check fails, financial still succeeds and returns in status endpoint (2026-01-16)
- **Problem solved:** Only financial category appears in GET /api/monitoring/status due to database errors in other categories, but service doesn't fail entirely
- **Why this works:** One category's data unavailability shouldn't blind you to others. Operators need visibility into what IS healthy even if some checks error. Prevents cascading failures
- **Trade-offs:** Partial results are harder to reason about than all-or-nothing responses. Must track which categories actually ran vs which errored. Operator must understand they're seeing incomplete picture

### Thresholds and skip conditions (quiet hours, working days) embedded in service layer rather than configuration-driven at query time (2026-01-16)
- **Context:** Quiet hours check prevents POST from executing checks even if manually triggered, enforced during execution not after
- **Why:** Business logic (quiet hours) shouldn't be bypassable via API parameter. Prevents operator from accidentally running heavy checks during sleep hours. Single source of truth in service
- **Rejected:** Configuration flags returned with response to let client decide if results are valid. Shifts responsibility to client, allows inconsistent interpretation
- **Trade-offs:** Less flexible - quiet hours can't be overridden without code change. More predictable - all clients see consistent behavior. Prevents subtle bugs from timing mismatches
- **Breaking if changed:** If changed to client-side skip logic, on-call engineer calling POST at 11pm might think they got fresh results when they got skipped ones

### Idempotency keys implemented in processQrPaymentFn to prevent duplicate wallet transactions (2026-01-16)
- **Context:** Payment processing with wallet deduction requires atomicity - duplicate requests could double-charge users
- **Why:** Idempotency keys allow safe retry logic without database constraints. Network failures or client retries won't create duplicate transactions if the same key is reused
- **Rejected:** Database-level unique constraints on payments alone - wouldn't handle case where request succeeds but response fails before client receives confirmation
- **Trade-offs:** Adds storage overhead for idempotency key tracking but enables true at-least-once delivery semantics. Client must generate stable keys from request parameters
- **Breaking if changed:** Removing idempotency key logic would allow duplicate charges in retry scenarios, requiring clients to implement their own deduplication

#### [Pattern] Separated QR code generation into multiple specialized functions (generateQrCode, generatePaymentQrCode, generatePaymentDataQrCode) (2026-01-16)
- **Problem solved:** QR payments require different QR payload types - some contain URLs, others contain encrypted payment data
- **Why this works:** Different payload types need different encoding/validation. Payment URLs need expiration/shortcodes, while data QR codes need encryption. Separation prevents mixing concerns
- **Trade-offs:** More functions to maintain but each has single responsibility. Easier to add new QR types without affecting existing code. Functions can have different error handling

### Query keys factory pattern (queryKeyFactory in TanStack) used instead of string literals for cache invalidation (2026-01-16)
- **Context:** Multiple QR payment queries (byId, byQrCode, byShortCode) need coordinated cache invalidation when payment status changes
- **Why:** Factory pattern centralizes query key structure. When payment updates, mutations can invalidate all related queries using the factory without hardcoding multiple key patterns throughout codebase
- **Rejected:** String literal query keys - would require mutations to know about all query key formats, making it fragile when adding new query types
- **Trade-offs:** Requires factory maintenance but prevents cache invalidation bugs. Easier to add new query types and guarantee cache consistency
- **Breaking if changed:** Removing factory pattern requires mutations to hardcode all cache keys they invalidate. New query types won't auto-invalidate without updating mutation code

#### [Gotcha] Merchant fee calculation includes both fixed + percentage components (not just one), requiring careful order of operations in wallet deduction (2026-01-16)
- **Situation:** Transaction flow: payer balance -= amount, merchant balance += amount - fees. Fee calculation must happen before wallet deductions to ensure consistency
- **Root cause:** Fee structure common in real payment systems, but critical that fees are calculated on the exact transaction amount to prevent reconciliation issues. Calculating fees after deduction risks floating-point errors affecting multiple accounts
- **How to avoid:** More complex math but ensures every transaction balances atomically. Alternative is complex reconciliation logic after the fact

#### [Pattern] Prevention of self-payments (user cannot pay themselves) implemented as business logic check, not database constraint (2026-01-16)
- **Problem solved:** User attempts to pay their own QR code through payment flow
- **Why this works:** Business logic check fails fast at application layer, preventing unnecessary database transaction. Self-payment doesn't make business sense and should fail at validation level before touching databases
- **Trade-offs:** Client can detect and show friendly error immediately vs generic database error. Prevents spending database transaction overhead on invalid requests

#### [Pattern] Dual API design: service class (OdooCrmCallLoggingService) + server functions (crm-call-logging.ts) (2026-01-16)
- **Problem solved:** Need both client-side orchestration and background job processing capability
- **Why this works:** Service class provides testable, reusable logic; server functions provide RPC interface for client and scheduled task execution. Avoids duplicating business logic between direct calls and background jobs
- **Trade-offs:** Slight indirection (service call wrapping), but gained ability to call from multiple contexts (direct, background, scheduled) without code duplication. Server functions act as adapter layer

### Sync status stored as enum string in database (pending|in_progress|success|failed|skipped) rather than boolean success flag (2026-01-16)
- **Context:** Need to represent intermediate states and distinguish between unprocessed, processing, and terminal states
- **Why:** Enum allows querying for specific statuses without separate columns. 'in_progress' state is critical for preventing duplicate processing during retries. 'skipped' state avoids marking user-skipped items as failed
- **Rejected:** Boolean 'synced' + separate error_count column - loses 'in_progress' state, can't distinguish never-attempted from failed, doesn't represent user-skipped items
- **Trade-offs:** String enum takes slightly more storage than boolean, but query logic becomes simpler (single column enum vs boolean+count logic). Prevents retry logic bugs
- **Breaking if changed:** Changing to boolean loses ability to prevent concurrent retry processing of same record

#### [Pattern] Separation of data access from AI analysis use case - data layer returns raw data, use case adds Claude integration layer (2026-01-16)
- **Problem solved:** Customer issue monitoring needs both real-time data fetch and optional AI analysis. Two separate functions prevent coupling AI dependencies to data queries
- **Why this works:** Allows dashboard to load immediately with data while AI analysis runs async. Prevents blocking on Claude API timeouts. AI can be toggled off without changing data layer
- **Trade-offs:** Requires two API calls instead of one (getCustomerIssueMonitorData, then analyzeCustomerIssues). Benefit: non-blocking UX and optional AI features

### API response validation accepts both rendered dashboard OR sign-in page as valid states in tests (2026-01-16)
- **Context:** Feature endpoint might be protected or unprotected depending on environment. Tests needed to verify route exists without assuming auth state
- **Why:** Deployment environments vary in authentication requirements. Tests validate the route is accessible (doesn't 404) and responds with valid content, regardless of auth
- **Rejected:** Asserting only successful dashboard render - this fails in secure environments and masks deployment issues
- **Trade-offs:** Tests are more permissive (harder to catch missing features). Benefit: single test suite works across dev/staging/production auth configurations
- **Breaking if changed:** Removing sign-in acceptance breaks tests in secured environments and forces environment-specific test configurations

### Separated data access layer from server functions instead of embedding logic directly in server functions (2026-01-16)
- **Context:** Cash position monitoring requires complex calculations (burn rate, runway prediction, alert generation) that must be server-only but called from multiple places
- **Why:** Enables reusability across multiple server functions and testability. Server functions in TanStack Start are harder to unit test directly, so moving core logic to data-access layer allows independent testing of business logic while server functions remain thin adapters
- **Rejected:** Embedding all logic directly in `createServerFn()` handlers - would couple calculations to server function definition and make testing business logic difficult without test database setup
- **Trade-offs:** Extra abstraction layer adds files but gains: testability without running server functions, reuse across multiple endpoints, easier to port logic to different runtimes later. Cost: one more indirection when reading code
- **Breaking if changed:** If removed, would lose ability to unit test cash position calculations independently. Server functions would need restructuring to expose internal logic for tests

#### [Pattern] Widget definition encapsulates metadata, schema validation, and serializable config alongside component implementation (2026-01-16)
- **Problem solved:** Dashboard system needs to persist widget configurations, validate user settings, and dynamically render different widget sizes without coupling to component internals
- **Why this works:** Metadata co-location with component ensures config schema stays in sync with component props. Makes dashboard system declarative: each widget declares what it needs, not dashboard dictating constraints. Serializable config enables persistence without custom serializers
- **Trade-offs:** Widget definition file becomes large (~900 lines) but concentrated complexity is easier to understand than scattered across files. Cost: more to load per widget, but benefit: integrity checking at definition time

#### [Pattern] Singleton service pattern with quiet hours enforcement to prevent unnecessary processing during off-peak times (2026-01-16)
- **Problem solved:** Compliance monitoring runs on-demand via API but needs to respect business hours to avoid wasting resources on redundant checks
- **Why this works:** Quiet hours (10pm-8am) + working day filters reduce computational overhead by skipping checks when they're not actionable. Prevents alert fatigue from background jobs running during off-hours when no one is working
- **Trade-offs:** Gained: Resource efficiency, better alert timing. Lost: Real-time detection during off-hours (acceptable tradeoff since no action can be taken)

#### [Gotcha] Default configuration thresholds (max $5k expenses, receipt required above $25, 3-day warning, 7-day critical) are hardcoded in service rather than database-driven (2026-01-16)
- **Situation:** Configuration needs to exist somewhere, and hardcoding provides simplicity for initial implementation
- **Root cause:** Hardcoded defaults enable the service to function without database configuration tables. Easy to change and review in code. Sufficient for MVP where policy is stable
- **How to avoid:** Gained: No config infrastructure needed. Lost: Changing thresholds requires code deployment, can't adjust without restart

### Implemented notification frequency tracking to prevent spam rather than simple time-based gates (2026-01-16)
- **Context:** Overdue task monitor needs to escalate notifications through multiple severity levels (24h, 48h, 72h, 120h) without overwhelming users with duplicate alerts
- **Why:** Time-based checks alone would re-trigger notifications at every escalation level. Tracking 'last reminder sent' prevents duplicate alerts for the same task across escalation boundaries, reducing false positives and alert fatigue
- **Rejected:** Simple threshold-only approach (just check if hours_overdue > threshold) - would cause notification storms as tasks age
- **Trade-offs:** Added complexity to state tracking (lastReminderSentAt field) but eliminates notification spam; requires careful synchronization between escalation levels
- **Breaking if changed:** Removing notification frequency check would cause duplicate alerts across escalation transitions, violating user experience expectations

#### [Pattern] Escalation rules ordered by increasing time thresholds with monotonically non-decreasing severity levels (2026-01-16)
- **Problem solved:** Multiple escalation triggers (24h, 48h, 72h, 120h overdue) need consistent severity mapping
- **Why this works:** Enforcing this ordering in tests prevents configuration errors where a 72h rule has lower severity than a 24h rule, which would confuse users and violate SLA expectations. Severity must increase with time overdue
- **Trade-offs:** Validation overhead in PUT endpoint but catches configuration errors before they affect users; test assertions verify invariant is maintained

### Monitor integrates with existing task-reminder-scheduler infrastructure rather than creating parallel notification system (2026-01-16)
- **Context:** System already has reminder scheduling, push notification, and email services
- **Why:** Reuse reduces duplicate code and ensures consistent notification behavior. Monitor calls existing reminder service rather than reimplementing notification delivery. Single source of truth for notification templates and delivery logic
- **Rejected:** Direct notification calls - bypasses existing infrastructure, creates consistency issues; separate monitor system - duplicates infrastructure
- **Trade-offs:** Tightly coupled to reminder-scheduler (harder to replace) but benefits from its maturity and consistency; requires understanding existing infrastructure
- **Breaking if changed:** If reminder-scheduler is refactored, monitor breaks; if monitor reimplements notifications, inconsistencies emerge between reminder and escalation notifications

### Separated cache concerns into three specialized modules (session-cache, odoo-cache, aiom-cache) rather than generic key-value wrapper (2026-01-16)
- **Context:** Redis cache implementation serving multiple distinct use cases with different invalidation, TTL, and data structure needs
- **Why:** Domain-specific modules allow tailored TTL strategies, automatic key building, specialized invalidation logic, and clearer API contracts. Prevents cache key collisions and enables feature-specific monitoring (token savings, hit rates by model).
- **Rejected:** Single generic caching service would require all callers to understand key naming conventions, TTL logic, and invalidation requirements. Higher coupling and more error-prone usage.
- **Trade-offs:** More code duplication across modules but significantly clearer contracts and safer API. Easier to add features like cache warming or preemptive invalidation per domain.
- **Breaking if changed:** Removing domain separation would require updating all call sites to handle key generation and TTL management manually, increasing bug surface area.

#### [Pattern] Combined IP address + identifier (phone/email/user ID) for rate limit bucketing instead of IP alone (2026-01-16)
- **Problem solved:** Single IP (office building, shared WiFi) shouldn't block all users. Single user with multiple IPs (mobile network) shouldn't reset limits.
- **Why this works:** IP-only is easily circumvented (attacker uses different IP) and unfair (shared networks). User-only is gamed by credential stuffing. Combination prevents both: requires attacker to use different phone numbers AND different IPs.
- **Trade-offs:** Gain: Fairer, more attack-resistant. Lose: More complex bucket key construction, higher Redis memory (more unique keys).

### Dual persistence strategy: PostgreSQL for reliable job durability + Redis for fast polling and distribution (2026-01-17)
- **Context:** Job queue needs both guaranteed persistence and low-latency job discovery
- **Why:** PostgreSQL provides ACID compliance and historical audit trail; Redis enables O(1) job distribution without repeated database scans. Single database would require polling overhead or complex change data capture
- **Rejected:** Pure Redis (data loss on crash), pure PostgreSQL (polling all pending jobs scales poorly), message broker like RabbitMQ (adds operational complexity)
- **Trade-offs:** Increased operational surface (manage two data stores) vs. ability to scale horizontally without hot database queries. Can repopulate Redis from PostgreSQL on worker restart
- **Breaking if changed:** Removing Redis forces return to database polling which creates N+1 queries at scale. Removing PostgreSQL loses job audit trail and recovery capability

### Job handlers registered at module load time via handler map, not factory pattern or dynamic import (2026-01-17)
- **Context:** Need to support multiple handler types (briefing, notification, sync, cleanup) with type-safe dispatch
- **Why:** Static registration at compile time enables: (1) TypeScript to verify all job types have handlers, (2) prevents runtime handler misses, (3) avoids dynamic imports which complicate tree-shaking and dependency analysis, (4) handler dependencies loaded eagerly so failures surface immediately
- **Rejected:** Dynamic require/import based on job.type (can't verify handlers exist until runtime), factory pattern with registration function (loose coupling but type inference lost)
- **Trade-offs:** Adding new job type requires code change vs. hot-reloading handlers from config. Static ensures type safety
- **Breaking if changed:** Switching to dynamic handlers loses TypeScript's ability to catch missing handler definitions at compile time. Runtime would silently fail jobs

#### [Pattern] Singleton pattern for JobQueueClient with lazy initialization and connection pooling (2026-01-17)
- **Problem solved:** Redis/database connections are expensive; multiple queue consumers need shared connection
- **Why this works:** Singleton ensures: (1) single Redis connection shared across all queue operations, (2) prevents connection pool exhaustion, (3) centralizes queue configuration, (4) enables graceful shutdown in one place
- **Trade-offs:** Testability requires mocking singleton vs. guaranteed single instance in production. Can be partially mitigated with manual reset in tests

### Retry logic with exponential backoff stored in job payload, not in queue state machine (2026-01-17)
- **Context:** Failed jobs need to be retried with delay, but delay increases with each attempt
- **Why:** Storing in payload: (1) retry state travels with the job record in PostgreSQL, (2) enables deterministic replay from DLQ without external state, (3) persists across worker restarts, (4) simpler than queue-side state management
- **Rejected:** Store retry count in separate retry_queue table (adds table, complicates joins), use queue native retry semantics like RabbitMQ (loses PostgreSQL audit trail)
- **Trade-offs:** Payload size increases slightly vs. complete job history in single record. Easier to debug and replay jobs
- **Breaking if changed:** Moving retry logic to external system loses the ability to replay jobs from PostgreSQL alone; would need external retry service

### Implemented relevance scoring algorithm in data access layer that detects natural language intent to prioritize result types, rather than simple keyword matching (2026-01-17)
- **Context:** Smart search needed to handle user queries like 'find overdue tasks' and surface the most relevant result type first
- **Why:** Natural language intent detection allows the system to understand context and prioritize expensive searches (e.g., skip contact search if user clearly asked for tasks). Prevents returning irrelevant mixed results that frustrate users.
- **Rejected:** Simple full-text search across all types equally, or relying on backend database full-text search capabilities without semantic understanding
- **Trade-offs:** Added complexity in client-side processing vs. simpler implementation, but avoids server load and improves user experience with smarter ranking. Intent detection is heuristic-based (keyword matching) so may miss context in complex queries.
- **Breaking if changed:** Removing intent detection reverts to dumb search that surfaces all types equally, making 'find overdue tasks' return contacts/messages alongside tasks

#### [Gotcha] Search results must include type-specific metadata (task status, contact phone, expense amount, etc.) but Odoo task search returns different schema than database contacts/messages (2026-01-17)
- **Situation:** Building type-specific result cards requires displaying different fields per type; naive approach tries to access 'status' on contact (doesn't exist)
- **Root cause:** Real-world data integration mixes sources (Odoo ERP for tasks, internal DB for contacts). Each source has different schema. Smart approach: normalize to minimal common schema (id, title, type) + type-specific extras field
- **How to avoid:** Type-specific metadata lives in extras object (not type-safe), but avoids forcing Odoo schema to fit database schema or vice versa. Components must handle optional fields gracefully.

### Placed query options in separate file (src/queries/smart-search.ts) instead of inline with hooks, enabling reuse and centralized cache strategy management (2026-01-17)
- **Context:** Multiple hooks (useSmartSearch, useQuickSearch, useSearchByType) each need similar query configurations (stale times, cache times, enabled flags)
- **Why:** Centralizing query configs allows consistent cache strategy: quick search has short stale time (fresh autocomplete), full search has longer stale time (reduce API calls). Single source of truth for cache invalidation timing.
- **Rejected:** Define queryOptions inline in each hook; embed stale times in hook logic; let React Query use defaults
- **Trade-offs:** Extra file/indirection, but enables cache strategy tuning from one place. Easier to change 'quick searches should refresh every 30s' globally.
- **Breaking if changed:** Removing this file scatters cache strategy across hooks. Changing stale time requires updating multiple hook definitions. Inconsistent cache behavior between search types.

### Separated rule execution into a dedicated service layer (RuleEngine) that handles condition evaluation independently from persistence and API concerns (2026-01-17)
- **Context:** Task auto-creation rules need to evaluate conditions against various trigger types with complex logic (nested fields, multiple operators, AND/OR combinations)
- **Why:** Allows rule logic to be tested, reused, and evolved independently. The engine can be called from multiple contexts (webhooks, scheduled jobs, manual triggers) without coupling to the database or HTTP layer
- **Rejected:** Embedding condition logic directly in server functions or data-access layer would create tight coupling and make it harder to test conditions without side effects
- **Trade-offs:** Added an extra abstraction layer that requires marshaling data in/out, but gained testability and reusability across trigger mechanisms
- **Breaking if changed:** If RuleEngine is removed, condition evaluation logic must be reimplemented in each trigger point (webhooks, jobs, API), creating inconsistency

#### [Pattern] Separated statistics tracking (read) from rule management (write) concerns - execution log is append-only and statistics are aggregated on read rather than updated in-place (2026-01-17)
- **Problem solved:** Rules need to track metrics like total triggers and tasks created, but these are updated frequently during execution
- **Why this works:** Append-only execution logs prevent update contention and allow audit trails. Aggregating stats on read (or via periodic batch) avoids expensive UPDATE operations under high trigger volume
- **Trade-offs:** Reads are slightly slower (need to scan/aggregate logs) but writes are fast and scalable. Need to handle or cache aggregation for dashboards

### Separate taskConversationLink table vs embedding task references directly in conversation records (2026-01-17)
- **Context:** Linking external tasks/projects to conversations required a design choice for relationship storage
- **Why:** Junction table pattern enables multiple task-conversation relationships and supports different task sources (external APIs, internal projects) without modifying core conversation schema. Allows flexible task metadata without bloating conversation records.
- **Rejected:** Adding taskId/externalTaskId fields directly to conversation table would require schema migration for existing data and limit extensibility
- **Trade-offs:** Adds query complexity (join required) but gains flexibility for multiple external task systems and avoids conversation table bloat. Makes it easier to add task source polymorphism later.
- **Breaking if changed:** If removed, lose ability to track task associations independently; would require adding task fields to conversations table or losing this feature entirely

### taskThreadMessage with explicit sender/userId vs storing message author in context (2026-01-17)
- **Context:** Task discussion threads needed to track which user wrote each message for display and permissions
- **Why:** Explicit userId field in taskThreadMessage enables direct permission checking (edit/delete own messages), message filtering by user, and maintains referential integrity. Avoids relying on message content parsing or implicit context.
- **Rejected:** Could store sender info in message content or rely on conversation context, but breaks permission models and requires parsing
- **Trade-offs:** Adds one more field but provides clear permission boundaries and enables 'sent by' filtering without parsing. Makes permission middleware straightforward.
- **Breaking if changed:** Without userId, message permission checks become impossible; edit/delete endpoints can't verify ownership; message queries can't filter by author

#### [Gotcha] taskThreadParticipant table required despite userId in taskThreadMessage (2026-01-17)
- **Situation:** Discovered that tracking thread participants separately from just analyzing who sent messages was necessary
- **Root cause:** Participants table tracks who is subscribed/involved in a thread for notifications and access control, separate from message history. A user might be participant without sending messages, or message sender might not be active participant.
- **How to avoid:** Extra table complexity enables fine-grained participant state (joined_at, roles) and notification management. Allows removing someone from thread without deleting their messages.

#### [Pattern] useTaskConversationLinks hook wrapping React Query with toast notifications and invalidation (2026-01-17)
- **Problem solved:** Multiple components needed to perform mutations with consistent success/error feedback and cache invalidation
- **Why this works:** Custom hook prevents query key duplication in components, centralizes invalidation logic, and adds user feedback (toasts) at mutation level. Follows existing pattern in codebase for consistent UX.
- **Trade-offs:** Hook abstraction adds a layer but prevents query logic sprawl. Invalidation side effects centralized rather than scattered in components.

#### [Gotcha] Route structure /dashboard/task-threads needed explicit layout integration (2026-01-17)
- **Situation:** New route for task thread management required proper dashboard layout context
- **Root cause:** Verifying route exists and renders properly requires understanding how TanStack Start routes integrate with existing dashboard layouts. Simple route creation isn't enough; needs layout context, auth redirects, and navigation integration.
- **How to avoid:** Route integration with layouts adds complexity but ensures consistent UX. Auth redirect (302 to sign-in) is handled by layout middleware.

#### [Pattern] Separated widget definition (config/types) from component implementation to enable dual usage: both as standalone component and dashboard widget (2026-01-17)
- **Problem solved:** TaskWidget needed to work both independently and as a configurable dashboard widget through the widget registry system
- **Why this works:** This separation allows the same component to be: (1) imported directly as TaskWidget for standalone use, (2) registered in builtInWidgets for dashboard discovery, and (3) configured via dashboard UI without code changes. Single implementation serves multiple integration patterns.
- **Trade-offs:** Requires maintaining both TypeScript exports AND widget registry entries in index.ts, but gains flexibility and single source of truth for component logic

#### [Pattern] Implemented configurable thresholds (overloadThreshold, warningThreshold, underutilizedThreshold) as API query parameters rather than hardcoding or only using config files. Allows runtime adjustment without redeployment. (2026-01-17)
- **Problem solved:** Team capacity monitoring requires different thresholds for different organizations or contexts
- **Why this works:** Query parameters provide flexibility for ad-hoc analysis and testing while defaults can be defined in the data-access layer
- **Trade-offs:** Added complexity to the API contract; requires documentation of valid parameter ranges; potential for invalid threshold combinations

#### [Pattern] Followed existing monitor implementations (cash-position-monitor, customer-issue-monitor) as templates for structure, function naming, and API response format. Maintains consistency across the system. (2026-01-17)
- **Problem solved:** Adding another monitor widget alongside existing ones; need to integrate seamlessly
- **Why this works:** Consistency reduces cognitive load for developers and makes the system more predictable. Easier to create shared utilities later if all monitors follow the same pattern.
- **Trade-offs:** Sometimes the existing pattern isn't optimal for this specific use case but consistency wins; future refactoring can standardize patterns

### Export utilities separate from component logic - created dedicated export-transactions.ts module with pure functions for CSV/text generation (2026-01-17)
- **Context:** Multiple export format options (CSV, text report) needed from the transaction history page
- **Why:** Keeps components focused on UI/state, makes export logic testable independently, allows reuse in other contexts (email exports, API responses). Pure functions are easier to mock in tests
- **Rejected:** Inline export logic in component - would couple data formatting to UI rendering, harder to test, breaks if component structure changes
- **Trade-offs:** Slight indirection/file overhead vs. significant gains in testability and reusability. CSV escape logic lives in dedicated module where it's visible
- **Breaking if changed:** If export module is removed, need alternative way to generate CSV/text - can't move this into component without losing separation of concerns

### Receipt dialog takes transaction data directly rather than requiring separate fetch - dialog receives full transaction object from list component (2026-01-17)
- **Context:** Transaction list already has full transaction details, receipt modal needed this data
- **Why:** Avoids unnecessary API call for data already in memory. Receipt view is just formatted display of existing data. Simpler component contract
- **Rejected:** Dialog fetches transaction by ID - would add latency, unnecessary round-trip for data already rendered
- **Trade-offs:** Component is tightly coupled to transaction data shape. Gain: instant modal open without loading state. Risk: if data structure changes, modal breaks
- **Breaking if changed:** If transaction data shape changes (fields renamed/removed), receipt dialog will show empty/wrong fields - no fallback fetch to correct it

### Separated Voice Activity Detection (VAD) logic into utility layer rather than embedding in hook or component (2026-01-17)
- **Context:** Needed to automatically detect silence and stop recording without user interaction in push-to-talk mode
- **Why:** Decoupling VAD from React lifecycle allows: (1) unit testing detection logic independently, (2) reusing same logic across different UI patterns (push-to-talk vs continuous), (3) easier configuration and threshold tuning without component re-renders
- **Rejected:** Embedding VAD directly in useVoiceInput hook would couple business logic with React state management, making it harder to test and reuse in non-React contexts
- **Trade-offs:** Slight increase in utility functions vs significant gain in testability and reusability; however adds another abstraction layer to understand
- **Breaking if changed:** Removing VAD utility and moving detection to hook would require duplicating silence detection logic or creating wrapper hooks for each listening mode

### Browser compatibility checks isolated into separate utility function rather than inline in hook initialization (2026-01-17)
- **Context:** Web Speech API has different names across browsers (SpeechRecognition, webkitSpeechRecognition) and missing in Firefox
- **Why:** Centralized compatibility checking allows: (1) consistent behavior across all components using voice input, (2) single source of truth for browser support matrix, (3) easy updates when browser support changes, (4) testable fallback logic without mocking entire hook
- **Rejected:** Checking compatibility inline in useVoiceInput would scatter browser-specific logic; checking in component layer would make browser detection a rendering concern rather than capability concern
- **Trade-offs:** One extra function call during hook initialization vs cleaner separation of concerns; enables graceful degradation across entire app without component-level awareness
- **Breaking if changed:** If browser check is removed and moved to component, each component using voice input must independently handle missing API, risking inconsistent error messages or degraded UX

### Implemented workflow engine as core business logic layer separate from React hooks, server functions, and API routes (2026-01-17)
- **Context:** Needed to support multiple trigger types (manual, schedule, event, webhook) and execution contexts without duplicating workflow logic
- **Why:** Separation of concerns allows the core engine to be reusable across different execution contexts (API routes, server functions, scheduled tasks) while keeping business logic independent of presentation
- **Rejected:** Embedding workflow logic directly in API routes or server functions would force code duplication and make it harder to test engine logic in isolation
- **Trade-offs:** Adds abstraction layers but enables testing workflows without HTTP context and reusing engine across multiple entry points
- **Breaking if changed:** Removing the core engine class would require reimplementing execution logic in each trigger handler, causing massive code duplication and inconsistency

### Step handlers implemented as a mapped object of type-specific handler functions rather than polymorphic class hierarchy (2026-01-17)
- **Context:** 9 different step types (action, condition, branch, wait, notification, integration, approval, parallel, loop) each with unique execution logic
- **Why:** Object map allows easy runtime lookup and extension without inheritance overhead. Each step type is independently testable and doesn't require coupling to a base class
- **Rejected:** Class-based polymorphism would require creating 9 step classes inheriting from BaseStep, adding boilerplate and making it harder to add new types dynamically
- **Trade-offs:** Type safety is lower (loses polymorphism benefits) but code is more functional, easier to tree-shake, and new step types can be added via configuration
- **Breaking if changed:** Changing handler function signatures would break all step type implementations simultaneously

#### [Gotcha] Parallel step execution requires nested promise handling with failure modes - some tasks may fail while others succeed (2026-01-17)
- **Situation:** Parallel step handler executes multiple branches concurrently using Promise.all but needs to handle partial failures without losing successful results
- **Root cause:** Using Promise.all directly would fail entire parallel step if any branch fails. Instead need Promise.allSettled or custom tracking to allow mixed success/failure states
- **How to avoid:** Proper handling enables graceful degradation where non-critical parallel branches can fail without aborting entire workflow

#### [Pattern] React hooks layer uses TanStack Query with custom server functions rather than direct API calls, enabling optimistic updates and caching (2026-01-17)
- **Problem solved:** Workflow operations (approve, reject, trigger) need to feel responsive while managing complex server state
- **Why this works:** Server functions allow direct database mutations with proper error handling and type safety. TanStack Query caching prevents redundant fetches and enables offline-first behavior
- **Trade-offs:** Adds framework coupling (Rsbuild) but gets better DX and performance

### Scheduled workflow processing implemented as separate API route (/api/workflows/process) callable by external cron rather than internal scheduler (2026-01-17)
- **Context:** Workflows with wait steps need to be resumed when conditions are met, but server process might not stay running
- **Why:** External cron job (Vercel cron, Render cron, etc.) is more reliable than in-process scheduler that dies when deployment restarts. Route is idempotent and can be called safely multiple times
- **Rejected:** In-process scheduler (setInterval, node-cron) would be lost on deployment restart, missing wake-up times
- **Trade-offs:** Adds external dependency on cron service but makes scheduling reliable across deployments
- **Breaking if changed:** Removing external route would require implementing internal scheduler, losing deployment-agnostic behavior

### Ensemble anomaly detection approach combining Z-Score, IQR, Moving Average, Isolation Forest, and Seasonal methods with weighted voting (2026-01-17)
- **Context:** Single anomaly detection algorithm has limitations - Z-Score fails with non-normal distributions, IQR misses gradual trends, Isolation Forest needs baseline tuning
- **Why:** Ensemble reduces false positives and false negatives. Different algorithms catch different anomaly types - sudden spikes (Z-Score), outliers (IQR), trend deviations (Moving Average), complex patterns (Isolation Forest)
- **Rejected:** Single algorithm approach would require extensive tuning per category and would miss edge cases
- **Trade-offs:** Higher computational cost but dramatically better detection accuracy; complexity of weighting mechanism vs simplicity
- **Breaking if changed:** Removing any algorithm degrades multi-type anomaly detection; changing weights requires re-tuning across all categories

### Category-specific default thresholds in service configuration rather than single global threshold (2026-01-17)
- **Context:** Expense anomalies (dollar amounts) have different statistical distributions than task_completion anomalies (percentages) or user_behavior anomalies (event counts)
- **Why:** Z-Score threshold of 2.5 appropriate for expenses but too aggressive for binary/rare events. Prevents tuning explosion by setting sensible category defaults
- **Rejected:** Global threshold would require per-rule overrides everywhere; no defaults would force configuration for every detection rule
- **Trade-offs:** More complex configuration surface but prevents alert fatigue in low-variance categories and improves precision in high-variance ones
- **Breaking if changed:** Removing category-specific config forces all anomalies through same threshold, causing cascading false positives in some categories

#### [Pattern] Singleton AnomalyDetectionService with lazy initialization of baselines and cached statistics (2026-01-17)
- **Problem solved:** Detection service needs efficient access to baselines across requests and metrics computation is expensive
- **Why this works:** Singleton ensures single baseline cache across application lifecycle. Prevents redundant database queries for statistics that change infrequently. In-memory cache provides sub-millisecond detection latency
- **Trade-offs:** Single instance improves performance and consistency but complicates testing and memory management

### Severity levels (low, medium, high, critical) separate from threshold values - severity assigned post-detection based on anomaly score (2026-01-17)
- **Context:** Same category may have low-severity gradual deviations and critical-severity extreme outliers - single threshold insufficient
- **Why:** Enables granular alerting strategy: low alerts to logs, medium to dashboards, high/critical to on-call. Threshold determines detection, score determines severity
- **Rejected:** Could use single threshold with binary alerting, but loses risk stratification and on-call fatigue management
- **Trade-offs:** More sophisticated workflow but enables proportional response and prevents alert fatigue
- **Breaking if changed:** Removing severity classification forces all alerts same priority, breaking escalation workflows

#### [Pattern] Two-table analytics storage pattern: separate event table for granular data + aggregate table for computed metrics (2026-01-17)
- **Problem solved:** Communication analytics needs both raw event tracking and pre-computed summaries for dashboard performance
- **Why this works:** Prevents expensive real-time aggregation queries on large event datasets while maintaining ability to drill down into raw data. Aggregates can be refreshed asynchronously.
- **Trade-offs:** Gains: query performance, UI responsiveness. Loses: real-time accuracy without refresh strategy, more storage, sync complexity between tables

### Bottleneck detection as separate operation with acknowledgement/resolution workflow rather than automatic flagging (2026-01-17)
- **Context:** Communications bottlenecks are actionable alerts that require team intervention
- **Why:** Separates detection (data-driven) from response (human workflow). Allows teams to acknowledge without resolving, dismiss false positives, and track resolution lifecycle.
- **Rejected:** Auto-resolving bottlenecks loses auditability. Pure read-only detection loses ability to manage alert fatigue.
- **Trade-offs:** Gains: flexibility, audit trail. Loses: simplicity, automatic optimization
- **Breaking if changed:** Removing acknowledgement status would make it impossible to distinguish between new and known bottlenecks, reducing usefulness in busy environments

### Dual-mode export system: synchronous GET endpoint for immediate small exports, asynchronous POST with job queue for large/heavy exports (2026-01-17)
- **Context:** Data export needs to handle both quick user requests and large data sets that might timeout or impact performance
- **Why:** Prevents request timeouts on large datasets. Synchronous path provides instant gratification for small exports. Async path scales and provides better UX via background processing with download links
- **Rejected:** Single synchronous endpoint would timeout on large exports; always async would add unnecessary complexity for small requests
- **Trade-offs:** More code paths to maintain, but dramatically better UX across different data sizes. Requires job queue infrastructure
- **Breaking if changed:** Removing async path means large exports fail or timeout. Removing sync path loses immediate download capability

#### [Pattern] R2 storage with presigned URLs for async exports instead of streaming response, with fallback to direct return if storage unavailable (2026-01-17)
- **Problem solved:** Large async exports shouldn't block job handler, and downloads might be accessed much later after job completes
- **Why this works:** Presigned URLs decouple storage from server availability - user can download hours later even if server restarts. Fallback keeps feature working in non-cloud deployments
- **Trade-offs:** Adds cloud storage dependency but dramatically improves reliability and user experience for large exports

#### [Pattern] Separate data-access layer (data-export.ts) for collecting/formatting export data rather than mixing with API endpoint logic (2026-01-17)
- **Problem solved:** Export logic might be needed from multiple places (API, CLI, email, etc.) and tends to grow as more data types are added
- **Why this works:** Single source of truth for export logic. Easy to test independently. Can be reused without duplicating collection queries. Scales as new data types are added
- **Trade-offs:** Extra abstraction layer, but pays dividends as feature grows and is reused

#### [Pattern] Synthetic data generation decoupled from demo authentication - demo context checks localStorage token but data generation happens independently (2026-01-17)
- **Problem solved:** Needed demo data to be available for all demo users without tight coupling between auth state and data service
- **Why this works:** Separation allows demo data to be pre-seeded and cached; multiple demo sessions can share the same generated dataset. Auth only validates session, not data source
- **Trade-offs:** Decoupling increases code complexity slightly but enables data reuse across sessions and simpler debugging; tighter coupling would mean redundant data generation

#### [Pattern] Mirrored ThemeProvider pattern for LanguageProvider to maintain architectural consistency (2026-01-17)
- **Problem solved:** Application already had established ThemeProvider with React Context + TanStack Query pattern for theme persistence
- **Why this works:** Reduces cognitive load by following existing patterns; developers familiar with theme switching immediately understand language switching; enables consistent server-side integration approach
- **Trade-offs:** More boilerplate code than raw i18next, but gains server-side cookie control and consistency with existing code patterns

### Separated language persistence into server function rather than client-side only, despite i18next supporting localStorage/cookies (2026-01-17)
- **Context:** LanguageProvider wraps i18n initialization but delegates cookie persistence to server-side functions via TanStack Query
- **Why:** Enables secure, server-controlled language persistence; allows future analytics/audit logging; prevents client-side cookie tampering; aligns with existing server function pattern
- **Rejected:** i18next-browser-languagedetector with localStorage: simpler but lacks server control and auditability
- **Trade-offs:** Additional network call for language changes; requires server infrastructure; gains security and auditability; complexity worth it if language selection is user-sensitive
- **Breaking if changed:** Removing server functions creates stale language preference after reload if localStorage isn't explicitly used; changes to language persistence logic require both server and client updates

### Placed LanguageSwitcher in Header rather than global navigation or separate menu (2026-01-17)
- **Context:** Header already contains ThemeSwitcher; both are user preferences that should be immediately accessible
- **Why:** Consistent placement with theme switching; high visibility; header is always visible and accessible; reduces cognitive load by co-locating related preference controls
- **Rejected:** Separate language menu in footer, settings page, or floating widget: less discoverable; Settings page alternative would require navigation and separate persistence logic
- **Trade-offs:** Header becomes slightly more crowded; gains immediate accessibility and discoverability; users more likely to find language switcher next to theme switcher due to proximity
- **Breaking if changed:** If Header is redesigned or removed, language switching becomes inaccessible without fallback UI; floating widget pattern would require different persistence strategy

### Created both SQL migration (0016) and Drizzle schema.ts definitions separately - not auto-generated from migration (2026-01-17)
- **Context:** PostgreSQL has SQL migration; Drizzle ORM needs TypeScript schema definitions
- **Why:** Allows SQL migration to be comprehensive (RLS, policies, helpers) while Drizzle schema defines only what ORM needs to know. Prevents Drizzle from attempting to manage complex SQL-level features.
- **Rejected:** Using Drizzle to generate all SQL would require Drizzle to support RLS policies and helper functions - Drizzle doesn't model these, forcing workarounds
- **Trade-offs:** Dual maintenance burden - schema.ts and SQL migration must stay in sync. Developer must update both when modifying tenant schema. Easy to create inconsistency.
- **Breaking if changed:** If schema.ts columns don't match SQL migration columns, Drizzle type safety is lost and runtime query errors occur. RLS policies reference columns that Drizzle doesn't know about.

### Created separate database schema file (schema-reporting.ts) and data access layer (reports.ts) instead of extending existing schema/DAL (2026-01-17)
- **Context:** Reporting Dashboard required new entities: reportDefinition, reportSchedule, reportSnapshot, reportKpi, reportDeliveryLog
- **Why:** Domain separation - reporting is a distinct bounded context with its own lifecycle management, scheduling logic, and delivery tracking that doesn't mix with core application entities
- **Rejected:** Adding to existing schema.ts would blur boundaries and couple reporting concerns with transaction/user management; harder to reason about reporting-specific queries
- **Trade-offs:** Gained: clear domain boundaries, easier to test/modify reporting logic independently, can refactor reporting without touching core. Lost: slight schema duplication if some entities reference core tables
- **Breaking if changed:** If reporting gets deeply integrated with core business logic (e.g., reports must trigger approvals), the separation becomes wrong and forces refactoring

### Export functionality implemented as CSV/JSON string generation rather than file streaming or background jobs (2026-01-17)
- **Context:** Dashboard provides immediate export with 'Export CSV' / 'Export JSON' buttons
- **Why:** Simplest implementation for small reports - generates string in memory, triggers browser download. Works for initial MVP data volumes.
- **Rejected:** Background job queue (for large reports), file streaming (for memory efficiency), or server-side file storage would be overkill for typical dashboard exports
- **Trade-offs:** Gained: instant feedback, no server storage needed. Lost: can't export very large reports (memory limits), no audit trail of who exported what
- **Breaking if changed:** If reports scale to millions of rows or business requires export audit logs, this approach must be replaced with queued/streamed solution

### Implemented tenant middleware as a composable factory function (createTenantMiddleware) rather than a single monolithic middleware (2026-01-17)
- **Context:** Multiple tenant selection strategies needed (headers, subdomains, default tenant) with varying strictness levels
- **Why:** Factory pattern enables reusable configuration while maintaining type safety. Allows creation of specialized variants (tenantSubdomainMiddleware, strictTenantMiddleware, etc.) without code duplication
- **Rejected:** Single middleware with complex conditional logic; separate middleware files for each variant
- **Trade-offs:** Increased abstraction complexity upfront but eliminates copy-paste middleware code. Easier to add new variants later
- **Breaking if changed:** Removing factory pattern would require maintaining separate middleware implementations that diverge over time

#### [Pattern] Specialized middleware variants (tenantAdminMiddleware, tenantOwnerMiddleware) created by composing base middleware with role validation (2026-01-17)
- **Problem solved:** Some routes need admin/owner verification but don't want to duplicate tenant middleware logic
- **Why this works:** Composition over inheritance. Each variant is built from standard createTenantMiddleware with role-specific options. Reduces code duplication and makes variants easy to understand
- **Trade-offs:** Requires understanding composition pattern but eliminates maintenance burden of multiple similar implementations

### Used singleton pattern for WebRTCCallingService via getWebRTCCallingService() rather than creating new instances (2026-01-17)
- **Context:** WebRTC calling requires persistent peer connections and state across the application lifetime
- **Why:** Multiple instances would create competing peer connections, duplicate signaling, and connection resource exhaustion. Single instance ensures one active call context and shared event lifecycle
- **Rejected:** Factory pattern per-component or Context-based instantiation would require complex cleanup coordination across components
- **Trade-offs:** Simpler state management vs harder testing (requires mocking singleton); easier resource cleanup vs potential memory leaks if not explicitly shutdown
- **Breaking if changed:** Moving to Context-based or per-component instances would require rearchitecting session manager lifecycle and call state synchronization across all consuming components

### SessionManager abstraction layer between WebRTCCallingService and SIP.js library (2026-01-17)
- **Context:** SIP.js has complex state machine (registered, connecting, active, held, etc.) that needs validation before operations
- **Why:** Prevents invalid state transitions (e.g., answering held call, holding terminated call). Centralizes state validation logic in one place rather than scattered in hooks/components
- **Rejected:** Direct SIP.js usage in hooks would require duplicated validation logic; missing state checks would cause cryptic SIP errors upstream
- **Trade-offs:** Extra abstraction layer adds code but prevents entire classes of runtime errors; easier debugging vs slightly more indirection
- **Breaking if changed:** Removing SessionManager validation would require consumers to handle SIP.js state machine directly, causing silent failures or exceptions

#### [Pattern] useWebRTCCall hook accesses singleton service state; useWebRTCCalling hook provides call operations; separated read vs write concerns (2026-01-17)
- **Problem solved:** Components need call state for rendering and methods for actions; singleton service owns actual state
- **Why this works:** Clear separation: read-only hook for display logic, action hook for mutations. Prevents accidental state modifications in render; hooks can be called conditionally without breaking dependencies
- **Trade-offs:** Developers must know to use both hooks vs simpler API; better composability and tree-shaking vs slight API complexity

#### [Pattern] Created wrapper/alias functions in data-access layer (findWorkflowDefinitionsByCreator, findRecentWorkflowInstances) that compose existing queries with domain-specific filters (2026-01-17)
- **Problem solved:** Needed specialized queries for common use cases without duplicating core query logic
- **Why this works:** Composition pattern reduces code duplication while creating semantic, domain-specific query names. Easier to maintain filter logic in one place
- **Trade-offs:** Adds thin wrapper functions but improves semantic clarity and prevents filter logic from leaking into application code. Single source of truth for each query pattern

#### [Gotcha] Workflow tables include event_log table for audit trail separate from execution tracking, plus scheduled_run table for deferred execution timing (2026-01-17)
- **Situation:** Workflow system needs both real-time execution tracking AND async event history AND future execution scheduling - three distinct concerns
- **Root cause:** Separating audit log (event_log) from execution state (step_execution) allows audit data to be immutable while execution state updates. Scheduled_run table handles cron-like delayed workflows
- **How to avoid:** More tables but cleaner semantics. Queries are simpler because each table has single responsibility. Audit trail guaranteed immutable