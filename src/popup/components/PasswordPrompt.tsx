// biome-ignore lint/style/useImportType: React import type is not allowed
import React, { useState } from "react";

interface PasswordPromptProps {
  isOpen: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

const PasswordPrompt: React.FC<PasswordPromptProps> = ({
  isOpen,
  onSubmit,
  onCancel,
}) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      setError("Password is required");
      return;
    }

    onSubmit(password);
    setPassword("");
    setError("");
  };

  const handleCancel = () => {
    setPassword("");
    setError("");
    onCancel();
  };

  return (
    <div className="password-modal-overlay">
      <div className="password-modal">
        <h3>Enter Password</h3>
        <p>
          Your context is password protected. Please enter your password to fill
          forms.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="modal-buttons">
            <button
              type="button"
              onClick={handleCancel}
              className="secondary-button"
            >
              Cancel
            </button>
            <button type="submit" className="primary-button">
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordPrompt;
