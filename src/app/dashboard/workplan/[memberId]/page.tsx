import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { MemberProgressClient } from "./MemberProgressClient";

export default async function MemberProgressPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const { memberId } = await params;

  return (
    <MemberProgressClient
      memberId={memberId}
      isAdmin={session.user.role === "ADMIN"}
    />
  );
}
