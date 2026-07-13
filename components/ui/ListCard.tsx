import Link from "next/link";

type ListCardProps = {
  href: string;
  title: string;
  description: string;
  meta?: string;
};

export function ListCard({ href, title, description, meta }: ListCardProps) {
  return (
    <article className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md max-[768px]:p-3 dark:border-gray-800 dark:bg-gray-900">
      <Link href={href} className="block">
        <h2 className="text-base font-semibold text-gray-900 max-[768px]:line-clamp-2 max-[768px]:text-[15px] dark:text-white">
          {title}
        </h2>
        {meta && (
          <p className="mt-1 text-xs text-gray-400 max-[768px]:text-[12px] dark:text-gray-500">
            {meta}
          </p>
        )}
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-600 max-[768px]:mt-1.5 max-[768px]:text-[13px] dark:text-gray-400">
          {description}
        </p>
      </Link>
    </article>
  );
}
