const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statsEl = document.getElementById('stats');
const zoomEl = document.getElementById('zoom');
const statusEl = document.getElementById('status');

let width, height;
let xMin = -2.2, xMax = 1.0;
let yMin = -1.2, yMax = 1.2;
let maxIter = 200; 
const paletteSize = 1024; 
let currentPaletteData = null;

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

function lerp(start, end, t) {
    return start + (end - start) * t;
}

function generatePalette(stops) {
    const data = new Uint8ClampedArray(paletteSize * 3);
    for (let i = 0; i < paletteSize; i++) {
        const pos = i / paletteSize;
        let left = stops[0], right = stops[stops.length - 1];
        for (let j = 0; j < stops.length - 1; j++) {
            if (pos >= stops[j].pos && pos <= stops[j+1].pos) {
                left = stops[j];
                right = stops[j+1];
                break;
            }
        }
        const t = (pos - left.pos) / (right.pos - left.pos);
        data[i * 3 + 0] = lerp(left.r, right.r, t);
        data[i * 3 + 1] = lerp(left.g, right.g, t);
        data[i * 3 + 2] = lerp(left.b, right.b, t); // Исправлено: было left.r
    }
    return data;
}

function updatePalette(name) {
    currentPaletteData = generatePalette(PALETTES[name]);
    render();
}

function render() {
    if (!currentPaletteData) return;
    statusEl.style.display = 'block';

    setTimeout(() => {
        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const cx = xMin + (x / width) * (xMax - xMin);
                const cy = yMin + (y / height) * (yMax - yMin);

                let zx = 0, zy = 0, zx2 = 0, zy2 = 0;
                let n = 0;

                while (n < maxIter && zx2 + zy2 <= 16) {
                    zy = 2 * zx * zy + cy;
                    zx = zx2 - zy2 + cx;
                    zx2 = zx * zx;
                    zy2 = zy * zy;
                    n++;
                }

                const pix = (y * width + x) * 4;
                if (n === maxIter) {
                    data[pix] = data[pix+1] = data[pix+2] = 0;
                } else {
                    const smooth = n + 1 - Math.log2(Math.log2(zx2 + zy2)) / 2;
                    let colorIdx = Math.floor(smooth * 20) % paletteSize;
                    if (colorIdx < 0) colorIdx = 0;

                    data[pix]   = currentPaletteData[colorIdx * 3 + 0];
                    data[pix+1] = currentPaletteData[colorIdx * 3 + 1];
                    data[pix+2] = currentPaletteData[colorIdx * 3 + 2];
                }
                data[pix+3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);
        statusEl.style.display = 'none';
        
        statsEl.innerText = `Iterations: ${Math.floor(maxIter)}`;
        zoomEl.innerText = `Zoom: ${(3.2 / (xMax - xMin)).toFixed(1)}x`;
    }, 0);
}

function handleResize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    const ratio = width / height;
    const xCenter = (xMax + xMin) / 2;
    const xRange = xMax - xMin;
    const yRange = xRange / ratio;
    const yCenter = (yMax + yMin) / 2;

    yMin = yCenter - yRange / 2;
    yMax = yCenter + yRange / 2;
    
    render();
}

canvas.addEventListener('mousedown', (e) => {
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const centerX = xMin + (mouseX / width) * (xMax - xMin);
    const centerY = yMin + (mouseY / height) * (yMax - yMin);

    const zoomFactor = e.button === 0 ? 0.4 : 2.5; 
    const dx = (xMax - xMin) * zoomFactor;
    const dy = (yMax - yMin) * zoomFactor;

    xMin = centerX - dx / 2;
    xMax = centerX + dx / 2;
    yMin = centerY - dy / 2;
    yMax = centerY + dy / 2;

    if (e.button === 0) maxIter += 50; 
    else maxIter = Math.max(200, maxIter - 50);

    render();
});

window.oncontextmenu = (e) => e.preventDefault();
window.onresize = handleResize;

// Инициализация
currentPaletteData = generatePalette(PALETTES.ultra);
handleResize();
