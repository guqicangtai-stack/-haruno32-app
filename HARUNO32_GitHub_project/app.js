const LOCAL_KEY="haruno32_records_v1";
const ENV_KEY="haruno32_environment_v1";
const OPS_KEY="haruno32_operations_v1";
const DEFAULT_SUPABASE_URL="https://zlpfidmfeeknnfvrgyyp.supabase.co";
const DEFAULT_SUPABASE_KEY="";
const APP_VERSION="15.0.0";
const PEST_KEY="haruno32_pest_records_v1";
const LEARNING_KEY="haruno32_learning_notes_v1";
const FAILURE_KEY="haruno32_failure_records_v1";
const DECISION_KEY="haruno32_decisions_v1";
const TARGET_KEY="haruno32_target_settings_v1";
function ensureDefaultConnection(){
  const savedUrl=(localStorage.getItem("haruno32_supabase_url")||"").trim();
  const savedKey=(localStorage.getItem("haruno32_supabase_key")||"").trim();
  if(!savedUrl) localStorage.setItem("haruno32_supabase_url",DEFAULT_SUPABASE_URL);
  // V5/V6に入っていた途中で切れたキーを自動削除します。
  if(savedKey==="sb_publishable_pswWBc9LE6xfvrvHCpstvg_IDMkfSi-") localStorage.removeItem("haruno32_supabase_key");
}
ensureDefaultConnection();

let selectedFiles=[], records=[], envImports=[], operations=[], decisions=[], pestRecords=[], learningNotes=[], failureRecords=[], supabaseClient=null, activeRecord=null;
const $=id=>document.getElementById(id);

$("date").value=new Date().toISOString().slice(0,10);
$("opDate").value=new Date().toISOString().slice(0,10);
if($("pestDate")) $("pestDate").value=new Date().toISOString().slice(0,10);
if($("learningDate")) $("learningDate").value=new Date().toISOString().slice(0,10);
if($("failureDate")) $("failureDate").value=new Date().toISOString().slice(0,10);

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
    await saveRecord(rec,selectedFiles);e.target.reset();selectedFiles=[];renderPreview();$("date").value=new Date().toISOString().slice(0,10);
$("opDate").value=new Date().toISOString().slice(0,10);await loadRecords();await loadOperations();renderAll();status(supabaseClient?"クラウドへ保存しました":"端末内へ保存しました");
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
  $("analysisText").value="";await loadRecords();await loadOperations();renderAll();alert("分析を保存しました");
};

function photoSrc(p){return p.url||p.data||""}


function localLoadOperations(){
  try{return JSON.parse(localStorage.getItem(OPS_KEY)||"[]")}
  catch{return[]}
}
function saveOperations(){localStorage.setItem(OPS_KEY,JSON.stringify(operations))}
function operationFromCloud(o){
  return {
    id:o.id,date:o.operation_date,house:o.house,
    harvest:numberOrZero(o.harvest_kg),
    irrigation:numberOrZero(o.irrigation_minutes),
    irrigation_count:numberOrZero(o.irrigation_count),
    nitrogen:numberOrZero(o.nitrogen_amount),
    fertilizer:o.fertilizer_note||"",
    memo:o.decision_note||"",
    created_at:o.created_at||new Date().toISOString()
  };
}
function operationToCloud(o){
  return {
    id:o.id,operation_date:o.date,house:o.house,
    harvest_kg:numberOrZero(o.harvest),
    irrigation_minutes:numberOrZero(o.irrigation),
    irrigation_count:numberOrZero(o.irrigation_count),
    nitrogen_amount:numberOrZero(o.nitrogen),
    fertilizer_note:o.fertilizer||"",
    decision_note:o.memo||"",
    created_at:o.created_at||new Date().toISOString(),
    updated_at:new Date().toISOString()
  };
}
async function loadOperations(){
  const local=localLoadOperations();
  if(!supabaseClient){
    operations=local.sort((a,b)=>(b.date+b.created_at).localeCompare(a.date+a.created_at));
    return;
  }
  const {data,error}=await supabaseClient.from("cultivation_operations")
    .select("*").order("operation_date",{ascending:false}).order("created_at",{ascending:false});
  if(error){
    operations=local;
    updateOpsSyncLabel(`実績テーブル未設定：supabase_setup.sqlを実行してください`,"warn");
    return;
  }
  operations=(data||[]).map(operationFromCloud);
  saveOperations();
  updateOpsSyncLabel("収穫・灌水・施肥もクラウド同期中","success");
}
async function saveOperation(op){
  const local=localLoadOperations().filter(x=>x.id!==op.id);
  local.unshift(op);
  localStorage.setItem(OPS_KEY,JSON.stringify(local));
  if(!supabaseClient)return;
  const {error}=await supabaseClient.from("cultivation_operations").upsert(operationToCloud(op));
  if(error)throw new Error(`実績クラウド保存：${error.message}`);
}
async function deleteOperation(id){
  operations=operations.filter(o=>o.id!==id);saveOperations();
  if(supabaseClient){
    const {error}=await supabaseClient.from("cultivation_operations").delete().eq("id",id);
    if(error)throw error;
  }
}
function updateOpsSyncLabel(text,kind=""){
  const el=$("opsSyncLabel");
  if(!el)return;
  el.textContent=text;
  el.className=kind;
}
async function syncOperationsToCloud(){
  if(!supabaseClient)throw new Error("オンライン接続されていません");
  const local=localLoadOperations();
  if(local.length){
    const {error}=await supabaseClient.from("cultivation_operations")
      .upsert(local.map(operationToCloud));
    if(error)throw error;
  }
  await loadOperations();
  return local.length;
}

function localLoadDecisions(){try{return JSON.parse(localStorage.getItem(DECISION_KEY)||"[]")}catch{return[]}}
function localSaveDecisions(){localStorage.setItem(DECISION_KEY,JSON.stringify(decisions))}
function decisionFromCloud(d){return {id:d.id,date:d.decision_date,house:d.house,action:d.action_text||"",reason:d.reason_text||"",result:d.result_text||"",created_at:d.created_at||new Date().toISOString()}}
function decisionToCloud(d){return {id:d.id,decision_date:d.date,house:d.house,action_text:d.action||"",reason_text:d.reason||"",result_text:d.result||"",created_at:d.created_at||new Date().toISOString(),updated_at:new Date().toISOString()}}
async function loadDecisions(){
  const local=localLoadDecisions();
  if(!supabaseClient){decisions=local.sort((a,b)=>(b.date+b.created_at).localeCompare(a.date+a.created_at));return}
  const {data,error}=await supabaseClient.from("decision_logs").select("*").order("decision_date",{ascending:false}).order("created_at",{ascending:false});
  if(error){decisions=local;return}
  decisions=(data||[]).map(decisionFromCloud);localSaveDecisions();
}
async function saveDecision(d){
  decisions=[d,...localLoadDecisions().filter(x=>x.id!==d.id)];localSaveDecisions();
  if(supabaseClient){const {error}=await supabaseClient.from("decision_logs").upsert(decisionToCloud(d));if(error)throw error}
}
async function deleteDecision(id){
  decisions=decisions.filter(d=>d.id!==id);localSaveDecisions();
  if(supabaseClient){const {error}=await supabaseClient.from("decision_logs").delete().eq("id",id);if(error)throw error}
}
async function syncDecisions(){
  if(!supabaseClient)throw new Error("オンライン接続されていません");
  const local=localLoadDecisions();
  if(local.length){const {error}=await supabaseClient.from("decision_logs").upsert(local.map(decisionToCloud));if(error)throw error}
  await loadDecisions();return local.length;
}

