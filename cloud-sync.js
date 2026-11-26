/* THƯ CÁ cloud sync — Supabase Auth + per-user JSON library.
   No credentials are embedded in this repository. Configure supabase-config.js. */
(()=>{
 const cfg=window.THUCAS_SUPABASE_CONFIG||{};
 const ready=!!(cfg.url&&cfg.publishableKey&&window.supabase?.createClient);
 let client=null,user=null,pushTimer=null,applyingRemote=false;
 const $=s=>document.querySelector(s);
 const status=msg=>{const el=$("#cloud-sync-status");if(el)el.textContent=msg};
 const bridge=()=>window.THUCAS_DATA_BRIDGE;
 function mergeRecords(local=[],remote=[],tombstones=[]){
  const map=new Map();
  for(const item of [...remote,...local]){
   if(!item?.id)continue;
   const old=map.get(item.id),a=Date.parse(old?.updatedAt||old?.createdAt||0)||0,b=Date.parse(item.updatedAt||item.createdAt||0)||0;
   if(!old||b>=a)map.set(item.id,item);
  }
  const deleted=new Map();
  for(const t of tombstones||[]){const old=deleted.get(t.id);if(!old||Date.parse(t.deletedAt)>Date.parse(old.deletedAt))deleted.set(t.id,t)}
  for(const [id,t] of deleted){const item=map.get(id);if(!item||(Date.parse(t.deletedAt)||0)>=(Date.parse(item.updatedAt||item.createdAt||0)||0))map.delete(id)}
  return [...map.values()];
 }
 function mergeLibrary(local,remote){
  const tombstones=[...(remote.syncTombstones||[]),...(local.syncTombstones||[])];
  const lp=Date.parse(local.progressUpdatedAt||0)||0,rp=Date.parse(remote.progressUpdatedAt||0)||0;
  return {...remote,...local,
   stories:mergeRecords(local.stories,remote.stories,tombstones.filter(x=>x.type==="story")),
   videos:mergeRecords(local.videos,remote.videos,tombstones.filter(x=>x.type==="video")),
   shelf:[...new Set([...(remote.shelf||[]),...(local.shelf||[])])],
   progress:lp>=rp?{...(remote.progress||{}),...(local.progress||{})}:{...(local.progress||{}),...(remote.progress||{})},
   progressUpdatedAt:lp>=rp?(local.progressUpdatedAt||remote.progressUpdatedAt):(remote.progressUpdatedAt||local.progressUpdatedAt),
   syncTombstones:tombstones.filter((t,i,a)=>a.findIndex(x=>x.type===t.type&&x.id===t.id&&x.deletedAt===t.deletedAt)===i).slice(-1000)
  };
 }
 async function init(){
  if(!ready){render();return}
  client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data,error}=await client.auth.getSession();if(error)throw error;
  user=data.session?.user||null;render();
  if(user)await syncNow();
  client.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;render();if(user)setTimeout(()=>syncNow().catch(e=>status("Đồng bộ chưa thành công: "+e.message)),0)});
 }
 function render(){
  const panel=$("#cloud-sync-panel");if(!panel)return;
  if(!ready){panel.innerHTML='<h3>Đồng bộ giữa các thiết bị</h3><p class="page-desc">Đã chuẩn bị phần tích hợp, nhưng chưa có URL và khóa công khai của dự án đồng bộ. Chưa có dữ liệu nào được gửi lên mạng.</p><p id="cloud-sync-status" class="notice">Chờ cấu hình máy chủ.</p>';return}
  if(!user){panel.innerHTML='<h3>Đồng bộ giữa các thiết bị</h3><p class="page-desc">Đăng nhập cùng một tài khoản trên điện thoại và máy tính để dùng chung thư viện.</p><form id="cloud-auth-form"><div class="field"><label>Email</label><input name="email" type="email" required autocomplete="username" placeholder="Email của bà"></div><div class="field"><label>Mật khẩu</label><input name="password" type="password" required minlength="8" autocomplete="current-password" placeholder="Ít nhất 8 ký tự"></div><div class="form-actions"><button class="primary-btn" type="submit">Đăng nhập</button><button class="secondary-btn" type="button" id="cloud-signup">Tạo tài khoản</button></div></form><p id="cloud-sync-status" class="notice">Dữ liệu chưa được đồng bộ.</p>';
   $("#cloud-auth-form")?.addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);status("Đang đăng nhập…");const {error}=await client.auth.signInWithPassword({email:fd.get("email"),password:fd.get("password")});if(error)status("Không đăng nhập được: "+error.message)});
   $("#cloud-signup")?.addEventListener("click",async()=>{const f=$("#cloud-auth-form"),email=f.elements.email.value,password=f.elements.password.value;if(!email||password.length<8){status("Nhập email và mật khẩu tối thiểu 8 ký tự trước nhé.");return}status("Đang tạo tài khoản…");const {data,error}=await client.auth.signUp({email,password});if(error)status("Không tạo được tài khoản: "+error.message);else if(!data.session)status("Đã gửi email xác nhận. Bà xác nhận email rồi quay lại đăng nhập nhé.");else status("Đã tạo tài khoản.")});
   return;
  }
  const safeEmail=String(user.email||"tài khoản THƯ CÁ").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  panel.innerHTML='<h3>Đồng bộ giữa các thiết bị</h3><p class="page-desc">Đang đăng nhập: <b>'+safeEmail+'</b></p><div class="form-actions"><button class="primary-btn" id="cloud-sync-now">Đồng bộ ngay</button><button class="secondary-btn" id="cloud-signout">Đăng xuất</button></div><p id="cloud-sync-status" class="notice">Đã kết nối tài khoản.</p><small class="page-desc">Truyện, chương, ảnh bìa, thông tin video và phụ đề được đồng bộ. Tệp video tải trực tiếp lên thiết bị vẫn nằm riêng trên thiết bị đó.</small>';
  $("#cloud-sync-now")?.addEventListener("click",()=>syncNow().catch(e=>status("Đồng bộ chưa thành công: "+e.message)));
  $("#cloud-signout")?.addEventListener("click",async()=>{await client.auth.signOut();user=null;render();status("Đã đăng xuất.")});
 }
 async function syncNow(){
  if(!user||!client)return;
  const b=bridge();if(!b)throw new Error("Chưa kết nối được dữ liệu THƯ CÁ");
  status("Đang kiểm tra thư viện đám mây…");
  const {data:row,error}=await client.from("thuca_library").select("payload,updated_at").eq("owner_id",user.id).maybeSingle();
  if(error)throw error;
  const local=b.getData();
  if(!row){const {error:e}=await client.from("thuca_library").upsert({owner_id:user.id,payload:local,updated_at:new Date().toISOString()},{onConflict:"owner_id"});if(e)throw e;status("Đã sao lưu thư viện thiết bị này lên đám mây.");return}
  applyingRemote=true;
  try{const merged=mergeLibrary(local,row.payload||{});b.setData(merged);const {error:e}=await client.from("thuca_library").upsert({owner_id:user.id,payload:merged,updated_at:new Date().toISOString()},{onConflict:"owner_id"});if(e)throw e;status("Đã đồng bộ xong. Thư viện đã được hợp nhất.");}
  finally{applyingRemote=false}
 }
 function schedulePush(snapshot){
  if(!ready||!user||!client||applyingRemote)return;
  clearTimeout(pushTimer);pushTimer=setTimeout(async()=>{try{const {error}=await client.from("thuca_library").upsert({owner_id:user.id,payload:snapshot,updated_at:new Date().toISOString()},{onConflict:"owner_id"});if(error)throw error;status("Đã tự đồng bộ lúc "+new Date().toLocaleTimeString("vi-VN"));}catch(e){status("Chưa đồng bộ được: "+e.message)}},1800);
 }
 window.TCCloudSync={init,render,syncNow,schedulePush,get isReady(){return ready},get isApplyingRemote(){return applyingRemote}};
 document.addEventListener("DOMContentLoaded",()=>{init().catch(e=>status("Không kết nối được máy chủ: "+e.message))});
})();
