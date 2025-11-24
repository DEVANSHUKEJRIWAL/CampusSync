import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import '../App.css'; // Ensure CSS is loaded

type ToastType = 'success' | 'error';

interface ToastContextType {
    showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const showToast = (message: string, type: ToastType) => {
        setToast({ message, type });
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Render the Toast UI globally here */}
            {toast && (
                <div className="toast-container">
                    <div className={`toast ${toast.type === "success" ? "toast-success" : "toast-error"}`}>
                        <span className="toast-icon">{toast.type === "success" ? "✅" : "⚠️"}</span>
                        <span>{toast.message}</span>
                    </div>
                </div>
            )}
        </ToastContext.Provider>
    );
};