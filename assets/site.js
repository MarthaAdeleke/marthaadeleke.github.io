(function () {
  var root = document.documentElement;
  var reveals = [].slice.call(document.querySelectorAll("[data-reveal]"));

  function showAll() {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  // No observer, or the reader prefers less motion: land everything at rest.
  if (!("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    showAll();
    return;
  }

  // Stagger each group by its position among its own revealing siblings.
  [].forEach.call(document.querySelectorAll("[data-stagger]"), function (group) {
    var items = [].slice.call(group.children).filter(function (el) {
      return el.hasAttribute("data-reveal");
    });
    items.forEach(function (el, i) {
      el.style.setProperty("--d", i * 90 + "ms");
    });
  });

  // Per-character split for the hero wordmark.
  var headline = document.querySelector(".headline");
  if (headline) {
    var i = 0;
    [].forEach.call(headline.children, function (word) {
      var text = word.textContent;
      word.textContent = "";
      text.split("").forEach(function (ch) {
        var mask = document.createElement("span");
        mask.className = "char";
        var inner = document.createElement("i");
        inner.textContent = ch;
        inner.style.setProperty("--cd", i++ * 40 + "ms");
        mask.appendChild(inner);
        word.appendChild(mask);
      });
    });
    // The letters are decorative once split; the h1's aria-label carries the name.
    [].forEach.call(headline.children, function (word) {
      word.setAttribute("aria-hidden", "true");
    });
    headline.setAttribute("data-reveal", "chars");
    reveals.push(headline);
  }

  var targets = new Map();
  reveals.forEach(function (el) {
    var t = el.getAttribute("data-reveal") === "mask" ? el.parentElement : el;
    if (!targets.has(t)) targets.set(t, []);
    targets.get(t).push(el);
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      (targets.get(entry.target) || []).forEach(function (el) {
        el.classList.add("is-in");
      });
      io.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0.01 });

  function start() { targets.forEach(function (_, t) { io.observe(t); }); }

  // Wait for the display face so the headline doesn't reveal, then reflow.
  if (document.fonts && document.fonts.ready) {
    var started = false;
    var once = function () { if (!started) { started = true; start(); } };
    document.fonts.ready.then(once);
    setTimeout(once, 1200);
  } else {
    start();
  }

  // Case-study contents list: mark the section currently in view. Figma shows
  // one entry highlighted and the rest at half opacity, which only means
  // something if it tracks the reader.
  var tocLinks = [].slice.call(document.querySelectorAll(".case-toc a"));
  if (tocLinks.length) {
    var sections = tocLinks
      .map(function (a) { return document.querySelector(a.getAttribute("href")); })
      .filter(Boolean);

    var setActive = function (i) {
      tocLinks.forEach(function (a, n) { a.classList.toggle("is-active", n === i); });
    };
    setActive(0);

    var spyTicking = false;
    var onSpy = function () {
      if (spyTicking) return;
      spyTicking = true;
      requestAnimationFrame(function () {
        var line = window.scrollY + window.innerHeight * 0.3;
        var current = 0;
        sections.forEach(function (sec, i) {
          if (sec.getBoundingClientRect().top + window.scrollY <= line) current = i;
        });
        setActive(current);
        spyTicking = false;
      });
    };
    addEventListener("scroll", onSpy, { passive: true });
    onSpy();
  }

  // Hairline under the navbar once the page has moved.
  var nav = document.querySelector(".navbar");
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      nav.classList.toggle("is-stuck", window.scrollY > 8);
      ticking = false;
    });
  }
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();

/* Mobile nav. Its own block on purpose: the reveal script above returns early
   when the reader prefers less motion, and the menu still has to open. */
(function () {
  var navbar = document.querySelector(".navbar");
  if (!navbar) return;
  var toggle = navbar.querySelector(".nav-toggle");
  var panel = navbar.querySelector(".nav-panel");
  if (!toggle || !panel) return;

  var root = document.documentElement;
  var desktop = window.matchMedia("(min-width: 1100px)");

  function setOpen(open) {
    navbar.classList.toggle("is-open", open);
    root.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  function isOpen() { return navbar.classList.contains("is-open"); }

  toggle.addEventListener("click", function () { setOpen(!isOpen()); });

  // Same-page anchors leave the panel sitting over the section they jumped to.
  panel.addEventListener("click", function (e) {
    if (e.target.closest("a")) setOpen(false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !isOpen()) return;
    setOpen(false);
    toggle.focus();
  });

  // Keep the keyboard inside the panel while it covers the page.
  panel.addEventListener("keydown", function (e) {
    if (e.key !== "Tab" || !isOpen()) return;
    var stops = [toggle].concat([].slice.call(panel.querySelectorAll("a[href]")));
    var first = stops[0];
    var last = stops[stops.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // Widening past the breakpoint restores the flat bar; an open state would
  // leave the page scroll locked with nothing on screen explaining why.
  var onDesktop = function (e) { if (e.matches) setOpen(false); };
  if (desktop.addEventListener) desktop.addEventListener("change", onDesktop);
  else desktop.addListener(onDesktop);
})();

/* The contact buttons are plain mailto links and open the visitor's mail client,
   which is what the label promises. The only thing scripted here is a safety
   net: a mailto does nothing at all for someone on webmail with no handler
   registered - no window, no error, no address - and they would be left with
   nowhere to go. If the page is still in front of us a moment after the click,
   nothing took over, so the address goes on screen and onto the clipboard.
   Its own block, like the nav: the reveal script above returns early under
   reduced motion, and this still has to work. Without scripting the mailto is
   untouched, which is the behaviour this is a net underneath. */
(function () {
  var HANDOFF_MS = 1200;
  var REVERT_MS = 4000;

  function viaTextarea(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:-9999px;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (err) {
      return false;
    }
  }

  // navigator.clipboard needs a secure context, so it is absent over plain http.
  function copy(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { done(true); },
        function () { done(viaTextarea(text)); }
      );
    } else {
      done(viaTextarea(text));
    }
  }

  [].forEach.call(document.querySelectorAll('a[href^="mailto:"]'), function (link) {
    var label = link.querySelector(".btn__label");
    if (!label) return;
    var address = link.getAttribute("href").slice(7).split("?")[0];
    var resting = label.textContent;
    var timer;

    function show() {
      label.textContent = "Copied — " + address;
      link.classList.add("is-copied");
      clearTimeout(timer);
      timer = setTimeout(function () {
        // Silence the live region for the revert: the reader has already been
        // told the address, and hearing the label again is just noise.
        label.setAttribute("aria-live", "off");
        label.textContent = resting;
        link.classList.remove("is-copied");
        setTimeout(function () { label.setAttribute("aria-live", "polite"); }, 100);
      }, REVERT_MS);
    }

    link.addEventListener("click", function (e) {
      // The mailto is left to fire: no preventDefault anywhere in here.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // A mail client taking over hides this page or takes the focus off it.
      var handed = false;
      function note() { handed = true; }
      document.addEventListener("visibilitychange", note);
      window.addEventListener("blur", note);

      setTimeout(function () {
        document.removeEventListener("visibilitychange", note);
        window.removeEventListener("blur", note);
        // Only a handoff we actually saw counts. document.hasFocus() is no use
        // as a precondition: a page can be the thing the reader is looking at
        // and still not hold focus, and treating that as a handoff would mute
        // this net for the very people it exists for.
        if (handed || document.hidden) return;
        copy(address, function (ok) { if (ok) show(); });
      }, HANDOFF_MS);
    });
  });
})();
