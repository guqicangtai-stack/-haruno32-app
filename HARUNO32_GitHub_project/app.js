const LOCAL_KEY="haruno32_records_v1";
const ENV_KEY="haruno32_environment_v1";
const DEFAULT_SUPABASE_URL="https://zlpfidmfeeknnfvrgyyp.supabase.co";
const DEFAULT_SUPABASE_KEY="sb_publishable_pswWBc9LE6xfvrvHCpstvg_IDMkfSi-";
const APP_VERSION="5.0.0";
let selectedFiles=[], records=[], envImports=[], supabaseClient=null, activeRecord=null;
const $=id=>document.getElementById(id);

$("date").value=new Date().toISOString().slice(0,10);

document.querySelectorAll(".tabs button").forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active"); $(btn.dataset.view).classList.add("active"); renderAll();
});

function normalizeSupabaseUrl(value=""){
  return value.trim().replace(/\/+$/,"").replace(/\/rest\/v1$/,"");
}
function settings(){
  const savedUrl=localStorage.getItem("haruno32_supabase_url");
  const savedKey=localStorage.getItem("haruno32_supabase_key");
  return {
    url:normalizeSupabaseUrl(savedUrl||DEFAULT_SUPABASE_URL),
    key:(savedKey||DEFAULT_SUPABASE_KEY).trim()
  };
}
function initSupabase(){
  const s=settings();
  try{
    supabaseClient=(s.url&&s.key&&window.supabase)
      ? window.supabase.createClient(s.url,s.key,{auth:{persistSession:false,autoRefreshToken:false}})
      : null;
  }catch(e){
    supabaseClient=null;
  }
  $("supabaseUrl").value=s.url;
  $("supabaseKey").value=s.key;
  updateBadge();
}
async function connectionCheck(){
  const s=settings();
  if(!s.url)throw new Error("Supabase URLが未入力です");
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(s.url)){
    throw new Error("URLの形式が違います。末尾の /rest/v1 は削除してください");
  }
  if(!s.key || !(s.key.startsWith("sb_publishable_") || s.key.startsWith("eyJ"))){
    throw new Error("Publishable keyが途中で切れているか、種類が違います");
  }
  const response=await fetch(`${s.url}/rest/v1/daily_records?select=id&limit=1`,{
    headers:{apikey:s.key,Authorization:`Bearer ${s.key}`}
  });
  const body=await response.text();
  if(!response.ok){
    let message=body;
    try{
      const parsed=JSON.parse(body);
      message=parsed.message||parsed.msg||parsed.error||body;
    }catch{}
    throw new Error(`${response.status}: ${message}`);
  }
  return true;
}
async function updateBadge(showMessage=false){
  const b=$("syncBadge");
  if(!supabaseClient){
    b.textContent=`端末内保存｜v${APP_VERSION}`;
    if(showMessage)alert("SupabaseのURLとPublishable keyを入力して保存してください");
    return false;
  }
  try{
    await connectionCheck();
    b.textContent=`オンライン同期｜v${APP_VERSION}`;
    if(showMessage)alert("接続成功：オンライン同期になりました");
    return true;
  }catch(e){
    b.textContent=`接続エラー｜v${APP_VERSION}`;
    if(showMessage)alert(`接続できませんでした\n\n${e.message}`);
    const fs=$("formStatus");
    if(fs){fs.textContent=`接続エラー：${e.message}`;fs.classList.add("show");}
    return false;
  }
}
function localLoad(){try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||"[]")}catch{return[]}}
function localSave(){localStorage.setItem(LOCAL_KEY,JSON.stringify(records))}
function fileToDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
function dataURLtoFile(data,name,type){const [h,b]=data.split(",");const bytes=atob(b);const a=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)a[i]=bytes.charCodeAt(i);return new File([a],name,{type:type||h.match(/:(.*?);/)[1]})}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

