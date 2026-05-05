import React, { useState } from 'react';
import alignedLightLogo from '../assets/alignedLightLogo.svg';
import alignedDarkLogo  from '../assets/alignedDarkLogo.svg';

const LoginPage = ({ isDark, onLogin, error }) => {
  const [loading, setLoading] = useState(false);
  const logo = isDark ? alignedDarkLogo : alignedLightLogo;

  const handleLogin = async () => {
    setLoading(true);
    try {
      await onLogin();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        <img src={logo} alt="Aligned Automation" className="login-logo" draggable={false} />

        <div className="login-app-badge">
          <span className="login-app-name">AURA</span>
          <span className="login-app-version">v1.0</span>
        </div>

        <p className="login-subtitle">Aligned Unified Resource Assistant</p>

        <button
          className="login-ms-btn"
          onClick={handleLogin}
          disabled={loading}
          aria-label="Sign in with Microsoft"
        >
          {loading ? (
            <>
              <i className="fas fa-spinner fa-spin login-ms-btn-icon" />
              Signing in…
            </>
          ) : (
            <>
              <i className="fab fa-microsoft login-ms-btn-icon" />
              Sign in with Microsoft
            </>
          )}
        </button>

        {error && (
          <div className="login-error" role="alert">
            <i className="fas fa-exclamation-circle" />
            {error}
          </div>
        )}

        <p className="login-mfa-note">
          <i className="fas fa-shield-halved" />
          MFA is enforced by your organisation. You may be prompted by Microsoft to verify your identity.
        </p>

      </div>

      <p className="login-footer">
        &copy; {new Date().getFullYear()} Aligned Automation · For internal use only
      </p>
    </div>
  );
};

export default LoginPage;
