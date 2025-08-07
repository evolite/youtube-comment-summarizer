// content.js - Content script for YouTube Comment Summarizer

/**
 * Main content script controller
 */
class ContentScriptController {
  constructor() {
    this.isInitialized = false;
    this.cleanupFunctions = [];
  }

  /**
   * Initializes the content script
   */
  async initialize() {
    try {
      if (this.isInitialized) return;
      
      const commentsSection = await this.waitForCommentsSection();
      if (commentsSection) {
        this.injectButtons(commentsSection);
        this.isInitialized = true;
        console.log('Content script initialized successfully');
      }
    } catch (error) {
      console.warn('Comments section not found, will retry:', error.message);
    }
  }

  /**
   * Waits for the comments section to appear
   */
  async waitForCommentsSection() {
    const maxAttempts = 10;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const commentsSection = document.querySelector('#comments');
      if (commentsSection) {
        return commentsSection;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
    
    return null;
  }

  /**
   * Injects the summarize buttons into the comments section
   */
  injectButtons(commentsSection) {
    // Remove existing buttons if any
    const existingButtons = commentsSection.querySelector('.yt-summarize-button-container');
    if (existingButtons) {
      existingButtons.remove();
    }

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'yt-summarize-button-container';

    // Create summarize button
    const summarizeBtn = this.createButton(
      'yt-summarize-btn',
      'Summarize Comments',
      'Summarize visible comments',
      () => this.handleSummarizeClick()
    );

    // Create deep summarize button
    const deepSummarizeBtn = this.createButton(
      'yt-summarize-btn-secondary',
      'Deep Summarize',
      'Load more comments and summarize',
      () => this.handleDeepSummarizeClick()
    );

    buttonContainer.appendChild(summarizeBtn);
    buttonContainer.appendChild(deepSummarizeBtn);

    // Insert at the top of comments section
    commentsSection.insertBefore(buttonContainer, commentsSection.firstChild);
  }

  /**
   * Creates a button element
   */
  createButton(className, text, ariaLabel, onClick) {
    const button = document.createElement('button');
    button.className = className;
    button.textContent = text;
    button.setAttribute('aria-label', ariaLabel);

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });

