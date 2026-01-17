---
tags: [security]
summary: security implementation decisions and patterns
relevantTo: [security]
importance: 0.7
relatedFiles: []
usageStats:
  loaded: 2
  referenced: 1
  successfulFeatures: 1
---
# security

### CallRecordWithUser type includes only minimal user info (id, name, email, image) in joined queries (2026-01-16)
- **Context:** Call records reference users and sometimes need to display user information alongside call data
- **Why:** Limiting user fields in relations prevents accidentally exposing sensitive user data (password, auth tokens, settings) when querying call records. The fields included are presentation-safe.
- **Rejected:** Could have included full User type, but this creates information disclosure risk if call record queries are cached, logged, or returned in error cases
- **Trade-offs:** Requires creating a minimal user type projection, but guarantees security by design - data that's not there can't be leaked
- **Breaking if changed:** If the relation includes sensitive fields and they're logged/cached, data exposure becomes a compliance issue; removing fields later requires auditing all usage

#### [Pattern] All server functions wrapped with authenticatedMiddleware and per-resource authorization checks (2026-01-16)
- **Problem solved:** Ensuring users can only access their own briefings across read/write/version operations
- **Why this works:** Two-layer protection: authentication validates identity, authorization validates briefing belongs to user. Prevents horizontal privilege escalation if identity validation fails.
- **Trade-offs:** Slightly more verbose (redundant userId checks) but eliminates class of privilege escalation bugs. Defensive duplication.

#### [Gotcha] XML-RPC fault responses must parse value content with explicit type casting to prevent information disclosure (2026-01-16)
- **Situation:** When Odoo returns an error, it's wrapped in XML-RPC fault structure with nested value element
- **Root cause:** The fix added type assertion `as unknown as XmlRpcFault` to safely parse fault structures. Without explicit parsing, unvalidated fault content could be treated as trusted, exposing internal Odoo error messages or SQL errors to the client without sanitization.
- **How to avoid:** Type assertion is less elegant but forces conscious decision to parse fault data; prevents accidental information leakage

#### [Gotcha] VAPID keys must be URL-safe base64 (with - and _ instead of + and /) but atob() expects standard base64 (2026-01-16)
- **Situation:** Test initially failed because VAPID key test string wasn't valid standard base64
- **Root cause:** VAPID keys are encoded as URL-safe base64 per WebPush spec to avoid encoding issues in URLs/tokens. Browser's atob() expects standard base64, requiring conversion before decoding.
- **How to avoid:** Extra conversion step (padding + character replacement) is small price for spec compliance and reduced encoding bugs

### API key stored only in server-side config (ANTHROPIC_API_KEY in privateEnv), never exposed to client-side hooks (2026-01-16)
- **Context:** Claude API client requires auth but client-side code cannot safely hold credentials. Server functions act as secure gateway.
- **Why:** Private environment variables are only readable on server. Client-side React hooks receive data, never credentials. Prevents API key exposure in network traffic or browser storage.
- **Rejected:** Storing API key in public env file or passing through client code - creates credential exposure vulnerability.
- **Trade-offs:** Requires routing all Claude calls through server functions as RPC layer instead of direct client calls. Adds latency/abstraction but provides essential security boundary.
- **Breaking if changed:** If privateEnv check is removed and key is moved to public env, credentials become exposed in browser network inspector and potentially logged.

#### [Pattern] Using request-scoped request_id for error correlation and tracing, attached to request.state in middleware (2026-01-16)
- **Problem solved:** Mobile API needs to correlate client requests with server errors for debugging and support purposes
- **Why this works:** Attaching ID to request.state makes it available throughout request lifecycle (middleware, handlers, exception handlers) without passing as parameter; enables end-to-end tracing
- **Trade-offs:** Early ID generation in middleware ensures availability everywhere but adds overhead to every request; enables better debugging but requires clients to read header for correlation

#### [Gotcha] Exposing exception details in error responses only when debug=True; requires careful environment configuration (2026-01-16)
- **Situation:** Production API exposed sensitive error details accidentally in error responses
- **Root cause:** Debug details help developers but expose internal implementation; conditional exposure based on debug flag prevents information leakage while maintaining debuggability in dev
- **How to avoid:** Better security in production vs harder to debug when debug=False; requires correct environment configuration or security exposure

#### [Gotcha] User cannot approve their own expense requests - validation happens server-side in approveExpenseRequestFn, not client-side (2026-01-16)
- **Situation:** Approval workflow could theoretically allow self-approval if only client-side checking existed
- **Root cause:** Server-side validation ensures security cannot be bypassed by client manipulation. Client-side UI can hide buttons, but server must enforce business rules
- **How to avoid:** Easier: protection against manipulation. Harder: requires backend enforcement in addition to UI feedback

### File upload validation happens only on client-side (MIME type checks) with no server-side validation mentioned in implementation (2026-01-16)
- **Context:** Form validates receiptUrl format but file upload only checks MIME types client-side before uploading to storage service.
- **Why:** Assumed storage service handles security (virus scanning, file type validation). Client validation improves UX by catching invalid files before upload attempts.
- **Rejected:** Skipping file validation entirely - would allow binary or malicious files to be uploaded
- **Trade-offs:** Lighter client code but security relies entirely on storage service's server-side validation. Client validation can be trivially bypassed.
- **Breaking if changed:** If storage service is compromised or bypassed, no server-side validation exists to prevent malicious file uploads to expense requests

