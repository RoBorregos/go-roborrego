import { notFound } from "next/navigation";
import Link from "next/link";

import { auth } from "~/server/auth";
import { api } from "~/trpc/server";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const member = await api.member.getById({ id }).catch(() => null);
  if (!member) notFound();

  const isOwnProfile = session?.user.id === id;
  const isAdmin = session?.user.role === "ADMIN";

  return (
    <div className="max-w-2xl">
      <Link
        href="/dashboard/members"
        className="text-sm text-blue-600 hover:underline mb-6 inline-block"
      >
        ← Back to Members
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-[#1a2744] px-6 py-8 flex items-center gap-4">
          {member.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.image}
              alt={member.name ?? ""}
              className="w-16 h-16 rounded-full border-2 border-white/30 object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-400 flex items-center justify-center">
              <span className="text-white text-2xl font-bold">
                {member.name?.charAt(0) ?? "?"}
              </span>
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-white">{member.name}</h1>
            <p className="text-blue-200 text-sm">{member.email}</p>
            <div className="flex gap-2 mt-2">
              {member.subTeam && (
                <span className="text-xs bg-white/20 text-white rounded px-2 py-0.5">
                  {member.subTeam}
                </span>
              )}
              <span className="text-xs bg-white/20 text-white rounded px-2 py-0.5">
                {member.role}
              </span>
              <span
                className={`text-xs rounded px-2 py-0.5 ${
                  member.status === "ACTIVE"
                    ? "bg-green-400/20 text-green-200"
                    : member.status === "ALUMNI"
                      ? "bg-purple-400/20 text-purple-200"
                      : "bg-gray-400/20 text-gray-300"
                }`}
              >
                {member.status}
              </span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="p-6 space-y-4">
          {member.bio && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Bio
              </h2>
              <p className="text-gray-700 text-sm">{member.bio}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <InfoField
              label="Join Date"
              value={member.joinDate.toLocaleDateString()}
            />
            {member.graduationDate && (
              <InfoField
                label="Graduation"
                value={member.graduationDate.toLocaleDateString()}
              />
            )}
            {member.birthday && (
              <InfoField
                label="Birthday"
                value={member.birthday.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
              />
            )}
            {(isOwnProfile || isAdmin) && member.phone && (
              <InfoField label="Phone" value={member.phone} />
            )}
          </div>

          <div className="flex gap-4">
            {member.githubUsername && (
              <a
                href={`https://github.com/${member.githubUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                GitHub: @{member.githubUsername}
              </a>
            )}
            {member.linkedinUrl && (
              <a
                href={member.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                LinkedIn
              </a>
            )}
          </div>

          <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-3">
            <Link
              href={`/dashboard/workplan/${id}`}
              className="inline-block text-sm border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              View Work Plan
            </Link>
            {(isOwnProfile || isAdmin) && (
              <Link
                href={
                  isOwnProfile
                    ? "/dashboard/profile/edit"
                    : `/dashboard/admin/members/${id}/edit`
                }
                className="inline-block text-sm bg-[#1a2744] text-white px-4 py-2 rounded-lg hover:bg-[#243660] transition-colors"
              >
                Edit Profile
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className="text-gray-800 text-sm">{value}</p>
    </div>
  );
}
