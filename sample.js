"use strict";

window.lessonSampleId = "lesson-desk-demo";
window.readLessonSample = () => ({
  conversationId: window.lessonSampleId,
  title: "等速運動",
  project: "閱讀與作答範例",
  messages: [
    { id: "demo-prompt", role: "user", text: "怎麼用速率和時間計算路程？" },
    {
      id: "demo-response",
      role: "assistant",
      text: [
        "# 等速運動",
        "物體以固定速率運動時，路程等於速率乘以時間。",
        "$$\ns = vt\n$$",
        "其中 $s$ 是路程、$v$ 是速率、$t$ 是經過的時間。",
        "## 例題",
        "每秒前進 4 公尺的自行車，5 秒後前進 $4 \\times 5 = 20$ 公尺。"
      ].join("\n\n")
    }
  ],
  questions: [
    {
      type: "single-choice",
      title: "單選題",
      prompt: "速率是 3 公尺／秒，經過 4 秒後，走了幾公尺？",
      options: ["6 公尺", "7 公尺", "12 公尺"],
      answers: ["3"]
    },
    {
      type: "multiple-choice",
      title: "多選題",
      prompt: "哪些數值足以用 s = vt 求出等速運動的路程？",
      options: ["A. 速率", "B. 經過的時間", "C. 起點的名稱"],
      answers: ["A", "B"]
    },
    {
      type: "fill-in",
      title: "填空題",
      prompt: "以每秒 2 公尺走 6 秒，走了幾公尺？請填數字。",
      answers: [12]
    }
  ]
});
