import { expect, test } from '@playwright/test';

test('navigate into a dictionary', async ({ page }) => {
	await page.goto('https://livingdictionaries.app/');
	await page.waitForTimeout(2000);
	await page.getByPlaceholder('Find a Dictionary').click();
	await page.getByPlaceholder('Find a Dictionary').fill('Achi');
	await page.getByRole('button', { name: 'Achi Guatemala' }).click();
	await page.getByRole('link', { name: 'Open Dictionary' }).click();
	await page.getByRole('link', { name: 'Contributors' }).click();
	await expect(page.getByRole('heading', { name: 'Living Dictionaries Team' })).toBeVisible();
});
