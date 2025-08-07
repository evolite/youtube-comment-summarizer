// background.js - Background script for YouTube Comment Summarizer

/**
 * Rate limiting manager
 */
class RateLimitManager {
  constructor() {
    this.requests = new Map();
    this.initializeCleanup();
  }

  initializeCleanup() {
    // Clean up old requests every minute
    setInterval(() => this.cleanup(), 60000);
  }

  checkRateLimit(tabId) {
    const now = Date.now();
    const tabRequests = this.requests.get(tabId) || [];
    
    // Remove requests older than 1 minute
    const recentRequests = tabRequests.filter(time => now - time < 60000);
    
    if (recentRequests.length >= 10) {
      return false; // Rate limited
    }
    
    // Add current request
    recentRequests.push(now);
    this.requests.set(tabId, recentRequests);
    return true;
  }

  cleanup() {
    const now = Date.now();
    for (const [tabId, requests] of this.requests.entries()) {
      const recentRequests = requests.filter(time => now - time < 60000);
      if (recentRequests.length === 0) {
        this.requests.delete(tabId);
      } else {
        this.requests.set(tabId, recentRequests);
      }
    }
  }
}

/**
 * Storage manager for handling browser storage operations
 */
class StorageManager {
  async get(keys) {
    try {
      return await browser.storage.local.get(keys);
    } catch (error) {
      console.error('Storage get error:', error);
      return {};
    }
  }

  async set(data) {
    try {
      await browser.storage.local.set(data);
    } catch (error) {
      console.error('Storage set error:', error);
    }
  }

  async remove(keys) {
    try {
      await browser.storage.local.remove(keys);
    } catch (error) {
      console.error('Storage remove error:', error);
    }
  }
}

/**
 * API service for handling AI provider communications
 */
class APIService {
  constructor() {
    this.providers = {
      claude: {
        name: 'Claude',
        validateKey: (key) => key && key.startsWith('sk-ant-') && key.length > 20,
        call: this.callClaudeAPI.bind(this)
      },
      openai: {
        name: 'OpenAI',
        validateKey: (key) => key && key.startsWith('sk-') && key.length > 20,
        call: this.callOpenAIAPI.bind(this)
      },
      gemini: {
        name: 'Gemini',
        validateKey: (key) => key && key.length > 20,
        call: this.callGeminiAPI.bind(this)
      }
    };
  }

  validateApiKey(apiKey, provider) {
    const providerConfig = this.providers[provider];
    if (!providerConfig) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    return providerConfig.validateKey(apiKey);
  }

  validateSystemPrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid system prompt');
    }
    if (prompt.length > 100000) {
      throw new Error('System prompt too long');
    }
    return prompt.trim();
  }

  async callClaudeAPI(apiKey, prompt, controller) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  async callOpenAIAPI(apiKey, prompt, controller) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        max_tokens: 2000,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that summarizes YouTube comments.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async callGeminiAPI(apiKey, prompt, controller) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 2000
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  async callAIProvider(provider, apiKey, prompt, controller) {
    const providerConfig = this.providers[provider];
    if (!providerConfig) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    return await providerConfig.call(apiKey, prompt, controller);
  }

  async generateSummary(comments, apiKey, systemPrompt, provider, timeout = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Validate inputs
      this.validateApiKey(apiKey, provider);
      this.validateSystemPrompt(systemPrompt);

      if (!Array.isArray(comments) || comments.length === 0) {
        throw new Error('No comments provided');
      }

      // Create prompt
      const commentText = comments.join('\n\n');
      const fullPrompt = `${systemPrompt}\n\nComments:\n${commentText}`;

      // Call AI provider
      const summary = await this.callAIProvider(provider, apiKey, fullPrompt, controller);
      
      // Sanitize response
      return this.sanitizeApiResponse(summary);
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  sanitizeApiResponse(text) {
    if (typeof text !== 'string') return '';
    
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/eval\s*\(/gi, '')
      .trim()
      .substring(0, 5000);
  }

  getProviders() {
    return this.providers;
  }

  getDefaultSystemPrompt() {
    return `Please provide a comprehensive summary of the YouTube video comments below. Focus on the main themes, sentiments, and key points discussed. Include both positive and negative feedback, and highlight any recurring topics or concerns. Make the summary easy to read and well-structured.`;
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

  async handleSummarizeRequest(request, sender) {
    try {
      // Check rate limit
      if (!this.rateLimitManager.checkRateLimit(sender.tab.id)) {
        return { error: 'Rate limit exceeded. Please wait before making another request.' };
      }

      // Validate comments
      this.validateComments(request.comments);

      // Get stored settings
      const { apiKey, systemPrompt, aiProvider } = await this.storageManager.get(['apiKey', 'systemPrompt', 'aiProvider']);
      
      if (!apiKey) {
        return { error: 'API key not configured. Please set your API key in the extension options.' };
      }

      if (!aiProvider) {
        return { error: 'AI provider not selected. Please select an AI provider in the extension options.' };
      }

      // Generate summary
      const summary = await this.apiService.generateSummary(
        request.comments,
        apiKey,
        systemPrompt || this.apiService.getDefaultSystemPrompt(),
        aiProvider
      );

      return { summary };
    } catch (error) {
      console.error('Summarize request error:', error);
      return { error: error.message };
    }
  }

  handleGetProvidersRequest() {
    return { providers: this.apiService.getProviders() };
  }

  validateComments(comments) {
    if (!Array.isArray(comments)) {
      throw new Error('Invalid comments format');
    }
    
    if (comments.length === 0) {
      throw new Error('No comments provided');
    }
    
    if (comments.length > 200) {
      throw new Error('Too many comments (max 200)');
    }
    
    for (const comment of comments) {
      if (typeof comment !== 'string' || comment.length < 5 || comment.length > 1000) {
        throw new Error('Invalid comment format or length');
      }
    }
  }

  handleMessage(request, sender, sendResponse) {
    (async () => {
      try {
        let response;
        
        switch (request.type) {
          case 'summarize':
            response = await this.handleSummarizeRequest(request, sender);
            break;
          case 'getProviders':
            response = this.handleGetProvidersRequest();
            break;
          default:
            response = { error: 'Unknown request type' };
        }
        
        sendResponse(response);
      } catch (error) {
        console.error('Message handling error:', error);
        sendResponse({ error: error.message });
      }
    })();
    
    return true; // Keep message channel open for async response
  }

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