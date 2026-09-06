"use client";

import Image from "next/image";

type BookImageProps = {
  src: string;
  alt: string;
  index: number;
};

export default function BookImage({ src, alt, index }: BookImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="object-contain p-1"
      onError={(e) => {
        const t = e.currentTarget as HTMLImageElement;
        t.style.display = "none";
        if (t.parentElement) {
          t.parentElement.style.background = `hsl(${(index * 47 + 30) % 360}, 20%, 88%)`;
        }
      }}
      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
    />
  );
}
