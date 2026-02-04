import React, { useState } from 'react';
import GerberViewer from './components/GerberViewer';
import BOMSidebar from './components/BOMSidebar';
import PlacementControls from './components/PlacementControls';
import { processGerberZip, runOCRProcess } from './lib/gerber-logic';
import { exportCPL } from './lib/exporter';
import { Upload, UploadCloud, Cpu, Info, FileCode } from 'lucide-react';

function App() {
  const [layers, setLayers] = useState([]);
  const [boardInfo, setBoardInfo] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [bom, setBom] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing...');
  const [componentLocations, setComponentLocations] = useState({});
  const [displayUnits, setDisplayUnits] = useState('mm'); // 'mm' or 'in'

  const handleGerberUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setLoadingMessage('Initializing...');
    try {
      const result = await processGerberZip(file, (msg) => {
        setLoadingMessage(msg);
      });
      setLayers(result.layers);
      setBoardInfo(result.boardInfo);

      // Auto-detect unit preference? Maybe just default to mm.

      setComponentLocations({}); // Reset locations since OCR is now manual

    } catch (error) {
      console.error(error);
      alert("Error processing Gerber file");
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleScanComponents = async () => {
    if (layers.length === 0 || !boardInfo) {
      alert("Please upload Gerber files first.");
      return;
    }

    if (bom.length === 0) {
      alert("Please upload a BOM first. We need to know which components to look for.");
      return;
    }

    setIsLoading(true);
    try {
      const designators = bom.map(b => b.designator);
      const locations = await runOCRProcess(layers, boardInfo, (msg) => setLoadingMessage(msg), designators);
      setComponentLocations(locations);

      if (Object.keys(locations).length === 0) {
        alert("No matching component references found on silkscreen layers.");
      }
    } catch (err) {
      console.error(err);
      alert("Error during OCR scanning.");
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };


  const handleSelection = (idx) => {
    setCurrentIdx(idx);

    // Auto-flip if component is only found on the other side
    const component = bom[idx];
    if (component && componentLocations[component.designator]) {
      const loc = componentLocations[component.designator];
      if (loc.layerType === 'Bottom Silkscreen' && !isFlipped) {
        setIsFlipped(true);
      } else if (loc.layerType === 'Top Silkscreen' && isFlipped) {
        setIsFlipped(false);
      }
    }
  };

  const handlePlacementClick = (coords) => {
    if (currentIdx === -1) return;

    const newBom = [...bom];
    newBom[currentIdx].placement = {
      ...newBom[currentIdx].placement,
      x: coords.x,
      y: coords.y,
      rotation: newBom[currentIdx].placement?.rotation || 0,
      layer: isFlipped ? 'Bottom' : 'Top'
    };
    setBom(newBom);

    // Auto-advance to next item immediately
    const nextIdx = newBom.findIndex((item, i) => i > currentIdx && !item.placement);
    if (nextIdx !== -1) {
      setCurrentIdx(nextIdx);
    } else {
      // If no next unplaced item, find any unplaced
      const firstUnplaced = newBom.findIndex(item => !item.placement);
      if (firstUnplaced !== -1) {
        setCurrentIdx(firstUnplaced);
      }
    }
  };

  const updatePlacement = (updates) => {
    const newBom = [...bom];
    newBom[currentIdx].placement = {
      ...newBom[currentIdx].placement,
      ...updates
    };
    setBom(newBom);
  };

  const confirmPlacement = () => {
    // Auto-advance to next item
    const nextIdx = bom.findIndex((item, i) => i > currentIdx && !item.placement);
    if (nextIdx !== -1) {
      setCurrentIdx(nextIdx);
    } else {
      // If no next unplaced item, find any unplaced
      const firstUnplaced = bom.findIndex(item => !item.placement);
      setCurrentIdx(firstUnplaced);
    }
  };

  const toggleLayer = (idx) => {
    const newLayers = [...layers];
    newLayers[idx].visible = !newLayers[idx].visible;
    setLayers(newLayers);
  };


  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-slate-900/50 backdrop-blur-xl z-20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-900/20">
              <Cpu size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                Gerber to CPL
              </h1>
              <p className="text-[10px] text-slate-500 font-medium tracking-wider uppercase">
                PCBA Manufacturing Utility
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Unit Toggle */}
            <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button
                onClick={() => setDisplayUnits('mm')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${displayUnits === 'mm'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                MM
              </button>
              <button
                onClick={() => setDisplayUnits('in')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${displayUnits === 'in'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                IN
              </button>
            </div>

            {layers.length > 0 && (
              <button
                onClick={() => setIsFlipped(!isFlipped)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${isFlipped
                  ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/30'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
              >
                {isFlipped ? 'Bottom View' : 'Top View'}
              </button>
            )}

            <label className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-semibold cursor-pointer transition-all active:scale-95 shadow-lg">
              <Upload size={18} />
              {layers.length > 0 ? 'Update Gerbers' : 'Upload Gerbers (.zip)'}
              <input type="file" className="hidden" accept=".zip" onChange={handleGerberUpload} />
            </label>
          </div>
        </header>

        {/* Viewer Section */}
        <div className="flex-1 relative p-6 flex flex-col min-h-0">
          {layers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.02] group">
              <div className="w-20 h-20 mb-6 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/10 group-hover:scale-110 group-hover:border-blue-500/50 transition-all duration-500">
                <FileCode size={40} className="text-slate-500 group-hover:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-200 mb-2">Ready to Start</h3>
              <p className="text-slate-500 text-center max-w-sm mb-8 leading-relaxed">
                Upload your PCB Gerber zip file to begin interactive component placement.
              </p>
              <label className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl cursor-pointer shadow-xl shadow-blue-900/20 transition-all active:scale-95">
                Select Gerber ZIP
                <input type="file" className="hidden" accept=".zip" onChange={handleGerberUpload} />
              </label>
            </div>
          ) : (
            <>
              <GerberViewer
                layers={layers}
                boardInfo={boardInfo}
                isFlipped={isFlipped}
                onPlacementClick={currentIdx !== -1 ? handlePlacementClick : null}
                onToggleLayer={toggleLayer}
                selectedComponent={currentIdx !== -1 ? bom[currentIdx] : null}
                componentLocation={currentIdx !== -1 && bom[currentIdx] ? componentLocations[bom[currentIdx].designator] : null}
                displayUnits={displayUnits}
                nativeUnits={boardInfo?.units || 'in'}
              />

              {currentIdx !== -1 && (
                <PlacementControls
                  currentComponent={bom[currentIdx]}
                  onUpdatePlacement={updatePlacement}
                  onConfirm={confirmPlacement}
                  displayUnits={displayUnits}
                  nativeUnits={boardInfo?.units || 'in'}
                />
              )}
            </>
          )}

          {/* Help Overlay */}
          <div className="absolute top-10 left-10 flex items-center gap-2 text-[11px] text-slate-500 bg-slate-900/40 backdrop-blur px-3 py-1.5 rounded-full border border-white/5">
            <Info size={14} />
            <span>Click on the board to place {currentIdx !== -1 ? bom[currentIdx].designator : 'components'}</span>
          </div>
        </div>
      </main>

      {/* Sidebar */}
      <BOMSidebar
        bom={bom}
        currentIdx={currentIdx}
        onBomUpload={setBom}
        onSelectComponent={handleSelection}
        onExport={(bomFileName) => exportCPL(bom, bomFileName, displayUnits, boardInfo?.units || 'in')}
        onScan={handleScanComponents}
        displayUnits={displayUnits}
        nativeUnits={boardInfo?.units || 'in'}
      />


      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin text-blue-500">
              <UploadCloud size={48} />
            </div>
            <div className="text-xl font-semibold text-slate-200">{loadingMessage}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
