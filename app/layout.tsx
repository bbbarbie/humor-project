import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image Atlas",
  description: "A playful atlas of images and their whispered stories.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
      >
        <main className="min-h-screen bg-[var(--background)] px-6 py-8 text-[var(--foreground)] md:px-10">
          {children}
        </main>
      </body>
    </html>
  );
}
