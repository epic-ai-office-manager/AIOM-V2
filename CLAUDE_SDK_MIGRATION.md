# Claude SDK Migration Guide

**Status**: ✅ Implementation Complete  
**Date**: January 17, 2026  
**Version**: 1.0.0

---

## Overview

This migration replaces the custom Claude HTTP client with the official Anthropic SDK, enabling:
- ✅ **Automatic cost tracking** per use case
- ✅ **Prompt caching** for 80%+ cost savings
- ✅ **Better error handling** with automatic retries
- ✅ **Type safety** with official TypeScript types
- ✅ **Real-time cost dashboard** for monitoring

---

## Migration Status

### ✅ Completed

1. **SDK Installation** - `@anthropic-ai/sdk` installed
2. **SDK Client** - `src/lib/claude/sdk-client.ts` with cost tracking
3. **Migration Wrapper** - Gradual rollout mechanism via `USE_SDK_CLIENT` flag
4. **System Prompts** - Cacheable prompt templates in `src/lib/claude/system-prompts/`
5. **Use Case Migration** - All 3 use cases migrated:
   - `call-summary.ts`
   - `customer-issue-monitor.ts`
   - `message-priority.ts`
6. **Cost Tracking API** - `/api/analytics/claude-usage` and export endpoints
7. **Dashboard UI** - `ClaudeUsageDashboard.tsx` component
8. **Documentation** - This guide

---

## Quick Start

### Enable SDK Client

```bash
# In your .env file
USE_SDK_CLIENT=true
```

### View Usage Dashboard

Navigate to: `/admin/claude-usage` (route needs to be added to your router)

### Export Usage Data

```bash
# CSV export
curl http://localhost:3000/api/analytics/claude-usage-export?period=30d&format=csv > usage.csv

# JSON export
curl http://localhost:3000/api/analytics/claude-usage-export?period=30d&format=json > usage.json
```

---

## Architecture

### Before (Custom Client)

```
User Request
    ↓
Custom HTTP fetch() to Anthropic API
    ↓
Manual retry logic
    ↓
No cost tracking ❌
    ↓
Response
```

### After (Official SDK)

```
User Request
    ↓
Migration Wrapper (USE_SDK_CLIENT flag)
    ↓
Official Anthropic SDK
    ↓
Automatic retries ✅
Cost tracking ✅
Prompt caching ✅
    ↓
Response + Usage Metrics
```

---

## Cost Optimization

### Prompt Caching Strategy

The system prompt is split into cacheable blocks:

```typescript
// BLOCK 1: Core identity (cache this - rarely changes)
{
  type: 'text',
  text: 'You are AIOM...',
  cache_control: { type: 'ephemeral' }
}

// BLOCK 2: Department schemas (cache this - rarely changes)
{
  type: 'text',
  text: 'DEPARTMENT KNOWLEDGE BASE...',
  cache_control: { type: 'ephemeral' }
}

// BLOCK 3: Tool definitions (cache this - rarely changes)
{
  type: 'text',
  text: 'AVAILABLE TOOLS...',
  cache_control: { type: 'ephemeral' }
}

// BLOCK 4: Current context (DON'T cache - changes per request)
{
  type: 'text',
  text: 'Date: 2026-01-17, User: John...'
  // NO cache_control
}
```

**Expected Results:**
- **Cache hit rate**: 80%+
- **Cost per request**: $0.003 (vs $0.015 without caching)
- **Monthly savings**: ~$36 at 100 requests/day

---

## API Reference

### GET /api/analytics/claude-usage

Get usage statistics for a time period.

**Query Parameters:**
- `period` - `24h`, `7d`, `30d`, or `all` (default: `7d`)

**Response:**
```json
{
  "period": "7d",
  "summary": {
    "totalCost": 1.23,
    "totalRequests": 150,
    "totalTokens": 45000,
    "averageCostPerRequest": 0.0082,
    "cacheEfficiency": "82.5%",
    "cacheEfficiencyRaw": 82.5
  },
  "byUseCase": [
    {
      "name": "call-summary",
      "cost": 0.45,
      "requests": 50,
      "tokens": 15000,
      "avgCostPerRequest": 0.009,
      "avgDurationMs": 1250
    }
  ],
  "projectedMonthlyCost": 5.28,
  "alerts": [
    {
      "type": "info",
      "message": "Excellent cache efficiency (82.5%)"
    }
  ]
}
```

### GET /api/analytics/claude-usage-export

Export usage data for billing.

**Query Parameters:**
- `period` - `24h`, `7d`, `30d`, or `all`
- `format` - `csv` or `json`

**Response:** File download

---

## Cost Tracking

### Automatic Tracking

Every API call is automatically tracked with:
- Input/output tokens
- Cache creation/read tokens
- Cost calculation
- Duration
- Use case label

### View Stats Programmatically

```typescript
import { getClaudeSDKClient } from '~/lib/claude/sdk-client';

const client = getClaudeSDKClient();
const stats = client.getUsageStats();

console.log(`Total cost: $${stats.totalCost.toFixed(2)}`);
console.log(`Cache efficiency: ${stats.cacheEfficiency.toFixed(1)}%`);
```

---

## Testing

### Unit Tests

