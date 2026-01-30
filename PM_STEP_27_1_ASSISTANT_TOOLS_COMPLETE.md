# PM STEP 27.1 — Assistant Tools + Policy Gate

**Status**: ✅ COMPLETE
**Date**: 2026-01-27

---

## Summary

Established the assistant tool surface with 5 initial tools and a pure policy decision module. All tools registered with stub handlers (NOT_IMPLEMENTED) and integrated into the global tool registry. No execution paths or API endpoints added in this step.

---

## Files Created

### 1. Policy Decision Module

**File**: `src/lib/assistant-policy/policy.ts` (51 lines)

**Purpose**: Pure function that evaluates whether a tool call should be allowed, denied, or requires approval.

**Implementation**:
- No database dependencies
- No authentication logic
- Pure decision function based on input parameters
- v1 rules (hardcoded):
  - Unrecognized tool ID → deny
  - Low risk → allow
  - Medium/high risk → requires_approval

**Interface**:
```typescript
export type AssistantPolicyDecision = "allow" | "deny" | "requires_approval";

export interface AssistantPolicyInput {
  tenantId: string;
  userId: string;
  toolId: string;
  riskLevel: "low" | "medium" | "high";
  channel: "web" | "telegram";
}

export interface AssistantPolicyResult {
  decision: AssistantPolicyDecision;
  reason: string;
}

export function evaluateAssistantPolicy(
  input: AssistantPolicyInput
): AssistantPolicyResult
```

**Recognized Tool IDs** (v1 hardcoded list):
- `assistant.create_task`
- `assistant.summarize_inbox_thread`
- `assistant.draft_email`
- `assistant.create_expense`
- `assistant.system_health_check`

---

### 2. Assistant Tool Definitions

**File**: `src/lib/assistant-tools/definitions.ts` (218 lines)

**Purpose**: Define 5 assistant tools with JSON schemas and stub handlers.

**Stub Handler**:
```typescript
const stubHandler = async <TInput, TOutput>(
  _input: TInput,
  _context: ToolContext
): Promise<ToolResult<TOutput>> => {
  return {
    success: false,
    error: {
      code: "NOT_IMPLEMENTED",
      message: "Tool execution not implemented yet",
    },
  };
};
```

**Tools Defined**:

#### Tool 1: Create Task
- **ID**: `assistant.create_task`
- **Risk Level**: medium
- **Permission**: user
- **Input Schema**: title (required), description, priority (low/normal/high), dueDate
- **Use Case**: Create tasks in task management system

#### Tool 2: Summarize Inbox Thread
- **ID**: `assistant.summarize_inbox_thread`
- **Risk Level**: low
- **Permission**: user
- **Input Schema**: threadId (required), maxMessages
- **Use Case**: Generate summary of conversation threads

#### Tool 3: Draft Email
- **ID**: `assistant.draft_email`
- **Risk Level**: low
- **Permission**: user
- **Input Schema**: to, subject, context (all required), tone (optional)
- **Use Case**: Generate draft emails based on context

#### Tool 4: Create Expense
- **ID**: `assistant.create_expense`
- **Risk Level**: high
- **Permission**: user
- **Input Schema**: amount, description, category (all required), date
- **Use Case**: Record expense entries

#### Tool 5: System Health Check
- **ID**: `assistant.system_health_check`
- **Risk Level**: low
- **Permission**: user
- **Input Schema**: includeDetails (optional boolean)
- **Use Case**: Check system health status

**Exports**:
```typescript
export const assistantTools = [
  createTaskTool,
  summarizeInboxThreadTool,
  draftEmailTool,
  createExpenseTool,
  systemHealthCheckTool,
];

export function getAssistantToolCount(): number {
  return assistantTools.length;
}
```

---

### 3. Registration Module

**File**: `src/lib/assistant-tools/index.ts` (73 lines)

**Purpose**: Provide register/unregister functions following existing tool registry patterns.

**Functions**:

