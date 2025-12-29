console.log("Checkpoint Collective - Tam Sürüm 🚀");

// --- SPLASH EKRANI ---
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) {
            splash.classList.add('hidden');
            setTimeout(() => splash.remove(), 500);
        }
    }, 2500);
});

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- GLOBAL DEĞİŞKENLER ---
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); 
let selectedFullDate = null; 

let allRaces = [];      // Sistemdeki tüm yarışlar
let myRaces = [];       // Benim hedef yarışlarım
let myWorkouts = [];    // Benim antrenmanlarım

let currentUserRole = 'free';
let currentUserId = null;

// Koçluk Değişkenleri
let activeStudentId = null; 
let studentYear = new Date().getFullYear();
let studentMonth = new Date().getMonth();

// RPE Seçimi
let selectedRpe = 0;

// --- GİRİŞ İŞLEMLERİ ---
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(e => alert(e.message));
}

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUserId = user.uid;
        // Kullanıcı Kaydı/Kontrolü
        const userRef = db.collection('users').doc(user.uid);
        const doc = await userRef.get();
        if (!doc.exists) {
            await userRef.set({
                name: user.displayName, email: user.email, photo: user.photoURL, role: 'free', joinedAt: new Date()
            });
        }
        
        currentUserRole = doc.data().role || 'free';
        updateUIForUser(user, currentUserRole);
        
        // Verileri Yükle
        loadMyRaces(); 
        loadMyWorkouts(currentUserId); 
        
        if(currentUserRole === 'admin') loadUsers();
    } else {
        // Çıkış Yapılmışsa Sıfırla
        currentUserId = null;
        currentUserRole = 'free';
        myRaces = [];
        myWorkouts = [];
        updateUIForGuest();
    }
    
    // Her durumda genel verileri çek
    loadNews();
    loadRaces();
});

// ==========================================
// 1. TAKVİM VE YARIŞ SİSTEMİ
// ==========================================

function loadRaces() {
    db.collection('races').orderBy('date', 'asc').onSnapshot(snapshot => {
        allRaces = [];
        snapshot.forEach(doc => { 
            const d = doc.data(); 
            d.id = doc.id; 
            allRaces.push(d); 
        });
        renderCalendar(); // Veri gelince takvimi çiz
        
        if(!selectedFullDate) showUpcomingRaces();
        else showDayDetails(selectedFullDate);
    });
}

function renderCalendar() {
    const calendarEl = document.getElementById('calendar-days');
    if(!calendarEl) return; // Element yoksa dur (Hata vermesin)

    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    document.getElementById('currentMonthLabel').innerText = `${monthNames[currentMonth]} ${currentYear}`;
    
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const startDay = firstDay === 0 ? 6 : firstDay - 1; 
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    let html = '';
    
    // Boşluklar
    for (let i = 0; i < startDay; i++) {
        html += `<div class="day-cell empty"></div>`;
    }
    
    // Günler
    for (let day = 1; day <= daysInMonth; day++) {
        const monthStr = (currentMonth + 1).toString().padStart(2, '0');
        const dayStr = day.toString().padStart(2, '0');
        const fullDate = `${currentYear}-${monthStr}-${dayStr}`;
        
        const hasRace = allRaces.some(r => r.date === fullDate);
        const hasMyRace = myRaces.some(r => r.date === fullDate);
        
        // Antrenman Kontrolü
        const workout = myWorkouts.find(w => w.date === fullDate);
        let workoutClass = '';
        if(workout) {
            workoutClass = workout.isCompleted ? 'has-workout completed' : 'has-workout';
        }

        let classes = workoutClass;
        if (hasMyRace) classes += ' has-my-race';
        else if (hasRace) classes += ' has-race';
        
        const todayClass = (new Date().toISOString().slice(0,10) === fullDate) ? 'today' : '';
        const selectedClass = (selectedFullDate === fullDate) ? 'selected' : '';
        
        html += `<div class="day-cell ${classes} ${todayClass} ${selectedClass}" onclick="selectDate('${fullDate}', this)">${day}</div>`;
    }
    
    calendarEl.innerHTML = html;
}

function changeMonth(direction) {
    currentMonth += direction;
    if(currentMonth < 0) { currentMonth = 11; currentYear--; } 
    else if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
}

