// ============================================================
// STATE
// ============================================================
const state = {
    step: 1,
    mode: 'upload',
    inventory: {},
    boxes: 0,
    volume: 0,
    km: 0,
    fromCoords: null,   // { lat, lon }
    toCoords: null,     // { lat, lon }
    fromAddress: '',    // "Straat 12, Stad"
    toAddress: '',      // "Straat 34, Stad"
    woonFromSurcharge: 0,
    woonToSurcharge: 0,
    hasMontage: false,
    montageHours: 0,
    montageItems: {},   // { item_id: count }
    aiDetectedItems: [], // [{ name, vol, icon, montage, qty, checked, needsMontage }]

    prices: {
        baseMoverRate: 32.50, // Per verhuizer per uur
        moversCount: 3,
        moverPerHour: 97.50, // 3 * 32.50
        truck: 150.00,
        perKm: 1.00,
        voorrijkosten: 135.00, // 3 * 45
        vroegboekKorting: 50.00,
        btwRate: 0.21,
        montageRate: 45.00 // Per uur voor de monteur
    }
};

// ============================================================
// CONFIGURATIE (ZET HIER JE SLEUTEL)
// ============================================================
// De API sleutel staat nu veilig in Vercel Environment Variables
const GEMINI_API_KEY = 'SECURE_ON_SERVER';



const itemsData = [
    { id: 'bank', name: 'Bank', vol: 1.5, icon: '🛋️', montage: 15 },
    { id: 'loveseat', name: 'Loveseat', vol: 0.9, icon: '🪑', montage: 10 },
    { id: 'bed_1p', name: 'Bed 1-pers.', vol: 1.2, icon: '🛏️', montage: 30 },
    { id: 'bed_2p', name: 'Bed 2-pers.', vol: 2.0, icon: '🛏️', montage: 45 },
    { id: 'matras', name: 'Matras', vol: 0.6, icon: '💤', montage: 0 },
    { id: 'eettafel', name: 'Eettafel', vol: 1.0, icon: '🍽️', montage: 20 },
    { id: 'salontafel', name: 'Salontafel', vol: 0.3, icon: '☕', montage: 10 },
    { id: 'kast_groot', name: 'Kledingkast', vol: 1.8, icon: '🗄️', montage: 60 },
    { id: 'kast_klein', name: 'Lage Kast', vol: 0.7, icon: '📦', montage: 20 },
    { id: 'boekenkast', name: 'Boekenkast', vol: 0.9, icon: '📚', montage: 30 },
    { id: 'wasmachine', name: 'Wasmachine', vol: 0.6, icon: '🧺', montage: 15 },
    { id: 'droger', name: 'Droger', vol: 0.6, icon: '🌡️', montage: 10 },
    { id: 'koelkast', name: 'Koelkast', vol: 0.8, icon: '❄️', montage: 0 },
    { id: 'vaatwasser', name: 'Vaatwasser', vol: 0.5, icon: '🍳', montage: 15 },
    { id: 'tv', name: 'TV', vol: 0.4, icon: '📺', montage: 10 },
    { id: 'bureau', name: 'Bureau', vol: 0.8, icon: '💻', montage: 25 },
    { id: 'piano', name: 'Piano', vol: 2.5, icon: '🎹', montage: 0 },
    { id: 'fiets', name: 'Fiets', vol: 1.0, icon: '🚲', montage: 10 },
];

// ============================================================
// SECURITY & DOMAIN LOCK
// ============================================================
const ALLOWED_DOMAINS = [
    'localhost',
    '127.0.0.1',
    'studentverhuisdienst.nl',
    'vercel.app',
    '' // Toestaan voor lokaal 'file://' gebruik
];

function checkSecurity() {
    const host = window.location.hostname;
    const isAllowed = ALLOWED_DOMAINS.some(d => host === d || host.endsWith('.' + d));

    if (!isAllowed) {
        document.body.innerHTML = `
            <div style="font-family:sans-serif; text-align:center; padding:50px; color:#1e293b;">
                <h1>⚠️ Ongeautoriseerd Gebruik</h1>
                <p>Deze calculator is intellectueel eigendom van Student Verhuis Dienst.</p>
                <p>Kopiëren van deze tool is niet toegestaan.</p>
            </div>
        `;
        throw new Error("Domain not authorized");
    }

    // Blokkeer rechtermuisknop om inspectie te bemoeilijken
    document.addEventListener('contextmenu', e => e.preventDefault());

    // Blokkeer F12 en Ctrl+Shift+I
    document.onkeydown = function (e) {
        if (e.keyCode == 123) return false;
        if (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) return false;
        if (e.ctrlKey && e.shiftKey && e.keyCode == 'C'.charCodeAt(0)) return false;
        if (e.ctrlKey && e.shiftKey && e.keyCode == 'J'.charCodeAt(0)) return false;
        if (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) return false;
    };
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    try {
        checkSecurity();
    } catch (e) { return; }

    initWizard();
    initInventory();
    initModes();
    initUpload();
    initPostcode();
    initWoonType();
    initMovers();
    updateInfoHighlight(1);
    calculate(true); // Initial calculation
});

// ============================================================
// WIZARD NAVIGATION
// ============================================================
function initWizard() {
    document.querySelectorAll('.next-step').forEach(btn => {
        btn.onclick = () => {
            if (state.step < 3) moveStep(state.step + 1);
        };
    });
    document.querySelectorAll('.prev-step').forEach(btn => {
        btn.onclick = () => {
            if (state.step > 1) moveStep(state.step - 1);
        };
    });
}

function moveStep(n) {
    if (n === 3) calculate();

    state.step = n;
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active', 'done'));

    document.getElementById(`step-${n}`).classList.add('active');
    document.querySelector(`.step[data-step="${n}"]`).classList.add('active');

    for (let i = 1; i < n; i++) {
        document.querySelector(`.step[data-step="${i}"]`).classList.add('done');
    }

    updateInfoHighlight(n);
    document.getElementById('calculator').scrollIntoView({ behavior: 'smooth', block: 'start' });
    lucide.createIcons();
}

function updateInfoHighlight(n) {
    document.querySelectorAll('.info-step').forEach((el, i) => {
        el.classList.toggle('active', i + 1 === n);
    });
}

// ============================================================
// POSTCODE LOOKUP — PDOK Locatieserver (officiële NL overheids-API, BAG)
// Gratis, geen API-sleutel, exacte NL adressen
// ============================================================
function initPostcode() {
    setupPostcodeLookup('from');
    setupPostcodeLookup('to');

    const manualKm = document.getElementById('manual-km');
    if (manualKm) {
        manualKm.addEventListener('input', () => {
            calculate(true);
        });
    }
}

