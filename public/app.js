console.log("Checkpoint Collective - Bulletproof Sürüm (v4.7) 🚀");

// ==========================================
// 1. ACİL DURUM SİGORTASI (EN ÜSTTE)
// ==========================================
// Kodun geri kalanı hata verse bile bu sayaç çalışır ve 4 sn sonra uygulamayı açar.
setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    if (splash && !splash.classList.contains('hidden')) {
        console.warn("⚠️ Acil Durum Protokolü: Uygulama zorla açılıyor...");
        splash.classList.add('hidden');
        setTimeout(() => splash.remove(), 500);
        
        // Eğer hiçbir sayfa aktif değilse Landing'i aç
        if(!document.querySelector('.view.active')) {
            const landing = document.getElementById('view-landing');
            const header = document.getElementById('main-header');
            const nav = document.getElementById('bottom-nav-bar');
            if(landing) {
                landing.classList.add('active');
                landing.style.display = 'flex';
            }
            if(header) header.style.display = 'none';
            if(nav) nav.style.display = 'none';
        }
    }
}, 4000);

// ==========================================
// 2. GLOBAL DEĞİŞKENLER VE AYARLAR
// ==========================================

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedFullDate = null;
let allRaces = []; let myRaces = []; let myWorkouts = []; let workoutTemplates = []; 
let currentUserRole = 'free'; let currentUserId = null;
let activeStudentId = null; let studentYear = new Date().getFullYear(); let studentMonth = new Date().getMonth();
let selectedRpe = 0; let editingWorkoutId = null; let openWorkoutId = null;    
let chartInstances = {};

// Firebase ve Auth Tanımları (Hata alırsa patlamasın diye boş tanımlıyoruz)
let auth = null;
let db = null;

// ==========================================
// 3. BAŞLATMA (HATA KORUMALI)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    try {
        // Firebase Başlatma Denemesi
        if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            auth = firebase.auth();
            db = firebase.firestore();
            
            // Ana Auth Dinleyicisi
            auth.onAuthStateChanged(handleAuthChange);
        } else {
            throw new Error("Firebase SDK veya Config bulunamadı!");
        }
    } catch (error) {
        console.error("🔥 KRİTİK HATA:", error);
        alert("Bağlantı hatası. Uygulama çevrimdışı modda açılıyor.");
        // Hata olsa bile Guest modunda aç
        enterAsGuest(); 
        hideSplashScreen();
    }
});

// ==========================================
// 4. ANA MANTIK FONKSİYONLARI
// ==========================================

async function handleAuthChange(user) {
    // Firebase cevap verdi, logoyu güvenle kaldırabiliriz
    hideSplashScreen();

    if (user) {
        // --- KULLANICI GİRİŞ YAPMIŞ ---
        currentUserId = user.uid;
        try {
            const userRef = db.collection('users').doc(user.uid);
            const doc = await userRef.get();
            if (!doc.exists) {
                await userRef.set({ name: user.displayName, email: user.email, photo: user.photoURL, role: 'free', joinedAt: new Date() });
            }
            currentUserRole = doc.data() ? doc.data().role : 'free';
        } catch (e) { console.error("User Fetch Error:", e); }
        
        updateUIForUser(user, currentUserRole);
        loadMyRaces(); 
        loadMyWorkouts(currentUserId); 
        
        if (currentUserRole === 'admin') { loadUsers(); loadAdminDashboard(); loadTemplates(); }
        
        switchView('feed');
    } else {
        // --- MİSAFİR ---
        currentUserId = null; currentUserRole = 'free';
        myRaces = []; myWorkouts = []; workoutTemplates = []; activeStudentId = null;
        updateUIForGuest();
        switchView('landing');
    }
    // Genel verileri yükle
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
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const target = document.getElementById('view-' + viewName);
    if(target) target.classList.add('active');

    // Menü Kontrolü
    const header = document.getElementById('main-header');
    const bottomNav = document.getElementById('bottom-nav-bar');

    if (viewName === 'landing') {
        if(header) header.style.display = 'none';
        if(bottomNav) bottomNav.style.display = 'none';
    } else {
        if(header) header.style.display = 'flex';
        if(bottomNav) bottomNav.style.display = 'flex';
    }

    // Temizlik
    if (viewName === 'admin') { activeStudentId = null; }
    if (viewName === 'discover') { 
        selectedFullDate = null; 
        document.querySelectorAll('.day-cell').forEach(el => el.classList.remove('selected')); 
        renderCalendar(); 
        showUpcomingRaces(); 
    }
    
    // Navigasyon Işığı
    const map = { 'feed': 0, 'discover': 1, 'tools': 2, 'locker': 3 }; 
    if (map[viewName] !== undefined && bottomNav) {
        document.querySelectorAll('.nav-item')[map[viewName]].classList.add('active');
    }
}

// ==========================================
// 5. İÇERİK VE UI GÜNCELLEMELERİ
// ==========================================

