import React, { useEffect } from 'react';
import { NotificationLog } from '../types';
import { CheckCircle2, AlertCircle, X, Bell } from 'lucide-react';

interface ToastProps {
  toast: NotificationLog | null;
  onClose: () => void;
}

export const NotificationToast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700/80 p-4 animate-in slide-in-from-bottom-5 duration-200 print:hidden">
      <div className="flex items-start space-x-3">
        <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
          <Bell size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white tracking-wide uppercase">
              Pembaruan Admin
            </h4>
            <span className="text-[10px] text-slate-400">{toast.timestamp}</span>
          </div>
          <h5 className="text-xs font-semibold text-blue-300 mt-1">{toast.title}</h5>
          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{toast.message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
