# File-Backed Memory Store (MVP)

Local file-backed long-term memory storage with tenant scoping and automatic secret redaction.

## Features

- **Tenant-scoped storage**: Each tenant has a separate `.jsonl` file
- **Automatic redaction**: Secrets are stripped before persistence
- **Concurrency-safe**: In-process mutex prevents write interleaving
- **Simple search**: Keyword matching across text, tags, and kind
- **No external dependencies**: Uses Node.js built-ins only

## Usage

### Append Memory Entry

```typescript
import { appendMemoryEntry } from "~/lib/memory/fileMemoryStore";

const entry = await appendMemoryEntry({
  tenantId: "acme-corp",
  userId: "user-123",
  kind: "user_preference",
  text: "User prefers dark mode and weekly email summaries",
  tags: ["ui", "preference", "notifications"],
  source: "conversation:abc123",
});
```

### List Memory Entries

```typescript
import { listMemoryEntries } from "~/lib/memory/fileMemoryStore";

// Get most recent 100 entries (newest first)
const entries = await listMemoryEntries({
  tenantId: "acme-corp",
  limit: 100,
});
```

### Search Memory Entries

```typescript
import { searchMemoryEntries } from "~/lib/memory/fileMemoryStore";

// Search by keyword (case-insensitive)
const results = await searchMemoryEntries({
  tenantId: "acme-corp",
  query: "dark mode",
  limit: 20,
});
```

## File Layout

```
.aiom/memory/
├── acme-corp.jsonl       # Tenant: acme-corp
├── demo-tenant.jsonl     # Tenant: demo-tenant
└── test-tenant-001.jsonl # Tenant: test-tenant-001
```

**Note**: The `.aiom/` directory is gitignored and will be created automatically on first write.

## JSONL Entry Format

Each line in a tenant's `.jsonl` file is a complete JSON object:

```json
{"id":"abc123def456","tenantId":"acme-corp","userId":"user-001","kind":"user_preference","text":"User prefers dark mode","tags":["ui","preference"],"source":"conversation:xyz789","createdAt":"2026-01-28T12:00:00.000Z","version":1}
```

Fields:
- `id`: Unique entry ID (nanoid)
- `tenantId`: Tenant identifier
- `userId`: Optional user who created the entry
- `kind`: Entry type/category (e.g., "user_preference", "insight", "fact")
- `text`: Memory content (redacted)
- `tags`: Optional array of tags
- `source`: Optional source reference
- `createdAt`: ISO 8601 timestamp
- `version`: Schema version (currently 1)

## Redaction

The following patterns are automatically redacted before persistence:

- `api_key=...` / `apiKey=...`
- `Authorization: Bearer ...`
- `sk-...` / `rk-...` style tokens
- Private key blocks (`-----BEGIN PRIVATE KEY-----`)
- JWT tokens (three base64 parts)
- Generic `secret=...` / `password=...` patterns

Example:
```typescript
// Input text
"My API key is api_key=sk_live_abc123 for production"

// Stored as (redacted)
"My API key is api_key=[REDACTED] for production"
```

## Concurrency Safety

- **In-process**: Per-tenant mutex serializes writes within a single Node.js process
- **Multi-instance**: Not supported in MVP (file locking would be needed)

For production multi-instance deployments, consider upgrading to a database-backed store.

## Testing

Run unit tests:

```bash
npx tsx src/lib/memory/fileMemoryStore.test.ts
```

All 15 tests should pass:
- ✓ Redaction patterns (5 tests)
- ✓ Append operations (2 tests)
- ✓ List operations (3 tests)
- ✓ Tenant isolation (1 test)
- ✓ Search operations (4 tests)

## Future Enhancements

Potential upgrades for this MVP:

1. **Database backend**: Migrate to PostgreSQL for multi-instance support
2. **Object storage**: Use S3/R2 for horizontal scaling
3. **Vector embeddings**: Semantic search with embedding similarity
4. **TTL/expiration**: Automatic cleanup of old entries
5. **Compression**: Gzip compression for large memory files
6. **Encryption at rest**: Encrypt tenant files on disk

## Integration Points

This memory store can be integrated with:

- AI conversation systems (Claude, GPT)
- Workflow automation (remember user preferences)
- Analytics pipelines (store insights)
- Audit logging (long-term event storage)

Example integration:

```typescript
// In AI conversation handler
import { appendMemoryEntry } from "~/lib/memory/fileMemoryStore";

async function handleUserMessage(tenantId: string, userId: string, message: string) {
  // ... process message with AI ...

  // Store important facts/preferences
  if (messageContainsPreference(message)) {
    await appendMemoryEntry({
      tenantId,
      userId,
      kind: "user_preference",
      text: extractedPreference,
      tags: ["ai", "conversation"],
      source: `conversation:${conversationId}`,
    });
  }
}
```
