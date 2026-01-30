# Quick Deployment Guide - Deploy to staging.ops.epic.dm NOW

## ⚠️ BEFORE YOU CONTINUE

**You need to authenticate with Vercel first!**

Visit this URL in your browser and click "Confirm":
👉 **https://vercel.com/oauth/device?user_code=LDGC-NTRZ**

Once you see "Success!" in your browser, the terminal will automatically continue.

---

## 📋 What You Need

I've prepared everything except your **DATABASE_URL**. You need:

✅ **Odoo Credentials** - Already configured!
- URL: https://epic-communications-inc818.odoo.com
- Database: epic-communications-inc818
- Username: eric.giraud@epic.dm
- Password: (configured)

✅ **BETTER_AUTH_SECRET** - Already generated!
- Secret: `w7AvLxUljFpFS9k4Z9jDX2H1NfjkNkiRRf7+g/3kyFc=`

❌ **DATABASE_URL** - You need to provide this!
- Format: `postgresql://user:password@host:port/database`
- Example: `postgresql://aiom_user:mypassword@db.example.com:5432/aiom_production`

---

## 🚀 Deployment Steps

### Option 1: Deploy via Vercel CLI (Faster)

Once authenticated, run these commands:

```bash
# 1. Link the project (first time only)
vercel link

# 2. Add DATABASE_URL environment variable
vercel env add DATABASE_URL production
# When prompted, paste your PostgreSQL connection string

# 3. Add BETTER_AUTH_SECRET
echo "w7AvLxUljFpFS9k4Z9jDX2H1NfjkNkiRRf7+g/3kyFc=" | vercel env add BETTER_AUTH_SECRET production

# 4. Add BETTER_AUTH_URL
echo "https://staging.ops.epic.dm" | vercel env add BETTER_AUTH_URL production

# 5. Add Odoo credentials
echo "https://epic-communications-inc818.odoo.com" | vercel env add ODOO_URL production
echo "epic-communications-inc818" | vercel env add ODOO_DATABASE production
echo "eric.giraud@epic.dm" | vercel env add ODOO_USERNAME production
echo "<your-odoo-password>" | vercel env add ODOO_PASSWORD production

# 6. Deploy to production!
vercel --prod
```

### Option 2: Deploy via Vercel Dashboard (More Visual)

1. **Go to**: https://vercel.com/dashboard
2. **Click**: "Add New..." → "Project"
3. **Import**: Connect your Git repository OR drag-drop the `.output` folder
4. **Configure**:
   - Framework: Other/None
   - Build Command: `npm run build` (already done)
   - Output Directory: `.output/public`
   - Install Command: `npm install`

5. **Environment Variables** (in Project Settings):
   ```
   DATABASE_URL = <your-postgresql-connection-string>
   BETTER_AUTH_SECRET = w7AvLxUljFpFS9k4Z9jDX2H1NfjkNkiRRf7+g/3kyFc=
   BETTER_AUTH_URL = https://staging.ops.epic.dm
   ODOO_URL = https://epic-communications-inc818.odoo.com
   ODOO_DATABASE = epic-communications-inc818
   ODOO_USERNAME = eric.giraud@epic.dm
   ODOO_PASSWORD = <your-odoo-password>
   ```

6. **Custom Domain** (in Project Settings → Domains):
   - Add domain: `staging.ops.epic.dm`
   - Follow DNS setup instructions

7. **Click "Deploy"**

---

## ✅ After Deployment - Verification

### 1. Check Health Endpoint
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

### 2. Visit the Application
Navigate to: **https://staging.ops.epic.dm**

### 3. Test Company View
1. Sign in (you'll be redirected if not authenticated)
2. Go to: https://staging.ops.epic.dm/dashboard/company-view
3. Should see data loading from Odoo

### 4. Run Full Verification
See comprehensive checklist: `docs/go-live/PHASE1_VERIFICATION_REPORT.md`

---

## ❓ Common Issues

### "Cannot connect to database"
- Check that `DATABASE_URL` is correct
- Verify database allows connections from Vercel's IP ranges
- Check if database is running and accessible

### "Odoo connection failed"
- Odoo URL should be publicly accessible
- Credentials are correct (already configured)
- Try accessing https://epic-communications-inc818.odoo.com manually

### "No Tenant Available"
- Sign in first
- Check database has users and tenants
- Verify `tenantMember` table has entries with `isDefault = true`

### Custom domain not working
- DNS propagation can take up to 48 hours (usually <1 hour)
- Verify DNS records are configured correctly
- Check Vercel dashboard for domain status

---

## 📞 Need Help?

- **Deployment Guide**: `DEPLOYMENT_GUIDE.md` (comprehensive)
- **Verification Checklist**: `docs/go-live/PHASE1_VERIFICATION_REPORT.md`
- **Troubleshooting**: `docs/go-live/PHASE1_COMPANY_VIEW.md` (Appendix C)

---

**Ready to deploy? Make sure you've authenticated with Vercel first!**

Visit: https://vercel.com/oauth/device?user_code=LDGC-NTRZ
