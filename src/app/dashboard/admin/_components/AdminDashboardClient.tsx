"use client";

import { useState } from "react";
import Link from "next/link";
import { api, type RouterOutputs } from "~/trpc/react";

type Overview = RouterOutputs["admin"]["getOverview"];

export function AdminDashboardClient() {
  const { data, isPending } = api.admin.getOverview.useQuery();
  const utils = api.useUtils();

  const reviewCompletion = api.workPlan.reviewCompletion.useMutation({
    onSuccess: () => void utils.admin.getOverview.invalidate(),
  });

  if (isPending) {
    return <p className="text-sm text-gray-400">Loading…</p>;
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Platform overview and pending actions
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active Members"
          value={data.members.active}
          sub={`${data.members.newThisMonth} joined this month`}
          href="/dashboard/admin/members"
          color="blue"
        />
        <StatCard
          label="Pending Reviews"
          value={data.pendingCompletions}
          sub="Work plan completions"
          href="/dashboard/workplan"
          color={data.pendingCompletions > 0 ? "amber" : "green"}
          urgent={data.pendingCompletions > 0}
        />
        <StatCard
          label="Active Projects"
          value={data.activeProjects}
          sub="Across all sub-teams"
          href="/dashboard/projects"
          color="indigo"
        />
        <StatCard
          label="Upcoming Meetings"
          value={data.upcomingMeetings.length}
          sub="Next 7 days"
          href="/dashboard/attendance"
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pending completions quick-review */}
        <Section
          title="Pending Completions"
          count={data.pendingCompletions}
          linkHref="/dashboard/workplan"
          linkLabel="View all"
          empty={data.recentPendingCompletions.length === 0}
          emptyText="No pending reviews."
        >
          <div className="divide-y divide-gray-100">
            {data.recentPendingCompletions.map((c) => (
              <PendingCompletionRow
                key={c.id}
                completion={c}
                onApprove={() =>
                  reviewCompletion.mutate({ id: c.id, status: "APPROVED" })
                }
                onReject={() =>
                  reviewCompletion.mutate({ id: c.id, status: "REJECTED" })
                }
                isSaving={reviewCompletion.isPending}
              />
            ))}
            {data.pendingCompletions > 5 && (
              <p className="px-4 py-2 text-xs text-gray-400">
                +{data.pendingCompletions - 5} more —{" "}
                <Link
                  href="/dashboard/workplan"
                  className="text-blue-600 hover:underline"
                >
                  review all
                </Link>
              </p>
            )}
          </div>
        </Section>

        {/* Upcoming meetings */}
        <Section
          title="Upcoming Meetings"
          count={data.upcomingMeetings.length}
          linkHref="/dashboard/attendance"
          linkLabel="Manage"
          empty={data.upcomingMeetings.length === 0}
          emptyText="No meetings in the next 7 days."
        >
          <div className="divide-y divide-gray-100">
            {data.upcomingMeetings.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {m.title}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(m.startTime).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    ·{" "}
                    {new Date(m.startTime).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {m.duration} min
                  </p>
                </div>
                <span className="shrink-0 text-xs text-gray-400">
                  {m._count.attendances} checked in
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Roster health */}
        <Section
          title="Roster Health"
          linkHref="/dashboard/admin/members"
          linkLabel="Manage roster"
          empty={false}
        >
          <div className="space-y-3 px-4 py-3">
            <RosterBar
              label="Active"
              value={data.members.active}
              color="bg-green-500"
              total={
                data.members.active +
                data.members.inactive +
                data.members.alumni
              }
            />
            <RosterBar
              label="Inactive"
              value={data.members.inactive}
              color="bg-gray-300"
              total={
                data.members.active +
                data.members.inactive +
                data.members.alumni
              }
            />
            <RosterBar
              label="Alumni"
              value={data.members.alumni}
              color="bg-purple-300"
              total={
                data.members.active +
                data.members.inactive +
                data.members.alumni
              }
            />

            {data.members.neverLoggedIn > 0 && (
              <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
                <p className="text-xs font-medium text-amber-600">
                  {data.members.neverLoggedIn} active member
                  {data.members.neverLoggedIn !== 1 ? "s" : ""} never logged in
                </p>
                <Link
                  href="/dashboard/admin/members?status=ACTIVE"
                  className="text-xs text-blue-600 hover:underline"
                >
                  View
                </Link>
              </div>
            )}
          </div>
        </Section>

        {/* Quick links */}
        <Section title="Quick Links" empty={false}>
          <div className="grid grid-cols-2 gap-2 px-4 py-3">
            {[
              {
                label: "Roster",
                href: "/dashboard/admin/members",
                desc: "Manage members",
              },
              {
                label: "Attendance",
                href: "/dashboard/attendance",
                desc: "Meetings & check-ins",
              },
              {
                label: "Work Plan",
                href: "/dashboard/workplan",
                desc: "Review completions",
              },
              {
                label: "Projects",
                href: "/dashboard/projects",
                desc: "All active projects",
              },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg border border-gray-200 px-3 py-2.5 transition-colors hover:border-blue-200 hover:bg-blue-50"
              >
                <p className="text-sm font-medium text-gray-900">
                  {link.label}
                </p>
                <p className="text-xs text-gray-400">{link.desc}</p>
              </Link>
            ))}
          </div>
        </Section>

        {/* Web export */}
        <WebExportPanel />

        {/* Sayings moderation */}
        <SayingsPanel />
      </div>
    </div>
  );
}

