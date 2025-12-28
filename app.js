console.log("Checkpoint Collective Başlatılıyor... 🚀");

// FIREBASE BAŞLATMA
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 1. GİRİŞ YAPMA
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => console.log("Giriş Başarılı"))
        .catch((error) => alert("Hata: " + error.message));
}

// 2. KULLANICI İZLEME
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // Kullanıcı giriş yapmış
        const userRef = db.collection('users').doc(user.uid);
        const doc = await userRef.get();

        if (!doc.exists) {
            // İlk kez geliyor, kaydet
            await userRef.set({
                name: user.displayName,
                email: user.email,
                photo: user.photoURL,
                role: 'free',
                joinedAt: new Date()
            });
        }
        updateUIForUser(user);
    } else {
        // Çıkış yapmış
        updateUIForGuest();
    }
});

// 3. ARAYÜZ GÜNCELLEME
function updateUIForUser(user) {
    document.getElementById('header-status').innerHTML = `<span style="color:var(--orange)">●</span> ${user.displayName.split(' ')[0]}`;
    document.querySelector('.profile-header h3').innerText = user.displayName;
    document.querySelector('.role-badge').innerText = "MEMBER";
    
    // Avatarı güncelle
    const avatarEl = document.querySelector('.profile-header .avatar');
    if(avatarEl) avatarEl.style.backgroundImage = `url('${user.photoURL}')`;
    
    document.querySelector('.login-prompt').style.display = 'none';
    
    // Çıkış butonu yoksa ekle
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
    document.querySelector('.role-badge').innerText = "Giriş Yapılmadı";
    document.querySelector('.login-prompt').style.display = 'block';
    const btn = document.getElementById('btnLogout');
    if(btn) btn.remove();
}

// 4. SAYFA GEÇİŞİ
function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById('view-' + viewName).classList.add('active');
    
    const map = { 'feed':0, 'discover':1, 'locker':2 };
    document.querySelectorAll('.nav-item')[map[viewName]].classList.add('active');
}

// Buton Listener
document.addEventListener('click', (e) => {
    if(e.target && e.target.id == 'btnLogin') loginWithGoogle();
});