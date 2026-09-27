export type NatoriNotificationSummary = {
  id: string;
  projectId: string;
  projectTitle: string;
  purpose: string;
  status: string;
  attemptNo: number;
  lastSentAt: string | null;
  retryAvailable: boolean;
  reviewRequired: boolean;
};

export type NatoriNotificationList = {
  enabled: boolean;
  sendingEnabled: boolean;
  notifications: NatoriNotificationSummary[];
  truncated: boolean;
  offset: number;
};
