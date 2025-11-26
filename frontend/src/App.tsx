import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useToast } from "./context/ToastContext";
import EventDashboard from "./components/EventDashboard";
import AdminPanel from "./components/AdminPanel";
import "./App.css";

function App() {
    const { loginWithRedirect, logout, user, isAuthenticated, getAccessTokenSilently, isLoading } = useAuth0();
    const { showToast } = useToast();

    // State to store the role
    const [userRole, setUserRole] = useState<string>("");

    useEffect(() => {
        if (isAuthenticated && user) {
            syncUserWithBackend(true);
        }
    }, [isAuthenticated, user]);

    const syncUserWithBackend = async (silent = false) => {
        try {
            const t = await getAccessTokenSilently();
            const response = await fetch("http://localhost:8080/api/users/sync", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${t}`
                },
                body: JSON.stringify({ email: user?.email })
            });

            if (!response.ok) throw new Error("Failed to sync");

            const data = await response.json();
            setUserRole(data.role);

            if (!silent) {
                showToast(`✅ User Synced! Role: ${data.role}`, "success");
            }
        } catch (error) {
            console.error("Sync failed", error);
            if (!silent) showToast("Sync Failed. Check console.", "error");
        }
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#6b7280', fontFamily: 'system-ui' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎓</div>
                    <div>Loading CampusSync...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="app-layout">
            {/* --- NAVIGATION BAR --- */}
            <nav className="navbar">
                <div className="navbar-brand">
                    🎓 <span>CampusSync</span>
                </div>

                <div className="navbar-actions">
                    {isAuthenticated ? (
                        <>
                            <div className="user-pill">
                                <span>{userRole || "Loading..."}</span>
                                <span style={{color:'#ccc'}}>|</span>
                                <strong>{user?.email}</strong>
                            </div>

                            <button
                                onClick={() => syncUserWithBackend(false)}
                                className="nav-btn btn-sync"
                                title="Sync latest role from database"
                            >
                                🔄 Sync
                            </button>

                            <button
                                onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                                className="nav-btn btn-logout"
                            >
                                Log Out
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => loginWithRedirect()}
                            className="nav-btn btn-login"
                        >
                            Log In
                        </button>
                    )}
                </div>
            </nav>

            {/* --- MAIN CONTENT --- */}
            <main className="main-content">
                {!isAuthenticated ? (
                    <div className="hero-container">
                        <h1 className="hero-title">Streamline Your Campus Events</h1>
                        <p className="hero-subtitle">
                            The central hub for students, faculty, and organizers to create, discover, and manage university events seamlessly.
                        </p>
                        <button
                            onClick={() => loginWithRedirect()}
                            className="nav-btn btn-login"
                            style={{ padding: '12px 32px', fontSize: '1.1rem' }}
                        >
                            Get Started Now
                        </button>
                    </div>
                ) : (
                    <>
                        <EventDashboard />

                        
                        {userRole === 'Admin' && (
                            <div className="admin-section">
                                <AdminPanel />
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

export default App;