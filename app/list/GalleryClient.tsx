"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { ImageWithFallback } from "../components/ImageWithFallback";
import type { ImageRow } from "./types";

type GalleryClientProps = {
  initialRows: ImageRow[];
  initialPage: number;
  initialCount: number | null;
  pageSize: number;
};

type SelectedImage = {
  url: string | null;
  image_description: string | null;
  additional_context: string | null;
};

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function GalleryClient({
  initialRows,
  initialPage,
  initialCount,
  pageSize,
}: GalleryClientProps) {
  const [selected, setSelected] = useState<SelectedImage | null>(null);
  const [rows, setRows] = useState<ImageRow[]>(initialRows);
  const [page, setPage] = useState(initialPage);
  const [count, setCount] = useState<number | null>(initialCount);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);

  const handleClose = () => setSelected(null);

  useEffect(() => {
    if (!selected) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [selected]);

  const cards = useMemo(
    () =>
      rows.map((row, index) => {
        const description = normalizeText(row.image_description);
        const context = normalizeText(row.additional_context);
        return (
          <button
            key={`${row.url ?? "row"}-${index}`}
            type="button"
            className="gallery-card gallery-fade-in text-left"
            onClick={() => setSelected(row)}
          >
            <div className="gallery-card-media">
              <ImageWithFallback
                src={row.url}
                alt={description ?? "Gallery image"}
                className="gallery-card-image"
              />
              <div className="gallery-card-overlay" />
            </div>
            <div className="gallery-card-text">
              {description ? (
                <div className="gallery-card-title clamp-2">{description}</div>
              ) : null}
              {context ? (
                <div className="gallery-card-context clamp-3">{context}</div>
              ) : null}
            </div>
          </button>
        );
      }),
    [rows]
  );

  const modalDescription = normalizeText(selected?.image_description);
  const modalContext = normalizeText(selected?.additional_context);

  const isFirstPage = page <= 1;
  const totalPages =
    typeof count === "number" ? Math.max(1, Math.ceil(count / pageSize)) : null;
  const isLastPage =
    totalPages !== null ? page >= totalPages : rows.length < pageSize;

  useEffect(() => {
    if (!hasLoadedOnce.current) {
      hasLoadedOnce.current = true;
      return;
    }

    const fetchPage = async () => {
      setIsLoading(true);
      setError(null);
      setSelected(null);

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        setError("Missing Supabase environment variables.");
        setIsLoading(false);
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const selectColumns = "url,image_description,additional_context";

      const baseQuery = () =>
        supabase
          .from("images")
          .select(selectColumns, { count: "exact" })
          .range(from, to);

      let response = await baseQuery().order("created_datetime_utc", {
        ascending: false,
      });

      if (response.error?.message?.includes("created_datetime_utc")) {
        response = await baseQuery().order("id", { ascending: false });
      }

      if (response.error?.message?.includes("id")) {
        response = await baseQuery();
      }

      if (response.error) {
        setError(response.error.message);
        setIsLoading(false);
        return;
      }

      setRows((response.data ?? []) as ImageRow[]);
      setCount((prev) =>
        typeof response.count === "number" ? response.count : prev ?? null
      );
      setIsLoading(false);
    };

    void fetchPage();
  }, [page, pageSize]);

  const handlePageChange = (nextPage: number) => {
    const next = Math.max(1, nextPage);
    if (next === page) return;
    setPage(next);
  };

  const showingStart = rows.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const showingEnd = rows.length > 0 ? showingStart + rows.length - 1 : 0;

  return (
    <>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-white/20 bg-white/10 p-6 text-sm text-slate-200">
          No images available.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50/90 p-4 text-sm text-red-900">
          {error}
        </div>
      ) : null}
      <div className="gallery-grid">{cards}</div>
      <div className="gallery-pagination">
        <button
          type="button"
          className="gallery-button"
          onClick={() => handlePageChange(page - 1)}
          disabled={isFirstPage || isLoading}
        >
          Previous
        </button>
        <span className="gallery-page-indicator">
          Page {page}
          {totalPages ? ` of ${totalPages}` : ""}
          {typeof count === "number"
            ? ` · Showing ${showingStart}\u2013${showingEnd} of ${count}`
            : rows.length > 0
            ? ` · Showing ${showingStart}\u2013${showingEnd}`
            : ""}
        </span>
        <button
          type="button"
          className="gallery-button"
          onClick={() => handlePageChange(page + 1)}
          disabled={isLastPage || isLoading}
        >
          Next
        </button>
      </div>
      {isLoading ? (
        <div className="text-sm text-slate-200">Loading page {page}…</div>
      ) : null}
      {selected ? (
        <div className="gallery-modal-backdrop" onClick={handleClose}>
          <div
            className="gallery-modal gallery-fade-in"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="gallery-modal-media">
              <ImageWithFallback
                src={selected.url}
                alt={modalDescription ?? "Gallery image"}
                className="gallery-modal-image"
              />
            </div>
            {(modalDescription || modalContext) && (
              <div className="gallery-modal-text">
                {modalDescription ? (
                  <div className="gallery-modal-title">{modalDescription}</div>
                ) : null}
                {modalContext ? (
                  <div className="gallery-modal-context">{modalContext}</div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