### Variable values validated before rendering; type-checked against schema defined in template (2026-01-16)
- **Context:** Template variables could contain malicious content or wrong types; Handlebars rendering could be exploited
- **Why:** Prevents injection attacks through variables. Type validation prevents logic errors (string into number). Validation happens before rendering so bad data never reaches Claude API.
- **Rejected:** No validation would trust user input and template authors. Validation at API call time is too late (bad data already in prompt).
- **Trade-offs:** Validation overhead on every render, but negligible since it's in-memory. More work for template authors to define types.
- **Breaking if changed:** Removing validation allows injection attacks. Variables could execute arbitrary Handlebars code.

### Approval chain validation at application layer rather than database constraints (2026-01-16)
- **Context:** Need to validate current user is next approver in chain; chain varies per voucher; database permissions cannot express 'next in queue' concept
- **Why:** Database constraints cannot evaluate JSON array position against current user; business logic belongs in application; enables conditional approval rules (delegation, substitute approvers) without schema changes
- **Rejected:** Trigger-based validation - cannot check user context; would be opaque to developers; would break if approval chain format changes
- **Trade-offs:** Requires trusting application layer to enforce; no database-level enforcement if application bypassed; approval logic scattered across validation functions
- **Breaking if changed:** Removing application validation allows unauthorized approvals; creates audit trail corruption; GL posting happens for unapproved vouchers

### Tool execution timeout is configurable per-call via toolContext.timeoutMs but has no global default enforced at registry level (2026-01-16)
- **Context:** Registry needs to protect against runaway tool executions but tools have different performance characteristics
- **Why:** Configurable timeout lets legitimate slow tools work while preventing abuse. Caller decides timeout based on context - not one-size-fits-all
- **Rejected:** Could enforce global max timeout but that breaks legitimate long-running tools. Could have no timeout but risks resource exhaustion
- **Trade-offs:** Flexibility requires caller discipline - bad caller could set infinite timeout. No safety net at registry level
- **Breaking if changed:** If timeout enforcement is removed entirely, malicious/broken tools can hang the system indefinitely

#### [Gotcha] Simple base64 encoding (btoa/atob) used instead of encryption in localStorage for mobile credentials (2026-01-16)
- **Situation:** Implementation uses 'Simple encryption like the module does' but btoa is encoding not encryption - credentials are recoverable from browser DevTools
- **Root cause:** Matching existing codebase pattern for consistency, but this is a security compromise. Real encryption requires WebCrypto API which adds complexity.
- **How to avoid:** Simple implementation vs compromised security; works in test environments vs fails security audits; no key rotation needed vs tokens readable in DevTools

### Channel and message data retrieved server-side through server functions rather than direct client-to-Odoo API calls (2026-01-16)
- **Context:** Need to access Odoo Discuss API which requires authentication and should not expose credentials to frontend
- **Why:** Server acts as authentication proxy - Odoo API key stored server-side only, never transmitted to client. Allows enforcing access control: users can only see channels they have permission for.
- **Rejected:** Direct client-side Odoo API calls - would require storing credentials in browser; OAuth directly from browser - unnecessary complexity
- **Trade-offs:** Adds network hop but gains security and access control. Server becomes critical path - if server is compromised, Odoo is compromised.
- **Breaking if changed:** Removing server-side proxy would require distributing Odoo credentials to clients, breaking security model

#### [Gotcha] Screen validation against hardcoded whitelist occurs AFTER URL parsing but BEFORE parameter extraction, allowing invalid screens to short-circuit work (2026-01-16)
- **Situation:** Malformed or malicious deep links could reference non-existent screens
- **Root cause:** Fail-fast pattern prevents building params for invalid navigation targets. Early validation avoids wasted parameter extraction for routes that don't exist
- **How to avoid:** Must maintain validation list in sync with actual navigable screens (currently 10 screens). Missing screen from list silently fails with 'Invalid screen' error - not immediately obvious which actual screen was attempted

### Applied authenticatedMiddleware consistently across all accounting server functions rather than implementing per-function auth (2026-01-16)
- **Context:** Financial data is sensitive; needed consistent auth enforcement across multiple endpoints
- **Why:** Middleware approach ensures auth cannot be accidentally bypassed by forgetting to add checks. It's a blanket security layer that automatically protects all functions in the layer
- **Rejected:** Individual auth checks in each function or relying on route-level protection alone
- **Trade-offs:** Less flexibility per endpoint (all endpoints require same auth type) but eliminates entire class of vulnerabilities where developers forget to add checks
- **Breaking if changed:** Removing middleware would expose all accounting data endpoints to unauthenticated requests. Adding endpoint-specific auth requirements would require rearchitecting the pattern

#### [Pattern] All server functions use authenticatedMiddleware to enforce user context validation, server functions don't receive userId as parameter - it comes from middleware (2026-01-16)
- **Problem solved:** Prevent privilege escalation where client could specify another user's ID in conversation operations
- **Why this works:** Middleware extracts auth from request headers (source of truth), functions can't bypass it. Client must trust server to use correct userId from auth context, not from function parameters.
- **Trade-offs:** Server functions have implicit dependency on middleware setup (harder to trace where userId comes from), but eliminates entire class of authorization bugs

