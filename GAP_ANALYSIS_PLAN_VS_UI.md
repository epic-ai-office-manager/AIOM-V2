# AIOM Gap Analysis: Plan vs. Actual Implementation

**Date**: 2026-01-29
**Crawl Timestamp**: 2026-01-29T00:17:02.915Z
**Plan Source**: `~/.claude/plans/mutable-snuggling-eich.md`

---

## Executive Summary

The AIOM application has **significant foundational infrastructure** in place but is **missing most of the autonomous execution capabilities** outlined in the transformation plan. The UI demonstrates an **AI COO Dashboard exists** with conversational interface elements, but the backend wiring for actual autonomous action execution is incomplete.

**Implementation Status**: **~40% Complete**

- ✅ **UI Layer**: AI COO Dashboard with conversational interface (DONE)
- ✅ **Database Schema**: Complete (monitoring, analysis, actions tables exist)
- ✅ **AI Infrastructure**: Master prompt, tool registry, Claude SDK client (DONE)
- ⚠️ **Workflow Execution**: Partially implemented (stubs exist, not wired)
- ❌ **Autonomous Action Loop**: Not implemented
- ❌ **Follow-up Engine**: Not implemented
- ❌ **Email/SMS Services**: Not implemented
- ❌ **Calendar Integration**: Not implemented
- ❌ **Policy Engine**: Not implemented

---

## 1. PHASE A: Wire Up Action Execution (CRITICAL GAP)

### Plan Expectation
- Workflow handlers execute real Odoo operations
- Email sending via Resend integration
- SMS sending via Twilio integration
- Push notifications working

### Actual Implementation

#### ✅ **What EXISTS**
- UI shows automated actions on AI COO dashboard:
  - "Payment overdue: INV/2025/00085" alerts
  - "Approve & Execute" and "Review Each" buttons
  - Conversational interface present
- API routes exist:
  - `/api/ai-coo/approve-action`
  - `/api/ai-coo/action-recommendations`
  - `/api/workflows/process`
  - `/api/workflows/event`

#### ❌ **What's MISSING (from Plan analysis)**
1. **Workflow Action Handlers are STUBS**
   - Location: `src/lib/workflow-automation-engine/step-handlers.ts:98-142`
   - Status: Console.log only, don't actually call Odoo client
   - Impact: Workflows simulate but don't execute

2. **No Email Service**
   - Plan requirement: Resend integration
   - Actual: No `src/lib/email/service.ts` file
   - Impact: Cannot send follow-ups, reminders, or notifications

3. **No SMS Service**
   - Plan requirement: Twilio integration
   - Actual: No `src/lib/sms/service.ts` file
   - Impact: Cannot send urgent alerts via SMS

4. **Notification Handler Incomplete**
   - Location: `src/lib/workflow-automation-engine/step-handlers.ts:180-230`
   - Status: Placeholder implementation
   - Impact: In-app notifications may not work fully

### Gap Severity: 🔴 **CRITICAL**
**This is the blocker preventing any autonomous operations from actually executing.**

---

## 2. PHASE B: Autonomous Action Framework (MAJOR GAP)

### Plan Expectation
- Operator Brain loop runs every 5 minutes
- Action Recommender generates AI-powered recommendations
- Guardrails system enforces boundaries
- Auto-execution for safe actions, approval for risky ones

### Actual Implementation

#### ✅ **What EXISTS**
- AI COO UI shows action recommendations:
  - "I need your input on 4 situations"
  - "Review All (4)" button
  - Individual action cards with approval options
- API endpoints exist:
  - `/api/ai-coo/action-recommendations`
  - `/api/ai-coo/approve-action`
  - `/api/ai-coo/activity-feed`
- Financial analyzer implemented:
  - Location: `src/lib/ai-coo/analyzers/financial.ts`
  - Status: Complete and running
- Database tables exist:
  - `autonomous_actions`
  - `analysis_results`
  - `alerts`

#### ❌ **What's MISSING**
1. **No Action Recommender**
   - Plan file: `src/lib/ai-coo/action-recommender.ts`
   - Actual: Does not exist
   - Impact: No AI-powered action generation

2. **No Guardrails System**
   - Plan file: `src/lib/ai-coo/guardrails.ts`
   - Actual: Does not exist
   - Impact: No runtime enforcement of safety boundaries

