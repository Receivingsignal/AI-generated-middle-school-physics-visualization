# Developer Guide: Physics Buoyancy Visualizer

## 1. Project Overview & Goals

**Purpose**: This web application serves as an interactive educational tool for visualizing and understanding buoyancy principles, commonly encountered in middle school physics. It aims to provide a dynamic alternative to static diagrams and problems.

**Core Features**:
-   **Dynamic Simulation**: Visual representation of a block in a container with adjustable liquid levels, tethered by a rope or free.
-   **Interactive Charting**: Real-time graphs displaying forces (pressure on block bottom, rope tension) as a function of liquid level.
-   **Parameter Control**: User-adjustable parameters for liquid level, rope length, block dimensions, block density, and liquid density.
-   **Scenario Variation**: Ability to simulate cutting the rope.
-   **Annotation**: Users can click on charts to add persistent annotations.

**Target Audience**: Students learning physics concepts, educators looking for demonstration tools.

**User Interface Language**: Chinese (中文).

## 2. File Structure & Key Components

```
. (Root Directory)
├── index.html             # Main HTML page structure, UI elements, script loading.
├── style.css              # CSS rules for layout, appearance, responsiveness.
├── script.js              # Core JavaScript: simulation logic, chart management, interactivity.
├── README.md              # General project information (bilingual).
├── DEVELOPER_GUIDE.md     # This document.
└── lib/                   # Local JavaScript libraries for offline use.
    ├── chart.js           # Chart.js library core.
    └── chartjs-plugin-annotation.min.js # Annotation plugin for Chart.js.
```

-   **`index.html`**: Defines the three-column layout (simulation, chart, controls). Contains all user-facing HTML elements (canvases, sliders, inputs, buttons) with Chinese labels. Loads `style.css`, then the `lib/` scripts, and finally `script.js`.
-   **`style.css`**: Implements the flexbox-based three-column layout. Styles UI elements for clarity, larger font sizes for accessibility (especially for classroom projection), and basic responsiveness. See comments within for details on specific sections like `.controls-area` font adjustments and checkbox scaling.
-   **`script.js`**: The heart of the application. Contains all dynamic logic. (See Section 3 for details).
-   **`lib/`**: Crucial for offline functionality. Contains local copies of Chart.js and its annotation plugin.

## 3. Core Logic in `script.js`

`script.js` is organized into several sections, executed after the DOM is fully loaded.

### 3.1. Global Scope & Initialization

-   **DOM Element Selection**: Constants are defined at the beginning to hold references to all necessary HTML elements (canvases, sliders, inputs, etc.).
-   **Constants**: `g` (gravity).
-   **`simParams` Object**: A central mutable object holding the current state of all adjustable simulation parameters (e.g., `liquidLevel_cm`, `blockDensity_kg_m3`). Values are typically updated by user controls.
-   **Chart State**: `currentChartType` (string: 'pressure' or 'tension'), `annotations` (array to store user-clicked chart annotations), `chartInstance` (holds the Chart.js object).
-   **Event Listener `DOMContentLoaded`**: Wraps the entire script to ensure DOM is ready.
    -   Calls `setupCanvases()` for initial sizing.
    -   Calls `initializeChart()` to create the Chart.js instance.
    -   Calls `updateAndDrawAll()` for the first render based on default parameters.
    -   Sets up a `resize` event listener on `window` to call `setupCanvases()` and `updateAndDrawAll()` for responsiveness.

### 3.2. Parameter Handling & UI Updates

-   **`createLink(slider, input, valueDisplay, paramName, isDensity)`**: 
    -   A utility function to synchronize a slider, its corresponding number input field, and a display span with a specific property in the `simParams` object.
    -   Adds `input` event listeners to both the slider and the number input.
    -   When a control changes, it updates `simParams[paramName]`, the linked display element's text, and the other linked control's value to maintain consistency.
    -   Critically, it calls `updateAndDrawAll()` after any parameter change.
-   **Event Listeners for Controls**: 
    -   Each parameter control (sliders, number inputs) is linked using `createLink()`.
    -   `cutRopeCheckbox` has its own `change` listener that updates `simParams.isRopeCut` and calls `updateAndDrawAll()`.
-   **`updateAndDrawAll()`**: 
    -   This is the primary function triggered after any parameter change or a window resize.
    -   It calls `updateChartData()` to regenerate and redraw the chart.
    -   It calls `drawSimulation()` to redraw the physics simulation canvas.

### 3.3. Physics Engine: `calculatePhysicsStep(...)`

This is the core calculation function. It takes the current simulation parameters (converted to SI units: meters, kg/m³) and returns an object containing calculated physical quantities.

