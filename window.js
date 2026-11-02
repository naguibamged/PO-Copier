// --- Make the window draggable ---
const floatingWindow = document.getElementById("floating-window");
const windowHeader = document.getElementById("window-header");

let isDragging = false;
let offsetX, offsetY;

if (windowHeader) {
  windowHeader.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - floatingWindow.getBoundingClientRect().left;
    offsetY = e.clientY - floatingWindow.getBoundingClientRect().top;
    windowHeader.style.cursor = "grabbing";
  });
}

document.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  floatingWindow.style.left = `${e.clientX - offsetX}px`;
  floatingWindow.style.top = `${e.clientY - offsetY}px`;
});

document.addEventListener("mouseup", () => {
  isDragging = false;
  if (windowHeader) {
    windowHeader.style.cursor = "move";
  }
});

// --- Close the window ---
const closeBtn = document.getElementById("close-window-btn");
if (closeBtn) {
  closeBtn.addEventListener("click", () => {
    if (floatingWindow) {
      floatingWindow.style.display = "none";
    }
  });
}

// --- Status Box Updater ---
function updateStatus(statusBoxId, message, type) {
  const statusBox = document.getElementById(statusBoxId);
  if (!statusBox) return;
  statusBox.textContent = message;
  // Reset classes
  statusBox.className =
    "status-box text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap";
  if (type === "success") {
    statusBox.classList.add("bg-green-100", "text-green-800");
  } else if (type === "error") {
    statusBox.classList.add("bg-red-100", "text-red-800");
  } else {
    statusBox.classList.add("bg-gray-200", "text-gray-700");
  }
}

// One Excel cell: button labels and nested markup included once, with no
// line breaks that would split a pasted row.
function cellText(cell) {
  const raw = cell.innerText != null ? cell.innerText : cell.textContent || "";
  return raw.replace(/\s+/g, " ").trim();
}

// Direct children only. A Kendo cell rendered as <td><td>value</td></td>
// must count once; querySelectorAll("td") would also return the inner cell.
function directRowCells(row) {
  return row.querySelectorAll(":scope > th, :scope > td");
}

function rowToColumns(row, excludedCols) {
  const values = [];
  directRowCells(row).forEach((cell, index) => {
    if (cell.classList.contains("k-hierarchy-cell")) return;
    if (excludedCols.includes(index)) return;
    values.push(cellText(cell));
  });
  return values;
}

/**
 * A reusable function to process and copy table data.
 * @param {boolean} includeHeader - Whether to include the header table.
 * @param {number} tableIndex - The index of the table on the page (0 for the first, 1 for the second).
 * @param {number[]} excludedHeaderCols - An array of header column indexes to exclude.
 * @param {number[]} excludedBodyCols - An array of body column indexes to exclude.
 * @param {string} statusBoxId - The ID of the status box to update.
 */
function copyTableData(
  includeHeader,
  tableIndex,
  excludedHeaderCols,
  excludedBodyCols,
  statusBoxId
) {
  const headerTables = document.querySelectorAll(".k-grid-header-table");
  const bodyTables = document.querySelectorAll(".k-grid-table");

  if (bodyTables.length <= tableIndex) {
    console.error(`Table ${tableIndex + 1} not found.`);
    updateStatus(statusBoxId, "غير موجود", "error");
    setTimeout(() => updateStatus(statusBoxId, "Idle", "neutral"), 3000);
    return;
  }

  const bodyTable = bodyTables[tableIndex];
  let headerText = "";

  if (includeHeader) {
    if (headerTables.length <= tableIndex) {
      console.error(`Header for table ${tableIndex + 1} not found.`);
      updateStatus(statusBoxId, "لا يوجد عنوان", "error");
      setTimeout(() => updateStatus(statusBoxId, "Idle", "neutral"), 3000);
      return;
    }
    const headerTable = headerTables[tableIndex];
    const headerRow =
      headerTable.querySelector("thead > tr") || headerTable.querySelector("tr");
    const headerData = headerRow
      ? rowToColumns(headerRow, excludedHeaderCols)
      : [];
    headerText = headerData.join("\t");
  }

  let bodyTextRows = [];
  bodyTable.querySelectorAll("tbody tr.k-master-row").forEach((row) => {
    bodyTextRows.push(rowToColumns(row, excludedBodyCols).join("\t"));
  });

  const fullText = includeHeader
    ? headerText + "\n" + bodyTextRows.join("\n")
    : bodyTextRows.join("\n");

  navigator.clipboard
    .writeText(fullText)
    .then(() => {
      updateStatus(statusBoxId, "تم النسخ", "success");
    })
    .catch((err) => {
      console.error("Error copying to clipboard:", err);
      updateStatus(statusBoxId, "فشل النسخ", "error");
    });

  setTimeout(() => updateStatus(statusBoxId, "Idle", "neutral"), 3000);
}

