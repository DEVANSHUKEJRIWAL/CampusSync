import { useState } from 'react';
import {
    MessageCircle as ChatBubbleLeftRightIcon,
    X as XMarkIcon,
    Send as PaperAirplaneIcon
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function ChatBot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{role: 'user' | 'bot', text: string}[]>([
        {role: 'bot', text: 'Hi! I am CampusBot. Ask me about upcoming events!'}
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!input.trim()) return;

        const userMsg = input;
        setMessages(prev => [...prev, {role: 'user', text: userMsg}]);
        setInput("");
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/ai/chat`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ question: userMsg })
            });
            const data = await res.json();
            setMessages(prev => [...prev, {role: 'bot', text: data.answer}]);
        } catch (err) {
            setMessages(prev => [...prev, {role: 'bot', text: "Sorry, I'm having trouble connecting to the campus brain."}]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'fixed', bottom: '20px', right: '20px',
                    background: '#4f46e5', color: 'white',
                    padding: '15px', borderRadius: '50%',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    border: 'none', cursor: 'pointer', zIndex: 2000
                }}
            >
                {isOpen ? <XMarkIcon width={24}/> : <ChatBubbleLeftRightIcon width={24}/>}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div style={{
                    position: 'fixed', bottom: '80px', right: '20px',
                    width: '350px', height: '500px',
                    background: 'white', borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    display: 'flex', flexDirection: 'column',
                    zIndex: 2000, overflow: 'hidden', border: '1px solid #e5e7eb'
                }}>
                    <div style={{background: '#4f46e5', color: 'white', padding: '15px', fontWeight: 'bold'}}>
                        🤖 CampusBot
                    </div>

                    <div style={{flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px'}}>
                        {messages.map((m, i) => (
                            <div key={i} style={{
                                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                                background: m.role === 'user' ? '#e0e7ff' : '#f3f4f6',
                                color: m.role === 'user' ? '#3730a3' : '#1f2937',
                                padding: '8px 12px', borderRadius: '12px',
                                maxWidth: '80%'
                            }}>
                                {m.text}
                            </div>
                        ))}
                        {loading && <div style={{color: '#9ca3af', fontSize: '12px'}}>Thinking...</div>}
                    </div>

                    <form onSubmit={handleSend} style={{padding: '10px', borderTop: '1px solid #e5e7eb', display: 'flex'}}>
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Type a question..."
                            style={{flex: 1, border: 'none', outline: 'none', padding: '10px'}}
                        />
                        <button type="submit" style={{background: 'none', border: 'none', cursor: 'pointer', color: '#4f46e5'}}>
                            <PaperAirplaneIcon width={24}/>
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}