-   **Inputs**: `hL_m` (liquid level), `L_R_m` (rope length), `S_m` (block side length), `rho_A_kg_m3` (block density), `rho_L_kg_m3` (liquid density), `isRopeCutScenario` (boolean), `g_val` (gravity).
-   **Initial Calculations**: `V_block_m3` (block volume), `A_block_m2` (block base area), `G_A_N` (block's weight).
-   **Logic based on `isRopeCutScenario`**:
    -   **If `!isRopeCutScenario` (Rope Attached)**:
        1.  **Determine Unconstrained Position (`y_B_unconstrained_m`)**: Calculates where the block's bottom would naturally rest if there were no rope. This considers if the block sinks (density > liquid or not enough liquid to float to its equilibrium depth) or floats at an equilibrium depth (`hL_m - submerged_depth_to_float_m`).
        2.  **Apply Rope Constraint**: The actual block bottom height `y_B_m` is `Math.min(y_B_unconstrained_m, L_R_m)`. This means the block cannot rise above `L_R_m` and will rest on the container bottom (`y_B_m = 0`) if `y_B_unconstrained_m` is zero and `L_R_m` is greater than zero (i.e., rope is slack).
        3.  **Recalculate Buoyant Force (`F_B_N`)**: Based on the actual `y_B_m` and the resulting submerged height of the block.
        4.  **Calculate Tension (`T_N`)**: Tension is non-zero only if the rope is taut and actively preventing the block from floating higher. This occurs if `y_B_unconstrained_m > L_R_m` (block wanted to be higher) and `y_B_m === L_R_m` (it's at the rope limit). `T_N` is then `F_B_N - G_A_N` (buoyancy less weight, effectively the net upward force the rope must counteract). Otherwise, `T_N` is 0.
    -   **If `isRopeCutScenario` (Rope Cut)**:
        1.  Determines if the block sinks (`G_A_N >= F_B_max_N`) or floats.
        2.  If it sinks, `y_B_m = 0`. `F_B_N` is based on submerged height (up to `S_m` or `hL_m`).
        3.  If it floats, calculates the `depthToFloat_m`. If `hL_m` is less than this, it rests on the bottom (`y_B_m = 0`); otherwise, `y_B_m = hL_m - depthToFloat_m` and `F_B_N = G_A_N`.
        4.  `T_N` is always 0.
-   **Pressure Force Calculation**: `F_P_bottom_N_corrected` (pressure force on the block's bottom surface) is `rho_L_kg_m3 * g_val * liquidDepthOverBottom_m * A_block_m2`, where `liquidDepthOverBottom_m` is `Math.max(0, hL_m - y_B_m)`.
-   **Return Object**: Contains `block_y_m`, `submergedHeight_m` (effective), `buoyantForce_N`, `gravityForce_N`, `tension_N`, `pressureForceBottom_N`.

### 3.4. Rendering Pipeline

-   **`setupCanvases()`**: 
    -   Sets the `width` and `height` of `physicsCanvas` and `dataChartCanvas`.
    -   `physicsCanvas` width is a percentage of its container; height aims for a 4:3 ratio or a max based on window height.
    -   `dataChartCanvas` width is a percentage; height is a percentage of its container or a max of 400px.
-   **`drawSimulation()`**: 
    -   Called by `updateAndDrawAll()`.
    -   Clears `ctxSim` (physics canvas context).
    -   **Scaling**: Calculates `scale` (pixels per cm) based on canvas dimensions and assumed maximum scene dimensions (e.g., 30-35cm) to ensure the simulation fits.
    -   **Drawing**: 
        -   Container: A rectangle.
        -   Liquid: A filled rectangle, height based on `simParams.liquidLevel_cm * scale`.
        -   Block: A filled and stroked rectangle. Its `blockDrawY` is calculated from `containerBaseY - (mToCm(currentPhysics.block_y_m) * scale) - blockHeight_px`. `currentPhysics` is obtained by calling `calculatePhysicsStep` with current `simParams`.
        -   Block Label 'A'.
        -   Rope: If `!simParams.isRopeCut`, a line is drawn from the block's bottom center to the container floor directly beneath it.
-   **`initializeChart()`**: 
    -   Creates the `chartInstance` using `new Chart(ctxChart, {...})`.
    -   **Type**: `'line'` for the main data.
    -   **Datasets**: 
        1.  Primary dataset for pressure/tension curve (type `line`). Initial label is for pressure.
        2.  Secondary dataset for the 'Current State' marker (type `scatter`), styled as a distinct point.
    -   **Options**: 
        -   `responsive: true`, `maintainAspectRatio: false`.
        -   `scales`: Configures x-axis (`'液面高度 h_L (cm)'`) and y-axis (`'力 (N)'`) with titles and tick font sizes.
        -   `plugins.tooltip.callbacks.label`: Customizes tooltips (hides for 'Current State' marker).
        -   `plugins.annotation.annotations`: Initialized as an empty array. This is where user-clicked annotations will be stored for the `chartjs-plugin-annotation` to render.
        -   `onClick: handleChartClick`.
-   **`updateChartData()`**: 
    -   Called by `updateAndDrawAll()`.
    -   Generates `hL_values_cm`, `pressure_force_values_N`, `tension_values_N` by looping `h_cm` from 0 to `liquidLevelSlider.max` and calling `calculatePhysicsStep` for each step.
    -   Updates `chartInstance.data.labels`.
    -   Updates the first dataset (`chartInstance.data.datasets[0]`) based on `currentChartType` (label, data, borderColor).
    -   Updates the second 'Current State' dataset (`chartInstance.data.datasets[1]`) with a single data point `{x: current_x_val, y: current_y_val}` derived from current `simParams`.
    -   Assigns the `annotations` array (managed by `handleChartClick`) to `chartInstance.options.plugins.annotation.annotations`.
    -   Calls `chartInstance.update()` to reflect all changes.

### 3.5. Interactivity

-   **`toggleChartBtn` Click Listener**: 
    -   Switches `currentChartType` between 'pressure' and 'tension'.
    -   Updates `toggleChartBtn.textContent` (Chinese labels).
    -   Clears the `annotations` array (user-added annotations are specific to a chart type).
    -   Calls `updateChartData()`.
-   **`handleChartClick(event)`**: 
    -   Attached to `chartInstance.options.onClick`.
    -   If a click occurs not on an existing chart element, it gets the clicked `x` coordinate (liquid level in cm) from the chart scale.
    -   Calculates the corresponding physics values (`yValue`) for that `clicked_hL_cm`.
    -   Creates an annotation object (type `'line'`, with label, arrowheads, etc.) using the schema for `chartjs-plugin-annotation`.
    -   Pushes this object to the `annotations` array.
    -   Calls `updateChartData()` to make the new annotation appear (as it updates `chartInstance.options.plugins.annotation.annotations`).
-   **`undoAnnotationBtn` Click Listener**: 
    -   Pops the last annotation from the `annotations` array.
    -   Calls `updateChartData()` to redraw the chart without the removed annotation.

## 4. Styling (`style.css`) Highlights

-   **Layout**: Primary use of CSS Flexbox for the three-column structure (`.app-container`, `.column`).
-   **Sizing**: Columns have `flex-basis` percentages to define their relative widths.
-   **Typography**: Base font size set on `body`. `.controls-area` has a slightly reduced base font, and its internal elements use `em` for relative sizing. Headings (`h2`) and buttons have larger font sizes for visibility.
-   **Controls Styling**: 
    -   `.control-group` for spacing.
    -   `input[type="checkbox"]` is scaled using `transform: scale(1.5)` for better touch target size.
-   **Canvas Sizing**: Canvases are set to `width: 90%` of their parent column, with height managed by JavaScript (`setupCanvases`) or `max-height`.
-   **Responsiveness**: A simple `@media (min-width: 1200px)` query increases some font sizes for larger screens. The canvas resizing in JS also contributes to responsiveness.

## 5. Potential Areas for Future Development

-   **Force Vector Visualization**: 
    -   In `drawSimulation()`, after drawing the block, calculate screen coordinates and scaled lengths for force vectors (Gravity, Buoyancy, Tension, Normal Force from container bottom if applicable).
    -   Draw arrows (lines with arrowheads) originating from the block's center of mass (for G) or points of application.
    -   Requires careful mapping of physics forces (Newtons) to visual lengths (pixels).
-   **Code Refinements & Organization**: 
    -   For larger projects, `script.js` could be split into modules (e.g., `physics.js`, `ui.js`, `chartInterface.js`) using ES6 modules (would require a build step or modern browser support for `<script type="module">`).
    -   Add more comprehensive error handling, especially for parsing user inputs.
    -   Consider a state management pattern if complexity grows significantly.
-   **Advanced Physics/Simulation Features**: 
    -   Allow selection from a list of predefined liquids or block materials.
    -   Make gravitational acceleration `g` an adjustable parameter.
    -   Introduce non-cubic block shapes or multiple blocks.
    -   Add options for container dimensions.
-   **UI/UX Enhancements**: 
    -   More polished visual design and CSS.
    -   Improved touch interactions, especially for sliders on touch devices.
    -   Saving/loading of simulation parameters (e.g., using localStorage).
    -   Exporting chart data (CSV) or simulation canvas (image).
-   **Internationalization (i18n)**: 
    -   While currently hardcoded to Chinese, a more robust i18n framework could be implemented to support multiple languages dynamically by storing string resources separately.

## 6. Dependencies

-   **Chart.js**: (`lib/chart.js`) - For drawing line and scatter charts.
    -   Official Site: [https://www.chartjs.org/](https://www.chartjs.org/)
-   **Chart.js Annotation Plugin**: (`lib/chartjs-plugin-annotation.min.js`) - For adding line and label annotations to Chart.js charts.
    -   GitHub: [https://github.com/chartjs/chartjs-plugin-annotation](https://github.com/chartjs/chartjs-plugin-annotation)

To ensure offline functionality, these libraries **must** be present in the `lib/` directory and correctly referenced in `index.html`. 