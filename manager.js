// Full-tab clipboard manager
class FullClipboardManager {
  constructor() {
    this.db = null;
    this.currentView = 'domains';
    this.currentDomain = null;
    this.currentApp = null;
    this.currentAppId = null;
    this.currentFlow = null;
    this.currentFlowId = null;
    this.currentPage = 0;
    this.pageSize = 15; // More items per page in full view
    this.clipboardPageSize = 25;
    this.currentData = [];
    this.totalCount = 0;
    this.hasMore = false;
    this.searchQuery = '';
    this.init();
  }

  async init() {
    console.log('Initializing Full Clipboard Manager...');
    
    try {
      // Initialize IndexedDB
      this.db = new ClipboardDB();
      await this.db.init();
      console.log('Database initialized');
      
      // Setup event listeners
      this.setupEventListeners();
      console.log('Event listeners set up');
      
      // Load initial view
      await this.loadCurrentView();
      this.render();
      
      console.log('Initialization complete');
    } catch (error) {
      console.error('Failed to initialize:', error);
      this.showError('Failed to initialize. Check console for details.');
    }
  }

  setupEventListeners() {
    // Header buttons
    document.getElementById('refresh-btn')?.addEventListener('click', () => this.refresh());
    document.getElementById('clear-all-btn')?.addEventListener('click', () => this.clearAllData());
    
    // Search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.debounceSearch();
      });
    }
    
    // Breadcrumb navigation
    document.getElementById('breadcrumb')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('breadcrumb-item')) {
        e.preventDefault();
        const view = e.target.dataset.view;
        this.navigateToView(view, e.target.dataset);
      }
    });
  }

  debounceSearch() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 0;
      this.loadCurrentView();
      this.render();
    }, 300);
  }

  async loadCurrentView() {
    console.log(`Loading ${this.currentView} view...`);
    this.showLoading();
    
    try {
      let result;
      
      if (this.currentView === 'domains') {
        result = await this.loadDomains();
      } else if (this.currentView === 'apps') {
        result = await this.loadApps();
      } else if (this.currentView === 'flows') {
        result = await this.loadFlows();
      } else if (this.currentView === 'clipboards') {
        result = await this.loadClipboards();
      }
      
      if (result) {
        this.currentData = result.data || [];
        this.totalCount = result.totalCount || 0;
        this.hasMore = result.hasMore || false;
      }
      
      console.log(`Loaded ${this.currentView}:`, this.currentData);
    } catch (error) {
      console.error(`Failed to load ${this.currentView}:`, error);
      this.currentData = [];
      this.totalCount = 0;
      this.hasMore = false;
      this.showError(`Failed to load ${this.currentView}`);
    }
  }

  async loadDomains() {
    const domains = await this.db.getDomains(this.currentPage, this.pageSize);
    const totalCount = await this.db.countDomains();
    
    return {
      data: domains,
      totalCount,
      hasMore: (this.currentPage + 1) * this.pageSize < totalCount
    };
  }

  async loadApps() {
    const apps = await this.db.getAppsByDomain(this.currentDomain, this.currentPage, this.pageSize);
    const totalCount = await this.db.countAppsByDomain(this.currentDomain);
    
    return {
      data: apps,
      totalCount,
      hasMore: (this.currentPage + 1) * this.pageSize < totalCount
    };
  }

  async loadFlows() {
    const flows = await this.db.getFlowsByApp(this.currentAppId, this.currentPage, this.pageSize);
    const totalCount = await this.db.countFlowsByApp(this.currentAppId);
    
    return {
      data: flows,
      totalCount,
      hasMore: (this.currentPage + 1) * this.pageSize < totalCount
    };
  }

  async loadClipboards() {
    const clipboards = await this.db.getClipboardsByFlow(this.currentFlowId, this.currentPage, this.clipboardPageSize);
    const totalCount = await this.db.countClipboardsByFlow(this.currentFlowId);
    
    return {
      data: clipboards,
      totalCount,
      hasMore: (this.currentPage + 1) * this.clipboardPageSize < totalCount
    };
  }

  showLoading() {
    const loading = document.getElementById('loading');
    const contentGrid = document.getElementById('content-grid');
    const emptyState = document.getElementById('empty-state');
    const pagination = document.getElementById('pagination');
    
    if (loading) loading.style.display = 'block';
    if (contentGrid) contentGrid.innerHTML = '';
    if (emptyState) emptyState.style.display = 'none';
    if (pagination) pagination.style.display = 'none';
  }

  render() {
    console.log('Rendering view:', this.currentView);
    
    const loading = document.getElementById('loading');
    const contentGrid = document.getElementById('content-grid');
    const emptyState = document.getElementById('empty-state');
    const pagination = document.getElementById('pagination');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const searchBar = document.getElementById('search-bar');
    
    if (loading) loading.style.display = 'none';
    if (contentGrid) contentGrid.innerHTML = '';
    if (emptyState) emptyState.style.display = 'none';
    if (pagination) pagination.style.display = 'none';
    
    // Show search bar only for clipboards
    if (searchBar) {
      searchBar.style.display = this.currentView === 'clipboards' ? 'block' : 'none';
    }
    
    // Show clear all button if there's data
    if (clearAllBtn) {
      clearAllBtn.style.display = this.totalCount > 0 ? 'block' : 'none';
    }
    
    // Update breadcrumb and title
    this.updateBreadcrumb();
    this.updateTitle();
    
    // Render content
    if (this.currentData.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    }
    
    if (this.currentView === 'domains') {
      this.renderDomains();
    } else if (this.currentView === 'apps') {
      this.renderApps();
    } else if (this.currentView === 'flows') {
      this.renderFlows();
    } else if (this.currentView === 'clipboards') {
      this.renderClipboards();
    }
    
    // Show pagination if needed
    this.renderPagination();
  }

  updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;
    
    let html = '<a href="#" class="breadcrumb-item" data-view="domains">Domains</a>';
    
    if (this.currentDomain) {
      html += ' <span class="breadcrumb-separator">›</span> ';
      html += `<a href="#" class="breadcrumb-item" data-view="apps" data-domain="${this.currentDomain}">${this.currentDomain}</a>`;
    }
    
    if (this.currentApp) {
      html += ' <span class="breadcrumb-separator">›</span> ';
      html += `<a href="#" class="breadcrumb-item" data-view="flows" data-app-id="${this.currentAppId}" data-app="${this.currentApp}">${this.currentApp}</a>`;
    }
    
    if (this.currentFlow) {
      html += ' <span class="breadcrumb-separator">›</span> ';
      html += `<span class="breadcrumb-item active">${this.currentFlow}</span>`;
    }
    
    breadcrumb.innerHTML = html;
  }

  updateTitle() {
    const title = document.getElementById('content-title');
    if (!title) return;
    
    if (this.currentView === 'domains') {
      title.textContent = 'Domains';
    } else if (this.currentView === 'apps') {
      title.textContent = `Apps in ${this.currentDomain}`;
    } else if (this.currentView === 'flows') {
      title.textContent = `Flows in ${this.currentApp}`;
    } else if (this.currentView === 'clipboards') {
      title.textContent = `Clipboards in ${this.currentFlow}`;
    }
  }

  renderDomains() {
    const grid = document.getElementById('content-grid');
    if (!grid) return;
    
    this.currentData.forEach(domain => {
      const card = this.createDomainCard(domain);
      grid.appendChild(card);
    });
  }

  renderApps() {
    const grid = document.getElementById('content-grid');
    if (!grid) return;
    
    this.currentData.forEach(app => {
      const card = this.createAppCard(app);
      grid.appendChild(card);
    });
  }

  renderFlows() {
    const grid = document.getElementById('content-grid');
    if (!grid) return;
    
    this.currentData.forEach(flow => {
      const card = this.createFlowCard(flow);
      grid.appendChild(card);
    });
  }

  renderClipboards() {
    const grid = document.getElementById('content-grid');
    if (!grid) return;
    
    this.currentData.forEach(clipboard => {
      const card = this.createClipboardCard(clipboard);
      grid.appendChild(card);
    });
  }

  createDomainCard(domain) {
    const card = document.createElement('div');
    card.className = 'card';
    card.addEventListener('click', () => this.navigateToDomain(domain.domain));
    
    card.innerHTML = `
      <div class="card-title">🌐 ${domain.domain}</div>
      <div class="card-meta">Added: ${new Date(domain.timestamp).toLocaleDateString()}</div>
    `;
    
    return card;
  }

  createAppCard(app) {
    const card = document.createElement('div');
    card.className = 'card';
    card.addEventListener('click', () => this.navigateToApp(app.id, app.appName));
    
    card.innerHTML = `
      <div class="card-title">📱 ${app.appName}</div>
      <div class="card-meta">First captured: ${new Date(app.timestamp).toLocaleDateString()}</div>
    `;
    
    return card;
  }

  createFlowCard(flow) {
    const card = document.createElement('div');
    card.className = 'card';
    
    const cardContent = document.createElement('div');
    cardContent.innerHTML = `
      <div class="card-title">📋 ${flow.flowName}</div>
      <div class="card-meta">First captured: ${new Date(flow.timestamp).toLocaleDateString()}</div>
      <div class="card-actions">
        <button class="btn btn-primary btn-sm" data-action="view-flow" data-flow-id="${flow.id}" data-flow-name="${flow.flowName}">View Clipboards</button>
        <button class="btn btn-danger btn-sm" data-action="delete-flow" data-flow-id="${flow.id}" data-flow-name="${flow.flowName}">Delete</button>
      </div>
    `;
    
    // Add event listeners for the buttons
    const viewBtn = cardContent.querySelector('[data-action="view-flow"]');
    const deleteBtn = cardContent.querySelector('[data-action="delete-flow"]');
    
    if (viewBtn) {
      viewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.navigateToFlow(flow.id, flow.flowName);
      });
    }
    
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteFlow(flow.id, flow.flowName);
      });
    }
    
    card.appendChild(cardContent);
    return card;
  }

  createClipboardCard(clipboard) {
    const card = document.createElement('div');
    card.className = 'card';
    
    const preview = clipboard.content.length > 200 ? 
      clipboard.content.substring(0, 200) + '...' : 
      clipboard.content;
    const timestamp = new Date(clipboard.timestamp).toLocaleString();
    
    card.innerHTML = `
      <div class="card-title">📄 Clipboard Entry</div>
      <div class="card-meta">${timestamp}</div>
      <div class="card-preview">${this.escapeHtml(preview)}</div>
      <div class="card-actions">
        <button class="btn btn-primary btn-sm" data-action="copy-clipboard" data-clipboard-id="${clipboard.id}">📋 Copy</button>
        <button class="btn btn-danger btn-sm" data-action="delete-clipboard" data-clipboard-id="${clipboard.id}">🗑️ Delete</button>
      </div>
    `;
    
    // Add event listeners for the buttons
    const copyBtn = card.querySelector('[data-action="copy-clipboard"]');
    const deleteBtn = card.querySelector('[data-action="delete-clipboard"]');
    
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyToClipboard(clipboard.id, copyBtn);
      });
    }
    
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteClipboard(clipboard.id);
      });
    }
    
    return card;
  }

  renderPagination() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;
    
    const limit = this.currentView === 'clipboards' ? this.clipboardPageSize : this.pageSize;
    
    if (this.totalCount <= limit) {
      pagination.style.display = 'none';
      return;
    }
    
    pagination.style.display = 'flex';
    
    const startIndex = this.currentPage * limit + 1;
    const endIndex = Math.min(startIndex + this.currentData.length - 1, this.totalCount);
    
    pagination.innerHTML = `
      <button class="btn btn-secondary" ${this.currentPage === 0 ? 'disabled' : ''} data-action="prev-page">← Previous</button>
      <span class="pagination-info">${startIndex}-${endIndex} of ${this.totalCount}</span>
      <button class="btn btn-secondary" ${!this.hasMore ? 'disabled' : ''} data-action="next-page">Next →</button>
    `;
    
    // Add event listeners for pagination buttons
    const prevBtn = pagination.querySelector('[data-action="prev-page"]');
    const nextBtn = pagination.querySelector('[data-action="next-page"]');
    
    if (prevBtn && !prevBtn.disabled) {
      prevBtn.addEventListener('click', () => this.prevPage());
    }
    
    if (nextBtn && !nextBtn.disabled) {
      nextBtn.addEventListener('click', () => this.nextPage());
    }
  }

  // Navigation methods
  async navigateToDomain(domain) {
    this.currentView = 'apps';
    this.currentDomain = domain;
    this.currentPage = 0;
    await this.loadCurrentView();
    this.render();
  }

  async navigateToApp(appId, appName) {
    this.currentView = 'flows';
    this.currentAppId = appId;
    this.currentApp = appName;
    this.currentPage = 0;
    await this.loadCurrentView();
    this.render();
  }

  async navigateToFlow(flowId, flowName) {
    this.currentView = 'clipboards';
    this.currentFlowId = flowId;
    this.currentFlow = flowName;
    this.currentPage = 0;
    await this.loadCurrentView();
    this.render();
  }

  async navigateToView(view, data = {}) {
    if (view === 'domains') {
      this.currentView = 'domains';
      this.currentDomain = null;
      this.currentApp = null;
      this.currentAppId = null;
      this.currentFlow = null;
      this.currentFlowId = null;
    } else if (view === 'apps') {
      this.currentView = 'apps';
      this.currentDomain = data.domain;
      this.currentApp = null;
      this.currentAppId = null;
      this.currentFlow = null;
      this.currentFlowId = null;
    } else if (view === 'flows') {
      this.currentView = 'flows';
      this.currentAppId = data.appId;
      this.currentApp = data.app;
      this.currentFlow = null;
      this.currentFlowId = null;
    }
    
    this.currentPage = 0;
    await this.loadCurrentView();
    this.render();
  }

  async nextPage() {
    if (this.hasMore) {
      this.currentPage++;
      await this.loadCurrentView();
      this.render();
    }
  }

  async prevPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      await this.loadCurrentView();
      this.render();
    }
  }

  // Action methods
  async copyToClipboard(clipboardId, buttonElement) {
    try {
      const clipboard = this.currentData.find(c => c.id === clipboardId);
      if (clipboard) {
        await navigator.clipboard.writeText(clipboard.content);
        
        // Visual feedback
        if (buttonElement) {
          const originalText = buttonElement.innerHTML;
          buttonElement.innerHTML = '✅ Copied!';
          buttonElement.classList.add('copy-success');
          
          setTimeout(() => {
            buttonElement.innerHTML = originalText;
            buttonElement.classList.remove('copy-success');
          }, 2000);
        }
        
        this.showToast('Copied to clipboard!', 'success');
      }
    } catch (error) {
      console.error('Failed to copy:', error);
      this.showToast('Failed to copy to clipboard', 'error');
    }
  }

  async deleteClipboard(clipboardId) {
    if (!confirm('Delete this clipboard entry?')) return;
    
    try {
      await this.db.deleteClipboard(clipboardId);
      await this.loadCurrentView();
      this.render();
      this.showToast('Clipboard deleted', 'success');
    } catch (error) {
      console.error('Failed to delete clipboard:', error);
      this.showToast('Failed to delete clipboard', 'error');
    }
  }

  async deleteFlow(flowId, flowName) {
    if (!confirm(`Delete all clipboards for "${flowName}" flow? This cannot be undone.`)) return;
    
    try {
      await this.db.deleteFlow(flowId);
      await this.loadCurrentView();
      this.render();
      this.showToast('Flow deleted', 'success');
    } catch (error) {
      console.error('Failed to delete flow:', error);
      this.showToast('Failed to delete flow', 'error');
    }
  }

  async clearAllData() {
    if (!confirm('Clear all clipboard data? This cannot be undone.')) return;
    
    try {
      await this.db.clearAllClipboards();
      this.currentView = 'domains';
      this.currentDomain = null;
      this.currentApp = null;
      this.currentAppId = null;
      this.currentFlow = null;
      this.currentFlowId = null;
      this.currentPage = 0;
      await this.loadCurrentView();
      this.render();
      this.showToast('All data cleared', 'success');
    } catch (error) {
      console.error('Failed to clear data:', error);
      this.showToast('Failed to clear data', 'error');
    }
  }

  async refresh() {
    await this.loadCurrentView();
    this.render();
    this.showToast('Data refreshed', 'success');
  }

  // Utility methods
  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast ${type === 'error' ? 'error' : ''} show`;
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  showError(message) {
    const loading = document.getElementById('loading');
    if (loading) {
      loading.textContent = message;
      loading.style.color = '#dc3545';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Global instance
let manager;

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    manager = new FullClipboardManager();
  });
} else {
  manager = new FullClipboardManager();
}