/**
 * Expense GL Posting Data Access Layer
 *
 * Handles the integration between expense vouchers and Odoo GL posting.
 * Provides functions for posting approved/reconciled expenses to the General Ledger.
 */

import { getOdooClient } from "./odoo";
import {
  createGLPostingService,
  type GLPostingRequest,
  type GLPostingResult,
  type GLAccountInfo,
  type GLJournalInfo,
} from "~/lib/odoo";
import {
  findExpenseVoucherByIdWithDetails,
  updateExpenseVoucher,
  markExpenseVoucherPostingFailed,
  getVouchersPendingGLPosting,
  type ExpenseVoucherWithDetails,
} from "./expense-vouchers";
import { auditLog } from "~/lib/audit-logging-service";

// =============================================================================
// Types
// =============================================================================

export interface ExpenseGLPostingOptions {
  /** Override the posting date (defaults to today) */
  postingDate?: string;
  /** Override the journal code (defaults to expense journal) */
  journalCode?: string;
  /** Override the AP account code (defaults to standard AP) */
  apAccountCode?: string;
  /** User ID performing the posting (for audit trail) */
  postedById?: string;
}

export interface ExpenseGLPostingResult {
  success: boolean;
  voucherId: string;
  voucherNumber: string;
  journalEntryId?: number;
  journalEntryName?: string;
  postingReference?: string;
  error?: string;
  errorCode?: string;
}

export interface BatchGLPostingResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  results: ExpenseGLPostingResult[];
}

// =============================================================================
// GL Account Lookups
// =============================================================================

/**
 * Gets available GL accounts for expense coding
 */
export async function getExpenseGLAccounts(): Promise<GLAccountInfo[]> {
  const client = await getOdooClient();
  const glService = createGLPostingService(client);

  // Get expense accounts (typically start with 6)
  return glService.findAccountsByPrefix("6");
}

/**
 * Gets available journals for expense posting
 */
export async function getExpenseJournals(): Promise<GLJournalInfo[]> {
  const client = await getOdooClient();

  const journals = await client.searchRead(
    "account.journal",
    [["type", "in", ["general", "purchase"]]],
    {
      fields: ["id", "code", "name", "type", "default_account_id"],
      order: "sequence asc",
    }
  );

  return journals.map((journal: Record<string, unknown>) => ({
    id: journal.id as number,
    code: journal.code as string,
    name: journal.name as string,
    type: (journal.type as string) || "general",
    defaultAccountId:
      journal.default_account_id && Array.isArray(journal.default_account_id)
        ? (journal.default_account_id[0] as number)
        : undefined,
  }));
}

/**
 * Validates a GL account code exists in Odoo
 */
export async function validateGLAccountCode(code: string): Promise<GLAccountInfo | null> {
  const client = await getOdooClient();
  const glService = createGLPostingService(client);
  return glService.findAccountByCode(code);
}

// =============================================================================
// Core GL Posting Functions
// =============================================================================

/**
 * Posts a single expense voucher to the General Ledger in Odoo
 */
