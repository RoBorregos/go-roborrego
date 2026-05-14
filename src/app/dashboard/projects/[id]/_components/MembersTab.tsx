"use client";

import { useRef, useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";

type Project = RouterOutputs["project"]["getById"];
type ProjectMember = Project["members"][0];

export function MembersTab({
  project,
  isManager,
  currentUserId,
}: {
  project: Project;
  isManager: boolean;
  currentUserId: string;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const utils = api.useUtils();

  function invalidate() {
    void utils.project.getById.invalidate({ id: project.id });
  }

  const removeMember = api.project.removeMember.useMutation({ onSuccess: invalidate });
  const updateRole = api.project.updateMemberRole.useMutation({ onSuccess: invalidate });

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">
          {project.members.length} Member{project.members.length !== 1 ? "s" : ""}
        </h2>
        {isManager && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add Member
          </button>
        )}
      </div>

      {showAdd && (
        <AddMemberPanel
          projectId={project.id}
          onAdded={invalidate}
          onClose={() => setShowAdd(false)}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        {project.members.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            isManager={isManager}
            isCurrentUser={m.userId === currentUserId}
            onRoleChange={(role) =>
              updateRole.mutate({ projectId: project.id, userId: m.userId, role })
            }
            onRemove={() =>
              removeMember.mutate({ projectId: project.id, userId: m.userId })
            }
            isSaving={removeMember.isPending || updateRole.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function MemberRow({
  member,
  isManager,
  isCurrentUser,
  onRoleChange,
  onRemove,
  isSaving,
}: {
  member: ProjectMember;
  isManager: boolean;
  isCurrentUser: boolean;
  onRoleChange: (role: "PROJECT_MEMBER" | "PROJECT_MANAGER") => void;
  onRemove: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {member.user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={member.user.image} alt="" className="w-8 h-8 rounded-full shrink-0" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <span className="text-blue-600 font-semibold text-xs">
            {member.user.name?.charAt(0) ?? "?"}
          </span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {member.user.name ?? member.user.email}
          {isCurrentUser && (
            <span className="ml-1.5 text-xs text-gray-400">(you)</span>
          )}
        </p>
        <p className="text-xs text-gray-400 truncate">{member.user.email}</p>
      </div>

      {member.user.subTeam && (
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded shrink-0">
          {member.user.subTeam}
        </span>
      )}

      {isManager && !isCurrentUser && member.user.role !== "ADMIN" ? (
        <select
          value={member.role}
          onChange={(e) => onRoleChange(e.target.value as "PROJECT_MEMBER" | "PROJECT_MANAGER")}
          disabled={isSaving}
          className="text-xs rounded border border-gray-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
        >
          <option value="PROJECT_MEMBER">Member</option>
          <option value="PROJECT_MANAGER">Manager</option>
        </select>
      ) : (
        <span className="text-xs text-gray-500 flex items-center gap-1">
          {member.role === "PROJECT_MANAGER" ? "Manager" : "Member"}
          {member.user.role === "ADMIN" && (
            <span title="Site admin — always a manager">🔒</span>
          )}
        </span>
      )}

      {isManager && !isCurrentUser && (
        <button
          onClick={onRemove}
          disabled={isSaving}
          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
        >
          Remove
        </button>
      )}
    </div>
  );
}

function AddMemberPanel({
  projectId,
  onAdded,
  onClose,
}: {
  projectId: string;
  onAdded: () => void;
  onClose: () => void;
}) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"PROJECT_MEMBER" | "PROJECT_MANAGER">("PROJECT_MEMBER");
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: available } = api.project.getAvailableMembers.useQuery({ projectId });
  const addMember = api.project.addMember.useMutation({
    onSuccess: () => {
      onAdded();
      setSelectedUserId("");
      setSearch("");
      setRole("PROJECT_MEMBER");
    },
  });

  const filtered = (available ?? []).filter((u) => {
    const q = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ??
      u.email?.toLowerCase().includes(q)
    );
  });

  function selectUser(id: string, name: string | null, email: string | null) {
    setSelectedUserId(id);
    setSearch(name ?? email ?? "");
    setOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) return;
    addMember.mutate({ projectId, userId: selectedUserId, role });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <h3 className="font-medium text-gray-900 mb-3 text-sm">Add Member</h3>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-600 mb-1">Member</label>
          <div ref={containerRef} className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedUserId(""); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="Search by name or email…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            {open && filtered.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filtered.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onMouseDown={() => selectUser(u.id, u.name, u.email)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors"
                    >
                      <span className="block text-sm font-medium text-gray-900">
                        {u.name ?? "—"}{u.subTeam ? <span className="ml-1 font-normal text-gray-400">({u.subTeam})</span> : null}
                      </span>
                      <span className="block text-xs text-gray-400">{u.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="PROJECT_MEMBER">Member</option>
            <option value="PROJECT_MANAGER">Manager</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!selectedUserId || addMember.isPending}
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {addMember.isPending ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
      {addMember.error && (
        <p className="text-xs text-red-600 mt-2">{addMember.error.message}</p>
      )}
    </div>
  );
}
