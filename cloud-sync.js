/* THƯ CÁ — shared library across all signed-in accounts, with two-way contributions.
   Supabase Auth + shared Postgres JSON library + private Storage bucket. */
(()=> {
 const cfg=window.THUCAS_SUPABASE_CONFIG||{};
 const BUCKET="thuca-videos";
 const ready=!!(cfg.url&&cfg.publishableKey&&window.supabase?.createClient);
 let client=null,user=null,channel=null,pushTimer=null,pollTimer=null,syncPromise=null,applyingRemote=false,pendingPush=false;
 let lastStatus="Đang khởi tạo đồng bộ…",recoveryMode=false;
 const authError=new URLSearchParams(location.search).get("error_code");
 if(authError==="otp_expired")lastStatus="Liên kết xác nhận đã hết hạn hoặc đã được dùng. Hãy quay lại THƯ CÁ, gửi lại email xác nhận/đặt lại mật khẩu và chỉ mở liên kết mới nhất.";
 else if(new URLSearchParams(location.search).get("error")==="access_denied")lastStatus="Liên kết xác thực không còn hợp lệ. Hãy yêu cầu gửi liên kết mới.";
 const PRODUCTION_URL="https://quynhnhucr010179-maker.github.io/Thu-Cac/";
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
 function sharedOnly(value={}){return {stories:Array.isArray(value.stories)?value.stories:[],videos:Array.isArray(value.videos)?value.videos:[],syncTombstones:Array.isArray(value.syncTombstones)?value.syncTombstones:[]}}
 function mergeLibrary(local={},remote={}){
  const tombstones=[...(remote.syncTombstones||[]),...(local.syncTombstones||[])];
  const merged={
   ...remote,...local,
   stories:mergeRecords(local.stories,remote.stories,tombstones.filter(x=>x.type==="story")),
   videos:mergeRecords(local.videos,remote.videos,tombstones.filter(x=>x.type==="video")),
   syncTombstones:tombstones.filter((t,i,a)=>a.findIndex(x=>x.type===t.type&&x.id===t.id&&x.deletedAt===t.deletedAt)===i).slice(-2000)
  };
  return merged;
 }
 function applyTheme(){const theme=user?.user_metadata?.theme||"ocean";document.body.dataset.userTheme=["ocean","mint","lavender","rose","night"].includes(theme)?theme:"ocean"}
 function profile(){return user?.user_metadata||{}}
 async function updateProfile(values){
  if(!user||!client)throw new Error("Bà cần đăng nhập trước.");
  const current=user.user_metadata||{},next={...current,username:String(values.username||"").trim(),display_name:String(values.display_name||"").trim(),theme:["ocean","mint","lavender","rose","night"].includes(values.theme)?values.theme:"ocean"};
  if(values.avatar_data)next.avatar_data=values.avatar_data;
  const {data,error}=await client.auth.updateUser({data:next});if(error)throw error;user=data.user||user;applyTheme();return user;
 }
 function render(){
  applyTheme();
  const panel=$("#cloud-sync-panel");if(!panel)return;
  if(!ready){
   panel.innerHTML='<h3>Đồng bộ giữa điện thoại và máy tính</h3><p class="page-desc">Chưa tải được thư viện Supabase hoặc thiếu Project URL / Publishable key. Chưa có dữ liệu nào được gửi lên máy chủ.</p><p id="cloud-sync-status" class="notice">'+esc(lastStatus)+'</p>';return;
  }
  if(recoveryMode){
   panel.innerHTML='<h3>Đặt mật khẩu mới</h3><p class="page-desc">Nhập mật khẩu mới cho tài khoản THƯ CÁ.</p><form id="cloud-recovery-form"><div class="field"><label>Mật khẩu mới</label><input name="newPassword" type="password" required minlength="8" autocomplete="new-password" placeholder="Ít nhất 8 ký tự"></div><button class="primary-btn" type="submit">Lưu mật khẩu mới</button></form><p id="cloud-sync-status" class="notice">'+esc(lastStatus)+'</p>';
   $("#cloud-recovery-form")?.addEventListener("submit",async e=>{
    e.preventDefault();const password=new FormData(e.currentTarget).get("newPassword");
    status("Đang cập nhật mật khẩu…");
    const {error}=await client.auth.updateUser({password:String(password)});
    if(error){status("Chưa đổi được mật khẩu: "+error.message);return}
    recoveryMode=false;status("Đổi mật khẩu thành công. Đang kết nối tài khoản…");render();
    try{await syncNow()}catch(err){status("Đã đổi mật khẩu nhưng đồng bộ chưa hoàn tất: "+err.message)}
   });
   return;
  }
  if(!user){
   panel.innerHTML='<h3>Tài khoản THƯ CÁ</h3><p class="page-desc">Đăng nhập để dùng tủ sách riêng. Khám phá và Video là thư viện chung.</p><form id="cloud-auth-form"><div class="field"><label>Email</label><input name="email" type="email" required autocomplete="username" placeholder="Email đăng ký"></div><div class="field"><label>Mật khẩu</label><input name="password" type="password" required minlength="8" autocomplete="current-password" placeholder="Ít nhất 8 ký tự"></div><div class="form-actions"><button class="primary-btn" type="submit">Đăng nhập</button><button class="secondary-btn" type="button" id="cloud-signup">Tạo tài khoản</button><button class="secondary-btn" type="button" id="cloud-forgot">Quên mật khẩu</button></div></form><p id="cloud-sync-status" class="notice">'+esc(lastStatus)+'</p><small class="page-desc">Tài khoản đã đăng ký thì đăng nhập; không cần tạo lại tài khoản. Nếu quên mật khẩu, dùng nút Quên mật khẩu.</small>';
   $("#cloud-auth-form")?.addEventListener("submit",async e=>{
    e.preventDefault();const fd=new FormData(e.currentTarget);status("Đang đăng nhập…");
    const {error}=await client.auth.signInWithPassword({email:String(fd.get("email")).trim(),password:String(fd.get("password"))});
    if(error)status(error.message?.toLowerCase().includes("invalid login credentials")?"Email hoặc mật khẩu chưa đúng. Nếu quên mật khẩu, chọn “Quên mật khẩu”.":"Không đăng nhập được: "+error.message);
   });
   $("#cloud-signup")?.addEventListener("click",async()=>{
    const f=$("#cloud-auth-form"),email=f?.elements.email.value.trim(),password=f?.elements.password.value||"";
    if(!email||password.length<8){status("Nhập email và mật khẩu tối thiểu 8 ký tự trước nhé.");return}
    status("Đang tạo tài khoản…");
    const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:PRODUCTION_URL}});
    if(error){const m=String(error.message||"").toLowerCase();status(m.includes("email rate limit exceeded")||m.includes("over_email_send_rate_limit")?"Supabase đã hết hạn mức gửi email miễn phí trong giờ này. Đây không phải lỗi mật khẩu. Bà đừng bấm tạo tài khoản liên tục; hãy chờ hạn mức tự làm mới hoặc cấu hình SMTP riêng để gửi email.": "Không tạo được tài khoản: "+error.message);}
    else if(data.user&&!data.user.identities?.length)status("Email này đã có tài khoản. Bà hãy đăng nhập hoặc chọn “Quên mật khẩu”, không cần đăng ký lại.");
    else if(!data.session)status("Đã gửi email xác nhận. Mở email mới nhất để xác nhận rồi quay lại THƯ CÁ.");
    else status("Đã tạo tài khoản. Đang kết nối thư viện…");
   });
   $("#cloud-forgot")?.addEventListener("click",async()=>{
    const email=$("#cloud-auth-form")?.elements.email.value.trim();
    if(!email){status("Nhập email tài khoản trước rồi bấm Quên mật khẩu.");return}
    status("Đang gửi liên kết đặt lại mật khẩu…");
    const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:PRODUCTION_URL+"?auth=recovery"});
    if(error){const m=String(error.message||"").toLowerCase();status(m.includes("email rate limit exceeded")||m.includes("over_email_send_rate_limit")?"Hệ thống đang hết hạn mức gửi email xác thực/khôi phục trong giờ này. Hãy chờ hạn mức làm mới hoặc cấu hình SMTP riêng.":"Chưa gửi được email đặt lại mật khẩu: "+error.message);}
    else status("Nếu email đã đăng ký, Supabase sẽ gửi liên kết đặt lại mật khẩu. Hãy mở email mới nhất và dùng liên kết một lần.");
   });
   return;
  }
  const meta=user.user_metadata||{};
  panel.innerHTML='<h3>Tài khoản THƯ CÁ</h3><p class="page-desc">Đang đăng nhập: <b>'+esc(user.email||"tài khoản THƯ CÁ")+'</b></p><p class="page-desc">Tên tài khoản: <b>@'+esc(meta.username||"chưa đặt")+'</b> · Tên hiển thị: <b>'+esc(meta.display_name||"chưa đặt")+'</b></p><p class="page-desc">Khám phá và Video là thư viện chung. Tủ sách và tiến độ đọc được lưu riêng cho tài khoản này.</p><div class="form-actions"><button class="primary-btn" id="cloud-sync-now">Đồng bộ ngay</button><button class="secondary-btn" id="cloud-signout">Đăng xuất</button></div><p id="cloud-sync-status" class="notice">'+esc(lastStatus)+'</p><small class="page-desc">Ảnh đại diện, tên hiển thị và màu sắc giao diện được lưu trong hồ sơ tài khoản này.</small>';
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
 }
 async function writeMerged(local){
  for(let attempt=0;attempt<4;attempt++){
   const {data:row,error:readError}=await client.from("thuca_shared_library").select("payload,revision,updated_at").eq("id","global").maybeSingle();
   if(readError)throw readError;
   const sharedLocal=sharedOnly(local);
   const remote=sharedOnly(row?.payload||{});
   const merged=mergeLibrary(sharedLocal,remote);
   stampLegacyRecords(merged);
   const assetErrors=await syncVideoAssets(merged);
   const mergedText=JSON.stringify(merged),remoteText=JSON.stringify(remote);
   if(row&&mergedText===remoteText){
    bridge().setData(merged);
    return {assetErrors,changed:false};
   }
   const now=new Date().toISOString();
   if(!row){
    const {error}=await client.from("thuca_shared_library").insert({id:"global",payload:merged,revision:1,updated_at:now});
    if(error){
     if(error.code==="23505")continue;
     throw error;
    }
    bridge().setData(merged);
    return {assetErrors,changed:true};
   }
   const revision=Number(row.revision)||1;
   const {data:updated,error}=await client.from("thuca_shared_library").update({payload:merged,revision:revision+1,updated_at:now}).eq("id","global").eq("revision",revision).select("revision").maybeSingle();
   if(error)throw error;
   if(!updated)continue;
   bridge().setData(merged);
   return {assetErrors,changed:true};
  }
  throw new Error("Có thay đổi đồng thời trên thiết bị khác. Bấm Đồng bộ ngay để thử hợp nhất lại.");
 }
 async function syncPersonal(){
  if(!user||!client)return;
  const b=bridge();if(!b?.getPersonalData||!b?.setPersonalData)return;
  const markerKey="thuca.personal.owner",marker=localStorage.getItem(markerKey);
  const {data:row,error}=await client.from("thuca_user_library").select("payload,revision,updated_at").eq("owner_id",user.id).maybeSingle();
  if(error)throw error;
  if(row){
   const remote=row.payload||{shelf:[],progress:{}},local=b.getPersonalData();
   if(marker!==user.id){
    b.setPersonalData(remote);
    localStorage.setItem(markerKey,user.id);
    return;
   }
   const remoteTime=Date.parse(remote.updatedAt||row.updated_at||0)||0;
   const localTime=Date.parse(local.updatedAt||0)||0;
   if(localTime>remoteTime){
    const {data:updated,error:updateError}=await client.from("thuca_user_library").update({payload:local,revision:(Number(row.revision)||1)+1,updated_at:new Date().toISOString()}).eq("owner_id",user.id).eq("revision",Number(row.revision)||1).select("owner_id").maybeSingle();
    if(updateError)throw updateError;
    if(!updated)throw new Error("Dữ liệu cá nhân vừa thay đổi ở thiết bị khác. Hãy đồng bộ lại.");
   }else b.setPersonalData(remote);
   localStorage.setItem(markerKey,user.id);
   return;
  }
  const initial=marker&&marker!==user.id?{shelf:[],progress:{},updatedAt:new Date().toISOString()}:b.getPersonalData();
  const {error:insertError}=await client.from("thuca_user_library").insert({owner_id:user.id,payload:initial,revision:1,updated_at:new Date().toISOString()});
  if(insertError&&insertError.code!=="23505")throw insertError;
  if(insertError?.code==="23505")return syncPersonal();
  b.setPersonalData(initial);
  localStorage.setItem(markerKey,user.id);
 }
 async function syncNow(){
  if(!user||!client)return;
  if(syncPromise)return syncPromise;
  syncPromise=(async()=>{
   const b=bridge();if(!b)throw new Error("Chưa kết nối được dữ liệu THƯ CÁ");
   applyingRemote=true;status("Đang tải và hợp nhất dữ liệu từ đám mây…");
   try{
    const result=await writeMerged(b.getData());
    await syncPersonal();
    const count=result.assetErrors.length;
    status(count?"Đã đồng bộ truyện và chương; "+count+" video chưa tải lên được. "+result.assetErrors.slice(0,2).join(" | "):"Đã đồng bộ xong. Mọi tài khoản THƯ CÁ đang dùng chung thư viện.");
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
  channel=client.channel("thuca-shared-library-global")
   .on("postgres_changes",{event:"*",schema:"public",table:"thuca_shared_library"},()=>{
    if(!applyingRemote)syncNow().catch(e=>status("Không nhận được thay đổi mới: "+e.message));
   })
   .on("postgres_changes",{event:"*",schema:"public",table:"thuca_user_library",filter:"owner_id=eq."+user.id},()=>{if(!applyingRemote)syncNow().catch(e=>status("Không nhận được thay đổi cá nhân: "+e.message))})
   .subscribe(state=>{if(state==="CHANNEL_ERROR")status("Kết nối cập nhật trực tiếp bị gián đoạn; THƯ CÁ vẫn kiểm tra khi mở lại hoặc quay về tab.")});
 }
 async function init(){
  if(!ready){render();return}
  client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  if(authError){history.replaceState({},document.title,location.pathname);}
  const {data,error}=await client.auth.getSession();if(error)throw error;
  user=data.session?.user||null;render();
  if(user){try{await syncNow()}catch(e){status("Chưa tải được thư viện ban đầu: "+e.message)}subscribe()}
  client.auth.onAuthStateChange((_event,session)=>{
   if(_event==="PASSWORD_RECOVERY"){recoveryMode=true;user=session?.user||null;render();return}
   if(_event==="SIGNED_OUT")recoveryMode=false;
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
  init,render,syncNow,schedulePush,getVideoUrl,updateProfile,
  get profile(){return profile()},
  get accountLabel(){return user?.email||"Tài khoản THƯ CÁ"},
  get isReady(){return ready},
  get isConnected(){return !!user},
  get isApplyingRemote(){return applyingRemote}
 };
 document.addEventListener("DOMContentLoaded",()=>{init().catch(e=>status("Không khởi tạo được đồng bộ: "+e.message))});
})();