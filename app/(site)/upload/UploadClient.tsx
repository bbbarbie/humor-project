"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
]);

const STEP_LABELS = [
  "Requesting upload URL...",
  "Uploading...",
  "Registering...",
  "Generating captions...",
] as const;

type UploadStatus = "idle" | "running" | "error" | "done";

type CaptionRecord = string | Record<string, unknown>;
type CaptionsResponse =
  | CaptionRecord[]
  | {
      captions?: CaptionRecord[];
      data?: CaptionRecord[];
      caption?: string;
    }
  | null;

function toCaptionText(entry: CaptionRecord) {
  if (typeof entry === "string") return entry;
  if (typeof entry.content === "string") return entry.content;
  if (typeof entry.caption === "string") return entry.caption;
  if (typeof entry.text === "string") return entry.text;
  return null;
}

function normalizeCaptions(payload: CaptionsResponse): string[] {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload
      .map(toCaptionText)
      .filter((value): value is string => Boolean(value && value.trim()));
  }

  if (typeof payload.caption === "string" && payload.caption.trim()) {
    return [payload.caption];
  }

  const candidates = payload.captions ?? payload.data;
  if (!Array.isArray(candidates)) return [];

  return candidates
    .map(toCaptionText)
    .filter((value): value is string => Boolean(value && value.trim()));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function statusForStep(
  stepIndex: number,
  status: UploadStatus,
  activeStep: number | null
) {
  if (status === "idle" || activeStep === null) return "pending";
  if (status === "error") {
    if (activeStep === stepIndex) return "error";
    if (stepIndex < activeStep) return "done";
    return "pending";
  }
  if (status === "done") return "done";
  if (stepIndex < activeStep) return "done";
  if (stepIndex === activeStep) return "active";
  return "pending";
}

