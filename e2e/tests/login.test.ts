test.skip('Login with a test account', async () => {
  if (browserName !== 'webkit') {
    // Safari on Windows runs into a "Server Error"
    await page.goto('https://staging.hvsb.workers.dev/');
    await page.click('text=Begin Reading');
    await page.click('text=The Family History of Jesus, the Messiah');
    await page.click('text=Sign in with email');

    await page.fill('input[name="email"]', '1234@checklye2e.com');
    await page.press('input[name="email"]', 'Enter');
    await page.fill('input[name="password"]', '1234@checklye2e.com');
    await page.press('input[name="password"]', 'Enter');

    await page.click('text=e2e');
    await page.click('text=Account Details');
    expect(await page.innerText('text=1234@checklye2e.com'));
    expect(await page.url()).toBe('https://staging.hvsb.workers.dev/account');
  }
});