function setupPostcodeLookup(dir) {
    const pcInput = document.getElementById(`${dir}-postcode`);
    const hnInput = document.getElementById(`${dir}-huisnr`);
    const straatEl = document.getElementById(`${dir}-straat`);
    const stadEl = document.getElementById(`${dir}-stad`);
    const statusEl = document.getElementById(`${dir}-status`);

    let lookupTimer = null;

    function triggerLookup() {
        clearTimeout(lookupTimer);
        lookupTimer = setTimeout(() => doLookup(), 700);
    }

    async function doLookup() {
        const pc = pcInput.value.replace(/\s/g, '').toUpperCase();
        const hn = hnInput.value.trim();

        if (!/^\d{4}[A-Z]{2}$/.test(pc)) {
            straatEl.value = '';
            stadEl.value = '';
            statusEl.textContent = '';
            statusEl.className = 'postcode-status';
            updateCoords(dir, null);
            return;
        }

        setStatus(statusEl, 'loading', '🔍 Adres opzoeken…');

        try {
            // PRIMARY: PDOK (Best for NL, but strict CORS)
            const q = hn ? `${pc} ${hn}` : pc;
            const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?fq=type:adres&q=${encodeURIComponent(q)}&fl=id,weergavenaam,straatnaam,woonplaatsnaam,postcode,centroide_ll&rows=1`;

            let resp = null;
            try { resp = await fetch(url); } catch (e) { /* silent fail to fallback */ }

            if (resp && resp.ok) {
                const data = await resp.json();
                const docs = data?.response?.docs;
                if (docs && docs.length > 0) {
                    const doc = docs[0];
                    straatEl.value = (doc.straatnaam || '') + (hn ? ' ' + hn : '');
                    stadEl.value = doc.woonplaatsnaam || '';
                    setStatus(statusEl, 'ok', `✅ Adres gevonden`);

                    const coords = parsePDOKPoint(doc.centroide_ll);
                    if (coords) {
                        updateCoords(dir, coords);
                        try { await maybeCalculateDistance(); } catch (e) { console.warn('Distance fail', e); }
                    }
                    return;
                }
            }

            // SECONDARY: OpenDataSoft
            const fallbackUrl = `https://postcode.opendatasoft.com/api/records/1.0/search/?dataset=gin-postcode-nederland&q=${pc}`;
            let fResp = null;
            try { fResp = await fetch(fallbackUrl); } catch (e) { }

            if (fResp && fResp.ok) {
                const fData = await fResp.json();
                if (fData.records && fData.records.length > 0) {
                    const rec = fData.records[0].fields;
                    straatEl.value = (rec.streetname || '') + (hn ? ' ' + hn : '');
                    stadEl.value = rec.cityname || '';
                    setStatus(statusEl, 'ok', `✅ Adres gevonden`);
                    const coords = { lat: fData.records[0].geometry.coordinates[1], lon: fData.records[0].geometry.coordinates[0] };
                    updateCoords(dir, coords);
                    try { await maybeCalculateDistance(); } catch (e) { }
                    return;
                }
            }

            // TERTIARY: Zippopotam.us (Very lenient CORS)
            const zipUrl = `https://api.zippopotam.us/nl/${pc.substring(0, 4)}`;
            let zResp = null;
            try { zResp = await fetch(zipUrl); } catch (e) { }
            if (zResp && zResp.ok) {
                const zData = await zResp.json();
                const place = zData.places[0];
                stadEl.value = place['place name'];
                setStatus(statusEl, 'ok', `⚠️ Alleen stad gevonden. Vul straat zelf in.`);
                straatEl.readOnly = false;
                stadEl.readOnly = false;
                updateCoords(dir, { lat: parseFloat(place.latitude), lon: parseFloat(place.longitude) });
                return;
            }

            throw new Error('ALL_FALLBACKS_FAILED');
        } catch (e) {
            console.warn('Lookup warning:', e);
            setStatus(statusEl, 'error', '❌ Verbinding geblokkeerd door browser. Vul straat/stad zelf in.');
            straatEl.readOnly = false;
            stadEl.readOnly = false;
            updateCoords(dir, null);
        }
    }

    pcInput.addEventListener('input', () => {
        pcInput.value = pcInput.value.replace(/\s/g, '').toUpperCase();
        triggerLookup();
    });
    hnInput.addEventListener('input', triggerLookup);
    hnInput.addEventListener('change', triggerLookup);
}

// Parse "POINT(lon lat)" string → { lat, lon }
function parsePDOKPoint(wkt) {
    if (!wkt) return null;
    const m = wkt.match(/POINT\(([0-9.]+)\s+([0-9.]+)\)/);
    if (!m) return null;
    return { lon: parseFloat(m[1]), lat: parseFloat(m[2]) };
}

function setStatus(el, type, msg) {
    el.textContent = msg;
    el.className = `postcode-status ${type}`;
}

function updateCoords(dir, coords) {
    if (dir === 'from') state.fromCoords = coords;
    else state.toCoords = coords;
    // Always trigger calc when coords update
    calculate(true);
}

async function geocodeForCoords(dir, query) {
    try {
        const resp = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
            { headers: { 'User-Agent': 'StudentVerhuisDienst/1.0' } }
        );
        const data = await resp.json();
        if (data && data[0]) {
            updateCoords(dir, { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
            maybeCalculateDistance();
        }
    } catch (e) { /* ignore */ }
}

// ============================================================
// DISTANCE — OSRM (routing engine, gratis, geen API key)
// ============================================================
async function maybeCalculateDistance() {
    if (!state.fromCoords || !state.toCoords) return;

    const loadEl = document.getElementById('distance-loading');
    const valEl = document.getElementById('distance-val');
    const resEl = document.getElementById('distance-result');

    if (loadEl) loadEl.style.display = 'inline';

    try {
        const { lat: lat1, lon: lon1 } = state.fromCoords;
        const { lat: lat2, lon: lon2 } = state.toCoords;

        const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
        const resp = await fetch(url);
        const data = await resp.json();

        if (data.code === 'Ok' && data.routes && data.routes[0]) {
            const meters = data.routes[0].distance;
            const km = Math.round(meters / 1000);
            state.km = km;
            if (valEl) valEl.textContent = `${km} km`;
            if (resEl) resEl.classList.add('has-value');
        }
    } catch (e) {
        // Silently fallback — user can still proceed
        console.warn('OSRM distance calculation failed:', e);
    } finally {
        if (loadEl) loadEl.style.display = 'none';
    }
}

// ============================================================
// WOONTYPE
// ============================================================
function initWoonType() {
    setupWoonGrid('woon-from-grid', 'from');
    setupWoonGrid('woon-to-grid', 'to');
}

function setupWoonGrid(gridId, direction) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.querySelectorAll('.woon-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            grid.querySelectorAll('.woon-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const surcharge = parseFloat(btn.dataset.surcharge);
            if (direction === 'from') state.woonFromSurcharge = surcharge;
            else state.woonToSurcharge = surcharge;
            calculate(true);
        });
    });
}

