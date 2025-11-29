import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface ScannedData {
    id: number;
    title: string;
}

interface Props {
    onClose: () => void;
}

export default function CheckInScanner({ onClose }: Props) {
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [scannedData, setScannedData] = useState<ScannedData | null>(null);
    const [error, setError] = useState<string>("");
    const scannerRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                handleScanSuccess(decodedText);
            },
            (_) => {
                // Ignore frame parse errors
            }
        ).catch((err) => {
            console.error("Error starting scanner", err);
            setError("Camera permission denied or unavailable.");
        });

        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().then(() => {
                    scannerRef.current?.clear();
                }).catch(err => console.error("Failed to stop scanner", err));
            }
        };
    }, []);

    const handleScanSuccess = (decodedText: string) => {
        if (scannerRef.current) {
            scannerRef.current.stop().catch(err => console.error(err));
        }

        try {
            const data = JSON.parse(decodedText);
            if (data.id && data.title) {
                setScannedData(data);
                setScanResult("Valid");
            } else {
                throw new Error("Invalid Data");
            }
        } catch (e) {
            if (decodedText.startsWith("event:")) {
                const parts = decodedText.split(":");
                setScannedData({ id: parseInt(parts[1]), title: "Event #" + parts[1] });
                setScanResult("Valid");
            } else {
                setError("❌ Invalid Ticket Format");
                setScanResult("Invalid");
            }
        }
    };

    const handleReset = () => {
        setScanResult(null);
        setError("");
        setScannedData(null);
        window.location.reload();
    };

    return (
        <div style={{ textAlign: 'center', width: '100%' }}>
            <h3 style={{ marginBottom: '20px', color: '#1f2937', marginTop: 0 }}>📷 Scan Ticket</h3>

            {!scanResult ? (
                <div style={{ position: 'relative', width: '100%', minHeight: '300px', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
                    {error ? (
                        <div style={{ color: 'white', padding: '40px' }}>{error}</div>
                    ) : (
                        <div id="reader" style={{ width: '100%', height: '100%' }}></div>
                    )}
                </div>
            ) : (
                <div style={{
                    padding: '30px',
                    background: error ? '#fee2e2' : '#dcfce7',
                    border: `2px solid ${error ? '#ef4444' : '#22c55e'}`,
                    borderRadius: '12px',
                    color: error ? '#991b1b' : '#14532d'
                }}>
                    <div style={{ fontSize: '40px', marginBottom: '10px' }}>
                        {error ? "❌" : "✅"}
                    </div>
                    <h2 style={{ margin: 0, fontSize: '24px' }}>
                        {error ? "Invalid Ticket" : "Verified!"}
                    </h2>

                    {scannedData && (
                        <>
                            <p style={{ margin: '10px 0 0 0', fontSize: '18px', fontWeight: 'bold' }}>
                                {scannedData.title}
                            </p>
                            <p style={{ fontSize: '14px', opacity: 0.8 }}>Event ID: {scannedData.id}</p>
                        </>
                    )}

                    <button
                        onClick={handleReset}
                        style={{
                            marginTop: '20px', padding: '10px 20px',
                            background: error ? '#dc2626' : '#166534', color: 'white', border: 'none',
                            borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
                        }}
                    >
                        Scan Next
                    </button>
                </div>
            )}

            <button onClick={onClose} style={{ marginTop: '20px', background: 'transparent', border: '1px solid #ccc', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', color: '#6b7280' }}>
                Close Scanner
            </button>
        </div>
    );
}