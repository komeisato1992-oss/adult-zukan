import { DoujinEntityListPage } from "@/components/admin/DoujinEntityListPage";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function Page({ searchParams }: PageProps) {
  return <DoujinEntityListPage kind="genres" searchParams={searchParams} />;
}
