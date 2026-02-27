"use client";

import { useMemo, useState } from "react";
import { triggerVoteReaction } from "@/app/components/VoteReactions";

type CaptionRow = {
  id: string | number;
  content: string | null;
};

type CaptionVotingClientProps = {
  captions: CaptionRow[];
  initialVotes: Record<string, number>;
};

type PendingState = Record<string, boolean>;

type ErrorState = Record<string, string | null>;
type SubmittedState = Record<string, boolean>;

const VOTE_LABELS: Record<number, string> = {
  1: "Upvote",
  [-1]: "Downvote",
};

export function CaptionVotingClient({
  captions,
  initialVotes,
}: CaptionVotingClientProps) {
  const [votes, setVotes] = useState<Record<string, number>>(initialVotes);
  const [pending, setPending] = useState<PendingState>({});
  const [errors, setErrors] = useState<ErrorState>({});
  const [submitted, setSubmitted] = useState<SubmittedState>({});

  const captionList = useMemo(() => {
    return captions
      .filter((caption) => {
        if (!caption.content) return false;
        return caption.content.trim().length > 0;
      })
      .map((caption) => ({
        ...caption,
        key: String(caption.id),
      }));
  }, [captions]);

  const handleVote = async (captionId: string, vote: 1 | -1) => {
    if (pending[captionId]) return;

    const previousVote = votes[captionId];

    setVotes((prev) => ({ ...prev, [captionId]: vote }));
    setPending((prev) => ({ ...prev, [captionId]: true }));
    setErrors((prev) => ({ ...prev, [captionId]: null }));
    setSubmitted((prev) => ({ ...prev, [captionId]: false }));

    try {
      let response: Response;
      try {
        response = await fetch("/api/caption-vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ captionId, voteValue: vote }),
        });
        if (!response.ok) throw new Error(await response.text());
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          "name" in err &&
          err.name === "AbortError"
        ) {
          console.warn("[vote] aborted - ignore");
          return;
        }
        throw err;
      }

      const payload = (await response.json().catch(() => null)) as
        | { voteValue?: number }
        | null;

      const resolvedVote = payload?.voteValue;
      if (resolvedVote === 1 || resolvedVote === -1) {
        setVotes((prev) => ({ ...prev, [captionId]: resolvedVote }));
      }
      setSubmitted((prev) => ({ ...prev, [captionId]: true }));
    } catch (error) {
      setVotes((prev) => ({ ...prev, [captionId]: previousVote }));
      setErrors((prev) => ({
        ...prev,
        [captionId]:
          error instanceof Error ? error.message : "Unable to save vote.",
      }));
    } finally {
      setPending((prev) => ({ ...prev, [captionId]: false }));
    }
  };

  if (captionList.length === 0) {
    return null;
  }

  return (
    <div className="caption-list">
      {captionList.map((caption) => {
        const currentVote = votes[caption.key];
        const isUpvoted = currentVote === 1;
        const isDownvoted = currentVote === -1;
        const isSaving = pending[caption.key];
        const hasVote = typeof currentVote === "number";
        const isSubmitted = submitted[caption.key];

        return (
          <div
            key={caption.key}
            className="caption-bubble"
          >
            <p className="text-sm text-white/85 clamp-3">{caption.content}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  isUpvoted
                    ? "border-emerald-300/70 bg-emerald-400/20 text-emerald-100"
                    : "border-white/20 bg-white/5 text-white/70 hover:border-white/40"
                }`}
                onClick={(event) => {
                  triggerVoteReaction("up", event.currentTarget.getBoundingClientRect());
                  void handleVote(caption.key, 1);
                }}
                disabled={isSaving}
                aria-pressed={isUpvoted}
              >
                👍 {VOTE_LABELS[1]}
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  isDownvoted
                    ? "border-rose-300/70 bg-rose-400/20 text-rose-100"
                    : "border-white/20 bg-white/5 text-white/70 hover:border-white/40"
                }`}
                onClick={(event) => {
                  triggerVoteReaction("down", event.currentTarget.getBoundingClientRect());
                  void handleVote(caption.key, -1);
                }}
                disabled={isSaving}
                aria-pressed={isDownvoted}
              >
                👎 {VOTE_LABELS[-1]}
              </button>
              {isSubmitted && hasVote ? (
                <span className="text-xs font-semibold text-emerald-200">
                  Submitted ✅
                </span>
              ) : null}
              {errors[caption.key] ? (
                <span className="text-xs text-rose-200">
                  {errors[caption.key]}
                </span>
              ) : null}
              {isSaving ? (
                <span className="text-xs text-white/60">Submitting…</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
