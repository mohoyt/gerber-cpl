import React from 'react';
import { RotateCw, Layers, Check, ChevronRight } from 'lucide-react';

const PlacementControls = ({ currentComponent, onUpdatePlacement, onConfirm, displayUnits = 'mm', nativeUnits = 'in' }) => {
    if (!currentComponent) return null;

    const { placement, designator, comment } = currentComponent;
    const rotation = placement?.rotation || 0;
    const layer = placement?.layer || 'Top';

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

    const rotate = () => {
        const nextRotation = (rotation + 90) % 360;
        onUpdatePlacement({ rotation: nextRotation });
    };

    const toggleLayer = () => {
        const nextLayer = layer === 'Top' ? 'Bottom' : 'Top';
        onUpdatePlacement({ layer: nextLayer });
    };

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-600 rounded-2xl shadow-2xl p-4 flex items-center gap-6">
                <div className="flex flex-col border-r border-slate-700 pr-6">
                    <span className="text-blue-400 font-bold text-lg">{designator}</span>
                    <span className="text-slate-400 text-xs truncate max-w-[150px]">{comment}</span>
                    {placement && (
                        <span className="text-[10px] font-mono text-slate-500 mt-1">
                            X: {formatCoord(placement.x)} Y: {formatCoord(placement.y)} {displayUnits}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center gap-1">
                        <button
                            onClick={rotate}
                            className="p-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition-all active:scale-90"
                            title="Rotate 90°"
                        >
                            <RotateCw size={24} className="text-slate-200" />
                        </button>
                        <span className="text-[10px] font-mono text-slate-500">{rotation}°</span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <button
                            onClick={toggleLayer}
                            className={`p-3 rounded-xl transition-all active:scale-90 ${layer === 'Top' ? 'bg-orange-600/20 text-orange-400' : 'bg-blue-600/20 text-blue-400'
                                }`}
                            title="Toggle Layer"
                        >
                            <Layers size={24} />
                        </button>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">{layer}</span>
                    </div>
                </div>

                <button
                    onClick={onConfirm}
                    className="ml-4 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
                >
                    <Check size={20} />
                    Confirm
                </button>
            </div>
        </div>
    );
};

export default PlacementControls;

