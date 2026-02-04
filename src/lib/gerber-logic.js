import JSZip from 'jszip';
import parser from 'gerber-parser';
import plotter from 'gerber-plotter';
import PlotterToSvg from 'gerber-to-svg/lib/plotter-to-svg';
import render from 'gerber-to-svg/render';
import xmlElementString from 'xml-element-string';
import { createWorker } from 'tesseract.js';

export async function processGerberZip(file, onProgress) {
    const reportProgress = (msg) => onProgress && onProgress(msg);
    const zip = new JSZip();
    reportProgress('Unzipping...');
    const content = await zip.loadAsync(file);
    const fileInfos = [];

    // Pass 1: Collect file data
    for (const [filename, fileData] of Object.entries(content.files)) {
        if (fileData.dir) continue;

        const ext = filename.split('.').pop().toLowerCase();
        const isGerber = ['gtl', 'gbl', 'gto', 'gbo', 'gts', 'gbs', 'txt', 'dri', 'xln', 'ger', 'gbr', 'gbp', 'gtp', 'gko', 'nc'].includes(ext);

        if (isGerber) {
            const text = await fileData.async('text');
            fileInfos.push({ filename, text, ext });
        }
    }

    const converters = [];
    let globalMinX = Infinity, globalMinY = Infinity, globalMaxX = -Infinity, globalMaxY = -Infinity;

    reportProgress('Parsing Gerber files...');
    // Pass 1 (continued): Parse and calculate individual bounding boxes
    for (const info of fileInfos) {
        try {
            const converter = await new Promise((resolve, reject) => {
                const p = parser();
                const pl = plotter();
                // Manually provide the element creator (required when using constructor directly)
                const conv = new PlotterToSvg(info.filename, { id: info.filename }, xmlElementString);


                p.pipe(pl).pipe(conv);
                p.write(info.text);
                p.end();

                conv.on('finish', () => resolve(conv));
                conv.on('error', reject);
            });

            if (converter.viewBox && converter.viewBox[2] > 0) {
                const [x, y, w, h] = converter.viewBox;
                globalMinX = Math.min(globalMinX, x);
                globalMinY = Math.min(globalMinY, y);
                globalMaxX = Math.max(globalMaxX, x + w);
                globalMaxY = Math.max(globalMaxY, y + h);
                converters.push({ info, converter });
            }
        } catch (err) {
            console.error(`Error processing ${info.filename}: `, err);
        }
    }

    // Pass 2: Unified rendering
    reportProgress('Rendering layers...');
    const globalViewBox = [globalMinX, globalMinY, globalMaxX - globalMinX, globalMaxY - globalMinY];
    const globalWidth = (globalMaxX - globalMinX) / 1000;
    const globalHeight = (globalMaxY - globalMinY) / 1000;

    const layers = converters.map(({ info, converter }) => {
        // Override converter dimensions to global to unify the Y-flip transform
        converter.viewBox = globalViewBox;
        converter.width = globalWidth;
        converter.height = globalHeight;

        // render() returns a string when converter uses default xml-element-string
        const svgString = render(converter, { id: info.filename.replace(/[^a-zA-Z0-9]/g, '_') });

        return {
            filename: info.filename,
            type: determineLayerType(info.filename),
            svg: svgString,
            visible: true
        };
    });

    return {
        layers,
        boardInfo: {
            viewBox: globalViewBox,
            width: globalWidth,
            height: globalHeight
        },
        componentLocations: {} // Initialize empty, OCR is now manual
    };
}

