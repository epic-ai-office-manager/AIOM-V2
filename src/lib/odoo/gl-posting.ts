/**
 * Odoo GL Posting Service
 *
 * Handles automatic posting of approved and reconciled expenses
 * to the General Ledger in Odoo with proper account coding and journal entries.
 */

import type { OdooClient } from "./client";
import type {
  AccountMove,
  AccountMoveLine,
  AccountJournal,
  AccountAccount,
  XmlRpcValue,
} from "./types";

// =============================================================================
// Types for GL Posting
// =============================================================================

export interface GLPostingLineItem {
  /** Description for the journal entry line */
  description: string;
  /** Debit amount (positive for debit entries) */
  debit: number;
  /** Credit amount (positive for credit entries) */
  credit: number;
  /** GL Account code (e.g., "6010" for expenses) */
  accountCode: string;
  /** Cost center code (optional) */
  costCenter?: string;
  /** Department code (optional) */
  department?: string;
  /** Project code (optional) */
  projectCode?: string;
  /** Partner/Vendor ID in Odoo (optional) */
  partnerId?: number;
  /** Tax code (optional) */
  taxCode?: string;
  /** Tax amount (optional) */
  taxAmount?: number;
}

export interface GLPostingRequest {
  /** Unique reference for the expense voucher */
  voucherNumber: string;
  /** Posting date (defaults to today if not provided) */
  postingDate?: string;
  /** Total amount of the expense */
  totalAmount: number;
  /** Currency code (e.g., "USD") */
  currency: string;
  /** Description/memo for the journal entry */
  description: string;
  /** Vendor/Payee name */
  vendorName?: string;
  /** Vendor ID in Odoo (res.partner) */
  vendorId?: number;
  /** Line items for the journal entry */
  lineItems: GLPostingLineItem[];
  /** Journal code to post to (defaults to "MISC" if not specified) */
  journalCode?: string;
  /** AP account code for the credit side (defaults to standard AP account) */
  apAccountCode?: string;
  /** External reference for cross-system tracking */
  externalReference?: string;
  /** Tags for categorization */
  tags?: string[];
}

export interface GLPostingResult {
  /** Whether the posting was successful */
  success: boolean;
  /** The Odoo journal entry ID (account.move) */
  journalEntryId?: number;
  /** The journal entry name/number in Odoo */
  journalEntryName?: string;
  /** Reference number for the posting */
  postingReference?: string;
  /** Error message if posting failed */
  error?: string;
  /** Error code if posting failed */
  errorCode?: string;
  /** Additional details about the posting */
  details?: {
    journalId: number;
    journalName: string;
    lineCount: number;
    totalDebit: number;
    totalCredit: number;
  };
}

export interface GLAccountInfo {
  id: number;
  code: string;
  name: string;
  accountType: string;
  isReconcile: boolean;
}

export interface GLJournalInfo {
  id: number;
  code: string;
  name: string;
  type: string;
  defaultAccountId?: number;
}

// =============================================================================
// GL Posting Service Class
// =============================================================================

export class OdooGLPostingService {
  private client: OdooClient;
  private accountCache: Map<string, GLAccountInfo> = new Map();
  private journalCache: Map<string, GLJournalInfo> = new Map();

  constructor(client: OdooClient) {
    this.client = client;
  }

  // ===========================================================================
  // Account Lookups
  // ===========================================================================

  /**
   * Finds a GL account by its code
   */
  async findAccountByCode(code: string): Promise<GLAccountInfo | null> {
    // Check cache first
    if (this.accountCache.has(code)) {
      return this.accountCache.get(code)!;
    }

    try {
      const accounts = await this.client.searchRead<AccountAccount>(
        "account.account",
        [["code", "=", code]],
        {
          fields: ["id", "code", "name", "account_type", "reconcile"],
          limit: 1,
        }
      );

      if (accounts.length === 0) {
        return null;
      }

      const account = accounts[0];
      const accountInfo: GLAccountInfo = {
        id: account.id,
        code: account.code,
        name: account.name,
        accountType: (account.account_type as string) || "asset",
        isReconcile: account.reconcile ?? false,
      };

      // Cache the result
      this.accountCache.set(code, accountInfo);
      return accountInfo;
    } catch (error) {
      console.error(`Error finding account by code ${code}:`, error);
      return null;
    }
  }

