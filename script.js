"use strict";

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://dvsvomzikboccrqmsnpj.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_J1wtt_ykvjyMShnrLXgZUQ_he7cIo0E'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ─── Auth: sign in anonymously on first visit ────────────────────────────────
async function ensureUser() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    await supabase.auth.signInAnonymously()
  }
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ─── Sessions ────────────────────────────────────────────────────────────────
async function loadSessions() {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('date', { ascending: false })
  if (error) { console.error('loadSessions:', error); return []; }
  // Normalise field names to match existing UI expectations
  return (data || []).map(s => ({
    ...s,
    duration:  s.duration_minutes,
    questions: s.questions_solved,
    difficulty: capitalise(s.difficulty)
  }))
}

async function addSession(session) {
  const user = await ensureUser()
  const { error } = await supabase.from('sessions').insert({
    user_id:          user.id,
    subject:          session.subject,
    duration_minutes: session.duration,
    questions_solved: session.questions || 0,
    difficulty:       session.difficulty ? session.difficulty.toLowerCase() : 'medium',
    date:             session.date,
    notes:            session.notes || ''
  })
  if (error) console.error('addSession:', error)
}

async function deleteSession(id) {
  const { error } = await supabase.from('sessions').delete().eq('id', id)
  if (error) console.error('deleteSession:', error)
}

// ─── Profile ─────────────────────────────────────────────────────────────────
async function getUser() {
  const authUser = await ensureUser()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .single()
  if (error || !data) return {}
  return {
    name:        data.name || '',
    age:         data.age || '',
    school:      data.school || '',
    dailyGoal:   data.daily_goal_minutes || 0,
    weeklyGoal:  data.weekly_goal_hours || 0
  }
}

async function saveUser(user) {
  const authUser = await ensureUser()
  const { error } = await supabase.from('profiles').upsert({
    id:                  authUser.id,
    name:                user.name || '',
    age:                 user.age ? Number(user.age) : null,
    school:              user.school || '',
    daily_goal_minutes:  user.dailyGoal ? Number(user.dailyGoal) : 0,
    weekly_goal_hours:   user.weeklyGoal ? Number(user.weeklyGoal) : 0
  })
  if (error) console.error('saveUser:', error)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function capitalise(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

function initDateBanner() {
  const el = document.getElementById("dateBanner") || document.getElementById("dateBannerText")
  if (!el) return
  el.textContent = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  })
}

async function initGreeting() {
  if (!window.location.pathname.includes("dashboard")) return
  const title = document.querySelector(".page-title")
  if (!title) return
  const h = new Date().getHours()
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : h < 21 ? "Good evening" : "Good night"
  const user = await getUser()
  const name = user.name ? user.name.trim() : ""
  title.innerHTML = name ? `${greeting}, <span>${name}</span>` : greeting
}

function getStreak(sessions) {
  if (!sessions.length) return 0
  const dates = [...new Set(sessions.map(s => s.date))].sort((a, b) => new Date(b) - new Date(a))
  let streak = 0, current = new Date(); current.setHours(0, 0, 0, 0)
  for (let d of dates) {
    const sd = new Date(d); sd.setHours(0, 0, 0, 0)
    const diff = (current - sd) / 86400000
    if (diff === 0) { streak++; current.setDate(current.getDate() - 1) }
    else if (diff === 1 && streak === 0) { streak++; current.setDate(current.getDate() - 2) }
    else break
  }
  return streak
}

async function updateStreakBadge() {
  const el = document.getElementById("sidebarStreak")
  if (!el) return
  const sessions = await loadSessions()
  el.textContent = `${getStreak(sessions)} days`
}

let toastTimer = null
function showToast(msg) {
  const toast = document.getElementById("toast"), text = document.getElementById("toastMsg")
  if (!toast) return
  if (text) text.textContent = msg
  toast.classList.add("show")
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2500)
}

