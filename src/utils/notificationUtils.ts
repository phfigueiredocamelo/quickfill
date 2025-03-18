/**
 * Utility functions for displaying notifications
 */

/**
 * Notification type
 */
export type NotificationType = 'success' | 'error' | 'info' | 'warning';

/**
 * CSS styles for notifications
 */
const NOTIFICATION_STYLES = {
  container: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: '9999',
    padding: '12px 20px',
    borderRadius: '4px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
    fontFamily: 'Arial, sans-serif',
    fontSize: '14px',
    maxWidth: '300px',
    transition: 'opacity 0.3s ease'
  },
  success: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    border: '1px solid #a5d6a7'
  },
  error: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    border: '1px solid #ef9a9a'
  },
  info: {
    backgroundColor: '#e3f2fd',
    color: '#0d47a1',
    border: '1px solid #90caf9'
  },
  warning: {
    backgroundColor: '#fff8e1',
    color: '#f57f17',
    border: '1px solid #ffe082'
  }
};

/**
 * Show a notification to the user
 * @param message Message to display
 * @param type Type of notification
 * @param duration Duration in milliseconds
 */
export const showNotification = (
  message: string,
  type: NotificationType = 'info',
  duration: number = 3000
): void => {
  // Create notification element
  const notification = document.createElement('div');
  
  // Apply container styles
  Object.entries(NOTIFICATION_STYLES.container).forEach(([key, value]) => {
    notification.style[key as any] = value;
  });
  
  // Apply type-specific styles
  Object.entries(NOTIFICATION_STYLES[type]).forEach(([key, value]) => {
    notification.style[key as any] = value;
  });
  
  // Set message
  notification.textContent = message;
  
  // Add to document
  document.body.appendChild(notification);
  
  // Remove after duration
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300); // Transition duration
  }, duration);
};