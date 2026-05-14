"use client";

import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";

type Project = RouterOutputs["project"]["getById"];
type LinkDraft = { name: string; url: string };

export function OverviewTab({
  project,
  isManager,
}: {
  project: Project;
  isManager: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const utils = api.useUtils();

  const updateProject = api.project.update.useMutation({
    onSuccess: () => {
      void utils.project.getById.invalidate({ id: project.id });
      setEditing(false);
    },
  });

  const [form, setForm] = useState({
    name: project.name,
    description: project.description ?? "",
    githubRepo: project.githubRepo ?? "",
    status: project.status,
    isPrivate: project.isPrivate,
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateProject.mutate({
      id: project.id,
      name: form.name,
      description: form.description || undefined,
      githubRepo: form.githubRepo || undefined,
      status: form.status as "ACTIVE" | "COMPLETED" | "ARCHIVED",
      isPrivate: form.isPrivate,
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {editing ? (
        <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Edit Project</h2>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">GitHub Repo</label>
            <input
              type="url"
              value={form.githubRepo}
              onChange={(e) => setForm({ ...form, githubRepo: e.target.value })}
              placeholder="https://github.com/…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.isPrivate}
              onChange={(e) => setForm({ ...form, isPrivate: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Private — hidden from non-members</span>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={updateProject.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {updateProject.isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">Details</h2>
              {project.isPrivate && (
                <span className="text-xs bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded">
                  Private
                </span>
              )}
            </div>
            {isManager && (
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-blue-600 hover:underline"
              >
                Edit
              </button>
            )}
          </div>

          {project.description ? (
            <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{project.description}</p>
          ) : (
            <p className="text-sm text-gray-400 mt-2 italic">No description.</p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {project.githubRepo && (
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">GitHub</p>
                <a
                  href={project.githubRepo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate block"
                >
                  {project.githubRepo.replace("https://github.com/", "")}
                </a>
              </div>
            )}
            {project.startDate && (
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Start</p>
                <p>{new Date(project.startDate).toLocaleDateString()}</p>
              </div>
            )}
            {project.endDate && (
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">End</p>
                <p>{new Date(project.endDate).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Members" value={project.members.length} />
        <StatCard label="Tasks" value={project._count.tasks} />
        <StatCard
          label="Your role"
          value={
            project.myRole === "PROJECT_MANAGER"
              ? "Manager"
              : project.myRole === "PROJECT_MEMBER"
                ? "Member"
                : "Observer"
          }
          small
        />
      </div>

      {/* Links */}
      <LinksSection project={project} isManager={isManager} />

      {/* Members preview */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Team</h2>
        <div className="flex flex-wrap gap-2">
          {project.members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 text-sm"
            >
              {m.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.user.image} alt="" className="w-5 h-5 rounded-full" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 text-[10px] font-semibold">
                    {m.user.name?.charAt(0) ?? "?"}
                  </span>
                </div>
              )}
              <span className="text-gray-700">{m.user.name ?? m.user.email}</span>
              {m.role === "PROJECT_MANAGER" && (
                <span className="text-xs text-blue-600 font-medium">PM</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LinksSection({ project, isManager }: { project: Project; isManager: boolean }) {
  const utils = api.useUtils();
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<LinkDraft[]>([]);

  const updateLinks = api.project.updateLinks.useMutation({
    onSuccess: () => {
      void utils.project.getById.invalidate({ id: project.id });
      setEditing(false);
    },
  });

  function openEdit() {
    setDrafts(
      project.links.length > 0
        ? project.links.map((l) => ({ name: l.name, url: l.url }))
        : [{ name: "", url: "" }],
    );
    setEditing(true);
  }

  function setDraft(i: number, key: "name" | "url", value: string) {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, [key]: value } : d)));
  }

  function save() {
    const links = drafts.filter((d) => d.name.trim() && d.url.trim());
    updateLinks.mutate({ projectId: project.id, links });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900">Links</h2>
        {isManager && !editing && (
          <button onClick={openEdit} className="text-xs text-blue-600 hover:underline">
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="space-y-2">
            {drafts.map((d, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={d.name}
                  onChange={(e) => setDraft(i, "name", e.target.value)}
                  placeholder="Name"
                  className="w-32 flex-shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  value={d.url}
                  onChange={(e) => setDraft(i, "url", e.target.value)}
                  placeholder="https://…"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => setDrafts((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setDrafts((prev) => [...prev, { name: "", url: "" }])}
            className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
          >
            + Add link
          </button>
          {updateLinks.error && (
            <p className="text-xs text-red-600">{updateLinks.error.message}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={updateLinks.isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {updateLinks.isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : project.links.length > 0 ? (
        <ul className="space-y-2">
          {project.links.map((l) => (
            <li key={l.id} className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 font-medium w-32 flex-shrink-0 truncate">{l.name}</span>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate"
              >
                {l.url}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-400 italic">
          No links yet.{isManager ? " Click Edit to add some." : ""}
        </p>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  small,
}: {
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
      <p className={`font-bold text-gray-900 ${small ? "text-lg" : "text-2xl"}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
