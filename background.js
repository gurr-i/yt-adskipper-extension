// Initialize default values when extension is installed
chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.sync.get(['enabled', 'adsSkipped'], function(result) {
    if (result.enabled === undefined) {
      chrome.storage.sync.set({ enabled: true });
    }
    
    if (result.adsSkipped === undefined) {
      chrome.storage.sync.set({ adsSkipped: 0 });
    }
  });
});

// Listen for tab updates to reinject the content script if needed
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  // Only proceed if the tab is completely loaded and it's a YouTube URL
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com')) {
    // Check if extension is enabled
    chrome.storage.sync.get(['enabled'], function(result) {
      if (result.enabled) {
        // Send message to content script to ensure it's active
        chrome.tabs.sendMessage(tabId, { action: 'checkStatus' }, function(response) {
          // If there's an error, it means the content script is not running
          // We won't reload the tab anymore to avoid disrupting the user experience
          if (chrome.runtime.lastError) {
            console.log("Content script not detected on YouTube tab, but we won't refresh to avoid disruption");
          }
        });
      }
    });
  }
});

// Reset ads skipped counter at midnight each day
function setupDailyReset() {
  const now = new Date();
  
  // Calculate time until midnight
  const night = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1, // the next day
    0, 0, 0 // midnight
  );
  
  // Time until midnight in milliseconds
  const timeUntilMidnight = night.getTime() - now.getTime();
  
  // Set timeout to reset counter at midnight
  setTimeout(function() {
    chrome.storage.sync.set({ adsSkipped: 0 });
    
    // Setup the next day's reset
    setupDailyReset();
  }, timeUntilMidnight);
}

// Start the daily reset scheduler
setupDailyReset();
