(function (global) {
  "use strict";

  const specs = [
    { lessonId: "6af8b2ab-59ec-83ee-ad40-ab08b031bac4", messageId: "5b130bd5-68d0-426c-a363-45dac9516032", title: "等加速度運動", type: "kinematics", marker: "Uses Delta x = v_i t + (1/2) a t^2", controls: [n("initialVelocityMetersPerSecond", "初速度 v₀", -10, 10, 0.5, 2, "m/s"), n("accelerationMetersPerSecondSquared", "加速度 a", -5, 5, 0.5, 1, "m/s²"), n("timeSeconds", "時間 t", 0, 10, 0.5, 5, "s")] },
    { lessonId: "6af8b2ab-59ec-83ee-ad40-ab08b031bac4", messageId: "5b130bd5-68d0-426c-a363-45dac9516032", title: "鉛直拋體運動", type: "freeFall", marker: "Shows an object moving vertically under gravity", controls: [n("initialHeightMeters", "初始高度 h₀", 1, 20, 1, 14, "m"), n("initialVelocityMetersPerSecond", "初速度 v₀", -20, 20, 1, 0, "m/s"), n("timeSeconds", "經過時間 t", 0, 8, 0.05, 0, "s")] },
    { lessonId: "6af8b359-d8f8-83ec-b0ed-96ba7d22d2da", messageId: "b42128dc-eca0-43a2-a991-7268f28e9d65", title: "角速度與頻率", type: "angularFrequency", marker: "Shows the relationship between angular frequency", controls: [n("frequency", "頻率 f", 0.1, 10, 0.1, 2, "Hz")] },
    { lessonId: "6af8b359-d8f8-83ec-b0ed-96ba7d22d2da", messageId: "b42128dc-eca0-43a2-a991-7268f28e9d65", title: "向心力", type: "centripetal", marker: "Shows a mass moving in a circle with tangential velocity", controls: [n("massKilograms", "質量 m", 0.5, 10, 0.5, 2, "kg"), n("speedMetersPerSecond", "速率 v", 0.5, 15, 0.5, 4, "m/s"), n("radiusMeters", "半徑 r", 0.5, 10, 0.5, 2, "m")] },
    { lessonId: "6af8b3dc-5ad4-83ee-9a6c-e98105cb5cd8", messageId: "0586b50b-dd5e-4770-89b0-d06c85e17556", title: "牛頓第二定律", type: "newton2", marker: "Shows how a box's mass and rightward horizontal net force", controls: [n("netForceNewtons", "合力 F", 0, 20, 1, 8, "N"), n("massKilograms", "質量 m", 0.5, 10, 0.5, 2, "kg")] },
    { lessonId: "6af8b3dc-5ad4-83ee-9a6c-e98105cb5cd8", messageId: "0586b50b-dd5e-4770-89b0-d06c85e17556", title: "作用力與反作用力", type: "newton3", marker: "Illustrates Newton's third-law relation", controls: [s("example", "互動情境", "pushingBox", [["pushingBox", "人推箱子"], ["collidingBalls", "兩球碰撞"], ["boxOnTable", "箱子靜置於桌面"]]) ] },
    { lessonId: "6af8b46e-6d50-83e8-9824-43b47d05edfa", messageId: "197541f0-18b1-4ce6-9a5a-ef5ecbf1ee39", title: "萬有引力提供向心力", type: "centripetal", marker: "Shows a mass moving in a circle with tangential velocity", controls: [n("massKilograms", "質量 m", 0.5, 10, 0.5, 2, "kg"), n("speedMetersPerSecond", "速率 v", 0.5, 15, 0.5, 4, "m/s"), n("radiusMeters", "半徑 r", 0.5, 10, 0.5, 2, "m")] },
    { lessonId: "6af8c6b9-868c-83ee-9c3e-ddc03bc231d5", messageId: "5b01c9ae-c293-49f6-86a0-3c2d56fd14cb", title: "波速、頻率與波長", type: "waveSpeed", marker: "Shows the relationship among wave speed, frequency, and wavelength.", controls: [n("frequency", "頻率 f", 0.5, 10, 0.5, 5, "Hz"), n("wavelength", "波長 λ", 0.1, 4, 0.1, 0.8, "m")] },
    { lessonId: "6af8c7a3-5fcc-83ee-ac84-ae6049d8f257", messageId: "dbd2b6cf-e2e7-4698-9de6-99df18b19989", title: "駐波的波速關係", type: "waveSpeed", marker: "Shows the relationship among wave speed, frequency, and wavelength.", controls: [n("frequency", "頻率 f", 0.5, 10, 0.5, 2, "Hz"), n("wavelength", "波長 λ", 0.5, 8, 0.5, 3, "m")] },
    { lessonId: "6af8c856-4b00-83ee-b6af-b7537295eefa", messageId: "9bd5735c-640a-46d4-8fbf-0a003c53ebae", title: "臨界角與全反射", type: "criticalAngle", marker: "Shows the critical-angle relation sin(theta_c)", controls: [n("indexRatio", "折射率比 n₂/n₁", 0.1, 0.99, 0.0001, 0.6667), n("incidentAngle", "入射角 θ", 0, 89, 0.01, 45, "°")] },
    { lessonId: "6af8c8c2-5628-83ee-aeea-3624022eddf5", messageId: "ef5b7c91-e86a-4ebd-a6c1-443b7d59d54b", title: "點電荷的電場", type: "pointCharge", marker: "Shows the point-charge relation E = k|q|/r^2", controls: [s("polarity", "電荷極性", "positive", [["positive", "正電荷"], ["negative", "負電荷"]]), n("distance", "探測距離 r", 0.5, 5, 0.1, 2, "相對單位")] },
    { lessonId: "6af8cc07-8c48-83ec-9446-fbd8e47da050", messageId: "a552f24b-33a0-4671-a324-9359db0f556b", title: "原子粒子數模型", type: "atom", marker: "Shows a generic atom model where changing proton", controls: [n("protons", "質子數 p", 1, 20, 1, 6), n("neutrons", "中子數 n", 0, 24, 1, 6), n("electrons", "電子數 e", 0, 20, 1, 6)] },
    { lessonId: "6af8cd34-b860-83ee-af65-cd646d0bfd74", messageId: "3804c22c-5a48-4275-a698-5164c51b9db8", title: "指數衰減", type: "decay", marker: "Shows how an exponential quantity decreases over time.", controls: [n("initial", "初始量 N₀", 0.1, 2, 0.1, 1), n("decay", "衰減常數 λ", 0.05, 2, 0.000001, 0.693147, "時間⁻¹"), n("time", "時間 t", 0, 5, 0.05, 1)] },
    { lessonId: "6af95661-c488-83ec-9b13-986d06cf2b7f", messageId: "01c0a771-1eff-4697-a584-bdcecc93bc2a", title: "z 分數", type: "zScore", marker: "Explains a z-score relative to a mean", controls: [n("x", "觀察值 x", -5, 5, 0.1, 1.2), n("mu", "平均數 μ", -5, 5, 0.1, 0), n("sigma", "標準差 σ", 0.1, 5, 0.1, 1)] },
    { lessonId: "6afd5281-8950-83ee-a6ee-f0d0e9267db6", messageId: "10564263-b187-48eb-acfc-d95404b2f1dd", title: "質量、體積與密度", type: "density", densityUnit: "g/cm³", marker: "Explains the relationship between mass, density, and volume.", controls: [n("mass", "質量 m", 1, 30, 1, 12, "g"), n("volume", "體積 V", 1, 20, 1, 5, "cm³")] },
    { lessonId: "6afd52ed-e4e0-83e8-80ed-187991462cf6", messageId: "3dcaee9f-be82-4277-ac9d-9602af2db2de", title: "熱量與溫度變化", type: "specificHeat", marker: "Shows how adjustable heat q changes a 1 kg copper", controls: [s("material", "物質", "water", [["water", "水"], ["sand", "砂"], ["copper", "銅"]]), n("heatKj", "熱量 q", -100, 100, 1, 40, "kJ")] },
    { lessonId: "6afd52ed-e4e0-83e8-80ed-187991462cf6", messageId: "3dcaee9f-be82-4277-ac9d-9602af2db2de", title: "鹽或糖在水中的溶解", type: "dissolution", marker: "Shows a salt or sugar crystal dissolving in water across three particle-level stages.", controls: [s("solute", "溶質", "salt", [["salt", "食鹽"], ["sugar", "蔗糖"]]), n("stage", "溶解過程", 0, 2, 1, 0)] },
    { lessonId: "6afd53e1-2b34-83ec-b9e0-003c061d14e4", messageId: "0a672dcf-255d-45a8-b9e1-ef7c1d663ee1", title: "質量、體積與密度", type: "density", densityUnit: "g/L", marker: "Explains the relationship between mass, density, and volume.", controls: [n("mass", "質量 m", 1, 30, 1, 12, "g"), n("volume", "體積 V", 1, 20, 1, 5, "L")] },
    { lessonId: "6afd54da-7e70-83ec-8771-36f269ff7846", messageId: "e1365503-83ba-4156-add6-2e89363e115c", title: "食鹽或蔗糖的粒子溶解模型", type: "dissolution", marker: "Shows a salt or sugar crystal dissolving in water across three particle-level stages.", controls: [s("solute", "溶質", "salt", [["salt", "食鹽"], ["sugar", "蔗糖"]]), n("stage", "溶解過程", 0, 2, 1, 0)] },
    { lessonId: "6afd54da-7e70-83ec-8771-36f269ff7846", messageId: "e1365503-83ba-4156-add6-2e89363e115c", title: "溶解度與飽和狀態", type: "solubility", marker: "Compares equal-solvent beakers as solid solute is added at fixed temperature.", controls: [n("added", "加入溶質", 0, 60, 1, 20, "g／100 g 水")] },
    { lessonId: "6afd5572-9ea0-83ee-81b7-0d775b578b48", messageId: "b51f149b-2237-4c5b-bf06-6bec717902e8", title: "電解質導電模型", type: "conductivity", marker: "Shows a conductivity tester with two electrodes", controls: [s("initial_solution", "溶液", "potassium-chloride", [["potassium-chloride", "氯化鉀（強電解質）"], ["acetic-acid", "醋酸（弱電解質）"], ["ethanol", "乙醇（非電解質）"]]), n("initial_concentration", "濃度", 0, 1.2, 0.05, 0.6, "mol/L")] },
    { lessonId: "6afd55c3-2658-83ee-9d8f-e71f367eaa57", messageId: "817cdb74-b482-4631-8627-a5f1ef291d9a", title: "原子粒子數模型", type: "atom", marker: "Shows a generic atom model where changing proton", controls: [n("protons", "質子數 p", 1, 20, 1, 6), n("neutrons", "中子數 n", 0, 24, 1, 6), n("electrons", "電子數 e", 0, 20, 1, 6)] },
    { lessonId: "6afd57ef-bf7c-83ee-9662-ce9fd0e6a08d", messageId: "a1210257-deec-483b-9682-cecf2406c984", title: "電子域與分子形狀", type: "vsepr", marker: "Shows how bonded atoms and lone electron pairs spread out around a central atom", controls: [s("configuration", "電子域組態", "AX4", [["AX2", "AX₂"], ["AX3", "AX₃"], ["AX2E", "AX₂E"], ["AX4", "AX₄"], ["AX3E", "AX₃E"], ["AX2E2", "AX₂E₂"], ["AX5", "AX₅"], ["AX6", "AX₆"]]), n("rotation", "模型旋轉角", 0, 360, 5, 0, "°")] },
    { lessonId: "6afd583c-8a64-83e8-82e1-9b7ee437d461", messageId: "d5801458-188f-435d-a40c-1b9d22afd22b", title: "離子或分子在水中的分散", type: "dissolution", marker: "Shows a salt or sugar crystal dissolving in water across three particle-level stages.", controls: [s("solute", "溶質", "salt", [["salt", "食鹽"], ["sugar", "蔗糖"]]), n("stage", "溶解過程", 0, 2, 1, 0)] },
    { lessonId: "6afd6c8e-ad10-83ee-bee4-b9bdb921c71e", messageId: "bb6624fe-010d-4995-8976-9228fc0ca968", title: "離子積與 Ksp", type: "solubilityProduct", sourceParameters: ["dissolution_stoichiometry", "ksp"], marker: "Shows how the ion product of a slightly soluble ionic solid", controls: [n("logRatio", "log₁₀(Q/Ksp)", -2, 2, 0.1, 0)] },
    { lessonId: "6afd6c8e-ad10-83ee-bee4-b9bdb921c71e", messageId: "bb6624fe-010d-4995-8976-9228fc0ca968", title: "溶解度與飽和狀態", type: "solubility", marker: "Compares equal-solvent beakers as solid solute is added at fixed temperature.", controls: [n("added", "加入溶質", 0, 60, 1, 20, "g／100 g 水")] },
    { lessonId: "6afd6e26-09a4-83e8-ab21-2ce0d09f4c45", messageId: "987d8fdc-2de2-4169-be35-d71aecede310", title: "緩衝液如何抵抗酸鹼", type: "bufferCapacity", marker: "Compares the pH change caused by the same modest strong-acid", controls: [s("challenge", "加入物質", "acid", [["acid", "加入強酸"], ["base", "加入強鹼"]]), n("dose", "加入量", 0, 3, 0.1, 1, "mmol")] },
    { lessonId: "6afd6e26-09a4-83e8-ab21-2ce0d09f4c45", messageId: "987d8fdc-2de2-4169-be35-d71aecede310", title: "緩衝區與 pKa", type: "bufferCurve", marker: "Shows a biological weak-acid/conjugate-base buffer as a pH-versus-acid/base-challenge titration curve.", controls: [n("pKa", "pKa", 3, 7, 0.01, 4.76), n("challenge", "酸鹼加入量", -15, 15, 0.5, 0, "mmol")] },
    { lessonId: "6afd6e80-aadc-83ee-b9eb-4f8cc1d9e04a", messageId: "5b9d87d7-cc33-44aa-b99b-58b610332544", title: "強弱酸鹼滴定曲線", type: "titration", marker: "Interactive high-school titration at 25 C adds a 0.100 M acid titrant", controls: [s("experiment", "滴定組合", "strong-strong", [["strong-strong", "強酸－強鹼"], ["strong-weak", "強酸－弱鹼"], ["weak-strong", "弱酸－強鹼"]]), n("acidVolumeMl", "加入酸體積", 0, 20, 0.5, 0, "mL")] },
    { lessonId: "6afd70eb-8bf8-83e8-9273-5a10a71af1b6", messageId: "14706ad7-213b-4fcf-bfe3-14443c6a613b", title: "電池電位、自由能與平衡", type: "electrochem", marker: "Shows the standard Gibbs free-energy, equilibrium-constant, and cell-potential relationship triangle", controls: [n("standard_cell_potential_volts", "標準電池電位 E°", -1, 1, 0.01, 0.12, "V"), n("electrons_transferred", "轉移電子數 n", 1, 6, 1, 2), n("temperature_kelvin", "溫度 T", 250, 400, 0.01, 298.15, "K")] },
    { lessonId: "6afd74ed-dfc4-83ee-a861-4445ff890da3", messageId: "90856fba-88da-4e4b-8be8-de8637fb0257", title: "分子式與實驗式", type: "empirical", marker: "Compares a discrete molecule's actual atom counts", controls: [s("example", "分子範例", "glucose", [["glucose", "葡萄糖 C₆H₁₂O₆"], ["water", "水 H₂O"], ["carbon-dioxide", "二氧化碳 CO₂"], ["benzene", "苯 C₆H₆"]])] },
    { lessonId: "6afd79be-45d4-83ee-bcda-066079974065", messageId: "0f16d869-dbcb-46d1-a19d-66bcb8787b57", title: "食鹽或蔗糖的粒子溶解", type: "dissolution", marker: "Shows a salt or sugar crystal dissolving in water across three particle-level stages.", controls: [s("solute", "溶質", "salt", [["salt", "食鹽"], ["sugar", "蔗糖"]]), n("stage", "溶解過程", 0, 2, 1, 0)] },
    { lessonId: "6afd79be-45d4-83ee-bcda-066079974065", messageId: "0f16d869-dbcb-46d1-a19d-66bcb8787b57", title: "PM2.5 與 PM10 粒徑", type: "particulate", marker: "Compares the inclusive PM2.5 and PM10 particle-diameter cutoffs", controls: [n("diameter", "代表粒徑", 0.1, 100, 0.1, 2.5, "μm")] },
  ];
  let nextWidgetId = 0;

  function n(key, label, min, max, step, initial, unit = "") {
    return { key, label, min, max, step, initial, unit };
  }
  function s(key, label, initial, options) { return { key, label, initial, options }; }

  function specFor(doc, message, block, blocks) {
    if (!doc || !message || !block || message.role !== "assistant" || block.kind !== "paragraph") return null;
    const candidates = specs.filter(spec => spec.lessonId === doc.id && spec.messageId === message.id &&
      block.text.trim().startsWith(spec.marker));
    if (!candidates.length) return null;
    const index = blocks?.indexOf(block) ?? -1;
    const occurrence = index < 0 ? 1 : 1 + blocks.slice(0, index).filter(previous =>
      previous.kind === "paragraph" && previous.text.trim().startsWith(candidates[0].marker)).length;
    const matched = candidates.find(spec => (spec.occurrence ?? 1) === occurrence);
    if (!matched) {
      console.error("互動講義元件出現次序不符", doc.id, message.id, occurrence);
      return null;
    }
    return matched;
  }

  function skippedInitialBlocks(blocks, index) {
    if (blocks[index + 1]?.kind !== "paragraph" || !/^初始值\s*[:：]$/.test(blocks[index + 1].text.trim())) return 0;
    const list = blocks[index + 2];
    if (list?.kind !== "list" || !list.items.length || !list.items.every(item => /^[\w-]+\s*[:：]/.test(item.trim()))) return 0;
    return 2;
  }

  function parseInitialValues(items, spec) {
    const values = {};
    const sourceParameters = {};
    const controls = new Map(spec.controls.map(control => [control.key, control]));
    const parameters = new Set(spec.sourceParameters ?? []);
    for (const item of items) {
      const match = item.trim().match(/^([\w-]+)\s*[:：]\s*(.*?)\s*$/);
      if (!match) continue;
      const [, key, raw] = match;
      if (!controls.has(key) && !parameters.has(key)) continue;
      let value;
      try {
        value = /^".*"$/.test(raw) ? JSON.parse(raw) : Number.isFinite(Number(raw)) ? Number(raw) : raw;
      } catch (error) {
        throw new Error("互動講義元件初值格式錯誤（" + spec.lessonId + "／" + key + "）：" + error.message);
      }
      const control = controls.get(key);
      if (control) {
        const inRange = control.options
          ? control.options.some(([option]) => option === String(value))
          : Number.isFinite(value) && value >= control.min && value <= control.max;
        const onStep = control.options || !inRange || Math.abs((value - control.min) / control.step -
          Math.round((value - control.min) / control.step)) < 1e-8;
        if (!inRange || !onStep) throw new RangeError("互動講義元件初值不符合控制範圍或刻度（" +
          spec.lessonId + "／" + key + "）：" + value);
        values[key] = value;
      } else sourceParameters[key] = value;
    }
    return { values, sourceParameters };
  }

  function planMessage(doc, message, blocks) {
    const widgets = new Map();
    for (const [index, block] of blocks.entries()) {
      const spec = specFor(doc, message, block, blocks);
      if (!spec) continue;
      const count = skippedInitialBlocks(blocks, index);
      const initial = count ? blocks[index + 2].items : [];
      widgets.set(index, { spec, ...parseInitialValues(initial, spec), skippedCount: count });
    }
    return widgets;
  }

  function render(spec, rawValues, sourceParameters = {}) {
    return renderLegacyModel(spec, rawValues, sourceParameters);
  }

  global.LessonLegacyWidgets = Object.freeze({ specFor, planMessage, render, specifications: specs });

  function renderLegacyModel(spec, rawValues, sourceParameters) {
    const values = {};
    for (const control of spec.controls) {
      const supplied = Object.hasOwn(rawValues, control.key);
      values[control.key] = supplied ? rawValues[control.key] : control.initial;
    }
    const figure = document.createElement("figure");
    figure.className = "lesson-visualization legacy-lesson-widget";
    figure.dataset.visualization = spec.type;
    figure.dataset.provenance = "reconstructed-from-lesson-description";
    const caption = document.createElement("figcaption");
    caption.textContent = spec.title;
    const svg = createSvg("svg", { viewBox: "0 0 400 220", role: "img", "aria-label": spec.title });
    const controlsNode = document.createElement("div");
    controlsNode.className = "visualization-controls";
    const widgetId = "legacy-control-" + (++nextWidgetId);
    const controls = spec.controls.map((control, index) => {
      const group = document.createElement("div");
      group.className = "visualization-control";
      const controlId = widgetId + "-" + index;
      if (control.options) {
        const label = document.createElement("label");
        label.className = "control-title";
        label.htmlFor = controlId;
        label.textContent = control.label + (control.unit ? "（" + control.unit + "）" : "");
        const select = document.createElement("select");
        select.id = controlId;
        for (const [value, text] of control.options) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = text;
          select.append(option);
        }
        select.value = String(values[control.key]);
        group.append(label, select);
        controlsNode.append(group);
        return { control, select };
      }
      const range = document.createElement("input");
      range.type = "range";
      const exactAngle = spec.type === "criticalAngle" && control.key === "incidentAngle";
      range.min = String(control.min); range.max = String(control.max); range.step = exactAngle ? "any" : String(control.step);
      range.value = String(values[control.key]);
      range.id = controlId + "-range";
      const rangeLabel = document.createElement("label");
      rangeLabel.className = "visually-hidden";
      rangeLabel.htmlFor = range.id;
      rangeLabel.textContent = control.label + (control.unit ? "（" + control.unit + "）" : "") + "滑桿";
      const numberInput = document.createElement("input");
      numberInput.type = "number";
      numberInput.min = String(control.min); numberInput.max = String(control.max); numberInput.step = exactAngle ? "any" : String(control.step);
      numberInput.value = String(values[control.key]);
      numberInput.id = controlId + "-number";
      const title = document.createElement("label");
      title.className = "control-title";
      title.htmlFor = numberInput.id;
      title.textContent = control.label + (control.unit ? "（" + control.unit + "）" : "");
      group.append(title, rangeLabel, range, numberInput);
      controlsNode.append(group);
      return { control, range, numberInput };
    });
    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "重設";
    reset.setAttribute("aria-label", `重設${spec.title}`);
    const criticalAngleButton = spec.type === "criticalAngle" ? document.createElement("button") : null;
    if (criticalAngleButton) {
      criticalAngleButton.type = "button";
      criticalAngleButton.textContent = "設為臨界角";
      criticalAngleButton.setAttribute("aria-label", "將入射角設為計算出的臨界角");
      controlsNode.append(criticalAngleButton);
    }
    controlsNode.append(reset);
    const output = document.createElement("output");
    output.className = "visualization-output";
    output.setAttribute("aria-live", "polite");
    const provenance = document.createElement("p");
    provenance.className = "visualization-provenance";
    const exampleControls = spec.controls.filter(control => !Object.hasOwn(rawValues, control.key));
    const sourceCount = spec.controls.length - exampleControls.length;
    const provenanceParts = ["初始值：" + sourceCount + " 項來自講義匯出，" + exampleControls.length + " 項使用示例值。"];
    if (exampleControls.length) provenanceParts.push("示例值：" + exampleControls.map(control =>
      control.label + " " + values[control.key] + (control.unit ? " " + control.unit : "")).join("、") + "。");
    provenanceParts.push("控制範圍與刻度為互動示例設計。互動依講義描述重建。");
    if (spec.type === "solubility") provenanceParts.push("溶解度以 36 g／100 g 水作示例假設。");
    if (Object.keys(sourceParameters).length) {
      const parameterLabels = { dissolution_stoichiometry: "溶解化學計量式", ksp: "Ksp" };
      provenanceParts.push("講義模型參數：" +
        Object.entries(sourceParameters).map(([key, value]) => (parameterLabels[key] ?? key) + " = " + value).join("；") + "。");
    }
    provenance.textContent = provenanceParts.join(" ");
    figure.append(caption, svg, controlsNode, output, provenance);

    function update() {
      const state = evaluate(spec.type, values, spec, sourceParameters);
      svg.replaceChildren();
      draw(spec.type, state, values, svg, spec);
      output.textContent = state.summary;
      svg.setAttribute("aria-label", `${spec.title}。${state.summary}`);
    }
    function setValue(control, value, exact = false) {
      if (control.options) {
        if (!control.options.some(([key]) => key === String(value))) return;
        values[control.key] = String(value);
      } else {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return;
        const bounded = Math.min(control.max, Math.max(control.min, numeric));
        const stepped = control.min + Math.round((bounded - control.min) / control.step) * control.step;
        const exactControl = exact || spec.type === "criticalAngle" && control.key === "incidentAngle";
        values[control.key] = Number((exactControl ? bounded : stepped).toPrecision(12));
      }
      for (const binding of controls) if (binding.control === control) {
        const current = String(values[control.key]);
        if (binding.range) binding.range.value = current;
        if (binding.numberInput) binding.numberInput.value = current;
        if (binding.select) binding.select.value = current;
      }
      update();
    }
    for (const binding of controls) {
      const { control } = binding;
      if (binding.range) {
        binding.range.addEventListener("input", () => setValue(control, binding.range.valueAsNumber));
        binding.numberInput.addEventListener("input", () => {
          const number = binding.numberInput.valueAsNumber;
          if (binding.numberInput.validity.valid && Number.isFinite(number) &&
              number >= control.min && number <= control.max) setValue(control, number);
        });
        const commit = () => {
          if (!binding.numberInput.value.trim() || !Number.isFinite(binding.numberInput.valueAsNumber)) binding.numberInput.value = String(values[control.key]);
          else setValue(control, binding.numberInput.valueAsNumber);
        };
        binding.numberInput.addEventListener("change", commit);
        binding.numberInput.addEventListener("blur", commit);
      } else binding.select.addEventListener("change", () => setValue(control, binding.select.value, binding.select));
    }
    if (criticalAngleButton) criticalAngleButton.addEventListener("click", () => {
      const angleControl = spec.controls.find(control => control.key === "incidentAngle");
      const critical = Math.asin(Math.min(0.9999, values.indexRatio)) * 180 / Math.PI;
      setValue(angleControl, critical, true);
    });
    reset.addEventListener("click", () => {
      for (const binding of controls) {
        const initial = Object.hasOwn(rawValues, binding.control.key) ? rawValues[binding.control.key] : binding.control.initial;
        values[binding.control.key] = initial;
        const current = String(initial);
        if (binding.range) binding.range.value = current;
        if (binding.numberInput) binding.numberInput.value = current;
        if (binding.select) binding.select.value = current;
      }
      update();
    });
    update();
    return figure;
  }

  function createSvg(tag, attrs = {}, content) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function evaluate(type, v, spec, sourceParameters) {
    switch (type) {
      case "kinematics": {
        const { initialVelocityMetersPerSecond: vi, accelerationMetersPerSecondSquared: a, timeSeconds: t } = v;
        const domainEnd = Math.max(t, 0.5);
        return { summary: `Δx = v₀t + ½at² = ${(vi * t + 0.5 * a * t * t).toFixed(2)} m；v = ${(vi + a * t).toFixed(2)} m/s`,
          graph: { domain: [0, domainEnd], labels: ["t = 0 s", `${domainEnd.toFixed(1)} s`], curves: [
            { name: "位置 x(t)", color: 0, fn: x => vi * x + 0.5 * a * x * x },
            { name: "速度 v(t)", color: 1, fn: x => vi + a * x },
            { name: "加速度 a(t)", color: 2, fn: () => a },
          ] } };
      }
      case "freeFall": {
        const g = 9.8, h0 = v.initialHeightMeters, v0 = v.initialVelocityMetersPerSecond;
        const impactTime = (v0 + Math.sqrt(v0 * v0 + 2 * g * h0)) / g;
        const t = Math.min(v.timeSeconds, impactTime);
        const height = Math.max(0, h0 + v0 * t - 0.5 * g * t * t);
        const velocity = v0 - g * t;
        const heightMax = h0 + (v0 > 0 ? v0 * v0 / (2 * g) : 0);
        return { summary: t >= impactTime ? "物體已落地；下落時間約 " + impactTime.toFixed(2) + " s。"
          : "t = " + t.toFixed(2) + " s；離地高度 " + height.toFixed(2) + " m；v = " + velocity.toFixed(2) + " m/s。",
          height, heightMax, velocity, gravity: g, impactTime, progress: t / Math.max(impactTime, 0.01) };
      }
      case "angularFrequency": {
        const omega = 2 * Math.PI * v.frequency;
        return { summary: "ω = 2πf = " + omega.toFixed(2) + " rad/s；週期 T = " + (1 / v.frequency).toFixed(2) + " s",
          frequency: v.frequency, omega };
      }
      case "centripetal": {
        const force = v.massKilograms * v.speedMetersPerSecond ** 2 / v.radiusMeters;
        return { summary: "F向 = mv²/r = " + force.toFixed(2) + " N；速率加倍時，向心力變為 4 倍。",
          force, mass: v.massKilograms, speed: v.speedMetersPerSecond, radius: v.radiusMeters };
      }
      case "newton2": return { summary: `a = F/m = ${(v.netForceNewtons / v.massKilograms).toFixed(2)} m/s²；方向與合力相同。`, force: v.netForceNewtons, acceleration: v.netForceNewtons / v.massKilograms };
      case "newton3": return { summary: "兩個力大小相等、方向相反，分別作用在兩個不同物體上。", example: v.example };
      case "waveSpeed": return { summary: `v = fλ = ${(v.frequency * v.wavelength).toFixed(2)} m/s；一個週期內，波前進一個波長。`, frequency: v.frequency, wavelength: v.wavelength };
      case "criticalAngle": {
        const critical = Math.asin(Math.min(0.9999, v.indexRatio)) * 180 / Math.PI;
        const atCritical = Math.abs(v.incidentAngle - critical) < 1e-9;
        return { summary: "θc = sin⁻¹(n₂/n₁) = " + critical.toFixed(2) + "°；目前入射角 " +
          v.incidentAngle + "°，" + (atCritical ? "折射光沿介面前進" :
            v.incidentAngle > critical ? "發生全反射" : "仍有折射光") + "。",
          critical, atCritical, incident: v.incidentAngle, ratio: v.indexRatio };
      }
      case "pointCharge": return { summary: `場強大小 E ∝ |q|/r²；距離 ${v.distance.toFixed(1)} 時，相對場強為 ${(1 / v.distance ** 2).toFixed(3)}。電場${v.polarity === "positive" ? "背離" : "指向"}電荷。`, distance: v.distance, fieldStrength: 1 / v.distance ** 2, polarity: v.polarity };
      case "atom": return { summary: `質子 ${v.protons} 個 → ${elementName(v.protons)}；質量數 A = p+n = ${v.protons + v.neutrons}；淨電荷 ${v.protons - v.electrons >= 0 ? "+" : ""}${v.protons - v.electrons}。`, protons: v.protons, neutrons: v.neutrons, electrons: v.electrons };
      case "decay": return { summary: `N(t) = N₀e^(−λt) = ${(v.initial * Math.exp(-v.decay * v.time)).toFixed(3)}；若 λ = ln 2，半衰期為 1 個時間單位。`, initial: v.initial, decay: v.decay, time: v.time, amount: v.initial * Math.exp(-v.decay * v.time) };
      case "zScore": return { summary: `z = (x−μ)/σ = ${((v.x - v.mu) / v.sigma).toFixed(2)}；${Math.abs((v.x - v.mu) / v.sigma).toFixed(2)} 個標準差${v.x >= v.mu ? "高於" : "低於"}平均數。`, z: (v.x - v.mu) / v.sigma };
      case "density": {
        const unit = spec?.densityUnit ?? "g/cm³";
        return { summary: "ρ = m/V = " + (v.mass / v.volume).toFixed(3) + " " + unit + "。",
          density: v.mass / v.volume, densityUnit: unit, mass: v.mass, volume: v.volume };
      }
      case "specificHeat": {
        const heatCapacity = { water: 4.18, sand: 0.84, copper: 0.385 }[v.material];
        const change = v.heatKj / heatCapacity;
        return { summary: `ΔT = q/(mc) = ${change.toFixed(2)} °C（m = 1 kg，c = ${heatCapacity} kJ/(kg·°C)）。`, material: v.material, heat: v.heatKj, change };
      }
      case "dissolution": {
        const stage = ["晶體尚未溶解", "部分粒子已分散", "粒子均勻分散"][v.stage];
        const description = v.solute === "salt"
          ? v.stage === 0 ? "NaCl 晶格中的 Na⁺ 與 Cl⁻ 交錯排列。"
            : "Na⁺ 與 Cl⁻ 分別分散；水分子的 O 端朝向 Na⁺、H 端朝向 Cl⁻。"
          : "蔗糖分子保持完整，分散並受到水分子包圍；溶解不代表分子解離。";
        return { summary: stage + "；" + description, solute: v.solute, stage: v.stage };
      }
      case "solubility": {
        const dissolved = Math.min(v.added, 36);
        const solid = Math.max(0, v.added - 36);
        const saturated = v.added >= 36;
        return { summary: solid ? "溶液已飽和：溶解 " + dissolved + " g，另有 " + solid + " g 固體剩下。"
          : saturated ? "溶液已飽和：36 g 全部溶解，沒有剩餘固體。"
            : "未達飽和：已加入的 " + dissolved + " g 全部溶解。",
          dissolved, solid, added: v.added, saturated, solubility: 36 };
      }
      case "conductivity": {
        const ionFraction = v.initial_solution === "potassium-chloride" ? 1
          : v.initial_solution === "acetic-acid" ? 0.35 : 0;
        const formulaUnits = Math.round(v.initial_concentration * 8);
        const ionPairs = Math.round(formulaUnits * ionFraction);
        const neutralMolecules = formulaUnits - ionPairs;
        const current = v.initial_concentration === 0 ? 0
          : ionFraction * v.initial_concentration / (v.initial_concentration + 0.2);
        const description = v.initial_solution === "potassium-chloride" ? "KCl 為強電解質，溶液中有較多可移動離子。"
          : v.initial_solution === "acetic-acid" ? "醋酸為弱電解質，只有一部分分子電離。"
            : "乙醇為非電解質，幾乎不提供可移動離子。";
        return { summary: description + " 濃度 " + v.initial_concentration.toFixed(2) +
          " mol/L；粒子數與燈泡亮度僅作定性示意，不代表實測導電度。",
          solution: v.initial_solution, concentration: v.initial_concentration, current, ionFraction,
          formulaUnits, ionPairs, neutralMolecules };
      }
      case "vsepr": {
        const geometry = { AX2: [2, 0, "直線形"], AX3: [3, 0, "平面三角形"], AX2E: [2, 1, "折線形"], AX4: [4, 0, "正四面體"], AX3E: [3, 1, "三角錐形"], AX2E2: [2, 2, "折線形"], AX5: [5, 0, "三角雙錐"], AX6: [6, 0, "正八面體"] }[v.configuration];
        return { summary: `${v.configuration.replace("E", "E ")}：中心原子周圍 ${geometry[0] + geometry[1]} 個電子域，分子形狀為${geometry[2]}。`, configuration: v.configuration, bonds: geometry[0], lonePairs: geometry[1], rotation: v.rotation };
      }
      case "solubilityProduct": {
        const ratio = 10 ** v.logRatio;
        const stoichiometry = sourceParameters.dissolution_stoichiometry;
        const ksp = Number(sourceParameters.ksp);
        if (stoichiometry !== "MX" || !Number.isFinite(ksp) || ksp <= 0) {
          throw new RangeError("Ksp 模型缺少有效的 MX 化學計量式或來源 Ksp。");
        }
        const q = ksp * ratio;
        const ionConcentration = Math.sqrt(q);
        const direction = ratio < 1 ? "Q < Ksp：固體傾向溶解。"
          : ratio > 1 ? "Q > Ksp：離子傾向沉澱。" : "Q = Ksp：系統處於飽和動態平衡。";
        return { summary: "MX(s) ⇌ M⁺ + X⁻；Ksp = " + ksp.toExponential(2) +
          "；Q = " + q.toExponential(2) + "；[M⁺] = [X⁻] ≈ " + ionConcentration.toExponential(2) +
          " M（依 MX 等莫耳離子假設）。Q/Ksp = " + ratio.toPrecision(3) + "；" + direction,
          ratio, q, ionConcentration, stoichiometry, ksp, direction };
      }
      case "bufferCapacity": {
        const acid = v.challenge === "acid";
        const amount = v.dose;
        const acidAmount = 10 + (acid ? amount : -amount);
        const baseAmount = 10 + (acid ? -amount : amount);
        const phBuffer = 4.76 + Math.log10(baseAmount / acidAmount);
        const phWater = amount === 0 ? 7
          : acid ? -Math.log10(amount / 1000) : 14 + Math.log10(amount / 1000);
        return { summary: "等莫耳緩衝液初始 pH 4.76；各含 10 mmol HA、A⁻。加入" +
          (acid ? "強酸" : "強鹼") + " " + amount.toFixed(1) + " mmol 後，緩衝液 pH 約 " +
          phBuffer.toFixed(2) + "，1 L 水約 " + phWater.toFixed(2) +
          "。比較假設稀溶液、體積固定為 1 L，忽略活度效應。",
          acid, amount, phBuffer, phWater, acidReserve: acidAmount, baseReserve: baseAmount,
          initialBufferPh: 4.76, initialWaterPh: 7 };
      }
      case "bufferCurve": {
        const equilibrium = bufferEquilibrium(v.challenge, v.pKa);
        const { ph, acidReserve, baseReserve } = equilibrium;
        return { summary: "加入酸／鹼 " + v.challenge.toFixed(1) + " mmol；pH 約 " +
          ph.toFixed(2) + "。平衡時 HA " + acidReserve.toFixed(1) + " mmol、A⁻ " +
          baseReserve.toFixed(1) + " mmol。模型假設加入前各有 10 mmol HA、共軛鹼，溶液體積固定為 1 L；pH 由質量與電荷平衡計算。",
          pKa: v.pKa, challenge: v.challenge, ...equilibrium };
      }
      case "titration": {
        const ph = titrationPh(v.experiment, v.acidVolumeMl);
        return { summary: "加入 0.100 M 酸 " + v.acidVolumeMl.toFixed(1) + " mL；目前 pH 約 " +
          ph.toFixed(2) + "。基準為 10.0 mL、0.100 M 鹼，25 °C；弱酸鹼採用醋酸／醋酸根 pKa 4.76 與銨離子 pKa 9.25。",
          experiment: v.experiment, volume: v.acidVolumeMl, ph };
      }
      case "electrochem": {
        const faraday = 96485, gas = 8.314;
        const deltaG = -v.electrons_transferred * faraday * v.standard_cell_potential_volts / 1000;
        const log10K = v.electrons_transferred * faraday * v.standard_cell_potential_volts / (2.303 * gas * v.temperature_kelvin);
        return { summary: `ΔG° = −nFE° = ${deltaG.toFixed(2)} kJ/mol；log₁₀K = ${log10K.toFixed(2)}；${v.standard_cell_potential_volts > 0 ? "標準狀態下正向自發" : v.standard_cell_potential_volts < 0 ? "標準狀態下逆向較有利" : "正逆方向平衡"}。`, deltaG, log10K, potential: v.standard_cell_potential_volts };
      }
      case "empirical": {
        const formulas = { glucose: ["C", 6, "H", 12, "O", 6, "葡萄糖"], water: ["H", 2, "O", 1, "", 0, "水"], "carbon-dioxide": ["C", 1, "O", 2, "", 0, "二氧化碳"], benzene: ["C", 6, "H", 6, "", 0, "苯"] };
        const f = formulas[v.example];
        const nums = [f[1], f[3], f[5]].filter(x => x > 0);
        const divisor = nums.reduce(gcd);
        const molecularMass = [[f[0], f[1]], [f[2], f[3]], [f[4], f[5]]]
          .reduce((sum, [symbol, count]) => sum + (atomicMass[symbol] ?? 0) * count, 0);
        const empiricalMass = molecularMass / divisor;
        return { summary: f[6] + "：分子式 " + formulaText(f, 1) + "；實驗式 " +
          formulaText(f, divisor) + "；最簡化因數 " + divisor + "。",
          formula: f, divisor, multiplier: divisor, molecularMass, empiricalMass };
      }
      case "particulate": {
        const d = v.diameter;
        return { summary: `代表粒徑 ${d.toFixed(1)} μm：${d <= 2.5 ? "屬於 PM2.5，也屬於 PM10。" : d <= 10 ? "不屬於 PM2.5，但屬於 PM10。" : "大於 PM10 的粒徑界線。"} PM10 的界線直徑是 PM2.5 的 4 倍。`, diameter: d };
      }
      default: throw new RangeError(`未知的教材模型：${type}`);
    }
  }

  function titrationPh(experiment, volumeMl) {
    const acid = 0.1 * volumeMl;
    const base = 1;
    const excess = acid - base;
    const volumeLiters = (10 + volumeMl) / 1000;
    if (experiment === "strong-strong") {
      if (Math.abs(excess) < 1e-12) return 7;
      const concentration = Math.abs(excess) / (10 + volumeMl);
      return excess < 0 ? 14 + Math.log10(concentration) : -Math.log10(concentration);
    }
    if (experiment === "strong-weak") {
      if (volumeMl === 0) return weakBasePh(0.1, 9.25);
      if (volumeMl < 10) return 9.25 + Math.log10((base - acid) / acid);
      if (Math.abs(excess) < 1e-12) return weakAcidPh(base / 1000 / volumeLiters, 9.25);
      return -Math.log10(excess / (10 + volumeMl));
    }
    if (Math.abs(excess) < 1e-12) return weakBasePh(base / 1000 / volumeLiters, 4.76);
    if (excess < 0) return 14 + Math.log10((base - acid) / (10 + volumeMl));
    return 4.76 + Math.log10(base / excess);
  }
  function bufferEquilibrium(challenge, pKa) {
    const ka = 10 ** -pKa;
    const totalBuffer = 20 / 1000;
    const initialCation = 10 / 1000;
    const addedCation = Math.max(0, challenge) / 1000;
    const addedAnion = Math.max(0, -challenge) / 1000;
    const chargeBalance = logHydrogen => {
      const hydrogen = 10 ** logHydrogen;
      const hydroxide = 1e-14 / hydrogen;
      const conjugateBase = totalBuffer * ka / (ka + hydrogen);
      return hydrogen + initialCation + addedCation - hydroxide - addedAnion - conjugateBase;
    };

    let low = -14, high = 0;
    for (let iteration = 0; iteration < 80; iteration++) {
      const middle = (low + high) / 2;
      if (chargeBalance(middle) > 0) high = middle;
      else low = middle;
    }
    const ph = -(low + high) / 2;
    const hydrogen = 10 ** -ph;
    const baseReserve = totalBuffer * ka / (ka + hydrogen) * 1000;
    const acidReserve = totalBuffer * 1000 - baseReserve;
    return { ph, acidReserve, baseReserve };
  }
  function weakAcidPh(concentration, pKa) {
    const ka = 10 ** -pKa;
    const hydrogen = (-ka + Math.sqrt(ka * ka + 4 * ka * concentration)) / 2;
    return -Math.log10(hydrogen);
  }
  function weakBasePh(concentration, pKaConjugateAcid) {
    const kb = 10 ** (pKaConjugateAcid - 14);
    const hydroxide = (-kb + Math.sqrt(kb * kb + 4 * kb * concentration)) / 2;
    return 14 + Math.log10(hydroxide);
  }
  function elementName(number) {
    return ["", "氫", "氦", "鋰", "鈹", "硼", "碳", "氮", "氧", "氟", "氖", "鈉", "鎂", "鋁", "矽", "磷", "硫", "氯", "氬", "鉀", "鈣"][number] ?? `原子序 ${number}`;
  }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function sub(number) { return number ? String(number).replace(/[0-9]/g, d => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]) : ""; }
  const atomicMass = { H: 1.008, C: 12.011, O: 15.999 };
  function formulaText(formula, divisor) {
    return [[formula[0], formula[1]], [formula[2], formula[3]], [formula[4], formula[5]]]
      .filter(([, count]) => count > 0)
      .map(([symbol, count]) => symbol + (count / divisor > 1 ? sub(count / divisor) : ""))
      .join("");
  }

  function draw(type, state, v, svg, spec) {
    switch (type) {
      case "kinematics": drawRows(svg, state.graph.curves, state.graph.domain, state.graph.labels); break;
      case "decay": drawGraph(svg, state.time, [{ name: "剩餘量 N(t)", color: 0, fn: t => state.initial * Math.exp(-state.decay * t) }], [0, Math.max(5, state.time)], [0, state.initial], ["0", "時間"]); break;
      case "bufferCurve": drawBufferCurve(svg, state); break;
      case "titration": drawTitration(svg, state); break;
      case "waveSpeed": drawWave(svg, state.frequency, state.wavelength); break;
      case "freeFall": drawFreeFall(svg, state); break;
      case "angularFrequency": drawCircular(svg, state, "angularFrequency"); break;
      case "centripetal": drawCircular(svg, state, "centripetal"); break;
      case "newton2": drawNewton2(svg, state); break;
      case "newton3": drawNewton3(svg, state.example); break;
      case "criticalAngle": drawRefraction(svg, state); break;
      case "pointCharge": drawPointCharge(svg, state); break;
      case "atom": drawAtom(svg, state); break;
      case "zScore": drawZScore(svg, state.z); break;
      case "density": drawDensity(svg, state, spec); break;
      case "specificHeat": drawHeat(svg, state); break;
      case "dissolution": drawDissolution(svg, state); break;
      case "solubility": drawSolubility(svg, state); break;
      case "conductivity": drawConductivity(svg, state); break;
      case "vsepr": drawVsepr(svg, state); break;
      case "solubilityProduct": drawKsp(svg, state); break;
      case "bufferCapacity": drawBufferCompare(svg, state); break;
      case "electrochem": drawElectrochem(svg, state); break;
      case "empirical": drawEmpirical(svg, state); break;
      case "particulate": drawParticulate(svg, state); break;
      default: throw new RangeError(`沒有圖形繪製器：${type}`);
    }
  }

  function drawGraph(svg, marker, curves, domain, yDomain, labels, layout = {}) {
    const x0 = 42, x1 = 390, y0 = layout.plotBottom ?? 175, y1 = layout.plotTop ?? 18;
    const py = y => y0 - (y - yDomain[0]) / (yDomain[1] - yDomain[0]) * (y0 - y1);
    for (let i = 0; i <= 4; i++) {
      const y = y1 + (y0 - y1) * i / 4;
      svg.append(createSvg("line", { x1: x0, x2: x1, y1: y, y2: y, class: "visualization-grid" }));
    }
    svg.append(createSvg("line", { x1: x0, x2: x1, y1: y0, y2: y0, class: "visualization-axis" }));
    for (const [index, curve] of curves.entries()) {
      const points = [];
      for (let i = 0; i <= 100; i++) {
        const x = domain[0] + (domain[1] - domain[0]) * i / 100;
        const value = curve.fn(x);
        if (!Number.isFinite(value)) throw new RangeError("圖形計算出非有限值。");
        points.push(`${(x0 + (x - domain[0]) / (domain[1] - domain[0]) * (x1 - x0)).toFixed(1)},${py(value).toFixed(1)}`);
      }
      svg.append(createSvg("polyline", { points: points.join(" "), class: `visualization-curve c${curve.color ?? index}` }));
    }
    const markerX = x0 + (Math.min(domain[1], Math.max(domain[0], marker)) - domain[0]) / (domain[1] - domain[0]) * (x1 - x0);
    const markerY = py(Math.max(yDomain[0], Math.min(yDomain[1], curves[0].fn(marker))));
    svg.append(createSvg("line", { x1: markerX, x2: markerX, y1: y1, y2: y0, class: "visualization-marker-line" }), createSvg("circle", { cx: markerX, cy: markerY, r: 5, class: "visualization-marker" }));
    const labelsY = layout.labelsY ?? 201;
    svg.append(createSvg("text", { x: x0, y: labelsY, class: "visualization-label" }, labels[0]), createSvg("text", { x: x1, y: labelsY, class: "visualization-label", "text-anchor": "end" }, labels[1]));
  }

  function drawTitration(svg, state) {
    drawGraph(svg, state.volume, [{ name: "滴定曲線", color: 0,
      fn: volume => titrationPh(state.experiment, volume) }], [0, 20], [0, 14],
    ["0 mL", "酸體積"], { plotTop: 38, plotBottom: 170, labelsY: 190 });
    svg.append(createSvg("rect", { x: 42, y: 8, width: 36, height: 18, rx: 4,
      fill: universalIndicatorColor(state.ph), stroke: "var(--line)" }),
      createSvg("text", { x: 86, y: 22, class: "visualization-label", "text-anchor": "start" },
        "通用指示劑示意；pH = " + state.ph.toFixed(2)));
  }

  function universalIndicatorColor(ph) {
    const stops = [
      [0, [190, 35, 64]], [2, [224, 55, 54]], [4, [239, 132, 43]],
      [6, [224, 207, 55]], [7, [67, 160, 83]], [8, [45, 164, 135]],
      [10, [47, 105, 190]], [12, [91, 66, 168]], [14, [128, 57, 150]],
    ];
    const bounded = Math.min(14, Math.max(0, ph));
    let index = 0;
    while (index < stops.length - 2 && bounded > stops[index + 1][0]) index++;
    const [lowPh, low] = stops[index], [highPh, high] = stops[index + 1];
    const ratio = (bounded - lowPh) / (highPh - lowPh);
    const channels = low.map((channel, position) => Math.round(channel + (high[position] - channel) * ratio));
    return "rgb(" + channels.join(", ") + ")";
  }

  function drawRows(svg, curves, domain, labels) {
    const colors = [0, 1, 2];
    const scales = [
      { min: -400, max: 400, label: "x(t) [m]" },
      { min: -60, max: 60, label: "v(t) [m/s]" },
      { min: -5, max: 5, label: "a [m/s²]" },
    ];
    curves.forEach((curve, row) => {
      const scale = scales[row];
      const yTop = 17 + row * 58, plotTop = yTop + 15, plotBottom = yTop + 50;
      const x0 = 80, x1 = 390;
      const yFor = value => plotBottom - (Math.min(scale.max, Math.max(scale.min, value)) - scale.min) /
        (scale.max - scale.min) * (plotBottom - plotTop);
      const zeroY = yFor(0);
      svg.append(createSvg("line", { x1: x0, x2: x1, y1: plotTop, y2: plotTop, class: "visualization-grid" }),
        createSvg("line", { x1: x0, x2: x1, y1: zeroY, y2: zeroY, class: "visualization-axis" }),
        createSvg("line", { x1: x0, x2: x1, y1: plotBottom, y2: plotBottom, class: "visualization-grid" }));
      svg.append(createSvg("text", { x: 5, y: yTop + 10, class: "visualization-label", "text-anchor": "start" }, scale.label),
        createSvg("text", { x: 73, y: plotTop + 3, class: "visualization-label", "text-anchor": "end" }, String(scale.max)),
        createSvg("text", { x: 73, y: zeroY + 3, class: "visualization-label", "text-anchor": "end" }, "0"),
        createSvg("text", { x: 73, y: plotBottom + 3, class: "visualization-label", "text-anchor": "end" }, String(scale.min)));
      const points = [];
      for (let i = 0; i <= 80; i++) {
        const x = domain[0] + (domain[1] - domain[0]) * i / 80;
        points.push(`${(x0 + i / 80 * (x1 - x0)).toFixed(1)},${yFor(curve.fn(x)).toFixed(1)}`);
      }
      svg.append(createSvg("polyline", { points: points.join(" "), class: `visualization-curve c${colors[row]}` }));
    });
    svg.append(createSvg("text", { x: 80, y: 211, class: "visualization-label" }, labels[0]), createSvg("text", { x: 390, y: 211, class: "visualization-label", "text-anchor": "end" }, labels[1]));
  }

  function drawWave(svg, frequency, wavelength) {
    const x0 = 42, x1 = 350, y0 = 112, amplitude = 52, domain = 4;
    svg.append(createSvg("line", { x1: x0, x2: x1, y1: y0, y2: y0, class: "visualization-axis" }));
    const points = [];
    for (let i = 0; i <= 120; i++) {
      const x = domain * i / 120;
      const y = y0 - amplitude * Math.sin(2 * Math.PI * x / wavelength);
      points.push((x0 + (x / domain) * (x1 - x0)).toFixed(1) + "," + y.toFixed(1));
    }
    svg.append(createSvg("polyline", { points: points.join(" "), class: "visualization-curve c0" }));
    text(svg, x0, 202, "0 m");
    text(svg, x1, 202, "固定空間範圍 4 m");
    const speed = frequency * wavelength;
    const arrowLength = 24 + Math.min(92, speed * 12);
    arrow(svg, 76, 174, 76 + arrowLength, 174, "var(--chart-1)");
    text(svg, 245, 170, "v = fλ = " + speed.toFixed(2) + " m/s");
    text(svg, 200, 17, "f = " + frequency + " Hz；λ = " + wavelength + " m；波形為空間示意");
  }
  function drawFreeFall(svg, state) {
    const top = 24, ground = 188;
    const y = ground - state.height / Math.max(1, state.heightMax) * (ground - top);
    svg.append(createSvg("line", { x1: 100, x2: 300, y1: ground, y2: ground, class: "visualization-axis" }),
      createSvg("line", { x1: 200, x2: 200, y1: top, y2: ground, class: "visualization-grid" }),
      createSvg("circle", { cx: 200, cy: y, r: 15, class: "visualization-marker" }),
      createSvg("text", { x: 224, y: y + 5, class: "visualization-label" }, "h = " + state.height.toFixed(1) + " m"),
      createSvg("text", { x: 150, y: 211, class: "visualization-label" }, "地面"));
    if (state.height > 0.05 && Math.abs(state.velocity) > 0.05) {
      const direction = state.velocity > 0 ? -1 : 1;
      const available = direction < 0 ? y - top - 8 : ground - y - 8;
      const length = Math.min(42, 12 + Math.abs(state.velocity) * 1.4, Math.max(0, available));
      if (length >= 8) {
        arrow(svg, 245, y, 245, y + direction * length, "var(--chart-1)");
        const labelY = Math.min(ground - 4, Math.max(top + 14, y + direction * 28));
        text(svg, 283, labelY, "v");
      }
    }
    arrow(svg, 285, 70, 285, 108, "var(--chart-2)");
    text(svg, 312, 92, "g 向下");
  }
  function arrow(svg, x1, y1, x2, y2, color = "var(--chart-0)") {
    const angle = Math.atan2(y2 - y1, x2 - x1), size = 8;
    const x3 = x2 - size * Math.cos(angle - Math.PI / 6), y3 = y2 - size * Math.sin(angle - Math.PI / 6);
    const x4 = x2 - size * Math.cos(angle + Math.PI / 6), y4 = y2 - size * Math.sin(angle + Math.PI / 6);
    svg.append(createSvg("line", { x1, y1, x2, y2, stroke: color, "stroke-width": 3 }), createSvg("polygon", { points: `${x2},${y2} ${x3},${y3} ${x4},${y4}`, fill: color }));
  }
  function drawCircular(svg, state, kind) {
    const cx = 200, cy = 112;
    const radius = kind === "centripetal" ? 34 + Math.min(10, state.radius) * 5 : 68;
    const angle = kind === "angularFrequency" ? (state.frequency - 0.1) / 9.9 * Math.PI * 2 : 0;
    const px = cx + radius * Math.cos(angle), py = cy + radius * Math.sin(angle);
    svg.append(createSvg("circle", { cx, cy, r: radius, fill: "none", stroke: "var(--muted)", "stroke-width": 1.5 }),
      createSvg("circle", { cx: px, cy: py, r: 10, class: "visualization-marker" }),
      createSvg("circle", { cx, cy, r: 4, fill: "var(--ink)" }));
    if (kind === "angularFrequency") {
      const tangentLength = 18 + Math.min(58, state.omega * 2.2);
      const tx = -Math.sin(angle), ty = Math.cos(angle);
      arrow(svg, px, py, px + tx * tangentLength, py + ty * tangentLength, "var(--chart-0)");
      text(svg, 200, 207, "f = " + state.frequency + " Hz；ω = " + state.omega.toFixed(2) + " rad/s；示意轉動相位");
    } else {
      const tangentLength = 20 + Math.min(70, state.speed * 4);
      const forceLength = 14 + Math.min(48, Math.log1p(state.force) * 8);
      arrow(svg, px, py, px - Math.sin(angle) * tangentLength, py + Math.cos(angle) * tangentLength, "var(--chart-0)");
      arrow(svg, px, py, px - Math.cos(angle) * forceLength, py - Math.sin(angle) * forceLength, "var(--chart-1)");
      text(svg, 200, 207, "r = " + state.radius + " m；m = " + state.mass + " kg；v = " +
        state.speed + " m/s；F向 = " + state.force.toFixed(2) + " N");
    }
  }
  function drawNewton2(svg, state) {
    svg.append(createSvg("line", { x1: 70, x2: 330, y1: 160, y2: 160, class: "visualization-axis" }), createSvg("rect", { x: 166, y: 100, width: 68, height: 54, rx: 7, class: "visualization-block" }), createSvg("text", { x: 200, y: 132, class: "visualization-label", "text-anchor": "middle" }, `${state.force} N`));
    const forceLength = Math.min(150, state.force * 8);
    const accelerationLength = Math.min(130, state.acceleration * 14);
    if (state.force > 0) arrow(svg, 200, 90, 200 + forceLength, 90, "var(--chart-1)");
    if (state.acceleration > 0) arrow(svg, 200, 75, 200 + accelerationLength, 75, "var(--chart-0)");
    svg.append(createSvg("text", { x: 200, y: 40, class: "visualization-label", "text-anchor": "middle" }, "合力 F → 加速度 a"));
  }
  function drawNewton3(svg, example) {
    if (example === "pushingBox") {
      svg.append(createSvg("circle", { cx: 100, cy: 130, r: 22, class: "visualization-marker" }), createSvg("rect", { x: 245, y: 110, width: 60, height: 45, rx: 5, class: "visualization-block" }));
      text(svg, 100, 174, "人"); text(svg, 275, 174, "箱子"); arrow(svg, 130, 98, 210, 98); arrow(svg, 230, 126, 150, 126, "var(--chart-1)");
    } else if (example === "collidingBalls") {
      svg.append(createSvg("circle", { cx: 145, cy: 120, r: 30, class: "visualization-marker" }), createSvg("circle", { cx: 255, cy: 120, r: 30, class: "visualization-endpoint" }));
      arrow(svg, 170, 75, 225, 75); arrow(svg, 230, 160, 175, 160, "var(--chart-1)"); text(svg, 145, 124, "A"); text(svg, 255, 124, "B");
    } else {
      svg.append(createSvg("line", { x1: 105, x2: 295, y1: 155, y2: 155, stroke: "var(--muted)", "stroke-width": 6 }), createSvg("rect", { x: 166, y: 100, width: 68, height: 54, rx: 6, class: "visualization-block" }));
      arrow(svg, 200, 100, 200, 48); arrow(svg, 200, 155, 200, 203, "var(--chart-1)"); text(svg, 240, 54, "桌面對箱子"); text(svg, 240, 204, "箱子對桌面");
    }
    text(svg, 200, 24, "兩力大小相等、方向相反，作用在不同物體");
  }

  function text(svg, x, y, value) { svg.append(createSvg("text", { x, y, class: "visualization-label", "text-anchor": "middle" }, value)); }
  function drawRefraction(svg, state) {
    svg.append(createSvg("line", { x1: 35, x2: 365, y1: 112, y2: 112, stroke: "var(--muted)", "stroke-width": 3 }), createSvg("line", { x1: 200, x2: 200, y1: 24, y2: 204, class: "visualization-grid" }));
    const theta = state.incident * Math.PI / 180;
    arrow(svg, 200 - 100 * Math.sin(theta), 112 - 100 * Math.cos(theta), 200, 112);
    if (state.incident > state.critical && !state.atCritical) {
      arrow(svg, 200, 112, 200 + 100 * Math.sin(theta), 112 - 100 * Math.cos(theta), "var(--chart-1)");
      text(svg, 300, 54, "全反射");
    } else {
      const refracted = state.atCritical ? Math.PI / 2
        : Math.asin(Math.min(1, Math.sin(theta) / Math.max(state.ratio, 0.1)));
      arrow(svg, 200, 112, 200 + 85 * Math.sin(refracted), 112 + 85 * Math.cos(refracted), "var(--chart-1)");
      text(svg, 296, state.atCritical ? 126 : 175, state.atCritical ? "沿介面" : "折射光");
    }
    text(svg, 100, 42, "n₁ 較大"); text(svg, 300, 198, "n₂ 較小");
  }
  function drawPointCharge(svg, state) {
    const cx = 200, cy = 110, r = 48 + state.distance * 18, px = cx + r;
    svg.append(createSvg("circle", { cx, cy, r: 20, fill: state.polarity === "positive" ? "var(--chart-0)" : "var(--chart-1)" }));
    text(svg, cx, cy + 5, state.polarity === "positive" ? "+q" : "−q");
    const fieldRadius = 112;
    for (const angle of [-60, 0, 60, 120, 180, 240]) {
      const a = angle * Math.PI / 180, x1 = cx + 28 * Math.cos(a), y1 = cy + 28 * Math.sin(a), x2 = cx + fieldRadius * Math.cos(a), y2 = cy + fieldRadius * Math.sin(a);
      arrow(svg, state.polarity === "positive" ? x1 : x2, state.polarity === "positive" ? y1 : y2,
        state.polarity === "positive" ? x2 : x1, state.polarity === "positive" ? y2 : y1);
    }
    svg.append(createSvg("line", { x1: cx, x2: px, y1: cy, y2: cy, class: "visualization-grid" }),
      createSvg("circle", { cx: px, cy, r: 9, class: "visualization-marker" }),
      createSvg("line", { x1: px, x2: px, y1: cy + 10, y2: cy + 24, class: "visualization-grid" }));
    const normalizedStrength = Math.min(1, Math.max(0, (state.fieldStrength - 0.04) / 3.96));
    const vectorLength = 8 + normalizedStrength * 40;
    const direction = state.polarity === "positive" ? 1 : -1;
    arrow(svg, px, cy + 28, px + direction * vectorLength, cy + 28, "var(--chart-2)");
    text(svg, 200, 174, `r = ${state.distance.toFixed(1)}；相對場強 E = ${state.fieldStrength.toFixed(3)}`);
    text(svg, 200, 204, "測點箭長經縮放，僅示意場強變化；周圍場線僅示方向");
  }
  function drawAtom(svg, state) {
    const cx = 200, cy = 105;
    const shellRadii = [25, 47, 69, 91], shellCapacities = [2, 8, 8, 2];
    shellRadii.forEach(radius => svg.append(createSvg("circle", {
      cx, cy, r: radius, fill: "none", stroke: "var(--line)", "stroke-width": 1.5,
    })));
    const nucleons = [...Array(state.protons).fill("p"), ...Array(state.neutrons).fill("n")];
    nucleons.forEach((kind, index) => {
      const columns = 8, row = Math.floor(index / columns), column = index % columns;
      const rowLength = Math.min(columns, nucleons.length - row * columns);
      const x = cx + (column - (rowLength - 1) / 2) * 7.5;
      const y = cy + (row - (Math.ceil(nucleons.length / columns) - 1) / 2) * 7.5;
      svg.append(createSvg("circle", { cx: x, cy: y, r: 3.5, fill: kind === "p" ? "var(--chart-1)" : "var(--chart-0)" }));
    });
    let remaining = state.electrons;
    shellRadii.forEach((radius, shell) => {
      const count = Math.min(remaining, shellCapacities[shell]);
      for (let index = 0; index < count; index++) {
        const angle = index * Math.PI * 2 / count + shell * 0.18;
        svg.append(createSvg("circle", {
          cx: cx + radius * Math.cos(angle), cy: cy + radius * Math.sin(angle),
          r: 4, fill: "var(--chart-2)",
        }));
      }
      remaining -= count;
    });
    text(svg, cx, 197, elementName(state.protons) + "；質子 p = " + state.protons + "、中子 n = " + state.neutrons);
    text(svg, cx, 213, "電子 e = " + state.electrons + "；殼層 2、8、8、2 示意，未依比例");
  }
  function drawZScore(svg, z) {
    const limit = Math.max(3, Math.ceil(Math.abs(z) * 1.1));
    drawGraph(svg, z, [{ color: 0, fn: x => Math.exp(-x * x / 2) }], [-limit, limit], [0, 1.1],
      ["−" + limit + "σ", "+" + limit + "σ"]);
    text(svg, 200, 15, "常態分布示意；標記為觀察值 x");
  }
  function drawDensity(svg, state, spec) {
    const width = 60 + Math.min(150, state.volume * 6), height = 40 + Math.min(80, state.mass * 3), x = 200 - width / 2, y = 154 - height;
    svg.append(createSvg("rect", { x, y, width, height, rx: 8, class: "visualization-block" }), createSvg("line", { x1: 70, x2: 330, y1: 156, y2: 156, class: "visualization-axis" }));
    const volumeUnit = spec.controls.find(control => control.key === "volume")?.unit ?? "";
    text(svg, 200, y - 8, "m = " + state.mass + " g");
    text(svg, 200, 185, "V = " + state.volume + " " + volumeUnit);
    text(svg, 200, 213, "ρ = " + state.density.toFixed(2) + " " + state.densityUnit);
  }
  function drawHeat(svg, state) {
    svg.append(createSvg("rect", { x: 100, y: 34, width: 200, height: 136, rx: 14, fill: "var(--wash)", stroke: "var(--line)" }));
    const baseline = 102, maxChange = 100 / 0.385;
    const rise = Math.abs(state.change) / maxChange * 55;
    const color = state.heat >= 0 ? "var(--chart-1)" : "var(--chart-0)";
    svg.append(createSvg("line", { x1: 124, x2: 276, y1: baseline, y2: baseline, class: "visualization-axis" }));
    if (rise > 0) svg.append(createSvg("rect", { x: 145,
      y: state.heat >= 0 ? baseline - Math.max(3, rise) : baseline,
      width: 110, height: Math.max(3, rise), rx: 8, fill: color, "fill-opacity": 0.75 }));
    text(svg, 200, 52, "固定量尺：ΔT = ±259.7 °C 對應 55 px");
    text(svg, 200, 194, `${state.material === "water" ? "水" : state.material === "sand" ? "砂" : "銅"}；熱量 q = ${state.heat} kJ`);
    text(svg, 200, 213, `溫度變化 ΔT = ${state.change.toFixed(2)} °C`);
  }

  function drawDissolution(svg, state) {
    svg.append(createSvg("rect", { x: 65, y: 42, width: 270, height: 135, rx: 10, fill: "var(--wash)", stroke: "var(--line)", "stroke-width": 2 }));
    if (state.solute === "salt") {
      const drawIon = (x, y, positive) => {
        svg.append(createSvg("circle", { cx: x, cy: y, r: 6,
          fill: positive ? "var(--chart-0)" : "var(--chart-1)" }));
        svg.append(createSvg("text", { x, y: y + 3, class: "visualization-label",
          "text-anchor": "middle", "font-size": 10 }, positive ? "+" : "−"));
      };
      const hydrateIon = (x, y, positive) => {
        for (const angle of [0, Math.PI]) {
          const waterX = x + 14 * Math.cos(angle), waterY = y + 14 * Math.sin(angle);
          drawHydrationWater(svg, waterX, waterY, angle, positive);
        }
      };
      if (state.stage === 0) {
        for (let pair = 0; pair < 18; pair++) {
          const x = 91 + (pair % 6) * 42, y = 146 + Math.floor(pair / 6) * 10;
          drawIon(x - 6, y, true); drawIon(x + 6, y, false);
        }
      } else if (state.stage === 1) {
        for (let index = 0; index < 16; index++) {
          const row = Math.floor(index / 4), column = index % 4;
          const x = 105 + column * 58, y = 60 + row * 24;
          const positive = (row + column) % 2 === 0;
          drawIon(x, y, positive);
          if ([4, 5, 10, 11].includes(index)) hydrateIon(x, y, positive);
        }
        for (let pair = 0; pair < 10; pair++) {
          const x = 105 + (pair % 5) * 42, y = 148 + Math.floor(pair / 5) * 10;
          drawIon(x - 6, y, true); drawIon(x + 6, y, false);
        }
      } else {
        for (let index = 0; index < 36; index++) {
          const row = Math.floor(index / 6), column = index % 6;
          const x = 82 + column * 47, y = 55 + row * 22;
          const positive = (row + column) % 2 === 0;
          drawIon(x, y, positive);
          if ([14, 15, 20, 21].includes(index)) hydrateIon(x, y, positive);
        }
      }
    } else {
      const points = Array.from({ length: 18 }, (_, index) => ({
        x: 95 + (index % 6) * 39,
        y: 72 + Math.floor(index / 6) * 31,
      }));
      const dispersed = Math.round(points.length * state.stage / 2);
      points.forEach((point, index) => {
        const position = index < dispersed
          ? { x: point.x, y: point.y }
          : { x: 155 + (index % 6) * 14, y: 145 - Math.floor((index - dispersed) / 6) * 12 };
        svg.append(createSvg("circle", { cx: position.x, cy: position.y, r: 10, fill: "var(--chart-2)" }));
        text(svg, position.x, position.y + 3, "糖");
        if (index < dispersed && index < 6) {
          for (const angle of [0, Math.PI / 2, Math.PI]) {
            drawHydrationWater(svg, position.x + 15 * Math.cos(angle), position.y + 15 * Math.sin(angle),
              angle + Math.PI, index % 2 === 0);
          }
        }
      });
    }
    text(svg, 200, 202, state.solute === "salt"
      ? state.stage === 0 ? "NaCl 晶格：Na⁺、Cl⁻ 交錯排列"
        : state.stage === 1 ? "部分離子分散；其餘仍在晶格"
          : "Na⁺、Cl⁻ 分開分布；水的 O 朝 Na⁺、H 朝 Cl⁻"
      : "蔗糖分子保持完整，周圍水分子示意氫鍵水合");
    text(svg, 200, 216, state.stage === 0 ? "水合未開始；示意粒子未按比例" : "水合水分子未按比例；溶解粒子彼此分開");
  }

  function drawHydrationWater(svg, x, y, angle, oxygenFacesSolute) {
    const ux = Math.cos(angle), uy = Math.sin(angle);
    const px = -uy, py = ux;
    const oxygenSign = oxygenFacesSolute ? -1 : 1;
    const hydrogenSign = -oxygenSign;
    const oxygen = { x: x + oxygenSign * 3 * ux, y: y + oxygenSign * 3 * uy };
    const hydrogens = [-1, 1].map(side => ({
      x: x + hydrogenSign * 3 * ux + side * 3.2 * px,
      y: y + hydrogenSign * 3 * uy + side * 3.2 * py,
    }));
    hydrogens.forEach(hydrogen => svg.append(createSvg("line", {
      x1: oxygen.x, y1: oxygen.y, x2: hydrogen.x, y2: hydrogen.y,
      stroke: "var(--muted)", "stroke-width": 1.3,
    })));
    svg.append(createSvg("circle", { cx: oxygen.x, cy: oxygen.y, r: 2.8, fill: "var(--chart-1)" }));
    hydrogens.forEach(hydrogen => svg.append(createSvg("circle", {
      cx: hydrogen.x, cy: hydrogen.y, r: 2, fill: "var(--muted)",
    })));
  }

  function drawSolubility(svg, state) {
    const waterTop = 60;
    svg.append(createSvg("path", { d: "M112 35 L112 171 Q200 188 288 171 L288 35", fill: "none", stroke: "var(--muted)", "stroke-width": 3 }),
      createSvg("path", { d: `M115 ${waterTop} L115 169 Q200 183 285 169 L285 ${waterTop} Z`, fill: "var(--wash)" }));
    const count = Math.round(state.dissolved / 3);
    for (let i = 0; i < count; i++) {
      const x = 133 + (i % 6) * 26, y = 83 + Math.floor(i / 6) * 28;
      svg.append(createSvg("circle", { cx: x, cy: y, r: 5, fill: "var(--chart-0)" }));
    }
    const solids = Math.min(18, Math.ceil(state.solid / 2));
    for (let i = 0; i < solids; i++) {
      const x = 163 + (i % 6) * 13, y = 160 - Math.floor(i / 6) * 8;
      svg.append(createSvg("circle", { cx: x, cy: y, r: 4.5, fill: "var(--chart-1)" }));
    }
    text(svg, 200, 198, state.saturated ? "已飽和" : "尚未飽和");
    text(svg, 200, 214, "加入 " + state.added + " g；溶解 " + state.dissolved + " g；剩餘 " + state.solid + " g");
  }

  function drawConductivity(svg, state) {
    const bulbOpacity = state.current > 0 ? 0.18 + 0.82 * state.current : 0.05;
    svg.append(createSvg("rect", { x: 92, y: 56, width: 216, height: 133, rx: 8, fill: "var(--wash)", stroke: "var(--line)", "stroke-width": 2 }),
      createSvg("path", { d: "M168 47 C168 19 232 19 232 47 L220 65 L180 65 Z", fill: "var(--chart-2)", opacity: bulbOpacity, stroke: "var(--muted)", "stroke-width": 2 }),
      createSvg("line", { x1: 168, x2: 112, y1: 44, y2: 44, stroke: "var(--muted)", "stroke-width": 3 }),
      createSvg("line", { x1: 112, x2: 112, y1: 44, y2: 77, stroke: "var(--muted)", "stroke-width": 3 }),
      createSvg("line", { x1: 232, x2: 288, y1: 44, y2: 44, stroke: "var(--muted)", "stroke-width": 3 }),
      createSvg("line", { x1: 288, x2: 288, y1: 44, y2: 77, stroke: "var(--muted)", "stroke-width": 3 }),
      createSvg("line", { x1: 165, x2: 165, y1: 72, y2: 151, stroke: "var(--chart-0)", "stroke-width": 5 }),
      createSvg("line", { x1: 235, x2: 235, y1: 72, y2: 151, stroke: "var(--chart-1)", "stroke-width": 5 }));
    const positions = Array.from({ length: 10 }, (_, index) => ({
      x: 124 + (index % 5) * 35, y: 98 + Math.floor(index / 5) * 39,
    }));
    for (let i = 0; i < state.ionPairs; i++) {
      const { x, y } = positions[i];
      svg.append(createSvg("circle", { cx: x - 6, cy: y, r: 6, fill: "var(--chart-0)", opacity: 0.86 }),
        createSvg("circle", { cx: x + 6, cy: y, r: 6, fill: "var(--chart-1)", opacity: 0.86 }));
      text(svg, x - 6, y + 3, "+"); text(svg, x + 6, y + 3, "−");
    }
    for (let i = 0; i < state.neutralMolecules; i++) {
      const { x, y } = positions[state.ionPairs + i];
      svg.append(createSvg("circle", { cx: x, cy: y, r: 7, fill: "var(--muted)", opacity: 0.72 }));
      text(svg, x, y + 3, "M");
    }
    svg.append(createSvg("rect", { x: 112, y: 174, width: 176, height: 6, rx: 3,
      fill: "var(--wash)", stroke: "var(--line)" }),
      createSvg("rect", { x: 112, y: 174, width: 176 * state.concentration / 1.2, height: 6, rx: 3,
        fill: "var(--chart-2)" }));
    const particleLabel = state.solution === "ethanol"
      ? "乙醇分子 M × " + state.neutralMolecules + "；可移動離子 0"
      : state.solution === "acetic-acid"
        ? "醋酸 M × " + state.neutralMolecules + "；離子對 × " + state.ionPairs
        : "K⁺、Cl⁻ 離子對 × " + state.ionPairs;
    text(svg, 200, 202, particleLabel);
    text(svg, 200, 216, "濃度 " + state.concentration.toFixed(2) + " mol/L；粒子數與燈泡亮度為定性示意");
  }

  function drawVsepr(svg, state) {
    const planar = [0, 120, 240].map(angle => {
      const radians = angle * Math.PI / 180;
      return [Math.cos(radians), Math.sin(radians), 0];
    });
    const tetra = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]
      .map(vector => vector.map(value => value / Math.sqrt(3)));
    const axial = [[0, 0, 1], [0, 0, -1], ...planar.map(([x, y]) => [x, y, 0])];
    const octa = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const configurations = {
      AX2: { shape: "直線形", vectors: [[1, 0, 0], [-1, 0, 0]], bonds: 2 },
      AX3: { shape: "平面三角形", vectors: planar, bonds: 3 },
      AX2E: { shape: "折線形", vectors: planar, bonds: 2 },
      AX4: { shape: "正四面體", vectors: tetra, bonds: 4 },
      AX3E: { shape: "三角錐形", vectors: tetra, bonds: 3 },
      AX2E2: { shape: "折線形", vectors: tetra, bonds: 2 },
      AX5: { shape: "三角雙錐", vectors: axial, bonds: 5 },
      AX6: { shape: "正八面體", vectors: octa, bonds: 6 },
    };
    const geometry = configurations[state.configuration];
    const cx = 200, cy = 105, rotation = state.rotation * Math.PI / 180;
    const projected = geometry.vectors.map(([x, y, z], index) => {
      const xr = x * Math.cos(rotation) + z * Math.sin(rotation);
      const zr = -x * Math.sin(rotation) + z * Math.cos(rotation);
      return { x: cx + xr * 78, y: cy - y * 78 - zr * 24, depth: zr, index };
    });
    const atoms = projected.slice(0, geometry.bonds).sort((a, b) => a.depth - b.depth);
    atoms.forEach(point => svg.append(createSvg("line", {
      x1: cx, y1: cy, x2: point.x, y2: point.y, stroke: "var(--muted)", "stroke-width": 3,
      ...(point.depth < -0.12 ? { "stroke-dasharray": "5 4" } : {}),
    })));
    projected.forEach((point, index) => {
      if (index < geometry.bonds) {
        svg.append(createSvg("circle", { cx: point.x, cy: point.y, r: 13, fill: "var(--chart-0)" }));
        text(svg, point.x, point.y + 4, "X");
      } else {
        const offset = point.depth < -0.12 ? 7 : 5;
        svg.append(createSvg("circle", { cx: point.x - offset, cy: point.y, r: 3.5, fill: "var(--chart-1)" }),
          createSvg("circle", { cx: point.x + offset, cy: point.y, r: 3.5, fill: "var(--chart-1)" }));
      }
    });
    svg.append(createSvg("circle", { cx, cy, r: 18, fill: "var(--chart-2)" }));
    text(svg, cx, cy + 4, "A");
    text(svg, cx, 211, state.configuration + "；" + geometry.shape + "；三維投影旋轉 " + state.rotation + "°");
  }

  function drawKsp(svg, state) {
    const x0 = 55, x1 = 345, y = 106;
    const position = x0 + (Math.log10(state.ratio) + 2) / 4 * (x1 - x0);
    svg.append(createSvg("rect", { x: x0, y: 85, width: (x1 - x0) / 2, height: 36, rx: 8, fill: "var(--chart-0)", opacity: 0.25 }),
      createSvg("rect", { x: (x0 + x1) / 2, y: 85, width: (x1 - x0) / 2, height: 36, rx: 8, fill: "var(--chart-1)", opacity: 0.25 }),
      createSvg("line", { x1: (x0 + x1) / 2, x2: (x0 + x1) / 2, y1: 66, y2: 143, stroke: "var(--ink)", "stroke-width": 2 }),
      createSvg("line", { x1: position, x2: position, y1: 68, y2: 145, stroke: "var(--chart-2)", "stroke-width": 4 }),
      createSvg("circle", { cx: position, cy: y, r: 9, fill: "var(--chart-2)" }));
    if (state.ratio < 1) {
      arrow(svg, 120, 67, 178, 67);
      text(svg, 200, 53, "淨溶解 → Q/Ksp = 1");
    } else if (state.ratio > 1) {
      arrow(svg, 280, 67, 222, 67, "var(--chart-1)");
      text(svg, 200, 53, "淨沉澱 → Q/Ksp = 1");
    } else text(svg, 200, 53, "Q = Ksp：動態平衡");
    text(svg, x0, 157, "0.01：未飽和");
    text(svg, (x0 + x1) / 2, 157, "1：飽和");
    text(svg, x1, 157, "100：過飽和");
    text(svg, 200, 188, "MX(s) ⇌ M⁺ + X⁻；Q = " + state.q.toExponential(2) + "；Ksp = " + state.ksp.toExponential(2));
    text(svg, 200, 210, "[M⁺] = [X⁻] ≈ " + state.ionConcentration.toExponential(2) + " M");
  }

  function drawBufferCompare(svg, state) {
    const rows = [{ label: "緩衝液", value: state.phBuffer, color: 0 }, { label: "水", value: state.phWater, color: 1 }];
    rows.forEach((row, index) => {
      const y = 58 + index * 75;
      text(svg, 75, y + 5, row.label);
      svg.append(createSvg("rect", { x: 112, y: y - 12, width: 220, height: 26, rx: 8, fill: "var(--wash)" }),
        createSvg("rect", { x: 112, y: y - 12, width: Math.max(2, row.value / 14 * 220), height: 26, rx: 8, fill: `var(--chart-${row.color})` }));
      text(svg, 350, y + 5, `pH ${row.value.toFixed(2)}`);
    });
    text(svg, 200, 171, "緩衝液反應後的 HA／A⁻ 存量");
    drawBufferReserves(svg, state.acidReserve, state.baseReserve, 187, 194);
    text(svg, 200, 216, state.acid ? "A⁻ + H⁺ → HA；純水 pH 變化較大" : "HA + OH⁻ → A⁻ + H₂O；純水 pH 變化較大");
  }

  function drawBufferCurve(svg, state) {
    drawGraph(svg, state.challenge, [{ name: "緩衝液 pH", color: 0,
      fn: challenge => bufferEquilibrium(challenge, state.pKa).ph }], [-15, 15], [0, 14],
    ["加酸 (mmol)", "加鹼 (mmol)"], { plotTop: 36, plotBottom: 145, labelsY: 164 });
    drawBufferReserves(svg, state.acidReserve, state.baseReserve, 182, 189);
    const direction = Math.abs(state.challenge) > 10
      ? "緩衝成分耗盡；多餘 " + (Math.abs(state.challenge) - 10).toFixed(1) + " mmol 強" +
        (state.challenge < 0 ? "酸" : "鹼")
      : state.challenge < 0 ? "加酸：A⁻ + H⁺ → HA"
        : state.challenge > 0 ? "加鹼：HA + OH⁻ → A⁻ + H₂O"
          : "起始 HA 與 A⁻ 各 10.0 mmol";
    text(svg, 200, 215, direction);
  }

  function drawBufferReserves(svg, acidReserve, baseReserve, labelY, barY) {
    const x = 68, width = 264, total = Math.max(1, acidReserve + baseReserve);
    const acidWidth = width * acidReserve / total;
    text(svg, 128, labelY, "HA " + acidReserve.toFixed(1) + " mmol");
    text(svg, 272, labelY, "A⁻ " + baseReserve.toFixed(1) + " mmol");
    svg.append(createSvg("rect", { x, y: barY, width, height: 12, rx: 6, fill: "var(--wash)", stroke: "var(--line)" }),
      createSvg("rect", { x, y: barY, width: acidWidth, height: 12, rx: 6, fill: "var(--chart-0)" }),
      createSvg("rect", { x: x + acidWidth, y: barY, width: width - acidWidth, height: 12, rx: 6, fill: "var(--chart-1)" }));
  }

  function drawElectrochem(svg, state) {
    const cards = [
      { x: 40, y: 42, title: "自由能變化", value: `ΔG° ${state.deltaG.toFixed(2)} kJ/mol`, color: 0 },
      { x: 220, y: 42, title: "電池電位", value: `E° ${state.potential.toFixed(2)} V`, color: 1 },
      { x: 130, y: 132, title: "平衡常數", value: `log₁₀K ${state.log10K.toFixed(2)}`, color: 2 },
    ];
    svg.append(createSvg("line", { x1: 150, y1: 92, x2: 190, y2: 132, stroke: "var(--muted)", "stroke-width": 2 }),
      createSvg("line", { x1: 250, y1: 92, x2: 210, y2: 132, stroke: "var(--muted)", "stroke-width": 2 }),
      createSvg("line", { x1: 150, y1: 163, x2: 250, y2: 163, stroke: "var(--muted)", "stroke-width": 2 }));
    cards.forEach(card => {
      svg.append(createSvg("rect", { x: card.x, y: card.y, width: 140, height: 54, rx: 9, fill: "var(--wash)", stroke: `var(--chart-${card.color})`, "stroke-width": 2 }));
      text(svg, card.x + 70, card.y + 20, card.title);
      text(svg, card.x + 70, card.y + 40, card.value);
    });
  }

  function drawEmpirical(svg, state) {
    const formula = state.formula;
    const atoms = [[formula[0], formula[1]], [formula[2], formula[3]], [formula[4], formula[5]]].filter(([, count]) => count > 0);
    const colors = ["var(--chart-0)", "var(--chart-1)", "var(--chart-2)"];
    const total = atoms.reduce((sum, [, count]) => sum + count, 0);
    let index = 0;
    atoms.forEach(([symbol, count], elementIndex) => {
      for (let i = 0; i < count; i++, index++) {
        const x = 58 + index % 12 * 25, y = 58 + Math.floor(index / 12) * 48;
        svg.append(createSvg("circle", { cx: x, cy: y, r: 11, fill: colors[elementIndex] }));
        text(svg, x, y + 4, symbol);
      }
    });
    const molecule = formulaText(formula, 1);
    const empirical = formulaText(formula, state.divisor);
    text(svg, 200, 165, formula[6] + "；分子式 " + molecule + " → 實驗式 " + empirical);
    text(svg, 200, 188, "各元素係數同除以 " + state.divisor + "；共有 " + total + " 個原子");
    text(svg, 200, 210, "M分子 = " + state.multiplier + " × M實驗式 = " +
      state.molecularMass.toFixed(2) + " = " + state.multiplier + " × " + state.empiricalMass.toFixed(2) + " g/mol");
  }

  function drawParticulate(svg, state) {
    const x0 = 42, x1 = 358, y = 100;
    const scale = value => x0 + (Math.log10(value) + 1) / 3 * (x1 - x0);
    const pm25 = scale(2.5), pm10 = scale(10), hair = scale(70), sand = scale(100);
    const current = scale(Math.min(100, Math.max(0.1, state.diameter)));
    svg.append(createSvg("rect", { x: x0, y: 83, width: pm25 - x0, height: 30, rx: 7, fill: "var(--chart-0)", opacity: 0.42 }),
      createSvg("rect", { x: pm25, y: 83, width: pm10 - pm25, height: 30, fill: "var(--chart-1)", opacity: 0.42 }),
      createSvg("rect", { x: pm10, y: 83, width: x1 - pm10, height: 30, rx: 7, fill: "var(--muted)", opacity: 0.25 }),
      createSvg("line", { x1: pm25, x2: pm25, y1: 55, y2: 141, stroke: "var(--chart-0)", "stroke-width": 2 }),
      createSvg("line", { x1: pm10, x2: pm10, y1: 55, y2: 141, stroke: "var(--chart-1)", "stroke-width": 2 }),
      createSvg("line", { x1: hair, x2: hair, y1: 55, y2: 141, stroke: "var(--muted)", "stroke-width": 2 }),
      createSvg("line", { x1: sand, x2: sand, y1: 55, y2: 141, stroke: "var(--muted)", "stroke-width": 2 }),
      createSvg("circle", { cx: current, cy: y, r: 9, fill: "var(--chart-2)", stroke: "var(--paper)", "stroke-width": 2 }));
    svg.append(createSvg("text", { x: pm25, y: 49, class: "visualization-label", "text-anchor": "middle" }, "2.5"));
    svg.append(createSvg("text", { x: pm10, y: 64, class: "visualization-label", "text-anchor": "middle" }, "10"));
    svg.append(createSvg("text", { x: hair, y: 49, class: "visualization-label", "text-anchor": "middle" }, "頭髮 ~70"));
    svg.append(createSvg("text", { x: x1, y: 64, class: "visualization-label", "text-anchor": "end" }, "細砂 ~100 μm"));
    text(svg, 200, 166, "代表粒徑 " + state.diameter.toFixed(1) + " μm");
    text(svg, 200, 187, "PM2.5 " + (state.diameter <= 2.5 ? "符合" : "超過") +
      "；PM10 " + (state.diameter <= 10 ? "符合" : "超過"));
    text(svg, 200, 208, "頭髮與細砂粒徑為示意參考，會因樣本而異；對數刻度");
  }
})(window);
