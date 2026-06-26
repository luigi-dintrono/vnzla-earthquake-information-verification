import { FeedView, type SP } from "@/components/FeedView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demo" };

export default async function DemoFeed({ searchParams }: { searchParams: Promise<SP> }) {
  return <FeedView demo={true} searchParams={await searchParams} />;
}