#### [Pattern] All server functions require authenticatedMiddleware; no public partner queries exposed despite partner data being semi-public in many B2B contexts (2026-01-16)
- **Problem solved:** Odoo partner data includes financial details (credit limits, balances) and contact information potentially sensitive
- **Why this works:** Conservative approach - authentication prevents scraping and rate-limiting attacks. Can be selectively removed for truly public data if needed. Matches existing application patterns.
- **Trade-offs:** Authentication on all calls reduces performance slightly (middleware overhead) but prevents accidental data leaks. Easy to add public endpoints later.

### Onboarding session state tracked separately from authentication state - account_link endpoint requires separate auth check (2026-01-16)
- **Context:** OTP verification completes without auth, but SIP credential provisioning must verify user identity
- **Why:** Prevents unauthenticated users from claiming SIP credentials; session progression doesn't grant auth privileges
- **Rejected:** Treating OTP verification as auth step would bypass normal login flow
- **Trade-offs:** Easier: clear separation of concerns. Harder: two different state models (session vs auth)
- **Breaking if changed:** If removed, unauthenticated users could provision credentials by completing OTP flow

#### [Gotcha] Tool handlers use try-catch with retryable error flags but don't validate query parameters before passing to data-access functions (2026-01-16)
- **Situation:** Customer search takes 'city' parameter, vendor search takes filters - insufficient input validation at tool handler level
- **Root cause:** Validation assumed to happen in data-access layer, but tool handlers should validate LLM-provided parameters for safety and user feedback
- **How to avoid:** Adding validation here duplicates logic from data-access but catches errors earlier with better context for Claude

### Validate EXIF orientation before applying; sanitize file names; rely on uploadMediaFile for tenant isolation (2026-01-16)
- **Context:** EXIF data could theoretically contain malicious metadata; file uploads to shared storage bucket
- **Why:** EXIF parsing is narrow attack surface (only reads orientation tag); uploadMediaFile handles multitenancy and access control; avoids custom auth logic
- **Rejected:** Stripping all EXIF without validation; custom file path generation without tenant context
- **Trade-offs:** Minimal security overhead; delegating to existing upload utility reduces custom security code (good) but ties feature to that utility's maintenance
- **Breaking if changed:** If uploadMediaFile is removed, uploads bypass tenant isolation; if EXIF validation is removed, corrupted EXIF could cause rotation to fail silently

### SendTopupData includes optional senderPhone but doesn't validate it on client. Server function receives it but implementation details hidden. (2026-01-16)
- **Context:** Mobile top-up may require sender identification in some countries/operators.
- **Why:** Defers complex validation rules to server where operator requirements are known. Client passes through optional data; server determines if required.
- **Rejected:** Could implement comprehensive client-side validation, but operator requirements vary by country/region and aren't reliably available client-side.
- **Trade-offs:** Client doesn't know if field is required until server responds. Gain maintainability since validation is source-of-truth on server.
- **Breaking if changed:** Moving validation to client would mean duplicating operator requirement logic and creating sync issues if operator rules change.

#### [Gotcha] GL account selection hard-coded to range 6010-6999 without server-side validation (2026-01-16)
- **Situation:** Form restricts GL accounts to specific range via dropdown, but malicious actors could submit different GL codes via API
- **Root cause:** Client-side restriction improves UX by preventing invalid selections, but requires server-side validation in expense voucher creation endpoint
- **How to avoid:** Better UX (prevented invalid selections) but server endpoint MUST independently validate GL account is in allowed range

### Used AES-256-GCM instead of simple encryption or hashing for SIP credentials (2026-01-16)
- **Context:** SIP passwords need to be retrieved in plaintext for VoIP provisioning, so they cannot be hashed. Required authenticated encryption.
- **Why:** GCM provides both confidentiality (AES-256) and authentication (prevents tampering). IV is randomly generated per encryption ensuring semantic security - same plaintext produces different ciphertexts.
- **Rejected:** Simple AES-CBC would be deterministic and vulnerable to tampering. Hashing not viable since plaintext retrieval required. Simple XOR encryption insufficient for credentials.
- **Trade-offs:** GCM is slightly slower than CBC but provides authentication tag that detects tampering. Requires storing both IV and ciphertext.
- **Breaking if changed:** Switching to non-authenticated encryption would silently accept tampered credentials. Removing random IV would create identical ciphertexts for same password, exposing patterns.

#### [Gotcha] Environment variable key caching prevents repeated lookups but risks key leakage if process is compromised (2026-01-16)
- **Situation:** Implementation caches decrypted encryption key in module scope to avoid repeated process.env accesses during runtime.
- **Root cause:** Repeated env lookups are inefficient and the key is single per deployment. Caching improves performance significantly.
- **How to avoid:** Performance gain vs slightly increased memory footprint and key exposure window if process memory is inspected.

#### [Gotcha] GCM authentication tag only protects integrity after decryption, not before (2026-01-16)
- **Situation:** Test verified that tampering with ciphertext is detected, but verification happens at decrypt time, not at-rest.
- **Root cause:** GCM design: IV + ciphertext + auth_tag are concatenated. Tampering detection only occurs when attempting decryption with same key.
- **How to avoid:** Simpler implementation but tampering isn't detected until decrypt is attempted. No at-rest integrity monitoring.

#### [Gotcha] Password regeneration requires server sync to invalidate old passwords on FlexiSIP server, not just local password rotation (2026-01-16)
- **Situation:** User calls 'regenerate password' - old password must stop working immediately across all SIP clients
- **Root cause:** Local password change alone leaves old password valid on FlexiSIP server. Attackers with old password can still register. Server must reject old password actively.
- **How to avoid:** Server sync adds latency to password regeneration. If server is down, old password temporarily remains valid (until server comes online and receives sync).