// ─── Profile page ─────────────────────────────────────────────────────────────
async function initProfile() {
  const saveBtn = document.getElementById("saveProfileBtn")
  if (!saveBtn) return
  const nameEl   = document.getElementById("profileName")
  const ageEl    = document.getElementById("profileAge")
  const schoolEl = document.getElementById("profileSchool")
  const dgEl     = document.getElementById("profileDailyGoal")
  const wgEl     = document.getElementById("profileWeeklyGoal")

  const user = await getUser()
  if (nameEl && user.name)       nameEl.value   = user.name
  if (ageEl && user.age)         ageEl.value    = user.age
  if (schoolEl && user.school)   schoolEl.value = user.school
  if (dgEl && user.dailyGoal)    dgEl.value     = user.dailyGoal
  if (wgEl && user.weeklyGoal)   wgEl.value     = user.weeklyGoal

  // Profile summary
  const fillSummary = (u) => {
    const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val || '—' }
    set('summaryName', u.name); set('summaryAge', u.age)
    set('summarySchool', u.school)
    set('summaryDaily', u.dailyGoal ? u.dailyGoal + ' min' : '')
    set('summaryWeekly', u.weeklyGoal ? u.weeklyGoal + ' hrs' : '')
  }
  fillSummary(user)

  saveBtn.addEventListener("click", async () => {
    const updated = {
      name:       nameEl ? nameEl.value.trim() : '',
      age:        ageEl ? ageEl.value.trim() : '',
      school:     schoolEl ? schoolEl.value.trim() : '',
      dailyGoal:  dgEl ? Number(dgEl.value) : 0,
      weeklyGoal: wgEl ? Number(wgEl.value) : 0
    }
    await saveUser(updated)
    fillSummary(updated)
    showToast("Profile saved ✓")
    initGreeting()
  })

  // Danger zone - reset all data
  const resetBtn = document.getElementById("resetDataBtn")
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      if (!confirm("This will permanently delete all your sessions and profile data. Are you sure?")) return
      const authUser = await ensureUser()
      await supabase.from('sessions').delete().eq('user_id', authUser.id)
      await supabase.from('profiles').delete().eq('id', authUser.id)
      showToast("All data deleted")
      setTimeout(() => window.location.reload(), 1000)
    })
  }
}

// ─── Log Session page ─────────────────────────────────────────────────────────
function initLogPage() {
  const btnSave = document.getElementById("submitSessionBtn")
  if (!btnSave) return
  const subject   = document.getElementById("inputSubject")
  const duration  = document.getElementById("inputDuration")
  const questions = document.getElementById("inputQuestions")
  const date      = document.getElementById("inputDate")
  const notes     = document.getElementById("inputNotes")
  const today     = new Date(), past = new Date()
  past.setFullYear(today.getFullYear() - 1)
  const todayISO  = today.toISOString().slice(0, 10)
  date.max = todayISO; date.min = past.toISOString().slice(0, 10); date.value = todayISO
  date.addEventListener("input", () => {
    if (new Date(date.value) > today) { showToast("Invalid date"); date.value = todayISO }
  })

  // Live preview updates
  const previewFields = {
    subject:    document.getElementById("previewSubject"),
    duration:   document.getElementById("previewDuration"),
    questions:  document.getElementById("previewQuestions"),
    difficulty: document.getElementById("previewDifficulty"),
    date:       document.getElementById("previewDate")
  }
  const updatePreview = () => {
    if (previewFields.subject)    previewFields.subject.textContent    = subject?.value.trim() || '—'
    if (previewFields.duration)   previewFields.duration.textContent   = duration?.value ? duration.value + ' min' : '—'
    if (previewFields.questions)  previewFields.questions.textContent  = questions?.value || '0'
    if (previewFields.date)       previewFields.date.textContent       = date?.value || '—'
    const diff = document.querySelector("input[name='difficulty']:checked")
    if (previewFields.difficulty && diff) previewFields.difficulty.textContent = capitalise(diff.value)
  }
  ;[subject, duration, questions, date, notes].forEach(el => el?.addEventListener('input', updatePreview))
  document.querySelectorAll("input[name='difficulty']").forEach(r => r.addEventListener('change', updatePreview))

  btnSave.addEventListener("click", async () => {
    if (!subject.value.trim() || !duration.value) { showToast("Fill subject and duration"); return }
    btnSave.disabled = true; btnSave.textContent = "Saving..."
    const diff = document.querySelector("input[name='difficulty']:checked")
    await addSession({
      subject:    subject.value.trim(),
      duration:   Number(duration.value),
      questions:  Number(questions.value || 0),
      difficulty: diff ? diff.value : "Medium",
      date:       date.value,
      notes:      notes.value.trim()
    })
    showToast("Session saved ✓")
    subject.value = ""; duration.value = ""; questions.value = ""; notes.value = ""
    date.value = todayISO
    btnSave.disabled = false; btnSave.textContent = "Save Session"
    updatePreview()
    updateStreakBadge()
  })
}

