console.log("Checkpoint Collective - Hedef Sistemi 🎯");

// --- SPLASH ---
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
let allRaces = [];      // Sistemdeki tüm yarışlar
let myRaces = [];       // Sadece benim eklediklerim (ID listesi ve tarihleri)
let currentUserRole = 'free';
let currentUserId = null;

// --- GİRİŞ ---
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(e => alert(e.message));
}

// --- ANA DÖNGÜ ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUserId = user.uid;
        const userRef = db.collection('users').doc(user.uid);
        const doc = await userRef.get();
        if (!doc.exists) {
            await userRef.set({
                name: user.displayName, email: user.email, photo: user.photoURL, role: 'free', joinedAt: new Date()
            });
        }
        currentUserRole = doc.data().role || 'free';
        updateUIForUser(user, currentUserRole);
        
        loadMyRaces(); // Kullanıcının hedeflerini çek
        if(currentUserRole === 'admin') loadUsers();
    } else {
        currentUserId = null;
        currentUserRole = 'free';
        myRaces = [];
        updateUIForGuest();
    }
    loadNews();
    loadRaces();
});

// --- YENİ: HEDEFLERİM (MY RACES) ---
function loadMyRaces() {
    if(!currentUserId) return;
    
    // Kullanıcının "my_races" alt koleksiyonunu dinle
    db.collection('users').doc(currentUserId).collection('my_races')
      .orderBy('date', 'asc')
      .onSnapshot(snapshot => {
          myRaces = [];
          let lockerHtml = '';
          
          snapshot.forEach(doc => {
              const data = doc.data();
              // Hafızaya al (Takvimde işaretlemek ve çakışma kontrolü için)
              myRaces.push({ id: doc.id, date: data.date, raceId: data.raceId });

              // Locker Listesini Oluştur
              const [y, m, d] = data.date.split('-');
              lockerHtml += `
              <div class="my-race-item">
                  <div class="my-race-date">
                      <div class="my-race-day">${d}</div>
                      <div class="my-race-month">${m}</div>
                  </div>
                  <div style="flex:1">
                      <div style="font-weight:bold; font-size:14px;">${data.name}</div>
                      <div style="font-size:11px; color:#888;">${data.category}</div>
                  </div>
                  <button class="btn-delete" onclick="removeFromMyRaces('${doc.id}')" title="Listeden Çıkar">×</button>
              </div>`;
          });

          // Locker'daki alanı güncelle
          const listContainer = document.getElementById('my-races-list');
          if(listContainer) {
              listContainer.innerHTML = lockerHtml || '<p style="color:gray; font-size:12px;">Henüz bir hedef yarış eklemedin.</p>';
          }

          // Takvimi yeniden çiz (Yıldızlar güncellensin)
          renderCalendar();
      });
}

// Hedefe Ekle / Çıkar
function toggleMyRace(raceId, raceName, raceDate, raceCat, btnElement) {
    if(!currentUserId) return alert("Lütfen önce giriş yapın.");

    // Kontrol 1: Bu yarış zaten ekli mi?
    const existing = myRaces.find(r => r.raceId === raceId);
    if (existing) {
        // Zaten ekli, çıkaralım mı?
        if(confirm("Bu yarışı hedeflerinden çıkarmak istiyor musun?")) {
            db.collection('users').doc(currentUserId).collection('my_races').doc(existing.id).delete();
        }
        return;
    }

    // Kontrol 2: AYNI TARİHTE başka yarış var mı? (ÇAKIŞMA KONTROLÜ)
    const conflict = myRaces.find(r => r.date === raceDate);
    if (conflict) {
        alert("⚠️ DİKKAT: Bu tarihte zaten başka bir hedefin var! Aynı güne iki yarış ekleyemezsin.");
        return;
    }

    // Sorun yok, ekle
    db.collection('users').doc(currentUserId).collection('my_races').add({
        raceId: raceId,
        name: raceName,
        date: raceDate,
        category: raceCat,
        addedAt: new Date()
    }).then(() => {
        alert("Hedeflerine eklendi! 🎯 Locker'da görebilirsin.");
    });
}

function removeFromMyRaces(docId) {
    if(confirm("Silmek istediğine emin misin?")) {
        db.collection('users').doc(currentUserId).collection('my_races').doc(docId).delete();
    }
}


