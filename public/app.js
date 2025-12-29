console.log("Checkpoint Collective - Master Sürüm (Okunabilir Format) 🚀");

// ==========================================
// 1. BAŞLANGIÇ VE AYARLAR
// ==========================================

// Splash Ekranı (Açılış Animasyonu)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.classList.add('hidden');
            setTimeout(() => splash.remove(), 500);
        }
    }, 2500);
});

// Firebase Başlatma
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- GLOBAL DEĞİŞKENLER ---
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedFullDate = null;

// Veri Listeleri (Hafıza)
let allRaces = [];          // Tüm yarışlar
let myRaces = [];           // Benim hedef yarışlarım
let myWorkouts = [];        // Benim antrenmanlarım (veya bakılan öğrencinin)
let workoutTemplates = [];  // Antrenman Şablonları

// Kullanıcı Durumu
let currentUserRole = 'free';
let currentUserId = null;

// Koçluk Modu Değişkenleri
let activeStudentId = null; // Şu an hangi öğrenciye bakıyoruz?
let studentYear = new Date().getFullYear();
let studentMonth = new Date().getMonth();

// Antrenman İşlemleri Değişkenleri
let selectedRpe = 0;
let editingWorkoutId = null; // Düzenleme modu için ID
let openWorkoutId = null;    // O an açık olan detay ID

// Grafik Referansları (Eskileri silmek için saklıyoruz)
let chartInstances = {};


// ==========================================
// 2. GİRİŞ VE KULLANICI YÖNETİMİ
// ==========================================

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(e => alert("Giriş Hatası: " + e.message));
}

// Ana Döngü: Kullanıcı Durumu Değişince Çalışır
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // --- GİRİŞ YAPILDI ---
        currentUserId = user.uid;
        console.log("Aktif Kullanıcı:", user.displayName);

        // Kullanıcıyı Veritabanına Kaydet (İlk kez geliyorsa)
        const userRef = db.collection('users').doc(user.uid);
        try {
            const doc = await userRef.get();
            if (!doc.exists) {
                await userRef.set({
                    name: user.displayName,
                    email: user.email,
                    photo: user.photoURL,
                    role: 'free', // Varsayılan rol
                    joinedAt: new Date()
                });
            }
            // Rolü çek
            if (doc.exists && doc.data().role) {
                currentUserRole = doc.data().role;
            } else {
                currentUserRole = 'free';
            }
        } catch (e) {
            console.error("Kullanıcı verisi alınamadı", e);
        }

        // Arayüzü Güncelle
        updateUIForUser(user, currentUserRole);

        // Kişisel Verileri Yükle
        loadMyRaces();
        loadMyWorkouts(currentUserId);

        // Eğer Admin ise Ekstra Verileri Yükle
        if (currentUserRole === 'admin') {
            loadUsers(); // Öğrenci listesi
            loadAdminDashboard(); // Dashboard verileri
            loadTemplates(); // Şablon kütüphanesi
        }

    } else {
        // --- ÇIKIŞ YAPILDI ---
        currentUserId = null;
        currentUserRole = 'free';
        myRaces = [];
        myWorkouts = [];
        workoutTemplates = [];
        activeStudentId = null;
        updateUIForGuest();
    }

    // Herkesin görebileceği genel veriler
    loadNews();
    loadRaces();
});


// ==========================================
// 3. ADMIN DASHBOARD (AKILLI ÖZET)
// ==========================================