// ─── Dashboard stats ──────────────────────────────────────────────────────────
async function initDashboardStats() {
  const sessions  = await loadSessions()
  const todayISO  = new Date().toISOString().slice(0, 10)
  const todaySess = sessions.filter(s => s.date === todayISO)
  const todayMins = todaySess.reduce((s, x) => s + x.duration, 0)
  const todayQ    = todaySess.reduce((s, x) => s + x.questions, 0)

  const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val }
  set("statHoursToday", `${Math.floor(todayMins / 60)}h ${todayMins % 60}m`)
  set("statQuestionsToday", todayQ)
  set("statStreak", getStreak(sessions))

  const now = new Date(), dow = (now.getDay() + 6) % 7
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - dow); weekStart.setHours(0, 0, 0, 0)
  const weekMins = sessions.filter(s => new Date(s.date) >= weekStart).reduce((s, x) => s + x.duration, 0)
  const wh = Math.floor(weekMins / 60), wm = weekMins % 60
  set("statWeekHours", wm > 0 ? `${wh}h ${wm}m` : `${wh}h`)

  const user = await getUser()
  const dailyGoal  = Number(user.dailyGoal) || 0
  const weeklyGoal = Number(user.weeklyGoal) || 0

  const dailyText = document.getElementById("dailyGoalText")
  const dailyBar  = document.getElementById("dailyGoalProgress")
  if (dailyText) dailyText.textContent = dailyGoal ? `${todayMins} / ${dailyGoal} min` : "No goal set"
  if (dailyBar)  dailyBar.style.width  = dailyGoal ? Math.min((todayMins / dailyGoal) * 100, 100) + "%" : "0%"

  const weeklyText = document.getElementById("weeklyGoalText")
  const weeklyBar  = document.getElementById("weeklyGoalProgress")
  if (weeklyText) weeklyText.textContent = weeklyGoal ? `${(weekMins / 60).toFixed(1)} / ${weeklyGoal} hrs` : "No goal set"
  if (weeklyBar)  weeklyBar.style.width  = weeklyGoal ? Math.min((weekMins / (weeklyGoal * 60)) * 100, 100) + "%" : "0%"

  initWeeklyChart(sessions)
  initSubjectBreakdown(sessions)
  initHeatmap(sessions)
}

// ─── Weekly chart ─────────────────────────────────────────────────────────────
function initWeeklyChart(sessions) {
  const canvas = document.getElementById("weeklyChart")
  if (!canvas) return
  const now = new Date(), dow = (now.getDay() + 6) % 7
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const data = Array(7).fill(0)
  for (let i = 0; i < 7; i++) {
    const d = new Date(now); d.setDate(now.getDate() - dow + i)
    const iso = d.toISOString().slice(0, 10)
    data[i] = sessions.filter(s => s.date === iso).reduce((sum, s) => sum + s.duration, 0)
  }
  function draw() {
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvas.offsetWidth * dpr; canvas.height = canvas.offsetHeight * dpr
    const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr)
    const cW = canvas.offsetWidth, cH = canvas.offsetHeight
    const pL = 36, pR = 12, pT = 16, pB = 38
    const chartW = cW - pL - pR, chartH = cH - pT - pB
    const maxVal = Math.max(...data, 60)
    const barW = (chartW / 7) * 0.5
    ctx.clearRect(0, 0, cW, cH)
    for (let i = 0; i <= 4; i++) {
      const y = pT + (chartH / 4) * i
      ctx.beginPath(); ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1
      ctx.moveTo(pL, y); ctx.lineTo(cW - pR, y); ctx.stroke()
      const val = Math.round(maxVal - (maxVal / 4) * i)
      ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.font = "10px DM Mono,monospace"
      ctx.textAlign = "right"; ctx.fillText(val + "m", pL - 4, y + 4)
    }
    data.forEach((val, i) => {
      const slotW = chartW / 7
      const x = pL + slotW * i + (slotW - barW) / 2
      const isToday = i === dow
      const barH = val > 0 ? Math.max((val / maxVal) * chartH, 4) : 2
      const y = pT + chartH - barH
      if (val > 0) {
        const grad = ctx.createLinearGradient(0, y, 0, y + barH)
        grad.addColorStop(0, isToday ? "rgba(181,242,61,0.95)" : "rgba(181,242,61,0.55)")
        grad.addColorStop(1, isToday ? "rgba(143,196,46,0.75)" : "rgba(143,196,46,0.25)")
        ctx.fillStyle = grad
        if (isToday) { ctx.shadowColor = "rgba(181,242,61,0.4)"; ctx.shadowBlur = 12 }
      } else { ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.shadowBlur = 0 }
      const r = Math.min(4, barH / 2)
      ctx.beginPath()
      ctx.moveTo(x + r, y); ctx.lineTo(x + barW - r, y)
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + r)
      ctx.lineTo(x + barW, y + barH); ctx.lineTo(x, y + barH)
      ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0
      if (val > 0) {
        ctx.fillStyle = isToday ? "rgba(181,242,61,0.9)" : "rgba(255,255,255,0.4)"
        ctx.font = "9px DM Mono,monospace"; ctx.textAlign = "center"
        ctx.fillText(val + "m", x + barW / 2, y - 5)
      }
      if (isToday) {
        ctx.beginPath(); ctx.arc(x + barW / 2, pT + chartH + 18, 3, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(181,242,61,0.9)"; ctx.fill()
      }
      ctx.fillStyle = isToday ? "rgba(181,242,61,0.9)" : "rgba(255,255,255,0.28)"
      ctx.font = `${isToday ? "bold " : ""}11px DM Mono,monospace`
      ctx.textAlign = "center"; ctx.fillText(labels[i], x + barW / 2, cH - pB + 20)
    })
  }
  draw(); window.addEventListener("resize", draw)
}

