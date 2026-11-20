// ==UserScript==
// @name         优酷视频暂停广告清除器 (Youku Pause Ad Killer)
// @namespace    https://github.com/wxyhaha/web-video-clean-overlay
// @version      1.0.2
// @description  专为优酷 VIP 用户打造，在视频暂停时自动清除大幅广告/推荐浮层，并修复因暂停画面缩小引发的黑屏问题
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

    // 1. 全局最强静态规则注入（包含防止视频画面被缩小成 158x84 导致黑屏的修复）
    const cssRules = `
        .youku-film-player video,
        .h5player video,
        .ykplayer video,
        #ykPlayer video,
        #player video,
        video.h5-ext-layer-video {
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            max-height: 100% !important;
            object-fit: contain !important;
        }

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
        div[class*="ad-pause"] {
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

    function injectStyle() {
        if (typeof GM_addStyle !== 'undefined') {
            GM_addStyle(cssRules);
        } else {
            const style = document.createElement('style');
            style.textContent = cssRules;
            (document.head || document.documentElement).appendChild(style);
        }
    }
    injectStyle();

    // 2. 毫秒级高频扫描与自动关闭
    const AD_SELECTORS = [
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

    function killAds() {
        // 还原被暂停恶意缩小的 video 尺寸
        document.querySelectorAll('video').forEach(v => {
            if (v.offsetWidth > 0 && v.offsetWidth < 300) {
                v.style.setProperty('width', '100%', 'important');
                v.style.setProperty('height', '100%', 'important');
                v.style.setProperty('object-fit', 'contain', 'important');
                if (v.parentElement && v.parentElement.offsetWidth < 300) {
                    v.parentElement.style.setProperty('width', '100%', 'important');
                    v.parentElement.style.setProperty('height', '100%', 'important');
                }
            }
        });

        for (const sel of AD_SELECTORS) {
            document.querySelectorAll(sel).forEach(el => {
                const closeBtn = el.querySelector('[class*="close" i], [title*="关闭"]');
                if (closeBtn && typeof closeBtn.click === 'function') {
                    try { closeBtn.click(); } catch (e) {}
                }
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('width', '0px', 'important');
                el.style.setProperty('height', '0px', 'important');
            });
        }
    }

    // 3. 轮询兜底与事件监听
    setInterval(killAds, 250);

    document.addEventListener('pause', () => {
        killAds();
        [50, 150, 300, 600, 1000].forEach(t => setTimeout(killAds, t));
    }, true);

    const observer = new MutationObserver(() => killAds());
    if (document.documentElement) {
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }
})();