#### [Pattern] Dual-role check pattern: verify both `role !== 'admin'` AND `!user.isAdmin` flag for redundant authorization (2026-01-16)
- **Problem solved:** Admin dashboard must verify user has admin permission through role-based or flag-based system
- **Why this works:** Handles both possible auth schema implementations (role-based vs flag-based), more defensive against data inconsistencies
- **Trade-offs:** Slightly more complex logic but survives auth schema migrations and handles legacy/new permission models simultaneously

#### [Pattern] All routes use external URL schemes (`tel:`, `mailto:`) for quick actions rather than backend callbacks. This delegates responsibility to OS/browser rather than creating new API endpoints. (2026-01-16)
- **Problem solved:** Mobile dashboard includes quick actions: call customer, email, navigate. Need to integrate phone/email without building custom APIs for these operations.
- **Why this works:** Mobile OS/browser handles tel: and mailto: natively with proper permission checks and user confirmation. Avoids building unnecessary backend infrastructure for OS-level operations. Users control which app opens (their preferred dialer, email client).
- **Trade-offs:** Simple and user-friendly but no server-side logging of calls/emails made. Acceptable since purpose is quick access, not audit trail.

### Call state machine stores only essential state in memory; sensitive information (SIP credentials, authentication tokens) are NOT persisted in CallStateManager but managed separately (2026-01-16)
- **Context:** Call state should be observable but credentials must never be accessible from call state object
- **Why:** Prevents accidental credential leakage through state inspection, logging, or debugging tools. Credentials managed in isolated config object
- **Rejected:** Storing credentials in call state or state manager would make them accessible wherever call state is used, violating principle of least privilege
- **Trade-offs:** Credentials managed separately requires different initialization path; slightly more complex setup; prevents entire class of credential exposure bugs
- **Breaking if changed:** If credentials were stored in observable call state, they could be logged, exposed in error messages, or accessed by unintended code

### All tools require 'user' permission level - same as financial tools, no specialized task-specific permissions (2026-01-16)
- **Context:** Authorization model needed for tool access control
- **Why:** Consistency with existing patterns. Task management is core functionality available to all authenticated users (like financial tools). Fine-grained permissions could be added at Odoo layer if needed.
- **Rejected:** No permissions (security risk), role-based permissions, task-specific resource permissions
- **Trade-offs:** Simpler model now but would need redesign if row-level security required later. All users get all task management tools.
- **Breaking if changed:** If permission level changed, would need to verify all consumers check new permission level before tool execution

### Validated sufficient availableBalance BEFORE transaction execution, not during, with explicit error codes (INSUFFICIENT_FUNDS, WALLET_FROZEN) (2026-01-16)
- **Context:** Preventing partial transaction execution where debit succeeds but subsequent business logic fails, leaving wallet in inconsistent state
- **Why:** Pre-validation gates the entire transaction block - if availableBalance is insufficient, the transaction never touches the database, ensuring all-or-nothing execution. Explicit error codes enable precise error handling without requiring exception inspection
- **Rejected:** Post-transaction validation would already have modified balances, requiring compensating transactions; relying on transaction rollback alone doesn't provide application-level clarity
- **Trade-offs:** Slightly more code (separate validation) vs atomic safety and clear error semantics
- **Breaking if changed:** Removing pre-validation would allow balance to go negative if validation logic is bypassed or timing window exists between check and database write

#### [Gotcha] Approval types are hardcoded enum (expense, time_off, purchase, document, general) rather than database-driven (2026-01-16)
- **Situation:** Feature implementation uses fixed set of approval categories
- **Root cause:** Type system safety - enum prevents invalid states at compile time. Reduces database queries for static data. Easier testing and validation.
- **How to avoid:** Easier: type safety, no runtime validation needed. Harder: adding new approval type requires code change + redeploy

#### [Gotcha] Test verification doesn't guarantee feature actually works, only that pages render and return HTTP 200/302. String matching tests pass even with redirects to sign-in page. (2026-01-16)
- **Situation:** Playwright tests check for strings like 'Country', 'Phone', 'Amount' but these assertions pass when redirected to authentication page if 'Email' or 'Sign in' is present.
- **Root cause:** String matching is too loose. Tests verify routes exist and return valid responses, but don't validate the actual feature functionality or component rendering.
- **How to avoid:** Permissive tests pass more often (good for CI/CD) but provide less confidence in actual feature implementation. More restrictive tests would require authenticated test setup.

### Store ipAddress, userAgent, sessionId, and requestId as separate queryable fields for security investigations (2026-01-16)
- **Context:** Security team needs to quickly find all actions from suspicious IP addresses or identify session compromise
- **Why:** Separate fields enable fast filtering (indexed queries) for security incident response. Keeping in metadata JSON only would require full table scan.
- **Rejected:** Store all request context in metadata JSON only - would make security incident investigation orders of magnitude slower
- **Trade-offs:** Slightly larger table but security queries (find all from IP X) execute in milliseconds vs seconds.
- **Breaking if changed:** If security context fields are moved to metadata-only, incident response capability degrades significantly

