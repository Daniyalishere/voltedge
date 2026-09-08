import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { buildProfile } from "@/lib/profile";
import { STATIONS } from "@/lib/stations";
import { DashboardView } from "./DashboardView";

export const metadata = { title: "Dashboard - VoltEdge" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  return (
    <DashboardView
      initialProfile={buildProfile(user)}
      stations={STATIONS}
      showWelcome={params.welcome === "1"}
    />
  );
}