export async function postExpenseVoucherToOdooGL(
  voucherId: string,
  options: ExpenseGLPostingOptions = {}
): Promise<ExpenseGLPostingResult> {
  // 1. Get the voucher with all details
  const voucher = await findExpenseVoucherByIdWithDetails(voucherId);

  if (!voucher) {
    return {
      success: false,
      voucherId,
      voucherNumber: "UNKNOWN",
      error: "Expense voucher not found",
      errorCode: "VOUCHER_NOT_FOUND",
    };
  }

  // 2. Validate voucher status
  if (voucher.status !== "approved" && voucher.status !== "posted") {
    return {
      success: false,
      voucherId,
      voucherNumber: voucher.voucherNumber,
      error: `Voucher must be approved before posting to GL. Current status: ${voucher.status}`,
      errorCode: "INVALID_STATUS",
    };
  }

  if (voucher.postingStatus === "posted") {
    return {
      success: false,
      voucherId,
      voucherNumber: voucher.voucherNumber,
      error: "Voucher has already been posted to GL",
      errorCode: "ALREADY_POSTED",
    };
  }

  try {
    // 3. Initialize Odoo client and GL service
    const client = await getOdooClient();
    const glService = createGLPostingService(client);

    // 4. Build the GL posting request
    const postingRequest = buildGLPostingRequest(voucher, options);

    // 5. Update posting status to pending
    await updateExpenseVoucher(voucherId, {
      postingStatus: "pending",
    });

    // 6. Post to Odoo GL
    const glResult = await glService.postExpenseToGL(postingRequest);

    if (!glResult.success) {
      // Mark posting as failed
      await markExpenseVoucherPostingFailed(voucherId, glResult.error || "Unknown error");

      return {
        success: false,
        voucherId,
        voucherNumber: voucher.voucherNumber,
        error: glResult.error,
        errorCode: glResult.errorCode,
      };
    }

    // 7. Update voucher with posting details
    await updateExpenseVoucher(voucherId, {
      status: "posted",
      postingStatus: "posted",
      postedAt: new Date(),
      glPostingDate: new Date(),
      glJournalEntryId: glResult.journalEntryId?.toString(),
      glPostingReference: glResult.postingReference,
      glPostingError: null,
    });

    // 8. Log the posting to audit trail
    await auditLog.log({
      eventType: "expense.gl_posted",
      category: "financial",
      actor: {
        actorId: options.postedById || "system",
        actorType: options.postedById ? "user" : "system",
      },
      resource: {
        resourceType: "expense_voucher",
        resourceId: voucherId,
      },
      change: {
        previousState: { postingStatus: "not_posted" },
        newState: {
          postingStatus: "posted",
          glJournalEntryId: glResult.journalEntryId,
          glPostingReference: glResult.postingReference,
        },
        changedFields: ["postingStatus", "glJournalEntryId", "glPostingReference", "postedAt"],
        description: `Expense voucher ${voucher.voucherNumber} posted to GL as ${glResult.journalEntryName}`,
      },
      metadata: {
        voucherNumber: voucher.voucherNumber,
        amount: voucher.amount,
        currency: voucher.currency,
        journalEntryId: glResult.journalEntryId,
        journalEntryName: glResult.journalEntryName,
        postingReference: glResult.postingReference,
      },
      tags: ["financial", "gl_posting", "expense"],
    });

    return {
      success: true,
      voucherId,
      voucherNumber: voucher.voucherNumber,
      journalEntryId: glResult.journalEntryId,
      journalEntryName: glResult.journalEntryName,
      postingReference: glResult.postingReference,
    };
  } catch (error) {
    // Mark posting as failed
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await markExpenseVoucherPostingFailed(voucherId, errorMessage);

    // Log the failure
    await auditLog.log({
      eventType: "expense.gl_posting_failed",
      category: "financial",
      severity: "warning",
      actor: {
        actorId: options.postedById || "system",
        actorType: options.postedById ? "user" : "system",
      },
      resource: {
        resourceType: "expense_voucher",
        resourceId: voucherId,
      },
      change: {
        previousState: { postingStatus: "pending" },
        newState: { postingStatus: "failed", glPostingError: errorMessage },
        changedFields: ["postingStatus", "glPostingError"],
        description: `GL posting failed for voucher ${voucher.voucherNumber}: ${errorMessage}`,
      },
      metadata: {
        voucherNumber: voucher.voucherNumber,
        error: errorMessage,
      },
      tags: ["financial", "gl_posting", "expense", "error"],
    });

    return {
      success: false,
      voucherId,
      voucherNumber: voucher.voucherNumber,
      error: errorMessage,
      errorCode: "POSTING_EXCEPTION",
    };
  }
}

/**
 * Posts multiple expense vouchers to the GL in batch
 */
export async function batchPostExpenseVouchersToGL(
  voucherIds: string[],
  options: ExpenseGLPostingOptions = {}
): Promise<BatchGLPostingResult> {
  const results: ExpenseGLPostingResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const voucherId of voucherIds) {
    const result = await postExpenseVoucherToOdooGL(voucherId, options);
    results.push(result);

    if (result.success) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  return {
    totalProcessed: voucherIds.length,
    successCount,
    failureCount,
    results,
  };
}

/**
 * Automatically posts all approved and reconciled vouchers pending GL posting
 */
export async function autoPostPendingVouchersToGL(
  options: ExpenseGLPostingOptions = {}
): Promise<BatchGLPostingResult> {
  // Get all vouchers that are approved but not yet posted
  const pendingVouchers = await getVouchersPendingGLPosting({
    limit: 100, // Process in batches of 100
  });

  if (pendingVouchers.length === 0) {
    return {
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
    };
  }

  // Filter to only include reconciled vouchers (if desired)
  const voucherIds = pendingVouchers
    .filter((v) => v.reconciliationStatus === "reconciled" || v.reconciliationStatus === "unreconciled")
    .map((v) => v.id);

  return batchPostExpenseVouchersToGL(voucherIds, options);
}

/**
 * Reverses a GL posting for an expense voucher
 */
