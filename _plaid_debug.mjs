import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext();
const page = await context.newPage();

const logs = [];
page.on('console', (msg) => logs.push(`[console:${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));
page.on('requestfailed', (req) => logs.push(`[reqfail] ${req.url()} ${req.failure()?.errorText}`));

try {
  console.log('--- Navigating to connect (demo mode) ---');
  await page.goto('http://localhost:3000/connect?demo=true', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  console.log('URL:', page.url());

  const connectBtn = page.getByRole('button', { name: /connect a bank/i });
  await connectBtn.waitFor({ timeout: 15000 });
  console.log('--- Clicking Connect a bank ---');
  await connectBtn.click();
  await page.waitForTimeout(3000);

  // Plaid Link opens in an iframe
  const frames = page.frames();
  console.log('frame URLs:', frames.map((f) => f.url()));

  const plaidFrame = frames.find((f) => f.url().includes('plaid'));
  if (plaidFrame) {
    console.log('--- Found Plaid iframe, searching institution ---');
    const searchInput = plaidFrame.getByPlaceholder(/search/i).first();
    await searchInput.waitFor({ timeout: 20000 });
    await searchInput.fill('Platypus');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/plaid-debug-search.png' });

    const bankOption = plaidFrame.getByText(/Platypus/i).first();
    await bankOption.click({ timeout: 10000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/plaid-debug-institution.png' });

    // continue button if present
    const continueBtn = plaidFrame.getByRole('button', { name: /continue/i }).first();
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click();
      await page.waitForTimeout(2000);
    }

    const userField = plaidFrame.locator('#username, input[name="username"]').first();
    await userField.waitFor({ timeout: 20000 });
    await userField.fill('user_good');
    const passField = plaidFrame.locator('#password, input[name="password"]').first();
    await passField.fill('pass_good');
    await page.screenshot({ path: '/tmp/plaid-debug-creds.png' });
    const submitBtn = plaidFrame.getByRole('button', { name: /submit|continue/i }).first();
    await submitBtn.click();
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/plaid-debug-after-submit.png' });

    // Some flows show an account-select screen
    const continueBtn2 = plaidFrame.getByRole('button', { name: /continue|connect/i }).first();
    if (await continueBtn2.isVisible().catch(() => false)) {
      await continueBtn2.click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: '/tmp/plaid-debug-after-continue2.png' });
    }
  } else {
    console.log('No Plaid iframe found');
  }

  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/plaid-debug-final.png' });
} catch (e) {
  console.log('ERR', e.message);
  await page.screenshot({ path: '/tmp/plaid-debug-error.png' }).catch(() => {});
}

console.log('--- LOGS ---');
console.log(logs.join('\n'));
await browser.close();
