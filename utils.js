// utils.js - Shared utilities for YouTube Comment Summarizer

/**
 * Text sanitization utilities
 */
export const TextSanitizer = {
  /**
   * Sanitizes text input to prevent XSS and injection attacks
   * @param {string} input - Text to sanitize
   * @param {number} maxLength - Maximum allowed length (default: 2000)
   * @returns {string} Sanitized text
   */
  sanitize(input, maxLength = 2000) {
    if (typeof input !== 'string') return '';
    
    return input
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\u0000/g, '') // Remove null bytes
      .trim()
      .substring(0, maxLength);
  },

  /**
   * Validates and sanitizes API response text
   * @param {string} text - API response text
   * @returns {string} Sanitized response
   */
  sanitizeApiResponse(text) {
    if (typeof text !== 'string') return '';
    
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/eval\s*\(/gi, '') // Remove eval calls
      .trim()
      .substring(0, 5000); // Limit response length
  }
};

/**
 * DOM manipulation utilities
 */
export const DOMUtils = {
  /**
   * Safely removes an element from the DOM
   * @param {Element} element - Element to remove
   */
  safeRemove(element) {
    try {
      if (element && element.parentNode) {
        element.remove();
      }
    } catch (error) {
      console.warn('Failed to remove element:', error);
    }
  },

  /**
   * Creates a DOM element with attributes
   * @param {string} tagName - HTML tag name
   * @param {Object} attributes - Element attributes
   * @param {string} textContent - Text content
   * @returns {Element} Created element
   */
  createElement(tagName, attributes = {}, textContent = '') {
    const element = document.createElement(tagName);
    
    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    
    // Set text content if provided
    if (textContent) {
      element.textContent = textContent;
    }
    
    return element;
  },

  /**
   * Waits for an element to be present in the DOM
   * @param {string} selector - CSS selector
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Element>} Promise that resolves with the element
   */
  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element && element.offsetParent !== null) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }
};

/**
 * Validation utilities
 */
export const ValidationUtils = {
  /**
   * Validates that a value is a non-empty string
   * @param {any} value - Value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   */
  validateString(value, fieldName = 'Field') {
    if (!value || typeof value !== 'string') {
      throw new Error(`${fieldName} must be a non-empty string`);
    }
    return true;
  },

  /**
   * Validates that a value is an array with specific constraints
   * @param {any} value - Value to validate
   * @param {number} minLength - Minimum array length
   * @param {number} maxLength - Maximum array length
   * @param {string} fieldName - Name of the field for error messages
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   */
  validateArray(value, minLength = 1, maxLength = Infinity, fieldName = 'Array') {
    if (!Array.isArray(value)) {
      throw new Error(`${fieldName} must be an array`);
    }
    
    if (value.length < minLength) {
      throw new Error(`${fieldName} must have at least ${minLength} item(s)`);
    }
    
    if (value.length > maxLength) {
      throw new Error(`${fieldName} must have at most ${maxLength} item(s)`);
    }
    
    return true;
  },

  /**
   * Validates a number within a range
   * @param {any} value - Value to validate
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @param {string} fieldName - Name of the field for error messages
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   */
  validateNumber(value, min = -Infinity, max = Infinity, fieldName = 'Number') {
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`${fieldName} must be a valid number`);
    }
    
    if (num < min || num > max) {
      throw new Error(`${fieldName} must be between ${min} and ${max}`);
    }
    
    return true;
  }
};

/**
 * Logger utility for consistent logging
 */
export const Logger = {
  /**
   * Logs an info message
   * @param {string} message - Message to log
   * @param {any} data - Additional data
   */
  info(message, data = {}) {
    console.log(`[INFO] ${message}`, data);
  },

  /**
   * Logs a warning message
   * @param {string} message - Message to log
   * @param {any} data - Additional data
   */
  warn(message, data = {}) {
    console.warn(`[WARN] ${message}`, data);
  },

  /**
   * Logs an error message
   * @param {string} message - Message to log
   * @param {Error} error - Error object
   */
  error(message, error = null) {
    console.error(`[ERROR] ${message}`, error);
  },

  /**
   * Logs a debug message (only in development)
   * @param {string} message - Message to log
   * @param {any} data - Additional data
   */
  debug(message, data = {}) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${message}`, data);
    }
  }
};

/**
 * Configuration constants to replace magic numbers
 */
export const CONSTANTS = {
  // Performance settings
  PERFORMANCE: {
    WAIT_TIMEOUT: 5000,
    LOAD_MORE_ATTEMPTS: 2,
    LOAD_MORE_DELAY: 1000,
    NAVIGATION_DELAY: 500,
    RETRY_DELAY: 250,
    MAX_BUTTON_INJECTION_ATTEMPTS: 3,
    MAX_CLEANUP_ITEMS: 50,
    REPLY_EXPANSION_DELAY: 1000,
    SCROLL_DELAY: 1500,
    CACHE_TIMEOUT: 5000
  },

  // Validation limits
  VALIDATION: {
    MAX_COMMENTS: 200,
    MAX_COMMENT_LENGTH: 1000,
    MIN_COMMENT_LENGTH: 5,
    MAX_TOTAL_LENGTH: 100000,
    MAX_PROMPT_LENGTH: 100000,
    MAX_API_KEY_LENGTH: 200,
    QUICK_CHECK_LIMIT: 50
  },

  // UI settings
  UI: {
    MAX_SUMMARY_LENGTH: 5000,
    MAX_LOADING_TEXT_LENGTH: 100,
    BUTTON_DISABLED_OPACITY: 0.5
  },

  // API settings
  API: {
    REQUEST_TIMEOUT: 30000,
    DEEP_ANALYSIS_TIMEOUT: 90000,
    RATE_LIMIT_WINDOW: 60000,
    MAX_REQUESTS_PER_WINDOW: 10
  }
};

/**
 * Async utilities for better error handling
 */
export const AsyncUtils = {
  /**
   * Wraps an async function with timeout
   * @param {Function} fn - Async function to wrap
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<any>} Promise that resolves with function result or rejects on timeout
   */
  withTimeout(fn, timeout) {
    return Promise.race([
      fn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), timeout)
      )
    ]);
  },

  /**
   * Retries an async function with exponential backoff
   * @param {Function} fn - Async function to retry
   * @param {number} maxAttempts - Maximum number of attempts
   * @param {number} baseDelay - Base delay in milliseconds
   * @returns {Promise<any>} Promise that resolves with function result
   */
  async retry(fn, maxAttempts = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts) {
          throw error;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}; 