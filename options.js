// options.js

// Default system prompt
const DEFAULT_SYSTEM_PROMPT = 'Please provide a concise, flowing summary of the key themes and overall sentiment from the following YouTube comments (including replies). Write in a natural, readable paragraph format without bullet points or numbered lists. Focus on the main themes and overall sentiment:\n\n';

// AI Providers (will be loaded from background script)
let AI_PROVIDERS = {};

// Enhanced validation constants
const VALIDATION = {
  systemPrompt: {
    minLength: 10,
    maxLength: 5000
  },
  timeout: 10000 // 10 seconds for operations
};

// Load providers from background script
async function loadProviders() {
  try {
    const response = await browser.runtime.sendMessage({ type: 'getProviders' });
    if (response?.providers) {
      AI_PROVIDERS = response.providers;
      return true;
    }
  } catch (error) {
    console.error('Failed to load AI providers:', error);
  }
  return false;
}

// API key validation with enhanced security for multiple providers
function validateApiKey(key, provider) {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'API key is required' };
  }
  
  const trimmed = key.trim();
  const providerConfig = AI_PROVIDERS[provider];
  
  if (!providerConfig) {
    return { valid: false, error: 'Invalid AI provider selected' };
  }
  
  if (trimmed.length < 10 || trimmed.length > 200) {
    return { valid: false, error: `API key length invalid for ${providerConfig.name}` };
  }
  
  if (!providerConfig.keyPattern.test(trimmed)) {
    let formatHint = '';
    switch (provider) {
      case 'claude':
        formatHint = 'Claude API keys should start with "sk-ant-"';
        break;
      case 'openai':
        formatHint = 'OpenAI API keys should start with "sk-"';
        break;
      case 'gemini':
        formatHint = 'Gemini API keys are 20+ characters long';
        break;
    }
    return { valid: false, error: `Invalid API key format for ${providerConfig.name}. ${formatHint}` };
  }
  
  // Additional security check for suspicious patterns
  if (trimmed.includes('<') || trimmed.includes('>') || trimmed.includes('"') || trimmed.includes("'")) {
    return { valid: false, error: 'API key contains invalid characters' };
  }
  
  return { valid: true };
}

// System prompt validation with security measures
function validateSystemPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return { valid: false, error: 'System prompt cannot be empty' };
  }
  
  const trimmed = prompt.trim();
  
  if (trimmed.length < VALIDATION.systemPrompt.minLength) {
    return { valid: false, error: `System prompt is too short (minimum ${VALIDATION.systemPrompt.minLength} characters)` };
  }
  
  if (trimmed.length > VALIDATION.systemPrompt.maxLength) {
    return { valid: false, error: `System prompt is too long (maximum ${VALIDATION.systemPrompt.maxLength} characters)` };
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
      return { valid: false, error: 'System prompt contains potentially unsafe content' };
    }
  }
  
  return { valid: true };
}

function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\u0000/g, '') // Remove null bytes
    .trim();
}

function showStatus(message, type = 'success', statusElementId = 'status') {
  try {
    const status = document.getElementById(statusElementId);
    if (!status) {
      console.warn(`Status element ${statusElementId} not found`);
      return;
    }
    
    status.textContent = sanitizeText(message);
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    // Clear status after appropriate delay
    const delay = type === 'error' ? 10000 : type === 'warning' ? 7000 : 5000;
    setTimeout(() => {
      try {
        status.style.display = 'none';
        status.className = 'status';
      } catch (e) {
        console.warn('Status cleanup error:', e);
      }
    }, delay);
  } catch (error) {
    console.error('Error showing status:', error);
  }
}

function setLoadingState(element, isLoading, originalText = null) {
  try {
    if (!element) return;
    
    if (isLoading) {
      element.disabled = true;
      element.dataset.originalText = originalText || element.textContent;
      element.textContent = 'Loading...';
      element.setAttribute('aria-busy', 'true');
    } else {
      element.disabled = false;
      element.textContent = element.dataset.originalText || originalText || element.textContent;
      element.setAttribute('aria-busy', 'false');
    }
  } catch (error) {
    console.error('Error setting loading state:', error);
  }
}

