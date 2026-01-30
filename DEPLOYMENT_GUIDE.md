# Deployment Guide - Staging Environment (staging.ops.epic.dm)

**Target URL**: https://staging.ops.epic.dm/
**Platform**: Vercel
**Date**: January 29, 2026

---

## Prerequisites

✅ **Completed**:
- Application built successfully (`.output/` directory)
- `vercel.json` configuration file created
- Vercel CLI installed globally

⚠️ **Required Before Deployment**:
- Vercel account with access to deploy to `staging.ops.epic.dm`
- Environment variables configured in Vercel dashboard or provided during deployment
- Database accessible from Vercel's network
- Odoo instance accessible from Vercel's network

---

## Environment Variables Required

The following environment variables must be configured in Vercel:

### Database
```bash
DATABASE_URL="postgresql://user:password@host:port/database"
```

### Authentication
```bash
BETTER_AUTH_SECRET="<32+ character random string>"
BETTER_AUTH_URL="https://staging.ops.epic.dm"
```

### Odoo Integration
```bash
ODOO_URL="https://your-odoo-instance.com"
ODOO_DATABASE="your-database-name"
ODOO_USERNAME="api_user"
ODOO_PASSWORD="<secure-password>"
```

---

## Deployment Options

### Option 1: Vercel CLI (Recommended for Quick Deployment)

#### Step 1: Authenticate with Vercel
```bash
vercel login
```
Follow the prompts to log in to your Vercel account.

#### Step 2: Link Project (First Time Only)
```bash
vercel link
```
- Select your Vercel team/account
- Link to existing project or create new
- Confirm project settings

#### Step 3: Set Environment Variables
You can set environment variables via CLI:
```bash
vercel env add DATABASE_URL production
# Paste your database URL when prompted

vercel env add BETTER_AUTH_SECRET production
# Paste your secret when prompted

vercel env add BETTER_AUTH_URL production
# Enter: https://staging.ops.epic.dm

vercel env add ODOO_URL production
# Paste your Odoo URL when prompted

vercel env add ODOO_DATABASE production
# Enter your Odoo database name

vercel env add ODOO_USERNAME production
# Enter your Odoo username

vercel env add ODOO_PASSWORD production
# Paste your Odoo password when prompted
```

#### Step 4: Deploy to Production
```bash
vercel --prod
```

This will:
- Upload your built application from `.output/`
- Deploy to production (staging.ops.epic.dm)
- Provide you with the deployment URL

---

### Option 2: Vercel Dashboard (Recommended for First-Time Setup)

#### Step 1: Log in to Vercel Dashboard
Navigate to https://vercel.com/dashboard

#### Step 2: Import Project
1. Click "Add New..." → "Project"
2. Import from Git (connect your repository) OR
3. Upload the `.output/` folder directly

#### Step 3: Configure Project Settings
- **Framework Preset**: Other (or None)
- **Build Command**: `npm run build` (already done)
- **Output Directory**: `.output/public`
- **Install Command**: `npm install`

#### Step 4: Add Environment Variables
In Project Settings → Environment Variables, add:
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` = `https://staging.ops.epic.dm`
- `ODOO_URL`
- `ODOO_DATABASE`
- `ODOO_USERNAME`
- `ODOO_PASSWORD`

Mark all as "Production" environment.

#### Step 5: Configure Custom Domain
In Project Settings → Domains:
1. Add domain: `staging.ops.epic.dm`
2. Follow DNS configuration instructions
3. Wait for DNS propagation (can take up to 48 hours, usually <1 hour)

#### Step 6: Deploy
Click "Deploy" button or trigger deployment via Git push.

---

## Post-Deployment Verification

### 1. Check Deployment Status
```bash
vercel ls
```

### 2. Verify Application is Running
```bash
curl https://staging.ops.epic.dm/api/monitoring/system-health
```

Expected response:
```json
{
  "status": "pass",
  "timestamp": "2026-01-29T...",
  "database": { "status": "pass" },
  "odoo": { "status": "pass" }
}
```

### 3. Test Company View Endpoint
```bash
curl -X GET 'https://staging.ops.epic.dm/api/company-view' \
  -H 'x-tenant-id: <your-tenant-id>' \
  -H 'Cookie: better-auth.session_token=<your-session-token>'
```

