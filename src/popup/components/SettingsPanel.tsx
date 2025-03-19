import React from 'react';
import { Settings, GPTModel } from '../../types';
import { AVAILABLE_MODELS } from '../../utils/constants';
import { verifyPassword as verifyPasswordUtil } from '../../utils/storageUtils';

interface SettingsPanelProps {
  settings: Settings;
  onUpdate: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  isLoading: boolean;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  settings, 
  onUpdate,
  isLoading 
}) => {
  return (
    <div className="settings-panel">
      <h2>Settings</h2>
      
      <div className="form-group">
        <label>
          <input 
            type="checkbox" 
            checked={settings.enabled} 
            onChange={(e) => onUpdate('enabled', e.target.checked)}
            disabled={isLoading}
          />
          Enable QuickFill
        </label>
      </div>
      
      <div className="form-group">
        <label htmlFor="api-key">OpenAI API Key</label>
        <input 
          type="password"
          id="api-key"
          value={settings.apiKey} 
          onChange={(e) => onUpdate('apiKey', e.target.value)}
          placeholder="Enter your OpenAI API key"
          disabled={isLoading}
        />
        <p className="info-text">Your API key is stored locally and never shared.</p>
      </div>

      <div className="form-group">
        <label htmlFor="model-select">GPT Model</label>
        <select
          id="model-select"
          value={settings.selectedModel}
          onChange={(e) => onUpdate('selectedModel', e.target.value as GPTModel)}
          disabled={isLoading}
        >
          {AVAILABLE_MODELS.map(model => (
            <option key={model} value={model}>{model}</option>
          ))}
        </select>
        <p className="info-text">Select the GPT model to use for form filling.</p>
      </div>
      
      <div className="status">
        <p>
          <strong>Status:</strong> {settings.enabled ? 'Enabled' : 'Disabled'}
        </p>
        <p>
          <strong>API Key:</strong> {settings.apiKey ? 'Set' : 'Not set'}
        </p>
      </div>
    </div>
  );
};

export default SettingsPanel;