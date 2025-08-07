// content.js

// Optimized configuration constants for better performance
const CONFIG = {
  waitTimeout: 5000, // Reduced from 10s to 5s
  loadMoreAttempts: 2, // Reduced from 3 to 2
  loadMoreDelay: 1000, // Reduced from 1500ms to 1000ms
  navigationDelay: 500, // Reduced from 1000ms to 500ms
  retryDelay: 250, // Reduced from 500ms to 250ms
  maxButtonInjectionAttempts: 3, // Reduced from 5 to 3
  maxCleanupItems: 50, // Reduced from 100 to 50
  replyExpansionDelay: 1000, // New: shorter delay for reply expansion
  scrollDelay: 1500 // New: optimized scroll delay
};

// Optimized comment selectors - prioritize most common ones first
const COMMENT_SELECTORS = [
  // Most common selectors first for faster matching
  '#content-text',
  'ytd-comment-thread-renderer #content-text',
  '.comment-text',
  'yt-formatted-string[slot="content"]',
  // Reply selectors (less common, so lower priority)
  'ytd-comment-renderer ytd-comment-renderer #content-text',
  'ytd-comment-renderer ytd-comment-renderer .comment-text',
  // Fallback selectors last
  '[data-comment-text]',
  'ytd-comment-thread-renderer .style-scope.ytd-comment-renderer'
];

// Reply-specific selectors for better targeting
const REPLY_SELECTORS = [
  'ytd-comment-renderer ytd-comment-renderer #content-text',
  'ytd-comment-renderer ytd-comment-renderer .comment-text',
  'ytd-comment-renderer ytd-comment-renderer [data-comment-text]',
  'ytd-comment-renderer ytd-comment-renderer yt-formatted-string[slot="content"]',
  // Deep nested replies
  'ytd-comment-renderer ytd-comment-renderer ytd-comment-renderer #content-text',
  'ytd-comment-renderer ytd-comment-renderer ytd-comment-renderer .comment-text',
  'ytd-comment-renderer ytd-comment-renderer ytd-comment-renderer [data-comment-text]',
  'ytd-comment-renderer ytd-comment-renderer ytd-comment-renderer yt-formatted-string[slot="content"]',
  // Additional reply patterns
  '.ytd-comment-renderer .ytd-comment-renderer #content-text',
  '.ytd-comment-renderer .ytd-comment-renderer .comment-text',
  '.ytd-comment-renderer .ytd-comment-renderer [data-comment-text]',
  '.ytd-comment-renderer .ytd-comment-renderer yt-formatted-string[slot="content"]',
  // Thread-specific reply selectors
  'ytd-comment-thread-renderer ytd-comment-renderer #content-text',
  'ytd-comment-thread-renderer ytd-comment-renderer .comment-text',
  'ytd-comment-thread-renderer ytd-comment-renderer [data-comment-text]',
  'ytd-comment-thread-renderer ytd-comment-renderer yt-formatted-string[slot="content"]',
  // Deep nested replies in threads
  'ytd-comment-thread-renderer ytd-comment-renderer ytd-comment-renderer #content-text',
  'ytd-comment-thread-renderer ytd-comment-renderer ytd-comment-renderer .comment-text',
  'ytd-comment-thread-renderer ytd-comment-renderer ytd-comment-renderer [data-comment-text]',
  'ytd-comment-thread-renderer ytd-comment-renderer ytd-comment-renderer yt-formatted-string[slot="content"]'
];

// Cache for DOM queries to avoid repeated lookups
const DOM_CACHE = {
  commentsSection: null,
  lastCacheTime: 0,
  cacheTimeout: 5000 // 5 seconds cache
};

function getCachedCommentsSection() {
  const now = Date.now();
  if (!DOM_CACHE.commentsSection || (now - DOM_CACHE.lastCacheTime) > DOM_CACHE.cacheTimeout) {
    DOM_CACHE.commentsSection = document.querySelector('#comments');
    DOM_CACHE.lastCacheTime = now;
  }
  return DOM_CACHE.commentsSection;
}

// Global cleanup registry with size limits
const cleanupRegistry = new Set();
let isCleaningUp = false;

function addCleanup(cleanupFn) {
  if (cleanupRegistry.size >= CONFIG.maxCleanupItems) {
    // Remove oldest cleanup functions to prevent memory leaks
    const iterator = cleanupRegistry.values();
    const oldestFn = iterator.next().value;
    cleanupRegistry.delete(oldestFn);
  }
  cleanupRegistry.add(cleanupFn);
}

