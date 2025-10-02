// Background script for handling storage and communication
importScripts('indexeddb.js');

let clipboardDB = null;

// Initialize IndexedDB
async function initDB() {
  if (!clipboardDB || !clipboardDB.db) {
    try {
      console.log('Creating new ClipboardDB instance...');
      clipboardDB = new ClipboardDB();
      await clipboardDB.init();
      console.log('IndexedDB initialized successfully');
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      clipboardDB = null; // Reset on error
      throw error;
    }
  }
  return clipboardDB;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkDomainEnabled') {
    checkDomainEnabled(request.domain)
      .then(enabled => sendResponse({ enabled }))
      .catch(error => sendResponse({ enabled: false, error: error.message }));
    return true;
  } else if (request.action === 'saveClipboard') {
    saveClipboardData(request.data)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === 'getDomains') {
    getDomains(request.page, request.limit).then(data => sendResponse(data));
    return true;
  } else if (request.action === 'getApps') {
    getApps(request.domain, request.page, request.limit).then(data => sendResponse(data));
    return true;
  } else if (request.action === 'getFlows') {
    getFlows(request.appId, request.page, request.limit).then(data => sendResponse(data));
    return true;
  } else if (request.action === 'getClipboards') {
    getClipboards(request.flowId, request.page, request.limit).then(data => sendResponse(data));
    return true;
  } else if (request.action === 'deleteClipboard') {
    deleteClipboardData(request.id).then(() => sendResponse({ success: true }));
    return true;
  } else if (request.action === 'deleteFlow') {
    deleteFlowData(request.flowId)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === 'getEnabledDomains') {
    getEnabledDomains().then(domains => sendResponse(domains));
    return true;
  } else if (request.action === 'setEnabledDomains') {
    setEnabledDomains(request.domains)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  } else if (request.action === 'clearAllData') {
    clearAllData().then(() => sendResponse({ success: true }));
    return true;
  } else if (request.action === 'debugDB') {
    debugDB().then(result => sendResponse(result));
    return true;
  } else if (request.action === 'testDB') {
    testDB().then(result => sendResponse(result));
    return true;
  }
});

async function checkDomainEnabled(domain) {
  try {
    const db = await initDB();
    const enabledDomains = await db.getEnabledDomains();
    console.log('Checking domain:', domain, 'Enabled domains:', enabledDomains);
    const isEnabled = enabledDomains.includes(domain);
    console.log('Domain enabled:', isEnabled);
    return isEnabled;
  } catch (error) {
    console.error('Failed to check domain enabled:', error);
    return false;
  }
}

async function saveClipboardData(data) {
  try {
    const db = await initDB();
    const clipboardEntry = await db.saveClipboard(data);
    console.log('Clipboard data saved successfully:', clipboardEntry);
    return clipboardEntry;
  } catch (error) {
    console.error('Failed to save clipboard data:', error);
    throw error;
  }
}

// New paginated API functions
async function getDomains(page = 0, limit = 3) {
  try {
    const db = await initDB();
    const domains = await db.getDomains(page, limit);
    const totalCount = await db.countDomains();
    
    return {
      data: domains,
      page,
      limit,
      totalCount,
      hasMore: (page + 1) * limit < totalCount
    };
  } catch (error) {
    console.error('Failed to get domains:', error);
    return { data: [], page, limit, totalCount: 0, hasMore: false };
  }
}

async function getApps(domain, page = 0, limit = 3) {
  try {
    const db = await initDB();
    const apps = await db.getAppsByDomain(domain, page, limit);
    const totalCount = await db.countAppsByDomain(domain);
    
    return {
      data: apps,
      page,
      limit,
      totalCount,
      hasMore: (page + 1) * limit < totalCount
    };
  } catch (error) {
    console.error('Failed to get apps:', error);
    return { data: [], page, limit, totalCount: 0, hasMore: false };
  }
}

async function getFlows(appId, page = 0, limit = 3) {
  try {
    const db = await initDB();
    const flows = await db.getFlowsByApp(appId, page, limit);
    const totalCount = await db.countFlowsByApp(appId);
    
    return {
      data: flows,
      page,
      limit,
      totalCount,
      hasMore: (page + 1) * limit < totalCount
    };
  } catch (error) {
    console.error('Failed to get flows:', error);
    return { data: [], page, limit, totalCount: 0, hasMore: false };
  }
}

