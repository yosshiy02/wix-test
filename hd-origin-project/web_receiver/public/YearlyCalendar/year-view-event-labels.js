(() => {
  "use strict";

  if (
    window.__hdYearViewEventLabelsInstalled
  ) {
    return;
  }

  window.__hdYearViewEventLabelsInstalled =
    true;

  const EVENT_KEY =
    "teamEventsMulti";

  const USER_KEY =
    "teamCalendarUsers";

  let applying = false;
  let observer = null;
  let timer = null;

  function readJson(
    key,
    fallback
  ) {
    try {
      const value =
        localStorage.getItem(key);

      return value
        ? JSON.parse(value)
        : fallback;
    }
    catch {
      return fallback;
    }
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .replace(
        /^\[[^\]]+\]\s*/,
        ""
      )
      .trim();
  }

  function eventTitle(event) {
    const raw =
      cleanText(
        event &&
        (
          event.workflow_raw_title ||
          event.title ||
          event.text
        )
      );

    if (!raw) {
      return "予定";
    }

    const firstLine =
      raw.split(
        /[\r\n｜|]/
      )[0].trim();

    return firstLine
      .replace(
        /^[^:：]{1,20}[:：]\s*/,
        ""
      )
      .trim() ||
      "予定";
  }

  function userMap() {
    const users =
      readJson(
        USER_KEY,
        []
      );

    const map =
      new Map();

    if (Array.isArray(users)) {
      users.forEach(user => {
        if (
          user &&
          user.id
        ) {
          map.set(
            String(user.id),
            {
              name:
                String(
                  user.name ||
                  user.id
                ),

              enabled:
                user.enabled !==
                false
            }
          );
        }
      });
    }

    return map;
  }

  function eventsForDate(
    events,
    dateKey
  ) {
    const rows =
      events &&
      Array.isArray(
        events[dateKey]
      )
        ? events[dateKey]
        : [];

    const users =
      userMap();

    return rows.filter(event => {
      if (!event) {
        return false;
      }

      const user =
        users.get(
          String(
            event.user || ""
          )
        );

      return !user ||
        user.enabled !== false;
    });
  }

  function createLabel(
    event,
    index
  ) {
    const label =
      document.createElement(
        "div"
      );

    label.className =
      "hd-year-event-label";

    label.dataset.eventId =
      String(
        event.id ||
        index
      );

    label.dataset.userId =
      String(
        event.user ||
        "unassigned"
      );

    label.title =
      eventTitle(event);

    const title =
      document.createElement(
        "span"
      );

    title.className =
      "hd-year-event-title";

    title.textContent =
      eventTitle(event);

    label.appendChild(title);

    if (
      event.workflow_ai === true
    ) {
      const ai =
        document.createElement(
          "small"
        );

      ai.className =
        "hd-year-event-tag ai";

      ai.textContent =
        "AI";

      label.appendChild(ai);
    }

    if (
      event.workflow_needs_review ===
        true
    ) {
      const review =
        document.createElement(
          "small"
        );

      review.className =
        "hd-year-event-tag review";

      review.textContent =
        "要確認";

      label.appendChild(review);
    }

    return label;
  }

  function applyLabels() {
    if (applying) {
      return;
    }

    const grid =
      document.getElementById(
        "calendarGrid"
      );

    if (
      !grid ||
      !grid.classList.contains(
        "year-grid"
      )
    ) {
      return;
    }

    applying = true;

    if (observer) {
      observer.disconnect();
    }

    try {
      const events =
        readJson(
          EVENT_KEY,
          {}
        );

      grid
        .querySelectorAll(
          "td[data-date]"
        )
        .forEach(cell => {
          const dateKey =
            String(
              cell.dataset.date ||
              ""
            );

          const cellInner =
            cell.querySelector(
              ".cell-inner"
            );

          if (
            !dateKey ||
            !cellInner
          ) {
            return;
          }

          const oldLabels =
            cellInner.querySelector(
              ".hd-year-event-list"
            );

          if (oldLabels) {
            oldLabels.remove();
          }

          const oldDots =
            cellInner.querySelector(
              ".mini-dots"
            );

          if (oldDots) {
            oldDots.classList.add(
              "hd-year-dots-hidden"
            );
          }

          const dayEvents =
            eventsForDate(
              events,
              dateKey
            );

          if (!dayEvents.length) {
            cell.classList.remove(
              "hd-year-has-events"
            );

            return;
          }

          cell.classList.add(
            "hd-year-has-events"
          );

          const list =
            document.createElement(
              "div"
            );

          list.className =
            "hd-year-event-list";

          const visible =
            dayEvents.slice(0, 2);

          visible.forEach(
            (event, index) => {
              list.appendChild(
                createLabel(
                  event,
                  index
                )
              );
            }
          );

          if (
            dayEvents.length > 2
          ) {
            const more =
              document.createElement(
                "div"
              );

            more.className =
              "hd-year-event-more";

            more.textContent =
              "ほか" +
              (
                dayEvents.length -
                2
              ) +
              "件";

            list.appendChild(more);
          }

          cellInner.appendChild(
            list
          );
        });
    }
    finally {
      applying = false;

      if (
        observer &&
        grid
      ) {
        observer.observe(
          grid,
          {
            childList: true,
            subtree: true
          }
        );
      }
    }
  }

  function scheduleApply() {
    window.clearTimeout(timer);

    timer =
      window.setTimeout(
        applyLabels,
        40
      );
  }

  function installObserver() {
    const grid =
      document.getElementById(
        "calendarGrid"
      );

    if (!grid) {
      return false;
    }

    observer =
      new MutationObserver(
        scheduleApply
      );

    observer.observe(
      grid,
      {
        childList: true,
        subtree: true
      }
    );

    scheduleApply();

    return true;
  }

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      if (installObserver()) {
        return;
      }

      let attempts = 0;

      const retry =
        window.setInterval(
          () => {
            attempts++;

            if (
              installObserver() ||
              attempts >= 100
            ) {
              window.clearInterval(
                retry
              );
            }
          },
          100
        );
    }
  );

  window.addEventListener(
    "storage",
    event => {
      if (
        event.key === EVENT_KEY ||
        event.key === USER_KEY
      ) {
        scheduleApply();
      }
    }
  );

  document.addEventListener(
    "click",
    event => {
      if (
        event.target.closest(
          ".tab-btn, .filter-btn, .mode-btn"
        )
      ) {
        window.setTimeout(
          scheduleApply,
          60
        );
      }
    }
  );
})();