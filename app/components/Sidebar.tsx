"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Image Atlas" },
  { href: "/list", label: "Gallery" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 h-screen w-60 flex-shrink-0 border-r border-gray-200/70 bg-white/80 px-4 py-6 backdrop-blur">
      <div className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        Navigation
      </div>
      <nav className="mt-6 flex flex-col gap-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const baseClasses =
            "rounded-md px-3 py-2 text-sm font-medium transition";
          const activeClasses = isActive
            ? "bg-gray-900 text-white"
            : "text-gray-700 hover:bg-gray-100";

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`${baseClasses} ${activeClasses}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
