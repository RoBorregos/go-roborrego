"use client";

import { useRef, useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useUpload } from "~/lib/useUpload";
import { areaColor } from "./areaColors";

type Task = NonNullable<RouterOutputs["project"]["getTask"]>;

const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const STATUS_OPTIONS = ["TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "DONE"] as const;

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-500 border-gray-200",
  MEDIUM: "bg-blue-50 text-blue-600 border-blue-200",
  HIGH: "bg-orange-50 text-orange-600 border-orange-200",
  URGENT: "bg-red-50 text-red-600 border-red-200",
};

export function TaskPanel({
  taskId,
  userId,
  isMember,
  isManager,
  onClose,
}: {
  taskId: string;
  userId: string;
  isMember: boolean;
  isManager: boolean;
  onClose: () => void;
}) {
  const { data: task, isPending } = api.project.getTask.useQuery({ id: taskId });
  const utils = api.useUtils();

  function invalidateTask() {
    void utils.project.getTask.invalidate({ id: taskId });
    if (task) void utils.project.getTasks.invalidate({ projectId: task.projectId });
  }

  const updateTask = api.project.updateTask.useMutation({ onSuccess: invalidateTask });
  const deleteTask = api.project.deleteTask.useMutation({
    onSuccess: () => {
      if (task) void utils.project.getTasks.invalidate({ projectId: task.projectId });
      onClose();
    },
  });
  const addComment = api.project.addComment.useMutation({ onSuccess: invalidateTask });
  const deleteComment = api.project.deleteComment.useMutation({ onSuccess: invalidateTask });

  const [comment, setComment] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");

  if (isPending) {
    return (
      <PanelShell onClose={onClose}>
        <p className="text-sm text-gray-400 p-4">Loading…</p>
      </PanelShell>
    );
  }

  if (!task) {
    return (
      <PanelShell onClose={onClose}>
        <p className="text-sm text-gray-400 p-4">Task not found.</p>
      </PanelShell>
    );
  }

  function startEditTitle() {
    setTitleInput(task!.title);
    setEditingTitle(true);
  }

  function saveTitle() {
    if (titleInput.trim() && titleInput !== task!.title) {
      updateTask.mutate({ id: task!.id, title: titleInput.trim() });
    }
    setEditingTitle(false);
  }

  function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    addComment.mutate({ taskId: task!.id, content: comment.trim() });
    setComment("");
  }

  return (
    <PanelShell onClose={onClose}>
      <div className="p-4 space-y-4">
        {/* Title */}
        {editingTitle ? (
          <input
            autoFocus
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") setEditingTitle(false);
            }}
            className="w-full text-lg font-bold text-gray-900 border-b-2 border-blue-400 outline-none pb-1"
          />
        ) : (
          <h2
            className={`text-lg font-bold text-gray-900 leading-snug ${isMember ? "cursor-pointer hover:text-blue-700" : ""}`}
            onClick={isMember ? startEditTitle : undefined}
          >
            {task.title}
          </h2>
        )}

        {/* Status + Priority */}
        <div className="flex gap-2 flex-wrap">
          {isMember ? (
            <select
              value={task.status}
              onChange={(e) =>
                updateTask.mutate({ id: task.id, status: e.target.value as typeof task.status })
              }
              className="text-xs rounded border border-gray-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
              {task.status.replace("_", " ")}
            </span>
          )}

          {isMember ? (
            <select
              value={task.priority}
              onChange={(e) =>
                updateTask.mutate({ id: task.id, priority: e.target.value as typeof task.priority })
              }
              className={`text-xs rounded border px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 ${PRIORITY_STYLES[task.priority] ?? ""}`}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          ) : (
            <span
              className={`text-xs px-2 py-0.5 rounded border font-medium ${PRIORITY_STYLES[task.priority] ?? ""}`}
            >
              {task.priority}
            </span>
          )}
        </div>

        {/* Blocked details — server clears these when status leaves BLOCKED */}
        {task.status === "BLOCKED" && (
          <BlockedSection
            task={task}
            isMember={isMember}
            onUpdate={(patch) => updateTask.mutate({ id: task.id, ...patch })}
          />
        )}

        {/* Due date */}
        {isMember && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
            <input
              type="date"
              value={task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""}
              onChange={(e) =>
                updateTask.mutate({
                  id: task.id,
                  dueDate: e.target.value ? new Date(e.target.value) : null,
                })
              }
              className="text-sm rounded border border-gray-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        )}

        {/* Description */}
        {isMember ? (
          <DescriptionEditor
            taskId={task.id}
            initial={task.description ?? ""}
            onSave={(desc) => updateTask.mutate({ id: task.id, description: desc })}
          />
        ) : task.description ? (
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.description}</p>
        ) : null}

        {/* Assignees */}
        <AssigneesEditor
          task={task}
          isMember={isMember}
          onUpdate={(ids) => updateTask.mutate({ id: task.id, assigneeIds: ids })}
        />

        {/* Areas */}
        <AreasEditor
          task={task}
          isMember={isMember}
          onUpdate={(ids) => updateTask.mutate({ id: task.id, areaIds: ids })}
        />

        {/* Labels */}
        <LabelsEditor
          task={task}
          isMember={isMember}
          onUpdate={(labels) => updateTask.mutate({ id: task.id, labels })}
        />

        {/* Creator + dates */}
        <div className="text-xs text-gray-400 space-y-0.5 pt-1 border-t border-gray-100">
          <p>Created by {task.creator.name ?? "—"}</p>
          <p>
            {new Date(task.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Delete */}
        {isManager && (
          <button
            onClick={() => {
              if (confirm("Delete this task?")) deleteTask.mutate({ id: task.id });
            }}
            disabled={deleteTask.isPending}
            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
          >
            {deleteTask.isPending ? "Deleting…" : "Delete task"}
          </button>
        )}

        {/* Attachments */}
        <div className="pt-2 border-t border-gray-100">
          <AttachmentsSection
            task={task}
            isMember={isMember}
            userId={userId}
            onUpdate={invalidateTask}
          />
        </div>

        {/* Comments */}
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-3">
            Comments ({task.comments.length})
          </p>

          <div className="space-y-3 mb-4">
            {task.comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                {c.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.user.image} alt="" className="w-6 h-6 rounded-full shrink-0 mt-0.5" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] text-blue-600 font-bold">
                      {c.user.name?.charAt(0) ?? "?"}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-gray-700">{c.user.name}</span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                    {(c.user.id === userId) && (
                      <button
                        onClick={() => deleteComment.mutate({ id: c.id })}
                        className="text-[10px] text-red-400 hover:text-red-600 ml-auto"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 whitespace-pre-wrap">{c.content}</p>
                </div>
              </div>
            ))}
          </div>

          {isMember && (
            <form onSubmit={submitComment} className="flex gap-2">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment…"
                rows={2}
                className="flex-1 text-sm rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
              <button
                type="submit"
                disabled={!comment.trim() || addComment.isPending}
                className="self-end px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Post
              </button>
            </form>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

function PanelShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="w-80 shrink-0 bg-white rounded-xl border border-gray-200 shadow-sm h-fit max-h-[calc(100vh-8rem)] overflow-y-auto sticky top-8">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Task Detail</p>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          ×
        </button>
      </div>
      {children}
    </div>
  );
}