function initMovers() {
    const container = document.getElementById('mover-selector');
    if (!container) return;
    container.querySelectorAll('.mover-btn').forEach(btn => {
        btn.onclick = () => {
            container.querySelectorAll('.mover-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const count = parseInt(btn.dataset.count);
            state.prices.moversCount = count;
            state.prices.moverPerHour = count * state.prices.baseMoverRate;
            state.prices.voorrijkosten = count * 45.00; // Updated rule: per mover

            document.getElementById('mover-rate-display').innerText = `€${state.prices.moverPerHour.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`;
            calculate(true);
        };
    });
}

// ============================================================
// MODES (upload / manual)
// ============================================================
function initModes() {
    const btnUpload = document.getElementById('btn-upload');
    const btnManual = document.getElementById('btn-manual');
    const secUpload = document.getElementById('section-upload');
    const secManual = document.getElementById('section-manual');

    btnUpload.onclick = () => {
        state.mode = 'upload';
        btnUpload.classList.add('active');
        btnManual.classList.remove('active');
        secUpload.style.display = 'block';
        secManual.style.display = 'none';
        calculate(true);
    };

    btnManual.onclick = () => {
        state.mode = 'manual';
        btnManual.classList.add('active');
        btnUpload.classList.remove('active');
        secManual.style.display = 'block';
        secUpload.style.display = 'none';
        calculate(true);
    };
}

// ============================================================
// INVENTORY GRID (manual)
// ============================================================
function initInventory() {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;

    itemsData.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.id = `item-${item.id}`;
        div.innerHTML = `
            <span class="item-emoji">${item.icon}</span>
            <span class="item-name">${item.name}</span>
            <span class="item-vol">${item.vol} m³</span>
            <div class="item-counter">
                <button class="ic-btn" onclick="changeItem('${item.id}', -1)">−</button>
                <span class="ic-count" id="cnt-${item.id}">0</span>
                <button class="ic-btn" onclick="changeItem('${item.id}', 1)">+</button>
            </div>
        `;
        grid.appendChild(div);
    });
}

window.changeItem = function (id, delta) {
    const current = state.inventory[id] || 0;
    const next = Math.max(0, current + delta);
    state.inventory[id] = next;

    const countEl = document.getElementById(`cnt-${id}`);
    const cardEl = document.getElementById(`item-${id}`);
    if (countEl) countEl.innerText = next;
    if (cardEl) cardEl.classList.toggle('selected', next > 0);

    // Sync montage list: if item added, default its montage count to 1 if it's the first time
    if (delta > 0 && state.hasMontage && (state.montageItems[id] || 0) < state.inventory[id]) {
        state.montageItems[id] = (state.montageItems[id] || 0) + 1;
    }

    if (state.hasMontage) updateMontageList();
    calculate(true);
};

window.updateBoxes = function (val) {
    state.boxes = Math.max(0, state.boxes + val);
    const el = document.getElementById('box-count');
    if (el) el.innerText = state.boxes;
    calculate(true);
};

// ============================================================
// MONTAGE LOGIC
// ============================================================
window.toggleMontage = function () {
    state.hasMontage = document.getElementById('montage-toggle').checked;
    const details = document.getElementById('montage-details');
    details.style.display = state.hasMontage ? 'block' : 'none';
    if (state.hasMontage) updateMontageList();
    calculate(true);
};

window.updateMontageList = function () {
    const list = document.getElementById('montage-items-list');
    if (!list) return;
    list.innerHTML = '';

    // Filter items from inventory that can be mounted
    itemsData.filter(item => (state.inventory[item.id] > 0 || state.mode === 'upload') && item.montage > 0).forEach(item => {
        const count = state.montageItems[item.id] || 0;
        const div = document.createElement('div');
        div.className = 'montage-item-row';
        div.innerHTML = `
            <span>${item.icon} ${item.name}</span>
            <div class="montage-item-controls">
                <button class="m-btn" onclick="changeMontageItem('${item.id}', -1)">−</button>
                <span class="m-count">${count}</span>
                <button class="m-btn" onclick="changeMontageItem('${item.id}', 1)">+</button>
            </div>
        `;
        list.appendChild(div);
    });
    updateMontageTime();
    lucide.createIcons();
};

window.changeMontageItem = function (id, delta) {
    const current = state.montageItems[id] || 0;
    const invCount = state.inventory[id] || (state.mode === 'upload' ? 99 : 0);
    const next = Math.max(0, Math.min(invCount, current + delta));
    state.montageItems[id] = next;
    updateMontageList();
    calculate(true);
};

function updateMontageTime() {
    let totalMinutes = 0;
    Object.keys(state.montageItems).forEach(id => {
        const item = itemsData.find(i => i.id === id);
        if (item) totalMinutes += (state.montageItems[id] * item.montage);
    });
    // Disassembly + Assembly means double time
    const totalHours = (totalMinutes * 2) / 60;
    state.montageHours = Math.ceil(totalHours * 10) / 10; // Round to 0.1
    document.getElementById('montage-hours-val').innerText = `${state.montageHours} uur`;
}

