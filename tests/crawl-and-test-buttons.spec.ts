import { test, expect } from '@playwright/test';

test.describe('AI COO Dashboard - Button Interaction Crawl', () => {
  test('Crawl and test all interactive buttons', async ({ page }) => {
    console.log('\n=== Starting Dashboard Crawl ===\n');

    // Navigate to dashboard
    await page.goto('http://localhost:3000/dashboard/ai-coo');
    await page.waitForLoadState('networkidle');

    console.log('✓ Page loaded successfully\n');

    // Take initial screenshot
    await page.screenshot({ path: 'test-results/crawl-01-initial.png', fullPage: true });

    // Test 1: Click Active Status Pill
    console.log('TEST 1: Clicking Active Status Pill...');
    try {
      const statusButton = page.locator('button').filter({ hasText: 'Active' });
      const buttonCount = await statusButton.count();
      console.log(`  Found ${buttonCount} button(s) with "Active" text`);

      if (buttonCount > 0) {
        await statusButton.first().click();
        await page.waitForTimeout(1000);

        // Check if drawer appeared
        const drawer = page.locator('[role="dialog"]').filter({ hasText: 'Operator Status' });
        const drawerVisible = await drawer.isVisible().catch(() => false);

        if (drawerVisible) {
          console.log('  ✓ SUCCESS: Drawer opened!');
          await page.screenshot({ path: 'test-results/crawl-02-drawer-opened.png', fullPage: true });

          // Test Emergency Stop button inside drawer
          console.log('\nTEST 2: Clicking Emergency Stop button...');
          const emergencyBtn = page.locator('button').filter({ hasText: 'Emergency Stop' });
          const emergencyCount = await emergencyBtn.count();
          console.log(`  Found ${emergencyCount} Emergency Stop button(s)`);

          if (emergencyCount > 0) {
            await emergencyBtn.first().click();
            await page.waitForTimeout(1000);

            // Check if modal appeared
            const modal = page.locator('[role="alertdialog"]').filter({ hasText: 'Emergency Stop' });
            const modalVisible = await modal.isVisible().catch(() => false);

            if (modalVisible) {
              console.log('  ✓ SUCCESS: Emergency modal opened!');
              await page.screenshot({ path: 'test-results/crawl-03-emergency-modal.png', fullPage: true });

              // Close modal
              const cancelBtn = page.locator('[role="alertdialog"] button').filter({ hasText: 'Cancel' });
              if (await cancelBtn.isVisible()) {
                await cancelBtn.click();
                await page.waitForTimeout(500);
                console.log('  ✓ Modal closed');
              }
            } else {
              console.log('  ✗ FAILED: Emergency modal did not appear');
              await page.screenshot({ path: 'test-results/crawl-03-emergency-failed.png', fullPage: true });
            }
          }

          // Close drawer
          const closeBtn = page.locator('[role="dialog"] button[aria-label], [role="dialog"] button:has-text("×")').first();
          if (await closeBtn.isVisible().catch(() => false)) {
            await closeBtn.click();
            await page.waitForTimeout(500);
            console.log('  ✓ Drawer closed\n');
          }
        } else {
          console.log('  ✗ FAILED: Drawer did not appear');
          await page.screenshot({ path: 'test-results/crawl-02-drawer-failed.png', fullPage: true });

          // Debug: Show what's on the page
          const buttons = await page.locator('button').all();
          console.log(`\n  Debug: Found ${buttons.length} total buttons on page`);
          for (let i = 0; i < Math.min(buttons.length, 10); i++) {
            const text = await buttons[i].textContent();
            console.log(`    Button ${i + 1}: "${text?.trim()}"`);
          }
        }
      }
    } catch (error) {
      console.log(`  ✗ ERROR: ${error}`);
      await page.screenshot({ path: 'test-results/crawl-error-status-pill.png', fullPage: true });
    }

    // Test 3: Review All Button
    console.log('\nTEST 3: Looking for Review All button...');
    try {
      const reviewBtn = page.locator('button').filter({ hasText: 'Review All' });
      const reviewCount = await reviewBtn.count();
      console.log(`  Found ${reviewCount} "Review All" button(s)`);

      if (reviewCount > 0) {
        await reviewBtn.first().click();
        await page.waitForTimeout(1000);

        // Check if approval modal appeared
        const approvalModal = page.locator('[role="dialog"]').filter({ hasText: 'Review Actions' });
        const approvalVisible = await approvalModal.isVisible().catch(() => false);

        if (approvalVisible) {
          console.log('  ✓ SUCCESS: Approval modal opened!');
          await page.screenshot({ path: 'test-results/crawl-04-approval-modal.png', fullPage: true });

          // Check for checkboxes
          const checkboxes = page.locator('[role="checkbox"]');
          const checkboxCount = await checkboxes.count();
          console.log(`  Found ${checkboxCount} checkboxes in modal`);

          // Close modal
          const cancelBtn = page.locator('[role="dialog"] button').filter({ hasText: 'Cancel' }).last();
          if (await cancelBtn.isVisible()) {
            await cancelBtn.click();
            await page.waitForTimeout(500);
            console.log('  ✓ Modal closed');
          }
        } else {
          console.log('  ✗ FAILED: Approval modal did not appear');
          await page.screenshot({ path: 'test-results/crawl-04-approval-failed.png', fullPage: true });
        }
      } else {
        console.log('  ⚠ No "Review All" button found (may be no pending actions)');
      }
    } catch (error) {
      console.log(`  ✗ ERROR: ${error}`);
    }

    // Test 4: Expand/Collapse AI Decision Cards
    console.log('\nTEST 4: Testing collapsible decision cards...');
    try {
      const showDetailsBtn = page.locator('button').filter({ hasText: 'Show Details' });
      const detailsCount = await showDetailsBtn.count();
      console.log(`  Found ${detailsCount} "Show Details" button(s)`);

      if (detailsCount > 0) {
        // Click first Show Details
        await showDetailsBtn.first().click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/crawl-05-card-expanded.png', fullPage: true });
        console.log('  ✓ Card expanded');

        // Click Show Less
        const showLessBtn = page.locator('button').filter({ hasText: 'Show Less' });
        if (await showLessBtn.first().isVisible()) {
          await showLessBtn.first().click();
          await page.waitForTimeout(500);
          console.log('  ✓ Card collapsed');
        }
      } else {
        console.log('  ⚠ No collapsible cards found');
      }
    } catch (error) {
      console.log(`  ✗ ERROR: ${error}`);
    }

    // Test 5: Individual action buttons on cards
    console.log('\nTEST 5: Testing action buttons on decision cards...');
    try {
      const approveButtons = page.locator('button').filter({ hasText: 'Approve & Execute' });
      const approveCount = await approveButtons.count();
      console.log(`  Found ${approveCount} "Approve & Execute" button(s)`);

      const reviewButtons = page.locator('button').filter({ hasText: 'Review Each' });
      const reviewCount = await reviewButtons.count();
      console.log(`  Found ${reviewCount} "Review Each" button(s)`);

      const askButtons = page.locator('button').filter({ hasText: 'Ask AI' });
      const askCount = await askButtons.count();
      console.log(`  Found ${askCount} "Ask AI" button(s)`);

      if (approveCount > 0) {
        console.log('  ✓ Action buttons are present on cards');
      }
    } catch (error) {
      console.log(`  ✗ ERROR: ${error}`);
    }

    // Final screenshot
    await page.screenshot({ path: 'test-results/crawl-06-final.png', fullPage: true });

    console.log('\n=== Crawl Complete ===\n');

    // Summary
    console.log('SUMMARY:');
    console.log('--------');
    console.log('Screenshots saved in test-results/');
    console.log('- crawl-01-initial.png: Initial dashboard state');
    console.log('- crawl-02-drawer-*.png: Status drawer test');
    console.log('- crawl-03-emergency-*.png: Emergency modal test');
    console.log('- crawl-04-approval-*.png: Approval modal test');
    console.log('- crawl-05-card-*.png: Collapsible card test');
    console.log('- crawl-06-final.png: Final state');
  });

  test('Debug: List all clickable elements', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/ai-coo');
    await page.waitForLoadState('networkidle');

    console.log('\n=== All Clickable Elements ===\n');

    // Get all buttons
    const buttons = await page.locator('button').all();
    console.log(`Total buttons found: ${buttons.length}\n`);

    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      const text = await button.textContent();
      const isVisible = await button.isVisible();
      const classes = await button.getAttribute('class');

      console.log(`Button ${i + 1}:`);
      console.log(`  Text: "${text?.trim()}"`);
      console.log(`  Visible: ${isVisible}`);
      console.log(`  Classes: ${classes}`);
      console.log('');
    }

    // Get all links
    const links = await page.locator('a').all();
    console.log(`\nTotal links found: ${links.length}`);
  });
});
