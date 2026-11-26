<!--
本專案專屬規則：規則檔的通用規則在本專案代入的值。
放：專案目錄、各層驗證指令、真依賴與替身、開發服務埠、專案專屬工具的執行方式、外部審查／委派工具與授權（選填：核准的工具、操作與上限、push `main` 是否放行）。
不放：通用規則（寫規則檔）、測試數字（寫 commit message）、決策（寫 DECISIONS.md）、公開契約與驗收（寫 docs/spec.md）、專案現況（寫 STATE.md）。
授權類內容（push `main` 放行、外部工具、額度上限）只在 user 明示後寫入，agent 不自行偵測或從舊檔搬入。
與規則檔衝突時以規則檔為準，並修正這份。
-->

# 專案規則

## 專案目錄

- 專案根目錄同時是靜態網站根目錄；入口為 `index.html`，前端程式與教材資料分布在根目錄及 `course-content/`。
- repo 不使用 `package.json` scripts；`package.json` 目前列出 Playwright `^1.65.1` 為開發相依。

## 驗證指令

- 指定教材瀏覽器稽核：`node audit-course-browser.js --lesson=6af8b3dc-5ad4-83ee-9a6c-e98105cb5cd8`。
- 全部教材本機發布版稽核：`node audit-course-browser.js`。
- 兩個指令使用 Playwright 與本機 Chrome／Chromium。若 Playwright 或瀏覽器不在預設路徑，使用 `PLAYWRIGHT_MODULE`、`CHROME_PATH` 指向現有安裝；不得為此自動安裝依賴。
- 稽核會寫入 `reports/` JSON。執行前後檢查 Git 狀態並檢閱報告差異；需要唯讀基線時在臨時副本執行。
- 靜態網站可直接開啟 `index.html`；目前未記載需常駐開發伺服器或固定埠。

## 專案工具

- 讀取程式碼區塊位置：`python tools/outline.py FILE [FILE...] [--min N]`，在 repo 根目錄執行。

## 發布

- README 說明 GitHub Pages 可由 `main` 分支根目錄發布；因此推送 `main` 可能公開更新網站，必須遵守通用規則取得明確授權。
- push main 已獲使用者長期同意，未推送commit不需詢問直接推

## 外部工具與委派

- 本檔沒有記錄持續有效的外部審查工具或委派授權；每次依通用規則判斷。
