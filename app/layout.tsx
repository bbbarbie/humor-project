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
      <body className="antialiased">{children}</body>
    </html>
  );
}