async function loadAdminDashboard() {
    const container = document.getElementById('admin-dashboard-container');
    if (!container) return; // Admin değilse veya sayfa yoksa dur

    container.innerHTML = '<p style="text-align:center;font-size:11px;color:gray;">Takım analizi yapılıyor...</p>';

    // Tarih Hesaplamaları
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toISOString().slice(0, 10);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    let html = `<div class="dashboard-summary-card"><div class="dashboard-header">GÜNLÜK ÖZET</div>`;
    let hasAlerts = false;

    // 1. Tüm öğrencileri çek (Admin olmayanlar)
    const usersSnap = await db.collection('users').where('role', '!=', 'admin').get();

    // 2. Her öğrencinin antrenmanlarını kontrol et (Parallel İşlem)
    const promises = usersSnap.docs.map(async (userDoc) => {
        const userData = userDoc.data();
        const uid = userDoc.id;

        // Bu öğrencinin antrenmanlarını çek
        const wSnap = await db.collection('users').doc(uid).collection('workouts').get();

        let userItems = '';

        wSnap.forEach(wDoc => {
            const w = wDoc.data();

            // A) KIRMIZI ALARM: Dün antrenman vardı ama yapılmadı
            if (w.date === yesterdayStr && !w.isCompleted) {
                userItems += `
                <div class="dashboard-item missed" onclick="openStudentDetail('${uid}', '${w.date}')">
                    <span class="dashboard-icon missed">⚠️</span>
                    <div class="dashboard-text"><strong>${userData.name.split(' ')[0]}</strong> dünkü antrenmanı kaçırdı.</div>
                </div>`;
                hasAlerts = true;
            }

            // B) YEŞİL RAPOR: Bugün veya Dün yapıldı ve raporlandı
            if ((w.date === todayStr || w.date === yesterdayStr) && w.isCompleted) {
                userItems += `
                <div class="dashboard-item review" onclick="openStudentDetail('${uid}', '${w.date}')">
                    <span class="dashboard-icon review">🔔</span>
                    <div class="dashboard-text"><strong>${userData.name.split(' ')[0]}</strong> rapor gönderdi (RPE: ${w.reportRpe || '-'}).</div>
                </div>`;
                hasAlerts = true;
            }

            // C) MAVİ BİLGİ: Bugün antrenmanı var (henüz yapılmadı)
            if (w.date === todayStr && !w.isCompleted) {
                userItems += `
                <div class="dashboard-item today" onclick="openStudentDetail('${uid}', '${w.date}')">
                    <span class="dashboard-icon today">📅</span>
                    <div class="dashboard-text"><strong>${userData.name.split(' ')[0]}</strong> bugün antrenman yapacak.</div>
                </div>`;
                hasAlerts = true;
            }
        });
        return userItems;
    });

    const results = await Promise.all(promises);
    html += results.join('');

    if (!hasAlerts) {
        html += `<p style="font-size:12px; color:gray; text-align:center;">Bugün için kritik bir durum yok. Takım stabil. 👍</p>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}


// ==========================================
// 4. ŞABLON SİSTEMİ
// ==========================================

function loadTemplates() {
    db.collection('templates').orderBy('title', 'asc').onSnapshot(snap => {
        workoutTemplates = [];
        let html = '<option value="">📂 Şablondan Yükle...</option>';

        snap.forEach(doc => {
            const t = doc.data();
            workoutTemplates.push({ id: doc.id, ...t });
            html += `<option value="${doc.id}">${t.title}</option>`;
        });

        const selector = document.getElementById('templateSelector');
        if (selector) selector.innerHTML = html;
    });
}

function loadTemplateToInputs() {
    const selector = document.getElementById('templateSelector');
    const selectedId = selector.value;

    if (!selectedId) return;

    const template = workoutTemplates.find(t => t.id === selectedId);
    if (template) {
        document.getElementById('workoutTitle').value = template.title;
        document.getElementById('workoutDesc').value = template.desc;
    }
}


// ==========================================
// 5. ANTRENMAN YÖNETİMİ (CRUD & RPE)
// ==========================================

// Antrenmanları Veritabanından Yükle
function loadMyWorkouts(userId) {
    db.collection('users').doc(userId).collection('workouts').onSnapshot(snapshot => {
        // Eğer kendi hesabıma bakıyorsam ana değişkeni güncelle
        if (userId === currentUserId) {
            myWorkouts = [];
            snapshot.forEach(doc => {
                const d = doc.data();
                d.id = doc.id;
                myWorkouts.push(d);
            });
            renderCalendar(); // Ana takvimdeki mavi noktalar için
            if (selectedFullDate) showDayDetails(selectedFullDate); // Eğer detay açıksa yenile
            
            // Kendi grafiklerimi güncelle
            renderCharts('myRpeChart', 'myConsistencyChart', myWorkouts);
        }

        // Eğer Admin olarak bir öğrenciye bakıyorsam onun takvimini yenile
        if (activeStudentId === userId) {
            renderStudentCalendar();
            // Admin olarak öğrenciye bakıyorsam grafikler openStudentDetail içinde güncelleniyor
        }

        // Adminsem dashboard'u da tazele (veri değişmiş olabilir)
        if (currentUserRole === 'admin') loadAdminDashboard();
    });
}

// Modal Aç: Yeni Antrenman Ekle
function openWorkoutAssignModal(dateStr) {
    editingWorkoutId = null; // Yeni kayıt modu
    document.getElementById('modalWorkoutDateLabel').innerText = "Tarih: " + dateStr;
    document.getElementById('modalWorkoutDateLabel').dataset.date = dateStr;

    // Formu temizle
    document.getElementById('workoutTitle').value = '';
    document.getElementById('workoutDesc').value = '';
    document.querySelector('#modal-workout-assign h3').innerText = "🏋️ ANTRENMAN YAZ";

    // Şablon checkboxını sıfırla ve göster
    const chk = document.getElementById('saveAsTemplate');
    if (chk) {
        chk.checked = false;
        chk.parentElement.style.display = 'flex';
    }

    // Şablon seçiciyi sıfırla
    if (document.getElementById('templateSelector')) {
        document.getElementById('templateSelector').value = "";
    }

    document.getElementById('modal-workout-assign').style.display = 'flex';
}

// Modal Aç: Var Olanı Düzenle
function editWorkout() {
    if (!activeStudentId || !openWorkoutId) return;

    // Detay ekranındaki verileri al
    const currentTitle = document.getElementById('viewWorkoutTitle').innerText;
    const currentDesc = document.getElementById('viewWorkoutDesc').innerText;
    const currentDate = document.getElementById('viewWorkoutDate').innerText;

    closeWorkoutViewModal(); // Detayı kapat

    // Ekleme penceresini verilerle aç
    document.getElementById('modalWorkoutDateLabel').innerText = "Tarih: " + currentDate;
    document.getElementById('modalWorkoutDateLabel').dataset.date = currentDate;
    document.getElementById('workoutTitle').value = currentTitle;
    document.getElementById('workoutDesc').value = currentDesc;
    document.querySelector('#modal-workout-assign h3').innerText = "✏️ ANTRENMANI DÜZENLE";

    editingWorkoutId = openWorkoutId; // Düzenleme modu

    // Düzenlerken şablon olarak kaydetmeyi gizle
    const chk = document.getElementById('saveAsTemplate');
    if (chk) chk.parentElement.style.display = 'none';

    document.getElementById('modal-workout-assign').style.display = 'flex';
}

function closeWorkoutModal() {
    document.getElementById('modal-workout-assign').style.display = 'none';
    editingWorkoutId = null;
}

// KAYDET (Yeni veya Güncelleme)
function saveWorkout() {
    if (!activeStudentId) return;

    const dateStr = document.getElementById('modalWorkoutDateLabel').dataset.date;
    const title = document.getElementById('workoutTitle').value;
    const desc = document.getElementById('workoutDesc').value;

    // Checkbox elementini güvenli seç
    const chk = document.getElementById('saveAsTemplate');
    const saveAsTemplate = chk ? chk.checked : false;

    if (!title) return alert("Lütfen bir başlık giriniz.");

    const workoutRef = db.collection('users').doc(activeStudentId).collection('workouts');

    if (editingWorkoutId) {
        // GÜNCELLEME
        workoutRef.doc(editingWorkoutId).update({
            title: title,
            desc: desc
        }).then(() => {
            closeWorkoutModal();
        });
    } else {
        // YENİ KAYIT
        workoutRef.add({
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
            // Eğer kutucuk işaretliyse Şablonlara da ekle
            if (saveAsTemplate) {
                db.collection('templates').add({
                    title: title,
                    desc: desc,
                    createdAt: new Date()
                });
            }
            closeWorkoutModal();
            alert("Antrenman Öğrenciye Gönderildi! 📨");
        });
    }
}

// SİLME
function deleteWorkout() {
    if (!activeStudentId || !openWorkoutId) return;

    if (confirm("Bu antrenmanı silmek istediğine emin misin?")) {
        db.collection('users').doc(activeStudentId).collection('workouts').doc(openWorkoutId).delete()
            .then(() => {
                closeWorkoutViewModal();
            });
    }
}

// DETAY GÖRÜNTÜLEME ve RAPORLAMA PENCERESİ
function openWorkoutView(workoutId, title, date, desc, isCompleted, stravaLink, ownerId, rpe, note) {
    openWorkoutId = workoutId;

    const modal = document.getElementById('modal-workout-view');
    modal.style.display = 'flex';

    // Verileri Doldur
    document.getElementById('viewWorkoutTitle').innerText = title;
    document.getElementById('viewWorkoutDate').innerText = date;
    document.getElementById('viewWorkoutDesc').innerText = desc;

    // Admin Aksiyon Butonları (Sadece Admin Görür)
    const adminActions = document.getElementById('admin-workout-actions');
    if (currentUserRole === 'admin') {
        adminActions.style.display = 'flex';
    } else {
        adminActions.style.display = 'none';
    }

    // Duruma Göre İçerik (Yapıldı mı?)
    const displayDiv = document.getElementById('workout-report-display');
    const formDiv = document.getElementById('workout-report-form');
    const btnOpen = document.getElementById('btnOpenReportForm');

    const completed = (isCompleted === true || isCompleted === 'true');

    if (completed) {
        // --- YAPILMIŞ: RAPOR GÖSTER ---
        displayDiv.style.display = 'block';
        formDiv.style.display = 'none';
        btnOpen.style.display = 'none';

        document.getElementById('displayRpe').innerText = (rpe || '-') + "/10";
        document.getElementById('displayNote').innerText = note ? `"${note}"` : "Not yok.";

        if (stravaLink && stravaLink.length > 5) {
            document.getElementById('displayStrava').innerHTML = `<a href="${stravaLink}" target="_blank" style="color:var(--blue); font-size:11px; text-decoration:none;">🔗 Strava'da Aç</a>`;
        } else {
            document.getElementById('displayStrava').innerHTML = "";
        }
    } else {
        // --- YAPILMAMIŞ: TAMAMLA BUTONU ---
        displayDiv.style.display = 'none';
        formDiv.style.display = 'none';
        btnOpen.style.display = 'block';

        // Formu temizle
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

    const boxes = document.querySelectorAll('.rpe-box');
    if (boxes[val - 1]) boxes[val - 1].classList.add('selected');
}

