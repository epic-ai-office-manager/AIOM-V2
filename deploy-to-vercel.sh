#!/bin/bash

# Deployment Script for AIOM-V2 to staging.ops.epic.dm
# This script sets up environment variables and deploys to Vercel

echo "🚀 AIOM-V2 Deployment to staging.ops.epic.dm"
echo "=============================================="
echo ""

# Check if vercel is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

echo "📝 Step 1: Logging in to Vercel..."
vercel login

echo ""
echo "🔗 Step 2: Linking project..."
vercel link

echo ""
echo "🔐 Step 3: Setting environment variables..."

# Note: User will need to provide DATABASE_URL and BETTER_AUTH_SECRET
echo ""
echo "⚠️  You will need to provide the following values:"
echo "   - DATABASE_URL (your PostgreSQL connection string)"
echo "   - BETTER_AUTH_SECRET (32+ character random string)"
echo ""
read -p "Press Enter to continue..."

# Set DATABASE_URL
echo ""
echo "Setting DATABASE_URL..."
vercel env add DATABASE_URL production

# Set BETTER_AUTH_SECRET
echo ""
echo "Setting BETTER_AUTH_SECRET (generate with: openssl rand -base64 32)..."
vercel env add BETTER_AUTH_SECRET production

# Set BETTER_AUTH_URL (hardcoded)
echo ""
echo "Setting BETTER_AUTH_URL..."
echo "https://staging.ops.epic.dm" | vercel env add BETTER_AUTH_URL production

# Set ODOO credentials (from user-provided values)
echo ""
echo "Setting ODOO_URL..."
echo "https://epic-communications-inc818.odoo.com" | vercel env add ODOO_URL production

echo ""
echo "Setting ODOO_DATABASE..."
echo "epic-communications-inc818" | vercel env add ODOO_DATABASE production

echo ""
echo "Setting ODOO_USERNAME..."
echo "eric.giraud@epic.dm" | vercel env add ODOO_USERNAME production

echo ""
echo "Setting ODOO_PASSWORD..."
echo "2e0f2f7b62ca0d876495114fec1bbbe1ae9810d9" | vercel env add ODOO_PASSWORD production

echo ""
echo "✅ Environment variables configured!"
echo ""
echo "🚀 Step 4: Deploying to production..."
vercel --prod

echo ""
echo "✨ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Visit https://staging.ops.epic.dm to verify deployment"
echo "   2. Check health: https://staging.ops.epic.dm/api/monitoring/system-health"
echo "   3. Review deployment logs in Vercel dashboard"
echo "   4. Run verification checklist: docs/go-live/PHASE1_VERIFICATION_REPORT.md"
echo ""
