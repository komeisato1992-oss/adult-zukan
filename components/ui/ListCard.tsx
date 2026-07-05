import Link from "next/link";

type ListCardProps = {
  href: string;
  title: string;
  description: string;
  meta?: string;
};

export function ListCard({ href, title, description, meta }: ListCardProps) {
  return (
    <article className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      <Link href={href} className="block">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        {meta && (
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{meta}</p>
        )}
        <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {description}
        </p>
      </Link>
    </article>
  );
}
