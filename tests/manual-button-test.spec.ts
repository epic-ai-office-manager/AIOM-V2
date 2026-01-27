import { test, expect } from '@playwright/test';

test.describe('Manual Button Tests - One at a Time', () => {
  test('Test 1: Just open and close drawer', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/ai-coo');
    await page.waitForLoadState('networkidle');

    console.log('\n=== Test 1: Drawer Open/Close ===');

    // Click Active button
    await page.locator('button').filter({ hasText: 'Active' }).first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/manual-01-drawer-open.png' });
    console.log('✓ Drawer opened');

    // Click X to close
    const closeButton = page.locator('[role="dialog"] button').first();
    await closeButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/manual-01-drawer-closed.png' });
    console.log('✓ Drawer closed');
  });

  test('Test 2: Just click Review All', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/ai-coo');
    await page.waitForLoadState('networkidle');

    console.log('\n=== Test 2: Review All Modal ===');

    const reviewBtn = page.locator('button').filter({ hasText: 'Review All' });
    if (await reviewBtn.count() > 0) {
      await reviewBtn.first().click({ force: true });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/manual-02-approval-modal.png' });
      console.log('✓ Approval modal opened');
    } else {
      console.log('⚠ No Review All button (no pending actions)');
    }
  });

  test('Test 3: Click Approve & Execute button', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/ai-coo');
    await page.waitForLoadState('networkidle');

    console.log('\n=== Test 3: Individual Approve Button ===');

    const approveBtn = page.locator('button').filter({ hasText: 'Approve & Execute' });
    if (await approveBtn.count() > 0) {
      console.log(`Found ${await approveBtn.count()} Approve & Execute buttons`);

      // Click first one
      await approveBtn.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/manual-03-after-approve.png' });
      console.log('✓ Clicked Approve & Execute');
    } else {
      console.log('⚠ No Approve & Execute buttons found');
    }
  });

  test('Test 4: Show/Hide Details on card', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/ai-coo');
    await page.waitForLoadState('networkidle');

    console.log('\n=== Test 4: Collapsible Card ===');

    const showDetailsBtn = page.locator('button').filter({ hasText: 'Show Details' });
    if (await showDetailsBtn.count() > 0) {
      await showDetailsBtn.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/manual-04-card-expanded.png' });
      console.log('✓ Card expanded');

      const showLessBtn = page.locator('button').filter({ hasText: 'Show Less' });
      if (await showLessBtn.count() > 0) {
        await showLessBtn.first().click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/manual-04-card-collapsed.png' });
        console.log('✓ Card collapsed');
      }
    } else {
      console.log('⚠ No collapsible cards found');
    }
  });
});
