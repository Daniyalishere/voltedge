import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { buildProfile } from "@/lib/profile";
import { RoutePlanner } from "./RoutePlanner";

export const metadata = { title: "Find a station - VoltEdge" };

export default async function MapPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <RoutePlanner profile={buildProfile(user)} />;
}