### 4. Access Frontend
Navigate to: https://staging.ops.epic.dm/dashboard/company-view

**Expected flow**:
1. Redirected to sign-in if not authenticated
2. After sign-in, access company view dashboard
3. Data loads from Odoo (or shows appropriate error states)

---

## Verification Checklist

Use the comprehensive verification report: `docs/go-live/PHASE1_VERIFICATION_REPORT.md`

Quick checklist:
- [ ] Application accessible at https://staging.ops.epic.dm
- [ ] Health check endpoint returns 200 OK
- [ ] Database connection working
- [ ] Odoo connection working
- [ ] Authentication working (can sign in)
- [ ] Company View page loads
- [ ] Company View API returns data
- [ ] No JavaScript errors in browser console
- [ ] Environment variables properly configured

---

## Troubleshooting

### Issue: Build fails on Vercel
**Solution**: The build is already complete in `.output/`. Use `vercel.json` configuration which skips rebuild.

### Issue: Database connection errors
**Solutions**:
- Verify `DATABASE_URL` is correct and accessible from Vercel's network
- Check if database allows connections from Vercel's IP ranges
- Consider using connection pooling (PgBouncer) for production

### Issue: Odoo connection fails
**Solutions**:
- Verify Odoo URL is publicly accessible or whitelist Vercel IPs
- Check Odoo credentials are correct
- Verify Odoo database name matches

### Issue: "No Tenant Available" on Company View
**Solutions**:
- Ensure user has authenticated
- Check user has default tenant assigned in database
- Verify `tenantMember` table has entry with `isDefault = true`

### Issue: Custom domain not working
**Solutions**:
- Verify DNS records are configured correctly
- Wait for DNS propagation (up to 48 hours)
- Check domain ownership verification

---

## Rollback Procedure

If issues occur after deployment:

### Via Vercel CLI
```bash
vercel rollback <deployment-url>
```

### Via Vercel Dashboard
1. Go to Deployments tab
2. Find previous working deployment
3. Click "..." menu → "Promote to Production"

---

## Monitoring & Alerts

### Recommended Vercel Monitoring
- Enable Vercel Analytics
- Set up deployment notifications (Slack/Email)
- Configure error tracking (Sentry integration)

### Application Monitoring
- Monitor `/api/monitoring/system-health` endpoint
- Track database connection pool usage
- Monitor Odoo API response times
- Set up alerts for:
  - Response time > 6 seconds (total budget exceeded)
  - Error rate > 5%
  - Database connection failures
  - Odoo connection failures

---

## Cost Considerations

### Vercel Costs
- **Serverless Functions**: Billed per execution
- **Bandwidth**: Billed per GB
- **Build Minutes**: Limited on free tier

### Optimization Tips
- Use Vercel's Edge Network for static assets
- Enable caching headers (already configured: 30s TTL)
- Monitor function execution time
- Consider Vercel Pro for production workloads

---

## Next Steps After Deployment

1. **Populate Database**:
   - Run seed scripts if needed
   - Create test users and tenants
   - Verify user-tenant assignments

2. **Test Authentication**:
   - Sign in with test account
   - Verify session persistence
   - Test tenant resolution

3. **Load Test**:
   - Test with multiple concurrent users
   - Verify cache effectiveness
   - Monitor response times under load

4. **Security Review**:
   - Verify HTTPS is enforced
   - Check CORS configuration
   - Review authentication flow
   - Test unauthorized access scenarios

5. **Documentation**:
   - Update README with staging URL
   - Document any deployment-specific configurations
   - Share access credentials with team (securely)

---

## Support & Resources

- **Vercel Documentation**: https://vercel.com/docs
- **Application Documentation**: `docs/go-live/PHASE1_COMPANY_VIEW.md`
- **Verification Report**: `docs/go-live/PHASE1_VERIFICATION_REPORT.md`
- **Troubleshooting**: See Appendix C in `PHASE1_COMPANY_VIEW.md`

---

**Deployment Guide Version**: 1.0
**Last Updated**: January 29, 2026
**Author**: AI Assistant (Claude Code)
