(function (global) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const MIN_SIDE = 24;
  const STEP = 6;

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseInteractiveTriangle(source) {
    if (typeof source !== "string" || source.length > 20_000) return null;
    const document = new DOMParser().parseFromString(source, "image/svg+xml");
    if (document.querySelector("parsererror")) return null;
    const root = document.documentElement;
    if (root.localName !== "svg" || root.getAttribute("role") !== "group" ||
        !/^Interactive right triangle\./.test(root.getAttribute("aria-label") || "")) return null;

    const viewBox = (root.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(number);
    if (viewBox.length !== 4 || viewBox.some(value => value === null) || viewBox[2] <= 0 || viewBox[3] <= 0) return null;
    const polygon = root.querySelector("polygon");
    const points = (polygon?.getAttribute("points") || "").trim().split(/[\s]+/)
      .map(pair => pair.split(",").map(number));
    if (points.length !== 3 || points.some(pair => pair.length !== 2 || pair.some(value => value === null))) return null;

    const handles = [...root.querySelectorAll('circle[data-learning-block-pan="both"][role="button"][tabindex="0"]')];
    if (handles.length !== 2) return null;
    const bHandle = handles.find(node => /point B\./.test(node.getAttribute("aria-label") || ""));
    const cHandle = handles.find(node => /point C\./.test(node.getAttribute("aria-label") || ""));
    if (!bHandle || !cHandle) return null;
    const B = [number(bHandle.getAttribute("cx")), number(bHandle.getAttribute("cy"))];
    const C = [number(cHandle.getAttribute("cx")), number(cHandle.getAttribute("cy"))];
    if (B.some(value => value === null) || C.some(value => value === null)) return null;
    const [A, polygonB, polygonC] = points;
    if (Math.abs(polygonB[0] - B[0]) > 0.01 || Math.abs(polygonB[1] - B[1]) > 0.01 ||
        Math.abs(polygonC[0] - C[0]) > 0.01 || Math.abs(polygonC[1] - C[1]) > 0.01 ||
        Math.abs(A[0] - C[0]) > 0.01 || Math.abs(A[1] - B[1]) > 0.01 ||
        B[0] - C[0] < MIN_SIDE || B[1] - C[1] < MIN_SIDE) return null;
    return { x: viewBox[0], y: viewBox[1], width: viewBox[2], height: viewBox[3], B, C };
  }

  function createSvg(tag, attributes = {}, text) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderInteractiveTriangle(source) {
    const spec = parseInteractiveTriangle(source);
    if (!spec) return null;
    let { B, C } = spec;
    const figure = document.createElement("figure");
    figure.className = "interactive-triangle";
    const svg = createSvg("svg", { viewBox: `${spec.x} ${spec.y} ${spec.width} ${spec.height}`, role: "group", class: "interactive-triangle__svg" });
    const title = createSvg("title");
    svg.append(title);
    svg.append(createSvg("text", { x: spec.x + spec.width / 2, y: spec.y + 24, class: "triangle-instruction", "text-anchor": "middle" }, "拖曳控制點，或聚焦後使用方向鍵調整"));
    const polygon = createSvg("polygon", { class: "triangle-shape" });
    const baseline = createSvg("line", { class: "triangle-edge" });
    const altitude = createSvg("line", { class: "triangle-edge" });
    const hypotenuse = createSvg("line", { class: "triangle-edge" });
    const rightAngle = createSvg("path", { class: "triangle-right-angle" });
    const angleArc = createSvg("path", { class: "triangle-angle-arc" });
    const ref = createSvg("text", { class: "triangle-side-label", "text-anchor": "middle" }, "參考角");
    const angleB = createSvg("text", { class: "triangle-angle-value", "text-anchor": "middle" });
    const angleC = createSvg("text", { class: "triangle-angle-value", "text-anchor": "middle" });
    const adjacentLabel = createSvg("text", { class: "triangle-side-label", "text-anchor": "middle" }, "鄰邊");
    const oppositeLabel = createSvg("text", { class: "triangle-side-label", "text-anchor": "end" }, "對邊");
    const hypotenuseLabel = createSvg("text", { class: "triangle-side-label", "text-anchor": "middle" }, "斜邊");
    const handles = [
      createSvg("circle", { class: "triangle-handle", r: 12, role: "button", tabindex: 0, "aria-label": "可移動頂點 B，使用方向鍵調整直角三角形" }),
      createSvg("circle", { class: "triangle-handle", r: 12, role: "button", tabindex: 0, "aria-label": "可移動頂點 C，使用方向鍵調整直角三角形" }),
    ];
    const dots = [createSvg("circle", { class: "triangle-dot", r: 5.5, "pointer-events": "none" }), createSvg("circle", { class: "triangle-dot", r: 5.5, "pointer-events": "none" })];
    svg.append(polygon, baseline, altitude, hypotenuse, rightAngle, angleArc, ref, angleB, angleC,
      adjacentLabel, oppositeLabel, hypotenuseLabel, dots[0], dots[1], handles[0], handles[1]);
    figure.append(svg);

    function update() {
      const A = [C[0], B[1]];
      const dx = B[0] - C[0];
      const dy = B[1] - C[1];
      const hyp = Math.hypot(dx, dy);
      const degrees = Math.atan2(dy, dx) * 180 / Math.PI;
      const rounded = value => Math.round(value * 10) / 10;
      const pointList = `${A[0]},${A[1]} ${B[0]},${B[1]} ${C[0]},${C[1]}`;
      polygon.setAttribute("points", pointList);
      baseline.setAttribute("x1", A[0]); baseline.setAttribute("y1", A[1]); baseline.setAttribute("x2", B[0]); baseline.setAttribute("y2", B[1]);
      altitude.setAttribute("x1", A[0]); altitude.setAttribute("y1", A[1]); altitude.setAttribute("x2", C[0]); altitude.setAttribute("y2", C[1]);
      hypotenuse.setAttribute("x1", B[0]); hypotenuse.setAttribute("y1", B[1]); hypotenuse.setAttribute("x2", C[0]); hypotenuse.setAttribute("y2", C[1]);
      rightAngle.setAttribute("d", `M ${A[0]} ${A[1]} L ${A[0] + 18} ${A[1]} L ${A[0] + 18} ${A[1] - 18} L ${A[0]} ${A[1] - 18} Z`);
      const arcRadius = Math.min(22, dx / 5, dy / 5);
      angleArc.setAttribute("d", `M ${B[0] - arcRadius} ${B[1]} A ${arcRadius} ${arcRadius} 0 0 0 ${B[0] - arcRadius * Math.cos(degrees * Math.PI / 180)} ${B[1] - arcRadius * Math.sin(degrees * Math.PI / 180)}`);
      ref.setAttribute("x", B[0] + 34); ref.setAttribute("y", B[1] - 26);
      angleB.setAttribute("x", B[0] - 14); angleB.setAttribute("y", B[1] - 9); angleB.textContent = `${rounded(degrees)}°`;
      angleC.setAttribute("x", C[0] + 20); angleC.setAttribute("y", C[1] + 22); angleC.textContent = `${rounded(90 - degrees)}°`;
      adjacentLabel.setAttribute("x", (A[0] + B[0]) / 2); adjacentLabel.setAttribute("y", A[1] + 20);
      oppositeLabel.setAttribute("x", A[0] - 12); oppositeLabel.setAttribute("y", (A[1] + C[1]) / 2);
      hypotenuseLabel.setAttribute("x", (B[0] + C[0]) / 2 + 12); hypotenuseLabel.setAttribute("y", (B[1] + C[1]) / 2);
      for (const [i, point] of [[0, B], [1, C]]) {
        handles[i].setAttribute("cx", point[0]); handles[i].setAttribute("cy", point[1]);
        dots[i].setAttribute("cx", point[0]); dots[i].setAttribute("cy", point[1]);
      }
      const description = `直角三角形。頂點 B 的參考角 ${rounded(degrees)} 度，另一個銳角 ${rounded(90 - degrees)} 度。鄰邊 ${rounded(dx)}，對邊 ${rounded(dy)}，斜邊 ${rounded(hyp)}。`;
      svg.setAttribute("aria-label", description);
      title.textContent = description;
    }

    function move(index, x, y) {
      const margin = 16;
      const minX = spec.x + margin;
      const maxX = spec.x + spec.width - margin;
      const minY = spec.y + margin;
      const maxY = spec.y + spec.height - margin;
      if (index === 0) B = [Math.min(maxX, Math.max(C[0] + MIN_SIDE, x)), Math.min(maxY, Math.max(C[1] + MIN_SIDE, y))];
      else C = [Math.min(B[0] - MIN_SIDE, Math.max(minX, x)), Math.min(B[1] - MIN_SIDE, Math.max(minY, y))];
      update();
    }

    function position(event) {
      const box = svg.getBoundingClientRect();
      const scale = Math.min(box.width / spec.width, box.height / spec.height);
      const left = box.left + (box.width - spec.width * scale) / 2;
      const top = box.top + (box.height - spec.height * scale) / 2;
      return [(event.clientX - left) / scale + spec.x, (event.clientY - top) / scale + spec.y];
    }

    handles.forEach((handle, index) => {
      handle.addEventListener("keydown", event => {
        const delta = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] }[event.key];
        if (!delta) return;
        event.preventDefault();
        const point = index === 0 ? B : C;
        move(index, point[0] + delta[0], point[1] + delta[1]);
      });
      handle.addEventListener("pointerdown", event => {
        event.preventDefault();
        handle.setPointerCapture(event.pointerId);
        handle.classList.add("is-dragging");
      });
      handle.addEventListener("pointermove", event => {
        if (!handle.hasPointerCapture(event.pointerId)) return;
        const [x, y] = position(event);
        move(index, x, y);
      });
      const stop = event => {
        if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
        handle.classList.remove("is-dragging");
      };
      handle.addEventListener("pointerup", stop);
      handle.addEventListener("pointercancel", stop);
    });
    update();
    return figure;
  }

  const reconstructedModels = Object.freeze({
    "center-of-mass": Object.freeze({
      lessonId: "6af8b6e9-9c9c-83ec-a21d-ddc263f50348",
      messageId: "3ed9470a-eceb-4ca0-b92d-ef6b897166e8",
      sourceMarker: "兩物體的質心位置",
      unavailableMarker: "目前的值無法使用",
      title: "兩物體的質心位置",
      label: "B 的質量（kg）",
      min: 1,
      max: 10,
      step: 1,
      initial: 6,
      calculate: massB => 8 * massB / (2 + massB),
    }),
    ph: Object.freeze({
      lessonId: "6afd6d79-c8d0-83ee-8fd6-a9627b2900ab",
      messageId: "796b7991-effe-49aa-9bec-05a18eac1698",
      sourceMarker: "觀察 pH 與氫離子濃度的關係",
      unavailableMarker: "目前的值無法使用",
      title: "pH 與氫離子濃度",
      label: "pH",
      min: 1,
      max: 13,
      step: 1,
      initial: 4,
      calculate: ph => 10 ** -ph,
    }),
    waveSuperposition: Object.freeze({
      lessonId: "6af8c796-0078-83ec-8a36-504eb91064db", messageId: "203be973-c586-48aa-a7ba-6c702819c9b4",
      sourceMarker: "兩個週期波的疊加", title: "兩波的相位差與疊加", domain: [0, Math.PI * 2], domainLabels: ["0", "2π"], yDomain: [-2.2, 2.2],
      controls: [{ label: "相位差（°）", min: 0, max: 180, step: 30, initial: 0 }],
      plot: ([phase]) => ({ curves: [
        { label: "波 1", color: 0, fn: x => Math.sin(x) },
        { label: "波 2", color: 1, fn: x => Math.sin(x + phase * Math.PI / 180) },
        { label: "合成波", color: 2, fn: x => Math.sin(x) + Math.sin(x + phase * Math.PI / 180) },
      ], output: `相位差 ${phase}°；合成振幅 = ${2 * Math.abs(Math.cos(phase * Math.PI / 360)) .toFixed(2)}` }),
    }),
    standingWave: Object.freeze({
      lessonId: "6af8c7a3-5fcc-83ee-ac84-ae6049d8f257", messageId: "dbd2b6cf-e2e7-4698-9de6-99df18b19989",
      sourceMarker: "固定兩端的弦，形成三個波腹的駐波", title: "三個波腹的駐波", domain: [0, Math.PI * 2], domainLabels: ["0", "2π"], yDomain: [-2.2, 2.2],
      controls: [{ label: "振動相位（°）", min: 0, max: 360, step: 15, initial: 0 }],
      plot: ([phase]) => ({ curves: [{ label: "弦的瞬時形狀", color: 0, fn: x => 2 * Math.sin(3 * x) * Math.cos(phase * Math.PI / 180) }], output: `相位 ${phase}°；水平位置是三個波節之一` }),
    }),
    doubleSlit: Object.freeze({
      lessonId: "6af8c88a-fe88-83ec-b39e-633d06351e96", messageId: "d490d203-22e2-40cb-a257-e7973bf8e4b2",
      sourceMarker: "雙狹縫干涉亮度分布", title: "雙狹縫干涉亮度分布", domain: [-4, 4], domainLabels: ["−4 mm", "4 mm"], yDomain: [0, 1.15],
      controls: [
        { label: "波長 λ（nm）", min: 400, max: 700, step: 25, initial: 500 },
        { label: "狹縫距離 d（mm）", min: 0.2, max: 0.6, step: 0.05, initial: 0.4 },
        { label: "屏幕距離 L（m）", min: 1, max: 2, step: 0.1, initial: 1.5 },
      ],
      plot: ([lambda, distance, screen]) => {
        const spacing = lambda * 1e-9 * screen / (distance * 1e-3) * 1e3;
        return { curves: [{ label: "相對亮度", color: 0, fn: y => Math.cos(Math.PI * y / spacing) ** 2 }], output: `相鄰明紋間距 Δy = λL/d = ${spacing.toFixed(2)} mm` };
      },
    }),
    magneticParticle: Object.freeze({
      lessonId: "6af8c9a7-6864-83e8-85be-88bdf1bd5a84", messageId: "bde4b223-3b0e-4816-b881-b2da2cd617a8",
      sourceMarker: "粒子速率（相對值）", title: "帶電粒子在磁場中的圓周運動", domain: [0, Math.PI * 2], domainLabels: ["0", "2π"], yDomain: [-2.7, 2.7],
      controls: [{ label: "粒子速率（相對值）", min: 0.5, max: 2.5, step: 0.5, initial: 1 }],
      plot: ([speed]) => ({ curves: [{ label: "軌道投影", color: 0, fn: x => speed * Math.sin(x) }], output: `r/r₀ = ${speed.toFixed(1)}；固定磁場下，週期不隨速率改變` }),
    }),
    polarization: Object.freeze({
      lessonId: "6af8c9ed-b8c0-83ee-86a6-dcc8026043d5", messageId: "4b8645a7-614f-4823-aeeb-0a28667c0413",
      sourceMarker: "調整偏振片角度", title: "偏振片角度與透射強度", domain: [0, 90], domainLabels: ["0°", "90°"], yDomain: [0, 1.08],
      controls: [{ label: "夾角 θ（°）", min: 0, max: 90, step: 5, initial: 0 }],
      plot: ([angle]) => ({ curves: [{ label: "I/I₀", color: 0, fn: theta => Math.cos(theta * Math.PI / 180) ** 2 }], output: `θ = ${angle}°；I/I₀ = cos²θ = ${(Math.cos(angle * Math.PI / 180) ** 2).toFixed(3)}` }),
    }),
    sineTransform: Object.freeze({
      lessonId: "6af956fc-4454-83ec-b84a-08c70b2af2a8", messageId: "87cb3f62-9d96-4054-ae6e-7f5d8c82d270",
      sourceMarker: "正弦函數變換實驗", title: "正弦函數變換實驗", domain: [0, Math.PI * 2], domainLabels: ["0", "2π"], yDomain: [-6, 6],
      controls: [
        { label: "振幅係數 A", min: 1, max: 3, step: 1, initial: 2 },
        { label: "頻率係數 B", min: 1, max: 3, step: 1, initial: 1 },
        { label: "水平位移 h（π/4）", min: -4, max: 4, step: 1, initial: 0 },
        { label: "中線高度 D", min: -2, max: 2, step: 1, initial: 0 },
      ],
      plot: ([a, b, h, d]) => ({ curves: [
        { label: "變換後", color: 0, fn: x => a * Math.sin(b * (x - h * Math.PI / 4)) + d },
        { label: "y = sin x", color: 1, fn: x => Math.sin(x) },
        { label: "中線 D", color: 2, fn: () => d },
      ], output: `振幅 ${a}；週期 ${(2 * Math.PI / b / Math.PI).toFixed(2)}π；中線 y = ${d}` }),
    }),
    idealGas: Object.freeze({
      lessonId: "6afd534c-8960-83ec-b48d-440c64d34d1e", messageId: "d8edf33e-8313-4f57-840e-18bc8bb374c3",
      sourceMarker: "理想氣體壓力模型", title: "理想氣體壓力模型", domain: [150, 600], domainLabels: ["150 K", "600 K"], yDomain: [0, 5.2],
      controls: [
        { label: "絕對溫度（K）", min: 150, max: 600, step: 50, initial: 300 },
        { label: "相對體積（%）", min: 40, max: 100, step: 10, initial: 100 },
      ],
      plot: ([temperature, volume]) => ({ curves: [{ label: "相對壓力", color: 0, fn: t => (t / 300) / (volume / 100) }], output: `P/P₀ = (T/300)/(V/100) = ${((temperature / 300) / (volume / 100)).toFixed(2)} 倍` }),
    }),
  });

  function reconstructedSpecFor(doc, message, block) {
    if (!doc || !message || !block || message.role !== "assistant" || block.kind !== "quote") return null;
    const matches = Object.values(reconstructedModels).filter(spec => spec.lessonId === doc.id &&
      spec.messageId === message.id && message.text.includes(spec.sourceMarker) &&
      block.text.includes(spec.unavailableMarker ?? "目前的值無法使用") &&
      (spec.controls?.[0] ? block.text.includes(`**範圍：** ${spec.controls[0].min} 至 ${spec.controls[0].max}`) : true));
    if (matches.length > 1) {
      console.error("教材互動元件識別不唯一", doc.id, message.id);
      return null;
    }
    return matches[0] ?? null;
  }

  function renderReconstructed(spec) {
    if (!spec || !Object.values(reconstructedModels).includes(spec)) {
      throw new TypeError("未知的教材互動模型");
    }
    if (spec.controls) return renderReconstructedChart(spec);
    const isMass = spec === reconstructedModels["center-of-mass"];
    const figure = document.createElement("figure");
    figure.className = "lesson-visualization";
    figure.dataset.visualization = isMass ? "center-of-mass" : "ph";
    figure.dataset.provenance = "reconstructed";
    const caption = document.createElement("figcaption");
    caption.textContent = `${spec.title}（依講義公式重建）`;

    const svg = createSvg("svg", { viewBox: "0 0 320 112", role: "img" });
    const axis = createSvg("line", { x1: 28, x2: 292, y1: 62, y2: 62, class: "visualization-axis" });
    const marker = createSvg("circle", { cy: 62, r: 7, class: "visualization-marker" });
    const markerLabel = createSvg("text", { y: 38, "text-anchor": "middle", class: "visualization-label" });
    svg.append(axis);

    if (isMass) {
      svg.append(
        createSvg("circle", { cx: 28, cy: 62, r: 5, class: "visualization-endpoint" }),
        createSvg("circle", { cx: 292, cy: 62, r: 5, class: "visualization-endpoint" }),
        createSvg("text", { x: 28, y: 91, "text-anchor": "start", class: "visualization-label" }, "A · 2 kg · 0 m"),
        createSvg("text", { x: 292, y: 91, "text-anchor": "end", class: "visualization-label" }, "B · 1–10 kg · 8 m"),
      );
    } else {
      for (let value = spec.min; value <= spec.max; value++) {
        const x = 28 + (value - spec.min) * 264 / (spec.max - spec.min);
        svg.append(createSvg("line", { x1: x, x2: x, y1: 58, y2: 66, class: "visualization-axis" }));
      }
      svg.append(
        createSvg("text", { x: 28, y: 91, "text-anchor": "start", class: "visualization-label" }, "pH 1 · 氫離子濃度高"),
        createSvg("text", { x: 292, y: 91, "text-anchor": "end", class: "visualization-label" }, "pH 13 · 氫離子濃度低"),
      );
    }
    svg.append(marker, markerLabel);

    const controls = document.createElement("div");
    controls.className = "visualization-controls";
    const createControl = (type, accessibleName, className) => {
      const label = document.createElement("label");
      label.className = className;
      const text = document.createElement("span");
      text.textContent = accessibleName;
      const input = document.createElement("input");
      input.type = type;
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      input.setAttribute("aria-label", accessibleName);
      label.append(text, input);
      controls.append(label);
      return input;
    };
    const range = createControl("range", spec.label, "visualization-range");
    const numeric = createControl("number", `${spec.label}（數值輸入）`, "visualization-number");
    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "重設";
    reset.setAttribute("aria-label", `重設${spec.label}`);
    controls.append(reset);
    const output = document.createElement("output");
    output.className = "visualization-output";
    output.setAttribute("aria-live", "polite");
    figure.append(caption, svg, controls, output);

    function update(rawValue) {
      if (!Number.isFinite(rawValue)) return false;
      const clamped = Math.min(spec.max, Math.max(spec.min, rawValue));
      const value = spec.min + Math.round((clamped - spec.min) / spec.step) * spec.step;
      const result = spec.calculate(value);
      if (!Number.isFinite(result)) throw new RangeError(`互動模型輸出非有限值：${spec.title}`);
      range.value = String(value);
      numeric.value = String(value);
      output.dataset.value = String(result);
      const markerX = isMass ? 28 + result * 264 / 8 : 28 + (value - spec.min) * 264 / (spec.max - spec.min);
      marker.setAttribute("cx", String(markerX));
      markerLabel.setAttribute("x", String(Math.min(276, Math.max(44, markerX))));
      if (isMass) {
        markerLabel.textContent = `${result.toFixed(2)} m`;
        output.textContent = `x_cm = (2×0 + ${value}×8) / (2 + ${value}) = ${result.toFixed(2)} m`;
      } else {
        markerLabel.textContent = `pH ${value}`;
        output.textContent = `pH = ${value}；[H⁺] = 10^(-${value}) mol/L`;
      }
      svg.setAttribute("aria-label", output.textContent);
      return true;
    }

    range.addEventListener("input", () => update(range.valueAsNumber));
    const commitNumber = () => {
      if (!numeric.value.trim() || !Number.isFinite(numeric.valueAsNumber)) {
        update(Number(range.value));
        return;
      }
      update(numeric.valueAsNumber);
    };
    numeric.addEventListener("input", () => {
      const value = numeric.valueAsNumber;
      if (numeric.validity.valid && Number.isFinite(value) && value >= spec.min && value <= spec.max) update(value);
    });
    numeric.addEventListener("change", commitNumber);
    numeric.addEventListener("blur", commitNumber);
    reset.addEventListener("click", () => update(spec.initial));
    update(spec.initial);
    return figure;
  }

  function renderReconstructedChart(spec) {
    const figure = document.createElement("figure");
    figure.className = "lesson-visualization";
    figure.dataset.visualization = spec.title;
    figure.dataset.provenance = "reconstructed";
    const caption = document.createElement("figcaption");
    caption.textContent = `${spec.title}（依講義公式重建；初值為示例）`;
    const svg = createSvg("svg", { viewBox: "0 0 360 200", role: "img", "aria-label": spec.title });
    const left = 39, right = 345, top = 16, bottom = 154;
    const grid = createSvg("g");
    for (let i = 0; i <= 4; i++) {
      const value = spec.yDomain[0] + (spec.yDomain[1] - spec.yDomain[0]) * i / 4;
      const y = bottom - (bottom - top) * i / 4;
      grid.append(createSvg("line", { x1: left, x2: right, y1: y, y2: y, class: "visualization-grid" }));
      grid.append(createSvg("text", { x: left - 5, y: y + 4, class: "visualization-label", "text-anchor": "end" }, Number(value.toPrecision(3)).toString()));
    }
    const xAxis = createSvg("line", { x1: left, x2: right, y1: bottom, y2: bottom, class: "visualization-axis" });
    const yAxis = createSvg("line", { x1: left, x2: left, y1: top, y2: bottom, class: "visualization-axis" });
    const curvesGroup = createSvg("g");
    const xLabels = [
      createSvg("text", { x: left, y: 174, class: "visualization-label", "text-anchor": "start" }, spec.domainLabels?.[0] ?? String(spec.domain[0])),
      createSvg("text", { x: right, y: 174, class: "visualization-label", "text-anchor": "end" }, spec.domainLabels?.[1] ?? String(spec.domain[1])),
    ];
    const legend = document.createElement("ul");
    legend.className = "visualization-legend";
    svg.append(grid, xAxis, yAxis, curvesGroup, ...xLabels);
    const controls = document.createElement("div");
    controls.className = "visualization-controls";
    const inputs = spec.controls.map(control => {
      const label = document.createElement("label");
      label.className = "visualization-control";
      const title = document.createElement("span");
      title.textContent = control.label;
      const range = document.createElement("input");
      range.type = "range";
      range.min = String(control.min); range.max = String(control.max); range.step = String(control.step);
      range.setAttribute("aria-label", control.label);
      const number = document.createElement("input");
      number.type = "number";
      number.min = String(control.min); number.max = String(control.max); number.step = String(control.step);
      number.setAttribute("aria-label", `${control.label}（數值輸入）`);
      label.append(title, range, number);
      controls.append(label);
      return { control, range, number };
    });
    const reset = document.createElement("button");
    reset.type = "button"; reset.textContent = "重設";
    reset.setAttribute("aria-label", `重設${spec.title}`);
    controls.append(reset);
    const output = document.createElement("output");
    output.className = "visualization-output";
    output.setAttribute("aria-live", "polite");
    figure.append(caption, svg, legend, controls, output);

    const xAt = x => left + (x - spec.domain[0]) / (spec.domain[1] - spec.domain[0]) * (right - left);
    const yAt = y => bottom - (y - spec.yDomain[0]) / (spec.yDomain[1] - spec.yDomain[0]) * (bottom - top);
    function update(values) {
      const state = spec.plot(values);
      if (!state || !Array.isArray(state.curves) || typeof state.output !== "string") {
        throw new TypeError(`教材互動模型輸出格式錯誤：${spec.title}`);
      }
      curvesGroup.replaceChildren();
      legend.replaceChildren();
      for (const [index, curve] of state.curves.entries()) {
        if (typeof curve.fn !== "function") throw new TypeError(`教材曲線缺少函數：${spec.title}`);
        const points = [];
        for (let i = 0; i <= 120; i++) {
          const x = spec.domain[0] + (spec.domain[1] - spec.domain[0]) * i / 120;
          const y = curve.fn(x);
          if (!Number.isFinite(y)) throw new RangeError(`教材曲線產生非有限值：${spec.title}`);
          points.push(`${xAt(x).toFixed(2)},${yAt(y).toFixed(2)}`);
        }
        curvesGroup.append(createSvg("polyline", { points: points.join(" "), class: `visualization-curve c${curve.color ?? index}` }));
        const item = document.createElement("li");
        item.textContent = curve.label;
        item.className = `c${curve.color ?? index}`;
        legend.append(item);
      }
      output.textContent = state.output;
      svg.setAttribute("aria-label", `${spec.title}。${state.output}`);
    }
    function setValue(index, raw) {
      const { control, range, number } = inputs[index];
      if (!Number.isFinite(raw)) return;
      const bounded = Math.min(control.max, Math.max(control.min, raw));
      const snapped = Number((control.min + Math.round((bounded - control.min) / control.step) * control.step).toPrecision(12));
      range.value = String(snapped);
      number.value = String(snapped);
      update(inputs.map(item => Number(item.range.value)));
    }
    inputs.forEach(({ control, range, number }, index) => {
      range.addEventListener("input", () => setValue(index, range.valueAsNumber));
      const commit = () => {
        if (!number.value.trim() || !Number.isFinite(number.valueAsNumber)) {
          setValue(index, Number(range.value));
          return;
        }
        setValue(index, number.valueAsNumber);
      };
      number.addEventListener("input", () => {
        if (number.validity.valid && Number.isFinite(number.valueAsNumber) && number.valueAsNumber >= control.min && number.valueAsNumber <= control.max) {
          setValue(index, number.valueAsNumber);
        }
      });
      number.addEventListener("change", commit);
      number.addEventListener("blur", commit);
    });
    reset.addEventListener("click", () => inputs.forEach(({ control }, index) => setValue(index, control.initial)));
    inputs.forEach(({ control, range, number }) => {
      range.value = String(control.initial);
      number.value = String(control.initial);
    });
    update(inputs.map(item => Number(item.range.value)));
    return figure;
  }

  const models = Object.freeze({
    centerOfMass: massB => reconstructedModels["center-of-mass"].calculate(massB),
    hydrogenIonConcentration: ph => reconstructedModels.ph.calculate(ph),
  });
  global.LessonVisualization = Object.freeze({
    parseInteractiveTriangle,
    renderInteractiveTriangle,
    reconstructedSpecFor,
    renderReconstructed,
    models,
  });
})(window);
