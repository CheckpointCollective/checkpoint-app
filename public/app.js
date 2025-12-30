console.log("Checkpoint Collective - Zırhlı PWA Sürümü (v6.0) 🛡️");

// ==========================================
// 1. GÜVENLİK SİGORTASI (CRASH PROTECTION)
// ==========================================
// Eğer bir hata olur da sayfa yüklenmezse, 4 saniye sonra
// splash screen'i zorla kaldırır ve misafir ekranını açar.
setTimeout(function() {
    const splash = document.getElementById('splash-screen');
    if (splash && !splash.classList.contains('hidden')) {
        console.warn("⚠️ Acil Durum: Uygulama yanıt vermiyor, zorla açılıyor.");
        splash.classList.add('hidden');
        setTimeout(() => splash.remove(), 500);
        
        // Eğer hala hiçbir sayfa seçili değilse Landing'i aç
        if(!document.querySelector('.view.active')) {
            switchView('landing');
        }
    }
}, 4000);

// ==========================================
// 2. BAŞLATMA
// ==========================================

let auth = null;
let db = null;

// Global Değişkenler
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedFullDate = null;
let allRaces = []; let myRaces = []; let myWorkouts = []; let workoutTemplates = [];
let currentUserRole = 'free'; let currentUserId = null;
let activeStudentId = null; let studentYear = new Date().getFullYear(); let studentMonth = new Date().getMonth();
let selectedRpe = 0; let editingWorkoutId = null; let openWorkoutId = null;
let chartInstances = {};

document.addEventListener('DOMContentLoaded', () => {
    try {
        if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            auth = firebase.auth();
            db = firebase.firestore();
            auth.onAuthStateChanged(handleAuthChange);
        } else {
            console.error("Firebase bulunamadı!");
            // Hata olsa bile kullanıcıyı içeri al
            enterAsGuest();
            hideSplashScreen();
        }
    } catch (error) {
        console.error("Kritik Başlatma Hatası:", error);
        enterAsGuest();
        hideSplashScreen();
    }
});

// ==========================================
// 3. ANA MANTIK
// ==========================================

async function handleAuthChange(user) {
    hideSplashScreen(); 

    if (user) {
        // --- GİRİŞ YAPMIŞ ---
        currentUserId = user.uid;
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (!doc.exists) {
                await db.collection('users').doc(user.uid).set({
                    name: user.displayName, 
                    email: user.email, 
                    photo: user.photoURL, 
                    role: 'free', 
                    joinedAt: new Date()
                });
            }
            currentUserRole = doc.data() ? doc.data().role : 'free';
        } catch (e) { console.error(e); }

        updateUIForUser(user, currentUserRole);
        loadMyRaces();
        loadMyWorkouts(currentUserId);

        if (currentUserRole === 'admin') {
            loadUsers();
            loadAdminDashboard();
            loadTemplates();
        }
        switchView('feed');
    } else {
        // --- MİSAFİR ---
        currentUserId = null; currentUserRole = 'free';
        myRaces = []; myWorkouts = []; workoutTemplates = []; activeStudentId = null;
        updateUIForGuest();
        switchView('landing');
    }
    loadNews();
    loadRaces();
}

function hideSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (splash && !splash.classList.contains('hidden')) {
        splash.classList.add('hidden');
        setTimeout(() => splash.remove(), 500);
    }
}

function switchView(viewName) {
    // Sayfaları gizle
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Hedef sayfayı aç
    const target = document.getElementById('view-' + viewName);
    if(target) target.classList.add('active');

    // Menü kontrolü
    const header = document.getElementById('main-header');
    const nav = document.getElementById('bottom-nav-bar');

    if (viewName === 'landing') {
        if(header) header.style.display = 'none';
        if(nav) nav.style.display = 'none';
    } else {
        if(header) header.style.display = 'flex';
        if(nav) nav.style.display = 'flex';
    }

    if (viewName === 'admin') activeStudentId = null;
    if (viewName === 'discover') {
        selectedFullDate = null;
        document.querySelectorAll('.day-cell').forEach(el => el.classList.remove('selected'));
        renderCalendar();
        showUpcomingRaces();
    }

    const map = { 'feed': 0, 'discover': 1, 'tools': 2, 'locker': 3 };
    if (map[viewName] !== undefined && nav) {
        document.querySelectorAll('.nav-item')[map[viewName]].classList.add('active');
    }
}

