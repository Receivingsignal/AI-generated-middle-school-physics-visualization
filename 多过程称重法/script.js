// --- DOM Elements ---
const physicsCanvas = document.getElementById('physicsCanvas');
const chartCanvas = document.getElementById('chartCanvas');
const physicsCtx = physicsCanvas.getContext('2d');
const chartCtx = chartCanvas.getContext('2d');

const heightSlider = document.getElementById('heightSlider');
const heightInput = document.getElementById('heightInput');
const heightValueSpan = document.getElementById('heightValue');

const gravitySlider = document.getElementById('gravitySlider');
const gravityInput = document.getElementById('gravityInput');
const gravityValueSpan = document.getElementById('gravityValue');

const densitySlider = document.getElementById('densitySlider');
const densityInput = document.getElementById('densityInput');
const densityValueSpan = document.getElementById('densityValue');

const volumeSlider = document.getElementById('volumeSlider');
const volumeInput = document.getElementById('volumeInput');
const volumeValueSpan = document.getElementById('volumeValue');

const currentFSpan = document.getElementById('currentF');
const currentHSpan = document.getElementById('currentH');
const clickFSpan = document.getElementById('clickF');
const clickHSpan = document.getElementById('clickH');

// --- Constants and Simulation Parameters ---
const G_ACCEL = 10; // N/kg
// {{ edit_13_start }}
const CYLINDER_HEIGHT_M = 0.05; // Keep cylinder short: 5 cm
const CONTAINER_WIDTH_M = 0.1; // Make container narrower: 10 cm (was 0.2 initially)
// {{ edit_13_end }}
const CONTAINER_AREA_M2 = CONTAINER_WIDTH_M * CONTAINER_WIDTH_M; // Recalculated
const CYLINDER_AREA_M2 = 0.002; // m² (Keep cylinder area constant for now)

// --- State Variables ---
let currentHeightCm = parseFloat(heightSlider.value); // User controlled descent height h (cm)
let objectWeightN = parseFloat(gravitySlider.value); // G (N)
let liquidDensityKgM3 = parseFloat(densitySlider.value); // rho (kg/m³)
// {{ edit_1_start }}
// Change initial volume default to 1.8L
let initialLiquidVolumeL = 1.8; // V (Liters) - Renamed for clarity (was parseFloat(volumeSlider.value))
// {{ edit_1_end }}

// let clickedGraphCoords = null; // Store clicked coordinates {h, F} // Removed
let clickedPointsArray = []; // Store multiple clicked coordinates [{h, F}, ...] // Added

// --- Scaling for Physics Canvas ---
const physScale = 1500; // Pixels per meter (increased for better visibility)
// {{ edit_14_start }}
// Utilize more of the increased canvas height
const containerDrawHeight = physicsCanvas.height * 0.8; // Use 80% of canvas height (was 0.7)
const containerDrawWidth = CONTAINER_WIDTH_M * physScale; // Recalculated based on new width
// Adjust bottom position slightly for the taller canvas
const containerBottomY = physicsCanvas.height - 40; // Y coord of container bottom (was 30)
// {{ edit_14_end }}
const cylinderDrawWidth = Math.sqrt(CYLINDER_AREA_M2) * physScale; // Visual width
const cylinderDrawHeight = CYLINDER_HEIGHT_M * physScale; // Visual height based on new height
const springTopY = 30; // Start spring lower

// --- Scaling for Chart Canvas ---
const chartPadding = 70; // Increased padding for larger labels
const chartWidth = chartCanvas.width - 2 * chartPadding;
const chartHeight = chartCanvas.height - 2 * chartPadding;
const hMaxCm = 30; // Max h on chart x-axis
let FMaxN = Math.max(25, objectWeightN + 5); // Dynamic Max F on chart y-axis

// --- Helper Functions ---
function litersToCubicMeters(liters) {
    return liters / 1000;
}

function cmToM(cm) {
    return cm / 100;
}

function mToCm(m) {
    return m * 100;
}

