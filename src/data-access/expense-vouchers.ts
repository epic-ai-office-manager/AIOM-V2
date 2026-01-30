import { eq, desc, asc, count, and, or, ilike, sql } from "drizzle-orm";
import { database } from "~/db";
import {
  expenseVoucher,
  expenseVoucherLineItem,
  expenseVoucherApprovalHistory,
  user,
  type ExpenseVoucher,
  type CreateExpenseVoucherData,
  type UpdateExpenseVoucherData,
  type ExpenseVoucherLineItem,
  type CreateExpenseVoucherLineItemData,
  type UpdateExpenseVoucherLineItemData,
  type ExpenseVoucherApprovalHistory,
  type CreateExpenseVoucherApprovalHistoryData,
  type ExpenseVoucherStatus,
  type ReconciliationStatus,
  type PostingStatus,
  type ApprovalChainStep,
} from "~/db/schema";

// Type for expense voucher with submitter and approver user info
export type ExpenseVoucherWithUsers = ExpenseVoucher & {
  submitter: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  currentApprover: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
  finalApprover: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
};

// Type for expense voucher with all related data
export type ExpenseVoucherWithDetails = ExpenseVoucherWithUsers & {
  lineItems: ExpenseVoucherLineItem[];
  approvalHistory: (ExpenseVoucherApprovalHistory & {
    approver: {
      id: string;
      name: string;
      email: string;
      image: string | null;
    };
  })[];
};

export interface ExpenseVoucherFilters {
  status?: ExpenseVoucherStatus;
  reconciliationStatus?: ReconciliationStatus;
  postingStatus?: PostingStatus;
  submitterId?: string;
  currentApproverId?: string;
  glAccountCode?: string;
  vendorId?: string;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

/**
 * Generate a unique voucher number
 * Format: EV-YYYY-XXXXX (e.g., EV-2024-00001)
 */
export async function generateVoucherNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EV-${year}-`;

  // Get the highest voucher number for this year
  const result = await database
    .select({ voucherNumber: expenseVoucher.voucherNumber })
    .from(expenseVoucher)
    .where(ilike(expenseVoucher.voucherNumber, `${prefix}%`))
    .orderBy(desc(expenseVoucher.voucherNumber))
    .limit(1);

  let nextNumber = 1;
  if (result.length > 0 && result[0].voucherNumber) {
    const lastNumber = parseInt(result[0].voucherNumber.replace(prefix, ""), 10);
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(5, "0")}`;
}

/**
 * Create a new expense voucher
 */
export async function createExpenseVoucher(
  data: Omit<CreateExpenseVoucherData, "voucherNumber">
): Promise<ExpenseVoucher> {
  const voucherNumber = await generateVoucherNumber();

  const [result] = await database
    .insert(expenseVoucher)
    .values({
      ...data,
      voucherNumber,
      updatedAt: new Date(),
    })
    .returning();

  return result;
}

/**
 * Find an expense voucher by ID
 */
export async function findExpenseVoucherById(
  id: string
): Promise<ExpenseVoucher | null> {
  const [result] = await database
    .select()
    .from(expenseVoucher)
    .where(eq(expenseVoucher.id, id))
    .limit(1);

  return result || null;
}

/**
 * Find an expense voucher by voucher number
 */
export async function findExpenseVoucherByNumber(
  voucherNumber: string
): Promise<ExpenseVoucher | null> {
  const [result] = await database
    .select()
    .from(expenseVoucher)
    .where(eq(expenseVoucher.voucherNumber, voucherNumber))
    .limit(1);

  return result || null;
}

/**
 * Find an expense voucher by ID with user info
 */