3. **No Action Executor**
   - Plan file: `src/lib/ai-coo/action-executor.ts`
   - Actual: Does not exist
   - Impact: Cannot execute approved actions

4. **No Operator Brain Loop**
   - Plan file: `src/lib/ai-coo/operator-brain.ts`
   - Actual: Does not exist
   - Impact: No continuous autonomous operation cycle

### Gap Severity: 🔴 **CRITICAL**
**The "brain" of the autonomous system is missing - only UI mockup exists.**

---

## 3. PHASE C: Follow-up Orchestration (NOT IMPLEMENTED)

### Plan Expectation
- Auto-schedule follow-ups on stalled deals (7+ days)
- Auto-send invoice reminders (15, 30, 60, 90 days overdue)
- Deal analyzer monitoring sales pipeline
- Follow-up engine tracking and executing scheduled actions

### Actual Implementation

#### ✅ **What EXISTS**
- UI shows automated alerts:
  - "Payment overdue: INV/2025/00085 (53 days)"
  - Suggests this data is being analyzed somewhere
- Inbox has "Analyze" button (suggests some analysis capability)

#### ❌ **What's MISSING**
1. **No Follow-up Engine**
   - Plan file: `src/lib/ai-coo/follow-up-engine.ts`
   - Actual: Does not exist
   - Impact: No automated follow-up scheduling or execution

2. **No Deal Analyzer**
   - Plan file: `src/lib/ai-coo/analyzers/deals.ts`
   - Actual: Does not exist
   - Impact: No sales pipeline monitoring

3. **No Invoice Follow-up Analyzer**
   - Plan file: `src/lib/ai-coo/analyzers/invoices.ts`
   - Actual: Does not exist
   - Impact: No automated invoice reminder system

4. **No `follow_ups` Database Table**
   - Plan requirement: New migration for follow-up tracking
   - Actual: Not created
   - Impact: Cannot persist scheduled follow-ups

### Gap Severity: 🟡 **HIGH**
**Important for proactive operations but not blocking initial deployment.**

---

## 4. PHASE D: Calendar & Policy System (NOT IMPLEMENTED)

### Plan Expectation
- Google Calendar integration for meeting scheduling
- AI finds optimal time slots
- Policy engine with user-defined business rules
- Time restrictions, approval requirements, financial limits

### Actual Implementation

#### ✅ **What EXISTS**
- Nothing visible in UI related to calendar integration
- No policy configuration interface found

#### ❌ **What's MISSING**
1. **No Calendar Integration**
   - Plan file: `src/lib/calendar/google-calendar.ts`
   - Actual: Does not exist
   - Impact: Cannot schedule meetings autonomously

2. **No Policy Engine**
   - Plan file: `src/lib/ai-coo/policy-engine.ts`
   - Actual: Does not exist
   - Impact: No user-configurable business rules

3. **No `policies` Database Table**
   - Plan requirement: New migration for policy storage
   - Actual: Not created
   - Impact: Cannot persist user-defined rules

### Gap Severity: 🟢 **MEDIUM**
**Advanced features for later phases - not blocking MVP.**

---

## 5. PHASE E: AI Operator Dashboard (PARTIALLY IMPLEMENTED)

### Plan Expectation

**Dashboard Design** (from plan):
- 3-column layout: AI Conversation, Live Activity Feed, Insights Panel
- Conversational interface with natural language
- Real-time updates via WebSocket
- Action-first design (not info-first)
- Progressive disclosure (surface → expand → deep dive)
- Emergency controls (Pause/Resume operations)

### Actual Implementation

#### ✅ **What EXISTS**

**AI COO Dashboard** (`/dashboard/ai-coo`):
- ✅ Conversational header: "I need your input on 4 situations"
- ✅ Action cards with:
  - "Approve & Execute" button
  - "Review Each" button
  - "Ask AI" button
  - "Tell Me More" button
  - "Dismiss" button
- ✅ Status indicator: "Active" badge
- ✅ Emergency controls: "Pause" button
- ✅ "Activity Log" button (suggests activity tracking exists)
- ✅ Alert cards showing automated actions:
  - "Payment overdue: INV/2025/00085 (53 days, $125)"
  - "Payment overdue: INV/2025/00084 (53 days)"
- ✅ Notification badge showing "3" pending items