function updateFeedHeader() {
    const hour = new Date().getHours();
    let greet = "Merhaba";
    if(hour < 12) greet = "Günaydın"; else if(hour < 18) greet = "Tünaydın"; else greet = "İyi Akşamlar";
    
    let name = "Misafir";
    if(auth && auth.currentUser) name = auth.currentUser.displayName.split(' ')[0];
    
    const greetMsg = document.getElementById('greet-msg');
    const greetStat = document.getElementById('greet-stat');

    if(greetMsg) greetMsg.innerText = `${greet}, ${name}!`;
    if(greetStat) {
        const msgs = ["Bugün kendin için bir şey yap.", "Adım adım hedefe.", "Koşu senin özgürlüğün.", "Hareket et, iyi hisset.", "İyi antrenmanlar!"];
        greetStat.innerText = msgs[Math.floor(Math.random() * msgs.length)];
    }
}

function loadNews() {
    if(!db) return;
    db.collection('news').orderBy('date', 'desc').onSnapshot(snapshot => {
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            let contentHtml = `<p>${data.content}</p>`;
            const ytMatch = data.content.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?(.+)/);
            if(ytMatch) {
                let videoId = ytMatch[1];
                if(videoId.includes('&')) videoId = videoId.split('&')[0];
                contentHtml = `<p>${data.content.replace(ytMatch[0], '')}</p><div class="video-wrapper"><iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe></div>`;
            }
            html += `<div class="news-card"><div class="news-img" style="background:${data.color || '#333'}"></div><div class="news-content"><div style="font-size:9px; color:var(--orange); font-weight:bold;">${data.tag}</div><h4>${data.title}</h4><div style="font-size:12px; color:#ccc; margin-top:5px;">${contentHtml}</div></div></div>`;
        });
        const container = document.getElementById('news-container');
        if(container) container.innerHTML = html || '<p style="text-align:center; color:gray">Henüz duyuru yok.</p>';
    });
}

function loginWithGoogle() {
    if(!auth) return alert("Sistem başlatılamadı.");
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(e => alert("Giriş Hatası: " + e.message));
}

function enterAsGuest() {
    switchView('feed');
}

// ==========================================
// 6. DİĞER FONKSİYONLAR (ARAÇLAR, TAKVİM VS.)
// ==========================================

function calculatePace() {
    const dist = parseFloat(document.getElementById('toolDist').value);
    const time = parseFloat(document.getElementById('toolTime').value);
    if (!dist || !time) return;
    const paceDec = time / dist; const paceMin = Math.floor(paceDec); const paceSec = Math.round((paceDec - paceMin) * 60); 
    const secStr = paceSec < 10 ? '0' + paceSec : paceSec;
    document.getElementById('resultPace').innerText = `Ortalama Pace: ${paceMin}:${secStr} /km`;
}

function calculateHR() {
    const age = parseFloat(document.getElementById('toolAge').value);
    if (!age) return;
    const maxHR = 220 - age;
    const z2_min = Math.round(maxHR * 0.60); const z2_max = Math.round(maxHR * 0.70);
    const z4_min = Math.round(maxHR * 0.80); const z4_max = Math.round(maxHR * 0.90);
    document.getElementById('resultHR').innerHTML = `<strong>Maksimum Nabız:</strong> ${maxHR}<br><span style="color:#4ECDC4">Zone 2:</span> ${z2_min}-${z2_max}<br><span style="color:#FF6B35">Zone 4:</span> ${z4_min}-${z4_max}`;
}

function calculateVolumeFromTitle(title) {
    if(!title) return 0;
    const match = title.match(/(\d+(?:\.\d+)?)\s*(k|km|m)/i);
    if (match) { let val = parseFloat(match[1]); if (match[2].toLowerCase() === 'm') val = val / 1000; return val; } return 0;
}

function renderCharts(canvasRpeId, canvasPieId, workouts, canvasVolId) {
    if (typeof Chart === 'undefined') return;
    const completedWorkouts = workouts.filter(w => w.isCompleted).sort((a, b) => a.date.localeCompare(b.date)).slice(-10);
    const rpeLabels = completedWorkouts.map(w => w.date.slice(5));
    const rpeData = completedWorkouts.map(w => w.reportRpe || 0);
    const totalAssigned = workouts.length; const totalCompleted = workouts.filter(w => w.isCompleted).length; const notDone = totalAssigned - totalCompleted;
    const volumeData = completedWorkouts.map(w => calculateVolumeFromTitle(w.title));

    const ctxRpe = document.getElementById(canvasRpeId);
    if (ctxRpe) {
        if (chartInstances[canvasRpeId]) chartInstances[canvasRpeId].destroy();
        chartInstances[canvasRpeId] = new Chart(ctxRpe, { type: 'line', data: { labels: rpeLabels, datasets: [{ label: 'Efor', data: rpeData, borderColor: '#FF6B35', backgroundColor: 'rgba(255, 107, 53, 0.1)', borderWidth: 2, tension: 0.3 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 10, grid: { color:'rgba(255,255,255,0.1)' } }, x: { display: false } } } });
    }
    const ctxPie = document.getElementById(canvasPieId);
    if (ctxPie) {
        if (chartInstances[canvasPieId]) chartInstances[canvasPieId].destroy();
        chartInstances[canvasPieId] = new Chart(ctxPie, { type: 'doughnut', data: { labels: ['Yapıldı', 'Eksik'], datasets: [{ data: [totalCompleted, notDone], backgroundColor: ['#4ECDC4', '#333'], borderWidth: 0 }] }, options: { responsive: true, cutout: '70%', plugins: { legend: { display: false } } } });
    }
    if(canvasVolId) {
        const ctxVol = document.getElementById(canvasVolId);
        if (ctxVol) {
            if (chartInstances[canvasVolId]) chartInstances[canvasVolId].destroy();
            chartInstances[canvasVolId] = new Chart(ctxVol, { type: 'bar', data: { labels: rpeLabels, datasets: [{ label: 'KM', data: volumeData, backgroundColor: '#4a90e2', borderRadius: 4 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color:'rgba(255,255,255,0.1)' } }, x: { display: false } } } });
        }
    }
}