// ============================================================
// PHOTO UPLOAD
// ============================================================
function initUpload() {
    const dropzone = document.getElementById('upload-dropzone');
    const input = document.getElementById('file-input');
    if (!dropzone || !input) return;

    dropzone.addEventListener('click', () => input.click());

    dropzone.addEventListener('dragover', e => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    input.addEventListener('change', e => handleFiles(e.target.files));

    // Reset button (Full clear)
    const btnReset = document.getElementById('btn-reset-upload');
    if (btnReset) btnReset.onclick = (e) => {
        e.stopPropagation();
        state.aiDetectedItems = [];
        const strip = document.getElementById('thumbnail-strip');
        if (strip) strip.innerHTML = '';
        document.getElementById('ai-results-panel').style.display = 'none';
        document.getElementById('upload-idle').style.display = 'flex';
        document.getElementById('upload-done').style.display = 'none';
        state.volume = 0;
        calculate(true);
    };

    // Add More button (Keep existing, add new)
    const btnAddMore = document.getElementById('btn-add-more');
    if (btnAddMore) btnAddMore.onclick = (e) => {
        e.stopPropagation();
        input.click();
    };
}

// Helper om afbeeldingen te verkleinen voor upload (Vercel heeft een 4.5MB limiet)
async function resizeImageForAI(file, maxDim = 1200) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxDim) {
                        height *= maxDim / width;
                        width = maxDim;
                    }
                } else {
                    if (height > maxDim) {
                        width *= maxDim / height;
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // Compress naar JPEG om data te besparen
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                const base64 = dataUrl.split(',')[1];
                resolve({ base64, mimeType: 'image/jpeg', dataUrl });
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function handleFiles(files) {
    if (!files || files.length === 0) return;

    const strip = document.getElementById('thumbnail-strip');
    const imageDataPromises = [];

    document.getElementById('upload-idle').style.display = 'none';
    document.getElementById('upload-scanning').style.display = 'flex';
    document.getElementById('upload-done').style.display = 'none';

    if (state.aiDetectedItems.length === 0) {
        document.getElementById('ai-results-panel').style.display = 'none';
    }

    const scanText = document.getElementById('scan-status-text');
    if (scanText) {
        scanText.textContent = state.aiDetectedItems.length > 0 ? "Extra foto's voorbereiden..." : "Foto's voorbereiden...";
    }

    // Verwerk en toon thumbnails direct
    for (const file of Array.from(files)) {
        const resizePromise = resizeImageForAI(file).then(res => {
            const img = document.createElement('img');
            img.src = res.dataUrl;
            img.className = 'thumb';
            img.title = file.name;
            strip.appendChild(img);
            return { base64: res.base64, mimeType: res.mimeType };
        }).catch(err => {
            console.error("Resize error:", err);
            return null;
        });
        imageDataPromises.push(resizePromise);
    }

    const input = document.getElementById('file-input');
    if (input) input.value = '';

    let progress = 0;
    const fill = document.getElementById('scan-fill');
    const progressInterval = setInterval(() => {
        const increment = progress < 85 ? (Math.random() * 10 + 2) : (Math.random() * 1);
        progress = Math.min(98, progress + increment);
        if (fill) fill.style.width = `${progress}%`;
    }, 250);

    try {
        const images = (await Promise.all(imageDataPromises)).filter(img => img !== null);

        if (scanText) scanText.textContent = "AI Analyseert items...";

        const result = await analyzeImagesWithGemini(images);

        clearInterval(progressInterval);
        if (fill) fill.style.width = '100%';

        if (result && result.error) {
            // API gaf een fout terug
            let errorMsg = result.error;
            if (result.suggestion) errorMsg += `<br><small style="color:#64748b">${result.suggestion}</small>`;

            clearInterval(progressInterval);
            if (fill) fill.style.width = '100%';

            const resultText = document.getElementById('upload-result-text');
            if (resultText) {
                resultText.innerHTML = `<small style="color:#ef4444">${result.error}</small>`;
            }

            setTimeout(() => finishScanSmart(images.length, errorMsg), 400);
        } else if (Array.isArray(result) && result.length > 0) {
            setTimeout(() => finishScanWithAI(images.length, result), 300);
        } else {
            setTimeout(() => finishScanSmart(images.length, "Geen duidelijke items herkend. Probeer een andere hoek."), 400);
        }
    } catch (err) {
        console.error('AI Error:', err);
        clearInterval(progressInterval);
        if (fill) fill.style.width = '100%';

        let errorMsg = err.message;
        const resultText = document.getElementById('upload-result-text');
        if (resultText) resultText.innerHTML = `<small style="color:#ef4444">Fout: ${errorMsg}</small>`;
        setTimeout(() => finishScanSmart(files.length, `Fout: ${errorMsg}`), 1500);
    }
}

async function analyzeImagesWithGemini(images) {
    // Stuur maximaal de laatste 5 foto's om binnen Vercel limieten te blijven (4.5MB totaal)
    const limitedImages = images.slice(-5);

    const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: limitedImages })
    });

    if (response.ok) {
        return await response.json();
    } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const err = await response.json();
            throw new Error(err.error || `Server fout (${response.status})`);
        } else {
            const text = await response.text();
            throw new Error(`Server reageert niet goed (${response.status})`);
        }
    }
}

function finishScanWithAI(fileCount, detectedItems) {
    const newItems = detectedItems.map(item => ({
        ...item,
        checked: true,
        needsDemontage: !!item.montageRequired, // We nemen aan dat als het montage nodig heeft, het ook demontage nodig heeft
        needsMontage: !!item.montageRequired
    }));

    // Voeg toe aan bestaande lijst
    state.aiDetectedItems = [...state.aiDetectedItems, ...newItems];

    renderAiItemsList();
    recalcAiVolume();

    document.getElementById('upload-scanning').style.display = 'none';
    document.getElementById('upload-done').style.display = 'flex';
    document.getElementById('upload-result-text').innerHTML =
        `<strong>🤖 AI vond ${newItems.length} nieuwe items</strong><br><small style="color:#10b981">Totaal nu ${state.aiDetectedItems.length} items in de lijst.</small>`;

    lucide.createIcons();
}

function finishScanSmart(fileCount, reason = "") {
    // Geen items gevonden, we voegen handmatig een placeholder toe maar waarschuwen de gebruiker
    const baseItems = [
        { name: 'Onbekend item (contoleren)', vol: 1.0, icon: '❓', montageRequired: false, montageMinutes: 0, qty: 1 }
    ];

    state.aiDetectedItems = [...state.aiDetectedItems, ...baseItems.map(item => ({
        ...item,
        checked: true,
        needsDemontage: false,
        needsMontage: false
    }))];

    renderAiItemsList();
    recalcAiVolume();

    document.getElementById('upload-scanning').style.display = 'none';
    document.getElementById('upload-done').style.display = 'flex';

    const resultText = document.getElementById('upload-result-text');
    if (resultText) {
        resultText.innerHTML = `<strong>⚠️ AI twijfelt over items</strong><br><small style="color:#f59e0b">${reason || "Controleer en voeg items handmatig toe."}</small>`;
    }

    lucide.createIcons();
}

