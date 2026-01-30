/**
 * Company View Payload Contract
 *
 * Canonical backend → frontend response contract for Phase 1 Company View dashboard.
 * Includes KPIs, tables, refresh metadata, and per-section error reporting.
 */

/**
 * Top-level response type for Company View
 */
export interface CompanyViewResponse {
  tenantId: string;
  refreshedAt: string; // ISO timestamp
  recommendedPollIntervalMs: number; // = 30000

  kpis: CompanyKpis;

  sections: {
    accounting: AccountingSection;
    crm: CrmSection;
    projects: ProjectsSection;
    helpdesk: HelpdeskSection;
    inventory: InventorySection;
  };

  errorsBySection: Partial<Record<CompanyViewSectionKey, SectionError>>;
}

/**
 * Section keys for error reporting
 */
export type CompanyViewSectionKey =
  | "accounting"
  | "crm"
  | "projects"
  | "helpdesk"
  | "inventory";

/**
 * KPI block (lightweight, dashboard-safe)
 */
export interface CompanyKpis {
  openInvoicesCount: number | null;
  overdueInvoicesCount: number | null;
  openLeadsCount: number | null;
  openTasksCount: number | null;
  openTicketsCount: number | null;
  lowStockItemsCount: number | null;
}

/**
 * Accounting section data
 */
export interface AccountingSection {
  recentInvoices: Array<{
    id: string;
    number: string;
    partnerName: string;
    amountTotal: number;
    currency: string;
    status: "draft" | "posted" | "paid" | "overdue" | "unknown";
    invoiceDate: string | null;
    dueDate: string | null;
  }>;
}

/**
 * CRM section data
 */
export interface CrmSection {
  openLeads: Array<{
    id: string;
    name: string;
    partnerName: string | null;
    stageName: string | null;
    expectedRevenue: number | null;
    probability: number | null;
  }>;
}

/**
 * Projects section data
 */
export interface ProjectsSection {
  openTasks: Array<{
    id: string;
    name: string;
    projectName: string | null;
    stageName: string | null;
    assigneeName: string | null;
    deadline: string | null;
  }>;
}

/**
 * Helpdesk section data
 */
export interface HelpdeskSection {
  openTickets: Array<{
    id: string;
    name: string;
    partnerName: string | null;
    stageName: string | null;
    priority: string | null;
  }>;
}

/**
 * Inventory section data
 */
export interface InventorySection {
  lowStockItems: Array<{
    id: string;
    productName: string;
    qtyAvailable: number;
    reorderMinQty: number | null;
  }>;
}

/**
 * Section error model
 */
export interface SectionError {
  message: string;
  isModuleMissing?: boolean;
  isAuthError?: boolean;
}
