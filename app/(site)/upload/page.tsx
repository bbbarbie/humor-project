import Link from "next/link";
import { redirect } from "next/navigation";
import AccountPill from "@/app/components/AccountPill";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import UploadClient from "./UploadClient";

export default async function UploadPage() {
  const supabase = await createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    redirect("/login");
  }

  return (
    <div className="glass-page -mx-6 -my-6 px-5 py-2 md:-mx-10 md:px-8 md:py-3">
      <nav className="mb-3 flex flex-wrap items-center gap-2">
        <Link
          href="/list"
          className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 sm:text-sm"
        >
          Back to Vote
        </Link>
        <span className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/20 px-3 py-1.5 text-xs font-semibold text-white sm:text-sm">
          Upload
        </span>
      </nav>

      <div className="glass-header">
        <p className="glass-eyebrow">Assignment 5</p>
        <h1 className="mt-1 text-[clamp(1.4rem,1.3vw+1rem,2.3rem)] leading-tight">
          Upload an image to generate fresh captions.
        </h1>
        <p className="mt-2 text-sm leading-snug sm:text-[0.95rem]">
          Select an image, upload it to AlmostCrackd, and wait while the pipeline
          creates captions for it.
        </p>
      </div>

      <UploadClient />
      <AccountPill />
    </div>
  );
}
