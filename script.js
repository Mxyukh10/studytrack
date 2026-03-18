"use strict";

const SESSION_KEY = "studytrack_sessions";
const USER_KEY    = "studytrack_user";

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "[]"); }
  catch { return []; }
}
function saveSessions(arr) { localStorage.setItem(SESSION_KEY, JSON.stringify(arr)); }
function addSession(session) { const s=loadSessions(); s.push(session); saveSessions(s); }
function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "{}"); }
  catch { return {}; }
}
function saveUser(user) { localStorage.setItem(USER_KEY, JSON.stringify(user)); }

function initDateBanner() {
  const el = document.getElementById("dateBanner") || document.getElementById("dateBannerText");
  if (!el) return;
  el.textContent = new Date().toLocaleDateString("en-US", {
    weekday:"long", month:"long", day:"numeric", year:"numeric"
  });
}

function initGreeting() {
  if (!window.location.pathname.includes("dashboard")) return;
  const title = document.querySelector(".page-title");
  if (!title) return;
  const h = new Date().getHours();
  const greeting = h<12?"Good morning":h<17?"Good afternoon":h<21?"Good evening":"Good night";
  const user = getUser();
  const name = user.name ? user.name.trim() : "";
  title.innerHTML = name ? `${greeting}, <span>${name}</span>` : greeting;
}

function getStreak() {
  const sessions = loadSessions();
  if (!sessions.length) return 0;
  const dates = [...new Set(sessions.map(s=>s.date))].sort((a,b)=>new Date(b)-new Date(a));
  let streak=0, current=new Date(); current.setHours(0,0,0,0);
  for (let d of dates) {
    const sd=new Date(d); sd.setHours(0,0,0,0);
    const diff=(current-sd)/86400000;
    if (diff===0){streak++;current.setDate(current.getDate()-1);}
    else if (diff===1&&streak===0){streak++;current.setDate(current.getDate()-2);}
    else break;
  }
  return streak;
}
function updateStreakBadge() {
  const el = document.getElementById("sidebarStreak");
  if (el) el.textContent = `${getStreak()} days`;
}

let toastTimer=null;
function showToast(msg) {
  const toast=document.getElementById("toast"), text=document.getElementById("toastMsg");
  if (!toast) return;
  if (text) text.textContent=msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove("show"),2500);
}

function initProfile() {
  // Profile page handles itself — skip
  if (window.location.pathname.includes("profile")) return;
  const saveBtn=document.getElementById("saveProfileBtn");
  if (!saveBtn) return;
  const name=document.getElementById("profileName"),
        age=document.getElementById("profileAge"),
        school=document.getElementById("profileSchool"),
        dg=document.getElementById("profileDailyGoal"),
        wg=document.getElementById("profileWeeklyGoal");
  const user=getUser();
  if(name&&user.name)     name.value=user.name;
  if(age&&user.age)       age.value=user.age;
  if(school&&user.school) school.value=user.school;
  if(dg&&user.dailyGoal)  dg.value=user.dailyGoal;
  if(wg&&user.weeklyGoal) wg.value=user.weeklyGoal;
  saveBtn.addEventListener("click",()=>{
    saveUser({
      name:       name?name.value.trim():"",
      age:        age?age.value.trim():"",
      school:     school?school.value.trim():"",
      dailyGoal:  dg?Number(dg.value):0,
      weeklyGoal: wg?Number(wg.value):0
    });
    showToast("Profile saved ✓"); initGreeting();
  });
}

function initLogPage() {
  const btnSave=document.getElementById("submitSessionBtn");
  if (!btnSave) return;
  const subject=document.getElementById("inputSubject"),
        duration=document.getElementById("inputDuration"),
        questions=document.getElementById("inputQuestions"),
        date=document.getElementById("inputDate"),
        notes=document.getElementById("inputNotes");
  const today=new Date(), past=new Date();
  past.setFullYear(today.getFullYear()-1);
  const todayISO=today.toISOString().slice(0,10);
  date.max=todayISO; date.min=past.toISOString().slice(0,10); date.value=todayISO;
  date.addEventListener("input",()=>{
    if(new Date(date.value)>today){showToast("Invalid date");date.value=todayISO;}
  });
  btnSave.addEventListener("click",()=>{
    if(!subject.value.trim()||!duration.value){showToast("Fill subject and duration");return;}
    const diff=document.querySelector("input[name='difficulty']:checked");
    addSession({
      subject:subject.value.trim(), duration:Number(duration.value),
      questions:Number(questions.value||0), difficulty:diff?diff.value:"Medium",
      date:date.value, notes:notes.value.trim()
    });
    showToast("Session saved ✓");
    subject.value=""; duration.value=""; questions.value=""; notes.value="";
    date.value=todayISO; updateStreakBadge();
  });
}

