const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function getReelUrls(page, instagramUsername, maxReels = 5) {
    await page.goto(`https://www.instagram.com/${instagramUsername}/reels/`);
    await page.waitForSelector('article a', { timeout: 5000 });

    let reelUrls = [];
    let previousHeight;

    while (reelUrls.length < maxReels) {
        const newUrls = await page.evaluate(() => {
            const links = document.querySelectorAll('article a');
            return Array.from(links).map(link => link.href);
        });

        reelUrls = [...new Set([...reelUrls, ...newUrls])];

        if (reelUrls.length >= maxReels) break;

        previousHeight = await page.evaluate('document.body.scrollHeight');
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`);
        await page.waitForTimeout(1000);
    }

    return reelUrls.slice(0, maxReels);
}

async function downloadReel(page, reelUrl, downloadFolder) {
    // Navigate to the downloader website
    await page.goto('https://fastdl.app/en');

    // Find the input field and submit button
    const inputField = await page.$('#search-form-input'); // Replace with actual input field selector
    // const submitButton = await page.$('#submit-button'); // Replace with actual submit button selector

    // Enter the reel URL and submit
    await inputField.type(reelUrl);
    // await submitButton.click();

    // Wait for the download button to appear
    try {
        await page.waitForSelector('.button__download', { timeout: 15000 }); // Replace with actual download button selector
        const downloadButton = await page.$('.button__download');
        
        // Setup download behavior
        await page._client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadFolder
        });

        // Click download button
        await downloadButton.click();

        // Wait for download to complete (this may vary depending on the site)
        await page.waitForTimeout(10000); // Adjust as needed

        console.log(`Downloaded reel: ${reelUrl}`);
    } catch (error) {
        console.error(`Error downloading reel ${reelUrl}: ${error.message}`);
    }
}

async function processInstagramUser(instagramUsername, downloadFolder, maxReels = 5) {
    const browser = await puppeteer.launch({ headless: false }); // Set headless: true for production
    const page = await browser.newPage();

    try {
        const reelUrls = await getReelUrls(page, instagramUsername, maxReels);
        console.log(`Found ${reelUrls.length} reel URLs`);

        for (const reelUrl of reelUrls) {
            await downloadReel(page, reelUrl, downloadFolder);
        }
    } finally {
        await browser.close();
    }
}

const instagramUsername = 'virat.kohli';
const downloadFolder = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadFolder)) {
    fs.mkdirSync(downloadFolder);
}

const maxReels = 1;

processInstagramUser(instagramUsername, downloadFolder, maxReels).catch(console.error);