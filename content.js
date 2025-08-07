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

// Enhanced comment selectors with fallbacks - now includes replies
const COMMENT_SELECTORS = [
  // Main comments
  'ytd-comment-thread-renderer #content-text',
  '.comment-text',
  '[data-comment-text]',
  'ytd-comment-thread-renderer .style-scope.ytd-comment-renderer',
  '#content-text',
  'yt-formatted-string[slot="content"]',
  // Reply comments
  'ytd-comment-renderer ytd-comment-renderer #content-text',
  'ytd-comment-renderer ytd-comment-renderer .comment-text',
  'ytd-comment-renderer ytd-comment-renderer [data-comment-text]',
  'ytd-comment-renderer ytd-comment-renderer yt-formatted-string[slot="content"]',
  // Nested replies (replies to replies)
  'ytd-comment-renderer ytd-comment-renderer ytd-comment-renderer #content-text',
  'ytd-comment-renderer ytd-comment-renderer ytd-comment-renderer .comment-text',
  'ytd-comment-renderer ytd-comment-renderer ytd-comment-renderer [data-comment-text]',
  'ytd-comment-renderer ytd-comment-renderer ytd-comment-renderer yt-formatted-string[slot="content"]',
  // Additional reply patterns
  '.ytd-comment-renderer .ytd-comment-renderer #content-text',
  '.ytd-comment-renderer .ytd-comment-renderer .comment-text',
  '.ytd-comment-renderer .ytd-comment-renderer [data-comment-text]',
  '.ytd-comment-renderer .ytd-comment-renderer yt-formatted-string[slot="content"]',
  // More specific reply selectors
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

async function findComments() {
  const comments = [];
  const seenTexts = new Set(); // Prevent duplicates
  
  // First, try to expand reply threads to capture more replies
  await expandReplyThreads();
  
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

async function expandReplyThreads() {
  try {
    // Comprehensive reply button patterns in multiple languages
    const replyButtonPatterns = [
      // English
      '[aria-label*="View replies"]', '[aria-label*="Show replies"]', '[aria-label*="Replies"]', '[aria-label*="reply"]',
      '[aria-label*="View reply"]', '[aria-label*="Show reply"]', '[aria-label*="Reply"]',
      // Spanish
      '[aria-label*="Ver respuestas"]', '[aria-label*="Mostrar respuestas"]', '[aria-label*="Respuestas"]', '[aria-label*="respuesta"]',
      // French
      '[aria-label*="Voir les réponses"]', '[aria-label*="Afficher les réponses"]', '[aria-label*="Réponses"]', '[aria-label*="réponse"]',
      // German
      '[aria-label*="Antworten anzeigen"]', '[aria-label*="Antworten"]', '[aria-label*="antwort"]',
      // Portuguese
      '[aria-label*="Ver respostas"]', '[aria-label*="Mostrar respostas"]', '[aria-label*="Respostas"]',
      // Italian
      '[aria-label*="Visualizza risposte"]', '[aria-label*="Mostra risposte"]', '[aria-label*="Risposte"]',
      // Japanese
      '[aria-label*="返信を表示"]', '[aria-label*="返信"]',
      // Korean
      '[aria-label*="답글 보기"]', '[aria-label*="답글"]',
      // Chinese
      '[aria-label*="查看回复"]', '[aria-label*="显示回复"]', '[aria-label*="回复"]',
      // Russian
      '[aria-label*="Показать ответы"]', '[aria-label*="Ответы"]',
      // Generic patterns
      '[aria-label*="replies"]', '[aria-label*="reply"]', '[aria-label*="responses"]', '[aria-label*="response"]',
      '[aria-label*="comments"]', '[aria-label*="comment"]',
      // Button text patterns
      'button:contains("replies")', 'button:contains("reply")', 'button:contains("responses")', 'button:contains("response")',
      // More generic patterns
      '[role="button"][aria-label*="reply"]', '[role="button"][aria-label*="replies"]',
      // YouTube-specific patterns
      '[data-purpose="view-replies"]', '[data-purpose="show-replies"]',
      // Fallback: any button with reply-related text
      'button[aria-label*="reply"]', 'button[aria-label*="replies"]', 'button[aria-label*="response"]', 'button[aria-label*="responses"]'
    ];
    
    // Look for "View replies" buttons and click them
    const viewRepliesButtons = document.querySelectorAll(replyButtonPatterns.join(', '));
    
    // Also check for buttons by text content
    const allButtons = document.querySelectorAll('button, [role="button"]');
    const textBasedReplyButtons = [];
    
    allButtons.forEach(button => {
      const text = (button.textContent || button.ariaLabel || '').toLowerCase();
      if (text.includes('reply') || text.includes('replies') || text.includes('response') || text.includes('responses') ||
          text.includes('respuesta') || text.includes('réponse') || text.includes('antwort') || text.includes('resposta') ||
          text.includes('risposta') || text.includes('返信') || text.includes('답글') || text.includes('回复') || text.includes('ответ')) {
        textBasedReplyButtons.push(button);
      }
    });
    
    // Combine both sets of buttons
    const allReplyButtons = [...viewRepliesButtons, ...textBasedReplyButtons];
    const uniqueButtons = [...new Set(allReplyButtons)]; // Remove duplicates
    
    for (const button of uniqueButtons) {
      if (button && button.offsetParent !== null && !button.disabled) {
        button.click();
        // Small delay between clicks to avoid overwhelming the page
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Also look for "Show more replies" buttons with multiple language patterns
    const moreRepliesPatterns = [
      // English
      '[aria-label*="Show more replies"]', '[aria-label*="Load more replies"]', '[aria-label*="more replies"]',
      // Spanish
      '[aria-label*="Mostrar más respuestas"]', '[aria-label*="Cargar más respuestas"]',
      // French
      '[aria-label*="Afficher plus de réponses"]', '[aria-label*="Charger plus de réponses"]',
      // German
      '[aria-label*="Mehr Antworten anzeigen"]', '[aria-label*="Weitere Antworten laden"]',
      // Generic
      '[aria-label*="more replies"]', '[aria-label*="load more"]', '[aria-label*="show more"]'
    ];
    
    const showMoreRepliesButtons = document.querySelectorAll(moreRepliesPatterns.join(', '));
    
    for (const button of showMoreRepliesButtons) {
      if (button && button.offsetParent !== null && !button.disabled) {
        button.click();
        // Small delay between clicks to avoid overwhelming the page
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Wait a bit for replies to load
    await new Promise(resolve => setTimeout(resolve, 1500));
    
  } catch (error) {
    console.warn('Error expanding reply threads:', error);
  }
}

async function loadAllCommentsWithScrolling() {
  try {
    const commentsContainer = document.querySelector('#comments');
    if (!commentsContainer) {
      throw new Error('Comments container not found');
    }
    
    // Store original scroll position
    const originalScrollY = window.scrollY;
    let comments = await findComments();
    
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
      
      // Expand reply threads to capture more replies
      await expandReplyThreads();
      
      // Look for "Load more" button and click it
      const loadMoreButton = document.querySelector('ytd-continuation-item-renderer button') ||
                           document.querySelector('[aria-label*="Show more"]') ||
                           document.querySelector('[aria-label*="Load more"]');
      
      if (loadMoreButton && loadMoreButton.offsetParent !== null) {
        loadMoreButton.click();
        await new Promise(resolve => setTimeout(resolve, scrollDelay));
        
        // Expand reply threads again after loading more comments
        await expandReplyThreads();
      }
      
      // Get updated comment count
      comments = await findComments();
      
      // If we didn't get any new comments, stop scrolling
      if (comments.length <= beforeScrollCount) {
        break;
      }
      
      // If we have enough comments, stop early
      if (comments.length >= 200) {
        break;
      }
    }
    
    // Restore original scroll position
    window.scrollTo({
      top: originalScrollY,
      behavior: 'smooth'
    });
    
    return comments.slice(0, 200); // Limit to prevent API overload
    
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
  }

  async initializeExtension() {
    try {
      this.initializationAttempts++;
      
      if (this.initializationAttempts > CONFIG.maxButtonInjectionAttempts) {
        console.warn('Max initialization attempts reached');
        return;
      }
      
      const commentsSection = await waitForCommentsSection();
      injectButton(commentsSection);
      
      // Reset attempts on success
      this.initializationAttempts = 0;
    } catch (error) {
      // Comments section not found, will retry
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

const navigationHandler = new NavigationHandler();

// Function to initialize the extension (also used by navigation handler)
async function initializeExtension() {
  try {
    const commentsSection = await waitForCommentsSection();
    injectButton(commentsSection);
  } catch (error) {
    // Comments section not found, will retry
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