import {notFound} from "next/navigation";
import {classBLabAvailable} from "@/lib/testing/classBLabAvailable";
import EntranceDemo from "./EntranceDemo";
export const dynamic="force-dynamic";
export default function LabEntrancePage(){
 if(!classBLabAvailable())notFound();
 return <EntranceDemo/>;
}