// Calculate initial liquid level based on volume and container area
function calculateInitialLiquidLevelM() {
    const volumeM3 = litersToCubicMeters(initialLiquidVolumeL); // Use initial volume
    // Calculate height based on container base area
    const levelM = volumeM3 / CONTAINER_AREA_M2;
    // Ensure the initial level isn't higher than the container visual height
    // {{ edit_1_start }}
    // Use updated containerDrawHeight calculation
    const maxInitialLevelM = (containerDrawHeight / physScale) * 0.95; // Leave some headroom
    // {{ edit_1_end }}
    return Math.min(levelM, maxInitialLevelM);
}

// Calculate buoyant force and spring force based on descent height h (cm)
function calculateForces(hCm) {
    const initialLiquidLevelM = calculateInitialLiquidLevelM();
    const descentToTouchCm = 10;

    // {{ edit_2_start }}
    // Calculate the maximum effective height before hitting the bottom
    const hMaxEffectiveCm = mToCm(initialLiquidLevelM) + descentToTouchCm;
    // Use the smaller value between the input hCm and the effective maximum
    const effectiveHCm = Math.min(hCm, hMaxEffectiveCm);
    // {{ edit_2_end }}

    // Calculate how far the cylinder bottom is below the initial water surface level
    // {{ edit_3_start }}
    // Use effectiveHCm for calculations
    const potentialSubmersionCm = Math.max(0, effectiveHCm - descentToTouchCm);
    // {{ edit_3_end }}
    const potentialSubmersionM = cmToM(potentialSubmersionCm);

    // Actual submerged depth cannot exceed cylinder height
    const submergedDepthM = Math.min(potentialSubmersionM, CYLINDER_HEIGHT_M);

    const submergedVolumeM3 = CYLINDER_AREA_M2 * submergedDepthM;
    const buoyantForceN = liquidDensityKgM3 * G_ACCEL * submergedVolumeM3;
    const springForceN = Math.max(0, objectWeightN - buoyantForceN); // Force cannot be negative

    // Calculate the rise in water level due to displaced volume
    const displacedVolumeM3 = submergedVolumeM3;
    const liquidLevelRiseM = displacedVolumeM3 / CONTAINER_AREA_M2;
    const currentLiquidLevelM = initialLiquidLevelM + liquidLevelRiseM;

    // Return forces based on effectiveHCm, but also return other levels for drawing
    return { buoyantForceN, springForceN, submergedDepthM, currentLiquidLevelM, initialLiquidLevelM };
}

// --- Drawing Functions ---

