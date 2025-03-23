// biome-ignore lint/style/useImportType: React import type is not allowed
import React, { useState, useEffect } from "react";
import SettingsPanel from "./SettingsPanel";
import ContextPanel from "./ContextPanel";
import PasswordPrompt from "./PasswordPrompt";
import PasswordModal from "./PasswordModal";
import type { Settings } from "../../types";
import { ACTIONS, DEFAULT_SETTINGS } from "../../utils/constants";
import { verifyPassword } from "../../utils/cryptoUtils";
import { saveApiKey } from "../../utils/storageUtils";

const App: React.FC = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<"settings" | "context">(
    "settings",
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPasswordPromptOpen, setIsPasswordPromptOpen] =
    useState<boolean>(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>("");

  // Load settings when component mounts
  useEffect(() => {
    loadSettings();
  }, []);

  // Load settings from storage
  const loadSettings = async () => {
    try {
      const result = await chrome.storage.sync.get("scratchforms_settings");
      if (result.scratchforms_settings) {
        setSettings(result.scratchforms_settings);
      }
    } catch (err) {
      setError("Failed to load settings");
      console.error("Error loading settings:", err);
    }
  };

  const saveSettings = async (newSettings: Settings) => {
    setIsLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        action: ACTIONS.UPDATE_SETTINGS,
        settings: newSettings,
      });

      if (response.success) {
        setSettings(newSettings);
        setError(null);
      } else {
        setError(response.error || "Failed to save settings");
      }
    } catch (err) {
      setError("Failed to communicate with extension");
      console.error("Error saving settings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = <K extends keyof Settings>(
    key: K,
    value: Settings[K],
  ) => {
    // Special handling for API key updates to prompt for encryption password
    if (key === "apiKey") {
      setApiKeyInput(value as string);
      if (value && (value as string).trim() !== "") {
        setIsApiKeyModalOpen(true);
        return;
      }
    }

    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  // Start form filling process - ONLY when explicitly called
  const fillForms = async () => {
    setError(null);

    // Sempre precisamos da senha para preencher formulários
    setIsPasswordPromptOpen(true);
  };

  // Process the form filling with password
  const processFillForms = async (password: string) => {
    setIsLoading(true);

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab || !tab.id) {
        throw new Error(
          "No active tab found. Please make sure you're on a web page.",
        );
      }

      // Se temos um hash de senha salvo, verificamos se a senha é correta
      if (settings.contextPasswordHash) {
        if (!verifyPassword(password, settings.contextPasswordHash)) {
          throw new Error("Incorrect password. Please try again.");
        }
      }

      // Processa com a senha fornecida
      const response = await chrome.runtime.sendMessage({
        action: ACTIONS.FILL_FORMS_WITH_PASSWORD,
        password: password,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to fill forms");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error filling forms:", err);
    } finally {
      setIsLoading(false);
      setIsPasswordPromptOpen(false);
    }
  };

  // Handle API key encryption
  const handleApiKeySave = async (password: string) => {
    setIsLoading(true);

    try {
      // Store the API key with encryption
      await saveApiKey(apiKeyInput, password);

      // Reload settings to get the updated encrypted API key
      await loadSettings();
      setError(null);
    } catch (err) {
      setError("Failed to save API key");
      console.error("Error saving API key:", err);
    } finally {
      setIsLoading(false);
      setIsApiKeyModalOpen(false);
    }
  };

  // Handle password submit from prompt
  const handlePasswordSubmit = (password: string) => {
    processFillForms(password);
  };

  // Clear context data
  const clearContext = async () => {
    setIsLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        action: ACTIONS.CLEAR_CONTEXT,
      });

      if (response.success) {
        // Reload settings to get updated context data
        await loadSettings();
      } else {
        setError(response.error || "Failed to clear context");
      }
    } catch (err) {
      setError("Failed to clear context");
      console.error("Error clearing context:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Direct context update with encryption
  const handleContextUpdate = (data: string, password: string) => {
    // Set loading state while encrypting
    setIsLoading(true);

    // Encrypt and save the data
    (async () => {
      try {
        const { encryptText, hashPassword } = await import(
          "../../utils/cryptoUtils"
        );

        // Encrypt the context data
        const encryptedData = encryptText(data, password);

        // Create updated context data
        const newContextData = {
          ...settings.contextData,
          [settings.selectedFormat]: encryptedData,
        };

        // Prepare new settings with password hash if needed
        const newSettings = {
          ...settings,
          contextData: newContextData,
        };

        // If no password hash exists, create one
        if (!settings.contextPasswordHash) {
          newSettings.contextPasswordHash = hashPassword(password);
        }

        // Update local state immediately for responsive UI
        setSettings(newSettings);

        // Save to storage
        await chrome.storage.sync.set({
          scratchforms_settings: newSettings,
        });

        setError(null);
      } catch (err) {
        console.error("Error encrypting context:", err);
        setError("Failed to encrypt context data");
      } finally {
        setIsLoading(false);
      }
    })();
  };

  return (
    <div className="app">
      <header className="header">
        <h1>ScratchForms</h1>
        <div className="tabs">
          <button
            type="button"
            className={activeTab === "settings" ? "active" : ""}
            onClick={() => setActiveTab("settings")}
          >
            Settings
          </button>
          <button
            type="button"
            className={activeTab === "context" ? "active" : ""}
            onClick={() => setActiveTab("context")}
          >
            Context
          </button>
        </div>
      </header>

      {error && (
        <div className="error-message">
          {error}
          <button type="button" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}

      <main className="content">
        {activeTab === "settings" && (
          <SettingsPanel
            settings={settings}
            onUpdate={updateSetting}
            isLoading={isLoading}
          />
        )}

        {activeTab === "context" && (
          <ContextPanel
            contextData={settings.contextData}
            selectedFormat={settings.selectedFormat}
            onUpdateContext={handleContextUpdate}
            onSelectFormat={(format) => updateSetting("selectedFormat", format)}
            onClearContext={clearContext}
            isLoading={isLoading}
            contextPasswordHash={settings.contextPasswordHash || ""}
          />
        )}
      </main>

      <footer className="footer">
        <div className="action-buttons">
          {/* Explicit Fill Form button - the ONLY way to trigger form filling */}
          <button
            type="button"
            className="fill-forms-button"
            onClick={fillForms}
            disabled={isLoading || !settings.enabled || !settings.apiKey}
          >
            {isLoading ? "Processing..." : "Fill Forms"}
          </button>
        </div>
        <p>ScratchForms © 2025</p>
      </footer>

      {/* Password prompt for form filling */}
      <PasswordPrompt
        isOpen={isPasswordPromptOpen}
        onSubmit={handlePasswordSubmit}
        onCancel={() => setIsPasswordPromptOpen(false)}
      />

      {/* Password modal for API key encryption */}
      <PasswordModal
        isOpen={isApiKeyModalOpen}
        onSubmit={handleApiKeySave}
        onCancel={() => {
          setIsApiKeyModalOpen(false);
          // Reset API key input if canceled
          setApiKeyInput("");
        }}
        title="Encrypt API Key"
        message="Please enter a password to encrypt your API key. You'll need this password to use the API key for form filling."
      />
    </div>
  );
};

export default App;
