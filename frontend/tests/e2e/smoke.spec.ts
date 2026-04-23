import { test, expect } from '@playwright/test';

test('homepage affiche le titre de l’application', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText(/buildflow/i);
});