function numberOrZero(v){const n=Number(v);return Number.isFinite(n)?n:0}
function operationKpis(){
  const today=new Date().toISOString().slice(0,10);
  const todayOps=operations.filter(o=>o.date===today);
  const last7=operations.filter(o=>{
    const diff=(new Date(today)-new Date(o.date))/86400000;
    return diff>=0&&diff<7;
  });
  const month=today.slice(0,7);
  const monthOps=operations.filter(o=>o.date.startsWith(month));
  return {
    todayHarvest:todayOps.reduce((s,o)=>s+numberOrZero(o.harvest),0),
    weekHarvest:last7.reduce((s,o)=>s+numberOrZero(o.harvest),0),
    monthHarvest:monthOps.reduce((s,o)=>s+numberOrZero(o.harvest),0),
    weekIrrigation:last7.reduce((s,o)=>s+numberOrZero(o.irrigation),0)
  };
}
function centerQualityScore(){
  const latest=records[0], today=new Date().toISOString().slice(0,10);
  const todayOp=operations.find(o=>o.date===today);
  const env=latestEnvironmentDay();
  const checks=[
    latest?20:0,
    latest&&(latest.photos||[]).length>=2?20:0,
    latest?.analysis?20:0,
    todayOp?20:0,
    env?20:0
  ];
  return checks.reduce((a,b)=>a+b,0);
}
function centerAdviceData(){
  const latest=records[0], env=latestEnvironmentDay();
  const today=new Date().toISOString().slice(0,10);
  const op=operations.find(o=>o.date===today);
  const items=[];
  let level="normal",label="通常";
  if(!latest){
    return {level:"start",label:"記録待ち",items:["まず今日の草勢と写真2枚を記録してください。"]};
  }
  if(Number(latest.vigor)<=2){
    level="alert";label="草勢注意";
    items.push("草勢が弱めです。灌水量を増やす前に、根域の湿り・根傷み・低温・日照不足を確認してください。");
  }else if(Number(latest.vigor)>=5){
    level="alert";label="過繁茂注意";
    items.push("草勢が強めです。摘葉量、着果負担、窒素供給の釣り合いを確認してください。");
  }else{
    items.push("草勢は中間域です。前回写真との差を見ながら、急な管理変更は避けます。");
  }
  if(env){
    const vpd=calcVpd(env.temp_avg,env.humidity_avg);
    if(vpd!==null&&vpd<0.4){
      level="alert";label="多湿注意";
      items.push(`概算飽差は${vpd}kPaです。結露、病害、蒸散不足を確認してください。`);
    }else if(vpd!==null&&vpd>1.5){
      level="alert";label="乾燥注意";
      items.push(`概算飽差は${vpd}kPaです。吸水負担と灌水タイミングを確認してください。`);
    }else{
      items.push(`概算飽差は${vpd}kPaで、平均値としては極端ではありません。`);
    }
  }else{
    items.push("環境データが未取込です。気温・湿度・日射の実感を記録に残してください。");
  }
  if(op){
    if(numberOrZero(op.harvest)>0)items.push(`今日の収穫 ${numberOrZero(op.harvest).toFixed(1)}kgを記録済みです。草勢と収量の両方を見て明日の負担を判断します。`);
    if(numberOrZero(op.irrigation)>0)items.push(`灌水合計 ${numberOrZero(op.irrigation)}分・${numberOrZero(op.irrigation_count)}回を記録済みです。`);
  }else{
    items.push("今日の収穫量・灌水・施肥実績を入力すると、判断精度が上がります。");
  }
  return {level,label,items:items.slice(0,4)};
}
function operationCard(o){
  return `<article class="record">
    <div class="record-head">
      <div><strong>${esc(o.date)}｜${esc(o.house)}</strong><p class="meta">収穫 ${numberOrZero(o.harvest).toFixed(1)}kg</p></div>
      <button class="delete-btn" data-op-delete="${o.id}">削除</button>
    </div>
    <div class="op-tags">
      <span>灌水 ${numberOrZero(o.irrigation)}分</span>
      <span>${numberOrZero(o.irrigation_count)}回</span>
      ${numberOrZero(o.nitrogen)?`<span>窒素 ${numberOrZero(o.nitrogen)}kg</span>`:""}
    </div>
    ${o.fertilizer?`<p><b>施肥：</b>${esc(o.fertilizer)}</p>`:""}
    ${o.memo?`<p><b>判断：</b>${esc(o.memo)}</p>`:""}
  </article>`;
}
function renderCenter(){
  const k=operationKpis();
  $("centerKpis").innerHTML=`
    <div class="metric"><span>今日の収穫</span><strong>${k.todayHarvest.toFixed(1)}kg</strong></div>
    <div class="metric"><span>直近7日収穫</span><strong>${k.weekHarvest.toFixed(1)}kg</strong></div>
    <div class="metric"><span>今月の収穫</span><strong>${k.monthHarvest.toFixed(1)}kg</strong></div>
    <div class="metric"><span>7日間灌水</span><strong>${k.weekIrrigation.toFixed(0)}分</strong></div>`;
  $("centerScore").textContent=centerQualityScore();
  const a=centerAdviceData();
  $("centerRisk").className=`priority-level ${a.level}`;
  $("centerRisk").textContent=a.label;
  $("centerAdvice").innerHTML=`<ol>${a.items.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>`;
  const daily={};
  operations.forEach(o=>daily[o.date]=(daily[o.date]||0)+numberOrZero(o.harvest));
  const points=Object.entries(daily).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14)
    .map(([date,value])=>({date,value}));
  const max=Math.max(10,...points.map(p=>p.value));
  $("harvestChart").innerHTML=svgLineChart(points,{minY:0,maxY:Math.ceil(max/10)*10,label:"収穫量"});
  $("operationList").innerHTML=operations.length?operations.map(operationCard).join(""):'<div class="empty">まだ実績がありません。</div>';
  document.querySelectorAll("[data-op-delete]").forEach(b=>b.onclick=()=>{
    if(!confirm("この実績を削除しますか？"))return;
    deleteOperation(b.dataset.opDelete).then(()=>renderAll()).catch(e=>alert("削除できませんでした："+e.message));
  });
}
function exportOperationsCsv(){
  const headers=["日付","ハウス","収穫量kg","灌水分","灌水回数","窒素量","施肥メモ","判断メモ"];
  const rows=operations.map(o=>[o.date,o.house,o.harvest,o.irrigation,o.irrigation_count,o.nitrogen,o.fertilizer,o.memo]);
  const csv="\uFEFF"+[headers,...rows].map(r=>r.map(csvEscape).join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);
  a.download=`HARUNO32_operations_${new Date().toISOString().slice(0,10)}.csv`;a.click();
  URL.revokeObjectURL(a.href);
}
$("operationForm").onsubmit=async e=>{
  e.preventDefault();
  const op={
    id:crypto.randomUUID(),
    date:$("opDate").value,
    house:$("opHouse").value,
    harvest:numberOrZero($("opHarvest").value),
    irrigation:numberOrZero($("opIrrigation").value),
    irrigation_count:numberOrZero($("opIrrigationCount").value),
    nitrogen:numberOrZero($("opNitrogen").value),
    fertilizer:$("opFertilizer").value.trim(),
    memo:$("opMemo").value.trim(),
    created_at:new Date().toISOString()
  };
  try{
    await saveOperation(op);
    await loadOperations();
    e.target.reset();$("opDate").value=new Date().toISOString().slice(0,10);
    $("opStatus").textContent=supabaseClient?"実績をクラウド保存しました":"実績を端末内へ保存しました";
    $("opStatus").classList.add("show");
    setTimeout(()=>$("opStatus").classList.remove("show"),3000);
    renderAll();
  }catch(err){
    $("opStatus").textContent="保存できませんでした："+err.message;
    $("opStatus").classList.add("show");
  }
};

