/* GMI portal demos · tabs, Hulili coach chat, practice log, review queue */
(function () {
  "use strict";

  /* tabs */
  var nav = document.querySelector(".portal-nav");
  if (nav) {
    var tabs = Array.prototype.slice.call(nav.querySelectorAll("[role=tab]"));
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (t, i) {
      t.tabIndex = t.getAttribute("aria-selected") === "true" ? 0 : -1;
      t.addEventListener("click", function () { select(t); });
      t.addEventListener("keydown", function (e) {
        var k = e.key, n = null;
        if (k === "ArrowDown" || k === "ArrowRight") n = tabs[(i + 1) % tabs.length];
        if (k === "ArrowUp" || k === "ArrowLeft") n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
  }

  /* Hulili coach chat (student portal) */
  var log = document.getElementById("coach-log");
  var form = document.getElementById("coach-form");
  if (log && form) {
    var input = document.getElementById("coach-input");
    var busy = false;
    function add(cls, text) {
      var d = document.createElement("div");
      d.className = "msg " + cls + " ai-fade";
      d.textContent = text;
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
      return d;
    }
    async function ask(q) {
      q = (q || "").trim();
      if (!q || busy) return;
      busy = true; input.value = "";
      add("me", q);
      var pending = add("bot", "Hulili is thinking…");
      pending.setAttribute("aria-busy", "true");
      try {
        if (!window.GMI_AI) throw new Error("not ready");
        var res = await window.GMI_AI.queryCustomAIModel(q, { task: "coach", instrument: "snare drum" });
        pending.textContent = res.text || "I don't have an answer for that yet. Try asking your mentor.";
        if (res.citations && res.citations.length) {
          var s = document.createElement("div");
          s.className = "msg-src";
          s.textContent = "From " + res.citations.map(function (c) { return c.label; }).join(", ");
          log.appendChild(s);
        }
      } catch (e) {
        pending.textContent = "Hulili couldn't answer right now. Please try again in a moment.";
      } finally {
        pending.removeAttribute("aria-busy");
        busy = false;
        log.scrollTop = log.scrollHeight;
      }
    }
    form.addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });
    document.querySelectorAll("#coach-quick button").forEach(function (b) {
      b.addEventListener("click", function () { ask(b.textContent); });
    });
  }

  /* practice log (student portal) */
  var lf = document.getElementById("log-form");
  if (lf) {
    lf.addEventListener("submit", function (e) {
      e.preventDefault();
      var what = document.getElementById("log-what"), min = document.getElementById("log-min");
      var w = what.value.trim(), m = parseInt(min.value, 10);
      if (!w) { what.focus(); return; }
      if (!(m > 0)) m = 20;
      var li = document.createElement("li");
      var left = document.createElement("div");
      var t = document.createElement("div"); t.className = "t"; t.textContent = w;
      var s = document.createElement("div"); s.className = "s"; s.textContent = "Today";
      left.appendChild(t); left.appendChild(s);
      var pill = document.createElement("span"); pill.className = "pill g"; pill.textContent = m + " min";
      li.appendChild(left); li.appendChild(pill);
      var list = document.getElementById("log-list");
      list.insertBefore(li, list.firstChild);
      what.value = "";
    });
  }

  /* review queue (admin portal) */
  document.querySelectorAll("[data-review] [data-done]").forEach(function (b) {
    b.addEventListener("click", function () {
      var acts = b.closest(".acts");
      var p = document.createElement("p");
      p.className = "done"; p.setAttribute("role", "status");
      p.textContent = "Reviewed";
      acts.replaceWith(p);
    });
  });
})();