// ==========================================
// 4. İÇERİK YÖNETİMİ
// ==========================================

function updateFeedHeader() {
    const hour = new Date().getHours();
    let greet = hour < 12 ? "Günaydın" : hour < 18 ? "Tünaydın" : "İyi Akşamlar";
    let name = "Misafir";
    if (auth && auth.currentUser) name = auth.currentUser.displayName.split(' ')[0];

    const gm = document.getElementById('greet-msg');
    const gs = document.getElementById('greet-stat');
    if(gm) gm.innerText = `${greet}, ${name}!`;
    if(gs) {
        const msgs = ["Bugün senin günün.", "Hedefe odaklan.", "İyi antrenmanlar!", "Harekete geç."];
        gs.innerText = msgs[Math.floor(Math.random() * msgs.length)];
    }
}

function loadNews() {
    if (!db) return;
    db.collection('news').orderBy('date', 'desc').onSnapshot(snap => {
        let html = '';
        snap.forEach(doc => {
            const d = doc.data();
            let contentHtml = `<p>${d.content}</p>`;
            const ytMatch = d.content.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/);
            if (ytMatch) {
                let vid = ytMatch[1].split('&')[0];
                contentHtml = `<p>${d.content.replace(ytMatch[0], '')}</p><div class="video-wrapper"><iframe src="https://www.youtube.com/embed/${vid}" allowfullscreen></iframe></div>`;
            }
            html += `<div class="news-card"><div class="news-img" style="background:${d.color||'#333'}"></div><div class="news-content"><div style="font-size:9px;color:var(--orange);font-weight:bold;">${d.tag}</div><h4>${d.title}</h4><div style="font-size:12px;color:#ccc;margin-top:5px;">${contentHtml}</div></div></div>`;
        });
        const c = document.getElementById('news-container');
        if(c) c.innerHTML = html || '<p style="text-align:center;color:gray">Duyuru yok.</p>';
    });
}

function loginWithGoogle() {
    const p = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(p).catch(e => alert("Giriş Hatası: " + e.message));
}

function enterAsGuest() { switchView('feed'); }

// ==========================================
// 5. FONKSİYONLAR
// ==========================================

function calculatePace() {
    const d = parseFloat(document.getElementById('toolDist').value);
    const t = parseFloat(document.getElementById('toolTime').value);
    if (!d || !t) return;
    const pace = t / d;
    const m = Math.floor(pace);
    const s = Math.round((pace - m) * 60);
    document.getElementById('resultPace').innerText = `Pace: ${m}:${s < 10 ? '0'+s : s} /km`;
}

function calculateHR() {
    const age = parseFloat(document.getElementById('toolAge').value);
    if (!age) return;
    const max = 220 - age;
    document.getElementById('resultHR').innerHTML = `Max: ${max}<br><span style="color:#4ECDC4">Z2:</span> ${Math.round(max*0.6)}-${Math.round(max*0.7)}<br><span style="color:#FF6B35">Z4:</span> ${Math.round(max*0.8)}-${Math.round(max*0.9)}`;
}

function calculateVolumeFromTitle(t) {
    if(!t) return 0;
    const m = t.match(/(\d+(?:\.\d+)?)\s*(k|km|m)/i);
    if(m) { let v = parseFloat(m[1]); if(m[2].toLowerCase() === 'm') v/=1000; return v; }
    return 0;
}

