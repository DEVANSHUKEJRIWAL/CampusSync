import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useToast } from "./context/ToastContext";
import EventDashboard from "./components/EventDashboard";
import AdminPanel from "./components/AdminPanel";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

function App() {
    const { loginWithRedirect, logout, user, isAuthenticated, getAccessTokenSilently, isLoading } = useAuth0();
    const { showToast } = useToast();
    const [userRole, setUserRole] = useState<string>("");

    useEffect(() => {
        if (isAuthenticated && user) {
            syncUserWithBackend(true);
        }
    }, [isAuthenticated, user]);

    const syncUserWithBackend = async (silent = false) => {
        try {
            const t = await getAccessTokenSilently();
            const response = await fetch(`${API_URL}/api/users/sync`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t}` },
                body: JSON.stringify({ email: user?.email })
            });
            if (!response.ok) throw new Error("Failed to sync");
            const data = await response.json();
            setUserRole(data.role);
            if (!silent) showToast(`Role Synced: ${data.role}`, "success");
        } catch (error) {
            if (!silent) showToast("Sync Failed", "error");
        }
    };

    if (isLoading) return <div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center'}}>Loading...</div>;

    return (
        <div className="app-layout">
            <nav className="navbar">
                <div className="nav-container">
                    <div className="navbar-brand">
                        🎓 <span>CampusSync</span>
                    </div>

                    <div className="nav-actions">
                        {isAuthenticated ? (
                            <>
                                <div className="user-pill">
                                    <span>{userRole || "..."}</span>
                                    <span style={{color:'#cbd5e1'}}>|</span>
                                    <strong>{user?.email}</strong>
                                </div>
                                <button onClick={() => syncUserWithBackend(false)} className="btn-nav">Sync</button>
                                <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })} className="btn-nav btn-logout">Log Out</button>
                            </>
                        ) : (
                            <button onClick={() => loginWithRedirect()} className="btn-nav" style={{background:'var(--primary)', color:'white'}}>Log In</button>
                        )}
                    </div>
                </div>
            </nav>

            <main className="main-content">
                {!isAuthenticated ? (
                    <div className="hero-container">
                        <h1 className="hero-title">Your Campus,<br/>Connect.</h1>
                        <p className="hero-subtitle">The central hub for students, faculty, and organizers to create, discover, and manage university events seamlessly.</p>
                        <button onClick={() => loginWithRedirect()} style={{padding:'16px 32px', fontSize:'1.1rem', background:'var(--primary)', color:'white', border:'none', borderRadius:'100px', fontWeight:'bold', cursor:'pointer'}}>Get Started</button>
                    </div>
                ) : (
                    <>
                        <EventDashboard />
                        {userRole === 'Admin' && <div style={{maxWidth:'1280px', margin:'0 auto', padding:'0 20px'}}><AdminPanel /></div>}
                    </>
                )}
            </main>
        </div>
    );
}

export default App;