### API key authentication via environment variable for cron trigger instead of internal service-to-service authentication (2026-01-16)
- **Context:** Automated cron service needs permission to trigger reminder processing without being a user
- **Why:** Environment variable keeps key out of code while being accessible to deployment platform. Simpler than OAuth/mTLS for non-interactive service.
- **Rejected:** No authentication would allow anyone with endpoint URL to DOS reminder system; mTLS adds certificate management overhead for external cron services
- **Trade-offs:** Environment variable is easy to rotate but requires secure variable storage; vulnerable if environment is exposed
- **Breaking if changed:** Removing authentication allows arbitrary reminder processing; weak API key enables reminder DOS attacks

### SHA-256 checksums with chain linking (storing previousChecksum) for tamper detection (2026-01-16)
- **Context:** Logs must be tamper-evident; malicious admin could modify historical records post-hoc
- **Why:** Checksums detect modification. Chain linking (each record references previous) means changing one record requires recomputing all subsequent records - detectable. SHA-256 provides cryptographic strength
- **Rejected:** Single checksum per record allows silent modification; timestamps alone don't prevent reordering; unsigned logs have no integrity proof
- **Trade-offs:** Easier: detects tampering at read time without external witness. Harder: requires checksum field storage and computation overhead; doesn't prevent tampering, only detects it
- **Breaking if changed:** Without chain linking, admin could modify individual records undetectably. Without checksums, DB corruption or SQL injection could silently modify audit trails

### Implemented per-recording encryption keys derived from master key + recording metadata rather than single key for all recordings (2026-01-16)
- **Context:** Each recording needs encryption but storing 256-bit keys per recording in database is expensive; master key alone creates risk that single key compromise exposes all recordings
- **Why:** Key derivation using PBKDF2(masterKey, recordingId + timestamp) provides unique ciphertexts per recording with deterministic key generation - allows re-encryption without key table. Single point of key management (master key in env) with security benefit of key separation
- **Rejected:** Single master key for all - catastrophic single point of failure; Random key per recording stored in DB - scalability issue and additional secret management
- **Trade-offs:** Key derivation is deterministic so same recording encrypted twice produces same ciphertext (leaks frequency); but avoids storing keys and simplifies key rotation by only rotating master key
- **Breaking if changed:** If master key rotation is implemented without updating derivation function, existing recordings become unencryptable; the recording ID must never change or encrypted data becomes inaccessible

### Webhook signature validation using HMAC-SHA256 with secret from environment rather than public key or API key lookup (2026-01-16)
- **Context:** FusionPBX webhook events need authentication to ensure events come from legitimate FusionPBX instance, not attacker spoofing recording events
- **Why:** HMAC with pre-shared secret is simple and fast (no database lookup), standard for webhook verification (Stripe, GitHub, Twilio all use this). Secret can be rotated by redeploying environment
- **Rejected:** Public key verification - requires FusionPBX instance to have private key, adds complexity; API key lookup - requires database roundtrip per request
- **Trade-offs:** Secret in environment can be leaked if environment is exposed (but so can database credentials); rotating secret requires deployment; but no operational complexity
- **Breaking if changed:** If FUSIONPBX_WEBHOOK_SECRET is empty or wrong, all legitimate FusionPBX events will be rejected as unauthorized; if attacker learns secret, they can spoof events until secret is rotated

### Audit logging for all GL posting operations (post, reverse, status) at data-access layer rather than service layer (2026-01-16)
- **Context:** GL transactions are financial records requiring compliance trails. Logging location affects what gets recorded and ability to bypass audit.
- **Why:** Data-access layer is the enforcement point - logs can't be bypassed by different calling paths. Captures all database changes regardless of how they're initiated (direct service call, server function, future batch job).
- **Rejected:** Service-layer logging would miss direct DB mutations; application-layer logging could be skipped by error handlers
- **Trade-offs:** Easier: comprehensive audit coverage, hard to accidentally skip. Harder: audit logging code mixed with data access, harder to test in isolation
- **Breaking if changed:** If audit logging moved to higher layer, concurrent access paths could bypass logging; if removed entirely, no compliance trail for GL transactions

### Admin-only endpoints for all mutations (create/update/delete flags and targets), authenticated-only for read checks (2026-01-16)
- **Context:** Need to prevent unauthorized users from manipulating feature flags while allowing legitimate feature evaluation
- **Why:** Feature flags control product behavior and rollout—only administrators should modify them. Read access for authenticated users enables product to check flags server-side safely. Prevents non-admin users from enabling beta features for themselves
- **Rejected:** Allowing any authenticated user to manage flags creates security hole where users bypass rollout strategy. Allowing public read could leak unreleased features in responses
- **Trade-offs:** Requires separate auth middleware for mutations vs reads. Admin-only write prevents agile self-service but ensures release integrity
- **Breaking if changed:** If admin check is removed, unprivileged users can modify flags. If authenticated check removed from read functions, exposes feature roadmap

#### [Pattern] Zod validation on server functions for mutation inputs (2026-01-16)
- **Problem solved:** All server functions in expense-reconciliation.ts use Zod schemas before processing user inputs
- **Why this works:** Prevents malformed requests from reaching data layer; provides type safety for downstream code; enables consistent validation error responses
- **Trade-offs:** Small validation overhead per request, but eliminates entire class of data-corruption bugs from bad inputs

#### [Pattern] All KYC actions logged to kycVerificationHistory table with IP address, action type, status changes, and comment trail (2026-01-16)
- **Problem solved:** KYC is high-risk: document fraud, approval corruption, system abuse are concerns
- **Why this works:** Complete audit trail enables forensic analysis (who approved what, when, from where) and regulatory compliance. IP tracking helps identify suspicious approval patterns
- **Trade-offs:** Additional storage/queries but essential for compliance (SOC2, KYC regulations require auditability). Performance cost is acceptable given KYC approval frequency is low

