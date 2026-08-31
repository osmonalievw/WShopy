require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const SneaksAPI = require('sneaks-api');
const cors = require('cors');
const path = require('path');

const app = express();
const bot = new Telegraf(process.env.TGBOT_API_KEY);
const sneaks = new SneaksAPI();

const PORT = process.env.PORT || 3000;
const NGROK_URL = "https://hrs-grain-testimonials-circle.trycloudflare.com"; // Replace when testing locally

app.use(cors());
app.use(express.json());
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

app.post('/api/order', (req, res) => {
    const { user_id, product, price, size, color } = req.body;
    
    // Notify Admin via Bot
    const msg = `🔥 **НОВЫЙ ЗАКАЗ** 🔥\n\nКлиент ID: ${user_id}\nМодель: ${product.shoeName}\nЦвет: ${color}\nРазмер: ${size} (EU)\nЦена: ${price}\n\nSKU: ${product.styleID}`;
    
    // Send to Admin (hardcoded for MVP, in future save to DB)
    // Assuming the bot owner is the admin. You can get owner ID dynamically or set in .env
    // bot.telegram.sendMessage(process.env.ADMIN_ID, msg, { parse_mode: 'Markdown' });
    
    console.log("Order received:", msg);
    res.json({ success: true, message: "Order placed" });
});

// Telegram Bot Logic
bot.start((ctx) => {
    ctx.reply(
        "👋 Добро пожаловать в Sneaker Concierge!\nСамые эксклюзивные кроссовки из Японии с доставкой в Кыргызстан.",
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🚀 Открыть Каталог", web_app: { url: NGROK_URL } }]
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
