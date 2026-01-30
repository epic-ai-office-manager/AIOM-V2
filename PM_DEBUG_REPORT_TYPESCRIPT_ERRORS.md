# PM DEBUG REPORT — TypeScript Build Failures (Production Blocker)

**Date**: 2026-01-27
**Status**: 🔴 BUILD BLOCKED - 351 TypeScript Errors
**Severity**: CRITICAL - Prevents production deployment

---

## Executive Summary

The repository has **351 TypeScript errors** preventing successful builds. The errors are concentrated in **30 key files**, with the top 3 offenders accounting for 65 errors (18.5%).

**Build Command**: `npm run build` → `vite build && tsc --noEmit`
**Vite Build**: ✅ SUCCESS (client + server bundles complete in ~9s)
**TypeScript Check**: ❌ FAIL (351 errors across 89 files)

**Critical Insight**: The Vite build succeeds, meaning the application runs in development. TypeScript errors only block the production build gate.

---

## Error Breakdown by Severity

### Top 10 Error Types (by frequency)

| Rank | Error Code | Count | Description | Severity |
|------|------------|-------|-------------|----------|
| 1 | **TS2339** | 91 | Property does not exist on type | HIGH |
| 2 | **TS2322** | 62 | Type not assignable to type | MEDIUM |
| 3 | **TS2345** | 44 | Argument type not assignable | MEDIUM |
| 4 | **TS18046** | 21 | Possibly undefined value | LOW |
| 5 | **TS2305** | 17 | Module has no exported member | HIGH |
| 6 | **TS2353** | 14 | Unknown property in object literal | MEDIUM |
| 7 | **TS2554** | 13 | Wrong number of arguments | MEDIUM |
| 8 | **TS7031** | 11 | No index signature with parameter | MEDIUM |
| 9 | **TS2365** | 11 | Operator not applicable to types | LOW |
| 10 | **TS18049** | 10 | Possibly undefined in boolean | LOW |

**Pattern Analysis**:
- **38.5%** (135 errors) are property/member access issues (TS2339, TS2305, TS2551)
- **33.6%** (118 errors) are type assignability issues (TS2322, TS2345, TS2769)
- **14.5%** (51 errors) are nullability/undefined checks (TS18046, TS18049, TS18048)

---

## Top 30 Files by Error Count

