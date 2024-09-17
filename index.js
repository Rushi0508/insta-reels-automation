const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getReelUrls(page, instagramUsername, maxReels = 5) {
    await page.goto(`https://www.instagram.com/${instagramUsername}/reels/`);
    await page.waitForSelector('a', { timeout: 50000 });

    let reelUrls = [];
    let previousHeight;

    while (reelUrls.length < maxReels) {
        const newUrls = await page.evaluate(() => {
            const links = document.querySelectorAll('a');
            return Array.from(links)
                .filter(link => link.href.includes('/reel/'))
                .map(link => link.href);
        });

        reelUrls = [...new Set([...reelUrls, ...newUrls])];

        if (reelUrls.length >= maxReels) break;

        previousHeight = await page.evaluate('document.body.scrollHeight');
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`);
        // await page.waitForTimeout(1000);
    }

    return reelUrls.slice(0, maxReels);
}

async function downloadFile(url, downloadFolder, caption, timestamp) {
    return new Promise((resolve, reject) => {
        const fileName = path.basename(new URL(url).pathname);
        const uniqueFolder = path.join(downloadFolder, timestamp.toString());

        fs.mkdirSync(uniqueFolder, { recursive: true });

        const videoFilePath = path.join(uniqueFolder, fileName);
        const file = fs.createWriteStream(videoFilePath);

        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                const captionFilePath = path.join(uniqueFolder, `${fileName}.txt`);
                fs.writeFile(captionFilePath, caption, (err) => {
                    if (err) reject(err);
                    resolve(videoFilePath);
                });
            });
        }).on('error', (err) => {
            fs.unlink(videoFilePath, () => reject(err));
        });
    });
}

async function downloadReel(page, reelUrl, downloadFolder) {
    await page.goto('https://fastdl.app/en');

    const inputField = await page.$('#search-form-input');
    const submitButton = await page.$('.search-form__button');

    await inputField.type(reelUrl);
    await submitButton.click();

    try {
        await page.waitForSelector('a.button.button--filled.button__download', { timeout: 30000 });

        const downloadUrl = await page.$eval('a.button.button--filled.button__download', el => el.href);
        const caption = await page.$eval('.output-list__caption', el => el.innerText);

        const timestamp = Date.now();
        const filePath = await downloadFile(downloadUrl, downloadFolder, caption, timestamp);

        console.log(`Downloaded reel: ${reelUrl} to ${filePath}`);
    } catch (error) {
        console.error(`Error downloading reel ${reelUrl}: ${error.message}`);
    }
}

async function processInstagramUser(instagramUsername, downloadFolder, maxReels = 5) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    try {
        const reelUrls = await getReelUrls(page, instagramUsername, maxReels);
        console.log(`Found ${reelUrls.length} reel URLs`);

        for (const reelUrl of reelUrls) {
            await downloadReel(page, reelUrl, downloadFolder);
            // await sleep(10000);
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

const maxReels = 2;

processInstagramUser(instagramUsername, downloadFolder, maxReels).catch(console.error);