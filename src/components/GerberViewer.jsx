import React, { useState } from 'react';
import { TransformWrapper, TransformComponent, useTransformEffect } from 'react-zoom-pan-pinch';
import { Maximize, Minimize, RotateCcw } from 'lucide-react';

// Convert native-unit Gerber coordinates to pixel offsets within the board div.
// boardInfo.viewBox = [minX, minY, width, height] in plotter units (1/1000 native units)
// boardInfo.width/height = viewBox dimensions / 1000 (native units)
// Board div size in px = boardInfo.width * 100 = viewBox[2] / 10
// → pixel = (plotter-unit - minX) / 10
// Gerber Y is flipped relative to SVG Y.
const gerberToPixel = (x, y, viewBox) => {
    const [minX, minY, , height] = viewBox;
    const yTranslate = height + 2 * minY;
    const px = (x * 1000 - minX) / 10;
    const py = (yTranslate - y * 1000 - minY) / 10;
    return { px, py };
};

const ZoomManager = ({ componentLocation, boardInfo }) => {
    useTransformEffect(({ setTransform }) => {
        if (componentLocation && boardInfo) {
            const { px, py } = gerberToPixel(componentLocation.x, componentLocation.y, boardInfo.viewBox);
            const zoomScale = 10;
            const container = document.getElementById('gerber-container');
            if (container) {
                const rect = container.getBoundingClientRect();
                const targetX = (rect.width / 2) - (px * zoomScale);
                const targetY = (rect.height / 2) - (py * zoomScale);
                setTransform(targetX, targetY, zoomScale, 400, "easeOut");
            }
        }
    });
    return null;
};

