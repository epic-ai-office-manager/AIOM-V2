/**
 * Migration Wrapper for Gradual Rollout
 * 
 * Allows switching between old custom client and new SDK client
 * via USE_SDK_CLIENT environment variable.
 * 
 * Usage:
 * - Set USE_SDK_CLIENT=true to use new SDK implementation
 * - Set USE_SDK_CLIENT=false (or unset) to use legacy implementation
 */

import { getClaudeClient as getOldClient } from './client';
import { getClaudeSDKClient } from './sdk-client';

/**
 * Get Claude client based on migration flag
 * 
 * This wrapper allows gradual rollout and A/B testing
 */
export function getClaudeClient() {
  const useSDK = process.env.USE_SDK_CLIENT === 'true';
  
  if (useSDK) {
    console.log('[Migration] Using Official Anthropic SDK Client');
    return getClaudeSDKClient();
  } else {
    console.log('[Migration] Using Legacy Custom Client');
    return getOldClient();
  }
}

/**
 * Check which client implementation is currently active
 */
export function isUsingSDKClient(): boolean {
  return process.env.USE_SDK_CLIENT === 'true';
}

/**
 * Get migration status for monitoring
 */
export function getMigrationStatus() {
  return {
    usingSDK: isUsingSDKClient(),
    clientType: isUsingSDKClient() ? 'sdk' : 'legacy',
    envVar: process.env.USE_SDK_CLIENT || 'unset',
  };
}