// Draw Physics Scene
function drawPhysicsScene() {
    physicsCtx.clearRect(0, 0, physicsCanvas.width, physicsCanvas.height);
    physicsCtx.font = "18px Arial"; // Larger font for labels
    physicsCtx.fillStyle = "black";
    physicsCtx.textAlign = "center";

    // Get calculated values for the current height
    const { springForceN, submergedDepthM, currentLiquidLevelM, initialLiquidLevelM } = calculateForces(currentHeightCm);

    // --- Calculate Positions ---
    const containerTopY = containerBottomY - containerDrawHeight;
    const initialWaterLevelY = containerBottomY - initialLiquidLevelM * physScale;
    const descentToTouchCm = 10;
    const yAtH0 = initialWaterLevelY - cmToM(descentToTouchCm) * physScale;

    // Calculate current cylinder bottom Y: Start at h=0 position and move DOWN as h increases
    let cylinderBottomY = yAtH0 + cmToM(currentHeightCm) * physScale;
    let cylinderTopY = cylinderBottomY - cylinderDrawHeight;

    // Calculate current liquid level Y coordinate
    let currentLiquidLevelY = containerBottomY - currentLiquidLevelM * physScale;

    // --- Boundary Checks ---
    // Ensure liquid level doesn't visually exceed container top or go below bottom
    currentLiquidLevelY = Math.max(containerTopY, Math.min(currentLiquidLevelY, containerBottomY));

    // Ensure cylinder doesn't visually go below container bottom
    // This check is crucial for visual representation
    if (cylinderBottomY > containerBottomY) {
         cylinderBottomY = containerBottomY;
         cylinderTopY = cylinderBottomY - cylinderDrawHeight;
    }
     // Ensure cylinder doesn't visually go above the spring attachment point
     if (cylinderTopY < springTopY + 30) {
         cylinderTopY = springTopY + 30;
         cylinderBottomY = cylinderTopY + cylinderDrawHeight;
     }

    // --- Draw Elements ---
    const containerDrawX = (physicsCanvas.width - containerDrawWidth) / 2;

    // Draw Container
    physicsCtx.strokeStyle = "black";
    physicsCtx.lineWidth = 2;
    physicsCtx.strokeRect(containerDrawX, containerTopY, containerDrawWidth, containerDrawHeight);

    // Draw Liquid
    physicsCtx.fillStyle = "rgba(100, 149, 237, 0.7)"; // Cornflower blue
    const liquidHeightPx = containerBottomY - currentLiquidLevelY;
     if (liquidHeightPx > 0) {
        // Draw liquid only within the container bounds
        const liquidDrawY = Math.max(currentLiquidLevelY, containerTopY);
        const liquidDrawHeight = containerBottomY - liquidDrawY;
        physicsCtx.fillRect(containerDrawX + physicsCtx.lineWidth / 2, liquidDrawY, containerDrawWidth - physicsCtx.lineWidth, liquidDrawHeight);
     }

    // Draw Cylinder
    physicsCtx.fillStyle = "gray";
    const cylinderX = (physicsCanvas.width - cylinderDrawWidth) / 2;
    physicsCtx.fillRect(cylinderX, cylinderTopY, cylinderDrawWidth, cylinderDrawHeight);
    physicsCtx.strokeStyle = "black";
    physicsCtx.lineWidth = 1;
    physicsCtx.strokeRect(cylinderX, cylinderTopY, cylinderDrawWidth, cylinderDrawHeight);

    // Draw Spring Scale
    physicsCtx.strokeStyle = "red";
    physicsCtx.lineWidth = 3;
    physicsCtx.beginPath();
    physicsCtx.moveTo(physicsCanvas.width / 2, springTopY);
    physicsCtx.lineTo(physicsCanvas.width / 2, cylinderTopY); // Connect to current cylinder top
    physicsCtx.stroke();
    // Draw scale body
    physicsCtx.fillStyle = "lightyellow";
    physicsCtx.strokeStyle = "black";
    physicsCtx.lineWidth = 1;
    physicsCtx.fillRect(physicsCanvas.width / 2 - 20, springTopY - 15, 40, 30);
    physicsCtx.strokeRect(physicsCanvas.width / 2 - 20, springTopY - 15, 40, 30);
    physicsCtx.fillStyle = "black";
    physicsCtx.font = "14px Arial";
    physicsCtx.fillText(springForceN.toFixed(1) + " N", physicsCanvas.width / 2, springTopY + 5);

    // Draw Height Marker (h) - Relative to initial water level
    physicsCtx.strokeStyle = "green";
    physicsCtx.lineWidth = 1;
    physicsCtx.beginPath();
    // Line indicating initial water level
    physicsCtx.moveTo(containerDrawX + containerDrawWidth + 5, initialWaterLevelY);
    physicsCtx.lineTo(containerDrawX + containerDrawWidth + 25, initialWaterLevelY);
    // Line indicating current cylinder bottom
    physicsCtx.moveTo(containerDrawX + containerDrawWidth + 5, cylinderBottomY);
    physicsCtx.lineTo(containerDrawX + containerDrawWidth + 25, cylinderBottomY);
    // Vertical line connecting the two levels (representing h visually somewhat)
    physicsCtx.moveTo(containerDrawX + containerDrawWidth + 15, initialWaterLevelY - cmToM(descentToTouchCm)*physScale); // h=0 level approx
    physicsCtx.lineTo(containerDrawX + containerDrawWidth + 15, cylinderBottomY);
    physicsCtx.stroke();
    physicsCtx.fillStyle = "green";
    physicsCtx.textAlign = "left";
    physicsCtx.fillText(`h = ${currentHeightCm.toFixed(1)} cm`, containerDrawX + containerDrawWidth + 30, cylinderBottomY);
    physicsCtx.fillText(`(初始水面)`, containerDrawX + containerDrawWidth + 30, initialWaterLevelY);


}

