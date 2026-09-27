/** Public display DTOs. Never expose access hashes or notification payloads. */
export type ConsultationFile = { id: string; name: string; sizeBytes: number; url: string };
export type ConsultationMessage = { id: string; sender: "staff" | "client"; body: string; notificationStatus: string; createdAt: string; files: ConsultationFile[] };
export type ConsultationOverview = {
  latestMessageId: string | null;
  latestSender: "staff" | "client" | null;
  latestMessageAt: string | null;
  notificationFailed: number;
  notificationPending: number;
};
