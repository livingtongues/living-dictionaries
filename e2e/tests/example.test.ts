test.skip('example.com loads a title of "Example Domain"', async () => {
  await page.goto('https://www.example.com');
  expect(await page.title()).toBe('Example Domain');
});