export async function runOCRProcess(layers, boardInfo, onProgress, validDesignators = []) {
    const reportProgress = (msg) => onProgress && onProgress(msg);
    reportProgress('Analyzing silkscreen text (this may take a moment)...');

    // Check if we have compatible layers
    const silkscreenLayers = layers.filter(l => l.type === 'Top Silkscreen' || l.type === 'Bottom Silkscreen');

    if (silkscreenLayers.length === 0) {
        return {};
    }

    const componentLocations = {};
    const globalViewBox = boardInfo.viewBox;
    // Robust normalization: trim whitespace and uppercase
    const validSet = new Set(validDesignators.map(d => d.toString().trim().toUpperCase()));

    console.log(`[OCR Debug] Valid Designators Set (Size: ${validSet.size}):`, [...validSet].slice(0, 10), "...");
    reportProgress(`Searching for ${validSet.size} components...`);

    for (const layer of silkscreenLayers) {
        reportProgress(`Scanning ${layer.type}...`);
        console.log(`Starting OCR for ${layer.type}`);

        const results = await performOCR(layer, globalViewBox, validSet);
        const count = Object.keys(results).length;
        console.log(`OCR for ${layer.type} finished. Found ${count} refs.`);

        for (const [designator, location] of Object.entries(results)) {
            // If already found on Top, don't overwrite with Bottom unless preferred logic changes
            if (!componentLocations[designator]) {
                componentLocations[designator] = {
                    ...location,
                    layerType: layer.type
                };
            }
        }
    }

    reportProgress(`Found ${Object.keys(componentLocations).length} component references.`);
    return componentLocations;
}

async function performOCR(layer, viewBox, validSet) {
    const [minX, minY, width, height] = viewBox;

    // Stable resolution - bump slightly to help small fonts
    const MAX_DIMENSION = 2500;
    const scaleX = MAX_DIMENSION / width;
    const scaleY = MAX_DIMENSION / height;
    const scale = Math.min(scaleX, scaleY, 5);

    const canvasWidth = Math.max(1, Math.floor(width * scale));
    const canvasHeight = Math.max(1, Math.floor(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    const svgBlob = new Blob([layer.svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = async () => {
            try {
                // 1. Draw original
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);

                // 2. Manual Thresholding (Make it pure B&W)
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    const val = avg < 128 ? 0 : 255; // Binary threshold
                    data[i] = data[i + 1] = data[i + 2] = val;
                }
                ctx.putImageData(imageData, 0, 0);

                console.log(`[OCR Debug] Processing ${layer.type} at ${canvas.width}x${canvas.height}`);

                const worker = await createWorker('eng', 1, {
                    logger: m => console.log(`[Tesseract] ${m.status}: ${Math.round(m.progress * 100)}%`)
                });

                // Try PSM 6 (Single uniform block of text) - often more robust than 11
                await worker.setParameters({
                    tessedit_pageseg_mode: '6',
                    user_defined_dpi: '300'
                });

                const locations = {};

                // --- Helper to process results ---
                const processResult = (result, isRotated) => {
                    if (!result || !result.data || !result.data.words) return;

                    result.data.words.forEach(word => {
                        const rawText = word.text.trim().toUpperCase();
                        const cleanText = rawText.replace(/[^A-Z0-9]/g, '');

                        // console.log(`[OCR Raw] Found: "${rawText}" (Clean: "${cleanText}") Conf: ${word.confidence}`);

                        if (cleanText.length < 2) {
                            // console.log(`[OCR Filter] Skipped "${rawText}": Too short`);
                            return;
                        }

                        const inSet = validSet.size === 0 || validSet.has(cleanText);

                        // Try "fuzzy" match? unique case: OCR says "C18" but BOM says "C18 "
                        // Or OCR says "C18." but we cleaned it to "C18".
                        // Wait, validSet uses original data.

                        if (!inSet) {
                            console.log(`[OCR Filter] REJECTED "${cleanText}" (Raw: "${rawText}"). Not in BOM Set.`);
                            return;
                        } else {
                            console.log(`[OCR Filter] ACCEPTED "${cleanText}"!`);
                        }

                        // Coordinate transformation
                        let cx, cy;

                        if (isRotated) {
                            // If rotated 90deg CW, the image (w,h) was processed as (h,w).
                            // bbox x is along the original y axis, y is along original -x axis... 
                            // Easier to think: we rotated context 90deg.
                            // Let's keep it simple: We scanned a specific canvas.
                            // The word.bbox is in that canvas space.
                            // Un-rotate the center point.

                            // Rotated 90 deg CW: 
                            // newX = oldY
                            // newY = oldH - oldX
                            // So to go back:
                            // oldY = newX
                            // oldX = oldH - newY (where oldH is width of rotated image)

                            // Center of word in rotated image
                            const wx = (word.bbox.x0 + word.bbox.x1) / 2;
                            const wy = (word.bbox.y0 + word.bbox.y1) / 2;

                            // Map back to unrotated pixel space (width=canvasWidth, height=canvasHeight)
                            // The canvas used for OCR had width=canvasHeight, height=canvasWidth
                            const rotatedW = canvasHeight; // width of temp canvas
                            // const rotatedH = canvasWidth; 

                            const orgX = rotatedW - wy;
                            const orgY = wx;

                            cx = orgX / scale + minX;
                            cy = orgY / scale + minY;

                        } else {
                            cx = (word.bbox.x0 + word.bbox.x1) / 2 / scale + minX;
                            cy = (word.bbox.y0 + word.bbox.y1) / 2 / scale + minY;
                        }

                        // Finally map to Gerber Y (Bottom-Left origin)
                        const finalY = (height + 2 * minY) - cy;

                        locations[cleanText] = { x: cx / 1000, y: finalY / 1000 };
                    });
                };

                // Pass 1: Normal
                console.log("Running Pass 1 (0°)...");
                const res1 = await worker.recognize(canvas);
                processResult(res1, false);

                // Pass 2: Rotated 90° for vertical text
                console.log("Running Pass 2 (90°)...");
                const canvasRot = document.createElement('canvas');
                canvasRot.width = canvasHeight;
                canvasRot.height = canvasWidth;
                const ctxRot = canvasRot.getContext('2d');

                // Rotate 90 degrees CW
                ctxRot.translate(canvasHeight, 0);
                ctxRot.rotate(90 * Math.PI / 180);
                ctxRot.drawImage(canvas, 0, 0);

                const res2 = await worker.recognize(canvasRot);
                processResult(res2, true);

                await worker.terminate();
                resolve(locations);

            } catch (err) {
                console.error("OCR Error:", err);
                resolve({});
            }
        };
        img.onerror = (err) => {
            console.error("Image Load Error:", err);
            URL.revokeObjectURL(url);
            resolve({});
        }
        img.src = url;
    });
}