async function loadRecords(){
  if(!supabaseClient){records=localLoad().sort((a,b)=>b.created_at.localeCompare(a.created_at));return}
  const {data,error}=await supabaseClient.from("daily_records").select("*").order("created_at",{ascending:false});
  if(error){records=localLoad();return}
  records=data||[];
}
async function uploadPhotos(recordId,files){
  const paths=[];
  for(let i=0;i<files.length;i++){
    const f=files[i], ext=(f.name.split(".").pop()||"jpg").toLowerCase();
    const path=`${recordId}/${Date.now()}_${i}.${ext}`;
    const {error}=await supabaseClient.storage.from("daily-photos").upload(path,f,{upsert:false});
    if(error)throw error;
    const {data}=supabaseClient.storage.from("daily-photos").getPublicUrl(path);
    paths.push({name:f.name,type:f.type,url:data.publicUrl,path});
  }
  return paths;
}
async function saveRecord(rec,files){
  if(!supabaseClient){
    rec.photos=await Promise.all(files.map(async f=>({name:f.name,type:f.type,data:await fileToDataURL(f)})));
    records.unshift(rec);localSave();return;
  }
  const {data,error}=await supabaseClient.from("daily_records").insert({
    id:rec.id,record_date:rec.record_date,house:rec.house,work:rec.work,vigor:rec.vigor,notes:rec.notes,analysis:"",photos:[]
  }).select().single();
  if(error)throw error;
  const photos=await uploadPhotos(rec.id,files);
  const {error:updateError}=await supabaseClient.from("daily_records").update({photos}).eq("id",rec.id);
  if(updateError)throw updateError;
}
$("photos").onchange=e=>{selectedFiles.push(...Array.from(e.target.files));e.target.value="";renderPreview()};
function renderPreview(){
  $("preview").innerHTML="";
  selectedFiles.forEach((f,i)=>{
    const d=document.createElement("div");d.className="preview-item";
    const img=document.createElement("img");img.src=URL.createObjectURL(f);
    const x=document.createElement("button");x.type="button";x.textContent="×";x.onclick=()=>{selectedFiles.splice(i,1);renderPreview()};
    d.append(img,x);$("preview").appendChild(d);
  });
}
$("recordForm").onsubmit=async e=>{
  e.preventDefault();status("保存中…");
  if(selectedFiles.length!==2){
    const proceed=confirm(`写真は毎日2枚が標準です。現在 ${selectedFiles.length}枚です。\nこのまま保存しますか？`);
    if(!proceed){status("保存を中止しました");return;}
  }
  try{
    const vigor=document.querySelector('input[name="vigor"]:checked')?.value;
    const rec={id:crypto.randomUUID(),record_date:$("date").value,house:$("house").value,work:$("work").value.trim(),vigor:Number(vigor),notes:$("notes").value.trim(),analysis:"",photos:[],created_at:new Date().toISOString()};
    await saveRecord(rec,selectedFiles);e.target.reset();selectedFiles=[];renderPreview();$("date").value=new Date().toISOString().slice(0,10);await loadRecords();renderAll();status(supabaseClient?"クラウドへ保存しました":"端末内へ保存しました");
  }catch(err){status("保存できませんでした："+err.message)}
};
function status(t){$("formStatus").textContent=t;$("formStatus").classList.add("show");setTimeout(()=>$("formStatus").classList.remove("show"),4000)}

function report(r){return `【HARUNO32 毎日の栽培記録】
日付：${r.record_date}
ハウス：${r.house}
今日の作業：${r.work}
草勢スコア：${r.vigor}/5
気づき・相談：${r.notes}
写真：${(r.photos||[]).length}枚

グリンへ：
写真と5項目を読み取り、HARUNO32の過去データ、32t目標、当日の環境データが利用できる場合はそれも照合してください。

次の形式で返してください。
1. 今日の状態評価
2. 写真から読み取れること
3. 環境面の評価
4. 注意点
5. 明日の優先作業
6. 追加で確認したいこと
7. ダッシュボード保存用要約`;
}
function recordFiles(r){
  return (r.photos||[]).filter(p=>p.data).map((p,i)=>dataURLtoFile(p.data,p.name||`photo${i+1}.jpg`,p.type));
}
function openShare(r){activeRecord=r;$("shareText").textContent=report(r);$("shareDialog").showModal()}
$("diagnoseLatest").onclick=()=>records[0]?openShare(records[0]):status("まだ記録がありません");
$("copyText").onclick=async()=>{await navigator.clipboard.writeText(report(activeRecord));$("copyText").textContent="コピーしました";setTimeout(()=>$("copyText").textContent="文章をコピー",1400)};
$("shareAll").onclick=async()=>{
  const files=recordFiles(activeRecord);
  try{
    if(navigator.share){await navigator.share({title:"HARUNO32",text:report(activeRecord),files})}
    else throw new Error();
  }catch(e){if(e.name!=="AbortError"){await navigator.clipboard.writeText(report(activeRecord));alert("文章をコピーしました。写真はこのチャットへ添付してください。")}}
};
$("closeDialog").onclick=()=>$("shareDialog").close();

$("saveAnalysis").onclick=async()=>{
  const id=$("analysisRecord").value,text=$("analysisText").value.trim();if(!id||!text)return;
  if(supabaseClient){const {error}=await supabaseClient.from("daily_records").update({analysis:text}).eq("id",id);if(error)return alert(error.message)}
  else{const r=records.find(x=>x.id===id);if(r)r.analysis=text;localSave()}
  $("analysisText").value="";await loadRecords();renderAll();alert("分析を保存しました");
};

