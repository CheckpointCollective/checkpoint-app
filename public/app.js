console.log("Checkpoint 360 - Koçluk Sistemi Başlıyor 👥");

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
        
        // Eğer Adminsen, kullanıcıları da yükle
        if(currentUserRole === 'admin') {
            loadUsers();
        }
    } else {
        currentUserRole = 'free';
        updateUIForGuest();
    }
    
    loadNews();
    loadRaces();
});

// --- YENİ: KULLANICILARI LİSTELE ---
function loadUsers() {
    db.collection('users').orderBy('joinedAt', 'desc').onSnapshot(snapshot => {
        let html = '';
        snapshot.forEach(doc => {
            const u = doc.data();
            // Rol etiketi rengi
            const roleClass = u.role === 'admin' ? 'admin' : '';
            const roleText = u.role === 'admin' ? 'YÖNETİCİ' : 'ÖĞRENCİ';

            html += `
            <div class="user-row">
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
        
        const container = document.getElementById('user-list-container');
        if(container) container.innerHTML = html || '<p>Kullanıcı yok.</p>';
    });
}

// --- VERİ ÇEKME (HABER & YARIŞ) ---
function loadNews() {
    db.collection('news').orderBy('date', 'desc').onSnapshot(snapshot => {
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `
            <div class="news-card">
                <div class="news-img" style="background:${data.color || '#333'}"></div>
                <div class="news-content">
                    <div style="font-size:9px; color:var(--orange); font-weight:bold;">${data.tag}</div>
                    <h4>${data.title}</h4>
                </div>
            </div>`;
        });
        document.getElementById('news-container').innerHTML = html || '<p style="text-align:center; color:gray">Haber yok.</p>';
    });
}

function loadRaces() {
    db.collection('races').onSnapshot(snapshot => {
        allRaces = [];
        snapshot.forEach(doc => {
            const raceData = doc.data();
            raceData.id = doc.id; 
            allRaces.push(raceData); 
        });
        renderCalendar();
        if(selectedFullDate) showDayDetails(selectedFullDate);
    });
}

// --- TAKVİM FONKSİYONLARI ---
function renderCalendar() {
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const lbl = document.getElementById('currentMonthLabel');
    if(lbl) lbl.innerText = `${monthNames[currentMonth]} ${currentYear}`;
    
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
    const calDays = document.getElementById('calendar-days');
    if(calDays) calDays.innerHTML = html;
}

function changeMonth(direction) {
    currentMonth += direction;
    if(currentMonth < 0) { currentMonth = 11; currentYear--; } 
    else if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
}

function selectDate(fullDate, element) {
    document.querySelectorAll('.day-cell').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    selectedFullDate = fullDate;
    showDayDetails(fullDate);
}

function showDayDetails(dateStr) {
    const pnl = document.getElementById('day-details-panel');
    if(pnl) pnl.style.display = 'block';
    
    const [y, m, d] = dateStr.split('-');
    document.getElementById('selectedDateLabel').innerText = `${d}.${m}.${y}`;

    const racesThatDay = allRaces.filter(r => r.date === dateStr);
    let html = '';
    if (racesThatDay.length > 0) {
        racesThatDay.forEach(race => {
            let deleteBtn = '';
            if (currentUserRole === 'admin') deleteBtn = `<button class="btn-delete" onclick="deleteRace('${race.id}')">🗑️</button>`;
            html += `
            <div class="race-mini-card">
                <div style="flex:1;">
                    <div style="font-weight:bold;">${race.name}</div>
                    <div style="font-size:11px; color:gray;">${race.category}</div>
                </div>
                <div style="display:flex; align-items:center;"><span style="font-size:16px;">🏁</span>${deleteBtn}</div>
            </div>`;
        });
    } else {
        html = '<p style="color:gray; font-size:12px; margin-top:10px;">Etkinlik yok.</p>';
    }
    document.getElementById('selected-day-races').innerHTML = html;

    if (currentUserRole === 'admin') document.getElementById('btnAddRaceToDay').style.display = 'block';
    else document.getElementById('btnAddRaceToDay').style.display = 'none';
}

function deleteRace(raceId) {
    if(confirm("Silmek istiyor musun?")) db.collection('races').doc(raceId).delete();
}

// --- MODAL & KAYIT ---
function openAddModal() {
    if (!selectedFullDate) return;
    document.getElementById('modalDateLabel').innerText = selectedFullDate;
    document.getElementById('modal-overlay').style.display = 'flex';
}
function closeAddModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('modalRaceName').value = '';
    document.getElementById('modalRaceCat').value = '';
}
function saveRaceFromModal() {
    const name = document.getElementById('modalRaceName').value;
    const cat = document.getElementById('modalRaceCat').value;
    if (!name) return alert("İsim giriniz");
    db.collection('races').add({ name: name, category: cat, date: selectedFullDate, createdAt: new Date() }).then(closeAddModal);
}

function saveNews() {
    const title = document.getElementById('newsTitle').value;
    const tag = document.getElementById('newsTag').value;
    const content = document.getElementById('newsContent').value;
    if (!title) return alert("Başlık giriniz");
    db.collection('news').add({ title: title, tag: tag || 'GENEL', content: content, date: new Date(), color: '#FF6B35' })
        .then(() => { alert("Haber Yayınlandı!"); switchView('feed'); });
}

// --- GENEL UI ---
function updateUIForUser(user, role) {
    document.getElementById('header-status').innerHTML = `<span style="color:var(--orange)">●</span> ${user.displayName.split(' ')[0]}`;
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
    document.getElementById('header-status').innerText = "Misafir";
    document.querySelector('.profile-header h3').innerText = "Misafir Kullanıcı";
    document.querySelector('.login-prompt').style.display = 'block';
    if(document.getElementById('btnAdmin')) document.getElementById('btnAdmin').remove();
    if(document.getElementById('btnLogout')) document.getElementById('btnLogout').remove();
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('view-' + viewName).classList.add('active');
    const map = {'feed':0, 'discover':1, 'locker':2};
    if(map[viewName]!==undefined) document.querySelectorAll('.nav-item')[map[viewName]].classList.add('active');
}

document.addEventListener('click', (e) => {
    if(e.target && e.target.id == 'btnLogin') loginWithGoogle();
});