function selectDate(fullDate, element) {
    if (selectedFullDate === fullDate) { 
        // Seçimi kaldır
        element.classList.remove('selected'); 
        selectedFullDate = null; 
        showUpcomingRaces(); 
    } else { 
        // Yeni seçim
        document.querySelectorAll('.day-cell').forEach(el => el.classList.remove('selected')); 
        element.classList.add('selected'); 
        selectedFullDate = fullDate; 
        showDayDetails(fullDate); 
    } 
}

function goToDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    currentYear = parseInt(y);
    currentMonth = parseInt(m) - 1; 
    renderCalendar();
    
    // Biraz bekle dom güncellensin
    setTimeout(() => {
        selectedFullDate = dateStr;
        showDayDetails(dateStr);
        // Günü görsel olarak seç
        document.querySelectorAll('.day-cell').forEach(cell => {
             if(parseInt(cell.innerText) == parseInt(d) && !cell.classList.contains('empty')) {
                 cell.classList.add('selected');
             }
        });
    }, 100);
}

// ==========================================
// 2. ANTRENMAN (WORKOUT) SİSTEMİ
// ==========================================

function loadMyWorkouts(userId) {
    db.collection('users').doc(userId).collection('workouts').onSnapshot(snapshot => {
          // Eğer kendi hesabıma bakıyorsam
          if(userId === currentUserId) {
              myWorkouts = [];
              snapshot.forEach(doc => { 
                  const d = doc.data(); 
                  d.id = doc.id; 
                  myWorkouts.push(d); 
              });
              renderCalendar(); // Ana takvimi güncelle
              if(selectedFullDate) showDayDetails(selectedFullDate);
          }
          
          // Eğer Admin olarak bir öğrenciye bakıyorsam
          if(activeStudentId === userId) {
             renderStudentCalendar();
          }
    });
}

function openWorkoutAssignModal(dateStr) {
    document.getElementById('modalWorkoutDateLabel').innerText = "Tarih: " + dateStr;
    document.getElementById('modalWorkoutDateLabel').dataset.date = dateStr; 
    document.getElementById('modal-workout-assign').style.display = 'flex';
}

function closeWorkoutModal() {
    document.getElementById('modal-workout-assign').style.display = 'none';
    document.getElementById('workoutTitle').value = '';
    document.getElementById('workoutDesc').value = '';
}

function saveWorkout() {
    if(!activeStudentId) return; 
    const dateStr = document.getElementById('modalWorkoutDateLabel').dataset.date;
    const title = document.getElementById('workoutTitle').value;
    const desc = document.getElementById('workoutDesc').value;

    if(!title) return alert("Başlık yazmalısın.");

    db.collection('users').doc(activeStudentId).collection('workouts').add({
        date: dateStr, 
        title: title, 
        desc: desc, 
        isCompleted: false, 
        stravaLink: "", 
        assignedBy: currentUserId, 
        createdAt: new Date(),
        reportRpe: 0, 
        reportNote: ""
    }).then(() => { 
        closeWorkoutModal(); 
        alert("Antrenman Gönderildi! 📨"); 
    });
}

// --- DETAY VE RAPORLAMA ---
let openWorkoutId = null;

function openWorkoutView(workoutId, title, date, desc, isCompleted, stravaLink, ownerId, rpe, note) {
    openWorkoutId = workoutId;
    document.getElementById('modal-workout-view').style.display = 'flex';
    document.getElementById('viewWorkoutTitle').innerText = title;
    document.getElementById('viewWorkoutDate').innerText = date;
    document.getElementById('viewWorkoutDesc').innerText = desc;

    const displayDiv = document.getElementById('workout-report-display');
    const formDiv = document.getElementById('workout-report-form');
    const btnOpen = document.getElementById('btnOpenReportForm');

    // Tamamlanmış mı kontrol et (Firebase boolean veya string gelebilir)
    const completed = (isCompleted === true || isCompleted === 'true');

    if(completed) {
        displayDiv.style.display = 'block';
        formDiv.style.display = 'none';
        btnOpen.style.display = 'none';

        document.getElementById('displayRpe').innerText = (rpe || '-') + "/10";
        document.getElementById('displayNote').innerText = note ? `"${note}"` : "Not yok.";
        
        if(stravaLink) {
            document.getElementById('displayStrava').innerHTML = `<a href="${stravaLink}" target="_blank" style="color:var(--blue); font-size:11px; text-decoration:none;">🔗 Strava'da Aç</a>`;
        } else {
            document.getElementById('displayStrava').innerHTML = "";
        }
    } else {
        displayDiv.style.display = 'none';
        formDiv.style.display = 'none';
        btnOpen.style.display = 'block';
        
        // Formu sıfırla
        selectedRpe = 0;
        document.getElementById('rpeValueDisplay').innerText = "Seçilmedi";
        document.querySelectorAll('.rpe-box').forEach(b => b.classList.remove('selected'));
        document.getElementById('reportNote').value = "";
        document.getElementById('reportStrava').value = "";
    }
}

