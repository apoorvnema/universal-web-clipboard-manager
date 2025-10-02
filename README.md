# Universal Clipboard Manager

A Chrome extension that captures and organizes clipboard data from any configured website with unlimited storage using IndexedDB.

## Features

- **Universal Domain Support**: Configure any domain for clipboard capture (not just mobbin.com)
- **Unlimited Storage**: Uses IndexedDB instead of localStorage for unlimited storage capacity
- **Domain-Based Organization**: Organize clipboards by Domain → App → Flow structure
- **Separate Rows**: Each copy operation creates a separate row instead of appending
- **Paginated Flow View**: Shows 5 flows at a time with pagination
- **Flow Management**: Delete entire flows from IndexedDB
- **Settings Panel**: Configure which domains to monitor

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select this folder
4. The extension icon should appear in your toolbar

## Usage

### Initial Setup
1. Click the extension icon to open the popup
2. Click "Settings" to configure domains
3. Enable domains you want to monitor (e.g., mobbin.com, google.com)

### Capturing Clipboards
1. Visit an enabled domain
2. Copy content (Ctrl+C or copy buttons)
3. The extension will automatically capture and store the clipboard data

### Viewing Clipboards
1. Click the extension icon
2. Navigate through: Domains → Apps → Flows
3. Each flow shows up to 5 items with pagination
4. Click "Paste" to copy content back to clipboard
5. Click "Delete Flow" to remove all clipboards for that flow

## File Structure

- `manifest.json` - Extension configuration
- `background.js` - Service worker handling IndexedDB operations
- `content.js` - Content script for clipboard capture
- `popup.html/js` - Extension popup interface
- `indexeddb.js` - IndexedDB wrapper class
- `test.html` - Test page for clipboard functionality

## Debugging

1. Open Chrome DevTools
2. Go to Application → Storage → IndexedDB → ClipboardManager
3. Check console logs in:
   - Extension popup (right-click popup → Inspect)
   - Background script (chrome://extensions → Details → Inspect views: service worker)
   - Content script (F12 on any webpage)

## Data Structure

```
IndexedDB: ClipboardManager
├── clipboards (store)
│   ├── id (primary key)
│   ├── domain
│   ├── appName  
│   ├── flowName
│   ├── content
│   ├── contentPreview
│   ├── isComplexData
│   ├── timestamp
│   └── url
└── settings (store)
    └── enabledDomains (array)
```

## Troubleshooting

If clipboards aren't showing:
1. Check browser console for errors
2. Verify domain is enabled in Settings
3. Try reloading the extension
4. Check IndexedDB in DevTools Application tab