(() => {
  'use strict';

  if (globalThis.__ykPauseAdKillerLoaded) {
    return;
  }
  globalThis.__ykPauseAdKillerLoaded = true;

  const STATIC_PAUSE_AD_SELECTORS = [
    '#click-close',
    '.ad-effect',
    '.ad-effect-details',
    'div[class*="ad-effect"]',
    'div.ad-button',
    '#youku-pause-resource-container',
    '.advertise-layer',
    '.youku-advertise-layer',
    '.advertise-youku-tips',
    '#youku-pause-container',
    'div.callEnd_box',
    'div.callEnd_fixed_box',
    'div[sourcetype*="Sbanner"]',
    '.youku-player-paused-overlay',
    '.youku-player-pause-ad',
    '.p-layer-pause-wrap',
    '.yk-pause-layer',
    '.h5player-paused-content',
    'div[class*="pause-ad"]',
    'div[class*="ad-pause"]',
    'div[class*="pauseAd"]',
    'div[class*="PauseAd"]',
    'div[class*="pause_ad"]',
    'div[id*="pause-ad"]',
    'div[id*="pause_ad"]',
    '.h5-ext-layer div[class*="pause"]',
    '.h5-ext-layer div[class*="ad-"]',
    '.h5-ext-layer div[class*="-ad"]',
  ];

  const PLAYER_CONTAINER_SELECTOR =
    '#ykPlayer, #player, .youku-film-player, .h5player, .ykplayer';
  const PROTECTED_ROOT_SELECTOR =
    '#ykPlayer, #player, .youku-film-player, .h5player, .ykplayer, .h5-ext-layer';

  const PROTECTED_KEYWORDS = [
    'control',
    'dashboard',
    'progress',
    'volume',
    'setting',
    'quality',
    'danmu',
    'bar',
    'subtitle',
    'logo',
    'watermark',
    'hotkey',
  ];

  const PROTECTED_SUBTREE_SELECTOR =
    '[class*="control"], [class*="dashboard"], [class*="danmu"], [class*="subtitle"]';

  function logDebug(...args) {
    console.log('%c[优酷暂停去广告]', 'color: #fff; background: #2563eb; padding: 2px 6px; border-radius: 4px;', ...args);
  }

  function logAction(...args) {
    console.log('%c[优酷暂停去广告 命中]', 'color: #fff; background: #059669; padding: 2px 6px; border-radius: 4px;', ...args);
  }

  /**
   * Helper diagnostic tool: print element tree under player when paused.
   */
  function inspectPlayerOverlays() {
    for (const video of document.querySelectorAll('video')) {
      let current = video.parentElement;
      let depth = 0;
      while (current && current !== document.body && depth < 4) {
        depth += 1;
        const rect = current.getBoundingClientRect();
        if (rect.width >= 300 && rect.height >= 180) {
          const directChildren = Array.from(current.children);
          logDebug(`播放器容器 (${current.tagName}.${current.className || '(无class)'}) 子元素清单:`, directChildren.map(c => ({
            tag: c.tagName,
            class: c.className,
            id: c.id,
            display: getComputedStyle(c).display,
            position: getComputedStyle(c).position,
            rect: `${Math.round(c.getBoundingClientRect().width)}x${Math.round(c.getBoundingClientRect().height)}`,
            textSnippet: (c.textContent || '').trim().slice(0, 30)
          })));
          break;
        }
        current = current.parentElement;
      }
    }
  }
  const AD_BADGE_TEXTS = new Set(['广告', '暂停广告', '关闭广告', 'AD']);
  const CLOSE_TEXTS = new Set(['×', '✕', '✖', 'X', '关闭', '关闭广告', '跳过', '跳过广告']);
  const PAUSE_SCAN_DELAYS_MS = [80, 250, 600, 1200];
  const BATCH_SIZE = 20;

  let isEnabled = true;
  let customSelectors = [];
  let isScanning = false;
  let rescanRequested = false;
  let mutationRafId = 0;
  let burstTimerIds = [];
  let pickerCleanup = null;

  /**
   * Read element class string safely for both HTML and SVG elements.
   * @param {Element} el
   * @returns {string}
   */
  function getClassString(el) {
    return (el.getAttribute('class') || '').toLowerCase();
  }

  /**
   * Check whether a string contains any protected UI token.
   * @param {string} value
   * @returns {boolean}
   */
  function hasProtectedKeyword(value) {
    if (!value) return false;
    const lower = value.toLowerCase();
    return PROTECTED_KEYWORDS.some((kw) => lower.includes(kw));
  }

  /**
   * Protect core video playback, player root wrappers, controls, danmaku, and extension UI.
   * @param {Element | null} el
   * @returns {boolean}
   */
  function isProtectedPlayerNode(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return true;
    if (el === document.documentElement || el === document.body) return true;
    if (el.id === 'yk-ad-picker-banner' || el.closest('#yk-ad-picker-banner')) return true;

    const tag = el.tagName;
    if (tag === 'VIDEO' || tag === 'AUDIO' || tag === 'HTML' || tag === 'BODY') return true;
    if (el.matches(PROTECTED_ROOT_SELECTOR)) return true;
    if (el.querySelector('video')) return true;

    if (hasProtectedKeyword(el.id) || hasProtectedKeyword(getClassString(el))) {
      return true;
    }

    if (el.querySelector(PROTECTED_SUBTREE_SELECTOR)) {
      return true;
    }

    let parent = el.parentElement;
    while (parent && parent !== document.body && !parent.matches(PROTECTED_ROOT_SELECTOR)) {
      if (hasProtectedKeyword(parent.id) || hasProtectedKeyword(getClassString(parent))) {
        return true;
      }
      parent = parent.parentElement;
    }

    return false;
  }

  /**
   * Locate player root containers on the page.
   * @returns {Element[]}
   */
  function getPlayerContainers() {
    const containers = new Set(document.querySelectorAll(PLAYER_CONTAINER_SELECTOR));

    for (const video of document.querySelectorAll('video')) {
      let current = video.parentElement;
      let depth = 0;
      let fallbackContainer = null;

      while (current && current !== document.body && depth < 4) {
        depth += 1;
        const rect = current.getBoundingClientRect();
        if (rect.width >= 300 && rect.height >= 180) {
          fallbackContainer = current;
          const pos = getComputedStyle(current).position;
          if (pos === 'relative' || pos === 'absolute' || pos === 'fixed') {
            containers.add(current);
          }
        }
        current = current.parentElement;
      }

      if (fallbackContainer) {
        containers.add(fallbackContainer);
      }
    }

    return Array.from(containers);
  }

  /**
   * Determine if a container (or page) has a paused, non-ended video.
   * @param {Element} container
   * @returns {{ hasVideo: boolean, isPaused: boolean }}
   */
  function getVideoPauseState(container) {
    let videos = Array.from(container.querySelectorAll('video'));
    if (videos.length === 0) {
      videos = Array.from(document.querySelectorAll('video'));
    }
    if (videos.length === 0) {
      return { hasVideo: false, isPaused: false };
    }
    let isPaused = videos.some((video) => video.paused === true && !video.ended);
    if (!isPaused && videos.length === 0) {
      // In case video element is loaded asynchronously
      isPaused = true;
    }
    return { hasVideo: true, isPaused };
  }

  /**
   * Check whether an overlay contains an explicit ad badge such as "广告" or "暂停广告".
   * @param {Element} el
   * @returns {{ matched: boolean, isPauseSpecific: boolean }}
   */
  function checkAdBadge(el) {
    const candidates = [el, ...el.querySelectorAll('span, div, p, a, em, i, label, button')];
    const limit = Math.min(candidates.length, 80);

    for (let i = 0; i < limit; i += 1) {
      const node = candidates[i];
      if (node.children.length > 2) continue;
      const rawText = (node.textContent || '').trim();
      if (!rawText || rawText.length > 8) continue;

      const normalized = rawText.toUpperCase();
      if (AD_BADGE_TEXTS.has(rawText) || AD_BADGE_TEXTS.has(normalized)) {
        return {
          matched: true,
          isPauseSpecific: rawText === '暂停广告',
        };
      }
    }

    return { matched: false, isPauseSpecific: false };
  }

  /**
   * Check whether an overlay contains a close button signature.
   * @param {Element} el
   * @returns {Element | null} Returns the close button element if found
   */
  function findCloseButton(el) {
    const directClose = el.querySelector(
      '[class*="close" i], [id*="close" i], [aria-label*="关闭"], [aria-label*="close" i], [title*="关闭"], [title*="close" i]'
    );
    if (directClose && !isProtectedPlayerNode(directClose)) {
      return directClose;
    }

    const candidates = el.querySelectorAll('button, a, span, div, i, em, svg');
    const limit = Math.min(candidates.length, 60);
    for (let i = 0; i < limit; i += 1) {
      const node = candidates[i];
      if (node.children.length > 2) continue;
      const text = (node.textContent || '').trim();
      if (!text || text.length > 6) continue;
      if (CLOSE_TEXTS.has(text) || CLOSE_TEXTS.has(text.toUpperCase())) {
        if (!isProtectedPlayerNode(node)) {
          return node;
        }
      }
    }

    return null;
  }

  /**
   * Check whether an overlay contains a close button signature.
   * @param {Element} el
   * @returns {boolean}
   */
  function hasCloseFeature(el) {
    return Boolean(findCloseButton(el));
  }

  /**
   * Check whether an overlay contains promotional media or outbound links.
   * @param {Element} el
   * @returns {boolean}
   */
  function hasMediaOrLinkFeature(el) {
    if (el.querySelector('img, a[href], iframe, canvas')) {
      return true;
    }

    const nodes = [el, ...el.querySelectorAll('div, span, a, section')];
    const limit = Math.min(nodes.length, 30);
    for (let i = 0; i < limit; i += 1) {
      const bg = getComputedStyle(nodes[i]).backgroundImage;
      if (bg && bg !== 'none' && bg.includes('url(')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Collect candidate overlay elements inside player containers and .h5-ext-layer.
   * @param {Element} container
   * @returns {Element[]}
   */
  function collectOverlayCandidates(container) {
    const candidates = new Set();

    for (const child of container.querySelectorAll('.h5-ext-layer > *')) {
      candidates.add(child);
    }

    const blocks = container.querySelectorAll('div, section, aside');
    const limit = Math.min(blocks.length, 150);
    for (let i = 0; i < limit; i += 1) {
      const node = blocks[i];
      if (candidates.has(node)) continue;
      const pos = getComputedStyle(node).position;
      if (pos === 'absolute' || pos === 'fixed') {
        candidates.add(node);
      }
    }

    return Array.from(candidates);
  }

  /**
   * Run heuristic pause ad detection across player containers.
   * @param {Set<Element>} matchedSet
   * @returns {Element[]}
   */
  function findHeuristicPauseAds(matchedSet) {
    const results = [];
    const containers = getPlayerContainers();

    for (const extLayerChild of document.querySelectorAll('.h5-ext-layer > *')) {
      const hostContainer = extLayerChild.closest(PLAYER_CONTAINER_SELECTOR);
      if (!hostContainer && !containers.includes(extLayerChild.parentElement)) {
        containers.push(extLayerChild.parentElement);
      }
    }

    for (const container of containers) {
      if (!container) continue;
      const playerRect = container.getBoundingClientRect();
      const playerArea = playerRect.width * playerRect.height;
      const { hasVideo, isPaused } = getVideoPauseState(container);
      const candidates = collectOverlayCandidates(container);

      for (const candidate of candidates) {
        if (matchedSet.has(candidate) || candidate.dataset.ykPauseAdKilled === '1') continue;
        if (isProtectedPlayerNode(candidate)) continue;

        const style = getComputedStyle(candidate);
        if (style.display === 'none' || style.visibility === 'hidden') continue;

        const badge = checkAdBadge(candidate);
        if (badge.matched && (badge.isPauseSpecific || isPaused || !hasVideo)) {
          results.push(candidate);
          continue;
        }

        if (!isPaused || playerArea <= 0) continue;

        const rect = candidate.getBoundingClientRect();
        const rectArea = rect.width * rect.height;
        if (rect.width < 120 || rect.height < 120 || rectArea >= playerArea * 0.95) {
          continue;
        }

        if (hasCloseFeature(candidate) && hasMediaOrLinkFeature(candidate)) {
          results.push(candidate);
        }
      }
    }

    return results;
  }

  /**
   * Remove descendant matches when an ancestor is already selected or hidden.
   * @param {Element[]} candidates
   * @returns {Element[]}
   */
  function deduplicateTargets(candidates) {
    const set = new Set(candidates);
    const unique = [];

    for (const el of set) {
      let ancestorCovered = false;
      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        if (set.has(parent) || parent.dataset.ykPauseAdKilled === '1') {
          ancestorCovered = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (!ancestorCovered) {
        unique.push(el);
      }
    }

    return unique;
  }

  /**
   * Yield one animation frame and apply hide classes in batches.
   * @param {Element[]} elements
   * @param {Element[]} reinforceElements
   * @returns {Promise<number>}
   */
  async function batchHideElements(elements, reinforceElements = []) {
    const allWork = [
      ...elements.map((el) => ({ el, isNew: true })),
      ...reinforceElements.map((el) => ({ el, isNew: false })),
    ];
    if (allWork.length === 0) return 0;

    let newlyKilled = 0;

    for (let i = 0; i < allWork.length; i += BATCH_SIZE) {
      const batch = allWork.slice(i, i + BATCH_SIZE);
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          if (!isEnabled) {
            resolve();
            return;
          }
          for (const { el, isNew } of batch) {
            if (!el.isConnected || isProtectedPlayerNode(el)) continue;

            const wasKilled = el.dataset.ykPauseAdKilled === '1';
            el.classList.add('yk-pause-ad-killed');
            el.dataset.ykPauseAdKilled = '1';

            if (!isNew || getComputedStyle(el).display !== 'none') {
              // Try clicking its close button first if available
              const closeBtn = findCloseButton(el);
              if (closeBtn && typeof closeBtn.click === 'function') {
                try {
                  logAction('自动点击暂停广告关闭按钮:', closeBtn);
                  closeBtn.click();
                } catch {
                  // Ignore click errors
                }
              }

              if (!('ykPrevDisplay' in el.dataset)) {
                el.dataset.ykPrevDisplay = el.style.getPropertyValue('display') || '';
                el.dataset.ykPrevDisplayPriority = el.style.getPropertyPriority('display') || '';
              }
              el.style.setProperty('display', 'none', 'important');
              logAction('已隐藏暂停广告元素:', el);
            }

            if (isNew && !wasKilled) {
              newlyKilled += 1;
            }
          }
          resolve();
        });
      });

      if (globalThis.scheduler?.yield) {
        await globalThis.scheduler.yield();
      }
    }

    return newlyKilled;
  }

  /**
   * Restore previously hidden nodes (used when disabled or custom rules reset).
   * @param {boolean} removeKillMarker
   */
  async function restoreHiddenElements(removeKillMarker) {
    const killed = Array.from(document.querySelectorAll('[data-yk-pause-ad-killed="1"]'));
    if (killed.length === 0) return;

    for (let i = 0; i < killed.length; i += BATCH_SIZE) {
      const batch = killed.slice(i, i + BATCH_SIZE);
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          for (const el of batch) {
            if (!el.isConnected) continue;
            if ('ykPrevDisplay' in el.dataset) {
              const prev = el.dataset.ykPrevDisplay;
              const priority = el.dataset.ykPrevDisplayPriority || '';
              if (prev) {
                el.style.setProperty('display', prev, priority);
              } else {
                el.style.removeProperty('display');
              }
              delete el.dataset.ykPrevDisplay;
              delete el.dataset.ykPrevDisplayPriority;
            }
            if (removeKillMarker) {
              el.classList.remove('yk-pause-ad-killed');
              delete el.dataset.ykPauseAdKilled;
            }
          }
          resolve();
        });
      });

      if (globalThis.scheduler?.yield) {
        await globalThis.scheduler.yield();
      }
    }
  }

  /**
   * Scan DOM for pause ads using static rules, custom rules, and heuristics.
   */
  async function scanAndClearPauseAds() {
    if (!isEnabled) return;
    if (isScanning) {
      rescanRequested = true;
      return;
    }

    isScanning = true;
    try {
      const matchedSet = new Set();
      const allSelectors = [...STATIC_PAUSE_AD_SELECTORS, ...customSelectors];

      for (const selector of allSelectors) {
        if (!selector || typeof selector !== 'string') continue;
        try {
          for (const el of document.querySelectorAll(selector)) {
            if (!isProtectedPlayerNode(el) && el.dataset.ykPauseAdKilled !== '1') {
              matchedSet.add(el);
            }
          }
        } catch {
          // Ignore invalid user-supplied selector
        }
      }

      for (const el of findHeuristicPauseAds(matchedSet)) {
        matchedSet.add(el);
      }

      const targets = deduplicateTargets(Array.from(matchedSet));
      const reinforce = [];
      for (const el of document.querySelectorAll('[data-yk-pause-ad-killed="1"]')) {
        if (!el.classList.contains('yk-pause-ad-killed') || getComputedStyle(el).display !== 'none') {
          reinforce.push(el);
        }
      }

      const newlyKilled = await batchHideElements(targets, reinforce);
      if (newlyKilled > 0) {
        logAction(`本次共清除 ${newlyKilled} 处暂停广告浮层`);
        try {
          await chrome.runtime.sendMessage({
            type: 'PAUSE_AD_CLEARED',
            count: newlyKilled,
          });
        } catch {
          // Service worker may be waking up or extension reloaded
        }
      }
    } finally {
      isScanning = false;
      if (rescanRequested) {
        rescanRequested = false;
        void scanAndClearPauseAds();
      }
    }
  }

  /**
   * Clear pending delayed scans triggered after a pause event.
   */
  function clearPauseScanBurst() {
    for (const timerId of burstTimerIds) {
      clearTimeout(timerId);
    }
    burstTimerIds = [];
  }

  /**
   * Run immediate scan plus delayed scans to catch asynchronously loaded pause ads.
   */
  function schedulePauseScanBurst() {
    if (!isEnabled) return;
    clearPauseScanBurst();
    void scanAndClearPauseAds();

    for (const delay of PAUSE_SCAN_DELAYS_MS) {
      const timerId = setTimeout(() => {
        void scanAndClearPauseAds();
      }, delay);
      burstTimerIds.push(timerId);
    }
  }

  /**
   * Generate a concise CSS selector for an element selected in picker mode.
   * @param {Element} el
   * @returns {string}
   */
  function buildCssSelector(el) {
    if (el.id && !/^\d+$/.test(el.id)) {
      const idSel = `#${CSS.escape(el.id)}`;
      try {
        if (document.querySelectorAll(idSel).length === 1) {
          return idSel;
        }
      } catch {
        // Fall through to path builder
      }
    }

    const parts = [];
    let current = el;
    let depth = 0;

    while (current && current !== document.body && current !== document.documentElement && depth < 4) {
      depth += 1;
      if (current.id && !/^\d+$/.test(current.id)) {
        const idSel = `#${CSS.escape(current.id)}`;
        parts.unshift(idSel);
        break;
      }

      const tag = current.tagName.toLowerCase();
      const classes = Array.from(current.classList)
        .filter((cls) => cls && !cls.startsWith('yk-ad-picker-') && cls !== 'yk-pause-ad-killed')
        .slice(0, 2)
        .map((cls) => `.${CSS.escape(cls)}`);

      let segment = tag + classes.join('');
      const parent = current.parentElement;
      if (parent) {
        const sameTagSiblings = Array.from(parent.children).filter(
          (sibling) => sibling.tagName === current.tagName
        );
        if (sameTagSiblings.length > 1) {
          const index = sameTagSiblings.indexOf(current) + 1;
          segment += `:nth-of-type(${index})`;
        }
      }

      parts.unshift(segment);
      if (current.classList.contains('h5-ext-layer')) {
        break;
      }
      current = current.parentElement;
    }

    return parts.join(' > ');
  }

  /**
   * Start interactive picker mode so users can click any missed pause ad overlay.
   */
  async function startPickerMode() {
    if (pickerCleanup) {
      pickerCleanup();
    }

    const banner = document.createElement('div');
    banner.id = 'yk-ad-picker-banner';
    banner.className = 'yk-ad-picker-banner';

    const textEl = document.createElement('span');
    textEl.className = 'yk-ad-picker-banner-text';
    textEl.textContent = '点选模式已开启：请点击要屏蔽的暂停广告区域（按 ESC 取消）';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'yk-ad-picker-banner-cancel';
    cancelBtn.textContent = '取消';

    banner.append(textEl, cancelBtn);
    (document.body || document.documentElement).appendChild(banner);

    let highlightedEl = null;

    const clearHighlight = () => {
      if (highlightedEl) {
        highlightedEl.classList.remove('yk-ad-picker-highlight');
        highlightedEl = null;
      }
    };

    const stopPicker = () => {
      clearHighlight();
      banner.remove();
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      pickerCleanup = null;
    };

    const onMouseOver = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target === banner || banner.contains(target)) {
        clearHighlight();
        return;
      }
      if (target === document.documentElement || target === document.body) {
        clearHighlight();
        return;
      }
      if (highlightedEl !== target) {
        clearHighlight();
        highlightedEl = target;
        highlightedEl.classList.add('yk-ad-picker-highlight');
      }
    };

    const onClick = async (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target === cancelBtn) {
        event.preventDefault();
        event.stopPropagation();
        stopPicker();
        return;
      }
      if (target === banner || banner.contains(target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (isProtectedPlayerNode(target)) {
        textEl.textContent = '这是播放器核心元素，请直接点击暂停广告浮层（按 ESC 取消）';
        return;
      }

      const selector = buildCssSelector(target);
      stopPicker();

      if (!selector) return;

      const { customSelectors: saved = [] } = await chrome.storage.local.get('customSelectors');
      const nextSelectors = Array.isArray(saved) ? [...saved] : [];
      if (!nextSelectors.includes(selector)) {
        nextSelectors.push(selector);
        await chrome.storage.local.set({ customSelectors: nextSelectors });
      }
      customSelectors = nextSelectors;

      const newlyKilled = await batchHideElements([target]);
      if (newlyKilled > 0) {
        try {
          await chrome.runtime.sendMessage({
            type: 'PAUSE_AD_CLEARED',
            count: newlyKilled,
          });
        } catch {
          // Ignore messaging errors
        }
      }
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        stopPicker();
      }
    };

    cancelBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      stopPicker();
    });

    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    pickerCleanup = stopPicker;
  }

  /**
   * Apply enabled state to root element so CSS static rules toggle immediately.
   * @param {boolean} enabled
   */
  function syncDisabledAttribute(enabled) {
    if (enabled) {
      delete document.documentElement.dataset.ykAdKillerDisabled;
    } else {
      document.documentElement.dataset.ykAdKillerDisabled = 'true';
    }
  }

  /**
   * Schedule one RAF-throttled scan on DOM mutations.
   */
  function requestMutationScan() {
    if (!isEnabled || mutationRafId !== 0) return;
    mutationRafId = requestAnimationFrame(() => {
      mutationRafId = 0;
      void scanAndClearPauseAds();
    });
  }

  /**
   * Initialize listeners, observers, and stored settings.
   */
  async function init() {
    try {
      const stored = await chrome.storage.local.get(['enabled', 'customSelectors']);
      isEnabled = typeof stored.enabled === 'boolean' ? stored.enabled : true;
      customSelectors = Array.isArray(stored.customSelectors) ? stored.customSelectors : [];
    } catch {
      isEnabled = true;
      customSelectors = [];
    }

    syncDisabledAttribute(isEnabled);
    logDebug('插件已初始化，当前状态:', isEnabled ? '已启用' : '已暂停', 'URL:', location.href);

    document.addEventListener(
      'pause',
      (event) => {
        if (event.target instanceof HTMLVideoElement) {
          logDebug('检测到视频暂停事件，正在扫描暂停广告...');
          schedulePauseScanBurst();
          setTimeout(() => {
            inspectPlayerOverlays();
          }, 300);
        }
      },
      true
    );

    document.addEventListener(
      'play',
      (event) => {
        if (event.target instanceof HTMLVideoElement) {
          logDebug('检测到视频恢复播放');
          clearPauseScanBurst();
        }
      },
      true
    );

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;

      if (changes.enabled) {
        isEnabled = changes.enabled.newValue !== false;
        syncDisabledAttribute(isEnabled);
        if (isEnabled) {
          void scanAndClearPauseAds();
        } else {
          clearPauseScanBurst();
          void restoreHiddenElements(false);
        }
      }

      if (changes.customSelectors) {
        customSelectors = Array.isArray(changes.customSelectors.newValue)
          ? changes.customSelectors.newValue
          : [];
        (async () => {
          await restoreHiddenElements(true);
          if (isEnabled) {
            await scanAndClearPauseAds();
          }
        })();
      }
    });

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'START_PICKER') {
        (async () => {
          try {
            await startPickerMode();
            sendResponse({ ok: true });
          } catch (err) {
            sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
          }
        })();
        return true;
      }
      return false;
    });

    const observer = new MutationObserver((mutations) => {
      if (!isEnabled) return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            requestMutationScan();
            return;
          }
        }
      }
    });

    const observeTarget = document.documentElement;
    if (observeTarget) {
      observer.observe(observeTarget, { childList: true, subtree: true });
    }

    if (isEnabled) {
      if (document.readyState === 'loading') {
        document.addEventListener(
          'DOMContentLoaded',
          () => {
            void scanAndClearPauseAds();
          },
          { once: true }
        );
      } else {
        void scanAndClearPauseAds();
      }
    }
  }

  void init();
})();
