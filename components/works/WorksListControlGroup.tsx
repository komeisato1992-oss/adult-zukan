import type { ReactNode } from "react";

type WorksListControlGroupProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function WorksListControlGroup({
  label,
  children,
  className = "",
}: WorksListControlGroupProps) {
  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <p className="text-xs font-bold text-foreground md:hidden">{label}</p>
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-3">
        <p className="hidden shrink-0 text-xs font-bold text-foreground md:block">
          {label}：
        </p>
        {children}
      </div>
    </div>
  );
}
