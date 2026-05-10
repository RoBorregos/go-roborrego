"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { api } from "~/trpc/react";
import { CompletionBadge } from "../_components/WorkPlanClient";

export function MemberProgressClient({
  memberId,
  isAdmin,
  backHref,
}: {
  memberId: string;
  isAdmin: boolean;
  backHref: string;
}) {
  const utils = api.useUtils();
  const { data: member } = api.member.getById.useQuery({ id: memberId });
  const { data: semesters } = api.workPlan.getSemesters.useQuery();
  const { data: activeSemester } = api.workPlan.getActiveSemester.useQuery();

  const storageKey = `workplan_member_semester_${memberId}`;

  const [semesterId, setSemesterId] = useState<string | null>(
    () => sessionStorage.getItem(storageKey),
  );
  const [search, setSearch] = useState("");
  const [filterInterested, setFilterInterested] = useState(false);
  const [filterDone, setFilterDone] = useState(false);

  const handleSemesterChange = (id: string) => {
    setSemesterId(id);
    sessionStorage.setItem(storageKey, id);
  };

  useEffect(() => {
    if (activeSemester && semesterId === null) {
      setSemesterId(activeSemester.id);
      sessionStorage.setItem(storageKey, activeSemester.id);
    }
  }, [activeSemester, semesterId, storageKey]);

  const { data: summary } = api.workPlan.getMemberSummary.useQuery(
    { semesterId: semesterId!, userId: memberId },
    { enabled: !!semesterId },
  );

  const { data: activities, isLoading: activitiesLoading } =
    api.workPlan.getMemberActivities.useQuery(
      { semesterId: semesterId!, userId: memberId },
      { enabled: !!semesterId },
    );

  const toggleInterest = api.workPlan.adminToggleInterest.useMutation({
    onSuccess: () => {
      void utils.workPlan.getMemberActivities.invalidate();
      void utils.workPlan.getMemberSummary.invalidate();
    },
  });

  const toggleCompletion = api.workPlan.adminToggleCompletion.useMutation({
    onSuccess: () => {
      void utils.workPlan.getMemberActivities.invalidate();
      void utils.workPlan.getMemberSummary.invalidate();
    },
  });

  const filtered = (activities ?? []).filter((a) => {
    const q = search.trim().toLowerCase();
    if (q && !a.name.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) {
      return false;
    }
    if (filterInterested || filterDone) {
      const matchesInterest = filterInterested && a.isInterested;
      const matchesDone = filterDone && a.completion?.status === "APPROVED";
      if (!matchesInterest && !matchesDone) return false;
    }
    return true;
  });

  const mandatory = filtered.filter((a) => a.isMandatory);
  const optional = filtered.filter((a) => !a.isMandatory);

  return (
    <div className="max-w-3xl">
      {/* Back + header */}
      <div className="mb-6">
        <Link
          href={backHref}
          className="text-xs text-gray-400 hover:text-gray-600 mb-2 inline-block"
        >
          ← {backHref.includes("members") ? "Roster" : "Work Plan"}
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {member?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.image} alt="" className="w-10 h-10 rounded-full" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-bold">
                  {member?.name?.charAt(0) ?? "?"}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">{member?.name ?? "…"}</h1>
              <p className="text-sm text-gray-400">{member?.email}</p>
            </div>
          </div>

          {/* Semester selector */}
          {semesters && semesters.length > 0 && (
            <select
              value={semesterId ?? ""}
              onChange={(e) => handleSemesterChange(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.isActive ? " (active)" : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Points Earned" value={summary.approvedPoints} />
          <StatCard
            label="Tentative Points"
            value={summary.tentativePoints}
            note="from interests"
          />
          <StatCard label="Interested In" value={summary.interestedCount} />
          <StatCard
            label="Mandatory"
            value={`${summary.mandatoryCompleted} / ${summary.mandatoryTotal}`}
            highlight={summary.mandatoryCompleted < summary.mandatoryTotal}
          />
        </div>
      )}

      {/* Search + filters */}
      {activities && activities.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input
            type="search"
            placeholder="Search activities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[180px] rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setFilterInterested((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              filterInterested
                ? "bg-blue-50 text-blue-700 border-blue-300"
                : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
            }`}
          >
            ★ Interested
          </button>
          <button
            onClick={() => setFilterDone((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              filterDone
                ? "bg-green-50 text-green-700 border-green-300"
                : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
            }`}
          >
            ✓ Done
          </button>
        </div>
      )}

      {/* Activities */}
      {!semesterId ? (
        <p className="text-sm text-gray-400">No active semester.</p>
      ) : activitiesLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : !activities?.length ? (
        <p className="text-sm text-gray-400">No activities for this semester.</p>
      ) : !filtered.length ? (
        <p className="text-sm text-gray-400">No activities match the current filters.</p>
      ) : (
        <div className="space-y-6">
          {mandatory.length > 0 && (
            <ActivitySection
              title="Mandatory"
              activities={mandatory}
              isAdmin={isAdmin}
              memberId={memberId}
              onToggleInterest={(activityId) =>
                toggleInterest.mutate({ userId: memberId, activityId })
              }
              onToggleCompletion={(activityId) =>
                toggleCompletion.mutate({ userId: memberId, activityId })
              }
            />
          )}
          {optional.length > 0 && (
            <ActivitySection
              title={mandatory.length > 0 ? "Optional" : "All Activities"}
              activities={optional}
              isAdmin={isAdmin}
              memberId={memberId}
              onToggleInterest={(activityId) =>
                toggleInterest.mutate({ userId: memberId, activityId })
              }
              onToggleCompletion={(activityId) =>
                toggleCompletion.mutate({ userId: memberId, activityId })
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

type Activity = {
  id: string;
  name: string;
  description: string;
  points: number;
  isMandatory: boolean;
  estimatedDate: Date | null;
  adminMessage: string | null;
  isInterested: boolean;
  completion: {
    status: string;
    note: string;
    adminNote: string | null;
  } | null;
};

function ActivitySection({
  title,
  activities,
  isAdmin,
  memberId: _memberId,
  onToggleInterest,
  onToggleCompletion,
}: {
  title: string;
  activities: Activity[];
  isAdmin: boolean;
  memberId: string;
  onToggleInterest: (activityId: string) => void;
  onToggleCompletion: (activityId: string) => void;
}) {
  return (
    <div>
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
        {title}
      </h2>
      <div className="space-y-3">
        {activities.map((a) => (
          <ActivityRow
            key={a.id}
            activity={a}
            isAdmin={isAdmin}
            onToggleInterest={() => onToggleInterest(a.id)}
            onToggleCompletion={() => onToggleCompletion(a.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ActivityRow({
  activity,
  isAdmin,
  onToggleInterest,
  onToggleCompletion,
}: {
  activity: Activity;
  isAdmin: boolean;
  onToggleInterest: () => void;
  onToggleCompletion: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isApproved = activity.completion?.status === "APPROVED";

  return (
    <div
      className={`bg-white rounded-xl border p-4 shadow-sm ${
        activity.isMandatory ? "border-amber-200" : "border-gray-200"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Status indicator */}
        <div className="mt-0.5 shrink-0">
          {activity.completion?.status === "APPROVED" ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs font-bold">✓</span>
          ) : activity.completion?.status === "PENDING" ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 text-xs">…</span>
          ) : activity.completion?.status === "REJECTED" ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs font-bold">✕</span>
          ) : activity.isInterested ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 text-blue-500 text-xs">★</span>
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-gray-300 text-xs">○</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <h3 className="font-semibold text-gray-900 text-sm">{activity.name}</h3>
            <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
              {activity.points} pts
            </span>
            {activity.completion && (
              <CompletionBadge status={activity.completion.status} />
            )}
            {!activity.completion && activity.isInterested && (
              <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded">
                Interested
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{activity.description}</p>
          {activity.estimatedDate && (
            <p className="text-xs text-gray-400 mt-0.5">
              Est. {new Date(activity.estimatedDate).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Right-side actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <>
              <button
                onClick={onToggleInterest}
                title={activity.isInterested ? "Remove interest" : "Mark as interested"}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  activity.isInterested
                    ? "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                    : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                }`}
              >
                {activity.isInterested ? "★ Interested" : "☆ Interest"}
              </button>
              <button
                onClick={onToggleCompletion}
                title={isApproved ? "Remove completion" : "Mark as completed"}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  isApproved
                    ? "bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
                    : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                }`}
              >
                {isApproved ? "✓ Done" : "○ Mark done"}
              </button>
            </>
          )}
          {activity.completion && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {expanded ? "Hide" : "Details"}
            </button>
          )}
        </div>
      </div>

      {/* Expanded submission detail */}
      {expanded && activity.completion && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Submission note</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{activity.completion.note}</p>
          </div>
          {activity.completion.adminNote && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Admin feedback</p>
              <p className="text-sm text-gray-700">{activity.completion.adminNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  note,
  highlight,
}: {
  label: string;
  value: string | number;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${highlight ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`}>
      <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? "text-amber-700" : "text-gray-900"}`}>
        {value}
      </p>
      {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
    </div>
  );
}
