const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- BİLDİRİM AYARLARI ---
const ONESIGNAL_APP_ID = '8d4c0c13-12bb-436a-95d1-bd64eaa1a051'; //App ID'n
const ONESIGNAL_API_KEY = 'd7gtusckze2hvyep2wy4ifxrd'; // Senin verdiğin API Key
// --- STRAVA AYARLARI ---
const STRAVA_CLIENT_ID = '186518';       
const STRAVA_CLIENT_SECRET = '2e89267133a6e48c3fc71787a8eaba4bbb71c863'; // Strava Secret'ını 
const PORT = process.env.PORT || 3000;


// 1. BİLDİRİM GÖNDERME
app.post('/api/send-notification', async (req, res) => {
    const { message, targetEmail } = req.body;
    try {
        await axios.post('https://onesignal.com/api/v1/notifications', {
            app_id: ONESIGNAL_APP_ID,
            contents: { en: message },
            include_external_user_ids: [targetEmail]
        }, {
            headers: { 'Authorization': `Basic ${ONESIGNAL_API_KEY}`, 'Content-Type': 'application/json' }
        });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Bildirim Hatası" }); }
});

// 2. STRAVA TOKEN YENİLEME
app.post('/api/strava/refresh', async (req, res) => {
    const { refresh_token } = req.body;
    try {
        const response = await axios.post('https://www.strava.com/oauth/token', {
            client_id: STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        });
        res.json(response.data);
    } catch (error) { res.status(500).json({ error: "Token yenilenemedi" }); }
});

// 3. STRAVA AKTİVİTELERİ ÇEKME
app.post('/api/strava/activities', async (req, res) => {
    const { access_token } = req.body;
    const oneMonthAgo = Math.floor(Date.now() / 1000) - 2592000; 
    try {
        const response = await axios.get(`https://www.strava.com/api/v3/athlete/activities?after=${oneMonthAgo}&per_page=30`, {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });
        res.json(response.data);
    } catch (error) { res.status(500).json({ error: "Aktiviteler alınamadı" }); }
});

// 4. STRAVA GİRİŞ
app.get('/auth/strava', (req, res) => {
    // Render adresini buraya doğru yazdığından emin ol!
    const redirectUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=https://checkpoint-collective.onrender.com/exchange_token&approval_prompt=force&scope=activity:read_all`;
    res.redirect(redirectUrl);
});

// 5. STRAVA DÖNÜŞ
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
        res.redirect(`/?strava_token=${response.data.access_token}&strava_refresh=${response.data.refresh_token}&strava_expires=${response.data.expires_at}`);
    } catch (error) { res.redirect('/?error=strava_connection_error'); }
});

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.listen(PORT, () => { console.log(`🚀 Sunucu hazır! Port: ${PORT}`); });