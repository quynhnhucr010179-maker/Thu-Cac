/* THƯ CÁ — two-way cloud sync for stories, chapters, reading data and video assets.
   Supabase Auth + Postgres JSON library + private Storage bucket. */
(()=> {
 const cfg=window.THUCAS_SUPABASE_CONFIG||{};
 const BUCKET="thuca-videos";
 const ready=!!(cfg.url&&cfg.publishableKey&&window.supabase?.createClient);
 let client=null,user=null,channel=null,pushTimer=null,pollTimer=null,syncPromise=null,applyingRemote=false,pendingPush=false;
 let lastStatus="Đang khởi tạo đồng bộ…";
 const $=s=>document.querySelector(s);
 const bridge=()=>window.THUCAS_DATA_BRIDGE;
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 function status(message){
  lastStatus=message;
  const el=$("#cloud-sync-status");if(el)el.textContent=message;
  const indicator=$("#storage-indicator");
  if(indicator&&user)indicator.textContent=message.startsWith("Đã đồng bộ")?"Đã lưu trên đám mây":"Đã kết nối · "+message;
 }
 function mergeRecords(local=[],remote=[],tombstones=[]){
  const map=new Map();
  for(const item of [...(remote||[]),...(local||[])]){
   if(!item?.id)continue;
   const old=map.get(item.id);
   const a=Date.parse(old?.updatedAt||old?.createdAt||0)||0;
   const b=Date.parse(item.updatedAt||item.createdAt||0)||0;
   if(!old||b>=a)map.set(item.id,item);
  }
  const deleted=new Map();
  for(const t of tombstones||[]){
   if(!t?.id)continue;
   const old=deleted.get(t.id);
   if(!old||(Date.parse(t.deletedAt)||0)>(Date.parse(old.deletedAt)||0))deleted.set(t.id,t);
  }
  for(const [id,t] of deleted){
   const item=map.get(id);
   if(!item||(Date.parse(t.deletedAt)||0)>=(Date.parse(item.updatedAt||item.createdAt||0)||0))map.delete(id);
  }
  return [...map.values()];
 }
 function mergeLibrary(local={},remote={}){
  const tombstones=[...(remote.syncTombstones||[]),...(local.syncTombstones||[])];
  const lp=Date.parse(local.progressUpdatedAt||0)||0,rp=Date.parse(remote.progressUpdatedAt||0)||0;
  const ls=Date.parse(local.shelfUpdatedAt||0)||0,rs=Date.parse(remote.shelfUpdatedAt||0)||0;
  const merged={
   ...remote,...local,
   stories:mergeRecords(local.stories,remote.stories,tombstones.filter(x=>x.type==="story")),
   videos:mergeRecords(local.videos,remote.videos,tombstones.filter(x=>x.type==="video")),
   shelf:ls===0&&rs===0?[...new Set([...(remote.shelf||[]),...(local.shelf||[])])]:ls>=rs?(local.shelf||[]):(remote.shelf||[]),
   progress:lp===0&&rp===0?{...(remote.progress||{}),...(local.progress||{})}:lp>=rp?(local.progress||{}):(remote.progress||{}),
   progressUpdatedAt:lp>=rp?(local.progressUpdatedAt||remote.progressUpdatedAt):(remote.progressUpdatedAt||local.progressUpdatedAt),
   shelfUpdatedAt:ls>=rs?(local.shelfUpdatedAt||remote.shelfUpdatedAt):(remote.shelfUpdatedAt||local.shelfUpdatedAt),
   syncTombstones:tombstones.filter((t,i,a)=>a.findIndex(x=>x.type===t.type&&x.id===t.id&&x.deletedAt===t.deletedAt)===i).slice(-2000)
  };
  return merged;
 }
 function render(){
  const panel=$("#cloud-sync-panel");if(!panel)return;
  if(!ready){
   panel.innerHTML='<h3>Đồng bộ giữa điện thoại và máy tính</h3><p class="page-desc">Chưa tải được thư viện Supabase hoặc thiếu Project URL / Publishable key. Chưa có dữ liệu nào được gửi lên máy chủ.</p><p id="cloud-sync-status" class="notice">'+esc(lastStatus)+'</p>';return;
  }
  if(!user){
   panel.innerHTML='<h3>Đồng bộ giữa điện thoại và máy tính</h3><p class="page-desc">Tạo một tài khoản THƯ CÁ, sau đó đăng nhập đúng tài khoản này trên cả điện thoại và máy tính. Dữ liệu thư viện sẽ dùng chung.</p><form id="cloud-auth-form"><div class="field"><label>Email</label><input name="email" type="email" required autocomplete="username" placeholder="Email của bà"></div><div class="field"><label>Mật khẩu</label><input name="password" type="password" required minlength="8" autocomplete="current-password" placeholder="Ít nhất 8 ký tự"></div><div class="form-actions"><button class="primary-btn" type="submit">Đăng nhập</button><button class="secondary-btn" type="button" id="cloud-signup">Tạo tài khoản</button></div></form><p id="cloud-sync-status" class="notice">'+esc(lastStatus)+'</p><small class="page-desc">Nếu bật xác nhận email trong Supabase, bà cần mở email xác nhận trước khi đăng nhập.</small>';
   $("#cloud-auth-form")?.addEventListener("submit",async e=>{
    e.preventDefault();const fd=new FormData(e.currentTarget);status("Đang đăng nhập…");
    const {error}=await client.auth.signInWithPassword({email:String(fd.get("email")).trim(),password:String(fd.get("password"))});
    if(error)status("Không đăng nhập được: "+error.message);
   });
   $("#cloud-signup")?.addEventListener("click",async()=>{
    const f=$("#cloud-auth-form"),email=f?.elements.email.value.trim(),password=f?.elements.password.value||"";
    if(!email||password.length<8){status("Nhập email và mật khẩu tối thiểu 8 ký tự trước nhé.");return}
    status("Đang tạo tài khoản…");
    const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
    if(error)status("Không tạo được tài khoản: "+error.message);
    else if(!data.session)status("Đã gửi email xác nhận. Xác nhận email rồi quay lại đăng nhập nhé.");
    else status("Đã tạo tài khoản. Đang kết nối thư viện…");
   });
   return;
  }
  panel.innerHTML='<h3>Đồng bộ giữa điện thoại và máy tính</h3><p class="page-desc">Đang đăng nhập: <b>'+esc(user.email||"tài khoản THƯ CÁ")+'</b></p><div class="form-actions"><button class="primary-btn" id="cloud-sync-now">Đồng bộ ngay</button><button class="secondary-btn" id="cloud-signout">Đăng xuất</button></div><p id="cloud-sync-status" class="notice">'+esc(lastStatus)+'</p><small class="page-desc">Truyện, toàn bộ chương, ảnh bìa, tủ sách, tiến độ đọc, thông tin video và phụ đề được đồng bộ. Video tải tệp lên sẽ được đưa vào kho lưu trữ đám mây riêng tư (giới hạn theo cấu hình gói Supabase).</small>';
  $("#cloud-sync-now")?.addEventListener("click",()=>syncNow().catch(e=>status("Đồng bộ chưa thành công: "+e.message)));
  $("#cloud-signout")?.addEventListener("click",async()=>{
   status("Đang đăng xuất…");if(channel){await client.removeChannel(channel);channel=null}
   await client.auth.signOut();user=null;render();status("Đã đăng xuất khỏi THƯ CÁ.");
  });
 }
 async function syncVideoAssets(library){
  const b=bridge(),failed=[];
  if(!b?.getVideoBlob||!user)return failed;
  for(const v of library.videos||[]){
   if(!v.fileStored||v.storagePath)continue;
   try{
    const blob=await b.getVideoBlob(v.id);
    if(!blob)throw new Error("Chưa tìm thấy tệp gốc trên thiết bị đang đồng bộ.");
    if(blob.size>50*1024*1024)throw new Error("Video vượt giới hạn tải lên 50 MB hiện đặt cho THƯ CÁ.");
    const path=user.id+"/"+v.id+"/media";
    const {error}=await client.storage.from(BUCKET).upload(path,blob,{upsert:true,cacheControl:"3600",contentType:blob.type||"video/mp4"});
    if(error)throw error;
    v.storagePath=path;v.updatedAt=new Date().toISOString();
   }catch(e){failed.push(v.title+": "+(e.message||"lỗi tải video"))}
  }
  return failed;
 }
 function stampLegacyRecords(library){
  const now=new Date().toISOString();
  for(const item of [...(library.stories||[]),...(library.videos||[])])if(!item.updatedAt)item.updatedAt=now;
  if((library.shelf||[]).length&&!library.shelfUpdatedAt)library.shelfUpdatedAt=now;
  if(Object.keys(library.progress||{}).length&&!library.progressUpdatedAt)library.progressUpdatedAt=now;
 }
 async function writeMerged(local){
  for(let attempt=0;attempt<4;attempt++){
   const {data:row,error:readError}=await client.from("thuca_library").select("payload,revision,updated_at").eq("owner_id",user.id).maybeSingle();
   if(readError)throw readError;
   const remote=row?.payload||{};
   const merged=mergeLibrary(local,remote);
   stampLegacyRecords(merged);
   const assetErrors=await syncVideoAssets(merged);
   const mergedText=JSON.stringify(merged),remoteText=JSON.stringify(remote);
   if(row&&mergedText===remoteText){
    bridge().setData(merged);
    return {assetErrors,changed:false};
   }
   const now=new Date().toISOString();
   if(!row){
    const {error}=await client.from("thuca_library").insert({owner_id:user.id,payload:merged,revision:1,updated_at:now});
    if(error){
     if(error.code==="23505")continue;
     throw error;
    }
    bridge().setData(merged);
    return {assetErrors,changed:true};
   }
   const revision=Number(row.revision)||1;
   const {data:updated,error}=await client.from("thuca_library").update({payload:merged,revision:revision+1,updated_at:now}).eq("owner_id",user.id).eq("revision",revision).select("revision").maybeSingle();
   if(error)throw error;
   if(!updated)continue;
   bridge().setData(merged);
   return {assetErrors,changed:true};
  }
  throw new Error("Có thay đổi đồng thời trên thiết bị khác. Bấm Đồng bộ ngay để thử hợp nhất lại.");
 }
 async function syncNow(){
  if(!user||!client)return;
  if(syncPromise)return syncPromise;
  syncPromise=(async()=>{
   const b=bridge();if(!b)throw new Error("Chưa kết nối được dữ liệu THƯ CÁ");
   applyingRemote=true;status("Đang tải và hợp nhất dữ liệu từ đám mây…");
   try{
    const result=await writeMerged(b.getData());
    const count=result.assetErrors.length;
    status(count?"Đã đồng bộ truyện và chương; "+count+" video chưa tải lên được. "+result.assetErrors.slice(0,2).join(" | "):"Đã đồng bộ xong. Điện thoại và máy tính đang dùng chung thư viện.");
    return result;
   }finally{applyingRemote=false;if(pendingPush){pendingPush=false;schedulePush()}}
  })();
  try{return await syncPromise}finally{syncPromise=null}
 }
 function schedulePush(){
  if(!ready||!user||!client)return;
  pendingPush=true;clearTimeout(pushTimer);
  if(applyingRemote)return;
  pushTimer=setTimeout(()=>{pendingPush=false;syncNow().catch(e=>status("Chưa đồng bộ được: "+e.message))},1200);
 }
 function subscribe(){
  if(channel){client.removeChannel(channel);channel=null}
  if(!user)return;
  channel=client.channel("thuca-library-"+user.id)
   .on("postgres_changes",{event:"*",schema:"public",table:"thuca_library",filter:"owner_id=eq."+user.id},()=>{
    if(!applyingRemote)syncNow().catch(e=>status("Không nhận được thay đổi mới: "+e.message));
   })
   .subscribe(state=>{if(state==="CHANNEL_ERROR")status("Kết nối cập nhật trực tiếp bị gián đoạn; THƯ CÁ vẫn kiểm tra khi mở lại hoặc quay về tab.")});
 }
 async function init(){
  if(!ready){render();return}
  client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data,error}=await client.auth.getSession();if(error)throw error;
  user=data.session?.user||null;render();
  if(user){try{await syncNow()}catch(e){status("Chưa tải được thư viện ban đầu: "+e.message)}subscribe()}
  client.auth.onAuthStateChange((_event,session)=>{
   user=session?.user||null;render();
   if(user){setTimeout(async()=>{try{await syncNow()}catch(e){status("Đồng bộ chưa thành công: "+e.message)}finally{subscribe()}},0)}
   else{if(channel){client.removeChannel(channel);channel=null}}
  });
  window.addEventListener("focus",()=>{if(user)syncNow().catch(e=>status("Chưa làm mới được dữ liệu: "+e.message))});
  window.addEventListener("online",()=>{if(user)syncNow().catch(e=>status("Chưa kết nối lại được: "+e.message))});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&user)syncNow().catch(e=>status("Chưa làm mới được dữ liệu: "+e.message))});
  pollTimer=setInterval(()=>{if(user&&document.visibilityState==="visible")syncNow().catch(e=>status("Chưa làm mới được dữ liệu: "+e.message))},45000);
 }
 async function getVideoUrl(path){
  if(!user||!client||!path)throw new Error("Video này chưa có bản lưu trên đám mây.");
  const {data,error}=await client.storage.from(BUCKET).createSignedUrl(path,3600);
  if(error)throw error;
  return data.signedUrl;
 }
 window.TCCloudSync={
  init,render,syncNow,schedulePush,getVideoUrl,
  get isReady(){return ready},
  get isConnected(){return !!user},
  get isApplyingRemote(){return applyingRemote}
 };
 document.addEventListener("DOMContentLoaded",()=>{init().catch(e=>status("Không khởi tạo được đồng bộ: "+e.message))});
})();