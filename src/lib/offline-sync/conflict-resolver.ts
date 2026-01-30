/**
 * Conflict Resolver
 *
 * Handles conflict resolution between client and server data
 * using various strategies.
 */

import type { OfflineEntityType } from "~/db/offline-queue-schema";
import type {
  ConflictDetails,
  ConflictResolutionResult,
  ConflictResolutionStrategy,
  ConflictResolver,
} from "./types";

/**
 * Deep merge two objects, preferring source values
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Get conflicting fields between two objects
 */
function getConflictingFields<T extends Record<string, unknown>>(
  clientData: T,
  serverData: T
): string[] {
  const conflicts: string[] = [];
  const allKeys = new Set([...Object.keys(clientData), ...Object.keys(serverData)]);

  for (const key of allKeys) {
    const clientValue = clientData[key];
    const serverValue = serverData[key];

    if (JSON.stringify(clientValue) !== JSON.stringify(serverValue)) {
      conflicts.push(key);
    }
  }

  return conflicts;
}

/**
 * ConflictResolver class
 * Handles conflict resolution between client and server data
 */
export class ConflictResolverService {
  private defaultStrategy: ConflictResolutionStrategy;
  private entityStrategies: Partial<Record<OfflineEntityType, ConflictResolutionStrategy>>;
  private customResolvers: Partial<Record<OfflineEntityType, ConflictResolver<any>>>;
  private debug: boolean;

  constructor(options: {
    defaultStrategy?: ConflictResolutionStrategy;
    entityStrategies?: Partial<Record<OfflineEntityType, ConflictResolutionStrategy>>;
    customResolvers?: Partial<Record<OfflineEntityType, ConflictResolver<any>>>;
    debug?: boolean;
  } = {}) {
    this.defaultStrategy = options.defaultStrategy ?? "client_wins";
    this.entityStrategies = options.entityStrategies ?? {};
    this.customResolvers = options.customResolvers ?? {};
    this.debug = options.debug ?? false;
  }

