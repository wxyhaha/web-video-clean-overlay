'use strict';

const DEFAULT_STORAGE = {
  enabled: true,
  clearedCount: 0,
  customSelectors: [],
};

const BADGE_COLOR = '#0066ff';

/**
 * Initialize default extension settings on install or update.
 */
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const existing = await chrome.storage.local.get(Object.keys(DEFAULT_STORAGE));
    const updates = {};

    if (typeof existing.enabled !== 'boolean') {
      updates.enabled = DEFAULT_STORAGE.enabled;
    }
    if (typeof existing.clearedCount !== 'number' || !Number.isFinite(existing.clearedCount)) {
      updates.clearedCount = DEFAULT_STORAGE.clearedCount;
    }
    if (!Array.isArray(existing.customSelectors)) {
      updates.customSelectors = DEFAULT_STORAGE.customSelectors;
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }
  } catch (err) {
    console.error('[Kill Youku Pause Ad] Failed to initialize storage:', err);
  }
});

/**
 * Update global cleared counter and per-tab badge text when pause ads are hidden.
 * @param {number} increment
 * @param {number | undefined} tabId
 */
async function handlePauseAdCleared(increment, tabId) {
  const safeIncrement =
    typeof increment === 'number' && Number.isFinite(increment) && increment > 0
      ? Math.floor(increment)
      : 1;

  const { clearedCount = 0 } = await chrome.storage.local.get('clearedCount');
  const nextTotal = clearedCount + safeIncrement;
  await chrome.storage.local.set({ clearedCount: nextTotal });

  if (typeof tabId === 'number') {
    const currentBadge = await chrome.action.getBadgeText({ tabId });
    const prevTabCount = Number.parseInt(currentBadge || '0', 10) || 0;
    const newTabCount = prevTabCount + safeIncrement;

    await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
    await chrome.action.setBadgeText({ tabId, text: String(newTabCount) });
  }

  return nextTotal;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'PAUSE_AD_CLEARED') {
    return false;
  }

  (async () => {
    try {
      const clearedCount = await handlePauseAdCleared(message.count, sender.tab?.id);
      sendResponse({ ok: true, clearedCount });
    } catch (err) {
      console.error('[Kill Youku Pause Ad] Failed to record cleared ad:', err);
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  })();

  return true;
});
