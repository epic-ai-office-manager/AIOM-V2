# Phase 1 Company View - Operational Documentation

**Version**: 1.0
**Last Updated**: January 29, 2026
**Status**: Production Ready

---

## 1. Feature Scope (Phase 1)

### Frontend Route
- **URL**: `/dashboard/company-view`
- **Component**: `src/routes/dashboard/company-view.tsx`
- **Authentication**: Required (Better Auth session)
- **Tenant Context**: Required (via `useCurrentTenant` hook)

### Backend API
- **Endpoint**: `GET /api/company-view`
- **Implementation**: `src/routes/api/company-view.ts`
- **Method**: GET only (read-only)
- **Response Format**: JSON (see `src/types/companyView.ts`)

### Data Sources
- **Odoo Modules** (read-only):
  - `account.move` - Accounting/Invoices
  - `crm.lead` - CRM/Sales Leads
  - `project.task` - Project Tasks
  - `helpdesk.ticket` - Support Tickets
  - `product.product` - Inventory

### Refresh Behavior
- **Type**: Polling-based "real-time"
- **Interval**: 30 seconds (configurable via `recommendedPollIntervalMs` in response)
- **User Control**: Manual refresh button available
- **Cache TTL**: 30 seconds server-side

### Read-Only Guarantee
**Phase 1 Company View performs NO write operations to Odoo.**

All API calls use:
- `searchRead()` - Read records
- `searchCount()` - Count records
- No `create()`, `write()`, `unlink()` operations

---

## 2. Authentication & Tenant Model

### Session System
- **Provider**: Better Auth
- **Session Storage**: Cookie-based
- **Cookie Name**: `better-auth.session_token`
- **Session Validation**: Server-side via `auth.api.getSession()`

### Tenant Resolution

#### Server Function
- **Location**: `src/fn/current-tenant.ts`
- **Export**: `getCurrentTenantId()`
- **Method**: Server function (TanStack Start)
- **Flow**:
  1. Extract session token from cookie (`better-auth.session_token`)
  2. Validate session with Better Auth
  3. Query user's default tenant from `tenantMember` table (where `isDefault = true`)
  4. Return tenant ID, name, and any errors

#### Frontend Hook
- **Location**: `src/hooks/useCurrentTenant.ts`
- **Export**: `useCurrentTenant()`
- **Returns**:
  ```typescript
  {
    tenantId: string | null;
    tenantName: string | null;
    isLoading: boolean;
    error: string | null;
  }
  ```
- **Cache**: React Query with 5-minute stale time

#### Required Request Header
**All API calls to `/api/company-view` must include**:
```
x-tenant-id: <tenant-id>
```

### Access Control Matrix

| Scenario | HTTP Status | Behavior |
|----------|-------------|----------|
| **No session** | 401 Unauthorized | `{ error: "Unauthorized: Valid session required" }` |
| **No x-tenant-id header** | 400 Bad Request | `{ error: "Bad Request: x-tenant-id header required" }` |
| **Invalid tenant ID** | 400 Bad Request | `{ error: "Bad Request: Invalid tenant ID" }` |
| **Inactive tenant** | 403 Forbidden | `{ error: "Forbidden: Tenant is inactive" }` |
| **User not tenant member** | 403 Forbidden | `{ error: "Forbidden: User is not a member of this tenant" }` |
| **Valid access** | 200 OK | Returns `CompanyViewResponse` |

### Frontend Tenant States

The Company View page handles these tenant states:

1. **Loading**: `isLoading = true`
   - UI: Loading spinner with "Loading tenant information..."

2. **No Tenant**: `!tenantId && !isLoading`
   - UI: Warning card "No Tenant Available"
   - Message: "You don't have a default tenant set..."

3. **Tenant Available**: `tenantId && !isLoading`
   - UI: Fetch company view data
   - Query enabled: `enabled: !!tenantId`

4. **Error**: `error !== null`
   - UI: Error card with specific error message

---

## 3. Data Flow

### Request Flow Diagram

