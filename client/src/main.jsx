import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { checkEnvironmentVariables } from './utils/envCheck.js'
import { validateFirebaseConfig } from './utils/serviceWorkerGenerator.js'

// Check environment variables in development
if (import.meta.env.DEV) {
  checkEnvironmentVariables();
}

// Validate Firebase configuration
validateFirebaseConfig();

createRoot(document.getElementById('root')).render(
    <App />
)
