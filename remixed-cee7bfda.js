const fs = require('fs');
const path = require('path');

// Global error handlers
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));

console.log('=== Script started ===');
require('dotenv').config();
console.log('DEBUG:', process.env.DEBUG);

const CONFIG = require('./config');
console.log('Config loaded:', CONFIG);

const { 
    default: makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const { sendAllNotifications } = require('./notification');
const { logHelper } = require('./logger');
const diff = require('diff');

puppeteer.use(StealthPlugin());

// ==================== UTILITY FUNCTIONS ====================

function ensureDirectories() {
    const dirs = [
        CONFIG.MONITORING.SAVE_DIR,
        path.join(__dirname, 'logs'),
        CONFIG.WHATSAPP.SESSION_DIR
    ];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    });
}

function clearFolder(folderPath) {
    try {
        if (!fs.existsSync(folderPath)) {
            logHelper.warn(`Directory does not exist: ${folderPath}`);
            return;
        }
        
        const files = fs.readdirSync(folderPath);
        if (files.length === 0) {
            logHelper.info(`Directory is empty: ${folderPath}`);
            return;
        }
        
        let deletedCount = 0;
        for (const file of files) {
            const filePath = path.join(folderPath, file);
            try {
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                } else if (stats.isDirectory()) {
                    fs.rmSync(filePath, { recursive: true, force: true });
                    deletedCount++;
                }
            } catch (fileError) {
                logHelper.error(`Failed to delete file: ${filePath}`, fileError);
            }
        }
        
        if (deletedCount > 0) {
            logHelper.info(`Deleted ${deletedCount} files from: ${folderPath}`);
        }
    } catch (error) {
        logHelper.error('Failed to clear folder', error);
    }
}

function getTimestamp() {
    return new Date().toLocaleString('en-US');
}

function getLatestHtmlFile(dir) {
    try {
        if (!fs.existsSync(dir)) {
            logHelper.warn(`HTML directory does not exist: ${dir}`);
            return null;
        }
        
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

        if (files.length === 0) {
            logHelper.warn(`No HTML files found in directory: ${dir}`);
            return null;
        }

        let latestFile = files[0];
        let latestTime = 0;

        for (const file of files) {
            const fullPath = path.join(dir, file);
            try {
                const stats = fs.statSync(fullPath);
                const mtime = stats.mtime.getTime();

                if (mtime > latestTime) {
                    latestTime = mtime;
                    latestFile = file;
                }
            } catch (fileError) {
                logHelper.error(`Failed to read file info: ${file}`, fileError);
            }
        }
        
        const result = path.join(dir, latestFile);
        logHelper.debug(`Latest HTML file: ${latestFile}`);
        return result;
    } catch (error) {
        logHelper.error('Failed to find latest HTML file', error);
        return null;
    }
}

// ==================== WEBSITE MONITORING CLASS ====================

class Website1337Monitor {
    constructor(whatsappBot) {
        this.whatsappBot = whatsappBot;
        this.browser = null;
        this.page = null;
        this.originalHtml = null;
        this.isRunning = false;
        this.startTime = null;
        this.attemptCount = 0;
        this.lastChangeTime = null;
        this.comparisonPaused = false;
    }

