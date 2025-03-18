import React, { useState, useEffect } from 'react';
import SettingsPanel from './SettingsPanel';
import ContextPanel from './ContextPanel';
import LogPanel from './LogPanel';
import { Settings, LogEntry } from '../../types';
import { ACTIONS, DEFAULT_SETTINGS } from '../../utils/constants';

// Main App component
const App: React.FC = () => {
  // State
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'settings' | 'context' | 'logs'>('settings');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load settings when component mounts
  useEffect(() => {
    loadSettings();
    loadLogs();
  }, []);

  // Load settings from storage
  const loadSettings = async () => {
    try {
      const result = await chrome.storage.sync.get('quickfill_settings');
      if (result.quickfill_settings) {
        setSettings(result.quickfill_settings);
      }
    } catch (err) {
      setError('Failed to load settings');
      console.error('Error loading settings:', err);
    }
  };

  // Load logs from storage
  const loadLogs = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: ACTIONS.GET_LOGS
      });
      
      if (response.success && response.logs) {
        setLogs(response.logs);
      }
    } catch (err) {
      console.error('Error loading logs:', err);
    }
  };

  // Save settings to storage WITHOUT triggering form fill
  const saveSettings = async (newSettings: Settings) => {
    setIsLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        action: ACTIONS.UPDATE_SETTINGS,
        settings: newSettings
      });
      
      if (response.success) {
        setSettings(newSettings);
        setError(null);
      } else {
        setError(response.error || 'Failed to save settings');
      }
    } catch (err) {
      setError('Failed to communicate with extension');
      console.error('Error saving settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Update a single setting WITHOUT triggering form fill
  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  // Start form filling process - ONLY when explicitly called
  const fillForms = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.id) {
        throw new Error('No active tab found');
      }
      
      // This is the ONLY place where we should be sending FILL_FORMS action
      const response = await chrome.runtime.sendMessage({
        action: ACTIONS.FILL_FORMS
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fill forms');
      }
      
      // Reload logs to show the new entry
      await loadLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error filling forms:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear context data
  const clearContext = async () => {
    setIsLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        action: ACTIONS.CLEAR_CONTEXT
      });
      
      if (response.success) {
        // Reload settings to get updated context data
        await loadSettings();
      } else {
        setError(response.error || 'Failed to clear context');
      }
    } catch (err) {
      setError('Failed to clear context');
      console.error('Error clearing context:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Clear logs
  const clearLogs = async () => {
    setIsLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        action: ACTIONS.CLEAR_LOGS
      });
      
      if (response.success) {
        setLogs([]);
      } else {
        setError(response.error || 'Failed to clear logs');
      }
    } catch (err) {
      setError('Failed to clear logs');
      console.error('Error clearing logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>QuickFill V2</h1>
        <div className="tabs">
          <button 
            className={activeTab === 'settings' ? 'active' : ''} 
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
          <button 
            className={activeTab === 'context' ? 'active' : ''} 
            onClick={() => setActiveTab('context')}
          >
            Context
          </button>
          <button 
            className={activeTab === 'logs' ? 'active' : ''} 
            onClick={() => setActiveTab('logs')}
          >
            Logs
          </button>
        </div>
      </header>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <main className="content">
        {activeTab === 'settings' && (
          <SettingsPanel 
            settings={settings} 
            onUpdate={updateSetting} 
            isLoading={isLoading}
          />
        )}

        {activeTab === 'context' && (
          <ContextPanel 
            contextData={settings.contextData}
            selectedFormat={settings.selectedFormat}
            onUpdateContext={(data) => updateSetting('contextData', {
              ...settings.contextData,
              [settings.selectedFormat]: data
            })}
            onSelectFormat={(format) => updateSetting('selectedFormat', format)}
            onClearContext={clearContext}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'logs' && (
          <LogPanel 
            logs={logs} 
            onClearLogs={clearLogs}
            isLoading={isLoading}
          />
        )}
      </main>

      <footer className="footer">
        <div className="action-buttons">
          {/* Explicit Fill Form button - the ONLY way to trigger form filling */}
          <button 
            className="fill-forms-button"
            onClick={fillForms}
            disabled={isLoading || !settings.enabled || !settings.apiKey}
          >
            {isLoading ? 'Processing...' : 'Fill Forms'}
          </button>
        </div>
        <p>QuickFill V2 © 2025</p>
      </footer>
    </div>
  );
};

export default App;