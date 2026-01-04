import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
    LineChart as PresentationChartLineIcon, // Mapped to LineChart
    Download as ArrowDownTrayIcon,          // Mapped to Download
    Users as UsersIcon,
    BadgeCheck as CheckBadgeIcon,           // Mapped to BadgeCheck
    Calendar as CalendarIcon,
    Ticket as TicketIcon,
    Star as StarIcon
} from 'lucide-react';
import { useToast } from "../context/ToastContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function AdminAnalytics() {
    const { getAccessTokenSilently } = useAuth0();
    const { showToast } = useToast();
    const [analytics, setAnalytics] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchAnalytics = async () => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/admin/analytics`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setAnalytics(await res.json());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleGlobalExport = async () => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch(`${API_URL}/api/admin/analytics/export`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "campus_sync_full_data.csv";
            a.click();
            showToast("📊 Full Data Exported!", "success");
        } catch (e) {
            showToast("Export failed", "error");
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, []);

    if (loading) return <div style={{padding:'20px', color:'#64748b'}}>Loading Analytics...</div>;
    if (!analytics) return null;

    return (
        <div className="form-card" style={{padding: '25px', marginBottom: '30px', background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', borderRadius: '12px', border: '1px solid #e2e8f0'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'30px'}}>
                <h3 style={{margin:0, display:'flex', alignItems:'center', gap:'10px', fontSize:'1.2rem', color: '#1e293b'}}>
                    <PresentationChartLineIcon style={{width:24, color:'#4f46e5'}} />
                    Platform Analytics
                </h3>
                <button onClick={handleGlobalExport} className="btn btn-secondary" style={{fontSize:'13px', display:'flex', alignItems:'center', gap:'6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', background: 'white'}}>
                    <ArrowDownTrayIcon style={{width:16}} /> Export All Data
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '30px' }}>
                <StatCard title="Total Users" value={analytics.total_users} color="#3b82f6" icon={<UsersIcon style={{width:24}}/>} />
                <StatCard title="Active Users" value={analytics.active_users} color="#10b981" icon={<CheckBadgeIcon style={{width:24}}/>} />
                <StatCard title="Total Events" value={analytics.total_events} color="#8b5cf6" icon={<CalendarIcon style={{width:24}}/>} />
                <StatCard title="Registrations" value={analytics.total_registrations} color="#f59e0b" icon={<TicketIcon style={{width:24}}/>} />
                <StatCard title="Avg Rating" value={analytics.avg_rating ? analytics.avg_rating.toFixed(1) : "N/A"} color="#ec4899" icon={<StarIcon style={{width:24}}/>} />
            </div>

            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px'}}>
                <div style={{background:'white', padding:'20px', borderRadius:'12px', border:'1px solid #e2e8f0', boxShadow:'0 2px 4px rgba(0,0,0,0.02)'}}>
                    <h4 style={{margin:'0 0 15px 0', color:'#64748b', fontSize:'12px', fontWeight: 'bold', textTransform:'uppercase', letterSpacing: '0.5px'}}>Attendance Drop-off</h4>
                    <div style={{display:'flex', alignItems:'center', gap:'20px'}}>
                        <div style={{position:'relative', width:'100px', height:'100px', borderRadius:'50%', background: `conic-gradient(#4f46e5 ${analytics.attendance_rate || 0}%, #f1f5f9 0)`}}>
                            <div style={{position:'absolute', inset:'10px', background:'white', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold', fontSize:'1.2rem', color: '#1e293b'}}>
                                {Math.round(analytics.attendance_rate || 0)}%
                            </div>
                        </div>
                        <div>
                            <div style={{fontSize:'24px', fontWeight:'800', color:'#1e293b'}}>{analytics.total_attended || 0} <span style={{fontSize:'14px', color:'#94a3b8', fontWeight:'normal'}}>/ {analytics.total_registrations || 0}</span></div>
                            <div style={{color:'#64748b', fontSize:'13px'}}>Attended vs Registered</div>
                            <div style={{fontSize:'12px', color: ((analytics.attendance_rate || 0) < 50 ? '#ef4444' : '#16a34a'), marginTop:'8px', fontWeight:'bold', display: 'flex', alignItems: 'center', gap: '4px'}}>
                                {(analytics.attendance_rate || 0) < 50 ? "⚠️ High Drop-off" : "✅ Healthy Rate"}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{background:'white', padding:'20px', borderRadius:'12px', border:'1px solid #e2e8f0', boxShadow:'0 2px 4px rgba(0,0,0,0.02)'}}>
                    <h4 style={{margin:'0 0 15px 0', color:'#64748b', fontSize:'12px', fontWeight: 'bold', textTransform:'uppercase', letterSpacing: '0.5px'}}>Busy Days (Heatmap)</h4>

                    <div style={{display:'flex', alignItems:'flex-end', height:'120px', gap:'8px', paddingTop: '10px'}}>
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                            const heatmap = analytics?.weekly_heatmap || {};
                            const val = heatmap[day] || 0;
                            const allValues = Object.values(heatmap) as number[];
                            const max = allValues.length > 0 ? Math.max(...allValues, 5) : 5;
                            const heightPercent = val === 0 ? 0 : Math.max((val / max) * 100, 10);

                            return (
                                <div key={day} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'5px', height: '100%', justifyContent: 'flex-end'}}>
                                    {val > 0 && <span style={{fontSize:'10px', fontWeight:'bold', color:'#4f46e5', marginBottom:'-2px'}}>{val}</span>}
                                    <div
                                        title={`${day}: ${val}`}
                                        style={{
                                            width:'100%',
                                            height: `${heightPercent}%`,
                                            background: val > 0 ? '#6366f1' : '#f1f5f9',
                                            borderRadius:'4px',
                                            transition:'height 0.3s ease',
                                            minHeight: val > 0 ? '4px' : '2px'
                                        }}
                                    ></div>
                                    <div style={{fontSize:'10px', color:'#64748b', fontWeight: '500'}}>{day.slice(0,3)}</div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, color, icon }: any) {
    return (
        <div style={{ background: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
                <span style={{ color: color }}>{icon}</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b' }}>{value}</div>
        </div>
    );
}