function AttachmentsSection({
  task,
  isMember,
  userId,
  onUpdate,
}: {
  task: Task;
  isMember: boolean;
  userId: string;
  onUpdate: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { upload, isUploading, error: uploadError } = useUpload();

  const addAttachment = api.project.addAttachment.useMutation({ onSuccess: onUpdate });
  const deleteAttachment = api.project.deleteAttachment.useMutation({ onSuccess: onUpdate });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${task.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const result = await upload(file, { bucket: "task-attachments", path });
    if (!result) return;
    addAttachment.mutate({
      taskId: task.id,
      fileName: file.name,
      fileUrl: result.publicUrl,
      storagePath: result.path,
      fileSize: file.size,
      mimeType: file.type || `application/octet-stream`,
    });
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return (
    <>
      <p className="text-xs font-medium text-gray-500 mb-2">
        Attachments ({task.attachments.length})
      </p>

      {task.attachments.length > 0 && (
        <div className="space-y-1 mb-2">
          {task.attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
            >
              <span className="text-sm">📎</span>
              <a
                href={a.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-xs text-blue-600 hover:underline truncate"
              >
                {a.fileName}
              </a>
              <span className="text-[10px] text-gray-400 shrink-0">{formatBytes(a.fileSize)}</span>
              {(a.user.id === userId) && (
                <button
                  onClick={() => deleteAttachment.mutate({ id: a.id })}
                  disabled={deleteAttachment.isPending}
                  className="text-[10px] text-red-400 hover:text-red-600 shrink-0"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isMember && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept="*/*"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || addAttachment.isPending}
            className="text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 rounded-lg px-3 py-1.5 w-full hover:border-gray-400 disabled:opacity-50 transition-colors"
          >
            {isUploading || addAttachment.isPending ? "Uploading…" : "+ Attach file"}
          </button>
          {uploadError && (
            <p className="text-xs text-red-600 mt-1">{uploadError}</p>
          )}
        </>
      )}
    </>
  );
}

function BlockedSection({
  task,
  isMember,
  onUpdate,
}: {
  task: Task;
  isMember: boolean;
  onUpdate: (patch: { blockedReason?: string | null; blockedByAreaId?: string | null }) => void;
}) {
  const { data: areas } = api.project.getAreas.useQuery({ projectId: task.projectId });
  // A task can't be waiting on an area it belongs to
  const own = new Set(task.areas.map((a) => a.areaId));

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
      <p className="text-xs font-semibold text-red-700">⛔ Blocked</p>
      <select
        disabled={!isMember}
        value={task.blockedByAreaId ?? ""}
        onChange={(e) => onUpdate({ blockedByAreaId: e.target.value || null })}
        className="w-full text-xs rounded border border-red-200 bg-white px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-400"
      >
        <option value="">Not waiting on an area</option>
        {(areas ?? []).filter((a) => !own.has(a.id)).map((a) => (
          <option key={a.id} value={a.id}>Waiting on {a.name}</option>
        ))}
      </select>
      <textarea
        key={task.id}
        readOnly={!isMember}
        rows={2}
        defaultValue={task.blockedReason ?? ""}
        placeholder="Why is this blocked?"
        onBlur={(e) => {
          const next = e.target.value.trim();
          if (next !== (task.blockedReason ?? "")) onUpdate({ blockedReason: next || null });
        }}
        className="w-full text-xs rounded border border-red-200 bg-white px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-400"
      />
    </div>
  );
}

/// Areas are a small fixed per-project set, so toggle chips beat a typeahead.
function AreasEditor({
  task,
  isMember,
  onUpdate,
}: {
  task: Task;
  isMember: boolean;
  onUpdate: (ids: string[]) => void;
}) {
  const { data: areas } = api.project.getAreas.useQuery({ projectId: task.projectId });
  const current = task.areas.map((a) => a.areaId);
  const shown = isMember
    ? (areas ?? [])
    : (areas ?? []).filter((a) => current.includes(a.id));

  if (shown.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1.5">Areas</p>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((a) => {
          const on = current.includes(a.id);
          return (
            <button
              key={a.id}
              disabled={!isMember}
              onClick={() =>
                onUpdate(on ? current.filter((id) => id !== a.id) : [...current, a.id])
              }
              className={`text-xs font-medium px-2 py-0.5 rounded transition-colors ${
                on
                  ? areaColor(a.color).chip
                  : "bg-white text-gray-400 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {a.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AssigneesEditor({
  task,
  isMember,
  onUpdate,
}: {
  task: Task;
  isMember: boolean;
  onUpdate: (ids: string[]) => void;
}) {
  const { data: projectMembers } = api.project.getProjectMembers.useQuery(
    { projectId: task.projectId },
    { enabled: isMember },
  );

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const assignedIds = new Set(task.assignees.map((a) => a.user.id));
  const currentIds = task.assignees.map((a) => a.user.id);

  const available = (projectMembers ?? []).filter(
    (m) =>
      !assignedIds.has(m.userId) &&
      ((m.user.name?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        (m.user.email?.toLowerCase().includes(search.toLowerCase()) ?? false)),
  );

  function addAssignee(userId: string) {
    onUpdate([...currentIds, userId]);
    setSearch("");
    setOpen(false);
  }

  function removeAssignee(userId: string) {
    onUpdate(currentIds.filter((id) => id !== userId));
  }

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1.5">Assignees</p>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {task.assignees.map((a) => (
          <div
            key={a.user.id}
            className="flex items-center gap-1.5 bg-gray-50 rounded-full px-2 py-0.5 text-xs text-gray-700"
          >
            {a.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.user.image} alt="" className="w-4 h-4 rounded-full" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-[8px] text-blue-600 font-bold">
                  {a.user.name?.charAt(0) ?? "?"}
                </span>
              </div>
            )}
            {a.user.name ?? "—"}
            {isMember && (
              <button
                onClick={() => removeAssignee(a.user.id)}
                className="text-gray-400 hover:text-red-500 ml-0.5 leading-none"
                aria-label="Remove"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {task.assignees.length === 0 && !isMember && (
          <p className="text-xs text-gray-400">None</p>
        )}
      </div>

      {isMember && (
        <div className="relative">
          <input
            type="text"
            placeholder="Add assignee…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="w-full text-xs rounded border border-gray-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          {open && available.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-md max-h-40 overflow-y-auto">
              {available.map((m) => (
                <button
                  key={m.userId}
                  onMouseDown={() => addAssignee(m.userId)}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2"
                >
                  {m.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.user.image} alt="" className="w-5 h-5 rounded-full" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-[8px] text-blue-600 font-bold">
                        {m.user.name?.charAt(0) ?? "?"}
                      </span>
                    </div>
                  )}
                  <span className="text-xs font-medium text-gray-800">{m.user.name}</span>
                  <span className="text-[10px] text-gray-400">{m.user.email}</span>
                </button>
              ))}
            </div>
          )}
          {open && search.length > 0 && available.length === 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-md px-3 py-2 text-xs text-gray-400">
              No matching members
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LabelsEditor({
  task,
  isMember,
  onUpdate,
}: {
  task: Task;
  isMember: boolean;
  onUpdate: (labels: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);

  const { data: projectLabels } = api.project.getProjectLabels.useQuery(
    { projectId: task.projectId },
    { enabled: isMember },
  );

  const suggestions = (projectLabels ?? []).filter(
    (l) =>
      !task.labels.includes(l) &&
      l.toLowerCase().includes(input.toLowerCase()),
  );
  const showDropdown = open && (suggestions.length > 0 || (input.trim().length > 0 && !task.labels.includes(input.trim())));

  function addLabel(value?: string) {
    const trimmed = (value ?? input).trim();
    if (!trimmed || task.labels.includes(trimmed)) return;
    onUpdate([...task.labels, trimmed]);
    setInput("");
    setOpen(false);
  }

  function removeLabel(label: string) {
    onUpdate(task.labels.filter((l) => l !== label));
  }

  if (!isMember && task.labels.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1.5">Labels</p>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {task.labels.map((label) => (
          <span
            key={label}
            className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
          >
            {label}
            {isMember && (
              <button
                onClick={() => removeLabel(label)}
                className="text-gray-400 hover:text-red-500 leading-none"
                aria-label="Remove label"
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {isMember && (
        <div className="relative flex gap-1">
          <input
            type="text"
            placeholder="Add label…"
            value={input}
            onChange={(e) => { setInput(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addLabel(); }
            }}
            className="flex-1 text-xs rounded border border-gray-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={() => addLabel()}
            disabled={!input.trim()}
            className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-40 transition-colors"
          >
            Add
          </button>
          {showDropdown && (
            <div className="absolute z-20 top-full left-0 right-8 mt-0.5 bg-white border border-gray-200 rounded shadow-md max-h-40 overflow-y-auto">
              {input.trim() && !task.labels.includes(input.trim()) && !suggestions.includes(input.trim()) && (
                <button
                  onMouseDown={() => addLabel(input.trim())}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-xs text-gray-700"
                >
                  Create <span className="font-medium">&quot;{input.trim()}&quot;</span>
                </button>
              )}
              {suggestions.map((s) => (
                <button
                  key={s}
                  onMouseDown={() => addLabel(s)}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-xs text-gray-700"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DescriptionEditor({
  taskId,
  initial,
  onSave,
}: {
  taskId: string;
  initial: string;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);

  if (!editing) {
    return (
      <div
        className="text-sm text-gray-600 cursor-pointer hover:bg-gray-50 rounded p-1 -mx-1 min-h-[2rem]"
        onClick={() => setEditing(true)}
      >
        {value || (
          <span className="text-gray-400 italic">Add a description…</span>
        )}
      </div>
    );
  }

  return (
    <div>
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        className="w-full text-sm rounded-lg border border-blue-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
      />
      <div className="flex gap-2 mt-1">
        <button
          onClick={() => { onSave(value); setEditing(false); }}
          className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Save
        </button>
        <button
          onClick={() => { setValue(initial); setEditing(false); }}
          className="text-xs px-2 py-1 text-gray-500 rounded hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
