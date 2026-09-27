import { notFound } from "next/navigation";
import NotificationVerification from "@/features/natori/components/dashboard/NotificationVerification";
import { notificationVerificationAvailable } from "@/features/natori/server/notificationVerification";

export const dynamic = "force-dynamic";

// The existing dashboard layout supplies the same login/shared-key requirement.
export default function NotificationCheckPage() {
  if (!notificationVerificationAvailable()) notFound();
  return <NotificationVerification />;
}
