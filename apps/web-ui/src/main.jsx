import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { msalInstance } from './utils/authService';

async function bootstrap() {
  await msalInstance.initialize();

  // Process the OAuth redirect response (code= in URL after Microsoft login/logout).
  // Must run before React renders so the account is in the MSAL cache when App mounts.
  try {
    const result = await msalInstance.handleRedirectPromise();
    if (result?.account) {
      msalInstance.setActiveAccount(result.account);
    }
  } catch (err) {
    console.error('[MSAL] redirect handling error:', err);
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
}

bootstrap();
