"use client";

import { useState } from "react";

import { api } from "~/trpc/react";

type LinkDraft = { url: string; description: string };

const emptyLink = (): LinkDraft => ({ url: "", description: "" });

type FormState = {
  name: string;
  description: string;
  links: LinkDraft[];
};

const emptyForm = (): FormState => ({
  name: "",
  description: "",
  links: [emptyLink()],
});

export function WebProjectsClient({ isAdmin }: { isAdmin: boolean }) {
  const utils = api.useUtils();
  const { data: projects, isLoading } = api.webProject.getAll.useQuery();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const createProject = api.webProject.create.useMutation({
    onSuccess: () => {
      void utils.webProject.getAll.invalidate();
      setShowCreate(false);
      setForm(emptyForm());
    },
  });

  const updateProject = api.webProject.update.useMutation({
    onSuccess: () => {
      void utils.webProject.getAll.invalidate();
      setEditingId(null);
      setForm(emptyForm());
    },
  });

  const deleteProject = api.webProject.delete.useMutation({
    onSuccess: () => {
      void utils.webProject.getAll.invalidate();
      setDeletingId(null);
    },
  });

  function openEdit(project: NonNullable<typeof projects>[number]) {
    setEditingId(project.id);
    setShowCreate(false);
    setForm({
      name: project.name,
      description: project.description,
      links:
        project.links.length > 0
          ? project.links.map((l) => ({ url: l.url, description: l.description ?? "" }))
          : [emptyLink()],
    });
  }

  function submitCreate() {
    if (!form.name.trim() || !form.description.trim()) return;
    const links = form.links
      .filter((l) => l.url.trim())
      .map((l, i) => ({ url: l.url.trim(), description: l.description.trim() || undefined, order: i }));
    createProject.mutate({ name: form.name, description: form.description, links });
  }

  function submitEdit() {
    if (!editingId || !form.name.trim() || !form.description.trim()) return;
    const links = form.links
      .filter((l) => l.url.trim())
      .map((l, i) => ({ url: l.url.trim(), description: l.description.trim() || undefined, order: i }));
    updateProject.mutate({ id: editingId, name: form.name, description: form.description, links });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Web Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">Links to RoBorregos web projects and resources</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setShowCreate((v) => !v);
              setEditingId(null);
              setForm(emptyForm());
            }}
            className="text-sm px-4 py-2 bg-[#1a2744] text-white rounded-lg hover:bg-[#243660] transition-colors"
          >
            {showCreate ? "Cancel" : "+ Add Project"}
          </button>
        )}
      </div>

      {isAdmin && showCreate && (
        <ProjectForm
          form={form}
          onChange={setForm}
          onSubmit={submitCreate}
          onCancel={() => { setShowCreate(false); setForm(emptyForm()); }}
          isPending={createProject.isPending}
          error={createProject.error?.message}
          submitLabel="Create"
        />
      )}

      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}

      {!isLoading && projects?.length === 0 && !showCreate && (
        <div className="py-16 text-center text-gray-400">
          <p className="text-4xl mb-3">🔗</p>
          <p className="text-sm font-medium">No web projects yet</p>
          {isAdmin && <p className="text-xs mt-1">Add the first one above.</p>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects?.map((project) =>
          isAdmin && editingId === project.id ? (
            <ProjectForm
              key={project.id}
              form={form}
              onChange={setForm}
              onSubmit={submitEdit}
              onCancel={() => { setEditingId(null); setForm(emptyForm()); }}
              isPending={updateProject.isPending}
              error={updateProject.error?.message}
              submitLabel="Save Changes"
            />
          ) : (
            <div key={project.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h2 className="text-base font-semibold text-gray-900">{project.name}</h2>
                {isAdmin && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEdit(project)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Edit
                    </button>
                    {deletingId === project.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => deleteProject.mutate({ id: project.id })}
                          disabled={deleteProject.isPending}
                          className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {deleteProject.isPending ? "Deleting…" : "Confirm"}
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(project.id)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-2">{project.description}</p>

              {project.links.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {project.links.map((link) => (
                    <li key={link.id} className="flex items-start gap-2">
                      <span className="mt-0.5 text-blue-400 flex-shrink-0">🔗</span>
                      <div className="min-w-0">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline break-all"
                        >
                          {link.url}
                        </a>
                        {link.description && (
                          <p className="text-xs text-gray-400">{link.description}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {project.links.length === 0 && (
                <p className="mt-2 text-xs text-gray-400 italic">No links added.</p>
              )}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function ProjectForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  isPending,
  error,
  submitLabel,
}: {
  form: FormState;
  onChange: (f: FormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isPending: boolean;
  error?: string;
  submitLabel: string;
}) {
  function setField(key: "name" | "description", value: string) {
    onChange({ ...form, [key]: value });
  }

  function setLink(index: number, key: "url" | "description", value: string) {
    const links = form.links.map((l, i) => (i === index ? { ...l, [key]: value } : l));
    onChange({ ...form, links });
  }

  function addLink() {
    onChange({ ...form, links: [...form.links, emptyLink()] });
  }

  function removeLink(index: number) {
    onChange({ ...form, links: form.links.filter((_, i) => i !== index) });
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-4 space-y-4">
      <div>
        <Label>Project Name *</Label>
        <input
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          className={inputCls}
          placeholder="e.g. RoBorregos Home"
        />
      </div>

      <div>
        <Label>Description *</Label>
        <textarea
          value={form.description}
          onChange={(e) => setField("description", e.target.value)}
          rows={2}
          className={inputCls + " resize-none"}
          placeholder="What is this project?"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Links</Label>
          <button
            type="button"
            onClick={addLink}
            className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
          >
            + Add link
          </button>
        </div>
        <div className="space-y-2">
          {form.links.map((link, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1">
                <input
                  value={link.url}
                  onChange={(e) => setLink(i, "url", e.target.value)}
                  className={inputCls}
                  placeholder="https://…"
                />
                <input
                  value={link.description}
                  onChange={(e) => setLink(i, "description", e.target.value)}
                  className={inputCls}
                  placeholder="Optional description"
                />
              </div>
              {form.links.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLink(i)}
                  className="mt-1 text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
                  aria-label="Remove link"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={isPending}
          className="text-sm px-4 py-2 bg-[#1a2744] text-white rounded-lg hover:bg-[#243660] disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="text-sm px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
      {children}
    </label>
  );
}
