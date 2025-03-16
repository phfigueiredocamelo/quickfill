/**
 * Utility functions for Chrome messaging
 */

import { ACTIONS } from './constants';

/**
 * Sends a message to the active tab
 * @param {Object} message - The message to send
 * @returns {Promise} A promise that resolves with the response
 */
export function sendMessageToActiveTab(message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        reject(new Error('No active tab found'));
        return;
      }
      
      try {
        chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError.message);
            reject(new Error(chrome.runtime.lastError.message || 'Could not connect to page'));
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        console.error('Error sending message to tab:', error);
        reject(new Error('Could not connect to page'));
      }
    });
  });
}

/**
 * Updates extension settings and sends update to content script
 * @param {Object} settings - The settings to update
 * @returns {Promise} A promise that resolves when settings are updated
 */
export function updateSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, () => {
      sendMessageToActiveTab({
        action: ACTIONS.UPDATE_SETTINGS,
        settings
      }).then(resolve).catch(() => resolve());
    });
  });
}

/**
 * Fills forms in the active tab
 * @param {boolean} logToPopup - Whether to log to popup
 * @returns {Promise} A promise that resolves with the response
 */
export function fillForms(logToPopup = false) {
  return new Promise((resolve, reject) => {
    sendMessageToActiveTab({
      action: ACTIONS.FILL_FORMS,
      logToPopup
    }).then(response => {
      // Content script should handle response and return properly
      resolve(response);
    }).catch(error => {
      console.error('Error in fillForms:', error);
      reject(error);
    });
  });
}

/**
 * Clears the cache
 * @returns {Promise} A promise that resolves with the response
 */
export function clearCache() {
  return sendMessageToActiveTab({
    action: ACTIONS.CLEAR_CACHE
  });
}

/**
 * Gets cache statistics
 * @returns {Promise} A promise that resolves with the cache stats
 */
export function getCacheStats() {
  return sendMessageToActiveTab({
    action: ACTIONS.GET_CACHE_STATS
  });
}