function renderCharts(rId, pId, w, vId) {
    if (typeof Chart === 'undefined') return;
    const comp = w.filter(x => x.isCompleted).sort((a,b) => a.date.localeCompare(b.date)).slice(-10);
    const lbls = comp.map(x => x.date.slice(5));
    const rData = comp.map(x => x.reportRpe || 0);
    const vData = comp.map(x => calculateVolumeFromTitle(x.title));
    const done = w.filter(x => x.isCompleted).length;
    const not = w.length - done;

    if(document.getElementById(rId)) {
        if(chartInstances[rId]) chartInstances[rId].destroy();
        chartInstances[rId] = new Chart(document.getElementById(rId), {
            type: 'line', data: { labels: lbls, datasets: [{ data: rData, borderColor: '#FF6B35', tension: 0.3 }] },
            options: { plugins: { legend: {display:false} }, scales: { x: {display:false}, y: {beginAtZero:true, max:10} } }
        });
    }
    if(document.getElementById(pId)) {
        if(chartInstances[pId]) chartInstances[pId].destroy();
        chartInstances[pId] = new Chart(document.getElementById(pId), {
            type: 'doughnut', data: { labels: ['Ok','No'], datasets: [{ data: [done, not], backgroundColor: ['#4ECDC4','#333'], borderWidth:0 }] },
            options: { cutout: '70%', plugins: { legend: {display:false} } }
        });
    }
    if(document.getElementById(vId)) {
        if(chartInstances[vId]) chartInstances[vId].destroy();
        chartInstances[vId] = new Chart(document.getElementById(vId), {
            type: 'bar', data: { labels: lbls, datasets: [{ data: vData, backgroundColor: '#4a90e2', borderRadius:4 }] },
            options: { plugins: { legend: {display:false} }, scales: { x: {display:false}, y: {beginAtZero:true} } }
        });
    }
}

function loadMyWorkouts(uid) {
    if(!db) return;
    db.collection('users').doc(uid).collection('workouts').onSnapshot(snap => {
        if(uid === currentUserId) {
            myWorkouts = [];
            snap.forEach(d => { const x = d.data(); x.id = d.id; myWorkouts.push(x); });
            renderCalendar(); 
            if(selectedFullDate) showDayDetails(selectedFullDate);
            renderCharts('myRpeChart', 'myConsistencyChart', myWorkouts, 'myVolumeChart');
            updateFeedHeader();
        }
        if(activeStudentId === uid) renderStudentCalendar();
        if(currentUserRole === 'admin') loadAdminDashboard();
    });
}

function loadTemplates() {
    if(!db) return;
    db.collection('templates').orderBy('title').onSnapshot(s => {
        workoutTemplates = [];
        let h = '<option value="">📂 Şablondan...</option>';
        s.forEach(d => { const t = d.data(); workoutTemplates.push({id:d.id, ...t}); h+=`<option value="${d.id}">${t.title}</option>`; });
        const sel = document.getElementById('templateSelector'); if(sel) sel.innerHTML = h;
    });
}

function loadTemplateToInputs() {
    const v = document.getElementById('templateSelector').value;
    const t = workoutTemplates.find(x => x.id === v);
    if(t) { document.getElementById('workoutTitle').value = t.title; document.getElementById('workoutDesc').value = t.desc; }
}

function openWorkoutAssignModal(d) {
    editingWorkoutId = null;
    document.getElementById('modalWorkoutDateLabel').innerText = "Tarih: " + d;
    document.getElementById('modalWorkoutDateLabel').dataset.date = d;
    document.getElementById('workoutTitle').value = ''; document.getElementById('workoutDesc').value = '';
    document.querySelector('#modal-workout-assign h3').innerText = "🏋️ ANTRENMAN YAZ";
    const chk = document.getElementById('saveAsTemplate');
    const sel = document.getElementById('templateSelector');
    
    if(currentUserRole === 'admin') {
        if(chk) { chk.parentElement.style.display = 'flex'; chk.checked = false; }
        if(sel) sel.style.display = 'block';
    } else {
        if(chk) chk.parentElement.style.display = 'none';
        if(sel) sel.style.display = 'none';
        activeStudentId = currentUserId;
    }
    if(sel) sel.value = "";
    document.getElementById('modal-workout-assign').style.display = 'flex';
}

function editWorkout() {
    if(!activeStudentId && !openWorkoutId) return;
    if(currentUserRole !== 'admin') activeStudentId = currentUserId;
    closeWorkoutViewModal();
    const d = document.getElementById('viewWorkoutDate').innerText;
    document.getElementById('modalWorkoutDateLabel').innerText = "Tarih: " + d;
    document.getElementById('modalWorkoutDateLabel').dataset.date = d;
    document.getElementById('workoutTitle').value = document.getElementById('viewWorkoutTitle').innerText;
    document.getElementById('workoutDesc').value = document.getElementById('viewWorkoutDesc').innerText;
    document.querySelector('#modal-workout-assign h3').innerText = "✏️ DÜZENLE";
    editingWorkoutId = openWorkoutId;
    
    const chk = document.getElementById('saveAsTemplate');
    if(chk) chk.parentElement.style.display = 'none';
    const sel = document.getElementById('templateSelector');
    if(sel) sel.style.display = 'none';
    
    document.getElementById('modal-workout-assign').style.display = 'flex';
}

