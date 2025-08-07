// services/CommentService.js - Comment processing and management

import { TextSanitizer, DOMUtils, ValidationUtils, Logger, CONSTANTS } from '../utils.js';

/**
 * Service for handling comment extraction, processing, and management
 */
export class CommentService {
  constructor() {
    this.commentSelectors = [
      '#content-text',
      'ytd-comment-thread-renderer #content-text',
      '.comment-text',
      'yt-formatted-string[slot="content"]',
      'ytd-comment-renderer ytd-comment-renderer #content-text',
      'ytd-comment-renderer ytd-comment-renderer .comment-text',
      '[data-comment-text]',
      'ytd-comment-thread-renderer .style-scope.ytd-comment-renderer'
    ];

    this.replySelectors = [
      'ytd-comment-renderer ytd-comment-renderer #content-text',
      'ytd-comment-renderer ytd-comment-renderer .comment-text',
      'ytd-comment-renderer ytd-comment-renderer [data-comment-text]',
      'ytd-comment-renderer ytd-comment-renderer yt-formatted-string[slot="content"]',
      'ytd-comment-renderer ytd-comment-renderer ytd-comment-renderer #content-text',
      'ytd-comment-renderer ytd-comment-renderer ytd-comment-renderer .comment-text',
      'ytd-comment-renderer ytd-comment-renderer ytd-comment-renderer [data-comment-text]',
      'ytd-comment-renderer ytd-comment-renderer ytd-comment-renderer yt-formatted-string[slot="content"]'
    ];

    this.domCache = {
      commentsSection: null,
      lastCacheTime: 0,
      cacheTimeout: CONSTANTS.PERFORMANCE.CACHE_TIMEOUT
    };
  }

  /**
   * Gets the cached comments section or fetches it from DOM
   * @returns {Element|null} Comments section element
   */
  getCachedCommentsSection() {
    const now = Date.now();
    if (!this.domCache.commentsSection || 
        (now - this.domCache.lastCacheTime) > this.domCache.cacheTimeout) {
      this.domCache.commentsSection = document.querySelector('#comments');
      this.domCache.lastCacheTime = now;
    }
    return this.domCache.commentsSection;
  }

  /**
   * Waits for the comments section to be available
   * @returns {Promise<Element>} Promise that resolves with comments section
   */
  async waitForCommentsSection() {
    return DOMUtils.waitForElement('#comments', CONSTANTS.PERFORMANCE.WAIT_TIMEOUT);
  }

  /**
   * Finds comments without expanding replies (for quick checks)
   * @returns {Promise<string[]>} Array of comment texts
   */
  async findCommentsWithoutExpanding() {
    const comments = [];
    const seenTexts = new Set();
    
    const commentsSection = this.getCachedCommentsSection();
    if (!commentsSection) return comments;
    
    // Use only the most efficient selector for quick check
    const elements = commentsSection.querySelectorAll('#content-text');
    
    for (const element of elements) {
      if (!element || !element.textContent) continue;
      
      const text = TextSanitizer.sanitize(element.textContent);
      if (text.length >= CONSTANTS.VALIDATION.MIN_COMMENT_LENGTH && !seenTexts.has(text)) {
        seenTexts.add(text);
        comments.push(text);
        
        if (comments.length >= CONSTANTS.VALIDATION.QUICK_CHECK_LIMIT) break;
      }
    }
    
    return comments;
  }

