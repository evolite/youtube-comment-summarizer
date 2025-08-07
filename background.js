// background.js

// Rate limiting configuration with memory cleanup
const RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60000, // 1 minute
  requests: new Map(),
  cleanupInterval: null
};

// Input validation constants
const VALIDATION = {
  maxComments: 100,
  maxCommentLength: 1000,
  minCommentLength: 5,
  maxTotalLength: 50000,
  maxPromptLength: 100000, // Prevent prompt injection attacks
  maxApiKeyLength: 200
};

// AI Provider configurations
const AI_PROVIDERS = {
  claude: {
    name: 'Claude 3.5 Sonnet',
    endpoint: 'https://api.anthropic.com/v1/messages',
    keyPattern: /^sk-ant-[a-zA-Z0-9\-_]+$/,
    keyPrefix: 'sk-ant-',
    model: 'claude-3-5-sonnet-20240620',
    maxTokens: 1024
  },
  openai: {
    name: 'OpenAI GPT-3.5 Turbo',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    keyPattern: /^sk-[a-zA-Z0-9]+$/,
    keyPrefix: 'sk-',
    model: 'gpt-3.5-turbo',
    maxTokens: 1000
  },
  gemini: {
    name: 'Google Gemini Pro',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    keyPattern: /^[A-Za-z0-9\-_]{39}$/,
    keyPrefix: '',
    model: 'gemini-pro',
    maxTokens: 1000
  }
};

// Default system prompt
const DEFAULT_SYSTEM_PROMPT = 'Please provide a concise, flowing summary of the key themes and overall sentiment from the following YouTube comments. Write in a natural, readable paragraph format without bullet points or numbered lists. Focus on the main themes and overall sentiment:\n\n';

// Initialize cleanup interval for rate limiting
function initializeRateLimitCleanup() {
  if (RATE_LIMIT.cleanupInterval) {
    clearInterval(RATE_LIMIT.cleanupInterval);
  }
  
  RATE_LIMIT.cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [tabId, requests] of RATE_LIMIT.requests.entries()) {
      const recentRequests = requests.filter(time => now - time < RATE_LIMIT.windowMs);
      if (recentRequests.length === 0) {
        RATE_LIMIT.requests.delete(tabId);
      } else {
        RATE_LIMIT.requests.set(tabId, recentRequests);
      }
    }
  }, RATE_LIMIT.windowMs);
}

function validateComments(comments) {
  if (!comments || !Array.isArray(comments)) {
    throw new Error('Invalid comments data: must be an array');
  }

  if (comments.length === 0) {
    throw new Error('No comments provided');
  }

  if (comments.length > VALIDATION.maxComments) {
    throw new Error(`Too many comments: maximum ${VALIDATION.maxComments} allowed`);
  }

  // Enhanced validation with type checking and sanitization
  const processedComments = comments
    .filter(comment => {
      if (typeof comment !== 'string') return false;
      const trimmed = comment.trim();
      return trimmed.length >= VALIDATION.minCommentLength && 
             trimmed.length <= VALIDATION.maxCommentLength;
    })
    .map(comment => {
      // Basic sanitization to prevent prompt injection
      return comment
        .substring(0, VALIDATION.maxCommentLength)
        .trim()
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
        .replace(/\u0000/g, ''); // Remove null bytes
    })
    .slice(0, VALIDATION.maxComments);

  if (processedComments.length === 0) {
    throw new Error('No valid comments found after filtering');
  }

  const totalLength = processedComments.join('').length;
  if (totalLength > VALIDATION.maxTotalLength) {
    throw new Error('Comments too long: total character limit exceeded');
  }

  return processedComments;
}

function checkRateLimit(tabId) {
  const now = Date.now();
  
  // Sanitize tabId to prevent injection
  const sanitizedTabId = String(tabId).substring(0, 100);
  
  const tabRequests = RATE_LIMIT.requests.get(sanitizedTabId) || [];

  // Clean old requests
  const recentRequests = tabRequests.filter(time => now - time < RATE_LIMIT.windowMs);

  if (recentRequests.length >= RATE_LIMIT.maxRequests) {
    throw new Error('Rate limit exceeded. Please wait before making another request.');
  }

  // Add current request
  recentRequests.push(now);
  RATE_LIMIT.requests.set(sanitizedTabId, recentRequests);

  return true;
}

function sanitizeApiResponse(text) {
  if (typeof text !== 'string') {
    return 'Invalid response format';
  }

  // Enhanced sanitization with additional protections
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*>/gi, '')
    .replace(/<link\b[^<]*>/gi, '')
    .replace(/<meta\b[^<]*>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/style\s*=/gi, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .trim()
    .substring(0, 10000); // Limit response length
}

function validateSystemPrompt(prompt) {
  if (typeof prompt !== 'string') {
    return DEFAULT_SYSTEM_PROMPT;
  }
  
  const trimmed = prompt.trim();
  if (trimmed.length === 0 || trimmed.length > VALIDATION.maxPromptLength) {
    return DEFAULT_SYSTEM_PROMPT;
  }
  
  // Basic sanitization for prompt injection prevention
  return trimmed
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .substring(0, VALIDATION.maxPromptLength);
}