function WebExportPanel() {
  const [result, setResult] = useState<{
    prUrl?: string;
    prNumber?: number;
    memberCount?: number;
    imagesUploaded?: number;
    newIdAssignments?: number;
    preview?: Record<string, unknown>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportMutation = api.admin.exportToWebRepo.useMutation({
    onSuccess: (data) => {
      if (!data.dryRun) setResult(data);
    },
    onError: (e) => setError(e.message),
  });

  const dryRunMutation = api.admin.exportToWebRepo.useMutation({
    onSuccess: (data) => {
      if (data.dryRun) {
        const preview = data as {
          dryRun: true;
          memberCount: number;
          newIdAssignments: number;
          preview: Record<string, unknown>;
        };
        setResult({
          memberCount: preview.memberCount,
          newIdAssignments: preview.newIdAssignments,
          preview: preview.preview,
        });
      }
    },
    onError: (e) => setError(e.message),
  });

  const isBusy = exportMutation.isPending || dryRunMutation.isPending;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:col-span-2">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">
          Export Members to Website
        </h2>
        <span className="text-xs text-gray-400">roborregos-web</span>
      </div>
      <div className="space-y-3 px-4 py-4">
        <p className="text-xs text-gray-500">
          Creates a pull request on{" "}
          <span className="font-mono">RoBorregos/roborregos-web</span> with
          updated <span className="font-mono">members.json</span> and member
          images. Members marked &ldquo;Exclude from export&rdquo; are skipped.
          Web IDs are auto-assigned if missing.
        </p>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </p>
        )}

        {result?.prUrl && (
          <div className="space-y-1 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs">
            <p className="font-medium text-green-800">
              PR created successfully
            </p>
            <p className="text-green-700">
              {result.memberCount} members · {result.imagesUploaded} images ·{" "}
              {result.newIdAssignments} new IDs assigned
            </p>
            <a
              href={result.prUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-blue-600 hover:underline"
            >
              PR #{result.prNumber}
            </a>
          </div>
        )}

        {result && !result.prUrl && (
          <div className="space-y-2">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs">
              <p className="font-medium text-blue-800">Dry run complete</p>
              <p className="text-blue-700">
                {result.memberCount} members to export ·{" "}
                {result.newIdAssignments} would get new IDs
              </p>
            </div>
            {result.preview && (
              <div className="space-y-1.5">
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      const blob = new Blob(
                        [JSON.stringify(result.preview, null, 4)],
                        { type: "application/json" },
                      );
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "members.json";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    ↓ Download members.json
                  </button>
                </div>
                <pre className="max-h-72 overflow-auto rounded-lg bg-gray-900 px-3 py-3 text-xs leading-relaxed text-gray-100">
                  {JSON.stringify(result.preview, null, 4)}
                </pre>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => {
              setError(null);
              setResult(null);
              dryRunMutation.mutate({ dryRun: true });
            }}
            disabled={isBusy}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {dryRunMutation.isPending ? "Running…" : "Dry Run"}
          </button>
          <button
            onClick={() => {
              setError(null);
              setResult(null);
              exportMutation.mutate({ dryRun: false });
            }}
            disabled={isBusy}
            className="rounded-lg bg-[#1a2744] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[#243660] disabled:opacity-50"
          >
            {exportMutation.isPending ? "Creating PR…" : "Create PR"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  href,
  color,
  urgent,
}: {
  label: string;
  value: number;
  sub: string;
  href: string;
  color: "blue" | "amber" | "green" | "indigo" | "purple";
  urgent?: boolean;
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-green-50 text-green-700",
    indigo: "bg-indigo-50 text-indigo-700",
    purple: "bg-purple-50 text-purple-700",
  };

  return (
    <Link
      href={href}
      className={`relative rounded-xl border p-5 shadow-sm transition-all hover:shadow-md ${
        urgent ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white"
      }`}
    >
      {urgent && (
        <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-amber-400" />
      )}
      <p className={`text-3xl font-bold ${colors[color]}`}>{value}</p>
      <p className="mt-1 text-sm font-medium text-gray-900">{label}</p>
      <p className="mt-0.5 text-xs text-gray-400">{sub}</p>
    </Link>
  );
}

function Section({
  title,
  count,
  linkHref,
  linkLabel,
  empty,
  emptyText,
  children,
}: {
  title: string;
  count?: number;
  linkHref?: string;
  linkLabel?: string;
  empty: boolean;
  emptyText?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {count !== undefined && count > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
              {count}
            </span>
          )}
        </div>
        {linkHref && linkLabel && (
          <Link
            href={linkHref}
            className="text-xs text-blue-600 hover:underline"
          >
            {linkLabel}
          </Link>
        )}
      </div>
      {empty ? (
        <p className="px-4 py-6 text-center text-sm text-gray-400">
          {emptyText}
        </p>
      ) : (
        children
      )}
    </div>
  );
}

function PendingCompletionRow({
  completion,
  onApprove,
  onReject,
  isSaving,
}: {
  completion: Overview["recentPendingCompletions"][0];
  onApprove: () => void;
  onReject: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {completion.user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={completion.user.image}
          alt=""
          className="h-7 w-7 shrink-0 rounded-full"
        />
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100">
          <span className="text-xs font-semibold text-blue-600">
            {completion.user.name?.charAt(0) ?? "?"}
          </span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-900">
          <span className="font-medium">{completion.user.name}</span>
          {" · "}
          <span className="text-gray-500">{completion.activity.name}</span>
        </p>
        <p className="text-xs text-gray-400">
          {completion.activity.points} pts
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          onClick={onApprove}
          disabled={isSaving}
          className="rounded border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={onReject}
          disabled={isSaving}
          className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

function SayingsPanel() {
  const utils = api.useUtils();
  const { data: sayings = [], isLoading } = api.saying.listAll.useQuery();

  const review = api.saying.review.useMutation({
    onSuccess: () => void utils.saying.listAll.invalidate(),
  });
  const setVisible = api.saying.setVisible.useMutation({
    onSuccess: () => void utils.saying.listAll.invalidate(),
  });
  const update = api.saying.update.useMutation({
    onSuccess: () => {
      void utils.saying.listAll.invalidate();
      setEditingId(null);
    },
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editExplanation, setEditExplanation] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editIsSerious, setEditIsSerious] = useState(false);

  function startEdit(s: (typeof sayings)[0]) {
    setEditingId(s.id);
    setEditText(s.text);
    setEditExplanation(s.explanation ?? "");
    setEditDate(String(new Date(s.date).getFullYear()));
    setEditIsSerious(s.isSerious);
  }

  const pending = sayings.filter((s) => s.status === "PENDING");
  const rest = sayings.filter((s) => s.status !== "PENDING");

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:col-span-2">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Sayings</h2>
          {pending.length > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
              {pending.length} pending
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="px-4 py-4 text-sm text-gray-400">Loading…</p>
      ) : sayings.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-400">
          No sayings submitted yet.
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {[...pending, ...rest].map((s) => (
            <div key={s.id} className="space-y-2 px-4 py-3">
              {editingId === s.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <textarea
                    value={editExplanation}
                    onChange={(e) => setEditExplanation(e.target.value)}
                    rows={2}
                    placeholder="Explanation (optional)"
                    className="w-full resize-none rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={2015}
                      max={new Date().getFullYear()}
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setEditIsSerious((v) => !v)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${editIsSerious ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-yellow-300 bg-yellow-50 text-yellow-700"}`}
                    >
                      {editIsSerious ? "🧠 Serious" : "🎮 Fun"}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        update.mutate({
                          id: s.id,
                          text: editText.trim(),
                          explanation: editExplanation.trim() || null,
                          date: editDate
                            ? new Date(`${editDate}-06-01`)
                            : undefined,
                          isSerious: editIsSerious,
                        })
                      }
                      disabled={update.isPending || !editText.trim()}
                      className="rounded-lg bg-[#1a2744] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[#243660] disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900">
                      &ldquo;{s.text}&rdquo;
                    </p>
                    {s.explanation && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        {s.explanation}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-gray-400">
                      {new Date(s.date).getFullYear()}
                      {" · by "}
                      {s.submitter.name}
                      {s.status !== "PENDING" &&
                        ` · ${s.status === "APPROVED" ? (s.isVisible ? "visible" : "hidden") : "rejected"}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {s.status === "PENDING" && (
                      <>
                        <button
                          onClick={() =>
                            review.mutate({ id: s.id, status: "APPROVED" })
                          }
                          disabled={review.isPending}
                          className="rounded border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() =>
                            review.mutate({ id: s.id, status: "REJECTED" })
                          }
                          disabled={review.isPending}
                          className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {s.status === "APPROVED" && (
                      <button
                        onClick={() =>
                          setVisible.mutate({
                            id: s.id,
                            isVisible: !s.isVisible,
                          })
                        }
                        disabled={setVisible.isPending}
                        className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
                      >
                        {s.isVisible ? "Hide" : "Show"}
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(s)}
                      className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RosterBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-400">
          {value} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