export default function UploadClient() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captions, setCaptions] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const clearFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setPreviewUrl(null);
  };

  const selectFile = (nextFile: File | null) => {
    setError(null);
    setCaptions([]);
    setStatus("idle");
    setActiveStep(null);

    if (!nextFile) {
      clearFile();
      return;
    }

    if (!ALLOWED_TYPES.has(nextFile.type)) {
      clearFile();
      setError("Invalid file type");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  };

  const fail = (stepIndex: number, message: string) => {
    setStatus("error");
    setActiveStep(stepIndex);
    setError(message);
  };

  const stepClass = (state: "pending" | "active" | "error" | "done") => {
    if (state === "done") {
      return "border-emerald-200/40 bg-emerald-500/15 text-emerald-100";
    }
    if (state === "active") {
      return "border-blue-200/40 bg-blue-500/15 text-blue-100";
    }
    if (state === "error") {
      return "border-red-200/40 bg-red-500/20 text-red-100";
    }
    return "border-white/10 bg-white/5 text-white/70";
  };

  const handleGenerateCaptions = async () => {
    if (!file) {
      setError("Select an image first");
      return;
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Invalid file type");
      return;
    }
    if (!supabase) {
      setError("Missing Supabase environment variables");
      return;
    }

    setError(null);
    setCaptions([]);
    setStatus("running");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        fail(0, "Not logged in");
        return;
      }

      setActiveStep(0);
      const presignResponse = await fetch(
        "https://api.almostcrackd.ai/pipeline/generate-presigned-url",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ contentType: file.type }),
        }
      );

      if (!presignResponse.ok) {
        fail(0, "Requesting upload URL failed");
        return;
      }

      const presignPayload = (await presignResponse.json()) as {
        presignedUrl?: string;
        cdnUrl?: string;
      };

      if (!presignPayload.presignedUrl || !presignPayload.cdnUrl) {
        fail(0, "Requesting upload URL failed");
        return;
      }

      setActiveStep(1);
      const uploadResponse = await fetch(presignPayload.presignedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        fail(1, "Upload failed");
        return;
      }

      setActiveStep(2);
      const registerResponse = await fetch(
        "https://api.almostcrackd.ai/pipeline/upload-image-from-url",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            imageUrl: presignPayload.cdnUrl,
            isCommonUse: false,
          }),
        }
      );

      if (!registerResponse.ok) {
        fail(2, "Registering failed");
        return;
      }

      const registerPayload = (await registerResponse.json()) as {
        imageId?: string;
      };

      if (!registerPayload.imageId) {
        fail(2, "Registering failed");
        return;
      }

      setActiveStep(3);
      const captionsResponse = await fetch(
        "https://api.almostcrackd.ai/pipeline/generate-captions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageId: registerPayload.imageId }),
        }
      );

      if (!captionsResponse.ok) {
        fail(3, "Generate failed");
        return;
      }

      const captionsPayload =
        (await captionsResponse.json().catch(() => null)) as CaptionsResponse;
      setCaptions(normalizeCaptions(captionsPayload));
      setStatus("done");
      setActiveStep(3);
    } catch {
      const fallbackMessage =
        activeStep === 1
          ? "Upload failed"
          : activeStep === 3
            ? "Generate failed"
            : "Something went wrong";
      fail(activeStep ?? 0, fallbackMessage);
    }
  };

  return (
    <section className="glass-card mx-auto w-full max-w-3xl">
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold text-white">Upload an Image</h2>
          <p className="mt-1 text-sm text-white/70">
            Supported: JPEG, JPG, PNG, WEBP, GIF, HEIC
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div
            className={`rounded-2xl border border-dashed p-5 transition ${
              isDragging
                ? "border-sky-200/70 bg-sky-500/10"
                : "border-white/20 bg-black/10"
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              if (status !== "running") {
                setIsDragging(true);
              }
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              if (status === "running") return;
              const dropped = event.dataTransfer.files?.[0] ?? null;
              selectFile(dropped);
            }}
          >
            <label className="flex cursor-pointer flex-col gap-3 text-sm text-white/80">
              <span className="font-semibold text-white">Image file</span>
              <input
                type="file"
                accept={Array.from(ALLOWED_TYPES).join(",")}
                onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
                disabled={status === "running"}
                className="block w-full text-sm text-white file:mr-3 file:rounded-full file:border-0 file:bg-white/20 file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-white/30 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span className="text-xs text-white/60">
                Drag and drop an image here, or click to browse.
              </span>
            </label>
          </div>

          {file ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/70">
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
                {file.name}
              </span>
              <span>{formatBytes(file.size)}</span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
                {file.type}
              </span>
            </div>
          ) : null}

          {previewUrl ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
              <img
                src={previewUrl}
                alt="Selected upload"
                className="h-56 w-full object-cover"
              />
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-xl border border-red-300/60 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleGenerateCaptions()}
            disabled={status === "running" || !file}
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/15 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "running" ? "Working..." : "Generate captions"}
          </button>
          <button
            type="button"
            onClick={clearFile}
            disabled={status === "running"}
            className="inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Clear
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold text-white">Progress</p>
          <p className="mt-1 text-xs text-white/60">
            {activeStep === null ? "Idle" : STEP_LABELS[activeStep]}
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-white/80">
            {STEP_LABELS.map((label, index) => {
              const stepState = statusForStep(index, status, activeStep);
              const stateLabel =
                stepState === "done"
                  ? "Done"
                  : stepState === "active"
                    ? "In progress"
                    : stepState === "error"
                      ? "Error"
                      : "Pending";

              return (
                <li key={label} className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide ${stepClass(
                      stepState
                    )}`}
                  >
                    {stateLabel}
                  </span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-semibold text-white">Captions</p>
          {captions.length ? (
            <ul className="mt-3 grid gap-2 text-sm text-white/80">
              {captions.map((caption, index) => (
                <li
                  key={`${caption}-${index}`}
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-2"
                >
                  {caption}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-white/60">
              No captions yet. Upload an image and click Generate captions.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
