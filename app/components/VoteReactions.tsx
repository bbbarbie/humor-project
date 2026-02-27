"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type VoteReactionType = "up" | "down";
const MAX_ITEMS_PER_CLICK = 60;
const MAX_TOTAL_ITEMS = 80;

type OverlayItem =
  | {
      id: string;
      kind: "wiggle";
      emoji: string;
      x: number;
      y: number;
      ttl: number;
    }
  | {
      id: string;
      kind: "up-float";
      emoji: string;
      x: number;
      y: number;
      size: number;
      driftX: number;
      riseY: number;
      rotate: number;
      wobble: number;
      duration: number;
      ttl: number;
    }
  | {
      id: string;
      kind: "down-burst";
      emoji: string;
      x: number;
      y: number;
      size: number;
      burstX: number;
      burstY: number;
      driftX: number;
      driftY: number;
      rotate: number;
      duration: number;
      ttl: number;
    };

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

type TriggerFn = (type: VoteReactionType, rect?: DOMRect | null) => void;

let triggerListener: TriggerFn | null = null;

export function triggerVoteReaction(type: VoteReactionType, buttonRect?: DOMRect | null) {
  triggerListener?.(type, buttonRect);
}

export function ReactionOverlay() {
  const [items, setItems] = useState<OverlayItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());
  const idCounter = useRef(0);
  const extraTimers = useRef<Set<number>>(new Set());

  useEffect(() => {
    const activeTimers = timers.current;
    const pendingExtraTimers = extraTimers.current;
    return () => {
      activeTimers.forEach((timer) => window.clearTimeout(timer));
      activeTimers.clear();
      pendingExtraTimers.forEach((timer) => window.clearTimeout(timer));
      pendingExtraTimers.clear();
    };
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const addItems = useCallback(
    (newItems: OverlayItem[]) => {
      if (newItems.length === 0) return;
      const trimmedForClick = newItems.slice(0, MAX_ITEMS_PER_CLICK);

      setItems((prev) => {
        const combined = [...prev, ...trimmedForClick];
        if (combined.length <= MAX_TOTAL_ITEMS) return combined;

        const dropCount = combined.length - MAX_TOTAL_ITEMS;
        const dropped = combined.slice(0, dropCount);
        dropped.forEach((item) => {
          const timer = timers.current.get(item.id);
          if (timer) {
            window.clearTimeout(timer);
            timers.current.delete(item.id);
          }
        });
        return combined.slice(dropCount);
      });

      trimmedForClick.forEach((item) => {
        const timer = window.setTimeout(() => {
          removeItem(item.id);
        }, item.ttl);
        timers.current.set(item.id, timer);
      });
    },
    [removeItem]
  );

  const nextId = useCallback(() => {
    idCounter.current += 1;
    return `vote-react-${idCounter.current}-${Date.now()}`;
  }, []);

  const triggerReaction = useCallback<TriggerFn>(
    (kind, rect) => {
      if (typeof window === "undefined") return;

      const fallbackX = window.innerWidth * 0.5;
      const fallbackY = window.innerHeight * 0.72;
      const originX = rect ? rect.left + rect.width / 2 : fallbackX;
      const originY = rect ? rect.top + rect.height / 2 : fallbackY;

      if (kind === "up") {
        addItems([
          {
            id: nextId(),
            kind: "wiggle",
            emoji: ["😍", "😭", "😂"][randomInt(0, 2)],
            x: originX,
            y: originY,
            ttl: randomInt(2000, 3000),
          },
        ]);

        const spawnTimer = window.setTimeout(() => {
          const clickItems: OverlayItem[] = [];
          const count = randomInt(25, 45);
          const choices = ["😍", "😭", "😂"];
          for (let index = 0; index < count; index += 1) {
            const fromBottomHalf = Math.random() < 0.72;
            const duration = randomInt(1400, 2200);
            const startX = randomFloat(0, window.innerWidth);
            const startY = fromBottomHalf
              ? randomFloat(window.innerHeight * 0.6, window.innerHeight)
              : randomFloat(0, window.innerHeight);
            clickItems.push({
              id: nextId(),
              kind: "up-float",
              emoji: choices[randomInt(0, choices.length - 1)],
              x: startX,
              y: startY,
              size: randomInt(28, 56),
              driftX: randomFloat(-140, 140),
              riseY: randomFloat(180, 420),
              rotate: randomFloat(-44, 44),
              wobble: randomFloat(18, 48),
              duration,
              ttl: randomInt(2000, 3000),
            });
          }
          addItems(clickItems);
          extraTimers.current.delete(spawnTimer);
        }, 320);
        extraTimers.current.add(spawnTimer);

        return;
      }

      const booChoices = ["💨", "🗑️"];
      const clickItems: OverlayItem[] = [];
      const booCount = randomInt(18, 35);
      for (let index = 0; index < booCount; index += 1) {
        const duration = randomInt(1200, 2000);
        const startX = randomFloat(0, window.innerWidth);
        const startY = randomFloat(0, window.innerHeight);
        clickItems.push({
          id: nextId(),
          kind: "down-burst",
          emoji: booChoices[randomInt(0, booChoices.length - 1)],
          x: startX,
          y: startY,
          size: randomInt(28, 54),
          burstX: randomFloat(-36, 36),
          burstY: randomFloat(-36, 36),
          driftX: randomFloat(-120, 120),
          driftY: randomFloat(-110, 90),
          rotate: randomFloat(-120, 120),
          duration,
          ttl: randomInt(2000, 3000),
        });
      }

      addItems(clickItems);
    },
    [addItems, nextId]
  );

  useEffect(() => {
    triggerListener = triggerReaction;
    return () => {
      if (triggerListener === triggerReaction) {
        triggerListener = null;
      }
    };
  }, [triggerReaction]);

  const canUseDOM = typeof document !== "undefined";
  const overlay = useMemo(() => {
    if (!canUseDOM) return null;
    return createPortal(
      <div className="vote-reaction-overlay" aria-hidden="true">
        <AnimatePresence>
          {items.map((item) => {
            if (item.kind === "wiggle") {
              return (
                <motion.div
                  key={item.id}
                  className="vote-reaction-wiggle"
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: [0.9, 1.05, 1] }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.34, ease: "easeOut" }}
                  style={{ left: item.x, top: item.y }}
                >
                  {item.emoji}
                </motion.div>
              );
            }

            if (item.kind === "up-float") {
              return (
                <motion.div
                  key={item.id}
                  className="vote-reaction-float"
                  initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.9 }}
                  animate={{
                    opacity: [0, 1, 1, 0],
                    x: [0, item.wobble, item.driftX - item.wobble, item.driftX],
                    y: [0, -item.riseY * 0.35, -item.riseY * 0.68, -item.riseY],
                    rotate: [0, item.rotate * 0.5, item.rotate],
                    scale: [0.9, 1.05, 1],
                  }}
                  transition={{
                    duration: item.duration / 1000,
                    ease: "easeOut"
                  }}
                  style={{ left: item.x, top: item.y, fontSize: `${item.size}px` }}
                >
                  {item.emoji}
                </motion.div>
              );
            }

            if (item.kind === "down-burst") {
              return (
                <motion.div
                  key={item.id}
                  className="vote-reaction-float"
                  initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.9 }}
                  animate={{
                    opacity: [0, 1, 0.88, 0],
                    x: [0, item.burstX, item.burstX + item.driftX],
                    y: [0, item.burstY, item.burstY + item.driftY],
                    rotate: [0, item.rotate * 0.5, item.rotate],
                    scale: [0.7, 1.06, 0.92],
                  }}
                  transition={{
                    duration: item.duration / 1000,
                    ease: "easeOut",
                  }}
                  style={{ left: item.x, top: item.y, fontSize: `${item.size}px` }}
                >
                  {item.emoji}
                </motion.div>
              );
            }

            return null;
          })}
        </AnimatePresence>
      </div>,
      document.body
    );
  }, [canUseDOM, items]);

  return overlay;
}
