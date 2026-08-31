const tg = window.Telegram.WebApp;
tg.expand();

try {
    if (tg.requestFullscreen) { tg.requestFullscreen(); }
    tg.setHeaderColor('#0d0d0d');
    tg.setBackgroundColor('#0d0d0d');
    if (tg.setBottomBarColor) { tg.setBottomBarColor('#0d0d0d'); }
} catch(e) {}

let currentProduct = null;
let selectedSize = null;
let currentColorVariant = null;

function calculateKGS(retailPriceUSD) {
    const usdToJpy = 150; const jpyToKgs = 0.57; const shipping = 1600; const margin = 2000;
    const priceUSD = retailPriceUSD || 120;
    const priceJPY = priceUSD * usdToJpy;
    return Math.round(priceJPY * jpyToKgs + shipping + margin);
}

function formatPrice(price) { return price.toLocaleString('en-US'); }

async function loadSneakers() {
    try {
        const response = await fetch('/api/sneakers?q=asics&limit=6');
        const products = await response.json();
        
        const grid = document.getElementById('catalog-grid');
        grid.innerHTML = '';
        
        if (products && products.length > 0) {
            const hero = products[0];
            document.getElementById('hero-img').src = hero.thumbnail;
            document.getElementById('hero-title').innerText = hero.shoeName;
            
            const heroPrice = calculateKGS(hero.retailPrice);
            document.getElementById('hero-price').innerText = `~${formatPrice(heroPrice)} KGS`;
            
            document.getElementById('hero-buy-btn').onclick = () => openModal(hero, heroPrice);
            
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
        document.getElementById('catalog-grid').innerHTML = '<p style="text-align:center; width:100%;">Ошибка загрузки каталога</p>';
    }
}

const appDiv = document.getElementById('app');
const productPage = document.getElementById('product-page');
const backBtn = document.getElementById('back-to-catalog');
const confirmBtn = document.getElementById('confirm-order-btn');
const checkoutModal = document.getElementById('checkout-modal');
const closeCheckoutBtn = document.getElementById('close-checkout');
const payConfirmBtn = document.getElementById('pay-confirm-btn');

function renderImages(images) {
    const slider = document.getElementById('image-slider');
    const dotsContainer = document.getElementById('slider-dots');
    slider.innerHTML = ''; dotsContainer.innerHTML = '';
    
    images.forEach((imgUrl, index) => {
        const img = document.createElement('img');
        img.src = imgUrl; img.className = 'pp-sneaker';
        slider.appendChild(img);
        
        const dot = document.createElement('div');
        dot.className = `dot ${index === 0 ? 'active' : ''}`;
        dotsContainer.appendChild(dot);
    });
    
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
    
    const swatches = document.querySelectorAll('.swatch-card');
    swatches.forEach(swatch => {
        if (swatch.dataset.hex === colorVariant.hex) swatch.classList.add('active');
        else swatch.classList.remove('active');
    });
}

function openModal(product, price) {
    currentProduct = product;
    selectedSize = null;
    document.getElementById('selected-size-name').innerText = "Не выбран";
    
    document.getElementById('pp-title').innerText = product.shoeName;
    document.getElementById('pp-brand').innerText = product.brand;
    document.getElementById('pp-price').innerText = formatPrice(price) + " KGS";
    document.getElementById('checkout-price').innerText = formatPrice(price) + " KGS";
    
    const swatchesContainer = document.getElementById('color-swatches');
    swatchesContainer.innerHTML = '';
    
    if (product.colors && product.colors.length > 0) {
        product.colors.forEach((color) => {
            const swatch = document.createElement('div');
            swatch.className = 'swatch-card';
            swatch.dataset.hex = color.hex;
            swatch.onclick = () => selectColor(color);
            swatch.innerHTML = `
                <img src="${color.images[0]}" alt="${color.name}">
                <span>${color.name}</span>
            `;
            swatchesContainer.appendChild(swatch);
        });
        selectColor(product.colors[0]);
    } else {
        document.getElementById('selected-color-name').innerText = "Стандартный";
        renderImages([product.thumbnail]);
    }
    
    const sizeGrid = document.getElementById('size-grid');
    const sizePills = sizeGrid.querySelectorAll('.size-pill');
    sizePills.forEach(box => {
        box.classList.remove('active');
        box.onclick = function() {
            sizePills.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedSize = this.innerText;
            document.getElementById('selected-size-name').innerText = selectedSize;
        }
    });
    
    appDiv.style.display = 'none';
    productPage.style.display = 'block';
    window.scrollTo(0,0);
}

backBtn.onclick = () => { productPage.style.display = 'none'; appDiv.style.display = 'block'; };

confirmBtn.onclick = () => {
    if (!selectedSize) { tg.showAlert("Пожалуйста, выберите размер (EU)!"); return; }
    checkoutModal.style.display = 'flex';
};

closeCheckoutBtn.onclick = () => { checkoutModal.style.display = 'none'; };

let receiptBase64 = null;
const receiptInput = document.getElementById('receipt-upload');
const fileNameDisplay = document.getElementById('file-name-display');

receiptInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        fileNameDisplay.innerText = "Файл: " + file.name;
        const reader = new FileReader();
        reader.onload = (event) => {
            receiptBase64 = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

payConfirmBtn.onclick = async () => {
    const name = document.getElementById('buyer-name').value;
    const phone = document.getElementById('buyer-phone').value;
    
    if (!name || !phone) { tg.showAlert("Заполните Имя и Номер телефона!"); return; }
    if (!receiptBase64) { tg.showAlert("Пожалуйста, прикрепите скриншот чека об оплате!"); return; }
    
    payConfirmBtn.innerText = "Отправка...";
    payConfirmBtn.disabled = true;
    
    const orderData = {
        user_id: tg.initDataUnsafe?.user?.id || 123456789,
        product: currentProduct,
        color: currentColorVariant ? currentColorVariant.name : 'Стандартный',
        price: document.getElementById('pp-price').innerText,
        size: selectedSize,
        name: name,
        phone: phone,
        receiptBase64: receiptBase64
    };
    
    try {
        const res = await fetch('/api/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });
        if (res.ok) {
            tg.showAlert("✅ Спасибо! Ваша заявка принята и чек загружен. Ожидайте подтверждения в течение часа.");
            checkoutModal.style.display = 'none';
            productPage.style.display = 'none';
            appDiv.style.display = 'block';
            window.scrollTo(0,0);
        } else {
            let errorText = res.statusText;
            try {
                const errData = await res.json();
                errorText = errData.error || errorText;
            } catch (jsonErr) {
                errorText = await res.text();
            }
            tg.showAlert(`Ошибка сервера (${res.status}): ${errorText.substring(0, 100)}`);
        }
    } catch (e) {
        tg.showAlert("Сетевая ошибка: " + e.message);
    } finally {
        payConfirmBtn.innerText = "Я перевел(а) деньги";
        payConfirmBtn.disabled = false;
    }
};

loadSneakers();
