import Parser from "rss-parser";
import type { Source } from "@/lib/types";
import type { RawItemInput } from "@/lib/ingest/types";
import { clip, stripNoise } from "@/lib/text";

const parser = new Parser({ timeout: 15000 });
const MAX_ITEMS = 25;

/** Parse any RSS/Atom feed URL into normalized raw items. */
export async function fetchRssUrl(url: string, source: Source): Promise<RawItemInput[]> {
  const feed = await parser.parseURL(url);
  const items = (feed.items ?? []).slice(0, MAX_ITEMS);

  return items
    .map((it): RawItemInput => {
      const title = it.title?.trim() ?? "";
      const body = stripNoise(it.contentSnippet ?? it.content ?? "");
      const raw_text = clip([title, body].filter(Boolean).join(". "), 1200);
      const enclosureUrl = (it.enclosure as { url?: string } | undefined)?.url;
      return {
        external_id: it.guid ?? it.link ?? title,
        author: (it as { creator?: string }).creator ?? source.name,
        raw_text,
        raw_url: it.link ?? url,
        lang: "es",
        media: enclosureUrl ? [{ type: "image", url: enclosureUrl }] : [],
        captured_at: it.isoDate ?? null,
      };
    })
    .filter((r) => r.raw_text.length > 0);
}

/** RSS / news connector. */
export async function fetchRss(source: Source): Promise<RawItemInput[]> {
  if (!source.url) return [];
  return fetchRssUrl(source.url, source);
}
