"use client";

import { useState } from "react";

type ImageWithFallbackProps = {
  src?: string | null;
  alt: string;
  className?: string;
};

export function ImageWithFallback({
  src,
  alt,
  className,
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);
  const sizeClasses = className ?? "h-60 w-full";

  if (!src || hasError) {
    return (
      <div
        className={`flex ${sizeClasses} items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-500`}
      >
        No image
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={sizeClasses}
      onError={() => setHasError(true)}
    />
  );
}
