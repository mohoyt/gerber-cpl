# Agent Guide to Gerber CPL Codebase

## Project Overview
This project is a React-based web application designed to help users generate accurate Component Placement Lists (CPL) for PCBA manufacturing. It visualizes Gerber files (PCB design files) and aids in assigning coordinates (centroids) to components listed in a BOM (Bill of Materials).

## Core Technologies
- **Framework**: React (Vite)
- **Styling**: TailwindCSS
- **Gerber Parsing/Rendering**: `@tracespace/parser`, `@tracespace/renderer`, `@tracespace/plotter`
- **OCR**: `tesseract.js` (for scanning component designators on silkscreen)
- **Icons**: `lucide-react`

## Architecture & State
The application state is primarily centralized in `src/App.jsx` and passed down to child components.

### Key State Objects (`src/App.jsx`)
- `layers`: Array of parsed Gerber layers (SVG data).
- `bom`: Array of BOM items (Designator, Footprint, etc.).
- `componentLocations`: Map of designators to detected locations (from OCR).
- `currentIdx`: Index of the currently selected component in the BOM.
- `displayUnits`: current display unit ('mm' or 'in').

### Folder Structure
- `src/components`: UI components.
  - `GerberViewer.jsx`: Main canvas for PCB visualization.
  - `BOMSidebar.jsx`: Sidebar for BOM management and component selection.
  - `PlacementControls.jsx`: UI for fine-tuning component coordinates.
- `src/lib`: Core logic.
  - `gerber-logic.js`: Functions to unzip and parse Gerber files, and run OCR logic.
  - `exporter.js`: Functions to format and download the final CPL CSV.

## Key Workflows

### 1. Gerber Processing
- User uploads a `.zip` file.
- `processGerberZip` (`gerber-logic.js`) extracts and parses common Gerber extensions.
- Layers are categorized (Top Copper, Silkscreen, etc.) and converted to SVG-compatible formats.

### 2. Component Placement
- User Uploads a BOM (CSV).
- **Manual Mode**: User clicks on the viewer. `handlePlacementClick` updates the `bom` state with `x`, `y` coordinates.
- **OCR Mode**: `handleScanComponents` uses Tesseract to read text from Silkscreen layers to find designators (e.g., "R1", "C2") and estimate their centroids.

### 3. Coordinate Systems & Units
- The backend/logic mostly treats coordinates in the native unit of the Gerber file (often inches).
- `displayUnits` controls the *presentation* to the user.
- **Important**: When exporting or displaying, always check `displayUnits` vs the `boardInfo.units` to perform necessary conversions.

## Common Tasks for Agents
- **Adding new Gerber layer support**: Check `src/lib/gerber-logic.js` layer inference logic.
- **Improving OCR**: Adjust Tesseract parameters or image preprocessing in `src/lib/gerber-logic.js`.
- **UI Tweaks**: Most visual changes happen in the `src/components` directory or `App.jsx`.

## Verification & Testing Strategy

Since this project primarily utilizes manual verification, follow these steps to valid functionality after code changes:

### 1. Prerequisite Checks
- Run `npm run lint` to ensure no syntax or code style errors.
- Ensure the app launches with `npm run dev` without console errors.

### 2. Manual Test Script
1.  **Load Reference Files**:
    - Use the provided `uOC1.1 Gerber.zip` and `uO_C BOM 1.1 - BOM.csv` in the root directory.
2.  **Verify Gerber Parsing**:
    - Upload the zip.
    - Confirm visually that Top Copper, Bottom Copper, and Silkscreen layers appear.
    - Check that the "Layer List" on the right (or flipped view) shows checkboxes for toggling visibility.
3.  **Verify BOM Import**:
    - Upload the CSV.
    - Confirm the sidebar populates with a list of components (e.g., C1, R1, U1).
4.  **Test Placement (Manual)**:
    - Click "R1" in the sidebar.
    - Click a location on the board.
    - **Expected**: A marker appears, and the selection auto-advances to the next component.
5.  **Test Unit Conversion**:
    - Toggle "MM" / "IN" at the top right.
    - **Expected**: The coordinates in the sidebar and placement controls update values to reflect the chosen unit.
6.  **Test OCR (Optional)**:
    - Click "Scan Components" in the sidebar.
    - **Expected**: Loading indicator appears, then markers populate automatically for found designators.
7.  **Test Export**:
    - Click "Export CPL".
    - Open the downloaded CSV.
    - **Expected**: Columns for Designator, Mid X, Mid Y, Rotation, Layer. Values should match what was seen in the UI.

### 3. Edge Cases
- **Missing Files**: Upload a zip with no valid gerber extensions. App should alert/handle gracefully.
- **Malformed BOM**: Upload a CSV without a "Detail.Designator" or "Designator" column. App should alert.