// ============================================================
// AI ITEMS CHECKLIST
// ============================================================
function renderAiItemsList() {
    const list = document.getElementById('ai-items-list');
    const panel = document.getElementById('ai-results-panel');
    if (!list || !panel) return;

    list.innerHTML = '';

    if (state.aiDetectedItems.length === 0) {
        panel.style.display = 'none';
        return;
    }

    state.aiDetectedItems.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = `ai-item-row${item.checked ? ' ai-item-checked' : ' ai-item-unchecked'}`;
        row.id = `ai-item-row-${idx}`;
        row.innerHTML = `
            <label class="ai-item-check">
                <input type="checkbox" id="ai-chk-${idx}" ${item.checked ? 'checked' : ''} onchange="toggleAiItem(${idx})">
                <span class="ai-check-box"></span>
            </label>
            <span class="ai-item-icon">${item.icon}</span>
            <div class="ai-item-info">
                <span class="ai-item-name">${item.name}</span>
                <span class="ai-item-vol-badge">${item.vol} m³/stuk</span>
            </div>
            <div class="ai-item-controls">
                <button class="ai-qty-btn" onclick="changeAiQty(${idx}, -1)">−</button>
                <span class="ai-qty-val" id="ai-qty-${idx}">${item.qty}</span>
                <button class="ai-qty-btn" onclick="changeAiQty(${idx}, 1)">+</button>
            </div>
            <div class="ai-item-extra-toggles">
                ${item.montageRequired ? `
                <label class="ai-montage-toggle" title="Demontage nodig?">
                    <input type="checkbox" id="ai-demont-${idx}" ${item.needsDemontage ? 'checked' : ''} onchange="toggleAiDemontage(${idx})">
                    <span class="ai-mont-label ${item.needsDemontage ? 'active' : ''}" id="ai-demont-label-${idx}">
                        🔧 Demontage
                    </span>
                </label>
                <label class="ai-montage-toggle" title="Montage nodig?">
                    <input type="checkbox" id="ai-mont-${idx}" ${item.needsMontage ? 'checked' : ''} onchange="toggleAiMontage(${idx})">
                    <span class="ai-mont-label ${item.needsMontage ? 'active' : ''}" id="ai-mont-label-${idx}">
                        🔨 Montage
                    </span>
                </label>` : ''}
            </div>
        `;
        list.appendChild(row);
    });

    panel.style.display = 'block';
    lucide.createIcons();
}

window.toggleAiItem = function (idx) {
    state.aiDetectedItems[idx].checked = !state.aiDetectedItems[idx].checked;
    const row = document.getElementById(`ai-item-row-${idx}`);
    if (row) {
        row.className = `ai-item-row${state.aiDetectedItems[idx].checked ? ' ai-item-checked' : ' ai-item-unchecked'}`;
    }
    recalcAiVolume();
};

window.changeAiQty = function (idx, delta) {
    const item = state.aiDetectedItems[idx];
    const newQty = item.qty + delta;

    if (newQty < 1) {
        // Verwijder het item uit de lijst
        state.aiDetectedItems.splice(idx, 1);
        renderAiItemsList();
    } else {
        item.qty = newQty;
        const el = document.getElementById(`ai-qty-${idx}`);
        if (el) el.textContent = item.qty;
    }
    recalcAiVolume();
};

window.toggleAiMontage = function (idx) {
    const item = state.aiDetectedItems[idx];
    item.needsMontage = !item.needsMontage;
    const label = document.getElementById(`ai-mont-label-${idx}`);
    if (label) label.className = `ai-mont-label${item.needsMontage ? ' active' : ''}`;
    recalcAiVolume();
};

window.toggleAiDemontage = function (idx) {
    const item = state.aiDetectedItems[idx];
    item.needsDemontage = !item.needsDemontage;
    const label = document.getElementById(`ai-demont-label-${idx}`);
    if (label) label.className = `ai-mont-label${item.needsDemontage ? ' active' : ''}`;
    recalcAiVolume();
};

function recalcAiVolume() {
    let totalVol = 0;
    let totalDemontageMinutes = 0;
    let totalMontageMinutes = 0;

    state.aiDetectedItems.forEach(item => {
        if (item.checked) {
            totalVol += item.vol * item.qty;
            const mMin = item.montageMinutes || 0;
            if (item.needsDemontage) {
                totalDemontageMinutes += (mMin * 0.8) * item.qty; // Demontage is meestal sneller
            }
            if (item.needsMontage) {
                totalMontageMinutes += mMin * item.qty;
            }
        }
    });

    state.volume = parseFloat(totalVol.toFixed(1));

    // Auto-set montage if any AI item has montage
    const hasAnyMontage = totalDemontageMinutes > 0 || totalMontageMinutes > 0;
    if (hasAnyMontage) {
        state.hasMontage = true;
        const toggle = document.getElementById('montage-toggle');
        if (toggle) toggle.checked = true;
        const details = document.getElementById('montage-details');
        if (details) details.style.display = 'block';

        state.montageHours = Math.ceil((totalDemontageMinutes + totalMontageMinutes) / 60 * 10) / 10;
        state.totalDemontageHours = Math.ceil(totalDemontageMinutes / 60 * 10) / 10;
        state.totalMontageHours = Math.ceil(totalMontageMinutes / 60 * 10) / 10;

        const hoursEl = document.getElementById('montage-hours-val');
        if (hoursEl) {
            hoursEl.innerHTML = `${state.totalDemontageHours} u demontage + ${state.totalMontageHours} u montage<br><small>Totaal: ${state.montageHours} uur</small>`;
        }
    } else {
        state.totalDemontageHours = 0;
        state.totalMontageHours = 0;
    }
    // Check if user manually has montage items selected separately
    // Only reset if no manual montage items either
    const hasManualMontage = Object.values(state.montageItems).some(v => v > 0);
    if (!hasManualMontage && !hasAnyMontage) {
        // Alleen uitzetten als er écht nergens iets geselecteerd is
    }

    // Update volume display
    const aiTotalVolEl = document.getElementById('ai-total-vol');
    if (aiTotalVolEl) aiTotalVolEl.textContent = `${state.volume} m³`;

    calculate(true);
}

