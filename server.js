const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Public klasörünü dışarıya aç
app.use(express.static(path.join(__dirname, 'public')));

// --- GÜVENLİK AYARLARI (Render'dan Gelecek) ---
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || '8d4c0c13-12bb-436a-95d1-bd64eaa1a051'; 
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY; 
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || '186518';       
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET; 
const PORT = process.env.PORT || 3000;

// 1. Strava Giriş Yönlendirmesi
app.get('/auth/strava', (req, res) => {
    const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    const redirectUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${baseUrl}/exchange_token&approval_prompt=force&scope=activity:read_all`;
    res.redirect(redirectUrl);
});

// 2. Strava Token Takası
app.get('/exchange_token', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/?error=strava_failed');
    try {
        const response = await axios.post('https://www.strava.com/oauth/token', {
            client_id: STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code'
        });
        // Tokenları URL parametresi olarak frontend'e geri yolla
        res.redirect(`/?strava_token=${response.data.access_token}&strava_refresh=${response.data.refresh_token}&strava_expires=${response.data.expires_at}`);
    } catch (error) { res.redirect('/?error=strava_connection_error'); }
});

// 3. Strava Veri Çekme (Proxy)
app.post('/api/strava/activities', async (req, res) => {
    const { access_token } = req.body;
    const oneMonthAgo = Math.floor(Date.now() / 1000) - 2592000; 
    try {
        const response = await axios.get(`https://www.strava.com/api/v3/athlete/activities?after=${oneMonthAgo}&per_page=30`, {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });
        res.json(response.data);
    } catch (error) { res.status(500).json({ error: "Veri çekilemedi" }); }
});

// Ana Sayfa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server çalışıyor: Port ${PORT}`);
});