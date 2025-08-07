// content.js

// Configuration constants with enhanced security
const CONFIG = {
  waitTimeout: 10000, // 10 seconds max wait for comments section
  loadMoreAttempts: 3, // Reduced to prevent excessive DOM manipulation
  loadMoreDelay: 1500, // Slightly reduced delay
  navigationDelay: 1000,
  retryDelay: 500,
  maxButtonInjectionAttempts: 5,
  maxCleanupItems: 100 // Prevent memory leaks
};

// Enhanced comment selectors with fallbacks
const COMMENT_SELECTORS = [
  'ytd-comment-thread-renderer #content-text',
  '.comment-text',
  '[data-comment-text]',
  'ytd-comment-thread-renderer .style-scope.ytd-comment-renderer',
  '#content-text',
  'yt-formatted-string[slot="content"]'
];

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

function injectButton(commentsSection) {
  try {
    // Check if button already exists
    if (document.getElementById('summarize-comments-btn')) {
      console.log('Button already exists, skipping injection');
      return;
    }
    
    // Validate commentsSection
    if (!commentsSection || !commentsSection.isConnected) {
      throw new Error('Invalid comments section');
    }
    
    const button = createSecureButton();
    
    // Use insertBefore instead of prepend for better compatibility
    const firstChild = commentsSection.firstElementChild;
    if (firstChild) {
      commentsSection.insertBefore(button, firstChild);
    } else {
      commentsSection.appendChild(button);
    }
    
    // Add event listener with proper error handling
    const handleButtonClick = (e) => {
      try {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        summarizeCommentsHandler();
      } catch (error) {
        console.error('Button click error:', error);
        showSummary('An error occurred. Please try again.', 0, true);
      }
    };
    
    button.addEventListener('click', handleButtonClick, { passive: false });
    
    // Add keyboard support
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleButtonClick(e);
      }
    });
    
    console.log('Button injected successfully');
    
    // Add to cleanup registry
    addCleanup(() => {
      try {
        if (button && button.parentNode) {
          button.removeEventListener('click', handleButtonClick);
          button.removeEventListener('keydown', handleButtonClick);
          button.remove();
        }
      } catch (e) {
        console.warn('Button cleanup error:', e);
      }
    });
    
  } catch (error) {
    console.error('Failed to inject button:', error);
  }
}

function findComments() {
  const comments = [];
  const seenTexts = new Set(); // Prevent duplicates
  
  for (const selector of COMMENT_SELECTORS) {
    try {
      const elements = document.querySelectorAll(selector);
      
      for (const element of elements) {
        if (!element || !element.textContent) continue;
        
        const text = sanitizeText(element.textContent);
        if (text.length > 5 && !seenTexts.has(text)) {
          seenTexts.add(text);
          comments.push(text);
          
          // Limit total comments to prevent memory issues
          if (comments.length >= 200) {
            break;
          }
        }
      }
      
      if (comments.length > 0) {
        break; // Use first selector that finds comments
      }
    } catch (error) {
      console.warn(`Error with selector ${selector}:`, error);
    }
  }
  
  return comments;
}

