import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LoginClient from "./LoginClient";

export const metadata: Metadata = { title: "Log in – Arhan.pk" };

export default async function LoginPage() {
  if (await auth()) redirect("/dashboard");
  return <LoginClient googleEnabled={!!process.env.AUTH_GOOGLE_ID} />;
}
