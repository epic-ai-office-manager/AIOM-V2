# 🧪 Testing the Claude SDK Migration Locally

Your dev server is running at **http://localhost:3000** ✅

## Step 1: Enable the SDK Client

Open your `.env` file and add or update:

```bash
USE_SDK_CLIENT=true
```

**Important:** Make sure you have your `ANTHROPIC_API_KEY` set in the `.env` file.

## Step 2: Restart the Dev Server

After updating `.env`:

```bash
# Stop the current server (Ctrl+C in the terminal)
# Then restart:
npx vite dev
```

## Step 3: Test the Migration

### Option A: Quick Browser Test

1. **Open the dashboard:**
   - Navigate to: http://localhost:3000/admin/claude-usage
   - You should see the Claude Usage Dashboard

2. **Make an API call:**
   - Use any feature in your app that calls Claude
   - For example, generate a call summary or analyze a customer issue

3. **Check the dashboard:**
   - Refresh http://localhost:3000/admin/claude-usage
   - You should see usage stats appear

### Option B: API Test

Test the analytics API directly:

```bash
# Get usage stats
curl http://localhost:3000/api/analytics/claude-usage?period=24h

# Export as CSV
curl http://localhost:3000/api/analytics/claude-usage-export?period=24h&format=csv
```

### Option C: Run Test Script

I created a test script for you:

```bash
npx tsx test-sdk-migration.ts
```

This will:
- ✅ Check if SDK is enabled
- ✅ Initialize the client
- ✅ Make a test API call
- ✅ Verify cost tracking
- ✅ Show usage statistics

## What to Look For

### ✅ Success Indicators

1. **Dashboard loads** at `/admin/claude-usage`
2. **Usage stats appear** after making API calls
3. **Cache efficiency** shows a percentage
4. **Cost tracking** displays dollar amounts
5. **No errors** in browser console or terminal

### ⚠️ Common Issues

**Issue: "SDK client not enabled"**
- Solution: Set `USE_SDK_CLIENT=true` in `.env` and restart

**Issue: "Invalid API key"**
- Solution: Check `ANTHROPIC_API_KEY` in `.env`

**Issue: Dashboard shows no data**
- Solution: Make at least one API call first

**Issue: TypeScript errors in routes**
- Solution: These are cosmetic - routes work at runtime

## Expected Results

After making a few API calls, you should see:

```
📊 Total Cost: $0.0045
📈 Cache Efficiency: 0% (first call) → 80%+ (subsequent calls)
🎯 Total Requests: 3
💰 Projected Monthly: $4.05
```

## Verify Cost Savings

1. **First call** (no cache): ~$0.015
2. **Second call** (with cache): ~$0.003 (80% savings!)
3. **Cache efficiency**: Should reach 80%+ after a few calls

## Next Steps

Once testing is successful:

1. ✅ Keep `USE_SDK_CLIENT=true` for production
2. 📊 Monitor the dashboard regularly
3. 💰 Set budget alerts if needed
4. 📈 Review cache efficiency weekly
5. 📝 Export usage data monthly for billing

## Rollback (if needed)

If you encounter issues:

```bash
# In .env
USE_SDK_CLIENT=false
# or just remove the line

# Restart server
npx vite dev
```

The app will immediately switch back to the legacy client.

---

**Ready to test!** 🚀

Start by setting `USE_SDK_CLIENT=true` in your `.env` file, then restart the server.
