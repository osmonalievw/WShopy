require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const SneaksAPI = require('sneaks-api');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
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

// Magic Product Link & SKU Parser
app.post('/api/parse-product', async (req, res) => {
    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ error: "Query is required" });
    }

    const trimmed = query.trim();
    const isUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://');

    if (isUrl) {
        try {
            console.log(`[Parser] Scraping URL: ${trimmed}`);
            const response = await axios.get(trimmed, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8,ru;q=0.7',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                },
                timeout: 10000
            });

            const html = response.data;
            const $ = cheerio.load(html);

            // 1. Title
            let title = $('meta[property="og:title"]').attr('content') ||
                        $('meta[name="twitter:title"]').attr('content') ||
                        $('h1').first().text().trim() ||
                        $('title').text().trim();
            // Clean up common suffixes like " | ABC-MART" or " | atmos tokyo"
            title = title.replace(/\s*[|–-]\s*(ABC-MART|atmos|NIKE|スニーカー).*$/i, '').trim();

            // 2. Description
            let description = $('meta[property="og:description"]').attr('content') ||
                              $('meta[name="description"]').attr('content') || '';

            // 3. Images
            const images = [];
            const ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
            if (ogImage) images.push(ogImage);

            // Check JSON-LD for rich image galleries and prices
            let parsedPrice = null;
            $('script[type="application/ld+json"]').each((_, el) => {
                try {
                    const data = JSON.parse($(el).html());
                    if (data['@type'] === 'Product' || (Array.isArray(data['@graph']) && data['@graph'].some(x => x['@type'] === 'Product'))) {
                        const productObj = data['@type'] === 'Product' ? data : data['@graph'].find(x => x['@type'] === 'Product');
                        if (productObj.image) {
                            if (Array.isArray(productObj.image)) {
                                productObj.image.forEach(img => { if (typeof img === 'string') images.push(img); });
                            } else if (typeof productObj.image === 'string') {
                                images.push(productObj.image);
                            }
                        }
                        if (productObj.offers) {
                            const offers = Array.isArray(productObj.offers) ? productObj.offers[0] : productObj.offers;
                            if (offers && offers.price) {
                                parsedPrice = parseFloat(offers.price);
                            }
                        }
                    }
                } catch (e) {}
            });

            // Fallback gallery images
            $('img').each((_, el) => {
                const src = $(el).attr('src') || $(el).attr('data-src');
                if (src && (src.includes('product') || src.includes('item') || src.includes('goods')) && !src.includes('icon') && !src.includes('logo')) {
                    const fullUrl = src.startsWith('http') ? src : new URL(src, trimmed).href;
                    if (!images.includes(fullUrl)) images.push(fullUrl);
                }
            });

            // 4. Price Detection & Conversion
            if (!parsedPrice) {
                const metaPrice = $('meta[property="product:price:amount"]').attr('content');
                if (metaPrice) parsedPrice = parseFloat(metaPrice);
            }
            if (!parsedPrice) {
                // Search regex for Japanese Yen: e.g., 14,300円 or ¥14,300
                const pageText = $('body').text();
                const match = pageText.match(/(?:¥|￥|税込|価格)?\s*([0-9]{1,3}(?:,[0-9]{3})+)\s*(?:円|JPY)?/);
                if (match) {
                    parsedPrice = parseFloat(match[1].replace(/,/g, ''));
                }
            }

            // Calculation formula: Yen to KGS + Air Cargo + Proxy Service Fee
            // Default rate: 1 JPY = 0.58 KGS. Air Cargo = 1200 KGS. Proxy Fee = 800 KGS.
            let kgsPrice = 8500; // default fallback
            let originalPriceStr = "Не указана";
            if (parsedPrice) {
                originalPriceStr = `${parsedPrice.toLocaleString()} ¥`;
                kgsPrice = Math.round(parsedPrice * 0.58 + 1200 + 800);
            }

            // Deduplicate images
            const uniqueImages = [...new Set(images)].filter(url => url && url.startsWith('http')).slice(0, 8);

            return res.json({
                success: true,
                type: 'url_scrape',
                title: title || 'Товар из Японии',
                description: description || 'Оригинальный товар с официального японского магазина.',
                originalPrice: originalPriceStr,
                price: kgsPrice,
                images: uniqueImages.length > 0 ? uniqueImages : ['https://pngimg.com/uploads/sneaker/sneaker_PNG2.png'],
                brand: title.split(' ')[0] || 'Sneakers',
                sizes: ['39', '40', '41', '42', '43', '44', '45']
            });
        } catch (err) {
            console.error("[Parser Error]", err.message);
            return res.status(500).json({ error: `Не удалось распарсить ссылку: ${err.message}` });
        }
    } else {
        // Query by Name / SKU via Sneaks API
        console.log(`[Parser] Searching Sneaks API for: ${trimmed}`);
        sneaks.getProducts(trimmed, 5, (error, products) => {
            if (error || !products || products.length === 0) {
                return res.status(404).json({ error: "Кроссовки не найдены в базе данных. Попробуйте уточнить название или вставить прямую ссылку." });
            }

            const p = products[0];
            const images = [];
            if (p.thumbnail) images.push(p.thumbnail);
            if (p.image && p.image['360']) {
                images.push(...p.image['360'].slice(0, 6));
            }

            // Convert USD retail to KGS + delivery
            const retailUSD = p.retailPrice || 120;
            const kgsPrice = Math.round(retailUSD * 87.5 + 1200 + 800);

            return res.json({
                success: true,
                type: 'sneaks_api',
                title: p.shoeName,
                description: p.description || `${p.brand} ${p.shoeName} (StyleID: ${p.styleID})`,
                originalPrice: `$${retailUSD}`,
                price: kgsPrice,
                images: images,
                brand: p.brand || 'Nike',
                styleID: p.styleID,
                sizes: ['40', '41', '42', '43', '44', '45']
            });
        });
    }
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
        const now = FieldValue.serverTimestamp();
        const orderRef = await db.collection('orders').add({
            // Schema for Flutter Admin (proxy_buyer_app):
            user_id: String(user_id || 'guest'),
            user_name: name || 'Клиент',
            user_phone: phone || '',
            product_id: product.styleID || 'custom_id',
            product_title: product.shoeName || 'Кроссовки',
            product_price: parseFloat(price) || 0,
            product_image_url: product.thumbnail || (product.image && product.image['360'] && product.image['360'][0]) || '',
            specification: {
                size: size || '',
                color: color || ''
            },
            receipt_image_url: receiptUrl,
            status: 'VERIFYING_PAYMENT',
            created_at: now,
            updated_at: now,

            // Legacy schema:
            userId: user_id,
            name: name,
            phone: phone,
            productId: product.styleID,
            productName: product.shoeName,
            color: color,
            size: size,
            price: price,
            receiptUrl: receiptUrl
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
