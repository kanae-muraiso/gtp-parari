import Bookshelf from "./Bookshelf";
import LegacyBookshelf from "./LegacyBookshelf";

type Props = {
  searchParams: Promise<{ tab?: string | string[] }>;
};

export default async function BookshelfPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  // Participation links identify the active membership using the original URL.
  return (Array.isArray(tab) ? tab[0] : tab) === "membership"
    ? <LegacyBookshelf />
    : <Bookshelf />;
}
