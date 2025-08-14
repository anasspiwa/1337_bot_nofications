const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const CONFIG = require('./config');
require('dotenv').config();

puppeteer.use(StealthPlugin());

async function testLogin() {
    let browser = null;
    let page = null;
    
    try {
        console.log('🧪 Testing 1337 website login...');
        console.log(`📧 Email: ${CONFIG.MONITORING.EMAIL}`);
        console.log(`🔗 Login URL: ${CONFIG.MONITORING.LOGIN_URL}`);
        console.log(`🎯 Target URL: ${CONFIG.MONITORING.TARGET_URL}`);
        
        // Launch browser
        browser = await puppeteer.launch({
            headless: false, // Always visible for testing
            args: CONFIG.BROWSER.ARGS,
            defaultViewport: null,
            timeout: 30000
        });

        page = await browser.newPage();
        
        // Set user agent
        await page.setUserAgent(CONFIG.BROWSER.USER_AGENT);
        
        // Navigate to login page
        console.log('🌐 Navigating to login page...');
        await page.goto(CONFIG.MONITORING.LOGIN_URL, { waitUntil: "networkidle2" });
        
        // Wait for login elements
        console.log('⏳ Waiting for login elements...');
        await page.waitForSelector('input[type="email"]', { timeout: 10000 });
        await page.waitForSelector('input[type="password"]', { timeout: 10000 });
        
        // Enter credentials
        console.log('📝 Entering credentials...');
        await page.type('input[type="email"]', CONFIG.MONITORING.EMAIL, { delay: 100 });
        await page.type('input[type="password"]', CONFIG.MONITORING.PASSWORD, { delay: 100 });
        
        // Click login button
        console.log('🔘 Clicking login button...');
        const submitBtn = await page.$('button[type="submit"]');
        if (!submitBtn) {
            throw new Error("Login button not found");
        }
        
        await Promise.all([
            submitBtn.click(),
            page.waitForNavigation({ waitUntil: "networkidle2" }),
        ]);
        
        // Check if login was successful
        const currentUrl = page.url();
        console.log(`📍 Current URL after login: ${currentUrl}`);
        
        if (currentUrl.includes('/en/users/sign_in') || currentUrl.includes('/users/sign_in')) {
            throw new Error("❌ Login failed - still on login page");
        }
        
        console.log('✅ Login successful!');
        
        // Navigate to target page
        console.log('🎯 Navigating to target page...');
        await page.goto(CONFIG.MONITORING.TARGET_URL, { waitUntil: "networkidle2" });
        
        // Wait a bit and check the page
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const targetUrl = page.url();
        console.log(`📍 Target page URL: ${targetUrl}`);
        
        if (targetUrl.includes('piscine')) {
            console.log('✅ Successfully reached target page!');
        } else {
            console.log('⚠️  Not on expected target page, but continuing...');
        }
        
        // Get page title
        const pageTitle = await page.title();
        console.log(`📄 Page title: ${pageTitle}`);
        
        // Check if we can see content
        const bodyText = await page.$eval('body', el => el.textContent);
        console.log(`📝 Page content length: ${bodyText.length} characters`);
        
        if (bodyText.length > 100) {
            console.log('✅ Page content loaded successfully!');
        } else {
            console.log('⚠️  Page content seems too short');
        }
        
        console.log('\n🎉 Login test completed successfully!');
        console.log('Press Ctrl+C to close the browser...');
        
        // Keep browser open for manual inspection
        await new Promise(() => {}); // This will keep the script running
        
    } catch (error) {
        console.error('❌ Login test failed:', error.message);
        console.error('Full error:', error);
    } finally {
        if (browser) {
            console.log('🔒 Closing browser...');
            await browser.close();
        }
    }
}

// Run the test
testLogin().catch(console.error); 