function performCleanup() {
  if (isCleaningUp) return; // Prevent recursive cleanup
  isCleaningUp = true;
  
  try {
    // Remove any existing summary boxes and loading states
    removeSummaryBox();
    
    // Remove any temporary loading elements
    const tempLoading = document.getElementById('yt-summarize-temp-loading');
    if (tempLoading && tempLoading.parentNode) {
      tempLoading.remove();
    }
    
    // Remove any existing buttons
    const buttonContainer = document.getElementById('yt-summarize-button-container');
    if (buttonContainer && buttonContainer.parentNode) {
      buttonContainer.remove();
    }
    
    // Run registered cleanup functions
    cleanupRegistry.forEach(fn => {
      try {
        if (typeof fn === 'function') {
          fn();
        }
      } catch (e) {
        console.warn('Cleanup error:', e);
      }
    });
    cleanupRegistry.clear();
    
  } catch (e) {
    console.error('Critical cleanup error:', e);
  } finally {
    isCleaningUp = false;
  }
}

function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\u0000/g, '') // Remove null bytes
    .trim()
    .substring(0, 2000); // Limit length
}

function waitForCommentsSection() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = Math.floor(CONFIG.waitTimeout / CONFIG.retryDelay);
    
    const checkForComments = () => {
      attempts++;
      
      if (attempts > maxAttempts) {
        reject(new Error('Comments section not found within timeout'));
        return;
      }
      
      const commentsSection = document.querySelector('#comments');
      if (commentsSection && commentsSection.offsetParent !== null) {
        resolve(commentsSection);
      } else {
        setTimeout(checkForComments, CONFIG.retryDelay);
      }
    };
    
    checkForComments();
  });
}

function createSecureButton() {
  const button = document.createElement('button');
  button.id = 'summarize-comments-btn';
  button.className = 'yt-summarize-btn';
  button.type = 'button';
  button.textContent = 'Summarize Comments';
  button.setAttribute('role', 'button');
  button.setAttribute('aria-label', 'Summarize YouTube comments using AI');
  button.setAttribute('tabindex', '0');
  
  return button;
}

function createDeepSummarizeButton() {
  const button = document.createElement('button');
  button.id = 'deep-summarize-comments-btn';
  button.className = 'yt-summarize-btn yt-summarize-btn-secondary';
  button.type = 'button';
  button.textContent = 'Deep Summarize';
  button.setAttribute('role', 'button');
  button.setAttribute('aria-label', 'Load more comments and summarize using AI');
  button.setAttribute('tabindex', '0');
  
  return button;
}

function injectButton(commentsSection) {
  try {
    // Check if buttons already exist
    if (document.getElementById('summarize-comments-btn')) {
      return;
    }
    
    // Validate commentsSection
    if (!commentsSection || !commentsSection.isConnected) {
      throw new Error('Invalid comments section');
    }
    
    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'yt-summarize-button-container';
    buttonContainer.className = 'yt-summarize-button-container';
    
    // Create main summarize button
    const button = createSecureButton();
    const deepButton = createDeepSummarizeButton();
    
    // Add event listeners
    const handleButtonClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      summarizeCommentsHandler();
    };
    
    const handleDeepButtonClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      deepSummarizeCommentsHandler();
    };
    
    button.addEventListener('click', handleButtonClick);
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleButtonClick(e);
      }
    });
    
    deepButton.addEventListener('click', handleDeepButtonClick);
    deepButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleDeepButtonClick(e);
      }
    });
    
    // Add buttons to container
    buttonContainer.appendChild(button);
    buttonContainer.appendChild(deepButton);
    
    // Insert before the first comment
    const firstComment = commentsSection.querySelector('ytd-comment-thread-renderer');
    if (firstComment) {
      commentsSection.insertBefore(buttonContainer, firstComment);
    } else {
      commentsSection.appendChild(buttonContainer);
    }
    
    // Add to cleanup registry
    addCleanup(() => {
      try {
        if (buttonContainer && buttonContainer.parentNode) {
          button.removeEventListener('click', handleButtonClick);
          button.removeEventListener('keydown', handleButtonClick);
          deepButton.removeEventListener('click', handleDeepButtonClick);
          deepButton.removeEventListener('keydown', handleDeepButtonClick);
          buttonContainer.remove();
        }
      } catch (e) {
        console.warn('Button cleanup error:', e);
      }
    });
    
  } catch (error) {
    console.error('Failed to inject buttons:', error);
  }
}