$("syncOpsBtn").onclick=async()=>{
  try{
    $("syncOpsBtn").disabled=true;
    updateOpsSyncLabel("実績を同期中…");
    const count=await syncOperationsToCloud();
    renderAll();
    alert(`実績同期が完了しました（端末内 ${count}件を確認）`);
  }catch(e){
    updateOpsSyncLabel("実績同期エラー","warn");
    alert(`同期できませんでした\n\n${e.message}\n\nSupabase SQL Editorで最新版の supabase_setup.sql を一度実行してください。`);
  }finally{$("syncOpsBtn").disabled=false}
};
function buildOneTapGrinPrompt(){
  const latest=records[0], env=latestEnvironmentDay(), today=new Date().toISOString().slice(0,10);
  const ops=operations.filter(o=>o.date===today);
  const opSummary=ops.length?ops.map(o=>`${o.house}: 収穫${numberOrZero(o.harvest)}kg、灌水${numberOrZero(o.irrigation)}分/${numberOrZero(o.irrigation_count)}回、窒素${numberOrZero(o.nitrogen)}、施肥${o.fertilizer||"記載なし"}、判断${o.memo||"記載なし"}`).join("\n"):"本日の実績は未入力";
  const envSummary=env?`日付${env.date}、平均気温${val(env.temp_avg,"℃")}、最低${val(env.temp_min,"℃")}、最高${val(env.temp_max,"℃")}、平均湿度${val(env.humidity_avg,"%")}、平均CO2 ${val(env.co2_avg,"ppm")}、概算飽差${calcVpd(env.temp_avg,env.humidity_avg)??"—"}kPa`:"環境データ未取込";
  return `HARUNO32の本日の栽培判断をしてください。

【最新の日次記録】
${latest?`日付：${latest.record_date}
ハウス：${latest.house}
作業：${latest.work}
草勢：${latest.vigor}/5
観察・相談：${latest.notes}
前回分析：${latest.analysis||"未保存"}
写真：${(latest.photos||[]).length}枚`:"日次記録なし"}

【本日の収穫・灌水・施肥】
${opSummary}

【最新環境】
${envSummary}

【必ず答える項目】
1. 今日の総合評価
2. 最優先で確認すること
3. 灌水判断
4. 施肥・硝酸態窒素の判断
5. 摘葉・つる下ろし等の作業判断
6. 明日までに見る変化
7. リスクと根拠

HARUNO32の方針に従い、断定しすぎず、現場で実行できる短い指示にしてください。摘葉とつる下ろしは同時に勧めないでください。`;
}
$("oneTapGrin").onclick=async()=>{
  const text=buildOneTapGrinPrompt();
  try{
    await navigator.clipboard.writeText(text);
    alert("本日の分析文をコピーしました。ChatGPTのグリンに貼り付けてください。");
  }catch{
    prompt("下の文章をコピーして、グリンに送ってください。",text);
  }
};

