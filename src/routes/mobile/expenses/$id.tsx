/**
 * Mobile Expense Request Detail Page
 *
 * Displays expense request details with status tracking
 * and action buttons based on current status.
 */

import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Receipt,
  User,
  Calendar,
  FileText,
  Loader2,
  Trash2,
  Edit,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { authClient } from "~/lib/auth-client";
import { redirect } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useExpenseRequest, useDeleteExpenseRequest } from "~/hooks/useExpenseRequests";
import { cn } from "~/lib/utils";
import { format } from "date-fns";
import type { ExpenseRequestStatus } from "~/db/schema";

export const Route = createFileRoute("/mobile/expenses/$id")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: "/mobile/expenses" },
      });
    }
  },
  component: MobileExpenseDetailPage,
});

// Status configuration
const STATUS_CONFIG: Record<
  ExpenseRequestStatus,
  { label: string; icon: typeof Clock; colorClass: string; bgClass: string; description: string }
> = {
  pending: {
    label: "Pending Approval",
    icon: Clock,
    colorClass: "text-yellow-600 dark:text-yellow-400",
    bgClass: "bg-yellow-500/10",
    description: "Waiting for approval from a manager",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle,
    colorClass: "text-green-600 dark:text-green-400",
    bgClass: "bg-green-500/10",
    description: "Your expense has been approved",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    colorClass: "text-red-600 dark:text-red-400",
    bgClass: "bg-red-500/10",
    description: "Your expense was not approved",
  },
  disbursed: {
    label: "Disbursed",
    icon: DollarSign,
    colorClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-500/10",
    description: "Payment has been processed",
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

function MobileExpenseDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  const { data: expense, isLoading, error } = useExpenseRequest(id);
  const deleteExpenseRequest = useDeleteExpenseRequest();

  const handleDelete = async () => {
    await deleteExpenseRequest.mutateAsync(id);
    navigate({ to: "/mobile/expenses" });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading expense...</p>
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
          <div className="flex items-center px-4 py-3">
            <Link to="/mobile/expenses">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-semibold ml-3">Expense Details</h1>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
          <div className="p-3 rounded-full bg-red-500/10 mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Expense not found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            This expense request may have been deleted or you don't have access to it.
          </p>
          <Link to="/mobile/expenses">
            <Button variant="outline">Back to Expenses</Button>
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[expense.status as ExpenseRequestStatus];
  const StatusIcon = statusConfig.icon;
  const canEdit = expense.status === "pending" && expense.requesterId === session?.user?.id;
  const canDelete = expense.status === "pending" && expense.requesterId === session?.user?.id;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/mobile/expenses">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold">Expense Details</h1>
            </div>
          </div>
          {(canEdit || canDelete) && (
            <div className="flex items-center gap-2">
              {canEdit && (
                <Link to="/mobile/expenses/$id" params={{ id }}>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Edit className="h-5 w-5" />
                  </Button>
                </Link>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-red-500 hover:text-red-600"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Status Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className={cn("p-3 rounded-full", statusConfig.bgClass)}>
                <StatusIcon className={cn("w-6 h-6", statusConfig.colorClass)} />
              </div>
              <div className="flex-1">
                <Badge
                  variant="outline"
                  className={cn(statusConfig.bgClass, statusConfig.colorClass, "border-0 mb-1")}
                >
                  {statusConfig.label}
                </Badge>
                <p className="text-sm text-muted-foreground">{statusConfig.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Amount Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <span className="text-muted-foreground">Amount</span>
              </div>
              <span className="text-2xl font-bold">
                {formatCurrency(expense.amount, expense.currency)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Details Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Purpose</p>
                <p className="text-sm text-muted-foreground">{expense.purpose}</p>
              </div>
            </div>

            {expense.description && (
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Description</p>
                  <p className="text-sm text-muted-foreground">{expense.description}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Submitted</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(expense.createdAt), "PPP 'at' p")}
                </p>
              </div>
            </div>

            {expense.receiptUrl && (
              <div className="flex items-center gap-3">
                <Receipt className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Receipt</p>
                  <a
                    href={expense.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    View attached receipt
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rejection Reason Card */}
        {expense.status === "rejected" && expense.rejectionReason && (
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-red-600 dark:text-red-400">
                Rejection Reason
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{expense.rejectionReason}</p>
              {expense.rejectedAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  Rejected on {format(new Date(expense.rejectedAt), "PPP")}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Approval Info Card */}
        {expense.status === "approved" && expense.approvedAt && (
          <Card className="border-green-200 dark:border-green-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-green-600 dark:text-green-400">
                Approval Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Approved on {format(new Date(expense.approvedAt), "PPP 'at' p")}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Disbursement Info Card */}
        {expense.status === "disbursed" && expense.disbursedAt && (
          <Card className="border-blue-200 dark:border-blue-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-blue-600 dark:text-blue-400">
                Disbursement Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Disbursed on {format(new Date(expense.disbursedAt), "PPP 'at' p")}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Timeline Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Created */}
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Request Created</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(expense.createdAt), "PPP 'at' p")}
                  </p>
                </div>
              </div>

              {/* Approved */}
              {expense.approvedAt && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Approved</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(expense.approvedAt), "PPP 'at' p")}
                    </p>
                  </div>
                </div>
              )}

              {/* Rejected */}
              {expense.rejectedAt && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Rejected</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(expense.rejectedAt), "PPP 'at' p")}
                    </p>
                  </div>
                </div>
              )}

              {/* Disbursed */}
              {expense.disbursedAt && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Disbursed</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(expense.disbursedAt), "PPP 'at' p")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Delete Expense Request
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense request? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteExpenseRequest.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteExpenseRequest.isPending}
            >
              {deleteExpenseRequest.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