// ============================================================
// CALCULATE
// ============================================================
function calculate(isLive = false) {
    let currentVol = state.volume;

    // Handle manual mode volume
    let inventoryVol = 0;
    if (state.mode === 'manual') {
        itemsData.forEach(item => {
            inventoryVol += (state.inventory[item.id] || 0) * item.vol;
        });
    }

    // Boxes are ALWAYS added, regardless of mode (photo or manual)
    const extraVol = (state.boxes || 0) * 0.1;

    // Total Volume:
    // - manual mode: sum of selected items
    // - upload mode with AI items: recalcAiVolume() already set state.volume
    // - upload mode without AI: state.volume from fallback estimate
    const baseVol = state.mode === 'manual' ? inventoryVol : state.volume;
    currentVol = parseFloat((baseVol + extraVol).toFixed(1));
    state.finalVolume = currentVol;

    // Default estimate for Step 1 if nothing selected (at least 5m3)
    if (currentVol === 0 && isLive) {
        currentVol = 5.0;
    }

    const manualKmInput = document.getElementById('manual-km');
    const manualKmVal = manualKmInput ? parseFloat(manualKmInput.value) : NaN;
    const kmPerTrip = (!isNaN(manualKmVal) && manualKmVal >= 0) ? manualKmVal : (state.km > 0 ? state.km : 0);

    const trips = Math.ceil(currentVol / 20);
    const totalKm = kmPerTrip * (trips * 2 - 1);

    const loadUnloadHours = currentVol / 3.0; // ~3 m3 per hour team performance
    const driveHours = totalKm / 60; // 60 km/h average for trucks
    const surchargeHours = (state.woonFromSurcharge || 0) + (state.woonToSurcharge || 0);

    const totalHoursRaw = loadUnloadHours + driveHours + surchargeHours;
    // Minimale afname van 2 uur
    const totalHours = Math.ceil(Math.max(2, totalHoursRaw));
    state.finalHours = totalHours;

    const p = state.prices;
    const km = totalKm; // For cost calculation

    const moversCost = totalHours * p.moverPerHour;
    const truckCost = p.truck;

    // Rijkosten (brandstof/slijtage) in vaste staffels o.b.v. kilometers
    let kmCost = 30; // 0 - 50 km
    if (km > 150) kmCost = 75;
    else if (km > 100) kmCost = 50;
    else if (km >= 50) kmCost = 40;
    const voorrijCost = p.voorrijkosten;
    const montageCost = state.hasMontage ? (state.montageHours * p.montageRate) : 0;

    const subtotaalRaw = moversCost + truckCost + kmCost + voorrijCost + montageCost;
    const discount = p.vroegboekKorting;
    const subtotaal = Math.max(0, subtotaalRaw - discount);
    const btw = subtotaal * p.btwRate;
    const totaal = subtotaal + btw;

    // Update Live Indicator
    const livePriceEl = document.getElementById('live-price-val');
    if (livePriceEl) {
        const newText = `€ ${fmt(totaal)}`;
        if (livePriceEl.innerText !== newText) {
            livePriceEl.innerText = newText;
            livePriceEl.classList.remove('price-bounce');
            void livePriceEl.offsetWidth;
            livePriceEl.classList.add('price-bounce');
        }
    }

    const ldKm = document.getElementById('ld-km');
    const ldVol = document.getElementById('ld-vol');
    const ldHours = document.getElementById('ld-hours');
    if (ldKm) ldKm.innerText = `${km} km`;
    if (ldVol) ldVol.innerText = `${currentVol} m³`;
    if (ldHours) ldHours.innerText = `${totalHours} uur`;

    // Step 3 Results
    const totalVolEl = document.getElementById('total-volume');
    if (totalVolEl) {
        totalVolEl.innerText = `${currentVol} m³`;
        document.getElementById('estimated-hours').innerText = `${totalHours} uur`;

        const woonLabel = surchargeHours > 0 ? ` incl. +${surchargeHours}u woontype-toeslag` : '';

        let breakdownHTML = `
            <div class="bd-row">
                <span class="bd-label"><i data-lucide="users" style="width:14px;height:14px"></i> ${p.moversCount} Verhuizers × ${totalHours}u${woonLabel}</span>
                <span class="bd-val">€ ${fmt(moversCost)}</span>
            </div>
            <div class="bd-row">
                <span class="bd-label"><i data-lucide="truck" style="width:14px;height:14px"></i> Verhuiswagen 20m³ (dagprijs)</span>
                <span class="bd-val">€ ${fmt(truckCost)}</span>
            </div>
        `;

        if (state.hasMontage && state.montageHours > 0) {
            const detailLabel = (state.totalDemontageHours > 0 || state.totalMontageHours > 0)
                ? `${state.totalDemontageHours}u demont. + ${state.totalMontageHours}u mont.`
                : `${state.montageHours}u`;

            breakdownHTML += `
                <div class="bd-row" style="background: var(--orange-light); border-radius: 4px; padding: 4px 0;">
                    <span class="bd-label" style="color: var(--orange); font-weight: 700;"><i data-lucide="settings" style="width:14px;height:14px"></i> Montage & Demontage (${detailLabel} × €45)</span>
                    <span class="bd-val" style="color: var(--orange); font-weight: 700;">€ ${fmt(montageCost)}</span>
                </div>
            `;
        }

        breakdownHTML += `
            <div class="bd-row">
                <span class="bd-label"><i data-lucide="map" style="width:14px;height:14px"></i> Rijkosten (${totalKm} km${trips > 1 ? ` — ${trips} ritten` : ''})</span>
                <span class="bd-val">€ ${fmt(kmCost)}</span>
            </div>
            <div class="bd-row">
                <span class="bd-label"><i data-lucide="navigation" style="width:14px;height:14px"></i> Voorrijkosten (${p.moversCount} × €45)</span>
                <span class="bd-val">€ ${fmt(voorrijCost)}</span>
            </div>
            <div class="bd-row discount-row" style="color: #10b981; font-weight: 600;">
                <span class="bd-label"><i data-lucide="zap" style="width:14px;height:14px"></i> Vroegboekkorting (7 dagen geldig)</span>
                <span class="bd-val">-€ ${fmt(discount)}</span>
            </div>
        `;

        document.getElementById('cost-breakdown').innerHTML = breakdownHTML;
        document.getElementById('result-subtotaal').innerText = `€ ${fmt(subtotaal)}`;
        document.getElementById('result-btw').innerText = `€ ${fmt(btw)}`;
        document.getElementById('total-price').innerText = `€ ${fmt(totaal)}`;

        lucide.createIcons();
    }
}

// ============================================================
// HELPERS — adres samenvoegen
// ============================================================
function getFromAddress() {
    const straat = document.getElementById('from-straat')?.value || '';
    const stad = document.getElementById('from-stad')?.value || '';
    const pc = document.getElementById('from-postcode')?.value || '';
    if (straat && stad) return `${straat}, ${pc} ${stad}`;
    if (stad) return stad;
    return 'Vertrekadres';
}

function getToAddress() {
    const straat = document.getElementById('to-straat')?.value || '';
    const stad = document.getElementById('to-stad')?.value || '';
    const pc = document.getElementById('to-postcode')?.value || '';
    if (straat && stad) return `${straat}, ${pc} ${stad}`;
    if (stad) return stad;
    return 'Bestemmingsadres';
}

