/**
 * KYC Submission Form
 *
 * Multi-step form for KYC verification with:
 * - Personal information form
 * - Document type selection
 * - Photo capture
 * - Review and submit
 */

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  User,
  FileText,
  Camera,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Upload,
  X,
  AlertCircle,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { ReceiptCapture } from "~/components/ReceiptCapture";
import { cn } from "~/lib/utils";
import {
  KYC_DOCUMENT_TYPES,
  KYC_DOCUMENT_TYPE_LABELS,
  KYC_DOCUMENT_TYPE_DESCRIPTIONS,
  type KycDocumentType,
} from "~/fn/kyc";
import type { MediaUploadResult } from "~/utils/storage/media-helpers";

// Personal information schema
const personalInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  middleName: z.string().max(100).optional().or(z.literal("")),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  nationality: z.string().min(1, "Nationality is required").max(100),
  phoneNumber: z.string().min(1, "Phone number is required").max(20),
  addressLine1: z.string().min(1, "Address is required").max(200),
  addressLine2: z.string().max(200).optional().or(z.literal("")),
  city: z.string().min(1, "City is required").max(100),
  stateProvince: z.string().max(100).optional().or(z.literal("")),
  postalCode: z.string().min(1, "Postal code is required").max(20),
  country: z.string().min(1, "Country is required").max(100),
});

export type PersonalInfoFormData = z.infer<typeof personalInfoSchema>;

// Document interface
export interface KYCDocument {
  id: string;
  documentType: KycDocumentType;
  fileName: string;
  fileUrl: string;
  status: string;
}

interface KYCSubmissionFormProps {
  // Initial data
  defaultPersonalInfo?: Partial<PersonalInfoFormData>;
  existingDocuments?: KYCDocument[];
  currentStatus?: string;

  // Callbacks
  onSavePersonalInfo: (data: PersonalInfoFormData) => Promise<void>;
  onAddDocument: (document: {
    documentType: KycDocumentType;
    fileName: string;
    fileUrl: string;
    fileSize?: number;
    mimeType?: string;
  }) => Promise<void>;
  onRemoveDocument: (documentId: string) => Promise<void>;
  onSubmit: () => Promise<void>;

  // Loading states
  isSavingPersonalInfo?: boolean;
  isAddingDocument?: boolean;
  isSubmitting?: boolean;
}

