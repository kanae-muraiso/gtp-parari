import {Suspense} from "react";
import LibraryWelcome from "./LibraryWelcome";
export default function Page(){return <Suspense fallback={<main className="p-6">読み込み中…</main>}><LibraryWelcome/></Suspense>;}
