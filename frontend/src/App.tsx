import { useAuth0 } from "@auth0/auth0-react";
import EventDashboard from "./components/EventDashboard";
import AdminPanel from "./components/AdminPanel";

function App() {
    const { loginWithRedirect, logout, user, isAuthenticated, getAccessTokenSilently, isLoading } = useAuth0();

    // Reuse the sync logic you already tested
    const syncUserWithBackend = async () => {
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
            const data = await response.json();
            alert(`✅ User Synced! Role: ${data.role}`);
        } catch (error) {
            console.error("Sync failed", error);
            alert("❌ Sync Failed");
        }
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "1000px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1>🎓 CampusSync</h1>
                {isAuthenticated && (
                    <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
                        Log Out
                    </button>
                )}
            </div>

            {!isAuthenticated ? (
                <div style={{ textAlign: "center", marginTop: "50px" }}>
                    <p>Welcome to the Campus Event Management System.</p>
                    <button
                        onClick={() => loginWithRedirect()}
                        style={{ padding: "12px 24px", fontSize: "18px", background: "#007bff", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
                    >
                        Log In to Continue
                    </button>
                </div>
            ) : (
                <div>
                    <div style={{ background: "#f0f0f0", padding: "15px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>Logged in as: <strong>{user?.email}</strong></span>
                        <button onClick={syncUserWithBackend}>🔄 Sync User Profile</button>
                    </div>

                    {/* Render the Dashboard Component */}
                    <EventDashboard />
                    <AdminPanel />
                </div>
            )}
        </div>
    );
}

export default App;