$("exportOpsCsv").onclick=exportOperationsCsv;
$("clearOps").onclick=()=>{
  if(!operations.length)return;
  if(confirm("栽培実績をすべて消去しますか？ クラウド側からも削除されます。")){
    (async()=>{
      try{
        if(supabaseClient){
          const ids=operations.map(o=>o.id);
          if(ids.length){
            const {error}=await supabaseClient.from("cultivation_operations").delete().in("id",ids);
            if(error)throw error;
          }
        }
        operations=[];saveOperations();renderAll();
      }catch(e){alert("全消去できませんでした："+e.message)}
    })();
  }
};

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
const FERTILIZER_MASTER={
  autumn:{label:"10〜11月 定植期",name:"谷崎ブレンドA",ratio:"N － P － K",a:"硝酸カルシウム 1袋",b:"尿素 1/2袋・リン酸アンモニア 1袋・硫酸カリウム 1袋",cost:3014+3268/2+9013+2695,note:"根張りと初期生育を優先。硝酸態窒素は草勢・根域・日射を見て判断。"},
  winter:{label:"12〜2月 冬期",name:"谷崎ブレンドB",ratio:"N － P － K",a:"硝酸カルシウム 1袋",b:"尿素 1/2袋・リン酸アンモニア 1/2袋・硫酸カリウム 2袋",cost:3014+3268/2+9013/2+2695*2,note:"低温・弱日射期。硝酸態窒素、根の活性、着果負担の釣り合いを重視。"},
  off:{label:"栽培準備期間",name:"定植準備",ratio:"土壌分析後に確定",a:"施肥はまだ実行しない",b:"土壌分析・還元消毒・灌水均一性を確認",cost:0,note:"定植前は施肥量より、土壌状態と根域環境の準備を優先。"}
};
function cropPhase(today=new Date().toISOString().slice(0,10)){
  const t=targetSettings();
  if(today<t.cropStart)return {key:"off",label:"作付準備期間"};
  if(today>t.cropEnd)return {key:"off",label:"栽培終了後"};
  const m=Number(today.slice(5,7));
  if(m===10||m===11)return {key:"autumn",label:"定植・初期生育期"};
  if(m===12||m===1||m===2)return {key:"winter",label:"冬期栽培"};
  return {key:"autumn",label:"栽培期間"};
}
function todayOperation(){const today=new Date().toISOString().slice(0,10);return operations.find(o=>o.date===today)||null}
function renderCommandPhotos(latest){
  const el=$("commandPhotos");if(!el)return;
  const photos=(latest?.photos||[]).slice(0,4);
  el.innerHTML=photos.length?photos.map((p,i)=>`<figure><img class="zoom-photo" src="${photoSrc(p)}" alt="本日の栽培写真${i+1}"><figcaption>${i===0?"① 代表株":i===1?"② 気になる箇所":`写真${i+1}`}</figcaption></figure>`).join(""):'<div class="empty">本日の写真はまだありません。今日の記録から追加できます。</div>';
  el.querySelectorAll('.zoom-photo').forEach(img=>img.onclick=()=>window.open(img.src,'_blank','noopener'));
}
function renderHome(){
  const today=new Date().toISOString().slice(0,10), d=new Date();
  const latest=records[0], op=todayOperation(), env=latestEnvironmentDay(), phase=cropPhase(today), target=targetProgressData(), decision=decisionEngineData(), foundation=foundationData();
  $("commandDate").textContent=`${d.toLocaleDateString("ja-JP",{year:"numeric",month:"long",day:"numeric",weekday:"short"})}｜${phase.label}`;
  $("cropPhaseBadge").textContent=phase.label;
  $("cropPhaseBadge").className=`phase-badge ${phase.key}`;
  $("homeSyncState").innerHTML=supabaseClient?'<span class="online-dot"></span>クラウド同期中':'<span class="offline-dot"></span>端末内保存';
  const todayHarvest=numberOrZero(op?.harvest), total=operations.reduce((sum,x)=>sum+numberOrZero(x.harvest),0);
  $("cmdTodayHarvest").textContent=`${todayHarvest.toFixed(1)} kg`;
  $("cmdHarvestNote").textContent=op?"本日入力済み":"本日の実績は未入力";
  $("cmdTotalHarvest").textContent=`${total.toFixed(1)} kg`;
  $("cmdTargetPct").textContent=`${target.pct.toFixed(1)}%`;
  $("cmdTargetBar").style.width=`${Math.min(100,target.pct)}%`;
  $("cmdVigor").textContent=latest?`${latest.vigor}/5`:"—";
  $("cmdVigorNote").textContent=latest?`${latest.record_date}｜${latest.house}`:"本日の記録待ち";
  const mins=(latest?.work||"").match(/(\d+)\s*分/g)?.reduce((s,x)=>s+Number(x.match(/\d+/)[0]),0)||null;
  $("cmdWorkMinutes").textContent=mins?`${mins}分`:"—";
  const recipe=FERTILIZER_MASTER[phase.key]||FERTILIZER_MASTER.autumn;
  $("fertilizerSeason").textContent=recipe.label;
  $("fertilizerRecipe").innerHTML=`<div class="fertilizer-name"><strong>${recipe.name}</strong><span>${recipe.ratio}</span></div><div class="fertilizer-lines"><p><b>A液：</b>${esc(recipe.a)}</p><p><b>B液：</b>${esc(recipe.b)}</p></div><div class="fertilizer-cost"><span>標準材料費</span><strong>${recipe.cost?recipe.cost.toLocaleString()+"円":"—"}</strong></div><p class="muted">${esc(recipe.note)}</p>`;
  $("commandRisk").className=`priority-level ${decision.level}`;$("commandRisk").textContent=decision.label;
  $("commandAiComment").innerHTML=`<p>${esc(decision.moves[0]||"今日の記録を確認してください。")}</p><p>${esc(decision.alerts[0]?.text||"大きな急変は確認されていません。")}</p>`;
  $("commandEnvironment").innerHTML=env?`<div class="env-grid command-env"><div><span>平均気温</span><b>${val(env.temp_avg,"℃")}</b></div><div><span>平均湿度</span><b>${val(env.humidity_avg,"%")}</b></div><div><span>CO₂</span><b>${val(env.co2_avg,"ppm")}</b></div><div><span>日射合計</span><b>${val(env.solar_sum)}</b></div></div><p class="muted">${env.date}｜${env.house}</p>`:'<div class="empty">SAWACHI CSVを取り込むと、ここに最新環境が表示されます。</div>';
  $("commandWork").innerHTML=latest?`<div class="compact-record"><strong>${esc(latest.record_date)}｜${esc(latest.house)}</strong><span class="vigor-pill">草勢 ${latest.vigor}/5</span><p>${esc(latest.work)}</p><p class="meta">${esc(latest.notes)}</p></div>`:'<div class="empty">本日の作業記録はまだありません。</div>';
  $("commandTop3").innerHTML=decision.moves.map((x,i)=>`<div class="move-item"><b>${i+1}</b><span>${esc(x)}</span></div>`).join("");
  renderCommandPhotos(latest);
  $("commandSummary").innerHTML=`<p><b>収穫：</b>${todayHarvest.toFixed(1)}kg（累計 ${total.toFixed(1)}kg）</p><p><b>灌水：</b>${op?`${numberOrZero(op.irrigation)}分・${numberOrZero(op.irrigation_count)}回`:"未入力"}</p><p><b>草勢：</b>${latest?`${latest.vigor}/5`:`未入力`}</p><p><b>施肥：</b>${op?.fertilizer?esc(op.fertilizer):phase.key==="off"?"準備期間のため未使用":"実績未入力"}</p>`;
  const start=target.s.cropStart,end=target.s.cropEnd;
  $("commandSchedule").innerHTML=`<ul class="schedule-list"><li><b>定植予定</b><span>${start}</span></li><li><b>収穫計画終了</b><span>${end}</span></li><li><b>次の判断</b><span>${phase.key==="off"?"土壌分析・灌水均一性の確認":"写真・草勢・収穫ペースの週次確認"}</span></li></ul>`;
  $("foundationScore").textContent=`${foundation.score}%`;
  $("foundationBars").innerHTML=foundation.checks.map(x=>`<div class="foundation-row"><div class="foundation-label"><strong>${esc(x.label)}</strong><span>${esc(x.detail)}</span></div><div class="progress"><i style="width:${x.value}%"></i></div><b>${x.value}%</b></div>`).join("");
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


function targetSettings(){
  let saved={};
  try{saved=JSON.parse(localStorage.getItem(TARGET_KEY)||"{}")}catch(_){saved={}}
  return {
    targetKg:Number(saved.targetKg)||32000,
    cropStart:saved.cropStart||"2026-10-01",
    cropEnd:saved.cropEnd||"2027-06-30"
  };
}
function dateDiffDays(a,b){return Math.round((new Date(b)-new Date(a))/86400000)}
function sumHarvestBetween(start,end){
  return operations.filter(o=>o.date>=start&&o.date<=end).reduce((s,o)=>s+numberOrZero(o.harvest),0);
}
function recordsOn(date){return records.find(r=>r.record_date===date)||null}
function opsOn(date){return operations.filter(o=>o.date===date)}
function aggregateOps(date){
  const xs=opsOn(date);
  return {
    harvest:xs.reduce((s,o)=>s+numberOrZero(o.harvest),0),
    irrigation:xs.reduce((s,o)=>s+numberOrZero(o.irrigation),0),
    irrigation_count:xs.reduce((s,o)=>s+numberOrZero(o.irrigation_count),0)
  };
}
function envOn(date){
  for(const imp of envImports){const d=(imp.days||[]).find(x=>x.date===date);if(d)return {...d,house:imp.house}}
  return null;
}
function daySnapshot(date){
  const r=recordsOn(date),o=aggregateOps(date),e=envOn(date);
  return {date,record:r,ops:o,env:e};
}
function fmtDelta(value,suffix=""){
  if(value===null||!Number.isFinite(value))return "—";
  const sign=value>0?"+":"";
  return `${sign}${Number(value.toFixed(1))}${suffix}`;
}
function compareSnapshot(base,other,label){
  if(!other.record && !other.ops.harvest && !other.env)return `<div class="comparison-card"><strong>${label}</strong><p class="muted">比較データなし</p></div>`;
  const vigor=(base.record&&other.record)?Number(base.record.vigor)-Number(other.record.vigor):null;
  const harvest=base.ops.harvest-other.ops.harvest;
  const irrigation=base.ops.irrigation-other.ops.irrigation;
  const temp=(base.env&&other.env&&Number.isFinite(Number(base.env.temp_avg))&&Number.isFinite(Number(other.env.temp_avg)))?Number(base.env.temp_avg)-Number(other.env.temp_avg):null;
  return `<div class="comparison-card"><strong>${label}</strong>
    <div><span>草勢</span><b>${fmtDelta(vigor)}</b></div>
    <div><span>収穫</span><b>${fmtDelta(harvest,"kg")}</b></div>
    <div><span>灌水</span><b>${fmtDelta(irrigation,"分")}</b></div>
    <div><span>平均気温</span><b>${fmtDelta(temp,"℃")}</b></div></div>`;
}
function buildMorningBriefData(){
  const latest=records[0], env=latestEnvironmentDay(), k=operationKpis(), advice=centerAdviceData();
  const items=[];
  if(latest)items.push(`最新記録は${latest.record_date}・${latest.house}、草勢${latest.vigor}/5です。`);
  else items.push("今日の草勢と写真2枚を記録してください。");
  items.push(...advice.items.slice(0,3));
  if(k.weekHarvest>0)items.push(`直近7日収穫は${k.weekHarvest.toFixed(1)}kgです。収穫ペースと草勢を一緒に確認します。`);
  if(env)items.push(`最新環境は平均${val(env.temp_avg,"℃")}・湿度${val(env.humidity_avg,"%")}・CO₂${val(env.co2_avg,"ppm")}です。`);
  const priority=priorityData();
  return {level:advice.level,label:advice.label,items:[...new Set(items)].slice(0,6),priority:priority.items[0]};
}
function targetProgressData(){
  const s=targetSettings(),today=new Date().toISOString().slice(0,10);
  const harvest=sumHarvestBetween(s.cropStart, today>s.cropEnd?s.cropEnd:today);
  const pct=Math.max(0,Math.min(100,harvest/s.targetKg*100));
  const totalDays=Math.max(1,dateDiffDays(s.cropStart,s.cropEnd)+1);
  const elapsed=today<s.cropStart?0:Math.min(totalDays,Math.max(0,dateDiffDays(s.cropStart,today)+1));
  const expected=s.targetKg*(elapsed/totalDays);
  const gap=harvest-expected;
  const remain=Math.max(0,s.targetKg-harvest);
  const remainDays=Math.max(0,totalDays-elapsed);
  const requiredDaily=remainDays?remain/remainDays:remain;
  return {s,today,harvest,pct,elapsed,totalDays,expected,gap,remain,remainDays,requiredDaily};
}
function cultivationJournalText(){
  const recentRecords=[...records].filter(r=>dateDiffDays(r.record_date,new Date().toISOString().slice(0,10))>=0&&dateDiffDays(r.record_date,new Date().toISOString().slice(0,10))<7);
  const recentOps=operations.filter(o=>dateDiffDays(o.date,new Date().toISOString().slice(0,10))>=0&&dateDiffDays(o.date,new Date().toISOString().slice(0,10))<7);
  if(!recentRecords.length&&!recentOps.length)return "直近7日間の記録がまだありません。日次記録や収穫実績を入力すると、自動日誌が作られます。";
  const avgV=recentRecords.length?(recentRecords.reduce((s,r)=>s+Number(r.vigor||0),0)/recentRecords.length).toFixed(1):"—";
  const harvest=recentOps.reduce((s,o)=>s+numberOrZero(o.harvest),0);
  const irrigation=recentOps.reduce((s,o)=>s+numberOrZero(o.irrigation),0);
  const works=[...new Set(recentRecords.map(r=>r.work).filter(Boolean))].slice(0,3);
  const analyses=recentRecords.filter(r=>r.analysis).length;
  let trend="草勢は概ね中間域です";
  if(Number(avgV)<=2.5)trend="草勢は弱めに推移しています";
  else if(Number(avgV)>=4.5)trend="草勢は強めに推移しています";
  return `直近7日間は、${trend}（平均${avgV}/5）。収穫は合計${harvest.toFixed(1)}kg、灌水記録は合計${irrigation.toFixed(0)}分でした。主な作業は${works.length?works.join("、"):"未記録"}です。グリン分析は${analyses}件保存されています。次週は、写真の同位置比較と、収穫量・灌水量・草勢の変化を同じ日付で揃えて判断精度を上げます。`;
}
function renderAssistant(){
  if(!$('morningBrief'))return;
  const b=buildMorningBriefData();
  $('assistantStatus').className=`priority-level ${b.level}`;
  $('assistantStatus').textContent=b.label;
  $('morningBrief').innerHTML=`<h3>最優先：${esc(b.priority||"記録を確認")}</h3><ol>${b.items.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>`;
  const t=targetProgressData();
  const pace=t.today<t.s.cropStart?"栽培開始前":(t.gap>=0?`計画比 ${fmtDelta(t.gap,"kg")}`:`計画比 ${fmtDelta(t.gap,"kg")}`);
  $('targetMeter').innerHTML=`<div class="target-number"><strong>${t.harvest.toFixed(1)}</strong><span> / ${t.s.targetKg.toLocaleString()}kg</span></div>
    <div class="target-progress"><i style="width:${t.pct}%"></i></div>
    <div class="target-stats"><div><span>達成率</span><b>${t.pct.toFixed(1)}%</b></div><div><span>残り</span><b>${t.remain.toFixed(0)}kg</b></div><div><span>必要日平均</span><b>${t.requiredDaily.toFixed(1)}kg</b></div><div><span>進捗</span><b>${pace}</b></div></div>
    <p class="muted">期間：${t.s.cropStart}〜${t.s.cropEnd}</p>`;
  const baseDate=records[0]?.record_date||new Date().toISOString().slice(0,10);
  const d=new Date(baseDate);const yesterday=new Date(d);yesterday.setDate(d.getDate()-1);const week=new Date(d);week.setDate(d.getDate()-7);
  const ds=x=>x.toLocaleDateString('sv-SE');
  const base=daySnapshot(baseDate);
  $('comparisonCards').innerHTML=compareSnapshot(base,daySnapshot(ds(yesterday)),`前日（${ds(yesterday)}）比`)+compareSnapshot(base,daySnapshot(ds(week)),`7日前（${ds(week)}）比`);
  $('cultivationJournal').textContent=cultivationJournalText();
  const timeline=[...records].sort((a,b)=>a.record_date.localeCompare(b.record_date)).filter(r=>(r.photos||[])[0]).slice(-12);
  $('photoTimeline').innerHTML=timeline.length?timeline.map(r=>`<figure><img class="zoom-photo" src="${photoSrc(r.photos[0])}" alt="${esc(r.record_date)} 代表株"><figcaption><strong>${esc(r.record_date)}</strong><span>${esc(r.house)}・草勢${r.vigor}</span></figcaption></figure>`).join(""):'<div class="empty">代表株写真がまだありません。</div>';
  document.querySelectorAll('#photoTimeline .zoom-photo').forEach(img=>img.onclick=()=>window.open(img.src,'_blank','noopener'));
}
function copyTextSafe(text,message){navigator.clipboard.writeText(text).then(()=>alert(message)).catch(()=>prompt("コピーしてください",text));}


function decisionEngineData(){
  const latest=records[0], env=latestEnvironmentDay(), t=targetProgressData(), a=centerAdviceData();
  const moves=[], alerts=[];
  if(!latest){moves.push("草勢スコアと代表株写真2枚を記録する");alerts.push({level:"start",title:"判断材料不足",text:"本日の植物記録がありません。"});}
  else{
    const v=Number(latest.vigor||0);
    if(v<=2) moves.push("根域の湿り・根傷み・低温を確認してから灌水や施肥を変える");
    else if(v>=5) moves.push("着果負担と葉量を確認し、窒素を増やさない");
    else moves.push("代表株を前回写真と比較し、急な管理変更を避ける");
    const prev=records.find(r=>r.id!==latest.id&&r.house===latest.house);
    if(prev){const dv=v-Number(prev.vigor||0);if(Math.abs(dv)>=2)alerts.push({level:"alert",title:"草勢が急変",text:`前回比 ${fmtDelta(dv)}。根・日射・着果負担を確認してください。`});}
  }
  if(env){
    const vpd=calcVpd(env.temp_avg,env.humidity_avg);
    if(vpd!==null&&vpd<0.4){moves.push("朝の結露と病害リスクを確認し、必要なら換気・循環を優先する");alerts.push({level:"alert",title:"多湿傾向",text:`概算飽差 ${vpd}kPa。結露と蒸散不足に注意。`});}
    else if(vpd!==null&&vpd>1.5){moves.push("日射と萎れを見て、少量多回灌水の必要性を確認する");alerts.push({level:"alert",title:"乾燥負担",text:`概算飽差 ${vpd}kPa。吸水負担に注意。`});}
    else moves.push("日射の変化に合わせて午後の灌水回数を判断する");
  }else moves.push("SAWACHIの最新CSVを取り込み、気温・湿度・CO₂を確認する");
  if(t.today>=t.s.cropStart&&t.gap<0){moves.push(`計画差 ${Math.abs(t.gap).toFixed(0)}kgを確認し、草勢を落とさず収穫ペース改善策を1つ決める`);alerts.push({level:"warn",title:"計画ペース未満",text:`線形計画比 ${fmtDelta(t.gap,"kg")}。必要日平均 ${t.requiredDaily.toFixed(1)}kg。`});}
  if(!alerts.length)alerts.push({level:"normal",title:"大きな急変なし",text:"入力済みデータでは強い警戒サインはありません。現場確認を優先してください。"});
  while(moves.length<3)moves.push("今日の収穫量・灌水・施肥実績を記録する");
  return {level:a.level,label:a.label,moves:[...new Set(moves)].slice(0,3),alerts,t};
}
function paceForecastData(){
  const t=targetProgressData();
  const elapsedHarvestDays=Math.max(1,t.elapsed);
  const avg=t.harvest/elapsedHarvestDays;
  const projected=Math.max(0,avg*t.totalDays);
  const ratio=t.s.targetKg?projected/t.s.targetKg*100:0;
  return {...t,avg,projected,ratio};
}
function renderDecision(){
  if(!$("todayThreeMoves"))return;
  const d=decisionEngineData(),p=paceForecastData();
  $("decisionRisk").className=`priority-level ${d.level}`;$("decisionRisk").textContent=d.label;
  $("todayThreeMoves").innerHTML=d.moves.map((x,i)=>`<div class="move-item"><b>${i+1}</b><span>${esc(x)}</span></div>`).join("");
  const projectedPct=Math.min(140,Math.max(0,p.ratio));
  $("paceForecast").innerHTML=`<div class="forecast-number"><strong>${p.projected.toFixed(0)}</strong><span>kg 予測</span></div><div class="target-progress"><i style="width:${Math.min(100,projectedPct)}%"></i></div><div class="target-stats"><div><span>実績日平均</span><b>${p.avg.toFixed(1)}kg</b></div><div><span>目標比</span><b>${p.ratio.toFixed(1)}%</b></div><div><span>必要日平均</span><b>${p.requiredDaily.toFixed(1)}kg</b></div><div><span>計画差</span><b>${fmtDelta(p.gap,"kg")}</b></div></div>`;
  $("changeAlerts").innerHTML=d.alerts.map(x=>`<article class="change-alert ${x.level}"><strong>${esc(x.title)}</strong><p>${esc(x.text)}</p></article>`).join("");
  $("decisionList").innerHTML=decisions.length?decisions.slice(0,20).map(x=>`<article class="record"><div class="record-head"><div><strong>${esc(x.date)}｜${esc(x.house)}</strong><p class="meta">${esc(x.action)}</p></div><button class="delete-btn" data-decision-delete="${x.id}">削除</button></div>${x.reason?`<p><b>理由：</b>${esc(x.reason)}</p>`:""}${x.result?`<p><b>結果：</b>${esc(x.result)}</p>`:""}</article>`).join(""):'<div class="empty">判断ログはまだありません。</div>';
  document.querySelectorAll('[data-decision-delete]').forEach(b=>b.onclick=()=>{if(confirm("この判断ログを削除しますか？"))deleteDecision(b.dataset.decisionDelete).then(()=>renderAll()).catch(e=>alert(e.message))});
}


function localLoadPest(){try{return JSON.parse(localStorage.getItem(PEST_KEY)||"[]")}catch{return[]}}
function localSavePest(){localStorage.setItem(PEST_KEY,JSON.stringify(pestRecords))}
function normalizeGroup(s=""){return s.trim().toUpperCase().replace(/\s+/g," ")}
async function loadPestRecords(){
  if(!supabaseClient){pestRecords=localLoadPest();return}
  const {data,error}=await supabaseClient.from("pest_control_records").select("*").order("spray_date",{ascending:false});
  pestRecords=error?localLoadPest():(data||[]);
}
async function savePestRecord(rec){
  if(!supabaseClient){pestRecords.unshift(rec);localSavePest();return}
  const {error}=await supabaseClient.from("pest_control_records").insert(rec);
  if(error)throw error;
}
function sameTarget(a,b){return (a||"").trim()&&(b||"").trim()&&((a||"").includes(b)||(b||"").includes(a))}
function recentRelevantPest(target,type){return [...pestRecords].sort((a,b)=>String(b.spray_date).localeCompare(String(a.spray_date))).filter(r=>r.pesticide_type===type&&(sameTarget(r.target_pest,target)||!target)).slice(0,5)}
function updateRotationCheck(){
  const box=$("rotationCheck"); if(!box)return;
  const group=normalizeGroup($("pestGroup").value), target=$("pestTarget").value.trim(), type=$("pestType").value;
  if(!group){box.className="rotation-check";box.textContent="系統コードを入力すると直近履歴と照合します。";return}
  const recent=recentRelevantPest(target,type), repeated=recent.find(r=>normalizeGroup(r.mode_group)===group);
  if(repeated){box.className="rotation-check alert";box.innerHTML=`注意：${esc(repeated.spray_date)}にも <b>${esc(group)}</b> を使用しています。同じ対象への連用にならないか確認してください。`;}
  else {box.className="rotation-check ok";box.textContent=`直近履歴では ${group} の同一系統連用は見つかりません。ラベルと地域指導基準も確認してください。`;}
}
function renderPest(){
  if(!$("pestHistory"))return;
  $("pestCount").textContent=pestRecords.length;
  const sorted=[...pestRecords].sort((a,b)=>String(b.spray_date).localeCompare(String(a.spray_date)));
  const latest=sorted[0];
  if(!latest){
    $("rotationBadge").textContent="記録待ち";
    $("rotationAdvice").innerHTML="<p>最初の散布記録を登録すると、対象病害虫ごとに直近の系統を表示します。</p>";
    $("pestHistory").innerHTML='<div class="empty">防除記録はまだありません。</div>';return;
  }
  const relevant=sorted.filter(r=>r.pesticide_type===latest.pesticide_type&&sameTarget(r.target_pest,latest.target_pest)).slice(0,4);
  const sameCount=relevant.filter(r=>normalizeGroup(r.mode_group)===normalizeGroup(latest.mode_group)).length;
  $("rotationBadge").textContent=sameCount>=2?"連用確認":"ローテーション確認";
  $("rotationBadge").className=`priority-level ${sameCount>=2?"high":"low"}`;
  $("rotationAdvice").innerHTML=`<p><b>最新：</b>${esc(latest.target_pest)}に ${esc(latest.product_name)}（${esc(latest.mode_group)}）</p><p>${sameCount>=2?"同じ対象で同一系統の記録が続いています。次回は別系統候補を検討し、最新ラベルと指導機関の情報で確認してください。":"次回は直近と異なる系統コードを候補にし、発生状況・抵抗性管理・ラベル条件を合わせて判断します。"}</p>`;
  $("pestHistory").innerHTML=sorted.slice(0,12).map(r=>`<article class="pest-row"><div><strong>${esc(r.spray_date)}｜${esc(r.house)}</strong><span>${esc(r.pesticide_type)}・${esc(r.target_pest)}</span></div><div><b>${esc(r.product_name)}</b><span>${esc(r.mode_group)}${r.dilution?`・${r.dilution}倍`:""}${r.spray_volume_l?`・${r.spray_volume_l}L`:""}</span></div><small>${esc(r.memo||"")}</small></article>`).join("");
}
if($("pestGroup")) ["pestGroup","pestTarget","pestType"].forEach(id=>$(id).addEventListener("input",updateRotationCheck));
if($("pestForm")) $("pestForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const rec={id:crypto.randomUUID(),spray_date:$("pestDate").value,house:$("pestHouse").value,pesticide_type:$("pestType").value,target_pest:$("pestTarget").value.trim(),product_name:$("pestProduct").value.trim(),active_ingredient:$("pestIngredient").value.trim(),mode_group:normalizeGroup($("pestGroup").value),dilution:Number($("pestDilution").value)||null,spray_volume_l:Number($("pestVolume").value)||null,preharvest_days:Number($("pestPhi").value)||null,label_max_uses:Number($("pestMaxUses").value)||null,memo:$("pestMemo").value.trim(),created_at:new Date().toISOString()};
  const recent=recentRelevantPest(rec.target_pest,rec.pesticide_type);
  if(recent[0]&&normalizeGroup(recent[0].mode_group)===rec.mode_group){
    const ok=confirm(`直前の同対象記録も ${rec.mode_group} です。連用の可能性があります。ラベルと防除方針を確認したうえで保存しますか？`); if(!ok)return;
  }
  try{await savePestRecord(rec);await loadPestRecords();renderPest();e.target.reset();$("pestDate").value=new Date().toISOString().slice(0,10);$("pestStatus").textContent=supabaseClient?"クラウドへ保存しました":"端末内へ保存しました";$("pestStatus").classList.add("show");updateRotationCheck();}
  catch(err){$("pestStatus").textContent="保存できませんでした："+err.message;$("pestStatus").classList.add("show");}
});



