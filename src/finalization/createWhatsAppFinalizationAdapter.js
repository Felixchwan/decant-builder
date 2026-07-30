export function createWhatsAppFinalizationAdapter({
  phoneNumber,
  openWindow = openBrowserWindow,
  copyText = copyBrowserText,
} = {}) {
  return Object.freeze({
    async finalize(finalizationModel) {
      const manualUrl = buildWhatsAppUrl({
        phoneNumber,
        message: finalizationModel?.message,
      });

      let openedWindow;

      try {
        openedWindow = openWindow(manualUrl, "_blank");
        if (openedWindow) {
          openedWindow.opener = null;
        }
      } catch {
        return { status: "failed", copied: false, manualUrl };
      }

      let copied;

      try {
        copied = Boolean(await copyText(finalizationModel.message));
      } catch {
        copied = false;
      }

      if (!openedWindow) {
        return { status: "manual_required", copied, manualUrl };
      }

      return { status: "opened", copied, manualUrl: "" };
    },
  });
}

export function buildWhatsAppUrl({ phoneNumber, message }) {
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}

function openBrowserWindow(url, target) {
  return window.open(url, target);
}

async function copyBrowserText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to a temporary textarea for browsers without clipboard permission.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
