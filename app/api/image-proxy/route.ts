import { isAllowedImageProxyUrl } from "@/lib/image-proxy";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url")?.trim();

  if (!imageUrl || !isAllowedImageProxyUrl(imageUrl)) {
    return new Response("許可されていない画像URLです。", { status: 403 });
  }

  try {
    const upstream = await fetch(imageUrl, {
      cache: "force-cache",
      headers: {
        Accept: "image/*",
      },
    });

    if (!upstream.ok) {
      return new Response("画像の取得に失敗しました。", { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const body = await upstream.arrayBuffer();

    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("画像の取得に失敗しました。", { status: 502 });
  }
}
