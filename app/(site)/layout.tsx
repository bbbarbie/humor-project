import FuturisticBackground from "@/app/components/FuturisticBackground";

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative isolate">
      <FuturisticBackground />
      <main className="relative z-10 min-h-screen px-6 py-8 text-[var(--foreground)] md:px-10">
        {children}
      </main>
    </div>
  );
}
