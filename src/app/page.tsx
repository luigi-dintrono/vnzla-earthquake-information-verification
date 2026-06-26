import { FeedView, type SP } from "@/components/FeedView";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<SP> }) {
  return <FeedView demo={false} searchParams={await searchParams} />;
}