function submitWorkoutReport() {
    if (!openWorkoutId) return;
    if (selectedRpe === 0) return alert("Lütfen zorluk derecesini seçin.");

    const note = document.getElementById('reportNote').value;
    const link = document.getElementById('reportStrava').value;
    const targetId = activeStudentId || currentUserId; // Hangi kullanıcı?

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
    editingWorkoutId = null;
}


// ==========================================
// 6. GRAFİK (CHART) SİSTEMİ
// ==========================================

function renderCharts(canvasRpeId, canvasPieId, workouts) {
    // 1. RPE Trendi (Sadece tamamlanan ve RPE'si olanlar, tarihe göre sıralı)
    const completedWorkouts = workouts
        .filter(w => w.isCompleted && w.reportRpe > 0)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-10); // Son 10 antrenman

    const rpeLabels = completedWorkouts.map(w => w.date.slice(5)); // "10-25"
    const rpeData = completedWorkouts.map(w => w.reportRpe);

    // 2. Sadakat (Tamamlanan vs Kaçırılan)
    const totalAssigned = workouts.length;
    const totalCompleted = workouts.filter(w => w.isCompleted).length;
    const todayStr = new Date().toISOString().slice(0, 10);
    // Kaçırılan: Tarihi geçmiş ama yapılmamış
    const totalMissed = workouts.filter(w => !w.isCompleted && w.date < todayStr).length;
    // Bekleyen: Toplam - (Yapılan)
    const notDone = totalAssigned - totalCompleted;

    // --- RPE CHART ÇİZ ---
    const ctxRpe = document.getElementById(canvasRpeId);
    if (ctxRpe) {
        if (chartInstances[canvasRpeId]) chartInstances[canvasRpeId].destroy(); // Eskiyi sil

        chartInstances[canvasRpeId] = new Chart(ctxRpe, {
            type: 'line',
            data: {
                labels: rpeLabels,
                datasets: [{
                    label: 'Zorluk (1-10)',
                    data: rpeData,
                    borderColor: '#FF6B35',
                    backgroundColor: 'rgba(255, 107, 53, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    pointBackgroundColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, max: 10, grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#888' } },
                    x: { display: false }
                }
            }
        });
    }

    // --- PASTA CHART ÇİZ ---
    const ctxPie = document.getElementById(canvasPieId);
    if (ctxPie) {
        if (chartInstances[canvasPieId]) chartInstances[canvasPieId].destroy();

        chartInstances[canvasPieId] = new Chart(ctxPie, {
            type: 'doughnut',
            data: {
                labels: ['Yapıldı', 'Eksik'],
                datasets: [{
                    data: [totalCompleted, notDone],
                    backgroundColor: ['#4ECDC4', '#333'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                cutout: '70%',
                plugins: { legend: { display: false } }
            }
        });
    }
}


// ==========================================
// 7. TAKVİM VE YARIŞLAR (ANA EKRAN)
// ==========================================

function loadRaces() {
    db.collection('races').orderBy('date', 'asc').onSnapshot(snapshot => {
        allRaces = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            d.id = doc.id;
            allRaces.push(d);
        });
        renderCalendar(); // Takvimi çiz

        if (!selectedFullDate) showUpcomingRaces();
        else showDayDetails(selectedFullDate);
    });
}

