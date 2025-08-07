# YouTube Comment Summarizer

A Firefox browser extension that provides AI-powered summaries of YouTube video comments using Claude 3.5 Sonnet API.

## 🚀 Features

- **One-click summarization** of YouTube video comments
- **AI-powered insights** using Claude 3.5 Sonnet
- **Smart comment loading** with fallback selectors
- **Rate limiting** to prevent API abuse
- **Secure API key storage** with validation
- **Event-driven navigation** handling
- **CSP compliant** implementation
- **Responsive design** with dark mode support
- **Comprehensive error handling**

## 📦 Installation

### For Development

1. Clone or download this repository
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox" in the left sidebar
4. Click "Load Temporary Add-on..."
5. Select the `manifest.json` file from the extension directory

### For Production

1. Create a ZIP file of all extension files
2. Submit to [Mozilla Add-ons](https://addons.mozilla.org/) for review
3. Install from the Firefox Add-ons store once approved

## ⚙️ Setup

### 1. Get Claude API Key

1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Create an account or sign in
3. Generate a new API key
4. Copy the key (starts with `sk-ant-`)

### 2. Configure Extension

1. Right-click the extension icon in Firefox toolbar
2. Select "Manage Extension" → "Preferences"
3. Enter your Claude API key
4. Click "Save API Key"

## 🎯 Usage

1. Navigate to any YouTube video
2. Scroll down to the comments section
3. Click the "Summarize Comments" button
4. Wait for the AI-powered summary to appear
5. Read the concise summary of key themes and sentiment

## 🛡️ Security Features

### Input Validation
- Comments are filtered and limited to prevent abuse
- Maximum 100 comments per request
- 1000 character limit per comment
- Total payload size restrictions

### Rate Limiting
- Maximum 10 requests per minute per tab
- Automatic request throttling
- User-friendly error messages

### API Response Sanitization
- Removes potentially dangerous HTML/JavaScript
- Prevents XSS attacks
- Validates response format

### Secure Storage
- API keys are stored locally using browser.storage.local
- No data transmission to third parties
- Input validation for all user data

## 🔧 Technical Details

### Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Content       │    │    Background    │    │   Options       │
│   Script        │◄──►│    Script        │◄──►│   Page          │
│                 │    │                  │    │                 │
│ - DOM injection │    │ - API calls      │    │ - Settings      │
│ - User events   │    │ - Rate limiting  │    │ - Key storage   │
│ - Navigation    │    │ - Validation     │    │ - Validation    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### File Structure

```
youtube-comment-summarizer/
├── manifest.json          # Extension configuration
├── background.js          # API calls and validation
├── content.js            # DOM manipulation and UI
├── options.html          # Settings page
├── options.js            # Settings logic
├── style.css             # UI styling
├── test.js               # Test suite
├── test.html             # Test runner
├── README.md             # Documentation
└── icons/
    ├── icon-48.png       # Extension icon (48x48)
    └── icon-96.png       # Extension icon (96x96)
```

## 🧪 Testing

### Run Tests in Browser

1. Open `test.html` in your browser
2. Click "Run All Tests"
3. View test results and coverage

### Run Specific Tests

```javascript
// In browser console
runSpecificTest('validation');  // Run validation tests
runSpecificTest('rate');        // Run rate limiting tests
```

### Test Coverage

- ✅ Input validation
- ✅ Rate limiting
- ✅ API response sanitization
- ✅ Comment extraction
- ✅ Error handling
- ✅ Integration workflows
- ✅ Performance benchmarks

## 🔍 API Reference

### Background Script Functions

#### `validateComments(comments)`
Validates and filters comment array.

**Parameters:**
- `comments` (Array): Array of comment strings

**Returns:**
- Array of validated comments (max 100)

**Throws:**
- Error if invalid input or no valid comments

#### `checkRateLimit(tabId)`
Enforces rate limiting per tab.

**Parameters:**
- `tabId` (String): Unique tab identifier

**Returns:**
- `true` if request allowed

**Throws:**
- Error if rate limit exceeded

#### `sanitizeApiResponse(text)`
Sanitizes API response to prevent XSS.

**Parameters:**
- `text` (String): Raw API response

**Returns:**
- Sanitized text string

### Content Script Functions

#### `findComments()`
Extracts comments using fallback selectors.

**Returns:**
- Array of comment text strings

#### `NavigationHandler`
Handles YouTube's SPA navigation.

**Methods:**
- `init()`: Initialize navigation handling
- `cleanup()`: Clean up event listeners

## 🚨 Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "API key not set" | No API key configured | Set key in extension options |
| "Rate limit exceeded" | Too many requests | Wait and try again |
| "Invalid comments data" | Comment extraction failed | Refresh page and retry |
| "API key format invalid" | Wrong key format | Check key starts with `sk-ant-` |

### Debug Mode

Enable debug logging in browser console:

```javascript
// In content script context
CONFIG.debug = true;
```

## 🔄 Updates and Maintenance

### Version History

- **v1.0.0**: Initial release with basic functionality
- **v1.1.0**: Added security improvements and rate limiting
- **v1.2.0**: Enhanced navigation handling and testing

### Maintenance Tasks

- [ ] Update Claude API version annually
- [ ] Test compatibility with Firefox updates
- [ ] Monitor and adjust rate limits
- [ ] Update comment selectors if YouTube changes

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run the test suite
5. Submit a pull request

### Code Style

- Use semicolons
- 2-space indentation
- Descriptive variable names
- Comprehensive error handling
- JSDoc comments for functions

### Testing Requirements

- All new features must include tests
- Maintain 90%+ test coverage
- Performance tests for heavy operations

## 📝 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Issues**: Report bugs on GitHub
- **Documentation**: Check this README
- **Tests**: Run test suite for debugging
- **API**: Refer to [Claude API docs](https://docs.anthropic.com/)

## 🔮 Roadmap

### Planned Features

- [ ] Comment sentiment analysis
- [ ] Customizable summary length
- [ ] Multiple language support
- [ ] Export summaries
- [ ] Summary caching
- [ ] Chrome extension version

### Performance Improvements

- [ ] Lazy loading of comments
- [ ] Background comment pre-loading
- [ ] Summary caching
- [ ] Optimized selectors

---

**Made with ❤️ for the YouTube community** 