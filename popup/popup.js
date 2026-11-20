'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const enableSwitch = document.getElementById('enable-switch');
  const mouseSeekSwitch = document.getElementById('mouse-seek-switch');
  const seekStepInput = document.getElementById('seek-step-input');
  const statusBadge = document.getElementById('status-badge');
  const clearedCountEl = document.getElementById('cleared-count');
  const customCountEl = document.getElementById('custom-count');
  const pickBtn = document.getElementById('pick-btn');
  const resetRulesBtn = document.getElementById('reset-rules-btn');
  const feedbackEl = document.getElementById('feedback');

  function setFeedback(message) {
    feedbackEl.textContent = message;
  }

  function renderState({ enabled, clearedCount, customSelectors, enableMouseSeek, mouseSeekStep }) {
    const isOn = enabled !== false;
    enableSwitch.checked = isOn;

    const isSeekOn = enableMouseSeek !== false;
    mouseSeekSwitch.checked = isSeekOn;
    seekStepInput.value = (typeof mouseSeekStep === 'number' && mouseSeekStep > 0) ? mouseSeekStep : 5;
    seekStepInput.disabled = !isSeekOn;

    statusBadge.textContent = isOn ? '运行中' : '已暂停';
    statusBadge.classList.toggle('status-on', isOn);
    statusBadge.classList.toggle('status-off', !isOn);

    clearedCountEl.textContent = String(
      typeof clearedCount === 'number' && Number.isFinite(clearedCount) ? clearedCount : 0
    );

    const ruleCount = Array.isArray(customSelectors) ? customSelectors.length : 0;
    customCountEl.textContent = String(ruleCount);
    resetRulesBtn.disabled = ruleCount === 0;
  }

  function isYoukuUrl(url) {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        (parsed.hostname === 'youku.com' || parsed.hostname.endsWith('.youku.com'))
      );
    } catch {
      return false;
    }
  }

  async function loadAndRender() {
    try {
      const data = await chrome.storage.local.get([
        'enabled',
        'clearedCount',
        'customSelectors',
        'enableMouseSeek',
        'mouseSeekStep',
      ]);
      renderState(data);
    } catch (err) {
      console.error('[Kill Youku Pause Ad] Failed to load settings:', err);
      setFeedback('读取设置失败，请重试');
    }
  }

  mouseSeekSwitch.addEventListener('change', async (event) => {
    const nextVal = Boolean(event.target.checked);
    seekStepInput.disabled = !nextVal;
    try {
      await chrome.storage.local.set({ enableMouseSeek: nextVal });
      setFeedback(nextVal ? '已开启鼠标前进/后退键控制进度' : '已关闭鼠标控制进度');
    } catch (err) {
      console.error(err);
      setFeedback('保存设置失败');
    }
  });

  seekStepInput.addEventListener('change', async (event) => {
    let step = parseInt(event.target.value, 10);
    if (isNaN(step) || step < 1) step = 1;
    if (step > 60) step = 60;
    event.target.value = step;
    try {
      await chrome.storage.local.set({ mouseSeekStep: step });
      setFeedback(`步进已更新为 ${step} 秒`);
    } catch (err) {
      console.error(err);
      setFeedback('保存步进秒数失败');
    }
  });

  enableSwitch.addEventListener('change', async (event) => {
    const nextEnabled = Boolean(event.target.checked);
    try {
      await chrome.storage.local.set({ enabled: nextEnabled });
      const data = await chrome.storage.local.get([
        'enabled',
        'clearedCount',
        'customSelectors',
      ]);
      renderState(data);
      setFeedback(nextEnabled ? '已开启暂停广告自动清除' : '已暂停清除功能');
    } catch (err) {
      console.error('[Kill Youku Pause Ad] Failed to update enabled state:', err);
      setFeedback('保存开关状态失败');
    }
  });

  pickBtn.addEventListener('click', async () => {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id || !isYoukuUrl(activeTab.url)) {
        setFeedback('请先打开优酷视频播放页面 (youku.com)');
        return;
      }

      const response = await chrome.tabs.sendMessage(activeTab.id, { type: 'START_PICKER' });
      if (response?.ok) {
        window.close();
      } else {
        setFeedback('启动点选模式失败，请刷新优酷页面后重试');
      }
    } catch (err) {
      console.error('[Kill Youku Pause Ad] Failed to start picker:', err);
      setFeedback('无法连接当前页面，请刷新优酷标签页后重试');
    }
  });

  resetRulesBtn.addEventListener('click', async () => {
    try {
      await chrome.storage.local.set({ customSelectors: [] });
      const data = await chrome.storage.local.get([
        'enabled',
        'clearedCount',
        'customSelectors',
      ]);
      renderState(data);
      setFeedback('已清空全部自定义屏蔽规则');
    } catch (err) {
      console.error('[Kill Youku Pause Ad] Failed to reset rules:', err);
      setFeedback('重置规则失败');
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.enabled || changes.clearedCount || changes.customSelectors || changes.enableMouseSeek || changes.mouseSeekStep) {
      void loadAndRender();
    }
  });

  await loadAndRender();
});
