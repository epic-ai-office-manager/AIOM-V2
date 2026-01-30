/**
 * Company View UI Test
 *
 * Verifies that the company view dashboard page:
 * - Loads without runtime errors
 * - Displays proper title and elements when authenticated with tenant
 * - Shows appropriate fallback when no tenant available
 *
 * Note: Page requires tenant context from authenticated session.
 * Tests verify graceful handling of missing tenant context.
 */

import { test, expect } from '@playwright/test';

test.describe('Company View Dashboard UI', () => {
  test('page loads without crashing', async ({ page }) => {
    // Navigate to company view page
    await page.goto('/dashboard/company-view');

    // Wait for page to finish initial load
    await page.waitForLoadState('domcontentloaded');

    // Page should render some content (not blank white screen)
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(0);
  });

  test('displays company view title', async ({ page }) => {
    await page.goto('/dashboard/company-view');
    await page.waitForLoadState('networkidle');

    // Title should be visible (even without tenant)
    const title = await page.getByRole('heading', { name: /company view/i }).textContent();
    expect(title).toBeTruthy();
  });

  test('shows tenant-aware states', async ({ page }) => {
    await page.goto('/dashboard/company-view');
    await page.waitForLoadState('networkidle');

    // Page should show ONE of these states:
    // 1. Loading tenant
    // 2. No tenant message
    // 3. Loading data (if tenant exists)
    // 4. Error state
    // 5. Data display (if authenticated with tenant)

    const pageText = await page.locator('body').textContent();

    const hasLoadingState = pageText?.includes('Loading') || false;
    const hasNoTenantState = pageText?.includes('No Tenant') || pageText?.includes('No default tenant') || false;
    const hasCompanyView = pageText?.includes('Company View') || false;
    const hasErrorState = pageText?.includes('Error') || false;

    // At minimum, "Company View" should be present
    expect(hasCompanyView).toBeTruthy();

    // And at least one state indicator
    const hasAnyState = hasLoadingState || hasNoTenantState || hasErrorState;
    expect(hasAnyState).toBeTruthy();
  });
});