### Server functions protected with authenticated middleware - OCR processing only for authenticated users (2026-01-16)
- **Context:** Receipt processing involves sensitive financial data and expensive API calls
- **Why:** Prevents API abuse (costly Claude Vision calls), ensures data privacy, enables per-user audit trail
- **Rejected:** Public OCR endpoint (would allow abuse and expose PII)
- **Trade-offs:** Requires auth context in all OCR handlers. Worth the security/cost protection
- **Breaking if changed:** Removing auth requirement exposes to API abuse and financial data privacy issues

### API key in Authorization header rather than URL parameter for triggering alert monitor (2026-01-16)
- **Context:** Service provides POST endpoint that triggers alert processing, needs protection from unauthorized triggering
- **Why:** API key in header keeps credential out of logs, URL params, referrer headers; matches existing security patterns in codebase
- **Rejected:** Query parameter ?apiKey=xxx - leaks in URLs, logs, browser history, and referrer headers when redirected
- **Trade-offs:** Slightly more secure vs slightly more complex client implementation
- **Breaking if changed:** Using query params exposes credentials in monitoring/logging systems; removes layer of protection

### All server functions protected with authentication middleware (verifyAuth) - no public-facing summary generation endpoint (2026-01-16)
- **Context:** Claude API calls are expensive ($0.01-0.03 per call) and sensitive callRecord data is accessed
- **Why:** Authentication prevents resource exhaustion attacks where malicious users generate unlimited summaries, driving up costs. Requiring auth links summaries to user identity for audit trails. The middleware is applied consistently across all 8 functions
- **Rejected:** Rate-limiting alone without auth - could still be exhausted by distributed attacks, and no audit trail of who generated summaries
- **Trade-offs:** Easier: Prevents abuse, audit trail. Harder: Requires active auth session, prevents public access if ever needed
- **Breaking if changed:** Removing auth would expose Claude API costs to unauthenticated attackers

#### [Pattern] Idempotency key generation for duplicate payment prevention (2026-01-16)
- **Problem solved:** QR payments are user-facing transactions that could be resubmitted due to network failures
- **Why this works:** Prevents accidental double-charges when payment requests are retried. Enables safe retry logic without business logic changes
- **Trade-offs:** Easier: safe retries, simple client code; Harder: requires idempotency key storage, request tracking, cache invalidation strategy

#### [Pattern] Merchant info and payer info stored within payment record with optional reference fields (2026-01-16)
- **Problem solved:** Need to know who created payment and who paid, but not always with foreign key constraints
- **Why this works:** Preserves payment immutability - captures state at creation time. Handles cases where merchant/user records might be deleted. Enables payments without hard user references
- **Trade-offs:** Easier: historical accuracy, data resilience; Harder: potential data duplication, must validate denormalized fields at write time

#### [Gotcha] Wallet status validation (frozen/suspended) happens in processQrPaymentFn, not just at wallet lookup (2026-01-16)
- **Situation:** Race condition: wallet status could change between validation and transaction execution in concurrent payments
- **Root cause:** Payment processing must re-validate wallet state immediately before deduction. Initial validation check is insufficient because status can change during async operations
- **How to avoid:** Requires additional database query per transaction but prevents frozen wallets from being charged. Cost of extra query is minimal vs risk of violating business rules

### Optional API key authentication with dev/prod mode distinction - endpoint accessible without auth in dev mode, requires Bearer token in production (2026-01-16)
- **Context:** Need to protect compliance monitoring endpoint in production while allowing local testing and development without configuration friction
- **Why:** Dev mode without auth enables rapid testing and CI/CD pipelines without secret management overhead. Production mode with optional API key (check at environment variable level) provides security without breaking backward compatibility for dev workflows
- **Rejected:** Always-require API key - breaks local development and testing pipelines. Always-allow without auth - leaves production endpoint vulnerable to external triggering
- **Trade-offs:** Gained: Frictionless dev experience. Lost: Must remember to set EXPENSE_COMPLIANCE_MONITOR_API_KEY in production (mitigated by environment-based config check)
- **Breaking if changed:** Removing the optional auth check would force API key setup in all environments, breaking existing CI/CD pipelines that don't manage secrets

### API endpoint requires environment variable API key in production but allows dev-mode access without authentication (2026-01-16)
- **Context:** Monitor must be callable by scheduled jobs but protected from unauthorized manual triggers in production
- **Why:** Development convenience (no auth setup) vs production safety. Missing API_KEY in prod environment acts as kill switch - endpoint becomes inaccessible. Allows deployment to work immediately in dev but fails safely in production until secured
- **Rejected:** Hard-coded dev bypass - too dangerous; optional auth - doesn't enforce security in production
- **Trade-offs:** Dev experience improved (works out of box) but requires explicit environment variable in production; missing config is a runtime failure, not a code review catch
- **Breaking if changed:** If auth check is removed, endpoint becomes publicly accessible; if no fallback for missing key, production deployments fail silently

#### [Gotcha] BarcodeDetector API (for QR scanning) not available in Firefox - requires fallback to manual code entry (2026-01-16)
- **Situation:** QR scanning feature relies on browser's BarcodeDetector which is Chrome/Edge only
- **Root cause:** This is a browser platform limitation, not a code issue. Graceful degradation ensures payment flow works universally
- **How to avoid:** Manual entry fallback is available but not as smooth UX. Cross-browser compatibility trade-off accepted for most users

