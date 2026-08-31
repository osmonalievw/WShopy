require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const SneaksAPI = require('sneaks-api');
const cors = require('cors');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

// Initialize Firebase Admin
let serviceAccount;
try {
    serviceAccount = require('./serviceAccountKey.json');
} catch (e) {
    console.error("serviceAccountKey.json not found! Ensure it is uploaded to Render as a Secret File.");
    process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "showp-d6660.firebasestorage.app"
});
const db = getFirestore();
const bucket = getStorage().bucket();

const app = express();
const bot = new Telegraf(process.env.TGBOT_API_KEY);
const sneaks = new SneaksAPI();

const PORT = process.env.PORT || 3000;
const WEBAPP_URL = process.env.WEBAPP_URL || "https://wshopy.onrender.com";

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Mock Database for MVP (Bypasses StockX Cloudflare Blocks)
const mockSneakers = [
    {
        shoeName: "Air Jordan 1 Retro High",
        brand: "Nike",
        styleID: "555088-105",
        retailPrice: 160,
        thumbnail: "https://pngimg.com/uploads/sneaker/sneaker_PNG48.png",
        colors: [
            {
                name: "Chicago (Red)",
                hex: "#e02130",
                images: [
                    "https://pngimg.com/uploads/sneaker/sneaker_PNG48.png",
                    "https://pngimg.com/uploads/sneaker/sneaker_PNG48.png" // Simulated 2nd angle
                ]
            },
            {
                name: "Royal (Blue)",
                hex: "#1d428a",
                images: [
                    "https://pngimg.com/uploads/sneaker/sneaker_PNG73.png",
                    "https://pngimg.com/uploads/sneaker/sneaker_PNG73.png"
                ]
            }
        ]
    },
    {
        shoeName: "Vans Old Skool Classic",
        brand: "Vans",
        styleID: "VN000D3HY28",
        retailPrice: 65,
        thumbnail: "https://pngimg.com/uploads/vans/vans_PNG30.png",
        colors: [
            {
                name: "Black/White",
                hex: "#000000",
                images: ["https://pngimg.com/uploads/vans/vans_PNG30.png", "https://pngimg.com/uploads/vans/vans_PNG30.png"]
            }
        ]
    },
    {
        shoeName: "Chuck Taylor All Star",
        brand: "Converse",
        styleID: "M9160",
        retailPrice: 60,
        thumbnail: "https://pngimg.com/uploads/converse/converse_PNG43.png",
        colors: [
            {
                name: "Classic Black",
                hex: "#222222",
                images: ["https://pngimg.com/uploads/converse/converse_PNG43.png"]
            }
        ]
    },
    {
        shoeName: "Air Max 90 Essential",
        brand: "Nike",
        styleID: "537384-111",
        retailPrice: 110,
        thumbnail: "https://pngimg.com/uploads/sneaker/sneaker_PNG2.png",
        colors: [
            {
                name: "Infrared",
                hex: "#ff3366",
                images: ["https://pngimg.com/uploads/sneaker/sneaker_PNG2.png"]
            }
        ]
    }
];

// Sneaks API Endpoints (Mocked for stability)
app.get('/api/sneakers', (req, res) => {
    res.json(mockSneakers);
});

app.post('/api/order', async (req, res) => {
    const { user_id, product, price, size, color, name, phone, receiptBase64 } = req.body;
    
    try {
        let receiptUrl = null;
        
        if (receiptBase64) {
            // Upload to Firebase Storage
            const base64Data = receiptBase64.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            const fileName = `receipts/${Date.now()}_${user_id}.jpg`;
            const file = bucket.file(fileName);
            
            await file.save(buffer, {
                metadata: { contentType: 'image/jpeg' }
            });
            
            // Save the exact storage path so Flutter can easily render it
            receiptUrl = `gs://${bucket.name}/${fileName}`;
        }
        
        // Save to Firestore
        const orderRef = await db.collection('orders').add({
            userId: user_id,
            name: name,
            phone: phone,
            productId: product.styleID,
            productName: product.shoeName,
            color: color,
            size: size,
            price: price,
            receiptUrl: receiptUrl,
            status: 'pending_payment',
            createdAt: FieldValue.serverTimestamp()
        });
        
        console.log(`Order ${orderRef.id} saved to Firebase!`);
        res.json({ success: true, message: "Order placed" });
    } catch (e) {
        console.error("Error saving order to Firebase:", e);
        res.status(500).json({ error: e.message || "Failed to process order" });
    }
});

// Telegram Bot Logic
bot.start((ctx) => {
    ctx.reply(
        "👋 Добро пожаловать в Sneaker Concierge!\nСамые эксклюзивные кроссовки из Японии с доставкой в Кыргызстан.",
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🚀 Открыть Каталог", web_app: { url: WEBAPP_URL } }]
                ]
            }
        }
    );
});

// Start the app
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    bot.launch().then(() => console.log("Bot is running"));
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
