import { createServerClient } from "@/lib/supabase/server";

interface GalleryPage {
  id: string;
  image_url: string;
  character_manifests: {
    character_name: string;
    theme: string;
  } | null;
}

/**
 * Server component that renders real completed coloring pages from the DB.
 * Uses the service role client so it can read across all orders (bypasses RLS).
 * Returns null (hides the section) if no completed pages exist yet.
 */
export async function GalleryOfDreams() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("pages")
    .select(
      "id, image_url, character_manifests(character_name, theme)",
    )
    .eq("status", "complete")
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error || !data || data.length === 0) {
    return null;
  }

  const pages = data as unknown as GalleryPage[];

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h2
          className="text-2xl font-bold text-gray-800 whitespace-nowrap"
          style={{ fontFamily: "var(--font-caveat), cursive" }}
        >
          Gallery of Dreams
        </h2>
        <div className="flex-1 h-px bg-gradient-to-r from-amber-300 via-pink-300 to-transparent" />
        <span
          className="text-sm text-gray-500 bg-amber-100 px-3 py-1 rounded-full whitespace-nowrap"
          style={{ fontFamily: "var(--font-nunito), sans-serif" }}
        >
          ✨ Real pages from real adventures
        </span>
      </div>

      {/* Scroll container */}
      <div className="gallery-scroll flex gap-4 overflow-x-auto pb-4 px-2">
        {pages.map((page) => (
          <div
            key={page.id}
            className="paper-curl flex-shrink-0 w-48 overflow-hidden"
            style={{ borderRadius: "4px 8px 8px 4px" }}
          >
            <div className="bg-white h-64 flex flex-col sketch-border">
              <div className="flex-1 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.image_url}
                  alt={
                    page.character_manifests?.character_name ??
                    "Coloring page"
                  }
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="px-2 pb-2 pt-1">
                <p
                  className="text-center text-sm font-semibold text-gray-700 truncate"
                  style={{ fontFamily: "var(--font-caveat), cursive" }}
                >
                  {page.character_manifests?.character_name ?? "Adventure"}
                </p>
                {page.character_manifests?.theme && (
                  <p
                    className="text-center text-xs text-amber-600 truncate"
                    style={{ fontFamily: "var(--font-nunito), sans-serif" }}
                  >
                    {page.character_manifests.theme}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
