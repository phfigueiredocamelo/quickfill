# QuickFill - AI-Powered Form Auto-Filler Chrome Extension

QuickFill is a Chrome extension that automatically fills HTML forms using GPT and saved context data. It analyzes form fields and their labels to understand their purpose, then matches them with appropriate data from your saved context.

Created by Paulo Henrique Figueiredo with assistance from Claude (Claude 3 Sonnet, Anthropic).

## Features

- **AI-Powered Form Analysis**: Uses GPT to understand form fields and their required data types
- **Intelligent Data Matching**: Matches form fields with corresponding data from your saved context
- **Automatic Form Filling**: Populates forms with appropriate values across different websites
- **Multi-Input Support**: Handles different input types (text, select, radio, checkbox, etc.)
- **Customizable**: Allows adding custom field mappings for specific websites or forms
- **User Control**: Review and confirm auto-filled data before submission
- **Privacy-Focused**: All data is stored locally in your browser

## How It Works

1. The extension scans forms on web pages
2. It analyzes form elements (inputs, selects, textareas) and their labels
3. It sends the form structure along with your saved context to GPT
4. GPT identifies appropriate values for each form field
5. The extension auto-fills the form with the matched values
6. Form fields are highlighted to show which ones were auto-filled

## Installation

### Developer Mode Installation

1. Clone this repository or download the source code
2. Install dependencies: `npm install`
3. Build the extension: `npm run build`
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable "Developer mode" (toggle in the top right)
6. Click "Load unpacked" and select the `dist` folder

## Usage

1. Click the QuickFill icon in your browser toolbar
2. Enter your OpenAI API key in the Settings tab
3. Add your personal information in the Context Data tab
4. Navigate to a website with a form
5. The extension will automatically fill the form if auto-fill is enabled
6. You can also click the "Fill Forms" button in the popup to manually trigger form filling

## Development

- `npm run dev` - Watch for changes and rebuild
- `npm run build` - Build for production

## Code Structure

- **src/content.js**: Main content script injected into web pages
- **src/utils/**: Utility modules
  - **constants.js**: Constants and default settings
  - **notification.js**: UI notification management
  - **formUtils.js**: Form manipulation utilities
  - **formProcessor.js**: Main form processor
  - **gptProcessor.js**: GPT API communication
  - **domObserver.js**: Observer for detecting DOM changes

## Privacy and Security

- All your personal data is stored locally in your browser
- API keys and personal information never leave your computer except when making API calls
- The extension only sends form structure and your context data to OpenAI's API
- You have full control over what data is stored and used

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.