// Draw Chart (F vs h)
function drawChart() {
    chartCtx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
    chartCtx.font = "16px Arial"; // Larger font for labels/ticks
    chartCtx.fillStyle = "black";
    chartCtx.textAlign = "center";
    chartCtx.textBaseline = "middle";

    // Update FMaxN based on current weight
    FMaxN = Math.max(25, objectWeightN + 5);

    // --- Draw Axes ---
    chartCtx.strokeStyle = "black";
    chartCtx.lineWidth = 2;
    // Y-axis (F)
    chartCtx.beginPath();
    chartCtx.moveTo(chartPadding, chartPadding);
    chartCtx.lineTo(chartPadding, chartCanvas.height - chartPadding);
    chartCtx.stroke();
    // X-axis (h)
    chartCtx.beginPath();
    chartCtx.moveTo(chartPadding, chartCanvas.height - chartPadding);
    chartCtx.lineTo(chartCanvas.width - chartPadding, chartCanvas.height - chartPadding);
    chartCtx.stroke();

    // --- Draw Labels and Ticks ---
    // Y-axis Label (F)
    chartCtx.save();
    chartCtx.translate(chartPadding / 2 - 10, chartCanvas.height / 2);
    chartCtx.rotate(-Math.PI / 2);
    chartCtx.fillText("弹簧测力计读数 F (N)", 0, 0);
    chartCtx.restore();

    // X-axis Label (h)
    chartCtx.fillText("物体下降高度 h (cm)", chartCanvas.width / 2, chartCanvas.height - chartPadding / 2 + 10);

    // Ticks (adjust number for clarity)
    const numYTicks = 6;
    const numXTicks = 7; // e.g., 0, 5, 10, 15, 20, 25, 30

    // Y-axis Ticks and Labels
    chartCtx.textAlign = "right";
    for (let i = 0; i <= numYTicks; i++) {
        const force = (i / numYTicks) * FMaxN;
        const y = chartCanvas.height - chartPadding - (force / FMaxN) * chartHeight;
        chartCtx.beginPath();
        chartCtx.moveTo(chartPadding - 5, y);
        chartCtx.lineTo(chartPadding, y);
        chartCtx.stroke();
        chartCtx.fillText(force.toFixed(1), chartPadding - 10, y);
    }

    // X-axis Ticks and Labels
    chartCtx.textAlign = "center";
    for (let i = 0; i <= numXTicks; i++) {
        const h = (i / numXTicks) * hMaxCm;
        const x = chartPadding + (h / hMaxCm) * chartWidth;
        chartCtx.beginPath();
        chartCtx.moveTo(x, chartCanvas.height - chartPadding);
        chartCtx.lineTo(x, chartCanvas.height - chartPadding + 5);
        chartCtx.stroke();
        chartCtx.fillText(h.toFixed(0), x, chartCanvas.height - chartPadding + 20);
    }

    // --- Plot Data ---
    chartCtx.strokeStyle = "blue";
    chartCtx.lineWidth = 2;
    chartCtx.beginPath();
    let firstPoint = true;

    for (let hCmPlot = 0; hCmPlot <= hMaxCm; hCmPlot += 0.1) { // Plot with fine steps
        const { springForceN } = calculateForces(hCmPlot);
        const x = chartPadding + (hCmPlot / hMaxCm) * chartWidth;
        const y = chartCanvas.height - chartPadding - (springForceN / FMaxN) * chartHeight;

        if (firstPoint) {
            chartCtx.moveTo(x, y);
            firstPoint = false;
        } else {
            chartCtx.lineTo(x, y);
        }
    }
    chartCtx.stroke();

    // --- Draw Current Point ---
    // {{ edit_4_start }}
    // Use calculateForces which now includes the bottom constraint for the force value
    const { springForceN: currentF } = calculateForces(currentHeightCm);
    // {{ edit_4_end }}
    const currentX = chartPadding + (currentHeightCm / hMaxCm) * chartWidth;
    // Y position is based on the potentially constrained force
    const currentY = chartCanvas.height - chartPadding - (currentF / FMaxN) * chartHeight;

    chartCtx.fillStyle = "red";
    chartCtx.beginPath();
    chartCtx.arc(currentX, currentY, 6, 0, 2 * Math.PI); // Larger point
    chartCtx.fill();
    // Label for current point
    chartCtx.fillStyle = "red";
    chartCtx.font = "bold 16px Arial";
    chartCtx.textAlign = "left";
    chartCtx.fillText(`(${currentHeightCm.toFixed(1)}, ${currentF.toFixed(1)})`, currentX + 10, currentY - 10);


    // --- Draw Clicked Point Markers ---
    clickHSpan.textContent = "?"; // Reset display initially
    clickFSpan.textContent = "?";

    chartCtx.fillStyle = "green";
    chartCtx.strokeStyle = "rgba(0, 128, 0, 0.7)";
    chartCtx.lineWidth = 1;
    chartCtx.font = "bold 14px Arial"; // Font for clicked point labels

    // Iterate through the array of clicked points
    clickedPointsArray.forEach((point, index) => {
        const clickX = chartPadding + (point.h / hMaxCm) * chartWidth;
        const clickY = chartCanvas.height - chartPadding - (point.F / FMaxN) * chartHeight;

        // Draw vertical line
        chartCtx.beginPath();
        chartCtx.moveTo(clickX, chartPadding);
        chartCtx.lineTo(clickX, chartCanvas.height - chartPadding);
        chartCtx.stroke();

        // Draw intersection point
        chartCtx.beginPath();
        chartCtx.arc(clickX, clickY, 5, 0, 2 * Math.PI);
        chartCtx.fill();

        // {{ edit_2_start }}
        // Display coordinates next to the clicked point on the chart
        chartCtx.fillStyle = "darkgreen"; // Use a slightly different color for text
        chartCtx.textAlign = "left"; // Align text to the right of the point
        chartCtx.textBaseline = "bottom"; // Align text slightly above the point vertically
        chartCtx.fillText(`(${point.h.toFixed(1)}, ${point.F.toFixed(1)})`, clickX + 8, clickY - 8); // Offset text slightly
        // {{ edit_2_end }}

        // Display coordinates of the *last* clicked point in the info div below the chart
        if (index === clickedPointsArray.length - 1) {
             clickHSpan.textContent = point.h.toFixed(1);
             clickFSpan.textContent = point.F.toFixed(1);
        }
    });

    // Update current info display (using the potentially constrained currentF)
    currentHSpan.textContent = currentHeightCm.toFixed(1);
    currentFSpan.textContent = currentF.toFixed(1);
}