function showReportForm() {
    document.getElementById('btnOpenReportForm').style.display = 'none';
    document.getElementById('workout-report-form').style.display = 'block';
}

function selectRpe(val) {
    selectedRpe = val;
    document.getElementById('rpeValueDisplay').innerText = val + "/10";
    document.querySelectorAll('.rpe-box').forEach(b => b.classList.remove('selected'));
    // Index mantığı (0'dan başladığı için -1)
    const boxes = document.querySelectorAll('.rpe-box');
    if(boxes[val-1]) boxes[val-1].classList.add('selected');
}

function submitWorkoutReport() {
    if(!openWorkoutId) return;
    if(selectedRpe === 0) return alert("Lütfen bir zorluk derecesi seç.");

    const note = document.getElementById('reportNote').value;
    const link = document.getElementById('reportStrava').value;
    const targetId = activeStudentId || currentUserId;
    
    db.collection('users').doc(targetId).collection('workouts').doc(openWorkoutId).update({
        isCompleted: true,
        reportRpe: selectedRpe,
        reportNote: note,
        stravaLink: link,
        completedAt: new Date()
    }).then(() => {
        closeWorkoutViewModal();
    });
}

function closeWorkoutViewModal() {
    document.getElementById('modal-workout-view').style.display = 'none';
    openWorkoutId = null;
}

// ==========================================
// 3. KOÇLUK / ÖĞRENCİ DETAYI
// ==========================================

async function openStudentDetail(targetUserId) {
    activeStudentId = targetUserId;
    const userDoc = await db.collection('users').doc(targetUserId).get();
    const userData = userDoc.data();

    document.getElementById('student-name').innerText = userData.name;
    document.getElementById('student-avatar').style.backgroundImage = `url('${userData.photo}')`;

    // Öğrencinin Hedef Yarışları
    db.collection('users').doc(targetUserId).collection('my_races').orderBy('date', 'asc').get()
        .then(snapshot => {
            let listHtml = '';
            snapshot.forEach(doc => {
                const r = doc.data();
                const [y, m, d] = r.date.split('-');
                listHtml += `
                <div class="my-race-item" style="border-left-color:#4a90e2;">
                    <div class="my-race-date">
                        <div class="my-race-day" style="color:#4a90e2;">${d}</div>
                        <div class="my-race-month">${m}</div>
                    </div>
                    <div style="flex:1">
                        <div style="font-weight:bold; font-size:14px;">${r.name}</div>
                        <div style="font-size:11px; color:#888;">${r.category}</div>
                    </div>
                </div>`;
            });
            document.getElementById('student-races-list').innerHTML = listHtml || '<p style="font-size:12px;color:gray;">Hedef yok.</p>';
        });

    // Öğrencinin Antrenmanları ve Takvimi
    loadMyWorkouts(targetUserId); 
    renderStudentCalendar();

    switchView('student-detail');
}

function renderStudentCalendar() {
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    document.getElementById('studentMonthLabel').innerText = `${monthNames[studentMonth]} ${studentYear}`;
    
    const firstDay = new Date(studentYear, studentMonth, 1).getDay();
    const startDay = firstDay === 0 ? 6 : firstDay - 1; 
    const daysInMonth = new Date(studentYear, studentMonth + 1, 0).getDate();
    
    // Anlık veri çek (Active Student için)
    db.collection('users').doc(activeStudentId).collection('workouts').get().then(snap => {
        const studentWorkouts = []; 
        snap.forEach(d => {
            const dd = d.data(); 
            dd.id = d.id; 
            studentWorkouts.push(dd);
        });

        let html = '';
        for (let i = 0; i < startDay; i++) html += `<div class="day-cell empty"></div>`;
        
        for (let day = 1; day <= daysInMonth; day++) {
            const monthStr = (studentMonth + 1).toString().padStart(2, '0');
            const dayStr = day.toString().padStart(2, '0');
            const fullDate = `${studentYear}-${monthStr}-${dayStr}`;
            
            const workout = studentWorkouts.find(w => w.date === fullDate);
            let dotClass = '';
            if(workout) dotClass = workout.isCompleted ? 'has-workout completed' : 'has-workout';

            html += `<div class="day-cell ${dotClass}" onclick="clickStudentDate('${fullDate}')">${day}</div>`;
        }
        document.getElementById('student-calendar-days').innerHTML = html;
    });
}