function determineLayerType(filename) {

    const f = filename.toLowerCase();

    // Protel/Altium extensions
    if (f.endsWith('.gtl') || f.includes('top.gbr') || f.includes('top.ger') || f.includes('toplayer')) return 'Top Copper';
    if (f.endsWith('.gbl') || f.includes('bot.gbr') || f.includes('bottom.ger') || f.includes('bottomlayer')) return 'Bottom Copper';

    // Silkscreen
    if (f.endsWith('.gto') || f.includes('topsilk') || f.includes('tsk')) return 'Top Silkscreen';
    if (f.endsWith('.gbo') || f.includes('botsilk') || f.includes('bsk')) return 'Bottom Silkscreen';

    // Solder Mask
    if (f.endsWith('.gts') || f.includes('topsmask') || f.includes('tsm')) return 'Top Solder Mask';
    if (f.endsWith('.gbs') || f.includes('botsmask') || f.includes('bsm')) return 'Bottom Solder Mask';

    // Solder Paste (Pads) - Very important for seeing where components go
    if (f.endsWith('.gtp') || f.includes('toppaste')) return 'Top Solder Paste';
    if (f.endsWith('.gbp') || f.includes('bottompaste')) return 'Bottom Solder Paste';

    // Drills
    if (f.endsWith('.drl') || f.includes('drill') || f.includes('.xln') || f.endsWith('.nc')) return 'Drill';

    // Outline
    if (f.endsWith('.gko') || f.includes('outline') || f.includes('board_edge')) return 'Outline';

    return 'Other';
}

