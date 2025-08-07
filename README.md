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
5. Click "Save Settings"

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

- **Multiple AI Providers**: Claude, OpenAI, and Gemini
- **Smart Comment Collection**: Quick mode for visible comments, deep mode for more
- **Reply Inclusion**: Automatically includes comment replies
- **Seamless Integration**: Works with YouTube's navigation
- **Error Handling**: Automatic retry and clear error messages
- **Privacy**: API keys stored securely, no data collection

## 🧪 **Testing**

1. Navigate to any YouTube video
2. Scroll to comments section
3. Click "Summarize Comments" or "Deep Summarize"
4. Verify summary appears correctly

## 📄 **License**

This project is licensed under the MIT License.

## 🙏 **Acknowledgments**

- YouTube for the platform
- Anthropic, OpenAI, and Google for AI services
- Firefox team for the WebExtensions API 