// v15 栽培マスターAI：学習ノート・失敗データベース
function localLoadArray(key){try{return JSON.parse(localStorage.getItem(key)||"[]")}catch{return []}}
function localSaveArray(key,data){localStorage.setItem(key,JSON.stringify(data))}
async function loadLearningNotes(){
  if(!supabaseClient){learningNotes=localLoadArray(LEARNING_KEY);return}
  const {data,error}=await supabaseClient.from("cultivation_learning_notes").select("*").order("note_date",{ascending:false});
  learningNotes=error?localLoadArray(LEARNING_KEY):(data||[]);
}
async function saveLearningNote(rec){
  if(!supabaseClient){learningNotes.unshift(rec);localSaveArray(LEARNING_KEY,learningNotes);return}
  const {error}=await supabaseClient.from("cultivation_learning_notes").insert({id:rec.id,note_date:rec.note_date,house:rec.house,learning_text:rec.learning_text,evidence_text:rec.evidence_text,created_at:rec.created_at});
  if(error)throw error;
}
async function loadFailureRecords(){
  if(!supabaseClient){failureRecords=localLoadArray(FAILURE_KEY);return}
  const {data,error}=await supabaseClient.from("cultivation_failure_records").select("*").order("event_date",{ascending:false});
  failureRecords=error?localLoadArray(FAILURE_KEY):(data||[]);
}
async function saveFailureRecord(rec){
  if(!supabaseClient){failureRecords.unshift(rec);localSaveArray(FAILURE_KEY,failureRecords);return}
  const {error}=await supabaseClient.from("cultivation_failure_records").insert(rec);if(error)throw error;
}
function renderCultivationChart(){
  if(!$("cultivationChart"))return;
  const latestRecord=[...records].sort((a,b)=>String(b.date||b.record_date||"").localeCompare(String(a.date||a.record_date||"")))[0];
  const latestOp=[...operations].sort((a,b)=>String(b.operation_date||b.date||"").localeCompare(String(a.operation_date||a.date||"")))[0];
  const latestPest=[...pestRecords].sort((a,b)=>String(b.spray_date||"").localeCompare(String(a.spray_date||"")))[0];
  $("cultivationChart").innerHTML=`
    <div class="chart-line"><span>最新の日次記録</span><b>${latestRecord?esc(latestRecord.date||latestRecord.record_date||"記録あり"):"未記録"}</b></div>
    <div class="chart-line"><span>最新の収穫・灌水・施肥</span><b>${latestOp?esc(latestOp.operation_date||latestOp.date||"記録あり"):"未記録"}</b></div>
    <div class="chart-line"><span>最新の防除</span><b>${latestPest?`${esc(latestPest.spray_date)}｜${esc(latestPest.target_pest)}`:"未記録"}</b></div>
    <div class="chart-line"><span>学習ノート</span><b>${learningNotes.length}件</b></div>
    <div class="chart-line"><span>失敗データ</span><b>${failureRecords.length}件</b></div>
    <p class="notice">同じ日付の草勢・写真・収穫・環境・施肥・防除を重ねて振り返るためのカルテです。記録が増えるほど比較の精度が上がります。</p>`;
}
function renderMaster(){
  if(!$("learningList"))return;
  $("learningCount").textContent=`${learningNotes.length}件`;$("failureCount").textContent=`${failureRecords.length}件`;$("knowledgeCount").textContent=learningNotes.length+failureRecords.length+pestRecords.length;
  $("learningList").innerHTML=learningNotes.length?learningNotes.slice(0,12).map(x=>`<article class="record"><div class="record-head"><strong>${esc(x.note_date)}｜${esc(x.house)}</strong></div><p>${esc(x.learning_text)}</p>${x.evidence_text?`<p class="meta">根拠：${esc(x.evidence_text)}</p>`:""}</article>`).join(""):'<div class="empty">学びはまだありません。</div>';
  $("failureList").innerHTML=failureRecords.length?failureRecords.slice(0,12).map(x=>`<article class="record"><div class="record-head"><strong>${esc(x.event_date)}｜${esc(x.house)}</strong><span class="badge">${esc(x.event_text)}</span></div>${x.cause_text?`<p>原因仮説：${esc(x.cause_text)}</p>`:""}${x.response_text?`<p class="meta">対応・結果：${esc(x.response_text)}</p>`:""}</article>`).join(""):'<div class="empty">失敗・異常の記録はまだありません。</div>';
  renderCultivationChart();
}
if($("learningForm"))$("learningForm").addEventListener("submit",async e=>{e.preventDefault();const rec={id:crypto.randomUUID(),note_date:$("learningDate").value,house:$("learningHouse").value,learning_text:$("learningText").value.trim(),evidence_text:$("learningEvidence").value.trim(),created_at:new Date().toISOString()};try{await saveLearningNote(rec);await loadLearningNotes();renderMaster();e.target.reset();$("learningDate").value=new Date().toISOString().slice(0,10);$("learningStatus").textContent=supabaseClient?"学びをクラウド保存しました":"学びを端末内保存しました";$("learningStatus").classList.add("show")}catch(err){$("learningStatus").textContent="保存できませんでした："+err.message;$("learningStatus").classList.add("show")}});
if($("failureForm"))$("failureForm").addEventListener("submit",async e=>{e.preventDefault();const rec={id:crypto.randomUUID(),event_date:$("failureDate").value,house:$("failureHouse").value,event_text:$("failureEvent").value.trim(),cause_text:$("failureCause").value.trim(),response_text:$("failureResponse").value.trim(),created_at:new Date().toISOString()};try{await saveFailureRecord(rec);await loadFailureRecords();renderMaster();e.target.reset();$("failureDate").value=new Date().toISOString().slice(0,10);$("failureStatus").textContent=supabaseClient?"失敗データをクラウド保存しました":"失敗データを端末内保存しました";$("failureStatus").classList.add("show")}catch(err){$("failureStatus").textContent="保存できませんでした："+err.message;$("failureStatus").classList.add("show")}});

