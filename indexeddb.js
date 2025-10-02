// IndexedDB wrapper for clipboard storage with normalized structure
class ClipboardDB {
  constructor() {
    this.dbName = 'ClipboardManager';
    this.version = 3; // Increment version for timestamp indexes
    this.db = null;
  }

  async init() {
    console.log('IndexedDB: Initializing database...');
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => {
        console.error('IndexedDB: Failed to open database:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB: Database opened successfully');
        console.log('IndexedDB: Object stores:', Array.from(this.db.objectStoreNames));
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        console.log('IndexedDB: Database upgrade needed');
        const db = event.target.result;
        
        // Clear old stores if they exist to recreate with proper indexes
        const storesToRecreate = ['domains', 'apps', 'flows', 'clipboards'];
        storesToRecreate.forEach(storeName => {
          if (db.objectStoreNames.contains(storeName)) {
            console.log(`IndexedDB: Deleting existing ${storeName} store`);
            db.deleteObjectStore(storeName);
          }
        });
        
        // Create domains store
        console.log('IndexedDB: Creating domains store');
        const domainStore = db.createObjectStore('domains', { keyPath: 'domain' });
        domainStore.createIndex('timestamp', 'timestamp', { unique: false });
        
        // Create apps store
        console.log('IndexedDB: Creating apps store');
        const appStore = db.createObjectStore('apps', { keyPath: 'id' });
        appStore.createIndex('domain', 'domain', { unique: false });
        appStore.createIndex('appName', 'appName', { unique: false });
        appStore.createIndex('timestamp', 'timestamp', { unique: false });
        
        // Create flows store
        console.log('IndexedDB: Creating flows store');
        const flowStore = db.createObjectStore('flows', { keyPath: 'id' });
        flowStore.createIndex('appId', 'appId', { unique: false });
        flowStore.createIndex('flowName', 'flowName', { unique: false });
        flowStore.createIndex('timestamp', 'timestamp', { unique: false });
        
        // Create clipboards store (for actual clipboard data)
        console.log('IndexedDB: Creating clipboards store');
        const clipboardStore = db.createObjectStore('clipboards', { keyPath: 'id' });
        clipboardStore.createIndex('flowId', 'flowId', { unique: false });
        clipboardStore.createIndex('timestamp', 'timestamp', { unique: false });
        
        // Create settings store
        if (!db.objectStoreNames.contains('settings')) {
          console.log('IndexedDB: Creating settings store');
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        
        console.log('IndexedDB: Database upgrade completed');
      };
    });
  }

  async saveClipboard(data) {
    const transaction = this.db.transaction(['domains', 'apps', 'flows', 'clipboards'], 'readwrite');
    
    try {
      // 1. Ensure domain exists
      const domainStore = transaction.objectStore('domains');
      const domainId = data.domain;
      
      await new Promise((resolve, reject) => {
        const getDomainReq = domainStore.get(domainId);
        getDomainReq.onsuccess = () => {
          if (!getDomainReq.result) {
            // Create domain entry
            const addDomainReq = domainStore.add({
              domain: domainId,
              timestamp: data.timestamp
            });
            addDomainReq.onsuccess = () => resolve();
            addDomainReq.onerror = () => reject(addDomainReq.error);
          } else {
            resolve();
          }
        };
        getDomainReq.onerror = () => reject(getDomainReq.error);
      });
      
      // 2. Ensure app exists
      const appStore = transaction.objectStore('apps');
      const appId = `${data.domain}::${data.appName}`;
      
      await new Promise((resolve, reject) => {
        const getAppReq = appStore.get(appId);
        getAppReq.onsuccess = () => {
          if (!getAppReq.result) {
            // Create app entry
            const addAppReq = appStore.add({
              id: appId,
              domain: data.domain,
              appName: data.appName,
              timestamp: data.timestamp
            });
            addAppReq.onsuccess = () => resolve();
            addAppReq.onerror = () => reject(addAppReq.error);
          } else {
            resolve();
          }
        };
        getAppReq.onerror = () => reject(getAppReq.error);
      });
      
      // 3. Ensure flow exists
      const flowStore = transaction.objectStore('flows');
      const flowId = `${appId}::${data.flowName}`;
      
      await new Promise((resolve, reject) => {
        const getFlowReq = flowStore.get(flowId);
        getFlowReq.onsuccess = () => {
          if (!getFlowReq.result) {
            // Create flow entry
            const addFlowReq = flowStore.add({
              id: flowId,
              appId: appId,
              flowName: data.flowName,
              timestamp: data.timestamp
            });
            addFlowReq.onsuccess = () => resolve();
            addFlowReq.onerror = () => reject(addFlowReq.error);
          } else {
            resolve();
          }
        };
        getFlowReq.onerror = () => reject(getFlowReq.error);
      });
      
      // 4. Add clipboard entry
      const clipboardStore = transaction.objectStore('clipboards');
      const clipboardEntry = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        flowId: flowId,
        content: data.clipboardContent,
        contentPreview: data.contentPreview,
        isComplexData: data.isComplexData,
        timestamp: data.timestamp,
        url: data.url
      };
      
      return new Promise((resolve, reject) => {
        const addClipboardReq = clipboardStore.add(clipboardEntry);
        addClipboardReq.onsuccess = () => resolve(clipboardEntry);
        addClipboardReq.onerror = () => reject(addClipboardReq.error);
      });
      
    } catch (error) {
      throw error;
    }
  }

  // Get domains with pagination (chronological order - oldest first)
  async getDomains(page = 0, limit = 3) {
    const transaction = this.db.transaction(['domains'], 'readonly');
    const store = transaction.objectStore('domains');
    const index = store.index('timestamp');
    
    return new Promise((resolve, reject) => {
      const results = [];
      let count = 0;
      let skipped = 0;
      const skipCount = page * limit;
      
      const request = index.openCursor(null, 'next'); // oldest first (chronological)
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && count < limit) {
          if (skipped < skipCount) {
            skipped++;
            cursor.continue();
            return;
          }
          
          results.push(cursor.value);
          count++;
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Get apps for a domain with pagination (chronological order - oldest first)
  async getAppsByDomain(domain, page = 0, limit = 3) {
    const transaction = this.db.transaction(['apps'], 'readonly');
    const store = transaction.objectStore('apps');
    
    return new Promise((resolve, reject) => {
      const results = [];
      const domainIndex = store.index('domain');
      
      // First get all apps for this domain
      const getAllRequest = domainIndex.getAll(IDBKeyRange.only(domain));
      getAllRequest.onsuccess = () => {
        const allApps = getAllRequest.result;
        
        // Sort by timestamp (oldest first)
        allApps.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Apply pagination
        const startIndex = page * limit;
        const endIndex = startIndex + limit;
        const paginatedApps = allApps.slice(startIndex, endIndex);
        
        resolve(paginatedApps);
      };
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  }

  // Get flows for an app with pagination (chronological order - oldest first)
  async getFlowsByApp(appId, page = 0, limit = 3) {
    const transaction = this.db.transaction(['flows'], 'readonly');
    const store = transaction.objectStore('flows');
    
    return new Promise((resolve, reject) => {
      const appIdIndex = store.index('appId');
      
      // First get all flows for this app
      const getAllRequest = appIdIndex.getAll(IDBKeyRange.only(appId));
      getAllRequest.onsuccess = () => {
        const allFlows = getAllRequest.result;
        
        // Sort by timestamp (oldest first)
        allFlows.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Apply pagination
        const startIndex = page * limit;
        const endIndex = startIndex + limit;
        const paginatedFlows = allFlows.slice(startIndex, endIndex);
        
        resolve(paginatedFlows);
      };
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  }

  // Get clipboards for a flow with pagination (newest first for clipboards)
  async getClipboardsByFlow(flowId, page = 0, limit = 5) {
    const transaction = this.db.transaction(['clipboards'], 'readonly');
    const store = transaction.objectStore('clipboards');
    
    return new Promise((resolve, reject) => {
      const flowIdIndex = store.index('flowId');
      
      // First get all clipboards for this flow
      const getAllRequest = flowIdIndex.getAll(IDBKeyRange.only(flowId));
      getAllRequest.onsuccess = () => {
        const allClipboards = getAllRequest.result;
        
        // Sort by timestamp (newest first for clipboards - most recent copies first)
        allClipboards.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Apply pagination
        const startIndex = page * limit;
        const endIndex = startIndex + limit;
        const paginatedClipboards = allClipboards.slice(startIndex, endIndex);
        
        resolve(paginatedClipboards);
      };
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  }

  // Get a single clipboard by ID
  async getClipboardById(clipboardId) {
    const transaction = this.db.transaction(['clipboards'], 'readonly');
    const store = transaction.objectStore('clipboards');
    
    return new Promise((resolve, reject) => {
      const request = store.get(clipboardId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Count methods for pagination
  async countDomains() {
    const transaction = this.db.transaction(['domains'], 'readonly');
    const store = transaction.objectStore('domains');
    
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async countAppsByDomain(domain) {
    const transaction = this.db.transaction(['apps'], 'readonly');
    const store = transaction.objectStore('apps');
    const index = store.index('domain');
    
    return new Promise((resolve, reject) => {
      const request = index.count(IDBKeyRange.only(domain));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async countFlowsByApp(appId) {
    const transaction = this.db.transaction(['flows'], 'readonly');
    const store = transaction.objectStore('flows');
    const index = store.index('appId');
    
    return new Promise((resolve, reject) => {
      const request = index.count(IDBKeyRange.only(appId));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async countClipboardsByFlow(flowId) {
    const transaction = this.db.transaction(['clipboards'], 'readonly');
    const store = transaction.objectStore('clipboards');
    const index = store.index('flowId');
    
    return new Promise((resolve, reject) => {
      const request = index.count(IDBKeyRange.only(flowId));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteClipboard(id) {
    const transaction = this.db.transaction(['clipboards'], 'readwrite');
    const store = transaction.objectStore('clipboards');
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFlow(flowId) {
    const transaction = this.db.transaction(['flows', 'clipboards'], 'readwrite');
    
    try {
      // Delete all clipboards for this flow
      const clipboardStore = transaction.objectStore('clipboards');
      const clipboardIndex = clipboardStore.index('flowId');
      
      await new Promise((resolve, reject) => {
        const request = clipboardIndex.openCursor(IDBKeyRange.only(flowId));
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
      
      // Delete the flow itself
      const flowStore = transaction.objectStore('flows');
      return new Promise((resolve, reject) => {
        const request = flowStore.delete(flowId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
    } catch (error) {
      throw error;
    }
  }

  async clearAllClipboards() {
    const transaction = this.db.transaction(['domains', 'apps', 'flows', 'clipboards'], 'readwrite');
    
    const stores = ['clipboards', 'flows', 'apps', 'domains'];
    const promises = stores.map(storeName => {
      const store = transaction.objectStore(storeName);
      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
    
    return Promise.all(promises);
  }

  async saveSetting(key, value) {
    const transaction = this.db.transaction(['settings'], 'readwrite');
    const store = transaction.objectStore('settings');
    
    return new Promise((resolve, reject) => {
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSetting(key, defaultValue = null) {
    const transaction = this.db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : defaultValue);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getEnabledDomains() {
    const domains = await this.getSetting('enabledDomains', ['mobbin.com']);
    
    // Initialize default domains if not set
    if (!domains || domains.length === 0) {
      const defaultDomains = ['mobbin.com'];
      await this.setEnabledDomains(defaultDomains);
      return defaultDomains;
    }
    
    return domains;
  }

  async setEnabledDomains(domains) {
    return await this.saveSetting('enabledDomains', domains);
  }
}