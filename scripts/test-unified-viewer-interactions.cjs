// 2026-10-07 20:35 JST
// PART: Real React DOM interactions with synthetic geometry and dictionary responses
const assert = require('node:assert/strict');
const req = require;
require('./test-unified-viewer.cjs');
const {JSDOM} = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {url:'https://reader.test/',pretendToBeVisual:true});
for (const key of ['window','document','Node','HTMLElement','Element','Image','Event','MouseEvent','KeyboardEvent','MutationObserver']) global[key] = dom.window[key];
global.IS_REACT_ACT_ENVIRONMENT = true;
const React = req('react');
const {createRoot} = req('react-dom/client');
const {ParariViewer} = req('../src/components/parari/viewer-v2/ParariViewer.tsx');
const {buildViewerDocument} = req('../src/components/parari/viewer-v2/buildViewerDocument.ts');
const {readingPositionStorageKey,readingModeStorageKey} = req('../src/components/parari/viewer-v2/readerProgress.ts');
// JSDOM has no layout engine. Geometry is deterministic; visual layout is not claimed.
let width=318;
Object.defineProperty(HTMLElement.prototype,'clientWidth',{get(){return width;}});
Object.defineProperty(HTMLElement.prototype,'scrollHeight',{get(){return Math.ceil((this.textContent.length||1)/(width/9))*32 + this.querySelectorAll('p').length*16;}});
HTMLElement.prototype.getBoundingClientRect = function(){
  const top=this.hasAttribute('data-parari-sheet-pager')?780:this.hasAttribute('data-parari-paged-sheet')?120:this.hasAttribute('data-parari-sheet-id')?120-window.scrollY:48-window.scrollY;
  const height=this.hasAttribute('data-parari-sheet-id')?2000:640;
  return {top,left:0,right:width,bottom:top+height,width,height,x:0,y:top,toJSON(){return this;}};
};
window.scrollTo = ({top})=>{ window.scrollY=top; window.dispatchEvent(new Event('scroll')); };
HTMLElement.prototype.scrollIntoView = function(){window.scrollTo({top:0});};
let fetches=0;
global.fetch=async (url,options)=>{
  assert.equal(url,'/api/english/dictionary');fetches++;
  const {words}=JSON.parse(options.body);assert.ok(words.includes('hello'));
  return {ok:true,json:async()=>({results:{hello:{found:true,matched:'hello',best:{word:'hello',lemma:'hello',pos:'interjection',formType:'base',senseId:'1',meaningJa:'こんにちは',eikenLevel:'3',eikenLevels:['3'],entryKind:'word'}}}})};
};
const text='Hello [[漢字|かんじ]] world.\n\n'+Array.from({length:12},(_,i)=>`Paragraph ${i+1}. Original text retained through pagination.`).join('\n\n');
const sources={
  book:`[BOOK]\ntitle: Test book\ncover: false\ntitlePage: false\ntoc: false\ndefaultReadingMode: scroll\n\n[PAGE] First\n${text}\n\n[PAGE] Last\nLast original body.`,
  page:`[PAGE]\ntitle: Test page\n\n[T]\n${text}\n\n[NOTICE] Important notice`,
  web:`[WEB]\ntitle: Test site\n\n[WEBPAGE]\npageType: top\ntitle: Home\nslug: home\nisHome: true\n\n[T]\n${text}\n[/WEBPAGE]\n\n[WEBPAGE]\npageType: fixed\ntitle: About\nslug: about\n\n[T]\nAbout original body.\n[/WEBPAGE]`,
};
let root;
async function settle(ms=40){await React.act(async()=>{await new Promise(resolve=>setTimeout(resolve,ms));});}
async function mount(format,pageSlug=null){
  if(root)await React.act(async()=>root.unmount());
  root=createRoot(document.getElementById('root'));
  await React.act(async()=>root.render(React.createElement(ParariViewer,{content:sources[format],workId:`test-${format}`,pageSlug,publicBasePath:'/author/site'})));
  await settle();
}
function findButton(label,scope=document){const b=[...scope.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')===label || x.textContent.trim()===label);assert.ok(b,`Missing ${label}`);return b;}
async function click(label,scope=document){const b=findButton(label,scope);assert.equal(b.disabled,false);await React.act(async()=>b.click());await settle();}
async function settings(){if(!document.querySelector('[aria-label="読書設定"]'))await click('読書設定を開く');}
async function option(group,label){await settings();const g=document.querySelector(`[role="group"][aria-label="${group}"]`);assert.ok(g);await click(label,g);}
async function keyEscape(){await React.act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));}

