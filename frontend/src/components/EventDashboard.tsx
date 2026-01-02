import {useEffect, useState} from "react";
import {useAuth0} from "@auth0/auth0-react";
import CalendarView from "./CalendarView";
import {
    ChevronDownIcon, BellIcon,
    MapPinIcon, CalendarIcon, UsersIcon, TagIcon, EyeIcon, PencilSquareIcon,
    MagnifyingGlassIcon, ListBulletIcon, CalendarDaysIcon, FunnelIcon, QrCodeIcon, XMarkIcon,
    ComputerDesktopIcon, TicketIcon, ClipboardDocumentListIcon, PlusIcon, TrashIcon
} from '@heroicons/react/20/solid';
import {useToast} from "../context/ToastContext";
import QRCode from "react-qr-code";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import CheckInScanner from "./CheckInScanner.tsx";
import "./EventDashboard.css";
import Chatbot from "./Chatbot";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

// --- NEW INTERFACES ---
interface CustomField {
    label: string;
    type: "text" | "number" | "boolean";
    required: boolean;
}

interface TicketType {
    name: string;
    price: number;
    capacity: number;
}

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
    // New fields
    is_recurring?: boolean;
    custom_fields?: CustomField[];
    ticket_types?: TicketType[];
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

    // Data State
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [myEvents, setMyEvents] = useState<any[]>([]);
    const [userRole, setUserRole] = useState("Loading...");
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [myBadges, setMyBadges] = useState<any[]>([]);
    const [attendees, setAttendees] = useState<any[]>([]);

    // --- COMMUNITY FEATURE STATE ---
    const [communityModalEvent, setCommunityModalEvent] = useState<Event | null>(null);
    const [activeTab, setActiveTab] = useState<"DETAILS" | "CHAT" | "PHOTOS" | "ATTENDEES">("DETAILS");
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState("");
    const [photos, setPhotos] = useState<any[]>([]);
    const [newPhotoUrl, setNewPhotoUrl] = useState("");

    // UI State
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const [viewMode, setViewMode] = useState<"LIST" | "CALENDAR">("LIST");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchLocation, setSearchLocation] = useState("");
    const [searchCategory, setSearchCategory] = useState("All");

    // Modal States
    const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
    const [cancelModalId, setCancelModalId] = useState<number | null>(null);
    const [inviteModalId, setInviteModalId] = useState<number | null>(null);
    const [inviteEmail, setInviteEmail] = useState("");
    const [qrModalEvent, setQrModalEvent] = useState<Event | null>(null);
    const [feedbackModalId, setFeedbackModalId] = useState<number | null>(null);
    const [feedbackRating, setFeedbackRating] = useState(5);
    const [feedbackComment, setFeedbackComment] = useState("");
    const [showScanner, setShowScanner] = useState(false);

    // --- NEW FEATURES STATE ---
    const [kioskMode, setKioskMode] = useState(false);
    const [kioskEmail, setKioskEmail] = useState("");
    const [kioskMessage, setKioskMessage] = useState<{ text: string, type: "success" | "error" } | null>(null);

    // Registration Modal
    const [registerModalEvent, setRegisterModalEvent] = useState<Event | null>(null);
    const [regAnswers, setRegAnswers] = useState<any>({});
    const [selectedTicket, setSelectedTicket] = useState<string>("");

    // Form State (Updated)
    const [editingEventId, setEditingEventId] = useState<number | null>(null);
    const [formError, setFormError] = useState("");
    const [formSuccess, setFormSuccess] = useState("");
    const [formData, setFormData] = useState({
        title: "", description: "", location: "",
        start_time: "", end_time: "",
        capacity: 0, visibility: "PUBLIC", category: "General",
        is_recurring: false,           // New
        custom_fields: [] as CustomField[], // New
        ticket_types: [] as TicketType[]    // New
    });

    // --- FETCHERS ---
    const fetchLeaderboard = async () => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/leaderboard`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) setLeaderboard(await res.json() || []);
        } catch (e) { console.error(e); }
    };

    const fetchBadges = async () => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/users/badges`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) setMyBadges(await res.json() || []);
        } catch (e) { console.error(e); }
    };

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
        } catch (error) { console.error(error); }
    };

    const fetchNotifications = async () => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/notifications`, {headers: {Authorization: `Bearer ${token}`}});
            if (res.ok) setNotifications(await res.json() || []);
        } catch (err) { console.error(err); }
    };

    const markNotificationsRead = async () => {
        try {
            const token = await getAccessTokenSilently();
            await fetch(`${API_URL}/api/notifications/read`, { method: "POST", headers: {Authorization: `Bearer ${token}`} });
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
            const res = await fetch(`${API_URL}/api/events?${params.toString()}`, {headers: {Authorization: `Bearer ${token}`}});
            if (res.ok) setEvents(await res.json() || []);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    const fetchMyEvents = async () => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/registrations/me`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) setMyEvents(await res.json() || []);
        } catch (err) { console.error(err); }
    };

    const fetchAttendees = async (id: number) => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/events/attendees?event_id=${id}`, {headers: {Authorization: `Bearer ${token}`}});
            if (res.ok) {
                setAttendees(await res.json() || []);
            }
        } catch (e) { console.error(e); }
    };

    const fetchComments = async (id: number) => {
        const res = await fetch(`${API_URL}/api/events/comments?event_id=${id}`);
        if(res.ok) setComments(await res.json() || []);
    };
    const fetchPhotos = async (id: number) => {
        const res = await fetch(`${API_URL}/api/events/photos?event_id=${id}`);
        if(res.ok) setPhotos(await res.json() || []);
    };
    const submitComment = async () => {
        if(!communityModalEvent || !newComment) return;
        const token = await getAccessTokenSilently();
        await fetch(`${API_URL}/api/events/comments`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
            body: JSON.stringify({event_id: communityModalEvent.id, text: newComment})
        });
        setNewComment("");
        fetchComments(communityModalEvent.id);
    };
    const submitPhoto = async () => {
        if(!communityModalEvent || !newPhotoUrl) return;
        const token = await getAccessTokenSilently();
        await fetch(`${API_URL}/api/events/photos`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
            body: JSON.stringify({event_id: communityModalEvent.id, url: newPhotoUrl})
        });
        setNewPhotoUrl("");
        fetchPhotos(communityModalEvent.id);
    };

    useEffect(() => {
        fetchEvents("", "", "All");
        if (isAuthenticated && user) {
            fetchMyEvents();
            fetchUserProfile();
            fetchNotifications();
            fetchBadges();
            fetchLeaderboard();
        }
    }, [user, isAuthenticated]);

    // --- NEW LOGIC: Kiosk & Registration ---

    const handleKioskCheckIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setKioskMessage(null); // Clear previous messages

        try {
            // 1. Send Request (No Token)
            const res = await fetch(`${API_URL}/api/events/checkin/self`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: kioskEmail })
            });

            // 2. Handle Response (Text or JSON)
            const contentType = res.headers.get("content-type");
            let data;
            if (contentType && contentType.indexOf("application/json") !== -1) {
                data = await res.json();
            } else {
                const text = await res.text();
                data = { message: text };
            }

            // 3. Show Result
            if (res.ok) {
                setKioskMessage({ text: `✅ ${data.message || "Checked in!"}`, type: "success" });
                setKioskEmail(""); // Clear input for next person

                // Optional: Clear success message after 3 seconds
                setTimeout(() => setKioskMessage(null), 3000);
            } else {
                setKioskMessage({ text: `❌ ${data.message || "Check-in failed"}`, type: "error" });
            }
        } catch (err) {
            setKioskMessage({ text: "⚠️ Connection Error. Please try again.", type: "error" });
        }
    };

    const handleJoinClick = (evt: Event) => {
        // If event has no complex fields or tickets, just register
        if ((!evt.custom_fields || evt.custom_fields.length === 0) && (!evt.ticket_types || evt.ticket_types.length === 0)) {
            submitRegistration(evt.id, {}, "General Admission");
        } else {
            // Open Modal
            setRegisterModalEvent(evt);
            setRegAnswers({});
            if (evt.ticket_types && evt.ticket_types.length > 0) {
                setSelectedTicket(evt.ticket_types[0].name);
            } else {
                setSelectedTicket("General Admission");
            }
        }
    };

    const submitRegistration = async (eventId: number, answers: any, ticketType: string) => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/registrations?event_id=${eventId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    custom_answers: answers,
                    ticket_type: ticketType
                })
            });
            const data = await res.json();
            if (res.status === 429) { showToast("⏳ Too many requests!", "error"); return; }
            if (!res.ok) { showToast(`⚠️ ${data.message || "Error registering"}`, "error"); return; }

            if (data.status === "REGISTERED") showToast("Success!", "success");
            else if (data.status === "WAITLISTED") showToast("Waitlisted.", "success");

            setRegisterModalEvent(null);
            await fetchMyEvents();
            await fetchEvents(searchQuery, searchLocation, searchCategory);
        } catch (error: any) { showToast(`Error: ${error.message}`, "error"); }
    };

    // --- FORM HELPERS (NEW) ---
    const addCustomField = () => {
        setFormData({
            ...formData,
            custom_fields: [...formData.custom_fields, { label: "", type: "text", required: false }]
        });
    };
    const updateCustomField = (index: number, field: string, value: any) => {
        const updated = [...formData.custom_fields];
        updated[index] = { ...updated[index], [field]: value };
        setFormData({ ...formData, custom_fields: updated });
    };
    const removeCustomField = (index: number) => {
        const updated = formData.custom_fields.filter((_, i) => i !== index);
        setFormData({ ...formData, custom_fields: updated });
    };
    const addTicketType = () => {
        setFormData({
            ...formData,
            ticket_types: [...formData.ticket_types, { name: "", capacity: 0, price: 0 }]
        });
    };
    const updateTicketType = (index: number, field: string, value: any) => {
        const updated = [...formData.ticket_types];
        updated[index] = { ...updated[index], [field]: value };
        setFormData({ ...formData, ticket_types: updated });
    };
    const removeTicketType = (index: number) => {
        const updated = formData.ticket_types.filter((_, i) => i !== index);
        setFormData({ ...formData, ticket_types: updated });
    };

    // --- STANDARD ACTIONS ---

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
        } catch (e) { showToast("Failed to download CSV.", "error"); }
    };

    const addToCalendar = (evt: any) => {
        if (!evt.start_time) return;
        const startDate = new Date(evt.start_time);
        const endDate = evt.end_time ? new Date(evt.end_time) : new Date(startDate.getTime() + 60 * 60 * 1000);
        const format = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
        const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(evt.title)}&dates=${format(startDate)}/${format(endDate)}&details=${encodeURIComponent(evt.description || "")}&location=${encodeURIComponent(evt.location || "")}`;
        window.open(url, "_blank");
    };

    const downloadCertificate = async (eventId: number, eventTitle: string) => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/events/certificate?event_id=${eventId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Certificate not available");
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Certificate - ${eventTitle}.pdf`;
            a.click();
            showToast("🎓 Certificate Downloaded!", "success");
        } catch (e) { showToast("Failed to download certificate", "error"); }
    };

    const handleCancelClick = (id: number) => { setCancelModalId(id); };
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
            } else {
                const data = await res.json();
                showToast(data.message, "error");
            }
        } catch (err) { showToast("Cancellation failed.", "error"); } finally { setCancelModalId(null); }
    };

    const handleInviteClick = (id: number) => { setInviteModalId(id); setInviteEmail(""); };
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
        } catch (err) { showToast("Error sending invitation.", "error"); } finally { setInviteModalId(null); }
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
                } else showToast("Failed to upload.", "error");
            } catch (err) { showToast("Upload error.", "error"); }
        };
        input.click();
    };

    const openFeedbackModal = (id: number) => { setFeedbackModalId(id); setFeedbackRating(5); setFeedbackComment(""); };
    const submitFeedback = async () => {
        if (!feedbackModalId) return;
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/events/feedback`, {
                method: "POST",
                headers: {"Content-Type": "application/json", Authorization: `Bearer ${token}`},
                body: JSON.stringify({event_id: feedbackModalId, rating: feedbackRating, comment: feedbackComment})
            });
            if (res.ok) { showToast("Feedback submitted!", "success"); setFeedbackModalId(null); } else showToast("Failed.", "error");
        } catch (error) { showToast("Error.", "error"); }
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
            category: evt.category || "General",
            is_recurring: evt.is_recurring || false,
            custom_fields: evt.custom_fields || [],
            ticket_types: evt.ticket_types || []
        });
        window.scrollTo({top: 0, behavior: 'smooth'});
    };

    const resetForm = () => {
        setEditingEventId(null);
        setFormData({
            title: "", description: "", location: "", start_time: "", end_time: "",
            capacity: 0, visibility: "PUBLIC", category: "General",
            is_recurring: false, custom_fields: [], ticket_types: []
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError("");
        setFormSuccess("");

        const start = new Date(formData.start_time);
        const end = new Date(formData.end_time);
        if (!formData.start_time || !formData.end_time) { setFormError("Dates are required."); return; }
        if (end <= start) { setFormError("End time must be after start time."); return; }
        if (formData.capacity <= 0) { setFormError("Capacity must be positive."); return; }

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

            if (!editingEventId) resetForm();
            await fetchEvents(searchQuery, searchLocation, searchCategory);

            setTimeout(() => { setFormSuccess(""); if(editingEventId) resetForm(); }, 3000);
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

    // --- RENDER: KIOSK MODE ---
    if (kioskMode) {
        return (
            <div className="kiosk-container" style={{height:'100vh', background:'#f8fafc', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', zIndex:9999}}>
                <button onClick={() => setKioskMode(false)} style={{position:'absolute', top:20, right:20}} className="btn btn-secondary">Exit Kiosk</button>

                <div style={{background:'white', padding:'60px', borderRadius:'24px', boxShadow:'0 25px 50px -12px rgba(0, 0, 0, 0.25)', textAlign:'center', width:'100%', maxWidth:'600px'}}>
                    <h1 style={{fontSize:'3rem', marginBottom:'10px', color:'#4f46e5'}}>👋 Welcome!</h1>
                    <p style={{fontSize:'1.2rem', color:'#64748b', marginBottom:'40px'}}>Self Check-In Kiosk</p>

                    <form onSubmit={handleKioskCheckIn}>
                        <input
                            type="email"
                            className="input-light"
                            style={{fontSize:'1.5rem', padding:'20px', textAlign:'center', marginBottom:'20px', width:'100%', boxSizing:'border-box'}}
                            placeholder="Enter your email..."
                            value={kioskEmail}
                            onChange={e => setKioskEmail(e.target.value)}
                            required
                            autoFocus
                        />
                        <button type="submit" className="btn btn-primary" style={{width:'100%', fontSize:'1.5rem', padding:'20px'}}>Check In</button>
                    </form>

                    {kioskMessage && (
                        <div style={{
                            marginTop: '30px',
                            padding: '15px',
                            borderRadius: '8px',
                            fontSize: '1.2rem',
                            fontWeight: 'bold',
                            background: kioskMessage.type === 'success' ? '#dcfce7' : '#fee2e2',
                            color: kioskMessage.type === 'success' ? '#166534' : '#991b1b'
                        }}>
                            {kioskMessage.text}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // --- RENDER: MAIN DASHBOARD ---
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
                        <>
                            <button onClick={() => setKioskMode(true)} className="btn btn-secondary" style={{display:'flex', alignItems:'center', gap:'6px', padding:'10px 16px'}}>
                                <ComputerDesktopIcon style={{width:'20px'}} /> Kiosk
                            </button>
                            <button onClick={() => setShowScanner(true)} className="btn btn-primary" style={{display:'flex', alignItems:'center', gap:'6px', padding:'10px 16px'}}>
                                <QrCodeIcon style={{width:'20px'}} /> Scan
                            </button>
                        </>
                    )}

                    <div className="user-badge" style={{background: 'white', padding: '8px 16px', borderRadius: '24px', fontSize: '14px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display:'flex', alignItems:'center', gap:'8px'}}>
                        <span style={{color: '#6b7280'}}>Logged in as:</span> <strong style={{color: '#111827'}}>{user?.email}</strong>
                        <span style={{background: '#4f46e5', color:'white', padding:'2px 10px', borderRadius:'12px', fontSize:'11px', fontWeight: 'bold', textTransform: 'uppercase'}}>{userRole}</span>
                    </div>
                </div>
            </div>

            {/* CREATE / EDIT FORM */}
            {canManage && (
                <form onSubmit={handleSubmit} className={`form-card ${editingEventId ? "editing" : ""}`}>
                    <div className="form-header">
                        <h3>{editingEventId ? "Edit Event" : "➕ Create New Event"}</h3>
                    </div>
                    <div className="form-body">
                        {formError && <div className="alert-box alert-error">{formError}</div>}
                        {formSuccess && <div className="alert-box alert-success">{formSuccess}</div>}

                        <div className="form-section">
                            <div className="section-title"><PencilSquareIcon style={{width: '20px', color: '#4f46e5'}}/> Basic Details</div>
                            <div className="grid-2">
                                <div className="input-group">
                                    <PencilSquareIcon className="input-icon"/>
                                    <input className="input-light" placeholder="Event Title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required/>
                                </div>
                                <div className="select-wrapper">
                                    <TagIcon className="input-icon"/>
                                    <select className="select-light" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <ChevronDownIcon className="select-arrow"/>
                                </div>
                                <div className="grid-full">
                                    <textarea className="input-light" placeholder="Description..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}/>
                                </div>
                            </div>
                        </div>

                        <div className="form-section">
                            <div className="section-title"><MapPinIcon style={{width: '20px', color: '#4f46e5'}}/> Logistics</div>
                            <div className="grid-2">
                                <div className="input-group grid-full">
                                    <MapPinIcon className="input-icon"/>
                                    <input className="input-light" placeholder="Location" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} required/>
                                </div>
                                <div className="input-group">
                                    <CalendarIcon className="input-icon"/>
                                    <DatePicker selected={formData.start_time ? new Date(formData.start_time) : null} onChange={(date) => setFormData({...formData, start_time: date ? date.toISOString() : ""})} showTimeSelect dateFormat="MMMM d, yyyy h:mm aa" className="input-light" placeholderText="Start Time" wrapperClassName="w-full" required />
                                </div>
                                <div className="input-group">
                                    <CalendarIcon className="input-icon"/>
                                    <DatePicker selected={formData.end_time ? new Date(formData.end_time) : null} onChange={(date) => setFormData({...formData, end_time: date ? date.toISOString() : ""})} showTimeSelect dateFormat="MMMM d, yyyy h:mm aa" className="input-light" placeholderText="End Time" wrapperClassName="w-full" required />
                                </div>
                                <div className="input-group">
                                    <UsersIcon className="input-icon"/>
                                    <input type="number" className="input-light" placeholder="Capacity" value={formData.capacity || ""} onChange={e => setFormData({...formData, capacity: Number(e.target.value)})} required/>
                                </div>
                                <div className="select-wrapper">
                                    <EyeIcon className="input-icon"/>
                                    <select className="select-light" value={formData.visibility} onChange={e => setFormData({...formData, visibility: e.target.value})}>
                                        <option value="PUBLIC">Public</option>
                                        <option value="PRIVATE">Private</option>
                                    </select>
                                    <ChevronDownIcon className="select-arrow"/>
                                </div>
                                <div style={{display:'flex', alignItems:'center', gap:'10px', marginTop:'10px'}}>
                                    <input type="checkbox" id="recurring" checked={formData.is_recurring} onChange={e => setFormData({...formData, is_recurring: e.target.checked})} style={{width:'20px', height:'20px'}} />
                                    <label htmlFor="recurring" style={{fontSize:'14px', fontWeight:'600', color:'#374151'}}>Repeat Weekly</label>
                                </div>
                            </div>
                        </div>

                        {/* NEW: TICKET TYPES */}
                        <div className="form-section">
                            <div className="section-title" style={{justifyContent:'space-between'}}>
                                <span><TicketIcon style={{width: '20px', color: '#4f46e5'}}/> Ticket Types</span>
                                <button type="button" onClick={addTicketType} className="btn btn-sm btn-secondary" style={{display:'flex', gap:'5px', fontSize:'12px'}}><PlusIcon style={{width:16}}/> Add Ticket</button>
                            </div>
                            {formData.ticket_types.map((ticket, idx) => (
                                <div key={idx} style={{display:'flex', gap:'10px', marginBottom:'10px', alignItems:'center'}}>
                                    <input placeholder="Name (e.g. VIP)" value={ticket.name} onChange={e => updateTicketType(idx, 'name', e.target.value)} className="input-light" style={{flex:2}} />
                                    <input type="number" placeholder="Cap" value={ticket.capacity} onChange={e => updateTicketType(idx, 'capacity', Number(e.target.value))} className="input-light" style={{width:'100px'}} />
                                    <input type="number" placeholder="$" value={ticket.price} onChange={e => updateTicketType(idx, 'price', Number(e.target.value))} className="input-light" style={{width:'100px'}} />
                                    <button type="button" onClick={() => removeTicketType(idx)} className="btn-icon"><TrashIcon style={{width:18, color:'#ef4444'}}/></button>
                                </div>
                            ))}
                            {formData.ticket_types.length === 0 && <p style={{fontSize:'12px', color:'#9ca3af', fontStyle:'italic'}}>Default: General Admission (Free)</p>}
                        </div>

                        {/* NEW: CUSTOM FIELDS */}
                        <div className="form-section">
                            <div className="section-title" style={{justifyContent:'space-between'}}>
                                <span><ClipboardDocumentListIcon style={{width: '20px', color: '#4f46e5'}}/> Registration Form</span>
                                <button type="button" onClick={addCustomField} className="btn btn-sm btn-secondary" style={{display:'flex', gap:'5px', fontSize:'12px'}}><PlusIcon style={{width:16}}/> Add Question</button>
                            </div>
                            {formData.custom_fields.map((field, idx) => (
                                <div key={idx} style={{display:'flex', gap:'10px', marginBottom:'10px', alignItems:'center'}}>
                                    <input placeholder="Question (e.g. Dietary Needs)" value={field.label} onChange={e => updateCustomField(idx, 'label', e.target.value)} className="input-light" style={{flex:2}} />
                                    <select value={field.type} onChange={e => updateCustomField(idx, 'type', e.target.value)} className="select-light" style={{flex:1}}>
                                        <option value="text">Text</option>
                                        <option value="number">Number</option>
                                        <option value="boolean">Yes/No</option>
                                    </select>
                                    <button type="button" onClick={() => removeCustomField(idx)} className="btn-icon"><TrashIcon style={{width:18, color:'#ef4444'}}/></button>
                                </div>
                            ))}
                        </div>

                        <div className="form-actions">
                            {editingEventId && <button type="button" onClick={resetForm} className="btn btn-secondary">Cancel</button>}
                            <button type="submit" className="btn btn-primary">{editingEventId ? "Update Event" : "Create Event"}</button>
                        </div>
                    </div>
                </form>
            )}

            <div className="schedule-card">
                <h3 style={{marginTop: 0, marginBottom: '20px', fontWeight: '800'}}>My Schedule</h3>
                {(!myEvents || myEvents.length === 0) ? (
                    <div style={{textAlign: 'center', padding: '30px', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: '12px'}}>
                        <p>You haven't registered for any events yet.</p>
                    </div>
                ) : (
                    <div className="schedule-grid">
                        {myEvents.map((e) => (
                            <div key={e.event_id} className={`schedule-item ${e.my_status === 'WAITLISTED' ? 'waitlisted' : 'registered'}`}>
                                <div>
                                    <strong style={{fontSize: '1.05rem', display: 'block'}}>{e.title}</strong>
                                    <div style={{fontSize: '0.85rem', color: '#64748b', marginTop: '4px', display:'flex', alignItems:'center', gap:'6px'}}>
                                        <CalendarIcon style={{width:'14px'}}/> {new Date(e.start_time).toLocaleString()}
                                    </div>
                                </div>
                                <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                                    <span className={`badge ${e.my_status === "WAITLISTED" ? "badge-status" : "badge-public"}`}>{e.my_status}</span>
                                    <button onClick={() => addToCalendar(e)} className="btn btn-sm btn-secondary" title="Add to Google Calendar" style={{padding:'6px'}}>
                                        <CalendarDaysIcon style={{width:'16px'}} />
                                    </button>
                                    {(e.my_status === "REGISTERED" || e.my_status === "ATTENDED") && (
                                        <button onClick={() => openFeedbackModal(e.event_id)} className="btn btn-sm btn-warning" style={{display:'flex', alignItems:'center', gap:'4px'}}>Rate</button>
                                    )}
                                    {e.my_status === "ATTENDED" && (
                                        <button onClick={() => downloadCertificate(e.event_id, e.title)} className="btn btn-sm btn-success" style={{display:'flex', alignItems:'center', gap:'4px'}}>🎓 Cert</button>
                                    )}
                                    {e.my_status === "REGISTERED" && (
                                        <button onClick={() => handleCancelClick(e.event_id)} className="btn btn-sm btn-danger">Cancel</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid-2" style={{marginBottom: '40px'}}>
                <div className="form-card" style={{padding: '20px'}}>
                    <h3 style={{display:'flex', alignItems:'center', gap:'10px'}}>🏆 Campus Leaderboard</h3>
                    <table style={{width:'100%', marginTop:'15px'}}>
                        <thead>
                        <tr style={{textAlign:'left', color:'#64748b', fontSize:'14px'}}>
                            <th>Rank</th><th>User</th><th>Points</th>
                        </tr>
                        </thead>
                        <tbody>
                        {leaderboard.map((u, idx) => (
                            <tr key={u.id} style={{borderBottom: '1px solid #f1f5f9'}}>
                                <td style={{padding:'10px', fontWeight:'bold'}}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}</td>
                                <td style={{padding:'10px'}}>{u.email.split('@')[0]}</td>
                                <td style={{padding:'10px', color:'#4f46e5', fontWeight:'bold'}}>{u.points} pts</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
                <div className="form-card" style={{padding: '20px'}}>
                    <h3 style={{display:'flex', alignItems:'center', gap:'10px'}}>🎖️ My Badges</h3>
                    {myBadges.length === 0 ? (
                        <p style={{color:'#94a3b8', textAlign:'center', marginTop:'20px'}}>Attend events to earn badges!</p>
                    ) : (
                        <div style={{display:'flex', gap:'15px', flexWrap:'wrap', marginTop:'15px'}}>
                            {myBadges.map((b:any) => (
                                <div key={b.name} style={{textAlign:'center', background:'#f8fafc', padding:'10px', borderRadius:'8px', border:'1px solid #e2e8f0', width:'80px'}}>
                                    <div style={{fontSize:'2rem'}}>{b.icon}</div>
                                    <div style={{fontSize:'0.75rem', fontWeight:'bold', marginTop:'5px'}}>{b.name}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="toolbar">
                <div className="search-inputs">
                    <div className="input-group" style={{flex: 2}}>
                        <MagnifyingGlassIcon className="input-icon"/>
                        <input className="input-light" placeholder="Search events..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/>
                    </div>
                    <div className="input-group" style={{flex: 1}}>
                        <MapPinIcon className="input-icon"/>
                        <input className="input-light" placeholder="Location..." value={searchLocation} onChange={e => setSearchLocation(e.target.value)}/>
                    </div>
                    <div className="select-wrapper" style={{flex: 1}}>
                        <FunnelIcon className="input-icon"/>
                        <select className="select-light" value={searchCategory} onChange={e => setSearchCategory(e.target.value)}>
                            <option value="All">All Categories</option>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <ChevronDownIcon className="select-arrow"/>
                    </div>
                    <button onClick={() => fetchEvents(searchQuery, searchLocation, searchCategory)} className="btn btn-primary">Search</button>
                    <button onClick={() => { setSearchQuery(""); setSearchLocation(""); setSearchCategory("All"); fetchEvents("", "", "All") }} className="btn btn-text">Clear</button>
                </div>
                <div className="view-toggle">
                    <button onClick={() => setViewMode("LIST")} className={`toggle-btn ${viewMode === "LIST" ? "active" : ""}`}><ListBulletIcon style={{width: '18px'}}/> List</button>
                    <button onClick={() => setViewMode("CALENDAR")} className={`toggle-btn ${viewMode === "CALENDAR" ? "active" : ""}`}><CalendarDaysIcon style={{width: '18px'}}/> Calendar</button>
                </div>
            </div>

            {loading ? <p style={{textAlign: 'center', color: '#64748b', padding: '40px'}}>Loading...</p> : (
                <>
                    {viewMode === "LIST" ? (
                        <div className="event-grid">
                            {events.length === 0 && <p style={{gridColumn: '1/-1', textAlign: 'center', color: '#64748b', padding: '40px'}}>No events found.</p>}
                            {events.map((evt) => {
                                const status = getMyStatus(evt.id);
                                return (
                                    <div key={evt.id} className="event-card">
                                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start'}}>
                                            <div>
                                                <h4 style={{margin: '0 0 5px 0', fontSize: '18px'}}>{evt.title}</h4>
                                                <span className="badge badge-status" style={{background: '#eee', color: '#333'}}>{evt.category || 'General'}</span>
                                                {evt.is_recurring && <span className="badge" style={{background:'#e0e7ff', color:'#4338ca', marginLeft:'5px'}}>Weekly</span>}
                                            </div>
                                        </div>
                                        <div style={{marginTop: '10px', fontSize: '14px', color: '#555'}}>📍 {evt.location}</div>
                                        <div style={{fontSize: '14px', color: '#555'}}>📅 {new Date(evt.start_time).toLocaleString()}</div>
                                        <div style={{fontSize: '14px', fontWeight: 'bold', marginTop: '5px', color: evt.registered_count >= evt.capacity ? '#dc2626' : '#16a34a'}}>
                                            👥 {evt.registered_count} / {evt.capacity} Spots Filled
                                        </div>
                                        <div className="event-badges">
                                            <span className="badge badge-status">{evt.status}</span>
                                            <span className={`badge ${evt.visibility === "PRIVATE" ? "badge-private" : "badge-public"}`}>{evt.visibility === "PRIVATE" ? "Private" : "Public"}</span>
                                        </div>
                                        <div className="card-actions">
                                            {!status && <button onClick={() => handleJoinClick(evt)} className="btn btn-success">Join</button>}
                                            {status === 'REGISTERED' && <button onClick={() => handleCancelClick(evt.id)} className="btn btn-danger">Cancel</button>}
                                            {status === 'WAITLISTED' && <button onClick={() => handleCancelClick(evt.id)} className="btn btn-warning">Leave Waitlist</button>}
                                            {canManage && (
                                                <>
                                                    <button onClick={() => handleInviteClick(evt.id)} className="btn btn-secondary">Invite</button>
                                                    <button onClick={() => handleBulkInvite(evt.id)} className="btn btn-secondary">CSV</button>
                                                    <button onClick={() => { fetchAttendees(evt.id); setSelectedEventId(evt.id); }} className="btn btn-info">Manage</button>
                                                    <button onClick={() => handleEditClick(evt)} className="btn btn-warning">Edit</button>
                                                </>
                                            )}
                                            <button onClick={() => setQrModalEvent(evt)} className="btn btn-secondary">QR</button>

                                            {/* ✅ COMMUNITY BUTTON ADDED HERE */}
                                            <button onClick={() => {
                                                setCommunityModalEvent(evt);
                                                setActiveTab("DETAILS");
                                                fetchComments(evt.id);
                                                fetchPhotos(evt.id);
                                                fetchAttendees(evt.id);
                                            }} className="btn btn-secondary">💬 Community</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <CalendarView events={events} onEventClick={(evt) => { if (canManage && confirm(`Edit event "${evt.title}"?`)) handleEditClick(evt); }}/>
                    )}
                </>
            )}

            {/* MODALS */}

            {/* NEW: REGISTRATION MODAL */}
            {registerModalEvent && (
                <div className="modal-overlay" onClick={() => setRegisterModalEvent(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth:'500px'}}>
                        <h3 style={{marginBottom:'15px'}}>Register for {registerModalEvent.title}</h3>

                        {/* Ticket Selection */}
                        {registerModalEvent.ticket_types && registerModalEvent.ticket_types.length > 0 && (
                            <div style={{marginBottom:'20px'}}>
                                <label style={{fontWeight:'bold', display:'block', marginBottom:'5px', color:'#374151'}}>Select Ticket</label>
                                <select className="select-light" value={selectedTicket} onChange={e => setSelectedTicket(e.target.value)}>
                                    {registerModalEvent.ticket_types.map(t => (
                                        <option key={t.name} value={t.name}>{t.name} - {t.price > 0 ? `$${t.price}` : 'Free'}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Custom Fields */}
                        {registerModalEvent.custom_fields && registerModalEvent.custom_fields.map((field, idx) => (
                            <div key={idx} style={{marginBottom:'15px'}}>
                                <label style={{display:'block', marginBottom:'5px', fontSize:'14px', fontWeight:'600', color:'#374151'}}>{field.label} {field.required && '*'}</label>
                                {field.type === 'boolean' ? (
                                    <select className="select-light" onChange={e => setRegAnswers({...regAnswers, [field.label]: e.target.value})}>
                                        <option value="">Select...</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </select>
                                ) : (
                                    <input
                                        type={field.type}
                                        className="input-light"
                                        style={{width:'100%', boxSizing:'border-box'}}
                                        onChange={e => setRegAnswers({...regAnswers, [field.label]: e.target.value})}
                                    />
                                )}
                            </div>
                        ))}

                        <div style={{display:'flex', justifyContent:'flex-end', gap:'10px', marginTop:'20px'}}>
                            <button onClick={() => setRegisterModalEvent(null)} className="btn btn-secondary">Cancel</button>
                            <button onClick={() => submitRegistration(registerModalEvent.id, regAnswers, selectedTicket)} className="btn btn-primary">Confirm Registration</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedEventId && <div className="modal-overlay" onClick={() => setSelectedEventId(null)}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px'}}>
                        <h3>Attendees</h3>
                        <button onClick={() => setSelectedEventId(null)}>Close</button>
                    </div>
                    <button onClick={() => downloadCsv(selectedEventId)} className="btn btn-success" style={{marginBottom: '10px', width: '100%'}}>Download CSV</button>
                    <table style={{width: '100%'}}>
                        <thead><tr><th style={{textAlign: 'left'}}>Email</th><th>Status</th></tr></thead>
                        <tbody>{attendees.map((a, i) => <tr key={i}><td>{a.email}</td><td>{a.status}</td></tr>)}</tbody>
                    </table>
                </div>
            </div>}

            {cancelModalId && <div className="modal-overlay">
                <div className="modal-content" style={{textAlign: 'center', maxWidth: '400px'}}>
                    <h3>Confirm</h3><p>Cancel registration?</p>
                    <div style={{display: 'flex', gap: '10px', justifyContent: 'center'}}>
                        <button onClick={() => setCancelModalId(null)} className="btn btn-secondary">No</button>
                        <button onClick={confirmCancel} className="btn btn-danger">Yes</button>
                    </div>
                </div>
            </div>}

            {inviteModalId && <div className="modal-overlay">
                <div className="modal-content" style={{maxWidth: '400px'}}>
                    <h3>Invite</h3>
                    <input type="email" className="input-light" placeholder="Email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} style={{width: '100%', marginBottom: '15px'}}/>
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
                <div className="modal-content" style={{maxWidth: '500px', textAlign: 'center'}}>
                    <h3>Rate Event</h3>
                    <div className="feedback-stars">{[1, 2, 3, 4, 5].map(s => <button key={s} type="button" onClick={() => setFeedbackRating(s)} className={`star-btn ${s <= feedbackRating ? 'selected' : ''}`}>★</button>)}</div>
                    <textarea className="input-light" rows={3} placeholder="Comment..." value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} style={{width: '100%', marginTop: '10px'}}/>
                    <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px'}}>
                        <button onClick={() => setFeedbackModalId(null)} className="btn btn-secondary">Cancel</button>
                        <button onClick={submitFeedback} className="btn btn-submit">Submit</button>
                    </div>
                </div>
            </div>}

            {qrModalEvent && <div className="modal-overlay" onClick={() => setQrModalEvent(null)}>
                <div className="modal-content" style={{textAlign: 'center', maxWidth: '400px'}} onClick={e => e.stopPropagation()}>
                    <h3>Check-in QR</h3><p><b>{qrModalEvent.title}</b></p>
                    <div style={{background: 'white', padding: '20px', display: 'inline-block', border: '1px solid #eee'}}><QRCode value={`event:${qrModalEvent.id}`} size={200}/></div>
                    <p style={{marginTop: '10px'}}>Scan at entrance</p>
                    <button onClick={() => setQrModalEvent(null)} className="btn btn-secondary" style={{marginTop: '20px'}}>Close</button>
                </div>
            </div>}

            {/* ✅ COMMUNITY MODAL */}
            {communityModalEvent && (
                <div className="modal-overlay" onClick={() => setCommunityModalEvent(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth:'700px', height:'80vh', display:'flex', flexDirection:'column'}}>

                        {/* Header */}
                        <div style={{borderBottom:'1px solid #eee', paddingBottom:'10px', marginBottom:'10px', display:'flex', justifyContent:'space-between'}}>
                            <h2 style={{margin:0}}>{communityModalEvent.title}</h2>
                            <button onClick={() => setCommunityModalEvent(null)} className="btn-text"><XMarkIcon width={24}/></button>
                        </div>

                        {/* Tabs */}
                        <div style={{display:'flex', gap:'10px', marginBottom:'20px', borderBottom:'1px solid #eee'}}>
                            {["DETAILS", "CHAT", "PHOTOS", "ATTENDEES"].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    style={{
                                        padding:'10px',
                                        borderBottom: activeTab === tab ? '3px solid #4f46e5' : '3px solid transparent',
                                        fontWeight: activeTab === tab ? 'bold' : 'normal',
                                        color: activeTab === tab ? '#4f46e5' : '#64748b',
                                        background:'none', border:'none', cursor:'pointer'
                                    }}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Content Area */}
                        <div style={{flex:1, overflowY:'auto', display:'flex', flexDirection:'column'}}>

                            {activeTab === "DETAILS" && (
                                <div>
                                    <p><strong>📍 Location:</strong> {communityModalEvent.location}</p>
                                    <p><strong>📝 Description:</strong> {communityModalEvent.description}</p>
                                    <div style={{marginTop:'20px'}}>
                                        <h4>Share Event</h4>
                                        <QRCode value={`event:${communityModalEvent.id}`} size={120}/>
                                    </div>
                                </div>
                            )}

                            {activeTab === "CHAT" && (
                                <div style={{display:'flex', flexDirection:'column', height:'100%'}}>
                                    <div style={{flex:1, overflowY:'auto', marginBottom:'10px'}}>
                                        {comments.length === 0 ? <p style={{color:'#999'}}>No comments yet.</p> : comments.map(c => (
                                            <div key={c.id} style={{background:'#f8fafc', padding:'10px', borderRadius:'8px', marginBottom:'8px'}}>
                                                <div style={{fontSize:'12px', color:'#6b7280', fontWeight:'bold'}}>{c.user_email.split('@')[0]}</div>
                                                <div>{c.text}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{display:'flex', gap:'10px'}}>
                                        <input className="input-light" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Ask a question..." style={{flex:1}} />
                                        <button onClick={submitComment} className="btn btn-primary">Post</button>
                                    </div>
                                </div>
                            )}

                            {activeTab === "PHOTOS" && (
                                // ✅ FIX: Added Flex column layout here
                                <div style={{display:'flex', flexDirection:'column', height:'100%'}}>

                                    {/* Grid grows to fill space, pushing input down */}
                                    <div style={{flex: 1, overflowY:'auto', marginBottom:'20px'}}>
                                        {photos.length === 0 && <p style={{color:'#94a3b8', fontStyle:'italic', textAlign:'center', marginTop:'40px'}}>No photos yet.</p>}
                                        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:'10px'}}>
                                            {photos.map(p => (
                                                <img key={p.id} src={p.url} style={{width:'100%', borderRadius:'8px', height:'150px', objectFit:'cover'}} />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Input Bar pinned to bottom */}
                                    {canManage && (
                                        <div style={{display:'flex', gap:'10px', padding:'10px', background:'#f8fafc', borderRadius:'8px', marginTop:'auto'}}>
                                            <input className="input-light" value={newPhotoUrl} onChange={e => setNewPhotoUrl(e.target.value)} placeholder="Paste Image URL..." style={{flex:1}} />
                                            <button onClick={submitPhoto} className="btn btn-primary">Add Photo</button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === "ATTENDEES" && (
                                <div>
                                    <h4>Who's Going? ({attendees.length})</h4>
                                    <div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>
                                        {attendees.map(a => (
                                            <div key={a.email} style={{display:'flex', alignItems:'center', gap:'5px', background:'#f0fdf4', padding:'5px 10px', borderRadius:'20px', border:'1px solid #bbf7d0'}}>
                                                <div style={{width:'24px', height:'24px', borderRadius:'50%', background:'#16a34a', color:'white', textAlign:'center', lineHeight:'24px', fontSize:'12px'}}>
                                                    {a.email[0].toUpperCase()}
                                                </div>
                                                <span style={{fontSize:'14px'}}>{a.email.split('@')[0]}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <Chatbot />
        </div>
    );
}