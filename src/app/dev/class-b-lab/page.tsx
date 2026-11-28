import {notFound} from "next/navigation";
import {classBLabAvailable} from "@/lib/testing/classBLabAvailable";
import LabClient from "./LabClient";
export const dynamic="force-dynamic";
export default function ClassBLabPage(){
 if(!classBLabAvailable())notFound();
 return <LabClient/>;
}