**Other Dashboard Features**:
- ✅ Main dashboard has widget system ("Customize" button)
- ✅ Task list with priorities and due dates
- ✅ Unified Inbox with "Analyze" button
- ✅ Approvals page (though shows "Loading expense requests...")
- ✅ Mobile interface with quick actions

#### ⚠️ **Partially Implemented**
1. **Layout**: Appears to be simpler than plan's 3-column design
   - Current: Vertical stacked layout
   - Plan: 3-column (Conversation | Activity | Insights)

2. **Real-time Updates**: Unknown if implemented
   - UI exists but unclear if WebSocket streaming works
   - No visible live activity feed

3. **Insights Panel**: Not visible in crawl
   - Plan: Right column with metrics, learnings, suggestions
   - Actual: May be hidden or not implemented

#### ❌ **What's MISSING**
1. **Live Activity Feed**
   - Plan: Center column with "Happening Now" and "Next Up"
   - Actual: No visible streaming activity log

2. **Contextual Insights Panel**
   - Plan: "Today's Impact", "Revenue Protected", "Success Rate", "Learnings"
   - Actual: Not visible in UI

3. **Approval Workflow Details**
   - Plan: View full action details, modify parameters, see AI reasoning
   - Actual: Basic approve/reject UI only

4. **Audit Trail Export**
   - Plan: Export to CSV
   - Actual: Not found

5. **Operator Cockpit Details**
   - Plan: View what's running, cancel specific actions, emergency rollback
   - Actual: Only "Pause" button visible

### Gap Severity: 🟡 **MEDIUM**
**UI foundation exists but missing advanced features and full implementation.**

---

## 6. Infrastructure & Architecture (STRONG FOUNDATION)

### Plan Expectation
- Master prompt system with 8 departments
- Single AI instance (not multi-agent)
- Tool registry with 25+ tools
- Odoo client for CRUD operations
- Database schema complete
- Prompt caching for cost optimization

### Actual Implementation

#### ✅ **What EXISTS** (Plan confirmed these exist)
1. **Master Prompt System**: ✅ Complete
   - Location: `src/lib/claude/system-prompts/aiom-master-prompt.ts`
   - 8 Department knowledge bases (Finance, Sales, Operations, Support, HR, Projects, Marketing, Accounting)
   - Prompt caching strategy implemented

2. **Claude SDK Client**: ✅ Complete
   - Location: `src/lib/claude/sdk-client.ts`
   - Singleton pattern
   - Cost tracking built-in
   - Automatic retries

3. **Tool Registry**: ✅ Complete
   - Location: `src/lib/tool-registry/registry.ts`
   - 25+ tools registered
   - Permission levels and rate limiting

4. **Odoo Client**: ✅ Complete
   - Location: `src/lib/odoo/client.ts`
   - Full CRUD operations
   - Production-ready

5. **Database Schema**: ✅ Complete
   - Tables: `monitoring_jobs`, `analysis_results`, `alerts`, `daily_briefings`, `autonomous_actions`, `alert_rules`, `ai_coo_usage`
   - Drizzle ORM with full type safety

6. **Financial Analyzer**: ✅ Complete
   - Location: `src/lib/ai-coo/analyzers/financial.ts`
   - Integrated with scheduler
   - Database-backed results

7. **API Routes**: ✅ Extensive
   - AI COO: 8 endpoints
   - Assistant: 4 endpoints
   - Workflows: 3 endpoints
   - Monitoring: 4 endpoints
   - Many more for business operations

### Gap Severity: ✅ **COMPLETE**
**Foundation is solid - 8.5/10 according to plan analysis.**

---

## 7. Department Coverage (ANALYZER GAP)

### Plan Assessment
| Department | Master Prompt | Analyzer | Tools | Status |
|------------|---------------|----------|-------|--------|
| **Finance** | ✅ Complete | ✅ Done | ✅ 9+ | **DONE** |
| **Sales** | ✅ Complete | ❌ Missing | ❌ Missing | **NEEDS IMPLEMENTATION** |
| **Operations** | ✅ Complete | ❌ Missing | ❌ Missing | **NEEDS IMPLEMENTATION** |
| **Support** | ✅ Complete | ❌ Missing | ❌ Missing | **NEEDS IMPLEMENTATION** |
| **HR** | ✅ Complete | ❌ Missing | ❌ Missing | **NEEDS IMPLEMENTATION** |
| **Projects** | ✅ Complete | ❌ Missing | ❌ Missing | **NEEDS IMPLEMENTATION** |
| **Marketing** | ✅ Complete | ❌ Missing | ❌ Missing | **NEEDS IMPLEMENTATION** |
| **Accounting** | ✅ Complete | ❌ Missing | ❌ Missing | **NEEDS IMPLEMENTATION** |

