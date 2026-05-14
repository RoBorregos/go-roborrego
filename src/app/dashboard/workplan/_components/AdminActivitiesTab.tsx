"use client";

import { useRef, useState } from "react";

import { api } from "~/trpc/react";

type ActivityFormState = {
  name: string;
  description: string;
  points: string;
  estimatedDate: string;
  adminMessage: string;
  isMandatory: boolean;
};

const emptyForm: ActivityFormState = {
  name: "",
  description: "",
  points: "",
  estimatedDate: "",
  adminMessage: "",
  isMandatory: false,
};

export function AdminActivitiesTab({
  semesterId,
  semesterName,
}: {
  semesterId: string;
  semesterName: string;
}) {
  const utils = api.useUtils();

  const { data: activities, isLoading } = api.workPlan.getActivities.useQuery({
    semesterId,
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ActivityFormState>(emptyForm);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reviewersPanelId, setReviewersPanelId] = useState<string | null>(null);

  const createActivity = api.workPlan.createActivity.useMutation({
    onSuccess: () => {
      void utils.workPlan.getActivities.invalidate();
      setShowCreate(false);
      setForm(emptyForm);
    },
  });

  const updateActivity = api.workPlan.updateActivity.useMutation({
    onSuccess: () => {
      void utils.workPlan.getActivities.invalidate();
      setEditingId(null);
      setForm(emptyForm);
    },
  });

  const deleteActivity = api.workPlan.deleteActivity.useMutation({
    onSuccess: () => {
      void utils.workPlan.getActivities.invalidate();
      setDeletingId(null);
    },
  });

  function openEdit(activity: NonNullable<typeof activities>[number]) {
    setEditingId(activity.id);
    setShowCreate(false);
    setForm({
      name: activity.name,
      description: activity.description,
      points: String(activity.points),
      estimatedDate: activity.estimatedDate
        ? new Date(activity.estimatedDate).toISOString().slice(0, 10)
        : "",
      adminMessage: activity.adminMessage ?? "",
      isMandatory: activity.isMandatory,
    });
  }

  function handleFormChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  }

  function submitCreate() {
    if (!form.name.trim() || !form.description.trim() || !form.points) return;
    createActivity.mutate({
      semesterId,
      name: form.name,
      description: form.description,
      points: parseInt(form.points),
      estimatedDate: form.estimatedDate
        ? new Date(form.estimatedDate)
        : undefined,
      adminMessage: form.adminMessage || undefined,
      isMandatory: form.isMandatory,
    });
  }

  function submitEdit() {
    if (!editingId) return;
    updateActivity.mutate({
      id: editingId,
      name: form.name || undefined,
      description: form.description || undefined,
      points: form.points ? parseInt(form.points) : undefined,
      estimatedDate: form.estimatedDate
        ? new Date(form.estimatedDate)
        : undefined,
      adminMessage: form.adminMessage || undefined,
      isMandatory: form.isMandatory,
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {activities?.length ?? 0} activities in{" "}
          <span className="font-medium text-gray-700">{semesterName}</span>
        </p>
        <button
          onClick={() => {
            setShowCreate((v) => !v);
            setEditingId(null);
            setForm(emptyForm);
          }}
          className="rounded-lg bg-[#1a2744] px-4 py-2 text-sm text-white transition-colors hover:bg-[#243660]"
        >
          {showCreate ? "Cancel" : "+ Add Activity"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <ActivityForm
          form={form}
          onChange={handleFormChange}
          onSubmit={submitCreate}
          onCancel={() => {
            setShowCreate(false);
            setForm(emptyForm);
          }}
          isPending={createActivity.isPending}
          error={createActivity.error?.message}
          submitLabel="Create Activity"
        />
      )}

      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}

      <div className="mt-4 space-y-3">
        {activities?.map((activity) => (
          <div key={activity.id}>
            {editingId === activity.id ? (
              <ActivityForm
                form={form}
                onChange={handleFormChange}
                onSubmit={submitEdit}
                onCancel={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                isPending={updateActivity.isPending}
                error={updateActivity.error?.message}
                submitLabel="Save Changes"
              />
            ) : (
              <div
                className={`rounded-xl border bg-white p-4 shadow-sm ${
                  activity.isMandatory ? "border-amber-200" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {activity.name}
                      </span>
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                        {activity.points} pts
                      </span>
                      {activity.isMandatory && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                          Mandatory
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {activity.description}
                    </p>
                    {activity.adminMessage && (
                      <p className="mt-1 rounded border border-blue-100 bg-blue-50 px-2 py-1 text-xs text-blue-600">
                        📋 {activity.adminMessage}
                      </p>
                    )}
                    {activity.estimatedDate && (
                      <p className="mt-1 text-xs text-gray-400">
                        Est.{" "}
                        {new Date(activity.estimatedDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <button
                      onClick={() =>
                        setReviewersPanelId(
                          reviewersPanelId === activity.id ? null : activity.id,
                        )
                      }
                      className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                        reviewersPanelId === activity.id
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Reviewers
                    </button>
                    <button
                      onClick={() => openEdit(activity)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    {deletingId === activity.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() =>
                            deleteActivity.mutate({ id: activity.id })
                          }
                          disabled={deleteActivity.isPending}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                        >
                          {deleteActivity.isPending ? "Deleting…" : "Confirm"}
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(activity.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                {reviewersPanelId === activity.id && (
                  <ReviewersPanel activityId={activity.id} />
                )}
              </div>
            )}
          </div>
        ))}
        {!isLoading && activities?.length === 0 && !showCreate && (
          <p className="text-sm text-gray-400">
            No activities yet. Add the first one above.
          </p>
        )}
      </div>
    </div>
  );
}

function ActivityForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  isPending,
  error,
  submitLabel,
}: {
  form: ActivityFormState;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isPending: boolean;
  error?: string;
  submitLabel: string;
}) {
  return (
    <div className="mb-4 space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Activity Name *</Label>
          <input
            name="name"
            value={form.name}
            onChange={onChange}
            className={inputCls}
            placeholder="e.g. Present at RoboMed 2026"
          />
        </div>

        <div className="sm:col-span-2">
          <Label>Description *</Label>
          <textarea
            name="description"
            value={form.description}
            onChange={onChange}
            rows={2}
            className={inputCls + " resize-none"}
            placeholder="What is this activity about?"
          />
        </div>

        <div>
          <Label>Points *</Label>
          <input
            name="points"
            type="number"
            min={1}
            value={form.points}
            onChange={onChange}
            className={inputCls}
            placeholder="e.g. 10"
          />
        </div>

        <div>
          <Label>Estimated Date</Label>
          <input
            name="estimatedDate"
            type="date"
            value={form.estimatedDate}
            onChange={onChange}
            className={inputCls}
          />
        </div>

        <div className="sm:col-span-2">
          <Label>Submission Instructions</Label>
          <input
            name="adminMessage"
            value={form.adminMessage}
            onChange={onChange}
            className={inputCls}
            placeholder="What should members include in their submission note?"
          />
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            id="isMandatory"
            name="isMandatory"
            type="checkbox"
            checked={form.isMandatory}
            onChange={onChange}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="isMandatory" className="text-sm text-gray-700">
            Mandatory for all active members
          </label>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={isPending}
          className="rounded-lg bg-[#1a2744] px-4 py-2 text-sm text-white transition-colors hover:bg-[#243660] disabled:opacity-50"
        >
          {isPending ? "Saving…" : submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ReviewersPanel({ activityId }: { activityId: string }) {
  const utils = api.useUtils();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: reviewers, isLoading } =
    api.workPlan.getActivityReviewers.useQuery({ activityId });
  const { data: members } = api.member.getDirectory.useQuery({});

  const addReviewer = api.workPlan.addActivityReviewer.useMutation({
    onSuccess: () => {
      void utils.workPlan.getActivityReviewers.invalidate({ activityId });
      setSelectedUserId("");
      setSearch("");
      setOpen(false);
    },
  });

  const removeReviewer = api.workPlan.removeActivityReviewer.useMutation({
    onSuccess: () =>
      void utils.workPlan.getActivityReviewers.invalidate({ activityId }),
  });

  const reviewerIds = new Set(reviewers?.map((r) => r.userId));
  const filtered = (members ?? []).filter((m) => {
    if (reviewerIds.has(m.id)) return false;
    const q = search.toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ?? m.email?.toLowerCase().includes(q)
    );
  });

  function selectMember(id: string, name: string | null, email: string | null) {
    setSelectedUserId(id);
    setSearch(name ?? email ?? "");
    setOpen(false);
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <p className="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
        Reviewers
      </p>

      {isLoading && <p className="text-xs text-gray-400">Loading…</p>}

      {reviewers?.length === 0 && !isLoading && (
        <p className="mb-2 text-xs text-gray-400">
          No reviewers assigned. Only admins can review submissions.
        </p>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        {reviewers?.map((r) => (
          <span
            key={r.userId}
            className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 py-0.5 pr-2 pl-1 text-xs text-blue-800"
          >
            {r.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.user.image} alt="" className="h-4 w-4 rounded-full" />
            ) : (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-200 text-[10px] font-bold">
                {r.user.name?.charAt(0) ?? "?"}
              </span>
            )}
            {r.user.name ?? r.user.email}
            <button
              onClick={() =>
                removeReviewer.mutate({ activityId, userId: r.userId })
              }
              disabled={removeReviewer.isPending}
              className="ml-0.5 leading-none text-blue-400 transition-colors hover:text-red-500"
              aria-label="Remove reviewer"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <div ref={containerRef} className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedUserId("");
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search by name or email…"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          {open && filtered.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {filtered.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onMouseDown={() => selectMember(m.id, m.name, m.email)}
                    className="w-full px-3 py-2 text-left transition-colors hover:bg-blue-50"
                  >
                    <span className="block text-xs font-medium text-gray-900">
                      {m.name ?? "—"}
                    </span>
                    <span className="block text-[11px] text-gray-400">
                      {m.email}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={() => {
            if (selectedUserId)
              addReviewer.mutate({ activityId, userId: selectedUserId });
          }}
          disabled={!selectedUserId || addReviewer.isPending}
          className="rounded-lg bg-[#1a2744] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[#243660] disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {addReviewer.error && (
        <p className="mt-1 text-xs text-red-600">{addReviewer.error.message}</p>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold tracking-wider text-gray-600 uppercase">
      {children}
    </label>
  );
}
