/**
 * Company View Dashboard
 *
 * Aggregated view of all company operations across accounting, CRM, projects,
 * helpdesk, and inventory. Polls backend every 30 seconds for fresh data.
 */

import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  AlertCircle,
  TrendingUp,
  Users,
  CheckSquare,
  LifeBuoy,
  Package,
  RefreshCw,
  Clock,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import type { CompanyViewResponse } from "~/types/companyView";
import { cn } from "~/lib/utils";
import { useCurrentTenant } from "~/hooks/useCurrentTenant";

export const Route = createFileRoute("/dashboard/company-view")({
  component: CompanyViewPage,
});

/**
 * Fetches company view data from backend
 */
async function fetchCompanyView(
  tenantId: string
): Promise<CompanyViewResponse> {
  const response = await fetch("/api/company-view", {
    headers: {
      "x-tenant-id": tenantId,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch company view: ${response.statusText}`);
  }

  return response.json();
}

function CompanyViewPage() {
  // Get current user's default tenant from authenticated session
  const {
    tenantId,
    tenantName,
    isLoading: isTenantLoading,
    error: tenantError,
  } = useCurrentTenant();

  // Fetch company view data with polling (only when tenant is available)
  const {
    data,
    isLoading,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["company-view", tenantId],
    queryFn: () => {
      if (!tenantId) {
        throw new Error("No tenant ID available");
      }
      return fetchCompanyView(tenantId);
    },
    refetchInterval: (query) => {
      // Use recommended interval from backend, fallback to 30s
      return query.state.data?.recommendedPollIntervalMs ?? 30000;
    },
    staleTime: 25000, // Consider data stale after 25s (before next poll)
    enabled: !!tenantId, // Only fetch when tenant ID is available
  });

  // Manual refresh handler
  const handleRefresh = () => {
    refetch();
  };

  // Format timestamp for display
  const lastUpdated = data?.refreshedAt
    ? new Date(data.refreshedAt).toLocaleString()
    : "Never";

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Company View</h1>
            <p className="text-muted-foreground mt-2">
              {tenantName
                ? `${tenantName} - Real-time overview of all business operations`
                : "Real-time overview of all business operations"}
            </p>
          </div>

          {/* Top bar controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Last updated: {lastUpdated}</span>
            </div>
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw
                className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* Tenant Loading State */}
        {isTenantLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                Loading tenant information...
              </p>
            </div>
          </div>
        )}

        {/* Tenant Missing State */}
        {!isTenantLoading && !tenantId && (
          <Card className="border-yellow-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-900">
                <AlertCircle className="h-5 w-5" />
                No Tenant Available
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {tenantError ||
                  "You don't have a default tenant set. Please contact your administrator or select a tenant from your profile settings."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Data Loading State */}
        {!isTenantLoading && tenantId && isLoading && !data && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">
                Loading company data...
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {!isTenantLoading && tenantId && error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Error Loading Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error
                  ? error.message
                  : "An unexpected error occurred"}
              </p>
              <Button onClick={handleRefresh} className="mt-4" variant="outline">
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Data Display */}
        {!isTenantLoading && tenantId && data && (
          <>
            {/* KPI Cards Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <KPICard
                title="Open Invoices"
                value={data.kpis.openInvoicesCount}
                icon={BarChart3}
                iconColor="text-blue-600"
              />
              <KPICard
                title="Overdue Invoices"
                value={data.kpis.overdueInvoicesCount}
                icon={AlertCircle}
                iconColor="text-red-600"
              />
              <KPICard
                title="Open Leads"
                value={data.kpis.openLeadsCount}
                icon={TrendingUp}
                iconColor="text-green-600"
              />
              <KPICard
                title="Open Tasks"
                value={data.kpis.openTasksCount}
                icon={CheckSquare}
                iconColor="text-purple-600"
              />
              <KPICard
                title="Open Tickets"
                value={data.kpis.openTicketsCount}
                icon={LifeBuoy}
                iconColor="text-orange-600"
              />
              <KPICard
                title="Low Stock Items"
                value={data.kpis.lowStockItemsCount}
                icon={Package}
                iconColor="text-yellow-600"
              />
            </div>

            {/* Section Blocks */}
            <div className="space-y-6">
              {/* Accounting Section */}
              <SectionCard
                title="Accounting"
                description="Recent invoices and receivables"
                error={data.errorsBySection.accounting}
              >
                {data.sections.accounting.recentInvoices.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice Number</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.sections.accounting.recentInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">
                            {invoice.number}
                          </TableCell>
                          <TableCell>{invoice.partnerName}</TableCell>
                          <TableCell>
                            {invoice.currency} {invoice.amountTotal.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <InvoiceStatusBadge status={invoice.status} />
                          </TableCell>
                          <TableCell>
                            {invoice.dueDate
                              ? new Date(invoice.dueDate).toLocaleDateString()
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState message="No invoices found" />
                )}
              </SectionCard>

              {/* CRM Section */}
              <SectionCard
                title="CRM"
                description="Open sales opportunities"
                error={data.errorsBySection.crm}
              >
                {data.sections.crm.openLeads.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Opportunity</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Expected Revenue</TableHead>
                        <TableHead>Probability</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.sections.crm.openLeads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">
                            {lead.name}
                          </TableCell>
                          <TableCell>{lead.partnerName || "—"}</TableCell>
                          <TableCell>{lead.stageName || "—"}</TableCell>
                          <TableCell>
                            {lead.expectedRevenue
                              ? `$${lead.expectedRevenue.toLocaleString()}`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {lead.probability !== null
                              ? `${lead.probability}%`
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState message="No open leads" />
                )}
              </SectionCard>

              {/* Projects Section */}
              <SectionCard
                title="Projects"
                description="Active tasks and deadlines"
                error={data.errorsBySection.projects}
              >
                {data.sections.projects.openTasks.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Assignee</TableHead>
                        <TableHead>Deadline</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.sections.projects.openTasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium">
                            {task.name}
                          </TableCell>
                          <TableCell>{task.projectName || "—"}</TableCell>
                          <TableCell>{task.stageName || "—"}</TableCell>
                          <TableCell>{task.assigneeName || "—"}</TableCell>
                          <TableCell>
                            {task.deadline
                              ? new Date(task.deadline).toLocaleDateString()
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState message="No open tasks" />
                )}
              </SectionCard>

              {/* Helpdesk Section */}
              <SectionCard
                title="Helpdesk"
                description="Customer support tickets"
                error={data.errorsBySection.helpdesk}
              >
                {data.sections.helpdesk.openTickets.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticket</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Priority</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.sections.helpdesk.openTickets.map((ticket) => (
                        <TableRow key={ticket.id}>
                          <TableCell className="font-medium">
                            {ticket.name}
                          </TableCell>
                          <TableCell>{ticket.partnerName || "—"}</TableCell>
                          <TableCell>{ticket.stageName || "—"}</TableCell>
                          <TableCell>
                            <PriorityBadge priority={ticket.priority} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState message="No open tickets" />
                )}
              </SectionCard>

              {/* Inventory Section */}
              <SectionCard
                title="Inventory"
                description="Low stock alerts"
                error={data.errorsBySection.inventory}
              >
                {data.sections.inventory.lowStockItems.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Available</TableHead>
                        <TableHead>Reorder Point</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.sections.inventory.lowStockItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.productName}
                          </TableCell>
                          <TableCell>{item.qtyAvailable}</TableCell>
                          <TableCell>{item.reorderMinQty || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="destructive">Low Stock</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <EmptyState message="No low stock items" />
                )}
              </SectionCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * KPI Card Component
 */
interface KPICardProps {
  title: string;
  value: number | null;
  icon: React.ElementType;
  iconColor: string;
}

function KPICard({ title, value, icon: Icon, iconColor }: KPICardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", iconColor)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {value !== null ? value.toLocaleString() : "—"}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Section Card Component with Error Handling
 */
interface SectionCardProps {
  title: string;
  description: string;
  error?: {
    message: string;
    isModuleMissing?: boolean;
    isAuthError?: boolean;
  };
  children: React.ReactNode;
}

function SectionCard({ title, description, error, children }: SectionCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Error Banner */}
        {error && (
          <div className="mb-4 rounded-md border border-yellow-600 bg-yellow-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-900">
                  {error.isModuleMissing
                    ? "Module Not Available"
                    : error.isAuthError
                    ? "Authentication Error"
                    : "Error Loading Data"}
                </p>
                <p className="text-sm text-yellow-700 mt-1">{error.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Empty State Component
 */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

/**
 * Invoice Status Badge
 */
function InvoiceStatusBadge({
  status,
}: {
  status: "draft" | "posted" | "paid" | "overdue" | "unknown";
}) {
  const variants: Record<typeof status, { variant: any; label: string }> = {
    draft: { variant: "secondary", label: "Draft" },
    posted: { variant: "default", label: "Posted" },
    paid: { variant: "success", label: "Paid" },
    overdue: { variant: "destructive", label: "Overdue" },
    unknown: { variant: "outline", label: "Unknown" },
  };

  const config = variants[status] || variants.unknown;

  return <Badge variant={config.variant as any}>{config.label}</Badge>;
}

/**
 * Priority Badge
 */
function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return <>—</>;

  const variants: Record<string, { variant: any; label: string }> = {
    high: { variant: "destructive", label: "High" },
    medium: { variant: "default", label: "Medium" },
    low: { variant: "secondary", label: "Low" },
  };

  const config = variants[priority.toLowerCase()] || {
    variant: "outline",
    label: priority,
  };

  return <Badge variant={config.variant as any}>{config.label}</Badge>;
}
