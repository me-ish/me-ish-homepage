// Legacy publication routes no longer mount the gallery's client providers.
export default function LegacyGalleryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