function renderCalendar() {
    const calendarEl = document.getElementById('calendar-days');
    if (!calendarEl) return;

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
        if (workout) {
            workoutClass = workout.isCompleted ? 'has-workout completed' : 'has-workout';
        }

        let classes = workoutClass;
        if (hasMyRace) classes += ' has-my-race';
        else if (hasRace) classes += ' has-race';

        const todayClass = (new Date().toISOString().slice(0, 10) === fullDate) ? 'today' : '';
        const selectedClass = (selectedFullDate === fullDate) ? 'selected' : '';

        html += `<div class="day-cell ${classes} ${todayClass} ${selectedClass}" onclick="selectDate('${fullDate}', this)">${day}</div>`;
    }

    calendarEl.innerHTML = html;
}

function changeMonth(direction) {
    currentMonth += direction;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    } else if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar();
}

function selectDate(fullDate, element) {
    if (selectedFullDate === fullDate) {
        // Seçimi kaldır
        element.classList.remove('selected');
        selectedFullDate = null;
        showUpcomingRaces();
    } else {
        // Seç
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

    setTimeout(() => {
        selectedFullDate = dateStr;
        showDayDetails(dateStr);
        // Görsel seçim
        document.querySelectorAll('.day-cell').forEach(cell => {
            if (parseInt(cell.innerText) == parseInt(d) && !cell.classList.contains('empty')) {
                cell.classList.add('selected');
            }
        });
    }, 100);
}

// GÜN DETAYI
function showDayDetails(dateStr) {
    const pnl = document.getElementById('day-details-panel');
    pnl.style.display = 'block';

    const [y, m, d] = dateStr.split('-');
    document.querySelector('#day-details-panel .details-header h3').innerText = `${d}.${m}.${y}`;
    document.querySelector('#day-details-panel .day-badge').innerText = "SEÇİLDİ";
    document.querySelector('#day-details-panel .day-badge').style.background = "var(--orange)";

    let html = '';

    // 1. Antrenman Varsa Göster
    const workout = myWorkouts.find(w => w.date === dateStr);
    if (workout) {
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

    // 2. Yarışlar Varsa Göster
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

    if (html === '') html = '<p style="color:gray; font-size:12px; margin-top:10px;">Etkinlik yok.</p>';
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

    const today = new Date().toISOString().slice(0, 10);
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


// ==========================================
// 8. ÖĞRENCİ DETAYI ve TAKVİMİ
// ==========================================

async function openStudentDetail(targetUserId, dateToFocus) {
    activeStudentId = targetUserId;
    const userDoc = await db.collection('users').doc(targetUserId).get();
    const userData = userDoc.data();

    document.getElementById('student-name').innerText = userData.name;
    document.getElementById('student-avatar').style.backgroundImage = `url('${userData.photo}')`;

    // Hedef Yarışları Çek
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

    // Eğer dashboarddan geldiyse (dateToFocus), o ayı aç
    if (dateToFocus) {
        const [y, m, d] = dateToFocus.split('-');
        studentYear = parseInt(y);
        studentMonth = parseInt(m) - 1;
        // Takvim yüklendikten sonra o günü açması için
        setTimeout(() => clickStudentDate(dateToFocus), 600);
    }

    // Antrenmanları yükle ve grafikleri çiz
    db.collection('users').doc(targetUserId).collection('workouts').get().then(snap => {
        const studentWorkouts = []; 
        snap.forEach(d => {
            const dd = d.data(); 
            dd.id = d.id; 
            studentWorkouts.push(dd);
        });
        
        // Takvimi çiz
        renderStudentCalendarWithData(studentWorkouts);
        
        // Grafikleri çiz
        renderCharts('studentRpeChart', 'studentConsistencyChart', studentWorkouts);
    });

    switchView('student-detail');
}

function renderStudentCalendarWithData(workouts) {
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    document.getElementById('studentMonthLabel').innerText = `${monthNames[studentMonth]} ${studentYear}`;

    const firstDay = new Date(studentYear, studentMonth, 1).getDay();
    const startDay = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(studentYear, studentMonth + 1, 0).getDate();

    let html = '';
    for (let i = 0; i < startDay; i++) html += `<div class="day-cell empty"></div>`;

    for (let day = 1; day <= daysInMonth; day++) {
        const monthStr = (studentMonth + 1).toString().padStart(2, '0');
        const dayStr = day.toString().padStart(2, '0');
        const fullDate = `${studentYear}-${monthStr}-${dayStr}`;

        const workout = workouts.find(x => x.date === fullDate);
        let dotClass = '';
        if (workout) dotClass = workout.isCompleted ? 'has-workout completed' : 'has-workout';

        html += `<div class="day-cell ${dotClass}" onclick="clickStudentDate('${fullDate}')">${day}</div>`;
    }
    document.getElementById('student-calendar-days').innerHTML = html;
}

function renderStudentCalendar() {
    // Veritabanından taze çekerek çiz (Ay değişince)
    db.collection('users').doc(activeStudentId).collection('workouts').get().then(snap => {
        const workouts = [];
        snap.forEach(d => {
            const dd = d.data();
            dd.id = d.id;
            workouts.push(dd);
        });
        renderStudentCalendarWithData(workouts);
    });
}

function changeStudentMonth(direction) {
    studentMonth += direction;
    if (studentMonth < 0) {
        studentMonth = 11;
        studentYear--;
    } else if (studentMonth > 11) {
        studentMonth = 0;
        studentYear++;
    }
    renderStudentCalendar();
}

function clickStudentDate(dateStr) {
    // Admin öğrenci takvimine tıklayınca
    db.collection('users').doc(activeStudentId).collection('workouts').where('date', '==', dateStr).get().then(snap => {
        if (!snap.empty) {
            // Varsa detayı aç
            const d = snap.docs[0];
            const w = d.data();
            openWorkoutView(d.id, w.title, w.date, w.desc, w.isCompleted, w.stravaLink, activeStudentId, w.reportRpe, w.reportNote);
        } else {
            // Yoksa ekle
            openWorkoutAssignModal(dateStr);
        }
    });
}


// ==========================================
// 9. GENEL YARDIMCI FONKSİYONLAR
// ==========================================

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
    if (!currentUserId) return;
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
        if (lc) lc.innerHTML = h || '<p style="color:gray; font-size:12px;">Henüz hedef yok.</p>';
        renderCalendar();
    });
}

