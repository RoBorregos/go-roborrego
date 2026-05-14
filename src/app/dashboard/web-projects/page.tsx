import { auth } from "~/server/auth";
import { WebProjectsClient } from "./_components/WebProjectsClient";

export default async function WebProjectsPage() {
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  return <WebProjectsClient isAdmin={isAdmin} />;
}