export async function findExpenseVoucherByIdWithUsers(
  id: string
): Promise<ExpenseVoucherWithUsers | null> {
  const result = await database.query.expenseVoucher.findFirst({
    where: eq(expenseVoucher.id, id),
    with: {
      submitter: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      currentApprover: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      finalApprover: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  return result as ExpenseVoucherWithUsers | null;
}

/**
 * Find an expense voucher by ID with all details
 */
export async function findExpenseVoucherByIdWithDetails(
  id: string
): Promise<ExpenseVoucherWithDetails | null> {
  const result = await database.query.expenseVoucher.findFirst({
    where: eq(expenseVoucher.id, id),
    with: {
      submitter: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      currentApprover: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      finalApprover: {
        columns: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      lineItems: true,
      approvalHistory: {
        with: {
          approver: {
            columns: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: (history: typeof expenseVoucherApprovalHistory, helpers: { asc: typeof asc; desc: typeof desc }) => [helpers.asc(history.actionAt)],
      },
    },
  });

  return result as ExpenseVoucherWithDetails | null;
}

/**
 * Update an expense voucher
 */
export async function updateExpenseVoucher(
  id: string,
  data: UpdateExpenseVoucherData
): Promise<ExpenseVoucher | null> {
  const [result] = await database
    .update(expenseVoucher)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(expenseVoucher.id, id))
    .returning();

  return result || null;
}

/**
 * Delete an expense voucher (and all related line items and history)
 */
export async function deleteExpenseVoucher(id: string): Promise<boolean> {
  const result = await database
    .delete(expenseVoucher)
    .where(eq(expenseVoucher.id, id))
    .returning();

  return result.length > 0;
}

/**
 * Get all expense vouchers with optional filters
 */
export async function getAllExpenseVouchers(
  filters: ExpenseVoucherFilters = {}
): Promise<ExpenseVoucher[]> {
  const {
    status,
    reconciliationStatus,
    postingStatus,
    submitterId,
    currentApproverId,
    glAccountCode,
    vendorId,
    searchQuery,
    limit = 50,
    offset = 0,
  } = filters;

  const conditions = [];

  if (status) {
    conditions.push(eq(expenseVoucher.status, status));
  }

  if (reconciliationStatus) {
    conditions.push(eq(expenseVoucher.reconciliationStatus, reconciliationStatus));
  }

  if (postingStatus) {
    conditions.push(eq(expenseVoucher.postingStatus, postingStatus));
  }

  if (submitterId) {
    conditions.push(eq(expenseVoucher.submitterId, submitterId));
  }

  if (currentApproverId) {
    conditions.push(eq(expenseVoucher.currentApproverId, currentApproverId));
  }

  if (glAccountCode) {
    conditions.push(eq(expenseVoucher.glAccountCode, glAccountCode));
  }

  if (vendorId) {
    conditions.push(eq(expenseVoucher.vendorId, vendorId));
  }

  if (searchQuery && searchQuery.trim()) {
    const searchTerm = `%${searchQuery.trim()}%`;
    conditions.push(
      or(
        ilike(expenseVoucher.voucherNumber, searchTerm),
        ilike(expenseVoucher.description, searchTerm),
        ilike(expenseVoucher.vendorName ?? "", searchTerm)
      )
    );
  }

  const query = database
    .select()
    .from(expenseVoucher)
    .orderBy(desc(expenseVoucher.createdAt))
    .limit(limit)
    .offset(offset);

  if (conditions.length > 0) {
    return await query.where(and(...conditions));
  }

  return await query;
}

/**
 * Get expense vouchers count with optional filters
 */
export async function getExpenseVouchersCount(
  filters: ExpenseVoucherFilters = {}
): Promise<number> {
  const {
    status,
    reconciliationStatus,
    postingStatus,
    submitterId,
    currentApproverId,
    glAccountCode,
    vendorId,
    searchQuery,
  } = filters;

  const conditions = [];

  if (status) {
    conditions.push(eq(expenseVoucher.status, status));
  }

  if (reconciliationStatus) {
    conditions.push(eq(expenseVoucher.reconciliationStatus, reconciliationStatus));
  }

  if (postingStatus) {
    conditions.push(eq(expenseVoucher.postingStatus, postingStatus));
  }

  if (submitterId) {
    conditions.push(eq(expenseVoucher.submitterId, submitterId));
  }

  if (currentApproverId) {
    conditions.push(eq(expenseVoucher.currentApproverId, currentApproverId));
  }

  if (glAccountCode) {
    conditions.push(eq(expenseVoucher.glAccountCode, glAccountCode));
  }

  if (vendorId) {
    conditions.push(eq(expenseVoucher.vendorId, vendorId));
  }

  if (searchQuery && searchQuery.trim()) {
    const searchTerm = `%${searchQuery.trim()}%`;
    conditions.push(
      or(
        ilike(expenseVoucher.voucherNumber, searchTerm),
        ilike(expenseVoucher.description, searchTerm),
        ilike(expenseVoucher.vendorName ?? "", searchTerm)
      )
    );
  }

  const query = database.select({ count: count() }).from(expenseVoucher);

  if (conditions.length > 0) {
    const results = await query.where(and(...conditions));
    return results[0]?.count || 0;
  }

  const results = await query;
  return results[0]?.count || 0;
}

// =============================================================================
// Workflow functions
// =============================================================================

/**
 * Submit an expense voucher for approval
 */
export async function submitExpenseVoucherForApproval(
  id: string,
  approvalChain: ApprovalChainStep[]
): Promise<ExpenseVoucher | null> {
  const currentApprover = approvalChain.find((step) => step.order === 1);

  return await updateExpenseVoucher(id, {
    status: "pending_approval",
    submittedAt: new Date(),
    approvalChain: JSON.stringify(approvalChain),
    currentApprovalStep: 1,
    totalApprovalSteps: approvalChain.length,
    currentApproverId: currentApprover?.userId ?? null,
  });
}

/**
 * Approve an expense voucher
 */
export async function approveExpenseVoucher(
  id: string,
  approverId: string,
  comments?: string
): Promise<ExpenseVoucher | null> {
  const voucher = await findExpenseVoucherById(id);
  if (!voucher) return null;

  // Parse current approval chain
  const approvalChain: ApprovalChainStep[] = voucher.approvalChain
    ? JSON.parse(voucher.approvalChain)
    : [];

  // Update current step
  const currentStep = voucher.currentApprovalStep;
  const stepIndex = approvalChain.findIndex((step) => step.order === currentStep);

  if (stepIndex !== -1) {
    approvalChain[stepIndex].status = "approved";
    approvalChain[stepIndex].actionAt = new Date().toISOString();
    approvalChain[stepIndex].comments = comments;
  }

  // Check if this is the final approval
  const isLastStep = currentStep >= voucher.totalApprovalSteps;
  const nextStep = currentStep + 1;
  const nextApprover = approvalChain.find((step) => step.order === nextStep);

  const updateData: UpdateExpenseVoucherData = {
    approvalChain: JSON.stringify(approvalChain),
  };

  if (isLastStep) {
    // Final approval
    updateData.status = "approved";
    updateData.approvedAt = new Date();
    updateData.finalApproverId = approverId;
    updateData.currentApproverId = null;
  } else {
    // Move to next step
    updateData.currentApprovalStep = nextStep;
    updateData.currentApproverId = nextApprover?.userId ?? null;
  }

  return await updateExpenseVoucher(id, updateData);
}

/**
 * Reject an expense voucher
 */
export async function rejectExpenseVoucher(
  id: string,
  approverId: string,
  reason: string,
  comments?: string
): Promise<ExpenseVoucher | null> {
  const voucher = await findExpenseVoucherById(id);
  if (!voucher) return null;

  // Parse and update approval chain
  const approvalChain: ApprovalChainStep[] = voucher.approvalChain
    ? JSON.parse(voucher.approvalChain)
    : [];

  const currentStep = voucher.currentApprovalStep;
  const stepIndex = approvalChain.findIndex((step) => step.order === currentStep);

  if (stepIndex !== -1) {
    approvalChain[stepIndex].status = "rejected";
    approvalChain[stepIndex].actionAt = new Date().toISOString();
    approvalChain[stepIndex].comments = comments || reason;
  }

  return await updateExpenseVoucher(id, {
    status: "rejected",
    rejectedAt: new Date(),
    rejectedById: approverId,
    rejectionReason: reason,
    approvalChain: JSON.stringify(approvalChain),
    currentApproverId: null,
  });
}

/**
 * Post an expense voucher to GL
 */
export async function postExpenseVoucherToGL(
  id: string,
  journalEntryId: string,
  postingReference: string
): Promise<ExpenseVoucher | null> {
  return await updateExpenseVoucher(id, {
    status: "posted",
    postingStatus: "posted",
    postedAt: new Date(),
    glPostingDate: new Date(),
    glJournalEntryId: journalEntryId,
    glPostingReference: postingReference,
    glPostingError: null,
  });
}

/**
 * Mark GL posting as failed
 */
export async function markExpenseVoucherPostingFailed(
  id: string,
  errorMessage: string
): Promise<ExpenseVoucher | null> {
  return await updateExpenseVoucher(id, {
    postingStatus: "failed",
    glPostingError: errorMessage,
  });
}

/**
 * Reconcile an expense voucher
 */
export async function reconcileExpenseVoucher(
  id: string,
  reconciledById: string,
  reference: string,
  notes?: string
): Promise<ExpenseVoucher | null> {
  return await updateExpenseVoucher(id, {
    reconciliationStatus: "reconciled",
    reconciliationDate: new Date(),
    reconciledById,
    reconciliationReference: reference,
    reconciliationNotes: notes,
  });
}

/**
 * Void an expense voucher
 */
export async function voidExpenseVoucher(
  id: string,
  voidedById: string,
  reason: string
): Promise<ExpenseVoucher | null> {
  return await updateExpenseVoucher(id, {
    status: "voided",
    voidedAt: new Date(),
    voidedById,
    voidReason: reason,
  });
}

// =============================================================================
// Line Item functions
// =============================================================================

/**
 * Create a line item for a voucher
 */
export async function createExpenseVoucherLineItem(
  data: CreateExpenseVoucherLineItemData
): Promise<ExpenseVoucherLineItem> {
  const [result] = await database
    .insert(expenseVoucherLineItem)
    .values({
      ...data,
      updatedAt: new Date(),
    })
    .returning();

  return result;
}

/**
 * Create multiple line items for a voucher
 */
export async function createExpenseVoucherLineItems(
  items: CreateExpenseVoucherLineItemData[]
): Promise<ExpenseVoucherLineItem[]> {
  if (items.length === 0) return [];

  const result = await database
    .insert(expenseVoucherLineItem)
    .values(items.map((item) => ({ ...item, updatedAt: new Date() })))
    .returning();

  return result;
}

/**
 * Get all line items for a voucher
 */
export async function getExpenseVoucherLineItems(
  voucherId: string
): Promise<ExpenseVoucherLineItem[]> {
  return await database
    .select()
    .from(expenseVoucherLineItem)
    .where(eq(expenseVoucherLineItem.voucherId, voucherId))
    .orderBy(expenseVoucherLineItem.lineNumber);
}

/**
 * Update a line item
 */
export async function updateExpenseVoucherLineItem(
  id: string,
  data: UpdateExpenseVoucherLineItemData
): Promise<ExpenseVoucherLineItem | null> {
  const [result] = await database
    .update(expenseVoucherLineItem)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(expenseVoucherLineItem.id, id))
    .returning();

  return result || null;
}

/**
 * Delete a line item
 */
export async function deleteExpenseVoucherLineItem(id: string): Promise<boolean> {
  const result = await database
    .delete(expenseVoucherLineItem)
    .where(eq(expenseVoucherLineItem.id, id))
    .returning();

  return result.length > 0;
}

/**
 * Delete all line items for a voucher
 */
export async function deleteExpenseVoucherLineItems(voucherId: string): Promise<boolean> {
  const result = await database
    .delete(expenseVoucherLineItem)
    .where(eq(expenseVoucherLineItem.voucherId, voucherId))
    .returning();

  return result.length > 0;
}

// =============================================================================
// Approval History functions
// =============================================================================

/**
 * Create an approval history entry
 */
export async function createApprovalHistoryEntry(
  data: CreateExpenseVoucherApprovalHistoryData
): Promise<ExpenseVoucherApprovalHistory> {
  const [result] = await database
    .insert(expenseVoucherApprovalHistory)
    .values(data)
    .returning();

  return result;
}

/**
 * Get approval history for a voucher
 */
export async function getExpenseVoucherApprovalHistory(
  voucherId: string
): Promise<ExpenseVoucherApprovalHistory[]> {
  return await database
    .select()
    .from(expenseVoucherApprovalHistory)
    .where(eq(expenseVoucherApprovalHistory.voucherId, voucherId))
    .orderBy(expenseVoucherApprovalHistory.actionAt);
}

// =============================================================================
// Query helpers
// =============================================================================

/**
 * Get pending approval vouchers for a specific approver
 */
export async function getPendingApprovalVouchersForApprover(
  approverId: string,
  filters: Omit<ExpenseVoucherFilters, "currentApproverId" | "status"> = {}
): Promise<ExpenseVoucher[]> {
  return await getAllExpenseVouchers({
    ...filters,
    status: "pending_approval",
    currentApproverId: approverId,
  });
}

/**
 * Get vouchers by submitter
 */
export async function getExpenseVouchersBySubmitter(
  submitterId: string,
  filters: Omit<ExpenseVoucherFilters, "submitterId"> = {}
): Promise<ExpenseVoucher[]> {
  return await getAllExpenseVouchers({ ...filters, submitterId });
}

/**
 * Get vouchers pending GL posting
 */
export async function getVouchersPendingGLPosting(
  filters: Omit<ExpenseVoucherFilters, "status" | "postingStatus"> = {}
): Promise<ExpenseVoucher[]> {
  return await getAllExpenseVouchers({
    ...filters,
    status: "approved",
    postingStatus: "not_posted",
  });
}

/**
 * Get unreconciled vouchers
 */
export async function getUnreconciledVouchers(
  filters: Omit<ExpenseVoucherFilters, "reconciliationStatus"> = {}
): Promise<ExpenseVoucher[]> {
  return await getAllExpenseVouchers({
    ...filters,
    reconciliationStatus: "unreconciled",
  });
}
