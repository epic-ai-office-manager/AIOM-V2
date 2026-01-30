/**
 * QR Scanner Payment Page
 *
 * Mobile camera interface for scanning payment QR codes with:
 * - Camera-based QR scanning
 * - Manual code entry fallback
 * - Amount preview and confirmation
 * - Receipt display
 */

import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  QrCode,
  Keyboard,
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
} from "lucide-react";
import { authClient } from "~/lib/auth-client";
import { redirect } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import {
  useQrPaymentByQrCode,
  useQrPaymentByShortCode,
  useProcessQrPayment,
  useScanQrCode,
  usePaymentIdempotencyKey,
} from "~/hooks/useQrPayments";
import { QR_PAYMENT_CURRENCIES } from "~/fn/qr-payments";
import { useMyWalletBalance } from "~/hooks/useWalletBalance";

export const Route = createFileRoute("/mobile/pay/")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: "/mobile/pay" },
      });
    }
  },
  component: QrScannerPage,
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

// Scanner steps
type ScannerStep = "scan" | "preview" | "confirm" | "processing" | "success" | "error";

// QR payment data type
interface QrPaymentData {
  id: string;
  qrCode: string;
  shortCode: string;
  amount: string;
  currency: string;
  description: string | null;
  merchantInfo: string;
  merchantId: string;
  expiresAt: Date | null;
  minAmount: string | null;
  maxAmount: string | null;
  status: string;
}

