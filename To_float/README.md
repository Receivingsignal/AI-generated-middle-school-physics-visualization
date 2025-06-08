# 物理浮力可视化器 / Physics Buoyancy Visualizer

## 项目简介 / Project Introduction

本项目是一个基于网页的初中物理浮力问题可视化与交互工具，支持参数调节、情景动画、数据图表与标注，适合教学与自学。

This project is a web-based visualization and interaction tool for middle school buoyancy problems. It supports parameter adjustment, scenario animation, data charting, and annotation, suitable for teaching and self-study.

## 功能特性 / Features

- 中文界面，三栏布局（物理情景、数据图表、控制台）
- 动态模拟物块、液体、细绳的物理过程
- 支持调节液面高度、细绳长度、物块边长、物块密度、液体密度
- 可模拟剪断细绳情景
- 图表实时显示物块底部压力/细绳拉力随液面变化
- 图表支持点击标注、撤销标注、当前状态点高亮
- 离线可用（本地lib目录下引入Chart.js及其注解插件）

- Chinese UI, three-column layout (physics, chart, controls)
- Dynamic simulation of block, liquid, and rope
- Adjustable liquid level, rope length, block size, block density, liquid density
- Simulate "cut rope" scenario
- Real-time chart of bottom pressure/rope tension vs. liquid level
- Chart supports click annotation, undo, and current state highlight
- Offline capable (local lib directory for Chart.js and annotation plugin)

## 使用说明 / Usage

### 离线环境配置 / Offline Setup
1. 在项目根目录下新建lib文件夹。
2. 下载Chart.js（https://cdn.jsdelivr.net/npm/chart.js）保存为lib/chart.js。
3. 下载chartjs-plugin-annotation（https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@latest/dist/chartjs-plugin-annotation.min.js）保存为lib/chartjs-plugin-annotation.min.js。
4. 打开index.html即可离线使用。

1. Create a `lib` folder in the project root.
2. Download Chart.js (https://cdn.jsdelivr.net/npm/chart.js) as lib/chart.js.
3. Download chartjs-plugin-annotation (https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@latest/dist/chartjs-plugin-annotation.min.js) as lib/chartjs-plugin-annotation.min.js.
4. Open index.html for offline use.

### 操作说明 / How to Use
- 右侧控制台调节参数，左侧动画实时反映，中央图表展示数据。
- 切换图表类型、点击图表添加标注、撤销标注。
- 勾选"剪断细绳"可模拟无绳情景。

- Adjust parameters in the right panel, see animation on the left, and data chart in the center.
- Switch chart type, click to annotate, undo annotation.
- Check "剪断细绳" (cut rope) to simulate rope-free scenario.

## 主要文件说明 / Main Files
- index.html：主页面结构（中文界面）
- style.css：样式表，三栏布局与大字体
- script.js：主逻辑，含物理计算、动画、图表、交互
- lib/chart.js, lib/chartjs-plugin-annotation.min.js：本地依赖库

- index.html: Main page structure (Chinese UI)
- style.css: Stylesheet, layout and large fonts
- script.js: Main logic (physics, animation, chart, interaction)
- lib/chart.js, lib/chartjs-plugin-annotation.min.js: Local dependencies

## 后续开发建议 / Suggestions for Future Development
- 增加物块受力矢量动态展示
- 支持多种物体/液体类型
- 增强移动端/触屏适配
- 支持导出图片/数据

- Add force vector visualization
- Support multiple object/liquid types
- Enhance mobile/touch support
- Support export of images/data

## Current Progress & Features\n\n- **Core Application Structure**: `index.html`, `style.css`, and `script.js` files.\n- **UI Layout (Chinese)**: Three-column layout: 物理情景模拟 (Physics Simulation), 数据图表 (Data Charts), 控制参数 (Controls).\n- **Styling**: CSS for layout, readability, and large UI elements suitable for classroom display.\n- **Controls (Chinese Labels)**: Interactive sliders and number inputs for: 液面高度 (Liquid Level), 细绳长度 (Rope Length), 物块边长 (Block Side Length), 物块密度 (Block Density), and 液体密度 (Liquid Density). Includes a 剪断细绳 (Cut Rope) checkbox.\n- **Physics Simulation Visualization**:\n    - Dynamic 2D canvas drawing of container, liquid, block ('A'), and rope.\n- **Physics Engine (Updated Rope Logic)**:\n    - `calculatePhysicsStep` function with revised logic for the attached rope:\n        - The rope is now **inextensible** and provides **tension only**.\n        - The block rests on the container bottom if the water level is too low for it to float and the rope is slack.\n        - The rope prevents the block from floating above the height defined by `细绳长度 (L_R)`. Tension is generated if buoyancy would lift it further.\n        - The previous `Y_RISE_FACTOR` logic (to match a specific graph) has been removed in favor of this more standard rope model.\n    - Handles \"rope cut\" scenario as before (block sinks or floats freely).\n    - Calculates: block position, buoyant force, gravity, rope tension, and pressure force on block's bottom.\n- **Data Charting (Chart.js - Chinese Labels)**:\n    - Toggleable charts: 物块底部压力 (Bottom Pressure Force) vs. 液面高度 (Liquid Level), and 细绳拉力 (Rope Tension) vs. 液面高度 (Liquid Level).\n    - Real-time indicator point (当前状态 - Current State) on the chart using a separate scatter dataset.\n    - Click to Annotate: Adds a vertical line and data label (e.g., `hL: Xcm, 力: Y N`).\n    - Undo Annotation button (撤销标注).\n- **Offline Capability**: Instructions provided to use local copies of Chart.js and its annotation plugin.\n\n## Original Problem Context (Figure 乙 Interpretation - Before Recent Changes)\n\nInitially, the rope logic (using `