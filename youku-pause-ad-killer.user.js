// ==UserScript==
// @name         优酷视频暂停广告清除器 (Youku Pause Ad Killer)
// @namespace    https://github.com/wxyhaha/web-video-clean-overlay
// @version      1.1.0
// @description  专为优酷 VIP 用户打造，在视频暂停时自动清除大幅广告/推荐浮层，修复暂停黑屏，并支持鼠标前进/后退侧键自定义秒数快进快退
// @author       wxyhaha
// @match        *://*.youku.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// @license      MIT
// @homepageURL  https://github.com/wxyhaha/web-video-clean-overlay
// @supportURL   https://github.com/wxyhaha/web-video-clean-overlay/issues
// ==/UserScript==

(function() {
    'use strict';

    // 默认鼠标步进秒数（可通过油猴菜单自定义）
    let mouseSeekStep = (typeof GM_getValue !== 'undefined') ? GM_getValue('mouseSeekStep', 5) : 5;
    let enableMouseSeek = (typeof GM_getValue !== 'undefined') ? GM_getValue('enableMouseSeek', true) : true;

    if (typeof GM_registerMenuCommand !== 'undefined') {
        GM_registerMenuCommand(`⚙️ 设置快进/快退步长 (当前: ${mouseSeekStep}秒)`, () => {
            const input = prompt('请输入鼠标侧键前进/后退的快进步长（秒）：', mouseSeekStep);
            if (input !== null) {
                const step = parseInt(input, 10);
                if (!isNaN(step) && step > 0 && step <= 60) {
                    mouseSeekStep = step;
                    GM_setValue('mouseSeekStep', step);
                    alert(`✅ 已成功将步长修改为 ${step} 秒！`);
                } else {
                    alert('❌ 请输入 1 到 60 之间的整数秒数');
                }
            }
        });
        GM_registerMenuCommand(`🖱️ 切换鼠标侧键控制进度 (当前: ${enableMouseSeek ? '已启用' : '已禁用'})`, () => {
            enableMouseSeek = !enableMouseSeek;
            GM_setValue('enableMouseSeek', enableMouseSeek);
            alert(`已${enableMouseSeek ? '启用' : '禁用'}鼠标侧键快进快退功能`);
        });
    }

    // 1. 全局最强静态规则注入（包含防止视频画面被缩小成 158x84 导致黑屏的修复）
    const cssRules = `
        /* 鼠标控制进度提示气泡 */
        .yk-seek-tooltip {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            z-index: 2147483647 !important;
            background: rgba(15, 23, 42, 0.88) !important;
            color: #ffffff !important;
            padding: 12px 24px !important;
            border-radius: 12px !important;
            font-family: system-ui, -apple-system, sans-serif !important;
            font-size: 18px !important;
            font-weight: 700 !important;
            border: 1px solid rgba(255, 255, 255, 0.2) !important;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4) !important;
            pointer-events: none !important;
            opacity: 0;
            transition: opacity 0.2s ease, transform 0.2s ease !important;
        }
        .yk-seek-tooltip.show {
            opacity: 1 !important;
            transform: translate(-50%, -50%) scale(1.05) !important;
        }

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

    if (typeof GM_addStyle !== 'undefined') {
        GM_addStyle(cssRules);
    } else {
        const style = document.createElement('style');
        style.textContent = cssRules;
        (document.head || document.documentElement).appendChild(style);
    }

    // 2. 鼠标侧键快进/快退提示与控制
    let tooltipEl = null;
    let tooltipTimer = null;
    function showSeekTooltip(text) {
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.className = 'yk-seek-tooltip';
            (document.body || document.documentElement).appendChild(tooltipEl);
        }
        tooltipEl.textContent = text;
        tooltipEl.classList.add('show');
        clearTimeout(tooltipTimer);
        tooltipTimer = setTimeout(() => {
            if (tooltipEl) tooltipEl.classList.remove('show');
        }, 800);
    }

    function formatTime(sec) {
        const s = Math.floor(sec || 0);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        const mm = String(m % 60).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
    }

    function handleMouseSeek(direction) {
        const video = document.querySelector('video');
        if (!video || isNaN(video.duration)) return false;

        const delta = direction * (mouseSeekStep || 5);
        const targetTime = Math.max(0, Math.min(video.duration, video.currentTime + delta));
        video.currentTime = targetTime;

        const sign = direction > 0 ? '⏩ 快进' : '⏪ 快退';
        showSeekTooltip(`${sign} ${Math.abs(delta)}秒 (${formatTime(targetTime)} / ${formatTime(video.duration)})`);
        return true;
    }

    // 全生命周期拦截键盘左右方向键（封死 keydown, keyup, keypress，防止优酷双重触发）
    const isArrowKey = (e) => (
        e.key === 'ArrowLeft' || e.code === 'ArrowLeft' || e.keyCode === 37 ||
        e.key === 'ArrowRight' || e.code === 'ArrowRight' || e.keyCode === 39
    );

    const isInputFocused = () => {
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        return activeTag === 'INPUT' || activeTag === 'TEXTAREA' || Boolean(document.activeElement?.isContentEditable);
    };

    const handleKeydownCapture = (e) => {
        if (!enableMouseSeek || isInputFocused() || !isArrowKey(e)) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (e.key === 'ArrowLeft' || e.code === 'ArrowLeft' || e.keyCode === 37) {
            handleMouseSeek(-1);
        } else {
            handleMouseSeek(1);
        }
    };

    const preventArrowLeak = (e) => {
        if (!enableMouseSeek || isInputFocused() || !isArrowKey(e)) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    };

    window.addEventListener('keydown', handleKeydownCapture, true);
    document.addEventListener('keydown', handleKeydownCapture, true);
    window.addEventListener('keyup', preventArrowLeak, true);
    document.addEventListener('keyup', preventArrowLeak, true);
    window.addEventListener('keypress', preventArrowLeak, true);
    document.addEventListener('keypress', preventArrowLeak, true);

    window.addEventListener('mouseup', (e) => {
        if (!enableMouseSeek) return;
        if (e.button === 3 || e.button === 4) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            const dir = e.button === 4 ? 1 : -1;
            handleMouseSeek(dir);
        }
    }, true);

    window.addEventListener('mousedown', (e) => {
        if (!enableMouseSeek) return;
        if (e.button === 3 || e.button === 4) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    }, true);

    // 3. 毫秒级高频扫描与自动关闭
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

    // 4. 轮询兜底与事件监听
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