```
Browser (Frontend)
    ↓ useQuery({ queryKey: ["company-view", tenantId] })
    ↓ fetchCompanyView(tenantId)
    ↓
API Handler (/api/company-view)
    ↓ 1. Auth Check (Better Auth session)
    ↓ 2. Tenant Validation
    ↓ 3. Cache Check (30s TTL)
    ↓ 4. [Cache Miss] → Aggregator
    ↓
Aggregator (Parallel Execution)
    ↓ Promise.allSettled([
    ├─→ fetchAccountingSection() → Odoo account.move
    ├─→ fetchCrmSection() → Odoo crm.lead
    ├─→ fetchProjectsSection() → Odoo project.task
    ├─→ fetchHelpdeskSection() → Odoo helpdesk.ticket
    └─→ fetchInventorySection() → Odoo product.product
    ↓ ])
    ↓ Assemble CompanyViewResponse
    ↓ Store in Cache
    ↓
Response (JSON)
    ↓ Headers: X-Cache: HIT/MISS, Cache-Control: private, max-age=30
    ↓ Body: CompanyViewResponse
    ↓
Browser (Frontend)
    ↓ React Query cache update
    ↓ UI re-render with new data
```

### Per-Tenant Cache (30-Second TTL)

**Implementation**: In-memory Map
```typescript
const cache = new Map<string, CacheEntry>();
const TTL_MS = 30_000; // 30 seconds
```

**Cache Key**: Tenant ID

**Cache Entry**:
```typescript
{
  data: CompanyViewResponse,
  expiresAt: number  // Date.now() + TTL_MS
}
```

**Cache Operations**:
- `getCachedResponse(tenantId)`: Returns data if not expired, null otherwise
- `setCachedResponse(tenantId, data)`: Stores data with expiration timestamp
- Automatic cleanup: Expired entries removed on next access

**Cache Headers**:
- `X-Cache: HIT` - Response served from cache
- `X-Cache: MISS` - Fresh data fetched from Odoo
- `Cache-Control: private, max-age=30` - Client-side cache hint

### Section Parallelism

All 5 sections execute **in parallel** using `Promise.allSettled()`:

```typescript
const [accountingResult, crmResult, projectsResult, helpdeskResult, inventoryResult]
  = await Promise.allSettled([...])
```