function loadMyWorkouts(userId) {
    if(!db) return;
    db.collection('users').doc(userId).collection('workouts').onSnapshot(snapshot => {
        if (userId === currentUserId) {
            myWorkouts = [];
            snapshot.forEach(doc => { const d = doc.data(); d.id = doc.id; myWorkouts.push(d); });
            renderCalendar(); if (selectedFullDate) showDayDetails(selectedFullDate); 
            renderCharts('myRpeChart', 'myConsistencyChart', myWorkouts, 'myVolumeChart');
            updateFeedHeader();
        }
        if (activeStudentId === userId) renderStudentCalendar(); 
        if (currentUserRole === 'admin') loadAdminDashboard();
    });
}

function loadTemplates() {
    if(!db) return;
    db.collection('templates').orderBy('title', 'asc').onSnapshot(snap => {
        workoutTemplates = [];
        let html = '<option value="">📂 Şablondan Yükle...</option>';
        snap.forEach(doc => { const t = doc.data(); workoutTemplates.push({ id: doc.id, ...t }); html += `<option value="${doc.id}">${t.title}</option>`; });
        const selector = document.getElementById('templateSelector'); if (selector) selector.innerHTML = html;
    });
}

function loadTemplateToInputs() {
    const selector = document.getElementById('templateSelector'); const selectedId = selector.value; if (!selectedId) return;
    const template = workoutTemplates.find(t => t.id === selectedId);
    if (template) { document.getElementById('workoutTitle').value = template.title; document.getElementById('workoutDesc').value = template.desc; }
}

function openWorkoutAssignModal(dateStr) {
    editingWorkoutId = null; 
    document.getElementById('modalWorkoutDateLabel').innerText = "Tarih: " + dateStr; 
    document.getElementById('modalWorkoutDateLabel').dataset.date = dateStr;
    document.getElementById('workoutTitle').value = ''; document.getElementById('workoutDesc').value = '';
    document.querySelector('#modal-workout-assign h3').innerText = "🏋️ ANTRENMAN YAZ";
    const chk = document.getElementById('saveAsTemplate');
    const selectBox = document.getElementById('templateSelector');
    if (currentUserRole === 'admin') {
        if (chk) chk.parentElement.style.display = 'flex'; if (selectBox) selectBox.style.display = 'block'; if(chk) chk.checked = false;
    } else {
        if (chk) chk.parentElement.style.display = 'none'; if (selectBox) selectBox.style.display = 'none'; activeStudentId = currentUserId;
    }
    if (selectBox) selectBox.value = ""; 
    document.getElementById('modal-workout-assign').style.display = 'flex';
}

function editWorkout() {
    if (!activeStudentId && !openWorkoutId) return; 
    if(currentUserRole !== 'admin' && !activeStudentId) activeStudentId = currentUserId;
    const currentTitle = document.getElementById('viewWorkoutTitle').innerText; const currentDesc = document.getElementById('viewWorkoutDesc').innerText; const currentDate = document.getElementById('viewWorkoutDate').innerText;
    closeWorkoutViewModal();
    document.getElementById('modalWorkoutDateLabel').innerText = "Tarih: " + currentDate; document.getElementById('modalWorkoutDateLabel').dataset.date = currentDate;
    document.getElementById('workoutTitle').value = currentTitle; document.getElementById('workoutDesc').value = currentDesc;
    document.querySelector('#modal-workout-assign h3').innerText = "✏️ ANTRENMANI DÜZENLE"; editingWorkoutId = openWorkoutId;
    const chk = document.getElementById('saveAsTemplate'); if (chk) chk.parentElement.style.display = 'none';
    const selectBox = document.getElementById('templateSelector'); if (selectBox) selectBox.style.display = 'none';
    document.getElementById('modal-workout-assign').style.display = 'flex';
}

function closeWorkoutModal() { document.getElementById('modal-workout-assign').style.display = 'none'; editingWorkoutId = null; }

