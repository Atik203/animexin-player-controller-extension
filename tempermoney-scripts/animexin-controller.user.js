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
            width: 320px;
            max-width: calc(100vw - 40px);
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
            /* Performance optimizations */
            will-change: transform;
            contain: layout style paint;
            transform: translateZ(0);
            isolation: isolate;
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
            /* Performance optimization */
            will-change: transform;
            transform: translateZ(0);
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
            /* Performance optimization */
            will-change: transform;
            transform: translateZ(0);
        }

        .animexin-next-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 5px 15px rgba(76, 175, 80, 0.4);
        }

        /* Input performance optimization */
        .animexin-input-group input {
            contain: layout style;
        }

        /* Notification performance optimization */
        .animexin-notification {
            contain: layout style paint;
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
            
            // Performance optimization - track cleanup functions
            this.cleanupFunctions = [];
            
            this.init();
        }

        /**
         * Initialize the controller with performance monitoring
         */
        async init() {
            try {
                const startTime = performance.now();
                
                // Load settings from Tampermonkey storage
                await this.loadSettings();
                
                // Find and setup player
                await this.findPlayer();
                
                // Create floating UI
                this.createFloatingUI();
                
                // Start monitoring
                this.startMonitoring();
                
                // Setup cleanup on page unload
                this.setupCleanup();
                
                const endTime = performance.now();
                console.log(`AnimeXin Player Controller initialized in ${(endTime - startTime).toFixed(2)}ms`);
            } catch (error) {
                console.error('Failed to initialize controller:', error);
            }
        }

        /**
         * Setup cleanup for better memory management
         */
        setupCleanup() {
            const cleanup = () => {
                this.cleanupFunctions.forEach(fn => {
                    try { fn(); } catch (e) { console.warn('Cleanup error:', e); }
                });
            };
            
            window.addEventListener('beforeunload', cleanup, { passive: true });
            this.cleanupFunctions.push(() => {
                window.removeEventListener('beforeunload', cleanup);
            });
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
         * Enhanced player detection with performance optimization and caching
         */
        async findPlayer() {
            return new Promise((resolve, reject) => {
                const maxAttempts = 60;
                let attempts = 0;
                let lastQueryTime = 0;
                let cachedFrame = null;
                let cachedVideo = null;
                let rafId = null;

                const tick = () => {
                    attempts++;
                    
                    try {
                        this.tryPreferServer();
                        
                        // Cache DOM queries to reduce reflow - only query every 200ms
                        const now = performance.now();
                        if (now - lastQueryTime >= 200) {
                            // More targeted and efficient selectors
                            cachedFrame = document.querySelector('iframe[src*="dailymotion.com"]');
                            cachedVideo = document.querySelector('.player .video_view video') || 
                                         document.querySelector('video#video');
                            lastQueryTime = now;
                        }
                        
                        this.playerFrame = cachedFrame;
                        this.html5Video = cachedVideo;
                        
                        if (this.playerFrame || this.html5Video) {
                            if (rafId) cancelAnimationFrame(rafId);
                            this.setupPlayer();
                            resolve();
                            return;
                        }
                        
                        if (attempts >= maxAttempts) {
                            if (rafId) cancelAnimationFrame(rafId);
                            reject(new Error('Player not found after maximum attempts'));
                            return;
                        }
                        
                        // Use requestAnimationFrame for better performance timing
                        rafId = requestAnimationFrame(tick);
                    } catch (error) {
                        console.error('Player finding attempt failed:', error);
                        // Fallback to setTimeout with longer delay on error
                        setTimeout(tick, 500);
                    }
                };
                
                tick();
                
                // Add cleanup
                this.cleanupFunctions.push(() => {
                    if (rafId) cancelAnimationFrame(rafId);
                });
            });
        }

        /**
         * Enhanced player setup with performance optimization and passive listeners
         */
        setupPlayer() {
            try {
                this.findNextEpisodeLink();

                if (this.playerFrame) {
                    // Add accessibility attributes
                    this.playerFrame.setAttribute('aria-label', 'Video player');
                    this.playerFrame.setAttribute('role', 'application');
                    
                    const messageHandler = this.handlePlayerMessage.bind(this);
                    window.addEventListener('message', messageHandler, { passive: true });
                    
                    const loadHandler = () => {
                        this.playerReady = true;
                        this.attachPlayerListeners();
                    };
                    this.playerFrame.addEventListener('load', loadHandler, { passive: true });
                    
                    if (this.playerFrame.contentWindow) {
                        this.playerReady = true;
                        this.attachPlayerListeners();
                    }
                    
                    // Add cleanup
                    this.cleanupFunctions.push(() => {
                        window.removeEventListener('message', messageHandler);
                        this.playerFrame?.removeEventListener('load', loadHandler);
                    });
                }

                if (this.html5Video) {
                    // Add accessibility attributes
                    this.html5Video.setAttribute('aria-label', 'Anime episode video');
                    
                    const v = this.html5Video;
                    // Use passive listeners for all video events to improve scroll performance
                    const playHandler = () => this.handlePlay();
                    const pauseHandler = () => this.handlePause();
                    const timeHandler = () => this.handleTimeUpdate({ currentTime: v.currentTime });
                    const durationHandler = () => this.handleDurationChange({ duration: v.duration });
                    const endedHandler = () => this.handleEnded();
                    
                    v.addEventListener('play', playHandler, { passive: true });
                    v.addEventListener('pause', pauseHandler, { passive: true });
                    v.addEventListener('timeupdate', timeHandler, { passive: true });
                    v.addEventListener('durationchange', durationHandler, { passive: true });
                    v.addEventListener('ended', endedHandler, { passive: true });
                    
                    if (!isNaN(v.duration)) this.duration = v.duration;
                    this.playerReady = true;
                    
                    // Add cleanup
                    this.cleanupFunctions.push(() => {
                        v.removeEventListener('play', playHandler);
                        v.removeEventListener('pause', pauseHandler);
                        v.removeEventListener('timeupdate', timeHandler);
                        v.removeEventListener('durationchange', durationHandler);
                        v.removeEventListener('ended', endedHandler);
                    });
                }

                // Start optimized monitoring with requestAnimationFrame
                this.startPlayerMonitoring();
            } catch (error) {
                console.error('Player setup failed:', error);
            }
        }

        /**
         * Optimized player monitoring with better performance
         */
        startPlayerMonitoring() {
            let lastTime = 0;
            let rafId = null;
            let monitoringActive = true;
            
            const monitor = () => {
                if (!monitoringActive || !this.playerReady) {
                    if (monitoringActive) {
                        rafId = requestAnimationFrame(monitor);
                    }
                    return;
                }
                
                // More efficient throttling using performance.now()
                const now = performance.now();
                if (now - lastTime < 1000) { // Exactly 1 second throttle
                    rafId = requestAnimationFrame(monitor);
                    return;
                }
                lastTime = now;
                
                try {
                    // Batch DOM operations to avoid multiple reflows
                    if (this.playerFrame && this.isPlaying) {
                        this.sendPlayerCommand('get_current_time');
                    }
                    if (this.html5Video && this.isPlaying) {
                        this.currentTime = this.html5Video.currentTime || 0;
                    }
                    this.checkOutroSkip();
                } catch (error) {
                    console.error('Player monitoring failed:', error);
                }
                
                rafId = requestAnimationFrame(monitor);
            };

            // Use requestAnimationFrame for better performance
            rafId = requestAnimationFrame(monitor);
            
            // Cleanup
            this.cleanupFunctions.push(() => {
                monitoringActive = false;
                if (rafId) {
                    cancelAnimationFrame(rafId);
                }
            });
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
            } catch (error) {
                console.error('Failed to attach player listeners:', error);
                this.retryWithBackoff(() => this.attachPlayerListeners());
            }
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
         * Enhanced monitoring with performance optimization and throttling
         */
        startMonitoring() {
            try {
                let isProcessing = false;
                let pendingCheck = false;
                
                // Throttled mutation processing to avoid excessive DOM queries
                const processChanges = () => {
                    if (isProcessing) {
                        pendingCheck = true;
                        return;
                    }
                    
                    isProcessing = true;
                    pendingCheck = false;
                    
                    // Use requestAnimationFrame to batch DOM operations
                    requestAnimationFrame(() => {
                        try {
                            this.tryPreferServer();
                            
                            // Cache previous elements to avoid unnecessary queries
                            const dm = document.querySelector('iframe[src*="dailymotion"]');
                            const vid = document.querySelector('.player .video_view video, video#video');
                            
                            if (dm && dm !== this.playerFrame) {
                                this.playerFrame = dm;
                                this.html5Video = null;
                                this.setupPlayer();
                            } else if (vid && vid !== this.html5Video) {
                                this.html5Video = vid;
                                this.playerFrame = null;
                                this.setupPlayer();
                            }
                        } catch (error) {
                            console.error('DOM monitoring failed:', error);
                        } finally {
                            isProcessing = false;
                            if (pendingCheck) {
                                setTimeout(processChanges, 16); // ~60fps throttle
                            }
                        }
                    });
                };

                // Optimized MutationObserver with filtered targets
                const observer = new MutationObserver((mutations) => {
                    // More efficient filtering - only check relevant mutations
                    const hasRelevantChanges = mutations.some(mutation => {
                        if (mutation.type !== 'childList') return false;
                        
                        // Check if any added nodes might contain players
                        return Array.from(mutation.addedNodes).some(node => {
                            if (node.nodeType !== Node.ELEMENT_NODE) return false;
                            const el = node;
                            
                            // More specific checks to reduce false positives
                            return el.tagName === 'IFRAME' || 
                                   el.tagName === 'VIDEO' ||
                                   el.classList?.contains('player') ||
                                   el.querySelector?.('iframe[src*="dailymotion"], video');
                        });
                    });
                    
                    if (hasRelevantChanges) {
                        processChanges();
                    }
                });

                // More targeted observation to reduce mutation volume
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: false, // Reduce noise from attribute changes
                    characterData: false // Reduce noise from text changes
                });
                
                // Cleanup observer
                this.cleanupFunctions.push(() => {
                    observer.disconnect();
                });
                
            } catch (error) {
                console.error('Monitoring setup failed:', error);
            }
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

        /**
         * Enhanced server preference with better error handling and performance
         */
        tryPreferServer() {
            try {
                const select = document.querySelector('select.mirror');
                if (!select || this.serverPreferAttempted || this.userServerOverride) return;

                if (!select.__animexinBound) {
                    const changeHandler = () => {
                        if (!this.serverPreferAttempted) this.userServerOverride = true;
                    };
                    select.addEventListener('change', changeHandler, { passive: true, once: false });
                    select.__animexinBound = true;
                    
                    // Add cleanup
                    this.cleanupFunctions.push(() => {
                        select.removeEventListener('change', changeHandler);
                    });
                }

                const preferred = this.findPreferredOption(select);
                if (preferred && preferred !== select.selectedOptions[0]) {
                    select.value = preferred.value;
                    const evt = new Event('change', { bubbles: true });
                    select.dispatchEvent(evt);
                }
                this.serverPreferAttempted = true;
            } catch (error) {
                console.error('Server preference failed:', error);
            }
        }

        /**
         * Find preferred server option with enhanced validation
         */
        findPreferredOption(select) {
            try {
                const opts = Array.from(select.options || []);
                const norm = (text) => {
                    if (!text || typeof text !== 'string') return '';
                    return text.toLowerCase().replace(/\s+/g, ' ').trim();
                };

                // Priority 1: Hardsub English Dailymotion
                let match = opts.find(o => {
                    const text = norm(o.textContent);
                    return text.includes('hardsub') && text.includes('english') && text.includes('dailymotion');
                });
                
                if (match) return match;

                // Priority 2: Hardsub English Ok.ru
                match = opts.find(o => {
                    const text = norm(o.textContent);
                    return text.includes('hardsub') && text.includes('english') && 
                           (text.includes('ok.ru') || text.includes('ok'));
                });
                
                return match || null;
            } catch (error) {
                console.error('Server option finding failed:', error);
                return null;
            }
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
         * Create floating UI element with CSP compliance
         */
        createUI() {
            this.element = document.createElement('div');
            this.element.id = 'animexin-floating-ui';
            this.element.setAttribute('role', 'dialog');
            this.element.setAttribute('aria-labelledby', 'animexin-title');
            this.element.setAttribute('aria-describedby', 'animexin-description');
            
            this.element.innerHTML = `
                <div class="animexin-header" role="banner">
                    <span id="animexin-title" class="animexin-title">AnimeXin (${this.controller.currentSeries})</span>
                    <button class="animexin-close" type="button" aria-label="Close settings panel" title="Close">×</button>
                </div>
                <div class="animexin-content" role="main">
                    <p id="animexin-description" style="position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;">Configure intro and outro skip settings for ${this.controller.currentSeries}</p>
                    
                    <div class="animexin-input-group">
                        <label for="intro-skip-start">Intro Start (mm:ss)</label>
                        <input type="text" 
                               id="intro-skip-start" 
                               placeholder="e.g., 1:30" 
                               value="${this.formatTime(this.controller.introSkipStart)}"
                               aria-describedby="intro-help"
                               autocomplete="off">
                        <small id="intro-help" style="font-size: 11px; color: #888; margin-top: 4px; display: block;">Time to skip to when episode starts</small>
                    </div>
                    
                    <div class="animexin-input-group">
                        <label for="outro-start">Outro Start (mm:ss)</label>
                        <input type="text" 
                               id="outro-start" 
                               placeholder="e.g., 17:49" 
                               value="${this.formatTime(this.controller.outroStartSeconds)}"
                               aria-describedby="outro-help"
                               autocomplete="off">
                        <small id="outro-help" style="font-size: 11px; color: #888; margin-top: 4px; display: block;">Time when outro begins</small>
                    </div>
                    
                    <button id="save-settings" 
                            type="button" 
                            class="animexin-save-btn"
                            aria-describedby="save-help">Save Settings</button>
                    <small id="save-help" style="font-size: 11px; color: #888; margin-top: 4px; display: block;">Saves settings for ${this.controller.currentSeries} episodes</small>
                    
                    <button id="next-episode-btn" 
                            type="button" 
                            class="animexin-next-btn" 
                            style="display:none;"
                            aria-label="Go to next episode">Next Episode</button>
                    
                    <div id="notification" style="display:none; padding: 8px 12px; margin: 8px 0; border-radius: 6px; font-size: 12px; background: #1a4d2e; color: #4caf50; border: 1px solid #2d5f3f;" role="status" aria-live="polite"></div>
                </div>
            `;

            document.body.appendChild(this.element);
            this.attachEventListeners();
        }

        /**
         * Attach event listeners with CSP compliance and accessibility
         */
        attachEventListeners() {
            try {
                const saveBtn = this.element.querySelector('#save-settings');
                const introInput = this.element.querySelector('#intro-skip-start');
                const outroStartInput = this.element.querySelector('#outro-start');
                const nextBtn = this.element.querySelector('#next-episode-btn');
                const closeBtn = this.element.querySelector('.animexin-close');

                // CSP compliant event listeners (no onclick)
                if (saveBtn) {
                    saveBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.handleSave(introInput.value, outroStartInput.value);
                    });
                }

                if (nextBtn) {
                    nextBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.controller.navigateToNextEpisode();
                    });
                }

                if (closeBtn) {
                    closeBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.hide();
                    });
                }

                // Input validation on change
                [introInput, outroStartInput].forEach(input => {
                    if (input) {
                        input.addEventListener('input', (e) => {
                            this.validateTimeInput(e.target);
                        }, { passive: true });
                    }
                });

                // Keyboard navigation
                this.element.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        this.hide();
                    }
                }, { passive: true });

            } catch (error) {
                console.error('Event listener attachment failed:', error);
            }
        }

        /**
         * Handle save with validation
         */
        handleSave(introValue, outroValue) {
            try {
                const introSeconds = this.parseTimeToSeconds(introValue);
                const outroStartSeconds = this.parseTimeToSeconds(outroValue);
                
                this.controller.updateSettings(introSeconds, this.controller.outroSkipDuration, outroStartSeconds);
                
                // Show success notification
                this.showNotification('Settings saved successfully!');
                
            } catch (error) {
                this.showNotification('Error saving settings. Please try again.', 'error');
            }
        }

        /**
         * Validate time input with visual feedback
         */
        validateTimeInput(input) {
            try {
                if (!input || !input.value) {
                    input.style.borderColor = '';
                    return;
                }
                
                this.parseTimeToSeconds(input.value);
                input.style.borderColor = '#4caf50';
                
            } catch (error) {
                input.style.borderColor = '#f44336';
            }
        }

        /**
         * Show notification
         */
        showNotification(message, type = 'success') {
            try {
                const notification = this.element.querySelector('#notification');
                if (!notification) return;
                
                notification.textContent = message;
                notification.style.display = 'block';
                
                // Auto-hide after 3 seconds
                setTimeout(() => {
                    notification.style.display = 'none';
                }, 3000);
                
            } catch (error) {
                console.error('Notification failed:', error);
            }
        }

        /**
         * Hide the floating UI
         */
        hide() {
            try {
                this.element.style.display = 'none';
            } catch (error) {
                console.error('UI hide failed:', error);
            }
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

        /**
         * Enhanced time parsing with validation
         */
        parseTimeToSeconds(value) {
            if (!value || typeof value !== 'string') return 0;
            
            // Remove any dangerous characters and normalize
            const sanitized = value.replace(/[^\d:]/g, '');
            if (!sanitized) return 0;
            
            // Direct number input
            if (/^\d+$/.test(sanitized)) {
                const num = parseInt(sanitized, 10);
                if (num < 0 || num > 86400) { // Max 24 hours
                    throw new Error('Time must be between 0 and 86400 seconds');
                }
                return num;
            }
            
            // Time format validation
            if (!/^(\d{1,2}:)?\d{1,2}:\d{2}$/.test(sanitized) && !/^\d{1,2}:\d{2}$/.test(sanitized)) {
                throw new Error('Time must be in mm:ss or hh:mm:ss format');
            }
            
            const parts = sanitized.split(':').map(p => {
                const num = parseInt(p, 10);
                if (isNaN(num)) throw new Error(`Invalid number: ${p}`);
                return num;
            });
            
            let totalSeconds = 0;
            
            if (parts.length === 2) {
                // mm:ss format
                const [minutes, seconds] = parts;
                if (seconds >= 60) throw new Error('Seconds must be less than 60');
                totalSeconds = minutes * 60 + seconds;
            } else if (parts.length === 3) {
                // hh:mm:ss format
                const [hours, minutes, seconds] = parts;
                if (minutes >= 60) throw new Error('Minutes must be less than 60');
                if (seconds >= 60) throw new Error('Seconds must be less than 60');
                totalSeconds = hours * 3600 + minutes * 60 + seconds;
            } else {
                throw new Error('Invalid time format');
            }
            
            if (totalSeconds < 0 || totalSeconds > 86400) {
                throw new Error('Time must be between 0 and 24 hours');
            }
            
            return totalSeconds;
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