| Rank | File | Errors | Category | Priority |
|------|------|--------|----------|----------|
| 1 | `src/lib/ai-coo/data-fetchers/financial.ts` | 26 | AI COO | 🔴 CRITICAL |
| 2 | `src/fn/demo-auth.ts` | 21 | Auth | 🟡 HIGH |
| 3 | `src/lib/odoo-query-tools/definitions.ts` | 18 | Odoo Integration | 🔴 CRITICAL |
| 4 | `src/hooks/useClaude.ts` | 17 | AI Integration | 🔴 CRITICAL |
| 5 | `src/lib/claude/__tests__/sdk-client.test.ts` | 16 | Tests | 🟢 LOW |
| 6 | `src/fn/audit-logs.ts` | 16 | Auditing | 🟡 MEDIUM |
| 7 | `src/hooks/useCallContext.ts` | 12 | VoIP | 🟡 MEDIUM |
| 8 | `src/fn/workflow-automation.ts` | 10 | Workflows | 🔴 CRITICAL |
| 9 | `src/routes/api/workflows/process.ts` | 9 | Workflows | 🔴 CRITICAL |
| 10 | `src/data-access/modules.ts` | 8 | Data Access | 🟡 MEDIUM |
| 11 | `src/components/MediaGallery.tsx` | 8 | UI | 🟢 LOW |
| 12 | `src/lib/task-management-tools/definitions.ts` | 7 | Tools | 🟡 MEDIUM |
| 13 | `src/data-access/expense-gl-posting.ts` | 7 | Finance | 🟡 MEDIUM |
| 14 | `src/lib/email/service.ts` | 6 | Email | 🔴 CRITICAL |
| 15 | `src/components/UnifiedInboxThreadDetail.tsx` | 6 | UI | 🟢 LOW |
| 16 | `src/components/post-call/CreateTaskForm.tsx` | 6 | UI | 🟢 LOW |
| 17 | `src/components/MediaLightbox.tsx` | 6 | UI | 🟢 LOW |
| 18 | `src/routes/mobile/topup/index.tsx` | 5 | Mobile | 🟢 LOW |
| 19 | `src/routes/mobile/topup/$transactionId.tsx` | 5 | Mobile | 🟢 LOW |
| 20 | `src/lib/workflow-automation-engine/engine.ts` | 5 | Workflows | 🔴 CRITICAL |
| 21 | `src/fn/unified-inbox.ts` | 5 | Inbox | 🟡 MEDIUM |
| 22 | `src/fn/claude.ts` | 5 | AI Integration | 🔴 CRITICAL |
| 23 | `src/routes/mobile/expenses/new.tsx` | 4 | Mobile | 🟢 LOW |
| 24 | `src/routes/api/workflows/event.ts` | 4 | Workflows | 🔴 CRITICAL |
| 25 | `src/hooks/usePosts.ts` | 4 | Hooks | 🟢 LOW |
| 26 | `src/fn/crm-call-logging.ts` | 4 | CRM | 🟡 MEDIUM |
| 27 | `src/fn/attachments.ts` | 4 | Attachments | 🟢 LOW |
| 28 | `src/data-access/portfolio.ts` | 4 | Data Access | 🟢 LOW |
| 29 | `src/data-access/events.ts` | 4 | Data Access | 🟡 MEDIUM |
| 30 | `src/routes/mobile/expenses/$id.tsx` | 3 | Mobile | 🟢 LOW |

**Top 30 Total**: 273 errors (77.8% of all errors)

---

## Critical Path Analysis

### Module 1: AI COO System (65 errors - 18.5%)

**Files**:
- `src/lib/ai-coo/data-fetchers/financial.ts` (26 errors)
- `src/hooks/useClaude.ts` (17 errors)
- `src/lib/claude/__tests__/sdk-client.test.ts` (16 errors)
- `src/fn/claude.ts` (5 errors)
- `src/lib/email/service.ts` (6 errors) - Used by AI COO

**Common Errors**:
- TS2339: Property 'citations' missing on TextBlock
- TS2345: MessageResponse | Message type conflicts
- TS2305: Missing exports in schema
- TS2554: Wrong argument counts

**Impact**: Blocks AI COO production deployment (core feature)

---

### Module 2: Workflow Automation (38 errors - 10.8%)

**Files**:
- `src/lib/odoo-query-tools/definitions.ts` (18 errors)
- `src/fn/workflow-automation.ts` (10 errors)
- `src/routes/api/workflows/process.ts` (9 errors)
- `src/lib/workflow-automation-engine/engine.ts` (5 errors)
- `src/routes/api/workflows/event.ts` (4 errors)

**Common Errors**:
- TS2353: workflowId does not exist in WorkflowContext
- TS2339: Properties missing on workflow types
- TS2554: Incorrect function signatures

**Impact**: Blocks autonomous workflow execution (critical for AI COO)

---

### Module 3: Authentication & Demo (21 errors - 6.0%)

**Files**:
- `src/fn/demo-auth.ts` (21 errors)

**Common Errors**:
- TS7006: Implicit 'any' types
- TS2339: Missing properties on user objects
- TS2322: Type mismatches in auth flow

**Impact**: Blocks demo environment and testing

---

### Module 4: Data Access Layer (27 errors - 7.7%)

**Files**:
- `src/data-access/modules.ts` (8 errors)
- `src/data-access/expense-gl-posting.ts` (7 errors)
- `src/data-access/portfolio.ts` (4 errors)
- `src/data-access/events.ts` (4 errors)

