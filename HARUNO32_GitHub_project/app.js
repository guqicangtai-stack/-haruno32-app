const LOCAL_KEY="haruno32_records_v1";
const ENV_KEY="haruno32_environment_v1";
const DEFAULT_SUPABASE_URL="https://zlpfidmfeeknnfvrgyyp.supabase.co";
const DEFAULT_SUPABASE_KEY="";
const APP_VERSION="8.0.0";
function ensureDefaultConnection(){
  const savedUrl=(localStorage.getItem("haruno32_supabase_url")||"").trim();
  const savedKey=(localStorage.getItem("haruno32_supabase_key")||"").trim();
  if(!savedUrl) localStorage.setItem("haruno32_supabase_url",DEFAULT_SUPABASE_URL);
  // V5/V6に入っていた途中で切れたキーを自動削除します。
  if(savedKey==="sb_publishable_pswWBc9LE6xfvrvHCpstvg_IDMkfSi-") localStorage.removeItem("haruno32_supabase_key");
}
ensureDefaultConnection();

let selectedFiles=[], records=[], envImports=[], supabaseClient=null, activeRecord=null;
const $=id=>document.getElementById(id);

$("date").value=new Date().toISOString().slice(0,10);

function goToView(view){
  document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("active",x.dataset.view===view));
  document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id===view));
  window.scrollTo({top:0,behavior:"smooth"});
  renderAll();
}
document.querySelectorAll(".tabs button").forEach(btn=>btn.onclick=()=>goToView(btn.dataset.view));
document.querySelectorAll("[data-go]").forEach(btn=>btn.onclick=()=>goToView(btn.dataset.go));

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

function maskKey(key=""){
  if(!key)return "未設定";
  if(key.length<=16)return `${key.slice(0,5)}…（${key.length}文字）`;
  return `${key.slice(0,14)}…${key.slice(-6)}（${key.length}文字）`;
}
function showConnectionDiagnostic(message="",kind="info"){
  const box=$("connectionDiagnostic");
  if(!box)return;
  const s=settings();
  box.className=`diagnostic ${kind}`;
  box.innerHTML=`
    <strong>${message}</strong>
    <div>URL：${s.url||"未設定"}</div>
    <div>キー：${maskKey(s.key)}</div>
    <div>キー種別：${s.key.startsWith("sb_publishable_")?"Publishable key":s.key.startsWith("eyJ")?"Legacy anon key":"未判定"}</div>
  `;
}

