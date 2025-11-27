#!/usr/bin/env node
/**
 * Offline PPO training runner for Asteroid Droid.
 *
 * Spins up a local static server, launches headless Chromium via Puppeteer,
 * toggles the in-game autopilot (which continues training), and monitors
 * progress until the target score is achieved. When finished, it exports
 * the trained weights to pretrained_model.json so the browser build can
 * load the stronger agent immediately.
 */

const path = require('path');
const fs = require('fs');
const express = require('express');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname);
const PORT = parseInt(process.env.OFFLINE_TRAIN_PORT || '4173', 10);
const TARGET_SCORE = parseInt(process.env.TARGET_SCORE || '3500', 10);
const MAX_EPISODES = parseInt(process.env.MAX_EPISODES || '6000', 10);
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);
const OUTPUT_PATH = path.resolve(process.env.OUTPUT_PATH || path.join(ROOT, 'pretrained_model.json'));
const SPEED_MULTIPLIER = parseFloat(process.env.SPEED_MULTIPLIER || '10'); // Increased default speed
const OBSERVER_PORT = parseInt(process.env.OBSERVER_PORT || '4174', 10);
const ENABLE_OBSERVER = process.env.ENABLE_OBSERVER !== '0'; // Default to enabled

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function startServer() {
    const app = express();
    app.use(express.static(ROOT));
    
    return new Promise(resolve => {
        const server = app.listen(PORT, () => {
            console.log(`[server] Serving Asteroid Droid on http://localhost:${PORT}`);
            console.log(`[server] Observer mode: http://localhost:${PORT}/index.html?offline=1&observe=1`);
            resolve(server);
        });
    });
}

async function main() {
    const server = await startServer();
    let browser;
    let observerBrowser = null;
    
    // Start observer window if enabled (default: yes)
    if (ENABLE_OBSERVER) {
        try {
            observerBrowser = await puppeteer.launch({
                headless: false,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                timeout: 60000
            });
            const observerPage = await observerBrowser.newPage();
            await observerPage.goto(`http://localhost:${PORT}/index.html?offline=1&observe=1`, { waitUntil: 'networkidle2', timeout: 30000 });
            console.log(`[observer] Observer window opened (does not slow down training)`);
            console.log(`[observer] You can also open http://localhost:${PORT}/index.html?offline=1&observe=1 in your browser`);
        } catch (err) {
            console.warn(`[observer] Failed to open observer window: ${err.message}`);
            console.log(`[observer] You can manually open http://localhost:${PORT}/index.html?offline=1&observe=1 in your browser`);
        }
    }
    
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-gpu', '--disable-setuid-sandbox'],
            timeout: 60000
        });
        
        const page = await browser.newPage();
        const targetUrl = `http://localhost:${PORT}/index.html?offline=1&headless=1&speed=${SPEED_MULTIPLIER}`;
        console.log(`[trainer] Launching headless training client (${SPEED_MULTIPLIER}x speed)`);
        console.log(`[trainer] Training runs in background - observer window shows progress without slowing it down`);
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        
        await page.waitForFunction(() => window.offlineAPIReady === true, { timeout: 60000 });
        console.log('[trainer] Offline API ready, enabling autopilot training...');
        await page.evaluate(() => {
            window.offlineAPI.ensureAutopilot();
            return true;
        });
        
        let bestScore = 0;
        let episode = 0;
        while (bestScore < TARGET_SCORE && episode < MAX_EPISODES) {
            await delay(POLL_INTERVAL);
            const stats = await page.evaluate(() => window.offlineAPI.getTrainingStats());
            episode = stats.episode || 0;
            bestScore = stats.bestScore || 0;
            const avgReward = Number(stats.avgReward || 0).toFixed(2);
            console.log(`[trainer] Episode ${episode.toString().padStart(4, ' ')} | Best ${bestScore} | Last ${stats.lastScore || 0} | AvgReward ${avgReward}`);
        }
        
        if (bestScore >= TARGET_SCORE) {
            console.log(`[trainer] Target best score ${TARGET_SCORE}+ reached! Exporting model...`);
        } else {
            console.log('[trainer] Max episodes reached, exporting current best model...');
        }
        
        const modelPayload = await page.evaluate(() => window.offlineAPI.exportModel());
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(modelPayload, null, 2));
        console.log(`[trainer] Saved pretrained model to ${OUTPUT_PATH}`);
    } catch (error) {
        console.error('[trainer] Offline training failed:', error);
        process.exitCode = 1;
    } finally {
        if (browser) {
            await browser.close();
        }
        if (observerBrowser) {
            await observerBrowser.close();
        }
        server.close();
    }
}

main();

