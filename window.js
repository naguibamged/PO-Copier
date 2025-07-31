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
    let headerData = [];
    headerTable.querySelectorAll("th").forEach((cell, index) => {
      if (!excludedHeaderCols.includes(index)) {
        headerData.push(cell.innerText.trim());
      }
    });
    headerText = headerData.join("\t");
  }

  let bodyTextRows = [];
  bodyTable.querySelectorAll("tbody tr").forEach((row) => {
    let rowData = [];
    row.querySelectorAll("th, td").forEach((cell, index) => {
      if (!excludedBodyCols.includes(index)) {
        rowData.push(cell.innerText.trim());
      }
    });
    bodyTextRows.push(rowData.join("\t"));
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

// Button 1: Copy first table (no header)
document.getElementById("copy-table-btn").addEventListener("click", () => {
  // Exclude columns 3 and 5 from the BODY only.
  copyTableData(false, 0, [], [2, 4], "status-box-1");
});

// Button 2: Copy first table (with header) - ⬇️ THIS IS THE MODIFIED LOGIC ⬇️
document
  .getElementById("copy-table-header-btn")
  .addEventListener("click", () => {
    // Exclude NO columns from the HEADER, but exclude columns 3 and 5 from the BODY.
    copyTableData(true, 0, [], [2, 4], "status-box-1");
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