async function loadAllCommentsWithoutScrolling() {
  console.log('Loading all comments with minimal interference...');
  
  try {
    // Get comments from the DOM without scrolling
    let comments = findComments();
    console.log(`Found ${comments.length} comments from DOM`);
    
    // If we have a reasonable number of comments, use them
    if (comments.length >= 10) {
      console.log(`Using ${comments.length} comments from DOM`);
      return comments.slice(0, 100); // Limit to prevent API overload
    }
    
    // If we have very few comments, try to load more by clicking "Load more" buttons
    console.log('Few comments found, trying to load more...');
    
    const loadMoreButtons = document.querySelectorAll(
      'ytd-button-renderer[is-secondary] button, [aria-label*="Load more"], [aria-label*="Show more"], #more-replies'
    );
    console.log(`Found ${loadMoreButtons.length} load more buttons`);
    
    let attempts = 0;
    const maxAttempts = Math.min(CONFIG.loadMoreAttempts, loadMoreButtons.length);
    
    while (attempts < maxAttempts) {
      const button = loadMoreButtons[attempts];
      if (!button || !button.isConnected) break;
      
      console.log('Clicking load more button...');
      try {
        // Check if button is still clickable
        if (!button.disabled && button.offsetParent !== null) {
          button.click();
          
          // Wait for new comments to load
          await new Promise(resolve => setTimeout(resolve, CONFIG.loadMoreDelay));
          
          // Get updated comment count
          const newComments = findComments();
          console.log(`After attempt ${attempts + 1}: ${newComments.length} comments`);
          
          if (newComments.length > comments.length) {
            comments = newComments;
          }
        }
      } catch (error) {
        console.warn('Error clicking load more button:', error);
      }
      
      attempts++;
    }
    
    console.log(`Final comment count: ${comments.length}`);
    return comments.slice(0, 100); // Limit to prevent API overload
    
  } catch (error) {
    console.error('Error loading comments:', error);
    throw new Error('Failed to load comments: ' + error.message);
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
  
  if (existingSummary) {
    existingSummary.remove();
  }
  
  if (existingLoading) {
    existingLoading.remove();
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
  loadingText.textContent = `Generating summary based on ${Math.min(commentCount, 100)} comments...`;
  
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
    titleElement.textContent = `Comments Summary (${Math.min(commentCount, 100)} comments)`;
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
  console.log('Summarize button clicked');

  try {
    // Disable button and show processing state
    const button = document.getElementById('summarize-comments-btn');
    if (button) {
      button.disabled = true;
      button.textContent = 'Processing...';
      button.setAttribute('aria-busy', 'true');
    }

    console.log('Loading comments...');
    const comments = await loadAllCommentsWithoutScrolling();

    if (!comments || comments.length === 0) {
      throw new Error('No comments found to summarize');
    }

    console.log(`Found ${comments.length} comments, showing loading state...`);
    showLoading(comments.length);

    console.log('Sending comments to background script...');
    
    // Add timeout to prevent hanging
    const messagePromise = browser.runtime.sendMessage({
      type: 'summarize',
      comments: comments.slice(0, 100) // Ensure we don't exceed limits
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timed out')), 60000)
    );
    
    const response = await Promise.race([messagePromise, timeoutPromise]);
    console.log('Received response from background script:', response);

    if (response.error) {
      throw new Error(response.error);
    }

    if (response.summary) {
      console.log('Displaying summary...');
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

// Enhanced Navigation handling with better error recovery
class NavigationHandler {
  constructor() {
    this.currentUrl = window.location.href;
    this.observer = null;
    this.isInitialized = false;
    this.initializationAttempts = 0;
  }

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
      console.log('Navigation handler initialized');
    } catch (error) {
      console.error('Failed to initialize navigation handler:', error);
    }
  }

  interceptHistoryAPI() {
    try {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = (...args) => {
        try {
          originalPushState.apply(history, args);
          setTimeout(() => this.handleNavigation(), 100);
        } catch (e) {
          console.warn('PushState override error:', e);
          originalPushState.apply(history, args);
        }
      };

      history.replaceState = (...args) => {
        try {
          originalReplaceState.apply(history, args);
          setTimeout(() => this.handleNavigation(), 100);
        } catch (e) {
          console.warn('ReplaceState override error:', e);
          originalReplaceState.apply(history, args);
        }
      };

      // Add to cleanup registry
      addCleanup(() => {
        try {
          history.pushState = originalPushState;
          history.replaceState = originalReplaceState;
        } catch (e) {
          console.warn('History API cleanup error:', e);
        }
      });
    } catch (error) {
      console.error('Failed to intercept history API:', error);
    }
  }

  setupMutationObserver() {
    try {
      this.observer = new MutationObserver((mutations) => {
        let shouldReinit = false;

        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            // Check if comments section was added or changed
            const commentsSection = document.querySelector('#comments');
            if (commentsSection && !document.getElementById('summarize-comments-btn')) {
              shouldReinit = true;
            }
          }
        });

        if (shouldReinit) {
          console.log('Comments section detected after navigation, injecting button...');
          this.initializeExtension();
        }
      });

      // Start observing with error handling
      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Add to cleanup registry
      addCleanup(() => {
        if (this.observer) {
          try {
            this.observer.disconnect();
            this.observer = null;
          } catch (e) {
            console.warn('Observer cleanup error:', e);
          }
        }
      });
    } catch (error) {
      console.error('Failed to setup mutation observer:', error);
    }
  }

  handleNavigation() {
    try {
      if (window.location.href !== this.currentUrl) {
        this.currentUrl = window.location.href;
        console.log('URL changed, re-initializing extension...');

        // Clean up old components
        performCleanup();

        // Wait for page to load, then re-initialize
        setTimeout(() => this.initializeExtension(), CONFIG.navigationDelay);
      }
    } catch (error) {
      console.error('Navigation handling error:', error);
    }
  }

  async initializeExtension() {
    try {
      this.initializationAttempts++;
      
      if (this.initializationAttempts > CONFIG.maxButtonInjectionAttempts) {
        console.warn('Max initialization attempts reached');
        return;
      }
      
      const commentsSection = await waitForCommentsSection();
      console.log('Comments section found, injecting button...');
      injectButton(commentsSection);
      
      // Reset attempts on success
      this.initializationAttempts = 0;
    } catch (error) {
      console.log('Comments section not found:', error.message);
    }
  }

  cleanup() {
    try {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      this.isInitialized = false;
      this.initializationAttempts = 0;
    } catch (error) {
      console.error('Navigation cleanup error:', error);
    }
  }
}

// Main initialization with error recovery
console.log('Content script loaded, initializing...');

const navigationHandler = new NavigationHandler();

// Function to initialize the extension (also used by navigation handler)
async function initializeExtension() {
  try {
    const commentsSection = await waitForCommentsSection();
    console.log('Comments section found, injecting button...');
    injectButton(commentsSection);
  } catch (error) {
    console.log('Comments section not found:', error.message);
  }
}

// Initialize extension on page load
initializeExtension();

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

// Additional cleanup for extension context invalidation
if (typeof browser !== 'undefined' && browser.runtime) {
  browser.runtime.onConnect.addListener(() => {
    // Extension context still valid
  });
} 