import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CheckCircle2,
  PhoneForwarded,
  AlertTriangle,
  Calendar,
  MessageSquare,
  ThumbsUp,
  Minus,
  ThumbsDown,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import {
  Form,
  FormControl,
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
import {
  DISPOSITION_TYPES,
  CUSTOMER_SENTIMENTS,
  TASK_PRIORITIES,
  type DispositionType,
  type CustomerSentiment,
  type TaskPriority,
} from "~/fn/call-dispositions";

const dispositionFormSchema = z.object({
  disposition: z.enum(DISPOSITION_TYPES),
  notes: z
    .string()
    .max(5000, "Notes must be less than 5000 characters")
    .optional()
    .or(z.literal("")),
  customerSentiment: z.enum(CUSTOMER_SENTIMENTS).optional(),
  followUpDate: z.string().optional().or(z.literal("")),
  followUpReason: z
    .string()
    .max(1000, "Follow-up reason must be less than 1000 characters")
    .optional()
    .or(z.literal("")),
  escalationReason: z
    .string()
    .max(1000, "Escalation reason must be less than 1000 characters")
    .optional()
    .or(z.literal("")),
  escalationPriority: z.enum(TASK_PRIORITIES).optional(),
});

type DispositionFormValues = z.infer<typeof dispositionFormSchema>;

interface CallDispositionFormProps {
  onSubmit: (data: DispositionFormValues) => void;
  isSubmitting?: boolean;
  defaultValues?: Partial<DispositionFormValues>;
}

const dispositionOptions: {
  value: DispositionType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    value: "resolved",
    label: "Resolved",
    description: "Issue was resolved during the call",
    icon: <CheckCircle2 className="h-5 w-5" />,
    color: "text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-800 dark:bg-green-950",
  },
  {
    value: "follow_up_needed",
    label: "Follow-up Needed",
    description: "Requires additional follow-up",
    icon: <PhoneForwarded className="h-5 w-5" />,
    color: "text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:bg-blue-950",
  },
  {
    value: "escalate",
    label: "Escalate",
    description: "Needs to be escalated to management",
    icon: <AlertTriangle className="h-5 w-5" />,
    color: "text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:bg-orange-950",
  },
];

const sentimentOptions: {
  value: CustomerSentiment;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "positive", label: "Positive", icon: <ThumbsUp className="h-4 w-4" /> },
  { value: "neutral", label: "Neutral", icon: <Minus className="h-4 w-4" /> },
  { value: "negative", label: "Negative", icon: <ThumbsDown className="h-4 w-4" /> },
];

export function CallDispositionForm({
  onSubmit,
  isSubmitting = false,
  defaultValues,
}: CallDispositionFormProps) {
  const form = useForm<DispositionFormValues>({
    resolver: zodResolver(dispositionFormSchema),
    defaultValues: {
      disposition: defaultValues?.disposition,
      notes: defaultValues?.notes || "",
      customerSentiment: defaultValues?.customerSentiment,
      followUpDate: defaultValues?.followUpDate || "",
      followUpReason: defaultValues?.followUpReason || "",
      escalationReason: defaultValues?.escalationReason || "",
      escalationPriority: defaultValues?.escalationPriority,
    },
  });

  const selectedDisposition = form.watch("disposition");

  const handleSubmit = (data: DispositionFormValues) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Disposition Selection */}
        <FormField
          control={form.control}
          name="disposition"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base font-semibold">
                Call Disposition
              </FormLabel>
              <FormControl>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {dispositionOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => field.onChange(option.value)}
                      className={cn(
                        "flex flex-col items-center p-4 rounded-lg border-2 transition-all",
                        "hover:scale-[1.02] active:scale-[0.98]",
                        field.value === option.value
                          ? cn(option.color, "border-2 ring-2 ring-offset-2 ring-primary/20")
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      )}
                    >
                      <div
                        className={cn(
                          "mb-2",
                          field.value === option.value
                            ? ""
                            : "text-gray-400 dark:text-gray-500"
                        )}
                      >
                        {option.icon}
                      </div>
                      <span
                        className={cn(
                          "font-medium text-sm",
                          field.value === option.value
                            ? ""
                            : "text-gray-700 dark:text-gray-300"
                        )}
                      >
                        {option.label}
                      </span>
                      <span
                        className={cn(
                          "text-xs mt-1 text-center",
                          field.value === option.value
                            ? "opacity-80"
                            : "text-gray-500 dark:text-gray-400"
                        )}
                      >
                        {option.description}
                      </span>
                    </button>
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Customer Sentiment */}
        <FormField
          control={form.control}
          name="customerSentiment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Sentiment</FormLabel>
              <FormControl>
                <div className="flex gap-2">
                  {sentimentOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        field.onChange(
                          field.value === option.value ? undefined : option.value
                        )
                      }
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
                        field.value === option.value
                          ? option.value === "positive"
                            ? "bg-green-100 border-green-300 text-green-700 dark:bg-green-950 dark:border-green-700 dark:text-green-400"
                            : option.value === "negative"
                              ? "bg-red-100 border-red-300 text-red-700 dark:bg-red-950 dark:border-red-700 dark:text-red-400"
                              : "bg-gray-100 border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      )}
                    >
                      {option.icon}
                      <span className="text-sm font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Call Notes
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter notes about the call..."
                  className="min-h-[120px] resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Follow-up Section (shown when follow_up_needed is selected) */}
        {selectedDisposition === "follow_up_needed" && (
          <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Calendar className="h-4 w-4" />
                Follow-up Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="followUpDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Follow-up Date</FormLabel>
                    <FormControl>
                      <input
                        type="datetime-local"
                        className={cn(
                          "flex h-10 w-full rounded-lg border px-3 py-2 text-sm",
                          "bg-white border-gray-300 text-gray-900",
                          "dark:bg-slate-950/50 dark:border-white/10 dark:text-slate-200",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="followUpReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Follow-up Reason</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Why is follow-up needed?"
                        className="min-h-[80px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        {/* Escalation Section (shown when escalate is selected) */}
        {selectedDisposition === "escalate" && (
          <Card className="border-orange-200 dark:border-orange-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <AlertTriangle className="h-4 w-4" />
                Escalation Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="escalationPriority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Escalation Priority</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="escalationReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Escalation Reason</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Why does this need to be escalated?"
                        className="min-h-[80px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting || !selectedDisposition}
            className="min-w-[200px]"
          >
            {isSubmitting ? "Saving..." : "Save Disposition"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