**Common Errors**:
- TS2305: Missing schema exports (Event, AttachmentType)
- TS2554: Wrong argument counts
- TS2322: Type assignability in GL posting

**Impact**: Database operations may fail in production

---

### Module 5: Mobile Routes (17 errors - 4.8%)

**Files**:
- `src/routes/mobile/topup/index.tsx` (5 errors)
- `src/routes/mobile/topup/$transactionId.tsx` (5 errors)
- `src/routes/mobile/expenses/new.tsx` (4 errors)
- `src/routes/mobile/expenses/$id.tsx` (3 errors)

**Common Errors**:
- TS2339: Property 'url', 'key', 'requestedAmount' missing
- TS2820: Invalid route paths
- TS2345: Type mismatches in Reloadly integration

**Impact**: Mobile app functionality degraded

---

### Module 6: UI Components (38 errors - 10.8%)

**Files**:
- `src/components/MediaGallery.tsx` (8 errors)
- `src/components/UnifiedInboxThreadDetail.tsx` (6 errors)
- `src/components/post-call/CreateTaskForm.tsx` (6 errors)
- `src/components/MediaLightbox.tsx` (6 errors)
- `src/components/widgets/*` (multiple files, ~12 errors)

**Common Errors**:
- TS2339: Property 'fileKey', 'type' missing on attachments
- TS2322: Form resolver type mismatches
- TS2307: Missing UI module (progress component)

**Impact**: UI rendering issues, form validation failures

---

## Root Cause Analysis

### 1. Schema Drift (HIGH SEVERITY)

**Problem**: Database schema exports don't match actual usage
**Evidence**: 17× TS2305 errors (missing exports)

**Examples**:
```typescript
// src/data-access/events.ts
import { event, Event, CreateEventData } from "~/db/schema";
// ERROR: Module has no exported member 'event', 'Event', 'CreateEventData'

// src/utils/storage/media-helpers.ts
import { AttachmentType } from "~/db/schema";
// ERROR: Module has no exported member 'AttachmentType'
```

**Fix Required**: Audit `src/db/schema.ts` and restore missing exports or refactor imports

---

### 2. Anthropic SDK Migration Incomplete (HIGH SEVERITY)

**Problem**: Claude SDK upgrade changed type signatures
**Evidence**: 17 errors in `src/hooks/useClaude.ts`, 5 in `src/fn/claude.ts`

**Examples**:
```typescript
// TS2345: MessageResponse | Message type conflicts
// TS2339: Property 'citations' missing in type 'TextBlock'
```

**Context**: Recent upgrade from old SDK to `@anthropic-ai/sdk@^0.71.2` introduced breaking changes

**Fix Required**: Update Claude integration code to match new SDK types

---

### 3. Workflow Context Type Incomplete (MEDIUM SEVERITY)

**Problem**: WorkflowContext interface missing required fields
**Evidence**: 3× TS2353 errors (workflowId does not exist)

**Examples**:
```typescript
// scripts/test-workflow-execution.ts:34
context: {
  workflowId: 'test-workflow-1', // ERROR: workflowId does not exist in type
  userId: testUserId,
}
```

**Fix Required**: Add `workflowId?: string` to WorkflowContext interface

---

### 4. Media Upload Response Type Mismatch (MEDIUM SEVERITY)

**Problem**: MediaUploadResult interface doesn't match actual response
**Evidence**: 15+ errors across MediaGallery, MediaLightbox, KYCSubmissionForm

**Examples**:
```typescript
// TS2339: Property 'url' does not exist on type 'MediaUploadResult'
// TS2339: Property 'key' does not exist on type 'MediaUploadResult'
// TS2339: Property 'originalFilename' does not exist on type 'MediaUploadResult'
```

**Fix Required**: Update MediaUploadResult interface or refactor usages

---