function validateApiKey(apiKey, provider) {
  if (typeof apiKey !== 'string') {
    throw new Error('Invalid API key type');
  }
  
  if (apiKey.length < 10 || apiKey.length > VALIDATION.maxApiKeyLength) {
    throw new Error('Invalid API key length');
  }
  
  const providerConfig = AI_PROVIDERS[provider];
  if (!providerConfig) {
    throw new Error('Invalid AI provider');
  }
  
  if (!providerConfig.keyPattern.test(apiKey)) {
    throw new Error(`Invalid API key format for ${providerConfig.name}`);
  }
  
  // Check for suspicious characters
  if (apiKey.includes('<') || apiKey.includes('>') || apiKey.includes('"') || apiKey.includes("'")) {
    throw new Error('API key contains invalid characters');
  }
  
  return true;
}

// Provider-specific API call functions
async function callClaudeAPI(apiKey, prompt, controller) {
  const response = await fetch(AI_PROVIDERS.claude.endpoint, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_PROVIDERS.claude.model,
      max_tokens: AI_PROVIDERS.claude.maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return data?.content?.[0]?.text || 'No summary returned.';
}

async function callOpenAIAPI(apiKey, prompt, controller) {
  const response = await fetch(AI_PROVIDERS.openai.endpoint, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_PROVIDERS.openai.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: AI_PROVIDERS.openai.maxTokens,
      temperature: 0.7
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || 'No summary returned.';
}

async function callGeminiAPI(apiKey, prompt, controller) {
  const response = await fetch(`${AI_PROVIDERS.gemini.endpoint}?key=${apiKey}`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        maxOutputTokens: AI_PROVIDERS.gemini.maxTokens,
        temperature: 0.7
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No summary returned.';
}

async function callAIProvider(provider, apiKey, prompt, controller) {
  switch (provider) {
    case 'claude':
      return await callClaudeAPI(apiKey, prompt, controller);
    case 'openai':
      return await callOpenAIAPI(apiKey, prompt, controller);
    case 'gemini':
      return await callGeminiAPI(apiKey, prompt, controller);
    default:
      throw new Error('Unsupported AI provider');
  }
}

// Initialize rate limit cleanup
initializeRateLimitCleanup();

// Listen for messages from content script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message type:', request.type);

  if (request.type === 'summarize') {
    // Handle the async operation
    (async () => {
      try {
        console.log('Starting summarize request...');

        // Validate sender
        if (!sender || !sender.tab) {
          throw new Error('Invalid request sender');
        }

        // Rate limiting check
        const tabId = sender.tab.id || 'unknown';
        checkRateLimit(tabId);

        // Input validation
        const validatedComments = validateComments(request.comments);
        console.log(`Processing ${validatedComments.length} validated comments`);

        // Retrieve settings from storage with timeout
        const storagePromise = browser.storage.local.get(['apiKey', 'systemPrompt', 'aiProvider']);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Storage timeout')), 5000)
        );
        
        const { apiKey, systemPrompt, aiProvider = 'claude' } = await Promise.race([storagePromise, timeoutPromise]);
        
        if (!apiKey) {
          console.log('No API key found');
          const providerName = AI_PROVIDERS[aiProvider]?.name || 'AI';
          sendResponse({ error: `${providerName} API key not set. Please set it in the extension options.` });
          return;
        }

        // Validate API key for selected provider
        validateApiKey(apiKey, aiProvider);
        console.log(`API key validated successfully for ${aiProvider}`);

        // Validate and sanitize system prompt
        const promptToUse = validateSystemPrompt(systemPrompt) || DEFAULT_SYSTEM_PROMPT;
        console.log('Using system prompt:', promptToUse.substring(0, 100) + '...');

        // Construct full prompt
        const fullPrompt = promptToUse + validatedComments.join('\n---\n');
        if (fullPrompt.length > VALIDATION.maxPromptLength) {
          throw new Error('Combined prompt too long');
        }

        console.log(`Making fetch request to ${AI_PROVIDERS[aiProvider].name}...`);

        // Call AI provider with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        try {
          const rawSummary = await callAIProvider(aiProvider, apiKey, fullPrompt, controller);
          clearTimeout(timeoutId);

          // Sanitize the response
          const summary = sanitizeApiResponse(rawSummary);

          if (!summary || summary.length === 0) {
            throw new Error('Empty response after sanitization');
          }

          console.log('Summary extracted and sanitized successfully');
          sendResponse({ summary });
          
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            throw new Error('Request timed out');
          }
          throw fetchError;
        }

      } catch (e) {
        console.error('Error in background script:', e.message);
        sendResponse({ error: 'Error: ' + String(e.message).substring(0, 500) });
      }
    })();

    return true; // Indicate async response
  }
  
  // Handle provider info request
  if (request.type === 'getProviders') {
    sendResponse({ providers: AI_PROVIDERS });
    return false;
  }
  
  // Reject unknown message types
  console.warn('Unknown message type:', request.type);
  sendResponse({ error: 'Unknown request type' });
  return false;
});

// Cleanup on extension unload
if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onSuspend) {
  browser.runtime.onSuspend.addListener(() => {
    if (RATE_LIMIT.cleanupInterval) {
      clearInterval(RATE_LIMIT.cleanupInterval);
    }
  });
} 