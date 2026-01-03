const { google } = require('googleapis');
const https = require('https');

// TikTok Events API Configuration
const TIKTOK_PIXEL_ID = process.env.TIKTOK_PIXEL_ID;
const TIKTOK_ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;

// Facebook Conversions API Configuration
const FACEBOOK_PIXEL_ID = process.env.FACEBOOK_PIXEL_ID;
const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;

// Send TikTok Event (Lead or CompletePayment)
async function sendTikTokEvent(eventData, eventType = 'Lead') {
    if (!TIKTOK_PIXEL_ID || !TIKTOK_ACCESS_TOKEN) {
        console.log('TikTok credentials not configured, skipping event');
        return;
    }

    const crypto = require('crypto');
    const eventTime = Math.floor(Date.now() / 1000);
    
    const payload = JSON.stringify({
        event_source: 'web',
        event_source_id: TIKTOK_PIXEL_ID,
        data: [{
            event: eventType,
            event_id: `${eventType.toLowerCase()}_${Date.now()}`,
            event_time: eventTime,
            user: {
                phone: eventData.phone ? crypto.createHash('sha256').update(eventData.phone).digest('hex') : undefined,
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
                url: eventData.url || 'https://classy-entremet-a4d6d1.netlify.app/'
            }
        }]
    });

    return new Promise((resolve) => {
        const options = {
            hostname: 'business-api.tiktok.com',
            path: '/open_api/v1.3/event/track/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Access-Token': TIKTOK_ACCESS_TOKEN
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('TikTok Event Response:', data);
                resolve(data);
            });
        });

        req.on('error', (e) => {
            console.error('TikTok Event Error:', e.message);
            resolve(null);
        });

        req.write(payload);
        req.end();
    });
}

// Send Facebook Conversion Event
async function sendFacebookEvent(eventData) {
    if (!FACEBOOK_PIXEL_ID || !FACEBOOK_ACCESS_TOKEN) {
        console.log('Facebook credentials not configured, skipping event');
        return;
    }

    const crypto = require('crypto');
    const eventTime = Math.floor(Date.now() / 1000);
    
    const payload = JSON.stringify({
        data: [{
            event_name: 'Purchase',
            event_time: eventTime,
            event_id: `order_${Date.now()}`,
            action_source: 'website',
            user_data: {
                ph: eventData.phone ? [crypto.createHash('sha256').update(eventData.phone).digest('hex')] : undefined,
                country: [crypto.createHash('sha256').update('eg').digest('hex')]
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
    });

    return new Promise((resolve) => {
        const options = {
            hostname: 'graph.facebook.com',
            path: `/v18.0/${FACEBOOK_PIXEL_ID}/events?access_token=${FACEBOOK_ACCESS_TOKEN}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('Facebook Event Response:', data);
                resolve(data);
            });
        });

        req.on('error', (e) => {
            console.error('Facebook Event Error:', e.message);
            resolve(null);
        });

        req.write(payload);
        req.end();
    });
}

// Google Sheets Configuration from Environment Variables
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'leads';

// Initialize Google Sheets Auth using Environment Variables
async function getGoogleSheetsAuth() {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            project_id: process.env.GOOGLE_PROJECT_ID
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    return auth;
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

// Netlify Serverless Function Handler
const handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight request
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Health check endpoint
    if (event.httpMethod === 'GET') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: 'OK',
                message: 'الخادم يعمل بشكل طبيعي',
                timestamp: getEgyptDateTime()
            })
        };
    }

    // Handle POST request for orders
    if (event.httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body);
            const { name, phone, whatsapp, governorate, address, product, quantity, total } = body;
            
            // Validate required fields
            if (!name || !phone || !governorate || !address) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, message: 'جميع الحقول مطلوبة' })
                };
            }

            // Check environment variables
            if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
                console.error('Missing required environment variables');
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ success: false, message: 'خطأ في إعدادات الخادم' })
                };
            }

            // Get auth and sheets client
            const auth = await getGoogleSheetsAuth();
            const sheets = google.sheets({ version: 'v4', auth });

            // Prepare row data
            const orderDate = getEgyptDateTime();
            const orderDetails = `${quantity || 'قطعة واحدة'} - ${total || '1,999 ج.م'}`;
            const rowData = [
                orderDate,           // A: تاريخ الطلب
                name,                // B: الاسم
                phone,               // C: رقم الهاتف
                whatsapp || phone,   // D: رقم الواتساب
                governorate,         // E: المحافظة
                '',                  // F: فارغ
                address,             // G: تفاصيل العنوان
                orderDetails,        // H: تفاصيل الطلب (عدد القطع والسعر)
                '',                  // I: فارغ
                '',                  // J: فارغ
                'موبايل المهام الخاصة K19', // K: المنتج
                'جديد'               // L: الحالة
            ];

            // Append to Google Sheet
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!A:L`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: [rowData]
                }
            });

            console.log('✅ تم إضافة طلب جديد:', { name, phone, orderDate });

            // Send Conversion Events (TikTok Lead & Facebook Lead)
            await Promise.all([
                sendTikTokEvent({ phone, quantity, total }, 'Lead'),
                sendFacebookEvent({ phone, quantity, total })
            ]);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, message: 'تم استلام الطلب بنجاح', orderDate: orderDate })
            };

        } catch (error) {
            console.error('❌ خطأ في إضافة الطلب:', error.message);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ success: false, message: 'حدث خطأ في حفظ الطلب', error: error.message })
            };
        }
    }

    // Method not allowed
    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ success: false, message: 'Method not allowed' })
    };
};

module.exports = { handler };
