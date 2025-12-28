console.log("Checkpoint 360 Başlatılıyor... 🚀");

// FIREBASE KURULUMU
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- GİRİŞ İŞLEMLERİ ---
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(e => alert(e.message));
}

// --- ANA DÖNGÜ ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // Kullanıcı Giriş Yapmış
        const userRef = db.collection('users').doc(user.uid);
        const doc = await userRef.get();
        if (!doc.exists) {
            await userRef.set({
                name: user.displayName, email: user.email, photo: user.photoURL, role: 'free', joinedAt: new Date()
            });
        }
        updateUIForUser(user);
    } else {
        // Misafir
        updateUIForGuest();
    }
    
    // Uygulama açılınca haberleri yükle
    loadNews();
});

// --- HABERLERİ ÇEKME ---
function loadNews() {
    db.collection('news').orderBy('date', 'desc').onSnapshot(snapshot => {
        let html = '';
        snapshot.forEach(doc => {
            const news = doc.data();
            // Basit Haber Kartı Tasarımı
            html += `
            <div class="news-card">
                <div class="news-img" style="background:${news.color || '#333'}"></div>
                <div class="news-content">
                    <div style="font-size:9px; color:var(--orange); font-weight:bold; margin-bottom:2px;">${news.tag}</div>
                    <h4>${news.title}</h4>
                    <p style="font-size:11px; color:#ccc; margin-top:2px;">${news.content}</p>
                </div>
            </div>`;
        });
        
        // Eğer hiç haber yoksa
        if(html === '') html = '<p style="text-align:center; padding:20px; color:gray">Henüz haber yok.</p>';
        
        document.getElementById('news-container').innerHTML = html;
    });
}

// --- HABER KAYDETME (ADMİN) ---
function saveNews() {
    const title = document.getElementById('newsTitle').value;
    const tag = document.getElementById('newsTag').value;
    const content = document.getElementById('newsContent').value;

    if (!title || !content) {
        alert("Lütfen başlık ve içerik girin!");
        return;
    }

    db.collection('news').add({
        title: title,
        tag: tag || 'GENEL',
        content: content,
        date: new Date(),
        color: '#FF6B35' // Varsayılan turuncu renk
    }).then(() => {
        alert("Haber Yayınlandı! 📢");
        // Formu temizle
        document.getElementById('newsTitle').value = '';
        document.getElementById('newsContent').value = '';
        // Akışa geri dön
        switchView('feed');
    }).catch(error => {
        alert("Hata: " + error.message);
    });
}

// --- ARAYÜZ GÜNCELLEME ---
async function updateUIForUser(user) {
    const doc = await db.collection('users').doc(user.uid).get();
    const role = doc.data().role;

    // Header ve Profil
    document.getElementById('header-status').innerHTML = `<span style="color:var(--orange)">●</span> ${user.displayName.split(' ')[0]}`;
    document.querySelector('.profile-header h3').innerText = user.displayName;
    document.querySelector('.profile-header .avatar').style.backgroundImage = `url('${user.photoURL}')`;
    document.querySelector('.login-prompt').style.display = 'none';

    // ROL VE BUTON
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
            // ARTIK BU BUTON ADMİN SAYFASINI AÇIYOR
            btn.onclick = () => switchView('admin');
            document.querySelector('.profile-header').appendChild(btn);
        }
    } else {
        document.querySelector('.role-badge').innerText = "MEMBER";
    }

    // Çıkış Butonu
    if (!document.getElementById('btnLogout')) {
        const btn = document.createElement('button');
        btn.id = 'btnLogout';
        btn.innerText = "ÇIKIŞ YAP";
        btn.className = "btn-primary";
        btn.style.backgroundColor = "#333";
        btn.style.marginTop = "10px";
        btn.onclick = () => auth.signOut();
        document.getElementById('view-locker').appendChild(btn);
    }
}

function updateUIForGuest() {
    document.getElementById('header-status').innerText = "Misafir";
    document.querySelector('.profile-header h3').innerText = "Misafir Kullanıcı";
    document.querySelector('.profile-header .avatar').style.backgroundImage = "none";
    document.querySelector('.login-prompt').style.display = 'block';
    if(document.getElementById('btnLogout')) document.getElementById('btnLogout').remove();
    if(document.getElementById('btnAdmin')) document.getElementById('btnAdmin').remove();
}

// --- SAYFA GEÇİŞ ---
function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById('view-' + viewName).classList.add('active');
    
    const map = { 'feed':0, 'discover':1, 'locker':2 };
    if(map[viewName] !== undefined) document.querySelectorAll('.nav-item')[map[viewName]].classList.add('active');
}

document.addEventListener('click', (e) => {
    if(e.target && e.target.id == 'btnLogin') loginWithGoogle();
});