import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
import { TASK_PRIORITIES, type TaskPriority } from "~/fn/call-dispositions";

const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters"),
  description: z
    .string()
    .max(2000, "Description must be less than 2000 characters")
    .optional()
    .or(z.literal("")),
  priority: z.enum(TASK_PRIORITIES).optional().default("medium"),
  dueDate: z.string().optional().or(z.literal("")),
});

type CreateTaskFormValues = z.input<typeof createTaskSchema>;

interface CreateTaskFormProps {
  onSubmit: (data: CreateTaskFormValues) => void;
  isSubmitting?: boolean;
  onCancel?: () => void;
}

const priorityColors: Record<TaskPriority, string> = {
  low: "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800",
  medium: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/50",
  high: "text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/50",
  urgent: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/50",
};

export function CreateTaskForm({
  onSubmit,
  isSubmitting = false,
  onCancel,
}: CreateTaskFormProps) {
  const form = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      dueDate: "",
    },
  });

  const handleSubmit = (data: CreateTaskFormValues) => {
    onSubmit(data);
    form.reset();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create New Task
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter task title..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter task description..."
                      className="min-h-[80px] resize-none"
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
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">
                          <span className={cn("px-2 py-0.5 rounded text-xs", priorityColors.low)}>
                            Low
                          </span>
                        </SelectItem>
                        <SelectItem value="medium">
                          <span className={cn("px-2 py-0.5 rounded text-xs", priorityColors.medium)}>
                            Medium
                          </span>
                        </SelectItem>
                        <SelectItem value="high">
                          <span className={cn("px-2 py-0.5 rounded text-xs", priorityColors.high)}>
                            High
                          </span>
                        </SelectItem>
                        <SelectItem value="urgent">
                          <span className={cn("px-2 py-0.5 rounded text-xs", priorityColors.urgent)}>
                            Urgent
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date (optional)</FormLabel>
                    <FormControl>
                      <input
                        type="datetime-local"
                        className={cn(
                          "flex h-9 w-full rounded-lg border px-3 py-2 text-sm",
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
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Task"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