### HTTPS requirement for getUserMedia (camera access) enforced by browser - localhost is exempt for development (2026-01-16)
- **Context:** Payment flow requires camera access which browsers only allow over HTTPS for security reasons
- **Why:** Prevents man-in-the-middle attacks on payment QR codes. This is a browser security policy, not application-level decision
- **Rejected:** HTTP payment flows - would be rejected by browser at getUserMedia call
- **Trade-offs:** Production deployment requires SSL/TLS. Development on localhost has special exemption, reducing friction
- **Breaking if changed:** Deploying payment flow on non-HTTPS production URL breaks camera functionality entirely

### Session cache includes explicit validation with timestamp + TTL expiry checks, separate from Redis TTL, to prevent token reuse after invalidation (2026-01-16)
- **Context:** Redis TTL alone insufficient - users logging out or permissions changing need immediate invalidation without waiting for TTL expiry
- **Why:** Dual-layer validation (Redis TTL + explicit checks) ensures invalidated sessions can't be served even if Redis entry accidentally persists. Timestamp comparison detects tampering or clock skew.
- **Rejected:** Relying solely on Redis TTL expiry is simpler but risks serving invalidated sessions if background invalidation fails or is delayed.
- **Trade-offs:** Adds per-request validation overhead (~1-2ms) but prevents security vulnerabilities. Validation is negligible compared to actual session usage.
- **Breaking if changed:** Removing explicit validation transforms invalidation from immediate to lazy (waiting for TTL), creating security window for compromised sessions.

### Implemented fail-open design for rate limiting - requests proceed even if Redis is unavailable (2026-01-16)
- **Context:** Rate limiting infrastructure can fail (Redis down, network issues). System must remain functional.
- **Why:** Availability > Rate Limiting. Blocking legitimate users due to infrastructure failure is worse than temporarily losing rate limit protection. Token bucket check wrapped in try-catch, returns true (allow) on error.
- **Rejected:** Fail-closed approach (block all requests if Redis down) - would cause cascading service unavailability
- **Trade-offs:** Gain: Graceful degradation, availability. Lose: Perfect rate limit enforcement during infrastructure issues. Requires monitoring to detect Redis failures.
- **Breaking if changed:** If changed to fail-closed, service becomes unavailable whenever Redis is down. If error handling removed, server crashes propagate to all endpoints.

### API key required for job management endpoints (enqueue, process, manage) but not for read-only status endpoint (2026-01-17)
- **Context:** Job enqueueing and processing are privileged operations; status checking is informational
- **Why:** Asymmetric security: (1) prevents unauthenticated users from filling queue with spam jobs, (2) status endpoint can be called frequently by dashboards/monitoring without auth overhead, (3) API key in header prevents CSRF on queue mutations, (4) monitoring and alerting can access status without special credentials
- **Rejected:** Protect all endpoints equally (status checks become expensive), protect nothing (DoS vector)
- **Trade-offs:** Status endpoint more accessible but can't trigger work vs. information is leaked to unauthenticated users. Acceptable since job stats are not sensitive
- **Breaking if changed:** Removing API key requirement from enqueue allows queue poisoning. Requiring it on status endpoint breaks external monitoring that doesn't have the key

#### [Gotcha] Odoo integration requires storing credentials (ODOO_USERNAME, ODOO_PASSWORD) in environment variables; search feature cannot work without these being configured (2026-01-17)
- **Situation:** Task search queries Odoo ERP directly; no fallback search method if Odoo is unavailable or misconfigured
- **Root cause:** Odoo is external system requiring authentication. Server function must authenticate with Odoo to fetch tasks. Missing creds = silent failure or error.
- **How to avoid:** Increases deployment complexity (env var management), but follows security best practice of not embedding secrets. Team must document required env vars.

#### [Gotcha] Server functions for rule management rely on caller's authentication context but don't explicitly validate that caller owns the rule - assumes calling layer enforces this (2026-01-17)
- **Situation:** Rules are user-specific but the data-access layer doesn't filter by current user context
- **Root cause:** The server function layer should enforce authorization, but implementation passes through to data-access without user_id checks
- **How to avoid:** Trusts calling layer (dashboard route) to enforce authorization. If dashboard auth is bypassed, rules become accessible to wrong users

### Microphone permission requests delegated entirely to browser's native permission system rather than implementing custom permission handling (2026-01-17)
- **Context:** Web Speech API requires user microphone access; component needs to request permission gracefully
- **Why:** Browser-native permission handling provides: (1) user-familiar permission UI (users know what's being asked), (2) automatic permission caching and persistence across sessions, (3) protection against phishing/spoofing (can't fake permission dialog), (4) consistent behavior with OS security model, (5) future compatibility if browser changes permission model
- **Rejected:** Custom permission tracking would be less secure (easier to spoof), less persistent (lost on page reload), and duplicative of browser capabilities
- **Trade-offs:** Less control over permission UX timing vs guaranteed secure, familiar, persistent permission handling
- **Breaking if changed:** If custom permission logic is added, it would create inconsistency with browser's permission model and lose automatic permission persistence