// --- Button Listeners ---

// Button 1: Copy first table (no header). Same columns as the header row.
document.getElementById("copy-table-btn").addEventListener("click", () => {
  copyTableData(false, 0, [], [], "status-box-1");
});

// Button 2: Copy first table (with header).
document
  .getElementById("copy-table-header-btn")
  .addEventListener("click", () => {
    copyTableData(true, 0, [], [], "status-box-1");
  });

// Button 3: Copy second table (no header)
document.getElementById("placeholder-btn").addEventListener("click", () => {
  // Exclude column 3 from the BODY only.
  copyTableData(false, 1, [], [2], "status-box-2");
});

// Button 4: Copy second table (with header)
document
  .getElementById("placeholder-header-btn")
  .addEventListener("click", () => {
    // Exclude column 3 from BOTH the HEADER and the BODY.
    copyTableData(true, 1, [2], [2], "status-box-2");
  });

// --- Copy every page of one supply order ---

const FULL_ORDER_PAGE_SIZE = "100";
const FULL_ORDER_MAX_PAGES = 50;
let fullOrderRunning = false;
let fullOrderPause = false;
let fullOrderStop = false;
let fullOrderStatusTimer = null;
let fullOrderStatusText = "Idle";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitFor(predicate, timeoutMs) {
  let start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      controlPoint()
        .then((paused) => {
          start += paused || 0;
          let value;
          try {
            value = predicate();
          } catch (err) {
            reject(err);
            return;
          }
          if (value) {
            resolve(value);
            return;
          }
          if (Date.now() - start >= timeoutMs) {
            resolve(null);
            return;
          }
          setTimeout(tick, 80);
        })
        .catch(reject);
    };
    tick();
  });
}

function setFullOrderStatus(message, type, reset) {
  if (fullOrderStatusTimer) {
    clearTimeout(fullOrderStatusTimer);
    fullOrderStatusTimer = null;
  }
  fullOrderStatusText = message;
  updateStatus("status-box-3", message, type);
  if (reset) {
    fullOrderStatusTimer = setTimeout(() => {
      fullOrderStatusText = "Idle";
      updateStatus("status-box-3", "Idle", "neutral");
    }, 3000);
  }
}

// Pause holds the run without consuming the loading timeout. Stop aborts it.
async function controlPoint() {
  if (fullOrderStop) throw new Error("stopped");
  if (!fullOrderPause) return 0;
  const started = Date.now();
  const previous = fullOrderStatusText;
  const pauseBtn = document.getElementById("pause-full-order-btn");
  if (pauseBtn) pauseBtn.textContent = "متابعة";
  setFullOrderStatus("متوقف مؤقتا", "neutral", false);
  while (fullOrderPause && !fullOrderStop) {
    await sleep(200);
  }
  if (pauseBtn) pauseBtn.textContent = "إيقاف مؤقت";
  if (fullOrderStop) throw new Error("stopped");
  setFullOrderStatus(previous, "neutral", false);
  return Date.now() - started;
}

function setRunControls(running) {
  fullOrderPause = false;
  const pauseBtn = document.getElementById("pause-full-order-btn");
  const stopBtn = document.getElementById("stop-full-order-btn");
  if (pauseBtn) {
    pauseBtn.disabled = !running;
    pauseBtn.textContent = "إيقاف مؤقت";
  }
  if (stopBtn) stopBtn.disabled = !running;
}

function isVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findNextButtons() {
  const titled = [...document.querySelectorAll('button[title="Go to the next page"]')];
  if (titled.length) return titled;
  return [...document.querySelectorAll(".k-pager .k-i-caret-alt-right")]
    .map((icon) => icon.closest("button"))
    .filter(Boolean);
}

function resultsGrid() {
  const buttons = findNextButtons();
  const button = buttons.find((item) => isVisible(item)) || buttons[0];
  if (!button) return document.querySelector(".k-grid");
  return button.closest(".k-grid") || button.closest(".k-widget");
}

function gridBodyTable(grid) {
  if (!grid) return null;
  return (
    grid.querySelector(".k-grid-content table.k-grid-table") ||
    grid.querySelector("table.k-grid-table")
  );
}

function gridHasBodyState(grid) {
  const body = gridBodyTable(grid);
  if (!body) return false;
  return !!body.querySelector("tr.k-master-row, tr.k-table-row, tr.k-grid-norecords");
}

function gridSignature(grid) {
  const body = gridBodyTable(grid);
  return body ? body.innerText : "";
}

function loadingMask() {
  const masks = document.querySelectorAll(".k-loading-mask");
  for (const mask of masks) {
    if (isVisible(mask)) return mask;
  }
  return null;
}

function isNoRecords(grid) {
  const body = gridBodyTable(grid);
  if (!body) return false;
  if (body.querySelector("tr.k-grid-norecords")) return true;
  return [...body.querySelectorAll("td")].some((cell) =>
    /no records available/i.test(cell.textContent || "")
  );
}

function pageDataRows(grid) {
  const body = gridBodyTable(grid);
  if (!body || isNoRecords(grid)) return [];
  const master = body.querySelectorAll("tbody tr.k-master-row");
  if (master.length) return [...master];
  return [
    ...body.querySelectorAll(
      "tbody tr.k-table-row:not(.k-grid-norecords):not(.k-detail-row):not(.k-grouping-row)"
    ),
  ];
}

function readPageRows(grid) {
  return pageDataRows(grid).map((row) => rowToColumns(row, []).join("\t"));
}

function rowKey(row) {
  return (
    row.getAttribute("aria-rowindex") ||
    row.getAttribute("data-grid-row-index") ||
    row.getAttribute("data-kendo-grid-item-index") ||
    null
  );
}

