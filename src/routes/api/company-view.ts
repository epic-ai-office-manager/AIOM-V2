/**
 * API Route: Company View Aggregator (Read-Only)
 *
 * GET /api/company-view
 *
 * Tenant-scoped endpoint that aggregates Odoo data into a unified company dashboard.
 * Includes KPIs, recent records, and per-section error reporting with partial failure isolation.
 *
 * Features:
 * - 30-second in-memory caching per tenant
 * - Isolated error handling (one section failure doesn't break entire response)
 * - Read-only (no Odoo writes)
 * - Better Auth session required
 * - x-tenant-id header required
 */

import { createFileRoute } from "@tanstack/react-router";
import { auth } from "~/utils/auth";
import { findTenantById, isUserTenantMember } from "~/data-access/tenants";
import { getOdooClient } from "~/data-access/odoo";
import type { OdooDomain } from "~/lib/odoo";
import type {
  CompanyViewResponse,
  CompanyKpis,
  AccountingSection,
  CrmSection,
  ProjectsSection,
  HelpdeskSection,
  InventorySection,
  SectionError,
} from "~/types/companyView";

// =============================================================================
// In-Memory Cache (30s TTL)
// =============================================================================

interface CacheEntry {
  data: CompanyViewResponse;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 30_000; // 30 seconds

/**
 * Gets cached response if valid, null otherwise
 */
function getCachedResponse(tenantId: string): CompanyViewResponse | null {
  const entry = cache.get(tenantId);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(tenantId);
    return null;
  }

  return entry.data;
}

/**
 * Stores response in cache with TTL
 */
function setCachedResponse(
  tenantId: string,
  data: CompanyViewResponse
): void {
  cache.set(tenantId, {
    data,
    expiresAt: Date.now() + TTL_MS,
  });
}

// =============================================================================
// Timeout Protection (PM STEP 62.5)
// =============================================================================

/**
 * Timeout configuration to prevent slow Odoo modules from blocking the entire endpoint
 */
const SECTION_TIMEOUT_MS = 4000; // 4 seconds per section
const TOTAL_BUDGET_MS = 6000; // 6 seconds total response time

/**
 * Wraps a promise with a timeout
 * Rejects if the promise doesn't settle within the specified time
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(
      () => reject(new Error(`${label} timeout after ${ms}ms`)),
      ms
    );
    promise
      .then((v) => {
        clearTimeout(id);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(id);
        reject(e);
      });
  });
}

// =============================================================================
// Section Aggregators (Isolated Error Handling)
// =============================================================================

/**
 * Fetches accounting section data (invoices, counts)
 */