(async()=>{
 for(const format of ['book','page','web']){
  window.localStorage.clear();window.scrollY=0;width=318;
  await mount(format);
  assert.equal(document.querySelectorAll('[aria-label="読書ツールバー"]').length,1);
  await click('漢字');assert.ok(document.body.textContent.includes('かんじ'));
  await option('ルビ','非表示');await keyEscape();
  assert.equal([...document.querySelectorAll('button')].some(b=>b.textContent==='漢字'),false);
  await option('ルビ','クリック');
  await option('文字サイズ','大');
  assert.ok(document.querySelector('[data-parari-text-block]').classList.contains('text-lg'));
  await option('書体','文学');
  assert.ok(document.querySelector('[data-parari-text-block]').classList.contains('font-serif'));
  const before=fetches;await option('語注','学習');await keyEscape();assert.ok(fetches>before);
  await click('Hello');assert.ok(document.body.textContent.includes('こんにちは'));
  await settings();await keyEscape();assert.equal(document.querySelector('[aria-label="読書設定"]'),null);
  await settings();await React.act(async()=>document.body.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true})));
  assert.equal(document.querySelector('[aria-label="読書設定"]'),null);
  await option('語注','OFF');
  await option('表示方法','PAGEスクロール');assert.ok(document.querySelector('[data-parari-sheet-pager]'));
  await option('表示方法','ページめくり');assert.ok(document.querySelector('[data-parari-sheet-pager]'));
  const collected=[];
  for(let i=0;i<30;i++){
    collected.push(document.querySelector('main').textContent);
    if(findButton('次へ').disabled)break;
    await click('次へ');
    if(i===29)throw Error('pagination did not terminate');
  }
  const all=collected.join(' ');
  for(let i=1;i<=12;i++) assert.equal(all.split(`Paragraph ${i}.`).length-1,1,`${format}: paragraph ${i} preserved exactly once`);
  const last=document.querySelector('main').textContent;
  await mount(format);
  assert.equal(document.querySelector('main').textContent,last,`${format}: restore saved paged position after initial scroll default`);
  const oldCount=Number(document.querySelector('[data-parari-sheet-pager]').textContent.match(/\/ (\d+)/)?.[1] || 1);
  width=624;await React.act(async()=>window.dispatchEvent(new Event('resize')));await settle();
  const newCount=Number(document.querySelector('[data-parari-sheet-pager]').textContent.match(/\/ (\d+)/)?.[1] || 1);
  assert.ok(newCount<=oldCount, `${format}: wider pages repaginate`);
  assert.ok(document.querySelector('main').textContent.includes(format==='book'?'Last original body.':'Paragraph 12.'), `${format}: resize preserves reading sheet/progress`);
  await settings();await click('読書位置をリセット');assert.equal(findButton('前へ').disabled,true);
  await option('表示方法','全文スクロール');assert.equal(document.querySelector('[data-parari-sheet-pager]'),null);
  assert.equal(document.querySelectorAll('[data-parari-text-block]').length>0,true);
  console.log(`PASS interaction: ${format} settings, ruby, dictionary, menu dismissal, modes, complete pagination, restore and reset`);
 }
 await mount('web','about');assert.ok(document.body.textContent.includes('About original body.'));assert.ok(document.querySelector('a[href="/author/site"]'));
 assert.equal(document.body.textContent.includes('Paragraph 1.'),false);
 await React.act(async()=>root.unmount());root=null;
 console.log('PASS interaction: WEB page navigation selects the requested body and preserves home links.');
 dom.window.close();
})().catch(async e=>{console.error(e);if(root)await React.act(async()=>root.unmount());dom.window.close();process.exitCode=1;});
