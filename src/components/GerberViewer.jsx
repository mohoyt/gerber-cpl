import React, { useState } from 'react';
import { TransformWrapper, TransformComponent, useTransformEffect } from 'react-zoom-pan-pinch';
import { Maximize, Minimize, RotateCcw, FlipHorizontal } from 'lucide-react';

const ZoomManager = ({ componentLocation, boardInfo }) => {
    useTransformEffect(({ setTransform }) => {
        if (componentLocation && boardInfo) {
            const [, minY, , height] = boardInfo.viewBox;
            const yTranslate = height + 2 * minY;

            // Convert Gerber coordinates back to SVG coordinates for zoomToElement or center
            const svgX = componentLocation.x * 1000;
            const svgY = yTranslate - (componentLocation.y * 1000);

            // Calculate scale based on board size (aim for ~100px zoom window)
            const zoomScale = 10;

            // Center the view on the component
            // Note: TransformWrapper's internal state needs to be updated. 
            // We use setTransform for direct control.
            const container = document.getElementById('gerber-container');
            if (container) {
                const rect = container.getBoundingClientRect();
                const targetX = (rect.width / 2) - (svgX * zoomScale);
                const targetY = (rect.height / 2) - (svgY * zoomScale);

                // Use smooth transition
                setTransform(targetX, targetY, zoomScale, 400, "easeOut");
            }
        }
    });
    return null;
};

const GerberViewer = ({ layers, boardInfo, isFlipped, onPlacementClick, onToggleLayer, selectedComponent, componentLocation, displayUnits = 'mm', nativeUnits = 'in' }) => {
    const [cursorCoords, setCursorCoords] = useState(null);

    // Combine visible layers into one view
    const visibleLayers = layers.filter(l => l.visible);

    const getGerberCoords = (e, svgElement) => {
        if (!boardInfo) return null;

        // Use SVG coordinates to get exact Gerber units
        const point = svgElement.createSVGPoint();
        point.x = e.clientX;
        point.y = e.clientY;

        // Convert screen coordinates to SVG coordinates
        const svgPoint = point.matrixTransform(svgElement.getScreenCTM().inverse());

        // Coordinate transformation matches gerber-to-svg's render.js:
        const [, minY, , height] = boardInfo.viewBox;
        const yTranslate = height + 2 * minY;

        let gerberX = svgPoint.x;
        let gerberY = yTranslate - svgPoint.y;

        // Convert mil (or 1/1000 units) back to base units (inch/mm)
        // Note: Plotter usually emits in 1/1000 of the units specified
        const finalX = gerberX / 1000;
        const finalY = gerberY / 1000;

        return { x: finalX, y: finalY };
    };

    const handleMouseMove = (e) => {
        if (!boardInfo) return;
        const svgElement = e.currentTarget.querySelector('svg');
        if (!svgElement) return;

        const coords = getGerberCoords(e, svgElement);
        if (coords) setCursorCoords(coords);
    };

    const handleBoardClick = (e) => {
        if (!onPlacementClick || !boardInfo) return;

        const svgElement = e.currentTarget.querySelector('svg');
        if (!svgElement) return;

        const coords = getGerberCoords(e, svgElement);
        if (coords) onPlacementClick(coords);
    };

    const formatCoord = (val) => {
        if (typeof val !== 'number') return '0.00';

        let displayVal = val;
        if (nativeUnits === 'in' && displayUnits === 'mm') {
            displayVal = val * 25.4;
        } else if (nativeUnits === 'mm' && displayUnits === 'in') {
            displayVal = val / 25.4;
        }

        return displayVal.toFixed(displayUnits === 'mm' ? 2 : 3);
    };


    const boardWidth = boardInfo ? boardInfo.width * 100 : 600; // Scaled for display
    const boardHeight = boardInfo ? boardInfo.height * 100 : 400;

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
                <TransformWrapper
                    initialScale={1}
                    minScale={0.1}
                    maxScale={30}
                    centerOnInit={true}
                >
                    {({ zoomIn, zoomOut, resetTransform }) => (
                        <>
                            <ZoomManager componentLocation={componentLocation} boardInfo={boardInfo} isFlipped={isFlipped} />
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

                                    {/* Component Highlight */}
                                    {componentLocation && boardInfo && (
                                        <div
                                            className="absolute pointer-events-none z-[200]"
                                            style={{
                                                left: componentLocation.x * 1000 - 10,
                                                top: (boardInfo.viewBox[3] + 2 * boardInfo.viewBox[1]) - (componentLocation.y * 1000) - 10,
                                                width: 20,
                                                height: 20,
                                                border: '2px solid #3b82f6',
                                                borderRadius: '50%',
                                                boxShadow: '0 0 10px #3b82f6, inset 0 0 10px #3b82f6',
                                                animation: 'pulse 1.5s infinite'
                                            }}
                                        />
                                    )}

                                    {/* Current Placement Preview */}
                                    {selectedComponent?.placement && boardInfo && (
                                        <div
                                            className="absolute pointer-events-none z-[210] flex items-center justify-center"
                                            style={{
                                                left: selectedComponent.placement.x * 1000 - 5,
                                                top: (boardInfo.viewBox[3] + 2 * boardInfo.viewBox[1]) - (selectedComponent.placement.y * 1000) - 5,
                                                width: 10,
                                                height: 10,
                                                backgroundColor: '#10b981',
                                                borderRadius: '2px',
                                                boxShadow: '0 0 10px #10b981',
                                                transform: `rotate(${selectedComponent.placement.rotation || 0}deg)`
                                            }}
                                        />
                                    )}

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
                                                {/* X Axis */}
                                                <line x1="-10000" y1="0" x2="10000" y2="0" stroke="rgba(59, 130, 246, 0.5)" strokeWidth="2" strokeDasharray="10,10" />
                                                {/* Y Axis */}
                                                <line x1="0" y1="-10000" x2="0" y2="10000" stroke="rgba(59, 130, 246, 0.5)" strokeWidth="2" strokeDasharray="10,10" />
                                                {/* Origin Dot */}
                                                <circle cx="0" cy="0" r="10" fill="#3b82f6" shadow="0 0 10px #3b82f6" />
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
                <div className="absolute bottom-4 left-4 text-xs font-mono bg-slate-900/80 backdrop-blur border border-slate-700 px-3 py-1.5 rounded-lg z-10 flex items-center gap-3 text-slate-300 shadow-lg transition-opacity duration-200">
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
