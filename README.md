# Mobbin Clipboard Manager Chrome Extension

A Chrome extension that captures and organizes clipboard data from mobbin.com, automatically categorizing by app name and flow type.

## Features

- **Automatic Detection**: Detects app names and flow types from mobbin.com URLs and page content
- **Smart Organization**: Groups clipboard data by app name and flow type (onboarding, signup, etc.)
- **Easy Access**: Clean popup interface to view and manage captured clipboards
- **One-Click Paste**: Paste any captured clipboard data with a single click
- **Auto-Cleanup**: Keeps only the 10 most recent entries per flow to prevent storage bloat

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select this extension folder
4. The extension icon will appear in your toolbar

## Usage

1. Visit mobbin.com and navigate to any app (e.g., `https://mobbin.com/apps/zomato-ios-...`)
2. Go to the flows page to see different flow types
3. Click the "Copy" button with the Figma icon next to any flow
4. You'll see a green notification confirming the capture
5. Click the extension icon to view your organized clipboards
6. Use the "Paste" button to copy any saved clipboard back to your system clipboard

### Supported Flow Detection
The extension automatically detects flow names from:
- `<div id="Onboarding">` - extracts "Onboarding"
- `<div id="Delivery">` - extracts "Delivery"
- `<div id="SignUp">` - extracts "SignUp" 
- Any meaningful div ID that represents a flow name
- Fallback to flow title text if no ID found

### Smart Flow Detection
- **Precise Flow Targeting**: Detects the exact flow being copied by analyzing the clicked button's container
- **Correct Flow Names**: No longer gets wrong/adjacent flow names - finds the specific flow you clicked
- **DOM-Based Timing**: Waits for "Flow copied" success message instead of arbitrary timeouts
- **Large Flow Support**: Handles flows of any size by waiting for actual completion signal

### Complex Data Handling
- Detects and handles complex JSON clipboard data from mobbin.com
- Shows data size and type in preview (e.g., "JSON data (3 keys)" or "Complex data (15KB)")
- Waits for backend completion signal before capture
- Retries capture if clipboard is initially empty

### Smart Storage Management
- **Automatic Compression**: Large clipboard data (>50KB) is compressed to save space
- **Quota Monitoring**: Shows storage usage in popup (e.g., "Storage: 1.2MB / 5MB (24%)")
- **Auto Cleanup**: Removes old entries when storage gets full (>80%)
- **Error Handling**: Shows clear error messages when storage quota is exceeded
- **Clear All Button**: Appears when storage is almost full for easy cleanup

## How It Works

### Content Script (content.js)
- Monitors mobbin.com pages for app and flow information
- Specifically detects "Copy to Figma" button clicks (with Figma icon)
- Extracts app names from `<h1 class="text-title-2">` elements
- Identifies flow names from `<div id="FlowName">` elements
- Shows visual confirmation when clipboard is captured

### Background Script (background.js)
- Handles data storage using Chrome's storage API
- Organizes data by app name and flow type
- Manages cleanup of old entries

### Popup Interface (popup.html/js)
- Displays organized clipboard data in a collapsible tree structure
- Provides paste and delete functionality
- Shows timestamps and content previews

## Data Structure

```
{
  "App Name": {
    "onboarding": [
      {
        "id": "timestamp",
        "content": "clipboard content",
        "timestamp": "ISO date",
        "url": "source URL"
      }
    ],
    "signup": [...],
    "login": [...]
  }
}
```

## Permissions

- `activeTab`: Access to the current tab for clipboard operations
- `storage`: Store clipboard data locally
- `clipboardRead/Write`: Read and write clipboard content
- `host_permissions`: Access to mobbin.com

## Troubleshooting

- If clipboard capture isn't working, make sure you're on mobbin.com
- The extension needs clipboard permissions - grant them when prompted
- Data is stored locally and won't sync across devices
- Clear extension data from Chrome settings if needed

## Development

To modify the extension:
1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes