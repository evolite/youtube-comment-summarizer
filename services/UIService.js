// services/UIService.js - UI management and interactions

import { DOMUtils, Logger, CONSTANTS } from '../utils.js';

/**
 * Service for handling UI operations and DOM manipulations
 */
export class UIService {
  constructor() {
    this.cleanupRegistry = new Set();
    this.isCleaningUp = false;
  }

  /**
   * Adds a cleanup function to the registry
   * @param {Function} cleanupFunction - Function to call during cleanup
   */
  addCleanup(cleanupFunction) {
    if (this.cleanupRegistry.size >= CONSTANTS.PERFORMANCE.MAX_CLEANUP_ITEMS) {
      // Remove oldest cleanup functions to prevent memory leaks
      const iterator = this.cleanupRegistry.values();
      const oldestFunction = iterator.next().value;
      this.cleanupRegistry.delete(oldestFunction);
    }
    this.cleanupRegistry.add(cleanupFunction);
  }

  /**
   * Performs comprehensive cleanup of UI elements
   */
  performCleanup() {
    if (this.isCleaningUp) return; // Prevent recursive cleanup
    this.isCleaningUp = true;
    
    try {
      // Remove any existing summary boxes and loading states
      this.removeSummaryBox();
      
      // Remove any temporary loading elements
      const tempLoading = document.getElementById('yt-summarize-temp-loading');
      DOMUtils.safeRemove(tempLoading);
      
      // Remove any existing buttons
      const buttonContainer = document.getElementById('yt-summarize-button-container');
      DOMUtils.safeRemove(buttonContainer);
      
      // Run registered cleanup functions
      this.cleanupRegistry.forEach(cleanupFunction => {
        try {
          if (typeof cleanupFunction === 'function') {
            cleanupFunction();
          }
        } catch (error) {
          Logger.warn('Cleanup error:', error);
        }
      });
      this.cleanupRegistry.clear();
      
    } catch (error) {
      Logger.error('Critical cleanup error:', error);
    } finally {
      this.isCleaningUp = false;
    }
  }

  /**
   * Creates a secure button element
   * @param {string} id - Button ID
   * @param {string} className - CSS class name
   * @param {string} text - Button text
   * @param {string} ariaLabel - Accessibility label
   * @returns {HTMLButtonElement} Created button
   */
  createSecureButton(id, className, text, ariaLabel) {
    const button = document.createElement('button');
    button.id = id;
    button.className = className;
    button.type = 'button';
    button.textContent = text;
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', ariaLabel);
    button.setAttribute('tabindex', '0');
    
    return button;
  }

  /**
   * Creates the main summarize button
   * @returns {HTMLButtonElement} Summarize button
   */
  createSummarizeButton() {
    return this.createSecureButton(
      'summarize-comments-btn',
      'yt-summarize-btn',
      'Summarize Comments',
      'Summarize YouTube comments using AI'
    );
  }

  /**
   * Creates the deep summarize button
   * @returns {HTMLButtonElement} Deep summarize button
   */
  createDeepSummarizeButton() {
    return this.createSecureButton(
      'deep-summarize-comments-btn',
      'yt-summarize-btn yt-summarize-btn-secondary',
      'Deep Summarize',
      'Load more comments and summarize using AI'
    );
  }

  /**
   * Injects buttons into the comments section
   * @param {Element} commentsSection - Comments section element
   * @param {Function} onSummarizeClick - Summarize button click handler
   * @param {Function} onDeepSummarizeClick - Deep summarize button click handler
   */
  injectButtons(commentsSection, onSummarizeClick, onDeepSummarizeClick) {
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
      const buttonContainer = DOMUtils.createElement('div', {
        id: 'yt-summarize-button-container',
        class: 'yt-summarize-button-container'
      });
      
      // Create buttons
      const summarizeButton = this.createSummarizeButton();
      const deepSummarizeButton = this.createDeepSummarizeButton();
      
      // Add event listeners
      const handleSummarizeClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        onSummarizeClick();
      };
      
