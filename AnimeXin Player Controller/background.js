/**
 * AnimeXin Player Controller - Background Service Worker
 * Handles extension lifecycle and provides enhanced error reporting
 */

class BackgroundService {
  constructor() {
    this.setupEventListeners();
    this.initializeExtension();
  }

  setupEventListeners() {
    // Extension installation/update
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstallation(details);
    });

    // Tab updates for contextual features
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });

    // Error reporting
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open
    });
  }

  handleInstallation(details) {
    console.log('AnimeXin Player Controller installed:', details.reason);
    
    if (details.reason === 'install') {
      // First-time installation
      chrome.storage.local.set({
        installDate: Date.now(),
        version: chrome.runtime.getManifest().version,
        settings: {
          autoServerSelection: true,
          enableNotifications: true,
          debugMode: false
        }
      });
    } else if (details.reason === 'update') {
      // Extension updated
      this.handleUpdate(details.previousVersion);
    }
  }

  handleUpdate(previousVersion) {
    console.log(`Updated from ${previousVersion} to ${chrome.runtime.getManifest().version}`);
    
    // Migration logic for future updates
    chrome.storage.local.get(['settings'], (result) => {
      const settings = result.settings || {};
      
      // Add new default settings for updates
      const updatedSettings = {
        autoServerSelection: true,
        enableNotifications: true,
        debugMode: false,
        ...settings
      };
      
      chrome.storage.local.set({ settings: updatedSettings });
    });
  }

  handleTabUpdate(tabId, changeInfo, tab) {
    // Enable extension icon only on AnimeXin pages
    if (changeInfo.status === 'complete' && tab.url) {
      if (tab.url.includes('animexin.dev')) {
        chrome.action.enable(tabId);
        chrome.action.setBadgeText({ 
          text: '🎬',
          tabId: tabId 
        });
        chrome.action.setBadgeBackgroundColor({ 
          color: '#667eea',
          tabId: tabId 
        });
      } else {
        chrome.action.disable(tabId);
        chrome.action.setBadgeText({ 
          text: '',
          tabId: tabId 
        });
      }
    }
  }

  handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'reportError':
        this.logError(request.error, sender);
        sendResponse({ success: true });
        break;
        
      case 'getGlobalSettings':
        chrome.storage.local.get(['settings'], (result) => {
          sendResponse({ 
            success: true, 
            settings: result.settings || {} 
          });
        });
        break;
        
      case 'updateGlobalSettings':
        chrome.storage.local.set({ 
          settings: request.settings 
        }, () => {
          sendResponse({ success: true });
        });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  logError(error, sender) {
    const errorLog = {
      timestamp: Date.now(),
      error: error,
      sender: sender,
      userAgent: navigator.userAgent,
      version: chrome.runtime.getManifest().version
    };
    
    console.error('AnimeXin Controller Error:', errorLog);
    
    // Store error for debugging (last 10 errors)
    chrome.storage.local.get(['errorLog'], (result) => {
      const errors = result.errorLog || [];
      errors.unshift(errorLog);
      
      // Keep only last 10 errors
      const trimmedErrors = errors.slice(0, 10);
      
      chrome.storage.local.set({ errorLog: trimmedErrors });
    });
  }

  initializeExtension() {
    console.log('AnimeXin Player Controller background service initialized');
  }
}

// Initialize background service
new BackgroundService();
