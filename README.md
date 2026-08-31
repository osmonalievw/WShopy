# Sneaker Concierge (WShopy) 👟

A modern, mobile-first Telegram Mini App (TMA) for seamless proxy-buying of sneakers from Japan. Built as an MVP to validate the business model of delivering authenticated sneakers with a transparent, all-inclusive pricing system.

## 🌟 Features
- **Telegram Native Integration:** Built specifically for the Telegram WebApp ecosystem. Zero-friction onboarding — users don't need to register or leave the messenger.
- **Premium UX/UI:** Dark mode aesthetic with floating neon elements, dynamic image carousels, and visual color variant selectors (Color Swatches).
- **All-inclusive Pricing Calculator:** Automatically calculates final localized prices (KGS) including currency conversion, Tokyo-to-Bishkek air shipping, and service margin.
- **Instant Admin Notifications:** Orders placed in the WebApp are instantly forwarded to the admin via the Telegram Bot API.

## 🛠 Tech Stack
- **Frontend:** Vanilla HTML, CSS3, Vanilla JavaScript (Zero heavy frameworks for maximum performance).
- **Backend:** Node.js, Express.js.
- **Bot Integration:** `telegraf`, `telegram-web-app.js`.

## 🚀 How to Run Locally

1. Install dependencies: `npm install`
2. Create `.env` file with `TGBOT_API_KEY=your_token`
3. Start server: `npm start`