// --- VERİ YÜKLEME ---
function loadRaces() {
    db.collection('races').orderBy('date', 'asc').onSnapshot(snapshot => {
        allRaces = [];
        snapshot.forEach(doc => { const d = doc.data(); d.id = doc.id; allRaces.push(d); });
        renderCalendar();
        if(!selectedFullDate) showUpcomingRaces();
        else showDayDetails(selectedFullDate);
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
        
        // Benim yarışım var mı?
        const hasMyRace = myRaces.some(r => r.date === fullDate);
        
        let classes = '';
        if (hasMyRace) classes += ' has-my-race'; // Altın Yıldız
        else if (hasRace) classes += ' has-race'; // Standart Yeşil
        
        const todayClass = (new Date().toISOString().slice(0,10) === fullDate) ? 'today' : '';
        const selectedClass = (selectedFullDate === fullDate) ? 'selected' : '';
        
        html += `<div class="day-cell ${classes} ${todayClass} ${selectedClass}" onclick="selectDate('${fullDate}', this)">${day}</div>`;
    }
    document.getElementById('calendar-days').innerHTML = html;
}

// --- GÜN DETAYI (GÜNCELLENDİ) ---
function showDayDetails(dateStr) {
    const pnl = document.getElementById('day-details-panel');
    pnl.style.display = 'block';
    
    const [y, m, d] = dateStr.split('-');
    document.querySelector('#day-details-panel .details-header h3').innerText = `${d}.${m}.${y}`;
    document.querySelector('#day-details-panel .day-badge').innerText = "SEÇİLDİ";
    document.querySelector('#day-details-panel .day-badge').style.background = "var(--orange)";

    const racesThatDay = allRaces.filter(r => r.date === dateStr);
    let html = '';
    
    if (racesThatDay.length > 0) {
        racesThatDay.forEach(race => {
            // Silme butonu (Admin)
            let deleteBtn = '';
            if (currentUserRole === 'admin') deleteBtn = `<button class="btn-delete" onclick="deleteRace('${race.id}')">🗑️</button>`;
            
            // Hedefe Ekle Butonu (Herkes)
            // Bu yarış listede var mı?
            const isAdded = myRaces.some(r => r.raceId === race.id);
            const btnText = isAdded ? "✓ EKLENDİ" : "＋ HEDEFLE";
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
    } else { html = '<p style="color:gray; font-size:12px; margin-top:10px;">Etkinlik yok.</p>'; }
    
    document.getElementById('selected-day-races').innerHTML = html;
    
    if (currentUserRole === 'admin') document.getElementById('btnAddRaceToDay').style.display = 'block';
    else document.getElementById('btnAddRaceToDay').style.display = 'none';
}

// --- DİĞERLERİ AYNI ---
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
            html += `<div class="race-mini-card" onclick="goToDate('${race.date}')" style="cursor:pointer;"><div style="margin-right:15px; text-align:center; min-width:35px;"><div style="font-weight:bold; color:white;">${d}</div><div style="font-size:10px; color:gray;">${m}</div></div><div style="flex:1;"><div style="font-weight:bold;">${race.name}</div><div style="font-size:11px; color:gray;">${race.category}</div></div><div style="font-size:14px; opacity:0.5;">❯</div></div>`;
        });
    } else { html = '<p style="color:gray; font-size:12px; margin-top:10px;">Yakında yarış görünmüyor.</p>'; }
    document.getElementById('selected-day-races').innerHTML = html;
    document.getElementById('btnAddRaceToDay').style.display = 'none';
}
function goToDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    currentYear = parseInt(y); currentMonth = parseInt(m) - 1; 
    renderCalendar();
    setTimeout(() => {
        selectedFullDate = dateStr; showDayDetails(dateStr);
        document.querySelectorAll('.day-cell').forEach(cell => {
             if(parseInt(cell.innerText) == parseInt(d) && !cell.classList.contains('empty')) cell.classList.add('selected');
        });
    }, 100);
}
function changeMonth(direction) { currentMonth += direction; if(currentMonth < 0) { currentMonth = 11; currentYear--; } else if (currentMonth > 11) { currentMonth = 0; currentYear++; } renderCalendar(); }
function selectDate(fullDate, element) { if (selectedFullDate === fullDate) { element.classList.remove('selected'); selectedFullDate = null; showUpcomingRaces(); } else { document.querySelectorAll('.day-cell').forEach(el => el.classList.remove('selected')); element.classList.add('selected'); selectedFullDate = fullDate; showDayDetails(fullDate); } }
function loadUsers() { db.collection('users').orderBy('joinedAt', 'desc').onSnapshot(snapshot => { let html = ''; snapshot.forEach(doc => { const u = doc.data(); const roleClass = u.role === 'admin' ? 'admin' : ''; const roleText = u.role === 'admin' ? 'YÖNETİCİ' : 'ÖĞRENCİ'; html += `<div class="user-row"><div class="user-info"><div class="user-mini-avatar" style="background-image:url('${u.photo || ''}')"></div><div><div class="user-name">${u.name}</div><div class="user-email">${u.email}</div></div></div><div class="user-role-tag ${roleClass}">${roleText}</div></div>`; }); document.getElementById('user-list-container').innerHTML = html || '<p>Kullanıcı yok.</p>'; }); }
function loadNews() { db.collection('news').orderBy('date', 'desc').onSnapshot(snapshot => { let html = ''; snapshot.forEach(doc => { const data = doc.data(); html += `<div class="news-card"><div class="news-img" style="background:${data.color || '#333'}"></div><div class="news-content"><div style="font-size:9px; color:var(--orange); font-weight:bold;">${data.tag}</div><h4>${data.title}</h4></div></div>`; }); document.getElementById('news-container').innerHTML = html || '<p style="text-align:center; color:gray">Haber yok.</p>'; }); }
function updateUIForUser(user, role) { const profileTrigger = document.getElementById('profile-trigger'); if(profileTrigger) { profileTrigger.classList.add('active'); profileTrigger.innerHTML = `<div class="user-avatar-small" style="background-image:url('${user.photoURL}')"></div>`; } document.querySelector('.profile-header h3').innerText = user.displayName; document.querySelector('.profile-header .avatar').style.backgroundImage = `url('${user.photoURL}')`; document.querySelector('.login-prompt').style.display = 'none'; document.getElementById('my-races-section').style.display = 'block'; /* YENİ: Locker'da listeyi göster */ if (role === 'admin') { document.querySelector('.role-badge').innerText = "YÖNETİCİ"; document.querySelector('.role-badge').style.background = "#D32F2F"; if (!document.getElementById('btnAdmin')) { const btn = document.createElement('button'); btn.id = 'btnAdmin'; btn.innerHTML = "⚡ YÖNETİCİ PANELİ"; btn.className = "btn-primary"; btn.style.marginTop = "15px"; btn.style.background = "#D32F2F"; btn.onclick = () => switchView('admin'); document.querySelector('.profile-header').appendChild(btn); } } else { document.querySelector('.role-badge').innerText = "MEMBER"; } if(!document.getElementById('btnLogout')) { const btn = document.createElement('button'); btn.id = 'btnLogout'; btn.innerText = "ÇIKIŞ YAP"; btn.className = "btn-primary"; btn.style.marginTop = "10px"; btn.style.background = "#333"; btn.onclick = () => auth.signOut(); document.getElementById('view-locker').appendChild(btn); } }
function updateUIForGuest() { const profileTrigger = document.getElementById('profile-trigger'); if(profileTrigger) { profileTrigger.classList.remove('active'); profileTrigger.innerHTML = `<span class="material-icons-round guest-icon">person_outline</span>`; } document.querySelector('.profile-header h3').innerText = "Misafir Kullanıcı"; document.querySelector('.login-prompt').style.display = 'block'; document.getElementById('my-races-section').style.display = 'none'; /* YENİ: Listeyi gizle */ if(document.getElementById('btnAdmin')) document.getElementById('btnAdmin').remove(); if(document.getElementById('btnLogout')) document.getElementById('btnLogout').remove(); }
function deleteRace(raceId) { if(confirm("Silmek istiyor musun?")) db.collection('races').doc(raceId).delete(); }
function openAddModal() { if (!selectedFullDate) return; document.getElementById('modalDateLabel').innerText = selectedFullDate; document.getElementById('modal-overlay').style.display = 'flex'; }
function closeAddModal() { document.getElementById('modal-overlay').style.display = 'none'; document.getElementById('modalRaceName').value = ''; document.getElementById('modalRaceCat').value = ''; }
function saveRaceFromModal() { const name = document.getElementById('modalRaceName').value; const cat = document.getElementById('modalRaceCat').value; if (!name) return alert("İsim giriniz"); db.collection('races').add({ name: name, category: cat, date: selectedFullDate, createdAt: new Date() }).then(closeAddModal); }
function saveNews() { const title = document.getElementById('newsTitle').value; const tag = document.getElementById('newsTag').value; const content = document.getElementById('newsContent').value; if (!title) return alert("Başlık giriniz"); db.collection('news').add({ title: title, tag: tag || 'GENEL', content: content, date: new Date(), color: '#FF6B35' }).then(() => { alert("Haber Yayınlandı!"); switchView('feed'); }); }
function switchView(viewName) { document.querySelectorAll('.view').forEach(v => v.classList.remove('active')); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); document.getElementById('view-' + viewName).classList.add('active'); if(viewName === 'discover') { selectedFullDate = null; document.querySelectorAll('.day-cell').forEach(el => el.classList.remove('selected')); showUpcomingRaces(); } const map = {'feed':0, 'discover':1, 'locker':2}; if(map[viewName]!==undefined) document.querySelectorAll('.nav-item')[map[viewName]].classList.add('active'); }
document.addEventListener('click', (e) => { if(e.target && e.target.id == 'btnLogin') loginWithGoogle(); });