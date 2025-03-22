document.addEventListener('DOMContentLoaded', function() {
  // Rate limiting variables
  const WRITE_OPERATION_LIMIT = 120; // Max writes per minute
  const WRITE_INTERVAL = 60000 / WRITE_OPERATION_LIMIT; // Minimum interval between writes
  let lastWriteTime = 0;
  let writeQueue = [];

  function processWriteQueue() {
    if (writeQueue.length > 0 && Date.now() - lastWriteTime >= WRITE_INTERVAL) {
      const {key, value, callback} = writeQueue.shift();
      chrome.storage.sync.set({[key]: value}, function() {
        lastWriteTime = Date.now();
        if (callback) callback();
        processWriteQueue();
      });
    } else if (writeQueue.length > 0) {
      setTimeout(processWriteQueue, WRITE_INTERVAL - (Date.now() - lastWriteTime));
    }
  }

  function rateLimitedSet(key, value, callback) {
    writeQueue.push({key, value, callback});
    processWriteQueue();
  }

  const toggleButton = document.getElementById('toggle-button');
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  const statusText = document.getElementById('status-text');
  const adsSkipped = document.getElementById('ads-skipped');

  // Load settings from storage
  chrome.storage.sync.get(['enabled', 'adsSkipped', 'darkMode'], function(result) {
    if (result.enabled === undefined) {
      toggleButton.checked = true;
      chrome.storage.sync.set({ enabled: true });
    } else {
      toggleButton.checked = result.enabled;
      updateStatusText(result.enabled);
    }

    adsSkipped.textContent = result.adsSkipped || 0;

    // Set dark mode state
    if (result.darkMode) {
      document.body.classList.add('dark-mode');
      darkModeToggle.checked = true;
    }
  });

  // Toggle button event listener
  toggleButton.addEventListener('change', function() {
    const isEnabled = toggleButton.checked;
    chrome.storage.sync.set({ enabled: isEnabled });
    updateStatusText(isEnabled);
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0] && tabs[0].url.includes('youtube.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleStatus', enabled: isEnabled }, function(response) {
          if (chrome.runtime.lastError) {
            console.log("Retrying message send in 500ms");
            setTimeout(() => {
              chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleStatus', enabled: isEnabled });
            }, 500);
          }
        });
      }
    });
  });

  // Dark mode toggle event listener
  darkModeToggle.addEventListener('change', function() {
    const isDarkMode = darkModeToggle.checked;
    chrome.storage.sync.set({ darkMode: isDarkMode });
    document.body.classList.toggle('dark-mode', isDarkMode);
  });

  function updateStatusText(enabled) {
    if (enabled) {
      statusText.textContent = 'Active';
      statusText.classList.remove('inactive');
    } else {
      statusText.textContent = 'Inactive';
      statusText.classList.add('inactive');
    }
  }
});