```bash
# Run SDK client tests
npm test src/lib/claude/__tests__/sdk-client.test.ts
```

### Integration Tests

```bash
# Test use case migrations
npm test src/use-cases/__tests__/call-summary.integration.test.ts
```

### Manual Testing

```bash
# 1. Enable SDK client
echo "USE_SDK_CLIENT=true" >> .env

# 2. Make a test request (use your app)

# 3. Check usage
curl http://localhost:3000/api/analytics/claude-usage?period=24h
```

---

## Rollback Plan

If issues occur, rollback is instant:

```bash
# In .env
USE_SDK_CLIENT=false
```

Or remove the line entirely. The app will use the legacy custom client.

---

## Monitoring

### Key Metrics to Watch

1. **Cache Efficiency** - Target: >80%
   - If <50%: Review system prompts
   - If <30%: Investigate prompt structure

2. **Cost per Request** - Target: <$0.005
   - Monitor high-cost use cases
   - Consider using Haiku for simple queries

3. **Monthly Projected Cost** - Target: <$36
   - Set alerts at $50/month
   - Review usage patterns weekly

### Alerts

The dashboard automatically generates alerts for:
- ⚠️ Projected cost >$50/month
- 🚨 Projected cost >$100/month
- ⚠️ Cache efficiency <50%
- ⚠️ High-cost use cases (>$10 total)

---

## Best Practices

### 1. Use Case Labeling

Always label your API calls:

```typescript
const response = await client.createMessage({
  messages: [...],
  useCase: 'call-summary', // ✅ Good - enables tracking
});
```

### 2. Optimize System Prompts

- Keep static content in cached blocks
- Put dynamic content (dates, user info) in non-cached blocks
- Review cache hit rate weekly

### 3. Choose the Right Model

```typescript
// For complex analysis
model: 'claude-sonnet-4-20250514' // $3/$15 per 1M tokens

// For simple tasks
model: 'claude-haiku-4-20250514' // $0.25/$1.25 per 1M tokens (10x cheaper!)
```

### 4. Batch Similar Requests

Group similar requests to maximize cache hits:

```typescript
// ✅ Good - all use same cached system prompt
for (const call of calls) {
  await analyzeCall(call); // Same system prompt cached
}
```

---

## Troubleshooting

### "SDK client not enabled" Error

**Solution:** Set `USE_SDK_CLIENT=true` in `.env`

### High Costs

**Check:**
1. Cache efficiency - should be >80%
2. Use case distribution - identify expensive operations
3. Model selection - use Haiku for simple tasks

### Low Cache Efficiency

**Solutions:**
1. Review system prompt structure
2. Ensure static content has `cache_control`
3. Minimize dynamic content in cached blocks

### TypeScript Errors

**Common Issues:**
- Missing `extractTextFromResponse` method - SDK client now includes this
- Type mismatches - Use `Anthropic.Message` type from SDK

---

## Next Steps

### Immediate (Week 1)

- [x] Enable SDK client in production
- [ ] Monitor cache efficiency for 48 hours
- [ ] Set up cost alerts in Slack/email
- [ ] Train team on dashboard usage

### Short-term (Month 1)

- [ ] Optimize high-cost use cases
- [ ] Implement Haiku routing for simple queries
- [ ] Add more granular use case labels
- [ ] Create monthly cost reports

### Long-term (Quarter 1)

- [ ] Integrate with EMA-PRO app
- [ ] Add voice integration (text-to-speech)
- [ ] Implement multi-model routing
- [ ] Build cost forecasting model

---

## Support

### Resources

- **Official SDK Docs**: https://github.com/anthropics/anthropic-sdk-typescript
- **Prompt Caching Guide**: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- **Cost Calculator**: https://docs.anthropic.com/en/docs/pricing

### Team Contacts

- **Implementation**: Development Team
- **Cost Questions**: Finance Team
- **Technical Issues**: Create GitHub issue

---

## Changelog

### v1.0.0 (2026-01-17)

- ✅ Initial migration complete
- ✅ SDK client with cost tracking
- ✅ Migration wrapper for gradual rollout
- ✅ Prompt caching implementation
- ✅ Cost dashboard and export
- ✅ All use cases migrated
- ✅ Documentation complete

---

## Appendix

### File Structure

```
src/
├── lib/
│   └── claude/
│       ├── sdk-client.ts           # New SDK client
│       ├── migration-wrapper.ts    # Gradual rollout
│       ├── client.ts               # Legacy client (keep for rollback)
│       └── system-prompts/
│           └── aiom-master-prompt.ts
├── routes/
│   └── api/
│       └── analytics/
│           ├── claude-usage.ts
│           └── claude-usage-export.ts
├── components/
│   └── admin/
│       └── ClaudeUsageDashboard.tsx
└── use-cases/
    ├── call-summary.ts             # ✅ Migrated
    ├── customer-issue-monitor.ts   # ✅ Migrated
    └── message-priority.ts         # ✅ Migrated
```

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY="sk-ant-..."

# Migration control
USE_SDK_CLIENT="true"  # or "false"
```

---

**Migration Complete! 🎉**

You're now using the official Anthropic SDK with automatic cost tracking and prompt caching. Monitor your dashboard and enjoy the cost savings!