export async function reverseExpenseGLPosting(
  voucherId: string,
  reason: string,
  reversedById: string
): Promise<ExpenseGLPostingResult> {
  // Get the voucher
  const voucher = await findExpenseVoucherByIdWithDetails(voucherId);

  if (!voucher) {
    return {
      success: false,
      voucherId,
      voucherNumber: "UNKNOWN",
      error: "Expense voucher not found",
      errorCode: "VOUCHER_NOT_FOUND",
    };
  }

  if (voucher.postingStatus !== "posted" || !voucher.glJournalEntryId) {
    return {
      success: false,
      voucherId,
      voucherNumber: voucher.voucherNumber,
      error: "Voucher has not been posted to GL or journal entry ID is missing",
      errorCode: "NOT_POSTED",
    };
  }

  try {
    const client = await getOdooClient();
    const glService = createGLPostingService(client);

    const journalEntryId = parseInt(voucher.glJournalEntryId, 10);
    const reversalResult = await glService.reverseJournalEntry(
      journalEntryId,
      undefined,
      reason
    );

    if (!reversalResult.success) {
      return {
        success: false,
        voucherId,
        voucherNumber: voucher.voucherNumber,
        error: reversalResult.error,
        errorCode: reversalResult.errorCode,
      };
    }

    // Update voucher to reflect reversal
    await updateExpenseVoucher(voucherId, {
      postingStatus: "reversed",
      glPostingError: `Reversed: ${reason}. Reversal entry: ${reversalResult.journalEntryName}`,
    });

    // Log the reversal
    await auditLog.log({
      eventType: "expense.gl_reversed",
      category: "financial",
      actor: {
        actorId: reversedById,
        actorType: "user",
      },
      resource: {
        resourceType: "expense_voucher",
        resourceId: voucherId,
      },
      change: {
        previousState: { postingStatus: "posted" },
        newState: { postingStatus: "reversed" },
        changedFields: ["postingStatus"],
        description: `GL posting reversed for voucher ${voucher.voucherNumber}. Reason: ${reason}`,
      },
      metadata: {
        voucherNumber: voucher.voucherNumber,
        originalJournalEntryId: journalEntryId,
        reversalJournalEntryId: reversalResult.journalEntryId,
        reversalReason: reason,
      },
      tags: ["financial", "gl_posting", "expense", "reversal"],
    });

    return {
      success: true,
      voucherId,
      voucherNumber: voucher.voucherNumber,
      journalEntryId: reversalResult.journalEntryId,
      journalEntryName: reversalResult.journalEntryName,
      postingReference: reversalResult.postingReference,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      voucherId,
      voucherNumber: voucher.voucherNumber,
      error: errorMessage,
      errorCode: "REVERSAL_EXCEPTION",
    };
  }
}

/**
 * Gets the GL posting status for a voucher from Odoo
 */
export async function getOdooGLPostingStatus(
  voucherId: string
): Promise<{ synced: boolean; odooState?: string; odooName?: string; error?: string }> {
  const voucher = await findExpenseVoucherByIdWithDetails(voucherId);

  if (!voucher) {
    return { synced: false, error: "Voucher not found" };
  }

  if (!voucher.glJournalEntryId) {
    return { synced: false, error: "No GL journal entry ID recorded" };
  }

  try {
    const client = await getOdooClient();
    const glService = createGLPostingService(client);

    const journalEntryId = parseInt(voucher.glJournalEntryId, 10);
    const status = await glService.getJournalEntryStatus(journalEntryId);

    if (!status.exists) {
      return { synced: false, error: "Journal entry not found in Odoo" };
    }

    return {
      synced: true,
      odooState: status.state,
      odooName: status.name,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { synced: false, error: errorMessage };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Builds a GL posting request from an expense voucher
 */
function buildGLPostingRequest(
  voucher: ExpenseVoucherWithDetails,
  options: ExpenseGLPostingOptions
): GLPostingRequest {
  const lineItems = voucher.lineItems.map((item) => ({
    description: item.description,
    debit: parseFloat(item.amount),
    credit: 0,
    accountCode: item.glAccountCode || voucher.glAccountCode || "6000", // Default to generic expense
    costCenter: item.costCenter || voucher.costCenter || undefined,
    department: item.department || voucher.department || undefined,
    projectCode: item.projectCode || voucher.projectCode || undefined,
    partnerId: voucher.vendorId ? parseInt(voucher.vendorId, 10) : undefined,
    taxCode: item.taxCode || undefined,
    taxAmount: item.taxAmount ? parseFloat(item.taxAmount) : undefined,
  }));

  // If no line items, create a single line from voucher header
  if (lineItems.length === 0) {
    lineItems.push({
      description: voucher.description,
      debit: parseFloat(voucher.amount),
      credit: 0,
      accountCode: voucher.glAccountCode || "6000",
      costCenter: voucher.costCenter || undefined,
      department: voucher.department || undefined,
      projectCode: voucher.projectCode || undefined,
      partnerId: voucher.vendorId ? parseInt(voucher.vendorId, 10) : undefined,
      taxCode: undefined,
      taxAmount: undefined,
    });
  }

  return {
    voucherNumber: voucher.voucherNumber,
    postingDate: options.postingDate || new Date().toISOString().split("T")[0],
    totalAmount: parseFloat(voucher.amount),
    currency: voucher.currency,
    description: `Expense Voucher: ${voucher.description}`,
    vendorName: voucher.vendorName || undefined,
    vendorId: voucher.vendorId ? parseInt(voucher.vendorId, 10) : undefined,
    lineItems,
    journalCode: options.journalCode,
    apAccountCode: options.apAccountCode,
    externalReference: voucher.externalReference || undefined,
    tags: voucher.tags ? JSON.parse(voucher.tags) : undefined,
  };
}
