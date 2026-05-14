"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

import { UserMenu } from "./UserMenu";

export function DashboardShell({
  children,
  user,
  role,
  signOutAction,
}: {
  children: React.ReactNode;
  user: { id: string; name: string | null; email: string | null; image: string | null };
  role: string;
  signOutAction: () => Promise<void>;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-64 bg-[#1a2744] text-white flex flex-col
          transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0 md:shrink-0
        `}
      >
        <div className="p-6 border-b border-white/10 shrink-0">
          <span className="text-xl font-bold tracking-tight">RoBorregos</span>
          <p className="text-xs text-blue-300 mt-1">Team Management</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/dashboard/members">Members</NavLink>
          <NavLink href="/dashboard/workplan">Work Plan</NavLink>
          {(role === "ADMIN" || role === "MEMBER") && (
            <>
              <NavLink href="/dashboard/attendance">Meetings</NavLink>
              <NavLink href="/dashboard/projects">Projects</NavLink>
            </>
          )}
          {role === "ADMIN" && (
            <>
              <NavLink href="/dashboard/admin/members">Roster</NavLink>
              <NavLink href="/dashboard/admin/profile-approvals">Profile Approvals</NavLink>
              <NavLink href="/dashboard/admin">Admin</NavLink>
            </>
          )}
          <NavLink href="/dashboard/support">Report Issue</NavLink>
          <NavLink href="/dashboard/onboarding">Getting Started</NavLink>
        </nav>

        <div className="p-3 border-t border-white/10 shrink-0">
          <UserMenu
            id={user.id}
            name={user.name}
            email={user.email}
            image={user.image}
            role={role}
            signOutAction={signOutAction}
          />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 h-screen">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-[#1a2744] text-white shrink-0 border-b border-white/10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold tracking-tight">RoBorregos</span>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? "bg-white/20 text-white"
          : "text-blue-100 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
