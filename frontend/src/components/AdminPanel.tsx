import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useToast } from "../context/ToastContext";
import "./EventDashboard.css";

interface User {
    id: number;
    email: string;
    role: string;
    created_at: string;
    is_active: boolean;
}

interface SystemStats {
    total_users: number;
    active_users: number;
    total_events: number;
    total_registrations: number;
    avg_rating: number;
}

interface EventAnalytics {
    id: number;
    title: string;
    start_time: string;
    capacity: number;
    registered_count: number;
}

export default function AdminPanel() {
    const { getAccessTokenSilently, user: authUser } = useAuth0();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState("ANALYTICS");
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [events, setEvents] = useState<EventAnalytics[]>([]);
    const [currentUserRole, setCurrentUserRole] = useState("");
    const [confirmModal, setConfirmModal] = useState<{id: number, active: boolean} | null>(null);

    const SUPER_ADMIN_EMAIL = "devanshukejriwal24@gmail.com";
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

    useEffect(() => {
        fetchUsers();
        fetchStats();
        fetchEvents();
    }, []);

    const fetchUsers = async () => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/admin/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if(res.ok) {
                const data = await res.json();
                setUsers(data || []);
                if (data) {
                    const me = data.find((u: User) => u.email === authUser?.email);
                    if (me) setCurrentUserRole(me.role);
                }
            }
        } catch (e) { console.error(e); }
    };

    const fetchStats = async () => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/admin/analytics`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if(res.ok) setStats(await res.json());
        } catch (e) { console.error(e); }
    };

    const fetchEvents = async () => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/events`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if(res.ok) {
                const data = await res.json();
                setEvents(data || []);
            }
        } catch (e) { console.error(e); }
    };

    const updateRole = async (userId: number, newRole: string) => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/admin/users/role`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId, role: newRole })
            });
            if (!res.ok) throw new Error("Failed");
            showToast("Role Updated!", "success");
            fetchUsers();
        } catch (error) { showToast("Update failed", "error"); }
    };

    const initiateToggle = (userId: number, isActive: boolean) => {
        setConfirmModal({ id: userId, active: isActive });
    };

    const confirmToggle = async () => {
        if (!confirmModal) return;
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/admin/users/active`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: confirmModal.id, is_active: confirmModal.active })
            });
            if (!res.ok) throw new Error("Failed");
            showToast(`User ${confirmModal.active ? 'Activated' : 'Deactivated'}!`, "success");
            fetchUsers();
        } catch (error) {
            showToast("Action failed", "error");
        } finally {
            setConfirmModal(null);
        }
    };

    const canEdit = currentUserRole === "Admin";

    if (currentUserRole && currentUserRole !== "Admin") return null;

    return (
        <div className="dashboard-container" style={{ marginTop: "40px", paddingTop: "40px" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#111827' }}>Admin Portal</h2>

                <div style={{ display: 'flex', gap: '10px' }}>
                    {['ANALYTICS', 'USERS', 'ATTENDANCE'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '6px',
                                border: 'none',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                background: activeTab === tab ? '#2563eb' : '#e5e7eb',
                                color: activeTab === tab ? 'white' : '#374151'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'ANALYTICS' && stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                    <StatCard title="Total Users" value={stats.total_users} color="#3b82f6" icon="👥" />
                    <StatCard title="Active Users" value={stats.active_users} color="#10b981" icon="✅" />
                    <StatCard title="Total Events" value={stats.total_events} color="#8b5cf6" icon="📅" />
                    <StatCard title="Registrations" value={stats.total_registrations} color="#f59e0b" icon="🎟️" />
                    <StatCard title="Avg Rating" value={stats.avg_rating ? stats.avg_rating.toFixed(1) : "N/A"} color="#ec4899" icon="⭐" />
                </div>
            )}

            {activeTab === 'USERS' && (
                <div className="form-card" style={{ padding: '0', overflow: 'hidden' }}>
                    <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
                        <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: "1px solid #e5e7eb" }}>
                            <th style={{ padding: "15px" }}>User</th>
                            <th style={{ padding: "15px" }}>Role</th>
                            <th style={{ padding: "15px" }}>Status</th>
                            <th style={{ padding: "15px" }}>Joined</th>
                            <th style={{ padding: "15px" }}>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {users.map(u => (
                            <tr key={u.id} style={{ borderBottom: "1px solid #eee", opacity: u.is_active ? 1 : 0.5 }}>
                                <td style={{ padding: "15px" }}>
                                    <div style={{ fontWeight: 'bold' }}>{u.email}</div>
                                    <div style={{ fontSize: '12px', color: '#666' }}>ID: {u.id}</div>
                                </td>
                                <td style={{ padding: "15px" }}>
                                    <span className={`badge ${u.role === 'Admin' ? 'badge-private' : 'badge-status'}`}>{u.role}</span>
                                </td>
                                <td style={{ padding: "15px" }}>
                                    {u.is_active ? <span style={{color:'green'}}>● Active</span> : <span style={{color:'red'}}>● Inactive</span>}
                                </td>
                                <td style={{ padding: "15px" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                                <td style={{ padding: "15px", display: 'flex', gap: '10px' }}>
                                    <select
                                        value={u.role}
                                        onChange={(e) => updateRole(u.id, e.target.value)}
                                        disabled={!canEdit || u.email === SUPER_ADMIN_EMAIL}
                                        style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
                                    >
                                        <option value="Member">Member</option>
                                        <option value="Organizer">Organizer</option>
                                        <option value="Admin">Admin</option>
                                    </select>

                                    <button
                                        onClick={() => initiateToggle(u.id, !u.is_active)}
                                        disabled={!canEdit || u.email === SUPER_ADMIN_EMAIL}
                                        className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                                    >
                                        {u.is_active ? 'Disable' : 'Enable'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'ATTENDANCE' && (
                <div className="form-card" style={{ padding: '0', overflow: 'hidden' }}>
                    <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
                        <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: "1px solid #e5e7eb" }}>
                            <th style={{ padding: "15px" }}>Event Name</th>
                            <th style={{ padding: "15px" }}>Date</th>
                            <th style={{ padding: "15px" }}>Capacity</th>
                            <th style={{ padding: "15px" }}>Registered</th>
                            <th style={{ padding: "15px" }}>Utilization</th>
                        </tr>
                        </thead>
                        <tbody>
                        {events.map(e => {
                            const utilization = Math.round((e.registered_count / e.capacity) * 100);
                            let color = 'green';
                            if (utilization > 50) color = 'orange';
                            if (utilization >= 100) color = 'red';

                            return (
                                <tr key={e.id} style={{ borderBottom: "1px solid #eee" }}>
                                    <td style={{ padding: "15px", fontWeight: 'bold' }}>{e.title}</td>
                                    <td style={{ padding: "15px" }}>{new Date(e.start_time).toLocaleDateString()}</td>
                                    <td style={{ padding: "15px" }}>{e.capacity}</td>
                                    <td style={{ padding: "15px" }}>{e.registered_count}</td>
                                    <td style={{ padding: "15px" }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '100px', height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ width: `${utilization}%`, height: '100%', background: color }}></div>
                                            </div>
                                            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{utilization}%</span>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                        </tbody>
                    </table>
                </div>
            )}

            {confirmModal && (
                <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
                    <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{marginTop:0}}>Confirm Action</h3>
                        <p style={{color:'#6b7280', marginBottom:'20px'}}>
                            Are you sure you want to <strong>{confirmModal.active ? 'Activate' : 'Deactivate'}</strong> this user?
                        </p>
                        <div style={{display:'flex', gap:'10px', justifyContent:'center'}}>
                            <button onClick={() => setConfirmModal(null)} className="btn btn-secondary">Cancel</button>
                            <button onClick={confirmToggle} className={`btn ${confirmModal.active ? 'btn-success' : 'btn-danger'}`}>
                                Yes, {confirmModal.active ? 'Activate' : 'Deactivate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ title, value, color, icon }: any) {
    return (
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase' }}>{title}</span>
                <span style={{ fontSize: '24px' }}>{icon}</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: color }}>{value}</div>
        </div>
    )
}