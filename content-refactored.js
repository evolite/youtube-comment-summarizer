// content-refactored.js - Refactored content script using service classes

import { CommentService } from './services/CommentService.js';
import { UIService } from './services/UIService.js';
import { Logger, CONSTANTS } from './utils.js';

/**
 * Main content script controller
 */
class ContentScriptController {
  constructor() {
    this.commentService = new CommentService();
    this.uiService = new UIService();
    this.navigationHandler = new NavigationHandler(this);
    this.isInitialized = false;
  }

  /**
   * Initializes the content script
   */
  async initialize() {
    try {
      if (this.isInitialized) return;
      
      const commentsSection = await this.commentService.waitForCommentsSection();
      if (commentsSection) {
        this.uiService.injectButtons(
          commentsSection,
          () => this.handleSummarizeClick(),
          () => this.handleDeepSummarizeClick()
        );
        this.isInitialized = true;
        Logger.info('Content script initialized successfully');
      }
    } catch (error) {
      Logger.warn('Comments section not found, will retry:', error.message);
    }
  }

  /**
   * Handles summarize button click
   */
  async handleSummarizeClick() {
    try {
      this.uiService.setButtonProcessingState(true);
      
      const comments = await this.commentService.loadVisibleComments();
      const processedComments = this.commentService.validateAndProcessComments(comments);
      
      this.uiService.showLoading(processedComments.length);
      
      const response = await this.requestSummaryFromBackground(processedComments);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      this.uiService.showSummary(response.summary, processedComments.length, false);
      
    } catch (error) {
      Logger.error('Error in summarize handler:', error);
      this.uiService.removeSummaryBox();
      this.uiService.showSummary(error.message, 0, true);
    } finally {
      this.uiService.setButtonProcessingState(false);
    }
  }

  /**
   * Handles deep summarize button click
   */
  async handleDeepSummarizeClick() {
    try {
      this.uiService.setButtonProcessingState(true);
      
      // Show initial loading message
      const tempLoading = this.uiService.showTemporaryLoading();
      
      const comments = await this.commentService.loadCommentsWithScrolling();
      
      // Remove temporary loading message
      this.uiService.removeTemporaryLoading();
      
      const processedComments = this.commentService.validateAndProcessComments(comments);
      
      this.uiService.showLoading(processedComments.length);
      
      const response = await this.requestSummaryFromBackground(
        processedComments, 
        CONSTANTS.API.DEEP_ANALYSIS_TIMEOUT
      );
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      this.uiService.showSummary(response.summary, processedComments.length, false);
      
    } catch (error) {
      Logger.error('Error in deep summarize handler:', error);
      this.uiService.removeSummaryBox();
      this.uiService.removeTemporaryLoading();
      this.uiService.showSummary(error.message, 0, true);
    } finally {
      this.uiService.setButtonProcessingState(false);
    }
  }

  /**
   * Requests summary from background script
   * @param {string[]} comments - Processed comments
   * @param {number} timeout - Request timeout
   * @returns {Promise<Object>} Response from background script
   */
  async requestSummaryFromBackground(comments, timeout = CONSTANTS.API.REQUEST_TIMEOUT) {
    const messagePromise = browser.runtime.sendMessage({
      type: 'summarize',
      comments: comments
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timed out')), timeout)
    );
    
    return await Promise.race([messagePromise, timeoutPromise]);
  }

  /**
   * Handles navigation events
   */
  handleNavigation() {
    this.uiService.removeSummaryBox();
    this.uiService.performCleanup();
    this.isInitialized = false;
    
    // Re-initialize after a short delay
    setTimeout(() => this.initialize(), CONSTANTS.PERFORMANCE.NAVIGATION_DELAY);
  }

  /**
   * Performs cleanup on page unload
   */
  cleanup() {
    this.uiService.performCleanup();
    this.navigationHandler.cleanup();
  }
}

/**
 * Navigation handler for detecting page changes
 */
class NavigationHandler {
  constructor(controller) {
    this.controller = controller;
    this.currentUrl = window.location.href;
    this.observer = null;
    this.isInitialized = false;
    this.initializationAttempts = 0;
    this.navigationThrottle = null;
  }

  /**
   * Initializes navigation handling
   */
  init() {
    if (this.isInitialized) return;

    try {
      // Listen for browser navigation events
      window.addEventListener('popstate', this.handleNavigation.bind(this), { passive: true });

      // Override pushState and replaceState to catch programmatic navigation
      this.interceptHistoryAPI();

      // Set up MutationObserver for DOM changes
      this.setupMutationObserver();

      this.isInitialized = true;
    } catch (error) {
      Logger.error('Failed to initialize navigation handler:', error);
    }
  }

  /**
   * Intercepts History API calls
   */
  interceptHistoryAPI() {
    try {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = function(...args) {
        originalPushState.apply(history, args);
        this.handleNavigation();
      }.bind(this);

      history.replaceState = function(...args) {
        originalReplaceState.apply(history, args);
        this.handleNavigation();
      }.bind(this);
    } catch (error) {
      Logger.error('Failed to intercept history API:', error);
    }
  }

  /**
   * Sets up MutationObserver for DOM changes
   */
  setupMutationObserver() {
    try {
      this.observer = new MutationObserver((mutations) => {
        // Only process if we're on a watch page
        if (window.location.pathname !== '/watch') return;
        
        // Check for comments section changes
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.id === 'comments' || node.querySelector('#comments')) {
                  this.handleNavigation();
                  break;
                }
              }
            }
          }
        }
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    } catch (error) {
      Logger.error('Failed to setup mutation observer:', error);
    }
  }

  /**
   * Handles navigation events with throttling
   */
  handleNavigation() {
    // Throttle navigation handling to prevent excessive calls
    if (this.navigationThrottle) {
      clearTimeout(this.navigationThrottle);
    }
    
    this.navigationThrottle = setTimeout(() => {
      try {
        if (window.location.href !== this.currentUrl) {
          this.currentUrl = window.location.href;
          this.controller.handleNavigation();
        }
      } catch (error) {
        Logger.error('Navigation handling error:', error);
      }
    }, 100); // 100ms throttle
  }

  /**
   * Performs cleanup
   */
  cleanup() {
    try {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      if (this.navigationThrottle) {
        clearTimeout(this.navigationThrottle);
        this.navigationThrottle = null;
      }
      this.isInitialized = false;
      this.initializationAttempts = 0;
    } catch (error) {
      Logger.error('Navigation cleanup error:', error);
    }
  }
}

// Initialize the content script
const controller = new ContentScriptController();

/**
 * Initializes the extension with retry logic
 */
async function initializeWithRetry() {
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      await controller.initialize();
      break; // Success, exit loop
    } catch (error) {
      attempts++;
      if (attempts < maxAttempts) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
}

// Initialize extension on page load
initializeWithRetry();

// Set up navigation handling only on watch pages
if (window.location.pathname === '/watch') {
  controller.navigationHandler.init();
}

// Enhanced cleanup on page unload
window.addEventListener('beforeunload', () => {
  try {
    controller.cleanup();
  } catch (error) {
    Logger.error('Unload cleanup error:', error);
  }
}, { passive: true });

// Handle page visibility changes (tab switching, minimizing, etc.)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    try {
      controller.uiService.removeSummaryBox();
    } catch (error) {
      Logger.error('Visibility change cleanup error:', error);
    }
  }
}, { passive: true });

// Additional cleanup for extension context invalidation
if (typeof browser !== 'undefined' && browser.runtime) {
  browser.runtime.onConnect.addListener(() => {
    // Extension context still valid
  });
} 