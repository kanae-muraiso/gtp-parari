import {Suspense} from "react";
import FanWelcomePage from "./FanWelcomePage";
export default function Page(){return <Suspense fallback={<main className="p-6">読み込み中…</main>}><FanWelcomePage/></Suspense>;}