// ============================================================
// PDF GENERATIE
// ============================================================
// ============================================================
window.downloadOfferte = async function () {
    const btn = document.querySelector('.pdf-cta-btn');
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="email-spinner"></span> Bezig...';
    btn.disabled = true;

    calculate(false);
    const dateStr = new Date().toLocaleDateString('nl-NL');

    // Zorg ervoor dat jsPDF geladen is via CDN
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Kleuren config
    const blueDark = [23, 37, 84];     // #172554
    const blueAcc = [37, 99, 235];    // #2563eb
    const grayTxt = [100, 116, 139];  // #64748b

    // Variabelen voor berekening
    const p = state.prices;
    const currentVol = state.finalVolume || 5;
    const totalHours = state.finalHours || 2;
    const moversCost = totalHours * p.moverPerHour;
    const truckCost = p.truck;
    const manualKmInput = document.getElementById('manual-km');
    const manualKmVal = manualKmInput ? parseFloat(manualKmInput.value) : NaN;
    const kmPerTrip = (!isNaN(manualKmVal) && manualKmVal >= 0) ? manualKmVal : (state.km > 0 ? state.km : 0);
    const trips = Math.ceil(currentVol / 20);
    const totalKm = kmPerTrip * (trips * 2 - 1);

    let kmCost = 30;
    if (totalKm > 150) kmCost = 75;
    else if (totalKm > 100) kmCost = 50;
    else if (totalKm >= 50) kmCost = 40;

    const voorrijCost = p.voorrijkosten;
    const montageCost = state.hasMontage ? (state.montageHours * p.montageRate) : 0;
    const subtotaalRaw = moversCost + truckCost + kmCost + voorrijCost + montageCost;
    const discount = p.vroegboekKorting;
    const subtotaal = Math.max(0, subtotaalRaw - discount);
    const orderNum = Math.floor(1000000 + Math.random() * 9000000).toString();

    // Helper voor centreren van tekst
    const cx = (text) => (doc.internal.pageSize.width / 2) - (doc.getTextWidth(text) / 2);

    // ==========================================
    // PAGINA 1 - WELKOM
    // ==========================================
    // "Fake" logo Header als we de afbeelding niet (makkelijk) in base64 hebben, of een blauw blok
    doc.setTextColor(...blueAcc);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    const logoTxt = "Student Verhuis Dienst";
    doc.text(logoTxt, cx(logoTxt), 30);

    doc.setTextColor(...blueDark);
    doc.setFontSize(24);
    const t1 = "Welkom bij Student Verhuis Dienst!";
    doc.text(t1, cx(t1), 60);

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const introTekst = "Fijn dat u voor ons overweegt bij deze bijzondere stap in uw leven. Verhuizen is immers niet alleen een logistieke klus, maar het begin van een nieuw hoofdstuk. Bij Student Verhuis Dienst begrijpen we dat als geen ander. Daarom zorgen wij voor een soepele, zorgeloze overgang — met aandacht voor mens èn materiaal.\n\nOns team bestaat uit ervaren, vakkundige verhuizers met oog voor detail, betrokkenheid en service. We helpen dagelijks mensen in heel Nederland aan een frisse start, of het nu gaat om een stadsverhuizing, een seniorenverhuizing of een complete gezinsverhuizing. Flexibiliteit, zorgvuldigheid en klantgerichtheid staan bij ons centraal — net als het leveren.";
    const splitIntro = doc.splitTextToSize(introTekst, 170);
    doc.text(splitIntro, 20, 80);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...blueDark);
    doc.text("Wat kunt u van ons verwachten?", 20, 130);

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    let bulletY = 145;
    const bullets = [
        ["Zorgeloze Start", "Wij regelen alles tot in de puntjes, zodat u zich kunt richten op uw nieuwe begin."],
        ["Persoonlijke Aanpak", "Geen standaardformule, maar een aanpak die past bij uw wensen en situatie."],
        ["Heldere Tarieven", "Eerlijke prijzen zonder verrassingen, altijd transparant en afgestemd op uw budget."],
        ["Vakkundig Team", "Onze verhuizers zijn professioneel opgeleid en weten precies hoe ze uw spullen efficiënt verplaatsen."]
    ];

    bullets.forEach(b => {
        doc.setFont("helvetica", "bold");
        doc.text("• " + b[0] + " - ", 20, bulletY);
        let w = doc.getTextWidth("• " + b[0] + " - ");
        doc.setFont("helvetica", "normal");
        let bText = doc.splitTextToSize(b[1], 170 - w);
        doc.text(bText, 20 + w, bulletY);
        bulletY += 12 * bText.length;
    });

    // ==========================================
    // PAGINA 2 - OFFERTE & TABEL
    // ==========================================
    doc.addPage();
    doc.setTextColor(...blueAcc);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text(logoTxt, cx(logoTxt), 30);

    doc.setTextColor(...blueDark);
    doc.setFontSize(22);
    doc.text("OFFERTE", 20, 55);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("Offerte datum: ", 20, 70);
    doc.setFont("helvetica", "normal");
    doc.text(dateStr, 60, 70);

    doc.setFont("helvetica", "bold");
    doc.text("Offerte nummer: ", 20, 78);
    doc.setFont("helvetica", "normal");
    doc.text(orderNum, 60, 78);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Geachte Klant,", 20, 95);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    const offText = doc.splitTextToSize("Naar aanleiding van uw offerteaanvraag hebben wij een vrijblijvende offerte voor u opgesteld. U kunt deze offerte desgewenst via PandaDoc / Zapier als akkoord markeren.", 170);
    doc.text(offText, 20, 103);

    // Bouw de Tabel Data op voor AUTOTABLE
    let tableBody = [
        [`Verhuizers ${p.moversCount} personen`, `${totalHours}`, 'uur', `€ ${fmt(p.moverPerHour)}`, `€ ${fmt(moversCost)}`],
        [`Verhuiswagen 20 m³`, `1`, 'stuk', `€ ${fmt(p.truck)}`, `€ ${fmt(truckCost)}`],
        [`Rijkosten (${totalKm} km)`, `1`, 'rit', `€ ${fmt(kmCost)}`, `€ ${fmt(kmCost)}`],
        [`Voorrijkosten verhuizers`, `${p.moversCount}`, 'stuk', `€ ${fmt(p.voorrijkosten / p.moversCount)}`, `€ ${fmt(voorrijCost)}`]
    ];
    if (state.hasMontage && state.montageHours > 0) {
        tableBody.splice(3, 0, [`Montage/demontage`, `${state.montageHours}`, 'uur', `€ ${fmt(p.montageRate)}`, `€ ${fmt(montageCost)}`]);
    }

    doc.autoTable({
        startY: 120,
        head: [['Beschrijving', 'Aantal', 'Eenheid', 'Stukprijs', 'Totaal']],
        body: tableBody,
        theme: 'plain',
        headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { cellPadding: 4, fontSize: 10, lineColor: [226, 232, 240], lineWidth: 0.1 },
        columnStyles: {
            0: { halign: 'left' },
            1: { halign: 'center' },
            2: { halign: 'center' },
            3: { halign: 'right' },
            4: { halign: 'right' }
        }
    });

    let finalY = doc.lastAutoTable.finalY + 15;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    let subTxt = `Subtotaal      € ${fmt(subtotaalRaw)}`;
    doc.text(subTxt, 190 - doc.getTextWidth(subTxt), finalY);

    finalY += 10;
    doc.setFontSize(10);
    doc.setTextColor(34, 197, 94); // Groen voor korting
    let kortTxt = `Vroegboekkorting (7 dgn)      -€ ${fmt(discount)}`;
    doc.text(kortTxt, 190 - doc.getTextWidth(kortTxt), finalY);

    // ==========================================
    // PAGINA 3 - TARIEVEN
    // ==========================================
    doc.addPage();
    doc.setTextColor(...blueAcc);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text(logoTxt, cx(logoTxt), 30);

    doc.setTextColor(...blueDark);
    doc.setFontSize(22);
    doc.text("TARIEVEN", 20, 55);

    const tarievenRows = [
        ["Verhuizer", "€ 32,50 p/u p.p.", "(min. afname 3 uur)"],
        ["Voorrijkosten verhuizers", "Afhankelijk regio", ""],
        ["Verhuiswagen 20 m3", "€ 150,00 p/d", "Per dag"],
        ["Km-vergoeding verhuiswagen", "Afhankelijk afstand", ""],
        ["Verhuislift", "€ 120 p/u", "(min. afname 1 uur)"],
        ["Overuren na 8 werkuren", "Toeslag v. 150% p/u", ""],
        ["Weekendtoeslag", "€ 25,- p.p.", ""],
        ["Zware objecten (> 80kg)", "Obv gewicht", ""]
    ];

    doc.autoTable({
        startY: 70,
        body: tarievenRows,
        theme: 'plain',
        styles: { cellPadding: 5, fontSize: 10, lineColor: [249, 115, 22], lineWidth: { top: 0, bottom: 0.5, left: 0, right: 0 } },
        columnStyles: { 0: { fontStyle: 'bold' } }
    });

    // Download Activeren via jsPDF (Browser Native)
    doc.save(`Offerte_SVD_${dateStr.replace(/\//g, '-')}.pdf`);
    btn.innerHTML = originalText;
    btn.disabled = false;
};

