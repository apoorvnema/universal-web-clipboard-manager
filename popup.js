// Popup script for displaying and managing clipboard data
class ClipboardManager {
  constructor() {
    this.clipboards = {};
    this.collapsedApps = new Set();
    this.collapsedFlows = new Set();
    this.init();
  }

  async init() {
    await this.loadClipboards();
    await this.loadStorageInfo();
    this.render();
  }

  async loadClipboards() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getClipboards' });
      this.clipboards = response || {};
    } catch (error) {
      console.error('Failed to load clipboards:', error);
    }
  }

  async loadStorageInfo() {
    try {
      const info = await chrome.runtime.sendMessage({ action: 'getStorageInfo' });
      this.storageInfo = info;
      this.updateStorageDisplay();
    } catch (error) {
      console.error('Failed to load storage info:', error);
    }
  }

  updateStorageDisplay() {
    const storageElement = document.getElementById('storage-info');
    const clearButton = document.getElementById('clear-all-btn');
    
    if (!storageElement || !this.storageInfo) return;

    const { usagePercent, usageKB, quotaKB } = this.storageInfo;
    
    storageElement.textContent = `Storage: ${usageKB}KB / ${quotaKB}KB (${usagePercent}%)`;
    
    if (usagePercent > 80) {
      storageElement.className = 'storage-info storage-warning';
      storageElement.textContent += ' - Storage almost full!';
      clearButton.style.display = 'block';
      
      // Add clear all functionality
      clearButton.onclick = () => {
        if (confirm('Clear all clipboard data? This cannot be undone.')) {
          this.clearAllData();
        }
      };
    } else {
      storageElement.className = 'storage-info';
      clearButton.style.display = 'none';
    }
  }

  async clearAllData() {
    try {
      await chrome.storage.local.clear();
      this.clipboards = {};
      await this.loadStorageInfo();
      this.render();
    } catch (error) {
      console.error('Failed to clear data:', error);
    }
  }

  render() {
    const container = document.getElementById('clipboard-container');
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('empty-state');

    loading.style.display = 'none';

    if (Object.keys(this.clipboards).length === 0) {
      emptyState.style.display = 'block';
      container.innerHTML = '';
      return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = '';

    for (const [appName, flows] of Object.entries(this.clipboards)) {
      const appElement = this.createAppElement(appName, flows);
      container.appendChild(appElement);
    }
  }

  createAppElement(appName, flows) {
    const appDiv = document.createElement('div');
    appDiv.className = 'app-section';

    const appHeader = document.createElement('div');
    appHeader.className = 'app-header';
    appHeader.innerHTML = `
      <span>${appName}</span>
      <span class="toggle">${this.collapsedApps.has(appName) ? '▶' : '▼'}</span>
    `;

    appHeader.addEventListener('click', () => {
      this.toggleApp(appName);
    });

    appDiv.appendChild(appHeader);

    const flowsContainer = document.createElement('div');
    flowsContainer.className = this.collapsedApps.has(appName) ? 'collapsed' : '';

    for (const [flowName, clipboards] of Object.entries(flows)) {
      const flowElement = this.createFlowElement(appName, flowName, clipboards);
      flowsContainer.appendChild(flowElement);
    }

    appDiv.appendChild(flowsContainer);
    return appDiv;
  }

  createFlowElement(appName, flowName, clipboards) {
    const flowDiv = document.createElement('div');
    flowDiv.className = 'flow-section';

    const flowKey = `${appName}-${flowName}`;
    const flowHeader = document.createElement('div');
    flowHeader.className = 'flow-header';
    flowHeader.innerHTML = `
      <span>${flowName.charAt(0).toUpperCase() + flowName.slice(1)} (${clipboards.length})</span>
      <span class="toggle">${this.collapsedFlows.has(flowKey) ? '▶' : '▼'}</span>
    `;

    flowHeader.addEventListener('click', () => {
      this.toggleFlow(flowKey);
    });

    flowDiv.appendChild(flowHeader);

    const clipboardsContainer = document.createElement('div');
    clipboardsContainer.className = this.collapsedFlows.has(flowKey) ? 'collapsed' : '';

    clipboards.forEach(clipboard => {
      const clipboardElement = this.createClipboardElement(clipboard);
      clipboardsContainer.appendChild(clipboardElement);
    });

    flowDiv.appendChild(clipboardsContainer);
    return flowDiv;
  }

  createClipboardElement(clipboard) {
    const clipboardDiv = document.createElement('div');
    clipboardDiv.className = 'clipboard-item';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'clipboard-content';

    const preview = document.createElement('div');
    preview.className = 'clipboard-preview';

    // Use contentPreview if available, otherwise create one
    if (clipboard.contentPreview) {
      preview.textContent = clipboard.contentPreview;
    } else {
      const content = clipboard.content || '';
      preview.textContent = content.substring(0, 50) + (content.length > 50 ? '...' : '');
    }

    // Add indicator for complex data
    if (clipboard.isComplexData) {
      preview.style.fontStyle = 'italic';
      preview.style.color = '#007bff';
    }

    const timestamp = document.createElement('div');
    timestamp.className = 'clipboard-timestamp';
    timestamp.textContent = new Date(clipboard.timestamp).toLocaleString();

    contentDiv.appendChild(preview);
    contentDiv.appendChild(timestamp);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'clipboard-actions';

    const pasteBtn = document.createElement('button');
    pasteBtn.className = 'btn btn-primary';
    pasteBtn.textContent = 'Paste';
    pasteBtn.addEventListener('click', (event) => {
      this.pasteClipboard(clipboard.content, event.target);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', () => {
      this.deleteClipboard(clipboard.id);
    });

    actionsDiv.appendChild(pasteBtn);
    actionsDiv.appendChild(deleteBtn);

    clipboardDiv.appendChild(contentDiv);
    clipboardDiv.appendChild(actionsDiv);

    return clipboardDiv;
  }

  toggleApp(appName) {
    if (this.collapsedApps.has(appName)) {
      this.collapsedApps.delete(appName);
    } else {
      this.collapsedApps.add(appName);
    }
    this.render();
  }

  toggleFlow(flowKey) {
    if (this.collapsedFlows.has(flowKey)) {
      this.collapsedFlows.delete(flowKey);
    } else {
      this.collapsedFlows.add(flowKey);
    }
    this.render();
  }

  async pasteClipboard(content, button) {
    try {
      await navigator.clipboard.writeText(content);

      // Visual feedback
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      button.style.background = '#28a745';

      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = '';
      }, 1000);
    } catch (error) {
      console.error('Failed to paste clipboard:', error);
      alert('Failed to copy to clipboard. Please try again.');
    }
  }

  async deleteClipboard(id) {
    try {
      await chrome.runtime.sendMessage({ action: 'deleteClipboard', id });
      await this.loadClipboards();
      await this.loadStorageInfo(); // Update storage info after deletion
      this.render();
    } catch (error) {
      console.error('Failed to delete clipboard:', error);
    }
  }
}

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', () => {
  new ClipboardManager();
});