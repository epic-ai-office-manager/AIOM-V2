/**
 * Mobile Top-Up Transaction Detail Page
 *
 * Displays detailed information about a specific top-up transaction
 * including receipt and status.
 */

import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Smartphone,
  ChevronRight,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Receipt,
  Copy,
  Share2,
  Download,
  ExternalLink,
} from "lucide-react";
import { authClient } from "~/lib/auth-client";
import { redirect } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { toast } from "sonner";
import {
  useMobileTopupTransaction,
  useMobileTopupReceipt,
} from "~/hooks/useMobileTopup";

export const Route = createFileRoute("/mobile/topup/$transactionId")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: "/mobile/topup/history" },
      });
    }
  },
  component: TransactionDetailPage,
});

// Status configuration
const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    description: "Your top-up is being processed",
    icon: Clock,
    colorClass: "text-yellow-600",
    bgClass: "bg-yellow-500/10",
  },
  processing: {
    label: "Processing",
    description: "Top-up is being sent to the network",
    icon: RefreshCw,
    colorClass: "text-blue-600",
    bgClass: "bg-blue-500/10",
  },
  successful: {
    label: "Successful",
    description: "Top-up was delivered successfully",
    icon: CheckCircle,
    colorClass: "text-green-600",
    bgClass: "bg-green-500/10",
  },
  failed: {
    label: "Failed",
    description: "Top-up could not be completed",
    icon: XCircle,
    colorClass: "text-red-600",
    bgClass: "bg-red-500/10",
  },
  refunded: {
    label: "Refunded",
    description: "Amount has been refunded to your wallet",
    icon: RefreshCw,
    colorClass: "text-purple-600",
    bgClass: "bg-purple-500/10",
  },
};

type StatusType = keyof typeof STATUS_CONFIG;

// Format currency
function formatCurrency(amount: string, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseFloat(amount));
}

// Format date
function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function TransactionDetailPage() {
  const { transactionId } = Route.useParams();
  const navigate = useNavigate();

  // Hooks
  const {
    data: transaction,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useMobileTopupTransaction(transactionId);
  const { data: receipt, isLoading: receiptLoading } =
    useMobileTopupReceipt(transactionId);

  // Copy transaction ID
  const handleCopyId = () => {
    navigator.clipboard.writeText(transactionId);
    toast.success("Transaction ID copied");
  };

  // Share transaction
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Mobile Top-Up Receipt",
          text: `Top-up of ${transaction?.requestedAmount} to ${transaction?.recipientPhone}`,
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      handleCopyId();
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
          <div className="flex items-center gap-3 px-4 py-3">
            <Link to="/mobile/topup/history">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">Transaction Details</h1>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
          <div className="flex items-center gap-3 px-4 py-3">
            <Link to="/mobile/topup/history">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">Transaction Details</h1>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="font-semibold mb-2">Transaction Not Found</h2>
          <p className="text-sm text-muted-foreground text-center mb-4">
            The transaction you're looking for doesn't exist or you don't have access to it.
          </p>
          <Link to="/mobile/topup/history">
            <Button>View All Transactions</Button>
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[transaction.status as StatusType] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/mobile/topup/history">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">Transaction Details</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={cn("h-5 w-5", isRefetching && "animate-spin")} />
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Status Card */}
        <Card className={cn("border-2", statusConfig.bgClass.replace("/10", "/20"))}>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center mb-4",
                  statusConfig.bgClass
                )}
              >
                <StatusIcon className={cn("h-8 w-8", statusConfig.colorClass)} />
              </div>
              <h2 className={cn("text-xl font-semibold", statusConfig.colorClass)}>
                {statusConfig.label}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {statusConfig.description}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Amount Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Amount Sent</p>
              <p className="text-3xl font-bold mt-1">
                {formatCurrency(
                  transaction.requestedAmount,
                  transaction.requestedAmountCurrency
                )}
              </p>
              {transaction.deliveredAmount && (
                <p className="text-sm text-muted-foreground mt-2">
                  Delivered: {formatCurrency(
                    transaction.deliveredAmount,
                    transaction.deliveredAmountCurrency ?? "USD"
                  )}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transaction Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recipient */}
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Recipient</span>
              <span className="font-medium">
                +{transaction.recipientCountryCode} {transaction.recipientPhone}
              </span>
            </div>

            {/* Operator */}
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Operator</span>
              <span className="font-medium">{transaction.operatorName}</span>
            </div>

            {/* Date */}
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{formatDate(transaction.createdAt)}</span>
            </div>

            {/* Transaction ID */}
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Transaction ID</span>
              <button
                onClick={handleCopyId}
                className="flex items-center gap-2 text-sm font-mono hover:text-primary"
              >
                {transaction.id.slice(0, 12)}...
                <Copy className="h-3 w-3" />
              </button>
            </div>

            {/* Reloadly Transaction ID */}
            {transaction.reloadlyTransactionId && (
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">Reference</span>
                <span className="font-mono text-sm">
                  {transaction.reloadlyTransactionId}
                </span>
              </div>
            )}

            {/* Error Message */}
            {transaction.errorMessage && (
              <div className="py-2 border-b">
                <span className="text-muted-foreground block mb-1">Error</span>
                <span className="text-sm text-red-600">
                  {transaction.errorMessage}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receipt Card */}
        {receipt && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Receipt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-muted rounded-lg p-4 text-sm font-mono space-y-2">
                <p>Amount: {receipt.amountCharged} {receipt.amountChargedCurrency}</p>
                {receipt.amountDelivered && (
                  <p>Delivered: {receipt.amountDelivered} {receipt.amountDeliveredCurrency}</p>
                )}
                <p>Recipient: +{receipt.recipientCountryCode} {receipt.recipientPhone}</p>
                <p>Operator: {receipt.operatorName}</p>
                <p>Date: {formatDate(receipt.createdAt)}</p>
                <p>Ref: {receipt.transactionId}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Link to="/mobile/topup" className="flex-1">
            <Button className="w-full">
              <Smartphone className="h-4 w-4 mr-2" />
              New Top-Up
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
