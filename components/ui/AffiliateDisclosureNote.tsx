type AffiliateDisclosureNoteProps = {
  className?: string;
};

export function AffiliateDisclosureNote({
  className = "",
}: AffiliateDisclosureNoteProps) {
  return (
    <p className={`text-xs leading-relaxed text-muted ${className}`}>
      ※本ページにはアフィリエイトリンクが含まれています。
    </p>
  );
}