function initDashboardStats() {
  const sessions=loadSessions(), todayISO=new Date().toISOString().slice(0,10);
  const todaySess=sessions.filter(s=>s.date===todayISO);
  const todayMins=todaySess.reduce((s,x)=>s+x.duration,0);
  const todayQ=todaySess.reduce((s,x)=>s+x.questions,0);
  const hoursEl=document.getElementById("statHoursToday");
  const questEl=document.getElementById("statQuestionsToday");
  const strEl=document.getElementById("statStreak");
  const weekEl=document.getElementById("statWeekHours");
  if(hoursEl) hoursEl.textContent=`${Math.floor(todayMins/60)}h ${todayMins%60}m`;
  if(questEl) questEl.textContent=todayQ;
  if(strEl)   strEl.textContent=getStreak();
  const now=new Date(), dow=(now.getDay()+6)%7;
  const weekStart=new Date(now); weekStart.setDate(now.getDate()-dow); weekStart.setHours(0,0,0,0);
  const weekMins=sessions.filter(s=>new Date(s.date)>=weekStart).reduce((s,x)=>s+x.duration,0);
  if(weekEl){
    const h=Math.floor(weekMins/60),m=weekMins%60;
    weekEl.textContent=m>0?`${h}h ${m}m`:`${h}h`;
  }
  const user=getUser();
  const dailyGoal=Number(user.dailyGoal)||0;
  const weeklyGoal=Number(user.weeklyGoal)||0;
  const dailyText=document.getElementById("dailyGoalText");
  const dailyBar=document.getElementById("dailyGoalProgress");
  if(dailyText) dailyText.textContent=dailyGoal?`${todayMins} / ${dailyGoal} min`:"No goal set";
  if(dailyBar)  dailyBar.style.width=dailyGoal?Math.min((todayMins/dailyGoal)*100,100)+"%":"0%";
  const weeklyText=document.getElementById("weeklyGoalText");
  const weeklyBar=document.getElementById("weeklyGoalProgress");
  if(weeklyText) weeklyText.textContent=weeklyGoal?`${(weekMins/60).toFixed(1)} / ${weeklyGoal} hrs`:"No goal set";
  if(weeklyBar)  weeklyBar.style.width=weeklyGoal?Math.min((weekMins/(weeklyGoal*60))*100,100)+"%":"0%";
}

function initWeeklyChart() {
  const canvas=document.getElementById("weeklyChart");
  if(!canvas) return;
  const sessions=loadSessions(), now=new Date(), dow=(now.getDay()+6)%7;
  const labels=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const data=Array(7).fill(0);
  for(let i=0;i<7;i++){
    const d=new Date(now); d.setDate(now.getDate()-dow+i);
    const iso=d.toISOString().slice(0,10);
    data[i]=sessions.filter(s=>s.date===iso).reduce((sum,s)=>sum+s.duration,0);
  }
  function draw(){
    const dpr=window.devicePixelRatio||1;
    canvas.width=canvas.offsetWidth*dpr;
    canvas.height=canvas.offsetHeight*dpr;
    const ctx=canvas.getContext("2d");
    ctx.scale(dpr,dpr);
    const cW=canvas.offsetWidth, cH=canvas.offsetHeight;
    const pL=36,pR=12,pT=16,pB=38;
    const chartW=cW-pL-pR, chartH=cH-pT-pB;
    const maxVal=Math.max(...data,60);
    const barW=(chartW/7)*0.5;
    ctx.clearRect(0,0,cW,cH);
    for(let i=0;i<=4;i++){
      const y=pT+(chartH/4)*i;
      ctx.beginPath(); ctx.strokeStyle="rgba(255,255,255,0.04)"; ctx.lineWidth=1;
      ctx.moveTo(pL,y); ctx.lineTo(cW-pR,y); ctx.stroke();
      const val=Math.round(maxVal-(maxVal/4)*i);
      ctx.fillStyle="rgba(255,255,255,0.2)"; ctx.font="10px DM Mono,monospace";
      ctx.textAlign="right"; ctx.fillText(val+"m",pL-4,y+4);
    }
    data.forEach((val,i)=>{
      const slotW=chartW/7;
      const x=pL+slotW*i+(slotW-barW)/2;
      const isToday=i===dow;
      const barH=val>0?Math.max((val/maxVal)*chartH,4):2;
      const y=pT+chartH-barH;
      if(val>0){
        const grad=ctx.createLinearGradient(0,y,0,y+barH);
        grad.addColorStop(0,isToday?"rgba(181,242,61,0.95)":"rgba(181,242,61,0.55)");
        grad.addColorStop(1,isToday?"rgba(143,196,46,0.75)":"rgba(143,196,46,0.25)");
        ctx.fillStyle=grad;
        if(isToday){ctx.shadowColor="rgba(181,242,61,0.4)";ctx.shadowBlur=12;}
      } else {
        ctx.fillStyle="rgba(255,255,255,0.05)"; ctx.shadowBlur=0;
      }
      const r=Math.min(4,barH/2);
      ctx.beginPath();
      ctx.moveTo(x+r,y); ctx.lineTo(x+barW-r,y);
      ctx.quadraticCurveTo(x+barW,y,x+barW,y+r);
      ctx.lineTo(x+barW,y+barH); ctx.lineTo(x,y+barH);
      ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur=0;
      if(val>0){
        ctx.fillStyle=isToday?"rgba(181,242,61,0.9)":"rgba(255,255,255,0.4)";
        ctx.font="9px DM Mono,monospace"; ctx.textAlign="center";
        ctx.fillText(val+"m",x+barW/2,y-5);
      }
      if(isToday){
        ctx.beginPath(); ctx.arc(x+barW/2,pT+chartH+18,3,0,Math.PI*2);
        ctx.fillStyle="rgba(181,242,61,0.9)"; ctx.fill();
      }
      ctx.fillStyle=isToday?"rgba(181,242,61,0.9)":"rgba(255,255,255,0.28)";
      ctx.font=`${isToday?"bold ":""}11px DM Mono,monospace`;
      ctx.textAlign="center"; ctx.fillText(labels[i],x+barW/2,cH-pB+20);
    });
  }
  draw();
  window.addEventListener("resize",draw);
}

