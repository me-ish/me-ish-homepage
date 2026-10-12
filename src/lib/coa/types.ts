/** The only entry fields allowed in the certificate client payload. */
export type CoACertificateEntry = {
  id: number;
  title: string | null;
  artist_name: string | null;
  edition_total: number | null;
  created_at: string | null;
  confirmed_at: string | null;
};
