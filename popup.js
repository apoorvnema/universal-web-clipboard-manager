// Popup script for displaying and managing clipboard data
class ClipboardManager {
  constructor() {
    this.enabledDomains = [];
    this.currentView = 'domains'; // 'domains', 'apps', 'flows', 'clipboards'
    this.currentDomain = null;
    this.currentApp = null;
    this.currentAppId = null;
    this.currentFlow = null;
    this.currentFlowId = null;
    this.currentPage = 0;
    this.pageSize = 3; // 3 items per page for domains/apps/flows
    this.clipboardPageSize = 5; // 5 clipboards per page
    this.currentData = [];
    this.totalCount = 0;
    this.hasMore = false;
    this.init();
  }

  async init() {
    console.log('Initializing ClipboardManager...');
    
    try {
      await this.loadEnabledDomains();
      console.log('Enabled domains loaded:', this.enabledDomains);
      
      this.setupEventListeners();
      console.log('Event listeners set up');
      
      await this.loadCurrentView();
      console.log('Current view loaded');
      
      this.render();
      console.log('Initial render complete');
    } catch (error) {
      console.error('Failed to initialize:', error);
      // Show error state
      const loading = document.getElementById('loading');
      if (loading) {
        loading.textContent = 'Failed to load. Check console for details.';
        loading.style.color = '#dc3545';
      }
    }
  }

  async loadCurrentView() {
    console.log(`Loading ${this.currentView} view...`);
    
    try {
      let response;
      
      if (this.currentView === 'domains') {
        console.log('Requesting domains...');
        response = await chrome.runtime.sendMessage({ 
          action: 'getDomains', 
          page: this.currentPage, 
          limit: this.pageSize 
        });
      } else if (this.currentView === 'apps') {
        console.log('Requesting apps for domain:', this.currentDomain);
        response = await chrome.runtime.sendMessage({ 
          action: 'getApps', 
          domain: this.currentDomain,
          page: this.currentPage, 
          limit: this.pageSize 
        });
      } else if (this.currentView === 'flows') {
        console.log('Requesting flows for appId:', this.currentAppId);
        response = await chrome.runtime.sendMessage({ 
          action: 'getFlows', 
          appId: this.currentAppId,
          page: this.currentPage, 
          limit: this.pageSize 
        });
      } else if (this.currentView === 'clipboards') {
        console.log('Requesting clipboards for flowId:', this.currentFlowId);
        response = await chrome.runtime.sendMessage({ 
          action: 'getClipboards', 
          flowId: this.currentFlowId,
          page: this.currentPage, 
          limit: this.clipboardPageSize 
        });
      }
      
      console.log('Response received:', response);
      
      if (response) {
        this.currentData = response.data || [];
        this.totalCount = response.totalCount || 0;
        this.hasMore = response.hasMore || false;
        console.log(`Loaded ${this.currentView}:`, this.currentData);
        console.log(`Total count: ${this.totalCount}, Has more: ${this.hasMore}`);
      } else {
        console.log('No response received');
        this.currentData = [];
        this.totalCount = 0;
        this.hasMore = false;
      }
    } catch (error) {
      console.error(`Failed to load ${this.currentView}:`, error);
      this.currentData = [];
      this.totalCount = 0;
      this.hasMore = false;
    }
  }

  async loadEnabledDomains() {
    try {
      const domains = await chrome.runtime.sendMessage({ action: 'getEnabledDomains' });
      this.enabledDomains = domains || ['mobbin.com'];
    } catch (error) {
      console.error('Failed to load enabled domains:', error);
      this.enabledDomains = ['mobbin.com'];
    }
  }