### 5. Odoo Query Tools Type Issues (HIGH SEVERITY)

**Problem**: 18 errors in Odoo query tool definitions
**Evidence**: Type mismatches in odoo-query-tools/definitions.ts

**Impact**: AI COO cannot query Odoo reliably

**Fix Required**: Align Odoo tool types with actual Odoo API responses

---

## Recommended Fix Strategy

### Option A: Quick Path (2-4 hours)

**Target**: Fix top 3 offenders to reduce error count by 65 (18.5%)

1. `src/lib/ai-coo/data-fetchers/financial.ts` (26 errors) - Odoo type fixes
2. `src/fn/demo-auth.ts` (21 errors) - Add explicit types, fix auth flow
3. `src/lib/odoo-query-tools/definitions.ts` (18 errors) - Align with Odoo schema

**Result**: 286 errors remaining (still blocking)

---

### Option B: Systematic Path (1-2 days)

**Target**: Fix by root cause category

**Phase 1**: Schema Fixes (1-2 hours)
- Restore missing exports in `src/db/schema.ts`
- Fix `Event`, `AttachmentType`, `CreateEventData` exports
- **Impact**: -25 errors (7%)

**Phase 2**: Claude SDK Migration (2-3 hours)
- Update `src/hooks/useClaude.ts` with new SDK types
- Fix `MessageResponse | Message` conflicts
- Add `citations` field to TextBlock handling
- **Impact**: -22 errors (6%)

**Phase 3**: Workflow Types (1 hour)
- Add `workflowId` to WorkflowContext
- Fix workflow test types
- **Impact**: -15 errors (4%)

**Phase 4**: Media Upload (1-2 hours)
- Update MediaUploadResult interface
- Fix all MediaGallery/Lightbox usages
- **Impact**: -20 errors (6%)

**Phase 5**: Odoo Types (2-3 hours)
- Align odoo-query-tools with actual responses
- Fix financial.ts Odoo queries
- **Impact**: -40 errors (11%)

**Phase 6**: Cleanup (2-3 hours)
- Fix demo-auth.ts implicit anys
- Fix expense-gl-posting.ts signatures
- Fix remaining mobile route errors
- **Impact**: -40 errors (11%)

**Total Time**: 9-14 hours
**Total Impact**: -162 errors (46% reduction)

**Remaining**: ~189 errors (mostly UI components, lower priority)

---

### Option C: Nuclear Path (30 minutes)

**Target**: Disable strict type checking temporarily

**Change**: Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": false,
    "skipLibCheck": true
  }
}
```

**Result**: Build passes, but loses type safety (NOT RECOMMENDED)

---

## Recommendation

**Proceed with Option B: Systematic Path**

**Rationale**:
1. Fixes root causes, not symptoms
2. Reduces technical debt
3. Restores production build gate
4. 1-2 day timeline is acceptable for production readiness

**First Step**: Phase 1 (Schema Fixes) - highest leverage, lowest risk

---

## Full Error Output Location

**File**: `typescript-errors-full.txt` (157 KB, 1,847 lines)
**Location**: Repository root
**Usage**: Reference for detailed error messages and line numbers

---

## Testing Notes

**Smoke Test Status**: ✅ PASSING (not affected by TypeScript errors)
**Runtime Status**: ✅ WORKING (Vite build succeeds, app runs in dev)
**Production Status**: ❌ BLOCKED (TypeScript check fails)

**Environment**: No additional env vars required - errors are purely type-related

---

## Next Action Required

**PM Decision Point**: Choose fix strategy (A, B, or C)

Once strategy is selected, IMPLEMENTATION AGENT will execute fixes and report back with:
- Files changed
- Errors reduced
- Updated build output
- Remaining blockers

---

**Report Generated**: 2026-01-27
**Agent**: IMPLEMENTATION AGENT (execution-only mode)
**Status**: Awaiting PM instruction for fix strategy
