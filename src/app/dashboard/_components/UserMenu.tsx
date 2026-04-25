"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function UserMenu({
  id,
  name,
  email,
  image,
  role,
  signOutAction,
}: {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/10 transition-colors text-left"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={name ?? ""}
            className="w-8 h-8 rounded-full flex-shrink-0 object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-semibold">
              {name?.charAt(0) ?? "?"}
            </span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{name}</p>
          <p className="text-xs text-blue-300 truncate">{role}</p>
        </div>
        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-blue-300 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown — opens upward */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
          {/* User info header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
            <p className="text-xs text-gray-400 truncate">{email}</p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <MenuItem href={`/dashboard/members/${id}`} onClick={() => setOpen(false)}>
              My Profile
            </MenuItem>
            <MenuItem href="/dashboard/profile/edit" onClick={() => setOpen(false)}>
              Edit Profile
            </MenuItem>
          </div>

          <div className="border-t border-gray-100 py-1">
            <form action={signOutAction}>
              <button
                type="submit"
                className="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  href,
  onClick,
  children,
  danger,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block px-4 py-2 text-sm transition-colors ${
        danger
          ? "text-red-600 hover:bg-red-50"
          : "text-gray-700 hover:bg-gray-50"
      }`}
    >
      {children}
    </Link>
  );
}