function saveWorkout() {
    if(!db) return;
    let targetId = activeStudentId; if(currentUserRole !== 'admin') targetId = currentUserId; if (!targetId) return;
    const dateStr = document.getElementById('modalWorkoutDateLabel').dataset.date; const title = document.getElementById('workoutTitle').value; const desc = document.getElementById('workoutDesc').value;
    const chk = document.getElementById('saveAsTemplate'); const saveAsTemplate = chk ? chk.checked : false;
    if (!title) return alert("Başlık giriniz.");
    const workoutRef = db.collection('users').doc(targetId).collection('workouts');
    if (editingWorkoutId) {
        workoutRef.doc(editingWorkoutId).update({ title: title, desc: desc }).then(() => { closeWorkoutModal(); });
    } else {
        workoutRef.add({ date: dateStr, title: title, desc: desc, isCompleted: false, stravaLink: "", assignedBy: currentUserId, createdAt: new Date(), reportRpe: 0, reportNote: "" }).then(() => {
            if (saveAsTemplate && currentUserRole === 'admin') { db.collection('templates').add({ title: title, desc: desc, createdAt: new Date() }); }
            closeWorkoutModal(); alert("Antrenman Eklendi! 📨");
        });
    }
}

function deleteWorkout() {
    let targetId = activeStudentId; if(currentUserRole !== 'admin') targetId = currentUserId; if (!targetId || !openWorkoutId) return;
    if (confirm("Silmek istiyor musun?")) { db.collection('users').doc(targetId).collection('workouts').doc(openWorkoutId).delete().then(() => { closeWorkoutViewModal(); }); }
}

function openWorkoutView(workoutId, title, date, desc, isCompleted, stravaLink, ownerId, rpe, note) {
    openWorkoutId = workoutId;
    const modal = document.getElementById('modal-workout-view'); modal.style.display = 'flex';
    document.getElementById('viewWorkoutTitle').innerText = title; document.getElementById('viewWorkoutDate').innerText = date; document.getElementById('viewWorkoutDesc').innerText = desc;
    const adminActions = document.getElementById('admin-workout-actions'); 
    if (currentUserRole === 'admin' || ownerId === currentUserId || (!ownerId && currentUserRole!=='admin')) { adminActions.style.display = 'flex'; } else { adminActions.style.display = 'none'; }
    const displayDiv = document.getElementById('workout-report-display'); const formDiv = document.getElementById('workout-report-form'); const btnOpen = document.getElementById('btnOpenReportForm');
    const completed = (isCompleted === true || isCompleted === 'true');
    if (completed) {
        displayDiv.style.display = 'block'; formDiv.style.display = 'none'; btnOpen.style.display = 'none';
        document.getElementById('displayRpe').innerText = (rpe || '-') + "/10"; document.getElementById('displayNote').innerText = note ? `"${note}"` : "Not yok.";
        if (stravaLink && stravaLink.length > 5) document.getElementById('displayStrava').innerHTML = `<a href="${stravaLink}" target="_blank" style="color:var(--blue); font-size:11px; text-decoration:none;">🔗 Strava'da Aç</a>`; else document.getElementById('displayStrava').innerHTML = "";
    } else {
        displayDiv.style.display = 'none'; formDiv.style.display = 'none'; btnOpen.style.display = 'block';
        selectedRpe = 0; document.getElementById('rpeValueDisplay').innerText = "Seçilmedi"; document.querySelectorAll('.rpe-box').forEach(b => b.classList.remove('selected')); document.getElementById('reportNote').value = ""; document.getElementById('reportStrava').value = "";
    }
}

function showReportForm() { document.getElementById('btnOpenReportForm').style.display = 'none'; document.getElementById('workout-report-form').style.display = 'block'; }
function selectRpe(val) { selectedRpe = val; document.getElementById('rpeValueDisplay').innerText = val + "/10"; document.querySelectorAll('.rpe-box').forEach(b => b.classList.remove('selected')); const boxes = document.querySelectorAll('.rpe-box'); if (boxes[val - 1]) boxes[val - 1].classList.add('selected'); }
function submitWorkoutReport() {
    if (!openWorkoutId) return; if (selectedRpe === 0) return alert("Zorluk seç.");
    const note = document.getElementById('reportNote').value; const link = document.getElementById('reportStrava').value; 
    let targetId = activeStudentId; if(currentUserRole !== 'admin') targetId = currentUserId;
    db.collection('users').doc(targetId).collection('workouts').doc(openWorkoutId).update({ isCompleted: true, reportRpe: selectedRpe, reportNote: note, stravaLink: link, completedAt: new Date() }).then(() => { closeWorkoutViewModal(); });
}
function closeWorkoutViewModal() { document.getElementById('modal-workout-view').style.display = 'none'; openWorkoutId = null; editingWorkoutId = null; }

