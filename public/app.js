const tg = window.Telegram.WebApp;
tg.expand(); // Fullscreen mode

let currentProduct = null;
let selectedSize = null;

// Fake Pricing Logic for MVP
function calculateKGS(retailPriceUSD) {
    const usdToJpy = 150;
    const jpyToKgs = 0.57; // Example rate
    const shipping = 1600;
    const margin = 2000;
    
    // If retail is null, base it on something standard
    const priceUSD = retailPriceUSD || 120;
    const priceJPY = priceUSD * usdToJpy;
    const priceKGS = Math.round(priceJPY * jpyToKgs + shipping + margin);
    
    return priceKGS;
}

function formatPrice(price) {
    return price.toLocaleString('en-US');
}

async function loadSneakers() {
    try {
        const response = await fetch('/api/sneakers?q=asics&limit=6');
        const products = await response.json();
        
        const grid = document.getElementById('catalog-grid');
        grid.innerHTML = '';
        
        if (products && products.length > 0) {
            // Set Hero to the first product
            const hero = products[0];
            document.getElementById('hero-img').src = hero.thumbnail;
            document.getElementById('hero-title').innerText = hero.shoeName;
            document.querySelector('.bg-text').innerText = hero.brand.toUpperCase();
            
            const heroPrice = calculateKGS(hero.retailPrice);
            document.getElementById('hero-price').innerText = `~${formatPrice(heroPrice)} KGS`;
            
            document.getElementById('hero-buy-btn').onclick = () => openModal(hero, heroPrice);
            
            // Populate grid with the rest
            products.slice(1).forEach(p => {
                const price = calculateKGS(p.retailPrice);
                
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <img src="${p.thumbnail}" alt="${p.shoeName}">
                    <div class="brand">${p.brand}</div>
                    <div class="name">${p.shoeName}</div>
                    <div class="price">~${formatPrice(price)} KGS</div>
                    <button class="card-btn" onclick='openModal(${JSON.stringify(p)}, ${price})'>Выбрать</button>
                `;
                grid.appendChild(card);
            });
        }
    } catch (e) {
        console.error(e);
        document.getElementById('catalog-grid').innerHTML = '<p style="text-align:center; width:100%;">Ошибка загрузки каталога</p>';
    }
}

// Navigation & Product Page Logic
const appDiv = document.getElementById('app');
const productPage = document.getElementById('product-page');
const backBtn = document.getElementById('back-to-catalog');
const sizeBoxes = document.querySelectorAll('.size-box');
const confirmBtn = document.getElementById('confirm-order-btn');

let currentColorVariant = null;

function renderImages(images) {
    const slider = document.getElementById('image-slider');
    const dotsContainer = document.getElementById('slider-dots');
    slider.innerHTML = '';
    dotsContainer.innerHTML = '';
    
    images.forEach((imgUrl, index) => {
        // Image
        const img = document.createElement('img');
        img.src = imgUrl;
        img.className = 'pp-sneaker';
        slider.appendChild(img);
        
        // Dot
        const dot = document.createElement('div');
        dot.className = `dot ${index === 0 ? 'active' : ''}`;
        dotsContainer.appendChild(dot);
    });
    
    // Simple scroll listener to update dots
    slider.addEventListener('scroll', () => {
        const scrollPosition = slider.scrollLeft;
        const slideWidth = slider.clientWidth;
        const activeIndex = Math.round(scrollPosition / slideWidth);
        
        const dots = dotsContainer.querySelectorAll('.dot');
        dots.forEach((d, i) => {
            if (i === activeIndex) d.classList.add('active');
            else d.classList.remove('active');
        });
    });
}

function selectColor(colorVariant) {
    currentColorVariant = colorVariant;
    document.getElementById('selected-color-name').innerText = colorVariant.name;
    renderImages(colorVariant.images);
    
    // Update swatches visually
    const swatches = document.querySelectorAll('.swatch');
    swatches.forEach(swatch => {
        if (swatch.dataset.hex === colorVariant.hex) swatch.classList.add('active');
        else swatch.classList.remove('active');
    });
}

function openModal(product, price) {
    currentProduct = product;
    selectedSize = null;
    
    // Set Basic Details
    document.getElementById('pp-bg-text').innerText = product.brand.toUpperCase();
    document.getElementById('pp-title').innerText = product.shoeName;
    document.getElementById('pp-brand').innerText = product.brand;
    document.getElementById('pp-price').innerText = formatPrice(price) + " KGS";
    
    // Setup Colors if they exist
    const swatchesContainer = document.getElementById('color-swatches');
    swatchesContainer.innerHTML = '';
    
    if (product.colors && product.colors.length > 0) {
        product.colors.forEach((color, index) => {
            const swatch = document.createElement('div');
            swatch.className = 'swatch';
            swatch.style.backgroundColor = color.hex;
            swatch.dataset.hex = color.hex;
            swatch.onclick = () => selectColor(color);
            swatchesContainer.appendChild(swatch);
        });
        // Select first color by default
        selectColor(product.colors[0]);
    } else {
        // Fallback for MVP if no colors defined
        document.getElementById('selected-color-name').innerText = "Стандартный";
        renderImages([product.thumbnail]);
    }
    
    // Reset sizes
    sizeBoxes.forEach(b => b.classList.remove('active'));
    
    // Transition
    appDiv.style.display = 'none';
    productPage.style.display = 'block';
    
    // Scroll to top
    window.scrollTo(0,0);
}

backBtn.onclick = () => {
    productPage.style.display = 'none';
    appDiv.style.display = 'block';
};

sizeBoxes.forEach(box => {
    box.onclick = function() {
        sizeBoxes.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        selectedSize = this.innerText;
    }
});

confirmBtn.onclick = async () => {
    if (!selectedSize) {
        tg.showAlert("Пожалуйста, выберите размер (EU)!");
        return;
    }
    
    const orderData = {
        user_id: tg.initDataUnsafe?.user?.id || 123456789,
        product: currentProduct,
        color: currentColorVariant ? currentColorVariant.name : 'Стандартный',
        price: document.getElementById('pp-price').innerText,
        size: selectedSize
    };
    
    try {
        const res = await fetch('/api/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        
        if (res.ok) {
            tg.showAlert("✅ Заказ оформлен! Наш менеджер свяжется с вами для подтверждения.");
            productPage.style.display = 'none';
            appDiv.style.display = 'block';
            tg.close(); // Close WebApp
        }
    } catch (e) {
        tg.showAlert("Ошибка при отправке заказа.");
    }
};

// Start
loadSneakers();
