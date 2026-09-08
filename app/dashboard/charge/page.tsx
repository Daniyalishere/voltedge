import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { buildProfile } from "@/lib/profile";
import { STATIONS } from "@/lib/stations";
import { ArrivedCharge } from "./ArrivedCharge";

export const metadata = { title: "Charging - VoltEdge" };

export default async function ChargePage({ searchParams }: PageProps<"/dashboard/charge">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const stationId = typeof params.station === "string" ? params.station : null;

  // Without a valid station, send the driver back to pick one on the map.
  const station = stationId ? STATIONS.find((s) => s.id === stationId) : null;
  if (!station) redirect("/dashboard/map");

  return <ArrivedCharge profile={buildProfile(user)} station={station} />;
}
