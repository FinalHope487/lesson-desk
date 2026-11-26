# Luna 教材匯出執行指令

你是 Luna，推理 effort 設為 `xhigh`。在 `D:\my-projects\高中課程` 執行以下流程。沿用現有腳本與講義桌。不要閱讀、摘要或輸出教材正文。只查看專案名稱、對話 ID、狀態、錯誤分類和件數。匯出內容由腳本直接寫入本機。

## 1. 建立本輪清單

1. 讀取 `chatgpt-course-export-manifest.json`，只取 `kind: "subject"` 的專案及對話 ID。本次核對基準為 14 個專案、103 篇。若清單數量或 ID 有異常，回報差異並保持任務待處理。
2. 執行 `node build-course-library.js --local`，成功後讀取 `reports/course-library-report.json` 的 `expected`、`matched`、`missing`。將已收錄的 ID 標為「已有」，將 `missing` 快照定為本輪待嘗試清單。已收錄的對話沿用本機檔案。舊交接快照曾記錄 25 篇已收錄、78 篇待處理，可能已過時；每次啟動以實際報告為準。
3. 建立或續寫本機執行紀錄，逐篇記下 ID、專案、輪次、嘗試次數、時間、結果與下一步。每次執行前記錄目標，執行後補結果。若只看到開始紀錄，從講義桌報告重新核對，仍未收錄就重做該次。既有 `course-export-progress.jsonl` 可用於交叉確認。

## 2. 第一輪逐篇執行

依清單順序，每次只選一個 ID。使用以下方式在 Codex `functions.exec` 呼叫現有腳本。以本輪待處理清單建立 `deferIds`，包含除目標外仍未收錄的所有 ID。目標執行完成並記錄結果後，才開始下一次。

```js
const source = await tools.exec_command({
  cmd: "Get-Content -LiteralPath 'export-chatgpt-courses.js' -Raw -Encoding UTF8",
  workdir: "D:\\my-projects\\高中課程",
  max_output_tokens: 12000
});
if (source.exit_code !== 0) throw new Error("exporter_read_failed");
const run = new Function(source.output + "\nreturn runCourseExport;")();
// targetId 和 missingIds 由執行者以實際清單代入。
const event = await run(tools, {
  deferIds: missingIds.filter(id => id !== targetId)
});
text({ id: event.id, project: event.project, status: event.status });
```

- `exported`：確認回傳 ID 是本次目標，且重新讀取的 `missing` 已沒有該 ID，才標記成功。若腳本回傳 `complete` 或 `deferred`，重新核對目標是否已收錄。報告仍列缺的 ID 不算成功。
- 單篇資料失敗：記下錯誤，下輪再回到該篇，第一輪先繼續處理其他 ID。曾截斷的選修物理 I 對話也要納入本輪。
- 限流：至少等 60 秒，若服務明示更長等待時間就採用較長者。再試同一 ID 一次。若仍限流，暫停整體匯出並回報；服務恢復後從原位置續跑。帳號未授權、服務全面無法使用、日誌或講義桌無法寫入時，也先處理共通問題。受共通問題阻擋的 ID 不能記為已經嘗試下載。
- 第一輪只有在每個初始待處理 ID 都有實際嘗試紀錄，或能證明已從其他來源匯入時，才算完成。列出嘗試篇數與其他來源匯入篇數。

## 3. 處理第一輪未成功的對話

1. 第一輪全部走完後，只重試仍未收錄的對話。暫時性錯誤（逾時、連線、回應異常）最多再試兩次，每次距離同一篇上次失敗至少 60 秒。若已存檔但講義桌更新失敗，先修正本機問題再執行 `node build-course-library.js --local`，確認該 ID 收錄，避免重新抓取。
2. 截斷時，可在介面允許的範圍內縮小每次讀取的回合數，再試一次。若單一回合仍超過讀取上限（每個項目最多 20,000 字元），或腳本回報不支援的附件／非文字內容，記錄原因並改用完整匯出來源。不得用截斷資料補缺或把錯誤當成功。
3. 優先使用使用者已取得的 ChatGPT 官方帳號匯出 ZIP。若本機有該 ZIP，執行 `node build-course-library.js "<ZIP 完整路徑>"`，由匯入器比對清單 ID 並保留科目及專案結構，再依報告核對缺漏。不要把 ZIP 或解包正文輸出到對話，也不要重複提交匯出申請。
4. 若仍缺且使用者能提供完整單篇匯出檔，依對話 ID 核對後放進對應的 `course-exports/<科目>/<專案名稱> [<專案 ID>]/<對話 ID>.json`，用既有匯入格式重建講義桌。若使用者尚未取得 ZIP 或單篇完整檔，向使用者說明需要的來源、受影響的專案和篇數，將這些 ID 標為「等待來源」。

## 4. 回報與停止條件

- 第一輪結束時回報實際嘗試數、成功新增數、各科收錄數、各類失敗數和待重試數，然後直接進入可執行的重試與補救步驟。
- 匯出尚有可執行步驟時，保持任務進行中。遇到確實需要使用者提供 ZIP、恢復授權，或使用者要求暫停時，保存待辦清單和執行紀錄，回報阻塞原因與下一個動作，等待條件解除。不要自行結案，也不要用無限次重試卡住其他對話。
- 只有在 `expected = 103`、`matched = 103`、`missing` 為空，且講義桌已更新時，才可回報全部收錄。任務是否結案交由使用者決定。