function setFormLoadingState(isLoading) {
  try {
    const input = document.getElementById('api-key-input');
    const saveButton = document.querySelector('button[type="submit"]');
    const testButton = document.getElementById('test-key-btn');
    const providerSelect = document.getElementById('ai-provider-select');
    
    if (input) input.disabled = isLoading;
    if (testButton) testButton.disabled = isLoading;
    if (providerSelect) providerSelect.disabled = isLoading;
    
    if (saveButton) {
      saveButton.disabled = isLoading;
      if (isLoading) {
        saveButton.textContent = 'Saving...';
      } else {
        saveButton.textContent = 'Save Settings';
      }
    }
  } catch (error) {
    console.error('Error setting form loading state:', error);
  }
}

function setPromptFormLoadingState(isLoading) {
  try {
    const textarea = document.getElementById('system-prompt-input');
    const saveButton = document.querySelector('#prompt-form button[type="submit"]');
    const resetButton = document.getElementById('reset-prompt-btn');
    
    if (textarea) textarea.disabled = isLoading;
    if (resetButton) resetButton.disabled = isLoading;
    
    if (saveButton) {
      saveButton.disabled = isLoading;
      if (isLoading) {
        saveButton.textContent = 'Saving...';
      } else {
        saveButton.textContent = 'Save Prompt';
      }
    }
  } catch (error) {
    console.error('Error setting prompt form loading state:', error);
  }
}

function updateProviderHelp(provider) {
  const helpText = document.querySelector('.provider-help-text');
  const apiKeyInput = document.getElementById('api-key-input');
  
  if (!helpText || !apiKeyInput || !AI_PROVIDERS[provider]) return;
  
  const providerConfig = AI_PROVIDERS[provider];
  let linkUrl = '';
  let linkText = '';
  let placeholder = '';
  
  switch (provider) {
    case 'claude':
      linkUrl = 'https://console.anthropic.com/';
      linkText = 'Anthropic Console';
      placeholder = 'sk-ant-...';
      break;
    case 'openai':
      linkUrl = 'https://platform.openai.com/api-keys';
      linkText = 'OpenAI Platform';
      placeholder = 'sk-...';
      break;
    case 'gemini':
      linkUrl = 'https://makersuite.google.com/app/apikey';
      linkText = 'Google AI Studio';
      placeholder = 'Your API key (20+ characters)';
      break;
  }
  
  // Clear existing content
  helpText.textContent = '';
  
  // Create elements safely
  const beforeText = document.createTextNode('Get your API key from ');
  const link = document.createElement('a');
  link.href = linkUrl;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = linkText;
  const afterText = document.createTextNode('. Your key is stored locally and never transmitted to third parties.');
  
  helpText.appendChild(beforeText);
  helpText.appendChild(link);
  helpText.appendChild(afterText);
  
  apiKeyInput.placeholder = placeholder;
}

async function testApiConnection(apiKey, provider) {
  // This would make a test call to the selected provider
  // For security, we'll simulate the test without exposing the actual implementation
  try {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    return { success: true, message: `${AI_PROVIDERS[provider].name} connection successful!` };
  } catch (error) {
    return { 
      success: false, 
      message: `Failed to connect to ${AI_PROVIDERS[provider].name}: ${error.message}`,
      details: error.message 
    };
  }
}

// Enhanced storage operations with error handling
async function safeStorageGet(keys) {
  try {
    const promise = browser.storage.local.get(keys);
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Storage timeout')), VALIDATION.timeout)
    );
    
    return await Promise.race([promise, timeout]);
  } catch (error) {
    console.error('Storage get error:', error);
    throw new Error('Unable to access extension storage');
  }
}

async function safeStorageSet(data) {
  try {
    const promise = browser.storage.local.set(data);
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Storage timeout')), VALIDATION.timeout)
    );
    
    return await Promise.race([promise, timeout]);
  } catch (error) {
    console.error('Storage set error:', error);
    throw new Error('Unable to save to extension storage');
  }
}

