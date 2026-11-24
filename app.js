(function(){
'use strict';
const $=id=>document.getElementById(id);
const core=window.KWCore;
const STORE='KW_BODRUM_MANUEL_JSON_PANEL_V2';
const API_BASE=String(window.KW_BODRUM_LIVE_API||'').trim().replace(/\/$/,'');
const LIVE_ENABLED=/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/i.test(API_BASE);
const number=n=>new Intl.NumberFormat('tr-TR').format(n);
const percent=(n,total)=>total?`%${new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n*100/total)}`:'%0,00';
let published=core.normalizeSnapshot(JSON.parse($('fallbackData').textContent));
let current=published;
let pending=null;
let activeOrigin='baseline';
function notify(message,type='success'){
  const div=$('alert');div.textContent=message;div.className='alert '+type;div.hidden=false;
}
function labelPeriodType(){
  const mode=$('periodType').value;
  $('periodValue').disabled=mode==='all';
  const prev=$('periodValue').value;
  $('periodValue').replaceChildren();
  const options=mode==='day'
    ? [...current.days].sort((a,b)=>b.date.localeCompare(a.date)).map(d=>({value:d.date,label:core.trDate(d.date)}))
    : core.periodList(current,mode);
  for(const o of options)$('periodValue').add(new Option(o.label,o.value));
  if(options.some(o=>o.value===prev))$('periodValue').value=prev;
}
// Görsel katman: yalnızca core.aggregateStats/forPeriod'dan gelen hazır toplamları kullanır.
// Canlı API okuma, dönem seçimi ve veri kaydetme mantığı değiştirilmez.
const DONUT_COLORS=['#237bea','#f04454','#ff9334','#ffc62c','#46b954','#10bcb1','#24a9d8','#754de3','#ae50d1','#ed54ab'];
const OTHERS_COLOR='#b4b7be';
const SVG_NS='http://www.w3.org/2000/svg';
const percentOf=(n,total)=>total?new Intl.NumberFormat('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1}).format(100*n/total)+'%':'0,0%';
function svgNode(tag,attrs){
  const el=document.createElementNS(SVG_NS,tag);
  for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));
  return el;
}
function renderDonut(chartId,legendId,rows,label){
  const chart=$(chartId),legend=$(legendId);chart.replaceChildren();legend.replaceChildren();
  const top=rows.slice(0,10);
  const other=rows.slice(10).reduce((sum,r)=>sum+r[1],0);
  const groups=top.map(([name,count],i)=>({name,count,color:DONUT_COLORS[i]}));
  if(other>0)groups.push({name:'Diğer',count:other,color:OTHERS_COLOR});
  const total=groups.reduce((sum,r)=>sum+r.count,0);
  const svg=svgNode('svg',{viewBox:'0 0 200 200',role:'img','aria-label':`${label}: ilk 10 ve diğerlerinin dağılımı`});
  const radius=74,circumference=2*Math.PI*radius;
  svg.append(svgNode('circle',{cx:100,cy:100,r:radius,fill:'none',stroke:'#ebedf0','stroke-width':31}));
  let offset=0;
  for(const group of groups){
    const len=total?group.count/total*circumference:0;
    const gap=Math.min(2.4,len*.12);
    const circle=svgNode('circle',{cx:100,cy:100,r:radius,fill:'none',stroke:group.color,'stroke-width':31,
      'stroke-dasharray':`${Math.max(.001,len-gap)} ${circumference}`,
      'stroke-dashoffset':`${-offset}`,transform:'rotate(-90 100 100)'});
    const title=svgNode('title',{});
    title.textContent=`${group.name}: ${number(group.count)} (${percentOf(group.count,total)} pasta payı)`;
    circle.append(title);svg.append(circle);offset+=len;
  }
  const count=svgNode('text',{x:100,y:101,'text-anchor':'middle',class:'donut-center-number'});
  count.textContent=number(rows.length);svg.append(count);
  const unit=svgNode('text',{x:100,y:122,'text-anchor':'middle',class:'donut-center-unit'});
  unit.textContent=label;svg.append(unit);
  chart.append(svg);
  if(!groups.length){const empty=document.createElement('p');empty.className='legend-empty';empty.textContent='Bu dönemde kayıt yok';legend.append(empty);return}
  for(const group of groups){
    const line=document.createElement('div');line.className='legend-line';
    const dot=document.createElement('span');dot.className='legend-dot';dot.style.background=group.color;
    const name=document.createElement('span');name.className='legend-name';name.textContent=group.name;name.title=group.name;
    const count=document.createElement('strong');count.className='legend-count';count.textContent=number(group.count);
    const ratio=document.createElement('span');ratio.className='legend-ratio';ratio.textContent=percentOf(group.count,total);
    line.append(dot,name,count,ratio);legend.append(line);
  }
}
function populateRemaining(table,rows,total){
  const dest=$(table);dest.replaceChildren();
  if(rows.length<=10){
    const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.className='empty-row';
    td.textContent=rows.length?'Bu dönemde ilk 10 dışındaki kayıt yok':'Bu dönemde kayıt yok';
    tr.append(td);dest.append(tr);return;
  }
  rows.slice(10).forEach(([name,count],i)=>{
    const tr=document.createElement('tr');
    for(const v of [String(i+11),name,number(count),`(${percent(count,total)})`]){
      const td=document.createElement('td');td.textContent=v;tr.append(td);
    }
    dest.append(tr);
  });
}
function render(){
  const mode=$('periodType').value;
  const chosen=$('periodValue').value;
  const s=mode==='day'
    ? core.aggregateStats(current.days.filter(d=>d.date===chosen))
    : core.forPeriod(current,mode,chosen);
  $('viewTitle').textContent=mode==='all'?'Tüm dönemler':$('periodValue').selectedOptions[0]?.textContent||'—';
  $('total').textContent=number(s.total);


  for(const [key,num,pct,bar] of [['positive','positive','positivePct','positiveBar'],['negative','negative','negativePct','negativeBar'],['pending','pending','pendingPct','pendingBar']]){
    $(num).textContent=number(s[key]);$(pct).textContent=percent(s[key],s.total);
    $(bar).style.width=s.total?`${Math.min(100,s[key]*100/s.total)}%`:'0%';
  }
  for(const [name,table,badge,suffix] of [['people','peopleRows','peopleCount','kişi'],['regions','regionsRows','regionsCount','bölge'],['budgets','budgetsRows','budgetsCount','bütçe']]){
    renderDonut(name+'Chart',name+'Legend',s[name],suffix.toLocaleUpperCase('tr-TR'));
    populateRemaining(table,s[name],s.total);
    $(badge).textContent=`${s[name].length} ${suffix}`;
  }
  $('sourceLabel').textContent=activeOrigin==='live'?'Canlı istatistikler':activeOrigin==='live-stale'?'Son alınan canlı veri':activeOrigin==='local'?'Yerel önizleme':activeOrigin==='published'?'GitHub yayın verisi':'Başlangıç raporu';
  const dt=current.generatedAt?new Date(current.generatedAt):null;
  $('updatedAt').textContent=dt&&!Number.isNaN(dt.valueOf())?`Son rapor: ${dt.toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})}`:'İlk hafta yüklü';
}
function applySnapshot(snapshot,source){
  current=core.normalizeSnapshot(snapshot);activeOrigin=source;
  labelPeriodType();render();
}
async function pollLive(){
  if(!LIVE_ENABLED)return;
  try{
    const response=await fetch(API_BASE+'/snapshot?ts='+Date.now(),{cache:'no-store'});
    if(!response.ok)throw Error('API HTTP '+response.status);
    const snapshot=core.normalizeSnapshot(await response.json());
    // Tarihsel 63 arayış yalnızca GitHub'daki sabit başlangıç raporunda da korunur.
    if(snapshot.historicalWeeks.reduce((sum,w)=>sum+w.total,0)!==63)throw Error('Tarihsel başlangıç verisi eksik');
    applySnapshot(snapshot,'live');
    $('alert').hidden=true;
  }catch(err){
    console.warn('Canlı rapor okunamadı; son geçerli veriler korunuyor:',err);
    if(activeOrigin==='live')activeOrigin='live-stale';
    render();
  }
}
async function load(){
  try{
    // GitHub depomuzda rapor.json ana klasörde. Eski data/ klasörlü dağıtımlar da desteklenir.
    let resp=await fetch('./rapor.json?t='+Date.now(),{cache:'no-store'});
    if(!resp.ok)resp=await fetch('./data/rapor.json?t='+Date.now(),{cache:'no-store'});
    if(resp.ok){published=core.normalizeSnapshot(await resp.json());activeOrigin='published'}
  }catch(e){/* file:// önizleme için gömülü başlangıç verisi kullanılır. */}
  if(LIVE_ENABLED){
    // Canlı sürümde eski tarayıcı önizlemesi sunucu sonuçlarını kesinlikle gölgelermez.
    applySnapshot(published,activeOrigin);
    const tools=document.querySelector('.tools');
    if(tools)tools.style.display='none'; // Otomatik bağlantı çalışırken manuel JSON arayüzü gizli.
    await pollLive();
    setInterval(pollLive,60*1000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)void pollLive()});
    return;
  }
  try{
    const raw=localStorage.getItem(STORE);
    if(raw){const local=core.normalizeSnapshot(JSON.parse(raw));
      if(Date.parse(local.generatedAt||'')>Date.parse(published.generatedAt||'')){
        applySnapshot(local,'local');return;
      }
    }
  }catch(e){console.warn('Yerel önizleme okunamadı',e)}
  applySnapshot(published,activeOrigin);
}
function downloadFile(filename,text){
  const blob=new Blob([text],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
async function onFile(event){
  const file=event.target.files?.[0];event.target.value='';
  // Önceki dosyanın düğmeleri yalnızca gerçek yeni seçimde görünür.
  pending=null;$('importReview').hidden=true;
  if(!file)return;
  if(file.size>25*1024*1024){notify('Dosya 25 MB sınırını aşıyor.','error');return}
  try{
    const json=JSON.parse(await file.text());
    const result=core.importExtension(current,json);
    if(result.summary.unchanged){notify(`Yeni hafta bulunamadı. Başlangıç dönemine ait ${result.summary.ignoredOld} kayıt atlandı. 26–31 Ekim haftasının 63 arayışı raporda zaten mevcut.`, 'error');return}
    pending=result;
    const s=result.summary;
    $('importTitle').textContent=`${file.name} · Yükleme kontrolü`;
    $('importSummary').textContent=`${number(s.imported)} yeni dönem kaydı değerlendirildi. Güncellenecek dönemler: ${s.changedWeeks.map(w=>w.label).join(', ')}.`;
    $('importDetail').textContent=`Başlangıç haftasıyla çakıştığı için atlanan: ${s.ignoredOld} · Hatalı tarihli: ${s.ignoredBad} · Dosya içi tekrar: ${s.duplicate}. Seçili haftaların önceki toplamları, bu JSON'daki tam kayıtlarla DEĞİŞTİRİLİR; toplanmaz.`;
    $('importReview').hidden=false;$('alert').hidden=true;
    $('importReview').scrollIntoView({behavior:'smooth',block:'nearest'});
  }catch(err){notify('İçe aktarılamadı: '+(err?.message||err),'error')}
}
function confirmImport(){
  if(!pending)return;
  try{
    localStorage.setItem(STORE,JSON.stringify(pending.snapshot));
    const changed=pending.summary.changedWeeks;
    applySnapshot(pending.snapshot,'local');
    $('periodType').value='week';labelPeriodType();
    if(changed.length)$('periodValue').value=changed[changed.length-1].start;
    render();
    notify('Bu cihazda veriler güncellendi. Herkesin görmesi için “Yayın JSON’unu indir” ile oluşan dosyayı GitHub deposunun ana klasöründeki rapor.json ile değiştir.');
    pending=null;$('importReview').hidden=true;
  }catch(e){notify('Yerel kayıt yapılamadı: '+e.message,'error')}
}
function downloadPublish(){
  downloadFile('rapor.json',core.toPublicDownload(current));
  notify('rapor.json indirildi. Herkesin görmesi için bu dosyayı GitHub deposunun ana klasöründeki rapor.json ile değiştir.');
}
$('periodType').addEventListener('change',()=>{labelPeriodType();render()});
$('periodValue').addEventListener('change',render);
$('fileInput').addEventListener('change',onFile);
$('confirmImport').addEventListener('click',confirmImport);
$('cancelImport').addEventListener('click',()=>{pending=null;$('importReview').hidden=true});
$('downloadPublic').addEventListener('click',downloadPublish);
load();
})();
