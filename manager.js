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
    this.expandedFlows = new Set(); // Track which flows are expanded
    this.flowClipboards = new Map(); // Cache clipboards for expanded flows
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

  async loadClipboardsForFlow(flowId, page = 0, limit = 10) {
    try {
      const clipboards = await this.db.getClipboardsByFlow(flowId, page, limit);
      const totalCount = await this.db.countClipboardsByFlow(flowId);
      
      return {
        data: clipboards,
        totalCount,
        hasMore: (page + 1) * limit < totalCount
      };
    } catch (error) {
      console.error('Failed to load clipboards for flow:', error);
      return { data: [], totalCount: 0, hasMore: false };
    }
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
      html += `<span class="breadcrumb-item active">${this.currentApp}</span>`;
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
      title.textContent = `Flows in ${this.currentApp} (Click to expand clipboards)`;
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

  async renderFlows() {
    await this.renderFlowsWithClipboards();
  }

  async renderFlowsWithClipboards() {
    const grid = document.getElementById('content-grid');
    if (!grid) return;
    
    for (const flow of this.currentData) {
      const flowCard = await this.createExpandableFlowCard(flow);
      grid.appendChild(flowCard);
    }
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

  async createExpandableFlowCard(flow) {
    const card = document.createElement('div');
    card.className = 'flow-card';
    card.style.cssText = `
      border: 1px solid #e9ecef;
      border-radius: 8px;
      margin-bottom: 16px;
      background: white;
      overflow: hidden;
    `;
    
    // Flow header
    const header = document.createElement('div');
    header.className = 'flow-header';
    header.style.cssText = `
      padding: 16px;
      background: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    
    const isExpanded = this.expandedFlows.has(flow.id);
    
    header.innerHTML = `
      <div>
        <div style="font-size: 16px; font-weight: 600; color: #212529; margin-bottom: 4px;">
          📋 ${flow.flowName} ${isExpanded ? '▼' : '▶'}
        </div>
        <div style="font-size: 12px; color: #6c757d;">
          First captured: ${new Date(flow.timestamp).toLocaleDateString()}
        </div>
      </div>
      <div class="flow-actions" style="display: flex; gap: 8px;">
        <button class="btn btn-danger btn-sm" data-action="delete-flow" data-flow-id="${flow.id}" data-flow-name="${flow.flowName}">🗑️ Delete</button>
      </div>
    `;
    
    // Clipboards container
    const clipboardsContainer = document.createElement('div');
    clipboardsContainer.className = 'clipboards-container';
    clipboardsContainer.style.display = isExpanded ? 'block' : 'none';
    
    if (isExpanded) {
      await this.loadAndRenderClipboards(flow.id, clipboardsContainer);
    }
    
    // Event listeners
    header.addEventListener('click', async (e) => {
      if (e.target.closest('.flow-actions')) return; // Don't toggle if clicking actions
      
      if (this.expandedFlows.has(flow.id)) {
        this.expandedFlows.delete(flow.id);
        clipboardsContainer.style.display = 'none';
        header.querySelector('div').innerHTML = header.querySelector('div').innerHTML.replace('▼', '▶');
      } else {
        this.expandedFlows.add(flow.id);
        clipboardsContainer.style.display = 'block';
        header.querySelector('div').innerHTML = header.querySelector('div').innerHTML.replace('▶', '▼');
        
        if (!this.flowClipboards.has(flow.id)) {
          clipboardsContainer.innerHTML = '<div style="padding: 16px; text-align: center; color: #6c757d;">Loading clipboards...</div>';
          await this.loadAndRenderClipboards(flow.id, clipboardsContainer);
        }
      }
    });
    
    const deleteBtn = header.querySelector('[data-action="delete-flow"]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteFlow(flow.id, flow.flowName);
      });
    }
    
    card.appendChild(header);
    card.appendChild(clipboardsContainer);
    
    return card;
  }

  async loadAndRenderClipboards(flowId, container) {
    try {
      const result = await this.loadClipboardsForFlow(flowId, 0, 10);
      this.flowClipboards.set(flowId, result);
      
      container.innerHTML = '';
      
      if (result.data.length === 0) {
        container.innerHTML = '<div style="padding: 16px; text-align: center; color: #6c757d;">No clipboards found</div>';
        return;
      }
      
      result.data.forEach(clipboard => {
        const clipboardItem = this.createClipboardItem(clipboard, flowId);
        container.appendChild(clipboardItem);
      });
      
      // Add "Load More" button if there are more clipboards
      if (result.hasMore) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = 'btn btn-outline';
        loadMoreBtn.style.cssText = 'margin: 16px; width: calc(100% - 32px);';
        loadMoreBtn.textContent = 'Load More Clipboards';
        loadMoreBtn.addEventListener('click', () => this.loadMoreClipboards(flowId, container));
        container.appendChild(loadMoreBtn);
      }
      
    } catch (error) {
      console.error('Failed to load clipboards:', error);
      container.innerHTML = '<div style="padding: 16px; text-align: center; color: #dc3545;">Failed to load clipboards</div>';
    }
  }

  createClipboardItem(clipboard, flowId) {
    const item = document.createElement('div');
    item.className = 'clipboard-item';
    item.style.cssText = `
      padding: 12px 16px;
      border-bottom: 1px solid #f1f3f4;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    `;
    
    const preview = clipboard.content.length > 150 ? 
      clipboard.content.substring(0, 150) + '...' : 
      clipboard.content;
    const timestamp = new Date(clipboard.timestamp).toLocaleString();
    
    item.innerHTML = `
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 12px; color: #6c757d; margin-bottom: 4px;">${timestamp}</div>
        <div style="font-size: 14px; color: #495057; background: #f8f9fa; padding: 8px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; word-break: break-word;">
          ${this.escapeHtml(preview)}
        </div>
      </div>
      <div style="display: flex; gap: 8px; flex-shrink: 0;">
        <button class="btn btn-primary btn-sm" data-action="copy-clipboard" data-clipboard-id="${clipboard.id}">📋 Copy</button>
        <button class="btn btn-danger btn-sm" data-action="delete-clipboard" data-clipboard-id="${clipboard.id}" data-flow-id="${flowId}">🗑️</button>
      </div>
    `;
    
    // Add event listeners
    const copyBtn = item.querySelector('[data-action="copy-clipboard"]');
    const deleteBtn = item.querySelector('[data-action="delete-clipboard"]');
    
    if (copyBtn) {
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.copyToClipboard(clipboard.id, copyBtn);
      });
    }
    
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.deleteClipboardFromFlow(clipboard.id, flowId);
      });
    }
    
    return item;
  }

  async loadMoreClipboards(flowId, container) {
    try {
      const currentData = this.flowClipboards.get(flowId);
      if (!currentData) return;
      
      const nextPage = Math.floor(currentData.data.length / 10);
      const result = await this.loadClipboardsForFlow(flowId, nextPage, 10);
      
      // Remove the "Load More" button
      const loadMoreBtn = container.querySelector('.btn-outline');
      if (loadMoreBtn) loadMoreBtn.remove();
      
      // Add new clipboards
      result.data.forEach(clipboard => {
        const clipboardItem = this.createClipboardItem(clipboard, flowId);
        container.appendChild(clipboardItem);
      });
      
      // Update cached data
      currentData.data.push(...result.data);
      currentData.hasMore = result.hasMore;
      
      // Add new "Load More" button if needed
      if (result.hasMore) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.className = 'btn btn-outline';
        loadMoreBtn.style.cssText = 'margin: 16px; width: calc(100% - 32px);';
        loadMoreBtn.textContent = 'Load More Clipboards';
        loadMoreBtn.addEventListener('click', () => this.loadMoreClipboards(flowId, container));
        container.appendChild(loadMoreBtn);
      }
      
    } catch (error) {
      console.error('Failed to load more clipboards:', error);
      this.showToast('Failed to load more clipboards', 'error');
    }
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



  async navigateToView(view, data = {}) {
    if (view === 'domains') {
      this.currentView = 'domains';
      this.currentDomain = null;
      this.currentApp = null;
      this.currentAppId = null;
      this.currentFlow = null;
      this.currentFlowId = null;
      this.expandedFlows.clear();
      this.flowClipboards.clear();
    } else if (view === 'apps') {
      this.currentView = 'apps';
      this.currentDomain = data.domain;
      this.currentApp = null;
      this.currentAppId = null;
      this.currentFlow = null;
      this.currentFlowId = null;
      this.expandedFlows.clear();
      this.flowClipboards.clear();
    } else if (view === 'flows') {
      this.currentView = 'flows';
      this.currentAppId = data.appId;
      this.currentApp = data.app;
      this.currentFlow = null;
      this.currentFlowId = null;
      // Keep expanded flows when navigating back to flows
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
      // Find clipboard in cached data
      let clipboard = null;
      for (const [flowId, flowData] of this.flowClipboards) {
        clipboard = flowData.data.find(c => c.id === clipboardId);
        if (clipboard) break;
      }
      
      if (!clipboard) {
        // Fallback: load directly from database
        clipboard = await this.db.getClipboardById(clipboardId);
      }
      
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
      } else {
        this.showToast('Clipboard entry not found', 'error');
      }
    } catch (error) {
      console.error('Failed to copy:', error);
      this.showToast('Failed to copy to clipboard', 'error');
    }
  }

  async deleteClipboardFromFlow(clipboardId, flowId) {
    if (!confirm('Delete this clipboard entry?')) return;
    
    try {
      await this.db.deleteClipboard(clipboardId);
      
      // Update cached data
      const cachedData = this.flowClipboards.get(flowId);
      if (cachedData) {
        cachedData.data = cachedData.data.filter(c => c.id !== clipboardId);
        cachedData.totalCount--;
      }
      
      // Re-render the specific flow's clipboards
      const flowCard = document.querySelector(`[data-flow-id="${flowId}"]`)?.closest('.flow-card');
      if (flowCard) {
        const container = flowCard.querySelector('.clipboards-container');
        if (container && this.expandedFlows.has(flowId)) {
          await this.loadAndRenderClipboards(flowId, container);
        }
      }
      
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