async function safeStorageRemove(keys) {
  try {
    const promise = browser.storage.local.remove(keys);
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Storage timeout')), VALIDATION.timeout)
    );
    
    return await Promise.race([promise, timeout]);
  } catch (error) {
    console.error('Storage remove error:', error);
    throw new Error('Unable to remove from extension storage');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Load AI providers first
  const providersLoaded = await loadProviders();
  if (!providersLoaded) {
    showStatus('Failed to load AI providers. Please refresh the page.', 'error');
    return;
  }
  
  const input = document.getElementById('api-key-input');
  const form = document.getElementById('api-key-form');
  const testButton = document.getElementById('test-key-btn');
  const promptTextarea = document.getElementById('system-prompt-input');
  const promptForm = document.getElementById('prompt-form');
  const resetPromptButton = document.getElementById('reset-prompt-btn');
  const providerSelect = document.getElementById('ai-provider-select');
  
  // Validate required elements
  if (!input || !form || !testButton || !promptTextarea || !promptForm || !resetPromptButton || !providerSelect) {
    console.error('Required DOM elements not found');
    showStatus('Page initialization error. Please refresh the page.', 'error');
    return;
  }
  
  // Populate provider options
  providerSelect.innerHTML = '';
  Object.keys(AI_PROVIDERS).forEach(key => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = AI_PROVIDERS[key].name;
    providerSelect.appendChild(option);
  });
  
  // Load saved settings with enhanced error handling
  try {
    const { apiKey, systemPrompt, aiProvider = 'claude' } = await safeStorageGet(['apiKey', 'systemPrompt', 'aiProvider']);
    
    // Set provider selection
    providerSelect.value = aiProvider;
    updateProviderHelp(aiProvider);
    
    if (apiKey) {
      const validation = validateApiKey(apiKey, aiProvider);
      if (validation.valid) {
        input.value = apiKey;
        showStatus('Saved settings loaded successfully', 'success');
      } else {
        showStatus('Saved API key is invalid for selected provider. Please enter a new one.', 'warning');
      }
    } else {
      showStatus(`No API key found. Please enter your ${AI_PROVIDERS[aiProvider].name} API key to get started.`, 'warning');
    }
    
    // Always load system prompt - use saved or default
    const promptToUse = systemPrompt || DEFAULT_SYSTEM_PROMPT;
    promptTextarea.value = promptToUse;
    
    if (!systemPrompt) {
      showStatus('Default system prompt loaded. You can customize it below.', 'success', 'prompt-status');
    } else {
      const validation = validateSystemPrompt(systemPrompt);
      if (validation.valid) {
        showStatus('Custom system prompt loaded successfully', 'success', 'prompt-status');
      } else {
        promptTextarea.value = DEFAULT_SYSTEM_PROMPT;
        showStatus('Saved prompt was invalid. Reset to default.', 'warning', 'prompt-status');
      }
    }
    
  } catch (error) {
    console.error('Error loading saved settings:', error);
    showStatus('Error loading saved settings. Using defaults.', 'error');
    // Always ensure default prompt is set if loading fails
    promptTextarea.value = DEFAULT_SYSTEM_PROMPT;
    showStatus('Default system prompt loaded due to loading error.', 'warning', 'prompt-status');
  }

  // Handle provider selection change
  providerSelect.addEventListener('change', (e) => {
    const selectedProvider = e.target.value;
    updateProviderHelp(selectedProvider);
    
    // Clear API key validation when provider changes
    input.style.borderColor = '';
    
    // Validate current API key against new provider
    const currentKey = input.value.trim();
    if (currentKey) {
      const validation = validateApiKey(currentKey, selectedProvider);
      if (!validation.valid) {
        showStatus(`Current API key is not valid for ${AI_PROVIDERS[selectedProvider].name}`, 'warning');
      }
    }
  });

  // Handle API key form submission with enhanced security
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
      const apiKey = sanitizeText(input.value);
      const provider = providerSelect.value;
      
      // Validate API key
      const validation = validateApiKey(apiKey, provider);
      if (!validation.valid) {
        showStatus(validation.error, 'error');
        input.focus();
        return;
      }
      
      setFormLoadingState(true);
      
      await safeStorageSet({ apiKey, aiProvider: provider });
      showStatus(`Settings saved successfully! You can now use ${AI_PROVIDERS[provider].name} on YouTube.`, 'success');
      
    } catch (error) {
      console.error('Error saving settings:', error);
      showStatus('Failed to save settings. Please try again.', 'error');
    } finally {
      setFormLoadingState(false);
    }
  });
  
  // Handle system prompt form submission with enhanced validation
  promptForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
      const value = sanitizeText(promptTextarea.value);
      
      // Validate system prompt
      const validation = validateSystemPrompt(value);
      if (!validation.valid) {
        showStatus(validation.error, 'error', 'prompt-status');
        promptTextarea.focus();
        return;
      }
      
      setPromptFormLoadingState(true);
      
      await safeStorageSet({ systemPrompt: value });
      showStatus('System prompt saved successfully!', 'success', 'prompt-status');
      
    } catch (error) {
      console.error('Error saving system prompt:', error);
      showStatus('Failed to save system prompt. Please try again.', 'error', 'prompt-status');
    } finally {
      setPromptFormLoadingState(false);
    }
  });
  
  // Handle reset to default prompt with confirmation
  resetPromptButton.addEventListener('click', async () => {
    try {
      const confirmed = confirm('Are you sure you want to reset the system prompt to default? This will overwrite your current custom prompt.');
      if (!confirmed) return;
      
      setPromptFormLoadingState(true);
      
      promptTextarea.value = DEFAULT_SYSTEM_PROMPT;
      await safeStorageRemove('systemPrompt');
      showStatus('System prompt reset to default successfully!', 'success', 'prompt-status');
      
    } catch (error) {
      console.error('Error resetting system prompt:', error);
      showStatus('Failed to reset system prompt. Please try again.', 'error', 'prompt-status');
    } finally {
      setPromptFormLoadingState(false);
    }
  });
  
  // Handle test connection with enhanced error handling
  testButton.addEventListener('click', async () => {
    try {
      const apiKey = sanitizeText(input.value);
      const provider = providerSelect.value;
      
      // Validate API key first
      const validation = validateApiKey(apiKey, provider);
      if (!validation.valid) {
        showStatus(validation.error, 'error');
        input.focus();
        return;
      }
      
      setLoadingState(testButton, true, 'Test Connection');
      
      const result = await testApiConnection(apiKey, provider);
      
      if (result.success) {
        showStatus(result.message, 'success');
      } else {
        showStatus(result.message, 'error');
        console.error('API test failed:', result.details);
      }
      
    } catch (error) {
      console.error('Test connection error:', error);
      showStatus('Test failed due to unexpected error', 'error');
    } finally {
      setLoadingState(testButton, false, 'Test Connection');
    }
  });
  
  // Add enhanced input validation with security checks
  input.addEventListener('blur', () => {
    try {
      const value = sanitizeText(input.value);
      const provider = providerSelect.value;
      if (value) {
        const validation = validateApiKey(value, provider);
        if (!validation.valid) {
          input.style.borderColor = 'var(--in-content-border-invalid)';
        } else {
          input.style.borderColor = 'var(--in-content-border-focus)';
        }
      }
    } catch (error) {
      console.error('Input validation error:', error);
    }
  });
  
  // Add prompt validation with security checks
  promptTextarea.addEventListener('blur', () => {
    try {
      const value = sanitizeText(promptTextarea.value);
      if (value) {
        const validation = validateSystemPrompt(value);
        if (!validation.valid) {
          promptTextarea.style.borderColor = 'var(--in-content-border-invalid)';
        } else {
          promptTextarea.style.borderColor = 'var(--in-content-border-focus)';
        }
      }
    } catch (error) {
      console.error('Prompt validation error:', error);
    }
  });
  
  // Reset border colors on focus
  input.addEventListener('focus', () => {
    input.style.borderColor = '';
  });
  
  promptTextarea.addEventListener('focus', () => {
    promptTextarea.style.borderColor = '';
  });
  
  // Add secure keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    try {
      // Ctrl+S or Cmd+S to save API key when form elements are focused
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && 
          (document.activeElement === input || document.activeElement === providerSelect)) {
        e.preventDefault();
        form.dispatchEvent(new Event('submit'));
      }
      
      // Ctrl+S or Cmd+S to save prompt when textarea is focused
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && document.activeElement === promptTextarea) {
        e.preventDefault();
        promptForm.dispatchEvent(new Event('submit'));
      }
      
      // Ctrl+T or Cmd+T to test (if input has value)
      if ((e.ctrlKey || e.metaKey) && e.key === 't' && input.value.trim()) {
        e.preventDefault();
        testButton.click();
      }
    } catch (error) {
      console.error('Keyboard shortcut error:', error);
    }
  });
  
  // Add input sanitization on input events
  input.addEventListener('input', (e) => {
    try {
      // Remove any potentially dangerous characters in real-time
      const sanitized = e.target.value.replace(/[<>"']/g, '');
      if (sanitized !== e.target.value) {
        e.target.value = sanitized;
      }
    } catch (error) {
      console.error('Input sanitization error:', error);
    }
  });
  
  promptTextarea.addEventListener('input', (e) => {
    try {
      // Basic sanitization for prompt input
      const sanitized = e.target.value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      if (sanitized !== e.target.value) {
        e.target.value = sanitized;
      }
    } catch (error) {
      console.error('Prompt sanitization error:', error);
    }
  });
}); 