const GerberViewer = ({
    layers,
    boardInfo,
    isFlipped,
    onPlacementClick,
    onToggleLayer,
    selectedComponent,
    componentLocation,
    displayUnits = 'mm',
    nativeUnits = 'in',
    placingRotation = 0,
    placements = [],   // All placed components: [{ x, y, rotation, designator }]
}) => {
    const [cursorCoords, setCursorCoords] = useState(null);

    const visibleLayers = layers.filter(l => l.visible);

    const getGerberCoords = (e) => {
        if (!boardInfo) return null;
        const rect = e.currentTarget.getBoundingClientRect();

        // The currentTarget is the div wrapper, which is scaled by react-zoom-pan-pinch.
        // rect width/height represents the on-screen size including the zoom scale.
        // We know its intrinsic (unscaled) size is boardWidth x boardHeight.
        const boardWidthPx = boardInfo.width * 100;
        const boardHeightPx = boardInfo.height * 100;

        const scaleX = rect.width / boardWidthPx;
        const scaleY = rect.height / boardHeightPx;

        const unscaledPx = (e.clientX - rect.left) / scaleX;
        const unscaledPy = (e.clientY - rect.top) / scaleY;

        const [minX, minY, , height] = boardInfo.viewBox;
        const yTranslate = height + 2 * minY;

        // Invert the gerberToPixel matching exactly
        // px = (x * 1000 - minX) / 10 => x = (px * 10 + minX) / 1000
        const x = (unscaledPx * 10 + minX) / 1000;
        // py = (yTranslate - y * 1000 - minY) / 10 => y = (yTranslate - py * 10 - minY) / 1000
        const y = (yTranslate - unscaledPy * 10 - minY) / 1000;

        return { x, y };
    };

    const handleMouseMove = (e) => {
        if (!boardInfo) return;
        const coords = getGerberCoords(e);
        if (coords) setCursorCoords(coords);
    };

    const handleBoardClick = (e) => {
        if (!onPlacementClick || !boardInfo) return;
        const coords = getGerberCoords(e);
        if (coords) onPlacementClick(coords);
    };

    const formatCoord = (val) => {
        if (typeof val !== 'number') return '0.00';
        let displayVal = val;
        if (nativeUnits === 'in' && displayUnits === 'mm') displayVal = val * 25.4;
        else if (nativeUnits === 'mm' && displayUnits === 'in') displayVal = val / 25.4;
        return displayVal.toFixed(displayUnits === 'mm' ? 2 : 3);
    };

    const boardWidth = boardInfo ? boardInfo.width * 100 : 600;
    const boardHeight = boardInfo ? boardInfo.height * 100 : 400;

    // Sizes in pixels for overlay elements
    const GHOST_W = 14;
    const GHOST_H = 22;
    const TICK_W = 4;
    const TICK_H = 16;

    return (
        <div className="relative w-full h-full bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden rounded-xl flex">
            {/* Layer Legend */}
            <div className="w-48 bg-slate-900/80 backdrop-blur-md border-r border-slate-700/50 p-4 z-20 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Layers</h3>
                {layers.length === 0 ? (
                    <span className="text-xs text-slate-600 italic">No layers</span>
                ) : (
                    layers.map((layer, idx) => (
                        <label key={layer.filename + idx} className="flex items-center gap-2 group cursor-pointer">
                            <input
                                type="checkbox"
                                checked={layer.visible}
                                onChange={() => onToggleLayer(idx)}
                                className="w-3 h-3 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-blue-500/20 transition-all cursor-pointer"
                            />
                            <div className="flex flex-col min-w-0">
                                <span className={`text-[11px] font-semibold truncate transition-colors ${layer.visible ? 'text-slate-200' : 'text-slate-500'}`}>
                                    {layer.type}
                                </span>
                                <span className="text-[9px] text-slate-600 truncate font-mono">
                                    {layer.filename.split('.').pop().toUpperCase()}
                                </span>
                            </div>
                        </label>
                    ))
                )}
            </div>

            {/* Viewer Content */}
            <div className="flex-1 relative overflow-hidden" id="gerber-container">
                <TransformWrapper initialScale={1} minScale={0.1} maxScale={30} centerOnInit={true}>
                    {({ zoomIn, zoomOut, resetTransform }) => (
                        <>
                            <ZoomManager componentLocation={componentLocation} boardInfo={boardInfo} />
                            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                                <button onClick={() => zoomIn()} className="p-2 bg-slate-800/80 backdrop-blur-md rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors text-slate-200">
                                    <Maximize size={20} />
                                </button>
                                <button onClick={() => zoomOut()} className="p-2 bg-slate-800/80 backdrop-blur-md rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors text-slate-200">
                                    <Minimize size={20} />
                                </button>
                                <button onClick={() => resetTransform()} className="p-2 bg-slate-800/80 backdrop-blur-md rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors text-slate-200">
                                    <RotateCcw size={20} />
                                </button>
                            </div>

                            <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                                <div
                                    className={`relative transition-transform duration-500 ${isFlipped ? 'scale-x-[-1]' : ''}`}
                                    onClick={handleBoardClick}
                                    onMouseMove={handleMouseMove}
                                    onMouseLeave={() => setCursorCoords(null)}
                                    style={{ cursor: onPlacementClick ? 'crosshair' : 'default' }}
                                >
                                    {visibleLayers.length === 0 ? (
                                        <div className="text-slate-500 font-medium italic">No visible layers</div>
                                    ) : (
                                        visibleLayers.map((layer, idx) => (
                                            <div
                                                key={layer.filename + idx}
                                                className="absolute inset-0 pointer-events-none"
                                                style={{
                                                    opacity: layer.type.includes('Solder Paste') ? 1 : 0.7,
                                                    mixBlendMode: 'screen',
                                                    filter: layer.type.includes('Solder Paste') ? 'brightness(1.5)' : 'none',
                                                    zIndex: layer.type.includes('Solder Paste') ? 100 : idx
                                                }}
                                                dangerouslySetInnerHTML={{ __html: layer.svg }}
                                            />
                                        ))
                                    )}

                                    {/* Static markers for ALL placed components (green tick lines) */}
                                    {boardInfo && placements.map((p) => {
                                        const isSelected = selectedComponent?.designator === p.designator;
                                        if (isSelected) return null; // selected component gets its own marker below
                                        const { px, py } = gerberToPixel(p.x, p.y, boardInfo.viewBox);
                                        return (
                                            <div
                                                key={p.designator}
                                                className="absolute pointer-events-none z-[200]"
                                                style={{
                                                    left: px - TICK_W / 2,
                                                    top: py - TICK_H / 2,
                                                    width: TICK_W,
                                                    height: TICK_H,
                                                    transform: `rotate(${p.rotation || 0}deg)`,
                                                    transformOrigin: '50% 50%',
                                                }}
                                            >
                                                {/* Tick body */}
                                                <div style={{
                                                    position: 'absolute',
                                                    left: 0, right: 0, top: 0, bottom: 0,
                                                    backgroundColor: '#10b981',
                                                    borderRadius: 1,
                                                    opacity: 0.85,
                                                    boxShadow: '0 0 4px #10b981',
                                                }} />
                                                {/* Pin-1 pip at top */}
                                                <div style={{
                                                    position: 'absolute',
                                                    width: 4, height: 4,
                                                    borderRadius: '50%',
                                                    backgroundColor: '#fff',
                                                    top: 1,
                                                    left: '50%',
                                                    transform: 'translateX(-50%)',
                                                }} />
                                            </div>
                                        );
                                    })}

                                    {/* OCR-found location highlight (pulsing blue ring) */}
                                    {componentLocation && boardInfo && (() => {
                                        const { px, py } = gerberToPixel(componentLocation.x, componentLocation.y, boardInfo.viewBox);
                                        return (
                                            <div
                                                className="absolute pointer-events-none z-[205]"
                                                style={{
                                                    left: px - 10,
                                                    top: py - 10,
                                                    width: 20,
                                                    height: 20,
                                                    border: '2px solid #3b82f6',
                                                    borderRadius: '50%',
                                                    boxShadow: '0 0 10px #3b82f6, inset 0 0 10px #3b82f6',
                                                    animation: 'pulse 1.5s infinite',
                                                }}
                                            />
                                        );
                                    })()}

                                    {/* Selected component placed-marker (brighter green tick) */}
                                    {selectedComponent?.placement && boardInfo && (() => {
                                        const { px, py } = gerberToPixel(
                                            selectedComponent.placement.x,
                                            selectedComponent.placement.y,
                                            boardInfo.viewBox
                                        );
                                        const rot = selectedComponent.placement.rotation || 0;
                                        return (
                                            <div
                                                className="absolute pointer-events-none z-[210]"
                                                style={{
                                                    left: px - TICK_W / 2,
                                                    top: py - TICK_H / 2,
                                                    width: TICK_W,
                                                    height: TICK_H,
                                                    transform: `rotate(${rot}deg)`,
                                                    transformOrigin: '50% 50%',
                                                }}
                                            >
                                                <div style={{
                                                    position: 'absolute',
                                                    left: 0, right: 0, top: 0, bottom: 0,
                                                    backgroundColor: '#34d399',
                                                    borderRadius: 1,
                                                    boxShadow: '0 0 8px #34d399',
                                                }} />
                                                <div style={{
                                                    position: 'absolute',
                                                    width: 4, height: 4,
                                                    borderRadius: '50%',
                                                    backgroundColor: '#fff',
                                                    top: 1,
                                                    left: '50%',
                                                    transform: 'translateX(-50%)',
                                                }} />
                                            </div>
                                        );
                                    })()}

                                    {/* Cursor ghost — amber directional indicator showing rotation before click */}
                                    {onPlacementClick && cursorCoords && boardInfo && (() => {
                                        const { px, py } = gerberToPixel(cursorCoords.x, cursorCoords.y, boardInfo.viewBox);
                                        return (
                                            <div
                                                className="absolute pointer-events-none z-[220]"
                                                style={{
                                                    left: px - GHOST_W / 2,
                                                    top: py - GHOST_H / 2,
                                                    width: GHOST_W,
                                                    height: GHOST_H,
                                                    transform: `rotate(${placingRotation}deg)`,
                                                    transformOrigin: '50% 50%',
                                                }}
                                            >
                                                {/* Body */}
                                                <div style={{
                                                    position: 'absolute',
                                                    inset: 0,
                                                    border: '2px solid #fbbf24',
                                                    backgroundColor: 'rgba(251,191,36,0.18)',
                                                    borderRadius: 3,
                                                    boxShadow: '0 0 8px rgba(251,191,36,0.5)',
                                                }} />
                                                {/* Pin-1 dot */}
                                                <div style={{
                                                    position: 'absolute',
                                                    width: 4, height: 4,
                                                    borderRadius: '50%',
                                                    backgroundColor: '#fbbf24',
                                                    boxShadow: '0 0 4px #fbbf24',
                                                    top: -6,
                                                    left: '50%',
                                                    transform: 'translateX(-50%)',
                                                }} />
                                                {/* Direction arrow */}
                                                <div style={{
                                                    position: 'absolute',
                                                    width: 0, height: 0,
                                                    borderLeft: '4px solid transparent',
                                                    borderRight: '4px solid transparent',
                                                    borderTop: '6px solid #fbbf24',
                                                    bottom: -7,
                                                    left: '50%',
                                                    transform: 'translateX(-50%)',
                                                }} />
                                            </div>
                                        );
                                    })()}

                                    <style>{`
                                        @keyframes pulse {
                                            0% { transform: scale(1); opacity: 0.8; }
                                            50% { transform: scale(1.5); opacity: 0.4; }
                                            100% { transform: scale(1); opacity: 0.8; }
                                        }
                                    `}</style>

                                    {/* Visual Origin Marker (Axes) */}
                                    {boardInfo && (
                                        <svg
                                            className="absolute inset-0 pointer-events-none overflow-visible"
                                            viewBox={boardInfo.viewBox.join(' ')}
                                            style={{ zIndex: 1000 }}
                                        >
                                            <g transform={`translate(0, ${boardInfo.viewBox[3] + 2 * boardInfo.viewBox[1]}) scale(1, -1)`}>
                                                <line x1="-10000" y1="0" x2="10000" y2="0" stroke="rgba(59, 130, 246, 0.5)" strokeWidth="2" strokeDasharray="10,10" />
                                                <line x1="0" y1="-10000" x2="0" y2="10000" stroke="rgba(59, 130, 246, 0.5)" strokeWidth="2" strokeDasharray="10,10" />
                                                <circle cx="0" cy="0" r="10" fill="#3b82f6" />
                                                <text x="15" y="-15" fill="#3b82f6" fontSize="40" fontWeight="bold" transform="scale(1, -1)">ORIGIN (0,0)</text>
                                            </g>
                                        </svg>
                                    )}

                                    {/* Dynamic spacer for board size */}
                                    <div style={{ width: boardWidth, height: boardHeight }} />
                                </div>
                            </TransformComponent>
                        </>
                    )}
                </TransformWrapper>

                {/* Live Coordinates HUD */}
                <div className="absolute bottom-4 left-4 text-xs font-mono bg-slate-900/80 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg z-10 flex items-center gap-3 text-slate-300 shadow-lg">
                    {cursorCoords ? (
                        <>
                            <div className="flex gap-1">
                                <span className="text-slate-500">X:</span>
                                <span className="text-blue-400 font-bold min-w-[3rem]">{formatCoord(cursorCoords.x)}</span>
                            </div>
                            <div className="flex gap-1">
                                <span className="text-slate-500">Y:</span>
                                <span className="text-blue-400 font-bold min-w-[3rem]">{formatCoord(cursorCoords.y)}</span>
                            </div>
                            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{displayUnits}</span>
                            {onPlacementClick && (
                                <>
                                    <span className="text-slate-700">|</span>
                                    <span className="text-amber-400 font-bold">{placingRotation}°</span>
                                </>
                            )}
                        </>
                    ) : (
                        <span className="text-slate-500 italic">Hover board for coords</span>
                    )}
                </div>

                {componentLocation && (
                    <div className="absolute top-4 left-4 text-[10px] text-blue-400 font-bold uppercase tracking-wider bg-blue-500/10 backdrop-blur px-3 py-1.5 rounded-full border border-blue-500/20 z-10 animate-pulse">
                        Auto-focused: {selectedComponent?.designator}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GerberViewer;
