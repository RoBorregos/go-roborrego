import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { WorkPlanClient } from "./_components/WorkPlanClient";

export default async function WorkPlanPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";
  const userId = session?.user.id ?? "";

  const isReviewer = userId
    ? (await db.workPlanActivityReviewer.count({ where: { userId } })) > 0
    : false;

  return <WorkPlanClient isAdmin={isAdmin} isReviewer={isReviewer} userId={userId} />;
}