  setupEventListeners() {
    const settingsBtn = document.getElementById('settings-btn');
    const debugBtn = document.getElementById('debug-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');

    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.showSettings());
    }

    if (debugBtn) {
      debugBtn.addEventListener('click', () => this.debugDB());
    }

    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        if (confirm('Clear all clipboard data? This cannot be undone.')) {
          this.clearAllData();
        }
      });
    }
  }

  async debugDB() {
    try {
      console.log('Running debug DB...');
      const debugResult = await chrome.runtime.sendMessage({ action: 'debugDB' });
      console.log('Debug DB result:', debugResult);
      
      console.log('Running test DB...');
      const testResult = await chrome.runtime.sendMessage({ action: 'testDB' });
      console.log('Test DB result:', testResult);
      
      alert(`DB Debug:\nStores: ${debugResult.storeNames?.join(', ')}\nCount: ${debugResult.count}\nTest Success: ${testResult.success}\nCheck console for details`);
      
      // Reload current view after test
      await this.loadCurrentView();
      this.render();
    } catch (error) {
      console.error('Debug DB failed:', error);
      alert('Debug failed: ' + error.message);
    }
  }

  async clearAllData() {
    try {
      await chrome.runtime.sendMessage({ action: 'clearAllData' });
      this.resetToHome();
      await this.loadCurrentView();
      this.render();
    } catch (error) {
      console.error('Failed to clear data:', error);
    }
  }

  resetToHome() {
    this.currentView = 'domains';
    this.currentDomain = null;
    this.currentApp = null;
    this.currentAppId = null;
    this.currentFlow = null;
    this.currentFlowId = null;
    this.currentPage = 0;
    this.currentData = [];
    this.totalCount = 0;
    this.hasMore = false;
  }

  async showSettings() {
    this.currentView = 'settings';
    this.render();
  }

  async showDomains() {
    this.showLoading();
    this.resetToHome();
    await this.loadCurrentView();
    this.render();
  }

  async showApps(domain) {
    this.showLoading();
    this.currentView = 'apps';
    this.currentDomain = domain;
    this.currentApp = null;
    this.currentAppId = null;
    this.currentPage = 0;
    await this.loadCurrentView();
    this.render();
  }

  async showFlows(appId, appName) {
    this.showLoading();
    this.currentView = 'flows';
    this.currentAppId = appId;
    this.currentApp = appName;
    this.currentFlow = null;
    this.currentFlowId = null;
    this.currentPage = 0;
    await this.loadCurrentView();
    this.render();
  }

  async showClipboards(flowId, flowName) {
    this.showLoading();
    this.currentView = 'clipboards';
    this.currentFlowId = flowId;
    this.currentFlow = flowName;
    this.currentPage = 0;
    await this.loadCurrentView();
    this.render();
  }

  async nextPage() {
    if (this.hasMore) {
      this.showLoading();
      this.currentPage++;
      await this.loadCurrentView();
      this.render();
    }
  }

  async prevPage() {
    if (this.currentPage > 0) {
      this.showLoading();
      this.currentPage--;
      await this.loadCurrentView();
      this.render();
    }
  }

  showLoading() {
    const loading = document.getElementById('loading');
    const container = document.getElementById('clipboard-container');
    const emptyState = document.getElementById('empty-state');
    
    if (loading) loading.style.display = 'block';
    if (container) container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'none';
  }

  render() {
    console.log('Rendering view:', this.currentView);
    console.log('Current data:', this.currentData);
    
    const container = document.getElementById('clipboard-container');
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('empty-state');

    if (loading) loading.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (container) container.innerHTML = '';

    // Show clear all button if there's data
    const clearAllBtn = document.getElementById('clear-all-btn');
    if (clearAllBtn) {
      clearAllBtn.style.display = this.totalCount > 0 ? 'block' : 'none';
    }

    if (this.currentView === 'settings') {
      this.renderSettings(container);
    } else if (this.currentView === 'domains') {
      this.renderDomains(container);
    } else if (this.currentView === 'apps') {
      this.renderApps(container);
    } else if (this.currentView === 'flows') {
      this.renderFlows(container);
    } else if (this.currentView === 'clipboards') {
      this.renderClipboards(container);
    }

    // Show empty state only for domains view when no data
    if (this.currentData.length === 0 && this.currentView === 'domains') {
      if (emptyState) emptyState.style.display = 'block';
    }
  }

  renderSettings(container) {
    const settingsDiv = document.createElement('div');
    settingsDiv.className = 'settings-view';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-secondary back-btn';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => this.showDomains());

    const title = document.createElement('h2');
    title.textContent = 'Domain Settings';
    title.style.margin = '16px 0';

    const description = document.createElement('p');
    description.textContent = 'Enable clipboard capture for these domains:';
    description.style.fontSize = '14px';
    description.style.color = '#6c757d';

    const domainList = document.createElement('div');
    domainList.className = 'domain-list';

    // Add example domains
    const exampleDomains = ['mobbin.com', 'google.com', 'github.com', 'figma.com'];
    
    exampleDomains.forEach(domain => {
      const domainItem = document.createElement('div');
      domainItem.className = 'domain-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = this.enabledDomains.includes(domain);
      checkbox.addEventListener('change', () => this.toggleDomain(domain, checkbox.checked));
      
      const label = document.createElement('label');
      label.textContent = domain;
      label.style.marginLeft = '8px';
      
      domainItem.appendChild(checkbox);
      domainItem.appendChild(label);
      domainList.appendChild(domainItem);
    });

    settingsDiv.appendChild(backBtn);
    settingsDiv.appendChild(title);
    settingsDiv.appendChild(description);
    settingsDiv.appendChild(domainList);
    container.appendChild(settingsDiv);
  }

  renderDomains(container) {
    if (!container) {
      console.error('Container not found for renderDomains');
      return;
    }

    if (this.currentData.length === 0) {
      console.log('No domains to render');
      return; // Empty state will be shown
    }

    console.log('Rendering domains:', this.currentData);

    // Add pagination controls
    this.addPaginationControls(container, 'Domains');

    this.currentData.forEach(domainData => {
      const domainDiv = document.createElement('div');
      domainDiv.className = 'app-section';

      const domainHeader = document.createElement('div');
      domainHeader.className = 'app-header';
      domainHeader.innerHTML = `<span>${domainData.domain}</span>`;
      domainHeader.addEventListener('click', () => this.showApps(domainData.domain));

      domainDiv.appendChild(domainHeader);
      container.appendChild(domainDiv);
    });
  }

  renderApps(container) {
    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-secondary back-btn';
    backBtn.textContent = '← Back to Domains';
    backBtn.addEventListener('click', () => this.showDomains());
    container.appendChild(backBtn);

    const title = document.createElement('h2');
    title.textContent = this.currentDomain;
    title.style.margin = '16px 0';
    container.appendChild(title);

    if (this.currentData.length === 0) {
      const noData = document.createElement('p');
      noData.textContent = 'No apps found for this domain.';
      noData.style.textAlign = 'center';
      noData.style.color = '#6c757d';
      container.appendChild(noData);
      return;
    }

    // Add pagination controls
    this.addPaginationControls(container, 'Apps');

    this.currentData.forEach(appData => {
      const appDiv = document.createElement('div');
      appDiv.className = 'app-section';

      const appHeader = document.createElement('div');
      appHeader.className = 'app-header';
      appHeader.innerHTML = `<span>${appData.appName}</span>`;
      appHeader.addEventListener('click', () => this.showFlows(appData.id, appData.appName));

      appDiv.appendChild(appHeader);
      container.appendChild(appDiv);
    });
  }

  renderFlows(container) {
    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-secondary back-btn';
    backBtn.textContent = '← Back to Apps';
    backBtn.addEventListener('click', () => this.showApps(this.currentDomain));
    container.appendChild(backBtn);

    const title = document.createElement('h2');
    title.textContent = this.currentApp;
    title.style.margin = '16px 0';
    container.appendChild(title);

    if (this.currentData.length === 0) {
      const noData = document.createElement('p');
      noData.textContent = 'No flows found for this app.';
      noData.style.textAlign = 'center';
      noData.style.color = '#6c757d';
      container.appendChild(noData);
      return;
    }

    // Add pagination controls
    this.addPaginationControls(container, 'Flows');

    this.currentData.forEach(flowData => {
      const flowDiv = document.createElement('div');
      flowDiv.className = 'flow-section';

      const flowHeader = document.createElement('div');
      flowHeader.className = 'flow-header';
      
      const headerContent = document.createElement('div');
      headerContent.style.display = 'flex';
      headerContent.style.justifyContent = 'space-between';
      headerContent.style.alignItems = 'center';
      headerContent.style.width = '100%';
      
      const flowInfo = document.createElement('span');
      flowInfo.innerHTML = `${flowData.flowName}`;
      flowInfo.addEventListener('click', () => this.showClipboards(flowData.id, flowData.flowName));
      flowInfo.style.cursor = 'pointer';
      flowInfo.style.flex = '1';
      
      const flowActions = document.createElement('div');
      flowActions.style.display = 'flex';
      flowActions.style.gap = '8px';
      
      const deleteFlowBtn = document.createElement('button');
      deleteFlowBtn.className = 'btn btn-danger';
      deleteFlowBtn.textContent = 'Delete';
      deleteFlowBtn.style.fontSize = '10px';
      deleteFlowBtn.style.padding = '2px 6px';
      deleteFlowBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteFlow(flowData.id, flowData.flowName);
      });
      
      flowActions.appendChild(deleteFlowBtn);
      
      headerContent.appendChild(flowInfo);
      headerContent.appendChild(flowActions);
      flowHeader.appendChild(headerContent);

      flowDiv.appendChild(flowHeader);
      container.appendChild(flowDiv);
    });
  }

  renderClipboards(container) {
    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-secondary back-btn';
    backBtn.textContent = '← Back to Flows';
    backBtn.addEventListener('click', () => this.showFlows(this.currentAppId, this.currentApp));
    container.appendChild(backBtn);

    const title = document.createElement('h2');
    title.textContent = this.currentFlow;
    title.style.margin = '16px 0';
    container.appendChild(title);

    if (this.currentData.length === 0) {
      const noData = document.createElement('p');
      noData.textContent = 'No clipboards found for this flow.';
      noData.style.textAlign = 'center';
      noData.style.color = '#6c757d';
      container.appendChild(noData);
      return;
    }

    // Add pagination controls
    this.addPaginationControls(container, 'Clipboards');

    this.currentData.forEach(clipboard => {
      const clipboardElement = this.createClipboardElement(clipboard);
      container.appendChild(clipboardElement);
    });
  }

  addPaginationControls(container, itemType) {
    if (this.totalCount <= this.pageSize && itemType !== 'Clipboards') return;
    if (this.totalCount <= this.clipboardPageSize && itemType === 'Clipboards') return;

    const paginationDiv = document.createElement('div');
    paginationDiv.className = 'pagination';
    
    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-secondary';
    prevBtn.textContent = '← Previous';
    prevBtn.disabled = this.currentPage === 0;
    prevBtn.addEventListener('click', () => this.prevPage());

    const startIndex = this.currentPage * (itemType === 'Clipboards' ? this.clipboardPageSize : this.pageSize) + 1;
    const endIndex = Math.min(startIndex + this.currentData.length - 1, this.totalCount);
    
    const pageInfo = document.createElement('span');
    pageInfo.textContent = `${startIndex}-${endIndex} of ${this.totalCount}`;
    pageInfo.style.margin = '0 12px';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-secondary';
    nextBtn.textContent = 'Next →';
    nextBtn.disabled = !this.hasMore;
    nextBtn.addEventListener('click', () => this.nextPage());

    paginationDiv.appendChild(prevBtn);
    paginationDiv.appendChild(pageInfo);
    paginationDiv.appendChild(nextBtn);
    container.appendChild(paginationDiv);
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



  async toggleDomain(domain, enabled) {
    try {
      if (enabled) {
        if (!this.enabledDomains.includes(domain)) {
          this.enabledDomains.push(domain);
        }
      } else {
        this.enabledDomains = this.enabledDomains.filter(d => d !== domain);
      }
      
      await chrome.runtime.sendMessage({ 
        action: 'setEnabledDomains', 
        domains: this.enabledDomains 
      });
    } catch (error) {
      console.error('Failed to update enabled domains:', error);
    }
  }

  async deleteFlow(flowId, flowName) {
    if (!confirm(`Delete all clipboards for "${flowName}" flow? This cannot be undone.`)) {
      return;
    }

    try {
      await chrome.runtime.sendMessage({ 
        action: 'deleteFlow', 
        flowId
      });
      
      // Reload current view
      await this.loadCurrentView();
      this.render();
    } catch (error) {
      console.error('Failed to delete flow:', error);
    }
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
      await this.loadCurrentView();
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