// KG Studio — Browser Extension Manifest V3 Service Worker
/* global chrome */

chrome.runtime.onInstalled.addListener(() => {
  // Enable opening side panel if supported
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }

  // Create context menus for rapid operational workflows from any webpage
  if (chrome.contextMenus) {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'kg_studio_qr_selection',
        title: '⚡ Tạo mã VietQR với số tiền "%s"',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: 'kg_studio_tts_selection',
        title: '🔊 Phát thanh AI (TTS) đoạn văn bản "%s"',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: 'kg_studio_open_sidepanel',
        title: '🧩 Mở KG Studio ở Thanh Bên (Side Panel)',
        contexts: ['all']
      });

      chrome.contextMenus.create({
        id: 'kg_studio_open_webapp',
        title: '🚀 Mở KG Studio toàn màn hình (Webapp)',
        contexts: ['all']
      });
    });
  }
});

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  const rawSelection = (info.selectionText || '').trim();

  if (info.menuItemId === 'kg_studio_qr_selection') {
    const digits = rawSelection.replace(/\D/g, '');
    const targetUrl = chrome.runtime.getURL(
      `index.html?tab=qr&amount=${encodeURIComponent(digits || '0')}&desc=${encodeURIComponent(rawSelection.slice(0, 40))}`
    );
    chrome.tabs.create({ url: targetUrl });
  } else if (info.menuItemId === 'kg_studio_tts_selection') {
    const targetUrl = chrome.runtime.getURL(
      `index.html?tab=tts&text=${encodeURIComponent(rawSelection)}`
    );
    chrome.tabs.create({ url: targetUrl });
  } else if (info.menuItemId === 'kg_studio_open_sidepanel') {
    if (chrome.sidePanel && tab?.windowId) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {
        chrome.tabs.create({ url: chrome.runtime.getURL('index.html?mode=extension&view=sidepanel') });
      });
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL('index.html?mode=extension&view=sidepanel') });
    }
  } else if (info.menuItemId === 'kg_studio_open_webapp') {
    chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
  }
});

chrome.commands?.onCommand.addListener((command, tab) => {
  if (command === 'open_side_panel' && chrome.sidePanel && tab?.windowId) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  }
});