// Virtual grids only render the visible window. Scroll the page and keep each
// row by its index so a 100-row page is copied in full.
async function readAllPageRows(grid) {
  if (isNoRecords(grid)) return [];
  const collected = new Map();
  const capture = () => {
    pageDataRows(grid).forEach((row) => {
      const key = rowKey(row);
      if (!key) return;
      collected.set(key, rowToColumns(row, []).join("\t"));
    });
  };

  const scroller = grid.querySelector(".k-grid-content");
  const table = gridBodyTable(grid);
  const maxScroll = () =>
    scroller ? scroller.scrollHeight - scroller.clientHeight : 0;
  // A virtual grid's scroll height comes from a spacer, not the rendered table.
  const virtual =
    scroller &&
    table &&
    scroller.scrollHeight > table.offsetHeight + 8 &&
    maxScroll() > 2;
  if (!virtual) return readPageRows(grid);

  scroller.scrollTop = 0;
  await sleep(80);
  let previousTop = -1;
  for (let step = 0; step < 300; step++) {
    await controlPoint();
    if (loadingMask()) {
      await sleep(80);
      continue;
    }
    capture();
    if (scroller.scrollTop >= maxScroll() - 2) break;
    if (scroller.scrollTop === previousTop) break;
    previousTop = scroller.scrollTop;
    const jump = Math.max(32, scroller.clientHeight * 0.45);
    scroller.scrollTop = Math.min(
      scroller.scrollTop + jump,
      Math.max(maxScroll(), 0)
    );
    await sleep(90);
  }
  capture();
  scroller.scrollTop = 0;

  if (!collected.size) return readPageRows(grid);
  return [...collected.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map((entry) => entry[1]);
}

function nextButton(grid) {
  if (!grid) return null;
  return (
    grid.querySelector('button[title="Go to the next page"]') ||
    grid.querySelector(".k-pager .k-i-caret-alt-right")?.closest("button") ||
    null
  );
}

function previousButton(grid) {
  if (!grid) return null;
  return (
    grid.querySelector('button[title="Go to the previous page"]') ||
    grid.querySelector(".k-pager .k-i-caret-alt-left")?.closest("button") ||
    null
  );
}

function isNextDisabled(button) {
  if (!button) return true;
  return (
    button.disabled ||
    button.classList.contains("k-disabled") ||
    button.classList.contains("k-state-disabled") ||
    button.getAttribute("aria-disabled") === "true"
  );
}

// The next search stays on the page where the last order finished.
async function returnToFirstPage() {
  for (let step = 0; step < FULL_ORDER_MAX_PAGES; step++) {
    await controlPoint();
    const grid = resultsGrid();
    if (!grid) return;
    const previous = previousButton(grid);
    if (isNextDisabled(previous)) return;
    const before = gridSignature(grid);
    previous.click();
    await waitForGridReady(before);
  }
}

function requestField() {
  const field = document.getElementById("pr");
  if (!field) return null;
  const placeholder = field.getAttribute("placeholder") || "";
  if (placeholder && !placeholder.includes("رقم طلب الإمداد")) return null;
  return field;
}

async function openUnderprocessing() {
  if (location.hostname !== "sc.upa.gov.eg") {
    throw new Error("wrong-site");
  }
  const field = requestField();
  if (!field) throw new Error("no-page");
  return field;
}

function setNativeValue(input, value) {
  input.focus();
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  );
  const apply = () => {
    descriptor.set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  apply();
  input.dispatchEvent(new Event("blur", { bubbles: true }));
  if (input.value !== value) apply();
}

function clickSearch(input) {
  const form = input.closest("form");
  const scopes = form ? [form, document] : [document];
  for (const scope of scopes) {
    const search = [...scope.querySelectorAll('button[type="submit"]')].find(
      (btn) => (btn.textContent || "").includes("بحث")
    );
    if (search) {
      search.click();
      return;
    }
  }
  throw new Error("search-button");
}

// Let the route's initial grid render so the search snapshot is not a blank page.
async function settleCurrentGrid() {
  let start = Date.now();
  let last = null;
  let lastAt = 0;
  while (Date.now() - start < 2000) {
    const paused = await controlPoint();
    start += paused;
    if (lastAt) lastAt += paused;
    if (loadingMask()) {
      last = null;
      await sleep(80);
      continue;
    }
    const signature = gridSignature(resultsGrid());
    if (signature && signature === last && Date.now() - lastAt > 400) return;
    if (signature !== last) {
      last = signature;
      lastAt = Date.now();
    }
    await sleep(80);
  }
}

// Wait until the Kendo loading overlay finishes and the results grid has settled.
// previousSignature is the grid text from before the action; a stuck pager
// keeps that same text and is treated as finished.
async function waitForGridReady(previousSignature) {
  let start = Date.now();
  let sawMask = false;
  let maskGoneAt = 0;
  let stableSignature = null;
  let stableSince = 0;

  while (Date.now() - start < 30000) {
    const paused = await controlPoint();
    start += paused;
    if (maskGoneAt) maskGoneAt += paused;
    if (stableSince) stableSince += paused;

    if (loadingMask()) {
      sawMask = true;
      maskGoneAt = 0;
      stableSignature = null;
      await sleep(80);
      continue;
    }

    if (sawMask && maskGoneAt === 0) maskGoneAt = Date.now();

    const grid = resultsGrid();
    if (!grid || !gridHasBodyState(grid)) {
      stableSignature = null;
      await sleep(80);
      continue;
    }

    const signature = gridSignature(grid);
    const changed = signature !== previousSignature;
    const elapsed = Date.now() - start;
    const accept =
      (sawMask && changed) ||
      (sawMask && maskGoneAt && Date.now() - maskGoneAt > 1500) ||
      (!sawMask && changed && elapsed > 1600) ||
      (!sawMask && elapsed > 8000);

    if (!accept) {
      await sleep(80);
      continue;
    }

    if (stableSignature === signature && Date.now() - stableSince >= 350) {
      return grid;
    }
    if (stableSignature !== signature) {
      stableSignature = signature;
      stableSince = Date.now();
    }
    await sleep(80);
  }

  throw new Error("loading-timeout");
}

function currentPageSize(grid) {
  const sizes = grid.querySelector(".k-pager-sizes");
  if (!sizes) return null;
  const shown = sizes.querySelector(".k-input-value-text, .k-input-value");
  if (shown && shown.textContent.trim()) {
    const match = shown.textContent.match(/\d+/);
    if (match) return match[0];
  }
  const input = sizes.querySelector("input.k-input-inner");
  if (input && input.value) {
    const match = String(input.value).match(/\d+/);
    if (match) return match[0];
  }
  const inner = sizes.querySelector(".k-input-inner");
  if (inner && inner.textContent.trim()) {
    const match = inner.textContent.match(/\d+/);
    if (match) return match[0];
  }
  const select = sizes.querySelector("select");
  if (select && select.value && select.value !== "0") return String(select.value);
  const match = (sizes.innerText || "").match(/\d+/);
  return match ? match[0] : null;
}

function findPageSizeOption(size) {
  const containers = document.querySelectorAll(
    ".k-animation-container, .k-popup, .k-list-container"
  );
  for (const container of containers) {
    if (!isVisible(container)) continue;
    const items = container.querySelectorAll(".k-list-item, .k-item, [role='option']");
    for (const item of items) {
      if (item.textContent.trim() === String(size)) return item;
    }
  }
  return null;
}

function kendoGridWidget(grid) {
  const jq = window.jQuery || window.$;
  if (jq && typeof jq === "function") {
    try {
      const widget = jq(grid).data("kendoGrid");
      if (widget) return widget;
    } catch (err) {
      console.error(err);
    }
  }
  if (window.kendo && typeof window.kendo.widgetInstance === "function") {
    try {
      const widget = window.kendo.widgetInstance(grid);
      if (widget && widget.dataSource) return widget;
    } catch (err) {
      console.error(err);
    }
  }
  return null;
}

function tryKendoPageSize(grid, size) {
  const jq = window.jQuery || window.$;
  const select = grid.querySelector(".k-pager-sizes select");
  if (jq && typeof jq === "function" && select) {
    try {
      const dropdown = jq(select).data("kendoDropDownList");
      if (dropdown && typeof dropdown.value === "function") {
        dropdown.value(String(size));
        if (typeof dropdown.trigger === "function") dropdown.trigger("change");
        return true;
      }
    } catch (err) {
      console.error(err);
    }
  }
  const widget = kendoGridWidget(grid);
  if (
    widget &&
    widget.dataSource &&
    typeof widget.dataSource.pageSize === "function"
  ) {
    widget.dataSource.pageSize(Number(size));
    return true;
  }
  return false;
}

async function setPageSize(size) {
  let grid = resultsGrid();
  if (!grid) throw new Error("grid");
  if (currentPageSize(grid) === String(size)) return;

  const before = gridSignature(grid);
  const sizes = grid.querySelector(".k-pager-sizes");
  let clicked = false;
  if (sizes) {
    const opener =
      sizes.querySelector("button.k-input-button, button.k-select, button") ||
      sizes.querySelector(".k-dropdownlist, .k-picker, .k-input-inner") ||
      sizes;
    opener.click();
    let item = await waitFor(() => findPageSizeOption(size), 800);
    if (!item) {
      opener.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window })
      );
      item = await waitFor(() => findPageSizeOption(size), 1700);
    }
    if (item) {
      item.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window })
      );
      item.click();
      clicked = true;
    } else {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    }
  }

  if (clicked) {
    try {
      await waitForGridReady(before);
    } catch (err) {
      if (!err || err.message !== "loading-timeout") throw err;
    }
    grid = resultsGrid() || grid;
    if (currentPageSize(grid) === String(size)) return;
    if (currentPageSize(grid) == null && gridSignature(grid) !== before) return;
  }

  grid = resultsGrid() || grid;
  if (!tryKendoPageSize(grid, size)) throw new Error("page-size");
  try {
    await waitForGridReady(before);
  } catch (err) {
    if (!err || err.message !== "loading-timeout") throw err;
  }
  grid = resultsGrid() || grid;
  if (currentPageSize(grid) === String(size)) return;
  if (!grid.querySelector(".k-pager-sizes")) return;
  throw new Error("page-size");
}