function saveWorkout() {
    if(!db) return;
    let uid = (currentUserRole === 'admin') ? activeStudentId : currentUserId;
    if(!uid) return;
    const title = document.getElementById('workoutTitle').value;
    if(!title) return alert("Başlık giriniz.");
    const date = document.getElementById('modalWorkoutDateLabel').dataset.date;
    const desc = document.getElementById('workoutDesc').value;
    const saveTmpl = document.getElementById('saveAsTemplate')?.checked;
    
    const ref = db.collection('users').doc(uid).collection('workouts');
    if(editingWorkoutId) {
        ref.doc(editingWorkoutId).update({ title, desc }).then(closeWorkoutModal);
    } else {
        ref.add({ date, title, desc, isCompleted: false, assignedBy: currentUserId, createdAt: new Date(), reportRpe:0 }).then(() => {
            if(saveTmpl && currentUserRole==='admin') db.collection('templates').add({ title, desc });
            closeWorkoutModal();
        });
    }
}

function closeWorkoutModal() { document.getElementById('modal-workout-assign').style.display = 'none'; editingWorkoutId = null; }

function openWorkoutView(id, title, date, desc, isComp, link, owner, rpe, note) {
    openWorkoutId = id;
    const m = document.getElementById('modal-workout-view'); m.style.display = 'flex';
    document.getElementById('viewWorkoutTitle').innerText = title;
    document.getElementById('viewWorkoutDate').innerText = date;
    document.getElementById('viewWorkoutDesc').innerText = desc;
    
    const adminDiv = document.getElementById('admin-workout-actions');
    const allowEdit = (currentUserRole === 'admin' || owner === currentUserId || (!owner && currentUserRole!=='admin'));
    adminDiv.style.display = allowEdit ? 'flex' : 'none';

    const done = (isComp === true || isComp === 'true');
    const dispDiv = document.getElementById('workout-report-display');
    const formDiv = document.getElementById('workout-report-form');
    const btnOpen = document.getElementById('btnOpenReportForm');

    if(done) {
        dispDiv.style.display = 'block'; formDiv.style.display = 'none'; btnOpen.style.display = 'none';
        document.getElementById('displayRpe').innerText = (rpe||'-')+"/10";
        document.getElementById('displayNote').innerText = note || "Not yok.";
        document.getElementById('displayStrava').innerHTML = (link && link.length>5) ? `<a href="${link}" target="_blank" style="color:var(--blue)">🔗 Strava</a>` : "";
    } else {
        dispDiv.style.display = 'none'; formDiv.style.display = 'none'; btnOpen.style.display = 'block';
        selectedRpe = 0; document.getElementById('reportNote').value = "";
    }
}

function showReportForm() { 
    document.getElementById('btnOpenReportForm').style.display = 'none'; 
    document.getElementById('workout-report-form').style.display = 'block'; 
}
function selectRpe(v) { 
    selectedRpe = v; 
    document.getElementById('rpeValueDisplay').innerText = v+"/10"; 
    document.querySelectorAll('.rpe-box').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.rpe-box')[v-1].classList.add('selected');
}
function submitWorkoutReport() {
    if(!selectedRpe) return alert("Zorluk seç.");
    let uid = (currentUserRole === 'admin') ? activeStudentId : currentUserId;
    db.collection('users').doc(uid).collection('workouts').doc(openWorkoutId).update({
        isCompleted: true, reportRpe: selectedRpe, 
        reportNote: document.getElementById('reportNote').value,
        stravaLink: document.getElementById('reportStrava').value
    }).then(closeWorkoutViewModal);
}
function deleteWorkout() {
    if(confirm("Silmek istiyor musun?")) {
        let uid = (currentUserRole === 'admin') ? activeStudentId : currentUserId;
        db.collection('users').doc(uid).collection('workouts').doc(openWorkoutId).delete().then(closeWorkoutViewModal);
    }
}
function closeWorkoutViewModal() { document.getElementById('modal-workout-view').style.display = 'none'; openWorkoutId = null; }