// ─── Subject breakdown ────────────────────────────────────────────────────────
function initSubjectBreakdown(sessions) {
  const container = document.getElementById("subjectBreakdown")
  if (!container) return
  if (!sessions.length) {
    container.innerHTML = `<p style="color:var(--text-muted);font-size:.82rem;text-align:center;padding:24px 0;opacity:.6">No sessions yet</p>`
    return
  }
  const map = {}
  sessions.forEach(s => {
    const key = s.subject || "Unknown"
    if (!map[key]) map[key] = { mins: 0, count: 0 }
    map[key].mins += s.duration; map[key].count++
  })
  const total = Object.values(map).reduce((s, v) => s + v.mins, 0)
  const sorted = Object.entries(map).sort((a, b) => b[1].mins - a[1].mins).slice(0, 6)
  const COLORS = ["#b5f23d", "#4dd9e8", "#a78bfa", "#fb923c", "#f87171", "#4ade80"]
  container.innerHTML = sorted.map(([subj, data], i) => {
    const pct = Math.round((data.mins / total) * 100)
    const h = Math.floor(data.mins / 60), m = data.mins % 60
    const dur = h > 0 ? `${h}h ${m}m` : `${m}m`
    const avgMins = Math.round(data.mins / data.count)
    return `<div style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;">
        <span style="font-size:.87rem;font-weight:600;color:var(--text-primary)">${subj}</span>
        <span style="font-family:var(--font-mono);font-size:.72rem;color:var(--text-muted)">${dur} · ${data.count} session${data.count !== 1 ? "s" : ""}</span>
      </div>
      <div style="height:6px;background:var(--bg-base);border-radius:99px;overflow:hidden;border:1px solid var(--border);margin-bottom:3px;">
        <div style="height:100%;width:${pct}%;background:${COLORS[i]};border-radius:99px;transition:width .8s ease;box-shadow:0 0 8px ${COLORS[i]}55"></div>
      </div>
      <div style="font-family:var(--font-mono);font-size:.68rem;color:var(--text-muted);text-align:right">${pct}% · avg ${avgMins}m/session</div>
    </div>`
  }).join("")
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────
function initHeatmap(sessions) {
  const container = document.getElementById("heatmapContainer")
  if (!container) return
  const now = new Date()
  const year = now.getFullYear(), month = now.getMonth()
  const totalDays = new Date(year, month + 1, 0).getDate()
  const firstDayMon = (new Date(year, month, 1).getDay() + 6) % 7
  const minuteMap = {}
  sessions.forEach(s => { minuteMap[s.date] = (minuteMap[s.date] || 0) + s.duration })
  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  container.innerHTML = `
    <div class="heatmap-month-label">${now.toLocaleString("default", { month: "long", year: "numeric" })}</div>
    <div class="heatmap-weekdays">${DAY_LABELS.map(d => `<div>${d}</div>`).join("")}</div>
    <div class="heatmap-cells" id="heatmapCells"></div>
    <div class="heatmap-legend">
      <span>Less</span>
      <span class="heatmap-legend-box" style="background:#1e2128;border:1px solid var(--border)"></span>
      <span class="heatmap-legend-box" style="background:#1a4731"></span>
      <span class="heatmap-legend-box" style="background:#1f7a3f"></span>
      <span class="heatmap-legend-box" style="background:#26a641"></span>
      <span>More</span>
    </div>`
  const cells = document.getElementById("heatmapCells")
  for (let i = 0; i < firstDayMon; i++) {
    const e = document.createElement("div"); e.className = "heatmap-day heatmap-empty"; cells.appendChild(e)
  }
  for (let d = 1; d <= totalDays; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    const mins = minuteMap[iso] || 0
    const isToday = iso === now.toISOString().slice(0, 10)
    let level = 0; if (mins > 0) level = 1; if (mins >= 60) level = 2; if (mins >= 120) level = 3
    const box = document.createElement("div")
    box.className = `heatmap-day level-${level}${isToday ? " heatmap-today" : ""}`
    box.title = `${iso}: ${mins} min`
    const label = document.createElement("span")
    label.className = "heatmap-date"; label.textContent = d
    box.appendChild(label); cells.appendChild(box)
  }
}

// ─── History page ─────────────────────────────────────────────────────────────
async function initHistoryPage() {
  const sessionsList = document.getElementById("sessionsList") || document.getElementById("historyList")
  if (!sessionsList) return

  const sessions = await loadSessions()

  // Stats
  const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val }
  set("statTotalSessions", sessions.length)
  const totalMins = sessions.reduce((s, x) => s + x.duration, 0)
  set("statTotalHours", (totalMins / 60).toFixed(1))
  set("statTotalQuestions", sessions.reduce((s, x) => s + x.questions, 0))
  const subjectCount = {}
  sessions.forEach(s => { subjectCount[s.subject] = (subjectCount[s.subject] || 0) + s.duration })
  const topSubject = Object.entries(subjectCount).sort((a, b) => b[1] - a[1])[0]
  set("statTopSubject", topSubject ? topSubject[0] : "—")

  renderHistory(sessions)
}

