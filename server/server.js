const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Google Sheets Configuration
const SPREADSHEET_ID = '1laNmzAhUHJpkm-DTqzn0fsZxZNZ7S-Du2-_m7WFDYc8';
const SHEET_NAME = 'leads';

// Initialize Google Sheets Auth
async function getGoogleSheetsAuth() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, 'credentials.json'),
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

// API endpoint to receive orders
app.post('/api/orders', async (req, res) => {
    try {
        const { name, phone, whatsapp, governorate, address, product, quantity, total } = req.body;
        
        // Validate required fields
        if (!name || !phone || !governorate || !address) {
            return res.status(400).json({ 
                success: false, 
                message: 'جميع الحقول مطلوبة' 
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

        res.json({ 
            success: true, 
            message: 'تم استلام الطلب بنجاح',
            orderDate: orderDate
        });

    } catch (error) {
        console.error('❌ خطأ في إضافة الطلب:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'حدث خطأ في حفظ الطلب',
            error: error.message 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'الخادم يعمل بشكل طبيعي' });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Serve the confirmation page
app.get('/confirm', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'confirm.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🚀 خادم Hope-K19 يعمل الآن!                            ║
║                                                          ║
║   📍 الرابط المحلي: http://localhost:${PORT}               ║
║   📊 Google Sheets: متصل                                 ║
║                                                          ║
║   ✅ جاهز لاستقبال الطلبات                               ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    `);
});
