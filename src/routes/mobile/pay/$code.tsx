/**
 * Direct Payment by Code Route
 *
 * Handles payments when a QR code links directly to a payment URL
 * e.g., /mobile/pay/PAY-ABC123 or /mobile/pay/QR-xxxxxxxxx
 */

import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  Wallet,
  User,
  Clock,
  Receipt,
  Share2,
  Home,
  QrCode,
} from "lucide-react";
import { authClient } from "~/lib/auth-client";
import { redirect } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import {
  useQrPaymentByQrCode,
  useQrPaymentByShortCode,
  useProcessQrPayment,
  usePaymentIdempotencyKey,
} from "~/hooks/useQrPayments";
import { QR_PAYMENT_CURRENCIES } from "~/fn/qr-payments";
import { useMyWalletBalance } from "~/hooks/useWalletBalance";

export const Route = createFileRoute("/mobile/pay/$code")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: "/mobile/pay" },
      });
    }
  },
  component: DirectPaymentPage,
});

// Currency formatting helper
function formatCurrency(amount: string | number, currency: string = "USD"): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(numAmount);
}

// Date formatting helper
function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

// Payment steps
type PaymentStep = "loading" | "preview" | "confirm" | "processing" | "success" | "error";

function DirectPaymentPage() {
  const navigate = useNavigate();
  const { code } = Route.useParams();
  const [step, setStep] = React.useState<PaymentStep>("loading");
  const [customAmount, setCustomAmount] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState("");
  const [transactionId, setTransactionId] = React.useState<string | null>(null);

  // Hooks
  const walletBalance = useMyWalletBalance();
  const processPayment = useProcessQrPayment();
  const { generateKey } = usePaymentIdempotencyKey();

  // Determine if it's a QR code or short code based on prefix
  const isQrCode = code.startsWith("QR-");
  const qrPaymentQuery = useQrPaymentByQrCode(isQrCode ? code : "");
  const shortCodeQuery = useQrPaymentByShortCode(isQrCode ? "" : code);

  // Get the appropriate payment data
  const paymentData = isQrCode ? qrPaymentQuery.data : shortCodeQuery.data;
  const isLoading = isQrCode ? qrPaymentQuery.isLoading : shortCodeQuery.isLoading;
  const queryError = isQrCode ? qrPaymentQuery.error : shortCodeQuery.error;

  // Initialize step based on query state
  React.useEffect(() => {
    if (isLoading) {
      setStep("loading");
    } else if (queryError) {
      setErrorMessage((queryError as Error).message || "Payment not found or expired");
      setStep("error");
    } else if (paymentData) {
      setStep("preview");
    }
  }, [isLoading, queryError, paymentData]);

  // Calculate final amount (for flexible payments)
  const finalAmount = React.useMemo(() => {
    if (!paymentData) return "0.00";
    if (customAmount) {
      return customAmount;
    }
    return paymentData.amount;
  }, [paymentData, customAmount]);

  // Parse merchant info
  const merchantInfo = React.useMemo(() => {
    if (!paymentData?.merchantInfo) return { merchantName: "Unknown Merchant" };
    try {
      return JSON.parse(paymentData.merchantInfo);
    } catch {
      return { merchantName: "Unknown Merchant" };
    }
  }, [paymentData]);

  // Check if flexible amount payment
  const isFlexibleAmount = paymentData?.minAmount || paymentData?.maxAmount;

  // Handle payment confirmation
  const handleConfirmPayment = async () => {
    if (!paymentData || !walletBalance.data?.walletId) return;

    setStep("processing");

    try {
      const result = await processPayment.mutateAsync({
        qrPaymentId: paymentData.id,
        payerWalletId: walletBalance.data.walletId,
        paidAmount: finalAmount,
        paidCurrency: paymentData.currency as typeof QR_PAYMENT_CURRENCIES[number],
        idempotencyKey: generateKey(),
      });

      setTransactionId(result.transactionId || result.id);
      setStep("success");
    } catch (error: any) {
      setErrorMessage(error.message || "Payment failed");
      setStep("error");
    }
  };

  // Reset and go back to scanner
  const handleReset = () => {
    navigate({ to: "/mobile/pay" });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/mobile/pay">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold">Payment</h1>
              <p className="text-xs text-muted-foreground">
                {step === "loading" && "Loading payment..."}
                {step === "preview" && "Review payment details"}
                {step === "confirm" && "Confirm payment"}
                {step === "processing" && "Processing..."}
                {step === "success" && "Payment successful"}
                {step === "error" && "Payment failed"}
              </p>
            </div>
          </div>
          {walletBalance.data && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className="text-sm font-semibold">
                {formatCurrency(walletBalance.data.availableBalance, walletBalance.data.currency)}
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Loading Step */}
        {step === "loading" && (
          <div className="flex-1 flex items-center justify-center p-8 min-h-[300px]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-lg font-medium">Loading Payment...</p>
              <p className="text-sm text-muted-foreground mt-2">
                Fetching payment details for {code}
              </p>
            </div>
          </div>
        )}

        {/* Preview Step */}
        {step === "preview" && paymentData && (
          <div className="p-4 space-y-4">
            {/* Merchant Info Card */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    {merchantInfo.merchantLogo ? (
                      <img
                        src={merchantInfo.merchantLogo}
                        alt={merchantInfo.merchantName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{merchantInfo.merchantName}</p>
                    {merchantInfo.businessType && (
                      <p className="text-sm text-muted-foreground">
                        {merchantInfo.businessType}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Code: {paymentData.shortCode}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Amount Card */}
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">Amount to Pay</p>
                {isFlexibleAmount ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-medium text-muted-foreground">
                        {paymentData.currency === "USD" ? "$" : paymentData.currency}
                      </span>
                      <Input
                        type="number"
                        value={customAmount || paymentData.amount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className="text-center text-3xl font-bold h-16 pl-12"
                        min={paymentData.minAmount ? parseFloat(paymentData.minAmount) : 0.01}
                        max={paymentData.maxAmount ? parseFloat(paymentData.maxAmount) : undefined}
                        step="0.01"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {paymentData.minAmount && `Min: ${formatCurrency(paymentData.minAmount, paymentData.currency)}`}
                      {paymentData.minAmount && paymentData.maxAmount && " • "}
                      {paymentData.maxAmount && `Max: ${formatCurrency(paymentData.maxAmount, paymentData.currency)}`}
                    </p>
                  </div>
                ) : (
                  <p className="text-4xl font-bold text-primary">
                    {formatCurrency(paymentData.amount, paymentData.currency)}
                  </p>
                )}
                {paymentData.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {paymentData.description}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Payment Details */}
            <Card>
              <CardContent className="p-4 space-y-3">
                {paymentData.expiresAt && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Expires</span>
                    </div>
                    <span>{formatDate(paymentData.expiresAt)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Wallet className="h-4 w-4" />
                    <span>Your Balance</span>
                  </div>
                  <span className="font-medium">
                    {formatCurrency(
                      walletBalance.data?.availableBalance || "0.00",
                      walletBalance.data?.currency || "USD"
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm border-t pt-3">
                  <span className="font-medium">Balance After</span>
                  <span
                    className={cn(
                      "font-semibold",
                      parseFloat(walletBalance.data?.availableBalance || "0") -
                        parseFloat(finalAmount) <
                        0 && "text-destructive"
                    )}
                  >
                    {formatCurrency(
                      Math.max(
                        0,
                        parseFloat(walletBalance.data?.availableBalance || "0") -
                          parseFloat(finalAmount)
                      ),
                      walletBalance.data?.currency || "USD"
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Insufficient Balance Warning */}
            {parseFloat(walletBalance.data?.availableBalance || "0") <
              parseFloat(finalAmount) && (
              <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                <div>
                  <p className="font-medium text-destructive">Insufficient Balance</p>
                  <p className="text-sm text-muted-foreground">
                    Please top up your wallet to complete this payment.
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleReset}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => setStep("confirm")}
                disabled={
                  parseFloat(walletBalance.data?.availableBalance || "0") <
                  parseFloat(finalAmount)
                }
              >
                Proceed to Pay
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Confirm Step */}
        {step === "confirm" && paymentData && (
          <div className="p-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-center">Confirm Payment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-2">You are paying</p>
                  <p className="text-4xl font-bold text-primary">
                    {formatCurrency(finalAmount, paymentData.currency)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    to {merchantInfo.merchantName}
                  </p>
                </div>

                <div className="border-t pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Code</span>
                    <span className="font-mono">{paymentData.shortCode}</span>
                  </div>
                  {paymentData.description && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Description</span>
                      <span>{paymentData.description}</span>
                    </div>
                  )}
                </div>

                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200 text-center">
                    Please verify the details before confirming. Payments cannot be reversed.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep("preview")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmPayment}
              >
                Confirm & Pay
              </Button>
            </div>
          </div>
        )}

        {/* Processing Step */}
        {step === "processing" && (
          <div className="flex-1 flex items-center justify-center p-8 min-h-[300px]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-lg font-medium">Processing Payment...</p>
              <p className="text-sm text-muted-foreground mt-2">
                Please wait while we process your payment
              </p>
            </div>
          </div>
        )}

        {/* Success Step */}
        {step === "success" && paymentData && (
          <div className="p-4 space-y-4">
            <div className="text-center py-8">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Payment Successful!</h2>
              <p className="text-muted-foreground">
                Your payment has been processed successfully
              </p>
            </div>

            {/* Receipt Card */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Receipt
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-8">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount Paid</span>
                  <span className="font-semibold text-lg text-primary">
                    {formatCurrency(finalAmount, paymentData.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paid To</span>
                  <span>{merchantInfo.merchantName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment Code</span>
                  <span className="font-mono">{paymentData.shortCode}</span>
                </div>
                {transactionId && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Transaction ID</span>
                    <span className="font-mono text-xs">{transactionId.slice(0, 12)}...</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date</span>
                  <span>{formatDate(new Date())}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-3">
                  <span className="text-muted-foreground">New Balance</span>
                  <span className="font-medium">
                    {formatCurrency(
                      parseFloat(walletBalance.data?.availableBalance || "0") -
                        parseFloat(finalAmount),
                      walletBalance.data?.currency || "USD"
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4">
              <Link to="/mobile/pay">
                <Button className="w-full">
                  <QrCode className="h-4 w-4 mr-2" />
                  Scan Another QR Code
                </Button>
              </Link>
              <Link to="/mobile" className="block">
                <Button variant="outline" className="w-full">
                  <Home className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Error Step */}
        {step === "error" && (
          <div className="p-4 space-y-4">
            <div className="text-center py-8">
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Payment Failed</h2>
              <p className="text-muted-foreground">
                {errorMessage || "Something went wrong with your payment"}
              </p>
            </div>

            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-destructive mb-1">Error Details</p>
                    <p className="text-muted-foreground">{errorMessage}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4">
              <Button
                className="w-full"
                onClick={handleReset}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Link to="/mobile" className="block">
                <Button variant="outline" className="w-full">
                  <Home className="h-4 w-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
