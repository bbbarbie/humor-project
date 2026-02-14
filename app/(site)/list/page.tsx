import { createClient } from "@supabase/supabase-js";
import { GalleryClient } from "./GalleryClient";
import type { ImageRow } from "./types";
import Link from "next/link";
import AccountPill from "@/app/components/AccountPill";

const PAGE_SIZE = 24;

type PageProps = {
  searchParams?: {
    page?: string;
  };
};

type FetchResult = {
  rows: ImageRow[];
  count: number | null;
  error: string | null;
};

async function fetchImages(page: number): Promise<FetchResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      rows: [],
      count: null,
      error: "Missing Supabase environment variables.",
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const selectColumns = "url,image_description,additional_context";

  let response = await supabase
    .from("images")
    .select(selectColumns, { count: "exact" })
    .range(from, to)
    .order("created_datetime_utc", { ascending: false });

  if (response.error?.message?.includes("created_datetime_utc")) {
    response = await supabase
      .from("images")
      .select(selectColumns, { count: "exact" })
      .range(from, to)
      .order("id", { ascending: false });
  }

  if (response.error?.message?.includes("id")) {
    response = await supabase
      .from("images")
      .select(selectColumns, { count: "exact" })
      .range(from, to);
  }

  if (response.error) {
    return { rows: [], count: null, error: response.error.message };
  }

  const rows = (response.data ?? []) as ImageRow[];

  return {
    rows,
    count: typeof response.count === "number" ? response.count : null,
    error: null,
  };
}

export default async function GalleryPage({ searchParams }: PageProps) {
  const pageParam = Number(searchParams?.page ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const { rows, count, error } = await fetchImages(page);

  return (
    <div className="glass-page -mx-6 -my-8 px-6 py-8 md:-mx-10 md:px-10">
      <nav className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/list"
          className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
        >
          Gallery
        </Link>
      </nav>
      <div className="glass-header">
        <p className="glass-eyebrow">Image Atlas</p>
        <h1>A playful atlas of images and their whispered stories.</h1>
        <p>
          Explore the gallery, tap an image to linger, and read the notes behind
          each moment.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50/90 p-4 text-sm text-red-900">
          {error}
        </div>
      ) : (
        <GalleryClient
          initialRows={rows}
          initialPage={page}
          initialCount={count}
          pageSize={PAGE_SIZE}
        />
      )}
      <AccountPill />
    </div>
  );
}
