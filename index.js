const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// --- DİKKAT: BURAYA KENDİ STRAVA BİLGİLERİNİ YAZ ---
const CLIENT_ID = '186518';       
const CLIENT_SECRET = '2e89267133a6e48c3fc71787a8eaba4bbb71c863'; 
// Sunucu hangi portu verirse onu kullan, yoksa 3000'i kullan
const PORT = process.env.PORT || 3000;

// 1. Giriş Rotası
app.get('/auth/strava', (req, res) => {
    // Onay ekranına gönder
   const redirectUrl = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&https://checkpoint-collective.onrender.com//exchange_token&approval_prompt=force&scope=activity:read_all`;
    res.redirect(redirectUrl);
});

// 2. Karşılama ve Yönlendirme Rotası (GÜNCELLENDİ)
app.get('/exchange_token', async (req, res) => {
    const authorizationCode = req.query.code;

    if (!authorizationCode) {
        return res.redirect('/?error=strava_failed');
    }

    try {
        // Strava'dan anahtarı al
        const response = await axios.post('https://www.strava.com/oauth/token', {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: authorizationCode,
            grant_type: 'authorization_code'
        });

        const accessToken = response.data.access_token;
        const refreshToken = response.data.refresh_token;
        const expiresAt = response.data.expires_at;

        // --- İŞTE BURAYI DÜZELTTİK ---
        // "Başarılı" yazısı yerine, kullanıcıyı ana sayfaya (/) geri gönderiyoruz.
        // Ama eli boş göndermiyoruz, URL'in arkasına anahtarı (token) ekliyoruz.
        res.redirect(`/?strava_token=${accessToken}&strava_refresh=${refreshToken}&strava_expires=${expiresAt}`);

    } catch (error) {
        console.error("Strava Hatası:", error.response ? error.response.data : error.message);
        res.redirect('/?error=strava_connection_error');
    }
});

// Ana Sayfa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Sunucu hazır! http://localhost:${PORT}`);
});