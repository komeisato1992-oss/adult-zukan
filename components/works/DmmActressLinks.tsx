import Link from "next/link";
import { getActressDetailPath } from "@/lib/actresses/slug";

type DmmActressLinksProps = {
  names: string[];
  className?: string;
};

export function DmmActressLinks({ names, className = "" }: DmmActressLinksProps) {
  if (names.length === 0) return null;

  return (
    <span className={className}>
      {names.map((name, index) => (
        <span key={name}>
          {index > 0 && "、"}
          <Link
            href={getActressDetailPath(name)}
            className="text-accent hover:underline"
          >
            {name}
          </Link>
        </span>
      ))}
    </span>
  );
}
