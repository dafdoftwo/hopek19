// Cloudflare Pages Function for Orders API

// Helper function to hash data using Web Crypto API
async function sha256Hash(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Send TikTok Event
async function sendTikTokEvent(env, eventData, eventType = 'Lead') {
    if (!env.TIKTOK_PIXEL_ID || !env.TIKTOK_ACCESS_TOKEN) {
        console.log('TikTok credentials not configured, skipping event');
        return;
    }

    const eventTime = Math.floor(Date.now() / 1000);
    const hashedPhone = eventData.phone ? await sha256Hash(eventData.phone) : undefined;
    
    const payload = {
        event_source: 'web',
        event_source_id: env.TIKTOK_PIXEL_ID,
        data: [{
            event: eventType,
            event_id: `${eventType.toLowerCase()}_${Date.now()}`,
            event_time: eventTime,
            user: {
                phone: hashedPhone,
                ip: eventData.ip || undefined,
                user_agent: eventData.userAgent || undefined
            },
            properties: {
                content_type: 'product',
                content_name: 'Hope K19',
                content_id: 'hope-k19',
                content_category: 'Mobile Phone',
                currency: 'EGP',
                value: parseFloat(eventData.total?.replace(/[^0-9.]/g, '')) || 1999,
                num_items: eventData.quantity || 1
            },
            page: {
                url: 'https://classy-entremet-a4d6d1.netlify.app/'
            }
        }]
    };

    try {
        const response = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Access-Token': env.TIKTOK_ACCESS_TOKEN
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        console.log('TikTok Event Response:', data);
        return data;
    } catch (error) {
        console.error('TikTok Event Error:', error.message);
        return null;
    }
}

// Send Facebook Conversion Event
async function sendFacebookEvent(env, eventData) {
    if (!env.FACEBOOK_PIXEL_ID || !env.FACEBOOK_ACCESS_TOKEN) {
        console.log('Facebook credentials not configured, skipping event');
        return;
    }

    const eventTime = Math.floor(Date.now() / 1000);
    const hashedPhone = eventData.phone ? await sha256Hash(eventData.phone) : undefined;
    const hashedCountry = await sha256Hash('eg');
    
    const payload = {
        data: [{
            event_name: 'Purchase',
            event_time: eventTime,
            event_id: `order_${Date.now()}`,
            action_source: 'website',
            user_data: {
                ph: hashedPhone ? [hashedPhone] : undefined,
                country: [hashedCountry]
            },
            custom_data: {
                currency: 'EGP',
                value: parseFloat(eventData.total?.replace(/[^0-9.]/g, '')) || 1999,
                content_name: 'Hope K19',
                content_type: 'product',
                contents: [{
                    id: 'hope-k19',
                    quantity: eventData.quantity || 1
                }]
            }
        }]
    };

    try {
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${env.FACEBOOK_PIXEL_ID}/events?access_token=${env.FACEBOOK_ACCESS_TOKEN}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }
        );
        const data = await response.json();
        console.log('Facebook Event Response:', data);
        return data;
    } catch (error) {
        console.error('Facebook Event Error:', error.message);
        return null;
    }
}

// Format date for Egypt timezone
function getEgyptDateTime() {
    const now = new Date();
    const options = {
        timeZone: 'Africa/Cairo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    return now.toLocaleString('en-GB', options).replace(',', '');
}

// Get Google Access Token using Service Account
async function getGoogleAccessToken(env) {
    const header = {
        alg: 'RS256',
        typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const claim = {
        iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now
    };

    // Base64url encode
    const base64urlEncode = (obj) => {
        const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
        return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };

    const headerEncoded = base64urlEncode(header);
    const claimEncoded = base64urlEncode(claim);
    const signatureInput = `${headerEncoded}.${claimEncoded}`;

    // Import private key and sign
    const privateKey = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    const pemContents = privateKey.replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replace(/\s/g, '');
    
    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    
    const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        binaryKey,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        new TextEncoder().encode(signatureInput)
    );

    const signatureEncoded = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const jwt = `${signatureInput}.${signatureEncoded}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
}

// Append row to Google Sheets
async function appendToGoogleSheet(env, rowData) {
    const accessToken = await getGoogleAccessToken(env);
    const sheetName = env.GOOGLE_SHEET_NAME || 'leads';
    
    const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SPREADSHEET_ID}/values/${sheetName}!A:L:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                values: [rowData]
            })
        }
    );

    return response.json();
}

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle OPTIONS request
export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders });
}

// Handle GET request
export async function onRequestGet({ env }) {
    return new Response(JSON.stringify({
        status: 'OK',
        message: 'الخادم يعمل بشكل طبيعي',
        timestamp: getEgyptDateTime()
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

// Handle POST request
export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();
        const { name, phone, whatsapp, governorate, address, product, quantity, total } = body;

        // Validate required fields
        if (!name || !phone || !governorate || !address) {
            return new Response(JSON.stringify({
                success: false,
                message: 'جميع الحقول مطلوبة'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Check environment variables
        if (!env.GOOGLE_SPREADSHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
            console.error('Missing required environment variables');
            return new Response(JSON.stringify({
                success: false,
                message: 'خطأ في إعدادات الخادم'
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Prepare row data
        const orderDate = getEgyptDateTime();
        const orderDetails = `${quantity || 'قطعة واحدة'} - ${total || '1,999 ج.م'}`;
        const rowData = [
            orderDate,
            name,
            phone,
            whatsapp || phone,
            governorate,
            '',
            address,
            orderDetails,
            '',
            '',
            'موبايل المهام الخاصة K19',
            'جديد'
        ];

        // Append to Google Sheet
        await appendToGoogleSheet(env, rowData);
        console.log('✅ تم إضافة طلب جديد:', { name, phone, orderDate });

        // Send Conversion Events
        await Promise.all([
            sendTikTokEvent(env, { phone, quantity, total }, 'Lead'),
            sendFacebookEvent(env, { phone, quantity, total })
        ]);

        return new Response(JSON.stringify({
            success: true,
            message: 'تم استلام الطلب بنجاح',
            orderDate: orderDate
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('❌ خطأ في إضافة الطلب:', error.message);
        return new Response(JSON.stringify({
            success: false,
            message: 'حدث خطأ في حفظ الطلب',
            error: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}
