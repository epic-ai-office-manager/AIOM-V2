/**
 * Mobile Top-Up Page
 *
 * Main page for purchasing mobile airtime/data with recipient selection,
 * amount entry, operator detection, and confirmation flow.
 */

import * as React from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Smartphone,
  ChevronRight,
  Loader2,
  Search,
  Plus,
  History,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  X,
  Wallet,
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
  useMobileTopupService,
  useOperator,
  useTopupEligibility,
  useSendMobileTopup,
} from "~/hooks/useMobileTopup";
import { useMyWalletBalance } from "~/hooks/useWalletBalance";
import type { ReloadlyOperator, ReloadlyCountry } from "~/lib/reloadly";

export const Route = createFileRoute("/mobile/topup/")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: "/mobile/topup" },
      });
    }
  },
  component: MobileTopupPage,
});

// Common country codes for quick selection
const POPULAR_COUNTRIES = [
  { code: "NG", name: "Nigeria", flag: "🇳🇬", callingCode: "+234" },
  { code: "GH", name: "Ghana", flag: "🇬🇭", callingCode: "+233" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", callingCode: "+254" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", callingCode: "+27" },
  { code: "IN", name: "India", flag: "🇮🇳", callingCode: "+91" },
  { code: "PH", name: "Philippines", flag: "🇵🇭", callingCode: "+63" },
];

// Preset amounts in USD
const PRESET_AMOUNTS = [5, 10, 15, 20, 25, 50];

// Format currency
function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Wizard steps
type Step = "recipient" | "amount" | "confirm" | "success";

