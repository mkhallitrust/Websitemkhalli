"""One-time migration: turn the single-page site (site/) into real separate pages (public/).

Each page keeps its own <head> (title, meta, JSON-LD), the shared header/footer, and ONLY its
own <section>. Shared CSS/JS move to /assets so the browser caches them across pages.

Run:  python tools/split_pages.py
After this, public/ is the source of truth; edit it directly.
"""
import hashlib, pathlib, re, shutil, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "site"
OUT = ROOT / "public"

# url folder -> (source file, section id)
PAGES = {
    "":             ("index.html",              "page-home"),
    "about":        ("about/index.html",        "page-about"),
    "vyasatirtha":  ("vyasatirtha/index.html",  "page-vyasatirtha"),
    "gallery":      ("gallery/index.html",      "page-gallery"),
    "events":       ("events/index.html",       "page-events"),
    "trust":        ("trust/index.html",        "page-trust"),
    "seva-booking": ("seva-booking/index.html", "page-sevas"),
    "donate":       ("donate/index.html",       "page-donations"),
}
# body scripts, in their original order, identified by a marker in their text
JS = [
    ("core.js",  "const pageSections = document.querySelectorAll('.page-section');"),
    ("pages.js", "window.pgToast = function"),
    ("seva.js",  "ADMIN CONFIGURATION"),
    ("home.js",  "const pageHome = $('#page-home');"),
    ("vt.js",    "window.vtEnsure"),
]
PAGE_JS = {"page-home": "home.js", "page-sevas": "seva.js", "page-vyasatirtha": "vt.js"}
COMMON_JS = {"core.js", "pages.js"}

STYLE_RE = re.compile(r"[ \t]*<style>(.*?)</style>\n?", re.S)
BODY_SCRIPT_RE = re.compile(r"[ \t]*(?:<!--(?:(?!-->).)*-->\s*)?<script>(.*?)</script>\n?", re.S)
SECTION_RE = re.compile(r'[ \t]*<section id="(page-[a-z]+)" class="page-section[^"]*"[^>]*>.*?(?=\n[ \t]*<section id="page-|\n[ \t]*</main>)', re.S)


def read(p):
    return p.read_text(encoding="utf-8")


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "assets/css").mkdir(parents=True)
    (OUT / "assets/js").mkdir(parents=True)

    css_hash = None
    js_written = {}
    for folder, (src_rel, sec_id) in PAGES.items():
        html = read(SRC / src_rel)
        head_end = html.index("</head>")
        head, body = html[:head_end], html[head_end:]

        # ---- styles -> one shared stylesheet
        styles = STYLE_RE.findall(head)
        css = "\n\n".join(s.strip("\n") for s in styles) + "\n"
        h = hashlib.sha1(css.encode()).hexdigest()
        if css_hash is None:
            css_hash = h
            (OUT / "assets/css/site.css").write_text(css, encoding="utf-8")
        elif h != css_hash:
            sys.exit(f"CSS differs in {src_rel}")
        first = True
        def style_sub(m):
            nonlocal first
            if first:
                first = False
                return '    <link rel="stylesheet" href="/assets/css/site.css">\n'
            return ""
        head = STYLE_RE.sub(style_sub, head)

        # ---- keep only this page's section inside <main>
        sections = {m.group(1): m for m in SECTION_RE.finditer(body)}
        if sec_id not in sections:
            sys.exit(f"{sec_id} not found in {src_rel}")
        main_open = body.index('<main class="flex-grow">') + len('<main class="flex-grow">')
        main_close = body.index("</main>")
        own = sections[sec_id].group(0)
        own = re.sub(r'(class="page-section)\s+hidden', r"\1", own, count=1)
        body = body[:main_open] + "\n" + own + "\n    " + body[main_close:]

        # ---- body scripts -> external files; include only what this page needs
        wanted = COMMON_JS | ({PAGE_JS[sec_id]} if sec_id in PAGE_JS else set())
        def script_sub(m):
            code = m.group(1)
            for name, marker in JS:
                if marker in code:
                    break
            else:
                return m.group(0)          # unknown inline script: leave it
            if name not in js_written:
                js_written[name] = code
                (OUT / "assets/js" / name).write_text(code.strip("\n") + "\n", encoding="utf-8")
            if name not in wanted:
                return ""
            return f'    <script src="/assets/js/{name}"></script>\n'
        body = BODY_SCRIPT_RE.sub(script_sub, body)

        dest = OUT / folder / "index.html" if folder else OUT / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(head + body, encoding="utf-8")
        print(f"{'/' + folder:15} {sec_id:18} {dest.stat().st_size // 1024:5} KB  js={sorted(wanted)}")

    missing = {n for n, _ in JS} - set(js_written)
    if missing:
        sys.exit(f"scripts not found: {missing}")

    # old redirect pages, 404, robots, sitemap: copy unchanged
    for p in ["404.html", "robots.txt", "sitemap.xml", "home/index.html", "contact/index.html",
              "location/index.html", "madhwanavami-sevas/index.html", "social-media/index.html"]:
        d = OUT / p
        d.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(SRC / p, d)

    # ---- the router: follow real links to other pages instead of swapping sections
    core = OUT / "assets/js/core.js"
    c = read(core)
    old = "                    e.preventDefault();\n                    const pageId = link.dataset.page;"
    new = ("                    // separate pages: a link to another page is an ordinary link\n"
           "                    if (link.dataset.page && !document.getElementById(link.dataset.page)) return;\n"
           "                    e.preventDefault();\n                    const pageId = link.dataset.page;")
    assert old in c; c = c.replace(old, new)
    old = "            window.__goPage = (pageId, scrollToId) => {\n"
    new = ("            window.__goPage = (pageId, scrollToId) => {\n"
           "                if (pageId && !document.getElementById(pageId)) { location.href = (PAGE_URL[pageId] || '/') + (scrollToId ? '#' + scrollToId : ''); return; }\n")
    assert old in c; c = c.replace(old, new)
    core.write_text(c, encoding="utf-8")
    print("assets:", sorted(p.name for p in (OUT / "assets/js").iterdir()), "+ site.css")


if __name__ == "__main__":
    main()
