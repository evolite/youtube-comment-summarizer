// test.js - Test suite for YouTube Comment Summarizer

// Mock browser APIs for testing
const mockBrowser = {
  storage: {
    local: {
      data: {},
      get: function(key) {
        return Promise.resolve({ [key]: this.data[key] });
      },
      set: function(obj) {
        Object.assign(this.data, obj);
        return Promise.resolve();
      },
      clear: function() {
        this.data = {};
        return Promise.resolve();
      }
    }
  },
  runtime: {
    sendMessage: function(message) {
      return Promise.resolve({ summary: 'Test summary' });
    }
  }
};

// Test utilities
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }
  
  test(name, fn) {
    this.tests.push({ name, fn });
  }
  
  async run() {
    console.log('🧪 Running test suite...\n');
    
    for (const test of this.tests) {
      try {
        await test.fn();
        console.log(`✅ ${test.name}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${test.name}`);
        console.log(`   Error: ${error.message}\n`);
        this.failed++;
      }
    }
    
    console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`);
  }
  
  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }
  
  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }
  
  assertThrows(fn, message) {
    let threw = false;
    try {
      fn();
    } catch (error) {
      threw = true;
    }
    if (!threw) {
      throw new Error(message || 'Expected function to throw');
    }
  }
}

// Initialize test runner
const test = new TestRunner();

// Background script tests
test.test('validateComments should accept valid comments array', () => {
  // Mock the validation function from background.js
  function validateComments(comments) {
    if (!comments || !Array.isArray(comments)) {
      throw new Error('Invalid comments data: must be an array');
    }
    
    if (comments.length === 0) {
      throw new Error('No comments provided');
    }
    
    const processedComments = comments
      .filter(comment => typeof comment === 'string' && comment.trim().length >= 5)
      .map(comment => comment.substring(0, 1000).trim())
      .slice(0, 100);
    
    if (processedComments.length === 0) {
      throw new Error('No valid comments found after filtering');
    }
    
    return processedComments;
  }
  
  const validComments = ['This is a great video!', 'I love this content', 'Amazing work'];
  const result = validateComments(validComments);
  
  test.assertEqual(result.length, 3, 'Should return all valid comments');
  test.assertEqual(result[0], 'This is a great video!', 'Should preserve comment text');
});

test.test('validateComments should reject invalid input', () => {
  function validateComments(comments) {
    if (!comments || !Array.isArray(comments)) {
      throw new Error('Invalid comments data: must be an array');
    }
    return comments;
  }
  
  test.assertThrows(() => validateComments(null), 'Should throw for null input');
  test.assertThrows(() => validateComments('string'), 'Should throw for string input');
  test.assertThrows(() => validateComments(123), 'Should throw for number input');
});

test.test('rate limiting should work correctly', () => {
  const RATE_LIMIT = {
    maxRequests: 2,
    windowMs: 1000,
    requests: new Map()
  };
  
  function checkRateLimit(tabId) {
    const now = Date.now();
    const tabRequests = RATE_LIMIT.requests.get(tabId) || [];
    
    const recentRequests = tabRequests.filter(time => now - time < RATE_LIMIT.windowMs);
    
    if (recentRequests.length >= RATE_LIMIT.maxRequests) {
      throw new Error('Rate limit exceeded');
    }
    
    recentRequests.push(now);
    RATE_LIMIT.requests.set(tabId, recentRequests);
    
    return true;
  }
  
  // Should allow first request
  test.assert(checkRateLimit('tab1'), 'Should allow first request');
  
  // Should allow second request
  test.assert(checkRateLimit('tab1'), 'Should allow second request');
  
  // Should reject third request
  test.assertThrows(() => checkRateLimit('tab1'), 'Should reject third request');
});

test.test('sanitizeApiResponse should remove dangerous content', () => {
  function sanitizeApiResponse(text) {
    if (typeof text !== 'string') {
      return 'Invalid response format';
    }
    
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }
  
  const maliciousInput = 'Hello <script>alert("xss")</script> world <iframe src="evil.com"></iframe>';
  const result = sanitizeApiResponse(maliciousInput);
  
  test.assertEqual(result, 'Hello  world', 'Should remove script and iframe tags');
  
  const jsInput = 'Click <a href="javascript:alert()">here</a>';
  const jsResult = sanitizeApiResponse(jsInput);
  
  test.assert(!jsResult.includes('javascript:'), 'Should remove javascript: URLs');
});

// Content script tests
test.test('findComments should use fallback selectors', () => {
  // Mock DOM
  const mockDocument = {
    querySelectorAll: function(selector) {
      const mockElements = {
        'ytd-comment-thread-renderer #content-text': [
          { textContent: 'Comment 1' },
          { textContent: 'Comment 2' }
        ],
        '.comment-text': [],
        '[data-comment-text]': []
      };
      
      return mockElements[selector] || [];
    }
  };
  
  function findComments() {
    const selectors = [
      'ytd-comment-thread-renderer #content-text',
      '.comment-text',
      '[data-comment-text]'
    ];
    
    for (const selector of selectors) {
      try {
        const elements = mockDocument.querySelectorAll(selector);
        if (elements.length > 0) {
          return Array.from(elements)
            .map(el => el.textContent?.trim())
            .filter(Boolean);
        }
      } catch (error) {
        console.warn(`Selector failed: ${selector}`, error);
      }
    }
    return [];
  }
  
  const result = findComments();
  test.assertEqual(result.length, 2, 'Should find comments using first selector');
  test.assertEqual(result[0], 'Comment 1', 'Should extract comment text correctly');
});

// Options page tests
test.test('validateApiKey should validate correctly', () => {
  function validateApiKey(key) {
    if (!key || typeof key !== 'string') {
      return { valid: false, error: 'API key is required' };
    }
    
    if (key.length < 10) {
      return { valid: false, error: 'API key is too short' };
    }
    
    if (!key.startsWith('sk-ant-')) {
      return { valid: false, error: 'Invalid API key format' };
    }
    
    return { valid: true };
  }
  
  // Valid key
  const validResult = validateApiKey('sk-ant-1234567890abcdef');
  test.assert(validResult.valid, 'Should accept valid API key');
  
  // Invalid keys
  const shortResult = validateApiKey('sk-ant-123');
  test.assert(!shortResult.valid, 'Should reject short API key');
  
  const wrongFormatResult = validateApiKey('invalid-key-format');
  test.assert(!wrongFormatResult.valid, 'Should reject wrong format');
  
  const emptyResult = validateApiKey('');
  test.assert(!emptyResult.valid, 'Should reject empty key');
});

// Integration tests
test.test('full workflow simulation', async () => {
  // Mock a complete workflow
  global.browser = mockBrowser;
  
  // 1. Save API key
  await mockBrowser.storage.local.set({ apiKey: 'sk-ant-test123456789' });
  
  // 2. Retrieve API key
  const { apiKey } = await mockBrowser.storage.local.get('apiKey');
  test.assertEqual(apiKey, 'sk-ant-test123456789', 'Should save and retrieve API key');
  
  // 3. Send message to background script
  const response = await mockBrowser.runtime.sendMessage({
    type: 'summarize',
    comments: ['Great video!', 'Love this content', 'Amazing work']
  });
  
  test.assert(response.summary, 'Should receive summary response');
});

// Performance tests
test.test('performance benchmarks', () => {
  // Test comment processing performance
  const largeCommentArray = Array(1000).fill('This is a test comment that is reasonably long');
  
  const startTime = performance.now();
  
  // Simulate comment processing
  const processed = largeCommentArray
    .filter(comment => typeof comment === 'string' && comment.trim().length >= 5)
    .map(comment => comment.substring(0, 1000).trim())
    .slice(0, 100);
  
  const endTime = performance.now();
  const processingTime = endTime - startTime;
  
  test.assert(processingTime < 100, `Comment processing should be fast (took ${processingTime}ms)`);
  test.assertEqual(processed.length, 100, 'Should limit to 100 comments');
});

// Run tests if in test environment
if (typeof window === 'undefined' || window.location.href.includes('test.html')) {
  test.run().catch(console.error);
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TestRunner, test };
} 