"use client";

import { useState } from "react";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: number;
}

export default function Avatar({ src, name, size = 40 }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const initial = name.trim()[0]?.toUpperCase() ?? "?";

  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };

  if (src && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        onError={() => setImgError(true)}
        className="rounded-full object-cover flex-shrink-0"
        style={style}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-green-800 flex items-center justify-center flex-shrink-0 text-white font-semibold select-none"
      style={style}
      aria-label={name}
    >
      {initial}
    </div>
  );
}
