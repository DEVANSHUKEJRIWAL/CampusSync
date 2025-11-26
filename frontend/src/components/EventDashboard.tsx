import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import CalendarView from "./CalendarView";
import { ChevronDownIcon, BellIcon } from '@heroicons/react/20/solid';
import { useToast } from "../context/ToastContext";
import QRCode from "react-qr-code";
import "./EventDashboard.css";

interface Event {
    id: number;
    title: string;
    description: string;
    location: string;
    start_time: string;
    end_time: string;
    capacity: number;
    status: string;
    visibility: string;
    category: string;
    registered_count: number;
}

interface Notification {
    id: number;
    message: string;
    is_read: boolean;
    created_at: string;
}

const CATEGORIES = ["General", "Workshop", "Seminar", "Club Meeting", "Social", "Sports"];

export default function EventDashboard() {
    const { getAccessTokenSilently, user } = useAuth0();
    const { showToast } = useToast();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [myEvents, setMyEvents] = useState<any[]>([]);

    const [userRole, setUserRole] = useState("Loading...");

    // Notification State
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showNotifPanel, setShowNotifPanel] = useState(false);

    // View Mode State
    const [viewMode, setViewMode] = useState<"LIST" | "CALENDAR">("LIST");

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchLocation, setSearchLocation] = useState("");
    const [searchCategory, setSearchCategory] = useState("All");

    // --- MODAL STATES ---
    const [selectedEventId, setSelectedEventId] = useState<number | null>(null); // Manage Attendees
    const [attendees, setAttendees] = useState<any[]>([]);

    const [cancelModalId, setCancelModalId] = useState<number | null>(null); // Cancel Confirmation

    const [inviteModalId, setInviteModalId] = useState<number | null>(null); // Invite User
    const [inviteEmail, setInviteEmail] = useState("");

    const [qrModalEvent, setQrModalEvent] = useState<Event | null>(null); // QR Modal

    // Feedback Modal State
    const [feedbackModalId, setFeedbackModalId] = useState<number | null>(null);
    const [feedbackRating, setFeedbackRating] = useState(5);
    const [feedbackComment, setFeedbackComment] = useState("");

    // Edit State
    const [editingEventId, setEditingEventId] = useState<number | null>(null);

    // Form Validation State
    const [formError, setFormError] = useState("");
    const [formSuccess, setFormSuccess] = useState("");

    // Crash Test State
    const [simulateCrash, setSimulateCrash] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        location: "",
        start_time: "",
        end_time: "",
        capacity: 0,
        visibility: "PUBLIC",
        category: "General"
    });

    // 👇 Helper to check permissions (Admin or Organizer)
    const canManage = userRole === 'Admin' || userRole === 'Organizer';

    if (simulateCrash) {
        throw new Error("Manual crash triggered for testing Error Boundary!");
    }

    // --- API CALLS ---
    const fetchUserProfile = async () => {
        if (!user?.email) return;
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch("http://localhost:8080/api/users/sync", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ email: user.email }),
            });
            if (res.ok) {
                const data = await res.json();
                setUserRole(data.role);
            }
        } catch (error) {
            console.error("Error fetching profile:", error);
        }
    };

    const fetchNotifications = async () => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch("http://localhost:8080/api/notifications", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setNotifications(data || []);
            }
        } catch (err) { console.error(err); }
    };

    const markNotificationsRead = async () => {
        try {
            const token = await getAccessTokenSilently();
            await fetch("http://localhost:8080/api/notifications/read", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            setNotifications(prev => prev.map(n => ({...n, is_read: true})));
        } catch (err) { console.error(err); }
    };

    const fetchEvents = async (query = "", loc = "", cat = "") => {
        try {
            setLoading(true);
            const token = await getAccessTokenSilently();
            const params = new URLSearchParams();
            if (query) params.append("q", query);
            if (loc) params.append("location", loc);
            if (cat && cat !== "All") params.append("category", cat);

            const res = await fetch(`http://localhost:8080/api/events?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setEvents(data || []);
            }
        } catch (error) {
            console.error("Error fetching events:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyEvents = async () => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch("http://localhost:8080/api/registrations/me", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                setMyEvents(await res.json());
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchAttendees = async (id: number) => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`http://localhost:8080/api/events/attendees?event_id=${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setAttendees(await res.json());
                setSelectedEventId(id);
            }
        } catch (e) { console.error(e); }
    };

    const downloadCsv = async (id: number) => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`http://localhost:8080/api/events/export?event_id=${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `attendees-${id}.csv`;
            a.click();
            showToast("CSV Downloaded!", "success");
        } catch (e) {
            console.error(e);
            showToast("Failed to download CSV.", "error");
        }
    };

    useEffect(() => {
        fetchEvents("", "", "All");
        fetchMyEvents();
        fetchUserProfile();
        fetchNotifications();
    }, [user]);

    // --- HANDLERS ---

    const handleRegister = async (eventId: number) => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`http://localhost:8080/api/registrations?event_id=${eventId}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await res.json();

            if (res.status === 429) {
                showToast("⏳ Too many requests! Please wait a moment.", "error");
                return;
            }

            if (!res.ok) {
                showToast(`⚠️ ${data.message || "Error registering"}`, "error");
                return;
            }

            if (data.status === "REGISTERED") {
                showToast("✅ Success! You are registered.", "success");
            } else if (data.status === "WAITLISTED") {
                showToast("Event is full. You are on the WAITLIST.", "success");
            }

            fetchMyEvents();
            fetchEvents(searchQuery, searchLocation, searchCategory);

        } catch (error: any) {
            console.error("Detailed Error:", error);
            showToast(`Registration failed: ${error.message || error}`, "error");
        }
    };

    const handleCancelClick = (eventId: number) => {
        setCancelModalId(eventId);
    };

    const confirmCancel = async () => {
        if (!cancelModalId) return;
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`http://localhost:8080/api/registrations?event_id=${cancelModalId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                showToast("Registration cancelled.", "success");
                fetchMyEvents();
                fetchEvents(searchQuery, searchLocation, searchCategory);
                fetchNotifications();
            } else {
                const data = await res.json();
                showToast(data.message, "error");
            }
        } catch (err) {
            showToast("Cancellation failed.", "error");
        } finally {
            setCancelModalId(null);
        }
    };

    const handleInviteClick = (eventId: number) => {
        setInviteModalId(eventId);
        setInviteEmail("");
    };

    const sendInvite = async () => {
        if (!inviteModalId || !inviteEmail) return;
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch("http://localhost:8080/api/events/invite", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ event_id: inviteModalId, email: inviteEmail }),
            });

            if (res.ok) {
                showToast("✅ User invited successfully!", "success");
            } else {
                showToast("❌ Failed to invite user.", "error");
            }
        } catch (err) {
            showToast("Error sending invitation.", "error");
        } finally {
            setInviteModalId(null);
        }
    };

    const handleBulkInvite = async (eventId: number) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';

        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('event_id', eventId.toString());
            formData.append('file', file);

            try {
                const token = await getAccessTokenSilently();
                const res = await fetch("http://localhost:8080/api/events/invite/bulk", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                });

                if (res.ok) {
                    const data = await res.json();
                    showToast(`✅ Success! Processed ${data.count} emails.`, "success");
                } else {
                    showToast("❌ Failed to upload.", "error");
                }
            } catch (err) {
                showToast("Upload error.", "error");
            }
        };
        input.click();
    };

    const openFeedbackModal = (eventId: number) => {
        setFeedbackModalId(eventId);
        setFeedbackRating(5);
        setFeedbackComment("");
    };

    const submitFeedback = async () => {
        if (!feedbackModalId) return;
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch("http://localhost:8080/api/events/feedback", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    event_id: feedbackModalId,
                    rating: feedbackRating,
                    comment: feedbackComment
                }),
            });

            if (res.ok) {
                showToast("🌟 Feedback submitted!", "success");
                setFeedbackModalId(null);
            } else {
                showToast("Failed to submit feedback.", "error");
            }
        } catch (error) {
            showToast("Network error.", "error");
        }
    };

    const handleEditClick = (evt: Event) => {
        setEditingEventId(evt.id);
        setFormError("");
        setFormSuccess("");

        const start = new Date(evt.start_time).toISOString().slice(0, 16);
        let end = evt.end_time ? new Date(evt.end_time).toISOString().slice(0, 16) : "";
        if (!end) { const d = new Date(evt.start_time); d.setHours(d.getHours() + 1); end = d.toISOString().slice(0, 16); }

        setFormData({
            title: evt.title,
            description: evt.description,
            location: evt.location,
            start_time: start,
            end_time: end,
            capacity: evt.capacity,
            visibility: evt.visibility,
            category: evt.category || "General"
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setEditingEventId(null);
        setFormError("");
        setFormSuccess("");
        setFormData({
            title: "",
            description: "",
            location: "",
            start_time: "",
            end_time: "",
            capacity: 0,
            visibility: "PUBLIC",
            category: "General"
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError("");
        setFormSuccess("");

        if (new Date(formData.end_time) <= new Date(formData.start_time)) {
            setFormError("End time must be strictly after start time.");
            return;
        }
        if (formData.capacity <= 0) {
            setFormError("Capacity must be a positive number.");
            return;
        }

        try {
            const token = await getAccessTokenSilently();
            const payload = {
                ...formData,
                capacity: Number(formData.capacity),
                start_time: new Date(formData.start_time).toISOString(),
                end_time: new Date(formData.end_time).toISOString(),
                id: editingEventId
            };

            const method = editingEventId ? "PUT" : "POST";

            const res = await fetch("http://localhost:8080/api/events", {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Failed to save event");
            }

            const msg = editingEventId ? "Event Updated Successfully!" : "Event Created Successfully!";
            setFormSuccess(msg);
            showToast(msg, "success");

            fetchEvents(searchQuery, searchLocation, searchCategory);

            setTimeout(() => {
                setFormSuccess("");
                if (!editingEventId) resetForm();
            }, 3000);

        } catch (error: any) {
            setFormError(error.message);
            showToast(`Error: ${error.message}`, "error");
        }
    };

    const getMyStatus = (eventId: number) => {
        const record = myEvents.find((e: any) => e.event_id === eventId);
        return record ? record.my_status : null;
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                    <h2 style={{fontSize: "24px", fontWeight: "bold", margin: 0}}>📅 Event Dashboard</h2>

                    <div style={{position: 'relative'}}>
                        <button
                            onClick={() => { setShowNotifPanel(!showNotifPanel); if(!showNotifPanel) markNotificationsRead(); }}
                            style={{background: 'none', border: 'none', cursor: 'pointer', position: 'relative'}}
                        >
                            <BellIcon style={{width:'28px', height:'28px', color: '#374151'}} />
                            {notifications && notifications.some(n => !n.is_read) && (
                                <span style={{
                                    position: 'absolute', top: '-2px', right: '-2px',
                                    background: 'red', borderRadius: '50%', width: '12px', height: '12px', border: '2px solid white'
                                }} />
                            )}
                        </button>

                        {showNotifPanel && (
                            <div style={{
                                position: 'absolute', top: '40px', left: '0', width: '320px',
                                background: 'white', border: '1px solid #ccc', borderRadius: '8px',
                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 100, padding: '15px',
                                maxHeight: '400px', overflowY: 'auto'
                            }}>
                                <h4 style={{margin: '0 0 10px 0', borderBottom: '1px solid #eee', paddingBottom: '5px', fontSize:'16px'}}>Notifications</h4>
                                {(!notifications || notifications.length === 0) ? <p style={{fontSize:'13px', color:'#666'}}>No notifications.</p> : (
                                    <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                                        {notifications.map(n => (
                                            <div key={n.id} style={{fontSize:'14px', padding:'10px', background: n.is_read ? 'white' : '#f0f9ff', borderRadius:'6px', borderBottom:'1px solid #eee'}}>
                                                {n.message}
                                                <div style={{fontSize:'11px', color:'#999', marginTop:'4px'}}>{new Date(n.created_at).toLocaleString()}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                    <div className="user-badge" style={{background: '#f3f4f6', padding: '8px 12px', borderRadius: '20px', fontSize: '14px'}}>
                        Logged in as: <strong>{user?.email}</strong>
                        <span style={{marginLeft: '8px', background: '#2563eb', color:'white', padding:'2px 8px', borderRadius:'10px', fontSize:'12px'}}>
                            {userRole}
                        </span>
                    </div>

                    <button
                        onClick={() => setSimulateCrash(true)}
                        className="btn btn-danger"
                        style={{ padding: "8px 12px" }}
                    >
                        💣 Crash App
                    </button>
                </div>
            </div>

            {/* 👇 FIXED: Form is hidden for Members */}
            {canManage && (
                <form onSubmit={handleSubmit} className={`form-card ${editingEventId ? "editing" : ""}`}>
                    <div className="space-y-12">
                        {formError && <div className="alert-box alert-error">{formError}</div>}
                        {formSuccess && <div className="alert-box alert-success">{formSuccess}</div>}

                        <div className="border-b border-gray-200 pb-12">
                            <h2 className="text-base font-semibold text-gray-900">
                                {editingEventId ? "Edit Event Details" : "Create New Event"}
                            </h2>
                            <p className="mt-1 text-sm text-gray-600">This information will be displayed publicly.</p>

                            <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                                <div className="sm:col-span-4">
                                    <label htmlFor="title" className="block text-sm font-medium text-gray-900">Event Title</label>
                                    <div className="mt-2">
                                        <input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="input-light" placeholder="e.g. Annual Hackathon" required />
                                    </div>
                                </div>
                                <div className="sm:col-span-2">
                                    <label htmlFor="category" className="block text-sm font-medium text-gray-900">Category</label>
                                    <div className="mt-2">
                                        <div className="select-wrapper">
                                            <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="select-light">
                                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <ChevronDownIcon aria-hidden="true" className="select-icon" />
                                        </div>
                                    </div>
                                </div>
                                <div className="col-span-full">
                                    <label htmlFor="description" className="block text-sm font-medium text-gray-900">Description</label>
                                    <div className="mt-2">
                                        <textarea rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-light" placeholder="Write a few sentences about the event." />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-b border-gray-200 pb-12">
                            <h2 className="text-base font-semibold text-gray-900">Logistics & Settings</h2>
                            <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                                <div className="col-span-full">
                                    <label htmlFor="location" className="block text-sm font-medium text-gray-900">Location</label>
                                    <div className="mt-2">
                                        <input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="input-light" required />
                                    </div>
                                </div>
                                <div className="sm:col-span-3">
                                    <label htmlFor="start-time" className="block text-sm font-medium text-gray-900">Start Time</label>
                                    <div className="mt-2">
                                        <input type="datetime-local" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} className="input-light" required />
                                    </div>
                                </div>
                                <div className="sm:col-span-3">
                                    <label htmlFor="end-time" className="block text-sm font-medium text-gray-900">End Time</label>
                                    <div className="mt-2">
                                        <input type="datetime-local" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} className="input-light" required />
                                    </div>
                                </div>
                                <div className="sm:col-span-3">
                                    <label htmlFor="capacity" className="block text-sm font-medium text-gray-900">Capacity</label>
                                    <div className="mt-2">
                                        <input type="number" value={formData.capacity || ""} onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })} className="input-light" required />
                                    </div>
                                </div>
                                <div className="sm:col-span-3">
                                    <label htmlFor="visibility" className="block text-sm font-medium text-gray-900">Visibility</label>
                                    <div className="mt-2 grid grid-cols-1">
                                        <div className="select-wrapper">
                                            <select value={formData.visibility} onChange={(e) => setFormData({ ...formData, visibility: e.target.value })} className="select-light">
                                                <option value="PUBLIC">Public</option>
                                                <option value="PRIVATE">Private (Invite Only)</option>
                                            </select>
                                            <ChevronDownIcon aria-hidden="true" className="select-icon" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="form-actions">
                        {editingEventId && <button type="button" onClick={resetForm} className="btn-text">Cancel</button>}
                        <button type="submit" className="btn-submit">{editingEventId ? "Update Event" : "Create Event"}</button>
                    </div>
                </form>
            )}

            {/* My Schedule */}
            <div className="schedule-card">
                <h3 style={{ marginTop: 0, fontSize: "20px", fontWeight: "bold" }}>🎫 My Schedule</h3>
                {(!myEvents || myEvents.length === 0) ? (
                    <p style={{ color: "gray" }}>You haven't registered for any events yet.</p>
                ) : (
                    <div>
                        {myEvents.map((e) => (
                            <div key={e.event_id} className="schedule-item">
                                <div>
                                    <strong>{e.title}</strong>
                                    <span style={{ color: "gray", fontSize: "13px", marginLeft: "10px" }}>
                                        📅 {new Date(e.start_time).toLocaleString()}
                                    </span>
                                </div>
                                <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                                    <span className={`badge ${e.my_status === "REGISTERED" ? "badge-public" : "badge-status"}`}>
                                        {e.my_status}
                                    </span>
                                    {e.my_status === "REGISTERED" && (
                                        <button
                                            onClick={() => openFeedbackModal(e.event_id)}
                                            className="btn btn-sm btn-warning"
                                            style={{padding:'4px 8px', fontSize:'12px'}}
                                        >
                                            ⭐ Rate
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Search & Toggles */}
            <div className="action-bar">
                <div style={{display:'flex', gap:'10px', flex: 1, flexWrap:'wrap'}}>
                    <input placeholder="🔍 Search title..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{padding:'10px', border:'1px solid #ccc', borderRadius:'4px', flex: 1}} />
                    <input placeholder="📍 Location..." value={searchLocation} onChange={(e) => setSearchLocation(e.target.value)} style={{padding:'10px', width:'150px', border:'1px solid #ccc', borderRadius:'4px'}} />

                    <select value={searchCategory} onChange={(e) => setSearchCategory(e.target.value)} style={{padding:'10px', borderRadius:'4px', border:'1px solid #ccc'}}>
                        <option value="All">All Categories</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <button onClick={() => fetchEvents(searchQuery, searchLocation, searchCategory)} className="btn btn-secondary">Filter</button>
                    <button onClick={() => {setSearchQuery(""); setSearchLocation(""); setSearchCategory("All"); fetchEvents("", "", "All")}} className="btn btn-secondary">Clear</button>
                </div>
                <div style={{marginTop: '10px'}}>
                    <button onClick={() => setViewMode("LIST")} className="btn btn-info" style={{marginRight:'5px'}}>List</button>
                    <button onClick={() => setViewMode("CALENDAR")} className="btn btn-info">Calendar</button>
                </div>
            </div>

            {/* Views */}
            {loading ? <p>Loading...</p> : (
                <>
                    {viewMode === "LIST" ? (
                        <div className="event-grid">
                            {events.length === 0 && <p>No events found.</p>}
                            {events.map((evt) => {
                                const status = getMyStatus(evt.id);
                                return (
                                    <div key={evt.id} className="event-card">
                                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'start'}}>
                                            <div>
                                                <h4 style={{margin:'0 0 5px 0', fontSize:'18px'}}>{evt.title}</h4>
                                                <span className="badge badge-status" style={{background:'#eee', color:'#333'}}>{evt.category || 'General'}</span>
                                            </div>
                                        </div>

                                        <div style={{marginTop:'10px', fontSize:'14px', color:'#555'}}>📍 {evt.location}</div>
                                        <div style={{fontSize:'14px', color:'#555'}}>📅 {new Date(evt.start_time).toLocaleString()}</div>

                                        <div style={{fontSize:'14px', fontWeight:'bold', marginTop:'5px', color: evt.registered_count >= evt.capacity ? '#dc2626' : '#16a34a'}}>
                                            👥 {evt.registered_count !== undefined ? evt.registered_count : 0} / {evt.capacity} Spots Filled
                                        </div>

                                        <div className="event-badges">
                                            <span className="badge badge-status">{evt.status}</span>
                                            <span className={`badge ${evt.visibility === "PRIVATE" ? "badge-private" : "badge-public"}`}>
                                                {evt.visibility === "PRIVATE" ? "Private" : "Public"}
                                            </span>
                                        </div>

                                        <div className="card-actions">
                                            {!status && (
                                                <button onClick={() => handleRegister(evt.id)} className="btn btn-success">Join</button>
                                            )}
                                            {status === 'REGISTERED' && (
                                                <button onClick={() => handleCancelClick(evt.id)} className="btn btn-danger">Cancel</button>
                                            )}
                                            {status === 'WAITLISTED' && (
                                                <button onClick={() => handleCancelClick(evt.id)} className="btn btn-warning" style={{color:'black'}}>Leave Waitlist</button>
                                            )}

                                            {/* 👇 FIXED: Hide Organizer buttons from Members */}
                                            {canManage && (
                                                <>
                                                    <button onClick={() => handleInviteClick(evt.id)} className="btn btn-secondary">Invite</button>
                                                    <button onClick={() => handleBulkInvite(evt.id)} className="btn btn-secondary">CSV</button>
                                                    <button onClick={() => fetchAttendees(evt.id)} className="btn btn-info">Manage</button>
                                                    <button onClick={() => handleEditClick(evt)} className="btn btn-warning">Edit</button>
                                                </>
                                            )}
                                            <button onClick={() => setQrModalEvent(evt)} className="btn btn-secondary" style={{background:'#3b82f6', color:'white', border:'none'}}>QR</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <CalendarView
                            events={events}
                            onEventClick={(evt) => { if(canManage && confirm(`Edit event "${evt.title}"?`)) handleEditClick(evt); }}
                        />
                    )}
                </>
            )}

            {/* --- MODALS --- */}

            {selectedEventId && (
                <div className="modal-overlay" onClick={() => setSelectedEventId(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                            <h3>👥 Attendees</h3>
                            <button onClick={() => setSelectedEventId(null)}>Close</button>
                        </div>
                        <button onClick={() => downloadCsv(selectedEventId)} className="btn btn-success" style={{width:'100%', marginBottom:'10px'}}>Download CSV</button>
                        <table style={{width:'100%'}}>
                            <thead><tr><th style={{textAlign:'left'}}>Email</th><th style={{textAlign:'left'}}>Status</th></tr></thead>
                            <tbody>
                            {attendees.map((a, i) => <tr key={i}><td>{a.email}</td><td>{a.status}</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {cancelModalId && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '400px', textAlign: 'center'}}>
                        <h3 style={{marginBottom: '10px'}}>Are you sure?</h3>
                        <p style={{color: '#666', marginBottom: '20px'}}>Do you want to cancel your registration for this event?</p>
                        <div style={{display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '20px'}}>
                            <button onClick={() => setCancelModalId(null)} className="btn btn-secondary">No, Keep It</button>
                            <button onClick={confirmCancel} className="btn btn-danger">Yes, Cancel Registration</button>
                        </div>
                    </div>
                </div>
            )}

            {inviteModalId && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '400px'}}>
                        <h3 style={{marginBottom: '15px'}}>💌 Invite User</h3>
                        <p style={{marginBottom: '10px', fontSize: '14px', color: '#666'}}>Enter the email address of the person you want to invite.</p>
                        <input
                            type="email"
                            className="input-light"
                            placeholder="user@example.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            style={{width: '100%', marginBottom: '20px', border: '1px solid #ccc', padding: '8px', borderRadius: '4px'}}
                        />
                        <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
                            <button onClick={() => setInviteModalId(null)} className="btn btn-secondary">Cancel</button>
                            <button onClick={sendInvite} className="btn btn-submit">Send Invite</button>
                        </div>
                    </div>
                </div>
            )}

            {feedbackModalId && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '500px'}}>
                        <h3 style={{textAlign:'center'}}>⭐ Rate This Event</h3>
                        <div className="feedback-stars">
                            {[1,2,3,4,5].map(star => (
                                <button key={star} type="button" onClick={() => setFeedbackRating(star)} className={`star-btn ${star <= feedbackRating ? 'selected' : ''}`}>★</button>
                            ))}
                        </div>
                        <textarea className="input-light" rows={3} placeholder="Write your review here..." value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} style={{width: '100%', marginTop: '10px'}} />
                        <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px'}}>
                            <button onClick={() => setFeedbackModalId(null)} className="btn btn-secondary">Cancel</button>
                            <button onClick={submitFeedback} className="btn btn-submit">Submit Feedback</button>
                        </div>
                    </div>
                </div>
            )}

            {qrModalEvent && (
                <div className="modal-overlay" onClick={() => setQrModalEvent(null)}>
                    <div className="modal-content" style={{textAlign: 'center', maxWidth:'400px'}} onClick={e => e.stopPropagation()}>
                        <h3>📱 Check-in QR Code</h3>
                        <p style={{marginBottom: '20px', fontWeight:'bold'}}>{qrModalEvent.title}</p>
                        <div style={{background: 'white', padding: '20px', display: 'inline-block', border:'1px solid #eee'}}>
                            <QRCode value={`event:${qrModalEvent.id}`} size={200} />
                        </div>
                        <p style={{marginTop: '15px', fontSize: '12px', color: '#666'}}>Scan this at the venue entrance to check in.</p>
                        <button onClick={() => setQrModalEvent(null)} className="btn btn-secondary" style={{marginTop: '20px'}}>Close</button>
                    </div>
                </div>
            )}

        </div>
    );
}