# Spaces - Chrome Extension

Intuitive tab management for Chrome.

## Installation

### Chrome Extension Store
[Install from Chrome Web Store](https://chrome.google.com/webstore/detail/spaces/cenkmofngpohdnkbjdpilgpmbiiljjim)

### Development Version (Manifest V3)

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension should now appear in your browser

## Manifest V3 Migration

This extension has been upgraded to use Chrome Extension Manifest V3. Key changes made:

### Technical Changes
- **Manifest Version**: Updated from v2 to v3
- **Background Scripts**: Converted from persistent background page to service worker
- **Browser Action**: Updated to use `action` instead of `browser_action`
- **Permissions**: Moved host permissions to separate field
- **APIs**: Replaced deprecated `chrome.extension.getBackgroundPage()` with messaging
- **Storage**: Replaced localStorage with `chrome.storage.local` for service worker compatibility

### File Changes
- `manifest.json`: Updated to v3 format
- `js/background.js`: Combined all background scripts into single service worker
- `js/popup.js`: Updated to use messaging instead of background page access
- `js/spaces.js`: Updated deprecated API calls

### Browser Support
- **Minimum Chrome Version**: 88+ (required for manifest v3)
- **Firefox**: Not supported (manifest v3 implementation differs)

## Features

- **Spaces Management**: Save and restore window sessions
- **Tab Organization**: Move tabs between spaces
- **Keyboard Shortcuts**: Quick access to space switching
- **Import/Export**: Backup and restore your spaces

## Development

### Files Structure
```
js/
├── background.js       # Service worker (combined from original background scripts)
├── popup.js           # Popup window functionality
├── spaces.js          # Main spaces management UI
├── spacesRenderer.js  # UI rendering utilities
├── spacesService.js   # Core spaces logic (legacy, functionality moved to background.js)
├── switcher.js        # Space switching functionality
└── utils.js           # Utility functions (legacy, functionality moved to background.js)
```

### Legacy Files (No Longer Used)
- `js/db.js` - Database functionality (moved to background.js)
- `js/dbService.js` - Database service (moved to background.js)
- `js/spacesService.js` - Core service (moved to background.js)
- `js/utils.js` - Utilities (moved to background.js)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
