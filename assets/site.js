/* Shared chrome: header and footer are injected once at runtime so seven pages
   never drift apart. Same pattern as imic3.js on imammahdi.ca. */

(function () {
  "use strict";

  var NAV = [
    ["index.html", "index"],
    ["research.html", "research"],
    ["ids.html", "iot ids"],
    ["flowsentry.html", "flowsentry"],
    ["ledgersentry.html", "ledgersentry"],
    ["imic.html", "imammahdi.ca"],
    ["method.html", "method"]
  ];

  var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (here === "") here = "index.html";

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (attrs[k] != null) n.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) {
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function buildHeader() {
    var nav = el("nav", { "class": "site-nav", "aria-label": "Sections" });
    NAV.forEach(function (item) {
      var current = item[0].toLowerCase() === here;
      nav.appendChild(el("a", {
        href: item[0],
        "aria-current": current ? "page" : null
      }, [item[1]]));
    });

    var brand = el("a", { "class": "brand", href: "index.html" }, []);
    brand.appendChild(document.createTextNode("sepehr jafari"));
    brand.appendChild(el("span", null, ["_"]));

    var head = el("header", { "class": "site-head" }, [
      el("div", { "class": "wrap" }, [brand, nav])
    ]);
    document.body.insertBefore(head, document.body.firstChild);

    var skip = el("a", { "class": "skip", href: "#main" }, ["Skip to content"]);
    document.body.insertBefore(skip, document.body.firstChild);
  }

  function buildFooter() {
    var links = el("div", { "class": "foot-links" }, [
      el("a", { href: "https://github.com/Aeripsen", rel: "me noopener" }, ["GitHub"]),
      el("a", { href: "https://orcid.org/0009-0002-8610-112X", rel: "me noopener" }, ["ORCID"]),
      el("a", { href: "https://www.linkedin.com/in/sepehr-jafari-fesharaki", rel: "me noopener" }, ["LinkedIn"]),
      el("a", { href: "https://ctftime.org/team/280084/", rel: "noopener" }, ["CTFtime"])
    ]);

    var foot = el("footer", { "class": "site-foot" }, [
      el("div", { "class": "wrap" }, [
        el("div", null, [
          el("div", null, ["Sepehr Jafari, Toronto."]),
          el("div", { "class": "mono", style: "font-size:0.72rem;margin-top:0.35rem" }, [
            "Hand-written HTML, CSS and JavaScript. No framework, no build step, no trackers."
          ])
        ]),
        links
      ])
    ]);
    document.body.appendChild(foot);
  }

  buildHeader();
  buildFooter();
})();
