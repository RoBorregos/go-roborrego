"use client";

import { useState } from "react";
import Link from "next/link";

import { api } from "~/trpc/react";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ALUMNI: "Alumni",
};

const ROLE_LABELS: Record<string, string> = {
  VIEWER: "Viewer",
  MEMBER: "Member",
  ADMIN: "Admin",
};

export default function MembersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ACTIVE" | "INACTIVE" | "ALUMNI" | undefined
  >(undefined);
  const [subTeamFilter, setSubTeamFilter] = useState<string | undefined>(
    undefined,
  );

  const { data: members, isLoading } = api.member.getDirectory.useQuery({
    search: search || undefined,
    status: statusFilter,
    subTeam: subTeamFilter,
  });

  const { data: subTeams } = api.member.getSubTeams.useQuery();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-gray-500 text-sm mt-1">
            {members?.length ?? 0} members found
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name, email, or GitHub..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter ?? ""}
          onChange={(e) =>
            setStatusFilter(
              (e.target.value as "ACTIVE" | "INACTIVE" | "ALUMNI") ||
                undefined,
            )
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="ALUMNI">Alumni</option>
        </select>
        {subTeams && subTeams.length > 0 && (
          <select
            value={subTeamFilter ?? ""}
            onChange={(e) => setSubTeamFilter(e.target.value || undefined)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All sub-teams</option>
            {subTeams.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Member grid */}
      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading members...</div>
      ) : members?.length === 0 ? (
        <div className="text-gray-400 text-sm">No members found.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {members?.map((member) => (
            <Link
              key={member.id}
              href={`/dashboard/members/${member.id}`}
              className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              {member.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.image}
                  alt={member.name ?? ""}
                  className="w-10 h-10 rounded-full flex-shrink-0 object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-sm">
                    {member.name?.charAt(0) ?? "?"}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate text-sm">
                  {member.name}
                </p>
                <p className="text-xs text-gray-500 truncate">{member.email}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {member.subTeam && (
                    <span className="inline-block text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
                      {member.subTeam}
                    </span>
                  )}
                  <span
                    className={`inline-block text-xs rounded px-1.5 py-0.5 ${
                      member.status === "ACTIVE"
                        ? "bg-green-50 text-green-700"
                        : member.status === "ALUMNI"
                          ? "bg-purple-50 text-purple-700"
                          : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {STATUS_LABELS[member.status]}
                  </span>
                  <span className="inline-block text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                    {ROLE_LABELS[member.role]}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
