// run `node e2e/essentials.cjs`
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({
        headless: false,
        slowMo: 50,
    });
    const context = await browser.newContext();

    const page = await context.newPage();
    await page.goto('http://staging.hvsb.workers.dev/');
    await page.click('text=Begin Reading');
    // assert.equal(page.url(), 'http://staging.hvsb.workers.dev/WEB/MAT/1');

    await page.click('text=The Family History of Jesus, the Messiah');
    // assert.equal(page.url(), 'http://staging.hvsb.workers.dev/WEB/MAT/1');

    // Click text=Sign in with emailEmail
    await page.click('text=Sign in with email');

    await page.fill('input[name="email"]', '1234@checklye2e.com');
    await page.press('input[name="email"]', 'Enter');

    // await page.fill('input[name="name"]', 'e2e tester');
    // await page.press('input[name="name"]', 'Tab');
    // await page.fill('input[name="newPassword"]', '1234@checklye2e.com');
    // await page.press('input[name="newPassword"]', 'Enter');
    await page.fill('input[name="password"]', '1234@checklye2e.com');
    await page.press('input[name="password"]', 'Enter');

    await page.click('text=e2e');
    await page.click('text=Account Details');
    // assert.equal(page.url(), 'http://staging.hvsb.workers.dev/account');

    await page.click('text=1234@checklye2e.com');

    await Promise.all([
        page.waitForNavigation(/*{ url: 'http://staging.hvsb.workers.dev/search' }*/),
        page.click('a:has-text("Search")')
    ]);

    await Promise.all([
        page.waitForNavigation(/*{ url: 'http://staging.hvsb.workers.dev/search?media_prod%5Bquery%5D=The%20Family%20History%20of%20Jesus' }*/),
        page.fill('[placeholder="Search Media"]', 'The Family History of Jesus')
    ]);

    await page.click('text=The Family History of Jesus, the Messiah');
    // assert.equal(page.url(), 'http://staging.hvsb.workers.dev/WEB/MAT/1/doc/4ksmpgO0pBPYQ4M09Et1');

    await page.click('text=The opening of the first book of the New Testament reflects a clear Jewish');

    await page.click('.next-ch-btn');
    // assert.equal(page.url(), 'http://staging.hvsb.workers.dev/WEB/MAT/2');

    await page.click('text=Matthew Matt 2');
    await page.waitForTimeout(1000);
    await page.click('a:has-text("3")');
    // assert.equal(page.url(), 'http://staging.hvsb.workers.dev/WEB/MAT/3');

    await page.click('text=1In those days, John the Baptizer came, preaching in the wilderness of Judea');

    await page.click('button:has-text("Contact Us")');
    await page.click('text=What is your question or comment?');
    await page.click('[aria-label="Close"]');

    await page.click('text=A Possible Site for the Cave of John the Baptist');
    // assert.equal(page.url(), 'http://staging.hvsb.workers.dev/WEB/MAT/3/img/MJjp4u7RVxn6pHkHMPoP');

    // await page.click('text=Subscribe to HVSB Basic');
    // await page.click('text=Checkout Using Stripe');

    // await page.click('[placeholder="1234 1234 1234 1234"]');
    // await page.fill('[placeholder="1234 1234 1234 1234"]', '4242 4242 4242 4242');
    // //   await page.press('[placeholder="1234 1234 1234 1234"]', 'Tab');
    // await page.fill('[placeholder="MM / YY"]', '12 / 26');
    // //   await page.press('[placeholder="MM / YY"]', 'Tab');
    // await page.fill('[placeholder="CVC"]', '424');
    // //   await page.press('[placeholder="CVC"]', 'Tab');
    // await page.fill('input[name="billingName"]', 'e2e tester');
    // //   await page.press('input[name="billingName"]', 'Tab');
    // //   await page.press('[aria-label="Country or region"]', 'Tab');
    // await page.fill('[placeholder="ZIP"]', '12345');
    // //   await page.press('[placeholder="ZIP"]', 'Tab');

    // await Promise.all([
    //     //   await page.goto('http://staging.hvsb.workers.dev/WEB/MAT/3');
    //     page.waitForNavigation(/*{ url: 'http://staging.hvsb.workers.dev/WEB/MAT/3' }*/),
    //     page.click('button:has-text("Start trial")')
    // ]);

    // ---------------------
    await context.close();
    await browser.close();
})();