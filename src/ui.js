const TOAST_DURATION_MS = 4800;

const ensureToastRegion = () => {
  let region = document.querySelector("[data-toast-region]");
  if (region) return region;

  region = document.createElement("div");
  region.className = "toast-region";
  region.dataset.toastRegion = "";
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "true");
  document.body.append(region);
  return region;
};

export const showToast = (message, { tone = "info", title = "" } = {}) => {
  const region = ensureToastRegion();
  const toast = document.createElement("div");
  toast.className = `toast is-${tone}`;
  toast.setAttribute("role", tone === "error" ? "alert" : "status");
  toast.innerHTML = `
    <div class="toast-copy">
      ${title ? `<strong>${escapeToastText(title)}</strong>` : ""}
      <span>${escapeToastText(message)}</span>
    </div>
    <button class="toast-close" type="button" aria-label="關閉提示">×</button>
  `;
  const dismiss = () => {
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 180);
  };
  toast.querySelector("button")?.addEventListener("click", dismiss);
  region.append(toast);
  window.setTimeout(dismiss, TOAST_DURATION_MS);
  return toast;
};

export const setButtonLoading = (button, loading, loadingLabel = "處理中…") => {
  if (!(button instanceof HTMLButtonElement)) return;
  if (loading) {
    button.dataset.idleLabel = button.textContent || "";
    button.disabled = true;
    button.classList.add("is-loading");
    button.textContent = loadingLabel;
    return;
  }
  button.disabled = false;
  button.classList.remove("is-loading");
  if (button.dataset.idleLabel) button.textContent = button.dataset.idleLabel;
  delete button.dataset.idleLabel;
};

export const renderLoadingSkeleton = (container, { rows = 3, label = "資料載入中" } = {}) => {
  if (!container) return;
  container.setAttribute("aria-busy", "true");
  container.innerHTML = `
    <div class="loading-state" role="status">
      <span class="loading-spinner" aria-hidden="true"></span>
      <span class="sr-only">${escapeToastText(label)}</span>
      <div class="skeleton-stack" aria-hidden="true">
        ${Array.from({ length: rows }, () => '<span class="skeleton-line"></span>').join("")}
      </div>
    </div>
  `;
};

export const clearLoadingState = (container) => container?.removeAttribute("aria-busy");

const escapeToastText = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
