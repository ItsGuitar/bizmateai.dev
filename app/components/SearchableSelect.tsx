"use client";

import React, { useEffect, useRef, useState } from "react";

interface SearchableSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search...",
  disabled = false,
  className = "",
  allowClear = true,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const filtered = query
    ? options.filter((opt) => opt.toLowerCase().includes(query.toLowerCase()))
    : options;

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-between gap-2"
      >
        <span className={value ? "text-slate-900 dark:text-white" : "text-slate-400"}>
          {value || placeholder}
        </span>
        <span className={`text-[10px] text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {allowClear && (
              <button
                type="button"
                onClick={() => handleSelect("")}
                className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                None
              </button>
            )}

            {filtered.length === 0 && (
              <div className="px-3 py-3 text-xs text-slate-400 text-center">No matches found.</div>
            )}

            {filtered.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleSelect(option)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                  option === value
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
