import puppeteer from 'puppeteer';

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  page.on('response', response => {
    if (response.url().includes('/api/rides') && response.request().method() === 'POST') {
      console.log(`[NETWORK] POST /api/rides completed with status: ${response.status()}`);
    }
  });

  try {
    console.log('Navigating to app...');
    await page.goto('https://gen-lang-client-0442992261.web.app/login', { waitUntil: 'networkidle2' });

    console.log('Signing up a new test user...');
    await page.click('button:has-text("Create an account")').catch(() => {});
    await page.waitForTimeout(500);
    
    // Switch to sign up tab if necessary
    const signUpBtn = await page.$x("//button[contains(text(), 'Create an account')]");
    if (signUpBtn.length > 0) {
      await signUpBtn[0].click();
      await page.waitForTimeout(500);
    }

    const testEmail = `testuser_${Date.now()}@example.com`;
    await page.type('input[type="email"]', testEmail);
    await page.type('input[type="password"]', 'password123');
    await page.type('input[name="name"], input[placeholder*="Name"]', 'Test Driver').catch(() => {});
    
    const submitBtns = await page.$x("//button[contains(text(), 'Sign up') or contains(text(), 'Create account')]");
    if (submitBtns.length > 0) {
      await submitBtns[0].click();
    } else {
      await page.click('button[type="submit"]');
    }
    
    console.log(`Signed up as ${testEmail}. Waiting for redirect...`);
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => page.waitForTimeout(3000));

    console.log('Navigating to /offer...');
    await page.goto('https://gen-lang-client-0442992261.web.app/offer', { waitUntil: 'networkidle2' });

    console.log('Filling out the ride offer form...');
    await page.select('select[name="origin"]', 'Galle');
    await page.select('select[name="destination"]', 'Colombo');
    
    // Future date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await page.type('input[name="date"]', dateStr);
    
    await page.type('input[name="departure_time"]', '08:00');
    await page.type('input[name="vehicle_description"]', 'Honda Fit - Automated Test');
    
    // Fuel calculator fields
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="number"]'));
      if (inputs.length >= 2) {
        // Clear and type
        inputs[0].value = '';
        inputs[1].value = '';
      }
    });
    
    const numberInputs = await page.$$('input[type="number"]');
    if (numberInputs.length >= 2) {
        await numberInputs[0].click({ clickCount: 3 }); // select all
        await numberInputs[0].type('3000');
        await numberInputs[1].click({ clickCount: 3 }); // select all
        await numberInputs[1].type('3');
    }

    console.log('Submitting the form...');
    const postBtns = await page.$x("//button[contains(., 'Post ride')]");
    if (postBtns.length > 0) {
      await postBtns[0].click();
    } else {
      await page.click('button[type="submit"]');
    }

    console.log('Waiting for success toast and redirect...');
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: 'test_success_state.png' });
    console.log('Screenshot saved to test_success_state.png');

  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'test_error_state.png' });
  } finally {
    await browser.close();
  }
})();
