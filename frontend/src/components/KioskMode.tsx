import { useState } from "react";
import { CheckBadgeIcon } from '@heroicons/react/20/solid';
import "./EventDashboard.css"; // Reuse styles

interface Props {
    eventId: number;
    eventTitle: string;
    onClose: () => void;
}

export default function KioskMode({ eventId, eventTitle, onClose }: Props) {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"IDLE" | "SUCCESS" | "ERROR">("IDLE");
    const [msg, setMsg] = useState("");

    const handleCheckIn = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/api/events/checkin/self`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ event_id: eventId, email })
            });
            const data = await res.json();
            if (res.ok) {
                setStatus("SUCCESS");
                setMsg(data.message);
                setEmail("");
                // Reset after 3 seconds for next student
                setTimeout(() => { setStatus("IDLE"); setMsg(""); }, 3000);
            } else {
                setStatus("ERROR");
                setMsg(data.message);
            }
        } catch (error) { setStatus("ERROR"); setMsg("Network Error"); }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 3000, background: '#f8fafc',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
            <button onClick={onClose} style={{position: 'absolute', top: 20, right: 20, padding: '10px', background: 'white', border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer'}}>Exit Kiosk</button>

            <div className="form-card" style={{width: '90%', maxWidth: '600px', textAlign: 'center', padding: '60px'}}>
                <h1 style={{fontSize: '2.5rem', marginBottom: '10px'}}>👋 Welcome!</h1>
                <h2 style={{fontSize: '1.5rem', color: '#4f46e5', marginBottom: '40px'}}>{eventTitle}</h2>

                {status === "SUCCESS" ? (
                    <div style={{color: '#10b981', animation: 'popIn 0.3s'}}>
                        <CheckBadgeIcon style={{width: 100, margin: '0 auto'}} />
                        <h3 style={{fontSize: '2rem', marginTop: '20px'}}>Checked In!</h3>
                        <p>{msg}</p>
                    </div>
                ) : (
                    <form onSubmit={handleCheckIn}>
                        <label style={{display: 'block', textAlign: 'left', marginBottom: '10px', fontWeight: 'bold'}}>Enter your Email</label>
                        <input
                            className="input-light"
                            style={{fontSize: '1.5rem', padding: '20px', height: 'auto'}}
                            placeholder="student@university.edu"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            autoFocus
                        />
                        <button type="submit" className="btn btn-primary" style={{width: '100%', marginTop: '30px', padding: '20px', fontSize: '1.5rem'}}>
                            Check In
                        </button>
                        {status === "ERROR" && <p style={{color: 'red', marginTop: '20px'}}>{msg}</p>}
                    </form>
                )}
            </div>
            <p style={{marginTop: '20px', color: '#94a3b8'}}>Self Check-In Station</p>
        </div>
    );
}