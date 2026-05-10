"use client";

import { useState } from "react";
import Link from "next/link";

import { api, type RouterOutputs } from "~/trpc/react";
import { CsvImportPanel } from "./CsvImportPanel";

type RosterMember = RouterOutputs["member"]["getRoster"][0];

const STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "ALUMNI"] as const;
const ROLE_OPTIONS = ["VIEWER", "MEMBER", "ADMIN"] as const;

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-50 text-green-700 border-green-200",
  INACTIVE: "bg-gray-100 text-gray-500 border-gray-200",
  ALUMNI: "bg-purple-50 text-purple-700 border-purple-200",
};

const ROLE_STYLES: Record<string, string> = {
  VIEWER: "bg-gray-100 text-gray-600 border-gray-200",
  MEMBER: "bg-blue-50 text-blue-700 border-blue-200",
  ADMIN: "bg-red-50 text-red-700 border-red-200",
};

type Panel = "register" | "import" | null;

export function RosterClient() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ACTIVE" | "INACTIVE" | "ALUMNI" | undefined
  >(() => (sessionStorage.getItem("roster_status") as "ACTIVE" | "INACTIVE" | "ALUMNI") || "ACTIVE");
  const [panel, setPanel] = useState<Panel>(null);
  const [sortByWebId, setSortByWebId] = useState(true);

  const { data: members, isPending } = api.member.getRoster.useQuery({
    search: search || undefined,
    status: statusFilter,
  });
  const utils = api.useUtils();

  const updateMember = api.member.updateMember.useMutation({
    onSuccess: () => void utils.member.getRoster.invalidate(),
  });

  function handleFieldChange(
    id: string,
    field: "role" | "status" | "subTeam",
    value: string,
  ) {
    updateMember.mutate({ id, [field]: value || undefined });
  }

  function handleNameChange(id: string, value: string) {
    if (!value.trim()) return;
    updateMember.mutate({ id, name: value.trim() });
  }

  function handleEmailChange(id: string, value: string) {
    if (!value.trim()) return;
    updateMember.mutate({ id, email: value.trim() });
  }

  function handleWebIdChange(id: string, value: string) {
    const parsed = parseInt(value, 10);
    updateMember.mutate({ id, webId: value && parsed > 0 ? parsed : undefined });
  }

  function handleClassYearChange(id: string, value: string) {
    const parsed = parseInt(value, 10);
    updateMember.mutate({ id, classYear: value && parsed > 1900 ? parsed : undefined });
  }

  function handleExcludeChange(id: string, excluded: boolean) {
    updateMember.mutate({ id, excludeFromExport: excluded });
  }

  function closePanel() {
    setPanel(null);
    void utils.member.getRoster.invalidate();
  }

  const sortedMembers = sortByWebId && members
    ? [...members].sort((a, b) => (a.webId ?? Infinity) - (b.webId ?? Infinity))
    : (members ?? []);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roster</h1>
          <p className="text-sm text-gray-500 mt-1">
            {members?.length ?? 0} members
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPanel(panel === "register" ? null : "register")}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Register Member
          </button>
          <button
            onClick={() => setPanel(panel === "import" ? null : "import")}
            className="px-4 py-2 text-sm bg-[#1a2744] text-white rounded-lg hover:bg-[#243660] transition-colors"
          >
            Bulk CSV Import
          </button>
        </div>
      </div>

      {/* Register member panel */}
      {panel === "register" && (
        <div className="mb-6">
          <RegisterMemberPanel onDone={closePanel} />
        </div>
      )}

      {/* CSV import panel */}
      {panel === "import" && (
        <div className="mb-6">
          <CsvImportPanel onDone={closePanel} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter ?? ""}
          onChange={(e) => {
            const val = e.target.value ? (e.target.value as "ACTIVE" | "INACTIVE" | "ALUMNI") : undefined;
            setStatusFilter(val);
            if (val) sessionStorage.setItem("roster_status", val);
            else sessionStorage.removeItem("roster_status");
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isPending ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : !members?.length ? (
        <p className="text-sm text-gray-400">No members found.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-255">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-4 py-3 font-medium text-gray-600">Member</th>
                <th className="px-4 py-3 font-medium text-gray-600">Sub-team</th>
                <th className="px-4 py-3 font-medium text-gray-600">Class</th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  <button
                    onClick={() => setSortByWebId((v) => !v)}
                    className={`flex items-center gap-1 hover:text-gray-900 transition-colors ${sortByWebId ? "text-blue-600" : ""}`}
                  >
                    Web ID {sortByWebId ? "↑" : "↕"}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">Role</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Attendance</th>
                <th className="px-4 py-3 font-medium text-gray-600">Completions</th>
                <th className="px-4 py-3 font-medium text-gray-600">Last Login</th>
                <th className="px-4 py-3 font-medium text-gray-600">PR Export</th>
                <th className="px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  onFieldChange={handleFieldChange}
                  onNameChange={handleNameChange}
                  onEmailChange={handleEmailChange}
                  onWebIdChange={handleWebIdChange}
                  onClassYearChange={handleClassYearChange}
                  onExcludeChange={handleExcludeChange}
                  isSaving={updateMember.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MemberRow({
  member,
  onFieldChange,
  onNameChange,
  onEmailChange,
  onWebIdChange,
  onClassYearChange,
  onExcludeChange,
  isSaving,
}: {
  member: RosterMember;
  onFieldChange: (id: string, field: "role" | "status" | "subTeam", value: string) => void;
  onNameChange: (id: string, value: string) => void;
  onEmailChange: (id: string, value: string) => void;
  onWebIdChange: (id: string, value: string) => void;
  onClassYearChange: (id: string, value: string) => void;
  onExcludeChange: (id: string, excluded: boolean) => void;
  isSaving: boolean;
}) {
  const [nameInput, setNameInput] = useState(member.name ?? "");
  const [subTeamInput, setSubTeamInput] = useState(member.subTeam ?? "");
  const [emailInput, setEmailInput] = useState(member.email ?? "");
  const [webIdInput, setWebIdInput] = useState(member.webId !== null ? String(member.webId) : "");
  const [classYearInput, setClassYearInput] = useState(member.classYear !== null ? String(member.classYear) : "");

  return (
    <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
      {/* Member */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {member.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.image}
              alt=""
              className="w-8 h-8 rounded-full shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <span className="text-blue-600 font-semibold text-xs">
                {member.name?.charAt(0) ?? "?"}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={() => {
                if (nameInput.trim() && nameInput !== member.name) {
                  onNameChange(member.id, nameInput.trim());
                } else {
                  setNameInput(member.name ?? "");
                }
              }}
              className="w-full rounded border border-transparent hover:border-gray-300 focus:border-blue-400 px-1 py-0 text-sm font-medium text-gray-900 focus:outline-none bg-transparent focus:bg-white truncate"
            />
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onBlur={() => {
                if (emailInput !== member.email && emailInput.includes("@")) {
                  onEmailChange(member.id, emailInput);
                } else {
                  setEmailInput(member.email ?? "");
                }
              }}
              className="w-full rounded border border-transparent hover:border-gray-300 focus:border-blue-400 px-1 py-0 text-xs text-gray-400 focus:text-gray-700 focus:outline-none bg-transparent focus:bg-white truncate"
            />
          </div>
        </div>
      </td>

      {/* Sub-team inline edit */}
      <td className="px-4 py-3">
        <input
          value={subTeamInput}
          onChange={(e) => setSubTeamInput(e.target.value)}
          onBlur={() => {
            if (subTeamInput !== (member.subTeam ?? "")) {
              onFieldChange(member.id, "subTeam", subTeamInput);
            }
          }}
          placeholder="—"
          className="w-28 rounded border border-transparent hover:border-gray-300 focus:border-blue-400 px-1.5 py-0.5 text-xs focus:outline-none bg-transparent focus:bg-white"
        />
      </td>

      {/* Class Year inline edit */}
      <td className="px-4 py-3">
        <input
          type="number"
          min={1900}
          max={2100}
          value={classYearInput}
          onChange={(e) => setClassYearInput(e.target.value)}
          onBlur={() => {
            if (classYearInput !== (member.classYear !== null ? String(member.classYear) : "")) {
              onClassYearChange(member.id, classYearInput);
            }
          }}
          placeholder="—"
          className="w-16 rounded border border-transparent hover:border-gray-300 focus:border-blue-400 px-1.5 py-0.5 text-xs focus:outline-none bg-transparent focus:bg-white"
        />
      </td>

      {/* Web ID inline edit */}
      <td className="px-4 py-3">
        <input
          type="number"
          min={1}
          value={webIdInput}
          onChange={(e) => setWebIdInput(e.target.value)}
          onBlur={() => {
            if (webIdInput !== (member.webId !== null ? String(member.webId) : "")) {
              onWebIdChange(member.id, webIdInput);
            }
          }}
          placeholder="—"
          className="w-16 rounded border border-transparent hover:border-gray-300 focus:border-blue-400 px-1.5 py-0.5 text-xs focus:outline-none bg-transparent focus:bg-white"
        />
      </td>

      {/* Role dropdown */}
      <td className="px-4 py-3">
        <select
          value={member.role}
          onChange={(e) => onFieldChange(member.id, "role", e.target.value)}
          disabled={isSaving}
          className={`text-xs px-2 py-0.5 rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 ${ROLE_STYLES[member.role] ?? ""}`}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </td>

      {/* Status dropdown */}
      <td className="px-4 py-3">
        <select
          value={member.status}
          onChange={(e) => onFieldChange(member.id, "status", e.target.value)}
          disabled={isSaving}
          className={`text-xs px-2 py-0.5 rounded border cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 ${STATUS_STYLES[member.status] ?? ""}`}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </td>

      {/* Attendance */}
      <td className="px-4 py-3">
        {member.attendanceRate !== null ? (
          <span
            className={`text-xs px-2 py-0.5 rounded border font-medium ${
              member.attendanceRate >= 80
                ? "bg-green-50 text-green-700 border-green-200"
                : member.attendanceRate >= 60
                  ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                  : "bg-red-50 text-red-600 border-red-200"
            }`}
          >
            {member.attendanceRate}%
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>

      {/* Completions */}
      <td className="px-4 py-3 text-gray-700 text-xs">
        {member.completionsCount > 0 ? member.completionsCount : (
          <span className="text-gray-400">0</span>
        )}
      </td>

      {/* Last login */}
      <td className="px-4 py-3 text-xs text-gray-400">
        {member.lastLoginAt
          ? new Date(member.lastLoginAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "Never"}
      </td>

      {/* PR Export */}
      <td className="px-4 py-3">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!member.excludeFromExport}
            onChange={(e) => onExcludeChange(member.id, !e.target.checked)}
            disabled={isSaving}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
          />
          <span className={`text-xs ${member.excludeFromExport ? "text-gray-400" : "text-gray-700"}`}>
            {member.excludeFromExport ? "Hidden" : "Included"}
          </span>
        </label>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/admin/members/${member.id}/edit`}
            className="text-xs text-blue-600 hover:underline"
          >
            Edit
          </Link>
          <Link
            href={`/dashboard/workplan/${member.id}?from=roster`}
            className="text-xs text-gray-500 hover:underline"
          >
            Work Plan
          </Link>
        </div>
      </td>
    </tr>
  );
}

function RegisterMemberPanel({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    email: "",
    name: "",
    role: "MEMBER" as "VIEWER" | "MEMBER" | "ADMIN",
    subTeam: "",
  });
  const [success, setSuccess] = useState<string | null>(null);

  const registerMember = api.member.registerMember.useMutation({
    onSuccess: (member) => {
      setSuccess(member.email);
      setForm({ email: "", name: "", role: "MEMBER", subTeam: "" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    registerMember.mutate({
      email: form.email,
      name: form.name || undefined,
      role: form.role,
      subTeam: form.subTeam || undefined,
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h2 className="font-semibold text-gray-900 mb-1">Register Member</h2>
      <p className="text-xs text-gray-500 mb-4">
        Pre-register a member by email.
        They will be able to sign in with Google once registered.
        If their name is left blank it defaults to their email prefix.
      </p>

      {success && (
        <div className="mb-4 px-3 py-2 rounded-lg border bg-green-50 text-green-700 border-green-200 text-sm flex items-center justify-between">
          <span><strong>{success}</strong> registered successfully.</span>
          <button
            onClick={() => setSuccess(null)}
            className="text-green-600 hover:text-green-800 ml-4"
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Email *
          </label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="member@example.com"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Name
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Full name (optional)"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Role
          </label>
          <select
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value as typeof form.role })
            }
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="VIEWER">Viewer</option>
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Sub-team
          </label>
          <input
            type="text"
            value={form.subTeam}
            onChange={(e) => setForm({ ...form, subTeam: e.target.value })}
            placeholder="e.g. RoboCup"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={registerMember.isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {registerMember.isPending ? "Registering…" : "Register"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
        </div>

        {registerMember.error && (
          <p className="w-full text-sm text-red-600 mt-1">
            {registerMember.error.message}
          </p>
        )}
      </form>
    </div>
  );
}