function photoSrc(p){return p.url||p.data||""}
function renderAll(){
  renderEnvironment();
  $("analysisRecord").innerHTML=records.map(r=>`<option value="${r.id}">${r.record_date}｜${esc(r.house)}</option>`).join("")||"<option>記録なし</option>";
  const analyzed=records.filter(r=>r.analysis).length,avg=records.length?(records.reduce((s,r)=>s+Number(r.vigor),0)/records.length).toFixed(1):"-";
  $("metrics").innerHTML=[
    ["総記録数",records.length],["分析済み",analyzed],["平均草勢",avg],["写真総数",records.reduce((s,r)=>s+(r.photos||[]).length,0)]
  ].map(x=>`<div class="metric"><div class="label">${x[0]}</div><div class="value">${x[1]}</div></div>`).join("");
  $("latest").innerHTML=records[0]?recordHTML(records[0],false):'<div class="empty">まだ記録がありません。</div>';
  $("recordList").innerHTML=records.length?records.map(r=>recordHTML(r,true)).join(""):'<div class="empty">まだ記録がありません。</div>';
  document.querySelectorAll("[data-share]").forEach(b=>b.onclick=()=>openShare(records.find(r=>r.id===b.dataset.share)));
}
function recordHTML(r,actions){
  const thumbs=(r.photos||[]).map(p=>`<img src="${photoSrc(p)}" alt="栽培写真">`).join("");
  return `<article class="record"><div class="record-head"><div><strong>${r.record_date}｜${esc(r.house)}</strong><div class="meta">草勢 ${r.vigor}/5｜写真 ${(r.photos||[]).length}枚</div></div><span class="badge">${r.analysis?"分析済み":"未分析"}</span></div><p>${esc(r.work)}</p><p class="meta">${esc(r.notes)}</p>${thumbs?`<div class="thumbs">${thumbs}</div>`:""}${r.analysis?`<div class="analysis">${esc(r.analysis)}</div>`:""}${actions?`<div class="record-actions"><button class="primary" data-share="${r.id}">グリンに送る</button></div>`:""}</article>`;
}
$("refreshBtn").onclick=async()=>{await loadRecords();renderAll()};
$("saveSettings").onclick=async()=>{
  const url=normalizeSupabaseUrl($("supabaseUrl").value);
  const key=$("supabaseKey").value.trim();
  if(url) localStorage.setItem("haruno32_supabase_url",url);
  else localStorage.removeItem("haruno32_supabase_url");
  if(key) localStorage.setItem("haruno32_supabase_key",key);
  else localStorage.removeItem("haruno32_supabase_key");
  initSupabase();
  await updateBadge(true);
};
$("testConnection").onclick=async()=>{
  initSupabase();
  await updateBadge(true);
};
$("exportBtn").onclick=()=>{
  const blob=new Blob([JSON.stringify({version:1,exported_at:new Date().toISOString(),records},null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`HARUNO32_${new Date().toISOString().slice(0,10)}.json`;a.click();
};
$("importFile").onchange=async e=>{const f=e.target.files[0];if(!f)return;const obj=JSON.parse(await f.text());records=obj.records||[];localSave();renderAll();alert("読み込みました")};

if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});

function envLoad(){try{return JSON.parse(localStorage.getItem(ENV_KEY)||"[]")}catch{return[]}}
function envSave(){localStorage.setItem(ENV_KEY,JSON.stringify(envImports))}

function parseCsvLine(line,delimiter){
  const out=[];let cur="",quoted=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){
      if(quoted&&line[i+1]==='"'){cur+='"';i++}else quoted=!quoted;
    }else if(ch===delimiter&&!quoted){out.push(cur.trim());cur=""}
    else cur+=ch;
  }
  out.push(cur.trim());return out;
}
function normalizeHeader(s){
  return String(s||"").toLowerCase().replace(/\s+/g,"").replace(/[()（）\[\]【】]/g,"");
}
function findColumn(headers,aliases){
  const hs=headers.map(normalizeHeader);
  return hs.findIndex(h=>aliases.some(a=>h.includes(normalizeHeader(a))));
}
function toNumber(v){
  const n=Number(String(v??"").replace(/,/g,"").replace(/[^\d.+-]/g,""));
  return Number.isFinite(n)?n:null;
}
function avg(values){const a=values.filter(Number.isFinite);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null}
function min(values){const a=values.filter(Number.isFinite);return a.length?Math.min(...a):null}
function max(values){const a=values.filter(Number.isFinite);return a.length?Math.max(...a):null}
function round(v,d=1){return Number.isFinite(v)?Number(v.toFixed(d)):null}
function detectDate(v){
  if(!v)return null;
  const s=String(v).trim().replace(/\./g,"/").replace(/-/g,"/");
  const d=new Date(s);
  return Number.isNaN(d.getTime())?null:d;
}
function parseSawachiCsv(text,house,fileName){
  text=text.replace(/^\uFEFF/,"").replace(/\r\n/g,"\n").replace(/\r/g,"\n");
  const lines=text.split("\n").filter(x=>x.trim());
  if(lines.length<2)throw new Error("CSVにデータ行がありません");
  const delimiter=(lines[0].split("\t").length>lines[0].split(",").length)?"\t":",";
  const headers=parseCsvLine(lines[0],delimiter);
  const idx={
    datetime:findColumn(headers,["日時","年月日時分","測定日時","date","time","時刻"]),
    temp:findColumn(headers,["気温","温度","temperature","temp"]),
    humidity:findColumn(headers,["相対湿度","湿度","humidity","rh"]),
    co2:findColumn(headers,["co2濃度","二酸化炭素","co2"]),
    solar:findColumn(headers,["日射量","日射","solar","radiation"])
  };
  if(idx.datetime<0)throw new Error("日時の列を自動判定できませんでした");
  const rows=lines.slice(1).map(line=>parseCsvLine(line,delimiter)).map(cols=>({
    at:detectDate(cols[idx.datetime]),
    temp:idx.temp>=0?toNumber(cols[idx.temp]):null,
    humidity:idx.humidity>=0?toNumber(cols[idx.humidity]):null,
    co2:idx.co2>=0?toNumber(cols[idx.co2]):null,
    solar:idx.solar>=0?toNumber(cols[idx.solar]):null
  })).filter(r=>r.at);
  if(!rows.length)throw new Error("有効な日時データを読み取れませんでした");
  const byDate={};
  rows.forEach(r=>{
    const key=r.at.toLocaleDateString("sv-SE");
    (byDate[key]||(byDate[key]=[])).push(r);
  });
  const days=Object.entries(byDate).map(([date,rs])=>({
    date,
    count:rs.length,
    temp_avg:round(avg(rs.map(r=>r.temp))),
    temp_min:round(min(rs.map(r=>r.temp))),
    temp_max:round(max(rs.map(r=>r.temp))),
    humidity_avg:round(avg(rs.map(r=>r.humidity))),
    co2_avg:round(avg(rs.map(r=>r.co2)),0),
    solar_avg:round(avg(rs.map(r=>r.solar))),
    solar_sum:round(rs.map(r=>r.solar).filter(Number.isFinite).reduce((s,v)=>s+v,0))
  })).sort((a,b)=>b.date.localeCompare(a.date));
  return {
    id:crypto.randomUUID(),house,file_name:fileName,imported_at:new Date().toISOString(),
    headers,detected:idx,row_count:rows.length,days
  };
}
function val(v,suffix=""){return v===null||v===undefined?"—":`${v}${suffix}`}
function renderEnvironment(){
  const latest=envImports[0];
  $("envSummary").innerHTML=latest&&latest.days.length?(()=>{
    const d=latest.days[0];
    return `<div class="env-head"><strong>${esc(d.date)}｜${esc(latest.house)}</strong><span class="badge">${latest.row_count}件</span></div>
      <div class="env-grid">
        <div><span>平均気温</span><b>${val(d.temp_avg,"℃")}</b></div>
        <div><span>最低 / 最高</span><b>${val(d.temp_min,"℃")} / ${val(d.temp_max,"℃")}</b></div>
        <div><span>平均湿度</span><b>${val(d.humidity_avg,"%")}</b></div>
        <div><span>平均CO₂</span><b>${val(d.co2_avg,"ppm")}</b></div>
        <div><span>平均日射</span><b>${val(d.solar_avg)}</b></div>
        <div><span>日射合計</span><b>${val(d.solar_sum)}</b></div>
      </div>`;
  })():'<div class="empty">まだCSVを取り込んでいません。</div>';
  $("envHistory").innerHTML=envImports.length?envImports.map(x=>`
    <article class="record">
      <div class="record-head"><div><strong>${esc(x.file_name)}</strong><div class="meta">${new Date(x.imported_at).toLocaleString("ja-JP")}｜${esc(x.house)}</div></div><span class="badge">${x.row_count}行</span></div>
      <p class="meta">${x.days.length}日分を集計</p>
    </article>`).join(""):'<div class="empty">取込履歴はありません。</div>';
}
$("sawachiCsv").onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  const s=$("csvStatus");s.textContent="CSVを解析中…";s.classList.add("show");
  try{
    const item=parseSawachiCsv(await file.text(),$("envHouse").value,file.name);
    envImports.unshift(item);envSave();renderEnvironment();
    s.textContent=`${item.row_count}行・${item.days.length}日分を取り込みました`;
  }catch(err){s.textContent="取り込めませんでした："+err.message}
  e.target.value="";
};
$("clearEnv").onclick=()=>{
  if(confirm("取り込んだ環境データをすべて消去しますか？")){
    envImports=[];envSave();renderEnvironment();
  }
};


envImports=envLoad();
initSupabase();loadRecords().then(renderAll);