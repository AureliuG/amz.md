"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

/** Centered dialog: Esc closes, Ctrl+Enter submits. */
export function Modal({ title, onClose, onSubmit, children, width = 760 }: { title: string; onClose: () => void; onSubmit?: () => void; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onSubmit?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onSubmit]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/30 p-3" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel-in w-full rounded-2xl bg-white p-5 shadow-2xl" style={{ maxWidth: width }}>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[16px] font-semibold text-slate-900">{title}</div>
          <button aria-label="Închide" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, extra, children }: { label: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-slate-700">{label}</span>
        {extra}
      </div>
      {children}
    </div>
  );
}
