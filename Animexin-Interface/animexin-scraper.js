/**
 * AnimeXin Scraper Service
 * Node.js backend service to scrape episode data from AnimeXin
 * 
 * Installation:
 * npm install express cors cheerio axios
 * 
 * Usage:
 * node animexin-scraper.js
 * Then make requests to: http://localhost:3000/api/scrape?url=<animexin-url>
 */

const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Serve static files (your HTML interface)
app.use(express.static(__dirname));

// Serve favicon
app.get('/favicon.ico', (req, res) => {
    res.type('image/x-icon');
    res.status(200).send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQEAYAAABPYyMiAAAABmJLR0T///////8JWPfcAAAACXBIWXMAAABIAAAASABGyWs+AAAAF0lEQVRIx2NgGAWjYBSMglEwCkbBSAcACBAAAeaR9cIAAAAASUVORK5CYII=', 'base64'));
});

/**
 * Enhanced AnimeXin scraper with server preference
 */
class AnimeXinScraper {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
                 this.serverPreferences = [
             'hardsub english dailymotion',
             'hardsub english ok.ru',
             'hardsub english mega',
             'hardsub english rumble',
             'all sub player dailymotion',
             'hardsub indonesia dailymotion',
             'hardsub indonesia ok.ru',
             'hardsub indonesia mega',
             'hardsub indonesia rumble',
             'all sub player rumble',
             'all sub player dood'
         ];
    }

    /**
     * Scrape episode data from AnimeXin URL
     */
    async scrapeEpisode(url) {
        try {
            console.log(`Scraping: ${url}`);
            
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            
            // Extract episode information
            const title = $('h1').first().text().trim() || 'Unknown Episode';
            const episodeNumber = this.extractEpisodeNumber(url);
            const seriesName = this.extractSeriesName(url);
            
            // Extract servers from dropdown
            const servers = this.extractServers($);
            
            // Find navigation links
            const prevLink = this.findNavigationLink($, 'prev');
            const nextLink = this.findNavigationLink($, 'next');
            
            return {
                title,
                episode: episodeNumber,
                series: seriesName,
                servers: servers,
                prevUrl: prevLink,
                nextUrl: nextLink,
                originalUrl: url
            };
            
        } catch (error) {
            console.error('Scraping error:', error.message);
            throw new Error(`Failed to scrape episode: ${error.message}`);
        }
    }

         /**
      * Extract video servers from the page
      */
     extractServers($) {
         const servers = [];
         
         // Look for server dropdown options - specifically target .mirror select
         $('select.mirror option').each((index, element) => {
             const $option = $(element);
             const serverName = $option.text().trim();
             const serverValue = $option.attr('value');
             
             if (serverName && serverValue && serverName.toLowerCase() !== 'select video server') {
                 const videoUrl = this.extractVideoUrl($option, $);
                 
                 if (videoUrl) {
                     servers.push({
                         name: serverName,
                         value: serverValue,
                         url: videoUrl,
                         preferred: this.isPreferredServer(serverName)
                     });
                     
                     console.log(`Found server: ${serverName} -> ${videoUrl}`);
                 }
             }
         });

         // If no servers found in dropdown, look for direct iframe
         if (servers.length === 0) {
             const iframe = $('iframe[src*="dailymotion"], iframe[src*="ok.ru"], iframe[src*="mega"]').first();
             if (iframe.length) {
                 const src = iframe.attr('src');
                 servers.push({
                     name: this.identifyServerType(src),
                     value: 'default',
                     url: src,
                     preferred: src.includes('dailymotion')
                 });
             }
         }

         // Sort by preference
         return servers.sort((a, b) => {
             if (a.preferred && !b.preferred) return -1;
             if (!a.preferred && b.preferred) return 1;
             return 0;
         });
     }

         /**
      * Extract video URL from server option
      */
     extractVideoUrl($option, $) {
         const serverValue = $option.attr('value');
         
         if (!serverValue) return null;
         
         try {
             // The server value is Base64 encoded HTML containing an iframe
             const decodedHtml = Buffer.from(serverValue, 'base64').toString('utf8');
             
             // Parse the decoded HTML to extract the iframe src
             const $decoded = cheerio.load(decodedHtml);
             const iframe = $decoded('iframe').first();
             
             if (iframe.length) {
                 let src = iframe.attr('src');
                 
                 // Handle protocol-relative URLs
                 if (src && src.startsWith('//')) {
                     src = 'https:' + src;
                 }
                 
                 return src;
             }
             
         } catch (error) {
             console.error('Error decoding server value:', error);
         }
         
         // Fallback: construct URL pattern
         return this.constructVideoUrl(serverValue, $option.text());
     }

    /**
     * Construct video URL based on server type
     */
    constructVideoUrl(serverValue, serverName) {
        const name = serverName.toLowerCase();
        
        if (name.includes('dailymotion')) {
            // Extract Dailymotion video ID if possible
            return `https://www.dailymotion.com/embed/video/${serverValue}`;
        } else if (name.includes('ok.ru')) {
            return `https://ok.ru/videoembed/${serverValue}`;
        } else if (name.includes('mega')) {
            return `https://mega.nz/embed/${serverValue}`;
        }
        
        // Default fallback
        return serverValue;
    }

    /**
     * Check if server is preferred based on user preference
     */
    isPreferredServer(serverName) {
        const name = serverName.toLowerCase();
        return this.serverPreferences.some(pref => 
            name.includes(pref.toLowerCase())
        );
    }

    /**
     * Identify server type from URL
     */
    identifyServerType(url) {
        if (url.includes('dailymotion')) return 'Dailymotion Player';
        if (url.includes('ok.ru')) return 'OK.ru Player';
        if (url.includes('mega')) return 'Mega Player';
        if (url.includes('rumble')) return 'Rumble Player';
        return 'Unknown Player';
    }

         /**
      * Find navigation links (previous/next episode)
      */
     findNavigationLink($, direction) {
         // Look for navigation buttons with more specific selectors
         const selectors = [
             `a[rel="${direction}"]`,
             `.naveps a[rel="${direction}"]`,
             `.nvs a[rel="${direction}"]`,
             direction === 'prev' ? '.naveps .nvs:first-child a' : '.naveps .nvs:last-child a',
             direction === 'prev' ? 'a:contains("Prev")' : 'a:contains("Next")'
         ];

         for (const selector of selectors) {
             const link = $(selector).first();
             if (link.length) {
                 const href = link.attr('href');
                 if (href && href !== '#' && href.includes('animexin.dev')) {
                     return this.resolveUrl(href);
                 }
             }
         }

         return null;
     }

    /**
     * Extract episode number from URL
     */
    extractEpisodeNumber(url) {
        const match = url.match(/episode[_-]?(\d+)/i);
        return match ? parseInt(match[1]) : 1;
    }

    /**
     * Extract series name from URL
     */
    extractSeriesName(url) {
        try {
            const path = new URL(url).pathname.replace(/^\/+|\/+$/g, '');
            const base = path.split('/')[0];
            const idx = base.indexOf('-episode-');
            return idx > 0 ? base.substring(0, idx) : base;
        } catch (e) {
            return 'unknown';
        }
    }

    /**
     * Resolve relative URLs to absolute
     */
    resolveUrl(href, baseUrl = 'https://animexin.dev') {
        if (href.startsWith('http')) return href;
        if (href.startsWith('/')) return baseUrl + href;
        return baseUrl + '/' + href;
    }
}

// API Routes
app.get('/api/scrape', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({
                error: 'URL parameter is required'
            });
        }

        if (!url.includes('animexin.dev')) {
            return res.status(400).json({
                error: 'Invalid AnimeXin URL'
            });
        }

        const scraper = new AnimeXinScraper();
        const episodeData = await scraper.scrapeEpisode(url);
        
        res.json({
            success: true,
            data: episodeData
        });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'AnimeXin Scraper'
    });
});

// Serve the main interface
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/anime-streaming-interface.html');
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 AnimeXin Scraper Service running on http://localhost:${PORT}`);
    console.log(`📱 Web Interface: http://localhost:${PORT}`);
    console.log(`🔗 API Endpoint: http://localhost:${PORT}/api/scrape?url=<animexin-url>`);
});

module.exports = app;