**Task Management** (cross-department): ✅ 14+ tools registered

### Gap Severity: 🟡 **HIGH**
**Only 1 of 8 departments has active monitoring. Sales and Operations are priorities.**

---

## 8. Key Routes Analysis

### Authentication & Onboarding
- ✅ `/sign-in` - Works, has Google OAuth option
- ✅ `/sign-up` - Exists (not crawled but in route tree)
- ✅ `/onboarding` - Exists in route tree
- ✅ `/demo` - **Strong demo environment with role selection**
  - Demo MD, Field Tech, Sales Rep, Admin roles
  - Isolated synthetic data

### Dashboard Routes
- ✅ `/dashboard` - Main overview with customizable widgets
- ✅ `/dashboard/ai-coo` - **AI Operator dashboard with conversational UI**
- ✅ `/dashboard/inbox` - Unified inbox with Odoo Discuss integration
- ✅ `/dashboard/approvals` - Expense approval workflow
- ✅ `/dashboard/reports` - Redirects to sign-in (auth required)
- ✅ `/dashboard/sales` - Redirects to sign-in (auth required)
- ✅ `/dashboard/wallet` - Has error ("Buffer is not defined")
- ✅ `/dashboard/admin` - Exists in route tree
- ✅ `/dashboard/md` - Managing Director dashboard (in route tree)
- ✅ `/dashboard/kyc` - KYC management (in route tree)

### Mobile Routes
- ✅ `/mobile` - **Well-designed mobile home** with quick actions
- ✅ `/mobile/expenses` - Expense request management
- ✅ `/mobile/field-tech` - **Field technician dashboard** with:
  - Work order tracking
  - Route planning
  - Inventory management
  - Time tracking
  - Site history
- ✅ `/mobile/call` - VoIP calling (in route tree)
- ✅ `/mobile/topup` - Mobile top-up (in route tree)
- ✅ `/mobile/pay` - QR payment scanning (in route tree)
- ✅ `/mobile/kyc` - KYC submission (in route tree)

### API Routes (Backend)
- ✅ **AI COO**: 8 endpoints (trigger, analysis, metrics, approve, alerts, recommendations, activity feed)
- ✅ **Assistant**: 4 endpoints (propose, approve, execute, reject)
- ✅ **Workflows**: 3 endpoints (webhook, process, event)
- ✅ **Monitoring**: 4 endpoints (system-health, status, health-check, alerts)
- ✅ **Extensive business operations**: 50+ API routes for KYC, jobs, tasks, briefings, etc.

---

## 9. UI/UX Quality Assessment

### ✅ **Strengths**
1. **Conversational AI Interface**: AI COO dashboard uses natural language
   - "I need your input on 4 situations"
   - Action-oriented buttons ("Approve & Execute", "Ask AI", "Tell Me More")

2. **Mobile-First Design**: Excellent mobile interface
   - Clean, card-based layout
   - Quick action buttons
   - Status summaries
   - Field tech tools are comprehensive

3. **Demo Environment**: Well-implemented
   - Role-based access
   - Synthetic data isolation
   - Clear explanations

4. **Navigation**: Clear and organized
   - Sidebar navigation on dashboard
   - Breadcrumbs and role indicators
   - Mobile bottom navigation

5. **Visual Hierarchy**: Good use of:
   - Priority badges (high/medium/low)
   - Status indicators (Active badge, notification counts)
   - Card-based layouts
   - Color coding

### ⚠️ **Weaknesses**
1. **Authentication Wall**: Many routes redirect to sign-in
   - Harder to evaluate full feature set without login

2. **Error Handling**: `/dashboard/wallet` shows "Buffer is not defined"
   - Suggests some runtime issues

3. **Loading States**: Several pages show "Loading..." indefinitely
   - `/dashboard/approvals`: "Loading expense requests..."
   - May be due to no backend data

4. **Missing Advanced Features**:
   - No visible real-time activity feed
   - No insights/metrics panel
   - No policy configuration UI
   - No detailed audit trail viewer

