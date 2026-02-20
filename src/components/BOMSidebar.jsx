import React from 'react';
import { Upload, CheckCircle2, Circle, ArrowRight, Download, Scan } from 'lucide-react';
import Papa from 'papaparse';

const BOMSidebar = ({ bom, currentIdx, onBomUpload, onSelectComponent, onExport, onScan, displayUnits = 'mm', nativeUnits = 'in' }) => {
    const [fileName, setFileName] = React.useState('');

    const formatCoord = (val) => {
        if (typeof val !== 'number') return '0.00';

        let displayVal = val;
        // Convert if needed
        if (nativeUnits === 'in' && displayUnits === 'mm') {
            displayVal = val * 25.4;
        } else if (nativeUnits === 'mm' && displayUnits === 'in') {
            displayVal = val / 25.4;
        }

        return displayVal.toFixed(displayUnits === 'mm' ? 2 : 3);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setFileName(file.name);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.toLowerCase().trim(),
            complete: (results) => {
                // Headers: comment, designator, footprint, part number
                const normalizedBom = results.data.map(item => ({
                    comment: item.comment || '',
                    designator: (item.designator || '').trim(),
                    footprint: item.footprint || '',
                    partNumber: item['part number'] || item.partnumber || '',
                    placement: null // { x, y, rotation, layer }
                }));
                onBomUpload(normalizedBom);
            }
        });
    };

    const progress = bom.length > 0
        ? Math.round((bom.filter(item => item.placement).length / bom.length) * 100)
        : 0;

    return (
        <div className="w-80 h-full flex flex-col bg-slate-800 border-l border-slate-700 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-700">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">BOM Progress</h2>
                    {onScan && (
                        <button
                            onClick={onScan}
                            className="p-2 bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                            title="Scan board for component positions (OCR)"
                        >
                            <Scan size={18} />
                        </button>
                    )}
                </div>
                {bom.length === 0 ? (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-slate-700/50 transition-all group">
                        <Upload className="w-8 h-8 text-slate-400 group-hover:text-blue-400 mb-2" />
                        <span className="text-sm font-medium text-slate-400 group-hover:text-slate-200">Upload Component List</span>
                        <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                    </label>
                ) : (
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-sm font-semibold text-slate-400">{progress}% Complete</span>
                            <span className="text-xs font-mono text-slate-500">{bom.filter(i => i.placement).length}/{bom.length}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-1000 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {bom.map((item, idx) => (
                    <button
                        key={item.designator + idx}
                        onClick={() => onSelectComponent(idx)}
                        className={`w-full p-4 rounded-xl flex items-center justify-between text-left transition-all group ${currentIdx === idx
                            ? 'bg-blue-600/20 border border-blue-500/50'
                            : item.placement
                                ? 'bg-slate-700/30 border border-slate-700 hover:border-slate-600'
                                : 'bg-slate-800 border border-slate-700 hover:border-slate-600'
                            }`}
                    >
                        <div className="flex flex-col gap-1 overflow-hidden">
                            <span className={`font-bold truncate ${currentIdx === idx ? 'text-blue-400' : 'text-slate-200'}`}>
                                {item.designator}
                            </span>
                            <span className="text-xs text-slate-400 truncate">{item.comment}</span>
                            <span className="text-[10px] font-mono text-slate-500 truncate">{item.footprint}</span>
                            {item.placement && (
                                <span className="text-[10px] font-mono text-blue-400 mt-1">
                                    X: {formatCoord(item.placement.x)} Y: {formatCoord(item.placement.y)} {displayUnits}
                                    {item.placement.rotation !== undefined && item.placement.rotation !== 0 && (
                                        <span className="text-amber-400"> · {item.placement.rotation}°</span>
                                    )}
                                </span>
                            )}
                        </div>
                        <div className="shrink-0 flex items-center">
                            {item.placement ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />

                            ) : currentIdx === idx ? (
                                <ArrowRight className="w-5 h-5 text-blue-400 animate-pulse" />
                            ) : (
                                <Circle className="w-5 h-5 text-slate-600 group-hover:text-slate-500" />
                            )}
                        </div>
                    </button>
                ))}
            </div>

            {bom.length > 0 && (
                <div className="p-4 bg-slate-900/50 border-t border-slate-700">
                    <button
                        onClick={() => onExport(fileName)}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
                    >
                        <Download size={20} />
                        Export CPL
                    </button>
                    {bom.some(i => !i.placement) && (
                        <p className="mt-2 text-[10px] text-center text-slate-500 italic">
                            Some components are unplaced. Exporting unfinished CPL.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default BOMSidebar;
