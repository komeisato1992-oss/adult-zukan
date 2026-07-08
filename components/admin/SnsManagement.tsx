import { getSnsScheduledPosts } from "@/lib/admin/sns-posts";
import { loadSnsPostHistory } from "@/lib/admin/sns-post-history-store";
import { SnsManagementClient } from "@/components/admin/SnsManagementClient";

export async function SnsManagement() {
  const [posts, { records: history }] = await Promise.all([
    getSnsScheduledPosts(),
    loadSnsPostHistory(),
  ]);

  return (
    <SnsManagementClient initialPosts={posts} initialHistory={history} />
  );
}
