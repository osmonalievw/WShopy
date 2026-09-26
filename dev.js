require('dotenv').config();
const ngrok = require('ngrok');
const nodemon = require('nodemon');

(async function() {
    try {
        const port = process.env.PORT || 3000;
        console.log("=========================================");
        console.log(`🚀 Starting local development server...`);
        console.log(`📡 Opening secure Ngrok tunnel on port ${port}...`);
        
        // Start ngrok tunnel
        const url = await ngrok.connect(port);
        console.log(`✅ Tunnel is live! Temporary WebApp URL: ${url}`);
        console.log("=========================================");
        console.log(`🤖 Now starting your Telegram Bot...`);

        // Start nodemon with the dynamic URL injected into the environment
        nodemon({
            script: 'index.js',
            ext: 'js html css',
            watch: ['index.js', 'public/'],
            env: {
                'WEBAPP_URL': url
            }
        });

        nodemon.on('start', function () {
            console.log('🔄 Server is up. You can now open the WebApp in Telegram!');
        }).on('quit', function () {
            console.log('🛑 Server stopped.');
            process.exit();
        }).on('restart', function (files) {
            console.log('⚡ File changed! Server auto-restarted.');
        });
    } catch (err) {
        console.error("❌ Error starting dev environment:", err);
        console.log("\nIf ngrok asks for an auth token, run: npx ngrok config add-authtoken <YOUR_TOKEN>");
        process.exit(1);
    }
})();
