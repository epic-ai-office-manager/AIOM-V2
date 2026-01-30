/**
 * File-Backed Memory Store (MVP)
 *
 * Provides tenant-scoped long-term memory storage using local JSONL files.
 * Supports append, list, and search operations with automatic redaction
 * of sensitive data.
 *
 * Design Principles:
 * - Tenant isolation: Each tenant has a separate .jsonl file
 * - Redaction-first: Secrets are automatically redacted before persistence
 * - Concurrency safety: In-process mutex prevents write interleaving
 * - Simple & reliable: No external dependencies, uses Node.js built-ins
 */

import { appendFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { nanoid } from "nanoid";

// =============================================================================
// Types & Interfaces
// =============================================================================

/**
 * Parameters for appending a new memory entry
 */
export interface AppendMemoryEntryParams {
  /** Tenant ID for isolation */
  tenantId: string;
  /** Optional user ID who created the entry */
  userId?: string;
  /** Type/category of memory entry (e.g., "user_preference", "insight", "fact") */
  kind: string;
  /** The actual memory text content */
  text: string;
  /** Optional tags for categorization */
  tags?: string[];
  /** Optional source reference (e.g., "conversation:xyz", "api:abc") */
  source?: string;
}

/**
 * A stored memory entry (includes generated fields)
 */
export interface MemoryEntry {
  /** Unique identifier */
  id: string;
  /** Tenant ID */
  tenantId: string;
  /** Optional user ID */
  userId?: string;
  /** Entry type/category */
  kind: string;
  /** Memory content (redacted) */
  text: string;
  /** Tags for categorization */
  tags?: string[];
  /** Source reference */
  source?: string;
  /** ISO 8601 timestamp */
  createdAt: string;
  /** Schema version */
  version: number;
}

/**
 * Parameters for listing memory entries
 */
export interface ListMemoryEntriesParams {
  /** Tenant ID for isolation */
  tenantId: string;
  /** Maximum number of entries to return (default: 100) */
  limit?: number;
}

/**
 * Parameters for searching memory entries
 */
export interface SearchMemoryEntriesParams {
  /** Tenant ID for isolation */
  tenantId: string;
  /** Search query (case-insensitive keyword match) */
  query: string;
  /** Maximum number of results to return (default: 20) */
  limit?: number;
}

// =============================================================================
// Configuration
// =============================================================================

/** Base directory for all memory files (relative to project root) */
const MEMORY_BASE_DIR = ".aiom/memory";

/** Current schema version */
const SCHEMA_VERSION = 1;

// =============================================================================
// Redaction Logic
// =============================================================================

/**
 * Redact sensitive information from text before persistence
 *
 * Patterns redacted:
 * - api_key=... / apiKey=...
 * - Authorization: Bearer ...
 * - sk-... / rk-...-style tokens
 * - FIREBASE_PRIVATE_KEY blocks
 * - Generic secret=... patterns
 *
 * @param text - The text to redact
 * @returns Redacted text with secrets replaced by [REDACTED]
 */
export function redact(text: string): string {
  let redacted = text;

  // Pattern 1: api_key= or apiKey= or api-key=
  redacted = redacted.replace(
    /\b(api[_-]?key|apikey)\s*[=:]\s*[^\s\n"']+/gi,
    "$1=[REDACTED]"
  );

  // Pattern 2: Authorization: Bearer <token>
  redacted = redacted.replace(
    /\bAuthorization\s*:\s*Bearer\s+[^\s\n"']+/gi,
    "Authorization: Bearer [REDACTED]"
  );

  // Pattern 3: sk-... or rk-...-style tokens (common API key patterns)
  redacted = redacted.replace(
    /\b(sk|rk|pk)[-_][a-zA-Z0-9_-]{20,}/g,
    "[REDACTED]"
  );

  // Pattern 4: Generic secret= or password= patterns
  redacted = redacted.replace(
    /\b(secret|password|token|key)\s*[=:]\s*[^\s\n"']+/gi,
    "$1=[REDACTED]"
  );

  // Pattern 5: FIREBASE_PRIVATE_KEY-style blocks (multiline)
  redacted = redacted.replace(
    /-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g,
    "[REDACTED PRIVATE KEY]"
  );

  // Pattern 6: JWT-like tokens (three base64-looking parts separated by dots)
  redacted = redacted.replace(
    /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    "[REDACTED]"
  );

  return redacted;
}

// =============================================================================
// File System Utilities
// =============================================================================

/**
 * Sanitize tenant ID for safe filesystem usage
 * Allows only [a-zA-Z0-9_-], replaces others with underscore
 */
function sanitizeTenantId(tenantId: string): string {
  return tenantId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Get the file path for a tenant's memory file
 */
function getMemoryFilePath(tenantId: string): string {
  const sanitized = sanitizeTenantId(tenantId);
  return join(process.cwd(), MEMORY_BASE_DIR, `${sanitized}.jsonl`);
}

/**
 * Ensure the memory directory exists
 */
async function ensureMemoryDirectory(): Promise<void> {
  const dirPath = join(process.cwd(), MEMORY_BASE_DIR);
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

// =============================================================================
// Concurrency Safety (In-Process Mutex)
// =============================================================================

/**
 * Per-tenant write locks to prevent interleaved writes
 * Key: tenantId, Value: Promise that resolves when write completes
 */
const writeLocks = new Map<string, Promise<void>>();

/**
 * Acquire a write lock for a tenant (serializes writes)
 *
 * @param tenantId - The tenant ID
 * @param operation - The async operation to execute under lock
 * @returns The result of the operation
 */
async function withWriteLock<T>(
  tenantId: string,
  operation: () => Promise<T>
): Promise<T> {
  // Wait for any existing write to complete
  const existingLock = writeLocks.get(tenantId);
  if (existingLock) {
    await existingLock;
  }

  // Create a new lock
  let resolveLock: () => void;
  const newLock = new Promise<void>((resolve) => {
    resolveLock = resolve;
  });
  writeLocks.set(tenantId, newLock);

  try {
    // Execute the operation
    const result = await operation();
    return result;
  } finally {
    // Release the lock
    resolveLock!();
    writeLocks.delete(tenantId);
  }
}

// =============================================================================
// Core Memory Operations
// =============================================================================

/**
 * Append a new memory entry to the tenant's memory file
 *
 * @param params - Memory entry parameters
 * @returns The created memory entry
 */
export async function appendMemoryEntry(
  params: AppendMemoryEntryParams
): Promise<MemoryEntry> {
  const { tenantId, userId, kind, text, tags, source } = params;

  // Validate required fields
  if (!tenantId || !kind || !text) {
    throw new Error("tenantId, kind, and text are required");
  }

  // Ensure directory exists
  await ensureMemoryDirectory();

  // Create the memory entry
  const entry: MemoryEntry = {
    id: nanoid(),
    tenantId,
    userId,
    kind,
    text: redact(text), // ALWAYS redact before persisting
    tags,
    source,
    createdAt: new Date().toISOString(),
    version: SCHEMA_VERSION,
  };

  // Serialize to JSONL (one line per entry)
  const line = JSON.stringify(entry) + "\n";

  // Write atomically under lock
  await withWriteLock(tenantId, async () => {
    const filePath = getMemoryFilePath(tenantId);
    await appendFile(filePath, line, "utf8");
  });

  return entry;
}

/**
 * List memory entries for a tenant (newest first)
 *
 * @param params - List parameters
 * @returns Array of memory entries
 */
export async function listMemoryEntries(
  params: ListMemoryEntriesParams
): Promise<MemoryEntry[]> {
  const { tenantId, limit = 100 } = params;

  if (!tenantId) {
    throw new Error("tenantId is required");
  }

  const filePath = getMemoryFilePath(tenantId);

  // If file doesn't exist, return empty array
  if (!existsSync(filePath)) {
    return [];
  }

  // Read the entire file
  const content = await readFile(filePath, "utf8");

  // Parse JSONL (one JSON object per line)
  const lines = content
    .split("\n")
    .filter((line) => line.trim().length > 0);

  const entries: MemoryEntry[] = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as MemoryEntry;
      entries.push(entry);
    } catch (err) {
      // Skip malformed lines
      console.warn("[Memory] Skipping malformed JSONL line:", err);
    }
  }

  // Return newest first
  const sorted = entries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return sorted.slice(0, limit);
}

/**
 * Search memory entries for a tenant using keyword matching
 *
 * @param params - Search parameters
 * @returns Array of matching memory entries
 */
export async function searchMemoryEntries(
  params: SearchMemoryEntriesParams
): Promise<MemoryEntry[]> {
  const { tenantId, query, limit = 20 } = params;

  if (!tenantId || !query) {
    throw new Error("tenantId and query are required");
  }

  // Get all entries for this tenant
  const allEntries = await listMemoryEntries({ tenantId, limit: 1000 });

  // Normalize query for case-insensitive search
  const normalizedQuery = query.toLowerCase();

  // Filter entries that match the query
  const matches = allEntries.filter((entry) => {
    // Search in text
    if (entry.text.toLowerCase().includes(normalizedQuery)) {
      return true;
    }

    // Search in tags
    if (entry.tags) {
      for (const tag of entry.tags) {
        if (tag.toLowerCase().includes(normalizedQuery)) {
          return true;
        }
      }
    }

    // Search in kind
    if (entry.kind.toLowerCase().includes(normalizedQuery)) {
      return true;
    }

    return false;
  });

  return matches.slice(0, limit);
}
