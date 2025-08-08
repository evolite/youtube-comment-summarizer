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
      if (this.isInitialized) {
        // Double-check that buttons are actually present
        const commentsSection = document.querySelector('#comments');
        const buttons = commentsSection?.querySelector('.yt-summarize-button-container');
        if (commentsSection && buttons) {
          return; // Already initialized and buttons are present
        } else {
          this.isInitialized = false;
        }
      }
      
      const commentsSection = await this.waitForCommentsSection();
      if (commentsSection) {
        this.injectButtons(commentsSection);
        this.isInitialized = true;
      } else {
        this.isInitialized = false;
      }
    } catch (error) {
      console.error('Initialization error:', error.message);
      this.isInitialized = false;
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
      
      console.log('Starting deep summarize...');
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
    // Multiple selectors to catch different comment structures
    const commentSelectors = [
      '#content-text', // Main comment text
      'ytd-comment-renderer #content-text', // Comment text within comment renderer
      'ytd-comment-thread-renderer #content-text', // Comment text in thread
      'ytd-comment-renderer yt-formatted-string', // Formatted comment text
      'ytd-comment-thread-renderer yt-formatted-string', // Formatted text in thread
      '[id="content-text"]', // Generic content text
      'ytd-comment-renderer [id="content-text"]', // Content text in comment renderer
      'ytd-comment-thread-renderer [id="content-text"]' // Content text in thread
    ];
    
    const comments = [];
    const seenComments = new Set(); // To avoid duplicates
    
    for (const selector of commentSelectors) {
      const elements = document.querySelectorAll(selector);
      
      for (const element of elements) {
        const text = element.textContent?.trim();
        
        if (text && 
            text.length > 5 && 
            text.length < 1000 && 
            !seenComments.has(text)) {
          
          // Skip common YouTube UI text
          if (!text.includes('Show more') && 
              !text.includes('Load more') && 
              !text.includes('View replies') && 
              !text.includes('Reply') &&
              !text.includes('Like') &&
              !text.includes('Dislike') &&
              !text.includes('Share') &&
              !text.includes('Report')) {
            
            comments.push(text);
            seenComments.add(text);
          }
        }
      }
    }
    
    console.log(`Found ${comments.length} unique comments from DOM`);
    return comments;
  }

  /**
   * Loads comments with scrolling to get more
   */
  async loadCommentsWithScrolling() {
    const originalScrollTop = window.scrollY;
    const comments = [];
    
    try {
      console.log('Starting deep comment loading with targeted expansion...');
      
      // First, scroll to the comments section
      const commentsSection = document.querySelector('#comments');
      if (commentsSection) {
        console.log('Scrolling to comments section...');
        commentsSection.scrollIntoView({ behavior: 'smooth' });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Get initial comments
      const initialComments = await this.loadVisibleComments();
      comments.push(...initialComments);
      console.log(`Initial comments found: ${initialComments.length}`);
      
      // Try to expand comments with human-like scrolling
      console.log('Attempting to expand comments section with human-like scrolling...');
      let expansionAttempts = 0;
      const maxExpansionAttempts = 30; // Try for about 30 seconds
      
      while (expansionAttempts < maxExpansionAttempts) {
        // Update progress
        const progressPercent = Math.min(95, Math.round((expansionAttempts / maxExpansionAttempts) * 90));
        const currentCommentsCount = await this.loadVisibleComments();
        this.showDeepProgress(`Expanding comments... (${currentCommentsCount.length} found)`, progressPercent);
        
        let foundNewContent = false;
        
        // Look for "Load more" buttons in comments
        const loadMoreButtons = document.querySelectorAll('ytd-button-renderer, ytd-comments, ytd-comment-thread-renderer');
        for (const button of loadMoreButtons) {
          const buttonText = button.textContent?.toLowerCase() || '';
          if (buttonText.includes('load more') || buttonText.includes('show more')) {
            try {
              button.click();
              foundNewContent = true;
              console.log('Clicked load more button');
              await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 300)); // Reduced delay 0.5-0.8s
            } catch (error) {
              console.log('Failed to click load more button');
            }
          }
        }
        

        
        // Human-like scrolling - scroll slowly and naturally
        const currentHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
        const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
        const scrollStep = 600 + Math.random() * 400; // Increased step size 600-1000px (2x)
        
        // Scroll in smaller steps like a human would
        const targetScrollY = Math.min(currentScrollY + scrollStep, currentHeight);
        window.scrollTo({
          top: targetScrollY,
          behavior: 'smooth'
        });
        
        // Wait like a human would between scrolls
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 500)); // Reduced delay 0.8-1.3s
        
        // Check if we got more comments
        const currentComments = await this.loadVisibleComments();
        if (currentComments.length > comments.length) {
          console.log(`Found ${currentComments.length - comments.length} new comments`);
          comments.push(...currentComments.slice(comments.length));
        }
        
        // If no new content found for a while, stop
        if (!foundNewContent && expansionAttempts > 15) {
          console.log('No new content found, stopping expansion');
          break;
        }
        
        expansionAttempts++;
        // Random delay between attempts like a human
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 300));
      }
      
      console.log('Comments expansion completed');
      this.showDeepProgress('Comment expansion completed!', 100);
      
    } finally {
      // Restore scroll position
      window.scrollTo(0, originalScrollTop);
      // Clean up progress indicator
      this.removeDeepProgress();
    }
    
    // Remove duplicates
    const uniqueComments = [...new Set(comments)];
    console.log(`Found ${uniqueComments.length} unique comments with targeted expansion`);
    return uniqueComments;
  }



  /**
   * Shows progress for deep summarize operation
   */
  showDeepProgress(message, progressPercent) {
    // Remove existing progress indicator
    const existingProgress = document.getElementById('yt-summarize-deep-progress');
    if (existingProgress) {
      existingProgress.remove();
    }
    
    // Create progress container
    const progressContainer = document.createElement('div');
    progressContainer.id = 'yt-summarize-deep-progress';
    progressContainer.className = 'yt-summarize-deep-progress';
    
    // Create progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'yt-summarize-progress-bar';
    progressBar.style.width = `${progressPercent}%`;
    
    // Create message
    const messageElement = document.createElement('div');
    messageElement.className = 'yt-summarize-progress-message';
    messageElement.textContent = message;
    
    // Create time remaining estimate
    const timeElement = document.createElement('div');
    timeElement.className = 'yt-summarize-progress-time';
    const remainingSeconds = Math.max(0, Math.round((100 - progressPercent) * 0.3)); // Rough estimate
    timeElement.textContent = remainingSeconds > 0 ? `~${remainingSeconds}s remaining` : 'Completing...';
    
    // Assemble
    progressContainer.appendChild(progressBar);
    progressContainer.appendChild(messageElement);
    progressContainer.appendChild(timeElement);
    
    // Insert into page
    const commentsSection = document.querySelector('#comments');
    if (commentsSection) {
      const buttonContainer = commentsSection.querySelector('.yt-summarize-button-container');
      if (buttonContainer) {
        buttonContainer.parentNode.insertBefore(progressContainer, buttonContainer.nextSibling);
      } else {
        commentsSection.insertBefore(progressContainer, commentsSection.firstChild);
      }
    }
  }

  /**
   * Removes deep progress indicator
   */
  removeDeepProgress() {
    const progressElement = document.getElementById('yt-summarize-deep-progress');
    if (progressElement) {
      progressElement.remove();
    }
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
      'yt-summarize-temp-loading',
      'yt-summarize-deep-progress'
    ];
    
    elements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.remove();
      }
    });
    
    // Also remove any orphaned elements with our classes (but NOT buttons)
    const orphanedElements = document.querySelectorAll('.yt-summarize-box, .yt-summarize-loading, .yt-summarize-deep-progress');
    orphanedElements.forEach(element => {
      element.remove();
    });
    
    // Remove any elements with our data attributes
    const dataElements = document.querySelectorAll('[data-error="true"]');
    dataElements.forEach(element => {
      if (element.classList.contains('yt-summarize-box')) {
        element.remove();
      }
    });
  }

  /**
   * Handles navigation
   */
  handleNavigation() {
    this.isInitialized = false;
    this.removeSummaryBox();
    
    // Clear any ongoing operations
    this.setButtonProcessingState(false);
    this.removeTemporaryLoading();
    
    // Re-initialize after a short delay
    setTimeout(() => {
      this.initialize();
    }, 500);
    
    // Additional safety check after a longer delay
    setTimeout(() => {
      const commentsSection = document.querySelector('#comments');
      const buttons = commentsSection?.querySelector('.yt-summarize-button-container');
      if (commentsSection && !buttons) {
        this.forceReinitialize();
      }
    }, 2000);
  }

  /**
   * Ensures buttons are always present
   */
  ensureButtonsPresent() {
    const commentsSection = document.querySelector('#comments');
    if (commentsSection && !commentsSection.querySelector('.yt-summarize-button-container')) {
      this.injectButtons(commentsSection);
      this.isInitialized = true;
    }
  }

  /**
   * Force re-initialization if needed
   */
  forceReinitialize() {
    this.isInitialized = false;
    this.initialize();
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
          console.log('Watch page detected, triggering navigation reset');
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
  const maxAttempts = 5; // Increased attempts
  
  while (attempts < maxAttempts) {
    try {
      await controller.initialize();
      // Verify buttons are actually present
      const commentsSection = document.querySelector('#comments');
      const buttons = commentsSection?.querySelector('.yt-summarize-button-container');
      if (commentsSection && buttons) {
        break; // Success, exit loop
      } else {
        controller.isInitialized = false;
      }
    } catch (error) {
      console.error(`Initialization attempt ${attempts + 1} failed:`, error.message);
    }
    attempts++;
    if (attempts < maxAttempts) {
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Initialize extension on page load
initializeWithRetry();

// Set up navigation handling only on watch pages
if (window.location.pathname === '/watch') {
  controller.navigationHandler = new NavigationHandler(controller);
  controller.navigationHandler.init();
  
  // More aggressive periodic check to ensure buttons are always present
  setInterval(() => {
    if (window.location.pathname === '/watch') {
      const commentsSection = document.querySelector('#comments');
      const buttons = commentsSection?.querySelector('.yt-summarize-button-container');
      
      if (commentsSection && !buttons) {
        controller.forceReinitialize();
      }
    }
  }, 3000); // Check every 3 seconds
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

// Additional URL change detection
let currentUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== currentUrl) {
    console.log('URL changed from', currentUrl, 'to', window.location.href);
    currentUrl = window.location.href;
    if (window.location.pathname === '/watch') {
      controller.handleNavigation();
    }
  }
}, 1000); 