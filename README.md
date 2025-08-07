# YouTube Comment Summarizer

A Firefox extension that summarizes YouTube video comments using AI (Claude, OpenAI, or Gemini) with enhanced privacy and security features.

## 🚀 **Installation**

### **Development Installation**
1. Clone the repository
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox" tab
4. Click "Load Temporary Add-on"
5. Select `manifest.json`

### **Production Installation**
1. Download the extension files
2. Open Firefox and navigate to `about:addons`
3. Click the gear icon and select "Install Add-on From File"
4. Select the extension directory

## ⚙️ **Configuration**

### **API Key Setup**
1. Get API keys from your preferred provider:
   - **Claude**: [Anthropic Console](https://console.anthropic.com/)
   - **OpenAI**: [OpenAI Platform](https://platform.openai.com/api-keys)
   - **Gemini**: [Google AI Studio](https://makersuite.google.com/app/apikey)

2. Open the extension options page
3. Select your preferred AI provider
4. Enter your API key
5. Optionally customize the system prompt
6. Click "Save Settings"

### **System Prompt Customization**
The default system prompt is:
```
Please provide a concise summary of the YouTube video comments below in a single short paragraph (2-4 sentences). Focus on the main themes and overall sentiment. Write in a natural, flowing style without bullet points or numbered lists. Keep it brief and easy to read.
```

You can customize this in the options page to change how the AI analyzes comments.

## 🎯 **Usage**

### **Quick Summarize**
- Click "Summarize Comments" to analyze visible comments
- Processes up to 100 comments without scrolling
- Fast response time
- Includes replies to comments

### **Deep Summarize**
- Click "Deep Summarize" for comprehensive analysis
- Scrolls to load more comments (up to 400)
- Automatically detects when more content is available
- Longer processing time but more thorough analysis

## 🔧 **Features**

### **Multiple AI Providers**
- **Claude 3.5 Sonnet**: Anthropic's latest model
- **OpenAI GPT-3.5 Turbo**: OpenAI's efficient model
- **Google Gemini Pro**: Google's advanced model
- Easy switching between providers in options

### **Smart Comment Collection**
- **Visible Comments**: Quick analysis of currently visible comments
- **Deep Collection**: Scrolls to load more comments automatically
- **Reply Expansion**: Automatically expands and includes comment replies
- **Duplicate Prevention**: Removes duplicate comments automatically

### **Robust Navigation Handling**
- **SPA Navigation**: Works with YouTube's single-page application
- **Button Persistence**: Buttons remain visible across video navigation
- **Summary Cleanup**: Summaries are removed when navigating to new videos
- **Auto-Recovery**: Buttons automatically restore if they disappear

### **Error Handling & Retry Logic**
- **Exponential Backoff**: Automatic retry with increasing delays
- **Provider Fallback**: Switch providers if one is overloaded
- **Rate Limiting**: Built-in protection against API rate limits
- **User-Friendly Errors**: Clear error messages with actionable advice

### **Security & Privacy**
- **Local Storage**: API keys stored securely in browser
- **Input Validation**: Comprehensive validation of all inputs
- **XSS Prevention**: Sanitized API responses
- **No Data Collection**: No user data is collected or transmitted

## 🛡️ **Security Features**

### **Input Validation**
- Comprehensive validation for all inputs
- XSS prevention through text sanitization
- API key format validation
- Prompt injection protection

### **Rate Limiting**
- 10 requests per minute per tab
- Automatic cleanup of old requests
- Configurable limits

### **Error Handling**
- Graceful error recovery
- User-friendly error messages
- Comprehensive logging for debugging

## 📊 **Performance Optimizations**

### **DOM Caching**
- Cache frequently accessed DOM elements
- Automatic cache invalidation
- Optimized selectors

### **Debouncing**
- Debounced reply expansion
- Throttled navigation handling
- Optimized event listeners

### **Memory Management**
- Cleanup registry for memory leaks
- Automatic cleanup on navigation
- Limited cleanup function storage

## 🧪 **Testing**

### **Manual Testing**
1. Navigate to any YouTube video
2. Scroll to comments section
3. Click "Summarize Comments" or "Deep Summarize"
4. Verify summary appears correctly
5. Test navigation between videos

## 🔄 **File Structure**

```
📄 manifest.json           # Extension manifest
📄 content.js             # Content script (YouTube interaction)
📄 background.js          # Background script (API handling)
📄 options.html           # Options page HTML
📄 options.js             # Options page logic
📄 style.css              # Extension styling
📁 icons/                 # Extension icons
├── icon-48.png
└── icon-96.png
```

## 🚀 **Future Enhancements**

### **Planned Improvements**
1. **Advanced Comment Filtering**: Filter by comment type or sentiment
2. **Summary Export**: Export summaries to various formats
3. **Custom Themes**: Additional UI themes and customization
4. **Batch Processing**: Summarize multiple videos at once
5. **Analytics Dashboard**: View summary statistics over time

## 🤝 **Contributing**

### **Development Setup**
1. Fork the repository
2. Create a feature branch
3. Follow the established code patterns
4. Add comprehensive tests
5. Submit a pull request

### **Code Standards**
- Use ES6+ features
- Write comprehensive JSDoc comments
- Maintain consistent error handling
- Follow Firefox WebExtensions best practices

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- YouTube for the platform
- Anthropic, OpenAI, and Google for AI services
- Firefox team for the WebExtensions API 