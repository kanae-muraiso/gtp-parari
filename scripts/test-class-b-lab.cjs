const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const Module=require("node:module");
const filename=path.resolve(__dirname,"../src/lib/testing/classBLab.ts");
const mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
mod._compile(ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
async function main(){
 const {runClassBLab}=mod.exports;
 const result=await runClassBLab(["fail","pay","class","class","class","class","class","class","upgrade","class","fill","member","event","event","event","event","paid","unpaid","open","enterUnpaid","enterPaid","enterPaid","close","enterPaid"]);
 assert.equal(result.plan,"b");assert.equal(result.blocks,2);assert.equal(result.classes,6);assert.equal(result.members,30);assert.equal(result.events,3);assert.equal(result.paid,1);assert.equal(result.unpaid,1);assert.equal(result.attended,1);assert.equal(result.gate,false);assert.equal(result.receipt.name,"ダミー参加者 A");
 assert.deepEqual(result.results.flatMap((r,i)=>r.ok?[]:[i]),[7,11,15,19,23]);
 assert.equal(result.entries.length,2);
 const cash=await runClassBLab(["pay","event","paid","unpaid","manualPresent","confirmCash","manualPresent"]);
 assert.equal(cash.results[4].ok,false);assert.equal(cash.results[5].ok,true);assert.equal(cash.results[6].ok,true);
 assert.equal(cash.paid,2);assert.equal(cash.unpaid,0);assert.equal(cash.attended,1);
 assert.equal(cash.entries.find(e=>e.name==="ダミー参加者 B").class_event_attendance,"present");
 const square=await runClassBLab(["pay","class","class","class","class","class","squareConnect","class","squareClass","squareFill","event","event","event","event","squareEvent"]);
 assert.deepEqual(square.results.flatMap((r,i)=>r.ok?[]:[i]),[7,13]);
 assert.equal(square.ordinaryClasses,5);assert.equal(square.squareClasses,1);
 assert.equal(square.members,31);assert.equal(square.ordinaryEvents,3);assert.equal(square.squareEvents,1);
 const revoked=await runClassBLab(["pay","class","class","class","class","class","squareClass","squareFill","disconnectSquare","class"]);
 assert.equal(revoked.results.at(-1).ok,false);assert.equal(revoked.ordinaryClasses,6);assert.equal(revoked.squareClasses,0);assert.equal(revoked.members,31);
 console.log("PASS: ordinary quotas, verified Square link only, deferred priced-slot attachment, 31 seats, paid event exemption and revocation retains data.");
 console.log("PASS: actual isolated browser lab scenario from failed payment through paid upgrade, quota, unpaid rejection, attendance, repeat check-in and gate closure.");
}
main().catch(e=>{console.error(e);process.exitCode=1});