function changeStudentMonth(direction) {
    studentMonth += direction;
    if(studentMonth < 0) { studentMonth = 11; studentYear--; } 
    else if (studentMonth > 11) { studentMonth = 0; studentYear++; }
    renderStudentCalendar();
}

function clickStudentDate(dateStr) {
    db.collection('users').doc(activeStudentId).collection('workouts').where('date','==',dateStr).get().then(snap => {
        if(!snap.empty){
            const d = snap.docs[0]; 
            const w = d.data();
            openWorkoutView(d.id, w.title, w.date, w.desc, w.isCompleted, w.stravaLink, activeStudentId, w.reportRpe, w.reportNote);
        } else { 
            openWorkoutAssignModal(dateStr); 
        }
    });
}

// ==========================================
// 4. LİSTELER VE UI YARDIMCILARI
// ==========================================

function showDayDetails(dateStr) {
    const pnl = document.getElementById('day-details-panel'); 
    pnl.style.display = 'block';
    
    const [y, m, d] = dateStr.split('-');
    document.querySelector('#day-details-panel .details-header h3').innerText = `${d}.${m}.${y}`;
    document.querySelector('#day-details-panel .day-badge').innerText = "SEÇİLDİ";
    document.querySelector('#day-details-panel .day-badge').style.background = "var(--orange)";

    let html = '';

    // ANTRENMAN GÖSTERİMİ
    const workout = myWorkouts.find(w => w.date === dateStr);
    if(workout) {
        const statusIcon = workout.isCompleted ? '☑' : '☐';
        const cardClass = workout.isCompleted ? 'workout-mini-card completed' : 'workout-mini-card';
        
        html += `
        <div class="${cardClass}" onclick="openWorkoutView('${workout.id}', '${workout.title}', '${workout.date}', '${workout.desc}', '${workout.isCompleted}', '${workout.stravaLink}', '${currentUserId}', '${workout.reportRpe}', '${workout.reportNote}')">
            <div>
                <div style="font-weight:bold; color:var(--blue); font-size:11px;">ANTRENMAN</div>
                <div style="font-weight:bold;">${workout.title}</div>
            </div>
            <div style="font-size:18px;">${statusIcon}</div>
        </div>`;
    }

    // YARIŞ GÖSTERİMİ
    const racesThatDay = allRaces.filter(r => r.date === dateStr);
    if (racesThatDay.length > 0) {
        racesThatDay.forEach(race => {
            let deleteBtn = '';
            if (currentUserRole === 'admin') deleteBtn = `<button class="btn-delete" onclick="deleteRace('${race.id}')">🗑️</button>`;
            
            const isAdded = myRaces.some(r => r.raceId === race.id);
            const btnText = isAdded ? "✓" : "＋";
            const btnClass = isAdded ? "btn-target added" : "btn-target";
            
            html += `
            <div class="race-mini-card">
                <div style="flex:1;">
                    <div style="font-weight:bold;">${race.name}</div>
                    <div style="font-size:11px; color:gray;">${race.category}</div>
                </div>
                <div style="display:flex; align-items:center; gap:5px;">
                    <button class="${btnClass}" onclick="toggleMyRace('${race.id}', '${race.name}', '${race.date}', '${race.category}', this)">${btnText}</button>
                    ${deleteBtn}
                </div>
            </div>`;
        });
    }

    if(html === '') html = '<p style="color:gray; font-size:12px; margin-top:10px;">Etkinlik yok.</p>';
    document.getElementById('selected-day-races').innerHTML = html;
    
    if (currentUserRole === 'admin') document.getElementById('btnAddRaceToDay').style.display = 'block';
    else document.getElementById('btnAddRaceToDay').style.display = 'none';
}

