console.log("Checkpoint Collective - Başlatılıyor... 🚀");

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

// --- DEĞİŞKENLER ---
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); 
let selectedFullDate = null; 
let allRaces = []; 
let currentUserRole = 'free';

// --- GİRİŞ ---
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(e => alert(e.message));
}

// --- ANA DÖNGÜ ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const userRef = db.collection('users').doc(user.uid);
        const doc = await userRef.get();
        if (!doc.exists) {
            await userRef.set({
                name: user.displayName, email: user.email, photo: user.photoURL, role: 'free', joinedAt: new Date()
            });
        }
        currentUserRole = doc.data().role || 'free';
        updateUIForUser(user, currentUserRole);
        if(currentUserRole === 'admin') loadUsers();
    } else {
        currentUserRole = 'free';
        updateUIForGuest();
    }
    loadNews();
    loadRaces();
});

// --- UI GÜNCELLEME ---
function updateUIForUser(user, role) {
    const profileTrigger = document.getElementById('profile-trigger');
    if(profileTrigger) {
        profileTrigger.classList.add('active');
        profileTrigger.innerHTML = `<div class="user-avatar-small" style="background-image:url('${user.photoURL}')"></div>`;
    }
    document.querySelector('.profile-header h3').innerText = user.displayName;
    document.querySelector('.profile-header .avatar').style.backgroundImage = `url('${user.photoURL}')`;
    document.querySelector('.login-prompt').style.display = 'none';

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
            document.querySelector('.profile-header').appendChild(btn);
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
    document.querySelector('.profile-header h3').innerText = "Misafir Kullanıcı";
    document.querySelector('.login-prompt').style.display = 'block';
    if(document.getElementById('btnAdmin')) document.getElementById('btnAdmin').remove();
    if(document.getElementById('btnLogout')) document.getElementById('btnLogout').remove();
}

// --- DİĞERLERİ ---
function loadUsers() {
    db.collection('users').orderBy('joinedAt', 'desc').onSnapshot(snapshot => {
        let html = '';
        snapshot.forEach(doc => {
            const u = doc.data();
            const roleClass = u.role === 'admin' ? 'admin' : '';
            const roleText = u.role === 'admin' ? 'YÖNETİCİ' : 'ÖĞRENCİ';
            html += `<div class="user-row"><div class="user-info"><div class="user-mini-avatar" style="background-image:url('${u.photo || ''}')"></div><div><div class="user-name">${u.name}</div><div class="user-email">${u.email}</div></div></div><div class="user-role-tag ${roleClass}">${roleText}</div></div>`;
        });
        document.getElementById('user-list-container').innerHTML = html || '<p>Kullanıcı yok.</p>';
    });
}
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
function loadRaces() {
    // Yarışları tarihe göre sıralı çekelim ki "Yaklaşanları" bulabilelim
    db.collection('races').orderBy('date', 'asc').onSnapshot(snapshot => {
        allRaces = [];
        snapshot.forEach(doc => { const d = doc.data(); d.id = doc.id; allRaces.push(d); });
        renderCalendar();
        
        // Eğer bir gün seçili DEĞİLSE, yaklaşan yarışları göster
        if(!selectedFullDate) {
            showUpcomingRaces();
        } else {
            // Seçiliyse o günün detayını güncelle (silme/ekleme anında)
            showDayDetails(selectedFullDate);
        }
    });
}
function renderCalendar() {
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    document.getElementById('currentMonthLabel').innerText = `${monthNames[currentMonth]} ${currentYear}`;
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const startDay = firstDay === 0 ? 6 : firstDay - 1; 
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    let html = '';
    for (let i = 0; i < startDay; i++) html += `<div class="day-cell empty"></div>`;
    for (let day = 1; day <= daysInMonth; day++) {
        const monthStr = (currentMonth + 1).toString().padStart(2, '0');
        const dayStr = day.toString().padStart(2, '0');
        const fullDate = `${currentYear}-${monthStr}-${dayStr}`;
        const hasRace = allRaces.some(r => r.date === fullDate);
        const raceClass = hasRace ? 'has-race' : '';
        const todayClass = (new Date().toISOString().slice(0,10) === fullDate) ? 'today' : '';
        const selectedClass = (selectedFullDate === fullDate) ? 'selected' : '';
        html += `<div class="day-cell ${raceClass} ${todayClass} ${selectedClass}" onclick="selectDate('${fullDate}', this)">${day}</div>`;
    }
    document.getElementById('calendar-days').innerHTML = html;
}
function changeMonth(direction) {
    currentMonth += direction;
    if(currentMonth < 0) { currentMonth = 11; currentYear--; } else if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
}
function selectDate(fullDate, element) {
    // Eğer zaten seçili olan güne tekrar tıklanırsa seçimi kaldır
    if (selectedFullDate === fullDate) {
        element.classList.remove('selected');
        selectedFullDate = null;
        showUpcomingRaces(); // Seçim kalkınca listeye dön
    } else {
        document.querySelectorAll('.day-cell').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        selectedFullDate = fullDate;
        showDayDetails(fullDate);
    }
}

