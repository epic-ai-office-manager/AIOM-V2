/**
 * Reloadly API Types
 *
 * Type definitions for the Reloadly Airtime & Data Top-up API.
 */

// =============================================================================
// Configuration Types
// =============================================================================

export interface ReloadlyConfig {
  clientId: string;
  clientSecret: string;
  sandbox?: boolean;
}

export interface ReloadlyAuthToken {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: Date;
}

// =============================================================================
// Operator Types
// =============================================================================

export interface ReloadlyCountry {
  isoName: string;
  name: string;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  flag: string;
  callingCodes: string[];
}

export interface ReloadlyFxRate {
  id: number;
  name: string;
  currencyCode: string;
  rate: number;
}

export interface ReloadlyOperator {
  id: number;
  operatorId: number;
  name: string;
  bundle: boolean;
  data: boolean;
  pin: boolean;
  supportsLocalAmounts: boolean;
  supportsGeographicalRechargePlans: boolean;
  denominationType: 'FIXED' | 'RANGE';
  senderCurrencyCode: string;
  senderCurrencySymbol: string;
  destinationCurrencyCode: string;
  destinationCurrencySymbol: string;
  commission: number;
  internationalDiscount: number;
  localDiscount: number;
  mostPopularAmount: number | null;
  mostPopularLocalAmount: number | null;
  minAmount: number | null;
  maxAmount: number | null;
  localMinAmount: number | null;
  localMaxAmount: number | null;
  country: ReloadlyCountry;
  fx: ReloadlyFxRate;
  logoUrls: string[];
  fixedAmounts: number[];
  fixedAmountsDescriptions: Record<string, string>;
  localFixedAmounts: number[];
  localFixedAmountsDescriptions: Record<string, string>;
  suggestedAmounts: number[];
  suggestedAmountsMap: Record<string, number>;
  promotions: ReloadlyPromotion[];
}

export interface ReloadlyPromotion {
  id: number;
  operatorId: number;
  title: string;
  title2: string;
  description: string;
  startDate: string;
  endDate: string;
  denominations: string;
  localDenominations: string;
}

// =============================================================================
// Auto-detect Types
// =============================================================================

export interface ReloadlyOperatorDetection {
  operatorId: number;
  operatorName: string;
  name: string;
  bundle: boolean;
  data: boolean;
  pin: boolean;
  supportsLocalAmounts: boolean;
  denominationType: 'FIXED' | 'RANGE';
  senderCurrencyCode: string;
  senderCurrencySymbol: string;
  destinationCurrencyCode: string;
  destinationCurrencySymbol: string;
  commission: number;
  internationalDiscount: number;
  localDiscount: number;
  mostPopularAmount: number | null;
  minAmount: number | null;
  maxAmount: number | null;
  localMinAmount: number | null;
  localMaxAmount: number | null;
  country: ReloadlyCountry;
  fx: ReloadlyFxRate;
  logoUrls: string[];
  fixedAmounts: number[];
  localFixedAmounts: number[];
  suggestedAmounts: number[];
}

// =============================================================================
// Top-up Request/Response Types
// =============================================================================

export interface ReloadlyTopupRequest {
  operatorId: number;
  amount: number;
  useLocalAmount?: boolean;
  customIdentifier?: string;
  recipientPhone: {
    countryCode: string;
    number: string;
  };
  senderPhone?: {
    countryCode: string;
    number: string;
  };
}

export interface ReloadlyTopupResponse {
  transactionId: number;
  operatorTransactionId: string | null;
  customIdentifier: string | null;
  recipientPhone: string;
  recipientEmail: string | null;
  senderPhone: string | null;
  countryCode: string;
  operatorId: number;
  operatorName: string;
  discount: number;
  discountCurrencyCode: string;
  requestedAmount: number;
  requestedAmountCurrencyCode: string;
  deliveredAmount: number;
  deliveredAmountCurrencyCode: string;
  transactionDate: string;
  pinDetail: ReloadlyPinDetail | null;
  balanceInfo: ReloadlyBalanceInfo;
}