function toggleMyRace(raceId, raceName, raceDate, raceCat, btnElement) {
    if (!currentUserId) return alert("Giriş yapmalısın.");
    const existing = myRaces.find(r => r.raceId === raceId);
    if (existing) {
        if (confirm("Çıkarmak istiyor musun?")) db.collection('users').doc(currentUserId).collection('my_races').doc(existing.id).delete();
        return;
    }
    const conflict = myRaces.find(r => r.date === raceDate);
    if (conflict) return alert("⚠️ Çakışma var!");
    db.collection('users').doc(currentUserId).collection('my_races').add({ raceId: raceId, name: raceName, date: raceDate, category: raceCat, addedAt: new Date() }).then(() => alert("Eklendi! 🎯"));
}

function removeFromMyRaces(docId) { if (confirm("Silmek istiyor musun?")) db.collection('users').doc(currentUserId).collection('my_races').doc(docId).delete(); }
function deleteRace(raceId) { if (confirm("Silmek istiyor musun?")) db.collection('races').doc(raceId).delete(); }
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

// UI GÜNCELLEMELERİ
function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('view-' + viewName).classList.add('active');

    if (viewName === 'admin') { activeStudentId = null; }
    if (viewName === 'discover') {
        selectedFullDate = null;
        document.querySelectorAll('.day-cell').forEach(el => el.classList.remove('selected'));
        renderCalendar();
        showUpcomingRaces();
    }

    const map = { 'feed': 0, 'discover': 1, 'locker': 2 };
    if (map[viewName] !== undefined) document.querySelectorAll('.nav-item')[map[viewName]].classList.add('active');
}

