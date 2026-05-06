const canvas = document.getElementById('canvas');
const ctx = canvas?.getContext('2d', { alpha: false }); 
const statsEl = document.getElementById('stats');
const zoomEl = document.getElementById('zoom');
const statusEl = document.getElementById('status');

let width, height;
let xMin = -2.2, xMax = 1.0, yMin = -1.2, yMax = 1.2;
let maxIter = 200; 
const paletteSize = 1024; 
let currentPaletteData = null;
let touchTimer = null;
let isRendering = false;

const PALETTES = {
    ultra: [
        {pos: 0.0, r: 0,   g: 7,   b: 100},
        {pos: 0.16, r: 32,  g: 107, b: 203},
        {pos: 0.42, r: 237, g: 255, b: 255},
        {pos: 0.64, r: 255, g: 170, b: 0},
        {pos: 0.85, r: 0,   g: 2,   b: 0},
        {pos: 1.0, r: 0,   g: 7,   b: 100}
    ],
    fire: [
        {pos: 0.0, r: 0,   g: 0, b: 0},
        {pos: 0.2, r: 180, g: 20, b: 0},
        {pos: 0.5, r: 255, g: 150, b: 0},
        {pos: 0.8, r: 255, g: 255, b: 200},
        {pos: 1.0, r: 0,   g: 0, b: 0}
    ]
};

function resetView() {
    xMin = -2.2; xMax = 1.0;
    yMin = -1.2; yMax = 1.2;
    maxIter = 200;
    handleResize();
}

function lerp(start, end, t) { 
    return start + (end - start) * t; 
}

function generatePalette(stops) {
    const data = new Uint8ClampedArray(paletteSize * 3);
    let stopIdx = 0;

    for (let i = 0; i < paletteSize; i++) {
        const pos = i / paletteSize;
        
        while (stopIdx < stops.length - 2 && pos > stops[stopIdx + 1].pos) {
            stopIdx++;
        }

        const left = stops[stopIdx];
        const right = stops[stopIdx + 1];
        
        const t = (pos - left.pos) / (right.pos - left.pos);
        const offset = i * 3;
        
        data[offset] = lerp(left.r, right.r, t);
        data[offset + 1] = lerp(left.g, right.g, t);
        data[offset + 2] = lerp(left.b, right.b, t);
    }
    return data;
}

function updatePalette(name) {
    if (PALETTES[name]) {
        currentPaletteData = generatePalette(PALETTES[name]);
        render();
    }
}

function render() {
    if (!currentPaletteData || !ctx || isRendering) return;
    
    isRendering = true;
    if (statusEl) statusEl.style.display = 'block';

    requestAnimationFrame(() => {
        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        const dx = (xMax - xMin) / width;
        const dy = (yMax - yMin) / height;

        for (let y = 0; y < height; y++) {
            const cy = yMin + y * dy;
            
            for (let x = 0; x < width; x++) {
                const cx = xMin + x * dx;
                let zx = 0, zy = 0, zx2 = 0, zy2 = 0, n = 0;

                while (n < maxIter && zx2 + zy2 <= 16) {
                    zy = 2 * zx * zy + cy;
                    zx = zx2 - zy2 + cx;
                    zx2 = zx * zx;
                    zy2 = zy * zy;
                    n++;
                }

                const pix = (y * width + x) * 4;
                if (n === maxIter) {
                    data[pix] = data[pix + 1] = data[pix + 2] = 0;
                } else {
                    const smooth = n + 1 - Math.log2(Math.log2(zx2 + zy2)) / 2;
                    const colorIdx = Math.floor(smooth * 20) % paletteSize;
                    const paletteOffset = colorIdx * 3;
                    
                    data[pix] = currentPaletteData[paletteOffset];
                    data[pix + 1] = currentPaletteData[paletteOffset + 1];
                    data[pix + 2] = currentPaletteData[paletteOffset + 2];
                }
                data[pix + 3] = 255;
            }
        }
        
        ctx.putImageData(imgData, 0, 0);
        
        if (statusEl) statusEl.style.display = 'none';
        if (statsEl) statsEl.innerText = `Iter: ${Math.floor(maxIter)}`;
        if (zoomEl) zoomEl.innerText = `Zoom: ${(3.2 / (xMax - xMin)).toFixed(1)}x`;
        
        isRendering = false;
    });
}

function zoom(clientX, clientY, isOut) {
    const dx = (xMax - xMin);
    const dy = (yMax - yMin);
    
    const centerX = xMin + (clientX / width) * dx;
    const centerY = yMin + (clientY / height) * dy;
    const zoomFactor = isOut ? 2.5 : 0.4;

    const newDx = dx * zoomFactor;
    const newDy = dy * zoomFactor;

    xMin = centerX - newDx / 2;
    xMax = centerX + newDx / 2;
    yMin = centerY - newDy / 2;
    yMax = centerY + newDy / 2;

    if (!isOut) maxIter += 40;
    else maxIter = Math.max(200, maxIter - 40);

    render();
}

canvas?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const x = t.clientX;
    const y = t.clientY;

    touchTimer = setTimeout(() => {
        zoom(x, y, true); // Zoom Out
        touchTimer = null;
    }, 500);
}, { passive: false });

canvas?.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (touchTimer) {
        clearTimeout(touchTimer);
        const t = e.changedTouches[0];
        zoom(t.clientX, t.clientY, false); // Zoom In
    }
}, { passive: false });

canvas?.addEventListener('mousedown', (e) => {
    if (e.button === 0 || e.button === 2) {
        zoom(e.clientX, e.clientY, e.button === 2);
    }
});

function handleResize() {
    width = window.innerWidth;
    height = window.innerHeight;
    if (canvas) {
        canvas.width = width;
        canvas.height = height;
    }
    
    const ratio = width / height;
    const xRange = xMax - xMin;
    const yCenter = (yMax + yMin) / 2;
    const newYRange = xRange / ratio;
    
    yMin = yCenter - newYRange / 2;
    yMax = yCenter + newYRange / 2;
    
    render();
}

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleResize, 150);
});

window.addEventListener('contextmenu', (e) => e.preventDefault());

currentPaletteData = generatePalette(PALETTES.ultra);
handleResize();
