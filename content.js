// content.js — YouTube Study Mode content script
// Runs on youtube.com and manipulates the DOM based on the active mode.

(function () {
  'use strict';

  // ========== CONFIGURATION ==========

  // Study-related keywords (case-insensitive matching)
  const STUDY_KEYWORDS = [
    'dsa', 'data structure', 'algorithm',
    'java', 'python', 'javascript', 'typescript', 'react', 'angular', 'vue',
    'programming', 'tutorial', 'coding', 'code', 'developer', 'development',
    'leetcode', 'competitive programming', 'web development',
    'machine learning', 'deep learning', 'ai', 'artificial intelligence',
    'computer science', 'software engineering', 'backend', 'frontend',
    'node.js', 'nodejs', 'c++', 'c programming', 'sql', 'database',
    'system design', 'interview', 'placement', 'operating system',
    'networking', 'linux', 'git', 'docker', 'devops', 'cloud',
    'html', 'css', 'bootstrap', 'tailwind'
  ];

  // CSS class we inject to identify our style block
  const STYLE_ID = 'yt-study-mode-styles';
  const NAV_BAR_ID = 'yt-study-mode-nav';
  const MESSAGE_ID = 'yt-study-mode-msg';
  const HIDDEN_SECTION_ATTR = 'data-yt-study-mode-hidden-section';
  const CARD_SELECTOR = `
    ytd-rich-item-renderer,
    ytd-video-renderer,
    ytd-compact-video-renderer,
    ytd-grid-video-renderer,
    ytd-playlist-renderer,
    ytd-radio-renderer,
    yt-lockup-view-model
  `;

  // Current mode: 'off' | 'study' | 'playlist' | 'combined'
  let currentMode = 'off';

  // Debounce timer for filtering
  let filterTimeout = null;

  // ========== HELPERS ==========

  // Check if a text string contains any study-related keyword
  function isStudyRelated(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return STUDY_KEYWORDS.some(kw => lower.includes(kw));
  }

  // Check if current page is a playlist page
  function isPlaylistPage() {
    return window.location.href.includes('/playlist') ||
           window.location.href.includes('list=');
  }

  // Check if current page is the playlists library
  function isPlaylistsLibrary() {
    return window.location.href.includes('/feed/playlists');
  }

  // Check if current page is a watch page
  function isWatchPage() {
    return window.location.pathname === '/watch';
  }

  // Check if current page is search results
  function isSearchPage() {
    return window.location.pathname === '/results';
  }

  // Check if current page is the home page
  function isHomePage() {
    return window.location.pathname === '/' || window.location.pathname === '';
  }

  function isPlaylistAllowedPage() {
    return isPlaylistPage() || isPlaylistsLibrary();
  }

  function getContentCards() {
    const cards = Array.from(document.querySelectorAll(CARD_SELECTOR));
    return cards.filter(card => !card.parentElement?.closest(CARD_SELECTOR));
  }

  function isPlaylistItem(card) {
    if (!card) return false;

    if (
      card.matches('ytd-playlist-renderer, ytd-radio-renderer') ||
      card.closest('ytd-playlist-panel-renderer') !== null ||
      card.closest('ytd-playlist-video-list-renderer') !== null ||
      card.closest('ytd-item-section-renderer[page-subtype="playlist"]') !== null
    ) {
      return true;
    }

    return Array.from(card.querySelectorAll('a[href]')).some(link => {
      const href = link.getAttribute('href') || '';
      return href.includes('/playlist?list=') || href.includes('&list=');
    });
  }

  function hideSections(selectors) {
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        el.setAttribute(HIDDEN_SECTION_ATTR, 'true');
        el.style.display = 'none';
      });
    });
  }

  function restoreHiddenSections() {
    document.querySelectorAll(`[${HIDDEN_SECTION_ATTR}="true"]`).forEach(el => {
      el.style.display = '';
      el.removeAttribute(HIDDEN_SECTION_ATTR);
    });
  }

  // ========== NAVIGATION BAR ==========
  // In playlist mode, we inject a small nav bar so users can access playlists
  // even though the sidebar is hidden.

  function injectNavBar(mode) {
    // Remove existing nav bar
    const existing = document.getElementById(NAV_BAR_ID);
    if (existing) existing.remove();

    if (mode === 'off') return;

    const nav = document.createElement('div');
    nav.id = NAV_BAR_ID;
    nav.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      gap: 8px;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 8px 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      font-family: 'YouTube Sans', 'Roboto', sans-serif;
      font-size: 13px;
    `;

    // Mode indicator
    const modeLabel = document.createElement('span');
    const modeNames = { study: '🎯 Study', playlist: '📋 Playlist', combined: '⚡ Combined' };
    modeLabel.textContent = modeNames[mode] || mode;
    modeLabel.style.cssText = 'color: #3ea6ff; font-weight: 600; padding: 4px 8px; white-space: nowrap;';
    nav.appendChild(modeLabel);

    // Always show a link to playlists
    if (mode === 'playlist' || mode === 'combined') {
      const sep = document.createElement('span');
      sep.textContent = '|';
      sep.style.cssText = 'color: #555; padding: 4px 0;';
      nav.appendChild(sep);

      const playlistLink = document.createElement('a');
      playlistLink.href = 'https://www.youtube.com/feed/playlists';
      playlistLink.textContent = '📋 My Playlists';
      playlistLink.style.cssText = `
        color: #ccc; text-decoration: none; padding: 4px 8px;
        border-radius: 6px; white-space: nowrap;
        transition: background 0.15s;
      `;
      playlistLink.onmouseenter = () => { playlistLink.style.background = '#333'; };
      playlistLink.onmouseleave = () => { playlistLink.style.background = 'none'; };
      nav.appendChild(playlistLink);

      const libraryLink = document.createElement('a');
      libraryLink.href = 'https://www.youtube.com/feed/library';
      libraryLink.textContent = '📚 Library';
      libraryLink.style.cssText = `
        color: #ccc; text-decoration: none; padding: 4px 8px;
        border-radius: 6px; white-space: nowrap;
        transition: background 0.15s;
      `;
      libraryLink.onmouseenter = () => { libraryLink.style.background = '#333'; };
      libraryLink.onmouseleave = () => { libraryLink.style.background = 'none'; };
      nav.appendChild(libraryLink);
    }

    document.body.appendChild(nav);
  }

  // ========== STYLE INJECTION ==========

  function injectStyles(mode) {
    const existing = document.getElementById(STYLE_ID);
    if (existing) existing.remove();

    if (mode === 'off') return;

    const style = document.createElement('style');
    style.id = STYLE_ID;

    let css = `
      /* Hide YouTube Shorts shelf & links */
      ytd-reel-shelf-renderer,
      ytd-rich-shelf-renderer[is-shorts],
      a[title="Shorts"],
      ytd-mini-guide-entry-renderer[aria-label="Shorts"],
      ytd-guide-entry-renderer a[title="Shorts"] {
        display: none !important;
      }

      /* Hide the left sidebar / guide */
      tp-yt-app-drawer#guide,
      ytd-mini-guide-renderer,
      #guide-button {
        display: none !important;
      }

      /* Expand the main content area to fill the space */
      ytd-app {
        --app-drawer-width: 0px !important;
      }
      ytd-page-manager {
        margin-left: 0 !important;
      }

      /* Hide the recommended videos sidebar on watch pages */
      #secondary.ytd-watch-flexy,
      #related {
        display: none !important;
      }

      /* Make the video player use full width */
      ytd-watch-flexy:not([theater]):not([fullscreen]) #primary.ytd-watch-flexy {
        max-width: 100% !important;
      }
    `;

    style.textContent = css;
    document.head.appendChild(style);
  }

  // ========== VIDEO FILTERING ==========

  function getVideoTitle(card) {
    const titleSelectors = [
      '#video-title',
      '#video-title-link',
      'a#video-title',
      'yt-formatted-string#video-title',
      'a.yt-lockup-metadata-view-model__title',
      '.yt-lockup-metadata-view-model__title',
      'h3 a',
      'h3 span',
      'a[href*="/watch"][title]',
      'a[href*="/watch"]',
      'a[href*="/playlist?list="][title]',
      'a[href*="/playlist?list="]'
    ];

    for (const selector of titleSelectors) {
      const titleEl = card.querySelector(selector);
      if (!titleEl) continue;

      const title = (titleEl.getAttribute('title') || titleEl.textContent || '').trim();
      if (title) return title.toLowerCase();
    }

    return '';
  }

  function filterVideos() {
    if (currentMode === 'off') return;

    const videoCards = getContentCards();
    let shownCount = 0;
    let hiddenCount = 0;

    videoCards.forEach(card => {
      const title = getVideoTitle(card);
      const isInPlaylist = isPlaylistItem(card);
      const studyMatch = isStudyRelated(title);

      let shouldShow = false;

      if (currentMode === 'study') {
        shouldShow = studyMatch;
      } else if (currentMode === 'playlist') {
        shouldShow = isPlaylistAllowedPage() && isInPlaylist;
      } else if (currentMode === 'combined') {
        shouldShow = studyMatch || isInPlaylist;
      }

      // On watch page, never hide the primary player area
      if (isWatchPage() && card.closest('#primary')) {
        shouldShow = currentMode !== 'playlist';
      }

      card.style.display = shouldShow ? '' : 'none';
      if (shouldShow) shownCount += 1;
      else hiddenCount += 1;
    });

    console.log(`[YouTube Study Mode] Filtered cards — shown: ${shownCount}, hidden: ${hiddenCount}, mode: ${currentMode}`);
  }

  // Handle playlist mode on home page — show a message instead of empty grid
  function handlePlaylistMode() {
    let msg = document.getElementById(MESSAGE_ID);

    if (currentMode !== 'playlist') {
      if (msg) msg.remove();
      restoreHiddenSections();
      return;
    }

    if (isPlaylistAllowedPage()) {
      if (msg) msg.remove();
      restoreHiddenSections();
      return;
    }

    let container = null;
    let selectorsToHide = [];

    if (isHomePage()) {
      container = document.querySelector('ytd-browse[page-subtype="home"]');
      selectorsToHide = ['ytd-browse[page-subtype="home"] #contents'];
    } else if (isSearchPage()) {
      container = document.querySelector('ytd-search');
      selectorsToHide = ['ytd-search #contents', 'ytd-search #primary'];
    } else if (isWatchPage()) {
      container = document.querySelector('ytd-watch-flexy #columns') || document.querySelector('ytd-watch-flexy');
      selectorsToHide = ['ytd-watch-flexy #primary', 'ytd-watch-flexy #secondary'];
    }

    restoreHiddenSections();
    if (selectorsToHide.length > 0) hideSections(selectorsToHide);
    if (!container) return;

    if (!msg) {
      msg = document.createElement('div');
      msg.id = MESSAGE_ID;
      msg.style.cssText = `
        text-align: center;
        padding: 80px 20px;
        font-size: 18px;
        color: #aaa;
        font-family: 'YouTube Sans', 'Roboto', sans-serif;
        position: relative;
        z-index: 10;
      `;
      msg.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
        <strong style="color: #fff; font-size: 22px;">Playlist Mode Active</strong>
        <br><br>
        <span style="color: #888;">Only your saved playlists and playlist videos are visible in this mode.</span>
        <br><br>
        <a href="https://www.youtube.com/feed/playlists"
           style="display: inline-block; padding: 12px 28px; background: #3ea6ff; color: #000;
                  border-radius: 20px; text-decoration: none; font-weight: 600; font-size: 15px;
                  transition: background 0.15s;">
          Go to My Playlists →
        </a>
        <br><br>
        <a href="https://www.youtube.com/feed/library"
           style="color: #3ea6ff; text-decoration: none; font-size: 14px;">
          or open your Library
        </a>
      `;
    }

    if (msg.parentElement !== container) {
      container.prepend(msg);
    }
  }

  // ========== MAIN APPLY FUNCTION ==========

  function applyMode() {
    console.log(`[YouTube Study Mode] Applying mode: ${currentMode}`);

    // Inject / remove CSS
    injectStyles(currentMode);

    // Inject / remove navigation bar
    injectNavBar(currentMode);

    if (currentMode === 'off') {
      // Restore all hidden video cards
      document.querySelectorAll(CARD_SELECTOR).forEach(card => { card.style.display = ''; });

      restoreHiddenSections();

      // Remove any message overlays
      const msg = document.getElementById(MESSAGE_ID);
      if (msg) msg.remove();

      return;
    }

    // Filter videos
    filterVideos();

    // Handle playlist-specific behavior
    handlePlaylistMode();
  }

  // Debounced version for MutationObserver
  function debouncedApply() {
    if (filterTimeout) clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
      if (currentMode !== 'off') {
        filterVideos();
        handlePlaylistMode();
      }
    }, 300);
  }

  // ========== INITIALIZATION ==========

  // Load the saved mode from storage
  chrome.storage.local.get(['ytStudyMode'], (result) => {
    currentMode = result.ytStudyMode || 'off';
    console.log(`[YouTube Study Mode] Initialized with mode: ${currentMode}`);
    applyMode();
  });

  // Listen for mode changes from the popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'modeChanged') {
      currentMode = message.mode;
      applyMode();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.ytStudyMode) {
      currentMode = changes.ytStudyMode.newValue || 'off';
      applyMode();
    }
  });

  // ========== MUTATION OBSERVER ==========
  // YouTube loads content dynamically (SPA), so we watch for DOM changes

  const observer = new MutationObserver((mutations) => {
    let shouldReapply = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        shouldReapply = true;
        break;
      }
    }
    if (shouldReapply && currentMode !== 'off') {
      debouncedApply();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Re-apply on YouTube SPA navigation (URL changes without page reload)
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      console.log(`[YouTube Study Mode] URL changed to: ${location.href}`);
      // Small delay to let YouTube render the new page
      setTimeout(applyMode, 500);
      // Second pass for lazy-loaded content
      setTimeout(applyMode, 1500);
    }
  });
  urlObserver.observe(document.querySelector('title') || document.head, {
    childList: true,
    subtree: true
  });

})();
