import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pageParam = Number(searchParams.get("page") ?? "1");
  const pageSizeParam = Number(searchParams.get("pageSize") ?? "12");

  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const pageSize =
    Number.isFinite(pageSizeParam) && pageSizeParam > 0
      ? Math.min(30, pageSizeParam)
      : 12;

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const selectColumns =
    "id,url,image_description,additional_context,captions!inner(id,content)";

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
    return NextResponse.json(
      { error: response.error.message ?? "Unable to load captions." },
      { status: 500 }
    );
  }

  const rows = (response.data ?? []) as VoteImageRow[];
  const filteredRows = filterImages(rows);

  return NextResponse.json({ images: filteredRows });
}
