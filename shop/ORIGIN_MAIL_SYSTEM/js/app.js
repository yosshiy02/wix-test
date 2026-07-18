document.addEventListener("DOMContentLoaded", () => {
  requestAnimationFrame(() => {
    document.body.classList.add("is-loaded");
  });

  const body = document.body;
  const tabs = [...document.querySelectorAll(".tab")];
  const cards = [...document.querySelectorAll(".mail-card")];

  const menuButton = document.getElementById("menuButton");
  const menuClose = document.getElementById("menuClose");
  const menuPanel = document.getElementById("menuPanel");
  const menuBackdrop = document.getElementById("menuBackdrop");

  function animateVisibleCards(filter = "all") {
    let index = 0;

    cards.forEach((card) => {
      const status = card.dataset.status;
      const visible = filter === "all" || status === filter;

      card.classList.remove("from-left", "from-right");

      if (!visible) {
        card.classList.add("is-hidden");
        card.style.animationDelay = "";
        return;
      }

      card.classList.remove("is-hidden");
      void card.offsetWidth;

      const direction = index % 2 === 0 ? "from-left" : "from-right";
      card.classList.add(direction);
      card.style.animationDelay = `${0.18 + index * 0.12}s`;
      index += 1;
    });
  }

  function setActiveTab(filter) {
    tabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.filter === filter);
    });
  }

  function applyFilter(filter) {
    setActiveTab(filter);
    animateVisibleCards(filter);
  }

  function openMenu() {
    if (!menuButton || !menuPanel || !menuBackdrop) return;
    menuButton.classList.add("is-open");
    menuButton.setAttribute("aria-expanded", "true");
    menuPanel.classList.add("is-open");
    menuPanel.setAttribute("aria-hidden", "false");
    menuBackdrop.hidden = false;
    requestAnimationFrame(() => menuBackdrop.classList.add("is-visible"));
  }

  function closeMenu() {
    if (!menuButton || !menuPanel || !menuBackdrop) return;
    menuButton.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuPanel.classList.remove("is-open");
    menuPanel.setAttribute("aria-hidden", "true");
    menuBackdrop.classList.remove("is-visible");

    window.setTimeout(() => {
      if (!menuPanel.classList.contains("is-open")) {
        menuBackdrop.hidden = true;
      }
    }, 420);
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      applyFilter(tab.dataset.filter || "all");
    });
  });

  document.querySelectorAll("[data-refresh='true']").forEach((button) => {
    button.addEventListener("click", () => {
      const current = document.querySelector(".tab.active");
      const filter = current ? current.dataset.filter : "all";
      animateVisibleCards(filter);
      closeMenu();
    });
  });

  if (menuButton) {
    menuButton.addEventListener("click", () => {
      const isOpen = menuPanel && menuPanel.classList.contains("is-open");
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });
  }

  if (menuClose) {
    menuClose.addEventListener("click", closeMenu);
  }

  if (menuBackdrop) {
    menuBackdrop.addEventListener("click", closeMenu);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  document.querySelectorAll('a[href$=".html"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("http")) return;
      event.preventDefault();
      body.classList.add("is-leaving");
      window.setTimeout(() => {
        window.location.href = href;
      }, 420);
    });
  });

  if (cards.length) {
    animateVisibleCards("all");
  }
});
