"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "~/trpc/react";

type SortKey = "totalPoints" | "tentativePoints" | "difference";
type SortDir = "asc" | "desc";
type Status = "ACTIVE" | "INACTIVE" | "ALUMNI";
type Role = "VIEWER" | "MEMBER" | "ADMIN";

const ALL_STATUSES: Status[] = ["ACTIVE", "INACTIVE", "ALUMNI"];
const ALL_ROLES: Role[] = ["VIEWER", "MEMBER", "ADMIN"];

const STATUS_LABELS: Record<Status, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ALUMNI: "Alumni",
};

const ROLE_LABELS: Record<Role, string> = {
  VIEWER: "Viewer",
  MEMBER: "Member",
  ADMIN: "Admin",
};

export function AdminMembersTab({ semesterId }: { semesterId: string }) {
  const { data, isLoading } = api.workPlan.getAdminMemberStats.useQuery({ semesterId });

  const [sortKey, setSortKey] = useState<SortKey>("totalPoints");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [visibleStatuses, setVisibleStatuses] = useState<Set<Status>>(new Set(ALL_STATUSES));
  const [visibleRoles, setVisibleRoles] = useState<Set<Role>>(new Set(ALL_ROLES));
  const [search, setSearch] = useState("");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function toggleStatus(s: Status) {
    setVisibleStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) {
        if (next.size === 1) return prev;
        next.delete(s);
      } else {
        next.add(s);
      }
      return next;
    });
  }

  function toggleRole(r: Role) {
    setVisibleRoles((prev) => {
      const next = new Set(prev);
      if (next.has(r)) {
        if (next.size === 1) return prev;
        next.delete(r);
      } else {
        next.add(r);
      }
      return next;
    });
  }

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>;

  const query = search.trim().toLowerCase();
  const filtered = (data ?? []).filter(
    (e) =>
      visibleStatuses.has(e.user.status as Status) &&
      visibleRoles.has(e.user.role as Role) &&
      (!query || (e.user.name ?? "").toLowerCase().includes(query)),
  );

  const sorted = [...filtered].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortDir === "desc" ? -diff : diff;
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        placeholder="Search by name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-y-2 gap-x-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Status:</span>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                visibleStatuses.has(s)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-500 border-gray-300 hover:border-gray-400"
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Role:</span>
          {ALL_ROLES.map((r) => (
            <button
              key={r}
              onClick={() => toggleRole(r)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                visibleRoles.has(r)
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-500 border-gray-300 hover:border-gray-400"
              }`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Member</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-700 w-24">Status</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-700 w-24">Role</th>
              <SortHeader
                label="Total Points"
                sortKey="totalPoints"
                current={sortKey}
                dir={sortDir}
                onClick={toggleSort}
              />
              <SortHeader
                label="Tentative"
                sortKey="tentativePoints"
                current={sortKey}
                dir={sortDir}
                onClick={toggleSort}
              />
              <SortHeader
                label="Difference"
                sortKey="difference"
                current={sortKey}
                dir={sortDir}
                onClick={toggleSort}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((entry) => (
              <tr key={entry.user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/workplan/${entry.user.id}`}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    {entry.user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={entry.user.image}
                        alt={entry.user.name ?? ""}
                        className="w-7 h-7 rounded-full"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 text-xs font-semibold">
                          {entry.user.name?.charAt(0) ?? "?"}
                        </span>
                      </div>
                    )}
                    <span className="text-gray-900 hover:text-blue-600">{entry.user.name}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={entry.user.status as Status} />
                </td>
                <td className="px-4 py-3 text-center">
                  <RoleBadge role={entry.user.role as Role} />
                </td>
                <td className="px-4 py-3 text-right font-bold text-blue-700">
                  {entry.totalPoints}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-600">
                  {entry.tentativePoints}
                </td>
                <td className={`px-4 py-3 text-right font-medium ${entry.difference >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {entry.difference >= 0 ? `+${entry.difference}` : entry.difference}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                  No members match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (key: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th className="text-right px-4 py-3 font-semibold text-gray-700 cursor-pointer select-none w-32">
      <button
        onClick={() => onClick(sortKey)}
        className={`flex items-center justify-end gap-1 w-full transition-colors ${active ? "text-blue-700" : "text-gray-700 hover:text-gray-900"}`}
      >
        {label}
        <span className="text-xs">
          {active ? (dir === "desc" ? "↓" : "↑") : "↕"}
        </span>
      </button>
    </th>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    ACTIVE: "bg-green-50 text-green-700 border-green-200",
    INACTIVE: "bg-gray-100 text-gray-600 border-gray-200",
    ALUMNI: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${styles[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const styles: Record<Role, string> = {
    ADMIN: "bg-red-50 text-red-700 border-red-200",
    MEMBER: "bg-blue-50 text-blue-700 border-blue-200",
    VIEWER: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${styles[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}