// --- GÜN DETAYI GÖSTER ---
function showDayDetails(dateStr) {
    const pnl = document.getElementById('day-details-panel');
    pnl.style.display = 'block';
    
    // Header kısmını "SEÇİLEN GÜN" formatına getir
    const [y, m, d] = dateStr.split('-');
    document.querySelector('#day-details-panel .details-header h3').innerText = `${d}.${m}.${y}`;
    document.querySelector('#day-details-panel .day-badge').innerText = "SEÇİLDİ";
    document.querySelector('#day-details-panel .day-badge').style.background = "var(--orange)";

    const racesThatDay = allRaces.filter(r => r.date === dateStr);
    let html = '';
    if (racesThatDay.length > 0) {
        racesThatDay.forEach(race => {
            let deleteBtn = '';
            if (currentUserRole === 'admin') deleteBtn = `<button class="btn-delete" onclick="deleteRace('${race.id}')">🗑️</button>`;
            html += `<div class="race-mini-card"><div style="flex:1;"><div style="font-weight:bold;">${race.name}</div><div style="font-size:11px; color:gray;">${race.category}</div></div><div style="display:flex; align-items:center;"><span style="font-size:16px;">🏁</span>${deleteBtn}</div></div>`;
        });
    } else { html = '<p style="color:gray; font-size:12px; margin-top:10px;">Etkinlik yok.</p>'; }
    
    document.getElementById('selected-day-races').innerHTML = html;
    
    if (currentUserRole === 'admin') document.getElementById('btnAddRaceToDay').style.display = 'block';
    else document.getElementById('btnAddRaceToDay').style.display = 'none';
}

// --- YENİ: YAKLAŞAN YARIŞLARI GÖSTER (Varsayılan) ---
function showUpcomingRaces() {
    const pnl = document.getElementById('day-details-panel');
    pnl.style.display = 'block';

    // Header kısmını "YAKLAŞAN YARIŞLAR" formatına getir
    document.querySelector('#day-details-panel .details-header h3').innerText = "YAKLAŞAN YARIŞLAR";
    document.querySelector('#day-details-panel .day-badge').innerText = "LİSTE";
    document.querySelector('#day-details-panel .day-badge').style.background = "#4a90e2"; // Mavi renk

    // Bugünden sonraki yarışları bul
    const today = new Date().toISOString().slice(0,10);
    const upcoming = allRaces.filter(r => r.date >= today).slice(0, 3); // İlk 3 tanesi

    let html = '';
    if (upcoming.length > 0) {
        upcoming.forEach(race => {
            // Tarihi güzelleştir (2025-10-15 -> 15.10)
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
        html = '<p style="color:gray; font-size:12px; margin-top:10px;">Yakında yarış görünmüyor.</p>';
    }

    document.getElementById('selected-day-races').innerHTML = html;
    
    // Ekleme butonunu gizle (Sadece tarih seçiliyken çıksın)
    document.getElementById('btnAddRaceToDay').style.display = 'none';
}

// Listeden yarışa tıklayınca takvimde o güne git
function goToDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    // Yıl ve Ay farklıysa önce takvimi oraya çevir
    currentYear = parseInt(y);
    currentMonth = parseInt(m) - 1; // JS'de aylar 0-11
    renderCalendar();
    
    // Sonra o günü seçili yap
    // (renderCalendar çalıştığı için DOM elemanları yenilendi, tekrar bulmamız lazım)
    setTimeout(() => {
        const cells = document.querySelectorAll('.day-cell');
        // Döngüyle o günü bul (Basit bir eşleştirme)
        // Not: Bu kısım %100 her zaman çalışmayabilir (farklı ay görünümündeyse), ama renderCalendar yukarıda ayı değiştirdiği için çalışmalı.
        // Daha kesin çözüm için 'data-date' attribute kullanmak gerekir ama şimdilik ID'siz gidiyoruz.
        
        // Basitçe günü seçili hale getiriyoruz:
        selectedFullDate = dateStr;
        showDayDetails(dateStr);
        
        // Görsel olarak kutuyu da işaretle
        // (Takvim yeniden çizildiği için metin içeriğinden günü buluyoruz)
        cells.forEach(cell => {
             // Hücrenin içindeki sayı == gün (başındaki 0'ı atarak kıyasla)
             if(parseInt(cell.innerText) == parseInt(d) && !cell.classList.contains('empty')) {
                 cell.classList.add('selected');
             }
        });
        
    }, 100);
}

function deleteRace(raceId) { if(confirm("Silmek istiyor musun?")) db.collection('races').doc(raceId).delete(); }
function openAddModal() { if (!selectedFullDate) return; document.getElementById('modalDateLabel').innerText = selectedFullDate; document.getElementById('modal-overlay').style.display = 'flex'; }
function closeAddModal() { document.getElementById('modal-overlay').style.display = 'none'; document.getElementById('modalRaceName').value = ''; document.getElementById('modalRaceCat').value = ''; }
function saveRaceFromModal() { const name = document.getElementById('modalRaceName').value; const cat = document.getElementById('modalRaceCat').value; if (!name) return alert("İsim giriniz"); db.collection('races').add({ name: name, category: cat, date: selectedFullDate, createdAt: new Date() }).then(closeAddModal); }
function saveNews() { const title = document.getElementById('newsTitle').value; const tag = document.getElementById('newsTag').value; const content = document.getElementById('newsContent').value; if (!title) return alert("Başlık giriniz"); db.collection('news').add({ title: title, tag: tag || 'GENEL', content: content, date: new Date(), color: '#FF6B35' }).then(() => { alert("Haber Yayınlandı!"); switchView('feed'); }); }
function switchView(viewName) { 
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active')); 
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); 
    document.getElementById('view-' + viewName).classList.add('active'); 
    
    // Takvime her girişte seçimi sıfırla ve listeyi göster
    if(viewName === 'discover') {
        selectedFullDate = null;
        document.querySelectorAll('.day-cell').forEach(el => el.classList.remove('selected'));
        showUpcomingRaces();
    }

    const map = {'feed':0, 'discover':1, 'locker':2}; 
    if(map[viewName]!==undefined) document.querySelectorAll('.nav-item')[map[viewName]].classList.add('active'); 
}
document.addEventListener('click', (e) => { if(e.target && e.target.id == 'btnLogin') loginWithGoogle(); });