function showUpcomingRaces() {
    const pnl = document.getElementById('day-details-panel'); 
    pnl.style.display = 'block';
    document.querySelector('#day-details-panel .details-header h3').innerText = "YAKLAŞAN YARIŞLAR";
    document.querySelector('#day-details-panel .day-badge').innerText = "LİSTE";
    document.querySelector('#day-details-panel .day-badge').style.background = "#4a90e2";
    
    const today = new Date().toISOString().slice(0,10);
    const upcoming = allRaces.filter(r => r.date >= today).slice(0, 3);
    
    let html = '';
    if (upcoming.length > 0) {
        upcoming.forEach(race => {
            const [y, m, d] = race.date.split('-');
            html += `
            <div class="race-mini-card" onclick="goToDate('${race.date}')" style="cursor:pointer;">
                <div style="margin-right:15px; text-align:center; min-width:35px;">
                    <div style="font-weight:bold; color:white;">${d}</div>
                    <div style="font-size:10px; color:gray;">${m}</div>
                </div>
                <div style="flex:1;">
                    <div style="font-weight:bold;">${race.name}</div>
                    <div style="font-size:11px; color:gray;">${race.category}</div>
                </div>
                <div style="font-size:14px; opacity:0.5;">❯</div>
            </div>`;
        });
    } else { 
        html = '<p style="color:gray; font-size:12px; margin-top:10px;">Yakında yarış yok.</p>'; 
    }
    
    document.getElementById('selected-day-races').innerHTML = html;
    document.getElementById('btnAddRaceToDay').style.display = 'none';
}

function loadUsers() {
    db.collection('users').orderBy('joinedAt', 'desc').onSnapshot(snapshot => {
        let html = '';
        snapshot.forEach(doc => {
            const u = doc.data();
            const roleClass = u.role === 'admin' ? 'admin' : '';
            const roleText = u.role === 'admin' ? 'YÖNETİCİ' : 'ÖĞRENCİ';
            html += `
            <div class="user-row" onclick="openStudentDetail('${doc.id}')">
                <div class="user-info">
                    <div class="user-mini-avatar" style="background-image:url('${u.photo || ''}')"></div>
                    <div>
                        <div class="user-name">${u.name}</div>
                        <div class="user-email">${u.email}</div>
                    </div>
                </div>
                <div class="user-role-tag ${roleClass}">${roleText}</div>
            </div>`;
        });
        document.getElementById('user-list-container').innerHTML = html || '<p>Kullanıcı yok.</p>';
    });
}

function loadMyRaces() {
    if(!currentUserId) return;
    db.collection('users').doc(currentUserId).collection('my_races').orderBy('date', 'asc').onSnapshot(snap => {
        myRaces = [];
        let h = '';
        snap.forEach(d => {
            const dat = d.data();
            myRaces.push({ id: d.id, date: dat.date, raceId: dat.raceId });
            const [y, m, da] = dat.date.split('-');
            h += `
            <div class="my-race-item">
                <div class="my-race-date">
                    <div class="my-race-day">${da}</div>
                    <div class="my-race-month">${m}</div>
                </div>
                <div style="flex:1">
                    <div style="font-weight:bold; font-size:14px;">${dat.name}</div>
                    <div style="font-size:11px; color:#888;">${dat.category}</div>
                </div>
                <button class="btn-delete" onclick="removeFromMyRaces('${d.id}')">×</button>
            </div>`;
        });
        const lc = document.getElementById('my-races-list');
        if(lc) lc.innerHTML = h || '<p style="color:gray; font-size:12px;">Henüz hedef yok.</p>';
        renderCalendar();
    });
}

function toggleMyRace(raceId, raceName, raceDate, raceCat, btnElement) {
    if(!currentUserId) return alert("Giriş yapmalısın.");
    const existing = myRaces.find(r => r.raceId === raceId);
    if (existing) {
        if(confirm("Çıkarmak istiyor musun?")) db.collection('users').doc(currentUserId).collection('my_races').doc(existing.id).delete();
        return;
    }
    const conflict = myRaces.find(r => r.date === raceDate);
    if (conflict) return alert("⚠️ Çakışma var!");
    db.collection('users').doc(currentUserId).collection('my_races').add({ raceId: raceId, name: raceName, date: raceDate, category: raceCat, addedAt: new Date() }).then(() => alert("Eklendi! 🎯"));
}

function removeFromMyRaces(docId) {
    if(confirm("Silmek istiyor musun?")) db.collection('users').doc(currentUserId).collection('my_races').doc(docId).delete();
}

function deleteRace(raceId) { if(confirm("Silmek istiyor musun?")) db.collection('races').doc(raceId).delete(); }