  /**
   * Expands reply threads by clicking reply buttons
   * @returns {Promise<void>}
   */
  async expandReplyThreads() {
    try {
      const replyButtons = document.querySelectorAll('[aria-label*="reply"], [aria-label*="replies"]');
      
      // Process buttons in batches to avoid blocking
      const batchSize = 3;
      for (let i = 0; i < replyButtons.length; i += batchSize) {
        const batch = Array.from(replyButtons).slice(i, i + batchSize);
        
        for (const button of batch) {
          if (button && button.offsetParent !== null && !button.disabled) {
            button.click();
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        // Small delay between batches
        if (i + batchSize < replyButtons.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // Wait for replies to load
      await new Promise(resolve => setTimeout(resolve, CONSTANTS.PERFORMANCE.REPLY_EXPANSION_DELAY));
      
    } catch (error) {
      Logger.warn('Error expanding reply threads:', error);
    }
  }

  /**
   * Finds all comments with reply expansion
   * @returns {Promise<string[]>} Array of comment texts
   */
  async findComments() {
    const comments = [];
    const seenTexts = new Set();
    
    // Expand replies only if we have comments
    const initialComments = await this.findCommentsWithoutExpanding();
    if (initialComments.length > 0) {
      await this.expandReplyThreads();
    }
    
    const commentsSection = this.getCachedCommentsSection();
    if (!commentsSection) return comments;
    
    // Try most efficient selector first
    const elements = commentsSection.querySelectorAll('#content-text');
    if (elements.length > 0) {
      for (const element of elements) {
        if (!element || !element.textContent) continue;
        
        const text = TextSanitizer.sanitize(element.textContent);
        if (text.length >= CONSTANTS.VALIDATION.MIN_COMMENT_LENGTH && !seenTexts.has(text)) {
          seenTexts.add(text);
          comments.push(text);
          
          if (comments.length >= CONSTANTS.VALIDATION.MAX_COMMENTS) break;
        }
      }
      return comments;
    }
    
    // Fallback to other selectors only if needed
    for (const selector of this.commentSelectors.slice(1)) {
      try {
        const elements = commentsSection.querySelectorAll(selector);
        
        for (const element of elements) {
          if (!element || !element.textContent) continue;
          
          const text = TextSanitizer.sanitize(element.textContent);
          if (text.length >= CONSTANTS.VALIDATION.MIN_COMMENT_LENGTH && !seenTexts.has(text)) {
            seenTexts.add(text);
            comments.push(text);
            
            if (comments.length >= CONSTANTS.VALIDATION.MAX_COMMENTS) break;
          }
        }
        
        if (comments.length > 0) break;
      } catch (error) {
        Logger.warn(`Error with selector ${selector}:`, error);
      }
    }
    
    return comments;
  }

  /**
   * Loads comments with scrolling for deep analysis
   * @returns {Promise<string[]>} Array of comment texts
   */
  async loadCommentsWithScrolling() {
    try {
      const commentsContainer = this.getCachedCommentsSection();
      if (!commentsContainer) {
        throw new Error('Comments container not found');
      }
      
      // Store original scroll position
      const originalScrollY = window.scrollY;
      let comments = await this.findComments();
      
      const maxScrollAttempts = 3;
      
      for (let i = 0; i < maxScrollAttempts; i++) {
        const beforeScrollCount = comments.length;
        
        // Scroll to load more comments
        const commentsBottom = commentsContainer.getBoundingClientRect().bottom + window.scrollY;
        window.scrollTo({
          top: commentsBottom + 300,
          behavior: 'auto'
        });
        
        await new Promise(resolve => setTimeout(resolve, CONSTANTS.PERFORMANCE.SCROLL_DELAY));
        
        // Expand replies only if we have comments
        const newComments = await this.findCommentsWithoutExpanding();
        if (newComments.length > 0) {
          await this.expandReplyThreads();
        }
        
        // Look for "Load more" button and click it
        const loadMoreButton = document.querySelector('ytd-continuation-item-renderer button') ||
                             document.querySelector('[aria-label*="Show more"]') ||
                             document.querySelector('[aria-label*="Load more"]');
        
        if (loadMoreButton && loadMoreButton.offsetParent !== null) {
          loadMoreButton.click();
          await new Promise(resolve => setTimeout(resolve, CONSTANTS.PERFORMANCE.SCROLL_DELAY));
          await this.expandReplyThreads();
        }
        
        // Get updated comment count
        comments = await this.findComments();
        
        // If we didn't get any new comments, stop scrolling
        if (comments.length <= beforeScrollCount) {
          break;
        }
        
        // If we have enough comments, stop early
        if (comments.length >= 150) {
          break;
        }
      }
      
      // Restore original scroll position
      window.scrollTo({
        top: originalScrollY,
        behavior: 'auto'
      });
      
      return comments.slice(0, 150);
      
    } catch (error) {
      Logger.error('Error loading comments with scrolling:', error);
      throw new Error('Failed to load comments with scrolling: ' + error.message);
    }
  }

  /**
   * Loads only visible comments without scrolling
   * @returns {Promise<string[]>} Array of comment texts
   */
  async loadVisibleComments() {
    try {
      const comments = await this.findComments();
      
      if (comments.length === 0) {
        throw new Error('No visible comments found');
      }
      
      return comments.slice(0, 100);
      
    } catch (error) {
      Logger.error('Error loading visible comments:', error);
      throw new Error('Failed to load visible comments: ' + error.message);
    }
  }

  /**
   * Validates and processes comments for API submission
   * @param {string[]} comments - Raw comment texts
   * @returns {string[]} Processed and validated comments
   * @throws {Error} If validation fails
   */
  validateAndProcessComments(comments) {
    ValidationUtils.validateArray(comments, 1, CONSTANTS.VALIDATION.MAX_COMMENTS, 'Comments');
    
    const processedComments = comments
      .filter(comment => {
        if (typeof comment !== 'string') return false;
        const trimmed = comment.trim();
        return trimmed.length >= CONSTANTS.VALIDATION.MIN_COMMENT_LENGTH && 
               trimmed.length <= CONSTANTS.VALIDATION.MAX_COMMENT_LENGTH;
      })
      .map(comment => TextSanitizer.sanitize(comment, CONSTANTS.VALIDATION.MAX_COMMENT_LENGTH))
      .slice(0, CONSTANTS.VALIDATION.MAX_COMMENTS);

    if (processedComments.length === 0) {
      throw new Error('No valid comments found after processing');
    }

    return processedComments;
  }
} 