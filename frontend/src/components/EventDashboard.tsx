import {useEffect, useState} from "react";
import {useAuth0} from "@auth0/auth0-react";
import CalendarView from "./CalendarView";
import {
    ChevronDownIcon, BellIcon,
    MapPinIcon, CalendarIcon, UsersIcon, TagIcon, EyeIcon, PencilSquareIcon,
    MagnifyingGlassIcon, ListBulletIcon, CalendarDaysIcon, FunnelIcon, QrCodeIcon, XMarkIcon
} from '@heroicons/react/20/solid';
import {useToast} from "../context/ToastContext";
import QRCode from "react-qr-code";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import CheckInScanner from "./CheckInScanner.tsx";
import "./EventDashboard.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

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
    const { getAccessTokenSilently, user, isAuthenticated } = useAuth0();
    const {showToast} = useToast();

    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [myEvents, setMyEvents] = useState<any[]>([]);
    const [userRole, setUserRole] = useState("Loading...");
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const [viewMode, setViewMode] = useState<"LIST" | "CALENDAR">("LIST");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchLocation, setSearchLocation] = useState("");
    const [searchCategory, setSearchCategory] = useState("All");
    const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
    const [attendees, setAttendees] = useState<any[]>([]);
    const [cancelModalId, setCancelModalId] = useState<number | null>(null);
    const [inviteModalId, setInviteModalId] = useState<number | null>(null);
    const [inviteEmail, setInviteEmail] = useState("");
    const [qrModalEvent, setQrModalEvent] = useState<Event | null>(null);
    const [feedbackModalId, setFeedbackModalId] = useState<number | null>(null);
    const [feedbackRating, setFeedbackRating] = useState(5);
    const [feedbackComment, setFeedbackComment] = useState("");
    const [editingEventId, setEditingEventId] = useState<number | null>(null);
    const [formError, setFormError] = useState("");
    const [formSuccess, setFormSuccess] = useState("");
    const [showScanner, setShowScanner] = useState(false);

    const [formData, setFormData] = useState({
        title: "", description: "", location: "",
        start_time: "", end_time: "",
        capacity: 0, visibility: "PUBLIC", category: "General"
    });

    const canManage = userRole === 'Admin' || userRole === 'Organizer';

    const fetchUserProfile = async () => {
        if (!user?.email) return;
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/users/sync`, {
                method: "POST",
                headers: {"Content-Type": "application/json", Authorization: `Bearer ${token}`},
                body: JSON.stringify({email: user.email}),
            });
            if (res.ok) {
                const data = await res.json();
                setUserRole(data.role);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchNotifications = async () => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/notifications`, {headers: {Authorization: `Bearer ${token}`}});
            if (res.ok) {
                const data = await res.json();
                setNotifications(data || []);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const markNotificationsRead = async () => {
        try {
            const token = await getAccessTokenSilently();
            await fetch(`${API_URL}/api/notifications/read`, {
                method: "POST",
                headers: {Authorization: `Bearer ${token}`}
            });
            setNotifications(prev => prev.map(n => ({...n, is_read: true})));
        } catch (err) {
            console.error(err);
        }
    };

    const fetchEvents = async (query = "", loc = "", cat = "") => {
        try {
            setLoading(true);
            const token = await getAccessTokenSilently();
            const params = new URLSearchParams();
            if (query) params.append("q", query);
            if (loc) params.append("location", loc);
            if (cat && cat !== "All") params.append("category", cat);
            const res = await fetch(`${API_URL}/api/events?${params.toString()}`, {headers: {Authorization: `Bearer ${token}`}});
            if (res.ok) {
                const data = await res.json();
                setEvents(data || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyEvents = async () => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/registrations/me`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                setMyEvents(data || []);
            }
        } catch (err) { console.error(err); }
    };

    const fetchAttendees = async (id: number) => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/events/attendees?event_id=${id}`, {headers: {Authorization: `Bearer ${token}`}});
            if (res.ok) {
                setAttendees(await res.json() || []);
                setSelectedEventId(id);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const downloadCsv = async (id: number) => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/events/export?event_id=${id}`, {headers: {Authorization: `Bearer ${token}`}});
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `attendees-${id}.csv`;
            a.click();
            showToast("CSV Downloaded!", "success");
        } catch (e) {
            showToast("Failed to download CSV.", "error");
        }
    };

    useEffect(() => {
        fetchEvents("", "", "All");
        if (isAuthenticated && user) {
            fetchMyEvents();
            fetchUserProfile();
            fetchNotifications();
        }
    }, [user, isAuthenticated]);

    const handleRegister = async (eventId: number) => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/registrations?event_id=${eventId}`, {
                method: "POST",
                headers: {Authorization: `Bearer ${token}`}
            });
            const data = await res.json();
            if (res.status === 429) {
                showToast("⏳ Too many requests!", "error");
                return;
            }
            if (!res.ok) {
                showToast(`⚠️ ${data.message || "Error registering"}`, "error");
                return;
            }
            if (data.status === "REGISTERED") showToast("Success!", "success");
            else if (data.status === "WAITLISTED") showToast("Waitlisted.", "success");
            await fetchMyEvents();
            await fetchEvents(searchQuery, searchLocation, searchCategory);
        } catch (error: any) {
            showToast(`Error: ${error.message}`, "error");
        }
    };

    const handleCancelClick = (id: number) => {
        setCancelModalId(id);
    };
    const confirmCancel = async () => {
        if (!cancelModalId) return;
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/registrations?event_id=${cancelModalId}`, {
                method: "DELETE",
                headers: {Authorization: `Bearer ${token}`}
            });
            if (res.ok) {
                showToast("Cancelled.", "success");
                await fetchMyEvents();
                await fetchEvents(searchQuery, searchLocation, searchCategory);
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

    const handleInviteClick = (id: number) => {
        setInviteModalId(id);
        setInviteEmail("");
    };
    const sendInvite = async () => {
        if (!inviteModalId || !inviteEmail) return;
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/events/invite`, {
                method: "POST",
                headers: {"Content-Type": "application/json", Authorization: `Bearer ${token}`},
                body: JSON.stringify({event_id: inviteModalId, email: inviteEmail})
            });
            if (res.ok) showToast("Invited!", "success"); else showToast("Failed.", "error");
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
                const res = await fetch(`${API_URL}/api/events/invite/bulk`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                });

                if (res.ok) {
                    const data = await res.json();
                    showToast(`Success! Processed ${data.count} emails.`, "success");
                    fetchEvents(searchQuery, searchLocation, searchCategory);
                } else {
                    showToast("Failed to upload.", "error");
                }
            } catch (err) {
                showToast("Upload error.", "error");
            }
        };
        input.click();
    };

    const openFeedbackModal = (id: number) => {
        setFeedbackModalId(id);
        setFeedbackRating(5);
        setFeedbackComment("");
    };
    const submitFeedback = async () => {
        if (!feedbackModalId) return;
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/events/feedback`, {
                method: "POST",
                headers: {"Content-Type": "application/json", Authorization: `Bearer ${token}`},
                body: JSON.stringify({event_id: feedbackModalId, rating: feedbackRating, comment: feedbackComment})
            });
            if (res.ok) {
                showToast("Feedback submitted!", "success");
                setFeedbackModalId(null);
            } else showToast("Failed.", "error");
        } catch (error) {
            showToast("Error.", "error");
        }
    };

    const handleEditClick = (evt: Event) => {
        setEditingEventId(evt.id);
        setFormError("");
        setFormSuccess("");
        setFormData({
            title: evt.title,
            description: evt.description,
            location: evt.location,
            start_time: evt.start_time,
            end_time: evt.end_time,
            capacity: evt.capacity,
            visibility: evt.visibility,
            category: evt.category || "General"
        });
        window.scrollTo({top: 0, behavior: 'smooth'});
    };

    const resetForm = () => {
        setEditingEventId(null);
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

        const start = new Date(formData.start_time);
        const end = new Date(formData.end_time);

        if (!formData.start_time || !formData.end_time) {
            setFormError("Dates are required.");
            return;
        }
        if (end <= start) {
            setFormError("End time must be after start time.");
            return;
        }
        if (formData.capacity <= 0) {
            setFormError("Capacity must be positive.");
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
            const res = await fetch(`${API_URL}/api/events`, {
                method: method,
                headers: {"Content-Type": "application/json", Authorization: `Bearer ${token}`},
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Failed");
            }

            const msg = editingEventId ? "Event Updated!" : "Event Created!";
            setFormSuccess(msg);
            showToast(msg, "success");
            if (!editingEventId) {
                setSearchQuery("");
                setSearchLocation("");
                setSearchCategory("All");
                await fetchEvents("", "", "All");
                resetForm();
            } else {
                await fetchEvents(searchQuery, searchLocation, searchCategory);
                setTimeout(() => { setFormSuccess(""); resetForm(); }, 2000);
            }

            setTimeout(() => {
                setFormSuccess("");
                resetForm();
            }, 5000);
        } catch (error: any) {
            setFormError(error.message);
            showToast(`Error: ${error.message}`, "error");
        }
    };

    const getMyStatus = (eventId: number) => {
        if (!myEvents) return null;
        const record = myEvents.find((e: any) => e.event_id === eventId);
        return record ? record.my_status : null;
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                    <h2>Event Dashboard</h2>
                </div>
                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                    <div style={{position: 'relative'}}>
                        <button onClick={() => { setShowNotifPanel(!showNotifPanel); if(!showNotifPanel) markNotificationsRead(); }} style={{background: 'white', border: '1px solid #e5e7eb', cursor: 'pointer', position: 'relative', padding: '10px', borderRadius: '50%', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'}}>
                            <BellIcon style={{width:'24px', height:'24px', color: '#4b5563'}} />
                            {notifications && notifications.some(n => !n.is_read) && <span style={{position:'absolute', top:0, right:0, background:'#ef4444', width:'10px', height:'10px', borderRadius:'50%'}} />}
                        </button>
                        {showNotifPanel && (
                            <div style={{position: 'absolute', top: '50px', right: 0, width: '350px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 100, padding: '16px', maxHeight: '400px', overflowY: 'auto'}}>
                                <h4 style={{margin: '0 0 12px 0', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', fontSize:'16px'}}>Notifications</h4>
                                {(!notifications || notifications.length === 0) ? <p style={{fontSize:'13px', color:'#9ca3af'}}>No new notifications.</p> : (
                                    <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                                        {notifications.map(n => (
                                            <div key={n.id} style={{fontSize:'13px', padding:'12px', background: n.is_read ? 'white' : '#f0f9ff', borderRadius:'8px', borderBottom:'1px solid #f1f5f9', marginBottom:'4px'}}>
                                                <div style={{color: '#374151'}}>{n.message}</div>
                                                <div style={{fontSize:'11px', color:'#9ca3af', marginTop:'4px'}}>{new Date(n.created_at).toLocaleString()}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {canManage && (
                        <button
                            onClick={() => setShowScanner(true)}
                            className="btn btn-primary"
                            style={{display:'flex', alignItems:'center', gap:'6px', padding:'10px 16px'}}
                        >
                            <QrCodeIcon style={{width:'20px'}} /> Scan Tickets
                        </button>
                    )}

                    <div className="user-badge" style={{background: 'white', padding: '8px 16px', borderRadius: '24px', fontSize: '14px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display:'flex', alignItems:'center', gap:'8px'}}>
                        <span style={{color: '#6b7280'}}>Logged in as:</span> <strong style={{color: '#111827'}}>{user?.email}</strong>
                        <span style={{background: '#4f46e5', color:'white', padding:'2px 10px', borderRadius:'12px', fontSize:'11px', fontWeight: 'bold', textTransform: 'uppercase'}}>{userRole}</span>
                    </div>

                </div>
            </div>

            {canManage && (
                <form onSubmit={handleSubmit} className={`form-card ${editingEventId ? "editing" : ""}`}>
                    <div className="form-header">
                        <h3>{editingEventId ? "Edit Event" : "➕ Create New Event"}</h3>
                    </div>
                    <div className="form-body">
                        {formError && <div className="alert-box alert-error">{formError}</div>}
                        {formSuccess && <div className="alert-box alert-success">{formSuccess}</div>}

                        <div className="form-section">
                            <div className="section-title"><PencilSquareIcon
                                style={{width: '20px', color: '#4f46e5'}}/> Event Details
                            </div>
                            <div className="grid-2">
                                <div className="input-group">
                                    <PencilSquareIcon className="input-icon"/>
                                    <input className="input-light" placeholder="Event Title" value={formData.title}
                                           onChange={e => setFormData({...formData, title: e.target.value})} required/>
                                </div>
                                <div className="select-wrapper">
                                    <TagIcon className="input-icon"/>
                                    <select className="select-light" value={formData.category}
                                            onChange={e => setFormData({...formData, category: e.target.value})}>
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <ChevronDownIcon className="select-arrow"/>
                                </div>
                                <div className="grid-full"><textarea className="input-light"
                                                                     placeholder="Description..."
                                                                     value={formData.description}
                                                                     onChange={e => setFormData({
                                                                         ...formData,
                                                                         description: e.target.value
                                                                     })}/></div>
                            </div>
                        </div>

                        <div className="form-section">
                            <div className="section-title"><MapPinIcon
                                style={{width: '20px', color: '#4f46e5'}}/> Logistics
                            </div>
                            <div className="grid-2">
                                <div className="input-group grid-full">
                                    <MapPinIcon className="input-icon"/>
                                    <input className="input-light" placeholder="Location" value={formData.location}
                                           onChange={e => setFormData({...formData, location: e.target.value})}
                                           required/>
                                </div>
                                <div className="input-group">
                                    <CalendarIcon className="input-icon"/>
                                    <DatePicker
                                        selected={formData.start_time ? new Date(formData.start_time) : null}
                                        onChange={(date) => setFormData({
                                            ...formData,
                                            start_time: date ? date.toISOString() : ""
                                        })}
                                        showTimeSelect
                                        dateFormat="MMMM d, yyyy h:mm aa"
                                        className="input-light"
                                        placeholderText="Start Time"
                                        wrapperClassName="w-full"
                                        required
                                    />
                                </div>
                                <div className="input-group">
                                    <CalendarIcon className="input-icon"/>
                                    <DatePicker
                                        selected={formData.end_time ? new Date(formData.end_time) : null}
                                        onChange={(date) => setFormData({
                                            ...formData,
                                            end_time: date ? date.toISOString() : ""
                                        })}
                                        showTimeSelect
                                        dateFormat="MMMM d, yyyy h:mm aa"
                                        className="input-light"
                                        placeholderText="End Time"
                                        wrapperClassName="w-full"
                                        required
                                    />
                                </div>
                                <div className="input-group">
                                    <UsersIcon className="input-icon"/>
                                    <input type="number" className="input-light" placeholder="Capacity"
                                           value={formData.capacity || ""}
                                           onChange={e => setFormData({...formData, capacity: Number(e.target.value)})}
                                           required/>
                                </div>
                                <div className="select-wrapper">
                                    <EyeIcon className="input-icon"/>
                                    <select className="select-light" value={formData.visibility}
                                            onChange={e => setFormData({...formData, visibility: e.target.value})}>
                                        <option value="PUBLIC">Public</option>
                                        <option value="PRIVATE">Private</option>
                                    </select>
                                    <ChevronDownIcon className="select-arrow"/>
                                </div>
                            </div>
                        </div>

                        <div className="form-actions">
                            {editingEventId &&
                                <button type="button" onClick={resetForm} className="btn btn-secondary">Cancel</button>}
                            <button type="submit"
                                    className="btn btn-primary">{editingEventId ? "Update Event" : "Create Event"}</button>
                        </div>
                    </div>
                </form>
            )}

            <div className="schedule-card">
                <h3 style={{marginTop: 0, marginBottom: '20px', fontWeight: '800'}}>My Schedule</h3>
                {(!myEvents || myEvents.length === 0) ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '30px',
                        color: '#94a3b8',
                        border: '2px dashed #e2e8f0',
                        borderRadius: '12px'
                    }}>
                        <p>You haven't registered for any events yet.</p>
                    </div>
                ) : (
                    <div className="schedule-grid">
                        {myEvents.map((e) => (
                            <div key={e.event_id}
                                 className={`schedule-item ${e.my_status === 'REGISTERED' ? 'registered' : 'waitlisted'}`}>
                                <div>
                                    <strong style={{fontSize: '1.05rem', display: 'block'}}>{e.title}</strong>
                                    <div style={{
                                        fontSize: '0.85rem',
                                        color: '#64748b',
                                        marginTop: '4px'
                                    }}>📅 {new Date(e.start_time).toLocaleString()}</div>
                                </div>
                                <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                                    <span
                                        className={`badge ${e.my_status === "REGISTERED" ? "badge-public" : "badge-status"}`}>{e.my_status}</span>
                                    {e.my_status === "REGISTERED" &&
                                        <button onClick={() => openFeedbackModal(e.event_id)}
                                                className="btn btn-sm btn-warning">Rate</button>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="toolbar">
                <div className="search-inputs">
                    <div className="input-group" style={{flex: 2}}>
                        <MagnifyingGlassIcon className="input-icon"/>
                        <input className="input-light" placeholder="Search events..." value={searchQuery}
                               onChange={e => setSearchQuery(e.target.value)}/>
                    </div>
                    <div className="input-group" style={{flex: 1}}>
                        <MapPinIcon className="input-icon"/>
                        <input className="input-light" placeholder="Location..." value={searchLocation}
                               onChange={e => setSearchLocation(e.target.value)}/>
                    </div>
                    <div className="select-wrapper" style={{flex: 1}}>
                        <FunnelIcon className="input-icon"/>
                        <select className="select-light" value={searchCategory}
                                onChange={e => setSearchCategory(e.target.value)}>
                            <option value="All">All Categories</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <ChevronDownIcon className="select-arrow"/>
                    </div>
                    <button onClick={() => fetchEvents(searchQuery, searchLocation, searchCategory)}
                            className="btn btn-primary">Search
                    </button>
                    <button onClick={() => {
                        setSearchQuery("");
                        setSearchLocation("");
                        setSearchCategory("All");
                        fetchEvents("", "", "All")
                    }} className="btn btn-text">Clear
                    </button>
                </div>
                <div className="view-toggle">
                    <button onClick={() => setViewMode("LIST")}
                            className={`toggle-btn ${viewMode === "LIST" ? "active" : ""}`}><ListBulletIcon
                        style={{width: '18px'}}/> List
                    </button>
                    <button onClick={() => setViewMode("CALENDAR")}
                            className={`toggle-btn ${viewMode === "CALENDAR" ? "active" : ""}`}><CalendarDaysIcon
                        style={{width: '18px'}}/> Calendar
                    </button>
                </div>
            </div>

            {loading ? <p style={{textAlign: 'center', color: '#64748b', padding: '40px'}}>Loading...</p> : (
                <>
                    {viewMode === "LIST" ? (
                        <div className="event-grid">
                            {events.length === 0 && <p style={{
                                gridColumn: '1/-1',
                                textAlign: 'center',
                                color: '#64748b',
                                padding: '40px'
                            }}>No events found.</p>}
                            {events.map((evt) => {
                                const status = getMyStatus(evt.id);
                                return (
                                    <div key={evt.id} className="event-card">
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'start'
                                        }}>
                                            <div>
                                                <h4 style={{margin: '0 0 5px 0', fontSize: '18px'}}>{evt.title}</h4>
                                                <span className="badge badge-status" style={{
                                                    background: '#eee',
                                                    color: '#333'
                                                }}>{evt.category || 'General'}</span>
                                            </div>
                                        </div>
                                        <div style={{
                                            marginTop: '10px',
                                            fontSize: '14px',
                                            color: '#555'
                                        }}>📍 {evt.location}</div>
                                        <div style={{
                                            fontSize: '14px',
                                            color: '#555'
                                        }}>📅 {new Date(evt.start_time).toLocaleString()}</div>
                                        <div style={{
                                            fontSize: '14px',
                                            fontWeight: 'bold',
                                            marginTop: '5px',
                                            color: evt.registered_count >= evt.capacity ? '#dc2626' : '#16a34a'
                                        }}>
                                            👥 {evt.registered_count} / {evt.capacity} Spots Filled
                                        </div>
                                        <div className="event-badges">
                                            <span className="badge badge-status">{evt.status}</span>
                                            <span
                                                className={`badge ${evt.visibility === "PRIVATE" ? "badge-private" : "badge-public"}`}>
                                                {evt.visibility === "PRIVATE" ? "Private" : "Public"}
                                            </span>
                                        </div>
                                        <div className="card-actions">
                                            {!status && <button onClick={() => handleRegister(evt.id)}
                                                                className="btn btn-success">Join</button>}
                                            {status === 'REGISTERED' &&
                                                <button onClick={() => handleCancelClick(evt.id)}
                                                        className="btn btn-danger">Cancel</button>}
                                            {status === 'WAITLISTED' &&
                                                <button onClick={() => handleCancelClick(evt.id)}
                                                        className="btn btn-warning">Leave Waitlist</button>}
                                            {canManage && (
                                                <>
                                                    <button onClick={() => handleInviteClick(evt.id)}
                                                            className="btn btn-secondary">Invite
                                                    </button>
                                                    <button onClick={() => handleBulkInvite(evt.id)}
                                                            className="btn btn-secondary">CSV
                                                    </button>
                                                    <button onClick={() => fetchAttendees(evt.id)}
                                                            className="btn btn-info">Manage
                                                    </button>
                                                    <button onClick={() => handleEditClick(evt)}
                                                            className="btn btn-warning">Edit
                                                    </button>
                                                </>
                                            )}
                                            <button onClick={() => setQrModalEvent(evt)}
                                                    className="btn btn-secondary">QR
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <CalendarView events={events} onEventClick={(evt) => {
                            if (canManage && confirm(`Edit event "${evt.title}"?`)) handleEditClick(evt);
                        }}/>
                    )}
                </>
            )}

            {selectedEventId && <div className="modal-overlay" onClick={() => setSelectedEventId(null)}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px'}}>
                        <h3>Attendees</h3>
                        <button onClick={() => setSelectedEventId(null)}>Close</button>
                    </div>
                    <button onClick={() => downloadCsv(selectedEventId)} className="btn btn-success"
                            style={{marginBottom: '10px', width: '100%'}}>Download CSV
                    </button>
                    <table style={{width: '100%'}}>
                        <thead>
                        <tr>
                            <th style={{textAlign: 'left'}}>Email</th>
                            <th>Status</th>
                        </tr>
                        </thead>
                        <tbody>{attendees.map((a, i) => <tr key={i}>
                            <td>{a.email}</td>
                            <td>{a.status}</td>
                        </tr>)}</tbody>
                    </table>
                </div>
            </div>}
            {cancelModalId && <div className="modal-overlay">
                <div className="modal-content" style={{textAlign: 'center', maxWidth: '400px'}}><h3>Confirm</h3>
                    <p>Cancel registration?</p>
                    <div style={{display: 'flex', gap: '10px', justifyContent: 'center'}}>
                        <button onClick={() => setCancelModalId(null)} className="btn btn-secondary">No</button>
                        <button onClick={confirmCancel} className="btn btn-danger">Yes</button>
                    </div>
                </div>
            </div>}
            {inviteModalId && <div className="modal-overlay">
                <div className="modal-content" style={{maxWidth: '400px'}}><h3>Invite</h3><input type="email"
                                                                                                 className="input-light"
                                                                                                 placeholder="Email"
                                                                                                 value={inviteEmail}
                                                                                                 onChange={e => setInviteEmail(e.target.value)}
                                                                                                 style={{
                                                                                                     width: '100%',
                                                                                                     marginBottom: '15px'
                                                                                                 }}/>
                    <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
                        <button onClick={() => setInviteModalId(null)} className="btn btn-secondary">Cancel</button>
                        <button onClick={sendInvite} className="btn btn-submit">Send</button>
                    </div>
                </div>
            </div>}
            {showScanner && (
                <div className="modal-overlay" onClick={() => setShowScanner(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth:'600px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
                            <h3>Check-in Scanner</h3>
                            <button onClick={() => setShowScanner(false)} className="btn-text"><XMarkIcon style={{width:24}}/></button>
                        </div>
                        <CheckInScanner onClose={() => setShowScanner(false)} />
                    </div>
                </div>
            )}
            {feedbackModalId && <div className="modal-overlay">
                <div className="modal-content" style={{maxWidth: '500px', textAlign: 'center'}}><h3>Rate Event</h3>
                    <div className="feedback-stars">{[1, 2, 3, 4, 5].map(s => <button key={s} type="button"
                                                                                      onClick={() => setFeedbackRating(s)}
                                                                                      className={`star-btn ${s <= feedbackRating ? 'selected' : ''}`}>★</button>)}</div>
                    <textarea className="input-light" rows={3} placeholder="Comment..." value={feedbackComment}
                              onChange={e => setFeedbackComment(e.target.value)}
                              style={{width: '100%', marginTop: '10px'}}/>
                    <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px'}}>
                        <button onClick={() => setFeedbackModalId(null)} className="btn btn-secondary">Cancel</button>
                        <button onClick={submitFeedback} className="btn btn-submit">Submit</button>
                    </div>
                </div>
            </div>}
            {qrModalEvent && <div className="modal-overlay" onClick={() => setQrModalEvent(null)}>
                <div className="modal-content" style={{textAlign: 'center', maxWidth: '400px'}}
                     onClick={e => e.stopPropagation()}><h3>Check-in QR</h3><p><b>{qrModalEvent.title}</b></p>
                    <div style={{
                        background: 'white',
                        padding: '20px',
                        display: 'inline-block',
                        border: '1px solid #eee'
                    }}><QRCode value={`event:${qrModalEvent.id}`} size={200}/></div>
                    <p style={{marginTop: '10px'}}>Scan at entrance</p>
                    <button onClick={() => setQrModalEvent(null)} className="btn btn-secondary"
                            style={{marginTop: '20px'}}>Close
                    </button>
                </div>
            </div>}
        </div>
    );
}