// --- Event Listeners ---

function updateSimulation() {
    drawPhysicsScene();
    drawChart();
}

// Sliders and Inputs synchronization
heightSlider.addEventListener('input', (e) => {
    currentHeightCm = parseFloat(e.target.value);
    heightValueSpan.textContent = currentHeightCm.toFixed(1);
    heightInput.value = currentHeightCm.toFixed(1);
    // {{ edit_6_start }}
    // REMOVED: clickedGraphCoords = null;
    // {{ edit_6_end }}
    updateSimulation();
});
heightInput.addEventListener('change', (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) val = 0;
    val = Math.max(0, Math.min(hMaxCm, val));
    currentHeightCm = val;
    e.target.value = currentHeightCm.toFixed(1);
    heightValueSpan.textContent = currentHeightCm.toFixed(1);
    heightSlider.value = currentHeightCm;
    // {{ edit_7_start }}
    // REMOVED: clickedGraphCoords = null;
    // {{ edit_7_end }}
    updateSimulation();
});

gravitySlider.addEventListener('input', (e) => {
    objectWeightN = parseFloat(e.target.value);
    gravityValueSpan.textContent = objectWeightN.toFixed(1);
    gravityInput.value = objectWeightN.toFixed(1);
    // {{ edit_8_start }}
    // REMOVED: clickedGraphCoords = null;
    // {{ edit_8_end }}
    updateSimulation();
});
gravityInput.addEventListener('change', (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val) || val < 1) val = 1;
    val = Math.min(50, val);
    objectWeightN = val;
    e.target.value = objectWeightN.toFixed(1);
    gravityValueSpan.textContent = objectWeightN.toFixed(1);
    gravitySlider.value = objectWeightN;
    // {{ edit_9_start }}
    // REMOVED: clickedGraphCoords = null;
    // {{ edit_9_end }}
    updateSimulation();
});

