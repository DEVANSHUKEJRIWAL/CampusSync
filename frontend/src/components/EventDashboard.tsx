import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import CalendarView from "./CalendarView"; // 👈 Import the Calendar Component

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
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [myEvents, setMyEvents] = useState<any[]>([]);

    // 👇 NEW: View Mode State (List vs Calendar)
    const [viewMode, setViewMode] = useState<"LIST" | "CALENDAR">("LIST");

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchLocation, setSearchLocation] = useState("");

    // Manage Attendees State
    const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
    const [attendees, setAttendees] = useState<any[]>([]);

    // Edit State
    const [editingEventId, setEditingEventId] = useState<number | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        location: "",
        start_time: "",
        end_time: "",
        capacity: 0,
        visibility: "PUBLIC",
    });

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
        } catch (e) { console.error(e); }
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
                alert(`⚠️ ${data.message || "Error registering"}`);
                return;
            }

            if (data.status === "REGISTERED") {
                alert("✅ Success! You are registered.");
            } else if (data.status === "WAITLISTED") {
                alert("bf Warning: Event is full. You are on the WAITLIST.");
            }

            fetchMyEvents();
            fetchEvents();

        } catch (error: any) {
            console.error("Detailed Error:", error);
            alert(`Registration failed: ${error.message || error}`);
        }
    };

    const handleCancel = async (eventId: number) => {
        if (!confirm("Are you sure you want to cancel registration?")) return;

        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`http://localhost:8080/api/registrations?event_id=${eventId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                alert("Registration cancelled.");
                fetchMyEvents();
                fetchEvents();
            } else {
                const data = await res.json();
                alert(data.message);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleInvite = async (eventId: number) => {
        const email = prompt("Enter the email to invite:");
        if (!email) return;

        try {
            const token = await getAccessTokenSilently();
            const res = await fetch("http://localhost:8080/api/events/invite", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ event_id: eventId, email: email }),
            });

            if (res.ok) {
                alert("✅ User invited successfully!");
            } else {
                alert("❌ Failed to invite user.");
            }
        } catch (err) {
            console.error(err);
            alert("Error sending invitation.");
        }
    };

    // --- EDIT LOGIC ---
    const handleEditClick = (evt: Event) => {
        setEditingEventId(evt.id);

        // Format dates for datetime-local input (slice to remove seconds/timezone)
        // Safely handle if end_time is missing or invalid
        const start = new Date(evt.start_time).toISOString().slice(0, 16);

        let end = "";
        if (evt.end_time) {
            end = new Date(evt.end_time).toISOString().slice(0, 16);
        } else {
            // Default end time to start + 1 hour
            const d = new Date(evt.start_time);
            d.setHours(d.getHours() + 1);
            end = d.toISOString().slice(0, 16);
        }

        setFormData({
            title: evt.title,
            description: evt.description,
            location: evt.location,
            start_time: start,
            end_time: end,
            capacity: evt.capacity,
            visibility: evt.visibility
        });

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
            visibility: "PUBLIC"
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = await getAccessTokenSilently();
            const payload = {
                ...formData,
                capacity: Number(formData.capacity),
                start_time: new Date(formData.start_time).toISOString(),
                end_time: new Date(formData.end_time).toISOString(),
                id: editingEventId // Include ID if editing
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

            alert(editingEventId ? "Event Updated!" : "Event Created!");
            fetchEvents();
            resetForm();

        } catch (error: any) {
            console.error(error);
            alert(`Error: ${error.message}`);
        }
    };

    const handleBulkInvite = async (eventId: number) => {
        // Create a hidden file input dynamically
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
                    headers: { Authorization: `Bearer ${token}` }, // Note: DO NOT set Content-Type for FormData, browser does it automatically
                    body: formData,
                });

                if (res.ok) {
                    const data = await res.json();
                    alert(`✅ Success! Processed ${data.count} emails.`);
                } else {
                    alert("❌ Failed to upload.");
                }
            } catch (err) {
                console.error(err);
                alert("Upload error.");
            }
        };

        input.click(); // Open the file picker dialog
    };

    return (
        <div style={{ marginTop: "20px", borderTop: "1px solid #ccc", paddingTop: "20px" }}>
            <h2>📅 Event Dashboard</h2>

            {/* --- CREATE / EDIT FORM --- */}
            <div style={{ background: "#f9f9f9", padding: "15px", borderRadius: "8px", marginBottom: "20px", border: editingEventId ? "2px solid #ffc107" : "1px solid #ddd" }}>
                <h3>{editingEventId ? "✏️ Edit Event" : "➕ Create New Event"}</h3>
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "400px" }}>
                    <input placeholder="Event Title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
                    <textarea placeholder="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                    <input placeholder="Location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} required />

                    <div style={{ display: "flex", gap: "10px" }}>
                        <label>Start: <input type="datetime-local" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} required /></label>
                        <label>End: <input type="datetime-local" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} required /></label>
                    </div>

                    <input type="number" placeholder="Capacity" value={formData.capacity || ""} onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })} required />

                    <label style={{ display: "flex", flexDirection: "column", fontSize: "14px" }}>
                        Visibility:
                        <select
                            value={formData.visibility}
                            onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                            style={{ padding: "8px", marginTop: "5px" }}
                        >
                            <option value="PUBLIC">Public</option>
                            <option value="PRIVATE">Private (Invite Only)</option>
                        </select>
                    </label>

                    <div style={{ display: "flex", gap: "10px" }}>
                        <button type="submit" style={{ flex: 1, background: editingEventId ? "#ffc107" : "#007bff", color: editingEventId ? "black" : "white", padding: "10px", border: "none", cursor: "pointer" }}>
                            {editingEventId ? "Update Event" : "Create Event"}
                        </button>

                        {editingEventId && (
                            <button
                                type="button"
                                onClick={resetForm}
                                style={{ background: "#6c757d", color: "white", padding: "10px", border: "none", cursor: "pointer" }}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* --- MY SCHEDULE --- */}
            <div style={{ marginBottom: "30px", padding: "20px", background: "#e3f2fd", borderRadius: "8px", border: "1px solid #bbdefb" }}>
                <h3 style={{ marginTop: 0 }}>🎫 My Schedule</h3>

                {(!myEvents || myEvents.length === 0) ? (
                    <p style={{ color: "#666" }}>You haven't registered for any events yet.</p>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {myEvents.map((e) => (
                            <div key={e.event_id} style={{ background: "white", padding: "10px", borderRadius: "5px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <strong>{e.title}</strong>
                                    <span style={{ color: "#666", fontSize: "14px", marginLeft: "10px" }}>
                                        📅 {new Date(e.start_time).toLocaleString()}
                                    </span>
                                </div>
                                <span style={{
                                    padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "bold",
                                    background: e.my_status === "REGISTERED" ? "#28a745" : "#ffc107",
                                    color: e.my_status === "REGISTERED" ? "white" : "black"
                                }}>
                                    {e.my_status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* --- SEARCH BAR & VIEW TOGGLE --- */}
            <div style={{ marginBottom: "20px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: "10px", flex: 1 }}>
                    <input
                        placeholder="🔍 Search title or desc..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ padding: "10px", flex: 1, minWidth: "200px" }}
                    />
                    <input
                        placeholder="📍 Location..."
                        value={searchLocation}
                        onChange={(e) => setSearchLocation(e.target.value)}
                        style={{ padding: "10px", width: "150px" }}
                    />
                    <button
                        onClick={() => fetchEvents(searchQuery, searchLocation)}
                        style={{ padding: "10px 20px", background: "#333", color: "white", border: "none", cursor: "pointer", borderRadius: "5px" }}
                    >
                        Search
                    </button>
                    <button
                        onClick={() => {
                            setSearchQuery("");
                            setSearchLocation("");
                            fetchEvents("", "");
                        }}
                        style={{ padding: "10px", background: "#ccc", border: "none", cursor: "pointer", borderRadius: "5px" }}
                    >
                        Clear
                    </button>
                </div>

                {/* 👇 VIEW TOGGLE BUTTONS */}
                <div style={{ display: "flex" }}>
                    <button
                        onClick={() => setViewMode("LIST")}
                        style={{ padding: '10px 16px', background: viewMode === "LIST" ? '#007bff' : '#e9ecef', color: viewMode === "LIST" ? 'white' : 'black', border: '1px solid #ccc', borderRight: 'none', borderTopLeftRadius: '5px', borderBottomLeftRadius: '5px', cursor: 'pointer' }}
                    >
                        List
                    </button>
                    <button
                        onClick={() => setViewMode("CALENDAR")}
                        style={{ padding: '10px 16px', background: viewMode === "CALENDAR" ? '#007bff' : '#e9ecef', color: viewMode === "CALENDAR" ? 'white' : 'black', border: '1px solid #ccc', borderTopRightRadius: '5px', borderBottomRightRadius: '5px', cursor: 'pointer' }}
                    >
                        Calendar
                    </button>
                </div>
            </div>

            {/* --- EVENT LIST / CALENDAR VIEW --- */}
            <h3>Upcoming Events</h3>
            {loading ? <p>Loading...</p> : (
                <>
                    {viewMode === "LIST" ? (
                        // --- LIST VIEW ---
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "20px" }}>
                            {events.length === 0 && <p>No events found.</p>}
                            {events.map((evt) => (
                                <div key={evt.id} style={{ border: "1px solid #ddd", padding: "15px", borderRadius: "8px", position: "relative" }}>
                                    <h4>{evt.title}</h4>
                                    <p style={{ fontSize: "14px", color: "#666" }}>📍 {evt.location}</p>
                                    <p style={{ fontSize: "12px" }}>📅 {new Date(evt.start_time).toLocaleString()}</p>
                                    <p>Capacity: {evt.capacity}</p>

                                    <p style={{ fontSize: "12px", fontWeight: "bold", color: evt.visibility === "PRIVATE" ? "red" : "green" }}>
                                        {evt.visibility === "PRIVATE" ? "🔒 Private" : "🌍 Public"}
                                    </p>

                                    <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ background: "#e1ecf4", color: "#007bff", padding: "2px 6px", borderRadius: "4px", fontSize: "12px" }}>
                                            {evt.status}
                                        </span>

                                        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                                            <button onClick={() => handleRegister(evt.id)} style={{ background: "#28a745", color: "white", border: "none", padding: "5px 8px", borderRadius: "4px", cursor: "pointer" }}>
                                                Join
                                            </button>

                                            <button onClick={() => handleCancel(evt.id)} style={{ background: "#dc3545", color: "white", border: "none", padding: "5px 8px", borderRadius: "4px", cursor: "pointer" }}>
                                                Cancel
                                            </button>

                                            <button onClick={() => handleInvite(evt.id)} style={{ background: "#6c757d", color: "white", border: "none", padding: "5px 8px", borderRadius: "4px", cursor: "pointer" }}>
                                                Invite
                                            </button>

                                            <button
                                                onClick={() => handleBulkInvite(evt.id)}
                                                style={{ background: "#6610f2", color: "white", border: "none", padding: "5px 8px", borderRadius: "4px", cursor: "pointer" }}
                                            >
                                                Bulk CSV
                                            </button>

                                            <button onClick={() => fetchAttendees(evt.id)} style={{ background: "#17a2b8", color: "white", border: "none", padding: "5px 8px", borderRadius: "4px", cursor: "pointer" }}>
                                                Manage
                                            </button>

                                            <button onClick={() => handleEditClick(evt)} style={{ background: "#ffc107", color: "black", border: "none", padding: "5px 8px", borderRadius: "4px", cursor: "pointer" }}>
                                                Edit
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        // --- 👇 NEW: CALENDAR VIEW COMPONENT ---
                        <CalendarView
                            events={events}
                            onEventClick={(evt) => {
                                if(confirm(`Edit event "${evt.title}"?`)) {
                                    handleEditClick(evt);
                                }
                            }}
                        />
                    )}
                </>
            )}

            {/* --- MANAGE ATTENDEES MODAL --- */}
            {selectedEventId && (
                <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <div style={{ background: "white", padding: "20px", borderRadius: "8px", width: "500px", maxHeight: "80vh", overflowY: "auto" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3>👥 Attendee List</h3>
                            <button onClick={() => setSelectedEventId(null)} style={{ cursor: "pointer" }}>❌ Close</button>
                        </div>

                        <button onClick={() => downloadCsv(selectedEventId)} style={{ marginBottom: "15px", padding: "8px", background: "#28a745", color: "white", border: "none", cursor: "pointer" }}>
                            📥 Download CSV
                        </button>

                        <table style={{ width: "100%", textAlign: "left", fontSize: "14px" }}>
                            <thead>
                            <tr style={{ borderBottom: "1px solid #ccc" }}>
                                <th>Email</th>
                                <th>Status</th>
                            </tr>
                            </thead>
                            <tbody>
                            {attendees.length === 0 && <tr><td colSpan={2}>No attendees yet.</td></tr>}
                            {attendees.map((a, idx) => (
                                <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                                    <td style={{ padding: "8px" }}>{a.email}</td>
                                    <td>{a.status}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}