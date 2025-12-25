const { google } = require('googleapis');

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

// Vercel Serverless Function Handler
module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Health check endpoint
    if (req.method === 'GET') {
        return res.status(200).json({ 
            status: 'OK', 
            message: 'الخادم يعمل بشكل طبيعي',
            timestamp: getEgyptDateTime()
        });
    }

    // Handle POST request for orders
    if (req.method === 'POST') {
        try {
            const { name, phone, whatsapp, governorate, address, product, quantity, total } = req.body;
            
            // Validate required fields
            if (!name || !phone || !governorate || !address) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'جميع الحقول مطلوبة' 
                });
            }

            // Check environment variables
            if (!SPREADSHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
                console.error('Missing required environment variables');
                return res.status(500).json({ 
                    success: false, 
                    message: 'خطأ في إعدادات الخادم' 
                });
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
                'جديد',              // F: الحالة
                address,             // G: تفاصيل العنوان
                orderDetails,        // H: تفاصيل الطلب (عدد القطع والسعر)
                '',                  // I: فارغ
                '',                  // J: فارغ
                'موبايل المهام الخاصة K19' // K: المنتج
            ];

            // Append to Google Sheet
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEET_NAME}!A:K`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: [rowData]
                }
            });

            console.log('✅ تم إضافة طلب جديد:', { name, phone, orderDate });

            return res.status(200).json({ 
                success: true, 
                message: 'تم استلام الطلب بنجاح',
                orderDate: orderDate
            });

        } catch (error) {
            console.error('❌ خطأ في إضافة الطلب:', error.message);
            return res.status(500).json({ 
                success: false, 
                message: 'حدث خطأ في حفظ الطلب',
                error: error.message 
            });
        }
    }

    // Method not allowed
    return res.status(405).json({ 
        success: false, 
        message: 'Method not allowed' 
    });
};
