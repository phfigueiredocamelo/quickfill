import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
import './styles.css';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Find the root element
  const container = document.getElementById('root');
  
  if (container) {
    // Create React root and render app
    const root = createRoot(container);
    root.render(<App />);
  }
});