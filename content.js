// Content script for mobbin.com
class MobbinClipboardCapture {
  constructor() {
    this.currentApp = null;
    this.currentFlow = null;
    this.init();
  }

  init() {
    this.detectAppAndFlow();
    this.setupClipboardListener();
    this.observePageChanges();
  }

  detectAppAndFlow() {
    this.detectAppName();
    this.detectFlowName();
    console.log('Detected App:', this.currentApp, 'Flow:', this.currentFlow);
  }

  detectAppName() {
    // Extract app name from the specific h1 element structure
    const appTitleElement = document.querySelector('h1.text-title-2');
    if (appTitleElement) {
      // Get the first text node which contains the app name (e.g., "Zomato")
      const appName = appTitleElement.childNodes[0]?.textContent?.trim();
      if (appName) {
        this.currentApp = appName;
        return;
      }
    }

    // Fallback: try to extract from URL
    const urlParts = window.location.pathname.split('/');
    const appIndex = urlParts.indexOf('apps');
    
    if (appIndex !== -1 && urlParts[appIndex + 1]) {
      this.currentApp = this.formatAppName(urlParts[appIndex + 1]);
    }
  }

  detectFlowName() {
    // Extract flow name from div with id attribute - accept ANY meaningful id
    const flowElements = document.querySelectorAll('div[id]');
    for (const element of flowElements) {
      const flowId = element.id;
      // Accept any id that looks like a flow name (not empty, not generic)
      if (flowId && flowId.length > 2 && !this.isGenericId(flowId)) {
        this.currentFlow = flowId;
        console.log('Found flow from div id:', flowId);
        break;
      }
    }

    // Fallback: look for flow name in the flow title text
    if (!this.currentFlow) {
      const flowTitleElement = document.querySelector('.underline.decoration-transparent');
      if (flowTitleElement) {
        const flowText = flowTitleElement.textContent.trim();
        if (flowText && flowText.length > 2) {
          this.currentFlow = flowText;
          console.log('Found flow from title text:', flowText);
        }
      }
    }

    // Final fallback: extract from URL if on flows page
    if (!this.currentFlow && window.location.pathname.includes('flows')) {
      this.currentFlow = 'general';
    }
  }

  findFlowContainer(button) {
    // Traverse up the DOM to find the flow container
    let current = button;
    while (current && current !== document.body) {
      // Look for the flow container with an ID
      if (current.id && current.id.length > 2 && !this.isGenericId(current.id)) {
        return current;
      }
      
      // Look for container with flow title
      const flowTitle = current.querySelector('.underline.decoration-transparent');
      if (flowTitle) {
        return current;
      }
      
      current = current.parentElement;
    }
    return null;
  }

  extractFlowFromContainer(container) {
    if (!container) return null;
    
    // First try to get from container ID
    if (container.id && container.id.length > 2 && !this.isGenericId(container.id)) {
      return container.id;
    }
    
    // Then try to get from flow title within container
    const flowTitle = container.querySelector('.underline.decoration-transparent');
    if (flowTitle) {
      const flowText = flowTitle.textContent.trim();
      if (flowText && flowText.length > 2) {
        return flowText;
      }
    }
    
    return null;
  }

  waitForFlowCopiedMessage() {
    console.log('Waiting for "Flow copied" message...');
    
    let attempts = 0;
    const maxAttempts = 50; // 10 seconds max
    
    const checkForMessage = () => {
      attempts++;
      
      // Look for "Flow copied" or similar success message
      const successMessages = document.querySelectorAll('*');
      let foundMessage = false;
      
      for (const element of successMessages) {
        const text = element.textContent?.toLowerCase() || '';
        if (text.includes('flow copied') || 
            text.includes('copied to clipboard') || 
            text.includes('copied successfully')) {
          console.log('Found success message:', element.textContent);
          foundMessage = true;
          break;
        }
      }
      
      if (foundMessage) {
        // Wait a bit more for clipboard to be fully populated
        setTimeout(() => this.handleClipboardCapture(), 500);
      } else if (attempts < maxAttempts) {
        // Keep checking every 500ms
        setTimeout(checkForMessage, 500);
      } else {
        console.log('Timeout waiting for success message, trying to capture anyway');
        this.handleClipboardCapture();
      }
    };
    
    // Start checking after a short delay
    setTimeout(checkForMessage, 500);
  }

  isGenericId(id) {
    // Filter out generic/system IDs that aren't flow names
    const genericPatterns = [
      /^radix-/i,
      /^headlessui-/i,
      /^react-/i,
      /^\d+$/,
      /^[a-f0-9-]{36}$/i, // UUID pattern
      /^root$/i,
      /^app$/i,
      /^main$/i,
      /^content$/i,
      /^container$/i
    ];

    return genericPatterns.some(pattern => pattern.test(id));
  }

  formatAppName(rawName) {
    return rawName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  extractFlowName(text) {
    const flowPatterns = [
      /onboarding/i,
      /sign[- ]?up/i,
      /log[- ]?in/i,
      /checkout/i,
      /profile/i,
      /settings/i,
      /dashboard/i,
      /home/i
    ];

    for (const pattern of flowPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].toLowerCase();
      }
    }

