import React from 'react'
import ReactDOM from 'react-dom/client'
import { Auth0Provider } from '@auth0/auth0-react'
import App from './App.tsx'
import './index.css'

// 👇 REPLACE THESE WITH YOUR ACTUAL VALUES FROM AUTH0 DASHBOARD
const domain = "cems-terps.us.auth0.com"; // e.g., dev-xyz.us.auth0.com
const clientId = "GRzz4LLOFwexYLxoX68zARtCUsNosYP0";
const audience = "http://localhost:8080"; // This matches the API Identifier we set in Auth0

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Auth0Provider
            domain={domain}
            clientId={clientId}
            authorizationParams={{
                redirect_uri: window.location.origin,
                audience: audience, // 👈 Crucial: tells Auth0 we want a token for the Go Backend
            }}
        >
            <App />
        </Auth0Provider>
    </React.StrictMode>,
)