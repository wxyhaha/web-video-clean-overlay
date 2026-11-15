// ==UserScript==
// @name         优酷视频暂停广告清除器 (Youku Pause Ad Killer)
// @namespace    https://github.com/wxyhaha/web-video-clean-overlay
// @version      1.0.0
// @description  专为优酷 VIP 用户打造，在视频暂停时自动清除大幅广告/推荐浮层，不影响正常播放、字幕与点击恢复
// @author       wxyhaha
// @match        *://*.youku.com/*
// @grant        GM_addStyle
// @run-at       document-start
// @license      MIT
// @homepageURL  https://github.com/wxyhaha/web-video-clean-overlay
// @supportURL   https://github.com/wxyhaha/web-video-clean-overlay/issues
// ==/UserScript==

(function() {
    'use strict';

    // 1. 静态样式层：在页面加载早期注入，毫秒级隐式消除，杜绝广告闪烁
    const cssRules = `
        #click-close,
        .ad-effect,
        .ad-effect-details,
        div[class*="ad-effect"],
        div.ad-button,
        #youku-pause-resource-container,
        .advertise-layer,
        .youku-advertise-layer,
        .advertise-youku-tips,
        #youku-pause-container,
        div.callEnd_box,
        div.callEnd_fixed_box,
        div[sourcetype*="Sbanner"],
        .youku-player-paused-overlay,
        .youku-player-pause-ad,
        .p-layer-pause-wrap,
        .yk-pause-layer,
        .h5player-paused-content,
        div[class*="pause-ad"],
        div[class*="ad-pause"],
        div[class*="pauseAd"],
        div[class*="PauseAd"],
        div[class*="pause_ad"],
        div[id*="pause-ad"],
        div[id*="pause_ad"],
        .h5-ext-layer div[class*="pause"],
        .h5-ext-layer div[class*="ad-"],
        .h5-ext-layer div[class*="-ad"],
        .yk-pause-ad-killed {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
            z-index: -9999 !important;
        }
    `;

    if (typeof GM_addStyle !== 'undefined') {
        GM_addStyle(cssRules);
    } else {
        const style = document.createElement('style');
        style.textContent = cssRules;
        (document.head || document.documentElement).appendChild(style);
    }

    // 2. 动态扫描与自动关闭逻辑
    const CLOSE_TEXTS = new Set(['×', '✕', '✖', 'X', '关闭', '关闭广告', '跳过', '跳过广告']);
    const STATIC_SELECTORS = [
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
        'div[sourcetype*="Sbanner"]'
    ];

    function findCloseButton(el) {
        const directClose = el.querySelector('[class*="close" i], [id*="close" i], [aria-label*="关闭"], [title*="关闭"]');
        if (directClose) return directClose;

        for (const node of el.querySelectorAll('button, a, span, div, i, em, svg')) {
            const text = (node.textContent || '').trim();
            if (CLOSE_TEXTS.has(text) || CLOSE_TEXTS.has(text.toUpperCase())) {
                return node;
            }
        }
        return null;
    }

    function killPauseAds() {
        for (const selector of STATIC_SELECTORS) {
            document.querySelectorAll(selector).forEach(el => {
                if (el.dataset.ykKilled === '1') return;

                // 尝试模拟点击其关闭按钮
                const closeBtn = findCloseButton(el);
                if (closeBtn && typeof closeBtn.click === 'function') {
                    try { closeBtn.click(); } catch(e) {}
                }

                // 强制隐藏并标记
                el.classList.add('yk-pause-ad-killed');
                el.style.setProperty('display', 'none', 'important');
                el.dataset.ykKilled = '1';
            });
        }
    }

    // 3. 监听视频暂停事件与 DOM 变化
    document.addEventListener('pause', (e) => {
        if (e.target instanceof HTMLVideoElement) {
            killPauseAds();
            [80, 200, 500, 1000].forEach(delay => setTimeout(killPauseAds, delay));
        }
    }, true);

    const observer = new MutationObserver(() => killPauseAds());
    const startObserver = () => {
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
    } else {
        startObserver();
    }
})();
