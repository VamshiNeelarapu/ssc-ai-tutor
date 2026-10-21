"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Zap, Clock } from "lucide-react";
import { AI_MODELS, DEFAULT_MODEL, getStoredModel, setStoredModel } from "@/lib/models";

export default function ModelSelector() {
  const [selectedId, setSelectedId] = useState(DEFAULT_MODEL);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedId(getStoredModel());
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = AI_MODELS.find((m) => m.id === selectedId) || AI_MODELS[0];

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setStoredModel(id);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md px-2.5 py-1.5 transition-colors"
        title="Switch AI model"
      >
        <Zap size={11} className="text-[#1f4e9c] flex-shrink-0" />
        <span className="max-w-[130px] truncate font-medium">{selected.label}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
          Free
        </span>
        {selected.dailyLimit && (
          <span title="Has daily rate limit" className="flex-shrink-0">
            <Clock size={10} className="text-amber-500" />
          </span>
        )}
        <ChevronDown size={11} className={`transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-80 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-3 py-2.5 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-700">AI Model</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Saved in your browser. Applies from your next message.
            </p>
          </div>

          <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 flex items-start gap-1.5">
            <Clock size={11} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-amber-700">
              <strong>⏱ Daily limit</strong> models reset every 24h — use these first to save your OpenRouter credits.
            </p>
          </div>

          <ul className="py-1 max-h-72 overflow-y-auto">
            {AI_MODELS.map((model) => (
              <li key={model.id}>
                <button
                  onClick={() => handleSelect(model.id)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-start gap-2 ${
                    selectedId === model.id ? "bg-[#eef3fb]" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs font-medium ${selectedId === model.id ? "text-[#1f4e9c]" : "text-gray-800"}`}>
                        {model.label}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                        Free
                      </span>
                      {model.dailyLimit && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 flex items-center gap-0.5">
                          <Clock size={9} />
                          Daily limit
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{model.description}</p>
                  </div>
                  {selectedId === model.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1f4e9c] mt-1.5 flex-shrink-0" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
