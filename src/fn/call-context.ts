/**
 * Call Context Server Functions
 * Server-side functions for fetching customer context during calls
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authenticatedMiddleware } from "./middleware";
import {
  getCallContext,
  findCustomerByPhone,
  getRecentInteractions,
  getOpenTickets,
  getCallHistory,
  searchCustomers,
  type CallContext,
  type CustomerInfo,
  type RecentInteraction,
  type OpenTicket,
  type CallContextFilters,
} from "~/data-access/call-context";

// ============================================================================
// Zod Schemas
// ============================================================================

const callContextFiltersSchema = z.object({
  interactionsLimit: z.number().min(1).max(50).optional(),
  ticketsLimit: z.number().min(1).max(50).optional(),
  callHistoryLimit: z.number().min(1).max(50).optional(),
  includeResolvedTickets: z.boolean().optional(),
  daysBack: z.number().min(1).max(365).optional(),
});

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get full call context for a customer
 * This is the main function for fetching all context during a call
 */
export const getCallContextFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z.object({
      phoneOrUserId: z.string().min(1).max(100),
      filters: callContextFiltersSchema.optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }): Promise<GetCallContextResult> => {
    try {
      const context = await getCallContext(data.phoneOrUserId, data.filters);

      return {
        success: true,
        context,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get call context",
      };
    }
  });

/**
 * Get customer info by phone number or user ID
 */
export const getCustomerInfoFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z.object({
      phoneOrUserId: z.string().min(1).max(100),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }): Promise<GetCustomerInfoResult> => {
    try {
      const customer = await findCustomerByPhone(data.phoneOrUserId);

      if (!customer) {
        return {
          success: true,
          customer: null,
        };
      }

      return {
        success: true,
        customer,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get customer info",
      };
    }
  });

/**
 * Get recent interactions for a customer
 */
export const getRecentInteractionsFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z.object({
      userId: z.string().min(1),
      limit: z.number().min(1).max(50).optional(),
      daysBack: z.number().min(1).max(365).optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }): Promise<GetRecentInteractionsResult> => {
    try {
      const interactions = await getRecentInteractions(data.userId, {
        limit: data.limit,
        daysBack: data.daysBack,
      });

      return {
        success: true,
        interactions,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get recent interactions",
      };
    }
  });

/**
 * Get open tickets for a customer
 */
export const getOpenTicketsFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z.object({
      userId: z.string().min(1),
      limit: z.number().min(1).max(50).optional(),
      includeResolved: z.boolean().optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }): Promise<GetOpenTicketsResult> => {
    try {
      const tickets = await getOpenTickets(data.userId, {
        limit: data.limit,
        includeResolved: data.includeResolved,
      });

      return {
        success: true,
        tickets,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get open tickets",
      };
    }
  });

/**
 * Get call history for a customer
 */
export const getCallHistoryFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z.object({
      userId: z.string().min(1),
      limit: z.number().min(1).max(100).optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }): Promise<GetCallHistoryResult> => {
    try {
      const callHistory = await getCallHistory(data.userId, {
        limit: data.limit,
      });

      return {
        success: true,
        callHistory,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get call history",
      };
    }
  });

/**
 * Search for customers by name, email, or phone
 */
export const searchCustomersFn = createServerFn({
  method: "GET",
})
  .inputValidator(
    z.object({
      query: z.string().min(1).max(100),
      limit: z.number().min(1).max(50).optional(),
    })
  )
  .middleware([authenticatedMiddleware])
  .handler(async ({ data }): Promise<SearchCustomersResult> => {
    try {
      const customers = await searchCustomers(data.query, data.limit);

      return {
        success: true,
        customers,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to search customers",
      };
    }
  });

// ============================================================================
// Type Exports
// ============================================================================

export type GetCallContextResult =
  | { success: true; context: CallContext }
  | { success: false; error: string };

export type GetCustomerInfoResult =
  | { success: true; customer: CustomerInfo | null }
  | { success: false; error: string };

export type GetRecentInteractionsResult =
  | { success: true; interactions: RecentInteraction[] }
  | { success: false; error: string };

export type GetOpenTicketsResult =
  | { success: true; tickets: OpenTicket[] }
  | { success: false; error: string };

export type GetCallHistoryResult =
  | {
      success: true;
      callHistory: {
        totalCalls: number;
        recentCalls: import("~/db/schema").CallRecord[];
        lastCallDate: Date | null;
      };
    }
  | { success: false; error: string };

export type SearchCustomersResult =
  | { success: true; customers: CustomerInfo[] }
  | { success: false; error: string };
