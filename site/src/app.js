// Página de descarga: detecta el sistema, muestra los pasos al descargar, cambia
// la captura de cada modo y hace aparecer el contenido al hacer scroll.
// Sin dependencias, cookies ni analíticas.
(() => {
  const ua = navigator.userAgent;
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
  const isWindows = /win/i.test(platform) || /Windows NT/.test(ua);
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.userAgentData && navigator.userAgentData.mobile);
  const canInstall = isWindows && !isMobile;

  const sheet = document.getElementById("after-download");
  const toast = document.querySelector(".toast");
  let lastFocus = null;

  // ─── Aparición suave al hacer scroll ──────────────────────────────────────
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.classList.add("js-reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      },
      // Empieza a aparecer un poco antes de entrar en pantalla: al hacer scroll nunca se ve un hueco.
      { rootMargin: "0px 0px 10% 0px", threshold: 0 },
    );
    reveals.forEach((el) => observer.observe(el));
  }

  // ─── Selector Desarrollo / Estudio ────────────────────────────────────────
  const switcher = document.querySelector(".switch");
  const shot = document.querySelector(".js-mode-shot");
  const caption = document.querySelector(".js-mode-caption");
  if (switcher && shot) {
    // Precarga la otra captura (del tamaño que elija el navegador) para que el cambio sea instantáneo.
    const preload = new Image();
    preload.sizes = shot.sizes;
    preload.srcset = shot.dataset.study;
    switcher.addEventListener("click", (event) => {
      const button = event.target.closest("[data-mode]");
      if (!button) return;
      const mode = button.dataset.mode;
      switcher.dataset.active = mode;
      switcher.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-checked", String(b === button)));
      shot.classList.add("is-swapping");
      setTimeout(() => {
        shot.srcset = shot.dataset[mode];
        shot.src = shot.dataset[mode].split(" ")[0];
        shot.alt = shot.dataset[mode === "dev" ? "altDev" : "altStudy"];
        caption.textContent = caption.dataset[mode];
        shot.classList.remove("is-swapping");
      }, 180);
    });
  }

  // ─── Fuera de Windows: explicar y ofrecer el enlace ───────────────────────
  if (!canInstall) document.querySelectorAll(".js-not-windows").forEach((el) => (el.hidden = false));

  // Dónde aparece el archivo descargado según el navegador.
  const hint = /Firefox\//.test(ua)
    ? "en la flecha de descargas, arriba a la derecha de Firefox, o en la carpeta Descargas"
    : /Edg\//.test(ua)
      ? "en el panel de descargas que se abre arriba a la derecha de Edge, o en la carpeta Descargas"
      : /Chrome\//.test(ua)
        ? "en el icono de descargas, arriba a la derecha de Chrome, o en la carpeta Descargas"
        : "desde las descargas de tu navegador o la carpeta Descargas";
  document.querySelectorAll(".js-browser-hint").forEach((el) => (el.textContent = hint));

  function showToast(text) {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => (toast.hidden = true), 3200);
  }

  function openSheet() {
    lastFocus = document.activeElement;
    sheet.hidden = false;
    document.body.classList.add("no-scroll");
    sheet.querySelector(".sheet__close").focus();
  }

  function closeSheet() {
    sheet.hidden = true;
    document.body.classList.remove("no-scroll");
    if (lastFocus) lastFocus.focus();
  }

  // El enlace descarga el archivo (atributo download); además se muestran los pasos.
  document.querySelectorAll(".js-download").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!canInstall) {
        event.preventDefault();
        copyLink();
        return;
      }
      // Deja que el navegador empiece la descarga y abre la guía un instante después.
      setTimeout(openSheet, 350);
    });
  });

  sheet.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]")) closeSheet();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !sheet.hidden) closeSheet();
  });

  async function copyLink() {
    const url = location.origin + location.pathname;
    try {
      if (navigator.share && isMobile) {
        await navigator.share({ title: document.body.dataset.name, text: "Descárgala en tu PC con Windows", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast("Enlace copiado. Ábrelo en tu PC con Windows para descargar.");
    } catch {
      showToast("Abre " + url + " en tu PC con Windows.");
    }
  }
  document.querySelectorAll(".js-copy").forEach((button) => button.addEventListener("click", copyLink));
})();
