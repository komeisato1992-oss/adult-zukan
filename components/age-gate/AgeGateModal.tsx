"use client";

import { useRouter } from "next/navigation";
import { siteConfig } from "@/lib/site-config";
import { saveAgeVerification } from "@/lib/age-gate/storage";

type AgeGateModalProps = {
  onVerified: () => void;
};

export function AgeGateModal({ onVerified }: AgeGateModalProps) {
  const router = useRouter();

  function handleAccept() {
    saveAgeVerification();
    onVerified();
  }

  function handleDeny() {
    router.push("/age-denied");
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      aria-describedby="age-gate-description"
    >
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-white shadow-2xl">
        {/* ヘッダー */}
        <div className="border-b border-border bg-gradient-to-r from-[#1a0000] via-[#3d0000] to-black px-6 py-5 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/70">
            Age Verification
          </p>
          <h2
            id="age-gate-title"
            className="mt-2 text-2xl font-bold text-white"
          >
            {siteConfig.name}
          </h2>
        </div>

        {/* 本文 */}
        <div className="px-6 py-8 text-center">
          <p
            id="age-gate-description"
            className="text-sm leading-relaxed text-muted"
          >
            当サイトは18歳以上を対象とした
            <br />
            アダルト作品紹介・検索サイトです。
          </p>
          <p className="mt-4 text-sm font-semibold text-foreground">
            18歳未満の方の閲覧は固くお断りします。
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleAccept}
              className="h-12 w-full rounded bg-accent text-sm font-bold text-white transition-colors hover:bg-accent-hover"
            >
              18歳以上です
            </button>
            <button
              type="button"
              onClick={handleDeny}
              className="h-12 w-full rounded border-2 border-foreground bg-white text-sm font-semibold text-foreground transition-colors hover:bg-surface"
            >
              18歳未満です
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