function MobileTopupPage() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState<Step>("recipient");
  const [selectedCountry, setSelectedCountry] = React.useState<typeof POPULAR_COUNTRIES[0] | null>(null);
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [selectedOperator, setSelectedOperator] = React.useState<ReloadlyOperator | null>(null);
  const [amount, setAmount] = React.useState<number>(0);
  const [customAmount, setCustomAmount] = React.useState("");
  const [showCountryPicker, setShowCountryPicker] = React.useState(false);
  const [showOperatorPicker, setShowOperatorPicker] = React.useState(false);
  const [countrySearch, setCountrySearch] = React.useState("");

  // Hooks
  const {
    countries,
    countriesLoading,
    operators,
    operatorsLoading,
    detectOperator,
    detectOperatorAsync,
    isDetectingOperator,
    detectedOperator,
    recentTransactions,
    transactionsLoading,
    stats,
  } = useMobileTopupService(selectedCountry?.code);

  const walletBalance = useMyWalletBalance();
  const sendTopup = useSendMobileTopup();

  // Check eligibility when amount and operator are selected
  const eligibility = useTopupEligibility(
    selectedOperator?.operatorId ?? 0,
    amount
  );

  // Filter countries based on search
  const filteredCountries = React.useMemo(() => {
    if (!countrySearch) return countries;
    const search = countrySearch.toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.isoName.toLowerCase().includes(search)
    );
  }, [countries, countrySearch]);

  // Auto-detect operator when phone number changes
  React.useEffect(() => {
    if (selectedCountry && phoneNumber.length >= 7) {
      const fullPhone = phoneNumber.startsWith("0")
        ? phoneNumber.slice(1)
        : phoneNumber;
      detectOperatorAsync({
        phone: `${selectedCountry.callingCode.replace("+", "")}${fullPhone}`,
        countryCode: selectedCountry.code,
      }).then((result) => {
        if (result.success && result.operator) {
          // Operator detection returns a different shape than ReloadlyOperator.
          // Keep selectedOperator unchanged; user can pick from the operator list.
        }
      }).catch(() => {
        // Ignore detection errors
      });
    }
  }, [phoneNumber, selectedCountry, detectOperatorAsync]);

  // Handle amount selection
  const handleAmountSelect = (selectedAmount: number) => {
    setAmount(selectedAmount);
    setCustomAmount("");
  };

  // Handle custom amount
  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed > 0) {
      setAmount(parsed);
    } else {
      setAmount(0);
    }
  };

  // Handle continue to next step
  const handleContinue = () => {
    if (step === "recipient" && selectedCountry && phoneNumber && selectedOperator) {
      setStep("amount");
    } else if (step === "amount" && amount > 0) {
      setStep("confirm");
    }
  };

  // Handle send top-up
  const handleSendTopup = async () => {
    if (!selectedCountry || !phoneNumber || !selectedOperator || amount <= 0) {
      return;
    }

    const fullPhone = phoneNumber.startsWith("0")
      ? phoneNumber.slice(1)
      : phoneNumber;

    const result = await sendTopup.mutateAsync({
      operatorId: selectedOperator.operatorId,
      amount,
      useLocalAmount: false,
      recipientPhone: {
        countryCode: selectedCountry.callingCode.replace("+", ""),
        number: fullPhone,
      },
      idempotencyKey: `topup-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    });

    if (result.success) {
      setStep("success");
    }
  };

  // Reset and start over
  const handleReset = () => {
    setStep("recipient");
    setSelectedCountry(null);
    setPhoneNumber("");
    setSelectedOperator(null);
    setAmount(0);
    setCustomAmount("");
    sendTopup.reset();
  };

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case "recipient":
        return (
          <RecipientStep
            selectedCountry={selectedCountry}
            phoneNumber={phoneNumber}
            selectedOperator={selectedOperator}
            isDetectingOperator={isDetectingOperator}
            operators={operators}
            operatorsLoading={operatorsLoading}
            onCountrySelect={() => setShowCountryPicker(true)}
            onPhoneChange={setPhoneNumber}
            onOperatorSelect={() => setShowOperatorPicker(true)}
            onContinue={handleContinue}
            recentTransactions={recentTransactions}
          />
        );

      case "amount":
        return (
          <AmountStep
            amount={amount}
            customAmount={customAmount}
            selectedOperator={selectedOperator}
            walletBalance={walletBalance.data?.availableBalance ?? "0.00"}
            walletCurrency={walletBalance.data?.currency ?? "USD"}
            eligibility={eligibility.data}
            isCheckingEligibility={eligibility.isLoading}
            onAmountSelect={handleAmountSelect}
            onCustomAmountChange={handleCustomAmountChange}
            onBack={() => setStep("recipient")}
            onContinue={handleContinue}
          />
        );

      case "confirm":
        return (
          <ConfirmStep
            selectedCountry={selectedCountry}
            phoneNumber={phoneNumber}
            selectedOperator={selectedOperator}
            amount={amount}
            walletBalance={walletBalance.data?.availableBalance ?? "0.00"}
            isPending={sendTopup.isPending}
            onBack={() => setStep("amount")}
            onConfirm={handleSendTopup}
          />
        );

      case "success":
        return (
          <SuccessStep
            amount={amount}
            phoneNumber={phoneNumber}
            selectedCountry={selectedCountry}
            selectedOperator={selectedOperator}
            transactionId={sendTopup.data?.transaction?.id}
            onNewTopup={handleReset}
            onViewHistory={() => navigate({ to: "/mobile/topup/history" })}
          />
        );
    }
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
              <h1 className="text-lg font-semibold">Mobile Top-Up</h1>
              <p className="text-xs text-muted-foreground">
                {step === "recipient" && "Enter recipient details"}
                {step === "amount" && "Select amount"}
                {step === "confirm" && "Review & confirm"}
                {step === "success" && "Transaction complete"}
              </p>
            </div>
          </div>
          <Link to="/mobile/topup/history">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <History className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Progress indicator */}
      {step !== "success" && (
        <div className="px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            {["recipient", "amount", "confirm"].map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
                    step === s
                      ? "bg-primary text-primary-foreground"
                      : ["recipient", "amount", "confirm"].indexOf(step) > i
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {i + 1}
                </div>
                {i < 2 && (
                  <div
                    className={cn(
                      "flex-1 h-1 rounded",
                      ["recipient", "amount", "confirm"].indexOf(step) > i
                        ? "bg-primary"
                        : "bg-muted"
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        {renderStepContent()}
      </div>

      {/* Country Picker Dialog */}
      <Dialog open={showCountryPicker} onOpenChange={setShowCountryPicker}>
        <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Country</DialogTitle>
          </DialogHeader>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search countries..."
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex-1 overflow-auto space-y-1">
            {/* Popular countries first */}
            {!countrySearch && (
              <>
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                  Popular
                </p>
                {POPULAR_COUNTRIES.map((country) => (
                  <button
                    key={country.code}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-left"
                    onClick={() => {
                      setSelectedCountry(country);
                      setSelectedOperator(null);
                      setShowCountryPicker(false);
                      setCountrySearch("");
                    }}
                  >
                    <span className="text-xl">{country.flag}</span>
                    <div className="flex-1">
                      <p className="font-medium">{country.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {country.callingCode}
                      </p>
                    </div>
                    {selectedCountry?.code === country.code && (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    )}
                  </button>
                ))}
                <div className="border-t my-2" />
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                  All Countries
                </p>
              </>
            )}
            {countriesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCountries.length > 0 ? (
              filteredCountries.map((country) => (
                <button
                  key={country.isoName}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-left"
                  onClick={() => {
                    const match = POPULAR_COUNTRIES.find(
                      (c) => c.code === country.isoName
                    );
                    setSelectedCountry(
                      match ?? {
                        code: country.isoName,
                        name: country.name,
                        flag: country.flag ?? "🏳️",
                        callingCode: country.callingCodes?.[0] ?? "",
                      }
                    );
                    setSelectedOperator(null);
                    setShowCountryPicker(false);
                    setCountrySearch("");
                  }}
                >
                  <span className="text-xl">{country.flag ?? "🏳️"}</span>
                  <div className="flex-1">
                    <p className="font-medium">{country.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {country.callingCodes?.[0] ?? ""}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No countries found
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Operator Picker Dialog */}
      <Dialog open={showOperatorPicker} onOpenChange={setShowOperatorPicker}>
        <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Operator</DialogTitle>
            <DialogDescription>
              Choose your mobile network operator
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-2">
            {operatorsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : operators.length > 0 ? (
              operators.map((op) => (
                <button
                  key={op.operatorId}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-lg border text-left transition-colors",
                    selectedOperator?.operatorId === op.operatorId
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  )}
                  onClick={() => {
                    setSelectedOperator(op);
                    setShowOperatorPicker(false);
                  }}
                >
                  {op.logoUrls?.[0] ? (
                    <img
                      src={op.logoUrls[0]}
                      alt={op.name}
                      className="w-10 h-10 rounded object-contain bg-white"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{op.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {op.bundle ? "Bundles available" : "Airtime only"}
                    </p>
                  </div>
                  {selectedOperator?.operatorId === op.operatorId && (
                    <CheckCircle className="h-5 w-5 text-primary" />
                  )}
                </button>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No operators available for this country
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// Step Components
// =============================================================================

function RecipientStep({
  selectedCountry,
  phoneNumber,
  selectedOperator,
  isDetectingOperator,
  operators,
  operatorsLoading,
  onCountrySelect,
  onPhoneChange,
  onOperatorSelect,
  onContinue,
  recentTransactions,
}: {
  selectedCountry: typeof POPULAR_COUNTRIES[0] | null;
  phoneNumber: string;
  selectedOperator: ReloadlyOperator | null;
  isDetectingOperator: boolean;
  operators: ReloadlyOperator[];
  operatorsLoading: boolean;
  onCountrySelect: () => void;
  onPhoneChange: (value: string) => void;
  onOperatorSelect: () => void;
  onContinue: () => void;
  recentTransactions: Array<{
    id: string;
    recipientPhone: string;
    recipientCountryCode: string;
    operatorName: string;
    requestedAmount: string;
  }>;
}) {
  const canContinue = selectedCountry && phoneNumber.length >= 7 && selectedOperator;

  return (
    <div className="space-y-6">
      {/* Country Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Country</label>
        <button
          onClick={onCountrySelect}
          className="w-full flex items-center justify-between px-4 py-3 border rounded-lg hover:bg-muted transition-colors"
        >
          {selectedCountry ? (
            <div className="flex items-center gap-3">
              <span className="text-xl">{selectedCountry.flag}</span>
              <div className="text-left">
                <p className="font-medium">{selectedCountry.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedCountry.callingCode}
                </p>
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">Select a country</span>
          )}
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Phone Number */}
      {selectedCountry && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Phone Number</label>
          <div className="flex gap-2">
            <div className="flex items-center px-3 bg-muted rounded-lg border">
              <span className="text-sm font-medium">
                {selectedCountry.callingCode}
              </span>
            </div>
            <div className="relative flex-1">
              <Input
                type="tel"
                placeholder="Enter phone number"
                value={phoneNumber}
                onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, ""))}
                className="pr-10"
                data-testid="phone-input"
              />
              {isDetectingOperator && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Operator Selection */}
      {selectedCountry && phoneNumber.length >= 7 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Network Operator</label>
          <button
            onClick={onOperatorSelect}
            className="w-full flex items-center justify-between px-4 py-3 border rounded-lg hover:bg-muted transition-colors"
            data-testid="operator-select"
          >
            {selectedOperator ? (
              <div className="flex items-center gap-3">
                {selectedOperator.logoUrls?.[0] ? (
                  <img
                    src={selectedOperator.logoUrls[0]}
                    alt={selectedOperator.name}
                    className="w-8 h-8 rounded object-contain bg-white"
                  />
                ) : (
                  <Smartphone className="w-8 h-8 text-muted-foreground" />
                )}
                <div className="text-left">
                  <p className="font-medium">{selectedOperator.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedOperator.bundle ? "Bundles available" : "Airtime"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {isDetectingOperator ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-muted-foreground">
                  {isDetectingOperator ? "Detecting..." : "Select operator"}
                </span>
              </div>
            )}
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Recent Recipients */}
      {recentTransactions.length > 0 && !phoneNumber && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Recent Recipients
          </h3>
          <div className="space-y-2">
            {recentTransactions.slice(0, 3).map((tx) => (
              <button
                key={tx.id}
                className="w-full flex items-center gap-3 px-4 py-3 border rounded-lg hover:bg-muted transition-colors text-left"
                onClick={() => {
                  // Find matching country
                  const country = POPULAR_COUNTRIES.find(
                    (c) => c.callingCode.replace("+", "") === tx.recipientCountryCode
                  );
                  if (country) {
                    onCountrySelect();
                  }
                  onPhoneChange(tx.recipientPhone);
                }}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    +{tx.recipientCountryCode} {tx.recipientPhone}
                  </p>
                  <p className="text-xs text-muted-foreground">{tx.operatorName}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Continue Button */}
      <Button
        className="w-full"
        size="lg"
        disabled={!canContinue}
        onClick={onContinue}
        data-testid="continue-btn"
      >
        Continue
        <ChevronRight className="h-5 w-5 ml-2" />
      </Button>
    </div>
  );
}

function AmountStep({
  amount,
  customAmount,
  selectedOperator,
  walletBalance,
  walletCurrency,
  eligibility,
  isCheckingEligibility,
  onAmountSelect,
  onCustomAmountChange,
  onBack,
  onContinue,
}: {
  amount: number;
  customAmount: string;
  selectedOperator: ReloadlyOperator | null;
  walletBalance: string;
  walletCurrency: string;
  eligibility: { canProceed: boolean; insufficientFunds: boolean } | undefined;
  isCheckingEligibility: boolean;
  onAmountSelect: (amount: number) => void;
  onCustomAmountChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const balance = parseFloat(walletBalance);
  const canContinue = amount > 0 && (!eligibility || eligibility.canProceed);
  const insufficientFunds = eligibility?.insufficientFunds ?? false;

  // Calculate min/max from operator if available
  const minAmount = selectedOperator?.minAmount ?? 1;
  const maxAmount = selectedOperator?.maxAmount ?? 500;

  return (
    <div className="space-y-6">
      {/* Wallet Balance Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Available Balance</span>
            </div>
            <span className="text-lg font-semibold">
              {formatCurrency(balance, walletCurrency)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Preset Amounts */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Select Amount</label>
        <div className="grid grid-cols-3 gap-2" data-testid="preset-amounts">
          {PRESET_AMOUNTS.map((preset) => (
            <Button
              key={preset}
              variant={amount === preset && !customAmount ? "default" : "outline"}
              className={cn(
                "h-14 text-lg font-semibold",
                amount === preset && !customAmount && "ring-2 ring-primary"
              )}
              onClick={() => onAmountSelect(preset)}
              disabled={preset > balance}
              data-testid={`amount-${preset}`}
            >
              ${preset}
            </Button>
          ))}
        </div>
      </div>

      {/* Custom Amount */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Or enter custom amount</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">
            $
          </span>
          <Input
            type="number"
            placeholder="0.00"
            value={customAmount}
            onChange={(e) => onCustomAmountChange(e.target.value)}
            className="pl-8 h-14 text-lg"
            min={minAmount}
            max={Math.min(maxAmount, balance)}
            step="0.01"
            data-testid="custom-amount"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Min: {formatCurrency(minAmount)} • Max: {formatCurrency(Math.min(maxAmount, balance))}
        </p>
      </div>

      {/* Insufficient Funds Warning */}
      {insufficientFunds && (
        <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <p className="font-medium text-destructive">Insufficient Funds</p>
            <p className="text-sm text-muted-foreground">
              Please top up your wallet or select a lower amount.
            </p>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" size="lg" onClick={onBack}>
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </Button>
        <Button
          className="flex-1"
          size="lg"
          disabled={!canContinue || isCheckingEligibility}
          onClick={onContinue}
          data-testid="continue-amount-btn"
        >
          {isCheckingEligibility ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              Continue
              <ChevronRight className="h-5 w-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ConfirmStep({
  selectedCountry,
  phoneNumber,
  selectedOperator,
  amount,
  walletBalance,
  isPending,
  onBack,
  onConfirm,
}: {
  selectedCountry: typeof POPULAR_COUNTRIES[0] | null;
  phoneNumber: string;
  selectedOperator: ReloadlyOperator | null;
  amount: number;
  walletBalance: string;
  isPending: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const balance = parseFloat(walletBalance);
  const remainingBalance = balance - amount;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recipient */}
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-muted-foreground">Recipient</span>
            <span className="font-medium">
              {selectedCountry?.callingCode} {phoneNumber}
            </span>
          </div>

          {/* Operator */}
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-muted-foreground">Operator</span>
            <div className="flex items-center gap-2">
              {selectedOperator?.logoUrls?.[0] && (
                <img
                  src={selectedOperator.logoUrls[0]}
                  alt={selectedOperator.name}
                  className="w-6 h-6 rounded object-contain bg-white"
                />
              )}
              <span className="font-medium">{selectedOperator?.name}</span>
            </div>
          </div>

          {/* Amount */}
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-muted-foreground">Amount</span>
            <span className="text-xl font-semibold text-primary">
              {formatCurrency(amount)}
            </span>
          </div>

          {/* Balance After */}
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground">Balance After</span>
            <span className="font-medium">{formatCurrency(remainingBalance)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Warning */}
      <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
        <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p>
            Please verify the phone number and operator before confirming.
            Top-ups cannot be reversed once sent.
          </p>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          size="lg"
          onClick={onBack}
          disabled={isPending}
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </Button>
        <Button
          className="flex-1"
          size="lg"
          onClick={onConfirm}
          disabled={isPending}
          data-testid="confirm-btn"
        >
          {isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Processing...
            </>
          ) : (
            <>
              Confirm & Send
              <ChevronRight className="h-5 w-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function SuccessStep({
  amount,
  phoneNumber,
  selectedCountry,
  selectedOperator,
  transactionId,
  onNewTopup,
  onViewHistory,
}: {
  amount: number;
  phoneNumber: string;
  selectedCountry: typeof POPULAR_COUNTRIES[0] | null;
  selectedOperator: ReloadlyOperator | null;
  transactionId?: string;
  onNewTopup: () => void;
  onViewHistory: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-6">
      {/* Success Icon */}
      <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
        <CheckCircle className="h-10 w-10 text-green-500" />
      </div>

      {/* Success Message */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Top-Up Successful!</h2>
        <p className="text-muted-foreground">
          {formatCurrency(amount)} has been sent to
        </p>
        <p className="text-lg font-medium">
          {selectedCountry?.callingCode} {phoneNumber}
        </p>
        {selectedOperator && (
          <p className="text-sm text-muted-foreground">{selectedOperator.name}</p>
        )}
      </div>

      {/* Transaction ID */}
      {transactionId && (
        <div className="bg-muted px-4 py-2 rounded-lg">
          <p className="text-xs text-muted-foreground">Transaction ID</p>
          <p className="text-sm font-mono">{transactionId.slice(0, 16)}...</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="w-full space-y-3 pt-4">
        <Button className="w-full" size="lg" onClick={onNewTopup} data-testid="new-topup-btn">
          <Plus className="h-5 w-5 mr-2" />
          New Top-Up
        </Button>
        <Button
          variant="outline"
          className="w-full"
          size="lg"
          onClick={onViewHistory}
        >
          <History className="h-5 w-5 mr-2" />
          View History
        </Button>
      </div>
    </div>
  );
}