// Optimized comment finding with early termination
async function findComments() {
  const comments = [];
  const seenTexts = new Set();
  
  // Expand replies only if we have comments
  const initialComments = await findCommentsWithoutExpanding();
  if (initialComments.length > 0) {
    await expandReplyThreads();
  }
  
  // Use cached DOM queries
  const commentsSection = getCachedCommentsSection();
  if (!commentsSection) return comments;
  
  // Try most efficient selector first
  const elements = commentsSection.querySelectorAll('#content-text');
  if (elements.length > 0) {
    for (const element of elements) {
      if (!element || !element.textContent) continue;
      
      const text = sanitizeText(element.textContent);
      if (text.length > 5 && !seenTexts.has(text)) {
        seenTexts.add(text);
        comments.push(text);
        
        if (comments.length >= 200) break;
      }
    }
    return comments;
  }
  
  // Fallback to other selectors only if needed
  for (const selector of COMMENT_SELECTORS.slice(1)) {
    try {
      const elements = commentsSection.querySelectorAll(selector);
      
      for (const element of elements) {
        if (!element || !element.textContent) continue;
        
        const text = sanitizeText(element.textContent);
        if (text.length > 5 && !seenTexts.has(text)) {
          seenTexts.add(text);
          comments.push(text);
          
          if (comments.length >= 200) break;
        }
      }
      
      if (comments.length > 0) break;
    } catch (error) {
      console.warn(`Error with selector ${selector}:`, error);
    }
  }
  
  return comments;
}

// Fast comment finding without reply expansion
async function findCommentsWithoutExpanding() {
  const comments = [];
  const seenTexts = new Set();
  
  const commentsSection = getCachedCommentsSection();
  if (!commentsSection) return comments;
  
  // Use only the most efficient selector for quick check
  const elements = commentsSection.querySelectorAll('#content-text');
  
  for (const element of elements) {
    if (!element || !element.textContent) continue;
    
    const text = sanitizeText(element.textContent);
    if (text.length > 5 && !seenTexts.has(text)) {
      seenTexts.add(text);
      comments.push(text);
      
      if (comments.length >= 50) break; // Lower limit for quick check
    }
  }
  
  return comments;
}

// Debounced reply expansion to prevent excessive clicking
let replyExpansionTimeout = null;

