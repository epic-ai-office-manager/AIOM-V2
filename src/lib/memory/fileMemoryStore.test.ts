/**
 * Unit Tests for File Memory Store
 *
 * Run with: npx tsx src/lib/memory/fileMemoryStore.test.ts
 */

import assert from "assert";
import { rmSync, existsSync } from "fs";
import { join } from "path";
import {
  appendMemoryEntry,
  listMemoryEntries,
  searchMemoryEntries,
  redact,
  type MemoryEntry,
} from "./fileMemoryStore";

// =============================================================================
// Test Configuration
// =============================================================================

const TEST_MEMORY_DIR = join(process.cwd(), ".aiom/memory");
const TEST_TENANT_1 = "test-tenant-001";
const TEST_TENANT_2 = "test-tenant-002";

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Clean up test memory files before/after tests
 */
function cleanupTestMemory() {
  if (existsSync(TEST_MEMORY_DIR)) {
    try {
      rmSync(TEST_MEMORY_DIR, { recursive: true, force: true });
    } catch (err) {
      console.warn("Failed to clean up test memory:", err);
    }
  }
}

/**
 * Assert that two values are equal (with better error messages)
 */
function assertEqual<T>(actual: T, expected: T, message?: string) {
  try {
    assert.strictEqual(actual, expected);
  } catch (err) {
    console.error(`Assertion failed: ${message || ""}`);
    console.error(`  Expected: ${expected}`);
    console.error(`  Actual:   ${actual}`);
    throw err;
  }
}

/**
 * Assert that a condition is true
 */
