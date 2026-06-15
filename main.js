import { Actor } from 'apify';
import { PlaywrightCrawler } from '@crawlee/playwright';
import { randomUserAgent } from '@crawlee/utils';

await Actor.init();

const input = await Actor.getInput() || {};

// Auto-generate if not provided
let username = input.username;
let password = input.password;
let email = input.email;
const proxyUrls = input.proxyUrls || [];

if (!username) {
    username = `user${Math.random().toString(36).slice(2)}${Date.now().toString().slice(-4)}`;
}
if (!password) {
    password = 'Pass' + Math.random().toString(36).slice(2) + '!' + Date.now().toString().slice(-4);
}
if (!email) {
    email = `${username}@tempmail.example.com`;  // Replace with real temp email service
}

console.log(`Using credentials - Username: ${username}, Email: ${email}`);

const crawler = new PlaywrightCrawler({
    headless: true,
    proxyConfiguration: proxyUrls.length > 0 ? await Actor.createProxyConfiguration({ proxyUrls }) : undefined,
    launchContext: {
        userAgent: randomUserAgent(),
    },
    requestHandler: async ({ page, request }) => {
        console.log(`Processing: ${request.url}`);

        // Go to Reddit register
        await page.goto('https://www.reddit.com/register', { 
            waitUntil: 'networkidle', 
            timeout: 60000 
        });

        // Fill signup form - selectors may need updating
        await page.waitForSelector('input[name="username"]', { timeout: 30000 });
        await page.fill('input[name="username"]', username);
        
        await page.fill('input[name="password"]', password);
        
        // Email if separate field
        try {
            await page.fill('input[name="email"]', email);
        } catch (e) {
            console.log('No direct email field or already filled');
        }

        // Click continue/submit buttons - adjust as needed
        await page.click('button[type="submit"], button:has-text("Continue"), button:has-text("Sign up")');

        // Handle potential CAPTCHA or next steps (manual or solver needed)
        console.log('Waiting for potential verification...');
        await page.waitForTimeout(10000); // Placeholder

        // Check for success
        if (page.url().includes('welcome') || await page.locator('text=Welcome').count() > 0) {
            console.log(`✅ Account likely created: ${username}`);
            await Actor.pushData({ success: true, username, email });
        } else {
            throw new Error('Signup did not complete successfully. Check logs/screenshots.');
        }
    },
    maxRequestsPerCrawl: 1,
});

await crawler.run([{ url: 'https://www.reddit.com/register' }]);

await Actor.exit();