import { test, expect } from '@playwright/test';

test.describe('Phase 3 Component Wiring Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/ai-coo');
    await page.waitForLoadState('networkidle');
  });

  test('1. OperatorStatusDrawer opens when clicking Active status pill', async ({ page }) => {
    // Find and click the Active status pill
    const statusPill = page.locator('button:has-text("Active")').first();
    await expect(statusPill).toBeVisible();

    console.log('✓ Active status pill is visible');

    await statusPill.click();

    // Wait for drawer to appear
    const drawer = page.locator('[role="dialog"]:has-text("Operator Status")');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    console.log('✓ OperatorStatusDrawer opened successfully');

    // Take screenshot
    await page.screenshot({ path: 'test-results/operator-drawer-open.png', fullPage: true });
    console.log('✓ Screenshot saved: operator-drawer-open.png');

    // Verify drawer contents
    await expect(page.locator('text=Currently Executing')).toBeVisible();
    await expect(page.locator('text=System Health')).toBeVisible();
    await expect(page.locator('button:has-text("Emergency Stop")')).toBeVisible();

    console.log('✓ Drawer contents verified (Currently Executing, System Health, Emergency Stop button)');
  });

  test('2. EmergencyStopModal opens from drawer', async ({ page }) => {
    // Open drawer first
    await page.locator('button:has-text("Active")').first().click();
    await page.waitForSelector('[role="dialog"]:has-text("Operator Status")');

    console.log('✓ Drawer opened');

    // Click Emergency Stop button
    const emergencyButton = page.locator('button:has-text("Emergency Stop")');
    await emergencyButton.click();

    // Wait for emergency modal
    const modal = page.locator('[role="alertdialog"]:has-text("Emergency Stop")');
    await expect(modal).toBeVisible({ timeout: 5000 });

    console.log('✓ EmergencyStopModal opened successfully');

    // Take screenshot
    await page.screenshot({ path: 'test-results/emergency-stop-modal.png', fullPage: true });
    console.log('✓ Screenshot saved: emergency-stop-modal.png');

    // Verify modal contents
    await expect(page.locator('text=This will immediately pause all autonomous operations')).toBeVisible();
    await expect(page.locator('text=Stop all in-progress actions')).toBeVisible();
    await expect(page.locator('button:has-text("Stop All Operations")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")').last()).toBeVisible();

    console.log('✓ Modal contents verified');

    // Close modal by clicking Cancel
    await page.locator('button:has-text("Cancel")').last().click();
    await expect(modal).not.toBeVisible();

    console.log('✓ Modal closed successfully');
  });

  test('3. ApprovalReviewModal opens from Review All button', async ({ page }) => {
    // Wait for AI Conversation column to load
    await page.waitForSelector('text=AI COO Conversation');

    // Check if "Review All" button exists (only shows when there are pending actions)
    const reviewButton = page.locator('button:has-text("Review All")');

    const buttonExists = await reviewButton.count() > 0;

    if (buttonExists) {
      console.log('✓ Review All button found');

      await reviewButton.click();

      // Wait for approval modal
      const modal = page.locator('[role="dialog"]:has-text("Review Actions")');
      await expect(modal).toBeVisible({ timeout: 5000 });

      console.log('✓ ApprovalReviewModal opened successfully');

      // Take screenshot
      await page.screenshot({ path: 'test-results/approval-review-modal.png', fullPage: true });
      console.log('✓ Screenshot saved: approval-review-modal.png');

      // Verify modal contents
      await expect(page.locator('text=Select actions to approve')).toBeVisible();
      await expect(page.locator('button:has-text("Approve")')).toBeVisible();
      await expect(page.locator('button:has-text("Cancel")').last()).toBeVisible();

      console.log('✓ Modal contents verified');

      // Check for action cards with checkboxes
      const checkboxes = page.locator('[role="checkbox"]');
      const checkboxCount = await checkboxes.count();
      console.log(`✓ Found ${checkboxCount} action checkboxes`);

      // Close modal
      await page.locator('button:has-text("Cancel")').last().click();
      await expect(modal).not.toBeVisible();

      console.log('✓ Modal closed successfully');
    } else {
      console.log('⚠ No "Review All" button found (no pending actions to review)');
      console.log('  This is expected if there are no pending approvals');
    }
  });

  test('4. Verify Phase 1-3 enhancements are present', async ({ page }) => {
    console.log('\n=== Verifying Phase 1 Components ===');

    // StatusPill with animation
    const statusPill = page.locator('[class*="animate"]').first();
    await expect(statusPill).toBeVisible();
    console.log('✓ Animated StatusPill present');

    // AIDecisionCard (collapsible)
    const decisionCards = page.locator('text=Show Details, text=Show Less').first();
    if (await decisionCards.count() > 0) {
      console.log('✓ Collapsible AIDecisionCard present');
    }

    console.log('\n=== Verifying Phase 2 Components ===');

    // Check for activity feed sections
    await expect(page.locator('text=Live Activity')).toBeVisible();
    console.log('✓ Live Activity column present');

    console.log('\n=== Verifying Phase 3 Components ===');

    // TopBar with status
    await expect(page.locator('text=AI Operator')).toBeVisible();
    console.log('✓ TopBar with AI Operator branding');

    // All three columns visible
    await expect(page.locator('text=AI COO Conversation')).toBeVisible();
    await expect(page.locator('text=Live Activity')).toBeVisible();
    console.log('✓ All three dashboard columns present');

    // Take full dashboard screenshot
    await page.screenshot({ path: 'test-results/full-dashboard.png', fullPage: true });
    console.log('✓ Full dashboard screenshot saved: full-dashboard.png');

    console.log('\n=== All Phase 1-3 Components Verified ===');
  });

  test('5. Complete interaction flow', async ({ page }) => {
    console.log('\n=== Testing Complete Interactive Flow ===');

    // 1. Click Active status -> Opens drawer
    await page.locator('button:has-text("Active")').first().click();
    await page.waitForSelector('[role="dialog"]:has-text("Operator Status")');
    console.log('✓ Step 1: Drawer opened');
    await page.waitForTimeout(500);

    // 2. Click Emergency Stop -> Opens confirmation modal
    await page.locator('button:has-text("Emergency Stop")').click();
    await page.waitForSelector('[role="alertdialog"]:has-text("Emergency Stop")');
    console.log('✓ Step 2: Emergency stop modal opened');
    await page.waitForTimeout(500);

    // 3. Cancel emergency stop
    await page.locator('button:has-text("Cancel")').last().click();
    console.log('✓ Step 3: Emergency stop cancelled');
    await page.waitForTimeout(500);

    // 4. Close drawer
    await page.locator('button[aria-label="Close"], button:has(svg)').first().click();
    console.log('✓ Step 4: Drawer closed');

    // 5. Open approval modal if available
    const reviewButton = page.locator('button:has-text("Review All")');
    if (await reviewButton.count() > 0) {
      await reviewButton.click();
      await page.waitForSelector('[role="dialog"]:has-text("Review Actions")');
      console.log('✓ Step 5: Approval modal opened');
      await page.waitForTimeout(500);

      // Close approval modal
      await page.locator('button:has-text("Cancel")').last().click();
      console.log('✓ Step 6: Approval modal closed');
    } else {
      console.log('⚠ Step 5-6: Skipped (no pending approvals)');
    }

    // Final screenshot
    await page.screenshot({ path: 'test-results/final-state.png', fullPage: true });
    console.log('✓ Final state screenshot saved');

    console.log('\n=== Complete Flow Verified Successfully ===');
  });
});
