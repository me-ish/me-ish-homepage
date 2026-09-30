export type DeliveryFileState = "pending" | "ready" | "failed" | "legacy_unverified" | "deleting";
export type DeliveryManifestFile = {
  id: string;
  path: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  storageVersion: string;
};
export type DeliveryDownloadFile = {
  id: string;
  fileName: string;
  sizeBytes: number;
  url: string | null;
  available: boolean;
};