    return 'general';
  }

  setupClipboardListener() {
    // Listen specifically for "Copy to Figma" button clicks
    document.addEventListener('click', (event) => {
      const target = event.target;
      const button = target.closest('button');
      
      // Check if this is the Copy to Figma button
      if (button) {
        const buttonText = button.textContent.toLowerCase();
        const hasFigmaIcon = button.querySelector('svg[data-sentry-component="FigmaOutlinedIcon"]');
        
        if ((buttonText.includes('copy') && hasFigmaIcon) || 
            buttonText.includes('copy to figma')) {
          console.log('Copy to Figma button clicked');
          
          // Find the specific flow being copied by traversing up the DOM
          const flowContainer = this.findFlowContainer(button);
          const specificFlow = this.extractFlowFromContainer(flowContainer);
          
          console.log('Detected specific flow:', specificFlow);
          
          // Re-detect app name
          this.detectAppName();
          
          // Set the specific flow we found
          if (specificFlow) {
            this.currentFlow = specificFlow;
          }
          
          // Wait for "Flow copied" message to appear, then capture
          this.waitForFlowCopiedMessage();
        }
      }
    });

    // Also listen for general copy events as backup
    document.addEventListener('copy', async () => {
      // Only capture if we're on a flows page
      if (window.location.pathname.includes('flows')) {
        setTimeout(() => this.handleClipboardCapture(), 100);
      }
    });
  }

  async handleClipboardCapture() {
    try {
      const clipboardData = await navigator.clipboard.readText();
      
      if (clipboardData && clipboardData.trim()) {
        // Make sure we have current app and flow info
        if (!this.currentApp || !this.currentFlow) {
          this.detectAppAndFlow();
        }

        // Check if clipboard contains complex data (JSON-like)
        let contentPreview = clipboardData;
        let isComplexData = false;
        
        try {
          // Try to parse as JSON to detect complex data
          const parsed = JSON.parse(clipboardData);
          if (parsed && typeof parsed === 'object') {
            isComplexData = true;
            contentPreview = `JSON data (${Object.keys(parsed).length} keys)`;
          }
        } catch (e) {
          // Not JSON, check if it looks like complex data
          if (clipboardData.includes('{"key":') || clipboardData.includes('payload')) {
            isComplexData = true;
            contentPreview = `Complex data (${Math.round(clipboardData.length / 1024)}KB)`;
          }
        }

        const captureData = {
          appName: this.currentApp || 'Unknown App',
          flowName: this.currentFlow || 'general',
          clipboardContent: clipboardData,
          contentPreview: contentPreview,
          isComplexData: isComplexData,
          timestamp: new Date().toISOString(),
          url: window.location.href
        };

        // Send to background script for storage
        chrome.runtime.sendMessage({
          action: 'saveClipboard',
          data: captureData
        }, (response) => {
          if (response && response.success) {
            console.log('Clipboard captured successfully:', captureData);
            // Show a brief visual feedback
            this.showCaptureNotification();
          } else {
            console.error('Failed to save clipboard:', response?.error);
            this.showErrorNotification(response?.error || 'Storage failed');
          }
        });
      } else {
        console.log('No clipboard data found, retrying in 1 second...');
        // Retry once more after additional delay
        setTimeout(() => this.handleClipboardCapture(), 1000);
      }
    } catch (error) {
      console.error('Failed to capture clipboard:', error);
      // Try alternative method for older browsers
      this.fallbackClipboardCapture();
    }
  }

  fallbackClipboardCapture() {
    // Show notification that we detected the click but couldn't capture
    console.log('Clipboard API failed, but Copy to Figma was clicked');
    
    // Still show notification with detected app/flow
    if (this.currentApp && this.currentFlow) {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #FF9800;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        transition: opacity 0.3s ease;
      `;
      notification.textContent = `⚠ Detected ${this.currentApp} - ${this.currentFlow} (clipboard access limited)`;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }, 3000);
    }
  }

  showCaptureNotification() {
    // Create a small notification to show capture was successful
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      transition: opacity 0.3s ease;
    `;
    notification.textContent = `✓ Captured ${this.currentApp} - ${this.currentFlow}`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 2000);
  }

  showErrorNotification(error) {
    // Create a notification to show storage error
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      transition: opacity 0.3s ease;
      max-width: 300px;
    `;
    
    if (error.includes('quota')) {
      notification.textContent = `⚠ Storage full! Please clear old clipboards in extension popup.`;
    } else {
      notification.textContent = `✗ Save failed: ${error}`;
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000); // Show error longer
  }

  observePageChanges() {
    // Watch for navigation changes and DOM updates
    let lastUrl = location.href;
    
    const observer = new MutationObserver((mutations) => {
      const url = location.href;
      
      // Check for URL changes
      if (url !== lastUrl) {
        lastUrl = url;
        console.log('URL changed to:', url);
        setTimeout(() => this.detectAppAndFlow(), 1500);
      }
      
      // Check for new content being loaded (like flow sections)
      const hasNewFlowContent = mutations.some(mutation => {
        return Array.from(mutation.addedNodes).some(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            return node.querySelector && (
              node.querySelector('div[id]') || 
              node.querySelector('.underline.decoration-transparent') ||
              node.querySelector('h1.text-title-2')
            );
          }
          return false;
        });
      });
      
      if (hasNewFlowContent) {
        console.log('New flow content detected');
        setTimeout(() => this.detectAppAndFlow(), 500);
      }
    });
    
    observer.observe(document, { 
      subtree: true, 
      childList: true,
      attributes: true,
      attributeFilter: ['id', 'class']
    });
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new MobbinClipboardCapture());
} else {
  new MobbinClipboardCapture();
}