function renderAll(){
  renderPest();
  renderMaster();
  renderEnvironment();
  renderCenter();
  renderDashboardPlus();
  renderHome();
  renderAssistant();
  renderDecision();
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
$("refreshBtn").onclick=async()=>{await loadRecords();await loadOperations();renderAll()};
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
  if(ok){await loadRecords();await loadOperations();renderAll();}
};
$("syncLocalBtn").onclick=async()=>{
  const btn=$("syncLocalBtn");
  btn.disabled=true;btn.textContent="同期中…";
  try{
    initSupabase();
    const ok=await updateBadge(false);
    if(!ok)throw new Error("先に接続を確認してください");
    const result=await syncLocalRecordsToCloud();
    await loadRecords();await loadOperations();renderAll();
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


if($("copyMorningBrief"))$("copyMorningBrief").onclick=()=>{
  const b=buildMorningBriefData();copyTextSafe(`【HARUNO32 朝のブリーフ】\n最優先：${b.priority}\n${b.items.map((x,i)=>`${i+1}. ${x}`).join("\n")}`,"朝のブリーフをコピーしました");
};
if($("copyJournal"))$("copyJournal").onclick=()=>copyTextSafe(cultivationJournalText(),"栽培日誌をコピーしました");
if($("saveTargetSettings"))$("saveTargetSettings").onclick=()=>{
  const data={targetKg:numberOrZero($("targetKg").value)||32000,cropStart:$("cropStart").value,cropEnd:$("cropEnd").value};
  if(!data.cropStart||!data.cropEnd||data.cropEnd<data.cropStart)return alert("栽培期間を正しく入力してください");
  localStorage.setItem(TARGET_KEY,JSON.stringify(data));renderAll();alert("32トン目標設定を保存しました");
};
const ts=targetSettings();
if($("targetKg"))$("targetKg").value=ts.targetKg;
if($("cropStart"))$("cropStart").value=ts.cropStart;
if($("cropEnd"))$("cropEnd").value=ts.cropEnd;



if($("decisionDate"))$("decisionDate").value=new Date().toISOString().slice(0,10);
if($("decisionForm"))$("decisionForm").onsubmit=async e=>{
  e.preventDefault();
  const d={id:crypto.randomUUID(),date:$("decisionDate").value,house:$("decisionHouse").value,action:$("decisionAction").value.trim(),reason:$("decisionReason").value.trim(),result:$("decisionResult").value.trim(),created_at:new Date().toISOString()};
  try{await saveDecision(d);await loadDecisions();e.target.reset();$("decisionDate").value=new Date().toISOString().slice(0,10);$("decisionStatus").textContent=supabaseClient?"判断ログをクラウド保存しました":"判断ログを端末内保存しました";$("decisionStatus").classList.add("show");renderAll();}catch(err){$("decisionStatus").textContent="保存できませんでした："+err.message;$("decisionStatus").classList.add("show")}
};
if($("syncDecisionsBtn"))$("syncDecisionsBtn").onclick=async()=>{try{const n=await syncDecisions();renderAll();alert(`判断ログを同期しました（端末内 ${n}件）`)}catch(e){alert(`同期できませんでした。最新版の supabase_setup.sql を実行してください。\n\n${e.message}`)}};
if($("copyDecisionBrief"))$("copyDecisionBrief").onclick=()=>{const d=decisionEngineData();copyTextSafe(`【HARUNO32 今日の意思決定】\n${d.moves.map((x,i)=>`${i+1}. ${x}`).join("\n")}\n\n【変化アラート】\n${d.alerts.map(x=>`・${x.title}：${x.text}`).join("\n")}`,"判断メモをコピーしました")};

envImports=envLoad();
(async()=>{
  initSupabase();
  const ok=await updateBadge(false);
  if(ok){await loadRecords();await loadOperations();await loadDecisions();await loadPestRecords();await loadLearningNotes();await loadFailureRecords();}
  else{records=localLoad().sort((a,b)=>(b.created_at||"").localeCompare(a.created_at||""));await loadOperations();await loadDecisions();await loadPestRecords();await loadLearningNotes();await loadFailureRecords();}
  renderAll();
})();