  /**
   * Finds accounts by code prefix (e.g., "6%" for all expense accounts)
   */
  async findAccountsByPrefix(prefix: string): Promise<GLAccountInfo[]> {
    try {
      const accounts = await this.client.searchRead<AccountAccount>(
        "account.account",
        [["code", "like", `${prefix}%`]],
        {
          fields: ["id", "code", "name", "account_type", "reconcile"],
          order: "code asc",
        }
      );

      return accounts.map((account) => ({
        id: account.id,
        code: account.code,
        name: account.name,
        accountType: (account.account_type as string) || "asset",
        isReconcile: account.reconcile ?? false,
      }));
    } catch (error) {
      console.error(`Error finding accounts by prefix ${prefix}:`, error);
      return [];
    }
  }

  /**
   * Gets the default AP (Accounts Payable) account
   */
  async getDefaultAPAccount(): Promise<GLAccountInfo | null> {
    try {
      // Search for account with type 'liability_payable'
      const accounts = await this.client.searchRead<AccountAccount>(
        "account.account",
        [["account_type", "=", "liability_payable"]],
        {
          fields: ["id", "code", "name", "account_type", "reconcile"],
          limit: 1,
          order: "code asc",
        }
      );

      if (accounts.length === 0) {
        // Fallback: Try common AP account codes
        for (const code of ["2000", "2100", "200000", "211000"]) {
          const account = await this.findAccountByCode(code);
          if (account) return account;
        }
        return null;
      }

      const account = accounts[0];
      return {
        id: account.id,
        code: account.code,
        name: account.name,
        accountType: (account.account_type as string) || "liability_payable",
        isReconcile: account.reconcile ?? true,
      };
    } catch (error) {
      console.error("Error finding default AP account:", error);
      return null;
    }
  }

  // ===========================================================================
  // Journal Lookups
  // ===========================================================================

  /**
   * Finds a journal by its code
   */
  async findJournalByCode(code: string): Promise<GLJournalInfo | null> {
    // Check cache first
    if (this.journalCache.has(code)) {
      return this.journalCache.get(code)!;
    }

    try {
      const journals = await this.client.searchRead<AccountJournal>(
        "account.journal",
        [["code", "=", code]],
        {
          fields: ["id", "code", "name", "type", "default_account_id"],
          limit: 1,
        }
      );

      if (journals.length === 0) {
        return null;
      }

      const journal = journals[0];
      const journalInfo: GLJournalInfo = {
        id: journal.id,
        code: journal.code,
        name: journal.name,
        type: (journal.type as string) || "general",
        defaultAccountId:
          journal.default_account_id && Array.isArray(journal.default_account_id)
            ? journal.default_account_id[0]
            : undefined,
      };

      // Cache the result
      this.journalCache.set(code, journalInfo);
      return journalInfo;
    } catch (error) {
      console.error(`Error finding journal by code ${code}:`, error);
      return null;
    }
  }

  /**
   * Gets the default expense journal (usually 'MISC' or 'EXP')
   */
  async getDefaultExpenseJournal(): Promise<GLJournalInfo | null> {
    // Try common expense journal codes
    for (const code of ["EXP", "MISC", "GEN", "JV"]) {
      const journal = await this.findJournalByCode(code);
      if (journal) return journal;
    }

    // Fallback: Get the first general journal
    try {
      const journals = await this.client.searchRead<AccountJournal>(
        "account.journal",
        [["type", "=", "general"]],
        {
          fields: ["id", "code", "name", "type", "default_account_id"],
          limit: 1,
          order: "sequence asc",
        }
      );

      if (journals.length > 0) {
        const journal = journals[0];
        return {
          id: journal.id,
          code: journal.code,
          name: journal.name,
          type: (journal.type as string) || "general",
          defaultAccountId:
            journal.default_account_id && Array.isArray(journal.default_account_id)
              ? journal.default_account_id[0]
              : undefined,
        };
      }
    } catch (error) {
      console.error("Error finding default expense journal:", error);
    }

    return null;
  }

  // ===========================================================================
  // GL Posting Operations
  // ===========================================================================

