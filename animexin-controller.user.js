// ==UserScript==
// @name         AnimeXin Player Controller
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Automate intro/outro skipping and episode navigation for AnimeXin Dailymotion players
// @author       You
// @match        https://animexin.dev/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    /**
     * AnimeXin Player Controller - Tampermonkey Userscript
     * Handles Dailymotion player automation for intro/outro skipping and episode navigation
     */

    // Add CSS styles
    GM_addStyle(`
        #animexin-floating-ui {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 300px;
            background: rgba(26, 26, 26, 0.95);
            border: 2px solid #667eea;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(10px);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #ffffff;
            transition: all 0.3s ease;
            overflow: hidden;
        }

        #animexin-floating-ui:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6);
        }

        .animexin-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
        }

        .animexin-header span {
            font-weight: 600;
            font-size: 14px;
        }

        .animexin-close {
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background-color 0.2s ease;
        }

        .animexin-close:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        .animexin-content {
            padding: 20px;
        }

        .animexin-input-group {
            margin-bottom: 20px;
        }

        .animexin-input-group label {
            display: block;
            margin-bottom: 8px;
            font-size: 13px;
            font-weight: 500;
            color: #e0e0e0;
        }

        .animexin-input-group input {
            width: 100%;
            padding: 10px;
            border: 2px solid #333;
            border-radius: 8px;
            background: #2a2a2a;
            color: #ffffff;
            font-size: 13px;
            box-sizing: border-box;
            transition: border-color 0.3s ease;
        }

        .animexin-input-group input:focus {
            outline: none;
            border-color: #667eea;
        }

        .animexin-input-group input::-webkit-outer-spin-button,
        .animexin-input-group input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }

        .animexin-save-btn {
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            margin-bottom: 15px;
        }

        .animexin-save-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }

        .animexin-save-btn:active {
            transform: translateY(0);
        }

        .animexin-next-btn {
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            text-align: center;
            transition: all 0.2s ease;
        }

        .animexin-next-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 5px 15px rgba(76, 175, 80, 0.4);
        }

        @media (max-width: 768px) {
            #animexin-floating-ui {
                top: 10px;
                right: 10px;
                left: 10px;
                width: auto;
            }
        }

        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }

        .animexin-next-btn {
            animation: pulse 2s infinite;
        }
    `);

    class AnimeXinPlayerController {
        constructor() {
            this.currentSeries = this.getCurrentSeries();
            this.player = null;
            this.playerFrame = null;
            this.html5Video = null;
            this.isPlaying = false;
            this.currentTime = 0;
            this.duration = 0;
            this.introSkipStart = 0; // seconds or parsed from mm:ss
            this.outroSkipDuration = 0; // fallback seconds
            this.outroStartSeconds = 0; // preferred explicit start
            this.retryCount = 0;
            this.maxRetries = 5;
            this.retryDelay = 1000;
            this.nextEpisodeLink = null;
            this.floatingUI = null;
            this.playerReady = false;
            this.serverPreferAttempted = false;
            this.userServerOverride = false;
            
            this.init();
        }

        /**
         * Initialize the controller
         */
        async init() {
            try {
                // Load settings from Tampermonkey storage
                await this.loadSettings();
                
                // Find and setup player
                await this.findPlayer();
                
                // Create floating UI
                this.createFloatingUI();
                
                // Start monitoring
                this.startMonitoring();
                
                console.log('AnimeXin Player Controller initialized');
            } catch (error) {
                console.error('Failed to initialize controller:', error);
            }
        }

        /**
         * Get current anime series from URL
         */
        getCurrentSeries() {
            try {
                const path = (new URL(window.location.href)).pathname.replace(/^\/+|\/+$/g, '');
                const base = path.split('/')[0];
                const idx = base.indexOf('-episode-');
                return idx > 0 ? base.substring(0, idx) : base;
            } catch (e) { return 'unknown'; }
        }

        /**
         * Load settings from Tampermonkey storage
         */
        async loadSettings() {
            try {
                const settings = GM_getValue(`animexin_${this.currentSeries}`);
                if (settings) {
                    this.introSkipStart = Number(settings.introSkipStart) || 0;
                    this.outroSkipDuration = Number(settings.outroSkipDuration) || 0;
                    this.outroStartSeconds = Number(settings.outroStartSeconds) || 0;
                }
            } catch (error) {
                console.error('Failed to load settings:', error);
            }
        }

        /**
         * Save settings to Tampermonkey storage
         */
        async saveSettings() {
            try {
                const settings = {
                    introSkipStart: this.introSkipStart,
                    outroSkipDuration: this.outroSkipDuration,
                    outroStartSeconds: this.outroStartSeconds,
                    timestamp: Date.now()
                };
                GM_setValue(`animexin_${this.currentSeries}`, settings);
                console.log('Settings saved for series:', this.currentSeries);
            } catch (error) {
                console.error('Failed to save settings:', error);
            }
        }

        /**
         * Find Dailymotion player iframe
         */
        async findPlayer() {
            return new Promise((resolve, reject) => {
                const maxAttempts = 60;
                let attempts = 0;

                const findPlayerInterval = setInterval(() => {
                    attempts++;
                    // Prefer servers while waiting
                    this.tryPreferServer();
                    // Look for DM iframe or HTML5 video
                    this.playerFrame = document.querySelector('iframe[src*="dailymotion"]');
                    this.html5Video = document.querySelector('.player .video_view video, video#video');

                    if (this.playerFrame || this.html5Video) {
                        clearInterval(findPlayerInterval);
                        this.setupPlayer();
                        resolve();
                    } else if (attempts >= maxAttempts) {
                        clearInterval(findPlayerInterval);
                        reject(new Error('Player not found after maximum attempts'));
                    }
                }, 200);
            });
        }

        /**
         * Setup player event listeners and communication
         */
        setupPlayer() {
            // Listen for messages from Dailymotion player
            if (this.playerFrame) {
                window.addEventListener('message', this.handlePlayerMessage.bind(this));
                this.playerFrame.addEventListener('load', () => {
                    this.playerReady = true;
                    this.attachPlayerListeners();
                });
                if (this.playerFrame.contentWindow) { this.playerReady = true; this.attachPlayerListeners(); }
            }
            // HTML5 fallback
            if (this.html5Video) {
                const v = this.html5Video;
                v.addEventListener('play', () => this.handlePlay());
                v.addEventListener('pause', () => this.handlePause());
                v.addEventListener('timeupdate', () => this.handleTimeUpdate({ currentTime: v.currentTime }));
                v.addEventListener('durationchange', () => this.handleDurationChange({ duration: v.duration }));
                v.addEventListener('ended', () => this.handleEnded());
                if (!isNaN(v.duration)) this.duration = v.duration;
                this.playerReady = true;
            }
            // Find next episode link
            this.findNextEpisodeLink();
            // Poll loop
            setInterval(() => {
                if (!this.playerReady) return;
                if (this.playerFrame && this.isPlaying) this.sendPlayerCommand('get_current_time');
                if (this.html5Video && this.isPlaying) this.currentTime = this.html5Video.currentTime || 0;
                this.checkOutroSkip();
            }, 1000);
        }

        /**
         * Find next episode link
         */
        findNextEpisodeLink() {
            this.nextEpisodeLink = document.querySelector('a[rel="next"]');
            if (!this.nextEpisodeLink) {
                console.log('No next episode link found, will show floating button');
            }
        }

        /**
         * Attach event listeners to player
         */
        attachPlayerListeners() {
            try {
                this.sendPlayerCommand('get_duration');
                this.sendPlayerCommand('get_player_state');
                this.monitorPlayerState();
            } catch (error) {
                console.error('Failed to attach player listeners:', error);
                this.retryWithBackoff(() => this.attachPlayerListeners());
            }
        }

        /**
         * Monitor player state changes
         */
        monitorPlayerState() {
            // Check player state every second
            setInterval(() => {
                if (this.playerFrame && this.isPlaying) {
                    this.sendPlayerCommand('get_current_time');
                }
            }, 1000);
        }

        /**
         * Handle messages from Dailymotion player
         */
        handlePlayerMessage(event) {
            try {
                const { origin, data } = event;
                
                // Verify origin is from Dailymotion
                if (!origin.includes('dailymotion')) return;
                
                if (data && typeof data === 'object') {
                    this.handlePlayerEvent(data);
                }
            } catch (error) {
                console.error('Error handling player message:', error);
            }
        }

        /**
         * Handle player events
         */
        handlePlayerEvent(event) {
            switch (event.event) {
                case 'play':
                    this.handlePlay();
                    break;
                case 'pause':
                    this.handlePause();
                    break;
                case 'timeupdate':
                    this.handleTimeUpdate(event.data);
                    break;
                case 'durationchange':
                    this.handleDurationChange(event.data);
                    break;
                case 'ended':
                    this.handleEnded();
                    break;
                case 'current_time':
                    this.currentTime = event.data || 0;
                    this.checkOutroSkip();
                    break;
                case 'duration':
                    this.duration = event.data || 0;
                    break;
                case 'player_state':
                    this.handlePlayerState(event.data);
                    break;
            }
        }

        /**
         * Handle play event
         */
        handlePlay() {
            this.isPlaying = true;
            console.log('Player started playing');
            
            // Request fullscreen
            this.requestFullscreen();
            
            // Skip intro if configured
            if (this.introSkipStart > 0) {
                setTimeout(() => {
                    this.seekTo(this.introSkipStart);
                }, 500);
            }
        }

        /**
         * Handle pause event
         */
        handlePause() {
            this.isPlaying = false;
            console.log('Player paused');
        }

        /**
         * Handle time update
         */
        handleTimeUpdate(data) {
            if (data && data.currentTime !== undefined) {
                this.currentTime = data.currentTime;
                this.checkOutroSkip();
            }
        }

        /**
         * Handle duration change
         */
        handleDurationChange(data) {
            if (data && data.duration !== undefined) {
                this.duration = data.duration;
            }
        }

        /**
         * Handle player ended
         */
        handleEnded() {
            console.log('Player ended, navigating to next episode');
            this.navigateToNextEpisode();
        }

        /**
         * Handle player state
         */
        handlePlayerState(state) {
            if (state && state.isPlaying !== undefined) {
                this.isPlaying = state.isPlaying;
            }
        }

        /**
         * Check if we should skip outro
         */
        checkOutroSkip() {
            if (!this.duration) return;
            const outroStart = this.outroStartSeconds > 0 ? this.outroStartSeconds : (this.outroSkipDuration > 0 ? (this.duration - this.outroSkipDuration) : 0);
            if (outroStart > 0 && this.currentTime >= (outroStart - 0.35)) {
                this.navigateToNextEpisode();
            }
        }

        /**
         * Navigate to next episode
         */
        navigateToNextEpisode() {
            if (this.nextEpisodeLink) {
                console.log('Navigating to next episode:', this.nextEpisodeLink.href);
                window.location.href = this.nextEpisodeLink.href;
            } else {
                this.showNextEpisodeButton();
            }
        }

        /**
         * Show floating next episode button
         */
        showNextEpisodeButton() {
            if (this.floatingUI) {
                this.floatingUI.showNextEpisodeButton();
            }
        }

        /**
         * Send command to Dailymotion player
         */
        sendPlayerCommand(command, data = null) {
            if (this.playerFrame && this.playerFrame.contentWindow) {
                try {
                    this.playerFrame.contentWindow.postMessage({ command, data }, '*');
                } catch (error) {
                    console.error('Failed to send player command:', error);
                    this.retryWithBackoff(() => this.sendPlayerCommand(command, data));
                }
                return;
            }
            // HTML5
            if (!this.html5Video) return;
            try {
                if (command === 'seek' && data && typeof data.time === 'number') this.html5Video.currentTime = data.time;
                if (command === 'play') this.html5Video.play().catch(() => {});
                if (command === 'pause') this.html5Video.pause();
            } catch (e) {}
        }

        /**
         * Seek to specific time
         */
        seekTo(time) {
            console.log('Seeking to:', time);
            this.sendPlayerCommand('seek', { time: time });
        }

        /**
         * Request fullscreen
         */
        requestFullscreen() {
            try {
                const el = this.playerFrame || this.html5Video;
                if (!el) return;
                if (el.requestFullscreen) el.requestFullscreen();
                else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
            } catch (error) {
                console.error('Failed to request fullscreen:', error);
            }
        }

        /**
         * Retry operation with exponential backoff
         */
        retryWithBackoff(operation) {
            if (this.retryCount >= this.maxRetries) {
                console.error('Max retries reached for operation');
                return;
            }

            this.retryCount++;
            const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);
            
            setTimeout(() => {
                try {
                    operation();
                } catch (error) {
                    console.error('Retry operation failed:', error);
                    this.retryWithBackoff(operation);
                }
            }, delay);
        }

        /**
         * Create floating UI
         */
        createFloatingUI() {
            this.floatingUI = new FloatingUI(this);
        }

        /**
         * Start monitoring for changes
         */
        startMonitoring() {
            // Monitor for dynamic content changes
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        // Prefer server when dropdown appears
                        this.tryPreferServer();
                        // Re-attach to new player
                        const dm = document.querySelector('iframe[src*="dailymotion"]');
                        const vid = document.querySelector('.player .video_view video, video#video');
                        if (dm && dm !== this.playerFrame) { this.playerFrame = dm; this.html5Video = null; this.setupPlayer(); }
                        else if (vid && vid !== this.html5Video) { this.html5Video = vid; this.playerFrame = null; this.setupPlayer(); }
                    }
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        /**
         * Update settings
         */
        updateSettings(introSkipStart, outroSkipDuration, outroStartSeconds) {
            this.introSkipStart = Number(introSkipStart) || 0;
            this.outroSkipDuration = Number(outroSkipDuration) || 0;
            this.outroStartSeconds = Number(outroStartSeconds) || 0;
            this.saveSettings();
            
            if (this.floatingUI) {
                this.floatingUI.updateSettings(this.introSkipStart, this.outroSkipDuration, this.outroStartSeconds);
            }
        }

        /** Prefer server: EN Dailymotion > EN Ok.ru */
        tryPreferServer() {
            const select = document.querySelector('select.mirror');
            if (!select || this.serverPreferAttempted || this.userServerOverride) return;
            if (!select.__animexinBound) {
                select.addEventListener('change', () => { if (!this.serverPreferAttempted) this.userServerOverride = true; }, false);
                select.__animexinBound = true;
            }
            const opts = Array.from(select.options || []);
            const norm = (t) => String(t || '').toLowerCase();
            let preferred = opts.find(o => norm(o.textContent).includes('hardsub english dailymotion'));
            if (!preferred) preferred = opts.find(o => { const t = norm(o.textContent); return t.includes('hardsub english') && (t.includes('ok.ru') || t.includes('ok')); });
            if (preferred && preferred !== select.selectedOptions[0]) {
                select.value = preferred.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }
            this.serverPreferAttempted = true;
        }
    }

    /**
     * Floating UI class for settings and controls
     */
    class FloatingUI {
        constructor(controller) {
            this.controller = controller;
            this.element = null;
            this.createUI();
        }

        /**
         * Create floating UI element
         */
        createUI() {
            this.element = document.createElement('div');
            this.element.id = 'animexin-floating-ui';
            this.element.innerHTML = `
                <div class="animexin-header">
                    <span>AnimeXin (${this.controller.currentSeries})</span>
                    <button class="animexin-close" onclick="this.parentElement.parentElement.style.display='none'">×</button>
                </div>
                <div class="animexin-content">
                    <div class="animexin-input-group">
                        <label>Intro Start (mm:ss)</label>
                        <input type="text" id="intro-skip-start" placeholder="e.g., 1:30" value="${this.formatTime(this.controller.introSkipStart)}">
                    </div>
                    <div class="animexin-input-group">
                        <label>Outro Start (mm:ss)</label>
                        <input type="text" id="outro-start" placeholder="e.g., 17:49" value="${this.formatTime(this.controller.outroStartSeconds)}">
                    </div>
                    <button id="save-settings" class="animexin-save-btn">Save Settings</button>
                    <div id="next-episode-btn" class="animexin-next-btn" style="display: none;">Next Episode</div>
                </div>
            `;

            document.body.appendChild(this.element);
            this.attachEventListeners();
        }

        /**
         * Attach event listeners
         */
        attachEventListeners() {
            const saveBtn = this.element.querySelector('#save-settings');
            const introInput = this.element.querySelector('#intro-skip-start');
            const outroStartInput = this.element.querySelector('#outro-start');
            const nextEpisodeBtn = this.element.querySelector('#next-episode-btn');

            saveBtn.addEventListener('click', () => {
                const introSeconds = this.parseTimeToSeconds(introInput.value);
                const outroStartSeconds = this.parseTimeToSeconds(outroStartInput.value);
                this.controller.updateSettings(introSeconds, this.controller.outroSkipDuration, outroStartSeconds);
            });

            nextEpisodeBtn.addEventListener('click', () => {
                this.controller.navigateToNextEpisode();
            });
        }

        /**
         * Update settings display
         */
        updateSettings(introSkipStart, _outroSkipDuration, outroStartSeconds) {
            const introInput = this.element.querySelector('#intro-skip-start');
            const outroStartInput = this.element.querySelector('#outro-start');
            if (introInput) introInput.value = this.formatTime(introSkipStart);
            if (outroStartInput) outroStartInput.value = this.formatTime(outroStartSeconds);
        }

        parseTimeToSeconds(value) {
            if (!value) return 0;
            if (/^\d+$/.test(value)) return Number(value);
            const parts = String(value).trim().split(':');
            if (parts.length === 2) {
                const m = Number(parts[0]) || 0; const s = Number(parts[1]) || 0; return m * 60 + s;
            } else if (parts.length === 3) {
                const h = Number(parts[0]) || 0; const m = Number(parts[1]) || 0; const s = Number(parts[2]) || 0; return h * 3600 + m * 60 + s;
            }
            return 0;
        }

        formatTime(seconds) {
            const s = Math.max(0, Math.floor(Number(seconds) || 0));
            const m = Math.floor(s / 60);
            const ss = String(s % 60).padStart(2, '0');
            return `${m}:${ss}`;
        }

        /**
         * Show next episode button
         */
        showNextEpisodeButton() {
            const nextEpisodeBtn = this.element.querySelector('#next-episode-btn');
            if (nextEpisodeBtn) {
                nextEpisodeBtn.style.display = 'block';
            }
        }
    }

    // Initialize controller when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new AnimeXinPlayerController();
        });
    } else {
        new AnimeXinPlayerController();
    }
})();
