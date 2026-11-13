"use client";

import { useEffect, useState } from "react";
import { cn, initials } from "@/components/ui";

export default function UserAvatar({ user, className, imageClassName, fallbackClassName }) {
  const [imageFailed, setImageFailed] = useState(false);
  const picture = String(user?.picture || "").trim();

  useEffect(() => setImageFailed(false), [picture]);

  if (picture && !imageFailed) {
    return (
      <span className={cn("relative block shrink-0 overflow-hidden rounded-full", className)}>
        <img
          src={picture}
          alt={`${user?.name || "User"} profile`}
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className={cn("h-full w-full object-cover", imageClassName)}
        />
      </span>
    );
  }

  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full font-bold", className, fallbackClassName)}>
      {initials(user?.name || "User")}
    </span>
  );
}
