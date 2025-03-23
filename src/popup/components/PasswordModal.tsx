// biome-ignore lint/style/useImportType: React import type is not allowed
import React, { useState } from "react";

interface PasswordModalProps {
  isOpen: boolean;
  isNewPassword?: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
  title?: string;
  message?: string;
}

const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  isNewPassword = false,
  onSubmit,
  onCancel,
  title = isNewPassword ? "Create Password" : "Enter Password",
  message,
}) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validação para nova senha
    if (isNewPassword) {
      if (password.length < 6) {
        setError("Password must be at least 6 characters long");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    onSubmit(password);
    setPassword("");
    setConfirmPassword("");
    setError("");
  };

  return (
    <div className="password-modal-overlay">
      <div className="password-modal">
        <h3>{title}</h3>
        {message && <p className="modal-message">{message}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">
              {isNewPassword ? "New Password" : "Password"}
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </div>

          {isNewPassword && (
            <div className="form-group">
              <label htmlFor="confirm-password">Confirm Password</label>
              <input
                type="password"
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
              />
            </div>
          )}

          {error && <p className="error-text">{error}</p>}

          <div className="modal-buttons">
            <button
              type="button"
              onClick={() => {
                onCancel();
                setPassword("");
                setConfirmPassword("");
                setError("");
              }}
              className="secondary-button"
            >
              Cancel
            </button>
            <button type="submit" className="primary-button">
              {isNewPassword ? "Create" : "Unlock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordModal;
