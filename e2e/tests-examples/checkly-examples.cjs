const { chromium } = require('playwright')
const browser = await chromium.launch()
const page = await browser.newPage()

const errorCount = {
  failedRequests: 0, // failed http request
  appExceptions: 0, // uncaught exceptions
  scriptErrors: 0,   // errors in your test script
  assertionErrors: 0 // you can count other errors here
}

const script = async () => {
  // This block will track failed http request in your app.
  // Note that 4xx and 5xx responses are still successful from HTTP standpoint
  // Feel free to remove or modify it according to your app behavior
  page.on('requestfailed', (request) => {
    console.log(`Failed request: ${request.url()} reason: ${request.failure().errorText}`)
    errorCount.failedRequests++
  })

  // This block will track uncaught exceptions in your app.
  // Feel free to remove or modify if according to your app behavior
  page.on('error', (exception) => {
    console.log(`Uncaught exception: ${exception}`)
    errorCount.appExceptions++
  })

  const appUrl = process.env.ENVIRONMENT_URL || 'https://staging.hvsb.workers.dev'
  console.log(`Starting to check: ${appUrl}`)

  // Navigate to your app and waits until there is no network activity for 500ms
  const response = await page.goto(appUrl, { waitUntil: 'networkidle' })
  console.log(`Successfully loaded: ${appUrl}, status: ${response.status()}`)

  // Wait for 1s
  await page.waitForTimeout(1000)
  // Note that it's much better to not use waitForTimeout and wait for a specific selector in your app like this:
  // await page.waitForSelector('.home-dashboard')

  // Take a full-page screenshot of the app
  await page.screenshot({
    path: 'home.png',
    fullPage: true
  })

  // // This block will find a DOM element using a selector and verify its inner text
  // const elementContent = await page.$eval('.dashboard > h2', el => el.innerText)
  // const expectedContent = 'Newest clients'
  // if (elementContent !== expectedContent) {
  //   console.info(`The innerText is "${elementContent}", expected "${expectedContent}"`)
  //   errorCount.assertionErrors++
  // }


  // // This block fills a login-form with a username and password
  // await page.type('input[type="email"]', 'user@myapp.com')
  // await page.type('input[type="password"]', 'password1234')
  // await page.click('button[type="submit"]') // click a button
  // await page.waitForNavigation({ waitUntil: 'networkidle' }) // wait for the app to reload
}

// This block of code will bootstrap your script.
// The check run will fail if any errors are detected.
const main = async () => {
  try {
    await script()
  } catch (error) {
    console.error(`E2E script error:`, error)
    errorCount.scriptErrors++
  } finally {
    await browser.close()
  }

  const totalErrors = Object.values(errorCount).reduce((accumulator, current) => accumulator + current, 0)
  if (totalErrors > 0) {
    // This will fail the check
    throw new Error(`${totalErrors} Errors detected on your page. Breakdown: ${JSON.stringify(errorCount)}`)
  }

  console.log('Check finished successfully - no errors')
}
await main()