function fullOrderStatusMessage(err) {
  const code = err && err.message;
  if (code === "wrong-site") return "موقع خاطئ";
  if (code === "no-page") return "افتح الصفحة";
  if (code === "page-size") return "لا يوجد 100";
  if (code === "loading-timeout") return "انتهت المهلة";
  return "فشل النسخ";
}

function parseRequestNumbers(text) {
  const seen = new Set();
  const numbers = [];
  String(text || "")
    .split(/[\s,;]+/)
    .forEach((part) => {
      const value = part.trim();
      if (!/^\d+$/.test(value) || seen.has(value)) return;
      seen.add(value);
      numbers.push(value);
    });
  return numbers;
}

function countBlockRows(blocks) {
  return blocks.reduce((count, block) => count + block.split("\n").length, 0);
}

function readGridHeader(grid) {
  if (!grid) return "";
  const headerTable = grid.querySelector(".k-grid-header-table");
  if (!headerTable) return "";
  const headerRow =
    headerTable.querySelector("thead > tr") || headerTable.querySelector("tr");
  if (!headerRow) return "";
  const text = rowToColumns(headerRow, []).join("\t");
  return text.trim() ? text : "";
}

// Search one request and return its rows. Does not write the clipboard.
async function collectOrderRows(requestNumber, onPage, includeHeader, headerBox) {
  const allRows = [];
  try {
    let field = requestField();
    if (!field) throw new Error("search-field");
    field.scrollIntoView({ block: "center", inline: "nearest" });
    setNativeValue(field, requestNumber);
    const beforeSearch = gridSignature(resultsGrid());
    clickSearch(field);
    await waitForGridReady(beforeSearch);
    await setPageSize(FULL_ORDER_PAGE_SIZE);
    await returnToFirstPage();

    if (includeHeader && headerBox.text == null) {
      const header = readGridHeader(resultsGrid());
      if (!header) throw new Error("no-header");
      headerBox.text = header;
    }

    let previousRows = null;
    for (let page = 1; page <= FULL_ORDER_MAX_PAGES; page++) {
      await controlPoint();
      const grid = resultsGrid();
      if (!grid) throw new Error("grid");
      const rows = await readAllPageRows(grid);
      if (rows.length === 0) break;

      const signature = rows.join("\n");
      if (previousRows !== null && signature === previousRows) break;
      previousRows = signature;
      allRows.push(...rows);
      if (onPage) onPage(page);

      if (page === FULL_ORDER_MAX_PAGES) break;
      const next = nextButton(grid);
      if (isNextDisabled(next)) break;
      await controlPoint();
      const beforePage = gridSignature(grid);
      next.click();
      await waitForGridReady(beforePage);
    }
    return allRows;
  } catch (err) {
    if (err && err.message === "stopped") err.partialRows = allRows;
    throw err;
  }
}