function updateUIForUser(user, role) {
    const profileTrigger = document.getElementById('profile-trigger');
    if (profileTrigger) {
        profileTrigger.classList.add('active');
        profileTrigger.innerHTML = `<div class="user-avatar-small" style="background-image:url('${user.photoURL}')"></div>`;
    }
    document.querySelector('#view-locker .profile-header h3').innerText = user.displayName;
    document.querySelector('#view-locker .profile-header .avatar').style.backgroundImage = `url('${user.photoURL}')`;
    document.querySelector('.login-prompt').style.display = 'none';
    document.getElementById('my-races-section').style.display = 'block';
    
    // Grafik bölümünü göster
    const statsSection = document.getElementById('my-stats-section');
    if(statsSection) statsSection.style.display = 'block';

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

    if (!document.getElementById('btnLogout')) {
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
    if (profileTrigger) {
        profileTrigger.classList.remove('active');
        profileTrigger.innerHTML = `<span class="material-icons-round guest-icon">person_outline</span>`;
    }
    document.querySelector('#view-locker .profile-header h3').innerText = "Misafir Kullanıcı";
    document.querySelector('.login-prompt').style.display = 'block';
    document.getElementById('my-races-section').style.display = 'none';
    
    const statsSection = document.getElementById('my-stats-section');
    if(statsSection) statsSection.style.display = 'none';

    if (document.getElementById('btnAdmin')) document.getElementById('btnAdmin').remove();
    if (document.getElementById('btnLogout')) document.getElementById('btnLogout').remove();
}

document.addEventListener('click', (e) => { if (e.target && e.target.id == 'btnLogin') loginWithGoogle(); });