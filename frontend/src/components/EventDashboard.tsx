import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import CalendarView from "./CalendarView";
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { useToast } from "../context/ToastContext";
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
}

export default function EventDashboard() {
    const { getAccessTokenSilently } = useAuth0();
    const { showToast } = useToast();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [myEvents, setMyEvents] = useState<any[]>([]);

    // View Mode State
    const [viewMode, setViewMode] = useState<"LIST" | "CALENDAR">("LIST");

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchLocation, setSearchLocation] = useState("");

    // --- MODAL STATES ---
    const [selectedEventId, setSelectedEventId] = useState<number | null>(null); // Manage Attendees
    const [attendees, setAttendees] = useState<any[]>([]);

    const [cancelModalId, setCancelModalId] = useState<number | null>(null); // Cancel Confirmation

    const [inviteModalId, setInviteModalId] = useState<number | null>(null); // Invite User
    const [inviteEmail, setInviteEmail] = useState("");

    // Edit State
    const [editingEventId, setEditingEventId] = useState<number | null>(null);

    // Form Validation State
    const [formError, setFormError] = useState("");
    const [formSuccess, setFormSuccess] = useState("");

    // 👇 NEW: State to trigger a crash for testing
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
    });

    // 👇 NEW: This logic crashes the app intentionally when the button is clicked
    if (simulateCrash) {
        throw new Error("Manual crash triggered for testing Error Boundary!");
    }

    // --- API CALLS ---

    const fetchEvents = async (query = "", loc = "") => {
        try {
            setLoading(true);
            const token = await getAccessTokenSilently();
            const params = new URLSearchParams();
            if (query) params.append("q", query);
            if (loc) params.append("location", loc);

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
        fetchEvents("", "");
        fetchMyEvents();
    }, []);

    // --- HANDLERS ---

    const handleRegister = async (eventId: number) => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`http://localhost:8080/api/registrations?event_id=${eventId}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await res.json();

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
            fetchEvents();

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
                fetchEvents();
            } else {
                const data = await res.json();
                showToast(data.message, "error");
            }
        } catch (err) {
            showToast("Cancellation failed.", "error");
        } finally {
            setCancelModalId(null); // Close modal
        }
    };

    const handleInviteClick = (eventId: number) => {
        setInviteModalId(eventId);
        setInviteEmail(""); // Reset input
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
            setInviteModalId(null); // Close modal
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

    // --- EDIT LOGIC ---
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
            visibility: evt.visibility
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
            visibility: "PUBLIC"
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

            fetchEvents();

            setTimeout(() => {
                setFormSuccess("");
                if (!editingEventId) resetForm();
            }, 3000);

        } catch (error: any) {
            setFormError(error.message);
            showToast(`Error: ${error.message}`, "error");
        }
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h2 style={{fontSize: "24px", fontWeight: "bold"}}>📅 Event Dashboard</h2>

                {/* 👇 NEW: Test Crash Button */}
                <button
                    onClick={() => setSimulateCrash(true)}
                    className="btn btn-danger"
                    style={{ padding: "8px 12px" }}
                >
                    💣 Crash App
                </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className={`form-card ${editingEventId ? "editing" : ""}`}>
                <div className="space-y-12">
                    {formError && <div className="alert-box alert-error">{formError}</div>}
                    {formSuccess && <div className="alert-box alert-success">{formSuccess}</div>}

                    <div className="border-b border-gray-200 pb-12">
                        <h2 className="text-base font-semibold text-gray-900">
                            {editingEventId ? "Edit Event Details" : "Create New Event"}
                        </h2>
                        <p className="mt-1 text-sm text-gray-600">
                            This information will be displayed publicly on the event calendar.
                        </p>

                        <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                            <div className="sm:col-span-4">
                                <label htmlFor="title" className="block text-sm font-medium text-gray-900">Event Title</label>
                                <div className="mt-2">
                                    <input type="text" name="title" id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="input-light" placeholder="e.g. Annual Hackathon" required />
                                </div>
                            </div>
                            <div className="col-span-full">
                                <label htmlFor="description" className="block text-sm font-medium text-gray-900">Description</label>
                                <div className="mt-2">
                                    <textarea name="description" id="description" rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-light" placeholder="Write a few sentences about the event." />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-b border-gray-200 pb-12">
                        <h2 className="text-base font-semibold text-gray-900">Logistics & Settings</h2>
                        <p className="mt-1 text-sm text-gray-600">Set the location, time, and capacity constraints.</p>

                        <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
                            <div className="col-span-full">
                                <label htmlFor="location" className="block text-sm font-medium text-gray-900">Location / Address</label>
                                <div className="mt-2">
                                    <input type="text" name="location" id="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="input-light" required />
                                </div>
                            </div>
                            <div className="sm:col-span-3">
                                <label htmlFor="start-time" className="block text-sm font-medium text-gray-900">Start Time</label>
                                <div className="mt-2">
                                    <input type="datetime-local" name="start-time" id="start-time" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} className="input-light" required />
                                </div>
                            </div>
                            <div className="sm:col-span-3">
                                <label htmlFor="end-time" className="block text-sm font-medium text-gray-900">End Time</label>
                                <div className="mt-2">
                                    <input type="datetime-local" name="end-time" id="end-time" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} className="input-light" required />
                                </div>
                            </div>
                            <div className="sm:col-span-3">
                                <label htmlFor="capacity" className="block text-sm font-medium text-gray-900">Capacity</label>
                                <div className="mt-2">
                                    <input type="number" name="capacity" id="capacity" value={formData.capacity || ""} onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })} className="input-light" required />
                                </div>
                            </div>
                            <div className="sm:col-span-3">
                                <label htmlFor="visibility" className="block text-sm font-medium text-gray-900">Visibility</label>
                                <div className="mt-2 grid grid-cols-1">
                                    <div className="select-wrapper">
                                        <select id="visibility" name="visibility" value={formData.visibility} onChange={(e) => setFormData({ ...formData, visibility: e.target.value })} className="select-light">
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
                    {editingEventId && (
                        <button type="button" onClick={resetForm} className="btn-text">Cancel</button>
                    )}
                    <button type="submit" className="btn-submit">
                        {editingEventId ? "Update Event" : "Create Event"}
                    </button>
                </div>
            </form>

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
                                <span className={`badge ${e.my_status === "REGISTERED" ? "badge-public" : "badge-status"}`}>
                                    {e.my_status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Search & Toggles */}
            <div className="action-bar">
                <div style={{display:'flex', gap:'10px', flex: 1}}>
                    <input placeholder="🔍 Search title or desc..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{padding:'10px', border:'1px solid #ccc', borderRadius:'4px', flex: 1}} />
                    <input placeholder="📍 Location..." value={searchLocation} onChange={(e) => setSearchLocation(e.target.value)} style={{padding:'10px', width:'150px', border:'1px solid #ccc', borderRadius:'4px'}} />
                    <button onClick={() => fetchEvents(searchQuery, searchLocation)} className="btn btn-secondary">Search</button>
                    <button onClick={() => {setSearchQuery(""); setSearchLocation(""); fetchEvents("", "")}} className="btn btn-secondary">Clear</button>
                </div>
                <div>
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
                            {events.map((evt) => (
                                <div key={evt.id} className="event-card">
                                    <h4 style={{margin:'0 0 10px 0', fontSize:'18px'}}>{evt.title}</h4>
                                    <div style={{fontSize:'14px', color:'#555'}}>📍 {evt.location}</div>
                                    <div style={{fontSize:'14px', color:'#555'}}>📅 {new Date(evt.start_time).toLocaleString()}</div>

                                    <div className="event-badges">
                                        <span className="badge badge-status">{evt.status}</span>
                                        <span className={`badge ${evt.visibility === "PRIVATE" ? "badge-private" : "badge-public"}`}>
                                            {evt.visibility === "PRIVATE" ? "Private" : "Public"}
                                        </span>
                                    </div>

                                    <div className="card-actions">
                                        <button onClick={() => handleRegister(evt.id)} className="btn btn-success">Join</button>
                                        <button onClick={() => handleCancelClick(evt.id)} className="btn btn-danger">Cancel</button>
                                        <button onClick={() => handleInviteClick(evt.id)} className="btn btn-secondary">Invite</button>
                                        <button onClick={() => handleBulkInvite(evt.id)} className="btn btn-secondary">CSV</button>
                                        <button onClick={() => fetchAttendees(evt.id)} className="btn btn-info">Manage</button>
                                        <button onClick={() => handleEditClick(evt)} className="btn btn-warning">Edit</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <CalendarView
                            events={events}
                            onEventClick={(evt) => { if(confirm(`Edit event "${evt.title}"?`)) handleEditClick(evt); }}
                        />
                    )}
                </>
            )}

            {/* --- MODALS --- */}

            {/* 1. Attendee Management Modal */}
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

            {/* 2. Cancel Confirmation Modal */}
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

            {/* 3. Invite User Modal */}
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

        </div>
    );
}