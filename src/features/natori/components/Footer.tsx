// components/natori/Footer.tsx
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t"
            style={{ background: "linear-gradient(90deg, #FFF5F9 0%, #FFEAF2 100%)", borderColor: "#F5D0DC" }}>
      <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-gray-600">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} Natori / me-ish. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
