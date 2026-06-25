import type { MediaItem, Source } from "@/lib/types";

/** Normalized output every connector produces. */
export interface RawItemInput {
  external_id?: string | null;
  author?: string | null;
  raw_text: string;
  raw_url?: string | null;
  lang?: string | null;
  media?: MediaItem[];
  captured_at?: string | null;
}

/** A connector pulls fresh items for one source. Add new mediums by adding one. */
export type Connector = (source: Source) => Promise<RawItemInput[]>;
