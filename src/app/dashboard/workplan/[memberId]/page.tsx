import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { MemberProgressClient } from "./MemberProgressClient";

export default async function MemberProgressPage({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const { memberId } = await params;
  const { from } = await searchParams;

  return (
    <MemberProgressClient
      memberId={memberId}
      isAdmin={session.user.role === "ADMIN"}
      backHref={from === "roster" ? "/dashboard/admin/members" : "/dashboard/workplan"}
    />
  );
}