// Step definitions
const STEPS = [
  { id: "personal", title: "Personal Info", icon: User },
  { id: "documents", title: "Documents", icon: FileText },
  { id: "review", title: "Review", icon: CheckCircle },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export function KYCSubmissionForm({
  defaultPersonalInfo,
  existingDocuments = [],
  currentStatus,
  onSavePersonalInfo,
  onAddDocument,
  onRemoveDocument,
  onSubmit,
  isSavingPersonalInfo = false,
  isAddingDocument = false,
  isSubmitting = false,
}: KYCSubmissionFormProps) {
  const [currentStep, setCurrentStep] = React.useState<StepId>("personal");
  const [showDocumentCapture, setShowDocumentCapture] = React.useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = React.useState<KycDocumentType | null>(null);

  // Personal info form
  const form = useForm<PersonalInfoFormData>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      middleName: "",
      dateOfBirth: "",
      nationality: "",
      phoneNumber: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      stateProvince: "",
      postalCode: "",
      country: "",
      ...defaultPersonalInfo,
    },
  });

  // Handle personal info submission
  const handleSavePersonalInfo = async (data: PersonalInfoFormData) => {
    await onSavePersonalInfo(data);
    setCurrentStep("documents");
  };

  // Handle document type selection and open capture
  const handleSelectDocumentType = (type: KycDocumentType) => {
    setSelectedDocumentType(type);
    setShowDocumentCapture(true);
  };

  // Handle document capture complete
  const handleDocumentCapture = async (results: MediaUploadResult[]) => {
    if (results.length > 0 && selectedDocumentType) {
      const result = results[0];
      await onAddDocument({
        documentType: selectedDocumentType,
        fileName: result.fileName || "document.jpg",
        fileUrl: result.fileKey,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
      });
    }
    setShowDocumentCapture(false);
    setSelectedDocumentType(null);
  };

  // Get current step index
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  // Check if form is already submitted
  const isAlreadySubmitted = currentStatus === "submitted" || currentStatus === "under_review" || currentStatus === "approved";

  // Check if can proceed to review
  const hasIdDocument = existingDocuments.some(
    (doc) => ["passport", "drivers_license", "national_id"].includes(doc.documentType)
  );

  return (
    <div className="space-y-6">
      {/* Step Progress */}
      <div className="flex items-center justify-between px-2">
        {STEPS.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = index < currentStepIndex;

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => setCurrentStep(step.id)}
                disabled={index > currentStepIndex && !isCompleted}
                className={cn(
                  "flex flex-col items-center gap-1 transition-colors",
                  isActive && "text-primary",
                  isCompleted && "text-green-600",
                  !isActive && !isCompleted && "text-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                    isActive && "border-primary bg-primary/10",
                    isCompleted && "border-green-600 bg-green-600/10",
                    !isActive && !isCompleted && "border-muted-foreground/30"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <StepIcon className="h-5 w-5" />
                  )}
                </div>
                <span className="text-xs font-medium">{step.title}</span>
              </button>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2",
                    isCompleted ? "bg-green-600" : "bg-muted-foreground/30"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content */}
      {currentStep === "personal" && (
        <PersonalInfoStep
          form={form}
          onSubmit={handleSavePersonalInfo}
          isPending={isSavingPersonalInfo}
        />
      )}

      {currentStep === "documents" && (
        <DocumentsStep
          documents={existingDocuments}
          onSelectDocumentType={handleSelectDocumentType}
          onRemoveDocument={onRemoveDocument}
          isAddingDocument={isAddingDocument}
          onBack={() => setCurrentStep("personal")}
          onNext={() => setCurrentStep("review")}
          hasIdDocument={hasIdDocument}
        />
      )}

      {currentStep === "review" && (
        <ReviewStep
          personalInfo={form.getValues()}
          documents={existingDocuments}
          onBack={() => setCurrentStep("documents")}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          isAlreadySubmitted={isAlreadySubmitted}
          currentStatus={currentStatus}
        />
      )}

      {/* Document Capture Dialog */}
      <Dialog open={showDocumentCapture} onOpenChange={setShowDocumentCapture}>
        <DialogContent className="p-0 max-w-full h-[90vh] sm:max-w-lg">
          <ReceiptCapture
            maxReceipts={1}
            onUploadComplete={handleDocumentCapture}
            onClose={() => {
              setShowDocumentCapture(false);
              setSelectedDocumentType(null);
            }}
            onError={(error) => console.error("Document capture error:", error)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Personal Info Step Component
interface PersonalInfoStepProps {
  form: ReturnType<typeof useForm<PersonalInfoFormData>>;
  onSubmit: (data: PersonalInfoFormData) => Promise<void>;
  isPending: boolean;
}

function PersonalInfoStep({ form, onSubmit, isPending }: PersonalInfoStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Personal Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John"
                        disabled={isPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Doe"
                        disabled={isPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="middleName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Middle Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Optional"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date of Birth */}
            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth *</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Nationality */}
            <FormField
              control={form.control}
              name="nationality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nationality *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., United States"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone Number */}
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number *</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Include country code</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Address Fields */}
            <FormField
              control={form.control}
              name="addressLine1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 1 *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="123 Main St"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="addressLine2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 2</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Apt 4B (optional)"
                      disabled={isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="New York"
                        disabled={isPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stateProvince"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State/Province</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="NY"
                        disabled={isPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Code *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="10001"
                        disabled={isPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="United States"
                        disabled={isPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                className="w-full"
                disabled={isPending}
                data-testid="save-personal-info-btn"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Save & Continue
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// Documents Step Component
interface DocumentsStepProps {
  documents: KYCDocument[];
  onSelectDocumentType: (type: KycDocumentType) => void;
  onRemoveDocument: (documentId: string) => Promise<void>;
  isAddingDocument: boolean;
  onBack: () => void;
  onNext: () => void;
  hasIdDocument: boolean;
}

function DocumentsStep({
  documents,
  onSelectDocumentType,
  onRemoveDocument,
  isAddingDocument,
  onBack,
  onNext,
  hasIdDocument,
}: DocumentsStepProps) {
  // Get uploaded document types
  const uploadedTypes = documents.map((d) => d.documentType);

  // ID document types
  const idDocTypes: KycDocumentType[] = ["passport", "drivers_license", "national_id"];
  const supportingDocTypes: KycDocumentType[] = ["proof_of_address", "utility_bill", "bank_statement", "selfie"];

  return (
    <div className="space-y-6">
      {/* ID Documents Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            ID Document (Required)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground mb-4">
            Please upload at least one of the following documents:
          </p>
          {idDocTypes.map((type) => {
            const isUploaded = uploadedTypes.includes(type);
            const uploadedDoc = documents.find((d) => d.documentType === type);

            return (
              <DocumentTypeCard
                key={type}
                type={type}
                isUploaded={isUploaded}
                uploadedDoc={uploadedDoc}
                onSelect={() => onSelectDocumentType(type)}
                onRemove={uploadedDoc ? () => onRemoveDocument(uploadedDoc.id) : undefined}
                disabled={isAddingDocument}
              />
            );
          })}
        </CardContent>
      </Card>

      {/* Supporting Documents Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            Supporting Documents (Optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {supportingDocTypes.map((type) => {
            const isUploaded = uploadedTypes.includes(type);
            const uploadedDoc = documents.find((d) => d.documentType === type);

            return (
              <DocumentTypeCard
                key={type}
                type={type}
                isUploaded={isUploaded}
                uploadedDoc={uploadedDoc}
                onSelect={() => onSelectDocumentType(type)}
                onRemove={uploadedDoc ? () => onRemoveDocument(uploadedDoc.id) : undefined}
                disabled={isAddingDocument}
              />
            );
          })}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!hasIdDocument}
          className="flex-1"
          data-testid="continue-to-review-btn"
        >
          Continue
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {!hasIdDocument && (
        <p className="text-sm text-amber-600 text-center flex items-center justify-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Please upload at least one ID document to continue
        </p>
      )}
    </div>
  );
}

// Document Type Card Component
interface DocumentTypeCardProps {
  type: KycDocumentType;
  isUploaded: boolean;
  uploadedDoc?: KYCDocument;
  onSelect: () => void;
  onRemove?: () => void;
  disabled?: boolean;
}

function DocumentTypeCard({
  type,
  isUploaded,
  uploadedDoc,
  onSelect,
  onRemove,
  disabled,
}: DocumentTypeCardProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 rounded-lg border transition-colors",
        isUploaded ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-muted/50"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{KYC_DOCUMENT_TYPE_LABELS[type]}</p>
        <p className="text-xs text-muted-foreground truncate">
          {isUploaded
            ? uploadedDoc?.fileName || "Document uploaded"
            : KYC_DOCUMENT_TYPE_DESCRIPTIONS[type]}
        </p>
      </div>
      <div className="flex items-center gap-2 ml-3">
        {isUploaded ? (
          <>
            <CheckCircle className="h-5 w-5 text-green-600" />
            {onRemove && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={onRemove}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={onSelect}
            disabled={disabled}
            data-testid={`upload-${type}-btn`}
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Camera className="h-4 w-4 mr-2" />
                Capture
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// Review Step Component
interface ReviewStepProps {
  personalInfo: PersonalInfoFormData;
  documents: KYCDocument[];
  onBack: () => void;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
  isAlreadySubmitted: boolean;
  currentStatus?: string;
}

function ReviewStep({
  personalInfo,
  documents,
  onBack,
  onSubmit,
  isSubmitting,
  isAlreadySubmitted,
  currentStatus,
}: ReviewStepProps) {
  return (
    <div className="space-y-6">
      {/* Status Alert */}
      {isAlreadySubmitted && (
        <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">
                {currentStatus === "approved" ? "Verification Approved" : "Verification Submitted"}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {currentStatus === "approved"
                  ? "Your KYC verification has been approved."
                  : "Your verification is under review. We will notify you once it's complete."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Personal Info Review */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ReviewItem label="Full Name" value={`${personalInfo.firstName} ${personalInfo.middleName || ""} ${personalInfo.lastName}`.trim()} />
          <ReviewItem label="Date of Birth" value={personalInfo.dateOfBirth} />
          <ReviewItem label="Nationality" value={personalInfo.nationality} />
          <ReviewItem label="Phone" value={personalInfo.phoneNumber} />
          <ReviewItem
            label="Address"
            value={[
              personalInfo.addressLine1,
              personalInfo.addressLine2,
              `${personalInfo.city}, ${personalInfo.stateProvince || ""} ${personalInfo.postalCode}`,
              personalInfo.country,
            ]
              .filter(Boolean)
              .join("\n")}
          />
        </CardContent>
      </Card>

      {/* Documents Review */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            Uploaded Documents ({documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {KYC_DOCUMENT_TYPE_LABELS[doc.documentType as KycDocumentType]}
                    </p>
                    <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No documents uploaded</p>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1" disabled={isSubmitting}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isSubmitting || isAlreadySubmitted}
          className="flex-1"
          data-testid="submit-kyc-btn"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : isAlreadySubmitted ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Already Submitted
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Submit for Review
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Review Item Component
function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right whitespace-pre-line">{value || "-"}</span>
    </div>
  );
}

export default KYCSubmissionForm;
