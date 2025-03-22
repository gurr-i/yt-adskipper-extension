// YouTube Ad Skipper - Content Script
let isEnabled = true;
let adsSkipped = 0;
let adObserver = null;
let isObserving = false;
let skipButtonCheck = null;
let videoAdCheck = null;

// Initialize on page load
initialize();

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "toggleStatus") {
    isEnabled = message.enabled;
    if (isEnabled) {
      startAdSkipper();
    } else {
      stopAdSkipper();
    }
  }
});

// Initialize ad skipper
function initialize() {
  // Get current state from storage
  chrome.storage.sync.get(["enabled", "adsSkipped"], function (result) {
    isEnabled = result.enabled !== undefined ? result.enabled : true;
    adsSkipped = result.adsSkipped || 0;

    if (isEnabled) {
      startAdSkipper();
    }
  });
}

// Start the ad skipper
function startAdSkipper() {
  if (!isObserving) {
    console.log("YouTube Ad Skipper: Starting...");

    // Setup the mutation observer to detect DOM changes (like ad appearance)
    setupAdObserver();

    // Start periodic checks for skip button and video ads
    startSkipButtonCheck();
    startVideoAdCheck();

    isObserving = true;
  }
}

// Stop the ad skipper
function stopAdSkipper() {
  console.log("YouTube Ad Skipper: Stopping...");

  if (adObserver) {
    adObserver.disconnect();
    adObserver = null;
  }

  if (skipButtonCheck) {
    clearInterval(skipButtonCheck);
    skipButtonCheck = null;
  }

  if (videoAdCheck) {
    clearInterval(videoAdCheck);
    videoAdCheck = null;
  }

  isObserving = false;
}

// Setup mutation observer to watch for ads
function setupAdObserver() {
  if (adObserver) {
    adObserver.disconnect();
  }

  adObserver = new MutationObserver(function (mutations) {
    if (!isEnabled) return;

    // Check for ads only if mutations are relevant
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
        checkForAds();
        break;
      }
    }
  });

  // Start observing the document with the configured parameters
  adObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// Start interval to check for skip button
function startSkipButtonCheck() {
  if (skipButtonCheck) {
    clearInterval(skipButtonCheck);
  }

  skipButtonCheck = setInterval(function () {
    if (!isEnabled) return;

    checkForSkipButton();
  }, 500); // Check every 500ms
}

// Start interval to check for video ads
function startVideoAdCheck() {
  if (videoAdCheck) {
    clearInterval(videoAdCheck);
  }

  videoAdCheck = setInterval(function () {
    if (!isEnabled) return;

    checkForVideoAds();
  }, 1000); // Check every 1000ms
}

// Check for the skip button
function checkForSkipButton() {
  // Look for various skip button selectors that YouTube might use
  const skipButtonSelectors = [
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    'button[data-tooltip-target-id="ad-skip-button"]',
    "button.ytp-ad-skip-button-modern",
    ".ytp-skip-ad-button",
    ".ytp-ad-skip-button-container",
    ".ytp-ad-skip-button-slot",
    ".ytp-ad-skip-button-wrapper",
    ".ytp-skip-ad",
    ".skip-ad-button",
    ".ytp-ad-skip-button-text",
    ".ytp-ad-skip-button-icon",
    ".ytp-ad-skip-button-animation",
    ".ytp-ad-skip-button-text-container",
    ".ytp-ad-skip-button-icon-container",
    ".ytp-ad-skip-button-animation-container",
  ];

  for (const selector of skipButtonSelectors) {
    const skipButton = document.querySelector(selector);
    if (skipButton && skipButton.offsetParent !== null) {
      console.log("YouTube Ad Skipper: Skip button found, clicking...");
      skipButton.click();
      incrementAdsSkipped();
      return; // Exit once we've found and clicked a button
    }
  }
}

// Check for video ads
function checkForVideoAds() {
  // Check if an ad is playing by looking for ad indicators
  const adIndicators = [
    ".ytp-ad-text",
    ".ytp-ad-preview-container",
    ".ad-showing",
    ".ytp-ad-player-overlay",
    ".ytp-ad-message-container",
    ".ytp-ad-message",
    ".ytp-ad-image",
    ".ytp-ad-overlay-container",
    ".ytp-ad-overlay",
    ".ytp-ad-progress",
    ".ytp-ad-progress-list",
    ".ytp-ad-progress-bar",
    ".ytp-ad-progress-bar-container",
    ".ytp-ad-progress-bar-fill",
    ".ytp-ad-progress-bar-buffer",
    ".ytp-ad-progress-bar-played",
  ];

  let adDetected = false;
  for (const selector of adIndicators) {
    const adElement = document.querySelector(selector);
    if (adElement && adElement.offsetParent !== null) {
      adDetected = true;
      break;
    }
  }

  if (adDetected) {
    // Check for skip button first
    checkForSkipButton();

    // If we can't find a skip button, try to force skip via video elements
    const video = document.querySelector("video");
    if (video) {
      // If we're in an ad, try to skip to the end
      console.log("YouTube Ad Skipper: Ad detected, attempting to skip...");

      // Try multiple methods to skip the ad

      // Method 1: Try to set current time to end of video
      try {
        if (video.duration) {
          video.currentTime = video.duration;
        }
      } catch (e) {
        console.log("YouTube Ad Skipper: Error skipping to end of ad:", e);
      }

      // Method 2: Try to mute the ad
      try {
        if (!video.muted) {
          video.muted = true;
          // We'll unmute after ad is over
          setTimeout(() => {
            if (!adDetected) video.muted = false;
          }, 2000);
        }
      } catch (e) {
        console.log("YouTube Ad Skipper: Error muting ad:", e);
      }

      incrementAdsSkipped();
    }
  }
}

// Check for all ad types
function checkForAds() {
  checkForSkipButton();
  checkForVideoAds();
}

// Increment ads skipped counter
function incrementAdsSkipped() {
  adsSkipped++;
  if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.set({ adsSkipped: adsSkipped });
  } else {
    console.error('Chrome storage sync API is not available');
  }

  // Notify user of ad skip
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.svg",
    title: "Ad Skipped",
    message: `You have skipped ${adsSkipped} ads this session.`,
  });
}

// Handle page navigation (e.g., when clicking on different videos)
window.addEventListener("yt-navigate-finish", function () {
  if (isEnabled) {
    // Just check for ads immediately instead of completely restarting
    // This provides a smoother experience without reloading
    console.log(
      "YouTube Ad Skipper: Page navigation detected, checking for ads"
    );
    checkForAds();

    // Only restart observers if we don't already have them running
    if (!isObserving) {
      startAdSkipper();
    }
  }
});