async function fetchAccountingSection(): Promise<{
  section: AccountingSection;
  kpis: Partial<CompanyKpis>;
  error?: SectionError;
}> {
  try {
    const client = await getOdooClient();

    // Fetch recent invoices (limit 10, most recent first)
    const invoiceDomain: OdooDomain = [
      ["move_type", "in", ["out_invoice", "out_refund"]],
      ["state", "=", "posted"],
    ];

    const invoices = await client.searchRead("account.move", invoiceDomain, {
      fields: [
        "id",
        "name",
        "partner_id",
        "amount_total",
        "currency_id",
        "state",
        "payment_state",
        "invoice_date",
        "invoice_date_due",
      ],
      limit: 10,
      order: "invoice_date desc",
    });

    // Count open invoices (not fully paid)
    const openInvoicesCount = await client.searchCount("account.move", [
      ["move_type", "in", ["out_invoice", "out_refund"]],
      ["state", "=", "posted"],
      ["payment_state", "in", ["not_paid", "partial"]],
    ]);

    // Count overdue invoices
    const today = new Date().toISOString().split("T")[0];
    const overdueInvoicesCount = await client.searchCount("account.move", [
      ["move_type", "in", ["out_invoice", "out_refund"]],
      ["state", "=", "posted"],
      ["payment_state", "in", ["not_paid", "partial"]],
      ["invoice_date_due", "<", today],
    ]);

    // Map invoices to response format
    const recentInvoices = invoices.map((inv: any) => {
      let status: "draft" | "posted" | "paid" | "overdue" | "unknown" =
        "unknown";

      if (inv.payment_state === "paid") {
        status = "paid";
      } else if (inv.state === "posted" && inv.payment_state === "not_paid") {
        const dueDate = inv.invoice_date_due
          ? new Date(inv.invoice_date_due)
          : null;
        status =
          dueDate && dueDate < new Date() ? "overdue" : "posted";
      } else if (inv.state === "draft") {
        status = "draft";
      }

      return {
        id: String(inv.id),
        number: inv.name || "",
        partnerName: Array.isArray(inv.partner_id)
          ? inv.partner_id[1]
          : "Unknown",
        amountTotal: inv.amount_total || 0,
        currency: Array.isArray(inv.currency_id) ? inv.currency_id[1] : "USD",
        status,
        invoiceDate: inv.invoice_date || null,
        dueDate: inv.invoice_date_due || null,
      };
    });

    return {
      section: { recentInvoices },
      kpis: {
        openInvoicesCount,
        overdueInvoicesCount,
      },
    };
  } catch (error: any) {
    console.error("[Company View] Accounting section error:", error);
    return {
      section: { recentInvoices: [] },
      kpis: {
        openInvoicesCount: null,
        overdueInvoicesCount: null,
      },
      error: {
        message: error.message || "Failed to fetch accounting data",
        isAuthError: error.message?.includes("authentication"),
      },
    };
  }
}

/**
 * Fetches CRM section data (leads)
 */
async function fetchCrmSection(): Promise<{
  section: CrmSection;
  kpis: Partial<CompanyKpis>;
  error?: SectionError;
}> {
  try {
    const client = await getOdooClient();

    // Fetch open leads
    const leadDomain: OdooDomain = [
      ["type", "=", "opportunity"],
      ["active", "=", true],
    ];

    const leads = await client.searchRead("crm.lead", leadDomain, {
      fields: [
        "id",
        "name",
        "partner_id",
        "stage_id",
        "expected_revenue",
        "probability",
      ],
      limit: 10,
      order: "expected_revenue desc",
    });

    // Count open leads
    const openLeadsCount = await client.searchCount("crm.lead", leadDomain);

    const openLeads = leads.map((lead: any) => ({
      id: String(lead.id),
      name: lead.name || "",
      partnerName: Array.isArray(lead.partner_id)
        ? lead.partner_id[1]
        : null,
      stageName: Array.isArray(lead.stage_id) ? lead.stage_id[1] : null,
      expectedRevenue: lead.expected_revenue || null,
      probability: lead.probability || null,
    }));

    return {
      section: { openLeads },
      kpis: { openLeadsCount },
    };
  } catch (error: any) {
    console.error("[Company View] CRM section error:", error);

    // Check if CRM module is missing
    const isModuleMissing =
      error.message?.includes("crm.lead") &&
      (error.message?.includes("not found") ||
        error.message?.includes("does not exist"));

    return {
      section: { openLeads: [] },
      kpis: { openLeadsCount: null },
      error: {
        message: error.message || "Failed to fetch CRM data",
        isModuleMissing,
        isAuthError: error.message?.includes("authentication"),
      },
    };
  }
}

/**
 * Fetches Projects section data (tasks)
 */