function loadAdminDashboard() {
    const container = document.getElementById('admin-dashboard-container'); if (!container) return;
    container.innerHTML = '<p style="text-align:center;font-size:11px;color:gray;">Veriler taranıyor...</p>';
    const today = new Date(); const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const todayStr = today.toISOString().slice(0, 10); const yesterdayStr = yesterday.toISOString().slice(0, 10);
    let html = `<div class="dashboard-summary-card"><div class="dashboard-header">GÜNLÜK ÖZET</div>`; let hasAlerts = false;
    db.collection('users').where('role', '!=', 'admin').onSnapshot(snap => {
        let promises = snap.docs.map(async (userDoc) => {
            const userData = userDoc.data(); const uid = userDoc.id;
            const wSnap = await db.collection('users').doc(uid).collection('workouts').get();
            let userItems = '';
            wSnap.forEach(wDoc => {
                const w = wDoc.data();
                if (w.date === yesterdayStr && !w.isCompleted) { userItems += `<div class="dashboard-item missed" onclick="openStudentDetail('${uid}', '${w.date}')"><span class="dashboard-icon missed">⚠️</span><div class="dashboard-text"><strong>${userData.name.split(' ')[0]}</strong> dünkü antrenmanı kaçırdı.</div></div>`; hasAlerts = true; }
                if ((w.date === todayStr || w.date === yesterdayStr) && w.isCompleted) { userItems += `<div class="dashboard-item review" onclick="openStudentDetail('${uid}', '${w.date}')"><span class="dashboard-icon review">🔔</span><div class="dashboard-text"><strong>${userData.name.split(' ')[0]}</strong> rapor gönderdi (RPE: ${w.reportRpe || '-'}).</div></div>`; hasAlerts = true; }
                if (w.date === todayStr && !w.isCompleted) { userItems += `<div class="dashboard-item today" onclick="openStudentDetail('${uid}', '${w.date}')"><span class="dashboard-icon today">📅</span><div class="dashboard-text"><strong>${userData.name.split(' ')[0]}</strong> bugün antrenman yapacak.</div></div>`; hasAlerts = true; }
            }); return userItems;
        });
        Promise.all(promises).then(results => {
            html += results.join('');
            if (!hasAlerts) html += `<p style="font-size:12px; color:gray; text-align:center;">Bugün için hareket yok.</p>`;
            html += `</div>`; container.innerHTML = html;
        });
    });
}

async function openStudentDetail(targetUserId, dateToFocus) {
    activeStudentId = targetUserId;
    const userDoc = await db.collection('users').doc(targetUserId).get(); const userData = userDoc.data();
    document.getElementById('student-name').innerText = userData.name; document.getElementById('student-avatar').style.backgroundImage = `url('${userData.photo}')`;
    db.collection('users').doc(targetUserId).collection('my_races').orderBy('date', 'asc').get().then(snap => { 
        let l=''; snap.forEach(d=>{const r=d.data();const [y,m,x]=r.date.split('-');l+=`<div class="my-race-item" style="border-left-color:#4a90e2;"><div class="my-race-date"><div class="my-race-day" style="color:#4a90e2;">${x}</div><div class="my-race-month">${m}</div></div><div style="flex:1"><div style="font-weight:bold; font-size:14px;">${r.name}</div><div style="font-size:11px; color:#888;">${r.category}</div></div></div>`;}); 
        document.getElementById('student-races-list').innerHTML = l || '<p style="font-size:12px;color:gray;">Hedef yok.</p>';
    });
    db.collection('users').doc(targetUserId).collection('workouts').get().then(snap => {
        const studentWorkouts = []; snap.forEach(d => { const dd = d.data(); dd.id = d.id; studentWorkouts.push(dd); });
        renderStudentCalendarWithData(studentWorkouts);
        renderCharts('studentRpeChart', 'studentConsistencyChart', studentWorkouts, 'studentVolumeChart');
    });
    if (dateToFocus) { const [y, m, d] = dateToFocus.split('-'); studentYear = parseInt(y); studentMonth = parseInt(m) - 1; setTimeout(() => clickStudentDate(dateToFocus), 600); }
    switchView('student-detail');
}

function renderStudentCalendarWithData(workouts) {
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    document.getElementById('studentMonthLabel').innerText = `${monthNames[studentMonth]} ${studentYear}`;
    const firstDay = new Date(studentYear, studentMonth, 1).getDay(); const startDay = firstDay===0?6:firstDay-1; const daysInMonth=new Date(studentYear,studentMonth+1,0).getDate();
    let html=''; for(let i=0;i<startDay;i++)html+=`<div class="day-cell empty"></div>`;
    for(let d=1;d<=daysInMonth;d++){
        const m=(studentMonth+1).toString().padStart(2,'0'); const da=d.toString().padStart(2,'0'); const fd=`${studentYear}-${m}-${da}`;
        const w=workouts.find(x=>x.date===fd);
        let cls=''; if(w) cls=w.isCompleted?'has-workout completed':'has-workout';
        html+=`<div class="day-cell ${cls}" onclick="clickStudentDate('${fd}')">${d}</div>`;
    }
    document.getElementById('student-calendar-days').innerHTML=html;
}

function renderStudentCalendar() { 
    db.collection('users').doc(activeStudentId).collection('workouts').get().then(snap => { 
        const workouts = []; snap.forEach(d => { const dd = d.data(); dd.id = d.id; workouts.push(dd); }); 
        renderStudentCalendarWithData(workouts); 
    }); 
}

function changeStudentMonth(dir) { studentMonth += dir; if(studentMonth < 0) { studentMonth = 11; studentYear--; } else if (studentMonth > 11) { studentMonth = 0; studentYear++; } renderStudentCalendar(); }
function clickStudentDate(dateStr) { db.collection('users').doc(activeStudentId).collection('workouts').where('date','==',dateStr).get().then(snap=>{ if(!snap.empty){ const d=snap.docs[0]; const w=d.data(); openWorkoutView(d.id, w.title, w.date, w.desc, w.isCompleted, w.stravaLink, activeStudentId, w.reportRpe, w.reportNote); } else { openWorkoutAssignModal(dateStr); } }); }

