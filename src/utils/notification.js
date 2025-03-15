import { STYLES, NOTIFICATION_DURATION } from './constants';

/**
 * Notification utility to display messages to the user.
 */
export class NotificationManager {
  static _instance = null;
  _notificationElement = null;
  _timeout = null;

  /**
   * Get the singleton instance
   */
  static getInstance() {
    if (!NotificationManager._instance) {
      NotificationManager._instance = new NotificationManager();
    }
    return NotificationManager._instance;
  }

  /**
   * Show a notification to the user
   * 
   * @param {string} message - The message to display
   * @param {string} type - The type of notification (info, success, error, warning)
   */
  show(message, type = 'info') {
    // Clear any existing timeout
    if (this._timeout) {
      clearTimeout(this._timeout);
    }

    // Create or get notification element
    if (!this._notificationElement) {
      this._notificationElement = document.createElement('div');
      this._notificationElement.className = 'quickfill-notification';
      document.body.appendChild(this._notificationElement);
    }

    // Apply base styles
    Object.assign(this._notificationElement.style, STYLES.NOTIFICATION.BASE);

    // Apply type-specific styles
    let typeStyles;
    switch (type) {
      case 'success':
        typeStyles = STYLES.NOTIFICATION.SUCCESS;
        break;
      case 'error':
        typeStyles = STYLES.NOTIFICATION.ERROR;
        break;
      case 'warning':
        typeStyles = STYLES.NOTIFICATION.WARNING;
        break;
      default: // info
        typeStyles = STYLES.NOTIFICATION.INFO;
        break;
    }
    Object.assign(this._notificationElement.style, typeStyles);

    // Set message and make visible
    this._notificationElement.textContent = message;
    this._notificationElement.style.opacity = '1';

    // Set timeout to hide
    this._timeout = setTimeout(() => {
      this._notificationElement.style.opacity = '0';
      this._timeout = setTimeout(() => {
        if (document.body.contains(this._notificationElement)) {
          document.body.removeChild(this._notificationElement);
          this._notificationElement = null;
        }
      }, 300);
    }, NOTIFICATION_DURATION);
  }

  /**
   * Show an info notification
   */
  info(message) {
    this.show(message, 'info');
  }

  /**
   * Show a success notification
   */
  success(message) {
    this.show(message, 'success');
  }

  /**
   * Show an error notification
   */
  error(message) {
    this.show(message, 'error');
  }

  /**
   * Show a warning notification
   */
  warning(message) {
    this.show(message, 'warning');
  }
}

export const showNotification = (message, type = 'info') => {
  NotificationManager.getInstance().show(message, type);
};