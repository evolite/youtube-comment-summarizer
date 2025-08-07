// services/APIService.js - API communication and management

import { TextSanitizer, ValidationUtils, Logger, CONSTANTS, AsyncUtils } from '../utils.js';

/**
 * Service for handling API communications with AI providers
 */
export class APIService {
  constructor() {
    this.providers = {
      claude: {
        name: 'Claude 3.5 Sonnet',
        endpoint: 'https://api.anthropic.com/v1/messages',
        keyPattern: /^sk-ant-[a-zA-Z0-9\-_]+$/,
        keyPrefix: 'sk-ant-',
        model: 'claude-3-5-sonnet-20240620',
        maxTokens: 2048
      },
      openai: {
        name: 'OpenAI GPT-3.5 Turbo',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        keyPattern: /^sk-[a-zA-Z0-9]+$/,
        keyPrefix: 'sk-',
        model: 'gpt-3.5-turbo',
        maxTokens: 2000
      },
      gemini: {
        name: 'Google Gemini Pro',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent',
        keyPattern: /^[A-Za-z0-9\-_]{20,}$/,
        keyPrefix: '',
        model: 'gemini-1.5-pro-latest',
        maxTokens: 2000
      }
    };

    this.defaultSystemPrompt = 'Please provide a concise, flowing summary of the key themes and overall sentiment from the following YouTube comments (including replies). Write in a natural, readable paragraph format without bullet points or numbered lists. Focus on the main themes and overall sentiment:\n\n';
  }

  /**
   * Validates API key for the specified provider
   * @param {string} apiKey - API key to validate
   * @param {string} provider - Provider name (claude, openai, gemini)
   * @throws {Error} If validation fails
   */
  validateApiKey(apiKey, provider) {
    ValidationUtils.validateString(apiKey, 'API Key');
    
    const providerConfig = this.providers[provider];
    if (!providerConfig) {
      throw new Error('Invalid AI provider');
    }

    if (apiKey.length < 10 || apiKey.length > CONSTANTS.VALIDATION.MAX_API_KEY_LENGTH) {
      throw new Error(`API key length invalid for ${providerConfig.name}`);
    }

    if (!providerConfig.keyPattern.test(apiKey)) {
      throw new Error(`Invalid API key format for ${providerConfig.name}`);
    }

    // Check for suspicious characters
    if (apiKey.includes('<') || apiKey.includes('>') || apiKey.includes('"') || apiKey.includes("'")) {
      throw new Error('API key contains invalid characters');
    }
  }