// ============================================================
// UNIFIED SHARING (WhatsApp, Email, PandaDoc)
// ============================================================

window.sendWhatsAppUnified = function () {
    const phone = document.getElementById('unified-phone')?.value?.replace(/[^0-9]/g, '');
    if (!phone || phone.length < 8) {
        alert('Vul eerst een geldig 06-nummer in.');
        return;
    }
    const finalPhone = phone.startsWith('06') ? '31' + phone.substring(1) : phone;
    const totaal = document.getElementById('total-price')?.innerText || '';
    const montageMsg = state.hasMontage ? `\nInclusief Montage: ${state.montageHours} uur` : '';
    const msg = encodeURIComponent(`Beste klant, hierbij uw verhuisindicatie:\nVan: ${getFromAddress()}\nNaar: ${getToAddress()}\nVolume: ${state.finalVolume} m3\nUren: ${state.finalHours}u${montageMsg}\nTotaal: ${totaal}\n\nStudent Verhuis Dienst`);
    window.open(`https://wa.me/${finalPhone}?text=${msg}`, '_blank');
};

window.sendEmailUnified = async function () {
    const email = document.getElementById('unified-email')?.value?.trim();
    const feedback = document.getElementById('feedback-unified');
    if (!email || !email.includes('@')) {
        alert('Vul eerst een geldig e-mailadres in.');
        return;
    }

    try {
        const resp = await fetch('send-email.php', {
            method: 'POST',
            body: JSON.stringify({
                to_email: email,
                van: getFromAddress(),
                naar: getToAddress(),
                volume: state.finalVolume,
                uren: state.finalHours,
                montage_uren: state.hasMontage ? state.montageHours : 0,
                totaal: document.getElementById('total-price')?.innerText
            })
        });
        const res = await resp.json();
        alert(res.message);
    } catch (err) {
        alert('Fout bij verzenden e-mail.');
    }
};

window.sendToPandaDocUnified = async function () {
    const email = document.getElementById('unified-email')?.value?.trim();
    if (!email || !email.includes('@')) {
        alert('Vul eerst het e-mailadres van de klant in.');
        return;
    }

    const btn = document.querySelector('[onclick="sendToPandaDocUnified()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Bezig...';
    btn.disabled = true;

    try {
        const webhookUrl = 'https://hooks.zapier.com/hooks/catch/26673302/u0lcw3k/';

        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: JSON.stringify({
                client_email: email,
                van: getFromAddress(),
                naar: getToAddress(),
                volume: document.getElementById('total-volume')?.innerText,
                uren: document.getElementById('estimated-hours')?.innerText,
                montage: state.hasMontage ? `${state.montageHours} uur` : 'Geen',
                afstand: document.getElementById('ld-km')?.innerText,
                totaal_prijs: document.getElementById('total-price')?.innerText,
                datum: new Date().toLocaleDateString('nl-NL')
            }),
            mode: 'no-cors'
        });

        alert('Succes! De offerte is klaargezet voor digitale ondertekening. U ontvangt hier zometeen een e-mail over.');
    } catch (err) {
        console.error('Signing API Error:', err);
        alert('Verzenden mislukt. Controleer uw internetverbinding.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

// ============================================================
// UTIL
// ============================================================
function fmt(n) {
    return n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getActiveWoonLabel(gridId) {
    const active = document.querySelector(`#${gridId} .woon-btn.active .woon-label`);
    return active ? active.innerText : 'Begane grond';
}

function showFeedback(el, type, msg) {
    if (!el) return;
    el.style.display = 'block';
    el.className = `email-feedback ${type}`;
    el.innerText = msg;
}