async function fetchProjectsSection(): Promise<{
  section: ProjectsSection;
  kpis: Partial<CompanyKpis>;
  error?: SectionError;
}> {
  try {
    const client = await getOdooClient();

    // Fetch open tasks
    const taskDomain: OdooDomain = [["active", "=", true]];

    const tasks = await client.searchRead("project.task", taskDomain, {
      fields: [
        "id",
        "name",
        "project_id",
        "stage_id",
        "user_ids",
        "date_deadline",
      ],
      limit: 10,
      order: "date_deadline asc",
    });

    // Count open tasks
    const openTasksCount = await client.searchCount(
      "project.task",
      taskDomain
    );

    const openTasks = tasks.map((task: any) => ({
      id: String(task.id),
      name: task.name || "",
      projectName: Array.isArray(task.project_id) ? task.project_id[1] : null,
      stageName: Array.isArray(task.stage_id) ? task.stage_id[1] : null,
      assigneeName:
        Array.isArray(task.user_ids) && task.user_ids.length > 0
          ? String(task.user_ids[0])
          : null,
      deadline: task.date_deadline || null,
    }));

    return {
      section: { openTasks },
      kpis: { openTasksCount },
    };
  } catch (error: any) {
    console.error("[Company View] Projects section error:", error);

    const isModuleMissing =
      error.message?.includes("project.task") &&
      (error.message?.includes("not found") ||
        error.message?.includes("does not exist"));

    return {
      section: { openTasks: [] },
      kpis: { openTasksCount: null },
      error: {
        message: error.message || "Failed to fetch projects data",
        isModuleMissing,
        isAuthError: error.message?.includes("authentication"),
      },
    };
  }
}

/**
 * Fetches Helpdesk section data (tickets)
 */
async function fetchHelpdeskSection(): Promise<{
  section: HelpdeskSection;
  kpis: Partial<CompanyKpis>;
  error?: SectionError;
}> {
  try {
    const client = await getOdooClient();

    // Fetch open tickets
    const ticketDomain: OdooDomain = [["active", "=", true]];

    const tickets = await client.searchRead(
      "helpdesk.ticket",
      ticketDomain,
      {
        fields: ["id", "name", "partner_id", "stage_id", "priority"],
        limit: 10,
        order: "priority desc, create_date desc",
      }
    );

    // Count open tickets
    const openTicketsCount = await client.searchCount(
      "helpdesk.ticket",
      ticketDomain
    );

    const openTickets = tickets.map((ticket: any) => ({
      id: String(ticket.id),
      name: ticket.name || "",
      partnerName: Array.isArray(ticket.partner_id)
        ? ticket.partner_id[1]
        : null,
      stageName: Array.isArray(ticket.stage_id) ? ticket.stage_id[1] : null,
      priority: ticket.priority || null,
    }));

    return {
      section: { openTickets },
      kpis: { openTicketsCount },
    };
  } catch (error: any) {
    console.error("[Company View] Helpdesk section error:", error);

    const isModuleMissing =
      error.message?.includes("helpdesk.ticket") &&
      (error.message?.includes("not found") ||
        error.message?.includes("does not exist"));

    return {
      section: { openTickets: [] },
      kpis: { openTicketsCount: null },
      error: {
        message: error.message || "Failed to fetch helpdesk data",
        isModuleMissing,
        isAuthError: error.message?.includes("authentication"),
      },
    };
  }
}

/**
 * Fetches Inventory section data (low stock items)
 */
async function fetchInventorySection(): Promise<{
  section: InventorySection;
  kpis: Partial<CompanyKpis>;
  error?: SectionError;
}> {
  try {
    const client = await getOdooClient();

    // Fetch low stock products (qty_available < reordering_min_qty)
    const productDomain: OdooDomain = [
      ["type", "=", "product"],
      ["active", "=", true],
    ];

    const products = await client.searchRead(
      "product.product",
      productDomain,
      {
        fields: [
          "id",
          "display_name",
          "qty_available",
          "reordering_min_qty",
        ],
        limit: 100, // Get more to filter
      }
    );

    // Filter for low stock (client-side since Odoo doesn't support field comparison in domain easily)
    const lowStockProducts = products.filter(
      (p: any) =>
        p.reordering_min_qty &&
        p.reordering_min_qty > 0 &&
        p.qty_available < p.reordering_min_qty
    );

    // Take top 10
    const lowStockItems = lowStockProducts.slice(0, 10).map((p: any) => ({
      id: String(p.id),
      productName: p.display_name || "",
      qtyAvailable: p.qty_available || 0,
      reorderMinQty: p.reordering_min_qty || null,
    }));

    return {
      section: { lowStockItems },
      kpis: { lowStockItemsCount: lowStockProducts.length },
    };
  } catch (error: any) {
    console.error("[Company View] Inventory section error:", error);

    const isModuleMissing =
      error.message?.includes("product.product") &&
      (error.message?.includes("not found") ||
        error.message?.includes("does not exist"));

    return {
      section: { lowStockItems: [] },
      kpis: { lowStockItemsCount: null },
      error: {
        message: error.message || "Failed to fetch inventory data",
        isModuleMissing,
        isAuthError: error.message?.includes("authentication"),
      },
    };
  }
}

