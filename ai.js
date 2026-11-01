/* ==========================================================
   Hulili · GMI AI features
   1. Mentorship & Portfolio Advisor   (#mentor-advisor)
   2. Archival AI Explorer             (#archive-explorer)
   3. Floating assistant drawer        (added to every page)

   HOW THE BACKEND HOOK WORKS
   - Every feature calls queryCustomAIModel(prompt, parameters).
   - If GMI_AI_CONFIG.endpoint is empty, or the request fails and
     mockFallback is true, a built-in mock answer is returned so the
     site works out of the box.
   - When the custom model is ready, set `endpoint` to YOUR server
     route (for example a Netlify/Cloudflare/Vercel function).

   SECURITY: never put a secret API key in this file. Anything in
   front-end JavaScript is public. Keep the key on the server route,
   which adds it and forwards the request to the model.

   EXPECTED REQUEST  (POST JSON)
     { prompt, task, parameters, page }
   EXPECTED RESPONSE (JSON, every field optional except text)
     { text, roadmap:{title,summary,steps:[{title,detail}]},
       mentors:[{name,role,initials}], resources:[{label,href}],
       references:[{type:"audio"|"doc",title,detail,status}],
       citations:[{label,href}], links:[{label,href}] }
   ========================================================== */
(function () {
  "use strict";

  /* ---------------- Configuration ---------------- */
  var GMI_AI_CONFIG = Object.assign({
    endpoint: "",            // e.g. "https://ai.globalmusicinitiative.org/v1/query"
    headers: {},             // extra NON-secret headers, e.g. {"X-GMI-Client":"web"}
    timeoutMs: 20000,
    mockFallback: true,      // use mock answers if the endpoint is empty or fails
    mockDelayMs: [900, 1700],
    assistantName: "Hulili"
  }, window.GMI_AI_CONFIG || {});

  /* ---------------- Core API hook ---------------- */
  /**
   * Query the custom-trained GMI model.
   * @param {string} prompt   User text (or a built prompt for structured tasks)
   * @param {object} parameters  { task: "mentorship-roadmap" | "archive-qa" | "assistant", ...task fields }
   * @returns {Promise<object>} normalized response (see header)
   */
  async function queryCustomAIModel(prompt, parameters) {
    parameters = parameters || {};
    var task = parameters.task || "assistant";

    if (!GMI_AI_CONFIG.endpoint) {
      return mockResponse(prompt, parameters, { reason: "no-endpoint" });
    }

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, GMI_AI_CONFIG.timeoutMs);
    try {
      var res = await fetch(GMI_AI_CONFIG.endpoint, {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json", "Accept": "application/json" }, GMI_AI_CONFIG.headers),
        body: JSON.stringify({ prompt: prompt, task: task, parameters: parameters, page: location.pathname }),
        signal: controller.signal
      });
      if (!res.ok) throw new GMIAIError("The AI service returned an error (" + res.status + ").", res.status);
      var data = await res.json();
      var out = normalizeResponse(data);
      out.meta = { source: "live" };
      return out;
    } catch (err) {
      var friendly = err.name === "AbortError"
        ? new GMIAIError("The AI took too long to respond.", "timeout")
        : (err instanceof GMIAIError ? err : new GMIAIError("We couldn't reach the AI service.", "network"));
      console.warn("[GMI AI]", friendly.message, err);
      if (GMI_AI_CONFIG.mockFallback) return mockResponse(prompt, parameters, { reason: friendly.code });
      throw friendly;
    } finally {
      clearTimeout(timer);
    }
  }

  function GMIAIError(message, code) { this.name = "GMIAIError"; this.message = message; this.code = code; }
  GMIAIError.prototype = Object.create(Error.prototype);

  /** Make any backend payload safe and predictable for the UI. */
  function normalizeResponse(d) {
    d = d && typeof d === "object" ? d : {};
    var arr = function (x) { return Array.isArray(x) ? x : []; };
    var str = function (x) { return typeof x === "string" ? x : ""; };
    return {
      text: str(d.text || d.answer || d.output),
      roadmap: d.roadmap && typeof d.roadmap === "object" ? {
        title: str(d.roadmap.title), summary: str(d.roadmap.summary),
        steps: arr(d.roadmap.steps).map(function (s) { return { title: str(s.title), detail: str(s.detail) }; })
      } : null,
      mentors: arr(d.mentors).map(function (m) { return { name: str(m.name), role: str(m.role), initials: str(m.initials) }; }),
      resources: arr(d.resources).map(safeLink),
      references: arr(d.references).map(function (r) { return { type: r.type === "audio" ? "audio" : "doc", title: str(r.title), detail: str(r.detail), status: str(r.status) }; }),
      citations: arr(d.citations).map(safeLink),
      links: arr(d.links).map(safeLink)
    };
  }
  function safeLink(l) {
    var href = typeof l.href === "string" ? l.href : "#";
    if (!/^(https?:|mailto:|#|[a-z0-9_-]+\.html)/i.test(href)) href = "#"; // block javascript: etc.
    return { label: typeof l.label === "string" ? l.label : href, href: href };
  }

  /* ---------------- Mock model (for testing) ---------------- */
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function mockResponse(prompt, p, info) {
    var d = GMI_AI_CONFIG.mockDelayMs;
    await wait(d[0] + Math.random() * (d[1] - d[0]));
    var out;
    if (p.task === "mentorship-roadmap") out = mockMentorship(p);
    else if (p.task === "archive-qa") out = mockArchive(prompt);
    else if (p.task === "coach") out = mockCoach(prompt);
    else out = mockAssistant(prompt, p.audience);
    out = normalizeResponse(out);
    out.meta = { source: "mock", reason: info && info.reason };
    return out;
  }

  function has(text, words) { text = (text || "").toLowerCase(); return words.some(function (w) { return text.indexOf(w) >= 0; }); }

  function mockMentorship(p) {
    var cat = p.category || "Performance", level = p.level || "Undergraduate", goal = p.goal || "Career pathways";
    var steps = {
      "Grant writing": [
        { title: "Find two funders that fit", detail: "Look for grants that match " + cat.toLowerCase() + " work at the " + level.toLowerCase() + " level. Your school's fellowship office is the best first stop." },
        { title: "Draft a one-page project summary", detail: "Say what you'll do, who it serves, and what it costs. A mentor reviews it with you before you write the full application." },
        { title: "Build a simple budget", detail: "List every cost with a source. Funders trust a clear, honest budget more than a big one." }
      ],
      "Archival and field work": [
        { title: "Learn consent and community protocol first", detail: "Before recording anyone, learn how to ask permission and who owns the material. GMI's Nepal work follows the community's terms." },
        { title: "Practice field recording basics", detail: "Record a local musician with a phone or loaned recorder, then log date, place, people and context for every file." },
        { title: "Study how archives are organized", detail: "See how recordings, video and notes are labeled so they stay useful for decades." }
      ],
      "Career pathways": [
        { title: "Map three possible paths", detail: "For " + cat.toLowerCase() + ", that might mean performing, teaching, research or arts leadership. Pick the one that excites you most to explore first." },
        { title: "Talk with someone already on that path", detail: "A short conversation with a working musician or scholar teaches more than hours of searching online." },
        { title: "Build one portfolio piece this term", detail: "A recording, paper, composition or project write-up you can share when opportunities come up." }
      ],
      "Auditions and portfolio": [
        { title: "Choose repertoire that shows your strengths", detail: "Pick pieces you can play well under pressure, not just the hardest ones you know." },
        { title: "Record a mock audition", detail: "Film yourself start to finish, then review it with a mentor for one or two clear fixes." },
        { title: "Gather your materials early", detail: "Bio, repertoire list, recordings and references. Keep them updated in one folder." }
      ],
      "Starting a GMI chapter": [
        { title: "Find two or three co-founders", detail: "A chapter lasts longer when leadership is shared and spans class years." },
        { title: "Register with your school", detail: "Most campuses need a constitution, an advisor and a small founding member list." },
        { title: "Pick one first project", detail: "Start with something small and real, like lessons for local students or a community concert, then grow from there." }
      ]
    }[goal] || [];
    var mentorRole = {
      "Performance": "Performance mentor", "Ethnomusicology": "Ethnomusicology mentor", "Composition": "Composition mentor",
      "Music education": "Music education mentor", "Music business and technology": "Music industry mentor"
    }[cat] || "GMI mentor";
    var resources = [{ label: "How GMI works", href: "how.html" }];
    if (goal === "Archival and field work") resources.unshift({ label: "The Nepal Sarangi Documentation Project", href: "nepal.html" });
    if (goal === "Starting a GMI chapter") resources.unshift({ label: "GMI's team and founding chapter", href: "team.html" });
    if (goal === "Grant writing" || goal === "Archival and field work") resources.push({ label: "Apply to the 2027 Nepal cohort", href: "apply.html" });
    resources.push({ label: "Ask GMI for a mentor match", href: "index.html#contact" });
    return {
      text: "Here is a starting roadmap for a " + level.toLowerCase() + " student in " + cat.toLowerCase() + " focused on " + goal.toLowerCase() + ".",
      roadmap: {
        title: goal + " roadmap",
        summary: "Three steps to start with. A GMI mentor can help you adjust them to your situation.",
        steps: steps
      },
      mentors: [
        { name: mentorRole, role: "Matched by GMI · name shared after intake", initials: initialsOf(mentorRole) },
        { name: "Peer mentor", role: "A GMI student a few steps ahead of you", initials: "PM" }
      ],
      resources: resources
    };
  }
  function initialsOf(s) { return s.split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase(); }

  function mockArchive(q) {
    if (has(q, ["sarangi", "gandharva", "gaine", "instrument", "tradition"])) return {
      text: "The sarangi is a bowed string instrument, carved by hand from a single block of wood. For generations, Gandharva musicians traveled from village to village singing ballads, news and stories, which made them Nepal's news carriers and oral historians.\n\nThe tradition belongs to the Gandharva community, who have kept it alive, often in the face of caste discrimination. Today it is both thriving and changing. Younger players carry it onto stages worldwide, while in rural communities much of the older repertoire lives in memory and performance.",
      references: [
        { type: "audio", title: "Village ballad recordings", detail: "Field recordings with Gandharva musicians and families", status: "Planned for 2027 fieldwork" },
        { type: "doc", title: "Song notes and translations", detail: "Lyrics, context and meaning, reviewed with the community", status: "Planned for 2027 fieldwork" }
      ],
      citations: [{ label: "GMI Nepal project page", href: "nepal.html" }, { label: "Project Sarangi", href: "https://projectsarangi.com" }]
    };
    if (has(q, ["oral", "document", "record", "archive", "how does gmi", "method", "consent"])) return {
      text: "GMI documents oral histories alongside the people who carry them, on the community's terms. With The Initiatives Foundation, the team plans to ask for consent before any recording, record performances and interviews in audio, video and writing, and return copies of the recordings to the Gandharva community.\n\nEvery file is logged with who, where, when and context so the archive stays useful for future generations.",
      references: [
        { type: "doc", title: "Consent and community protocol", detail: "Guided by The Initiatives Foundation", status: "In development" },
        { type: "audio", title: "Interviews with musicians and elders", detail: "Audio and video, with written transcripts", status: "Planned for 2027 fieldwork" }
      ],
      citations: [{ label: "GMI Nepal project page", href: "nepal.html" }]
    };
    if (has(q, ["women", "gender", "female"])) return {
      text: "Historically, Gandharva music was mostly performed by men, who traveled to perform while women often held household roles. Sons learned the sarangi and songs by traveling with their fathers.\n\nThe project plans to explore the role of women in Gandharva households, how their experiences differ from male musicians', and how these roles are changing across generations.",
      references: [{ type: "audio", title: "Conversations with Gandharva women", detail: "Interviews planned with consent", status: "Planned for 2027 fieldwork" }],
      citations: [{ label: "GMI Nepal project page", href: "nepal.html" }]
    };
    if (has(q, ["when", "where", "fieldwork", "trip", "join", "cohort"])) return {
      text: "Fieldwork in Nepal is planned for late April to mid-June 2027, with a cohort of students from many schools and fields. The final cohort is chosen by February 28, 2027, and needs-based funding is available.",
      references: [],
      citations: [{ label: "Apply to the cohort", href: "apply.html" }, { label: "GMI Nepal project page", href: "nepal.html" }]
    };
    return {
      text: "That is a great question for the archive. The GMI archive will grow after the 2027 fieldwork in Nepal, so many answers are still being gathered. For now, try asking about the sarangi, the Gandharva tradition, or how GMI documents oral histories.",
      references: [],
      citations: [{ label: "GMI Nepal project page", href: "nepal.html" }]
    };
  }

  function mockCoach(q) {
    var src = function (t) { return [{ label: "a sample masterclass on " + t, href: "#" }]; };
    if (has(q, ["rudiment", "faster", "speed", "tense", "paradiddle"])) return {
      text: "Speed comes from relaxed control, not force.\n\n1. Start slow with a metronome, slow enough that every stroke sounds even.\n2. Play two minutes clean, then raise the tempo a few clicks.\n3. Keep your grip loose and let the stick rebound.\n\nIf it starts to feel tense, go back down. Tension is the speed limit.",
      citations: src("rudiments")
    };
    if (has(q, ["nerv", "scared", "anxious", "audition", "perform"])) return {
      text: "Almost every performer gets nervous. A few things help.\n\n1. Practice performing, not just playing. Run your piece start to finish for a friend or your phone camera.\n2. Plan your first few notes so you can start on autopilot.\n3. Slow your breathing before you walk in.\n\nNerves mean you care. The goal is to play well with them, not to make them disappear.",
      citations: src("performance")
    };
    if (has(q, ["plan", "practice", "routine", "minute", "time"])) return {
      text: "Here's a balanced 20 minutes.\n\n5 min warm up with slow, even strokes\n5 min one rudiment or scale\n8 min your piece, hardest four bars first\n2 min play something you love, just for fun\n\nLog it when you're done and I'll suggest what to focus on tomorrow.",
      citations: src("practice habits")
    };
    if (has(q, ["rhythm", "count", "read", "dotted", "note"])) return {
      text: "Count out loud while you clap the rhythm first, then play it. If a bar feels tricky, write the counts under the notes and play it at half speed.\n\nDotted notes are easier if you count the smaller beats inside them, like 1-e-and-a.",
      citations: src("reading rhythm")
    };
    if (has(q, ["hurt", "pain", "wrist", "injur"])) return {
      text: "Pain is a signal to stop and rest, not to push through. Please tell a parent or guardian and your GMI mentor. If it keeps hurting, a doctor should check it.\n\nI've let GMI staff know so someone can follow up with you."
    };
    return {
      text: "Good question. In the full version I'll answer from GMI's masterclasses and link the exact lesson. For this preview, try asking about rudiments, nerves, rhythm or a practice plan."
    };
  }

  function mockAssistant(q, audience) {
    if (has(q, ["hulili", "name", "who are you", "what are you"])) return {
      text: "I'm Hulili, GMI's AI assistant. In Hawaiian, hulili can mean a bridge or ladder across a gully, a way across a gap. That's what GMI hopes to be for students who don't have access to music teachers or opportunities.\n\nI'm a preview right now, so my answers come from GMI's website."
    };
    if (audience === "board" || has(q, ["board", "governance", "nonprofit", "501", "metric", "impact", "expansion", "chapter"])) {
      if (has(q, ["chapter", "expansion", "grow", "metric"])) return {
        text: "GMI is starting small on purpose. The Vanderbilt chapter comes first, with a pilot group of students and volunteer mentors, so we can learn what works before adding chapters at other universities.\n\nImpact will be shared publicly as programs launch, focused on outcomes like students served, practice and goals reached, rather than reach alone.",
        links: [{ label: "See GMI's goals for the next 12 months", href: "partners.html" }]
      };
      if (has(q, ["impact", "measure"])) return {
        text: "GMI plans to measure impact by what changes for students. That means how many get regular access to expert teaching and a mentor, whether they reach the goals they set, and whether they find instruments, teachers and opportunities they didn't have before.",
        links: [{ label: "For partners and investors", href: "partners.html" }]
      };
      return {
        text: "GMI is preparing to incorporate as an independent nonprofit with a founding board that brings legal, financial and fundraising strength. Student chapters, starting at Vanderbilt, are student-run and affiliated with the organization.\n\nIf you're interested in serving, GMI would love to talk.",
        links: [{ label: "Contact GMI about the board", href: "index.html?topic=Joining%20the%20board#contact" }, { label: "Meet the team", href: "team.html" }]
      };
    }
    if (has(q, ["cohort", "nepal trip"])) return {
      text: "College students from any school or field can apply to the 2027 Nepal cohort. The final cohort is chosen by February 28, 2027, and needs-based funding is available.",
      links: [{ label: "Nepal cohort application", href: "apply.html" }]
    };
    if (has(q, ["apply", "join", "sign up", "cost", "price", "afford", "pay"])) return {
      text: "Young musicians can apply to GMI with a parent or guardian. Beginners are welcome. Financial support is available for students who can demonstrate financial need.",
      links: [{ label: "Apply as a student", href: "join.html" }]
    };
    if (has(q, ["mentor", "roadmap", "advice", "career"])) return {
      text: "Yes. Every GMI student is matched with a trained volunteer mentor who helps them find what they need next, like an instrument, a teacher or college advice. You can also try the Mentorship Advisor on the home page for a starting roadmap.",
      links: [{ label: "Open the Mentorship Advisor", href: "index.html#mentorship" }]
    };
    if (has(q, ["nepal", "sarangi", "gandharva"])) return {
      text: "GMI's first field project is the Sarangi Documentation Project in Nepal, with The Initiatives Foundation. The goal is the first thorough documentary and written record of the Gandharva sarangi storytelling tradition, made on the community's terms.",
      links: [{ label: "Explore the Nepal project", href: "nepal.html" }]
    };
    if (has(q, ["donate", "give", "support", "fund"])) return {
      text: "Online giving is coming soon. To support GMI now, send a message and the team will follow up.",
      links: [{ label: "Ways to support GMI", href: "partners.html" }]
    };
    if (has(q, ["contact", "email", "talk"])) return {
      text: "You can reach GMI at info@globalmusicinitiative.org or through the contact form.",
      links: [{ label: "Go to the contact form", href: "index.html#contact" }]
    };
    return {
      text: "I'm still a preview, so I can best help with joining GMI, mentorship, the Nepal project, and GMI's governance and growth plans. Try one of the suggestions below, or contact the team directly.",
      links: [{ label: "Contact GMI", href: "index.html#contact" }]
    };
  }

  /* ---------------- Small DOM helpers (no innerHTML for AI text) ---------------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "class") n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function loader(label) {
    return el("div", { class: "ai-loader", role: "status" }, [
      el("span", { class: "bars", "aria-hidden": "true" }, [el("b"), el("b"), el("b"), el("b"), el("b")]),
      el("span", { text: label || "Querying GMI Custom AI Model…" })
    ]);
  }
  var ICON_BARS = '<svg viewBox="0 0 24 24" fill="none" stroke="#F2C230" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 9v6M9.5 5v14M14.5 7v10M19 10v4"/></svg>';
  function iconBars() { var s = document.createElement("span"); s.className = "ai-avatar"; s.setAttribute("aria-hidden", "true"); s.innerHTML = ICON_BARS; return s; }
  function linkList(items, cls) {
    return el("ul", { class: cls || "resource-list" }, items.map(function (r) {
      var ext = /^https?:/.test(r.href);
      var a = el("a", { href: r.href }, [el("span", { text: r.label }), el("span", { "aria-hidden": "true", text: "→" })]);
      if (ext) { a.target = "_blank"; a.rel = "noopener"; }
      return el("li", null, [a]);
    }));
  }
  function mockNote(res) {
    return res.meta && res.meta.source === "mock"
      ? el("p", { class: "ai-note", text: "Preview answer · Hulili's custom model is in development" })
      : null;
  }

  /* ---------------- 1. Mentorship advisor ---------------- */
  function initMentorAdvisor() {
    var form = document.getElementById("mentor-form");
    if (!form) return;
    var out = document.getElementById("mentor-output");
    var btn = form.querySelector("[type=submit]");

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var params = {
        task: "mentorship-roadmap",
        category: form.elements.category.value,
        level: form.elements.level.value,
        goal: form.elements.goal.value,
        notes: form.elements.notes.value.trim().slice(0, 500)
      };
      var prompt = "Create a mentorship roadmap for a " + params.level + " student in " + params.category +
        " whose primary goal is " + params.goal + "." + (params.notes ? " Extra context: " + params.notes : "");

      btn.disabled = true;
      out.setAttribute("aria-busy", "true");
      out.replaceChildren(loader());
      try {
        var res = await queryCustomAIModel(prompt, params);
        out.replaceChildren(renderRoadmap(res, params));
        var h = out.querySelector("h4"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
      } catch (err) {
        out.replaceChildren(el("p", { class: "ai-error", role: "alert", text: err.message + " Please try again, or email info@globalmusicinitiative.org." }));
      } finally {
        btn.disabled = false;
        out.setAttribute("aria-busy", "false");
      }
    });
  }

  function renderRoadmap(res, params) {
    var r = res.roadmap || { title: "Your roadmap", summary: res.text, steps: [] };
    var wrap = el("div", { class: "ai-result ai-fade" }, [
      el("div", { class: "roadmap-head" }, [
        el("h4", { text: r.title }),
        el("span", { class: "ai-badge", text: params.category + " · " + params.level })
      ]),
      el("p", { class: "roadmap-summary", text: r.summary || res.text }),
      r.steps.length ? el("ol", { class: "roadmap-steps" }, r.steps.map(function (s) {
        return el("li", null, [el("div", null, [el("strong", { text: s.title }), el("span", { text: s.detail })])]);
      })) : null
    ]);
    if (res.mentors.length) {
      wrap.appendChild(el("p", { class: "ai-subhead", text: "Suggested mentors" }));
      wrap.appendChild(el("div", { class: "mentor-list" }, res.mentors.map(function (m, i) {
        var colors = ["background:var(--sun);color:var(--navy-deep)", "background:var(--land);color:#fff", "background:var(--sea);color:#fff"];
        return el("div", { class: "mentor-chip" }, [
          el("div", { class: "avatar", style: colors[i % 3], "aria-hidden": "true", text: m.initials || initialsOf(m.name) }),
          el("div", null, [el("strong", { text: m.name }), el("span", { text: m.role })])
        ]);
      })));
    }
    if (res.resources.length) {
      wrap.appendChild(el("p", { class: "ai-subhead", text: "GMI resources" }));
      wrap.appendChild(linkList(res.resources));
    }
    var again = el("button", { type: "button", class: "btn ghost", text: "Start over" });
    again.addEventListener("click", function () {
      var out = document.getElementById("mentor-output");
      out.replaceChildren(el("p", { class: "ai-note", text: "Choose your details and generate a new roadmap." }));
      document.getElementById("m-category").focus();
    });
    var match = el("a", { class: "btn", href: "#contact", text: "Request a mentor match" });
    match.addEventListener("click", function () {
      var topic = document.getElementById("f-topic"), msg = document.getElementById("f-msg");
      if (topic) for (var i = 0; i < topic.options.length; i++) if (topic.options[i].text === "Joining GMI") topic.selectedIndex = i;
      if (msg && !msg.value) msg.value = "I'd like a mentor match. I'm a " + params.level.toLowerCase() + " student in " + params.category.toLowerCase() + ", focused on " + params.goal.toLowerCase() + ".";
    });
    wrap.appendChild(el("div", { class: "ai-actions" }, [match, again]));
    var note = mockNote(res); if (note) wrap.appendChild(note);
    return wrap;
  }

  /* ---------------- 2. Archival explorer ---------------- */
  function initArchive() {
    var root = document.getElementById("archive-explorer");
    if (!root) return;
    var form = root.querySelector(".archive-search");
    var input = form.querySelector("input");
    var log = root.querySelector(".archive-log");
    var busy = false;

    async function ask(q) {
      q = (q || "").trim();
      if (!q || busy) return;
      busy = true;
      input.value = "";
      log.replaceChildren(); // keep one Q&A visible at a time for readability
      log.appendChild(el("div", { class: "archive-q ai-fade", text: q }));
      var box = el("div", { class: "archive-a ai-fade", "aria-busy": "true" }, [loader("Searching the GMI archive…")]);
      log.appendChild(box);
      try {
        var res = await queryCustomAIModel(q, { task: "archive-qa", collection: "nepal-sarangi" });
        box.replaceChildren();
        res.text.split(/\n\n+/).forEach(function (p) { box.appendChild(el("p", { text: p })); });
        if (res.references.length) {
          box.appendChild(el("p", { class: "ai-subhead", text: "Field recordings and documents" }));
          box.appendChild(el("ul", { class: "ref-list" }, res.references.map(function (r) {
            var icon = el("span", { class: "ref-icon " + r.type, "aria-hidden": "true" });
            icon.innerHTML = r.type === "audio"
              ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/></svg>'
              : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/></svg>';
            return el("li", null, [icon, el("div", null, [
              el("strong", { text: r.title }), el("span", { text: r.detail }),
              r.status ? el("span", { class: "status", text: r.status }) : null
            ])]);
          })));
        }
        if (res.citations.length) {
          var c = el("p", { class: "citations" }, ["Sources · "]);
          res.citations.forEach(function (s, i) {
            var a = el("a", { href: s.href, text: s.label });
            if (/^https?:/.test(s.href)) { a.target = "_blank"; a.rel = "noopener"; }
            if (i) c.appendChild(document.createTextNode(" · "));
            c.appendChild(a);
          });
          box.appendChild(c);
        }
        var note = mockNote(res); if (note) box.appendChild(note);
      } catch (err) {
        box.replaceChildren(el("p", { class: "ai-error", role: "alert", text: err.message + " Please try again." }));
      } finally {
        box.setAttribute("aria-busy", "false");
        busy = false;
      }
    }

    form.addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });
    root.querySelectorAll(".chip").forEach(function (c) {
      c.addEventListener("click", function () { ask(c.dataset.prompt || c.textContent); });
    });
  }

  /* ---------------- 3. Floating drawer ---------------- */
  var QUICK = {
    student: ["How do I apply to GMI?", "Can I get a mentor?", "What if I can't afford it?", "What does Hulili mean?"],
    board: ["What are GMI's governance goals?", "How will GMI grow?", "How will GMI measure impact?", "How can I join the board?"]
  };

  function initDrawer() {
    if (document.getElementById("ai-drawer") || document.querySelector("[data-no-hulili-drawer]")) return;
    var audience = "student";

    var fab = el("button", { type: "button", class: "ai-fab", "aria-expanded": "false", "aria-controls": "ai-drawer" }, [
      iconBars(), el("span", null, [el("span", { class: "label-long", text: "Ask " }), "Hulili"])
    ]);
    fab.setAttribute("aria-label", "Ask Hulili, GMI's AI assistant");

    var closeBtn = el("button", { type: "button", class: "ai-close", "aria-label": "Close assistant" });
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

    var tabStudent = el("button", { type: "button", class: "ai-tab", role: "tab", "aria-selected": "true", id: "ai-tab-student", text: "I'm a student" });
    var tabBoard = el("button", { type: "button", class: "ai-tab", role: "tab", "aria-selected": "false", id: "ai-tab-board", text: "Board and partners" });
    var msgs = el("div", { class: "ai-msgs", id: "ai-msgs", role: "log", "aria-live": "polite", "aria-relevant": "additions", tabindex: "0", "aria-label": "Conversation with Hulili" });
    var quick = el("div", { class: "ai-quick", "aria-label": "Suggested questions" });
    var input = el("input", { type: "text", id: "ai-input", autocomplete: "off", maxlength: "500", placeholder: "Ask about GMI…" });
    var label = el("label", { for: "ai-input", class: "sr-only", text: "Message Hulili" });
    var send = el("button", { type: "submit", class: "btn", text: "Send" });
    var compose = el("form", { class: "ai-compose" }, [label, input, send]);

    var drawer = el("section", { class: "ai-drawer", id: "ai-drawer", role: "dialog", "aria-modal": "false", "aria-labelledby": "ai-drawer-title" }, [
      el("div", { class: "ai-drawer-head" }, [
        iconBars(),
        el("div", null, [el("h2", { id: "ai-drawer-title", text: "Ask Hulili" }), el("p", { text: "GMI's AI assistant · preview" })]),
        closeBtn
      ]),
      el("div", { class: "ai-tabs", role: "tablist", "aria-label": "Who are you?" }, [tabStudent, tabBoard]),
      msgs, quick, compose,
      el("p", { class: "ai-drawer-foot", text: "Hulili can make mistakes. For anything important, email info@globalmusicinitiative.org." })
    ]);
    drawer.hidden = true;
    document.body.appendChild(fab);
    document.body.appendChild(drawer);

    function addMsg(who, text, links) {
      var m = el("div", { class: "msg " + who + " ai-fade" }, [text]);
      (links || []).forEach(function (l) {
        m.appendChild(document.createElement("br"));
        m.appendChild(el("a", { class: "msg-link", href: l.href, text: l.label + " →" }));
      });
      msgs.appendChild(m);
      msgs.scrollTop = msgs.scrollHeight;
      return m;
    }
    function renderQuick() {
      quick.replaceChildren.apply(quick, QUICK[audience].map(function (q) {
        var b = el("button", { type: "button", text: q });
        b.addEventListener("click", function () { ask(q); });
        return b;
      }));
    }
    function greet() {
      msgs.replaceChildren();
      addMsg("bot", audience === "student"
        ? "Aloha! I'm Hulili. I can help you join GMI, find mentorship and learn about the Nepal project. What would you like to know?"
        : "Aloha! I'm Hulili. I can share GMI's governance goals, chapter growth plans and how GMI measures impact. What would you like to know?");
    }
    function setAudience(a) {
      audience = a;
      tabStudent.setAttribute("aria-selected", String(a === "student"));
      tabBoard.setAttribute("aria-selected", String(a === "board"));
      greet(); renderQuick();
    }

    var busy = false;
    async function ask(q) {
      q = (q || "").trim();
      if (!q || busy) return;
      busy = true; send.disabled = true;
      input.value = "";
      addMsg("me", q);
      var pending = addMsg("bot", "");
      pending.replaceChildren(loader("Hulili is thinking…"));
      try {
        var res = await queryCustomAIModel(q, { task: "assistant", audience: audience });
        pending.remove();
        addMsg("bot", res.text || "Sorry, I don't have an answer for that yet.", res.links);
      } catch (err) {
        pending.remove();
        addMsg("bot", err.message + " You can always email info@globalmusicinitiative.org.");
      } finally {
        busy = false; send.disabled = false;
      }
    }

    function open() {
      drawer.hidden = false; fab.setAttribute("aria-expanded", "true");
      if (!msgs.childNodes.length) setAudience(audience);
      setTimeout(function () { input.focus(); }, 50);
    }
    function close() {
      drawer.hidden = true; fab.setAttribute("aria-expanded", "false"); fab.focus();
    }
    fab.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    drawer.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    tabStudent.addEventListener("click", function () { setAudience("student"); });
    tabBoard.addEventListener("click", function () { setAudience("board"); });
    compose.addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });

    // any element with data-open-hulili opens the drawer
    document.querySelectorAll("[data-open-hulili]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); if (b.dataset.openHulili === "board") setAudience("board"); open(); });
    });
  }

  /* ---------------- Boot ---------------- */
  function boot() { initMentorAdvisor(); initArchive(); initDrawer(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // Public API for testing in the console, e.g. GMI_AI.queryCustomAIModel("hello", {task:"assistant"})
  window.GMI_AI = { queryCustomAIModel: queryCustomAIModel, config: GMI_AI_CONFIG, normalizeResponse: normalizeResponse };
})();