#### `registerAssistantTools()`
- Loops through assistantTools array
- Checks `!registry.has(tool.id)` to prevent duplicates
- Calls `registry.register(tool as any)` with type assertion
- Uses `eslint-disable-next-line @typescript-eslint/no-explicit-any` comment

#### `unregisterAssistantTools()`
- Loops through assistantTools array
- Calls `registry.unregister(tool.id)`

#### `areAssistantToolsRegistered()`
- Returns `assistantTools.every((tool) => registry.has(tool.id))`
- Used to check if tools are already registered

#### `getAssistantClaudeTools()`
- Registers tools if not already registered
- Returns Claude-compatible format:
  ```typescript
  {
    name: tool.id,
    description: tool.description,
    input_schema: tool.inputSchema
  }
  ```

**Pattern**: Follows exact same structure as `src/lib/task-management-tools/index.ts`

---

### 4. Tool Registry Integration

**File Modified**: `src/fn/tool-registry.ts`

**Changes**:

#### Line 23 (Import):
```typescript
import { registerAssistantTools } from "~/lib/assistant-tools";
```

#### Line 38 (Registration Call):
```typescript
function ensureToolsRegistered(): void {
  if (!toolsInitialized) {
    registerExampleTools();
    registerFinancialTools();
    registerTaskManagementTools();
    registerAssistantTools();  // ← ADDED
    toolsInitialized = true;
  }
}
```

**Effect**: All assistant tools are now automatically registered when any tool registry function is called.

---

## TypeScript Compilation Results

### Before PM STEP 27.1
```bash
$ npx tsc --noEmit --pretty false 2>&1 | grep "error TS" | wc -l
94
```

### After PM STEP 27.1 (Initial)
```bash
$ npx tsc --noEmit --pretty false 2>&1 | grep "error TS" | wc -l
98  # ← 4 new errors
```

**Errors Found**: Type mismatch in `assistantTools` array declaration

**Error Details**:
```
src/lib/assistant-tools/definitions.ts(208,3): error TS2322:
  Type 'ToolDefinition<CreateTaskInput, unknown>' is not assignable to
  type 'ToolDefinition<Record<string, unknown>, unknown>'.
```

**Root Cause**: Explicit type annotation `ToolDefinition[]` defaulted to `ToolDefinition<Record<string, unknown>, unknown>[]`, but individual tools used specific input types.

**Fix**: Removed explicit type annotation, letting TypeScript infer the correct union type.

```typescript
// Before (caused errors):
export const assistantTools: ToolDefinition[] = [...]

// After (fixed):
export const assistantTools = [...]
```

### After Fix
```bash
$ npx tsc --noEmit --pretty false 2>&1 | grep "error TS" | wc -l
94  # ← Back to baseline

$ npx tsc --noEmit --pretty false 2>&1 | grep -E "(assistant-tools|assistant-policy)"
# No output - 0 errors in new files ✓
```

**Result**: ✅ **No new TypeScript errors** (94 unchanged)

---

## Test Results

```bash
$ npm test

> test
> playwright test tests/smoke.spec.ts --config playwright.config.ts --reporter=list

Running 1 test using 1 worker

[Smoke Test] Health Status: degraded
[Smoke Test] Database Status: pass
  ✓  1 [chromium] › tests\smoke.spec.ts:17:3 › Smoke Test - System Health
     › GET /api/monitoring/system-health returns valid health status (107ms)

  1 passed (1.5s)
```

**Status**: ✅ **ALL TESTS PASSING**

---

## Verification Checklist

- [x] Policy module created with pure decision function
- [x] 5 assistant tools defined with stub handlers
- [x] All tools have correct metadata (id, name, description, version, category, permission, enabled, inputSchema, handler)
- [x] Risk levels set in metadata (assistantRiskLevel: low/medium/high)
- [x] Registration functions created following existing patterns
- [x] Tools wired into ensureToolsRegistered()
- [x] No new TypeScript errors (94 unchanged)
- [x] All tests passing (1/1)
- [x] No execution paths added (handlers return NOT_IMPLEMENTED)
- [x] No new API routes added
- [x] No database changes required
- [x] No new dependencies added

