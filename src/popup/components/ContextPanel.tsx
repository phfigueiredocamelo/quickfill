import React from 'react';
import { ContextFormat } from '../../types';

interface ContextPanelProps {
  contextData: Record<ContextFormat, string>;
  selectedFormat: ContextFormat;
  onUpdateContext: (data: string) => void;
  onSelectFormat: (format: ContextFormat) => void;
  onClearContext: () => void;
  isLoading: boolean;
}

const ContextPanel: React.FC<ContextPanelProps> = ({
  contextData,
  selectedFormat,
  onUpdateContext,
  onSelectFormat,
  onClearContext,
  isLoading
}) => {
  const formatOptions: ContextFormat[] = ['json', 'txt', 'csv', 'xml'];
  
  return (
    <div className="context-panel">
      <h2>User Context</h2>
      
      <div className="form-group">
        <label htmlFor="format-select">Format</label>
        <select
          id="format-select"
          value={selectedFormat}
          onChange={(e) => onSelectFormat(e.target.value as ContextFormat)}
          disabled={isLoading}
        >
          {formatOptions.map(format => (
            <option key={format} value={format}>{format.toUpperCase()}</option>
          ))}
        </select>
      </div>
      
      <div className="form-group">
        <label htmlFor="context-data">Context Data</label>
        <textarea
          id="context-data"
          value={contextData[selectedFormat]}
          onChange={(e) => onUpdateContext(e.target.value)}
          placeholder={`Enter your user context data in ${selectedFormat.toUpperCase()} format`}
          rows={10}
          disabled={isLoading}
        />
        <p className="info-text">
          This data will be used to fill forms. For best results, include personal information
          relevant to the forms you want to fill.
        </p>
      </div>
      
      <button
        className="danger-button"
        onClick={onClearContext}
        disabled={isLoading || Object.values(contextData).every(data => !data)}
      >
        Clear All Context Data
      </button>
    </div>
  );
};

export default ContextPanel;