function initSubjectBreakdown() {
  const container=document.getElementById("subjectBreakdown");
  if(!container) return;
  const sessions=loadSessions();
  if(!sessions.length){
    container.innerHTML=`<p style="color:var(--text-muted);font-size:.82rem;text-align:center;padding:24px 0;opacity:.6">No sessions yet</p>`;
    return;
  }
  const map={};
  sessions.forEach(s=>{
    const key=s.subject||"Unknown";
    if(!map[key]) map[key]={mins:0,count:0};
    map[key].mins+=s.duration; map[key].count++;
  });
  const total=Object.values(map).reduce((s,v)=>s+v.mins,0);
  const sorted=Object.entries(map).sort((a,b)=>b[1].mins-a[1].mins).slice(0,6);
  const COLORS=["#b5f23d","#4dd9e8","#a78bfa","#fb923c","#f87171","#4ade80"];
  container.innerHTML=sorted.map(([subj,data],i)=>{
    const pct=Math.round((data.mins/total)*100);
    const h=Math.floor(data.mins/60),m=data.mins%60;
    const dur=h>0?`${h}h ${m}m`:`${m}m`;
    const avgMins=Math.round(data.mins/data.count);
    return `<div style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;">
        <span style="font-size:.87rem;font-weight:600;color:var(--text-primary)">${subj}</span>
        <span style="font-family:var(--font-mono);font-size:.72rem;color:var(--text-muted)">${dur} · ${data.count} session${data.count!==1?"s":""}</span>
      </div>
      <div style="height:6px;background:var(--bg-base);border-radius:99px;overflow:hidden;border:1px solid var(--border);margin-bottom:3px;">
        <div style="height:100%;width:${pct}%;background:${COLORS[i]};border-radius:99px;transition:width .8s ease;box-shadow:0 0 8px ${COLORS[i]}55"></div>
      </div>
      <div style="font-family:var(--font-mono);font-size:.68rem;color:var(--text-muted);text-align:right">${pct}% · avg ${avgMins}m/session</div>
    </div>`;
  }).join("");
}

function initHeatmap() {
  const container=document.getElementById("heatmapContainer");
  if(!container) return;
  const sessions=loadSessions(), now=new Date();
  const year=now.getFullYear(), month=now.getMonth();
  const totalDays=new Date(year,month+1,0).getDate();
  const firstDayMon=(new Date(year,month,1).getDay()+6)%7;
  const minuteMap={};
  sessions.forEach(s=>{minuteMap[s.date]=(minuteMap[s.date]||0)+s.duration;});
  const DAY_LABELS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  container.innerHTML=`
    <div class="heatmap-month-label">${now.toLocaleString("default",{month:"long",year:"numeric"})}</div>
    <div class="heatmap-weekdays">${DAY_LABELS.map(d=>`<div>${d}</div>`).join("")}</div>
    <div class="heatmap-cells" id="heatmapCells"></div>
    <div class="heatmap-legend">
      <span>Less</span>
      <span class="heatmap-legend-box" style="background:#1e2128;border:1px solid var(--border)"></span>
      <span class="heatmap-legend-box" style="background:#1a4731"></span>
      <span class="heatmap-legend-box" style="background:#1f7a3f"></span>
      <span class="heatmap-legend-box" style="background:#26a641"></span>
      <span>More</span>
    </div>`;
  const cells=document.getElementById("heatmapCells");
  for(let i=0;i<firstDayMon;i++){
    const e=document.createElement("div"); e.className="heatmap-day heatmap-empty"; cells.appendChild(e);
  }
  for(let d=1;d<=totalDays;d++){
    const iso=`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const mins=minuteMap[iso]||0;
    const isToday=iso===now.toISOString().slice(0,10);
    let level=0; if(mins>0)level=1; if(mins>=60)level=2; if(mins>=120)level=3;
    const box=document.createElement("div");
    box.className=`heatmap-day level-${level}${isToday?" heatmap-today":""}`;
    box.title=`${iso}: ${mins} min`;
    const label=document.createElement("span");
    label.className="heatmap-date"; label.textContent=d;
    box.appendChild(label); cells.appendChild(box);
  }
}

document.addEventListener("DOMContentLoaded",()=>{
  initDateBanner(); initGreeting(); initProfile();
  initLogPage(); initDashboardStats(); initWeeklyChart();
  initSubjectBreakdown(); initHeatmap(); updateStreakBadge();
});
