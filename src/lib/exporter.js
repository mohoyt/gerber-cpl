import Papa from 'papaparse';

export async function exportCPL(bom, originalFileName = '', displayUnits = 'mm', nativeUnits = 'in') {
    const convert = (val) => {
        if (val === undefined || val === null) return '';
        if (typeof val !== 'number') return val;

        let displayVal = val;
        // Convert if needed
        if (nativeUnits === 'in' && displayUnits === 'mm') {
            displayVal = val * 25.4;
        } else if (nativeUnits === 'mm' && displayUnits === 'in') {
            displayVal = val / 25.4;
        }
        return displayVal.toFixed(displayUnits === 'mm' ? 2 : 3);
    };

    const data = bom.map(item => ({
        'Designator': item.designator,
        'Value': item.comment,
        'Mid X': convert(item.placement?.x),
        'Mid Y': convert(item.placement?.y),
        'Layer': item.placement?.layer || '',
        'Rotation': item.placement?.rotation !== undefined ? item.placement.rotation : ''
    }));

    const csvContent = Papa.unparse(data);
    const csvWithBOM = "\uFEFF" + csvContent;


    // Generate filename
    let exportName = 'component_placement';
    if (originalFileName) {
        const nameWithoutExt = originalFileName.replace(/\.[^/.]+$/, "");
        exportName = nameWithoutExt.replace(/BOM/i, 'CPL');
        if (exportName === nameWithoutExt) {
            exportName += '_CPL';
        }
    } else {
        exportName += `_${new Date().toISOString().split('T')[0]}`;
    }

    const safeName = exportName.replace(/\./g, '_').replace(/_csv$/, '') + '.csv';

    // Method 1: Modern File System Access API (Best for Chrome)
    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: safeName,
                types: [{
                    description: 'CSV File',
                    accept: { 'text/csv': ['.csv'] },
                }],
            });
            const writable = await handle.createWritable();
            await writable.write(csvWithBOM);
            await writable.close();
            return; // Success!
        } catch (err) {
            // User cancelled or security error - fallback if it's not a cancellation
            if (err.name === 'AbortError') return;
            console.error('File System API failed, falling back:', err);
        }
    }

    // Method 2: Robust Fallback with explicit trigger
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = safeName;
    link.style.display = 'none';

    document.body.appendChild(link);

    // Use an explicit event for maximum compatibility
    const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
    });
    link.dispatchEvent(clickEvent);

    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 1000);
}