      const handleDeepSummarizeClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        onDeepSummarizeClick();
      };
      
      summarizeButton.addEventListener('click', handleSummarizeClick);
      summarizeButton.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleSummarizeClick(event);
        }
      });
      
      deepSummarizeButton.addEventListener('click', handleDeepSummarizeClick);
      deepSummarizeButton.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleDeepSummarizeClick(event);
        }
      });
      
      // Add buttons to container
      buttonContainer.appendChild(summarizeButton);
      buttonContainer.appendChild(deepSummarizeButton);
      
      // Insert at the very beginning of the comments section
      commentsSection.insertBefore(buttonContainer, commentsSection.firstChild);
      
      // Add to cleanup registry
      this.addCleanup(() => {
        try {
          if (buttonContainer && buttonContainer.parentNode) {
            summarizeButton.removeEventListener('click', handleSummarizeClick);
            summarizeButton.removeEventListener('keydown', handleSummarizeClick);
            deepSummarizeButton.removeEventListener('click', handleDeepSummarizeClick);
            deepSummarizeButton.removeEventListener('keydown', handleDeepSummarizeClick);
            buttonContainer.remove();
          }
        } catch (error) {
          Logger.warn('Button cleanup error:', error);
        }
      });
      
    } catch (error) {
      Logger.error('Failed to inject buttons:', error);
    }
  }

  /**
   * Removes summary box and related UI elements
   */
  removeSummaryBox() {
    const elementsToRemove = [
      'yt-summarize-summary',
      'yt-summarize-loading',
      'yt-summarize-temp-loading',
      'summary-box',
      'summary-loading-box'
    ];
    
    elementsToRemove.forEach(elementId => {
      const element = document.getElementById(elementId);
      DOMUtils.safeRemove(element);
    });
    
    // Remove any elements with our CSS classes that might be orphaned
    const orphanedElements = document.querySelectorAll('.yt-summarize-box, .yt-summarize-loading, .yt-summarize-spinner');
    orphanedElements.forEach(element => {
      DOMUtils.safeRemove(element);
    });
  }

  /**
   * Shows loading state with comment count
   * @param {number} commentCount - Number of comments being processed
   */
  showLoading(commentCount) {
    this.removeSummaryBox();

    const commentsSection = document.querySelector('#comments');
    if (!commentsSection) return;

    const loadingBox = DOMUtils.createElement('div', {
      id: 'yt-summarize-loading',
      class: 'yt-summarize-loading',
      role: 'status',
      'aria-live': 'polite'
    });
    
    const loadingText = DOMUtils.createElement('div', {}, 
      `${commentCount > 100 ? 'Deep analysis' : 'Analysis'} - generating summary from ${Math.min(commentCount, 200)} comments...`
    );
    
    const loadingSpinner = DOMUtils.createElement('div', {
      class: 'yt-summarize-spinner',
      'aria-hidden': 'true'
    });
    
    loadingBox.appendChild(loadingText);
    loadingBox.appendChild(loadingSpinner);
    
    commentsSection.insertBefore(loadingBox, commentsSection.firstChild);

    // Add to cleanup registry
    this.addCleanup(() => {
      const box = document.getElementById('yt-summarize-loading');
      DOMUtils.safeRemove(box);
    });
  }

  /**
   * Shows summary with proper formatting
   * @param {string} summary - Summary text to display
   * @param {number} commentCount - Number of comments processed
   * @param {boolean} isError - Whether this is an error message
   */
  showSummary(summary, commentCount, isError = false) {
    this.removeSummaryBox();

    const commentsSection = document.querySelector('#comments');
    if (!commentsSection) return;

    const summaryBox = DOMUtils.createElement('div', {
      id: 'yt-summarize-summary',
      class: 'yt-summarize-box',
      role: 'article',
      'aria-label': 'Comment summary'
    });
    
    // Set error state if needed
    if (isError) {
      summaryBox.setAttribute('data-error', 'true');
    }

    const titleElement = DOMUtils.createElement('div', {
      class: 'yt-summarize-title'
    }, isError ? 'Error' : 
      `Comments ${commentCount > 100 ? 'Deep Analysis' : 'Summary'} (${Math.min(commentCount, 200)} comments)`
    );

    const contentElement = DOMUtils.createElement('div', {
      class: 'yt-summarize-content'
    }, summary);

    summaryBox.appendChild(titleElement);
    summaryBox.appendChild(contentElement);

    commentsSection.insertBefore(summaryBox, commentsSection.firstChild);

    // Add to cleanup registry
    this.addCleanup(() => {
      const box = document.getElementById('yt-summarize-summary');
      DOMUtils.safeRemove(box);
    });
  }

  /**
   * Sets button processing state
   * @param {boolean} isProcessing - Whether buttons should be in processing state
   */
  setButtonProcessingState(isProcessing) {
    const summarizeButton = document.getElementById('summarize-comments-btn');
    const deepSummarizeButton = document.getElementById('deep-summarize-comments-btn');
    
    [summarizeButton, deepSummarizeButton].forEach(button => {
      if (button) {
        button.disabled = isProcessing;
        button.setAttribute('aria-busy', isProcessing.toString());
        
        if (isProcessing) {
          if (button === summarizeButton) {
            button.textContent = 'Processing...';
          } else if (button === deepSummarizeButton) {
            button.textContent = 'Loading more...';
          }
        } else {
          if (button === summarizeButton) {
            button.textContent = 'Summarize Comments';
          } else if (button === deepSummarizeButton) {
            button.textContent = 'Deep Summarize';
          }
        }
      }
    });
  }

  /**
   * Shows temporary loading message for deep analysis
   * @returns {Element} The temporary loading element
   */
  showTemporaryLoading() {
    const tempLoading = DOMUtils.createElement('div', {
      id: 'yt-summarize-temp-loading',
      class: 'yt-summarize-loading'
    }, 'Scrolling to load more comments...');
    
    const commentsSection = document.querySelector('#comments');
    if (commentsSection) {
      commentsSection.insertBefore(tempLoading, commentsSection.firstChild);
    }
    
    return tempLoading;
  }

  /**
   * Removes temporary loading message
   */
  removeTemporaryLoading() {
    const tempLoading = document.getElementById('yt-summarize-temp-loading');
    DOMUtils.safeRemove(tempLoading);
  }
} 