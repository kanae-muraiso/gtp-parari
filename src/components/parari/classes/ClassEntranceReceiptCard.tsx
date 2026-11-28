"use client";
export type ClassEntranceReceipt={name:string;bookingId:string;checkedAt:string;title:string;sessionAt:string};
export default function ClassEntranceReceiptCard({receipt}:{receipt:ClassEntranceReceipt}){
 return <section className="mt-5 grid gap-4 rounded-2xl bg-emerald-100 p-5 text-emerald-950" role="status">
        <div className="mx-auto grid h-20 w-20 animate-pulse place-items-center rounded-full bg-emerald-700 text-5xl text-white motion-reduce:animate-none" aria-hidden>✓</div>
        <h1 className="text-3xl font-bold">受付完了</h1><p className="text-xl font-bold">{receipt.name} 様</p>
        <p className="text-lg">{receipt.title}</p><p className="text-base">受付時刻 {new Date(receipt.checkedAt).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}</p>
        <p className="break-all text-base">申込番号 {receipt.bookingId}</p><p className="text-base">この画面を受付スタッフにお見せください。</p>
      </section>;
}
