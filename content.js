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
      console.log('Buttons already exist, skipping injection');
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
    
    const button = createSecureButton();
    const deepButton = createDeepSummarizeButton();
    
    buttonContainer.appendChild(button);
    buttonContainer.appendChild(deepButton);
    
    // Use insertBefore instead of prepend for better compatibility
    const firstChild = commentsSection.firstElementChild;
    if (firstChild) {
      commentsSection.insertBefore(buttonContainer, firstChild);
    } else {
      commentsSection.appendChild(buttonContainer);
    }
    
    // Add event listener for regular summarize button
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
    
    // Add event listener for deep summarize button
    const handleDeepButtonClick = (e) => {
      try {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        deepSummarizeCommentsHandler();
      } catch (error) {
        console.error('Deep button click error:', error);
        showSummary('An error occurred. Please try again.', 0, true);
      }
    };
    
    button.addEventListener('click', handleButtonClick, { passive: false });
    deepButton.addEventListener('click', handleDeepButtonClick, { passive: false });
    
    // Add keyboard support for both buttons
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleButtonClick(e);
      }
    });
    
    deepButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleDeepButtonClick(e);
      }
    });
    
    console.log('Buttons injected successfully');
    
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

async function loadAllCommentsWithScrolling() {
  console.log('Loading comments with scrolling to get more data...');
  
  try {
    const commentsContainer = document.querySelector('#comments');
    if (!commentsContainer) {
      throw new Error('Comments container not found');
    }
    
    // Store original scroll position
    const originalScrollY = window.scrollY;
    let comments = findComments();
    console.log(`Initial comments found: ${comments.length}`);
    
    // Scroll down to load more comments (max 5 attempts)
    const maxScrollAttempts = 5;
    const scrollDelay = 2000; // 2 seconds between scrolls
    
    for (let i = 0; i < maxScrollAttempts; i++) {
      const beforeScrollCount = comments.length;
      
      // Scroll to the bottom of the comments section
      const commentsBottom = commentsContainer.getBoundingClientRect().bottom + window.scrollY;
      window.scrollTo({
        top: commentsBottom + 500,
        behavior: 'smooth'
      });
      
      // Wait for new comments to load
      await new Promise(resolve => setTimeout(resolve, scrollDelay));
      
      // Look for "Load more" button and click it
      const loadMoreButton = document.querySelector('ytd-continuation-item-renderer button') ||
                           document.querySelector('[aria-label*="Show more"]') ||
                           document.querySelector('[aria-label*="Load more"]');
      
      if (loadMoreButton && loadMoreButton.offsetParent !== null) {
        console.log(`Clicking load more button (attempt ${i + 1})`);
        loadMoreButton.click();
        await new Promise(resolve => setTimeout(resolve, scrollDelay));
      }
      
      // Get updated comment count
      comments = findComments();
      console.log(`After scroll attempt ${i + 1}: ${comments.length} comments`);
      
      // If we didn't get any new comments, stop scrolling
      if (comments.length <= beforeScrollCount) {
        console.log('No new comments loaded, stopping scroll attempts');
        break;
      }
      
      // If we have enough comments, stop early
      if (comments.length >= 200) {
        console.log('Reached comment limit, stopping scroll attempts');
        break;
      }
    }
    
    // Restore original scroll position
    window.scrollTo({
      top: originalScrollY,
      behavior: 'smooth'
    });
    
    console.log(`Final deep load result: ${comments.length} comments`);
    return comments.slice(0, 200); // Limit to prevent API overload
    
  } catch (error) {
    console.error('Error in deep comment loading:', error);
    // Fallback to regular comment loading
    return findComments().slice(0, 100);
  }
}

async function loadAllCommentsWithoutScrolling() {
  console.log('Loading visible comments without scrolling or clicking...');
  
  try {
    // Get only the comments that are already visible in the DOM
    const comments = findComments();
    console.log(`Found ${comments.length} visible comments`);
    
    if (comments.length === 0) {
      throw new Error('No visible comments found');
    }
    
    console.log(`Using ${comments.length} visible comments for quick analysis`);
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

async function deepSummarizeCommentsHandler() {
  console.log('Deep Summarize button clicked');

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

    console.log('Loading comments with deep analysis...');
    const comments = await loadAllCommentsWithScrolling();

    // Remove temporary loading message
    if (tempLoading && tempLoading.parentNode) {
      tempLoading.remove();
    }

    if (!comments || comments.length === 0) {
      throw new Error('No comments found to summarize');
    }

    console.log(`Found ${comments.length} comments via deep analysis, showing loading state...`);
    showLoading(comments.length);

    console.log('Sending comments to background script...');
    
    // Add timeout to prevent hanging (longer for deep analysis)
    const messagePromise = browser.runtime.sendMessage({
      type: 'summarize',
      comments: comments.slice(0, 200) // Allow more comments for deep analysis
    });
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timed out')), 90000) // 90 seconds for deep analysis
    );
    
    const response = await Promise.race([messagePromise, timeoutPromise]);
    console.log('Received response from background script:', response);

    if (response.error) {
      throw new Error(response.error);
    }

    if (response.summary) {
      console.log('Displaying deep summary...');
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