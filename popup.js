// popup.js — Handles mode switching in the extension popup

const buttons = document.querySelectorAll('.btn');
const offBtn = document.getElementById('offBtn');
const currentModeEl = document.getElementById('currentMode');

// Display names for each mode
const modeNames = {
  study: 'Study Mode',
  playlist: 'Playlist Mode',
  combined: 'Combined Mode',
  off: 'Off'
};

// Update the UI to reflect the currently active mode
function updateUI(mode) {
  buttons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  currentModeEl.textContent = modeNames[mode] || 'Off';
}

// Load the saved mode when popup opens
chrome.storage.local.get(['ytStudyMode'], (result) => {
  const mode = result.ytStudyMode || 'off';
  console.log('[YouTube Study Mode] Current mode:', mode);
  updateUI(mode);
});

// Handle mode button clicks
buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    chrome.storage.local.set({ ytStudyMode: mode }, () => {
      console.log('[YouTube Study Mode] Switched to:', mode);
      updateUI(mode);
      // Notify the content script to apply changes immediately
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'modeChanged', mode });
        }
      });
    });
  });
});

// Handle "Turn Off" button
offBtn.addEventListener('click', () => {
  chrome.storage.local.set({ ytStudyMode: 'off' }, () => {
    console.log('[YouTube Study Mode] Turned off');
    updateUI('off');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'modeChanged', mode: 'off' });
      }
    });
  });
});
