import { DmmRelatedWorks } from "@/components/works/DmmRelatedWorks";
import type { DmmInternalLinkSection } from "@/lib/dmm/internal-links";

type DmmWorkInternalLinksProps = {
  sections: DmmInternalLinkSection[];
};

export function DmmWorkInternalLinks({ sections }: DmmWorkInternalLinksProps) {
  if (sections.length === 0) return null;

  return (
    <>
      {sections.map((section) => (
        <DmmRelatedWorks
          key={section.id}
          items={section.items}
          title={section.title}
          sectionId={section.id}
        />
      ))}
    </>
  );
}