### Webhook triggers validated via secret comparison rather than bearer tokens, using crypto.timingSafeEqual to prevent timing attacks (2026-01-17)
- **Context:** External systems need to trigger workflows securely without maintaining authentication state
- **Why:** Webhook secrets are simpler to manage than bearer tokens for external integrations. Timing-safe comparison prevents attackers from using response time to guess secrets
- **Rejected:** Simple string equality check would be vulnerable to timing attacks
- **Trade-offs:** Slightly slower (constant-time comparison) but prevents timing attack vulnerability
- **Breaking if changed:** Removing timing-safe comparison introduces timing attack vector where attacker can guess secret byte-by-byte

#### [Gotcha] Isolation Forest implementation requires careful seed management for reproducibility across service restarts (2026-01-17)
- **Situation:** Isolation Forest uses random forests, so same metric value produces different anomaly scores across service instances without fixed seed
- **Root cause:** Non-deterministic scoring breaks alert deduplication and distributed tracing. Fixed seed ensures consistency but sacrifices randomness benefit of ensemble
- **How to avoid:** Deterministic scoring at cost of some ML randomness benefit; necessary for production consistency

#### [Gotcha] Data export handler must explicitly exclude sensitive authentication fields (passwords) even though they're in user model. This isn't automatic/implicit (2026-01-17)
- **Situation:** User data collection naturally includes all user model fields, but exporting auth credentials would be a security disaster
- **Root cause:** Prevents accidental credential exposure in user-initiated exports. Requires conscious decision about what's safe to export
- **How to avoid:** Must manually curate export schemas, but ensures security-by-design rather than security-by-accident

### Demo environment uses localStorage-based tokens with explicit demo mode branding/warnings rather than hiding the fact it's a sandbox (2026-01-17)
- **Context:** Needed to create safe sandbox environment without compromising security or deceiving users
- **Why:** Transparency is the primary security control here - users must never be confused about whether they're in demo or production. Token-based auth allows session isolation while branding ensures awareness
- **Rejected:** Using production auth flow with filtered data; obfuscating demo status in UI
- **Trade-offs:** Explicit demo branding may feel less 'production-like' but eliminates confusion risk; localStorage tokens are sufficient for demo since they're not production credentials
- **Breaking if changed:** Removing the prominent 'demo mode' notices defeats the entire security posture - users could mistake demo for production data

#### [Pattern] Browser language detection falls back through cookie → localStorage → navigator.language hierarchy (2026-01-17)
- **Problem solved:** Application needs to respect explicit user choice while providing sensible defaults for new users
- **Why this works:** Cookie (explicit choice) takes precedence over local storage (deprecated) over automatic detection; respects user agency while providing experience for first-time visitors
- **Trade-offs:** More detection logic to maintain; ensures explicit choice survives across browsers/devices if cookies work; localStorage fallback provided for migration/resilience

#### [Pattern] Created helper functions (get_current_tenant_id, is_tenant_member, is_tenant_admin) as RLS policy building blocks rather than embedding logic directly (2026-01-17)
- **Problem solved:** RLS policies need consistent tenant isolation logic applied to 90+ tables
- **Why this works:** Single source of truth for tenant validation. Reduces copy-paste errors in policies. Simplifies policy auditing and updates. Easier to add new policy types.
- **Trade-offs:** Adds function call overhead to every RLS check (minimal but measurable). Requires database upgrade compatibility. More indirection to follow when debugging policies.

#### [Gotcha] Reports visible only to admin, md, and sales roles - but tests verify route exists even before authentication check runs (2026-01-17)
- **Situation:** Tests pass because they accept '404 or less' OR 'Sign in prompt' as valid responses from /dashboard/reports
- **Root cause:** Route is open (redirects to login) but protected by middleware/component logic - tests verify route doesn't 404, not that access is denied
- **How to avoid:** Gained: simpler test setup (no auth required). Lost: verification that unauthorized users actually can't see reports (tests would pass even if permissions were removed)

#### [Gotcha] Cross-tenant access validation required at query level, not just middleware level - assertSameTenant utilities are essential (2026-01-17)
- **Situation:** Middleware sets tenant context, but if developer forgets to validate retrieved resource belongs to same tenant, cross-tenant leak occurs
- **Root cause:** Tenant ID in context is not cryptographic proof of access - it's developer-supplied. Resource could have been created in different tenant. Validation must happen when accessing existing resources
- **How to avoid:** Requires discipline from developers to call assertSameTenant. Caught by TypeScript helpers but not enforced. Alternative would be ORM-level tenant filtering (more overhead)

### Tenant member existence check required even when user has valid session - isUserTenantMember validation in middleware (2026-01-17)
- **Context:** User could have valid session but been removed from tenant after login, or tenant could be deleted
- **Why:** Session validity ≠ tenant access validity. User could be removed from tenant after login. Tenant could be deleted. Middleware must re-validate on every request to prevent stale access
- **Rejected:** Trusting session alone; only checking tenant existence
- **Trade-offs:** Additional database query per request. But critical security property - sessions are long-lived but tenant membership can change
- **Breaking if changed:** If tenant membership check removed, deprovisioned users could continue accessing tenant data for duration of their session

#### [Gotcha] Workflow approval table has multiple timestamp fields (requested_at, decided_at, due_at, notified_at) for different approval lifecycle events, not just single approval timestamp (2026-01-17)
- **Situation:** Initial implementation might assume single decision timestamp, but real workflow approvals need separate tracking of request, notification, due date, and decision times
- **Root cause:** Different lifecycle events require separate audit trails. Notifications may happen after request, decisions may come before/after due date. SLA tracking needs distinct due_at
- **How to avoid:** More fields to manage but vastly simpler queries for business logic like SLA tracking, reminders, and overdue detection