import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const screenshotDir = './screenshots';
mkdirSync(screenshotDir, { recursive: true });

const routesToCheck = [
  { path: '/', name: 'homepage' },
  { path: '/sign-in', name: 'sign-in' },
  { path: '/dashboard', name: 'dashboard' },
  { path: '/dashboard/ai-coo', name: 'ai-coo-dashboard' },
  { path: '/dashboard/reports', name: 'reports' },
  { path: '/dashboard/approvals', name: 'approvals' },
  { path: '/dashboard/inbox', name: 'inbox' },
  { path: '/dashboard/sales', name: 'sales' },
  { path: '/dashboard/wallet', name: 'wallet' },
  { path: '/demo', name: 'demo' },
  { path: '/mobile', name: 'mobile' },
  { path: '/mobile/expenses', name: 'mobile-expenses' },
  { path: '/mobile/field-tech', name: 'mobile-field-tech' },
];

const report = {
  timestamp: new Date().toISOString(),
  routes: [],
  navigation: {},
  features: [],
  aiCapabilities: [],
};

async function crawl() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  for (const route of routesToCheck) {
    try {
      console.log(`Checking ${route.path}...`);
      await page.goto(`http://localhost:3000${route.path}`, {
        waitUntil: 'networkidle',
        timeout: 10000
      });

      await page.waitForTimeout(1000);

      // Take screenshot
      const screenshotPath = join(screenshotDir, `${route.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Get page title and visible text
      const title = await page.title();
      const bodyText = await page.locator('body').innerText();

      // Check for navigation elements
      const navLinks = await page.locator('nav a, [role="navigation"] a').allTextContents();

      // Check for AI/autonomous features
      const pageContent = await page.content();
      const hasAICOO = pageContent.includes('AI COO') || pageContent.includes('ai-coo');
      const hasOperator = pageContent.includes('Operator') || pageContent.includes('operator');
      const hasAutonomous = pageContent.includes('autonomous') || pageContent.includes('Autonomous');
      const hasApproval = pageContent.includes('approval') || pageContent.includes('Approval');

      // Get visible buttons/actions
      const buttons = await page.locator('button').allTextContents();
      const visibleButtons = buttons.filter(b => b.trim().length > 0);

      report.routes.push({
        path: route.path,
        name: route.name,
        title,
        screenshot: screenshotPath,
        accessible: true,
        navLinks: navLinks.slice(0, 10),
        buttons: visibleButtons.slice(0, 15),
        hasAICOO,
        hasOperator,
        hasAutonomous,
        hasApproval,
        textPreview: bodyText.substring(0, 500),
      });

    } catch (error) {
      console.log(`Error on ${route.path}: ${error.message}`);
      report.routes.push({
        path: route.path,
        name: route.name,
        accessible: false,
        error: error.message,
      });
    }
  }

  // Save report
  writeFileSync('./crawl-report.json', JSON.stringify(report, null, 2));
  console.log('Report saved to crawl-report.json');

  await browser.close();
}

crawl().catch(console.error);