densitySlider.addEventListener('input', (e) => {
    liquidDensityKgM3 = parseFloat(e.target.value);
    densityValueSpan.textContent = liquidDensityKgM3.toFixed(0);
    densityInput.value = liquidDensityKgM3.toFixed(0);
    // {{ edit_10_start }}
    // REMOVED: clickedGraphCoords = null;
    // {{ edit_10_end }}
    updateSimulation();
});
densityInput.addEventListener('change', (e) => {
    let val = parseFloat(e.target.value);
     if (isNaN(val) || val < 500) val = 500;
     val = Math.min(2000, val);
    liquidDensityKgM3 = val;
    e.target.value = liquidDensityKgM3.toFixed(0);
    densityValueSpan.textContent = liquidDensityKgM3.toFixed(0);
    densitySlider.value = liquidDensityKgM3;
    // {{ edit_11_start }}
    // REMOVED: clickedGraphCoords = null;
    // {{ edit_11_end }}
    updateSimulation();
});

// Volume listeners already correctly handled clickedPointsArray (no clearing needed)
volumeSlider.addEventListener('input', (e) => {
    initialLiquidVolumeL = parseFloat(e.target.value);
    volumeValueSpan.textContent = initialLiquidVolumeL.toFixed(1);
    volumeInput.value = initialLiquidVolumeL.toFixed(1);
    updateSimulation();
});
volumeInput.addEventListener('change', (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val) || val < 1) val = 1;
    val = Math.min(10, val);
    initialLiquidVolumeL = val;
    e.target.value = initialLiquidVolumeL.toFixed(1);
    volumeValueSpan.textContent = initialLiquidVolumeL.toFixed(1);
    volumeSlider.value = initialLiquidVolumeL;
    updateSimulation();
});


// Chart Click Listener (Correctly uses clickedPointsArray)
chartCanvas.addEventListener('click', (event) => {
    const rect = chartCanvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    if (mouseX >= chartPadding && mouseX <= chartCanvas.width - chartPadding &&
        mouseY >= chartPadding && mouseY <= chartCanvas.height - chartPadding) {

        const clickedHCm = ((mouseX - chartPadding) / chartWidth) * hMaxCm;
        // {{ edit_12_start }}
        // Calculate force using the potentially constrained value from calculateForces
        const { springForceN: clickedF } = calculateForces(clickedHCm);
        // {{ edit_12_end }}

        // Add the new point to the array
        clickedPointsArray.push({ h: clickedHCm, F: clickedF });

        drawChart(); // Redraw to show the new marker
    }
});

// Undo Button Listener (Correctly uses clickedPointsArray)
const undoButton = document.getElementById('undoButton'); // Make sure to add this button in HTML

undoButton.addEventListener('click', () => {
    if (clickedPointsArray.length > 0) {
        clickedPointsArray.pop(); // Remove the last added point
        drawChart(); // Redraw the chart without the last point
    }
});
// --- End of New Section ---


// --- Initial Draw ---
// {{ edit_3_start }}
// Ensure slider and input reflect the new initial volume on load
volumeSlider.value = initialLiquidVolumeL;
volumeInput.value = initialLiquidVolumeL.toFixed(1);
volumeValueSpan.textContent = initialLiquidVolumeL.toFixed(1);
// {{ edit_3_end }}
updateSimulation();