    async startMonitoring() {
        try {
            logHelper.monitoring('Starting 1337 website monitoring...');
            this.startTime = new Date();
            
            const result = await this.initBrowser();
            if (!result) {
                throw new Error('Failed to initialize browser');
            }

            this.browser = result.browser;
            this.page = result.page;

            // First, navigate to login page and authenticate
            logHelper.monitoring('Navigating to login page for initial authentication...');
            await this.performInitialLogin();

            // Wait and get original content
            logHelper.monitoring('Waiting 10 seconds before taking original snapshot...');
            await new Promise(resolve => setTimeout(resolve, 10000));

            this.originalHtml = await this.getPageContentWithRetry();
            
            clearFolder(CONFIG.MONITORING.SAVE_DIR);
            const firstSavePath = path.join(CONFIG.MONITORING.SAVE_DIR, '1337_original.html');
            fs.writeFileSync(firstSavePath, this.originalHtml, "utf-8");
            logHelper.monitoring(`Saved original snapshot: ${firstSavePath}`);

            // Send start notification
            await this.sendStartNotification();

            // Start monitoring loop
            this.isRunning = true;
            await this.monitoringLoop();

        } catch (error) {
            logHelper.error('Failed to start monitoring', error);
            await this.cleanup();
            
            // Send critical error notification
            if (this.whatsappBot && this.whatsappBot.isConnected && this.whatsappBot.sock) {
                const adminNumbers = this.whatsappBot.adminNumbers || CONFIG.WHATSAPP.ADMIN_NUMBERS;
                if (adminNumbers.length > 0) {
                    try {
                        await this.whatsappBot.sock.sendMessage(adminNumbers[0], {
                            text: `❌ *Critical Error in Monitoring Startup:* ${error.message}`
                        });
                    } catch (whatsappError) {
                        logHelper.error('Failed to send critical error notification via WhatsApp', whatsappError);
                    }
                }
            }
            throw error;
        }
    }

    async initBrowser() {
        try {
            logHelper.monitoring('Initializing browser...');
            
            this.browser = await puppeteer.launch({
                headless: CONFIG.MONITORING.HEADLESS,
                args: CONFIG.BROWSER.ARGS,
                defaultViewport: null,
                timeout: CONFIG.MONITORING.BROWSER_TIMEOUT,
                ignoreDefaultArgs: ['--disable-extensions'],
                executablePath: process.env.CHROME_PATH || undefined
            });

            this.page = await this.browser.newPage();
            
            // Set user agent
            await this.page.setUserAgent(CONFIG.BROWSER.USER_AGENT);
            
            // Set timeout
            this.page.setDefaultTimeout(CONFIG.MONITORING.PAGE_TIMEOUT);
            this.page.setDefaultNavigationTimeout(CONFIG.MONITORING.PAGE_TIMEOUT);

            logHelper.monitoring('Browser initialized successfully');
            return { browser: this.browser, page: this.page };
            
        } catch (error) {
            logHelper.error('Failed to initialize browser', error);
            return null;
        }
    }

    async getPageContentWithRetry(maxAttempts = 3) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // Wait for page to load completely before getting content
                await this.page.waitForSelector('body', { timeout: 15000 });
                
                // Check for logout
                const isLoggedOut = await this.checkIfLoggedOut();
                if (isLoggedOut) {
                    logHelper.monitoring('Logout detected! Starting re-login process...');
                    await this.handleLogout();
                    continue; // Retry after re-login
                }
                
                // Add auto-scroll
                await this.autoScrollDown();
                
