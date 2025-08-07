# YouTube Comment Summarizer

A Firefox extension that summarizes YouTube video comments using AI (Claude, OpenAI, or Gemini).

## 🚀 **Installation**

1. Open Firefox and navigate to `about:debugging`
2. Click "This Firefox" tab
3. Click "Load Temporary Add-on"
4. Select `manifest.json`

## ⚙️ **Setup**

1. Get an API key from your preferred provider:
   - **Claude**: [Anthropic Console](https://console.anthropic.com/)
   - **OpenAI**: [OpenAI Platform](https://platform.openai.com/api-keys)
   - **Gemini**: [Google AI Studio](https://makersuite.google.com/app/apikey)

2. Open the extension options page
3. Select your preferred AI provider
4. Enter your API key
5. Optionally customize the system prompt
6. Click "Save Settings"

## 🎯 **Usage**

### **Quick Summarize**
- Click "Summarize Comments" to analyze visible comments
- Fast response time
- Includes replies to comments

### **Deep Summarize**
- Click "Deep Summarize" for comprehensive analysis
- Automatically loads more comments by scrolling
- Longer processing time but more thorough analysis

## 🔧 **Features**

### **Multiple AI Providers**
- **Claude 3.5 Sonnet**: Anthropic's latest model
- **OpenAI GPT-3.5 Turbo**: OpenAI's efficient model
- **Google Gemini Pro**: Google's advanced model
- Easy switching between providers

### **Smart Comment Collection**
- **Quick Mode**: Analyzes currently visible comments
- **Deep Mode**: Scrolls to load more comments automatically
- **Reply Inclusion**: Automatically includes comment replies
- **Duplicate Prevention**: Removes duplicate comments

### **Seamless YouTube Integration**
- Works with YouTube's navigation
- Buttons remain visible across video changes
- Summaries are removed when navigating to new videos
- Automatic recovery if buttons disappear

### **Error Handling**
- Automatic retry with increasing delays
- Switch providers if one is overloaded
- Built-in protection against API rate limits
- Clear error messages with helpful advice

### **Privacy & Security**
- API keys stored securely in your browser
- No user data is collected or transmitted
- Comprehensive input validation
- Sanitized API responses

## 🧪 **Testing**

1. Navigate to any YouTube video
2. Scroll to comments section
3. Click "Summarize Comments" or "Deep Summarize"
4. Verify summary appears correctly
5. Test navigation between videos

## 🚀 **Future Enhancements**

- Advanced comment filtering
- Summary export functionality
- Custom themes and UI customization
- Batch processing for multiple videos
- Analytics dashboard

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Follow the established code patterns
4. Submit a pull request

## 📄 **License**

This project is licensed under the MIT License.

## 🙏 **Acknowledgments**

- YouTube for the platform
- Anthropic, OpenAI, and Google for AI services
- Firefox team for the WebExtensions API 