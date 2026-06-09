import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext();
const page = await context.newPage();

const logs = [];
page.on('console', (msg) => {
  logs.push(`[console:${msg.type()}] ${msg.text()}`);
});
page.on('pageerror', (err) => {
  logs.push(`[pageerror] ${err.message}`);
});

try {
  console.log('--- Navigating to sign-in ---');
  await page.goto('http://localhost:3000/sign-in', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/plaid-debug/01-signin.png' });
  console.log(await page.title());
  console.log(page.url());
} catch (e) {
  console.log('ERR', e.message);
}

await browser.close();
console.log('--- LOGS ---');
console.log(logs.join('\n'));