                const content = await this.page.content();
                if (content && content.length > 100) {
                    return content;
                } else {
                    logHelper.warn(`Content is empty or too small in attempt ${attempt}. Reloading...`);
                    await this.page.reload({ waitUntil: "networkidle2" });
                }
            } catch (err) {
                logHelper.error(`Error getting content in attempt ${attempt}:`, err);
                await this.page.reload({ waitUntil: "networkidle2" });
            }
        }
        throw new Error("Could not get valid content after several attempts");
    }

    async autoScrollDown() {
        try {
            logHelper.monitoring("Starting auto-scroll...");
            
            // Gradual scrolling down
            await this.page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 100; // Distance per scroll
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        
                        // Stop when we reach the bottom
                        if (totalHeight >= scrollHeight) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100); // 100ms delay between scrolls
                });
                
                // Scroll back up slightly to ensure all elements are loaded
                window.scrollTo(0, document.body.scrollHeight * 0.8);
                
                // Additional wait for dynamic content
                await new Promise(resolve => setTimeout(resolve, 2000));
            });
            
            logHelper.success("Auto-scroll completed successfully");
        } catch (error) {
            logHelper.warn("Error in auto-scroll:", error.message);
            // Don't want to stop the process if scrolling fails
        }
    }

    async checkIfLoggedOut() {
        try {
            // Check current URL
            const currentUrl = this.page.url();
            if (currentUrl.includes('/en/users/sign_in') || currentUrl.includes('/users/sign_in')) {
                logHelper.monitoring("Login page detected - user is logged out");
                return true;
            }

            // Check for login elements on the page
            const loginElements = await this.page.$$('input[type="email"], input[type="password"], button[type="submit"]');
            if (loginElements.length >= 2) {
                logHelper.monitoring("Login elements detected - user is logged out");
                return true;
            }

            // Check for login-related error messages
            const errorMessages = await this.page.$$eval('body', (body) => {
                const text = body.textContent.toLowerCase();
                return text.includes('sign in') || text.includes('login') || text.includes('password') || text.includes('email');
            });
            
            if (errorMessages) {
                logHelper.monitoring("Login messages detected - user is logged out");
                return true;
            }

            return false;
        } catch (error) {
            logHelper.warn("Error checking logout status:", error.message);
            return false;
        }
    }

    async handleLogout() {
        try {
            logHelper.monitoring("Starting re-login process...");
            // Send logout notification
            const logoutInfo = {
                type: 'Re-login Process',
                timestamp: getTimestamp(),
                attempt: 'auto',
                savedFile: 'N/A',
                details: 'Logout detected and automatic re-login in progress'
            };
            await this.sendErrorNotification(logoutInfo);

            // Navigate to login page
            await this.page.goto(CONFIG.MONITORING.LOGIN_URL, { waitUntil: "networkidle2" });
            logHelper.monitoring("Navigating to login page...");

            // Wait for login elements to load
            await this.page.waitForSelector('input[type="email"]', { timeout: 10000 });
            await this.page.waitForSelector('input[type="password"]', { timeout: 10000 });

            // Enter login credentials
            await this.page.type('input[type="email"]', CONFIG.MONITORING.EMAIL, { delay: 50 });
            await this.page.type('input[type="password"]', CONFIG.MONITORING.PASSWORD, { delay: 50 });

            // Click login button
            const submitBtn = await this.page.$('button[type="submit"]');
            if (!submitBtn) {
                throw new Error("Login button not found");
            }

            await Promise.all([
                submitBtn.click(),
                this.page.waitForNavigation({ waitUntil: "networkidle2" }),
            ]);

            // Verify successful login
            const currentUrl = this.page.url();
            if (currentUrl.includes('/en/users/sign_in') || currentUrl.includes('/users/sign_in')) {
                throw new Error("Login failed - still on login page");
            }

            logHelper.success("Re-login successful!");

            // Navigate to target page
            await this.page.goto(CONFIG.MONITORING.TARGET_URL, { waitUntil: "networkidle2" });
            logHelper.monitoring("Navigating to target page...");

            // Additional wait to ensure page loads
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Save a new HTML snapshot and set as originalHtml
            this.originalHtml = await this.getPageContentWithRetry();
            const newSavePath = path.join(CONFIG.MONITORING.SAVE_DIR, '1337_original.html');
            fs.writeFileSync(newSavePath, this.originalHtml, "utf-8");
            logHelper.monitoring(`Saved new original snapshot after re-login: ${newSavePath}`);

            // Send successful re-login notification
            const successInfo = {
                type: 'Re-login Process',
                timestamp: getTimestamp(),
                attempt: 'success',
                savedFile: 'N/A',
                details: 'Re-login successful and monitoring resumed'
            };
            await this.sendStartNotification();

            this.comparisonPaused = false;

        } catch (error) {
            logHelper.error("Failed to re-login:", error.message);
            // Send failed re-login notification
            const failureInfo = {
                type: 'Re-login Failed',
                timestamp: getTimestamp(),
                attempt: 'failed',
                savedFile: 'N/A',
                details: `Failed to re-login: ${error.message}`
            };
            await this.sendErrorNotification(failureInfo);
            throw error; // Re-throw error for upper level handling
        }
    }

    async performInitialLogin() {
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logHelper.monitoring(`Starting initial login process (attempt ${attempt}/${maxRetries})...`);
                
                // Navigate to login page with longer timeout
                await this.page.goto(CONFIG.MONITORING.LOGIN_URL, { 
                    waitUntil: "networkidle2",
                    timeout: CONFIG.MONITORING.PAGE_TIMEOUT 
                });
                logHelper.monitoring("Navigating to login page...");

                // Wait for page to be fully loaded
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Wait for login elements to load with longer timeout
                await this.page.waitForSelector('input[type="email"]', { timeout: 20000 });
                await this.page.waitForSelector('input[type="password"]', { timeout: 20000 });

                // Focus and clear the email field, then type the email
                await this.page.evaluate(() => {
                    const emailInput = document.querySelector('input[type="email"]');
                    if (emailInput) {
                        emailInput.focus();
                        emailInput.value = '';
                    }
                });
                await this.page.type('input[type="email"]', CONFIG.MONITORING.EMAIL, { delay: 100 });
                // Log the value in the browser console for confirmation
                await this.page.evaluate(() => {
                    const emailInput = document.querySelector('input[type="email"]');
                    if (emailInput) {
                        console.log('EMAIL FIELD VALUE:', emailInput.value);
                    }
                });

                // Focus and clear the password field, then type the password
                await this.page.evaluate(() => {
                    const passwordInput = document.querySelector('input[type="password"]');
                    if (passwordInput) {
                        passwordInput.focus();
                        passwordInput.value = '';
                    }
                });
                await this.page.type('input[type="password"]', CONFIG.MONITORING.PASSWORD, { delay: 100 });

                // Wait a moment before clicking
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Click login button
                const submitBtn = await this.page.$('button[type="submit"]');
                if (!submitBtn) {
                    throw new Error("Login button not found");
                }

                // Click and wait for navigation with longer timeout
                await Promise.all([
                    submitBtn.click(),
                    this.page.waitForNavigation({ 
                        waitUntil: "networkidle2",
                        timeout: CONFIG.MONITORING.PAGE_TIMEOUT 
                    }),
                ]);

                // Wait a bit more for any redirects
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Verify successful login
                const currentUrl = this.page.url();
                logHelper.monitoring(`Current URL after login: ${currentUrl}`);
                
                if (currentUrl.includes('/en/users/sign_in') || currentUrl.includes('/users/sign_in')) {
                    throw new Error("Login failed - still on login page");
                }

                logHelper.success("Initial login successful!");

                // Navigate to target page
                await this.page.goto(CONFIG.MONITORING.TARGET_URL, { 
                    waitUntil: "networkidle2",
                    timeout: CONFIG.MONITORING.PAGE_TIMEOUT 
                });
                logHelper.monitoring("Navigating to target page...");

                // Additional wait to ensure page loads
                await new Promise(resolve => setTimeout(resolve, 5000));

                // Verify we're on the correct page
                const targetUrl = this.page.url();
                logHelper.monitoring(`Target page URL: ${targetUrl}`);
                
                if (targetUrl.includes('piscine')) {
                    logHelper.success("Successfully reached target page!");
                } else {
                    logHelper.warn("Not on expected target page, but continuing...");
                }

                logHelper.success("Initial login and navigation completed successfully!");
                return; // Success, exit the retry loop

            } catch (error) {
                logHelper.error(`Login attempt ${attempt} failed:`, error.message);
                
                if (attempt === maxRetries) {
                    logHelper.error('All login attempts failed');
                    throw error;
                }
                
                logHelper.monitoring(`Retrying login in 5 seconds... (${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    async monitoringLoop() {
        for (let attempt = 1; attempt <= CONFIG.MONITORING.MAX_ATTEMPTS && this.isRunning; attempt++) {
            logHelper.monitoring(`Attempt ${attempt} - waiting ${CONFIG.MONITORING.CHECK_INTERVAL / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.MONITORING.CHECK_INTERVAL));

            if (!this.isRunning) break;

            try {
                const currentHtml = await this.getPageContentWithRetry();

                // Extract main content text for keyword search
                const getMainText = (html) => {
                    const $ = require('cheerio').load(html);
                    let searchRoot = $('main');
                    if (searchRoot.length === 0) searchRoot = $('body');
                    searchRoot.find('script, style, [aria-hidden="true"], [hidden], [style*="display:none"], [style*="visibility:hidden"]').remove();
                    let text = '';
                    const blockTags = ['p','div','section','article','header','footer','nav','ul','ol','li','table','tr','td','th','h1','h2','h3','h4','h5','h6','br'];
                    searchRoot.find('*').each((i, el) => {
                        const tag = $(el).prop('tagName')?.toLowerCase();
                        let t = $(el).text().replace(/\u200B/g, '').replace(/\s+/g, ' ').trim();
                        if (t.length > 0) {
                            text += t;
                            if (blockTags.includes(tag)) text += ' ';
                        }
                    });
                    return text.toLowerCase();
                };
                const mainText = getMainText(currentHtml);
                const keywords = (CONFIG.MONITORING.KEYWORD || '').toLowerCase().split(',').map(k => k.trim()).filter(Boolean);
                // Whole word match (case-insensitive)
                const foundKeyword = keywords.find(kw => kw && new RegExp(`\\b${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(mainText));

                if (!this.comparisonPaused && foundKeyword) {
                    logHelper.monitoring(`Attempt ${attempt}: ❗ Keyword "${foundKeyword}" found in main content!`);
                    const changeInfo = {
                        type: 'Keyword Detected',
                        timestamp: getTimestamp(),
                        attempt: attempt,
                        savedFile: `1337_keyword_try${attempt}.html`,
                        details: `Keyword "${foundKeyword}" detected in main content.`
                    };
                    // Save new version (do NOT clear folder here)
                    const changeSavePath = path.join(CONFIG.MONITORING.SAVE_DIR, changeInfo.savedFile);
                    fs.writeFileSync(changeSavePath, currentHtml, "utf-8");
                    logHelper.monitoring(`Saved keyword snapshot: ${changeSavePath}`);
                    // Send notifications
                    await this.sendChangeNotifications(changeInfo);
                } else if (!this.comparisonPaused) {
                    logHelper.monitoring(`Attempt ${attempt}: No keywords found or not set.`);
                } else {
                    logHelper.monitoring(`Attempt ${attempt}: Comparison paused during login process.`);
                }

                // Refresh page every two attempts
                if (attempt % 2 === 0) {
                    logHelper.monitoring("Refreshing page...");
                    await this.page.reload({ waitUntil: "networkidle2" });

                    // Check for logout after page refresh
                    const isLoggedOutAfterReload = await this.checkIfLoggedOut();
                    if (isLoggedOutAfterReload) {
                        logHelper.monitoring("Logout detected after page refresh! Starting re-login...");
                        await this.handleLogout();
                        // Get content after re-login
                        this.originalHtml = await this.getPageContentWithRetry();
                    } else {
                        // Add auto-scroll after page refresh
                        await this.autoScrollDown();
                        // Do NOT update this.originalHtml, do NOT clear folder, do NOT save reload snapshot
                    }
                }

            } catch (err) {
                logHelper.error(`Error in attempt ${attempt}:`, err);
                await this.handleError(err, attempt);
            }
        }

        logHelper.monitoring("Monitoring loop ended");
        await this.cleanup();
        await this.sendStopNotification(); // Send notification when stopping naturally
    }

    async handleError(err, attempt) {
        const errorInfo = {
            type: 'System Error',
            timestamp: getTimestamp(),
            attempt: attempt,
            savedFile: 'N/A',
            details: `Error during monitoring: ${err.message}`
        };

        if (
            err.message.includes("detached Frame") ||
            err.message.includes("Navigating frame was detached") ||
            err.message.includes("Target closed") ||
            err.message.includes("Protocol error")
        ) {
            logHelper.warn("Critical browser error detected. Restarting browser...");
            errorInfo.details = `Critical browser error (${err.message}). Restarting browser.`;
            await this.sendErrorNotification(errorInfo);

            try {
                await this.browser.close();
            } catch (e) {
                logHelper.error("Error closing old browser:", e.message);
            }

            const result = await this.initBrowser();
            if (!result) {
                logHelper.error("Could not reopen page. Stopping monitoring.");
                errorInfo.details = `Failed to restart browser after critical error (${err.message}). Stopping monitoring.`;
                this.isRunning = false;
                await this.sendErrorNotification(errorInfo);
                return;
            }

            this.browser = result.browser;
            this.page = result.page;
            
            // Perform login after browser restart since we lost session
            logHelper.monitoring("Performing login after browser restart...");
            await this.performInitialLogin();
            
            // Add auto-scroll after browser restart and login
            await this.autoScrollDown();
            
            this.originalHtml = await this.getPageContentWithRetry();

            clearFolder(CONFIG.MONITORING.SAVE_DIR);
            const restartSavePath = path.join(CONFIG.MONITORING.SAVE_DIR, `1337_restart_try${attempt}.html`);
            fs.writeFileSync(restartSavePath, this.originalHtml, "utf-8");
            logHelper.monitoring(`Saved page snapshot after restart: ${restartSavePath}`);
        } else {
            logHelper.error("Unexpected error:", err);
            errorInfo.details = `Unexpected error (${err.message}). Stopping monitoring.`;
            this.isRunning = false;
            await this.sendErrorNotification(errorInfo);
        }
    }

    async sendStartNotification() {
        const startInfo = {
            type: 'Monitoring Started',
            timestamp: getTimestamp(),
            attempt: 0,
            savedFile: '1337_original.html',
            details: '1337 website monitoring started successfully'
        };

        await sendAllNotifications(startInfo, this.whatsappBot.sock, this.whatsappBot.isConnected);
    }

    async sendStopNotification() {
        const stopInfo = {
            type: 'Monitoring Stopped',
            timestamp: getTimestamp(),
            attempt: 'final',
            savedFile: 'N/A',
            details: '1337 website monitoring stopped.'
        };
        await sendAllNotifications(stopInfo, this.whatsappBot.sock, this.whatsappBot.isConnected);
    }

    async sendErrorNotification(errorInfo) {
        await sendAllNotifications(errorInfo, this.whatsappBot.sock, this.whatsappBot.isConnected);
    }

    async sendChangeNotifications(changeInfo) {
        try {
            logHelper.notification('Sending change notifications...');
            // Only call sendAllNotifications ONCE per event; notification.js handles repeats for other channels
            await sendAllNotifications(changeInfo, this.whatsappBot.sock, this.whatsappBot.isConnected);
        } catch (error) {
            logHelper.error('Error sending change notifications:', error);
        }
    }

    async cleanup() {
        this.isRunning = false;
        if (this.browser) {
            try {
                await this.browser.close();
                logHelper.info('Browser closed');
            } catch (error) {
                logHelper.warn('Error closing browser:', error.message);
            }
        }
    }

    stop() {
        logHelper.monitoring('Stopping website monitoring...');
        this.isRunning = false;
    }
}

// ==================== WHATSAPP BOT CLASS ====================

class WhatsAppBot {
    constructor() {
        this.sock = null;
        this.isConnected = false;
        this.monitor = null;
        this.adminNumbers = CONFIG.WHATSAPP.ADMIN_NUMBERS;
        this.groupIds = CONFIG.WHATSAPP.GROUP_IDS;
    }

    async start() {
        try {
            logHelper.whatsapp('Starting WhatsApp bot...');
            await this.connectToWhatsApp();
        } catch (error) {
            logHelper.error('Failed to start WhatsApp bot:', error);
        }
    }

    async connectToWhatsApp() {
        logHelper.whatsapp('connectToWhatsApp() called');
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(CONFIG.WHATSAPP.SESSION_DIR);

        logHelper.whatsapp('Creating WhatsApp socket...');
        this.sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            auth: state,
            browser: ['Chrome (Linux)', '', ''],
        });
        logHelper.whatsapp('WhatsApp socket created.');

        this.sock.ev.on('creds.update', saveCreds);
        this.sock.ev.on('connection.update', (update) => {
            console.log('connection.update event:', update);
            if (update.qr) {
                qrcode.generate(update.qr, { small: true });
                console.log('Scan the QR code above with WhatsApp.');
            }
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                this.isConnected = false;
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;

                logHelper.whatsapp('Connection closed:', lastDisconnect?.error?.message || lastDisconnect?.error);

                if (shouldReconnect && CONFIG.WHATSAPP.AUTO_RECONNECT) {
                    logHelper.whatsapp('Reconnecting to WhatsApp...');
                    setTimeout(() => this.connectToWhatsApp(), CONFIG.WHATSAPP.RECONNECT_DELAY);
                } else {
                    logHelper.error('Logged out from WhatsApp. Restart bot and scan new QR code.');
                    process.exit(1);
                }
            } else if (connection === 'open') {
                this.isConnected = true;
                logHelper.success('✅ Connected to WhatsApp successfully!');
                logHelper.whatsapp('🤖 Bot ready to receive commands...');
            }
        });
        this.sock.ev.on('messages.upsert', this.handleIncomingMessages.bind(this));
    }

    async handleIncomingMessages(messageUpdate) {
        const { messages } = messageUpdate;

        for (const message of messages) {
            if (message.key.fromMe || !message.message) continue;

            const messageText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
            const senderJid = message.key.remoteJid;
            const isGroup = senderJid.endsWith('@g.us');
            const actualSender = isGroup ? message.key.participant : senderJid;

            if (!this.adminNumbers.includes(actualSender)) continue;

            if (messageText.toLowerCase().startsWith('/')) {
                await this.handleCommand(messageText, senderJid);
            }
        }
    }

    async handleCommand(command, senderJid) {
        const commandLower = command.toLowerCase();
        
        try {
            if (commandLower === '/help') {
                const helpText = `🤖 *1337 Monitoring Bot Commands*

📋 *Available Commands:*
• /help - Show this help message
• /status - Check bot and monitoring status
• /keyword <text> - Search for keywords in saved HTML files
• /كلمة <text> - Search for keywords (Arabic)
• /groupid - Get current group ID
• /stop - Stop monitoring
• /start - Start monitoring

📝 *Examples:*
• /keyword piscine
• /كلمة اختبار
• /status

🔧 *Bot Status:* ${this.isConnected ? '✅ Connected' : '❌ Disconnected'}
📊 *Monitoring:* ${this.monitor?.isRunning ? '🟢 Running' : '🔴 Stopped'}

---
🤖 1337 Automated Monitoring System`;

                await this.sock.sendMessage(senderJid, { text: helpText });
                
            } else if (commandLower === '/status') {
                const statusText = `📊 *1337 Monitoring Bot Status*

🔗 *Connection Status:* ${this.isConnected ? '✅ Connected' : '❌ Disconnected'}
📈 *Monitoring Status:* ${this.monitor?.isRunning ? '🟢 Running' : '🔴 Stopped'}

⏰ *Start Time:* ${this.monitor?.startTime ? this.monitor.startTime.toLocaleString() : 'N/A'}
🔄 *Attempt Count:* ${this.monitor?.attemptCount || 0}
📅 *Last Change:* ${this.monitor?.lastChangeTime ? this.monitor.lastChangeTime.toLocaleString() : 'N/A'}

👥 *Admin Numbers:* ${this.adminNumbers.length}
📱 *Group IDs:* ${this.groupIds.length}

---
🤖 1337 Automated Monitoring System`;

                await this.sock.sendMessage(senderJid, { text: statusText });
                
            } else if (commandLower.startsWith('/keyword ') || commandLower.startsWith('/كلمة ')) {
                const keyword = commandLower.startsWith('/keyword ') 
                    ? command.slice(9).trim() 
                    : command.slice(7).trim();
                
                if (!keyword) {
                    await this.sock.sendMessage(senderJid, { 
                        text: '⚠️ Please provide a keyword after the command.\nExample: /keyword piscine' 
                    });
                    return;
                }
                await this.searchKeywordAndReply(keyword, senderJid);
                
            } else if (commandLower === '/groupid') {
                const groupId = senderJid.endsWith('@g.us') ? senderJid : 'Not in a group';
                await this.sock.sendMessage(senderJid, { 
                    text: `📱 *Group ID:* ${groupId}` 
                });
                
            } else if (commandLower === '/stop') {
                if (this.monitor) {
                    this.monitor.stop();
                    await this.sock.sendMessage(senderJid, { 
                        text: '🛑 Monitoring stopped successfully.' 
                    });
                } else {
                    await this.sock.sendMessage(senderJid, { 
                        text: '⚠️ No monitoring session active.' 
                    });
                }
                
            } else if (commandLower === '/start') {
                if (this.monitor && !this.monitor.isRunning) {
                    this.monitor.startMonitoring();
                    await this.sock.sendMessage(senderJid, { 
                        text: '🚀 Monitoring started successfully.' 
                    });
                } else {
                    await this.sock.sendMessage(senderJid, { 
                        text: '⚠️ Monitoring is already running or not initialized.' 
                    });
                }
                
            } else {
                await this.sock.sendMessage(senderJid, { 
                    text: '❓ Unknown command. Use /help to see available commands.' 
                });
            }
            
        } catch (error) {
            logHelper.error('Error handling command:', error);
            await this.sock.sendMessage(senderJid, { 
                text: '❌ Error processing command. Please try again.' 
            });
        }
    }

    async searchKeywordAndReply(keyword, chatId) {
        const htmlDir = CONFIG.MONITORING.SAVE_DIR;
        try {
            const latestFile = getLatestHtmlFile(htmlDir);

            if (!latestFile) {
                await this.sock.sendMessage(chatId, { 
                    text: '⚠️ No saved HTML files found.' 
                });
                return;
            }

            const htmlContent = fs.readFileSync(latestFile, 'utf-8');
            const $ = cheerio.load(htmlContent);
            const lowerKeyword = keyword.toLowerCase();

            let matchedTexts = [];
            let searchRoot = $('main');
            if (searchRoot.length === 0) {
                searchRoot = $('body'); // fallback if <main> not found
            }

            // Collect texts containing the keyword only from main content
            searchRoot.find('*').each((i, el) => {
                const text = $(el).text().trim();
                if (text.length > 5 && text.toLowerCase().includes(lowerKeyword)) {
                    matchedTexts.push(text);
                }
            });

            if (matchedTexts.length === 0) {
                await this.sock.sendMessage(chatId, { 
                    text: `❌ Keyword "${keyword}" not found in latest HTML file.` 
                });
            } else {
                const maxResults = 5;
                const responseText = matchedTexts.slice(0, maxResults).join('\n\n');
                await this.sock.sendMessage(chatId, {
                    text: `✅ Found "${keyword}" in latest HTML file:\n\n${responseText}`,
                    content: `<@&${process.env.DISCORD_ROLE_ID || 'everyone'}> 1337 Website Alert!`
                });
            }
        } catch (err) {
            logHelper.error('Error in keyword search:', err);
            await this.sock.sendMessage(chatId, { 
                text: `❌ Error during search: ${err.message}`,
                content: `<@&${process.env.DISCORD_ROLE_ID || 'everyone'}> 1337 Website Alert!`
            });
        }
    }
}

// ==================== MAIN FUNCTION ====================

async function main() {
    console.log('Main function started');
    try {
        ensureDirectories();
        // Start WhatsApp bot
        const whatsappBot = new WhatsAppBot();
        await whatsappBot.start();
        // Wait for WhatsApp connection
        let attempts = 0;
        while (!whatsappBot.isConnected && attempts < 60) {
            await new Promise(r => setTimeout(r, 5000));
            attempts++;
            console.log(`Waiting for WhatsApp connection... (${attempts}/60)`);
        }
        if (!whatsappBot.isConnected) {
            console.error('WhatsApp connection timeout. Please scan the QR code and restart the bot.');
            process.exit(1);
        }
        // Start monitoring
        const monitor = new Website1337Monitor(whatsappBot);
        whatsappBot.monitor = monitor;
        await monitor.startMonitoring();
    } catch (err) {
        console.error('Fatal error in main:', err);
        process.exit(1);
    }
}

main();


