import { redirect } from "next/navigation";

export default function AuditsLanding() {
  redirect("/account/monitoring/audits/dashboard");
}
