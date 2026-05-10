"use client";

import { useEffect, useState } from "react";

import { api } from "~/trpc/react";
import { ActivitiesTab } from "./ActivitiesTab";
import { AdminActivitiesTab } from "./AdminActivitiesTab";
import { AdminReviewTab } from "./AdminReviewTab";
import { AdminSemestersTab } from "./AdminSemestersTab";
import { LeaderboardTab } from "./LeaderboardTab";

const VALID_TABS = ["activities", "leaderboard", "manage", "review", "semesters"] as const;
type Tab = (typeof VALID_TABS)[number];

const STORAGE_TAB = "workplan_tab";
const STORAGE_SEMESTER = "workplan_semester";

export function WorkPlanClient({
  isAdmin,
  userId,
}: {
  isAdmin: boolean;
  userId: string;
}) {
  const { data: semesters } = api.workPlan.getSemesters.useQuery();
  const { data: activeSemester } = api.workPlan.getActiveSemester.useQuery();

  const [tab, setTab] = useState<Tab>(() => {
    const saved = sessionStorage.getItem(STORAGE_TAB);
    return saved && VALID_TABS.includes(saved as Tab) ? (saved as Tab) : "activities";
  });
  const [semesterId, setSemesterId] = useState<string | null>(
    () => sessionStorage.getItem(STORAGE_SEMESTER),
  );

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    sessionStorage.setItem(STORAGE_TAB, newTab);
  };

  const handleSemesterChange = (newSemester: string) => {
    setSemesterId(newSemester);
    sessionStorage.setItem(STORAGE_SEMESTER, newSemester);
  };

  // Default to active semester if none saved
  useEffect(() => {
    if (activeSemester && semesterId === null) {
      setSemesterId(activeSemester.id);
      sessionStorage.setItem(STORAGE_SEMESTER, activeSemester.id);
    }
  }, [activeSemester, semesterId]);

  const currentSemester = semesters?.find((s) => s.id === semesterId);

  const memberTabs: { key: Tab; label: string }[] = [
    { key: "activities", label: "Activities" },
    { key: "leaderboard", label: "Leaderboard" },
  ];
  const adminTabs: { key: Tab; label: string }[] = [
    { key: "manage", label: "Manage Activities" },
    { key: "review", label: "Review Submissions" },
    { key: "semesters", label: "Semesters" },
  ];

  return (
    <div>
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Work Plan</h1>

        {/* Semester selector */}
        {semesters && semesters.length > 0 ? (
          <select
            value={semesterId ?? ""}
            onChange={(e) => handleSemesterChange(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isActive ? " (active)" : ""}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-gray-400">No semesters yet</span>
        )}
      </div>

      {/* Stats summary — only shown when a semester is selected and on member tabs */}
      {semesterId && (tab === "activities" || tab === "leaderboard") && (
        <SummaryBar semesterId={semesterId} />
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-x-6 border-b border-gray-200 mb-6">
        {memberTabs.map((t) => (
          <TabBtn key={t.key} active={tab === t.key} onClick={() => handleTabChange(t.key)}>
            {t.label}
          </TabBtn>
        ))}
        {isAdmin && (
          <>
            <span className="border-l border-gray-200 mx-1" />
            {adminTabs.map((t) => (
              <TabBtn key={t.key} active={tab === t.key} onClick={() => handleTabChange(t.key)}>
                {t.label}
              </TabBtn>
            ))}
          </>
        )}
      </div>

      {/* Tab content */}
      {!semesterId && tab !== "semesters" ? (
        <p className="text-sm text-gray-400">
          {isAdmin
            ? 'No semester selected. Create one in the "Semesters" tab.'
            : "No active semester configured yet."}
        </p>
      ) : (
        <>
          {tab === "activities" && semesterId && (
            <ActivitiesTab semesterId={semesterId} userId={userId} />
          )}
          {tab === "leaderboard" && semesterId && (
            <LeaderboardTab semesterId={semesterId} />
          )}
          {isAdmin && tab === "manage" && semesterId && (
            <AdminActivitiesTab semesterId={semesterId} semesterName={currentSemester?.name ?? ""} />
          )}
          {isAdmin && tab === "review" && (
            <AdminReviewTab semesterId={semesterId} />
          )}
          {isAdmin && tab === "semesters" && <AdminSemestersTab />}
        </>
      )}
    </div>
  );
}

function SummaryBar({ semesterId }: { semesterId: string }) {
  const { data: summary } = api.workPlan.getMySummary.useQuery({ semesterId });
  if (!summary) return null;

  return (
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
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
    </div>
  );
}

export function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-blue-600 text-blue-700"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

export function CompletionBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200",
    APPROVED: "bg-green-50 text-green-700 border-green-200",
    REJECTED: "bg-red-50 text-red-700 border-red-200",
  };
  const labels: Record<string, string> = {
    PENDING: "Pending review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded border ${styles[status] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
