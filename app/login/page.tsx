import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginFlow } from "./LoginFlow";

export const metadata = { title: "Sign in - VoltEdge" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <LoginFlow />;
}