async function expandReplyThreads() {
  try {
    // Debounce reply expansion to prevent multiple rapid calls
    if (replyExpansionTimeout) {
      clearTimeout(replyExpansionTimeout);
    }
    
    replyExpansionTimeout = setTimeout(async () => {
      // Use more efficient button detection
      const replyButtons = document.querySelectorAll('[aria-label*="reply"], [aria-label*="replies"]');
      
      // Process buttons in batches to avoid blocking
      const batchSize = 3;
      for (let i = 0; i < replyButtons.length; i += batchSize) {
        const batch = Array.from(replyButtons).slice(i, i + batchSize);
        
        for (const button of batch) {
          if (button && button.offsetParent !== null && !button.disabled) {
            button.click();
            await new Promise(resolve => setTimeout(resolve, 100)); // Shorter delay
          }
        }
        
        // Small delay between batches
        if (i + batchSize < replyButtons.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // Shorter wait time for replies to load
      await new Promise(resolve => setTimeout(resolve, CONFIG.replyExpansionDelay));
      
    }, 100); // Small debounce delay
    
  } catch (error) {
    console.warn('Error expanding reply threads:', error);
  }
}

async function loadAllCommentsWithScrolling() {
  try {
    const commentsContainer = getCachedCommentsSection();
    if (!commentsContainer) {
      throw new Error('Comments container not found');
    }
    
    // Store original scroll position
    const originalScrollY = window.scrollY;
    let comments = await findComments();
    
    // Reduced scroll attempts for better performance
    const maxScrollAttempts = 3; // Reduced from 5 to 3
    
    for (let i = 0; i < maxScrollAttempts; i++) {
      const beforeScrollCount = comments.length;
      
      // More efficient scrolling - scroll to specific position
      const commentsBottom = commentsContainer.getBoundingClientRect().bottom + window.scrollY;
      window.scrollTo({
        top: commentsBottom + 300, // Reduced from 500 to 300
        behavior: 'auto' // Use 'auto' instead of 'smooth' for faster scrolling
      });
      
      // Shorter wait time
      await new Promise(resolve => setTimeout(resolve, CONFIG.scrollDelay));
      
      // Expand replies only if we have comments
      const newComments = await findCommentsWithoutExpanding();
      if (newComments.length > 0) {
        await expandReplyThreads();
      }
      
      // Look for "Load more" button and click it
      const loadMoreButton = document.querySelector('ytd-continuation-item-renderer button') ||
                           document.querySelector('[aria-label*="Show more"]') ||
                           document.querySelector('[aria-label*="Load more"]');
      
      if (loadMoreButton && loadMoreButton.offsetParent !== null) {
        loadMoreButton.click();
        await new Promise(resolve => setTimeout(resolve, CONFIG.scrollDelay));
        
        // Expand replies again after loading more comments
        await expandReplyThreads();
      }
      
      // Get updated comment count
      comments = await findComments();
      
      // If we didn't get any new comments, stop scrolling
      if (comments.length <= beforeScrollCount) {
        break;
      }
      
      // If we have enough comments, stop early
      if (comments.length >= 150) { // Reduced from 200 to 150
        break;
      }
    }
    
    // Restore original scroll position
    window.scrollTo({
      top: originalScrollY,
      behavior: 'auto' // Use 'auto' for faster restoration
    });
    
    return comments.slice(0, 150); // Reduced limit
    
  } catch (error) {
    console.error('Error loading comments with scrolling:', error);
    throw new Error('Failed to load comments with scrolling: ' + error.message);
  }
}

async function loadAllCommentsWithoutScrolling() {
  try {
    // Get only the comments that are already visible in the DOM
    const comments = await findComments();
    
    if (comments.length === 0) {
      throw new Error('No visible comments found');
    }
    
    return comments.slice(0, 100); // Limit to prevent API overload
    
  } catch (error) {
    console.error('Error loading visible comments:', error);
    throw new Error('Failed to load visible comments: ' + error.message);
  }
}

// Legacy function for compatibility
function getAllComments() {
  return findComments();
}

function removeSummaryBox() {
  // Remove any existing summary or loading boxes
  const existingSummary = document.getElementById('yt-summarize-summary');
  const existingLoading = document.getElementById('yt-summarize-loading');
  const tempLoading = document.getElementById('yt-summarize-temp-loading');
  
  if (existingSummary) {
    existingSummary.remove();
  }
  
  if (existingLoading) {
    existingLoading.remove();
  }
  
  if (tempLoading) {
    tempLoading.remove();
  }
  
  // Also remove any legacy boxes that might exist
  const legacySummary = document.getElementById('summary-box');
  const legacyLoading = document.getElementById('summary-loading-box');
  
  if (legacySummary) {
    legacySummary.remove();
  }
  
  if (legacyLoading) {
    legacyLoading.remove();
  }
  
  // Remove any elements with our CSS classes that might be orphaned
  const orphanedElements = document.querySelectorAll('.yt-summarize-box, .yt-summarize-loading, .yt-summarize-spinner');
  orphanedElements.forEach(element => {
    if (element.parentNode) {
      element.remove();
    }
  });
}

function showLoading(commentCount) {
  // Remove any existing summary or loading box
  removeSummaryBox();

  const commentsSection = document.querySelector('#comments');
  if (!commentsSection) return;

  const loadingBox = document.createElement('div');
  loadingBox.id = 'yt-summarize-loading';
  loadingBox.className = 'yt-summarize-loading';
  loadingBox.setAttribute('role', 'status');
  loadingBox.setAttribute('aria-live', 'polite');
  
  const loadingText = document.createElement('div');
  const displayCount = Math.min(commentCount, 200);
  const analysisType = commentCount > 100 ? 'Deep analysis' : 'Analysis';
  loadingText.textContent = `${analysisType} - generating summary from ${displayCount} comments...`;
  
  const loadingSpinner = document.createElement('div');
  loadingSpinner.className = 'yt-summarize-spinner';
  loadingSpinner.setAttribute('aria-hidden', 'true');
  
  loadingBox.appendChild(loadingText);
  loadingBox.appendChild(loadingSpinner);
  
  commentsSection.insertBefore(loadingBox, commentsSection.firstChild);

  // Add to cleanup registry
  addCleanup(() => {
    const box = document.getElementById('yt-summarize-loading');
    if (box) box.remove();
  });
}

function showSummary(summary, commentCount, isError = false) {
  // Remove loading box
  removeSummaryBox();

  const commentsSection = document.querySelector('#comments');
  if (!commentsSection) return;

  const summaryBox = document.createElement('div');
  summaryBox.id = 'yt-summarize-summary';
  summaryBox.className = 'yt-summarize-box';
  summaryBox.setAttribute('role', 'article');
  summaryBox.setAttribute('aria-label', 'Comment summary');
  
  // Set error state if needed
  if (isError) {
    summaryBox.setAttribute('data-error', 'true');
  }

  const titleElement = document.createElement('div');
  titleElement.className = 'yt-summarize-title';
  if (isError) {
    titleElement.textContent = 'Error';
  } else {
    const displayCount = Math.min(commentCount, 200);
    const analysisType = commentCount > 100 ? 'Deep Analysis' : 'Summary';
    titleElement.textContent = `Comments ${analysisType} (${displayCount} comments)`;
  }

  const contentElement = document.createElement('div');
  contentElement.className = 'yt-summarize-content';
  contentElement.textContent = sanitizeText(summary);

  summaryBox.appendChild(titleElement);
  summaryBox.appendChild(contentElement);

  commentsSection.insertBefore(summaryBox, commentsSection.firstChild);

  // Add to cleanup registry
  addCleanup(() => {
    const box = document.getElementById('yt-summarize-summary');
    if (box) box.remove();
  });
}

async function summarizeCommentsHandler() {
  try {
    // Disable button and show processing state
    const button = document.getElementById('summarize-comments-btn');
    if (button) {
      button.disabled = true;
      button.textContent = 'Processing...';
      button.setAttribute('aria-busy', 'true');
    }

    const comments = await loadAllCommentsWithoutScrolling();

    if (!comments || comments.length === 0) {
      throw new Error('No comments found to summarize');
    }

    showLoading(comments.length);

    // Add timeout to prevent hanging
    const messagePromise = browser.runtime.sendMessage({
      type: 'summarize',
      comments: comments.slice(0, 100) // Ensure we don't exceed limits
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timed out')), 60000)
    );
    
    const response = await Promise.race([messagePromise, timeoutPromise]);

    if (response.error) {
      throw new Error(response.error);
    }

    if (response.summary) {
      showSummary(response.summary, comments.length, false);
    } else {
      throw new Error('No summary returned from API');
    }

  } catch (error) {
    console.error('Error in summarizeCommentsHandler:', error);
    removeSummaryBox();
    showSummary(error.message, 0, true);
  } finally {
    // Re-enable button
    const button = document.getElementById('summarize-comments-btn');
    if (button) {
      button.disabled = false;
      button.textContent = 'Summarize Comments';
      button.setAttribute('aria-busy', 'false');
    }
  }
}

async function deepSummarizeCommentsHandler() {
  try {
    // Disable both buttons and show processing state
    const button = document.getElementById('summarize-comments-btn');
    const deepButton = document.getElementById('deep-summarize-comments-btn');
    
    [button, deepButton].forEach(btn => {
      if (btn) {
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
      }
    });
    
    if (deepButton) {
      deepButton.textContent = 'Loading more...';
    }
    if (button) {
      button.textContent = 'Processing...';
    }

    // Show initial loading message
    const tempLoading = document.createElement('div');
    tempLoading.id = 'yt-summarize-temp-loading';
    tempLoading.className = 'yt-summarize-loading';
    tempLoading.textContent = 'Scrolling to load more comments...';
    
    const commentsSection = document.querySelector('#comments');
    if (commentsSection) {
      commentsSection.insertBefore(tempLoading, commentsSection.firstChild);
    }

    const comments = await loadAllCommentsWithScrolling();

    // Remove temporary loading message
    if (tempLoading && tempLoading.parentNode) {
      tempLoading.remove();
    }

    if (!comments || comments.length === 0) {
      throw new Error('No comments found to summarize');
    }

    showLoading(comments.length);

    // Add timeout to prevent hanging (longer for deep analysis)
    const messagePromise = browser.runtime.sendMessage({
      type: 'summarize',
      comments: comments.slice(0, 200) // Allow more comments for deep analysis
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timed out')), 90000) // 90 seconds for deep analysis
    );
    
    const response = await Promise.race([messagePromise, timeoutPromise]);

    if (response.error) {
      throw new Error(response.error);
    }

    if (response.summary) {
      showSummary(response.summary, comments.length, false);
    } else {
      throw new Error('No summary returned from API');
    }

  } catch (error) {
    console.error('Error in deepSummarizeCommentsHandler:', error);
    removeSummaryBox();
    
    // Remove temporary loading if it exists
    const tempLoading = document.getElementById('yt-summarize-temp-loading');
    if (tempLoading && tempLoading.parentNode) {
      tempLoading.remove();
    }
    
    showSummary(error.message, 0, true);
  } finally {
    // Re-enable both buttons
    const button = document.getElementById('summarize-comments-btn');
    const deepButton = document.getElementById('deep-summarize-comments-btn');
    
    if (button) {
      button.disabled = false;
      button.textContent = 'Summarize Comments';
      button.setAttribute('aria-busy', 'false');
    }
    
    if (deepButton) {
      deepButton.disabled = false;
      deepButton.textContent = 'Deep Summarize';
      deepButton.setAttribute('aria-busy', 'false');
    }
  }
}

// Enhanced Navigation handling with throttling for better performance
class NavigationHandler {
  constructor() {
    this.currentUrl = window.location.href;
    this.observer = null;
    this.isInitialized = false;
    this.initializationAttempts = 0;
    this.navigationThrottle = null;
  }

  init() {
    if (this.isInitialized) return;

    try {
      // Listen for browser navigation events with throttling
      window.addEventListener('popstate', this.handleNavigation.bind(this), { passive: true });

      // Override pushState and replaceState to catch programmatic navigation
      this.interceptHistoryAPI();

      // Set up MutationObserver for DOM changes
      this.setupMutationObserver();

      this.isInitialized = true;
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
    } catch (error) {
      console.error('Failed to intercept history API:', error);
    }
  }

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
      console.error('Failed to setup mutation observer:', error);
    }
  }

  handleNavigation() {
    // Throttle navigation handling to prevent excessive calls
    if (this.navigationThrottle) {
      clearTimeout(this.navigationThrottle);
    }
    
    this.navigationThrottle = setTimeout(() => {
      try {
        if (window.location.href !== this.currentUrl) {
          this.currentUrl = window.location.href;

          // Remove any existing summary boxes immediately
          removeSummaryBox();
          
          // Clean up old components
          performCleanup();

          // Wait for page to load, then re-initialize
          setTimeout(() => this.initializeExtension(), CONFIG.navigationDelay);
        }
      } catch (error) {
        console.error('Navigation handling error:', error);
      }
    }, 100); // 100ms throttle
  }

  async initializeExtension() {
    try {
      this.initializationAttempts++;
      
      if (this.initializationAttempts > CONFIG.maxButtonInjectionAttempts) {
        return;
      }
      
      const commentsSection = await waitForCommentsSection();
      if (commentsSection) {
        injectButton(commentsSection);
        // Reset attempts on success
        this.initializationAttempts = 0;
      }
    } catch (error) {
      // Comments section not found, will retry
      console.warn('Navigation: Comments section not found, will retry:', error.message);
    }
  }

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
      console.error('Navigation cleanup error:', error);
    }
  }
}

// Main initialization with error recovery

const navigationHandler = new NavigationHandler();

// Function to initialize the extension (also used by navigation handler)
async function initializeExtension() {
  try {
    const commentsSection = await waitForCommentsSection();
    if (commentsSection) {
      injectButton(commentsSection);
    }
  } catch (error) {
    // Comments section not found, will retry
    console.warn('Comments section not found, will retry:', error.message);
  }
}

// Initialize extension on page load with retry
async function initializeWithRetry() {
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      await initializeExtension();
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
  navigationHandler.init();
}

// Enhanced cleanup on page unload
window.addEventListener('beforeunload', () => {
  try {
    performCleanup();
    navigationHandler.cleanup();
  } catch (error) {
    console.error('Unload cleanup error:', error);
  }
}, { passive: true });

// Handle page visibility changes (tab switching, minimizing, etc.)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    try {
      removeSummaryBox();
    } catch (error) {
      console.error('Visibility change cleanup error:', error);
    }
  }
}, { passive: true });

// Additional cleanup for extension context invalidation
if (typeof browser !== 'undefined' && browser.runtime) {
  browser.runtime.onConnect.addListener(() => {
    // Extension context still valid
  });
} 