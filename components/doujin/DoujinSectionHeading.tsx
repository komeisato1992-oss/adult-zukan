type DoujinSectionHeadingProps = {
  title: string;
  id?: string;
  className?: string;
};

/** アダルト図鑑のセクション見出しと同型。縦線色は同人テーマの --accent (#F78FA7) */
export function DoujinSectionHeading({
  title,
  id,
  className = "mb-4",
}: DoujinSectionHeadingProps) {
  return (
    <h2
      id={id}
      className={`border-l-4 border-accent pl-3 text-lg font-bold text-foreground ${className}`}
    >
      {title}
    </h2>
  );
}