---

## What This Step Does NOT Include (By Design)

❌ **No tool execution** - All handlers return NOT_IMPLEMENTED error
❌ **No API endpoints** - No new routes created
❌ **No database writes** - Policy is pure function, tools are stubs
❌ **No Telegram integration** - Just tool definitions
❌ **No Claude SDK calls** - No actual AI usage
❌ **No authentication** - Policy module doesn't check permissions
❌ **No user approvals** - Just policy decision logic

---

## Policy Decision Examples

### Example 1: Low Risk Tool (Auto-Approve)
```typescript
evaluateAssistantPolicy({
  tenantId: "tenant_a",
  userId: "user_123",
  toolId: "assistant.summarize_inbox_thread",
  riskLevel: "low",
  channel: "web"
})
// Returns: { decision: "allow", reason: "Low risk tool - auto-approved" }
```

### Example 2: Medium Risk Tool (Requires Approval)
```typescript
evaluateAssistantPolicy({
  tenantId: "tenant_a",
  userId: "user_123",
  toolId: "assistant.create_task",
  riskLevel: "medium",
  channel: "telegram"
})
// Returns: {
//   decision: "requires_approval",
//   reason: "Medium risk tool - requires user approval before execution"
// }
```

### Example 3: High Risk Tool (Requires Approval)
```typescript
evaluateAssistantPolicy({
  tenantId: "tenant_a",
  userId: "user_123",
  toolId: "assistant.create_expense",
  riskLevel: "high",
  channel: "web"
})
// Returns: {
//   decision: "requires_approval",
//   reason: "High risk tool - requires user approval before execution"
// }
```

### Example 4: Unrecognized Tool (Deny)
```typescript
evaluateAssistantPolicy({
  tenantId: "tenant_a",
  userId: "user_123",
  toolId: "assistant.delete_database",
  riskLevel: "high",
  channel: "web"
})
// Returns: {
//   decision: "deny",
//   reason: "Tool ID 'assistant.delete_database' is not recognized"
// }
```

---

## Tool Registry State After This Step

**Total Registered Tools**: 25+ (existing) + 5 (assistant) = **30+**

**Assistant Tools Accessible Via**:
- `getToolsFn()` - Returns all tools (filtered by user permissions)
- `getToolByIdFn({ toolId: "assistant.create_task" })` - Returns single tool
- `getClaudeToolsFn()` - Returns Claude-compatible tool definitions
- `searchToolsFn({ query: "assistant" })` - Finds assistant tools by keyword
- `getAssistantClaudeTools()` - Returns only assistant tools in Claude format

**Tool Categories**:
- `utility` - assistant.create_task, assistant.system_health_check
- `communication` - assistant.summarize_inbox_thread, assistant.draft_email
- `data` - assistant.create_expense

---

## Next Steps: PM STEP 27.2

**Objective**: Intent Parsing + LLM Integration

**Tasks**:
1. Create Telegram message intent parser using Claude SDK
2. Map parsed intent to tool + parameters
3. Call evaluateAssistantPolicy() for gating
4. Store intent parse result (no execution yet)
5. Return rich response showing what would be executed

**Still No Execution**: Tools remain as stubs, but intent parsing + policy checks will be fully functional.

---

## Commit Summary

**Files Created**:
- ✅ `src/lib/assistant-policy/policy.ts` (51 lines)
- ✅ `src/lib/assistant-tools/definitions.ts` (218 lines)
- ✅ `src/lib/assistant-tools/index.ts` (73 lines)

**Files Modified**:
- ✅ `src/fn/tool-registry.ts` (+2 lines: import + registration call)

**Total New Code**: ~340 lines

**TypeScript Errors**: 94 (unchanged from baseline)
**Tests Passing**: 1/1 ✓

---

**PM STEP 27.1 Complete**: ✅ Assistant tools registered, policy gate ready, zero execution paths, ready for PM STEP 27.2 (intent parsing)
