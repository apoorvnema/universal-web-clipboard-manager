// Background script for handling storage and communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveClipboard') {
    saveClipboardData(request.data)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  } else if (request.action === 'getClipboards') {
    getClipboardData().then(data => sendResponse(data));
    return true; // Keep message channel open for async response
  } else if (request.action === 'deleteClipboard') {
    deleteClipboardData(request.id).then(() => sendResponse({ success: true }));
    return true;
  } else if (request.action === 'getStorageInfo') {
    getStorageInfo().then(info => sendResponse(info));
    return true;
  }
});

async function saveClipboardData(data) {
  try {
    // Get existing data
    const result = await chrome.storage.local.get(['clipboards']);
    const clipboards = result.clipboards || {};

    // Check storage usage before saving
    const storageUsage = await chrome.storage.local.getBytesInUse();
    const maxStorage = chrome.storage.local.QUOTA_BYTES || 5242880; // 5MB default
    const usagePercent = (storageUsage / maxStorage) * 100;

    console.log(`Storage usage: ${Math.round(usagePercent)}% (${Math.round(storageUsage / 1024)}KB / ${Math.round(maxStorage / 1024)}KB)`);

    // If storage is getting full, clean up old entries
    if (usagePercent > 80) {
      console.log('Storage getting full, cleaning up old entries...');
      await cleanupOldEntries(clipboards);
    }

    // Organize by app name
    if (!clipboards[data.appName]) {
      clipboards[data.appName] = {};
    }

    // Organize by flow within app
    if (!clipboards[data.appName][data.flowName]) {
      clipboards[data.appName][data.flowName] = [];
    }

    // Compress large content to save space
    let content = data.clipboardContent;
    let isCompressed = false;

    if (content.length > 50000) { // 50KB threshold
      try {
        content = await compressString(content);
        isCompressed = true;
        console.log(`Compressed content from ${data.clipboardContent.length} to ${content.length} bytes`);
      } catch (e) {
        console.warn('Compression failed, storing original:', e);
        content = data.clipboardContent;
      }
    }

    // Add new clipboard entry with unique ID
    const clipboardEntry = {
      id: Date.now().toString(),
      content: content,
      isCompressed: isCompressed,
      originalSize: data.clipboardContent.length,
      contentPreview: data.contentPreview,
      isComplexData: data.isComplexData,
      timestamp: data.timestamp,
      url: data.url
    };

    clipboards[data.appName][data.flowName].unshift(clipboardEntry);

    // Keep fewer entries per flow to manage storage better
    const maxEntriesPerFlow = usagePercent > 60 ? 3 : 5;
    if (clipboards[data.appName][data.flowName].length > maxEntriesPerFlow) {
      clipboards[data.appName][data.flowName] = clipboards[data.appName][data.flowName].slice(0, maxEntriesPerFlow);
    }

    // Try to save, with fallback cleanup if quota exceeded
    try {
      await chrome.storage.local.set({ clipboards });
      console.log('Clipboard data saved successfully');
    } catch (quotaError) {
      if (quotaError.message.includes('quota')) {
        console.log('Quota exceeded, performing aggressive cleanup...');
        await aggressiveCleanup(clipboards);

        // Try saving again with cleaned data
        clipboards[data.appName][data.flowName] = [clipboardEntry]; // Keep only this new entry
        await chrome.storage.local.set({ clipboards });
        console.log('Clipboard data saved after cleanup');
      } else {
        throw quotaError;
      }
    }

  } catch (error) {
    console.error('Failed to save clipboard data:', error);
    throw error; // Re-throw to notify content script
  }
}

async function compressString(str) {
  // Simple compression using built-in compression
  const encoder = new TextEncoder();
  const data = encoder.encode(str);

  const compressed = await new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      }
    }).pipeThrough(new CompressionStream('gzip'))
  ).arrayBuffer();

  // Convert to base64 for storage
  const base64 = btoa(String.fromCharCode(...new Uint8Array(compressed)));
  return base64;
}

async function decompressString(compressedBase64) {
  // Decompress base64 compressed string
  const compressed = Uint8Array.from(atob(compressedBase64), c => c.charCodeAt(0));

  const decompressed = await new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(compressed);
        controller.close();
      }
    }).pipeThrough(new DecompressionStream('gzip'))
  ).arrayBuffer();

  const decoder = new TextDecoder();
  return decoder.decode(decompressed);
}

async function cleanupOldEntries(clipboards) {
  // Remove entries older than 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  for (const appName in clipboards) {
    for (const flowName in clipboards[appName]) {
      clipboards[appName][flowName] = clipboards[appName][flowName].filter(
        entry => entry.timestamp > weekAgo
      );

      // Keep only 2 most recent entries per flow
      if (clipboards[appName][flowName].length > 2) {
        clipboards[appName][flowName] = clipboards[appName][flowName].slice(0, 2);
      }

      // Clean up empty flows
      if (clipboards[appName][flowName].length === 0) {
        delete clipboards[appName][flowName];
      }
    }

    // Clean up empty apps
    if (Object.keys(clipboards[appName]).length === 0) {
      delete clipboards[appName];
    }
  }
}

async function aggressiveCleanup(clipboards) {
  // Keep only the most recent entry per flow
  for (const appName in clipboards) {
    for (const flowName in clipboards[appName]) {
      if (clipboards[appName][flowName].length > 0) {
        clipboards[appName][flowName] = [clipboards[appName][flowName][0]];
      }
    }
  }
}

async function getClipboardData() {
  try {
    const result = await chrome.storage.local.get(['clipboards']);
    const clipboards = result.clipboards || {};

    // Decompress any compressed content for display
    for (const appName in clipboards) {
      for (const flowName in clipboards[appName]) {
        for (const entry of clipboards[appName][flowName]) {
          if (entry.isCompressed && entry.content) {
            try {
              entry.content = await decompressString(entry.content);
              entry.isCompressed = false; // Mark as decompressed for this session
            } catch (e) {
              console.warn('Failed to decompress entry:', e);
              // Keep compressed version, will show preview instead
            }
          }
        }
      }
    }

    return clipboards;
  } catch (error) {
    console.error('Failed to get clipboard data:', error);
    return {};
  }
}

async function getStorageInfo() {
  try {
    const usage = await chrome.storage.local.getBytesInUse();
    const quota = chrome.storage.local.QUOTA_BYTES || 5242880;
    return {
      usage: usage,
      quota: quota,
      usagePercent: Math.round((usage / quota) * 100),
      usageKB: Math.round(usage / 1024),
      quotaKB: Math.round(quota / 1024)
    };
  } catch (error) {
    console.error('Failed to get storage info:', error);
    return { usage: 0, quota: 0, usagePercent: 0 };
  }
}

async function deleteClipboardData(id) {
  try {
    const result = await chrome.storage.local.get(['clipboards']);
    const clipboards = result.clipboards || {};

    // Find and remove the entry with matching ID
    for (const appName in clipboards) {
      for (const flowName in clipboards[appName]) {
        clipboards[appName][flowName] = clipboards[appName][flowName].filter(
          entry => entry.id !== id
        );

        // Clean up empty flows
        if (clipboards[appName][flowName].length === 0) {
          delete clipboards[appName][flowName];
        }
      }

      // Clean up empty apps
      if (Object.keys(clipboards[appName]).length === 0) {
        delete clipboards[appName];
      }
    }

    await chrome.storage.local.set({ clipboards });
  } catch (error) {
    console.error('Failed to delete clipboard data:', error);
  }
}