function loadUsers() {
    if(!db) return;
    db.collection('users').orderBy('joinedAt', 'desc').onSnapshot(snapshot => {
        let html = '';
        snapshot.forEach(doc => {
            const u = doc.data(); const roleClass = u.role === 'admin' ? 'admin' : ''; const roleText = u.role === 'admin' ? 'YÖNETİCİ' : 'ÖĞRENCİ';
            html += `<div class="user-row" onclick="openStudentDetail('${doc.id}')"><div class="user-info"><div class="user-mini-avatar" style="background-image:url('${u.photo || ''}')"></div><div><div class="user-name">${u.name}</div><div class="user-email">${u.email}</div></div></div><div class="user-role-tag ${roleClass}">${roleText}</div></div>`;
        });
        document.getElementById('user-list-container').innerHTML = html || '<p>Kullanıcı yok.</p>';
    });
}

function loadMyRaces() {
    if (!currentUserId || !db) return;
    db.collection('users').doc(currentUserId).collection('my_races').orderBy('date', 'asc').onSnapshot(snap => {
        myRaces = []; let h = '';
        snap.forEach(d => {
            const dat = d.data(); myRaces.push({ id: d.id, date: dat.date, raceId: dat.raceId }); const [y, m, da] = dat.date.split('-');
            const mainRace = allRaces.find(r => r.id === dat.raceId);
            const iconFile = (mainRace && mainRace.type === 'trail') ? 'icon-trail.jpg' : 'icon-road.jpg';
            h += `<div class="my-race-item"><div style="margin-right:10px;"><img src="${iconFile}" class="race-type-icon"></div><div class="my-race-date"><div class="my-race-day">${da}</div><div class="my-race-month">${m}</div></div><div style="flex:1"><div style="font-weight:bold; font-size:14px;">${dat.name}</div><div style="font-size:11px; color:#888;">${dat.category}</div></div><button class="btn-delete" onclick="removeFromMyRaces('${d.id}')">×</button></div>`;
        });
        const lc = document.getElementById('my-races-list'); if (lc) lc.innerHTML = h || '<p style="color:gray; font-size:12px;">Henüz hedef yok.</p>'; renderCalendar(); updateFeedHeader();
    });
}

function toggleMyRace(raceId, raceName, raceDate, raceCat, btnElement) { if (!currentUserId) return alert("Giriş yapmalısın."); const existing = myRaces.find(r => r.raceId === raceId); if (existing) { if (confirm("Çıkarmak istiyor musun?")) db.collection('users').doc(currentUserId).collection('my_races').doc(existing.id).delete(); return; } const conflict = myRaces.find(r => r.date === raceDate); if (conflict) return alert("⚠️ Çakışma var!"); db.collection('users').doc(currentUserId).collection('my_races').add({ raceId: raceId, name: raceName, date: raceDate, category: raceCat, addedAt: new Date() }).then(() => alert("Eklendi! 🎯")); }
function removeFromMyRaces(docId) { if (confirm("Silmek istiyor musun?")) db.collection('users').doc(currentUserId).collection('my_races').doc(docId).delete(); }
function deleteRace(raceId) { if (confirm("Silmek istiyor musun?")) db.collection('races').doc(raceId).delete(); }
function openAddModal() { if (!selectedFullDate) return; document.getElementById('modalDateLabel').innerText = selectedFullDate; document.getElementById('modal-overlay').style.display = 'flex'; }
function closeAddModal() { document.getElementById('modal-overlay').style.display = 'none'; document.getElementById('modalRaceName').value = ''; document.getElementById('modalRaceCat').value = ''; document.getElementById('modalRaceWeb').value = ''; }

function saveRaceFromModal() {
    const name = document.getElementById('modalRaceName').value; const cat = document.getElementById('modalRaceCat').value; const type = document.getElementById('modalRaceType').value; const web = document.getElementById('modalRaceWeb').value;
    if (!name) return alert("İsim giriniz");
    db.collection('races').add({ name: name, category: cat, date: selectedFullDate, type: type, website: web, createdAt: new Date() }).then(closeAddModal);
}

function saveNews() { const title = document.getElementById('newsTitle').value; const tag = document.getElementById('newsTag').value; const content = document.getElementById('newsContent').value; if (!title) return alert("Başlık giriniz"); db.collection('news').add({ title: title, tag: tag || 'GENEL', content: content, date: new Date(), color: '#FF6B35' }).then(() => { alert("Haber Yayınlandı!"); switchView('feed'); }); }

