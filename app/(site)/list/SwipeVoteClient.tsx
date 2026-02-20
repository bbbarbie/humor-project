"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useAnimation,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { ImageWithFallback } from "@/app/components/ImageWithFallback";

type CaptionRow = {
  id: string;
  content: string | null;
};

type VoteImage = {
  id: string | number;
  url: string | null;
  image_description: string | null;
  additional_context: string | null;
  captions: CaptionRow[];
};

type SwipeVoteClientProps = {
  initialImages: VoteImage[];
  initialPage: number;
  pageSize: number;
};

type VoteQueueItem = {
  imageId: string | number;
  imageUrl: string | null;
  imageDescription: string | null;
  additionalContext: string | null;
  caption: CaptionRow;
};

const SWIPE_THRESHOLD = 120;
const TOAST_DURATION_MS = 1200;

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function sanitizeImages(images: VoteImage[]) {
  return images
    .map((image) => ({
      ...image,
      captions: image.captions.filter(
        (caption) => normalizeText(caption.content) !== null
      ),
    }))
    .filter((image) => image.captions.length > 0);
}

function shuffleArray<T>(items: T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

function imageKey(imageId: string | number) {
  return String(imageId);
}

function isSameImageId(
  left: string | number | null | undefined,
  right: string | number | null | undefined
) {
  if (left == null || right == null) return false;
  return imageKey(left) === imageKey(right);
}

function avoidAdjacentSameImage(
  queue: VoteQueueItem[],
  previousImageId: string | number | null | undefined
) {
  if (queue.length < 2) return queue;

  const adjusted = [...queue];
  let lastImageId = previousImageId ?? null;

  for (let index = 0; index < adjusted.length; index += 1) {
    if (!isSameImageId(adjusted[index]?.imageId, lastImageId)) {
      lastImageId = adjusted[index]?.imageId ?? null;
      continue;
    }

    const swapIndex = adjusted.findIndex(
      (item, candidateIndex) =>
        candidateIndex > index && !isSameImageId(item.imageId, lastImageId)
    );
    if (swapIndex <= index) {
      lastImageId = adjusted[index]?.imageId ?? null;
      continue;
    }

    [adjusted[index], adjusted[swapIndex]] = [
      adjusted[swapIndex],
      adjusted[index],
    ];
    lastImageId = adjusted[index]?.imageId ?? null;
  }

  return adjusted;
}

function buildShuffledQueue(images: VoteImage[]) {
  const groupedQueue = images.map((image) => ({
    imageId: image.id,
    items: shuffleArray(
      image.captions.map<VoteQueueItem>((caption) => ({
        imageId: image.id,
        imageUrl: image.url,
        imageDescription: image.image_description,
        additionalContext: image.additional_context,
        caption,
      }))
    ),
  }));

  const queue: VoteQueueItem[] = [];
  let previousImageId: string | number | null = null;

  while (groupedQueue.some((group) => group.items.length > 0)) {
    const nonRepeatingGroups = groupedQueue.filter(
      (group) =>
        group.items.length > 0 &&
        !isSameImageId(group.imageId, previousImageId)
    );
    const availableGroups =
      nonRepeatingGroups.length > 0
        ? nonRepeatingGroups
        : groupedQueue.filter((group) => group.items.length > 0);

    const nextGroup =
      availableGroups[Math.floor(Math.random() * availableGroups.length)];
    const nextItem = nextGroup.items.pop();
    if (!nextItem) continue;

    queue.push(nextItem);
    previousImageId = nextItem.imageId;
  }

  return avoidAdjacentSameImage(queue, null);
}

export function SwipeVoteClient({
  initialImages,
  initialPage,
  pageSize,
}: SwipeVoteClientProps) {
  const initialSanitizedImages = useMemo(
    () => sanitizeImages(initialImages),
    [initialImages]
  );
  const initialQueue = useMemo(
    () => buildShuffledQueue(initialSanitizedImages),
    [initialSanitizedImages]
  );
  const [queue, setQueue] = useState<VoteQueueItem[]>(initialQueue);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(
    initialSanitizedImages.length >= pageSize
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const controls = useAnimation();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-10, 0, 10]);
  const rightHintOpacity = useTransform(x, [40, 120], [0, 1]);
  const leftHintOpacity = useTransform(x, [-120, -40], [1, 0]);

  const toastTimer = useRef<number | null>(null);

  const currentItem = queue[currentIndex];
  const currentCaption = currentItem?.caption;
  const captionText = currentCaption?.content ?? "";

  useEffect(() => {
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
    }
    if (toast) {
      toastTimer.current = window.setTimeout(() => {
        setToast(null);
      }, TOAST_DURATION_MS);
    }
    return () => {
      if (toastTimer.current) {
        window.clearTimeout(toastTimer.current);
      }
    };
  }, [toast]);

  useEffect(() => {
    controls.set({ x: 0, rotate: 0, opacity: 1 });
    x.set(0);
  }, [controls, x, currentCaption?.id]);

  const fetchMore = useCallback(async (previousImageId?: string | number) => {
    if (isLoadingMore || !hasMore) return null;
    setIsLoadingMore(true);
    setError(null);

    const nextPage = page + 1;
    try {
      const response = await fetch(
        `/api/vote-feed?page=${nextPage}&pageSize=${pageSize}`
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload?.error ||
          payload?.message ||
          "Unable to load more captions.";
        throw new Error(message);
      }
      const payload = (await response.json()) as { images?: VoteImage[] };
      const nextImages = sanitizeImages(payload.images ?? []);
      const nextQueue = buildShuffledQueue(nextImages);
      const adjustedQueue = avoidAdjacentSameImage(nextQueue, previousImageId);
      setQueue((prev) => [...prev, ...adjustedQueue]);
      setPage(nextPage);
      setHasMore(nextImages.length >= pageSize);
      setIsLoadingMore(false);
      return adjustedQueue;
    } catch (err) {
      setIsLoadingMore(false);
      setHasMore(false);
      setError(
        err instanceof Error ? err.message : "Unable to load more captions."
      );
      return null;
    }
  }, [hasMore, isLoadingMore, page, pageSize]);

  const advance = useCallback(async () => {
    if (!currentItem) return;

    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    if (hasMore) {
      const nextQueue = await fetchMore(currentItem.imageId);
      if (nextQueue && nextQueue.length > 0) {
        setCurrentIndex((prev) => prev + 1);
        return;
      }
    }

    setIsComplete(true);
    setCurrentIndex(queue.length);
  }, [currentIndex, currentItem, fetchMore, hasMore, queue.length]);

  useEffect(() => {
    if (!currentItem) return;
    if (!currentCaption) {
      void advance();
    }
  }, [advance, currentCaption, currentItem]);

  const handleVote = useCallback(
    async (voteValue: 1 | -1) => {
      if (!currentCaption || isSaving) return;
      setIsSaving(true);
      setError(null);

      const direction = voteValue === 1 ? 1 : -1;
      await controls.start({
        x: direction * 280,
        rotate: direction * 8,
        opacity: 0,
        transition: { duration: 0.16 },
      });

      try {
        const response = await fetch("/api/caption-vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            captionId: currentCaption.id,
            voteValue,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message =
            payload?.error ||
            payload?.message ||
            "Unable to save vote.";
          throw new Error(message);
        }

        setToast("Saved ✓");
        await new Promise((resolve) => setTimeout(resolve, 260));
        await advance();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to save vote.");
      } finally {
        setIsSaving(false);
        controls.set({ x: 0, rotate: 0, opacity: 1 });
        x.set(0);
      }
    },
    [advance, controls, currentCaption, isSaving, x]
  );

  const handleDragEnd = useCallback(
    async (_: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number } }) => {
      if (isSaving) return;
      if (info.offset.x > SWIPE_THRESHOLD) {
        await handleVote(1);
      } else if (info.offset.x < -SWIPE_THRESHOLD) {
        await handleVote(-1);
      } else {
        controls.start({ x: 0, rotate: 0, transition: { duration: 0.2 } });
      }
    },
    [controls, handleVote, isSaving]
  );

  const captionCount = queue.length;
  const captionPosition = captionCount > 0 ? currentIndex + 1 : 0;

  const cardKey = useMemo(
    () => `${currentItem?.imageId ?? "none"}-${currentCaption?.id ?? "empty"}`,
    [currentItem?.imageId, currentCaption?.id]
  );

  if (!currentItem || !currentCaption) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
        <p>
          {isComplete
            ? "You are all caught up. Check back soon for more captions."
            : "No captions available to vote on yet."}
        </p>
        {error ? <p className="vote-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="vote-shell !items-start !pt-0 !pb-2 md:!pt-1">
      <div className="vote-card-wrap w-full max-w-3xl !gap-2">
        <motion.div
          key={cardKey}
          className="vote-card !max-h-[62vh] sm:!max-h-[64vh] lg:!max-h-[68vh] !gap-3 !p-4 md:!p-5"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.24}
          onDragEnd={handleDragEnd}
          style={{ x, rotate }}
          animate={controls}
        >
          {toast ? <div className="vote-toast">{toast}</div> : null}
          <div className="vote-meta !text-[0.72rem] sm:!text-xs">
            <span>
              Caption {captionPosition} of {captionCount}
            </span>
            <span className="vote-meta-divider" />
            <span>Swipe to vote</span>
          </div>

          <div className="vote-media min-h-0 flex-1 !h-auto !max-h-[38vh] !p-2 sm:!max-h-[40vh] lg:!max-h-[44vh]">
            <ImageWithFallback
              src={currentItem.imageUrl}
              alt="Caption image"
              className="vote-image h-full w-full object-contain"
            />
          </div>

          <div className="vote-caption !gap-2">
            <p className="vote-caption-text !text-base !leading-snug md:!text-[1.05rem]">
              {captionText}
            </p>
          </div>

          <motion.div className="vote-swipe-hint vote-swipe-hint-right" style={{ opacity: rightHintOpacity }}>
            Upvote
          </motion.div>
          <motion.div className="vote-swipe-hint vote-swipe-hint-left" style={{ opacity: leftHintOpacity }}>
            Downvote
          </motion.div>
        </motion.div>

        <div className="vote-actions !gap-2">
          <button
            type="button"
            className="vote-action-button vote-action-down !py-2"
            onClick={() => void handleVote(-1)}
            disabled={isSaving}
          >
            Downvote
          </button>
          <button
            type="button"
            className="vote-action-button vote-action-up !py-2"
            onClick={() => void handleVote(1)}
            disabled={isSaving}
          >
            Upvote
          </button>
        </div>

        {error ? <p className="vote-error">{error}</p> : null}
        {isLoadingMore ? (
          <p className="vote-status">Loading more captions…</p>
        ) : null}
        {isComplete ? (
          <p className="vote-status">That was the last caption. Check back soon.</p>
        ) : null}
      </div>
    </div>
  );
}
