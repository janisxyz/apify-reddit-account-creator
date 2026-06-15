import { Actor } from 'apify';
import { PlaywrightCrawler } from '@crawlee/playwright';
import { randomUserAgent } from '@crawlee/utils';

await Actor.init();

const input = await Actor.getInput() || {};
const { username, password, email, proxyUrls = [] } = input;

// Auto-generate if not provided
function generateRandomUsername() {
  const adjectives = ['Cool', 'Fast', 'Smart', 'Happy', 'Bright'];
  const nouns = ['Panda', 'Tiger', 'Eagle', 'Wolf', 'Fox'];
  const num = Math.floor(Math.random() * 9999);
  return `${adjectives[Math.floor(Math.random()*adjectives.length)]}${nouns[Math.floor(Math.random()*nouns.length)]}${num}`;
}

function generatePassword() {
  return 'Pass' + Math.random().toString(36).slice(2) + '!' + Date.now().toString().slice(-4);
}

function generateEmail() {
  return `temp${Date.now()}@example.com`;  // Replace with real temp mail service in production
}

const finalUsername = username || generateRandomUsername();
const finalPassword = password || generatePassword();
const finalEmail = email || generateEmail();

console.log(`Generated credentials:`);
console.log(`Username: ${finalUsername}`);
console.log(`Password: ${finalPassword}`);
console.log(`Email: ${finalEmail}`);

const crawler = new PlaywrightCrawler({
    headless: true,
    proxyConfiguration: proxyUrls.length > 0 ? await Actor.createProxyConfiguration({ proxyUrls }) : undefined,
    launchContext: {
        userAgent: randomUserAgent(),
    },
    requestHandler: async ({ page, request }) => {
        console.log(`Processing: ${request.url}`);

        await page.goto('https://www.reddit.com/register', { 
            waitUntil: 'networkidle', 
            timeout: 60000 
        });

        await page.waitForSelector('input[name="username"]', { timeout: 30000 });
        await page.fill('input[name="username"]', finalUsername);
        
        await page.fill('input[name="password"]', finalPassword);
        
        try {
            await page.fill('input[name="email"]', finalEmail);
        } catch (e) {
            console.log('No direct email field');
        }

        await page.click('button[type="submit"], button:has-text("Continue"), button:has-text("Sign up")');

        console.log('Waiting for verification...');
        await page.waitForTimeout(15000);

        if (page.url().includes('welcome') || await page.locator('text=Welcome').count() > 0) {
            console.log(`✅ Account likely created: ${finalUsername}`);
            await Actor.pushData({ success: true, username: finalUsername, password: finalPassword, email: finalEmail });
        } else {
            console.log('Signup incomplete - check for CAPTCHA/email verification.');
            await Actor.pushData({ success: false, username: finalUsername });
        }
    },
    maxRequestsPerCrawl: 1,
});

await crawler.run([{ url: 'https://www.reddit.com/register' }]);

await Actor.exit();