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
 console.log("PASS: actual isolated browser lab scenario from failed payment through paid upgrade, quota, unpaid rejection, attendance, repeat check-in and gate closure.");
}
main().catch(e=>{console.error(e);process.exitCode=1});
