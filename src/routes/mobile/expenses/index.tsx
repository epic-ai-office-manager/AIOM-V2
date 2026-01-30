/**
 * Mobile Expense Request Submission Page
 *
 * Mobile-optimized page for creating and managing expense requests
 * with receipt capture, approval tracking, and offline support.
 */

import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Plus,
  RefreshCw,
  Loader2,
  Receipt,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  ChevronRight,
  Camera,
  Filter,
  ArrowLeft,
} from "lucide-react";
import { authClient } from "~/lib/auth-client";
import { redirect } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import {
  useMyExpenseRequests,
} from "~/hooks/useExpenseRequests";
import { cn } from "~/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import type { ExpenseRequest, ExpenseRequestStatus } from "~/db/schema";

export const Route = createFileRoute("/mobile/expenses/")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: "/mobile/expenses" },
      });
    }
  },
  component: MobileExpensesPage,
});

// Status configuration
const STATUS_CONFIG: Record<
  ExpenseRequestStatus,
  { label: string; icon: typeof Clock; colorClass: string; bgClass: string }
> = {
  pending: {
    label: "Pending",
    icon: Clock,
    colorClass: "text-yellow-600 dark:text-yellow-400",
    bgClass: "bg-yellow-500/10",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle,
    colorClass: "text-green-600 dark:text-green-400",
    bgClass: "bg-green-500/10",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    colorClass: "text-red-600 dark:text-red-400",
    bgClass: "bg-red-500/10",
  },
  disbursed: {
    label: "Disbursed",
    icon: DollarSign,
    colorClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-500/10",
  },
};

/**
 * Format currency amount
 */
function formatCurrency(amount: string, currency: string = "USD"): string {
  const numericAmount = parseFloat(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(numericAmount);
}

/**
 * Expense Request Card Component (Mobile-optimized)
 */
function ExpenseRequestCard({ request }: { request: ExpenseRequest }) {
  const statusConfig = STATUS_CONFIG[request.status as ExpenseRequestStatus];
  const StatusIcon = statusConfig.icon;
  const createdDate = new Date(request.createdAt);

  return (
    <Link to="/mobile/expenses/$id" params={{ id: request.id }}>
      <Card className="transition-all duration-200 active:scale-[0.98] hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant="outline"
                  className={cn(statusConfig.bgClass, statusConfig.colorClass, "border-0")}
                >
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>
              <h3 className="font-medium truncate">{request.purpose}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {formatDistanceToNow(createdDate, { addSuffix: true })}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-semibold">
                {formatCurrency(request.amount, request.currency)}
              </p>
              {request.receiptUrl && (
                <Receipt className="w-4 h-4 text-muted-foreground ml-auto mt-1" />
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * Filter Tabs Component
 */
function FilterTabs({
  activeFilter,
  onFilterChange,
}: {
  activeFilter: ExpenseRequestStatus | "all";
  onFilterChange: (filter: ExpenseRequestStatus | "all") => void;
}) {
  const filters: Array<{ value: ExpenseRequestStatus | "all"; label: string }> = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "disbursed", label: "Disbursed" },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
      {filters.map((filter) => (
        <Button
          key={filter.value}
          variant={activeFilter === filter.value ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange(filter.value)}
          className="flex-shrink-0 whitespace-nowrap"
        >
          {filter.label}
        </Button>
      ))}
    </div>
  );
}

/**
 * Mobile Expenses Page Component
 */
function MobileExpensesPage() {
  const [statusFilter, setStatusFilter] = React.useState<ExpenseRequestStatus | "all">("all");

  // Fetch user's expense requests
  const {
    data: expenses,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useMyExpenseRequests(
    statusFilter === "all" ? undefined : { status: statusFilter }
  );

  // Group expenses by status for quick stats
  const stats = React.useMemo(() => {
    if (!expenses) return { pending: 0, approved: 0, rejected: 0, disbursed: 0, total: 0 };
    return {
      pending: expenses.filter((e) => e.status === "pending").length,
      approved: expenses.filter((e) => e.status === "approved").length,
      rejected: expenses.filter((e) => e.status === "rejected").length,
      disbursed: expenses.filter((e) => e.status === "disbursed").length,
      total: expenses.length,
    };
  }, [expenses]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold">My Expenses</h1>
              <p className="text-xs text-muted-foreground">
                {stats.total} {stats.total === 1 ? "request" : "requests"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 w-9"
            >
              <RefreshCw className={cn("h-5 w-5", isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>
      </header>

      {/* Quick Stats */}
      <div className="px-4 py-3 bg-muted/30 border-b">
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center">
            <p className="text-lg font-semibold text-yellow-600">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-green-600">{stats.approved}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-red-600">{stats.rejected}</p>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-blue-600">{stats.disbursed}</p>
            <p className="text-xs text-muted-foreground">Disbursed</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-3 border-b">
        <FilterTabs activeFilter={statusFilter} onFilterChange={setStatusFilter} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading expenses...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="p-3 rounded-full bg-red-500/10 mb-4">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Failed to load expenses</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "An unexpected error occurred"}
            </p>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : expenses && expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Receipt className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No expenses yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {statusFilter === "all"
                ? "Create your first expense request to get started"
                : `No ${statusFilter} expenses found`}
            </p>
            <Link to="/mobile/expenses/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Expense
              </Button>
            </Link>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {expenses?.map((expense) => (
              <ExpenseRequestCard key={expense.id} request={expense} />
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      {expenses && expenses.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Link to="/mobile/expenses/new">
            <Button
              size="lg"
              className="rounded-full w-14 h-14 shadow-lg"
              data-testid="new-expense-fab"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