export interface ReloadlyPinDetail {
  serial: string;
  info1: string;
  info2: string;
  info3: string;
  value: number | null;
  code: string;
  ivr: string;
  validity: string;
}

export interface ReloadlyBalanceInfo {
  oldBalance: number;
  newBalance: number;
  currencyCode: string;
  currencyName: string;
  updatedAt: string;
}

// =============================================================================
// Transaction Types (API Response Types)
// =============================================================================

/**
 * Reloadly API Transaction response
 * This is the transaction object returned from Reloadly's API
 */
export interface ReloadlyApiTransaction {
  transactionId: number;
  operatorTransactionId: string | null;
  customIdentifier: string | null;
  recipientPhone: string;
  recipientEmail: string | null;
  senderPhone: string | null;
  countryCode: string;
  operatorId: number;
  operatorName: string;
  discount: number;
  discountCurrencyCode: string;
  requestedAmount: number;
  requestedAmountCurrencyCode: string;
  deliveredAmount: number;
  deliveredAmountCurrencyCode: string;
  transactionDate: string;
  pinDetail: ReloadlyPinDetail | null;
  status: ReloadlyApiTransactionStatus;
}

export type ReloadlyApiTransactionStatus = 'SUCCESSFUL' | 'PENDING' | 'REFUNDED' | 'FAILED';

/** @deprecated Use ReloadlyApiTransaction instead */
export type ReloadlyTransaction = ReloadlyApiTransaction;

/** @deprecated Use ReloadlyApiTransactionStatus instead */
export type ReloadlyTransactionStatus = ReloadlyApiTransactionStatus;

// =============================================================================
// Account Types
// =============================================================================

export interface ReloadlyAccountBalance {
  balance: number;
  currencyCode: string;
  currencyName: string;
  updatedAt: string;
}

// =============================================================================
// Product Types (for data bundles)
// =============================================================================

export interface ReloadlyProduct {
  id: number;
  name: string;
  description: string | null;
  price: number;
  priceType: 'FIXED' | 'RANGE';
  localPrice: number;
  localCurrencyCode: string;
  currencyCode: string;
  validity: string | null;
  dataAmount: number | null;
  dataUnit: string | null;
  unlimited: boolean;
}

// =============================================================================
// Error Types
// =============================================================================

export interface ReloadlyAPIError {
  errorCode: string;
  message: string;
  details?: string[];
  path?: string;
  timestamp?: string;
}

// =============================================================================
// Pagination Types
// =============================================================================

export interface ReloadlyPaginatedResponse<T> {
  content: T[];
  pageable: {
    sort: {
      sorted: boolean;
      unsorted: boolean;
      empty: boolean;
    };
    pageSize: number;
    pageNumber: number;
    offset: number;
    paged: boolean;
    unpaged: boolean;
  };
  totalElements: number;
  totalPages: number;
  last: boolean;
  first: boolean;
  sort: {
    sorted: boolean;
    unsorted: boolean;
    empty: boolean;
  };
  numberOfElements: number;
  size: number;
  number: number;
  empty: boolean;
}

// =============================================================================
// Filter Types
// =============================================================================

export interface ReloadlyOperatorFilters {
  countryCode?: string;
  includeBundles?: boolean;
  includeData?: boolean;
  includePin?: boolean;
  suggestedAmountsMap?: boolean;
  suggestedAmounts?: boolean;
  includeFixedDenominationType?: boolean;
  includeRangeDenominationType?: boolean;
  page?: number;
  size?: number;
}

/**
 * Query parameters for Reloadly API transaction history endpoint
 */
export interface ReloadlyApiTransactionFilters {
  startDate?: string;
  endDate?: string;
  operatorId?: number;
  countryCode?: string;
  operatorName?: string;
  customIdentifier?: string;
  page?: number;
  size?: number;
}

/** @deprecated Use ReloadlyApiTransactionFilters instead */
export type ReloadlyTransactionFilters = ReloadlyApiTransactionFilters;
