// biome-ignore lint/style/useImportType: React import type is not allowed
import React, { useState, useEffect } from "react";
import PasswordModal from "./PasswordModal";
import { verifyPassword } from "../../utils/cryptoUtils";

interface ContextPanelProps {
  contextData: string;
  onUpdateContext: (data: string, password: string) => void;
  onClearContext: () => void;
  isLoading: boolean;
  contextPasswordHash: string;
}

const ContextPanel: React.FC<ContextPanelProps> = ({
  contextData,
  onUpdateContext,
  onClearContext,
  isLoading,
  contextPasswordHash,
}) => {
  const [decryptedContent, setDecryptedContent] = useState<string>("");
  const [isPasswordModalOpen, setIsPasswordModalOpen] =
    useState<boolean>(false);
  const [isNewPassword, setIsNewPassword] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string>("");

  // Check if we need to request a password when the component mounts or when contextPasswordHash changes
  useEffect(() => {
    // Only open the password modal when context has data that needs unlocking
    // and the user isn't already unlocked
    if (contextPasswordHash && !isUnlocked) {
      // We have existing encrypted context, need to unlock
      setIsPasswordModalOpen(true);
      setIsNewPassword(false);
    } else if (!contextPasswordHash && !isUnlocked) {
      // First time setup, need to create a password
      setIsPasswordModalOpen(true);
      setIsNewPassword(true);
    }
  }, [contextPasswordHash, isUnlocked]);

  // Handle password submission
  const handlePasswordSubmit = async (password: string) => {
    // For creating a new password
    if (isNewPassword) {
      setCurrentPassword(password);
      setIsUnlocked(true);
      setIsPasswordModalOpen(false);
      // Create empty context with the new password
      onUpdateContext("", password);
    }
    // For verifying existing password
    else {
      // Verify against stored hash
      if (
        contextPasswordHash &&
        verifyPassword(password, contextPasswordHash)
      ) {
        setCurrentPassword(password);
        setIsUnlocked(true);
        setIsPasswordModalOpen(false);
        setPasswordError("");

        // Decrypt and show the context data for the current format
        try {
          const { decryptText } = await import("../../utils/cryptoUtils");
          const decrypted = decryptText(contextData, password);
          setDecryptedContent(decrypted);
        } catch (error) {
          console.error("Failed to decrypt context:", error);
          setPasswordError("Failed to decrypt context data.");
          setIsPasswordModalOpen(true);
        }
      } else {
        setPasswordError("Incorrect password. Please try again.");
        // Keep the modal open
        setIsPasswordModalOpen(true);
      }
    }
  };

  // Handle textarea content changes
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setDecryptedContent(newContent);

    // Only update context if we have a password
    if (currentPassword) {
      onUpdateContext(newContent, currentPassword);
    }
  };

  // Handle the clear context button
  const handleClearContext = () => {
    setIsUnlocked(false);
    setCurrentPassword("");
    setDecryptedContent("");
    onClearContext();
  };

  return (
    <div className="context-panel">
      <h2>User Context</h2>

      {isUnlocked ? (
        <>
          <div className="form-group">
            <label htmlFor="context-data">Context Data</label>
            <textarea
              id="context-data"
              value={decryptedContent}
              onChange={handleContentChange}
              placeholder={
                "Enter your user context data in any format you like. This will be used to fill forms automatically."
              }
              rows={10}
              disabled={isLoading}
            />
            <p className="info-text">
              This data will be used to fill forms. For best results, include
              personal information relevant to the forms you want to fill.
            </p>
          </div>

          <button
            type="button"
            className="danger-button"
            onClick={handleClearContext}
            disabled={isLoading}
          >
            Clear All Data
          </button>
        </>
      ) : (
        <div className="locked-context">
          <p>Your context data is protected with a password.</p>
          {passwordError && <p className="error-text">{passwordError}</p>}
          <div className="context-buttons">
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setIsNewPassword(false);
                setIsPasswordModalOpen(true);
              }}
              disabled={isLoading || !contextPasswordHash}
            >
              Unlock Context
            </button>
          </div>
        </div>
      )}

      <PasswordModal
        isOpen={isPasswordModalOpen}
        isNewPassword={isNewPassword}
        onSubmit={handlePasswordSubmit}
        onCancel={() => {
          setIsPasswordModalOpen(false);
          setIsUnlocked(true);
        }}
      />
    </div>
  );
};

export default ContextPanel;