  /**
   * Posts an expense voucher to the General Ledger in Odoo
   */
  async postExpenseToGL(request: GLPostingRequest): Promise<GLPostingResult> {
    try {
      // 1. Validate and get journal
      const journal = request.journalCode
        ? await this.findJournalByCode(request.journalCode)
        : await this.getDefaultExpenseJournal();

      if (!journal) {
        return {
          success: false,
          error: "No suitable journal found for expense posting",
          errorCode: "JOURNAL_NOT_FOUND",
        };
      }

      // 2. Get AP account for the credit side
      let apAccount: GLAccountInfo | null = null;
      if (request.apAccountCode) {
        apAccount = await this.findAccountByCode(request.apAccountCode);
      }
      if (!apAccount) {
        apAccount = await this.getDefaultAPAccount();
      }
      if (!apAccount) {
        return {
          success: false,
          error: "No Accounts Payable account found for credit entry",
          errorCode: "AP_ACCOUNT_NOT_FOUND",
        };
      }

      // 3. Validate and get expense accounts for debit side
      const moveLines: Record<string, XmlRpcValue>[] = [];
      let totalDebit = 0;
      let totalCredit = 0;

      // Add debit entries for each line item
      for (const lineItem of request.lineItems) {
        const expenseAccount = await this.findAccountByCode(lineItem.accountCode);
        if (!expenseAccount) {
          return {
            success: false,
            error: `Expense account ${lineItem.accountCode} not found in Odoo`,
            errorCode: "EXPENSE_ACCOUNT_NOT_FOUND",
          };
        }

        const debitAmount = lineItem.debit || 0;
        const creditAmount = lineItem.credit || 0;

        if (debitAmount > 0) {
          totalDebit += debitAmount;
          moveLines.push({
            account_id: expenseAccount.id,
            name: lineItem.description || request.description,
            debit: debitAmount,
            credit: 0,
            partner_id: lineItem.partnerId || request.vendorId || false,
          });
        }

        if (creditAmount > 0) {
          totalCredit += creditAmount;
          moveLines.push({
            account_id: expenseAccount.id,
            name: lineItem.description || request.description,
            debit: 0,
            credit: creditAmount,
            partner_id: lineItem.partnerId || request.vendorId || false,
          });
        }
      }

      // If no explicit credit entries, add AP credit entry for total amount
      if (totalCredit === 0) {
        totalCredit = request.totalAmount;
        moveLines.push({
          account_id: apAccount.id,
          name: `${request.vendorName || "Expense"} - ${request.voucherNumber}`,
          debit: 0,
          credit: request.totalAmount,
          partner_id: request.vendorId || false,
        });
      }

      // Validate debits = credits
      const debitTotal = moveLines.reduce((sum, line) => sum + ((line.debit as number) || 0), 0);
      const creditTotal = moveLines.reduce((sum, line) => sum + ((line.credit as number) || 0), 0);

      if (Math.abs(debitTotal - creditTotal) > 0.01) {
        return {
          success: false,
          error: `Journal entry is not balanced. Debits: ${debitTotal.toFixed(2)}, Credits: ${creditTotal.toFixed(2)}`,
          errorCode: "UNBALANCED_ENTRY",
        };
      }

      // 4. Create the journal entry in Odoo
      const postingDate = request.postingDate || new Date().toISOString().split("T")[0];

      const moveValues: Record<string, XmlRpcValue> = {
        journal_id: journal.id,
        date: postingDate,
        ref: request.voucherNumber,
        narration: request.description,
        move_type: "entry",
        line_ids: moveLines.map((line) => [0, 0, line]),
      };

      // Add partner if provided
      if (request.vendorId) {
        moveValues.partner_id = request.vendorId;
      }

      // Create the account.move record
      const moveId = await this.client.create("account.move", moveValues);

      if (!moveId) {
        return {
          success: false,
          error: "Failed to create journal entry in Odoo",
          errorCode: "CREATE_FAILED",
        };
      }

      // 5. Post the journal entry (change state from draft to posted)
      try {
        await this.client.callMethodOnIds("account.move", [moveId], "action_post");
      } catch (postError) {
        // If posting fails, the entry is still in draft - return with warning
        console.warn(`Journal entry ${moveId} created but posting failed:`, postError);
      }

      // 6. Get the created move details
      const createdMoves = await this.client.read<AccountMove>("account.move", [moveId], {
        fields: ["id", "name", "state", "date", "amount_total"],
      });

      const createdMove = createdMoves[0];

      return {
        success: true,
        journalEntryId: moveId,
        journalEntryName: createdMove?.name || `JE-${moveId}`,
        postingReference: `${journal.code}/${postingDate}/${moveId}`,
        details: {
          journalId: journal.id,
          journalName: journal.name,
          lineCount: moveLines.length,
          totalDebit: debitTotal,
          totalCredit: creditTotal,
        },
      };
    } catch (error) {
      console.error("Error posting expense to GL:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error during GL posting",
        errorCode: "POSTING_FAILED",
      };
    }
  }