function updateUIForUser(user, role) {
    const profileTrigger = document.getElementById('profile-trigger');
    if (profileTrigger) { profileTrigger.classList.add('active'); profileTrigger.innerHTML = `<div class="user-avatar-small" style="background-image:url('${user.photoURL}')"></div>`; }
    document.querySelector('#view-locker .profile-header h3').innerText = user.displayName; document.querySelector('#view-locker .profile-header .avatar').style.backgroundImage = `url('${user.photoURL}')`;
    document.querySelector('.login-prompt').style.display = 'none'; document.getElementById('my-races-section').style.display = 'block';
    const statsSection = document.getElementById('my-stats-section'); if (statsSection) statsSection.style.display = 'block';
    document.getElementById('feed-header-card').style.display = 'flex'; 
    if (role === 'admin') {
        document.querySelector('.role-badge').innerText = "YÖNETİCİ"; document.querySelector('.role-badge').style.background = "#D32F2F";
        if (!document.getElementById('btnAdmin')) { const btn = document.createElement('button'); btn.id = 'btnAdmin'; btn.innerHTML = "⚡ YÖNETİCİ PANELİ"; btn.className = "btn-primary"; btn.style.marginTop = "15px"; btn.style.background = "#D32F2F"; btn.onclick = () => switchView('admin'); document.querySelector('#view-locker .profile-header').appendChild(btn); }
    } else { document.querySelector('.role-badge').innerText = "MEMBER"; }
    if (!document.getElementById('btnLogout')) { const btn = document.createElement('button'); btn.id = 'btnLogout'; btn.innerText = "ÇIKIŞ YAP"; btn.className = "btn-primary"; btn.style.marginTop = "10px"; btn.style.background = "#333"; btn.onclick = () => auth.signOut(); document.getElementById('view-locker').appendChild(btn); }
}

function updateUIForGuest() {
    const profileTrigger = document.getElementById('profile-trigger');
    if (profileTrigger) { profileTrigger.classList.remove('active'); profileTrigger.innerHTML = `<span class="material-icons-round guest-icon">person_outline</span>`; }
    document.querySelector('#view-locker .profile-header h3').innerText = "Misafir Kullanıcı"; document.querySelector('.login-prompt').style.display = 'block'; document.getElementById('my-races-section').style.display = 'none';
    const statsSection = document.getElementById('my-stats-section'); if (statsSection) statsSection.style.display = 'none';
    document.getElementById('feed-header-card').style.display = 'none'; 
    if (document.getElementById('btnAdmin')) document.getElementById('btnAdmin').remove(); if (document.getElementById('btnLogout')) document.getElementById('btnLogout').remove();
}

function loadRaces() { 
    if(!db) return;
    db.collection('races').orderBy('date', 'asc').onSnapshot(snapshot => { allRaces = []; snapshot.forEach(doc => { const d = doc.data(); d.id = doc.id; allRaces.push(d); }); renderCalendar(); if (!selectedFullDate) showUpcomingRaces(); else showDayDetails(selectedFullDate); }); 
}

function renderCalendar() {
    const el=document.getElementById('calendar-days'); if(!el) return;
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    document.getElementById('currentMonthLabel').innerText = `${monthNames[currentMonth]} ${currentYear}`;
    const firstDay = new Date(currentYear, currentMonth, 1).getDay(); const startDay = firstDay === 0 ? 6 : firstDay - 1; const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    let html = '';
    for (let i = 0; i < startDay; i++) { html += `<div class="day-cell empty"></div>`; }
    for (let day = 1; day <= daysInMonth; day++) {
        const monthStr = (currentMonth + 1).toString().padStart(2, '0'); const dayStr = day.toString().padStart(2, '0'); const fullDate = `${currentYear}-${monthStr}-${dayStr}`;
        const race = allRaces.find(r => r.date === fullDate); const hasMyRace = myRaces.some(r => r.date === fullDate); const workout = myWorkouts.find(w => w.date === fullDate);
        let workoutClass = ''; if (workout) workoutClass = workout.isCompleted ? 'has-workout completed' : 'has-workout';
        let classes = workoutClass; if (hasMyRace) classes += ' has-my-race'; else if (race) classes += ' has-race';
        let iconHtml = '';
        if (race) {
            const iconFile = race.type === 'trail' ? 'icon-trail.jpg' : 'icon-road.jpg';
            iconHtml = `<img src="${iconFile}" class="race-type-icon-small">`;
        }
        const todayClass = (new Date().toISOString().slice(0, 10) === fullDate) ? 'today' : ''; const selectedClass = (selectedFullDate === fullDate) ? 'selected' : '';
        html += `<div class="day-cell ${classes} ${todayClass} ${selectedClass}" onclick="selectDate('${fullDate}', this)">${day} ${iconHtml}</div>`;
    }
    el.innerHTML = html;
}

function changeMonth(dir) { currentMonth += dir; if (currentMonth < 0) { currentMonth = 11; currentYear--; } else if (currentMonth > 11) { currentMonth = 0; currentYear++; } renderCalendar(); }
function selectDate(fd, el) { if (selectedFullDate === fd) { el.classList.remove('selected'); selectedFullDate = null; showUpcomingRaces(); } else { document.querySelectorAll('.day-cell').forEach(e => e.classList.remove('selected')); el.classList.add('selected'); selectedFullDate = fd; showDayDetails(fd); } }
function goToDate(dateStr) { const [y, m, d] = dateStr.split('-'); currentYear = parseInt(y); currentMonth = parseInt(m) - 1; renderCalendar(); setTimeout(() => { selectedFullDate = dateStr; showDayDetails(dateStr); document.querySelectorAll('.day-cell').forEach(cell => { if (parseInt(cell.innerText) == parseInt(d) && !cell.classList.contains('empty')) { cell.classList.add('selected'); } }); }, 100); }