// =============================================================================
// Route Handler
// =============================================================================

export const Route = createFileRoute("/api/company-view")({
  server: {
    handlers: {
      /**
       * GET /api/company-view
       *
       * Returns aggregated company view with KPIs and recent records from all sections.
       * Cached for 30 seconds per tenant.
       */
      GET: async ({ request }) => {
        try {
          // ===================================================================
          // 1. Authentication & Authorization
          // ===================================================================

          // Verify Better Auth session
          const session = await auth.api.getSession({ headers: request.headers });
          if (!session?.user?.id) {
            return Response.json(
              { error: "Unauthorized: Valid session required" },
              { status: 401 }
            );
          }

          const userId = session.user.id;

          // Extract and validate tenant ID from header
          const tenantId = request.headers.get("x-tenant-id");
          if (!tenantId) {
            return Response.json(
              { error: "Bad Request: x-tenant-id header required" },
              { status: 400 }
            );
          }

          // Validate tenant exists and is active
          const tenant = await findTenantById(tenantId);
          if (!tenant) {
            return Response.json(
              { error: "Bad Request: Invalid tenant ID" },
              { status: 400 }
            );
          }

          if (!tenant.isActive) {
            return Response.json(
              { error: "Forbidden: Tenant is inactive" },
              { status: 403 }
            );
          }

          // Validate user is tenant member
          const isMember = await isUserTenantMember(tenantId, userId);
          if (!isMember) {
            return Response.json(
              { error: "Forbidden: User is not a member of this tenant" },
              { status: 403 }
            );
          }

          // ===================================================================
          // 2. Check Cache
          // ===================================================================

          const cached = getCachedResponse(tenantId);
          if (cached) {
            console.log(`[Company View] Cache hit for tenant ${tenantId}`);
            return Response.json(cached, {
              headers: {
                "X-Cache": "HIT",
                "Cache-Control": "private, max-age=30",
              },
            });
          }

          console.log(`[Company View] Cache miss for tenant ${tenantId}, fetching data...`);

          // ===================================================================
          // 3. Aggregate Data (Parallel with Isolated Error Handling + Timeouts)
          // ===================================================================

          // Wrap each section with timeout protection
          const accountingPromise = withTimeout(
            fetchAccountingSection(),
            SECTION_TIMEOUT_MS,
            "accounting"
          );
          const crmPromise = withTimeout(
            fetchCrmSection(),
            SECTION_TIMEOUT_MS,
            "crm"
          );
          const projectsPromise = withTimeout(
            fetchProjectsSection(),
            SECTION_TIMEOUT_MS,
            "projects"
          );
          const helpdeskPromise = withTimeout(
            fetchHelpdeskSection(),
            SECTION_TIMEOUT_MS,
            "helpdesk"
          );
          const inventoryPromise = withTimeout(
            fetchInventorySection(),
            SECTION_TIMEOUT_MS,
            "inventory"
          );

          // Execute all sections in parallel with overall budget timeout
          const allSections = Promise.allSettled([
            accountingPromise,
            crmPromise,
            projectsPromise,
            helpdeskPromise,
            inventoryPromise,
          ]);

          const results = await withTimeout(
            allSections,
            TOTAL_BUDGET_MS,
            "company-view aggregation"
          );

          // Extract results from settled promises
          const accountingResult =
            results[0].status === "fulfilled"
              ? results[0].value
              : {
                  section: { recentInvoices: [] },
                  kpis: {
                    openInvoicesCount: null,
                    overdueInvoicesCount: null,
                  },
                  error: {
                    message:
                      results[0].reason?.message ||
                      "Section timed out or failed",
                  },
                };

          const crmResult =
            results[1].status === "fulfilled"
              ? results[1].value
              : {
                  section: { openLeads: [] },
                  kpis: { openLeadsCount: null },
                  error: {
                    message:
                      results[1].reason?.message ||
                      "Section timed out or failed",
                  },
                };

          const projectsResult =
            results[2].status === "fulfilled"
              ? results[2].value
              : {
                  section: { openTasks: [] },
                  kpis: { openTasksCount: null },
                  error: {
                    message:
                      results[2].reason?.message ||
                      "Section timed out or failed",
                  },
                };

          const helpdeskResult =
            results[3].status === "fulfilled"
              ? results[3].value
              : {
                  section: { openTickets: [] },
                  kpis: { openTicketsCount: null },
                  error: {
                    message:
                      results[3].reason?.message ||
                      "Section timed out or failed",
                  },
                };

          const inventoryResult =
            results[4].status === "fulfilled"
              ? results[4].value
              : {
                  section: { lowStockItems: [] },
                  kpis: { lowStockItemsCount: null },
                  error: {
                    message:
                      results[4].reason?.message ||
                      "Section timed out or failed",
                  },
                };

          // Collect errors from failed sections
          const errorsBySection: CompanyViewResponse["errorsBySection"] = {};

          if (accountingResult.error) {
            errorsBySection.accounting = accountingResult.error;
          }
          if (crmResult.error) {
            errorsBySection.crm = crmResult.error;
          }
          if (projectsResult.error) {
            errorsBySection.projects = projectsResult.error;
          }
          if (helpdeskResult.error) {
            errorsBySection.helpdesk = helpdeskResult.error;
          }
          if (inventoryResult.error) {
            errorsBySection.inventory = inventoryResult.error;
          }

          // Assemble KPIs from all sections
          const kpis: CompanyKpis = {
            openInvoicesCount: accountingResult.kpis.openInvoicesCount ?? null,
            overdueInvoicesCount:
              accountingResult.kpis.overdueInvoicesCount ?? null,
            openLeadsCount: crmResult.kpis.openLeadsCount ?? null,
            openTasksCount: projectsResult.kpis.openTasksCount ?? null,
            openTicketsCount: helpdeskResult.kpis.openTicketsCount ?? null,
            lowStockItemsCount:
              inventoryResult.kpis.lowStockItemsCount ?? null,
          };

          // Assemble response
          const response: CompanyViewResponse = {
            tenantId,
            refreshedAt: new Date().toISOString(),
            recommendedPollIntervalMs: 30000,
            kpis,
            sections: {
              accounting: accountingResult.section,
              crm: crmResult.section,
              projects: projectsResult.section,
              helpdesk: helpdeskResult.section,
              inventory: inventoryResult.section,
            },
            errorsBySection,
          };

          // ===================================================================
          // 4. Store in Cache
          // ===================================================================

          setCachedResponse(tenantId, response);

          // ===================================================================
          // 5. Return Response
          // ===================================================================

          return Response.json(response, {
            headers: {
              "X-Cache": "MISS",
              "Cache-Control": "private, max-age=30",
            },
          });
        } catch (error: any) {
          console.error("[Company View] Unexpected error:", error);
          return Response.json(
            {
              error: "Internal Server Error",
              message: error.message || "An unexpected error occurred",
            },
            { status: 500 }
          );
        }
      },
    },
  },
});
