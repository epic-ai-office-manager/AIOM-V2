/**
 * Demo Environment Types
 *
 * Type definitions for the demo/sandbox environment feature.
 */

import type { DemoUserRole } from "~/db/schema";

// Demo session context available throughout the demo environment
export interface DemoSessionContext {
  sessionId: string;
  email: string;
  name: string;
  role: DemoUserRole;
  expiresAt: Date;
  createdAt: Date;
}

// Demo login credentials
export interface DemoLoginCredentials {
  email: string;
  password: string;
}

// Demo login response
export interface DemoLoginResult {
  success: boolean;
  session?: DemoSessionContext;
  error?: string;
  token?: string;
}

// Demo session validation result
export interface DemoSessionValidation {
  isValid: boolean;
  session?: DemoSessionContext;
  error?: string;
}

// Synthetic data types for demo
export interface DemoExpenseData {
  id: string;
  amount: string;
  currency: string;
  purpose: string;
  description: string;
  status: "pending" | "approved" | "rejected" | "disbursed";
  createdAt: Date;
  requesterName: string;
}

export interface DemoWorkOrderData {
  id: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  assignedTo: string;
  customerName: string;
  createdAt: Date;
  scheduledDate: Date;
}

export interface DemoCustomerData {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt: Date;
  totalOrders: number;
  totalSpent: string;
}

export interface DemoTransactionData {
  id: string;
  type: "credit" | "debit";
  amount: string;
  currency: string;
  description: string;
  category: string;
  createdAt: Date;
  reference: string;
}

// Demo data generation configuration
export interface DemoDataConfig {
  expenseCount: number;
  workOrderCount: number;
  customerCount: number;
  transactionCount: number;
  dateRangeDays: number;
}

// Demo activity tracking
export interface DemoActivity {
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, {}>;
  timestamp: Date;
}

// Demo feature restrictions
export interface DemoFeatureRestrictions {
  canCreateRealPayments: boolean;
  canSendRealEmails: boolean;
  canAccessProduction: boolean;
  canExportData: boolean;
  maxDataLimit: number;
}

// Demo environment state
export interface DemoEnvironmentState {
  isActive: boolean;
  session: DemoSessionContext | null;
  restrictions: DemoFeatureRestrictions;
  lastActivity: Date | null;
}