  /**
   * Reverses a previously posted journal entry
   */
  async reverseJournalEntry(
    journalEntryId: number,
    reversalDate?: string,
    reason?: string
  ): Promise<GLPostingResult> {
    try {
      // Get the original entry
      const originalMoves = await this.client.read<AccountMove>("account.move", [journalEntryId], {
        fields: ["id", "name", "state", "journal_id"],
      });

      if (originalMoves.length === 0) {
        return {
          success: false,
          error: `Journal entry ${journalEntryId} not found`,
          errorCode: "ENTRY_NOT_FOUND",
        };
      }

      const originalMove = originalMoves[0];

      if (originalMove.state !== "posted") {
        return {
          success: false,
          error: `Journal entry ${journalEntryId} is not posted (state: ${originalMove.state})`,
          errorCode: "ENTRY_NOT_POSTED",
        };
      }

      // Create reversal using Odoo's built-in method
      const date = reversalDate || new Date().toISOString().split("T")[0];

      const reversalResult = await this.client.callMethodOnIds<{
        res_id: number;
      }>("account.move", [journalEntryId], "action_reverse", [], {
        default_date: date,
        default_ref: reason || `Reversal of ${originalMove.name}`,
      });

      // Handle the reversal wizard response
      let reversalMoveId: number;

      if (typeof reversalResult === "object" && reversalResult?.res_id) {
        reversalMoveId = reversalResult.res_id;
      } else if (typeof reversalResult === "number") {
        reversalMoveId = reversalResult;
      } else {
        // Try to find the reversal by reference
        const reversals = await this.client.searchRead<AccountMove>(
          "account.move",
          [
            ["ref", "ilike", `Reversal of ${originalMove.name}`],
            ["date", "=", date],
          ],
          { fields: ["id", "name"], limit: 1, order: "id desc" }
        );

        if (reversals.length > 0) {
          reversalMoveId = reversals[0].id;
        } else {
          return {
            success: false,
            error: "Reversal created but ID could not be retrieved",
            errorCode: "REVERSAL_ID_UNKNOWN",
          };
        }
      }

      // Get the reversal details
      const reversalMoves = await this.client.read<AccountMove>("account.move", [reversalMoveId], {
        fields: ["id", "name", "state"],
      });

      const reversalMove = reversalMoves[0];

      return {
        success: true,
        journalEntryId: reversalMoveId,
        journalEntryName: reversalMove?.name || `REV-${reversalMoveId}`,
        postingReference: `REVERSAL/${date}/${reversalMoveId}`,
      };
    } catch (error) {
      console.error("Error reversing journal entry:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error during reversal",
        errorCode: "REVERSAL_FAILED",
      };
    }
  }

  /**
   * Gets the status of a journal entry in Odoo
   */
  async getJournalEntryStatus(
    journalEntryId: number
  ): Promise<{ exists: boolean; state?: string; name?: string; amountTotal?: number }> {
    try {
      const moves = await this.client.read<AccountMove>("account.move", [journalEntryId], {
        fields: ["id", "name", "state", "amount_total"],
      });

      if (moves.length === 0) {
        return { exists: false };
      }

      const move = moves[0];
      return {
        exists: true,
        state: move.state,
        name: move.name,
        amountTotal: move.amount_total,
      };
    } catch (error) {
      console.error("Error getting journal entry status:", error);
      return { exists: false };
    }
  }

  /**
   * Clears the account and journal caches
   */
  clearCache(): void {
    this.accountCache.clear();
    this.journalCache.clear();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a new GL Posting service instance
 */
export function createGLPostingService(client: OdooClient): OdooGLPostingService {
  return new OdooGLPostingService(client);
}
