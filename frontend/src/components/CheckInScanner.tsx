import React, { useState } from 'react';
import { useZxing } from "react-zxing";
import { useAuth0 } from "@auth0/auth0-react"; // 👈 Import Auth0 Hook
import { useToast } from "../context/ToastContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

interface CheckInScannerProps {
    onClose: () => void;
}

const CheckInScanner: React.FC<CheckInScannerProps> = ({ onClose }) => {
    const { getAccessTokenSilently } = useAuth0(); // 👈 Get token from Auth0
    const { showToast } = useToast();
    const [lastResult, setLastResult] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // Setup the Camera
    const { ref } = useZxing({
        onResult(result) {
            console.log("Scanned Raw Data:", result.getText());
            handleScan(result.getText());
        },
        onError(error) {
            if (error.name === "NotAllowedError") {
                setErrorMsg("🔒 Camera Permission Denied");
            } else if (error.name === "NotFoundError") {
                setErrorMsg("📷 No Camera Device Found");
            }
        },
        constraints: {
            video: { facingMode: "environment" }
        }
    });

    const handleScan = async (data: string) => {
        if (isProcessing || data === lastResult) return;

        setIsProcessing(true);
        setLastResult(data);
        console.log("Processing:", data);

        let eventId = "";

        // Parse format "event:123"
        if (data.startsWith("event:")) {
            eventId = data.split(":")[1];
        } else if (data.includes("/events/")) {
            const parts = data.split("/");
            eventId = parts[parts.length - 1];
        } else {
            showToast("❌ Invalid QR Format", "error");
            setIsProcessing(false);
            return;
        }

        await checkInUser(eventId);
    };

    const checkInUser = async (eventId: string) => {
        try {
            showToast("Checking in...", "success");

            const token = await getAccessTokenSilently();

            const res = await fetch(`${API_URL}/api/events/checkin`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ event_id: Number(eventId) })
            });

            // 👇 FIX: Get raw text first, then try to parse it as JSON
            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text); // Converts '{"message": "Hi"}' -> { message: "Hi" }
            } catch {
                data = { message: text }; // Fallback if it's just plain text
            }

            if (res.ok) {
                // Now data.message will be just "User checked in successfully"
                showToast(` ${data.message || "Success!"}`, "success");
                setTimeout(() => onClose(), 1500);
            } else {
                showToast(`⚠️ ${data.message || "Check-in Failed"}`, "error");
                setTimeout(() => {
                    setIsProcessing(false);
                    setLastResult("");
                }, 2000);
            }
        } catch (err) {
            console.error("Check-in Error:", err);
            showToast("Connection Error", "error");
            setIsProcessing(false);
            setLastResult("");
        }
    };

    return (
        <div style={{ textAlign: 'center', background: '#000', borderRadius: '12px', overflow: 'hidden', position: 'relative', minHeight: '320px' }}>

            {errorMsg ? (
                <div style={{ padding: '50px', color: '#ef4444' }}>
                    <p style={{ fontSize: '40px' }}>🚫</p>
                    <h3>{errorMsg}</h3>
                    <p style={{ fontSize: '12px', color: '#ccc' }}>Check browser permissions.</p>
                </div>
            ) : (
                <div style={{ position: 'relative', width: '100%', height: '300px' }}>
                    <video ref={ref} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: '200px', height: '200px', border: '4px solid rgba(0, 255, 0, 0.6)', borderRadius: '12px',
                        boxShadow: '0 0 20px rgba(0, 255, 0, 0.3)'
                    }}></div>
                </div>
            )}

            <div style={{ padding: '15px', background: '#111', color: 'white', borderTop: '1px solid #333' }}>
                {isProcessing ? (
                    <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>⏳ Verifying...</span>
                ) : (
                    <span>Looking for QR Code...</span>
                )}
                <button onClick={onClose} style={{
                    marginTop: '10px', background: '#333', color: 'white', border: 'none',
                    padding: '8px 24px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', marginLeft: '10px'
                }}>
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default CheckInScanner;