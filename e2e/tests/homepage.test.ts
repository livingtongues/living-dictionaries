describe('Homepage', () => {
  test('has title of House Visual Study Bible', async () => {
    await page.goto('https://staging.livingdictionaries.workers.dev/');
    await page.screenshot({ path: `screenshots/hvsb-${browserName}.png` });
    console.log(`Screenshot saved to screenshots/hvsb-${browserName}.png`);
    expect(await page.title()).toBe('Living Dictionaries');
  });
});
