import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import AccountPill from "@/app/components/AccountPill";
import { SwipeVoteClient } from "./SwipeVoteClient";

const PAGE_SIZE = 12;

type CaptionRow = {
  id: string;
  content: string | null;
};

type VoteImageRow = {
  id: string | number;
  url: string | null;
  image_description: string | null;
  additional_context: string | null;
  captions: CaptionRow[];
};

type PageProps = {
  searchParams?: Promise<{
    page?: string;
  }>;
};

type FetchResult = {
  rows: VoteImageRow[];
  error: string | null;
};

function hasCaptionContent(value: string | null) {
  return value?.trim().length ? true : false;
}

function filterImages(rows: VoteImageRow[]) {
  return rows
    .map((row) => ({
      ...row,
      captions: row.captions.filter((caption) =>
        hasCaptionContent(caption.content)
      ),
    }))
    .filter((row) => row.captions.length > 0);
}

async function fetchImages(page: number): Promise<FetchResult> {
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const selectColumns =
    "id,url,image_description,additional_context,captions!inner(id,content)";

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch (error) {
    return {
      rows: [],
      error:
        error instanceof Error
          ? error.message
          : "Missing Supabase environment variables.",
    };
  }

  let response = await supabase
    .from("images")
    .select(selectColumns)
    .not("captions.content", "is", null)
    .neq("captions.content", "")
    .range(from, to)
    .order("created_datetime_utc", { ascending: false });

  if (response.error?.message?.includes("created_datetime_utc")) {
    response = await supabase
      .from("images")
      .select(selectColumns)
      .not("captions.content", "is", null)
      .neq("captions.content", "")
      .range(from, to)
      .order("id", { ascending: false });
  }

  if (response.error?.message?.includes("id")) {
    response = await supabase
      .from("images")
      .select(selectColumns)
      .not("captions.content", "is", null)
      .neq("captions.content", "")
      .range(from, to);
  }

  if (response.error) {
    return { rows: [], error: response.error.message };
  }

  const rows = (response.data ?? []) as VoteImageRow[];
  const filteredRows = filterImages(rows);

  return {
    rows: filteredRows,
    error: null,
  };
}

export default async function GalleryPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    redirect("/login");
  }

  const sp = await searchParams;
  const pageParam = Number(sp?.page ?? "1");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const { rows, error } = await fetchImages(page);

  return (
    <div className="glass-page vote-page -mx-6 -my-6 px-5 py-2 md:-mx-10 md:px-8 md:py-3">
      <nav className="mb-2 flex flex-wrap items-center gap-2">
        <Link
          href="/list"
          className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 sm:text-sm"
        >
          Gallery
        </Link>
      </nav>
      <div className="glass-header mb-2 max-w-3xl">
        <p className="glass-eyebrow">Caption Voting</p>
        <h1 className="mt-1 text-[clamp(1.35rem,1.2vw+1rem,2rem)] leading-tight">
          Swipe through captions and vote in a single flow.
        </h1>
        <p className="mt-1 text-sm leading-snug sm:text-[0.95rem]">
          Drag right to upvote, left to downvote. Each swipe saves your vote and
          moves you to the next caption.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50/90 p-4 text-sm text-red-900">
          {error}
        </div>
      ) : (
        <SwipeVoteClient
          initialImages={rows}
          initialPage={page}
          pageSize={PAGE_SIZE}
        />
      )}
      <AccountPill />
    </div>
  );
}
