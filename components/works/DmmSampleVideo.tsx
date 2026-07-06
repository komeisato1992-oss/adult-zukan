"use client";

import { useState } from "react";

type DmmSampleVideoProps = {
  src: string;
};

function SectionHeading({ id, children }: { id: string; children: string }) {
  return (
    <h2
      id={id}
      className="mb-4 border-l-4 border-accent pl-3 text-lg font-bold text-foreground"
    >
      {children}
    </h2>
  );
}

export function DmmSampleVideo({ src }: DmmSampleVideoProps) {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return null;
  }

  return (
    <section aria-labelledby="sample-movie-title" className="mt-10">
      <SectionHeading id="sample-movie-title">サンプル動画</SectionHeading>
      <video
        src={src}
        controls
        className="w-full max-w-[720px] rounded-lg bg-black"
        preload="metadata"
        onError={() => setVisible(false)}
      >
        お使いのブラウザは動画再生に対応していません。
      </video>
    </section>
  );
}
