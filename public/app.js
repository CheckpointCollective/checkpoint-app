console.log("Checkpoint Collective Başlatılıyor... 🚀");

// --- 1. FIREBASE BAŞLATMA ---
// config.js dosyasından gelen bilgileri kullanır
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- 2. GİRİŞ İŞLEMLERİ ---
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => {
            console.log("Giriş Başarılı:", result.user.displayName);
        })
        .catch((error) => {
            console.error("Giriş Hatası:", error);
            alert("Giriş yapılamadı: " + error.message);
        });
}

// --- 3. KULLANICI DURUMUNU İZLEME ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // --- KULLANICI GİRİŞ YAPMIŞ ---
        console.log("Aktif Kullanıcı:", user.email);

        // Veritabanı Kontrolü (Yoksa Kaydet)
        const userRef = db.collection('users').doc(user.uid);
        
        try {
            const doc = await userRef.get();
            if (!doc.exists) {
                console.log("Yeni Kullanıcı Kaydediliyor...");
                await userRef.set({
                    name: user.displayName,
                    email: user.email,
                    photo: user.photoURL,
                    role: 'free', // Varsayılan rol
                    joinedAt: new Date()
                });
            }
        } catch (error) {
            console.error("Veritabanı hatası:", error);
        }

        // Arayüzü Güncelle
        updateUIForUser(user);

    } else {
        // --- MİSAFİR MODU ---
        updateUIForGuest();
    }
});

// --- 4. ARAYÜZ GÜNCELLEME (LOGGED IN) ---
async function updateUIForUser(user) {
    // Header'da ismin sadece ilk kısmını göster
    const firstName = user.displayName.split(' ')[0];
    const headerStatus = document.getElementById('header-status');
    if(headerStatus) headerStatus.innerHTML = `<span style="color:var(--orange)">●</span> ${firstName}`;
    
    // Locker Ekranı Bilgileri
    const profileHeader = document.querySelector('.profile-header h3');
    const avatar = document.querySelector('.profile-header .avatar');
    const loginPrompt = document.querySelector('.login-prompt');
    const roleBadge = document.querySelector('.role-badge');

    if(profileHeader) profileHeader.innerText = user.displayName;
    if(avatar) avatar.style.backgroundImage = `url('${user.photoURL}')`;
    if(loginPrompt) loginPrompt.style.display = 'none';

    // ROL KONTROLÜ (Admin mi?)
    // Burası veritabanından güncel rolü çeker
    try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
            const userData = doc.data();
            const userRole = userData.role;

            if (userRole === 'admin') {
                // ADMİN İSE
                if(roleBadge) {
                    roleBadge.innerText = "YÖNETİCİ";
                    roleBadge.style.background = "linear-gradient(90deg, #D32F2F, #B71C1C)"; // Kırmızı tonlar
                    roleBadge.style.color = "white";
                }
                
                // Admin Paneli Butonu Ekle (Tekrar eklememek için kontrol et)
                if (!document.getElementById('btnAdmin')) {
                    const btnAdmin = document.createElement('button');
                    btnAdmin.id = 'btnAdmin';
                    btnAdmin.innerHTML = "⚡ YÖNETİCİ PANELİ";
                    btnAdmin.className = "btn-primary";
                    btnAdmin.style.marginTop = "15px";
                    btnAdmin.style.background = "#D32F2F"; // Kırmızı buton
                    btnAdmin.onclick = () => alert("Admin Paneli Henüz Hazır Değil! 🚧");
                    
                    document.querySelector('.profile-header').appendChild(btnAdmin);
                }

            } else {
                // NORMAL ÜYE İSE
                if(roleBadge) roleBadge.innerText = "MEMBER";
            }
        }
    } catch (error) {
        console.error("Rol çekilemedi:", error);
    }
    
    // Çıkış Butonu Ekle
    if (!document.getElementById('btnLogout')) {
        const lockerDiv = document.getElementById('view-locker');
        const btnLogout = document.createElement('button');
        btnLogout.id = 'btnLogout';
        btnLogout.innerText = "ÇIKIŞ YAP";
        btnLogout.className = "btn-primary";
        btnLogout.style.backgroundColor = "#333";
        btnLogout.style.marginTop = "10px";
        btnLogout.onclick = () => auth.signOut();
        lockerDiv.appendChild(btnLogout);
    }
}

// --- 5. ARAYÜZ GÜNCELLEME (GUEST) ---
function updateUIForGuest() {
    const headerStatus = document.getElementById('header-status');
    if(headerStatus) headerStatus.innerText = "Misafir";
    
    const profileHeader = document.querySelector('.profile-header h3');
    if(profileHeader) profileHeader.innerText = "Misafir Kullanıcı";
    
    const avatar = document.querySelector('.profile-header .avatar');
    if(avatar) avatar.style.backgroundImage = "none";
    
    const roleBadge = document.querySelector('.role-badge');
    if(roleBadge) {
        roleBadge.innerText = "Giriş Yapılmadı";
        roleBadge.style.background = "#ddd";
        roleBadge.style.color = "black";
    }
    
    const loginPrompt = document.querySelector('.login-prompt');
    if(loginPrompt) loginPrompt.style.display = 'block';
    
    // Admin veya Çıkış butonlarını temizle
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) btnLogout.remove();
    const btnAdmin = document.getElementById('btnAdmin');
    if (btnAdmin) btnAdmin.remove();
}

// --- 6. SAYFA GEÇİŞ MANTIĞI ---
function switchView(viewName) {
    // Tüm ekranları gizle
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    // Tüm menü butonlarını pasif yap
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Seçilen ekranı göster
    const selectedView = document.getElementById('view-' + viewName);
    if (selectedView) {
        selectedView.classList.add('active');
    }

    // İlgili menü butonunu aktif yap
    const menuIndex = { 'feed': 0, 'discover': 1, 'locker': 2 };
    const navItems = document.querySelectorAll('.nav-item');
    if (navItems[menuIndex[viewName]]) {
        navItems[menuIndex[viewName]].classList.add('active');
    }
}

// --- 7. GLOBAL TIKLAMA DİNLEYİCİSİ ---
// Login butonu dinamik olduğu için click event'i buradan yakalıyoruz
document.addEventListener('click', function(e){
    if(e.target && e.target.id == 'btnLogin'){
        loginWithGoogle();
    }
});