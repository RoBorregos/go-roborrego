"use client";

import { useRef, useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { AREA_COLOR_KEYS, areaColor } from "./areaColors";

type Project = RouterOutputs["project"]["getById"];
type ProjectMember = Project["members"][0];
type Area = RouterOutputs["project"]["getAreas"][0];
type MemberArea = { area: Area; isLead: boolean };

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
  const [areaFilter, setAreaFilter] = useState<string[]>([]);
  const utils = api.useUtils();

  const { data: areas } = api.project.getAreas.useQuery({ projectId: project.id });

  function invalidate() {
    void utils.project.getById.invalidate({ id: project.id });
  }

  function invalidateAreas() {
    void utils.project.getAreas.invalidate({ projectId: project.id });
    void utils.project.getTasks.invalidate({ projectId: project.id });
  }

  const removeMember = api.project.removeMember.useMutation({ onSuccess: invalidate });
  const updateRole = api.project.updateMemberRole.useMutation({ onSuccess: invalidate });
  const setMemberAreas = api.project.setMemberAreas.useMutation({ onSuccess: invalidateAreas });

  // getAreas already carries each area's membership.
  const areasByUser = new Map<string, MemberArea[]>();
  for (const area of areas ?? []) {
    for (const m of area.members) {
      const list = areasByUser.get(m.userId) ?? [];
      list.push({ area, isLead: m.isLead });
      areasByUser.set(m.userId, list);
    }
  }

  // Members matching any selected area
  const shownMembers =
    areaFilter.length === 0
      ? project.members
      : project.members.filter((m) =>
          (areasByUser.get(m.userId) ?? []).some((a) => areaFilter.includes(a.area.id)),
        );

  return (
    <div className="max-w-2xl space-y-4">
      <AreasPanel
        projectId={project.id}
        areas={areas ?? []}
        isManager={isManager}
        onChanged={invalidateAreas}
      />

      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">
          {areaFilter.length > 0
            ? `${shownMembers.length} of ${project.members.length} Members`
            : `${project.members.length} Member${project.members.length !== 1 ? "s" : ""}`}
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

      {(areas ?? []).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {(areas ?? []).map((area) => {
            const active = areaFilter.includes(area.id);
            return (
              <button
                key={area.id}
                onClick={() =>
                  setAreaFilter((prev) =>
                    prev.includes(area.id)
                      ? prev.filter((a) => a !== area.id)
                      : [...prev, area.id],
                  )
                }
                className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-colors ${
                  active
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${active ? "bg-white/80" : areaColor(area.color).dot}`}
                />
                {area.name}
              </button>
            );
          })}
          {areaFilter.length > 0 && (
            <button
              onClick={() => setAreaFilter([])}
              className="text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
            >
              ✕ Clear
            </button>
          )}
        </div>
      )}

      {showAdd && (
        <AddMemberPanel
          projectId={project.id}
          onAdded={invalidate}
          onClose={() => setShowAdd(false)}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        {shownMembers.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">
            No members in the selected area{areaFilter.length !== 1 ? "s" : ""}.
          </p>
        )}
        {shownMembers.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            isManager={isManager}
            isCurrentUser={m.userId === currentUserId}
            allAreas={areas ?? []}
            memberAreas={areasByUser.get(m.userId) ?? []}
            onSetAreas={(next) =>
              setMemberAreas.mutate({ projectId: project.id, userId: m.userId, areas: next })
            }
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

/// Manager-only CRUD over the project's areas.
function AreasPanel({
  projectId,
  areas,
  isManager,
  onChanged,
}: {
  projectId: string;
  areas: Area[];
  isManager: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(AREA_COLOR_KEYS[0]!);

  const createArea = api.project.createArea.useMutation({
    onSuccess: () => { onChanged(); setName(""); },
  });
  const deleteArea = api.project.deleteArea.useMutation({ onSuccess: onChanged });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 text-sm">
          Areas <span className="font-normal text-gray-400">({areas.length})</span>
        </h2>
        {isManager && (
          <button onClick={() => setOpen(!open)} className="text-xs text-gray-500 hover:text-gray-700">
            {open ? "Done" : "Manage"}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {areas.map((a) => (
          <span
            key={a.id}
            className={`text-xs font-medium px-2 py-0.5 rounded ${areaColor(a.color).chip}`}
          >
            {a.name} <span className="opacity-60">{a._count.tasks}</span>
            {open && (
              <button
                onClick={() => {
                  if (confirm(`Delete area "${a.name}"? Tasks keep existing, untagged.`))
                    deleteArea.mutate({ id: a.id });
                }}
                className="ml-1 opacity-60 hover:opacity-100"
                aria-label="Delete area"
              >
                ×
              </button>
            )}
          </span>
        ))}
        {areas.length === 0 && (
          <p className="text-xs text-gray-400">
            No areas yet — split the project into tracks like HRI or Vision.
          </p>
        )}
      </div>

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) createArea.mutate({ projectId, name: name.trim(), color });
          }}
          className="flex items-center gap-2 mt-3"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New area name…"
            className="flex-1 min-w-0 text-sm rounded border border-gray-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <select
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="text-xs rounded border border-gray-300 px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {AREA_COLOR_KEYS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            type="submit"
            disabled={!name.trim() || createArea.isPending}
            className="text-xs px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Add
          </button>
        </form>
      )}
      {createArea.error && <p className="text-xs text-red-600 mt-2">{createArea.error.message}</p>}
    </div>
  );
}

function MemberRow({
  member,
  isManager,
  isCurrentUser,
  allAreas,
  memberAreas,
  onSetAreas,
  onRoleChange,
  onRemove,
  isSaving,
}: {
  member: ProjectMember;
  isManager: boolean;
  isCurrentUser: boolean;
  allAreas: Area[];
  memberAreas: MemberArea[];
  onSetAreas: (areas: { areaId: string; isLead: boolean }[]) => void;
  onRoleChange: (role: "PROJECT_MEMBER" | "PROJECT_MANAGER") => void;
  onRemove: () => void;
  isSaving: boolean;
}) {
  const [editingAreas, setEditingAreas] = useState(false);
  const current = new Map(memberAreas.map((m) => [m.area.id, m.isLead]));

  function commit(next: Map<string, boolean>) {
    onSetAreas([...next].map(([areaId, isLead]) => ({ areaId, isLead })));
  }

  return (
    <div>
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

      <div className="flex flex-wrap gap-1 justify-end shrink-0 max-w-56">
        {memberAreas.map(({ area, isLead }) => (
          <span
            key={area.id}
            className={`text-xs font-medium px-2 py-0.5 rounded ${areaColor(area.color).chip}`}
            title={isLead ? `Area PM of ${area.name} — label only, grants no permissions` : area.name}
          >
            {isLead && "★ "}{area.name}
          </span>
        ))}
        {isManager && allAreas.length > 0 && (
          <button
            onClick={() => setEditingAreas(!editingAreas)}
            className="text-xs text-gray-400 hover:text-gray-600 px-1 transition-colors"
            title="Edit areas"
          >
            {editingAreas ? "✕" : "＋"}
          </button>
        )}
      </div>

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

      {editingAreas && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-400 mb-1.5">
            Click an area to join or leave it. Click the ★ to make this member the
            area&apos;s PM.
          </p>
          <div className="flex flex-wrap gap-1.5 items-center">
            {allAreas.map((a) => {
              const joined = current.has(a.id);
              const isLead = current.get(a.id) ?? false;
              // Whoever currently holds this area's PM, if not this member
              const otherLead = a.members.find((m) => m.isLead && m.userId !== member.userId);
              return (
                <span
                  key={a.id}
                  className={`text-xs font-medium px-2 py-0.5 rounded ${
                    joined ? areaColor(a.color).chip : "bg-white text-gray-400 border border-gray-200"
                  }`}
                >
                  <button
                    onClick={() => {
                      const next = new Map(current);
                      if (joined) next.delete(a.id);
                      else next.set(a.id, false);
                      commit(next);
                    }}
                    title={joined ? `Leave ${a.name}` : `Join ${a.name}`}
                  >
                    {a.name}
                  </button>
                  {joined && (
                    <button
                      onClick={() => commit(new Map(current).set(a.id, !isLead))}
                      className={`ml-1 ${isLead ? "" : "opacity-30"}`}
                      title={
                        isLead
                          ? `Remove as PM of ${a.name}`
                          : otherLead
                            ? `Make PM of ${a.name} — replaces ${otherLead.user.name ?? "the current PM"}`
                            : `Make PM of ${a.name}`
                      }
                    >
                      ★
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </div>
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
      (u.name?.toLowerCase().includes(q) ?? false) ||
      (u.email?.toLowerCase().includes(q) ?? false)
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
