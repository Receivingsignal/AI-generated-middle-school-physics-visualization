// 物理浮力可视化器主脚本
// Physics Buoyancy Visualizer Main Script

document.addEventListener('DOMContentLoaded', () => {
    // 获取DOM元素 / Get DOM elements
    const physicsCanvas = document.getElementById('physicsCanvas');
    const ctxSim = physicsCanvas.getContext('2d');
    const dataChartCanvas = document.getElementById('dataChart');
    const ctxChart = dataChartCanvas.getContext('2d');

    // 控制面板元素 / Control panel elements
    const liquidLevelSlider = document.getElementById('liquidLevelSlider');
    const liquidLevelInput = document.getElementById('liquidLevelInput');
    const liquidLevelValueDisplay = document.getElementById('liquidLevelValue');
    const ropeLengthSlider = document.getElementById('ropeLengthSlider');
    const ropeLengthInput = document.getElementById('ropeLengthInput');
    const ropeLengthValueDisplay = document.getElementById('ropeLengthValue');
    const blockHeightSlider = document.getElementById('blockHeightSlider');
    const blockHeightInput = document.getElementById('blockHeightInput');
    const blockHeightValueDisplay = document.getElementById('blockHeightValue');
    const blockDensitySlider = document.getElementById('blockDensitySlider');
    const blockDensityInput = document.getElementById('blockDensityInput');
    const blockDensityValueDisplay = document.getElementById('blockDensityValue');
    const liquidDensitySlider = document.getElementById('liquidDensitySlider');
    const liquidDensityInput = document.getElementById('liquidDensityInput');
    const liquidDensityValueDisplay = document.getElementById('liquidDensityValue');
    const cutRopeCheckbox = document.getElementById('cutRopeCheckbox');
    const toggleChartBtn = document.getElementById('toggleChartBtn');
    const undoAnnotationBtn = document.getElementById('undoAnnotationBtn');

    // 常量 / Constants
    const g = 10; // 重力加速度 / Gravity acceleration (N/kg)

    // 仿真参数对象 / Simulation parameter object
    let simParams = {
        liquidLevel_cm: parseFloat(liquidLevelSlider.value),        // 液面高度 / Liquid level
        ropeLength_cm: parseFloat(ropeLengthSlider.value),         // 细绳长度 / Rope length
        blockHeight_cm: parseFloat(blockHeightSlider.value),       // 物块边长 / Block side length
        blockDensity_kg_m3: parseFloat(blockDensitySlider.value),  // 物块密度 / Block density
        liquidDensity_kg_m3: parseFloat(liquidDensitySlider.value),// 液体密度 / Liquid density
        isRopeCut: cutRopeCheckbox.checked                        // 是否剪断细绳 / Rope cut
    };

    let currentChartType = 'pressure'; // 当前图表类型 / Current chart type
    let annotations = [];              // 标注数组 / Annotation array
    let chartInstance;                 // Chart.js实例 / Chart.js instance

    // 单位换算工具 / Unit conversion utilities
    const cmToM = (cm) => cm / 100;
    const mToCm = (m) => m * 100;

    // 画布初始化 / Canvas setup
    function setupCanvases() {
        // Physics Simulation Canvas
        const simContainer = document.querySelector('.physics-simulation-area');
        physicsCanvas.width = simContainer.clientWidth * 0.9;
        // Maintain a 4:3 aspect ratio for sim canvas, or fixed height
        const simHeight = Math.min(physicsCanvas.width * (3/4), window.innerHeight * 0.5);
        physicsCanvas.height = simHeight;


        // Chart Canvas - Chart.js handles its own sizing mostly
        const chartContainer = document.querySelector('.chart-area');
        dataChartCanvas.width = chartContainer.clientWidth * 0.9;
        dataChartCanvas.height = Math.min(chartContainer.clientHeight * 0.7, 400); // Max height 400px
    }

    // 滑块与输入框联动 / Link slider and input
    function createLink(slider, input, valueDisplay, paramName, isDensity = false) {
        const updateSimParam = (valueStr) => {
            const value = parseFloat(valueStr);
            if (isNaN(value)) return;
            simParams[paramName] = value;
            valueDisplay.textContent = value.toFixed(isDensity ? 0 : 1);
            if (slider.value !== valueStr) slider.value = valueStr;
            if (input.value !== valueStr) input.value = valueStr;
            updateAndDrawAll();
        };
        slider.addEventListener('input', (e) => updateSimParam(e.target.value));
        input.addEventListener('input', (e) => updateSimParam(e.target.value));
    }

    createLink(liquidLevelSlider, liquidLevelInput, liquidLevelValueDisplay, 'liquidLevel_cm');
    createLink(ropeLengthSlider, ropeLengthInput, ropeLengthValueDisplay, 'ropeLength_cm');
    createLink(blockHeightSlider, blockHeightInput, blockHeightValueDisplay, 'blockHeight_cm');
    createLink(blockDensitySlider, blockDensityInput, blockDensityValueDisplay, 'blockDensity_kg_m3', true);
    createLink(liquidDensitySlider, liquidDensityInput, liquidDensityValueDisplay, 'liquidDensity_kg_m3', true);

    cutRopeCheckbox.addEventListener('change', (e) => {
        simParams.isRopeCut = e.target.checked;
        updateAndDrawAll();
    });

    // 物理计算主函数 / Main physics calculation
    // 输入均为SI单位，输出包含物块位置、浮力、重力、拉力、底部压力等
    function calculatePhysicsStep(hL_m, L_R_m, S_m, rho_A_kg_m3, rho_L_kg_m3, isRopeCutScenario, g_val) {
        // 体积、面积、重力 / Volume, area, gravity
        const V_block_m3 = S_m * S_m * S_m;
        const A_block_m2 = S_m * S_m;
        const G_A_N = rho_A_kg_m3 * V_block_m3 * g_val;

        let y_B_m; // 物块底面离容器底的高度 / Block bottom height from container bottom
        let F_B_N; // 浮力 / Buoyant force
        let T_N = 0; // 细绳拉力 / Rope tension

        if (!isRopeCutScenario) { // 细绳未剪断 / Rope attached
            // 计算无绳时物块"自然"位置 / Unconstrained (no rope) block position
            let y_B_unconstrained_m;
            const submerged_depth_to_float_m = (G_A_N / (rho_L_kg_m3 * g_val * A_block_m2));
            if (submerged_depth_to_float_m > S_m) {
                y_B_unconstrained_m = 0; // 密度大于液体，沉底 / Sinks
            } else if (hL_m < submerged_depth_to_float_m) {
                y_B_unconstrained_m = 0; // 液面太低，沉底 / Not enough liquid, rests on bottom
            } else {
                y_B_unconstrained_m = hL_m - submerged_depth_to_float_m; // 浮在平衡高度 / Floats at equilibrium
            }
            y_B_unconstrained_m = Math.max(0, y_B_unconstrained_m);
            // 细绳约束：不能高于细绳长度 / Rope constraint: cannot rise above rope length
            y_B_m = Math.min(y_B_unconstrained_m, L_R_m);
            // 重新计算浮力 / Recalculate buoyancy at actual position
            const depthOfBlockBottom_from_surface_m = Math.max(0, hL_m - y_B_m);
            const submergedBlockHeight_m_actual = Math.min(depthOfBlockBottom_from_surface_m, S_m);
            F_B_N = rho_L_kg_m3 * g_val * A_block_m2 * submergedBlockHeight_m_actual;
            // 拉力：仅当物块想浮得更高但被绳子拉住时 / Tension only if block wants to float higher than rope allows
            if (y_B_unconstrained_m > L_R_m && y_B_m === L_R_m) {
                T_N = Math.max(0, F_B_N - G_A_N);
            } else {
                T_N = 0;
            }
        } else { // 细绳已剪断 / Rope cut
            const F_B_max_N = rho_L_kg_m3 * g_val * V_block_m3; // Max buoyancy if fully submerged

            if (G_A_N >= F_B_max_N) { // Sinks or stays at bottom
                y_B_m = 0;
                const submergedBlockHeight_m = Math.min(S_m, hL_m);
                F_B_N = rho_L_kg_m3 * g_val * A_block_m2 * submergedBlockHeight_m;
            } else { // Floats
                const depthToFloat_m = G_A_N / (rho_L_kg_m3 * g_val * A_block_m2);
                if (hL_m < depthToFloat_m) { // Not enough liquid to float freely, rests on bottom
                    y_B_m = 0;
                    const submergedBlockHeight_m = Math.min(S_m, hL_m);
                    F_B_N = rho_L_kg_m3 * g_val * A_block_m2 * submergedBlockHeight_m;
                } else { // Floats freely
                    y_B_m = hL_m - depthToFloat_m;
                    F_B_N = G_A_N; // Buoyancy equals gravity
                }
            }
            T_N = 0; // No tension when rope is cut
        }
        
        const pressureAtBottom_Pa = rho_L_kg_m3 * g_val * Math.max(0, hL_m - y_B_m);
        const F_P_bottom_N = pressureAtBottom_Pa * A_block_m2;
        
        // Correction: F_P_bottom_N calculation should consider only if block bottom is wet.
        // And the pressure is due to liquid *above* the bottom face *up to the liquid surface*.
        // The depth for pressure calc is (hL_m - y_B_m) IF y_B_m < hL_m, otherwise 0.
        // And this depth should not be more than S_m for pressure *on the block's face*
        // No, pressure force on bottom is simpler: P_bottom * Area = (rho_L * g * depth_of_bottom_face_from_surface) * Area
        let liquidDepthOverBottom_m = Math.max(0, hL_m - y_B_m);
        // If block bottom is above liquid surface, liquidDepthOverBottom_m is negative or zero from max(0, ...), so pressure force is 0. Correct.
        const F_P_bottom_N_corrected = rho_L_kg_m3 * g_val * liquidDepthOverBottom_m * A_block_m2;


        return {
            block_y_m: y_B_m,
            submergedHeight_m: (F_B_N / (rho_L_kg_m3 * g_val * A_block_m2)), // Effective submerged height
            buoyantForce_N: F_B_N,
            gravityForce_N: G_A_N,
            tension_N: T_N,
            pressureForceBottom_N: F_P_bottom_N_corrected
        };
    }

    // 图表初始化 / Chart initialization
    function initializeChart() {
        chartInstance = new Chart(ctxChart, {
            type: 'line',
            data: {
                labels: [], // h_L values in cm
                datasets: [
                    {
                        label: '物块底部压力 (N)', // Main data series (Pressure Force on Bottom)
                        data: [], 
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1,
                        yAxisID: 'y',
                    },
                    {
                        label: '当前状态', // Current State
                        data: [], 
                        type: 'scatter',
                        pointRadius: 7,
                        pointStyle: 'rectRot', 
                        pointBackgroundColor: 'rgba(255, 0, 0, 0.8)',
                        pointBorderColor: 'rgba(150, 0, 0, 1)',
                        pointBorderWidth: 2,
                        yAxisID: 'y',
                        order: -1 
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: '液面高度 h_L (cm)', font: { size: 15, weight: 'bold' } }, // Liquid Level h_L (cm)
                        ticks: { font: { size: 13 } },
                        type: 'linear',
                        position: 'bottom'
                    },
                    y: {
                        title: { display: true, text: '力 (N)', font: { size: 15, weight: 'bold' } }, // Force (N)
                        ticks: { font: { size: 13 } },
                        beginAtZero: true
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                if (context.datasetIndex === 1) {
                                    return null; 
                                }
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(2) + ' N';
                                }
                                return label;
                            }
                        }
                    },
                    annotation: { 
                        annotations: [] 
                    }
                },
                onClick: handleChartClick
            }
        });
    }

    // 图表数据更新 / Update chart data
    function updateChartData() {
        if (!chartInstance) return;

        const hL_values_cm = [];
        const pressure_force_values_N = [];
        const tension_values_N = [];

        const L_R_m = cmToM(simParams.ropeLength_cm);
        const S_m = cmToM(simParams.blockHeight_cm);

        for (let h_cm = 0; h_cm <= parseFloat(liquidLevelSlider.max); h_cm += 0.5) {
            hL_values_cm.push(h_cm);
            const hL_m_step = cmToM(h_cm);
            
            const physics = calculatePhysicsStep(
                hL_m_step, L_R_m, S_m,
                simParams.blockDensity_kg_m3, simParams.liquidDensity_kg_m3,
                simParams.isRopeCut, g
            );
            pressure_force_values_N.push(physics.pressureForceBottom_N);
            tension_values_N.push(physics.tension_N);
        }

        chartInstance.data.labels = hL_values_cm;
        if (currentChartType === 'pressure') {
            chartInstance.data.datasets[0].label = '物块底部压力 (N)'; // Pressure Force on Bottom (N)
            chartInstance.data.datasets[0].data = pressure_force_values_N;
            chartInstance.data.datasets[0].borderColor = 'rgb(75, 192, 192)';
        } else { // tension
            chartInstance.data.datasets[0].label = '细绳拉力 (N)'; // Rope Tension (N)
            chartInstance.data.datasets[0].data = tension_values_N;
            chartInstance.data.datasets[0].borderColor = 'rgb(255, 99, 132)';
        }

        const current_hL_m = cmToM(simParams.liquidLevel_cm);
        const currentPhysics = calculatePhysicsStep(
            current_hL_m, L_R_m, S_m,
            simParams.blockDensity_kg_m3, simParams.liquidDensity_kg_m3,
            simParams.isRopeCut, g
        );
        
        const current_x_val = simParams.liquidLevel_cm;
        const current_y_val = (currentChartType === 'pressure') ? currentPhysics.pressureForceBottom_N : currentPhysics.tension_N;
        chartInstance.data.datasets[1].data = [{ x: current_x_val, y: current_y_val }];
        chartInstance.data.datasets[1].pointStyle = simParams.isRopeCut ? 'rect' : 'rectRot';
        chartInstance.data.datasets[1].pointRadius = simParams.isRopeCut ? 5 : 7;
        
        chartInstance.options.plugins.annotation.annotations = annotations; 

        chartInstance.update();
    }

    // 切换图表类型按钮事件 / Toggle chart type button event
    toggleChartBtn.addEventListener('click', () => {
        currentChartType = (currentChartType === 'pressure') ? 'tension' : 'pressure';
        toggleChartBtn.textContent = (currentChartType === 'pressure') ? '显示细绳拉力图表' : '显示底部压力图表'; // Show Rope Tension Chart / Show Bottom Pressure Chart
        annotations = []; 
        updateChartData(); 
    });
    
    // 图表点击标注事件 / Chart click annotation event
    function handleChartClick(event) {
        const points = chartInstance.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
        if (points.length === 0) { 
            const canvasPosition = Chart.helpers.getRelativePosition(event, chartInstance);
            const clicked_hL_cm = chartInstance.scales.x.getValueForPixel(canvasPosition.x);

            if (clicked_hL_cm === undefined || clicked_hL_cm < 0 || clicked_hL_cm > parseFloat(liquidLevelSlider.max)) return;

            const hL_m_click = cmToM(clicked_hL_cm);
            const L_R_m = cmToM(simParams.ropeLength_cm);
            const S_m = cmToM(simParams.blockHeight_cm);

            const clickedPhysics = calculatePhysicsStep(
                hL_m_click, L_R_m, S_m,
                simParams.blockDensity_kg_m3, simParams.liquidDensity_kg_m3,
                simParams.isRopeCut, g
            );

            const yValue = (currentChartType === 'pressure') ? clickedPhysics.pressureForceBottom_N : clickedPhysics.tension_N;

            const annotation = {
                type: 'line',
                xMin: clicked_hL_cm,
                xMax: clicked_hL_cm,
                borderColor: 'rgb(150, 150, 150)',
                borderWidth: 1,
                label: {
                    content: `hL: ${clicked_hL_cm.toFixed(1)}cm, 力: ${yValue.toFixed(2)}N`, // Force
                    enabled: true,
                    position: 'start',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    font: { size: 10 },
                    yAdjust: -10
                },
                arrowHeads: {
                    end: {
                        display: true,
                        length: 8,
                        width: 6,
                        borderColor: 'rgb(150,150,150)',
                        backgroundColor: 'rgb(150,150,150)'
                    }
                },
                yMin: chartInstance.scales.y.min, 
                yMax: yValue, 
                id: 'annotation_' + Date.now()
            };
            annotations.push(annotation);
            updateChartData(); 
        }
    }

    // 撤销标注按钮事件 / Undo annotation button event
    undoAnnotationBtn.addEventListener('click', () => {
        if (annotations.length > 0) {
            annotations.pop();
            updateChartData();
        }
    });

    // 物理情景绘制 / Draw physics simulation
    function drawSimulation() {
        ctxSim.clearRect(0, 0, physicsCanvas.width, physicsCanvas.height);

        const scale = Math.min(physicsCanvas.width / 30, physicsCanvas.height / 35); // px per cm, assuming max sim width/height shown is ~30-35cm
        const containerBaseY = physicsCanvas.height - 20; // 20px margin at bottom
        const containerWidth_px = 25 * scale; // Assume container is 25cm wide visually
        const containerDrawX = (physicsCanvas.width - containerWidth_px) / 2;

        // Draw container
        ctxSim.strokeStyle = 'black';
        ctxSim.lineWidth = 2;
        ctxSim.strokeRect(containerDrawX, containerBaseY - (30 * scale), containerWidth_px, 30 * scale); // Assume 30cm tall container for drawing

        // Current physics state for drawing
        const hL_m = cmToM(simParams.liquidLevel_cm);
        const L_R_m = cmToM(simParams.ropeLength_cm);
        const S_m = cmToM(simParams.blockHeight_cm);
        const currentPhysics = calculatePhysicsStep(
            hL_m, L_R_m, S_m,
            simParams.blockDensity_kg_m3, simParams.liquidDensity_kg_m3,
            simParams.isRopeCut, g
        );

        const y_B_cm = mToCm(currentPhysics.block_y_m);
        const S_cm = simParams.blockHeight_cm;
        const hL_cm_current = simParams.liquidLevel_cm;

        // Draw liquid
        const liquidHeight_px = hL_cm_current * scale;
        ctxSim.fillStyle = 'rgba(100, 150, 255, 0.6)';
        ctxSim.fillRect(containerDrawX, containerBaseY - liquidHeight_px, containerWidth_px, liquidHeight_px);

        // Draw block
        const blockWidth_px = S_cm * scale;
        const blockHeight_px = S_cm * scale;
        const blockX_px = containerDrawX + (containerWidth_px - blockWidth_px) / 2;
        const blockY_px_from_bottom = y_B_cm * scale;
        const blockDrawY = containerBaseY - blockY_px_from_bottom - blockHeight_px;

        ctxSim.fillStyle = 'rgba(200, 100, 50, 0.8)';
        ctxSim.fillRect(blockX_px, blockDrawY, blockWidth_px, blockHeight_px);
        ctxSim.strokeStyle = 'black';
        ctxSim.strokeRect(blockX_px, blockDrawY, blockWidth_px, blockHeight_px);
        
        // Draw Label 'A' on block
        ctxSim.fillStyle = 'white';
        ctxSim.font = Math.max(12, blockHeight_px * 0.5) + 'px Arial';
        ctxSim.textAlign = 'center';
        ctxSim.textBaseline = 'middle';
        ctxSim.fillText('A', blockX_px + blockWidth_px / 2, blockDrawY + blockHeight_px / 2);


        // Draw rope if not cut
        if (!simParams.isRopeCut) {
            ctxSim.beginPath();
            ctxSim.moveTo(blockX_px + blockWidth_px / 2, blockDrawY + blockHeight_px); // Bottom center of block
            ctxSim.lineTo(blockX_px + blockWidth_px / 2, containerBaseY - (L_R_m > currentPhysics.block_y_m ? (mToCm(L_R_m)*scale) : blockY_px_from_bottom)); // Point on container base directly below, or at rope length if block sank past it
            // Corrected rope drawing: from block bottom to container bottom IF block is at L_R.
            // If block is at y_B, rope is from block bottom (at y_B) to container bottom (y=0).
            ctxSim.lineTo(blockX_px + blockWidth_px / 2, containerBaseY);
            ctxSim.strokeStyle = 'gray';
            ctxSim.lineWidth = 2;
            ctxSim.stroke();
        }
        
        // TODO: Draw force vectors (G, Fb, T, Support) in a later step
    }
    
    // 主更新函数 / Main update function
    function updateAndDrawAll() {
        updateChartData();
        drawSimulation();
    }

    // 初始化 / Initialization
    window.addEventListener('resize', () => {
        setupCanvases();
        updateAndDrawAll();
    });

    // For now, click to annotate might not fully render without the plugin (e.g. arrowheads).
    // The line and label part of annotation should work.
    // The current point indicator is a native Chart.js feature if `chartjs-plugin-annotation` is not present for the `point` type annotation.
    // For full annotation features like lines and boxes, the plugin is usually needed.
    // Let's ensure the current point uses a structure that Chart.js can render if the plugin is missing.
    // Chart.js itself does not directly support 'point' type annotations in options.plugins.annotation.annotations without the plugin.
    // However, we can draw custom points in `afterDatasetsDraw` or use a scatter chart dataset for the current point.

    // For simplicity, the current point will be managed as part of the annotations array,
    // and we rely on the structure being compatible or gracefully ignored if plugin isn't there for some parts.
    // The current implementation adds it to chartInstance.options.plugins.annotation.annotations.
    // If chartjs-plugin-annotation is not loaded, this specific part might not show, but the rest of the chart will.

    setupCanvases();
    initializeChart(); // Initialize chart structure
    updateAndDrawAll(); // Initial calculation and draw
}); 