import { DoujinSectionHeading } from "@/components/doujin/DoujinSectionHeading";

type DoujinWorkDescriptionProps = {
  description: string;
};

/** 作品紹介（危険な HTML は呼び出し側で除去済みのプレーンテキスト想定） */
export function DoujinWorkDescription({ description }: DoujinWorkDescriptionProps) {
  if (!description.trim()) return null;

  return (
    <section aria-labelledby="doujin-work-description-title" className="mt-10">
      <DoujinSectionHeading
        title="作品紹介"
        id="doujin-work-description-title"
      />
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted sm:text-base">
        {description}
      </p>
    </section>
  );
}