**Rationale**:
- Minimize total response time (max of slowest section, not sum of all)
- Isolated failures (one slow section doesn't block others)
- Typical total time: 1-4 seconds (vs. 5-20s sequential)

### Timeout Protection (PM STEP 62.5)

**Per-Section Timeout**: 4 seconds
```typescript
const SECTION_TIMEOUT_MS = 4000;
```

Each section wrapped with timeout:
```typescript
withTimeout(fetchAccountingSection(), SECTION_TIMEOUT_MS, "accounting")
```

**Total Budget Timeout**: 6 seconds
```typescript
const TOTAL_BUDGET_MS = 6000;
```

Entire aggregation wrapped:
```typescript
await withTimeout(allSections, TOTAL_BUDGET_MS, "company-view aggregation")
```

**Timeout Behavior**:
- Section timeout → Section returns empty data with error in `errorsBySection`
- Total timeout → All incomplete sections fail, completed sections still return
- Frontend receives partial data + timeout errors

### Partial Failure Model

**Design Principle**: One failing section does NOT fail the entire response.

**Implementation**: `Promise.allSettled()` instead of `Promise.all()`

**Behavior**:
- Successful sections return data normally
- Failed sections return:
  - Empty arrays for table data
  - `null` for KPI values
  - Error object in `errorsBySection`

**Example**:
```json
{
  "kpis": {
    "openInvoicesCount": 5,      // ✓ Accounting OK
    "openLeadsCount": null,       // ✗ CRM failed
    "openTasksCount": 10          // ✓ Projects OK
  },
  "errorsBySection": {
    "crm": {
      "message": "crm timeout after 4000ms"
    }
  }
}
```

### Meaning of errorsBySection

**Location in Response**: `CompanyViewResponse.errorsBySection`

**Type**: `Partial<Record<CompanyViewSectionKey, SectionError>>`

**SectionError Structure**:
```typescript
{
  message: string;              // Human-readable error description
  isModuleMissing?: boolean;    // true if Odoo module not installed
  isAuthError?: boolean;        // true if Odoo authentication failed
}
```

**Error Categories**:

1. **Module Missing**
   ```json
   {
     "message": "Model crm.lead not found",
     "isModuleMissing": true
   }
   ```
   - **Cause**: Odoo module not installed (e.g., CRM, Helpdesk)
   - **User Impact**: Section shows "Module not available" message
   - **Resolution**: Install module in Odoo or accept missing data

2. **Timeout**
   ```json
   {
     "message": "projects timeout after 4000ms"
   }
   ```
   - **Cause**: Section exceeded 4-second timeout
   - **User Impact**: Section shows "Temporarily unavailable" message
   - **Resolution**: Auto-resolves on next refresh if Odoo responds faster

3. **Authentication**
   ```json
   {
     "message": "Odoo authentication failed",
     "isAuthError": true
   }
   ```
   - **Cause**: Invalid Odoo credentials or session expired
   - **User Impact**: Section shows "Connection error"
   - **Resolution**: Check Odoo credentials in environment variables

4. **Generic Errors**
   ```json
   {
     "message": "Failed to fetch accounting data"
   }
   ```
   - **Cause**: Network issues, Odoo server errors, database problems
   - **User Impact**: Section shows generic error message
   - **Resolution**: Check Odoo server health, network connectivity

**Frontend Handling**:
- Empty sections → Show "No data available" state
- Errors → Show inline error banner per section
- Response always returns 200 OK (errors are informational, not fatal)

---

## 4. Response Contract

### Type Definition
**Source**: `src/types/companyView.ts`

### Top-Level Structure
```typescript
interface CompanyViewResponse {
  tenantId: string;                    // Tenant ID from request header
  refreshedAt: string;                 // ISO 8601 timestamp of data fetch
  recommendedPollIntervalMs: number;   // Always 30000 (30 seconds)

  kpis: CompanyKpis;                   // Aggregated KPIs from all sections
  sections: {                          // Section-specific data
    accounting: AccountingSection;
    crm: CrmSection;
    projects: ProjectsSection;
    helpdesk: HelpdeskSection;
    inventory: InventorySection;
  };
  errorsBySection: Partial<Record<CompanyViewSectionKey, SectionError>>;
}
```

### KPI Block
```typescript
interface CompanyKpis {
  openInvoicesCount: number | null;      // Unpaid/partially paid invoices
  overdueInvoicesCount: number | null;   // Overdue invoices (past due date)
  openLeadsCount: number | null;         // Active CRM opportunities
  openTasksCount: number | null;         // Active project tasks
  openTicketsCount: number | null;       // Open helpdesk tickets
  lowStockItemsCount: number | null;     // Products below reorder point
}
```

**Critical Contract Rules**:

1. **KPIs May Be Null**
   - **When**: Section fails, times out, or module missing
   - **Frontend Must**: Handle null values gracefully
   - **Display**: Show "—" or "N/A" for null KPIs

2. **Sections Always Exist**
   - **Guarantee**: All 5 section objects present in every response
   - **Failed Sections**: Return empty arrays (`[]`)
   - **Frontend Can**: Always destructure `sections.accounting`, etc.

3. **Errors Are Informational, Not Fatal**
   - **HTTP Status**: Always 200 OK (unless auth/tenant validation fails)
   - **Error Reporting**: Via `errorsBySection` object
   - **User Experience**: Partial dashboard is better than complete failure

### Section Structures

#### Accounting Section
```typescript
interface AccountingSection {
  recentInvoices: Array<{
    id: string;                                          // Odoo record ID
    number: string;                                      // Invoice number (e.g., INV/2025/0001)
    partnerName: string;                                 // Customer name
    amountTotal: number;                                 // Total invoice amount
    currency: string;                                    // Currency code (e.g., USD)
    status: "draft" | "posted" | "paid" | "overdue" | "unknown";
    invoiceDate: string | null;                          // YYYY-MM-DD format
    dueDate: string | null;                              // YYYY-MM-DD format
  }>;
}
```
- **Limit**: 10 most recent invoices (ordered by `invoice_date desc`)
- **Filter**: `move_type` in `["out_invoice", "out_refund"]`, `state = "posted"`

#### CRM Section
```typescript
interface CrmSection {
  openLeads: Array<{
    id: string;
    name: string;                  // Lead/Opportunity name
    partnerName: string | null;    // Customer name (may be null for new leads)
    stageName: string | null;      // Sales stage (e.g., "Qualified", "Proposal")
    expectedRevenue: number | null;
    probability: number | null;    // Win probability (0-100)
  }>;
}
```
- **Limit**: 10 leads (ordered by `expected_revenue desc`)
- **Filter**: `type = "opportunity"`, `active = true`

#### Projects Section
```typescript
interface ProjectsSection {
  openTasks: Array<{
    id: string;
    name: string;                  // Task name
    projectName: string | null;    // Parent project name
    stageName: string | null;      // Task stage (e.g., "In Progress")
    assigneeName: string | null;   // Assigned user ID (not resolved to name)
    deadline: string | null;       // YYYY-MM-DD format
  }>;
}
```
- **Limit**: 10 tasks (ordered by `date_deadline asc` - soonest first)
- **Filter**: `active = true`

#### Helpdesk Section
```typescript
interface HelpdeskSection {
  openTickets: Array<{
    id: string;
    name: string;                  // Ticket subject
    partnerName: string | null;    // Customer name
    stageName: string | null;      // Ticket stage (e.g., "New", "In Progress")
    priority: string | null;       // Priority level (e.g., "high", "low")
  }>;
}
```
- **Limit**: 10 tickets (ordered by `priority desc, create_date desc`)
- **Filter**: `active = true`

#### Inventory Section
```typescript
interface InventorySection {
  lowStockItems: Array<{
    id: string;
    productName: string;           // Product display name
    qtyAvailable: number;          // Current stock quantity
    reorderMinQty: number | null;  // Minimum reorder quantity threshold
  }>;
}
```
- **Limit**: 10 products with lowest stock levels
- **Filter**: `type = "product"`, `active = true`, `qty_available < reordering_min_qty`

### Example Response

**Successful Response** (200 OK):
```json
{
  "tenantId": "tenant-abc-123",
  "refreshedAt": "2026-01-29T15:30:00.000Z",
  "recommendedPollIntervalMs": 30000,
  "kpis": {
    "openInvoicesCount": 12,
    "overdueInvoicesCount": 3,
    "openLeadsCount": 8,
    "openTasksCount": 24,
    "openTicketsCount": 5,
    "lowStockItemsCount": 2
  },
  "sections": {
    "accounting": {
      "recentInvoices": [
        {
          "id": "1234",
          "number": "INV/2026/0015",
          "partnerName": "Acme Corp",
          "amountTotal": 5000.00,
          "currency": "USD",
          "status": "posted",
          "invoiceDate": "2026-01-15",
          "dueDate": "2026-02-15"
        }
      ]
    },
    "crm": { "openLeads": [...] },
    "projects": { "openTasks": [...] },
    "helpdesk": { "openTickets": [...] },
    "inventory": { "lowStockItems": [...] }
  },
  "errorsBySection": {}
}
```

**Partial Failure Response** (200 OK):
```json
{
  "tenantId": "tenant-abc-123",
  "refreshedAt": "2026-01-29T15:30:00.000Z",
  "recommendedPollIntervalMs": 30000,
  "kpis": {
    "openInvoicesCount": 12,
    "overdueInvoicesCount": 3,
    "openLeadsCount": null,        // CRM failed
    "openTasksCount": 24,
    "openTicketsCount": null,      // Helpdesk failed
    "lowStockItemsCount": 2
  },
  "sections": {
    "accounting": { "recentInvoices": [...] },
    "crm": { "openLeads": [] },    // Empty due to error
    "projects": { "openTasks": [...] },
    "helpdesk": { "openTickets": [] },  // Empty due to error
    "inventory": { "lowStockItems": [...] }
  },
  "errorsBySection": {
    "crm": {
      "message": "Model crm.lead not found",
      "isModuleMissing": true
    },
    "helpdesk": {
      "message": "helpdesk timeout after 4000ms"
    }
  }
}
```

---

## 5. Caching Behavior

### In-Memory Cache Architecture

**Implementation**: JavaScript Map data structure
```typescript
const cache = new Map<string, CacheEntry>();
```

**Scope**: Per server instance (not shared across instances)

**Persistence**: Memory only (clears on server restart)

**Key**: Tenant ID (string)

**Value**: CacheEntry object
```typescript
{
  data: CompanyViewResponse,  // Full response object
  expiresAt: number           // Unix timestamp (ms) when cache expires
}
```

### Cache Lifecycle

1. **Request Arrives**
   ```typescript
   const cached = getCachedResponse(tenantId);
   ```

2. **Cache Hit**
   - Entry exists AND `Date.now() <= entry.expiresAt`
   - Response served immediately (< 1ms latency)
   - Header: `X-Cache: HIT`
   - No Odoo calls made

3. **Cache Miss**
   - Entry doesn't exist OR expired (`Date.now() > entry.expiresAt`)
   - Fetch fresh data from Odoo (1-6 seconds)
   - Store in cache with new expiration
   - Header: `X-Cache: MISS`

4. **Cache Expiration**
   - TTL: 30 seconds (`TTL_MS = 30_000`)
   - Expired entries deleted on next access (lazy cleanup)
   - No background cleanup process

### Response Headers

**X-Cache Header**:
- `X-Cache: HIT` - Data served from cache (< 30s old)
- `X-Cache: MISS` - Fresh data fetched from Odoo

**Cache-Control Header**:
```
Cache-Control: private, max-age=30
```
- `private` - Response is user/tenant-specific (not publicly cacheable)
- `max-age=30` - Client (browser) may cache for 30 seconds

### Multi-Instance Deployment Implications

**Scenario**: Horizontal scaling with multiple server instances behind load balancer

**Issue**: Each instance has independent in-memory cache

**Impact**:
```
User Request 1 → Server A → Cache MISS → Fetch from Odoo → Cache on A
User Request 2 → Server B → Cache MISS → Fetch from Odoo → Cache on B
```
- Cache hit rate lower than single instance (split across instances)
- Increased Odoo load (N instances = N separate caches)
- No cache coherence between instances

**Current Behavior**: Acceptable for Phase 1
- TTL is short (30s), so staleness is minimal
- Odoo timeout protection prevents overload
- Most deployments use 1-2 instances

**Future Enhancement** (Not Phase 1):
- Shared cache (Redis, Memcached)
- Cache invalidation on Odoo webhook
- Server-sent events for real-time updates

### Cache Performance Characteristics

**Cache Hit Scenario**:
- **Latency**: < 1ms
- **Odoo Load**: 0 requests
- **Server CPU**: Minimal (memory lookup)

**Cache Miss Scenario**:
- **Latency**: 1-6 seconds (Odoo aggregation)
- **Odoo Load**: 5-10 XML-RPC calls
- **Server CPU**: Low (I/O bound)

**Expected Hit Rate**: 90%+ in production
- With 30s TTL and 30s frontend poll interval
- First request each 30s is MISS, subsequent requests are HITs

---

## 6. Failure Modes & What Users See

| Failure Type | HTTP Status | Backend Behavior | Frontend Display | User Action |
|--------------|-------------|------------------|------------------|-------------|
| **No session** | 401 | Return error object | Redirect to sign-in | Log in |
| **No x-tenant-id** | 400 | Return error object | Show error message | Contact admin |
| **Invalid tenant** | 400 | Return error object | Show error message | Contact admin |
| **Inactive tenant** | 403 | Return error object | Show error message | Contact admin |
| **Not tenant member** | 403 | Return error object | Show error message | Contact admin |
| **Odoo module missing** | 200 | Section empty + error | Section shows "Module not available" banner | Acceptable - partial data |
| **Section timeout** | 200 | Section empty + error | Section shows "Temporarily unavailable" banner | Wait for next refresh (30s) |
| **Odoo auth failure** | 200 | All sections fail | All sections show "Connection error" | Contact admin - check env vars |
| **Network error** | 200 | Affected sections fail | Sections show error banners | Transient - usually resolves |
| **Odoo server down** | 200 | All sections fail | All sections show errors | Check Odoo server status |
| **Total timeout (6s)** | 200 | All/most sections fail | Most sections show timeout | Wait - may resolve on retry |

### Detailed User Experience

#### 1. Module Missing (e.g., CRM not installed in Odoo)

**Backend**:
```json
{
  "sections": {
    "crm": { "openLeads": [] }
  },
  "kpis": {
    "openLeadsCount": null
  },
  "errorsBySection": {
    "crm": {
      "message": "Model crm.lead not found",
      "isModuleMissing": true
    }
  }
}
```

**Frontend**:
- CRM section shows warning banner:
  ```
  ⚠️ CRM Module Not Available
  The CRM module is not installed in your Odoo instance.
  Contact your administrator to enable CRM functionality.
  ```
- Other sections display normally
- KPI card shows "—" for `openLeadsCount`

**User Action**: None required - acceptable degraded state

#### 2. Section Timeout (e.g., Projects takes > 4 seconds)

**Backend**:
```json
{
  "sections": {
    "projects": { "openTasks": [] }
  },
  "kpis": {
    "openTasksCount": null
  },
  "errorsBySection": {
    "projects": {
      "message": "projects timeout after 4000ms"
    }
  }
}
```

**Frontend**:
- Projects section shows info banner:
  ```
  ℹ️ Projects Data Temporarily Unavailable
  The projects module is taking longer than usual to respond.
  Data will refresh automatically in 30 seconds.
  ```
- Refresh countdown timer visible
- Other sections display normally

**User Action**: Wait 30 seconds for auto-refresh (usually resolves)

#### 3. Authentication Failure (Invalid Odoo credentials)

**Backend**:
```json
{
  "sections": {
    "accounting": { "recentInvoices": [] },
    "crm": { "openLeads": [] },
    // All sections empty
  },
  "kpis": {
    "openInvoicesCount": null,
    // All KPIs null
  },
  "errorsBySection": {
    "accounting": { "message": "Authentication failed", "isAuthError": true },
    "crm": { "message": "Authentication failed", "isAuthError": true },
    // All sections have auth error
  }
}
```

**Frontend**:
- Global error banner at top of page:
  ```
  ❌ Connection Error
  Unable to connect to Odoo. Please contact your system administrator.
  Error: Authentication failed
  ```
- All sections show skeleton/empty state
- Manual refresh button disabled

**User Action**: Contact admin - environment variable issue

#### 4. Network Error (Odoo server unreachable)

**Backend**:
```json
{
  "errorsBySection": {
    "accounting": { "message": "Network error: ECONNREFUSED" },
    // Similar for all sections
  }
}
```

**Frontend**:
- Global error banner:
  ```
  ❌ Odoo Server Unreachable
  Cannot connect to Odoo server. This issue usually resolves automatically.
  Data will refresh in 30 seconds.
  ```
- All sections show empty state
- Auto-refresh countdown visible

**User Action**: Wait - usually transient network issue

#### 5. Frontend Tenant States

**Loading Tenant** (`isLoading = true`):
```
┌─────────────────────────────────────┐
│         Company View Dashboard      │
├─────────────────────────────────────┤
│                                     │
│          [Spinner Animation]        │
│   Loading tenant information...     │
│                                     │
└─────────────────────────────────────┘
```

**No Tenant** (`!tenantId && !isLoading`):
```
┌─────────────────────────────────────┐
│         Company View Dashboard      │
├─────────────────────────────────────┤
│  ⚠️ No Tenant Available              │
│                                     │
│  You don't have a default tenant   │
│  set. Please contact your          │
│  administrator or select a tenant  │
│  from your profile settings.       │
│                                     │
│  [Contact Admin]                   │
└─────────────────────────────────────┘
```

**Tenant Available** (`tenantId && !isLoading`):
```
┌─────────────────────────────────────┐
│    Company View - Acme Corp         │
├─────────────────────────────────────┤
│  [KPI Cards]                        │
│  [Section Tabs: Accounting, CRM...] │
│  [Data Tables]                      │
│                                     │
│  Last updated: 2 seconds ago        │
│  [Refresh] button                   │
└─────────────────────────────────────┘
```

---

## 7. Environment & Configuration Checklist

### Required Environment Variables

#### Database (PostgreSQL)
```bash
DATABASE_URL="postgresql://user:password@localhost:5432/aiom"
```
- **Used By**: Drizzle ORM, tenant membership queries
- **Format**: PostgreSQL connection string
- **Validation**: Must be valid URL with credentials

#### Better Auth
```bash
BETTER_AUTH_SECRET="<random-32+-char-string>"
VITE_BETTER_AUTH_URL="https://app.yourdomain.com"  # Production URL
```
- **BETTER_AUTH_SECRET**:
  - Minimum 32 characters
  - Used for session encryption
  - Generate: `openssl rand -base64 32`
- **VITE_BETTER_AUTH_URL**:
  - Public-facing application URL
  - Used for OAuth redirects
  - Optional (defaults to `http://localhost:3000` in dev)

#### Odoo Connection
```bash
ODOO_URL="https://odoo.yourdomain.com"
ODOO_DATABASE="production"
ODOO_USERNAME="api_user"
ODOO_PASSWORD="<secure-password>"
```
- **ODOO_URL**: Full URL to Odoo instance (with protocol)
- **ODOO_DATABASE**: Odoo database name
- **ODOO_USERNAME**: Odoo user with API access
  - Required permissions: Read access to all 5 modules
  - Recommended: Create dedicated API user with read-only role
- **ODOO_PASSWORD**: Odoo user password
  - Store securely (secrets manager recommended)

### Optional Environment Variables

```bash
NODE_ENV="production"  # or "development"
PORT="3000"            # Server port (default: 3000)
```

### Configuration Verification

**Pre-Deployment Checklist**:

- [ ] **Database Connection**
  ```bash
  # Test PostgreSQL connection
  psql "$DATABASE_URL" -c "SELECT 1;"
  ```

- [ ] **Better Auth Secret**
  ```bash
  # Verify length (should be 32+ characters)
  echo -n "$BETTER_AUTH_SECRET" | wc -c
  ```

- [ ] **Odoo Connection**
  ```bash
  # Test Odoo API (requires xmlrpc command or curl with XML-RPC)
  # Manual verification: Try to log in to Odoo web UI with credentials
  ```

- [ ] **Tenant Setup**
  ```sql
  -- Verify at least one tenant exists
  SELECT id, name, "isActive" FROM tenant;

  -- Verify user has default tenant
  SELECT tm.*, t.name as tenant_name
  FROM "tenantMember" tm
  JOIN tenant t ON tm."tenantId" = t.id
  WHERE tm."userId" = '<user-id>' AND tm."isDefault" = true;
  ```

- [ ] **Environment Variables Loaded**
  ```bash
  # Verify all required vars are set
  node -e "
    const required = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'ODOO_URL', 'ODOO_DATABASE', 'ODOO_USERNAME', 'ODOO_PASSWORD'];
    const missing = required.filter(v => !process.env[v]);
    if (missing.length > 0) {
      console.error('Missing:', missing.join(', '));
      process.exit(1);
    }
    console.log('All required environment variables set ✓');
  "
  ```

### Build Commands

#### Development
```bash
# Start development server with hot reload
npm run dev
```
- **Port**: 3000 (default)
- **Access**: http://localhost:3000
- **Features**: Hot module replacement, source maps

#### Production Build
```bash
# Build for production
npm run build
```
- **Output**: `.output/` directory
- **Duration**: ~20-30 seconds
- **Artifacts**:
  - Client bundle: `.output/public/assets/`
  - SSR bundle: `.output/server/`
  - Nitro server: `.output/server/index.mjs`

#### Production Start
```bash
# Start production server
npm run start
# OR
node .output/server/index.mjs
```
- **Port**: 3000 (default, set via PORT env var)
- **Process Manager**: Recommended (PM2, systemd)

### Health Check Endpoint

**Endpoint**: `GET /api/monitoring/system-health`

**Response**:
```json
{
  "status": "pass" | "degraded" | "fail",
  "timestamp": "2026-01-29T15:30:00.000Z",
  "database": { "status": "pass" },
  "odoo": { "status": "pass" | "fail" }
}
```

**Use**: Load balancer health checks, monitoring systems

### Deployment Verification Steps

1. **Build Validation**
   ```bash
   npm run build
   # Verify: No errors, exit code 0
   ```

2. **Test Suite**
   ```bash
   npm test
   # Verify: All tests pass
   ```

3. **Start Server**
   ```bash
   npm run start &
   SERVER_PID=$!
   sleep 5  # Wait for startup
   ```

4. **Health Check**
   ```bash
   curl http://localhost:3000/api/monitoring/system-health
   # Verify: {"status":"pass"}
   ```

5. **Company View Endpoint (requires auth)**
   ```bash
   # Manual verification: Log in to UI, navigate to /dashboard/company-view
   # Verify: Page loads, data displays or appropriate errors shown
   ```

6. **Cleanup**
   ```bash
   kill $SERVER_PID
   ```

---

## 8. Read-Only Guarantee

### Explicit Statement

**Phase 1 Company View performs NO write operations to Odoo.**

All interactions with Odoo are read-only queries.

### Implementation Evidence

**File**: `src/routes/api/company-view.ts`

**Odoo Methods Used** (all read-only):
- `client.searchRead(model, domain, options)` - Query records
- `client.searchCount(model, domain)` - Count records

**Odoo Methods NOT Used** (write operations):
- ❌ `client.create(model, values)` - Create records
- ❌ `client.write(model, ids, values)` - Update records
- ❌ `client.unlink(model, ids)` - Delete records

### Data Operations Summary

| Section | Odoo Model | Operation | Records Limit |
|---------|------------|-----------|---------------|
| Accounting | `account.move` | `searchRead` | 10 |
| Accounting | `account.move` | `searchCount` | N/A |
| CRM | `crm.lead` | `searchRead` | 10 |
| CRM | `crm.lead` | `searchCount` | N/A |
| Projects | `project.task` | `searchRead` | 10 |
| Projects | `project.task` | `searchCount` | N/A |
| Helpdesk | `helpdesk.ticket` | `searchRead` | 10 |
| Helpdesk | `helpdesk.ticket` | `searchCount` | N/A |
| Inventory | `product.product` | `searchRead` | 100 (filtered to 10) |

**Total Odoo Calls Per Request**: 9-10 read operations (cached for 30 seconds)

### User Permissions

**Recommended Odoo User Role**: Read-only API user

**Required Permissions**:
- `account.move`: Read
- `crm.lead`: Read
- `project.task`: Read
- `helpdesk.ticket`: Read
- `product.product`: Read

**Not Required**:
- Write permissions on any model
- Administrative access
- User management permissions

### Audit Trail

**Phase 1 Company View does not create audit records in Odoo.**

However:
- Application-level logging captures all API requests
- Better Auth logs authentication events
- Server logs record request timestamps and user IDs

**Recommendation**: Monitor server logs for Company View usage patterns.

---

## Appendix A: Response Size Estimates

**Typical Response Size**:
- **With full data**: 15-50 KB (JSON)
- **With errors**: 5-15 KB (JSON)
- **Gzipped**: 3-10 KB (compression ratio ~5:1)

**Network Transfer** (per 30-second poll):
- **Cache HIT**: < 1 KB (304 Not Modified or cached response)
- **Cache MISS**: 3-10 KB (gzipped JSON)

**Monthly Bandwidth** (per user, 8-hour workday):
- **Requests**: ~960 requests/month (1 every 30s for 8 hrs/day, 20 days/month)
- **Transfer**: ~3-10 MB/month (with cache hits)

---

## Appendix B: Monitoring Recommendations

### Key Metrics to Track

1. **Response Time**
   - **Target**: P95 < 2 seconds (cache miss), P95 < 100ms (cache hit)
   - **Alert**: P95 > 5 seconds

2. **Cache Hit Rate**
   - **Target**: > 85%
   - **Alert**: < 70%

3. **Section Timeout Rate**
   - **Target**: < 5% per section
   - **Alert**: > 10% per section

4. **Error Rate**
   - **Target**: < 2% of requests (excluding module missing errors)
   - **Alert**: > 5%

5. **Odoo Connection Health**
   - **Target**: 100% uptime
   - **Alert**: Connection failures > 1% of requests

### Log Patterns to Monitor

**Successful Request**:
```
[Company View] Cache hit for tenant <tenant-id>
```

**Cache Miss with Fresh Data**:
```
[Company View] Cache miss for tenant <tenant-id>, fetching data...
```

**Section Timeout**:
```
[Company View] Accounting section error: Error: accounting timeout after 4000ms
```

**Module Missing**:
```
[Company View] CRM section error: Error: Model crm.lead not found
```

**Auth Failure**:
```
[Company View] Unauthorized: Valid session required
```

---

## Appendix C: Troubleshooting Guide

### Issue: Page shows "Loading tenant information..." indefinitely

**Cause**: Frontend cannot resolve tenant ID

**Diagnosis**:
1. Check browser console for errors
2. Check Network tab for `/api/getCurrentTenantId` call
3. Check server logs for session/tenant errors

**Resolution**:
- Ensure user has authenticated session
- Verify user has default tenant in database:
  ```sql
  SELECT * FROM "tenantMember"
  WHERE "userId" = '<user-id>' AND "isDefault" = true;
  ```

### Issue: All sections show errors

**Cause**: Odoo connection failure

**Diagnosis**:
1. Test Odoo credentials: Try logging into Odoo web UI
2. Check server logs for Odoo connection errors
3. Verify `ODOO_URL`, `ODOO_DATABASE`, `ODOO_USERNAME`, `ODOO_PASSWORD`

**Resolution**:
- Verify Odoo server is reachable from application server
- Check firewall rules allow XML-RPC traffic (port 8069 or 443)
- Verify Odoo credentials are correct

### Issue: Specific section always times out

**Cause**: Odoo module performance issue

**Diagnosis**:
1. Check which section times out in `errorsBySection`
2. Check Odoo server load and database performance
3. Test specific Odoo model query performance in Odoo UI

**Resolution**:
- Optimize Odoo database (VACUUM, REINDEX)
- Review Odoo module custom code for performance issues
- Consider increasing `SECTION_TIMEOUT_MS` (requires code change)

### Issue: Cache hit rate very low

**Cause**: Multiple server instances or frequent restarts

**Diagnosis**:
1. Check `X-Cache` header distribution (should be >85% HIT)
2. Check server uptime and restart frequency
3. Verify load balancer sticky session configuration

**Resolution**:
- Enable sticky sessions on load balancer (route same tenant to same instance)
- Reduce server restart frequency
- Consider shared cache (Redis) for multi-instance deployments (future enhancement)

---

## Document Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-29 | Claude Code | Initial go-live documentation for Phase 1 Company View |

---

**End of Phase 1 Company View Operational Documentation**
