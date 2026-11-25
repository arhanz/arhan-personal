import "./grabber.css";
import { requireUser } from "@/lib/session";
import { providerStatus } from "@/lib/ytgrabber";
import Grabber from "./Grabber";

export const dynamic = "force-dynamic";

export default async function YtGrabberPage() {
  // Logged-in users only: every search and download uses the server's CPU and bandwidth.
  const u = await requireUser();
  const st = await providerStatus();
  return <Grabber who={u.name || u.email || ""} searchReady={st.searchReady} downloadReady={st.downloadReady} note={st.note} />;
}
