(() => {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setModalVisibility(modalElement, visible) {
    if (!modalElement) return;
    modalElement.classList.toggle("hidden", !visible);
    modalElement.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function button({ label, className = "btn btn-light", attrs = "" }) {
    return `<button type="button" class="${escapeHtml(className)}" ${attrs}>${escapeHtml(label)}</button>`;
  }

  function renderCardRows(container, rows, emptyText = "No records found.") {
    if (!container) return;
    if (!Array.isArray(rows) || rows.length === 0) {
      container.innerHTML = `<p>${escapeHtml(emptyText)}</p>`;
      return;
    }
    container.innerHTML = rows.join("");
  }

  function renderDataTable(container, columns, rows, emptyText = "No data available.") {
    if (!container) return;
    if (!Array.isArray(rows) || rows.length === 0) {
      container.innerHTML = `<p class="status-message">${escapeHtml(emptyText)}</p>`;
      return;
    }

    const head = columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join("");
    const body = rows
      .map((row) => {
        const tds = columns
          .map((col) => {
            const value = typeof col.render === "function" ? col.render(row[col.key], row) : row[col.key];
            return `<td>${value ?? ""}</td>`;
          })
          .join("");
        return `<tr>${tds}</tr>`;
      })
      .join("");

    container.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  window.UIComponents = {
    button,
    setModalVisibility,
    renderCardRows,
    renderDataTable
  };
})();