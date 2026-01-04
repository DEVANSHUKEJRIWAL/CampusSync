// @ts-ignore

import React from 'react'
import ReactDOM from 'react-dom/client'
import {Auth0Provider} from '@auth0/auth0-react'
import App from './App.tsx'
import './index.css'
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import {ToastProvider} from "./context/ToastContext.tsx";

const AUTH0_DOMAIN = "cems-terps.us.auth0.com";
const clientId = "GRzz4LLOFwexYLxoX68zARtCUsNosYP0";
const audience = "http://localhost:8080";



ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ErrorBoundary>
            <Auth0Provider
                domain={AUTH0_DOMAIN}
                clientId={clientId}
                authorizationParams={{
                    redirect_uri: window.location.origin,
                    audience: audience,
                }}
                cacheLocation="localstorage"
                useRefreshTokens={true}
            >
                <ToastProvider>
                    <App/>
                </ToastProvider>
            </Auth0Provider>
        </ErrorBoundary>
    </React.StrictMode>,
)