function loadAdminDashboard() {
    const c = document.getElementById('admin-dashboard-container'); if(!c) return;
    c.innerHTML = '<p style="text-align:center;font-size:11px;color:gray;">...</p>';
    const today = new Date().toISOString().slice(0,10);
    const yest = new Date(new Date().setDate(new Date().getDate()-1)).toISOString().slice(0,10);
    
    db.collection('users').where('role','!=','admin').onSnapshot(s => {
        let promises = s.docs.map(async u => {
            const ud = u.data(); const snap = await db.collection('users').doc(u.id).collection('workouts').get();
            let html = '';
            snap.forEach(w => {
                const wd = w.data();
                if(wd.date === yest && !wd.isCompleted) html += `<div class="dashboard-item missed" onclick="openStudentDetail('${u.id}')">⚠️ <strong>${ud.name}</strong> dün yapmadı.</div>`;
                if(wd.date === today && wd.isCompleted) html += `<div class="dashboard-item review" onclick="openStudentDetail('${u.id}')">🔔 <strong>${ud.name}</strong> raporladı.</div>`;
            });
            return html;
        });
        Promise.all(promises).then(res => c.innerHTML = `<div class="dashboard-summary-card">${res.join('') || '<p style="text-align:center">Hareket yok.</p>'}</div>`);
    });
}

async function openStudentDetail(uid) {
    activeStudentId = uid;
    const u = await db.collection('users').doc(uid).get();
    document.getElementById('student-name').innerText = u.data().name;
    document.getElementById('student-avatar').style.backgroundImage = `url('${u.data().photo}')`;
    
    db.collection('users').doc(uid).collection('workouts').get().then(s => {
        const w = []; s.forEach(d => {const x=d.data(); x.id=d.id; w.push(x)});
        renderStudentCalendarWithData(w);
        renderCharts('studentRpeChart', 'studentConsistencyChart', w, 'studentVolumeChart');
    });
    switchView('student-detail');
}

function renderStudentCalendarWithData(w) {
    const m = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
    document.getElementById('studentMonthLabel').innerText = `${m[studentMonth]} ${studentYear}`;
    const f = new Date(studentYear, studentMonth, 1).getDay(); const s = f===0?6:f-1; const t = new Date(studentYear, studentMonth+1, 0).getDate();
    let h = ''; for(let i=0;i<s;i++) h+=`<div class="day-cell empty"></div>`;
    for(let i=1;i<=t;i++) {
        const d = `${studentYear}-${(studentMonth+1).toString().padStart(2,'0')}-${i.toString().padStart(2,'0')}`;
        const fnd = w.find(x => x.date === d);
        let c = ''; if(fnd) c = fnd.isCompleted ? 'has-workout completed' : 'has-workout';
        h+=`<div class="day-cell ${c}" onclick="clickStudentDate('${d}')">${i}</div>`;
    }
    document.getElementById('student-calendar-days').innerHTML = h;
}
function changeStudentMonth(d) { studentMonth+=d; if(studentMonth<0){studentMonth=11;studentYear--}else if(studentMonth>11){studentMonth=0;studentYear++} renderStudentCalendar(); }
function clickStudentDate(d) { 
    db.collection('users').doc(activeStudentId).collection('workouts').where('date','==',d).get().then(s => {
        if(!s.empty) { const x=s.docs[0].data(); openWorkoutView(s.docs[0].id, x.title, x.date, x.desc, x.isCompleted, x.stravaLink, activeStudentId, x.reportRpe, x.reportNote); }
        else openWorkoutAssignModal(d);
    });
}

function loadUsers() {
    db.collection('users').orderBy('joinedAt', 'desc').onSnapshot(s => {
        let h = ''; s.forEach(d => { const u=d.data(); h+=`<div class="user-row" onclick="openStudentDetail('${d.id}')"><div class="user-info"><div class="user-name">${u.name}</div></div><div class="user-role-tag">${u.role==='admin'?'ADMIN':'ÖĞR'}</div></div>`; });
        const c = document.getElementById('user-list-container'); if(c) c.innerHTML = h;
    });
}

