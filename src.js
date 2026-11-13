import { createClient } from "@supabase/supabase-js";

// Add your Supabase project values here after following README.md.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const $ = (id) => document.getElementById(id);
const initialState = () => ({
  day: 1, money: 850000, maxAge: 14, alexAge: 0,
  events: [{time:"Начало истории", text:"Семья Вебер начинает новую главу. Александр только родился."}],
  chat: []
});
let state = initialState(), roomCode = "", player = null, channel = null, localMode = !supabase;
const savedRoom = localStorage.getItem("lw_room");
const savedRole = localStorage.getItem("lw_role");
if (savedRole) $("playerRole").value = savedRole;

function render(){
  $("money").textContent = "€ " + Number(state.money).toLocaleString("de-DE");
  $("day").textContent = "День " + state.day;
  $("maxAge").textContent = state.maxAge + (state.maxAge===1?" год":" лет");
  $("alexAge").textContent = state.alexAge + (state.alexAge===1?" год":" лет");
  $("players").textContent = localMode ? "1 · демо" : "2 места";
  $("eventList").innerHTML = state.events.slice(0,12).map(e=>`<div class="event"><small>${escapeHtml(e.time)}</small>${escapeHtml(e.text)}</div>`).join("");
  $("chatLog").innerHTML = state.chat.slice(-12).map(m=>`<div class="chat-message"><b>${escapeHtml(m.name)}:</b>${escapeHtml(m.text)}</div>`).join("");
  $("chatLog").scrollTop = $("chatLog").scrollHeight;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function stamp(){return "День "+state.day;}
function addEvent(text){state.events.unshift({time:stamp(),text});saveState();}
async function saveState(){
  render();
  if(supabase && roomCode){
    const {error}=await supabase.from("game_rooms").upsert({room_code:roomCode,state,updated_at:new Date().toISOString()},{onConflict:"room_code"});
    if(error) $("connection").textContent="Ошибка синхронизации";
  } else localStorage.setItem("lw_demo_state",JSON.stringify(state));
}
async function enterRoom(code, created=false){
  roomCode=code.toUpperCase(); player={name:$("playerName").value.trim()||"Игрок",role:$("playerRole").value};
  localStorage.setItem("lw_room",roomCode);localStorage.setItem("lw_role",player.role);
  if(supabase){
    const {data,error}=await supabase.from("game_rooms").select("state").eq("room_code",roomCode).maybeSingle();
    if(error){$("setupError").textContent="Не удалось подключиться к комнате. Проверь SQL и настройки Supabase.";return;}
    if(data?.state) state=data.state;
    else if(created){state=initialState();await saveState();}
    else {$("setupError").textContent="Комната не найдена. Проверь код.";return;}
    channel=supabase.channel("room-"+roomCode).on("postgres_changes",{event:"UPDATE",schema:"public",table:"game_rooms",filter:"room_code=eq."+roomCode},payload=>{
      if(payload.new?.state){state=payload.new.state;render();}
    }).subscribe(status=>$("connection").textContent=status==="SUBSCRIBED"?"Онлайн · синхронизация":"Подключение...");
    localMode=false;
  }else{
    localMode=true;
    state=JSON.parse(localStorage.getItem("lw_demo_state")||"null")||initialState();
    $("connection").textContent="Демо · одно устройство";
  }
  $("setup").hidden=true;$("game").hidden=false;
  $("greeting").textContent="Привет, "+player.name+"!";
  $("roomLabel").textContent="Комната: "+roomCode+" · Персонаж: "+(player.role==="maxim"?"Максим Вебер":"Александр Вебер");
  render();
}
$("createRoom").onclick=()=>enterRoom(Math.random().toString(36).slice(2,8).toUpperCase(),true);
$("joinRoom").onclick=()=>{const c=$("roomInput").value.trim();if(c.length<4){$("setupError").textContent="Введи код комнаты.";return;}enterRoom(c,false);};
$("leave").onclick=()=>{if(channel&&supabase)supabase.removeChannel(channel);channel=null;$("game").hidden=true;$("setup").hidden=false;};
document.querySelectorAll("[data-action]").forEach(btn=>btn.onclick=()=>{
  const a=btn.dataset.action;
  if(a==="family") addEvent(player.name+" провёл время с семьёй.");
  if(a==="football") addEvent("Семья обсудила будущую футбольную мечту Александра. Запись в секцию пока не оформлена.");
  if(a==="school") addEvent(player.name+" занялся образованием и развитием.");
  if(a==="advance"){state.day++; if(state.day%365===0){state.maxAge++;state.alexAge++;} addEvent("Наступил новый игровой день.");}
});
$("sendChat").onclick=async()=>{const text=$("chatInput").value.trim();if(!text)return;state.chat.push({name:player.name,text});$("chatInput").value="";await saveState();};
if(savedRoom){$("roomInput").value=savedRoom;}
render();