function QrScannerPage() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState<ScannerStep>("scan");
  const [inputMode, setInputMode] = React.useState<"camera" | "manual">("camera");
  const [manualCode, setManualCode] = React.useState("");
  const [paymentData, setPaymentData] = React.useState<QrPaymentData | null>(null);
  const [customAmount, setCustomAmount] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState("");
  const [cameraPermission, setCameraPermission] = React.useState<"granted" | "denied" | "prompt">("prompt");
  const [isScanning, setIsScanning] = React.useState(false);
  const [transactionId, setTransactionId] = React.useState<string | null>(null);

  // Video ref for camera
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const scanIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // Hooks
  const walletBalance = useMyWalletBalance();
  const scanQrCode = useScanQrCode();
  const processPayment = useProcessQrPayment();
  const { generateKey } = usePaymentIdempotencyKey();

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

  // Cleanup camera on unmount
  React.useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Start camera when in scan mode and camera input selected
  React.useEffect(() => {
    if (step === "scan" && inputMode === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
  }, [step, inputMode]);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraPermission("granted");
        setIsScanning(true);
        startScanning();
      }
    } catch (error: any) {
      console.error("Camera error:", error);
      if (error.name === "NotAllowedError") {
        setCameraPermission("denied");
      }
      setInputMode("manual");
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  // Start QR scanning (using native BarcodeDetector if available)
  const startScanning = () => {
    // Check for BarcodeDetector API support
    if ("BarcodeDetector" in window) {
      const barcodeDetector = new (window as any).BarcodeDetector({
        formats: ["qr_code"],
      });

      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState !== 4) return;

        try {
          const barcodes = await barcodeDetector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const qrValue = barcodes[0].rawValue;
            if (qrValue) {
              stopCamera();
              handleQrCodeScanned(qrValue);
            }
          }
        } catch (error) {
          console.error("Scan error:", error);
        }
      }, 200);
    } else {
      // Fallback: Show manual entry since BarcodeDetector not supported
      console.log("BarcodeDetector not supported, falling back to manual entry");
      setInputMode("manual");
    }
  };

  // Handle scanned QR code
  const handleQrCodeScanned = async (qrCodeOrUrl: string) => {
    setStep("processing");

    try {
      const result = await scanQrCode.mutateAsync(qrCodeOrUrl);

      if (result) {
        setPaymentData(result as QrPaymentData);
        setStep("preview");
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Failed to process QR code");
      setStep("error");
    }
  };

  // Handle manual code submission
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    setStep("processing");

    try {
      const result = await scanQrCode.mutateAsync(manualCode.trim());

      if (result) {
        setPaymentData(result as QrPaymentData);
        setStep("preview");
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Invalid QR code or short code");
      setStep("error");
    }
  };

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

  // Reset and start over
  const handleReset = () => {
    setStep("scan");
    setInputMode("camera");
    setManualCode("");
    setPaymentData(null);
    setCustomAmount("");
    setErrorMessage("");
    setTransactionId(null);
    processPayment.reset();
    scanQrCode.reset();
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/mobile">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold">Scan to Pay</h1>
              <p className="text-xs text-muted-foreground">
                {step === "scan" && "Scan a payment QR code"}
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
              <p className="text-sm font-semibold" data-testid="wallet-balance-display">
                {formatCurrency(walletBalance.data.availableBalance, walletBalance.data.currency)}
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Scan Step */}
        {step === "scan" && (
          <div className="flex flex-col h-full">
            {/* Camera View */}
            {inputMode === "camera" && (
              <div className="relative flex-1 bg-black">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  data-testid="camera-view"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Scanning Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-64 h-64">
                    {/* Corner Brackets */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />

                    {/* Scanning Line Animation */}
                    {isScanning && (
                      <div className="absolute inset-x-4 top-4 bottom-4 overflow-hidden">
                        <div className="w-full h-0.5 bg-primary animate-[scan_2s_ease-in-out_infinite]" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Camera Permission Denied */}
                {cameraPermission === "denied" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    <div className="text-center text-white p-6">
                      <CameraOff className="h-12 w-12 mx-auto mb-4 opacity-70" />
                      <p className="text-lg font-medium mb-2">Camera Access Denied</p>
                      <p className="text-sm opacity-70 mb-4">
                        Please enable camera access in your device settings
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => setInputMode("manual")}
                        className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                      >
                        Enter Code Manually
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Manual Entry */}
            {inputMode === "manual" && (
              <div className="flex-1 p-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <QrCode className="h-5 w-5" />
                      Enter Payment Code
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleManualSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Input
                          type="text"
                          placeholder="Enter QR code or short code (e.g., PAY-ABC123)"
                          value={manualCode}
                          onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                          className="text-center font-mono text-lg"
                          data-testid="manual-code-input"
                          autoFocus
                        />
                        <p className="text-xs text-muted-foreground text-center">
                          Enter the payment code shown by the merchant
                        </p>
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={!manualCode.trim() || scanQrCode.isPending}
                        data-testid="manual-submit-btn"
                      >
                        {scanQrCode.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            Continue
                            <ChevronRight className="h-4 w-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Mode Toggle */}
            <div className="p-4 border-t bg-background">
              <div className="flex gap-2">
                <Button
                  variant={inputMode === "camera" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setInputMode("camera")}
                  disabled={cameraPermission === "denied"}
                  data-testid="camera-mode-btn"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Scan QR
                </Button>
                <Button
                  variant={inputMode === "manual" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setInputMode("manual")}
                  data-testid="manual-mode-btn"
                >
                  <Keyboard className="h-4 w-4 mr-2" />
                  Enter Code
                </Button>
              </div>
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
                    <p className="font-semibold" data-testid="merchant-name">
                      {merchantInfo.merchantName}
                    </p>
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
                        data-testid="custom-amount-input"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {paymentData.minAmount && `Min: ${formatCurrency(paymentData.minAmount, paymentData.currency)}`}
                      {paymentData.minAmount && paymentData.maxAmount && " • "}
                      {paymentData.maxAmount && `Max: ${formatCurrency(paymentData.maxAmount, paymentData.currency)}`}
                    </p>
                  </div>
                ) : (
                  <p className="text-4xl font-bold text-primary" data-testid="payment-amount">
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
                data-testid="proceed-to-confirm-btn"
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
                  <p className="text-4xl font-bold text-primary" data-testid="confirm-amount">
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
                data-testid="confirm-payment-btn"
              >
                Confirm & Pay
              </Button>
            </div>
          </div>
        )}

        {/* Processing Step */}
        {step === "processing" && (
          <div className="flex-1 flex items-center justify-center p-8">
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
            <Card data-testid="payment-receipt">
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
              <Button
                className="w-full"
                onClick={handleReset}
                data-testid="scan-another-btn"
              >
                <QrCode className="h-4 w-4 mr-2" />
                Scan Another QR Code
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
                data-testid="try-again-btn"
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

      {/* Custom CSS for scanning animation */}
      <style>
        {`
          @keyframes scan {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(calc(100% - 2px));
            }
          }
        `}
      </style>
    </div>
  );
}
