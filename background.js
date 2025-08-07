// background.js - Refactored background script using service classes

import { APIService } from './services/APIService.js';
import { Logger, CONSTANTS } from './utils.js';

/**
 * Rate limiting manager
 */
class RateLimitManager {
  constructor() {
    this.requests = new Map();
    this.cleanupInterval = null;
    this.initializeCleanup();
  }

  /**
   * Initializes cleanup interval for rate limiting
   */
  initializeCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [tabId, requests] of this.requests.entries()) {
        const recentRequests = requests.filter(time => now - time < CONSTANTS.API.RATE_LIMIT_WINDOW);
        if (recentRequests.length === 0) {
          this.requests.delete(tabId);
        } else {
          this.requests.set(tabId, recentRequests);
        }
      }
    }, CONSTANTS.API.RATE_LIMIT_WINDOW);
  }

  /**
   * Checks if a tab has exceeded rate limits
   * @param {string} tabId - Tab ID to check
   * @throws {Error} If rate limit exceeded
   */
  checkRateLimit(tabId) {
    const now = Date.now();
    const recentRequests = this.requests.get(tabId) || [];
    const validRequests = recentRequests.filter(time => now - time < CONSTANTS.API.RATE_LIMIT_WINDOW);
    
    if (validRequests.length >= CONSTANTS.API.MAX_REQUESTS_PER_WINDOW) {
      throw new Error(`Rate limit exceeded: maximum ${CONSTANTS.API.MAX_REQUESTS_PER_WINDOW} requests per minute`);
    }
    
    validRequests.push(now);
    this.requests.set(tabId, validRequests);
  }

  /**
   * Performs cleanup
   */
  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * Storage manager for handling browser storage operations
 */
class StorageManager {
  /**
   * Gets data from storage with timeout
   * @param {string[]} keys - Keys to retrieve
   * @returns {Promise<Object>} Storage data
   */
  async get(keys) {
    const storagePromise = browser.storage.local.get(keys);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Storage timeout')), 5000)
    );
    
    return await Promise.race([storagePromise, timeoutPromise]);
  }

  /**
   * Sets data in storage
   * @param {Object} data - Data to store
   * @returns {Promise<void>}
   */
  async set(data) {
    return await browser.storage.local.set(data);
  }

  /**
   * Removes data from storage
   * @param {string[]} keys - Keys to remove
   * @returns {Promise<void>}
   */
  async remove(keys) {
    return await browser.storage.local.remove(keys);
  }
}

/**
 * Main background script controller
 */
class BackgroundScriptController {
  constructor() {
    this.apiService = new APIService();
    this.rateLimitManager = new RateLimitManager();
    this.storageManager = new StorageManager();
  }

  /**
   * Handles summarize requests
   * @param {Object} request - Request object
   * @param {Object} sender - Message sender
   * @returns {Promise<Object>} Response object
   */
  async handleSummarizeRequest(request, sender) {
    try {
      Logger.info('Starting summarize request...');

      // Validate sender
      if (!sender || !sender.tab) {
        throw new Error('Invalid request sender');
      }

      // Rate limiting check
      const tabId = sender.tab.id || 'unknown';
      this.rateLimitManager.checkRateLimit(tabId);

      // Validate comments
      const validatedComments = this.validateComments(request.comments);
      Logger.info(`Processing ${validatedComments.length} validated comments`);

      // Retrieve settings from storage
      const { apiKey, systemPrompt, aiProvider = 'claude' } = await this.storageManager.get([
        'apiKey', 
        'systemPrompt', 
        'aiProvider'
      ]);
      
      if (!apiKey) {
        const providerName = this.apiService.getProviders()[aiProvider]?.name || 'AI';
        return { error: `${providerName} API key not set. Please set it in the extension options.` };
      }

      // Validate API key for selected provider
      this.apiService.validateApiKey(apiKey, aiProvider);
      Logger.info(`API key validated successfully for ${aiProvider}`);

      // Validate and sanitize system prompt
      const promptToUse = this.apiService.validateSystemPrompt(systemPrompt);
      Logger.info('Using system prompt:', promptToUse.substring(0, 100) + '...');

      // Generate summary
      const summary = await this.apiService.generateSummary(
        validatedComments,
        apiKey,
        promptToUse,
        aiProvider
      );

      Logger.info('Summary generated successfully');
      return { summary };
      
    } catch (error) {
      Logger.error('Error in background script:', error.message);
      return { error: 'Error: ' + String(error.message).substring(0, 500) };
    }
  }

  /**
   * Handles provider info requests
   * @returns {Object} Provider information
   */
  handleGetProvidersRequest() {
    return { providers: this.apiService.getProviders() };
  }

  /**
   * Validates and processes comments
   * @param {string[]} comments - Raw comments array
   * @returns {string[]} Processed comments
   * @throws {Error} If validation fails
   */
  validateComments(comments) {
    if (!comments || !Array.isArray(comments)) {
      throw new Error('Invalid comments data: must be an array');
    }

    if (comments.length === 0) {
      throw new Error('No comments provided');
    }

    if (comments.length > CONSTANTS.VALIDATION.MAX_COMMENTS) {
      throw new Error(`Too many comments: maximum ${CONSTANTS.VALIDATION.MAX_COMMENTS} allowed`);
    }

    // Enhanced validation with type checking and sanitization
    const processedComments = comments
      .filter(comment => {
        if (typeof comment !== 'string') return false;
        const trimmed = comment.trim();
        return trimmed.length >= CONSTANTS.VALIDATION.MIN_COMMENT_LENGTH && 
               trimmed.length <= CONSTANTS.VALIDATION.MAX_COMMENT_LENGTH;
      })
      .map(comment => {
        // Basic sanitization to prevent prompt injection
        return comment
          .substring(0, CONSTANTS.VALIDATION.MAX_COMMENT_LENGTH)
          .trim()
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
          .replace(/\u0000/g, ''); // Remove null bytes
      })
      .slice(0, CONSTANTS.VALIDATION.MAX_COMMENTS);

    if (processedComments.length === 0) {
      throw new Error('No valid comments found after processing');
    }

    return processedComments;
  }

  /**
   * Handles incoming messages
   * @param {Object} request - Request object
   * @param {Object} sender - Message sender
   * @param {Function} sendResponse - Response function
   * @returns {boolean} Whether response is async
   */
  handleMessage(request, sender, sendResponse) {
    Logger.info('Background script received message type:', request.type);

    if (request.type === 'summarize') {
      // Handle the async operation
      (async () => {
        try {
          const response = await this.handleSummarizeRequest(request, sender);
          sendResponse(response);
        } catch (error) {
          Logger.error('Error in async message handler:', error);
          sendResponse({ error: 'Internal server error' });
        }
      })();

      return true; // Indicate async response
    }
    
    if (request.type === 'getProviders') {
      const response = this.handleGetProvidersRequest();
      sendResponse(response);
      return false;
    }
    
    // Reject unknown message types
    Logger.warn('Unknown message type:', request.type);
    sendResponse({ error: 'Unknown request type' });
    return false;
  }

  /**
   * Performs cleanup on extension unload
   */
  cleanup() {
    this.rateLimitManager.cleanup();
  }
}

// Initialize the background script controller
const controller = new BackgroundScriptController();

// Listen for messages from content script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  return controller.handleMessage(request, sender, sendResponse);
});

// Cleanup on extension unload
if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onSuspend) {
  browser.runtime.onSuspend.addListener(() => {
    controller.cleanup();
  });
} 