    return button;
  }

  /**
   * Handles summarize button click
   */
  async handleSummarizeClick() {
    try {
      this.setButtonProcessingState(true);
      
      const comments = await this.loadVisibleComments();
      const processedComments = this.validateAndProcessComments(comments);
      
      this.showLoading(processedComments.length);
      
      const response = await this.requestSummaryFromBackground(processedComments);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      this.showSummary(response.summary, processedComments.length, false);
      
    } catch (error) {
      console.error('Error in summarize handler:', error);
      this.removeSummaryBox();
      this.showSummary(error.message, 0, true);
    } finally {
      this.setButtonProcessingState(false);
    }
  }

  /**
   * Handles deep summarize button click
   */
  async handleDeepSummarizeClick() {
    try {
      this.setButtonProcessingState(true);
      
      // Show initial loading message
      this.showTemporaryLoading();
      
      const comments = await this.loadCommentsWithScrolling();
      
      // Remove temporary loading message
      this.removeTemporaryLoading();
      
      const processedComments = this.validateAndProcessComments(comments);
      
      this.showLoading(processedComments.length);
      
      const response = await this.requestSummaryFromBackground(processedComments, 90000);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      this.showSummary(response.summary, processedComments.length, false);
      
    } catch (error) {
      console.error('Error in deep summarize handler:', error);
      this.removeSummaryBox();
      this.removeTemporaryLoading();
      this.showSummary(error.message, 0, true);
    } finally {
      this.setButtonProcessingState(false);
    }
  }

  /**
   * Loads visible comments without scrolling
   */
  async loadVisibleComments() {
    const commentElements = document.querySelectorAll('#content-text');
    const comments = [];
    
    for (const element of commentElements) {
      const text = element.textContent?.trim();
      if (text && text.length > 5) {
        comments.push(text);
      }
    }
    
    console.log(`Found ${comments.length} comments from DOM`);
    return comments;
  }

  /**
   * Loads comments with scrolling to get more
   */
  async loadCommentsWithScrolling() {
    const originalScrollTop = window.scrollY;
    const comments = [];
    let attempts = 0;
    const maxAttempts = 3;
    
    try {
      while (attempts < maxAttempts) {
        // Get current visible comments
        const currentComments = await this.loadVisibleComments();
        comments.push(...currentComments);
        
        // Try to click "Load more" button
        const loadMoreButton = document.querySelector('ytd-button-renderer[aria-label*="Load more"]');
        if (loadMoreButton) {
          loadMoreButton.click();
          await new Promise(resolve => setTimeout(resolve, 1500));
        } else {
          // Scroll down to load more
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        attempts++;
      }
    } finally {
      // Restore scroll position
      window.scrollTo(0, originalScrollTop);
    }
    
    // Remove duplicates
    const uniqueComments = [...new Set(comments)];
    console.log(`Found ${uniqueComments.length} comments with scrolling`);
    return uniqueComments;
  }

  /**
   * Validates and processes comments
   */
  validateAndProcessComments(comments) {
    if (!Array.isArray(comments)) {
      throw new Error('Invalid comments format');
    }
    
    if (comments.length === 0) {
      throw new Error('No comments found');
    }
    
    if (comments.length > 200) {
      comments = comments.slice(0, 200);
    }
    
    return comments.filter(comment => 
      comment && 
      typeof comment === 'string' && 
      comment.length > 5 && 
      comment.length < 1000
    );
  }

  /**
   * Requests summary from background script
   */
  async requestSummaryFromBackground(comments, timeout = 30000) {
    const messagePromise = browser.runtime.sendMessage({
      type: 'summarize',
      comments: comments
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeout);
    });

    try {
      const response = await Promise.race([messagePromise, timeoutPromise]);
      return response;
    } catch (error) {
      throw new Error(`Background script error: ${error.message}`);
    }
  }

  /**
   * Sets button processing state
   */
  setButtonProcessingState(isProcessing) {
    const buttons = document.querySelectorAll('.yt-summarize-btn, .yt-summarize-btn-secondary');
    buttons.forEach(button => {
      button.disabled = isProcessing;
      button.style.opacity = isProcessing ? '0.5' : '1';
    });
  }

  /**
   * Shows loading message
   */
  showLoading(commentCount) {
    this.removeSummaryBox();
    
    const loadingBox = document.createElement('div');
    loadingBox.id = 'yt-summarize-loading';
    loadingBox.className = 'yt-summarize-loading';
    loadingBox.textContent = `Generating summary based on ${commentCount} comments...`;
    
    const commentsSection = document.querySelector('#comments');
    if (commentsSection) {
      commentsSection.insertBefore(loadingBox, commentsSection.firstChild);
    }
  }

  /**
   * Shows summary
   */
  showSummary(summary, commentCount, isError = false) {
    this.removeSummaryBox();
    
    const summaryBox = document.createElement('div');
    summaryBox.id = 'yt-summarize-summary';
    summaryBox.className = 'yt-summarize-box';
    if (isError) {
      summaryBox.setAttribute('data-error', 'true');
    }
    
    const title = document.createElement('h3');
    title.textContent = isError ? 'Error' : `Summary (${commentCount} comments)`;
    
    const content = document.createElement('div');
    content.textContent = summary;
    
    summaryBox.appendChild(title);
    summaryBox.appendChild(content);
    
    const commentsSection = document.querySelector('#comments');
    if (commentsSection) {
      commentsSection.insertBefore(summaryBox, commentsSection.firstChild);
    }
  }

  /**
   * Shows temporary loading message
   */
  showTemporaryLoading() {
    const tempLoading = document.createElement('div');
    tempLoading.id = 'yt-summarize-temp-loading';
    tempLoading.textContent = 'Loading more comments...';
    document.body.appendChild(tempLoading);
  }

  /**
   * Removes temporary loading message
   */
  removeTemporaryLoading() {
    const tempLoading = document.getElementById('yt-summarize-temp-loading');
    if (tempLoading) {
      tempLoading.remove();
    }
  }

  /**
   * Removes summary box
   */
  removeSummaryBox() {
    const elements = [
      'yt-summarize-summary',
      'yt-summarize-loading',
      'yt-summarize-temp-loading'
    ];
    
    elements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.remove();
      }
    });
    
    // Also remove any orphaned elements with our classes
    const orphanedElements = document.querySelectorAll('.yt-summarize-box, .yt-summarize-loading');
    orphanedElements.forEach(element => element.remove());
  }

  /**
   * Handles navigation
   */
  handleNavigation() {
    this.isInitialized = false;
    this.removeSummaryBox();
    
    // Re-initialize after a short delay
    setTimeout(() => this.initialize(), 500);
  }

  /**
   * Cleanup function
   */
  cleanup() {
    this.removeSummaryBox();
    this.cleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    });
    this.cleanupFunctions = [];
  }
}

/**
 * Navigation handler for detecting page changes
 */
class NavigationHandler {
  constructor(controller) {
    this.controller = controller;
    this.observer = null;
    this.initializationAttempts = 0;
    this.maxAttempts = 3;
  }

  init() {
    try {
      this.interceptHistoryAPI();
      this.setupMutationObserver();
      this.controller.Logger = console; // Fallback logger
    } catch (error) {
      console.error('Failed to initialize navigation handler:', error);
    }
  }

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
      
      window.addEventListener('popstate', () => {
        this.handleNavigation();
      });
    } catch (error) {
      console.error('Failed to intercept history API:', error);
    }
  }

  setupMutationObserver() {
    try {
      this.observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.id === 'comments' || node.querySelector('#comments')) {
                  this.handleNavigation();
                  return;
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
      console.error('Failed to setup mutation observer:', error);
    }
  }

  handleNavigation() {
    // Throttle navigation handling
    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
    }
    
    this.navigationTimeout = setTimeout(() => {
      try {
        if (window.location.pathname === '/watch') {
          this.controller.handleNavigation();
        }
      } catch (error) {
        console.error('Navigation handling error:', error);
      }
    }, 100); // 100ms throttle
  }

  cleanup() {
    try {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      
      if (this.navigationTimeout) {
        clearTimeout(this.navigationTimeout);
        this.navigationTimeout = null;
      }
      
      this.initializationAttempts = 0;
    } catch (error) {
      console.error('Navigation cleanup error:', error);
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
  controller.navigationHandler = new NavigationHandler(controller);
  controller.navigationHandler.init();
}

// Enhanced cleanup on page unload
window.addEventListener('beforeunload', () => {
  try {
    controller.cleanup();
  } catch (error) {
    console.error('Unload cleanup error:', error);
  }
}, { passive: true });

// Handle page visibility changes (tab switching, minimizing, etc.)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    try {
      controller.removeSummaryBox();
    } catch (error) {
      console.error('Visibility change cleanup error:', error);
    }
  }
}, { passive: true }); 