function openAddModal() { if (!selectedFullDate) return; document.getElementById('modalDateLabel').innerText = selectedFullDate; document.getElementById('modal-overlay').style.display = 'flex'; }
function closeAddModal() { document.getElementById('modal-overlay').style.display = 'none'; document.getElementById('modalRaceName').value = ''; document.getElementById('modalRaceCat').value = ''; }
function saveRaceFromModal() { const name = document.getElementById('modalRaceName').value; const cat = document.getElementById('modalRaceCat').value; if (!name) return alert("İsim giriniz"); db.collection('races').add({ name: name, category: cat, date: selectedFullDate, createdAt: new Date() }).then(closeAddModal); }

function loadNews() {
    db.collection('news').orderBy('date', 'desc').onSnapshot(snapshot => {
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `<div class="news-card"><div class="news-img" style="background:${data.color || '#333'}"></div><div class="news-content"><div style="font-size:9px; color:var(--orange); font-weight:bold;">${data.tag}</div><h4>${data.title}</h4></div></div>`;
        });
        document.getElementById('news-container').innerHTML = html || '<p style="text-align:center; color:gray">Haber yok.</p>';
    });
}

function saveNews() { const title = document.getElementById('newsTitle').value; const tag = document.getElementById('newsTag').value; const content = document.getElementById('newsContent').value; if (!title) return alert("Başlık giriniz"); db.collection('news').add({ title: title, tag: tag || 'GENEL', content: content, date: new Date(), color: '#FF6B35' }).then(() => { alert("Haber Yayınlandı!"); switchView('feed'); }); }

// --- NAVİGASYON VE UI ---

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('view-' + viewName).classList.add('active');
    
    if(viewName === 'admin') { activeStudentId = null; }
    if(viewName === 'discover') { 
        selectedFullDate = null; 
        document.querySelectorAll('.day-cell').forEach(el => el.classList.remove('selected')); 
        renderCalendar(); // Takvimi tekrar çiz (görünüm bozukluğu varsa)
        showUpcomingRaces(); 
    }

    const map = {'feed':0, 'discover':1, 'locker':2};
    if(map[viewName]!==undefined) document.querySelectorAll('.nav-item')[map[viewName]].classList.add('active');
}

function updateUIForUser(user, role) {
    const profileTrigger = document.getElementById('profile-trigger');
    if(profileTrigger) {
        profileTrigger.classList.add('active');
        profileTrigger.innerHTML = `<div class="user-avatar-small" style="background-image:url('${user.photoURL}')"></div>`;
    }
    
    document.querySelector('#view-locker .profile-header h3').innerText = user.displayName;
    document.querySelector('#view-locker .profile-header .avatar').style.backgroundImage = `url('${user.photoURL}')`;
    document.querySelector('.login-prompt').style.display = 'none';
    document.getElementById('my-races-section').style.display = 'block';

    if (role === 'admin') {
        document.querySelector('.role-badge').innerText = "YÖNETİCİ";
        document.querySelector('.role-badge').style.background = "#D32F2F";
        
        if (!document.getElementById('btnAdmin')) {
            const btn = document.createElement('button');
            btn.id = 'btnAdmin';
            btn.innerHTML = "⚡ YÖNETİCİ PANELİ";
            btn.className = "btn-primary";
            btn.style.marginTop = "15px";
            btn.style.background = "#D32F2F";
            btn.onclick = () => switchView('admin');
            document.querySelector('#view-locker .profile-header').appendChild(btn);
        }
    } else {
        document.querySelector('.role-badge').innerText = "MEMBER";
    }
    
    if(!document.getElementById('btnLogout')) {
        const btn = document.createElement('button');
        btn.id = 'btnLogout';
        btn.innerText = "ÇIKIŞ YAP";
        btn.className = "btn-primary";
        btn.style.marginTop = "10px";
        btn.style.background = "#333";
        btn.onclick = () => auth.signOut();
        document.getElementById('view-locker').appendChild(btn);
    }
}

function updateUIForGuest() {
    const profileTrigger = document.getElementById('profile-trigger');
    if(profileTrigger) {
        profileTrigger.classList.remove('active');
        profileTrigger.innerHTML = `<span class="material-icons-round guest-icon">person_outline</span>`;
    }
    document.querySelector('#view-locker .profile-header h3').innerText = "Misafir Kullanıcı";
    document.querySelector('.login-prompt').style.display = 'block';
    document.getElementById('my-races-section').style.display = 'none';
    if(document.getElementById('btnAdmin')) document.getElementById('btnAdmin').remove();
    if(document.getElementById('btnLogout')) document.getElementById('btnLogout').remove();
}

document.addEventListener('click', (e) => { if(e.target && e.target.id == 'btnLogin') loginWithGoogle(); });