function loadRaces() {
    if(!db) return;
    db.collection('races').orderBy('date').onSnapshot(s => {
        allRaces = []; s.forEach(d => {const x=d.data(); x.id=d.id; allRaces.push(x)});
        renderCalendar(); showUpcomingRaces();
    });
}

function renderCalendar() {
    const c = document.getElementById('calendar-days'); if(!c) return;
    const m = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
    document.getElementById('currentMonthLabel').innerText = `${m[currentMonth]} ${currentYear}`;
    const f = new Date(currentYear, currentMonth, 1).getDay(); const s = f===0?6:f-1; const t = new Date(currentYear, currentMonth+1, 0).getDate();
    let h = ''; for(let i=0;i<s;i++) h+=`<div class="day-cell empty"></div>`;
    for(let i=1;i<=t;i++) {
        const d = `${currentYear}-${(currentMonth+1).toString().padStart(2,'0')}-${i.toString().padStart(2,'0')}`;
        const race = allRaces.find(r => r.date === d);
        const work = myWorkouts.find(w => w.date === d);
        let cls = ''; if(work) cls = work.isCompleted ? 'has-workout completed' : 'has-workout';
        if(race) cls += ' has-race';
        let icon = ''; if(race) icon = `<img src="${race.type==='trail'?'icon-trail.jpg':'icon-road.jpg'}" class="race-type-icon-small">`;
        h+=`<div class="day-cell ${cls}" onclick="selectDate('${d}', this)">${i} ${icon}</div>`;
    }
    c.innerHTML = h;
}
function changeMonth(d) { currentMonth+=d; if(currentMonth<0){currentMonth=11;currentYear--}else if(currentMonth>11){currentMonth=0;currentYear++} renderCalendar(); }
function selectDate(d, el) { 
    if(selectedFullDate === d) { selectedFullDate = null; showUpcomingRaces(); }
    else { document.querySelectorAll('.day-cell').forEach(e=>e.classList.remove('selected')); el.classList.add('selected'); selectedFullDate = d; showDayDetails(d); }
}
function showDayDetails(d) {
    document.getElementById('day-details-panel').style.display = 'block';
    document.getElementById('selectedDateLabel').innerText = d;
    document.querySelector('#day-details-panel .day-badge').innerText = "SEÇİLDİ";
    let h = '';
    const w = myWorkouts.find(x => x.date === d);
    if(w) h+=`<div class="workout-mini-card ${w.isCompleted?'completed':''}" onclick="openWorkoutView('${w.id}','${w.title}','${w.date}','${w.desc}','${w.isCompleted}','${w.stravaLink}','${currentUserId}','${w.reportRpe}','${w.reportNote}')"><div><strong>${w.title}</strong></div><div>${w.isCompleted?'☑':'☐'}</div></div>`;
    
    allRaces.filter(r => r.date === d).forEach(r => {
        const added = myRaces.some(m => m.raceId === r.id);
        let link = r.website ? `<a href="${r.website}" target="_blank">🌐</a>` : '';
        h+=`<div class="race-mini-card"><div><strong>${r.name}</strong> <small>${r.category}</small></div><div>${link} <button onclick="toggleMyRace('${r.id}','${r.name}','${r.date}','${r.category}')">${added?'✓':'＋'}</button></div></div>`;
    });
    document.getElementById('selected-day-races').innerHTML = h || '<p>Etkinlik yok.</p>';
    
    let btn = '';
    if(currentUserRole === 'admin') btn = `<button class="btn-primary" onclick="openAddModal()">＋ YARIŞ EKLE</button>`;
    else if(currentUserId) btn = `<button class="btn-primary" onclick="openWorkoutAssignModal('${d}')">＋ ANTRENMAN EKLE</button>`;
    document.getElementById('day-action-buttons').innerHTML = btn;
}
function showUpcomingRaces() {
    document.getElementById('day-details-panel').style.display = 'block';
    document.getElementById('selectedDateLabel').innerText = "YAKLAŞANLAR";
    document.querySelector('#day-details-panel .day-badge').innerText = "LİSTE";
    const today = new Date().toISOString().slice(0,10);
    const up = allRaces.filter(r => r.date >= today).slice(0,3);
    let h = '';
    up.forEach(r => h+=`<div class="race-mini-card"><div>${r.date} <strong>${r.name}</strong></div></div>`);
    document.getElementById('selected-day-races').innerHTML = h || '<p>Yarış yok.</p>';
    document.getElementById('day-action-buttons').innerHTML = '';
}
function toggleMyRace(rid, name, date, cat) {
    if(!currentUserId) return;
    const exists = myRaces.find(r => r.raceId === rid);
    if(exists) { if(confirm("Sil?")) db.collection('users').doc(currentUserId).collection('my_races').doc(exists.id).delete(); }
    else db.collection('users').doc(currentUserId).collection('my_races').add({raceId:rid, name, date, category:cat});
}
function saveRaceFromModal() {
    const n=document.getElementById('modalRaceName').value; if(!n) return;
    db.collection('races').add({
        name: n, 
        category: document.getElementById('modalRaceCat').value,
        type: document.getElementById('modalRaceType').value,
        website: document.getElementById('modalRaceWeb').value,
        date: selectedFullDate
    }).then(closeAddModal);
}
function closeAddModal() { document.getElementById('modal-overlay').style.display='none'; }
function openAddModal() { document.getElementById('modal-overlay').style.display='flex'; }
function saveNews() { db.collection('news').add({ title:document.getElementById('newsTitle').value, tag:document.getElementById('newsTag').value, content:document.getElementById('newsContent').value, date:new Date() }).then(()=>{switchView('feed')}); }

