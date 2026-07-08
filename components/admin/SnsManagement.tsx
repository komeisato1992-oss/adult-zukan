import { getSnsScheduledPosts } from "@/lib/admin/sns-posts";
import { SnsPostCard } from "@/components/admin/SnsPostCard";

export async function SnsManagement() {
  const posts = await getSnsScheduledPosts();

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">今日の投稿</h2>
      <div className="grid gap-4">
        {posts.map((post) => (
          <SnsPostCard key={post.slot} post={post} />
        ))}
      </div>
    </section>
  );
}
