# Deployment Script for AIOM-V2 to staging.ops.epic.dm
# PowerShell version for Windows

Write-Host "🚀 AIOM-V2 Deployment to staging.ops.epic.dm" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Check if vercel is installed
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelInstalled) {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Red
    npm install -g vercel
}

Write-Host "📝 Step 1: Logging in to Vercel..." -ForegroundColor Yellow
vercel login

Write-Host ""
Write-Host "🔗 Step 2: Linking project..." -ForegroundColor Yellow
vercel link

Write-Host ""
Write-Host "🔐 Step 3: Setting environment variables..." -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  You will need to provide:" -ForegroundColor Magenta
Write-Host "   - DATABASE_URL (your PostgreSQL connection string)" -ForegroundColor White
Write-Host "   - BETTER_AUTH_SECRET (32+ character random string)" -ForegroundColor White
Write-Host ""
Write-Host "   Generate BETTER_AUTH_SECRET with:" -ForegroundColor Gray
Write-Host "   node -e `"console.log(require('crypto').randomBytes(32).toString('base64'))`"" -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to continue"

# Set DATABASE_URL
Write-Host ""
Write-Host "Setting DATABASE_URL..." -ForegroundColor Green
Write-Host "Enter your PostgreSQL connection string:" -ForegroundColor Yellow
$dbUrl = Read-Host
$dbUrl | vercel env add DATABASE_URL production

# Set BETTER_AUTH_SECRET
Write-Host ""
Write-Host "Setting BETTER_AUTH_SECRET..." -ForegroundColor Green
Write-Host "Enter your secret (32+ characters):" -ForegroundColor Yellow
$authSecret = Read-Host -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($authSecret)
$authSecretPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
$authSecretPlain | vercel env add BETTER_AUTH_SECRET production

# Set BETTER_AUTH_URL
Write-Host ""
Write-Host "Setting BETTER_AUTH_URL..." -ForegroundColor Green
"https://staging.ops.epic.dm" | vercel env add BETTER_AUTH_URL production

# Set ODOO credentials
Write-Host ""
Write-Host "Setting ODOO_URL..." -ForegroundColor Green
"https://epic-communications-inc818.odoo.com" | vercel env add ODOO_URL production

Write-Host ""
Write-Host "Setting ODOO_DATABASE..." -ForegroundColor Green
"epic-communications-inc818" | vercel env add ODOO_DATABASE production

Write-Host ""
Write-Host "Setting ODOO_USERNAME..." -ForegroundColor Green
"eric.giraud@epic.dm" | vercel env add ODOO_USERNAME production

Write-Host ""
Write-Host "Setting ODOO_PASSWORD..." -ForegroundColor Green
"2e0f2f7b62ca0d876495114fec1bbbe1ae9810d9" | vercel env add ODOO_PASSWORD production

Write-Host ""
Write-Host "✅ Environment variables configured!" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Step 4: Deploying to production..." -ForegroundColor Yellow
vercel --prod

Write-Host ""
Write-Host "✨ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Visit https://staging.ops.epic.dm to verify deployment"
Write-Host "   2. Check health: https://staging.ops.epic.dm/api/monitoring/system-health"
Write-Host "   3. Review deployment logs in Vercel dashboard"
Write-Host "   4. Run verification checklist: docs/go-live/PHASE1_VERIFICATION_REPORT.md"
Write-Host ""
