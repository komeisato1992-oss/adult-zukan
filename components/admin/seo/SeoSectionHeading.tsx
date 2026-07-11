import type { ReactNode } from "react";

type SeoSectionHeadingProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function SeoSectionHeading({
  title,
  description,
  action,
}: SeoSectionHeadingProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="border-l-4 border-accent pl-3 text-lg font-bold text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 pl-4 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