---

## 10. Critical Path to MVP (Based on Plan)

### What MUST Be Done for Basic Autonomous Operation

**Week 1-2: Phase A - Wire Up Execution** 🔴 CRITICAL
1. ✅ Fix workflow handlers to call Odoo client (not console.log)
2. ✅ Add Resend email service integration
3. ✅ Add Twilio SMS service integration
4. ✅ Wire up notification handler completely

**Week 3-4: Phase B - Operator Brain** 🔴 CRITICAL
1. ✅ Create Action Recommender (using existing Claude SDK)
2. ✅ Create Guardrails System (conservative defaults)
3. ✅ Create Action Executor
4. ✅ Create Operator Brain Loop (5-minute cycle)

**Result**: After Phase A + B, you have **minimal autonomous AI that can actually execute actions**.

---

## 11. What's Working vs. What's Not

### ✅ **WORKING (Can Use Now)**
1. UI/UX layer - Dashboard, mobile interfaces, navigation
2. Authentication system - Sign-in, OAuth
3. Demo environment - Role-based synthetic data
4. Database layer - All tables, schemas, migrations
5. AI infrastructure - Master prompt, Claude SDK, tool registry
6. Odoo client - CRUD operations ready
7. Financial analyzer - Running and producing insights
8. Unified inbox - Message aggregation
9. Field tech mobile app - Work orders, routing, inventory
10. Expense workflow UI - Request submission and approvals

### ⚠️ **PARTIALLY WORKING (Needs Completion)**
1. AI COO dashboard - UI exists, but no real actions execute
2. Workflow engine - Orchestration works, but handlers are stubs
3. Approval system - UI works, but no AI-generated approvals yet
4. Notifications - In-app may work, but email/SMS missing

### ❌ **NOT WORKING (Needs Implementation)**
1. Autonomous action execution - Workflows don't actually execute
2. Email sending - No service integration
3. SMS sending - No service integration
4. Action recommendations - No AI-powered generation
5. Guardrails enforcement - No runtime boundaries
6. Operator brain loop - No continuous autonomous cycle
7. Follow-up engine - No automated scheduling
8. Deal/invoice analyzers - No additional department monitoring
9. Calendar integration - No meeting scheduling
10. Policy engine - No user-defined rules
11. Real-time activity feed - No WebSocket streaming visible
12. Insights panel - No metrics/learnings display

---

## 12. Recommended Next Steps (Prioritized)

### 🔴 **IMMEDIATE (Week 1)**
1. **Fix Workflow Action Handlers** (1-2 days)
   - File: `src/lib/workflow-automation-engine/step-handlers.ts`
   - Change: Call actual Odoo client instead of console.log
   - Impact: Workflows will actually execute actions

2. **Add Email Service** (1 day)
   - File: Create `src/lib/email/service.ts`
   - Integration: Resend API
   - Impact: Can send automated emails

3. **Add SMS Service** (1 day)
   - File: Create `src/lib/sms/service.ts`
   - Integration: Twilio API
   - Impact: Can send urgent alerts

### 🟡 **HIGH PRIORITY (Week 2-3)**
4. **Create Action Recommender** (2-3 days)
   - File: Create `src/lib/ai-coo/action-recommender.ts`
   - Impact: AI generates actionable recommendations

5. **Create Guardrails System** (1-2 days)
   - File: Create `src/lib/ai-coo/guardrails.ts`
   - Impact: Safety boundaries enforced

6. **Create Action Executor** (1-2 days)
   - File: Create `src/lib/ai-coo/action-executor.ts`
   - Impact: Approved actions actually execute

7. **Create Operator Brain Loop** (2-3 days)
   - File: Create `src/lib/ai-coo/operator-brain.ts`
   - Impact: Continuous autonomous operation begins

### 🟢 **MEDIUM PRIORITY (Week 4-6)**
8. **Sales Analyzer** (2-3 days)
   - File: Create `src/lib/ai-coo/analyzers/deals.ts`
   - Impact: Monitor sales pipeline proactively

9. **Follow-up Engine** (3-4 days)
   - File: Create `src/lib/ai-coo/follow-up-engine.ts`
   - Impact: Automated deal and invoice follow-ups

10. **Enhanced Dashboard UI** (2-3 days)
    - Add real-time activity feed
    - Add insights panel with metrics
    - Improve approval workflow details