async function connectionCheck(){
  const s=settings();
  if(!s.url)throw new Error("Supabase URLが未入力です");
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(s.url)){
    throw new Error("URLの形式が違います。Project URLだけを入力してください");
  }
  if(!s.key)throw new Error("anon keyが未入力です");
  if(!(s.key.startsWith("sb_publishable_") || s.key.startsWith("eyJ"))){
    throw new Error("キーの種類が違います。Legacy anon key（eyJで始まるキー）を推奨します");
  }
  if(s.key.endsWith("-")){
    throw new Error("キーが途中で切れています。Supabaseのコピーアイコンで全文をコピーしてください");
  }

  const headers={apikey:s.key};
  if(s.key.startsWith("eyJ")) headers.Authorization=`Bearer ${s.key}`;

  const response=await fetch(`${s.url}/rest/v1/daily_records?select=id&limit=1`,{headers});
  const body=await response.text();

  if(!response.ok){
    let detail=body;
    try{
      const parsed=JSON.parse(body);
      detail=parsed.message||parsed.msg||parsed.error||body;
    }catch(_){}
    throw new Error(`${response.status}: ${detail}`);
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
    b.classList.add("online");
    b.classList.remove("error");
    showConnectionDiagnostic("接続成功：スマホとPCで同じクラウドを使用します","success");
    if(showMessage)alert("接続成功：オンライン同期になりました");
    return true;
  }catch(e){
    b.textContent=`接続エラー｜v${APP_VERSION}`;
    b.classList.add("error");
    b.classList.remove("online");
    showConnectionDiagnostic(`接続失敗：${e.message}`,"error");
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

async function syncLocalRecordsToCloud(){
  if(!supabaseClient)throw new Error("オンライン接続されていません");
  const local=localLoad();
  if(!local.length)return {uploaded:0,skipped:0};

  let uploaded=0,skipped=0;
  for(const rec of local){
    const {data:existing,error:checkError}=await supabaseClient
      .from("daily_records").select("id").eq("id",rec.id).maybeSingle();
    if(checkError)throw checkError;
    if(existing){skipped++;continue;}

    const photoFiles=(rec.photos||[])
      .filter(p=>p.data)
      .map((p,i)=>dataURLtoFile(p.data,p.name||`photo${i+1}.jpg`,p.type));

    const {error:insertError}=await supabaseClient.from("daily_records").insert({
      id:rec.id,
      record_date:rec.record_date,
      house:rec.house,
      work:rec.work,
      vigor:rec.vigor,
      notes:rec.notes,
      analysis:rec.analysis||"",
      photos:[],
      created_at:rec.created_at||new Date().toISOString()
    });
    if(insertError)throw insertError;

    if(photoFiles.length){
      const photos=await uploadPhotos(rec.id,photoFiles);
      const {error:updateError}=await supabaseClient
        .from("daily_records").update({photos}).eq("id",rec.id);
      if(updateError)throw updateError;
    }
    uploaded++;
  }
  return {uploaded,skipped};
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

function report(r){
  const env=latestEnvironmentDay();
  const recent=[...records].sort((a,b)=>b.record_date.localeCompare(a.record_date)).slice(0,7);
  const avgRecent=recent.length?(recent.reduce((s,x)=>s+Number(x.vigor||0),0)/recent.length).toFixed(1):"—";
  const envText=env
    ? `\n【最新環境集計】\n日付：${env.date}\nハウス：${env.house}\n平均気温：${val(env.temp_avg,"℃")}\n最低/最高：${val(env.temp_min,"℃")} / ${val(env.temp_max,"℃")}\n平均湿度：${val(env.humidity_avg,"%")}\n平均CO₂：${val(env.co2_avg,"ppm")}\n概算飽差：${val(calcVpd(env.temp_avg,env.humidity_avg),"kPa")}\n`
    : "\n【最新環境集計】\n未取込\n";
  return `【HARUNO32 毎日の栽培記録】
日付：${r.record_date}
ハウス：${r.house}
今日の作業：${r.work}
草勢スコア：${r.vigor}/5
直近7件の平均草勢：${avgRecent}/5
気づき・相談：${r.notes}
写真：${(r.photos||[]).length}枚
${envText}
グリンへ：
写真と記録を読み取り、HARUNO32の過去データ、32t目標、環境データを照合してください。
施肥はECだけで決めず、窒素量・硝酸態窒素・根域・気温・日射・草勢を合わせて評価してください。

次の形式で返してください。
1. 今日の状態評価
2. 写真から読み取れること
3. 環境面の評価
4. 根・灌水・施肥の注意点
5. 明日の優先作業
6. 32t目標に対する先行指標
7. 追加で確認したいこと
8. ダッシュボード保存用要約`;
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

function formatDateJP(value){
  const d=new Date(value);
  return Number.isNaN(d.getTime())?String(value):`${d.getMonth()+1}/${d.getDate()}`;
}
function svgLineChart(points,{minY=1,maxY=5,label="草勢"}={}){
  if(!points.length)return '<div class="empty">グラフ用の記録がありません。</div>';
  const width=760,height=230,padL=46,padR=20,padT=20,padB=42;
  const innerW=width-padL-padR,innerH=height-padT-padB;
  const x=i=>padL+(points.length===1?innerW/2:(i/(points.length-1))*innerW);
  const y=v=>padT+((maxY-v)/(maxY-minY))*innerH;
  const path=points.map((p,i)=>`${i?"L":"M"} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const grid=[minY,minY+1,minY+2,minY+3,minY+4].filter(v=>v<=maxY).map(v=>
    `<line x1="${padL}" y1="${y(v)}" x2="${width-padR}" y2="${y(v)}" class="chart-grid"/>
     <text x="${padL-10}" y="${y(v)+4}" text-anchor="end" class="chart-label">${v}</text>`
  ).join("");
  const dots=points.map((p,i)=>
    `<circle cx="${x(i)}" cy="${y(p.value)}" r="5" class="chart-dot">
      <title>${p.date}：${p.value}</title>
    </circle>`
  ).join("");
  const labels=points.map((p,i)=>{
    const show=points.length<=8 || i===0 || i===points.length-1 || i%Math.ceil(points.length/6)===0;
    return show?`<text x="${x(i)}" y="${height-14}" text-anchor="middle" class="chart-label">${formatDateJP(p.date)}</text>`:"";
  }).join("");
  return `<div class="chart-wrap"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}推移">
    ${grid}<path d="${path}" class="chart-line"/>${dots}${labels}
  </svg></div>`;
}
function latestEnvironmentDay(){
  const latest=envImports[0];
  return latest?.days?.[0] ? {house:latest.house,...latest.days[0]} : null;
}
function calcVpd(temp,humidity){
  if(!Number.isFinite(temp)||!Number.isFinite(humidity))return null;
  const es=0.6108*Math.exp((17.27*temp)/(temp+237.3));
  return Number((es*(1-humidity/100)).toFixed(2));
}
function makeTodayBrief(){
  if(!records.length)return {
    level:"info",
    title:"まず1件、今日の記録を保存しましょう",
    items:["写真は①代表株、②気になる箇所の2枚が標準です。"]
  };
  const r=records[0], env=latestEnvironmentDay();
  const items=[];
  let level="good";
  if(r.vigor<=2){items.push("草勢が弱めです。根域の水分、根傷み、低温・日照不足を優先確認。");level="warn";}
  else if(r.vigor>=5){items.push("草勢がかなり強めです。過繁茂、着果負担との釣り合い、窒素過多に注意。");level="warn";}
  else items.push("草勢は大きく崩れていません。前日との差を写真で追いましょう。");
  if(!(r.photos||[]).length){items.push("写真が未登録です。次回は標準2枚を残すと比較精度が上がります。");level="warn";}
  if(!r.analysis)items.push("未分析です。「グリンに送る」から今日の診断を作成できます。");
  if(env){
    const vpd=calcVpd(env.temp_avg,env.humidity_avg);
    if(vpd!==null){
      if(vpd<0.4){items.push(`平均飽差は約${vpd}kPa。湿り過ぎ・結露リスクを確認。`);level="warn";}
      else if(vpd>1.5){items.push(`平均飽差は約${vpd}kPa。乾燥・吸水負担に注意。`);level="warn";}
      else items.push(`平均飽差は約${vpd}kPa。極端な乾湿ではありません。`);
    }
  }else{
    items.push("SAWACHIデータ未取込です。9月19日以降、CSVを取り込むと環境評価を重ねられます。");
  }
  return {level,title:`${r.record_date}｜${r.house} の確認`,items};
}
function weeklySummaryText(){
  const last=[...records].sort((a,b)=>b.record_date.localeCompare(a.record_date)).slice(0,7);
  if(!last.length)return "まだ記録がありません。";
  const avgV=(last.reduce((s,r)=>s+Number(r.vigor||0),0)/last.length).toFixed(1);
  const analyzed=last.filter(r=>r.analysis).length;
  const photos=last.reduce((s,r)=>s+(r.photos||[]).length,0);
  const houses=[...new Set(last.map(r=>r.house))].join("・");
  return `直近${last.length}件｜平均草勢 ${avgV}/5｜分析済み ${analyzed}件｜写真 ${photos}枚｜対象 ${houses}`;
}
function renderDashboardPlus(){
  const trend=[...records].sort((a,b)=>a.record_date.localeCompare(b.record_date)).slice(-21)
    .map(r=>({date:r.record_date,value:Number(r.vigor)})).filter(p=>Number.isFinite(p.value));
  $("vigorChart").innerHTML=svgLineChart(trend);
  const brief=makeTodayBrief();
  $("todayBrief").className=`brief ${brief.level}`;
  $("todayBrief").innerHTML=`<h3>${esc(brief.title)}</h3><ul>${brief.items.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`;
  $("weeklySummary").textContent=weeklySummaryText();
}
function csvEscape(value){
  const s=String(value??"");
  return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
}
function exportRecordsCsv(){
  const headers=["日付","ハウス","作業","草勢","気づき・相談","写真枚数","分析"];
  const rows=records.map(r=>[
    r.record_date,r.house,r.work,r.vigor,r.notes,(r.photos||[]).length,r.analysis||""
  ]);
  const csv="\uFEFF"+[headers,...rows].map(row=>row.map(csvEscape).join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`HARUNO32_records_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}


function sameHousePrevious(latest){
  return records.find(r=>r.id!==latest.id && r.house===latest.house) || null;
}
function compactRecordHTML(r){
  if(!r)return '<div class="empty">まだ記録がありません。</div>';
  return `<div class="compact-record">
    <strong>${esc(r.record_date)}｜${esc(r.house)}</strong>
    <span class="vigor-pill">草勢 ${r.vigor}/5</span>
    <p>${esc(r.work)}</p>
    <p class="meta">${esc(r.notes)}</p>
    <button class="secondary compact" data-home-share="${r.id}">グリンに送る</button>
  </div>`;
}
function priorityData(){
  if(!records.length){
    return {level:"start",label:"記録開始",items:[
      "今日の作業と草勢を記録する",
      "代表株と気になる箇所の写真を2枚残す",
      "記録後にグリンへ送って分析を保存する"
    ]};
  }
  const r=records[0], env=latestEnvironmentDay(), items=[];
  let level="normal",label="通常確認";
  if(Number(r.vigor)<=2){
    level="alert";label="要確認";
    items.push("草勢が弱め。根域の水分、根傷み、低温、日照不足を先に確認する");
  }else if(Number(r.vigor)>=5){
    level="alert";label="要確認";
    items.push("草勢が強め。過繁茂、着果負担との釣り合い、窒素過多を確認する");
  }else{
    items.push("前回からの草勢変化を代表株写真で確認する");
  }
  if((r.photos||[]).length<2){
    level="alert";label="写真不足";
    items.push("今日は標準写真2枚を残す");
  }else{
    items.push("最新写真と前回写真を比較し、生長点・葉色・節間を見る");
  }
  if(!r.analysis)items.push("最新記録をグリンへ送り、分析結果を保存する");
  else items.push("前回のグリン分析から、今日実行する項目を一つ選ぶ");
  if(env){
    const vpd=calcVpd(env.temp_avg,env.humidity_avg);
    if(vpd!==null && vpd<0.4){
      level="alert";label="環境注意";
      items.push(`概算飽差 ${vpd}kPa。結露・多湿・病害リスクを確認する`);
    }else if(vpd!==null && vpd>1.5){
      level="alert";label="環境注意";
      items.push(`概算飽差 ${vpd}kPa。乾燥と吸水負担を確認する`);
    }else{
      items.push("SAWACHIの最新推移を確認し、灌水判断と照合する");
    }
  }else{
    items.push("SAWACHI CSVが入るまでは、気温・湿度・日射の気づきを記録欄に残す");
  }
  return {level,label,items:items.slice(0,4)};
}
function photoPanel(record,title){
  const photos=(record?.photos||[]).slice(0,2);
  return `<div class="compare-column">
    <div class="compare-title"><strong>${title}</strong><span>${record?`${esc(record.record_date)}｜${esc(record.house)}`:"—"}</span></div>
    ${record?`<div class="compare-photos">
      ${[0,1].map(i=>photos[i]
        ? `<figure><img class="zoom-photo" src="${photoSrc(photos[i])}" alt="${i===0?"代表株":"気になる箇所"}"><figcaption>${i===0?"① 代表株":"② 気になる箇所"}</figcaption></figure>`
        : `<div class="photo-placeholder">${i===0?"① 代表株":"② 気になる箇所"}<br>未登録</div>`).join("")}
    </div>`:'<div class="empty">比較対象がありません。</div>'}
  </div>`;
}
function renderPhotoComparison(){
  const latest=records[0];
  if(!latest){
    $("photoComparison").innerHTML='<div class="empty">記録と写真を保存すると、ここに比較表示されます。</div>';
    return;
  }
  const previous=sameHousePrevious(latest);
  $("photoComparison").innerHTML=`<div class="photo-compare-grid">${photoPanel(latest,"最新")}${photoPanel(previous,"前回")}</div>`;
  document.querySelectorAll(".zoom-photo").forEach(img=>img.onclick=()=>window.open(img.src,"_blank","noopener"));
}
function foundationData(){
  const recent=records.slice(0,14);
  const checks=[
    {label:"日次記録",value:Math.min(100,Math.round(recent.length/7*100)),detail:`直近 ${recent.length}件`},
    {label:"標準写真2枚",value:recent.length?Math.round(recent.filter(r=>(r.photos||[]).length>=2).length/recent.length*100):0,detail:"代表株＋気になる箇所"},
    {label:"グリン分析",value:recent.length?Math.round(recent.filter(r=>r.analysis).length/recent.length*100):0,detail:"分析保存率"},
    {label:"環境データ",value:envImports.length?100:0,detail:envImports.length?`${envImports.length}回取込済み`:"未取込"}
  ];
  return {checks,score:Math.round(checks.reduce((s,x)=>s+x.value,0)/checks.length)};
}
function renderHome(){
  const d=new Date();
  $("homeDate").textContent=`${d.getMonth()+1}月${d.getDate()}日　今日の仕事`;
  const p=priorityData();
  $("priorityLevel").className=`priority-level ${p.level}`;
  $("priorityLevel").textContent=p.label;
  $("homePriority").innerHTML=`<ol>${p.items.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>`;
  $("homeLatest").innerHTML=compactRecordHTML(records[0]);
  $("homeSyncState").innerHTML=supabaseClient
    ? '<span class="online-dot"></span>クラウド同期中'
    : '<span class="offline-dot"></span>端末内保存';
  renderPhotoComparison();
  const f=foundationData();
  $("foundationScore").textContent=`${f.score}%`;
  $("foundationBars").innerHTML=f.checks.map(x=>`<div class="foundation-row">
    <div class="foundation-label"><strong>${esc(x.label)}</strong><span>${esc(x.detail)}</span></div>
    <div class="progress"><i style="width:${x.value}%"></i></div>
    <b>${x.value}%</b>
  </div>`).join("");
  document.querySelectorAll("[data-home-share]").forEach(b=>b.onclick=()=>openShare(records.find(r=>r.id===b.dataset.homeShare)));
}
function filteredRecords(){
  const house=$("historyHouse")?.value||"";
  const q=($("historySearch")?.value||"").trim().toLowerCase();
  return records.filter(r=>{
    const houseOk=!house||r.house===house;
    const text=[r.record_date,r.house,r.work,r.notes,r.analysis].join(" ").toLowerCase();
    return houseOk&&(!q||text.includes(q));
  });
}
function renderHistory(){
  const shown=filteredRecords();
  $("historyCount").textContent=`${shown.length}件を表示（全${records.length}件）`;
  $("recordList").innerHTML=shown.length?shown.map(r=>recordHTML(r,true)).join(""):'<div class="empty">条件に合う記録がありません。</div>';
}

function renderAll(){
  renderEnvironment();
  renderDashboardPlus();
  renderHome();
  $("analysisRecord").innerHTML=records.map(r=>`<option value="${r.id}">${r.record_date}｜${esc(r.house)}</option>`).join("")||"<option>記録なし</option>";
  const analyzed=records.filter(r=>r.analysis).length,avg=records.length?(records.reduce((s,r)=>s+Number(r.vigor),0)/records.length).toFixed(1):"-";
  $("metrics").innerHTML=[
    ["総記録数",records.length],["分析済み",analyzed],["平均草勢",avg],["写真総数",records.reduce((s,r)=>s+(r.photos||[]).length,0)]
  ].map(x=>`<div class="metric"><div class="label">${x[0]}</div><div class="value">${x[1]}</div></div>`).join("");
  $("latest").innerHTML=records[0]?recordHTML(records[0],false):'<div class="empty">まだ記録がありません。</div>';
  renderHistory();
  document.querySelectorAll("[data-share]").forEach(b=>b.onclick=()=>openShare(records.find(r=>r.id===b.dataset.share)));
}
function recordHTML(r,actions){
  const thumbs=(r.photos||[]).map(p=>`<img src="${photoSrc(p)}" alt="栽培写真">`).join("");
  return `<article class="record"><div class="record-head"><div><strong>${r.record_date}｜${esc(r.house)}</strong><div class="meta">草勢 ${r.vigor}/5｜写真 ${(r.photos||[]).length}枚</div></div><span class="badge">${r.analysis?"分析済み":"未分析"}</span></div><p>${esc(r.work)}</p><p class="meta">${esc(r.notes)}</p>${thumbs?`<div class="thumbs">${thumbs}</div>`:""}${r.analysis?`<div class="analysis">${esc(r.analysis)}</div>`:""}${actions?`<div class="record-actions"><button class="primary" data-share="${r.id}">グリンに送る</button></div>`:""}</article>`;
}
$("refreshBtn").onclick=async()=>{await loadRecords();renderAll()};
$("historyHouse").onchange=renderHistory;
$("historySearch").oninput=renderHistory;
$("saveSettings").onclick=async()=>{
  const url=normalizeSupabaseUrl($("supabaseUrl").value);
  const key=$("supabaseKey").value.replace(/\s+/g,"").trim();
  if(url) localStorage.setItem("haruno32_supabase_url",url);
  else localStorage.removeItem("haruno32_supabase_url");
  if(key) localStorage.setItem("haruno32_supabase_key",key);
  else localStorage.removeItem("haruno32_supabase_key");
  $("supabaseKey").value=key;
  initSupabase();
  await updateBadge(true);
};
$("testConnection").onclick=async()=>{
  initSupabase();
  const ok=await updateBadge(true);
  if(ok){await loadRecords();renderAll();}
};
$("syncLocalBtn").onclick=async()=>{
  const btn=$("syncLocalBtn");
  btn.disabled=true;btn.textContent="同期中…";
  try{
    initSupabase();
    const ok=await updateBadge(false);
    if(!ok)throw new Error("先に接続を確認してください");
    const result=await syncLocalRecordsToCloud();
    await loadRecords();renderAll();
    alert(`同期完了：${result.uploaded}件をクラウドへ保存、${result.skipped}件は既に保存済みです`);
  }catch(e){
    alert(`同期できませんでした\n\n${e.message}`);
  }finally{
    btn.disabled=false;btn.textContent="端末内の記録をクラウドへ同期";
  }
};
$("exportCsvBtn").onclick=exportRecordsCsv;
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
(async()=>{
  initSupabase();
  const ok=await updateBadge(false);
  if(ok) await loadRecords();
  else records=localLoad().sort((a,b)=>(b.created_at||"").localeCompare(a.created_at||""));
  renderAll();
})();