  /**
   * Validates system prompt
   * @param {string} prompt - System prompt to validate
   * @returns {string} Validated prompt or default prompt
   */
  validateSystemPrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') {
      return this.defaultSystemPrompt;
    }

    const trimmed = prompt.trim();
    
    if (trimmed.length < 10) {
      throw new Error('System prompt is too short (minimum 10 characters)');
    }

    if (trimmed.length > CONSTANTS.VALIDATION.MAX_PROMPT_LENGTH) {
      throw new Error(`System prompt is too long (maximum ${CONSTANTS.VALIDATION.MAX_PROMPT_LENGTH} characters)`);
    }

    // Security check for potential injection attempts
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /data:/i,
      /vbscript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /function\s*\(/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(trimmed)) {
        throw new Error('System prompt contains potentially dangerous content');
      }
    }

    return trimmed;
  }

  /**
   * Calls Claude API
   * @param {string} apiKey - Claude API key
   * @param {string} prompt - Full prompt including system prompt and comments
   * @param {AbortController} controller - Abort controller for timeout
   * @returns {Promise<string>} API response
   */
  async callClaudeAPI(apiKey, prompt, controller) {
    const response = await fetch(this.providers.claude.endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.providers.claude.model,
        max_tokens: this.providers.claude.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data?.content?.[0]?.text || 'No summary returned.';
  }

  /**
   * Calls OpenAI API
   * @param {string} apiKey - OpenAI API key
   * @param {string} prompt - Full prompt including system prompt and comments
   * @param {AbortController} controller - Abort controller for timeout
   * @returns {Promise<string>} API response
   */
  async callOpenAIAPI(apiKey, prompt, controller) {
    const response = await fetch(this.providers.openai.endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.providers.openai.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.providers.openai.maxTokens,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || 'No summary returned.';
  }

  /**
   * Calls Gemini API
   * @param {string} apiKey - Gemini API key
   * @param {string} prompt - Full prompt including system prompt and comments
   * @param {AbortController} controller - Abort controller for timeout
   * @returns {Promise<string>} API response
   */
  async callGeminiAPI(apiKey, prompt, controller) {
    const response = await fetch(`${this.providers.gemini.endpoint}?key=${apiKey}`, {
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
          maxOutputTokens: this.providers.gemini.maxTokens,
          temperature: 0.7
        }
      }),
    });

    if (!response.ok) {
      let errorText = response.statusText;
      try {
        const errorData = await response.text();
        Logger.debug('Gemini API error response:', errorData);
        errorText = errorData ? errorData.substring(0, 500) : `HTTP ${response.status}`;
      } catch (e) {
        errorText = `HTTP ${response.status}`;
      }
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    Logger.debug('Gemini API response:', data);
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No summary returned.';
  }

  /**
   * Calls the specified AI provider
   * @param {string} provider - Provider name (claude, openai, gemini)
   * @param {string} apiKey - API key for the provider
   * @param {string} prompt - Full prompt including system prompt and comments
   * @param {AbortController} controller - Abort controller for timeout
   * @returns {Promise<string>} API response
   */
  async callAIProvider(provider, apiKey, prompt, controller) {
    switch (provider) {
      case 'claude':
        return await this.callClaudeAPI(apiKey, prompt, controller);
      case 'openai':
        return await this.callOpenAIAPI(apiKey, prompt, controller);
      case 'gemini':
        return await this.callGeminiAPI(apiKey, prompt, controller);
      default:
        throw new Error('Unsupported AI provider');
    }
  }

  /**
   * Generates summary from comments using specified AI provider
   * @param {string[]} comments - Array of comment texts
   * @param {string} apiKey - API key for the provider
   * @param {string} systemPrompt - System prompt to use
   * @param {string} provider - Provider name (claude, openai, gemini)
   * @param {number} timeout - Request timeout in milliseconds
   * @returns {Promise<string>} Generated summary
   */
  async generateSummary(comments, apiKey, systemPrompt, provider, timeout = CONSTANTS.API.REQUEST_TIMEOUT) {
    try {
      // Validate inputs
      this.validateApiKey(apiKey, provider);
      const validatedPrompt = this.validateSystemPrompt(systemPrompt);
      
      // Construct full prompt
      const fullPrompt = validatedPrompt + comments.join('\n---\n');
      if (fullPrompt.length > CONSTANTS.VALIDATION.MAX_PROMPT_LENGTH) {
        throw new Error('Combined prompt too long');
      }

      Logger.info(`Making API request to ${this.providers[provider].name}`, {
        commentCount: comments.length,
        promptLength: fullPrompt.length
      });

      // Call AI provider with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const rawSummary = await this.callAIProvider(provider, apiKey, fullPrompt, controller);
        clearTimeout(timeoutId);

        // Sanitize the response
        const summary = TextSanitizer.sanitizeApiResponse(rawSummary);

        if (!summary || summary.length === 0) {
          throw new Error('Empty response after sanitization');
        }

        Logger.info('Summary generated successfully', { summaryLength: summary.length });
        return summary;
        
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out');
        }
        throw fetchError;
      }

    } catch (error) {
      Logger.error('Error generating summary:', error);
      throw error;
    }
  }

  /**
   * Gets provider information
   * @returns {Object} Provider configurations
   */
  getProviders() {
    return this.providers;
  }

  /**
   * Gets default system prompt
   * @returns {string} Default system prompt
   */
  getDefaultSystemPrompt() {
    return this.defaultSystemPrompt;
  }
} 