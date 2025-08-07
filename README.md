# YouTube Comment Summarizer

A secure Firefox browser extension that provides AI-powered summaries of YouTube video comments using your choice of Claude 3.5 Sonnet, OpenAI GPT-3.5 Turbo, or Google Gemini Pro.

## 🚀 Features

- **Multi-AI Provider Support** - Choose between Claude, OpenAI, or Gemini
- **Two Summarization Modes**:
  - **Quick Summarize** - Analyzes visible comments instantly
  - **Deep Summarize** - Loads more comments for comprehensive analysis
- **Secure API Integration** with comprehensive input validation
- **Customizable AI Prompts** - Tailor the summarization style
- **Smart Rate Limiting** to prevent API abuse (10 requests/minute/tab)
- **Event-driven Navigation** - Works seamlessly across YouTube videos
- **Modern UI Design** - Matches YouTube's visual style with dark mode support
- **Enhanced Security** - XSS prevention, input sanitization, secure storage
- **Comprehensive Testing Suite** - Browser-based unit and integration tests

## 📦 Installation

### For Development

1. Clone or download this repository
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox" in the left sidebar
4. Click "Load Temporary Add-on..."
5. Select the `manifest.json` file from the extension directory

### For Production

1. Create a ZIP file of all extension files (excluding development files)
2. Submit to [Mozilla Add-ons](https://addons.mozilla.org/) for review
3. Install from the Firefox Add-ons store once approved

## ⚙️ Setup

### 1. Choose Your AI Provider

The extension supports three AI providers:

#### Claude 3.5 Sonnet (Anthropic)
- **Strengths**: Advanced reasoning, nuanced analysis
- **Get API Key**: [Anthropic Console](https://console.anthropic.com/)
- **Key Format**: Starts with `sk-ant-`

#### OpenAI GPT-3.5 Turbo
- **Strengths**: Fast, cost-effective, widely supported
- **Get API Key**: [OpenAI Platform](https://platform.openai.com/api-keys)
- **Key Format**: Starts with `sk-`

#### Google Gemini Pro
- **Strengths**: Free tier available with Google account
- **Get API Key**: [Google AI Studio](https://makersuite.google.com/app/apikey)
- **Key Format**: 20+ character alphanumeric string

### 2. Configure Extension

1. Right-click the extension icon in Firefox toolbar
2. Select "Manage Extension" → "Preferences"
3. Choose your preferred AI provider
4. Enter your API key
5. Optionally customize the system prompt
6. Click "Save Settings"

## 🎯 Usage

### Quick Summarize (Recommended)
1. Navigate to any YouTube video
2. Scroll down to the comments section
3. Click the **"Summarize Comments"** button
4. Get an instant summary of visible comments

### Deep Summarize
1. Navigate to any YouTube video with many comments
2. Scroll down to the comments section
3. Click the **"Deep Summarize"** button
4. The extension will automatically load more comments and provide a comprehensive analysis

## 🛡️ Security Features

### Enhanced Input Validation
- Comments filtered and sanitized for malicious content
- Maximum 100 comments per quick request, 200 for deep analysis
- 1000 character limit per comment
- API key format validation per provider
- System prompt validation and sanitization

### Advanced Rate Limiting
- 10 requests per minute per tab
- Automatic request throttling with user feedback
- Memory-efficient rate limit tracking with cleanup

### API Response Security
- Comprehensive HTML/JavaScript tag removal
- XSS attack prevention
- Response length limiting
- Suspicious URL protocol filtering

### Secure Data Handling
- API keys stored locally using `browser.storage.local`
- No data transmission to unauthorized third parties
- Input sanitization at multiple levels
- Timeout protection for all network requests

## 🔧 Technical Details

### Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Content       │    │    Background    │    │   Options       │
│   Script        │◄──►│    Script        │◄──►│   Page          │
│                 │    │                  │    │                 │
│ - UI injection  │    │ - Multi-AI APIs  │    │ - Provider sel. │
│ - Comment scrape│    │ - Rate limiting  │    │ - API keys      │
│ - Navigation    │    │ - Validation     │    │ - Custom prompts│
│ - Two modes     │    │ - Security       │    │ - Validation    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### File Structure

```
youtube-comment-summarizer/
├── manifest.json          # Extension configuration (v1.2.2)
├── background.js          # Multi-provider API integration
├── content.js            # Enhanced UI and comment extraction
├── options.html          # Modern settings page with dark mode
├── options.js            # Multi-provider settings logic
├── style.css             # YouTube-matching UI design
├── test.js               # Comprehensive test suite
├── test.html             # Browser-based test runner
├── test-runner.js        # Test execution engine
├── README.md             # This documentation
└── icons/
    ├── icon-48.png       # Extension icon (48x48)
    └── icon-96.png       # Extension icon (96x96)
```

### AI Provider Integration

The extension abstracts AI provider differences:

```javascript
// Each provider has standardized configuration
const AI_PROVIDERS = {
  claude: {
    name: 'Claude 3.5 Sonnet',
    endpoint: 'https://api.anthropic.com/v1/messages',
    keyPattern: /^sk-ant-[a-zA-Z0-9\-_]+$/,
    model: 'claude-3-5-sonnet-20240620',
    maxTokens: 2048
  },
  // ... OpenAI and Gemini configurations
};
```

## 🧪 Testing

### Run Complete Test Suite

1. Open `test.html` in your browser
2. Click "Run All Tests"
3. View detailed results with timing and coverage

### Run Specific Test Categories

```javascript
// In browser console
runSpecificTest('validation');    // Input validation tests
runSpecificTest('rate');         // Rate limiting tests
runSpecificTest('security');     // Security and sanitization tests
runSpecificTest('integration'); // Full workflow tests
```

### Test Coverage

- ✅ Multi-provider API validation
- ✅ Enhanced input validation and sanitization
- ✅ Rate limiting with memory management
- ✅ Security features (XSS prevention, response sanitization)
- ✅ Comment extraction with fallback selectors
- ✅ Navigation handling across YouTube videos
- ✅ Error handling and recovery
- ✅ Integration workflows for all providers
- ✅ Performance benchmarks and optimization
- ✅ UI state management

## 🔍 API Reference

### Background Script Functions

#### `validateApiKey(apiKey, provider)`
Validates API key format for the specified provider.

**Parameters:**
- `apiKey` (String): The API key to validate
- `provider` (String): Provider name ('claude', 'openai', 'gemini')

**Returns:**
- `true` if valid

**Throws:**
- Error with specific validation message

#### `callAIProvider(provider, apiKey, systemPrompt, comments)`
Makes API call to the specified provider.

**Parameters:**
- `provider` (String): AI provider identifier
- `apiKey` (String): Valid API key
- `systemPrompt` (String): Customized system prompt
- `comments` (Array): Validated comments array

**Returns:**
- Promise resolving to summary text

### Content Script Functions

#### `loadAllCommentsWithoutScrolling()`
Extracts currently visible comments without any page interaction.

**Returns:**
- Promise resolving to array of up to 100 comment strings

#### `loadAllCommentsWithScrolling()`
Scrolls page and loads more comments for deep analysis.

**Returns:**
- Promise resolving to array of up to 200 comment strings

#### `NavigationHandler`
Handles YouTube's single-page application navigation.

**Methods:**
- `init()`: Initialize navigation event handling
- `cleanup()`: Remove event listeners and clean up

## 🚨 Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "API key not set" | No API key configured | Set key in extension options |
| "Invalid AI provider" | Provider not selected | Choose provider in settings |
| "Rate limit exceeded" | Too many requests | Wait 1 minute and try again |
| "Invalid comments data" | Comment extraction failed | Refresh page and retry |
| "API key format invalid" | Wrong key format for provider | Check key format requirements |
| "Gemini API error: 404" | Outdated Gemini endpoint | Extension auto-handles latest endpoint |

### Debug Mode

Enable comprehensive logging:

```javascript
// In browser console (content script context)
CONFIG.debug = true;

// View detailed logs for troubleshooting
```

## 🔄 Version History

- **v1.0.0**: Initial release with Claude integration
- **v1.1.0**: Added security improvements and comprehensive testing
- **v1.2.0**: Enhanced navigation, rate limiting, and error handling
- **v1.2.1**: Multi-provider support (Claude, OpenAI, Gemini)
- **v1.2.2**: Deep summarize feature, enhanced UI, custom icons

## 🤝 Contributing

### Development Guidelines

1. **Fork and Branch**: Create feature branches from main
2. **Code Standards**: Follow existing patterns and add JSDoc comments
3. **Security First**: All inputs must be validated and sanitized
4. **Test Coverage**: New features require comprehensive tests
5. **Performance**: Benchmark heavy operations

### Testing Requirements

- All new features must include unit tests
- Integration tests for user workflows
- Security tests for validation functions
- Performance tests for optimization
- Browser compatibility testing

## 📝 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Issues**: Report bugs via GitHub Issues
- **Documentation**: Comprehensive README and inline comments
- **Testing**: Run test suite for debugging assistance
- **API Documentation**:
  - [Claude API](https://docs.anthropic.com/)
  - [OpenAI API](https://platform.openai.com/docs/)
  - [Gemini API](https://ai.google.dev/docs/)

## 🔮 Roadmap

### Upcoming Features

- [ ] **Summary Export**: Save summaries as text/PDF
- [ ] **Comment Sentiment Trends**: Track sentiment over time
- [ ] **Multilingual Support**: Detect and summarize in multiple languages
- [ ] **Summary Caching**: Cache results to reduce API calls
- [ ] **Advanced Filtering**: Filter comments by sentiment/keywords
- [ ] **Chrome Extension**: Port to Chromium-based browsers

### Technical Improvements

- [ ] **Background Comment Loading**: Pre-load comments for faster summaries
- [ ] **Optimized Selectors**: Improve comment detection reliability
- [ ] **Streaming Responses**: Show summary as it's generated
- [ ] **Offline Mode**: Cache and work without internet
- [ ] **Performance Analytics**: Track extension performance metrics

---

**Built with ❤️ for the YouTube community** | **Secure • Fast • Privacy-First** 