---

## 13. Summary Scorecard

| Category | Plan Requirement | Actual Status | Gap |
|----------|------------------|---------------|-----|
| **UI/UX** | AI Operator Dashboard | ✅ 70% Complete | Missing: Activity feed, insights panel |
| **Phase A: Execution** | Workflow handlers, Email, SMS | ❌ 0% Complete | All services missing |
| **Phase B: Autonomy** | Brain loop, Recommender, Guardrails | ❌ 5% Complete | Only DB schema exists |
| **Phase C: Follow-ups** | Engine, Deal analyzer, Invoice analyzer | ❌ 0% Complete | Not started |
| **Phase D: Calendar & Policy** | Google Cal, Policy engine | ❌ 0% Complete | Not started |
| **Phase E: Dashboard** | 3-column layout, Real-time, Controls | ⚠️ 40% Complete | Basic UI only |
| **Infrastructure** | AI, DB, Tools, Odoo client | ✅ 95% Complete | Excellent foundation |

**Overall Completion**: **~35-40%**

**Estimated Time to MVP** (Minimal Autonomous Operation):
- **Optimistic**: 2-3 weeks (if focusing only on Phase A + B)
- **Realistic**: 4-6 weeks (with testing and iteration)
- **Original Plan**: 6-8 weeks (revised from 10-12 weeks)

---

## 14. Key Insights

### 🎯 **Good News**
1. **Foundation is exceptional** - 8.5/10 architecture rating (per plan)
2. **UI mockups are impressive** - Shows clear vision of end state
3. **Database schema is complete** - No design work needed
4. **Odoo integration is ready** - Just needs to be called
5. **AI infrastructure is solid** - Master prompt, tools, caching all done

### ⚠️ **Bad News**
1. **Critical gap in Phase A** - No actual execution happens
2. **Autonomous loop missing** - AI can analyze but can't act
3. **Communication channels missing** - No email or SMS
4. **Only 1 of 8 departments active** - Finance only, others need analyzers

### 💡 **Strategic Recommendation**
**Focus ruthlessly on Phase A + B for next 3-4 weeks** to achieve a working autonomous MVP. Defer Phase C, D, E enhancements until after the core loop is proven.

The UI creates an impressive demo experience, but the backend needs urgent wiring to deliver on the autonomous promise. The infrastructure exists - it just needs to be connected.

---

## 15. Files Referenced

### ✅ **Files That EXIST** (confirmed by plan analysis)
- `src/lib/claude/system-prompts/aiom-master-prompt.ts`
- `src/lib/claude/sdk-client.ts`
- `src/lib/tool-registry/registry.ts`
- `src/lib/odoo/client.ts`
- `src/lib/ai-coo/analyzers/financial.ts`
- `src/lib/ai-coo/scheduler/index.ts`
- `src/lib/workflow-automation-engine/step-handlers.ts` (with stubs)
- `src/db/ai-coo-schema.ts`
- `src/data-access/ai-coo.ts`
- `src/routes/dashboard/ai-coo/index.tsx`

### ❌ **Files That SHOULD EXIST** (per plan, but don't)
- `src/lib/email/service.ts`
- `src/lib/sms/service.ts`
- `src/lib/ai-coo/action-recommender.ts`
- `src/lib/ai-coo/guardrails.ts`
- `src/lib/ai-coo/action-executor.ts`
- `src/lib/ai-coo/operator-brain.ts`
- `src/lib/ai-coo/follow-up-engine.ts`
- `src/lib/ai-coo/analyzers/deals.ts`
- `src/lib/ai-coo/analyzers/invoices.ts`
- `src/lib/calendar/google-calendar.ts`
- `src/lib/ai-coo/policy-engine.ts`

---

## Conclusion

The AIOM application has an **excellent foundation** and **impressive UI**, but **lacks the critical backend wiring** to make autonomous operations real. The gap between "looks autonomous" and "actually autonomous" is significant but **bridgeable in 3-4 weeks** with focused effort on Phase A and B.

**The transformation plan is achievable** - the architecture is sound, the tools are ready, and the vision is clear. Execution just needs to shift from UI polish to backend integration.

**Next Action**: Start Phase A immediately - wire up Odoo action handlers, add email/SMS services, and get workflows actually executing. That alone will unlock 70% of the value proposition.