function fullOrderClipboard(blocks, headerText) {
  const body = blocks.join("\n\n");
  return headerText ? headerText + "\n" + body : body;
}

async function copyCollected(blocks, headerText) {
  if (!blocks.length) return 0;
  await navigator.clipboard.writeText(fullOrderClipboard(blocks, headerText));
  return countBlockRows(blocks);
}

async function finishStop(blocks, headerText) {
  try {
    const rowCount = await copyCollected(blocks, headerText);
    setFullOrderStatus(
      rowCount ? "تم الإيقاف (" + rowCount + ")" : "تم الإيقاف",
      rowCount ? "success" : "neutral",
      true
    );
  } catch (err) {
    console.error("Full order copy failed:", err);
    setFullOrderStatus("فشل النسخ", "error", true);
  }
}

async function copyFullOrder(includeHeader) {
  if (fullOrderRunning) return;

  const numbers = parseRequestNumbers(
    document.getElementById("full-order-input").value
  );
  if (!numbers.length) {
    setFullOrderStatus("أدخل الرقم", "error", true);
    return;
  }

  const button = document.getElementById("copy-full-order-btn");
  const headerButton = document.getElementById("copy-full-order-header-btn");
  fullOrderRunning = true;
  fullOrderStop = false;
  button.disabled = true;
  if (headerButton) headerButton.disabled = true;
  setRunControls(true);
  const blocks = [];
  const missing = [];
  const headerBox = { text: null };
  let stoppedAt = null;
  let failure = null;
  let stoppedByUser = false;

  try {
    setFullOrderStatus("جاري البحث", "neutral", false);
    await openUnderprocessing();
    await settleCurrentGrid();

    for (let index = 0; index < numbers.length; index++) {
      await controlPoint();
      const requestNumber = numbers[index];
      const position = index + 1 + "/" + numbers.length;
      setFullOrderStatus(position, "neutral", false);
      try {
        const rows = await collectOrderRows(
          requestNumber,
          (page) => {
            setFullOrderStatus(position + " ص" + page, "neutral", false);
          },
          includeHeader,
          headerBox
        );
        if (!rows.length) missing.push(requestNumber);
        else blocks.push(rows.join("\n"));
      } catch (err) {
        if (err && err.message === "stale-value") {
          missing.push(requestNumber);
          continue;
        }
        if (err && err.message === "no-header") {
          failure = err;
          break;
        }
        if (err && err.message === "stopped") {
          if (err.partialRows && err.partialRows.length) {
            blocks.push(err.partialRows.join("\n"));
          }
          stoppedByUser = true;
          break;
        }
        console.error("Full order copy failed:", err);
        stoppedAt = requestNumber;
        failure = err;
        break;
      }
    }

    if (failure && failure.message === "no-header") {
      setFullOrderStatus("لا يوجد عنوان", "error", true);
      return;
    }

    if (stoppedByUser) {
      await finishStop(blocks, headerBox.text);
      return;
    }

    const rowCount = countBlockRows(blocks);
    if (blocks.length) {
      await navigator.clipboard.writeText(
        fullOrderClipboard(blocks, headerBox.text)
      );
    }

    if (failure) {
      const copied = rowCount ? " (" + rowCount + ")" : "";
      setFullOrderStatus("توقف " + stoppedAt + copied, "error", true);
      return;
    }

    if (!blocks.length) {
      setFullOrderStatus("لا توجد نتائج", "error", true);
      return;
    }

    const missingNote = missing.length ? " ناقص " + missing.length : "";
    setFullOrderStatus(
      "تم النسخ (" + rowCount + ")" + missingNote,
      "success",
      true
    );
  } catch (err) {
    if (err && err.message === "stopped") {
      await finishStop(blocks, headerBox.text);
      return;
    }
    console.error("Full order copy failed:", err);
    setFullOrderStatus(fullOrderStatusMessage(err), "error", true);
  } finally {
    fullOrderRunning = false;
    fullOrderPause = false;
    fullOrderStop = false;
    setRunControls(false);
    if (button) button.disabled = false;
    if (headerButton) headerButton.disabled = false;
  }
}

document.getElementById("copy-full-order-btn").addEventListener("click", () => {
  copyFullOrder(false);
});

document
  .getElementById("copy-full-order-header-btn")
  .addEventListener("click", () => {
    copyFullOrder(true);
  });

document.getElementById("pause-full-order-btn").addEventListener("click", () => {
  if (!fullOrderRunning) return;
  fullOrderPause = !fullOrderPause;
  const pauseBtn = document.getElementById("pause-full-order-btn");
  if (pauseBtn) pauseBtn.textContent = fullOrderPause ? "متابعة" : "إيقاف مؤقت";
});

document.getElementById("stop-full-order-btn").addEventListener("click", () => {
  if (!fullOrderRunning) return;
  fullOrderStop = true;
  fullOrderPause = false;
});