  /**
   * Log debug messages
   */
  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log("[ConflictResolver]", ...args);
    }
  }

  /**
   * Get the strategy for a specific entity type
   */
  getStrategyForEntity(entityType: OfflineEntityType): ConflictResolutionStrategy {
    return this.entityStrategies[entityType] ?? this.defaultStrategy;
  }

  /**
   * Set a custom resolver for an entity type
   */
  setCustomResolver<T = unknown>(entityType: OfflineEntityType, resolver: ConflictResolver<T>): void {
    this.customResolvers[entityType] = resolver as ConflictResolver<any>;
  }

  /**
   * Detect if there's a conflict between client and server data
   */
  detectConflict<T extends Record<string, unknown>>(
    clientData: T,
    serverData: T,
    clientTimestamp: Date,
    serverTimestamp?: Date
  ): { hasConflict: boolean; conflictingFields: string[] } {
    // If server data doesn't exist, no conflict
    if (!serverData) {
      return { hasConflict: false, conflictingFields: [] };
    }

    const conflictingFields = getConflictingFields(clientData, serverData);

    // If no field differences, no conflict
    if (conflictingFields.length === 0) {
      return { hasConflict: false, conflictingFields: [] };
    }

    // If we have a server timestamp and client made changes after server,
    // there might not be a conflict (optimistic update scenario)
    if (serverTimestamp && clientTimestamp > serverTimestamp) {
      this.log("Client timestamp is newer, potential optimistic update");
    }

    return { hasConflict: true, conflictingFields };
  }

  /**
   * Resolve a conflict using the configured strategy
   */
  async resolve<T = unknown>(
    conflict: ConflictDetails<T>
  ): Promise<ConflictResolutionResult<T>> {
    const strategy = conflict.queueItem.conflictResolution ??
      this.getStrategyForEntity(conflict.entityType);

    this.log(`Resolving conflict for ${conflict.entityType}:${conflict.entityId} using ${strategy}`);

    // Check for custom resolver first
    if (strategy === "custom" || this.customResolvers[conflict.entityType]) {
      const customResolver = this.customResolvers[conflict.entityType] as ConflictResolver<T> | undefined;
      if (customResolver) {
        return await customResolver(conflict);
      }
    }

    switch (strategy) {
      case "client_wins":
        return this.resolveClientWins(conflict);

      case "server_wins":
        return this.resolveServerWins(conflict);

      case "merge":
        return this.resolveMerge(conflict);

      case "timestamp":
        return this.resolveByTimestamp(conflict);

      case "manual":
        return this.requireManualResolution(conflict);

      default:
        return {
          resolved: false,
          strategyUsed: strategy,
          error: `Unknown conflict resolution strategy: ${strategy}`,
        };
    }
  }

  /**
   * Client wins - use client data
   */
  private resolveClientWins<T>(
    conflict: ConflictDetails<T>
  ): ConflictResolutionResult<T> {
    this.log("Resolving with client_wins strategy");

    return {
      resolved: true,
      resolvedData: conflict.clientData,
      strategyUsed: "client_wins",
    };
  }

  /**
   * Server wins - use server data
   */
  private resolveServerWins<T>(
    conflict: ConflictDetails<T>
  ): ConflictResolutionResult<T> {
    this.log("Resolving with server_wins strategy");

    return {
      resolved: true,
      resolvedData: conflict.serverData,
      strategyUsed: "server_wins",
    };
  }

  /**
   * Merge - try to merge client and server data
   */
  private resolveMerge<T>(
    conflict: ConflictDetails<T>
  ): ConflictResolutionResult<T> {
    this.log("Resolving with merge strategy");

    try {
      // For object payloads, try field-level merge
      if (
        typeof conflict.clientData === "object" &&
        typeof conflict.serverData === "object" &&
        !Array.isArray(conflict.clientData) &&
        !Array.isArray(conflict.serverData)
      ) {
        const merged = deepMerge(
          conflict.serverData as Record<string, unknown>,
          conflict.clientData as Record<string, unknown>
        ) as T;

        return {
          resolved: true,
          resolvedData: merged,
          strategyUsed: "merge",
        };
      }

      // For non-objects, fall back to client wins
      this.log("Cannot merge non-object data, falling back to client_wins");
      return this.resolveClientWins(conflict);
    } catch (error) {
      return {
        resolved: false,
        strategyUsed: "merge",
        error: `Merge failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Timestamp - most recent modification wins
   */
  private resolveByTimestamp<T>(
    conflict: ConflictDetails<T>
  ): ConflictResolutionResult<T> {
    this.log("Resolving with timestamp strategy");

    // If no server timestamp, client wins
    if (!conflict.serverTimestamp) {
      return this.resolveClientWins(conflict);
    }

    const clientTime = conflict.clientTimestamp.getTime();
    const serverTime = conflict.serverTimestamp.getTime();

    if (clientTime >= serverTime) {
      this.log("Client timestamp is newer or equal");
      return {
        resolved: true,
        resolvedData: conflict.clientData,
        strategyUsed: "timestamp",
      };
    } else {
      this.log("Server timestamp is newer");
      return {
        resolved: true,
        resolvedData: conflict.serverData,
        strategyUsed: "timestamp",
      };
    }
  }

  /**
   * Manual - require user intervention
   */
  private requireManualResolution<T>(
    conflict: ConflictDetails<T>
  ): ConflictResolutionResult<T> {
    this.log("Requiring manual resolution");

    return {
      resolved: false,
      strategyUsed: "manual",
      requiresManualResolution: true,
      error: "This conflict requires manual resolution",
    };
  }

  /**
   * Create conflict details from queue item and server response
   */
  createConflictDetails<T>(
    queueItem: ConflictDetails<T>["queueItem"],
    serverData: T,
    serverTimestamp?: Date
  ): ConflictDetails<T> {
    const clientData = queueItem.payload as T;
    const conflictingFields = typeof clientData === "object" && typeof serverData === "object"
      ? getConflictingFields(
          clientData as Record<string, unknown>,
          serverData as Record<string, unknown>
        )
      : [];

    return {
      queueItem,
      clientData,
      serverData,
      entityId: queueItem.entityId ?? queueItem.id,
      entityType: queueItem.entityType,
      clientTimestamp: queueItem.updatedAt,
      serverTimestamp,
      conflictingFields,
    };
  }
}

/**
 * Create a default conflict resolver instance
 */
export function createConflictResolver(
  options?: ConstructorParameters<typeof ConflictResolverService>[0]
): ConflictResolverService {
  return new ConflictResolverService(options);
}