async function getClipboards(flowId, page = 0, limit = 5) {
  try {
    const db = await initDB();
    const clipboards = await db.getClipboardsByFlow(flowId, page, limit);
    const totalCount = await db.countClipboardsByFlow(flowId);
    
    return {
      data: clipboards,
      page,
      limit,
      totalCount,
      hasMore: (page + 1) * limit < totalCount
    };
  } catch (error) {
    console.error('Failed to get clipboards:', error);
    return { data: [], page, limit, totalCount: 0, hasMore: false };
  }
}

async function deleteClipboardData(id) {
  try {
    const db = await initDB();
    await db.deleteClipboard(id);
    console.log('Clipboard deleted:', id);
  } catch (error) {
    console.error('Failed to delete clipboard data:', error);
    throw error;
  }
}

async function deleteFlowData(flowId) {
  try {
    const db = await initDB();
    await db.deleteFlow(flowId);
    console.log('Flow deleted:', flowId);
  } catch (error) {
    console.error('Failed to delete flow data:', error);
    throw error;
  }
}

async function getEnabledDomains() {
  try {
    const db = await initDB();
    return await db.getEnabledDomains();
  } catch (error) {
    console.error('Failed to get enabled domains:', error);
    return ['mobbin.com'];
  }
}

async function setEnabledDomains(domains) {
  try {
    const db = await initDB();
    await db.setEnabledDomains(domains);
    console.log('Enabled domains updated:', domains);
  } catch (error) {
    console.error('Failed to set enabled domains:', error);
    throw error;
  }
}

async function clearAllData() {
  try {
    const db = await initDB();
    await db.clearAllClipboards();
    console.log('All clipboard data cleared');
  } catch (error) {
    console.error('Failed to clear all data:', error);
    throw error;
  }
}

async function debugDB() {
  try {
    console.log('=== DEBUG DB START ===');
    const db = await initDB();
    console.log('DB instance:', db);
    console.log('DB object:', db.db);
    
    // Check if database exists and has stores
    if (!db.db) {
      return { error: 'Database not initialized' };
    }
    
    const storeNames = Array.from(db.db.objectStoreNames);
    console.log('Available stores:', storeNames);
    
    // Try to count records in clipboards store
    const transaction = db.db.transaction(['clipboards'], 'readonly');
    const store = transaction.objectStore('clipboards');
    
    return new Promise((resolve, reject) => {
      const countRequest = store.count();
      countRequest.onsuccess = () => {
        const count = countRequest.result;
        console.log('Total clipboards in DB:', count);
        
        // Get all records
        const getAllRequest = store.getAll();
        getAllRequest.onsuccess = () => {
          const allRecords = getAllRequest.result;
          console.log('All records:', allRecords);
          resolve({
            storeNames,
            count,
            records: allRecords,
            success: true
          });
        };
        getAllRequest.onerror = () => {
          console.error('Failed to get all records:', getAllRequest.error);
          resolve({
            storeNames,
            count,
            error: 'Failed to get records',
            success: false
          });
        };
      };
      countRequest.onerror = () => {
        console.error('Failed to count records:', countRequest.error);
        resolve({
          storeNames,
          error: 'Failed to count records',
          success: false
        });
      };
    });
  } catch (error) {
    console.error('Debug DB failed:', error);
    return { error: error.message, success: false };
  }
}

async function testDB() {
  try {
    console.log('=== TEST DB START ===');
    
    // Add a test record
    const testData = {
      domain: 'test.com',
      appName: 'Test App',
      flowName: 'Test Flow',
      clipboardContent: 'Test clipboard content',
      contentPreview: 'Test preview',
      isComplexData: false,
      timestamp: new Date().toISOString(),
      url: 'https://test.com'
    };
    
    console.log('Adding test data:', testData);
    await saveClipboardData(testData);
    console.log('Test data added successfully');
    
    // Try to retrieve it
    console.log('Retrieving all clipboards...');
    const clipboards = await getClipboardData();
    console.log('Retrieved clipboards:', clipboards);
    
    return {
      success: true,
      testDataAdded: testData,
      retrievedData: clipboards
    };
  } catch (error) {
    console.error('Test DB failed:', error);
    return { error: error.message, success: false };
  }
}