function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message || "condition is false"}`);
  }
}

// =============================================================================
// Test Suite
// =============================================================================

async function runTests() {
  console.log("=".repeat(70));
  console.log("File Memory Store - Unit Tests");
  console.log("=".repeat(70));

  let passedTests = 0;
  let failedTests = 0;

  /**
   * Helper to run a test with error handling
   */
  async function test(name: string, fn: () => Promise<void>) {
    try {
      console.log(`\n[TEST] ${name}`);
      await fn();
      console.log(`  ✓ PASSED`);
      passedTests++;
    } catch (err) {
      console.error(`  ✗ FAILED`);
      console.error(err);
      failedTests++;
    }
  }

  // Clean up before tests
  cleanupTestMemory();

  // ===========================================================================
  // Test: Redaction Function
  // ===========================================================================

  await test("Redaction: api_key patterns", async () => {
    const text1 = "api_key=sk_live_abc123def456";
    const redacted1 = redact(text1);
    assertTrue(redacted1.includes("[REDACTED]"), "Should redact api_key");
    assertTrue(!redacted1.includes("sk_live_abc123def456"), "Should not contain original key");

    const text2 = "apiKey=abcdef123456";
    const redacted2 = redact(text2);
    assertTrue(redacted2.includes("[REDACTED]"), "Should redact apiKey");
  });

  await test("Redaction: Authorization Bearer tokens", async () => {
    const text = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const redacted = redact(text);
    assertTrue(redacted.includes("Authorization: Bearer [REDACTED]"), "Should redact bearer token");
    assertTrue(!redacted.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"), "Should not contain JWT");
  });

  await test("Redaction: sk-/rk- style tokens", async () => {
    const text = "Use token sk-proj-abc123def456ghi789 for API access";
    const redacted = redact(text);
    assertTrue(redacted.includes("[REDACTED]"), "Should redact sk- token");
    assertTrue(!redacted.includes("sk-proj-abc123def456ghi789"), "Should not contain original token");
  });

  await test("Redaction: Private key blocks", async () => {
    const text = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj
-----END PRIVATE KEY-----`;
    const redacted = redact(text);
    assertTrue(redacted.includes("[REDACTED PRIVATE KEY]"), "Should redact private key");
    assertTrue(!redacted.includes("MIIEvQIBADANBgkqhkiG"), "Should not contain key data");
  });

  await test("Redaction: JWT tokens", async () => {
    const text = "Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const redacted = redact(text);
    assertTrue(redacted.includes("[REDACTED]"), "Should redact JWT");
    assertTrue(!redacted.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"), "Should not contain JWT");
  });

  // ===========================================================================
  // Test: Append Memory Entry
  // ===========================================================================

  await test("Append: Creates valid JSON entry", async () => {
    const entry = await appendMemoryEntry({
      tenantId: TEST_TENANT_1,
      userId: "user-001",
      kind: "user_preference",
      text: "User prefers dark mode",
      tags: ["ui", "preference"],
      source: "conversation:abc123",
    });

    // Verify structure
    assertTrue(entry.id.length > 0, "Should have ID");
    assertEqual(entry.tenantId, TEST_TENANT_1, "Should have correct tenant ID");
    assertEqual(entry.userId, "user-001", "Should have correct user ID");
    assertEqual(entry.kind, "user_preference", "Should have correct kind");
    assertEqual(entry.text, "User prefers dark mode", "Should have correct text");
    assertTrue(Array.isArray(entry.tags), "Tags should be array");
    assertEqual(entry.tags?.[0], "ui", "Should have correct tags");
    assertEqual(entry.version, 1, "Should have version 1");
    assertTrue(entry.createdAt.length > 0, "Should have createdAt timestamp");
  });

  await test("Append: Redacts secrets before persisting", async () => {
    const entry = await appendMemoryEntry({
      tenantId: TEST_TENANT_1,
      kind: "note",
      text: "My API key is api_key=sk_live_secret123 for production",
    });

    assertTrue(entry.text.includes("[REDACTED]"), "Should redact secret");
    assertTrue(!entry.text.includes("sk_live_secret123"), "Should not contain original secret");
  });

  // ===========================================================================
  // Test: List Memory Entries
  // ===========================================================================

  await test("List: Returns entries newest first", async () => {
    // Create multiple entries
    const entry1 = await appendMemoryEntry({
      tenantId: TEST_TENANT_1,
      kind: "fact",
      text: "First entry",
    });

    // Small delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 10));

    const entry2 = await appendMemoryEntry({
      tenantId: TEST_TENANT_1,
      kind: "fact",
      text: "Second entry",
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const entry3 = await appendMemoryEntry({
      tenantId: TEST_TENANT_1,
      kind: "fact",
      text: "Third entry",
    });

    // List entries
    const entries = await listMemoryEntries({ tenantId: TEST_TENANT_1 });

    assertTrue(entries.length >= 3, `Should have at least 3 entries, got ${entries.length}`);

    // Find our entries (there might be others from previous tests)
    const ourEntries = entries.filter(e =>
      e.text === "First entry" ||
      e.text === "Second entry" ||
      e.text === "Third entry"
    );

    assertTrue(ourEntries.length === 3, "Should find all three test entries");

    // Verify newest first ordering
    const third = ourEntries.find(e => e.text === "Third entry");
    const second = ourEntries.find(e => e.text === "Second entry");
    const first = ourEntries.find(e => e.text === "First entry");

    const thirdIdx = entries.indexOf(third!);
    const secondIdx = entries.indexOf(second!);
    const firstIdx = entries.indexOf(first!);

    assertTrue(thirdIdx < secondIdx, "Third entry should come before second");
    assertTrue(secondIdx < firstIdx, "Second entry should come before first");
  });

  await test("List: Respects limit parameter", async () => {
    const entries = await listMemoryEntries({ tenantId: TEST_TENANT_1, limit: 2 });
    assertTrue(entries.length <= 2, `Should return at most 2 entries, got ${entries.length}`);
  });

  await test("List: Returns empty array for non-existent tenant", async () => {
    const entries = await listMemoryEntries({ tenantId: "nonexistent-tenant" });
    assertEqual(entries.length, 0, "Should return empty array");
  });

  // ===========================================================================
  // Test: Tenant Isolation
  // ===========================================================================

  await test("Tenant Isolation: Separate tenants have separate files", async () => {
    // Add entry for tenant 1
    await appendMemoryEntry({
      tenantId: TEST_TENANT_1,
      kind: "fact",
      text: "Tenant 1 data",
    });

    // Add entry for tenant 2
    await appendMemoryEntry({
      tenantId: TEST_TENANT_2,
      kind: "fact",
      text: "Tenant 2 data",
    });

    // List entries for each tenant
    const tenant1Entries = await listMemoryEntries({ tenantId: TEST_TENANT_1 });
    const tenant2Entries = await listMemoryEntries({ tenantId: TEST_TENANT_2 });

    // Verify tenant 1 doesn't see tenant 2's data
    const tenant1HasTenant2Data = tenant1Entries.some((e) =>
      e.text.includes("Tenant 2 data")
    );
    assertTrue(!tenant1HasTenant2Data, "Tenant 1 should not see Tenant 2 data");

    // Verify tenant 2 doesn't see tenant 1's data
    const tenant2HasTenant1Data = tenant2Entries.some((e) =>
      e.text.includes("Tenant 1 data")
    );
    assertTrue(!tenant2HasTenant1Data, "Tenant 2 should not see Tenant 1 data");
  });

  // ===========================================================================
  // Test: Search Memory Entries
  // ===========================================================================

  await test("Search: Finds entries by text content", async () => {
    await appendMemoryEntry({
      tenantId: TEST_TENANT_1,
      kind: "fact",
      text: "The user loves pizza",
    });

    const results = await searchMemoryEntries({
      tenantId: TEST_TENANT_1,
      query: "pizza",
    });

    assertTrue(results.length > 0, "Should find matching entry");
    assertTrue(
      results.some((e) => e.text.includes("pizza")),
      "Result should contain 'pizza'"
    );
  });

  await test("Search: Finds entries by tags", async () => {
    await appendMemoryEntry({
      tenantId: TEST_TENANT_1,
      kind: "fact",
      text: "User activity logged",
      tags: ["analytics", "tracking"],
    });

    const results = await searchMemoryEntries({
      tenantId: TEST_TENANT_1,
      query: "analytics",
    });

    assertTrue(results.length > 0, "Should find entry by tag");
    assertTrue(
      results.some((e) => e.tags?.includes("analytics")),
      "Result should have 'analytics' tag"
    );
  });

  await test("Search: Case-insensitive matching", async () => {
    await appendMemoryEntry({
      tenantId: TEST_TENANT_1,
      kind: "fact",
      text: "User prefers UPPERCASE settings",
    });

    const results = await searchMemoryEntries({
      tenantId: TEST_TENANT_1,
      query: "uppercase",
    });

    assertTrue(results.length > 0, "Should find entry with case-insensitive search");
  });

  await test("Search: Respects limit parameter", async () => {
    const results = await searchMemoryEntries({
      tenantId: TEST_TENANT_1,
      query: "entry",
      limit: 1,
    });

    assertTrue(results.length <= 1, `Should return at most 1 result, got ${results.length}`);
  });

  // Clean up after tests
  cleanupTestMemory();

  // ===========================================================================
  // Test Summary
  // ===========================================================================

  console.log("\n" + "=".repeat(70));
  console.log("Test Summary");
  console.log("=".repeat(70));
  console.log(`Total Tests: ${passedTests + failedTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log("=".repeat(70));

  if (failedTests > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
