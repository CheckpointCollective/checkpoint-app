console.log("Checkpoint Collective Başlatılıyor... 🚀");

// 1. FIREBASE BAŞLATMA
// (config.js içindeki firebaseConfig değişkenini kullanır)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 2. GİRİŞ YAPMA FONKSİYONU (Google)
function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => {
            console.log("Giriş Başarılı:", result.user.displayName);
            // Sayfa yenilemeye gerek yok, onAuthStateChanged yakalayacak
        })
        .catch((error) => {
            console.error("Giriş Hatası:", error);
            alert("Giriş yapılırken bir hata oluştu.");
        });
}

// 3. KULLANICI DURUMUNU İZLEME (Olay Merkezi)
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // --- KULLANICI GİRİŞ YAPMIŞ ---
        console.log("Kullanıcı aktif:", user.email);

        // A) Veritabanında Kaydı Var mı Bak? Yoksa Oluştur.
        const userRef = db.collection('users').doc(user.uid);
        const doc = await userRef.get();

        if (!doc.exists) {
            console.log("Yeni Kullanıcı! Veritabanına 'free' olarak ekleniyor...");
            await userRef.set({
                name: user.displayName,
                email: user.email,
                photo: user.photoURL,
                role: 'free', // Varsayılan Rol
                joinedAt: new Date()
            });
        } else {
            console.log("Mevcut Kullanıcı. Rolü:", doc.data().role);
        }

        // B) Arayüzü Güncelle (Profil Bilgileri)
        updateUIForUser(user);

    } else {
        // --- KULLANICI ÇIKIŞ YAPMIŞ ---
        console.log("Misafir Modu");
        updateUIForGuest();
    }
});

// 4. ARAYÜZ GÜNCELLEME (User vs Guest)
function updateUIForUser(user) {
    // Header Rozeti
    const headerStatus = document.getElementById('header-status');
    headerStatus.innerHTML = `<span style="color:var(--orange)">●</span> ${user.displayName.split(' ')[0]}`; // Sadece ilk isim
    
    // Locker Ekranı (Login Butonunu Gizle, Profili Göster)
    document.querySelector('.profile-header h3').innerText = user.displayName;
    document.querySelector('.profile-header .avatar').style.backgroundImage = `url('${user.photoURL}')`;
    document.querySelector('.profile-header .avatar').style.backgroundSize = "cover";
    
    // Login Kutusunu Gizle
    document.querySelector('.login-prompt').style.display = 'none';
    
    // Çıkış Butonu Ekle (Locker Ekranına)
    if (!document.getElementById('btnLogout')) {
        const lockerDiv = document.getElementById('view-locker');
        const btnLogout = document.createElement('button');
        btnLogout.id = 'btnLogout';
        btnLogout.innerText = "ÇIKIŞ YAP";
        btnLogout.className = "btn-primary";
        btnLogout.style.backgroundColor = "#333"; // Gri renk
        btnLogout.style.marginTop = "10px";
        btnLogout.onclick = () => auth.signOut();
        lockerDiv.appendChild(btnLogout);
    }
}

function updateUIForGuest() {
    // Header Rozeti
    document.getElementById('header-status').innerText = "Misafir";
    
    // Locker Ekranı
    document.querySelector('.profile-header h3').innerText = "Misafir Kullanıcı";
    document.querySelector('.profile-header .avatar').style.backgroundImage = "none";
    
    // Login Kutusunu Göster
    document.querySelector('.login-prompt').style.display = 'block';
    
    // Varsa Çıkış Butonunu Sil
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) btnLogout.remove();
}

// 5. SAYFA GEÇİŞ MANTIĞI (Aynı kalacak)
function switchView(viewName) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    const selectedView = document.getElementById('view-' + viewName);
    if (selectedView) selectedView.classList.add('active');
    
    const menuIndex = { 'feed': 0, 'discover': 1, 'locker': 2 };
    const navItems = document.querySelectorAll('.nav-item');
    if (navItems[menuIndex[viewName]]) navItems[menuIndex[viewName]].classList.add('active');
}

// 6. BUTON TIKLAMALARI
// Login butonu dinamik oluştuğu için veya başta varsa, ona listener ekleyelim
document.addEventListener('click', function(e){
    if(e.target && e.target.id == 'btnLogin'){
        loginWithGoogle();
    }
});