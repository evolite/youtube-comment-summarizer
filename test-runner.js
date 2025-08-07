// test-runner.js - Browser test runner for YouTube Comment Summarizer

// Override console.log for test output
let outputElement;

// Browser-based test runner
class BrowserTestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.outputElement = null;
  }
  
  initialize() {
    this.outputElement = document.getElementById('output');
    outputElement = this.outputElement;
    
    // Override console.log to display in the page
    const originalLog = console.log;
    console.log = (...args) => {
      const message = args.join(' ');
      if (this.outputElement) {
        this.outputElement.textContent += message + '\n';
        this.outputElement.scrollTop = this.outputElement.scrollHeight;
      }
      originalLog.apply(console, args);
    };
  }
  
  test(name, fn) {
    this.tests.push({ name, fn });
  }
  
  async run() {
    this.passed = 0;
    this.failed = 0;
    
    console.log('🧪 Starting Test Suite...\n');
    
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
    
    console.log('\n📊 Test Results:');
    console.log(`   Passed: ${this.passed}`);
    console.log(`   Failed: ${this.failed}`);
    console.log(`   Total: ${this.tests.length}`);
    
    if (this.failed === 0) {
      console.log('\n🎉 All tests passed!');
    } else {
      console.log(`\n⚠️  ${this.failed} test(s) failed.`);
    }
    
    this.updateStats();
  }
  
  updateStats() {
    const statsElement = document.getElementById('stats');
    if (statsElement) {
      const total = this.tests.length;
      const passRate = total > 0 ? Math.round((this.passed / total) * 100) : 0;
      statsElement.textContent = `Tests: ${total} | Passed: ${this.passed} | Failed: ${this.failed} | Pass Rate: ${passRate}%`;
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

// Global functions for test controls
async function runTests() {
  const runBtn = document.getElementById('run-btn');
  runBtn.disabled = true;
  runBtn.textContent = 'Running...';
  
  clearOutput();
  
  try {
    await window.testRunner.run();
  } catch (error) {
    console.log('❌ Test runner error:', error.message);
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = 'Run All Tests';
  }
}

function clearOutput() {
  if (outputElement) {
    outputElement.textContent = '';
  }
}

function runSpecificTest() {
  const testName = prompt('Enter test name (partial match):');
  if (!testName) return;
  
  const matchingTests = window.testRunner.tests.filter(test => 
    test.name.toLowerCase().includes(testName.toLowerCase())
  );
  
  if (matchingTests.length === 0) {
    console.log(`No tests found matching "${testName}"`);
    return;
  }
  
  console.log(`Running ${matchingTests.length} test(s) matching "${testName}":\n`);
  
  matchingTests.forEach(async (test, index) => {
    try {
      await test.fn();
      console.log(`✅ ${test.name}`);
    } catch (error) {
      console.log(`❌ ${test.name}`);
      console.log(`   Error: ${error.message}\n`);
    }
  });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize browser test runner
  window.testRunner = new BrowserTestRunner();
  window.testRunner.initialize();
  
  // Copy tests from the imported test runner if available
  if (typeof test !== 'undefined' && test.tests) {
    window.testRunner.tests = test.tests;
  }
  
  // Show initial stats
  window.testRunner.updateStats();
}); 