// ==========================================
// 6. UI GÜNCELLEME (GÜVENLİ)
// ==========================================
// DİKKAT: Hata alınan bölüm burasıydı, şimdi güvenli.
function updateUIForUser(user, role) {
    // 1. Profil İkonu
    const profileTrigger = document.getElementById('profile-trigger');
    if (profileTrigger) {
        profileTrigger.classList.add('active');
        const photo = user.photoURL || 'https://via.placeholder.com/150';
        profileTrigger.innerHTML = `<div class="user-avatar-small" style="background-image:url('${photo}')"></div>`;
    }
    
    // 2. Locker Header (Hata korumalı)
    const lockerHeader = document.querySelector('#view-locker .profile-header');
    if (lockerHeader) {
        const h3 = lockerHeader.querySelector('h3');
        if (h3) h3.innerText = user.displayName;
        const avt = lockerHeader.querySelector('.avatar');
        if (avt) avt.style.backgroundImage = `url('${user.photoURL}')`;
        
        // Admin Butonu
        if(role === 'admin' && !document.getElementById('btnAdmin')) {
            const b = document.createElement('button'); b.id='btnAdmin'; b.innerText='YÖNETİCİ'; b.className='btn-primary'; b.onclick=()=>switchView('admin');
            lockerHeader.appendChild(b);
        }
    }

    // 3. Bölümleri Aç
    const ms = document.getElementById('my-stats-section'); if(ms) ms.style.display = 'block';
    const mr = document.getElementById('my-races-section'); if(mr) mr.style.display = 'block';
    const fh = document.getElementById('feed-header-card'); if(fh) fh.style.display = 'flex';
    
    // 4. Çıkış Butonu
    const locker = document.getElementById('view-locker');
    if(locker && !document.getElementById('btnLogout')) {
        const b = document.createElement('button'); b.id='btnLogout'; b.innerText='ÇIKIŞ YAP'; b.className='btn-primary'; b.style.marginTop='10px'; b.style.background='#333'; 
        b.onclick=()=>auth.signOut();
        locker.appendChild(b);
    }
}

function updateUIForGuest() {
    const pt = document.getElementById('profile-trigger');
    if(pt) { pt.classList.remove('active'); pt.innerHTML = `<span class="material-icons-round guest-icon">person_outline</span>`; }
    
    const lh = document.querySelector('#view-locker .profile-header h3');
    if(lh) lh.innerText = "Misafir";
    
    document.getElementById('my-stats-section').style.display = 'none';
    document.getElementById('my-races-section').style.display = 'none';
    document.getElementById('feed-header-card').style.display = 'none';
    
    if(document.getElementById('btnAdmin')) document.getElementById('btnAdmin').remove();
    if(document.getElementById('btnLogout')) document.getElementById('btnLogout').remove();
}

document.addEventListener('click', e => { if(e.target.id === 'btnLogin') loginWithGoogle(); });