function renderHistory(sessions) {
  const container = document.getElementById("sessionsList") || document.getElementById("historyList")
  if (!container) return
  const countEl = document.getElementById("historyCount")
  if (countEl) countEl.textContent = `${sessions.length} results`
  if (!sessions.length) {
    container.innerHTML = `<div style="text-align:center;padding:48px 0;color:var(--text-muted)">No sessions yet</div>`
    return
  }
  const DIFF_COLORS = { easy: "#4ade80", medium: "#fb923c", hard: "#f87171" }
  container.innerHTML = sessions.map(s => {
    const h = Math.floor(s.duration / 60), m = s.duration % 60
    const dur = h > 0 ? `${h}h ${m}m` : `${m}m`
    const color = DIFF_COLORS[s.difficulty?.toLowerCase()] || "#fb923c"
    return `<div class="session-card" data-id="${s.id}" style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-radius:10px;border:1px solid var(--border);background:var(--bg-card);margin-bottom:10px;">
      <div>
        <div style="font-weight:600;font-size:.95rem;margin-bottom:4px">${s.subject}</div>
        <div style="font-size:.78rem;color:var(--text-muted)">${s.date} · ${dur} · ${s.questions} questions</div>
        ${s.notes ? `<div style="font-size:.75rem;color:var(--text-muted);margin-top:4px;opacity:.7">${s.notes}</div>` : ""}
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:.72rem;font-weight:600;color:${color};background:${color}22;padding:3px 10px;border-radius:99px">${capitalise(s.difficulty)}</span>
        <button onclick="handleDelete('${s.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.1rem;opacity:.5;transition:opacity .2s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.5">✕</button>
      </div>
    </div>`
  }).join("")
}

window.handleDelete = async (id) => {
  if (!confirm("Delete this session?")) return
  await deleteSession(id)
  showToast("Session deleted")
  initHistoryPage()
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await ensureUser()
  initDateBanner()
  await initGreeting()
  await initProfile()
  initLogPage()
  await initDashboardStats()
  await initHistoryPage()
  await updateStreakBadge()
})
