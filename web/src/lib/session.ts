import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireUser() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  return s.user;
}
export async function requireClient() {
  const u = await requireUser();
  if (u.role === "ADMIN") redirect("/admin");
  return u;
}
export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "ADMIN") redirect("/dashboard");
  return u;
}
