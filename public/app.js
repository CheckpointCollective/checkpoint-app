console.log("Checkpoint 360 - Admin Modu Aktif 🚀");

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

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
        updateUIForUser(user);
    } else {
        updateUIForGuest();
    }
    
    // Verileri Yükle
    loadNews();
    loadRaces(); // YENİ: Yarışları da yükle
});

// --- VERİ ÇEKME FONKSİYONLARI ---
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
                    <p style="font-size:11px; color:#ccc;">${data.content}</p>
                </div>
            </div>`;
        });
        document.getElementById('news-container').innerHTML = html || '<p style="text-align:center; color:gray">Haber yok.</p>';
    });
}

function loadRaces() {
    db.collection('races').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `
            <div class="race-card">
                <div class="race-date">
                    <div class="day">${data.day}</div>
                    <div class="month">${data.month}</div>
                </div>
                <div class="race-info">
                    <div class="race-name">${data.name}</div>
                    <div class="race-cat">${data.category}</div>
                </div>
                <button class="btn-icon">＋</button>
            </div>`;
        });
        document.getElementById('races-container').innerHTML = html || '<p style="text-align:center; color:gray; padding:20px;">Henüz yarış eklenmedi.</p>';
    });
}

// --- VERİ KAYDETME FONKSİYONLARI (ADMİN) ---
function saveNews() {
    const title = document.getElementById('newsTitle').value;
    const tag = document.getElementById('newsTag').value;
    const content = document.getElementById('newsContent').value;

    if (!title) return alert("Başlık giriniz!");

    db.collection('news').add({
        title: title, tag: tag, content: content, date: new Date(), color: '#FF6B35'
    }).then(() => {
        alert("Haber Yayınlandı!");
        switchView('feed');
        document.getElementById('newsTitle').value = ''; // Temizle
    });
}

function saveRace() {
    const name = document.getElementById('raceName').value;
    const day = document.getElementById('raceDateDay').value;
    const month = document.getElementById('raceDateMonth').value;
    const cat = document.getElementById('raceCat').value;

    if (!name || !day) return alert("Yarış bilgilerini eksiksiz giriniz!");

    db.collection('races').add({
        name: name, day: day, month: month, category: cat, createdAt: new Date()
    }).then(() => {
        alert("Yarış Takvime Eklendi! 🏁");
        switchView('discover'); // Takvime götür
        // Kutuları temizle
        document.getElementById('raceName').value = '';
        document.getElementById('raceDateDay').value = '';
    });
}

// --- ARAYÜZ VE GEÇİŞLER ---
async function updateUIForUser(user) {
    const doc = await db.collection('users').doc(user.uid).get();
    const role = doc.data().role;

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
    
    // Çıkış butonu
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