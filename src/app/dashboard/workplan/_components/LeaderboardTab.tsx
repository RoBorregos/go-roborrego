"use client";

import Link from "next/link";
import { api } from "~/trpc/react";

export function LeaderboardTab({ semesterId }: { semesterId: string }) {
  const { data: leaderboard, isLoading } = api.workPlan.getLeaderboard.useQuery({
    semesterId,
  });

  if (isLoading) return <p className="text-sm text-gray-400">Loading leaderboard…</p>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-semibold text-gray-700 w-16">Rank</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-700">Member</th>
            <th className="text-right px-4 py-3 font-semibold text-gray-700">Points</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {leaderboard?.map((entry) => (
            <tr key={entry.user.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-bold text-gray-500 text-base">
                {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/dashboard/workplan/${entry.user.id}`}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  {entry.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.user.image}
                      alt={entry.user.name ?? ""}
                      className="w-7 h-7 rounded-full"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 text-xs font-semibold">
                        {entry.user.name?.charAt(0) ?? "?"}
                      </span>
                    </div>
                  )}
                  <span className="text-gray-900 hover:text-blue-600">{entry.user.name}</span>
                </Link>
              </td>
              <td className="px-4 py-3 text-right font-bold text-blue-700">
                {entry.points}
              </td>
            </tr>
          ))}
          {leaderboard?.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-10 text-center text-gray-400 text-sm">
                No points earned yet this semester.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
