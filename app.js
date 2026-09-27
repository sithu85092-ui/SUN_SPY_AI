// @ts-nocheck
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const BACKEND_URL = "https://sun-spy-ai.onrender.com";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const sidebar = $("#sidebar"), menuButton = $("#menuButton"), headerTitle = $("#headerTitle");
  const messages = $("#messages"), input = $("#messageInput"), sendBtn = $("#sendButton");
  const stopBtn = $("#stopButton"), newChat = $("#newChat"), imageInput = $("#imageInput");
  const attachBtn = $("#attachButton"), preview = $("#attachmentPreview"), status = $("#composerStatus");
  const voiceSend = $("#voiceSendButton"), callBtn = $("#callButton"), historyList = $("#historyList");

  const pageTitles = {chat:"Chat",writer:"Writer",coder:"AI Coder",translate:"Translate",image:"Text to Image",voice:"Voice",video:"AI Video",recap:"Video Recap",music:"Music",settings:"Settings"};
  let mode = localStorage.getItem("sunspy_mode") || "fast";
  let conversation = [];
  let pendingImage = null;
  let abortController = null;
  let typingCancelled = false;
  let recognition = null;
  let speaking = false;

  const defaultAppearance = {theme:"dark", accent:"#7c5cff", fontSize:16, density:"comfortable"};
  const getAppearance = () => JSON.parse(localStorage.getItem("sunspy_appearance") || JSON.stringify(defaultAppearance));
  const saveAppearance = (x) => localStorage.setItem("sunspy_appearance", JSON.stringify(x));

  function toast(text){
    let t=$("#sunspyToast"); if(!t){t=document.createElement("div");t.id="sunspyToast";t.className="sunspy-toast";document.body.appendChild(t)}
    t.textContent=text;t.classList.add("show");clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove("show"),2200);
  }

  function openPage(name){
    $$(".page").forEach(p=>p.classList.remove("active"));
    $$(".nav-item").forEach(n=>n.classList.remove("active"));
    $("#page-"+name)?.classList.add("active");
    document.querySelector(`.nav-item[data-page="${name}"]`)?.classList.add("active");
    if(headerTitle) headerTitle.textContent=pageTitles[name]||name;
    setDrawer?.(false);
  }
  $$(".nav-item").forEach(n=>n.addEventListener("click",()=>openPage(n.dataset.page)));
  const drawerScrim = $("#drawerScrim"), drawerClose = $("#drawerClose");
  function setDrawer(open){
    sidebar?.classList.toggle("open", !!open);
    drawerScrim?.classList.toggle("show", !!open);
    menuButton?.setAttribute("aria-expanded", String(!!open));
    document.body.classList.toggle("drawer-open", !!open);
  }
  menuButton?.addEventListener("click",()=>setDrawer(!sidebar?.classList.contains("open")));
  drawerClose?.addEventListener("click",()=>setDrawer(false));
  drawerScrim?.addEventListener("click",()=>setDrawer(false));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")setDrawer(false);});
  let drawerTouchX=0, drawerTouchY=0;
  document.addEventListener("touchstart",e=>{
    if(!e.touches[0])return;
    drawerTouchX=e.touches[0].clientX; drawerTouchY=e.touches[0].clientY;
  },{passive:true});
  document.addEventListener("touchend",e=>{
    if(!e.changedTouches[0])return;
    const x=e.changedTouches[0].clientX, y=e.changedTouches[0].clientY;
    const dx=x-drawerTouchX, dy=y-drawerTouchY;
    const mobile=window.matchMedia("(max-width:800px)").matches;
    if(!mobile)return;
    if(!sidebar?.classList.contains("open") && drawerTouchX<24 && dx>70 && Math.abs(dy)<70) setDrawer(true);
    if(sidebar?.classList.contains("open") && dx<-70 && Math.abs(dy)<70) setDrawer(false);
  },{passive:true});
  $("#settingsButton")?.addEventListener("click",()=>openPage("settings"));
  $("#historyButton")?.addEventListener("click",()=>openPage("chat"));
  $("#headerSearch")?.addEventListener("click",()=>{
    const q=prompt("Search your saved chats");
    if(!q)return;
    const chats=JSON.parse(localStorage.getItem("sunspy_chats")||"[]");
    const hit=chats.find(c=>String(c.title||"").toLowerCase().includes(q.toLowerCase()) || c.messages?.some(m=>String(m.text||"").toLowerCase().includes(q.toLowerCase())));
    if(hit){loadChat(hit.id);toast("Chat found");}else toast("No matching chat found");
  });
  $("#headerHelp")?.addEventListener("click",()=>toast("Use Enter for a new line • Ctrl/⌘+Enter to send"));

  function escapeHTML(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
  function formatText(v){let h=escapeHTML(v);h=h.replace(/```([\s\S]*?)```/g,(_,c)=>`<pre class="code-block"><code>${c.trim()}</code></pre>`);h=h.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/`([^`]+)`/g,"<code>$1</code>");return h;}
  function scroll(){requestAnimationFrame(()=>messages?.scrollTo({top:messages.scrollHeight,behavior:"smooth"}))}

  function addUser(text,image){
    const el=document.createElement("div");el.className="message user";
    el.innerHTML=`<div class="message-body"><div class="message-text"></div></div>`;
    el.querySelector(".message-text").textContent=text||"";
    if(image){const w=document.createElement("div");w.className="message-attachment";w.innerHTML=`<img src="${image.data}" alt="${escapeHTML(image.name)}"><span>${escapeHTML(image.name)}</span>`;el.querySelector(".message-body").appendChild(w)}
    messages.appendChild(el);scroll();return el;
  }
  function addAI(text=""){
    const el=document.createElement("div");el.className="message ai";el.innerHTML=`<div class="message-avatar">SS</div><div class="message-body"><div class="message-name">SUN SPY AI</div><div class="message-text"></div></div>`;messages.appendChild(el);return el;
  }
  function showTyping(){const el=document.createElement("div");el.className="message ai typing-message";el.innerHTML=`<div class="message-avatar">SS</div><div class="message-body"><div class="message-name">SUN SPY AI</div><div class="typing-dots"><i></i><i></i><i></i></div></div>`;messages.appendChild(el);scroll();return el}

  async function typeText(el,text){
    typingCancelled=false; const target=el.querySelector(".message-text"); target.classList.add("typing-caret");
    for(let i=0;i<text.length;i++){
      if(typingCancelled) break;
      target.innerHTML=formatText(text.slice(0,i+1));
      if(i%3===0) scroll();
      await new Promise(r=>setTimeout(r, mode==="smart"?7:4));
    }
    target.classList.remove("typing-caret");scroll();
  }

  function clearComposer(){pendingImage=null;if(preview){preview.hidden=true;preview.innerHTML=""}if(imageInput)imageInput.value=""}
  async function renderPreview(file){
    if(!file.type.startsWith("image/")){toast("Please choose an image");return}
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{
      const max=1600, scale=Math.min(1,max/Math.max(img.width,img.height));
      const c=document.createElement("canvas"); c.width=Math.max(1,Math.round(img.width*scale)); c.height=Math.max(1,Math.round(img.height*scale));
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      const data=c.toDataURL("image/jpeg",.82); URL.revokeObjectURL(url);
      pendingImage={data,name:file.name.replace(/\.[^.]+$/,".jpg"),mimeType:"image/jpeg"};
      preview.hidden=false; preview.innerHTML=`<div class="attachment-chip"><img src="${data}"><div><b>${escapeHTML(file.name)}</b><small>${Math.round(data.length/1024)} KB · Ready to send</small></div><button type="button" id="removeAttachment">×</button></div>`;
      $("#removeAttachment")?.addEventListener("click",clearComposer);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);toast("Could not read image")}; img.src=url;
  }
  attachBtn?.addEventListener("click",()=>imageInput?.click());
  imageInput?.addEventListener("change",()=>{const f=imageInput.files?.[0];if(!f)return;if(f.size>10*1024*1024){toast("Image is larger than 10 MB");return}renderPreview(f)});

  $$(".mode-button").forEach(b=>{b.classList.toggle("active",b.dataset.mode===mode);b.addEventListener("click",()=>{mode=b.dataset.mode;localStorage.setItem("sunspy_mode",mode);$$(".mode-button").forEach(x=>x.classList.toggle("active",x.dataset.mode===mode));toast(mode==="smart"?"Smart mode enabled":"Fast mode enabled")})});

  function saveCurrentChat(){
    if(!conversation.length)return;
    const chats=JSON.parse(localStorage.getItem("sunspy_chats")||"[]");
    const title=(conversation.find(x=>x.role==="user")?.text||"New chat").slice(0,60);
    const item={id:Date.now(),title,createdAt:new Date().toISOString(),messages:conversation.slice(-60)};
    chats.unshift(item);localStorage.setItem("sunspy_chats",JSON.stringify(chats.slice(0,50)));renderHistory();
  }
  function renderHistory(){if(!historyList)return;const chats=JSON.parse(localStorage.getItem("sunspy_chats")||"[]");historyList.innerHTML=chats.map(c=>`<button class="history-row" data-id="${c.id}"><b>${escapeHTML(c.title)}</b><small>${new Date(c.createdAt).toLocaleString()}</small></button>`).join("");historyList.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>loadChat(Number(b.dataset.id))))}
  function loadChat(id){
    const c=JSON.parse(localStorage.getItem("sunspy_chats")||"[]").find(x=>x.id===id);
    if(!c)return;
    conversation=c.messages||[];
    messages.innerHTML="";
    $("#welcomeHero")?.classList.add("hidden");
    conversation.forEach(m=>m.role==="user"?addUser(m.text,m.image):addAIStatic(m.text));
    openPage("chat");
  }
  function addAIStatic(text){const el=addAI();el.querySelector(".message-text").innerHTML=formatText(text);scroll()}
  function clearMessages(){messages.innerHTML=""}
  function startNewChat(){if(conversation.length)saveCurrentChat();conversation=[];clearMessages();clearComposer();$("#welcomeHero")?.classList.remove("hidden");welcomeGreeting(true);input?.focus();toast("New chat started")}
  newChat?.addEventListener("click",startNewChat);

  function welcomeGreeting(reset=false){
    if(!reset && conversation.length)return;
    $("#welcomeHero")?.classList.remove("hidden");
  }

  function beginConversationUI(){
    $("#welcomeHero")?.classList.add("hidden");
  }

  async function sendMessage(){
    const text=input?.value.trim()||"";
    if(!text && !pendingImage)return;
    if(abortController){toast("Already generating — Stop ကိုနှိပ်ပါ");return}
    const image=pendingImage;
    beginConversationUI();
    input.value="";clearComposer();addUser(text,image);
    conversation.push({role:"user",text:text||"Please analyze this image.",image:image||null});
    const typing=showTyping();status.textContent="Thinking…";sendBtn.disabled=true;stopBtn.hidden=false;abortController=new AbortController();
    try{
      const body={message:text||"Please analyze the uploaded image.",mode,history:conversation.slice(-12).map(x=>({role:x.role,text:x.text})),image:image?{data:image.data.split(",")[1],mimeType:image.mimeType}:null};
      const res=await fetch(BACKEND_URL+"/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:abortController.signal});
      const data=await res.json();if(!res.ok)throw new Error(data.details||data.error||"Backend error");
      typing.remove();if(data.uiCommand)applyUICommand(data.uiCommand);
      const aiText=data.reply||"No response.";conversation.push({role:"model",text:aiText});
      const el=addAI();await typeText(el,aiText);
      speakIfEnabled(aiText);
    }catch(e){typing.remove();if(e.name!=="AbortError"){const el=addAI();el.querySelector(".message-text").innerHTML=`<span class="error-text">${escapeHTML(e.message||"Something went wrong")}</span>`}else{const el=addAI();el.querySelector(".message-text").textContent="Generation stopped."}}
    finally{abortController=null;stopBtn.hidden=true;sendBtn.disabled=false;status.textContent="Ready"}
  }
  sendBtn?.addEventListener("click",sendMessage);
  stopBtn?.addEventListener("click",()=>{typingCancelled=true;abortController?.abort();speechSynthesis?.cancel();status.textContent="Stopped";stopBtn.hidden=true});
  // Keyboard contract: Enter = newline. Ctrl/Cmd + Enter = send.
  input?.addEventListener("keydown",e=>{
    if(e.key==="Enter" && (e.ctrlKey || e.metaKey)){
      e.preventDefault();
      sendMessage();
    }
  });
  input?.addEventListener("input",()=>{
    input.style.height="auto";
    input.style.height=Math.min(input.scrollHeight,150)+"px";
  });

  // Voice input / voice send / voice conversation
  function setupRecognition(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){toast("Voice input is not supported on this browser");return null}
    const r=new SR();r.lang=document.documentElement.lang==="my"?"my-MM":"en-US";r.interimResults=true;r.continuous=false;
    r.onstart=()=>toast("Listening…");r.onresult=e=>{let s="";for(const x of e.results)s+=x[0].transcript;input.value=s};r.onerror=()=>toast("Voice input stopped");return r;
  }
  voiceSend?.addEventListener("click",()=>{if(recognition){recognition.stop();recognition=null;return}recognition=setupRecognition();recognition?.start()});
  function speakIfEnabled(text){if(!$("#autoVoice")?.checked||!window.speechSynthesis)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=/[\u1000-\u109F]/.test(text)?"my-MM":"en-US";speechSynthesis.speak(u)}
  callBtn?.addEventListener("click",()=>{
    speaking=!speaking;
    callBtn.classList.toggle("active",speaking);
    if(speaking){
      if(!recognition) recognition=setupRecognition();
      if(recognition){
        recognition.continuous=true;
        recognition.interimResults=false;
        recognition.onresult=e=>{
          let finalText="";
          for(const r of e.results){if(r.isFinal) finalText+=r[0].transcript+" ";}
          if(finalText.trim()){input.value=finalText.trim();sendMessage();}
        };
        recognition.onend=()=>{if(speaking){try{recognition.start()}catch(_){}}};
        try{recognition.start();toast("Live voice on — speak naturally")}catch(_){toast("Live voice could not start")}
      }
    }else{
      try{recognition?.stop()}catch(_){ }
      recognition=null;
      speechSynthesis?.cancel();
      toast("Live voice off");
    }
  });

  // Appearance and natural UI commands
  function applyAppearance(patch){const x={...getAppearance(),...patch};saveAppearance(x);document.documentElement.dataset.theme=x.theme;document.documentElement.style.setProperty("--accent",x.accent);document.documentElement.style.setProperty("--font-size",x.fontSize+"px");document.documentElement.dataset.density=x.density;if($("#themeSelect"))$("#themeSelect").value=x.theme;if($("#accentColor"))$("#accentColor").value=x.accent;if($("#fontSizeRange"))$("#fontSizeRange").value=x.fontSize;if($("#densitySelect"))$("#densitySelect").value=x.density}
  function applyUICommand(c){
    if(!c)return;
    if(c.action==="theme")applyAppearance({theme:c.value});
    if(c.action==="accent")applyAppearance({accent:c.value});
    if(c.action==="density")applyAppearance({density:c.value});
    if(c.action==="sidebar")setDrawer(c.value==="open");
    if(c.action==="font_size")applyAppearance({fontSize:Number(c.value)});
    if(c.action==="ui_request"){
      if(c.value==="add_button") toast("UI request understood — open Coder to add the exact button safely.");
      if(c.value==="remove_button") toast("UI request understood — open Coder to remove the requested control safely.");
      if(c.value==="set_text") toast("UI text change request understood.");
      if(c.value==="background") toast("UI background request understood.");
      if(c.value==="layout") toast("UI layout request understood.");
    }
  }
  $("#themeSelect")?.addEventListener("change",e=>applyAppearance({theme:e.target.value}));$("#accentColor")?.addEventListener("input",e=>applyAppearance({accent:e.target.value}));$("#fontSizeRange")?.addEventListener("input",e=>applyAppearance({fontSize:Number(e.target.value)}));$("#densitySelect")?.addEventListener("change",e=>applyAppearance({density:e.target.value}));$("#resetAppearance")?.addEventListener("click",()=>applyAppearance(defaultAppearance));

  // Background image/video, kept local unless the user supplies an online URL.
  $("#backgroundUrlButton")?.addEventListener("click",()=>{const u=$("#backgroundUrl")?.value.trim();if(u){document.body.style.setProperty("--user-bg",`url("${u.replace(/"/g,'')}")`);document.body.classList.add("has-user-bg");localStorage.setItem("sunspy_bg_url",u);toast("Online background applied")}});
  $("#backgroundFile")?.addEventListener("change",e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>15*1024*1024){toast("Background video/image must be under 15 MB");return}const u=URL.createObjectURL(f);if(f.type.startsWith("video/")){let v=$("#bgVideo");if(!v){v=document.createElement("video");v.id="bgVideo";v.muted=true;v.autoplay=true;v.loop=true;v.playsInline=true;v.className="background-video";document.body.prepend(v)}v.src=u;document.body.classList.add("has-bg-video")}else{document.body.style.setProperty("--user-bg",`url("${u}")`);document.body.classList.add("has-user-bg")}});
  const oldBg=localStorage.getItem("sunspy_bg_url");if(oldBg){document.body.style.setProperty("--user-bg",`url("${oldBg}")`);document.body.classList.add("has-user-bg")}

  // Feature cards: route users to tools and keep generation providers configurable.
  $$("[data-open-tool]").forEach(b=>b.addEventListener("click",()=>openPage(b.dataset.openTool)));
  $$(".suggestions button").forEach(b=>b.addEventListener("click",()=>{input.value=b.dataset.prompt||"";input.focus()}));

  // AI Coder agent: review -> edit -> apply -> download. Never writes to server automatically.
  const codeInput=$("#codeEditor");
  $("#aiEditCode")?.addEventListener("click",async()=>{
    const instruction=$("#codeInstruction")?.value.trim();const fileName=$("#codeFileName")?.value||"app.js";const code=codeInput?.value||"";
    if(!instruction||!code){toast("Code နဲ့ instruction နှစ်ခုလုံးထည့်ပါ");return}
    const b=$("#aiEditCode");b.disabled=true;b.textContent="AI editing…";
    try{const r=await fetch(BACKEND_URL+"/api/code-edit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fileName,instruction,code,mode})});const d=await r.json();if(!r.ok)throw new Error(d.details||d.error);codeInput.value=d.code;$("#codePreview")&&( $("#codePreview").textContent=d.code );toast("AI code edit ready — review before Apply")}catch(e){toast(e.message||"Code edit failed")}finally{b.disabled=false;b.textContent="✨ AI Edit Code"}
  });
  $("#applyCode")?.addEventListener("click",()=>{if(!codeInput)return;const p=$("#codePreview")?.textContent||"";if(!p){toast("No AI code to apply");return}codeInput.value=p;$("#codeResult")?.setAttribute("hidden","");toast("Applied to editor — review and save/download")});
  $("#downloadCode")?.addEventListener("click",()=>{const name=$("#codeFileName")?.value||"app.js",blob=new Blob([codeInput?.value||""],{type:"text/plain"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href)});
  $("#clearCode")?.addEventListener("click",()=>{if(codeInput)codeInput.value=""});

  // Local history controls
  $("#clearHistory")?.addEventListener("click",()=>{localStorage.removeItem("sunspy_chats");renderHistory();toast("Chat history cleared")});
  $("#exportHistory")?.addEventListener("click",()=>{const b=new Blob([localStorage.getItem("sunspy_chats")||"[]"],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="sunspy-chat-history.json";a.click();URL.revokeObjectURL(a.href)});

  applyAppearance(getAppearance());renderHistory();welcomeGreeting();
});
