"use client";

import { useEffect, useState } from "react";
import { CaptionVotingClient } from "@/app/components/CaptionVotingClient";

type CaptionRow = {
  id: string;
  content: string | null;
  userVote: number | null;
};

type CaptionPayload = {
  captions: CaptionRow[];
};

type InlineCaptionVotingProps = {
  imageId: string | number;
};

const captionCache = new Map<string, CaptionPayload>();

export function InlineCaptionVoting({ imageId }: InlineCaptionVotingProps) {
  const [captions, setCaptions] = useState<CaptionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imageKey = String(imageId);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const cached = captionCache.get(imageKey);

    if (cached) {
      setCaptions(cached.captions ?? []);
      setError(null);
      return () => {
        isMounted = false;
        controller.abort();
      };
    }

    const loadCaptions = async () => {
      setCaptions(null);
      setError(null);

      try {
        const response = await fetch(
          `/api/image-captions?imageId=${encodeURIComponent(imageKey)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message =
            payload?.error ||
            payload?.message ||
            "Unable to load captions.";
          throw new Error(message);
        }

        const payload = (await response.json()) as CaptionPayload;

        if (!isMounted) return;

        const nextPayload = { captions: payload.captions ?? [] };
        captionCache.set(imageKey, nextPayload);
        setCaptions(nextPayload.captions);
      } catch (err) {
        if (controller.signal.aborted || !isMounted) return;
        setError(
          err instanceof Error ? err.message : "Unable to load captions."
        );
        setCaptions([]);
      }
    };

    void loadCaptions();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [imageKey]);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200/40 bg-rose-500/10 p-3 text-xs text-rose-100">
        {error}
      </div>
    );
  }

  if (!captions) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
        Loading captions…
      </div>
    );
  }

  const initialVotes = captions.reduce<Record<string, number>>((acc, caption) => {
    if (caption.userVote === 1 || caption.userVote === -1) {
      acc[caption.id] = caption.userVote;
    }
    return acc;
  }, {});

  return <CaptionVotingClient captions={captions} initialVotes={initialVotes} />;
}