function showDayDetails(dateStr) {
    const pnl = document.getElementById('day-details-panel'); pnl.style.display = 'block';
    const [y, m, d] = dateStr.split('-');
    document.querySelector('#day-details-panel .details-header h3').innerText = `${d}.${m}.${y}`;
    document.querySelector('#day-details-panel .day-badge').innerText = "SEÇİLDİ"; document.querySelector('#day-details-panel .day-badge').style.background = "var(--orange)";
    let html = '';

    const workout = myWorkouts.find(w => w.date === dateStr);
    if (workout) {
        const statusIcon = workout.isCompleted ? '☑' : '☐'; const cardClass = workout.isCompleted ? 'workout-mini-card completed' : 'workout-mini-card';
        html += `<div class="${cardClass}" onclick="openWorkoutView('${workout.id}', '${workout.title}', '${workout.date}', '${workout.desc}', '${workout.isCompleted}', '${workout.stravaLink}', '${currentUserId}', '${workout.reportRpe}', '${workout.reportNote}')"><div><div style="font-weight:bold; color:var(--blue); font-size:11px;">ANTRENMAN</div><div style="font-weight:bold;">${workout.title}</div></div><div style="font-size:18px;">${statusIcon}</div></div>`;
    }

    const racesThatDay = allRaces.filter(r => r.date === dateStr);
    if (racesThatDay.length > 0) {
        racesThatDay.forEach(race => {
            let deleteBtn = ''; if (currentUserRole === 'admin') deleteBtn = `<button class="btn-delete" onclick="deleteRace('${race.id}')">🗑️</button>`;
            const isAdded = myRaces.some(r => r.raceId === race.id); const btnText = isAdded ? "✓" : "＋"; const btnClass = isAdded ? "btn-target added" : "btn-target";
            const iconFile = race.type === 'trail' ? 'icon-trail.jpg' : 'icon-road.jpg';
            let webLink = ''; if(race.website) { webLink = `<a href="${race.website}" target="_blank" class="btn-link">🌐 WEB</a>`; }
            html += `<div class="race-mini-card"><div style="margin-right:10px;"><img src="${iconFile}" class="race-type-icon"></div><div style="flex:1;"><div style="font-weight:bold;">${race.name}</div><div style="font-size:11px; color:gray;">${race.category}</div></div><div style="display:flex; align-items:center; gap:5px;">${webLink}<button class="${btnClass}" onclick="toggleMyRace('${race.id}', '${race.name}', '${race.date}', '${race.category}', this)">${btnText}</button>${deleteBtn}</div></div>`;
        });
    }

    if (html === '') html = '<p style="color:gray; font-size:12px; margin-top:10px;">Etkinlik yok.</p>';
    document.getElementById('selected-day-races').innerHTML = html;
    
    // FREE KULLANICI / ADMIN BUTONU
    const actionContainer = document.getElementById('day-action-buttons');
    if(actionContainer) {
        let btnHtml = '';
        if (currentUserRole === 'admin') {
            btnHtml = `<button id="btnAddRaceToDay" class="btn-primary" onclick="openAddModal()">＋ SİSTEME YARIŞ EKLE</button>`;
        } else if (currentUserId) {
            btnHtml = `<button class="btn-primary" style="background:#333; border:1px solid #555;" onclick="openWorkoutAssignModal('${dateStr}')">＋ ANTRENMAN EKLE</button>`;
        }
        actionContainer.innerHTML = btnHtml;
    }
}

function showUpcomingRaces() {
    const pnl = document.getElementById('day-details-panel'); pnl.style.display = 'block';
    document.querySelector('#day-details-panel .details-header h3').innerText = "YAKLAŞAN YARIŞLAR";
    document.querySelector('#day-details-panel .day-badge').innerText = "LİSTE"; document.querySelector('#day-details-panel .day-badge').style.background = "#4a90e2";
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = allRaces.filter(r => r.date >= today).slice(0, 3);
    let html = '';
    if (upcoming.length > 0) {
        upcoming.forEach(race => {
            const [y, m, d] = race.date.split('-');
            const iconFile = race.type === 'trail' ? 'icon-trail.jpg' : 'icon-road.jpg';
            html += `<div class="race-mini-card" onclick="goToDate('${race.date}')" style="cursor:pointer;"><div style="margin-right:15px; text-align:center; min-width:35px;"><div style="font-weight:bold; color:white;">${d}</div><div style="font-size:10px; color:gray;">${m}</div></div><div style="margin-right:10px;"><img src="${iconFile}" class="race-type-icon"></div><div style="flex:1;"><div style="font-weight:bold;">${race.name}</div><div style="font-size:11px; color:gray;">${race.category}</div></div><div style="font-size:14px; opacity:0.5;">❯</div></div>`;
        });
    } else { html = '<p style="color:gray; font-size:12px; margin-top:10px;">Yakında yarış yok.</p>'; }
    document.getElementById('selected-day-races').innerHTML = html; 
    document.getElementById('day-action-buttons').innerHTML = '';
}

document.addEventListener('click', (e) => { if (e.target && e.target.id == 'btnLogin') loginWithGoogle(); });