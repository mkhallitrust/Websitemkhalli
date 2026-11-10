"""Apply the trust identity, 3D polish includes, Cashfree payment UI and policy pages to public/.

Safe to run more than once (every insert is guarded by a marker).
Run:  python tools/patch_site.py
Trust facts below are taken from the registered Trust Deed (Book IV, GBD-4-00153-2013-14).
"""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUB = ROOT / "public"
V = "3"  # bump to make browsers fetch new CSS/JS

# ------------------------------------------------------------------ trust facts (from the deed)
NAME_EN = "Mavinakayinahalli Sri Mukhyaprana Seva Trust"
NAME_KN = "ಮಾವಿನಕಾಯಿನಹಳ್ಳಿ ಶ್ರೀ ಮುಖ್ಯಪ್ರಾಣ ಸೇವಾ ಟ್ರಸ್ಟ್"
DEED_NAME = "MAVINAKAYINAHALLI SRI MUKHYA PRANA SEVA TRUST"
SHORT = "MSMPST"
REG_NO = "GBD-4-00153-2013-14"
REG_BOOK = "Book IV"
REG_CD = "GBDD85"
REG_DATE = "05-03-2014"
REG_OFFICE = "Sub-Registrar, Gauribidanur"
REG_ADDR = ("C/o Gururaja Rao, Temple Road, Next to Govt. Higher Primary School, Mavinakayinahalli, "
            "Gauribidanur Taluk, Chikkaballapur District, Karnataka 561211")
TEMPLE_ADDR = "Anjaneya Temple, Arasalbande, Mavinakayinahalli, Karnataka 561211"
SETTLOR = "Shri M.R. Krishna Murthy"
TRUSTEES = ["Sri M.R. Krishna Murthy", "Sri N.K. Mohana", "Sri M.S. Sudheendra", "Sri Sripadaraja K",
            "Sri M.V. Trivikram", "Sri M.S. Badarinath", "Sri Gururaja Rao", "Smt. Vani Srinivasa",
            "Smt. Vijayalakshmi"]
EMAIL = "mkhallitrust@gmail.com"
PHONE = "+91 94480 76834"
PHONE_TEL = "+919448076834"
LOGO = "https://raw.githubusercontent.com/chiranjeevims87-dotcom/mkhalli/main/Gemini_Generated_Image_rt4xiert4xiert4x%20-%20Edited.png"
SITE = "https://www.mkhallipranadevaru.com"

PAGES = ["index.html", "about/index.html", "vyasatirtha/index.html", "gallery/index.html",
         "events/index.html", "trust/index.html", "seva-booking/index.html", "donate/index.html"]


def bi(en, kn):
    return f'<span data-lang="en">{en}</span><span data-lang="kn">{kn}</span>'


def trust_card(extra_cls="", show_reg=True, show_trustees=False):
    reg = ""
    if show_reg:
        reg = (f'<div class="trust-id-reg">'
               f'<span><ion-icon name="document-text-outline"></ion-icon>{bi("Registered public charitable trust", "ನೋಂದಾಯಿತ ಸಾರ್ವಜನಿಕ ದತ್ತಿ ಟ್ರಸ್ಟ್")}</span>'
               f'<span><ion-icon name="ribbon-outline"></ion-icon>{bi("Reg. No.", "ನೋಂದಣಿ ಸಂಖ್ಯೆ")} <b>{REG_NO}</b> ({REG_BOOK}, CD {REG_CD})</span>'
               f'<span><ion-icon name="calendar-outline"></ion-icon>{bi("Registered on", "ನೋಂದಣಿ ದಿನಾಂಕ")} <b>{REG_DATE}</b> · {bi(REG_OFFICE, "ಉಪ ನೋಂದಣಾಧಿಕಾರಿ, ಗೌರಿಬಿದನೂರು")}</span>'
               f'</div>')
    trustees = ""
    if show_trustees:
        lis = "".join(f"<li>{t}</li>" for t in TRUSTEES)
        trustees = (f'<details class="trust-id-more"><summary>{bi("Registered office and first Board of Trustees (as per the Trust Deed)", "ನೋಂದಾಯಿತ ಕಚೇರಿ ಮತ್ತು ಮೊದಲ ಟ್ರಸ್ಟಿ ಮಂಡಳಿ (ಟ್ರಸ್ಟ್ ಪತ್ರದ ಪ್ರಕಾರ)")}</summary>'
                    f'<dl><div><dt>{bi("Name in the deed", "ಪತ್ರದಲ್ಲಿರುವ ಹೆಸರು")}</dt><dd>{DEED_NAME} (‘{SHORT}’)</dd></div>'
                    f'<div><dt>{bi("Deed", "ಪತ್ರ")}</dt><dd>{bi("Deed of Charitable Trust and Settlement, executed at Gauribidanur on 5 March 2014", "ದತ್ತಿ ಟ್ರಸ್ಟ್ ಮತ್ತು ಸೆಟಲ್‌ಮೆಂಟ್ ಪತ್ರ, ಗೌರಿಬಿದನೂರಿನಲ್ಲಿ 5 ಮಾರ್ಚ್ 2014 ರಂದು")}</dd></div>'
                    f'<div><dt>{bi("Settlor", "ಸ್ಥಾಪಕರು (ಸೆಟ್ಲರ್)")}</dt><dd>{SETTLOR}</dd></div>'
                    f'<div><dt>{bi("Registered office", "ನೋಂದಾಯಿತ ಕಚೇರಿ")}</dt><dd>{REG_ADDR}</dd></div>'
                    f'<div><dt>{bi("First Board of Trustees", "ಮೊದಲ ಟ್ರಸ್ಟಿ ಮಂಡಳಿ")}</dt><dd><ol>{lis}</ol></dd></div></dl></details>')
    return f'''
<!-- TRUST-ID -->
<div class="trust-id-wrap {extra_cls}">
  <div class="trust-id" role="region" aria-label="{NAME_EN}">
    <span class="trust-id-seal"><img src="{LOGO}" alt="Seal of {NAME_EN}" width="64" height="64" loading="lazy" decoding="async"></span>
    <div>
      <span class="trust-id-kicker">{bi("Temple managed by", "ದೇವಾಲಯದ ನಿರ್ವಹಣೆ")}</span>
      <strong class="trust-id-name">{bi(NAME_EN + " (R)", NAME_KN + " (ರಿ)")}</strong>
      {reg}
      <div class="trust-id-meta">
        <span><ion-icon name="location-outline"></ion-icon>{TEMPLE_ADDR}</span>
        <span><ion-icon name="mail-outline"></ion-icon><a href="mailto:{EMAIL}">{EMAIL}</a></span>
        <span><ion-icon name="call-outline"></ion-icon><a href="tel:{PHONE_TEL}">{PHONE}</a></span>
      </div>
      <p class="trust-id-pay"><ion-icon name="shield-checkmark-outline"></ion-icon>{bi(f"All online seva bookings and donations on this website are received directly by {NAME_EN} (R) through Cashfree Payments.", f"ಈ ವೆಬ್‌ಸೈಟ್‌ನ ಎಲ್ಲಾ ಆನ್‌ಲೈನ್ ಸೇವಾ ಬುಕಿಂಗ್ ಮತ್ತು ದೇಣಿಗೆಗಳನ್ನು Cashfree Payments ಮೂಲಕ ನೇರವಾಗಿ {NAME_KN} (ರಿ) ಸ್ವೀಕರಿಸುತ್ತದೆ.")}</p>
      {trustees}
    </div>
  </div>
</div>
<!-- /TRUST-ID -->
'''


FOOTER_LEGAL = f'''<!-- FOOTER-LEGAL -->
                <p class="foot-legal"><span>{bi(f"Operated by {NAME_EN} (R) · Reg. No. {REG_NO}", f"{NAME_KN} (ರಿ) ನಿರ್ವಹಿಸುತ್ತದೆ · ನೋಂದಣಿ ಸಂಖ್ಯೆ {REG_NO}")}</span></p>
                <nav class="foot-legal-links" aria-label="Policies"><a href="/contact/">{bi("Contact Us", "ಸಂಪರ್ಕಿಸಿ")}</a><a href="/terms/">{bi("Terms &amp; Conditions", "ನಿಯಮಗಳು")}</a><a href="/privacy-policy/">{bi("Privacy Policy", "ಗೌಪ್ಯತಾ ನೀತಿ")}</a><a href="/refund-policy/">{bi("Refund &amp; Cancellation", "ಮರುಪಾವತಿ ಮತ್ತು ರದ್ದತಿ")}</a></nav>
                <!-- /FOOTER-LEGAL -->
'''

SEVA_PAY = f'''<!-- CF-SEVA -->
                        <div class="cf-online">
                            <button type="button" id="sv-pay-online" class="cf-btn" onclick="startOnlinePayment(this)">
                                <ion-icon name="lock-closed-outline"></ion-icon>{bi("Pay online securely", "ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ಸುರಕ್ಷಿತವಾಗಿ ಪಾವತಿಸಿ")}
                            </button>
                            <p class="pay-secure"><span><ion-icon name="shield-checkmark"></ion-icon>{bi("UPI · Cards · Net banking · Wallets", "UPI · ಕಾರ್ಡ್ · ನೆಟ್ ಬ್ಯಾಂಕಿಂಗ್ · ವ್ಯಾಲೆಟ್")}</span><span>{bi("Paid to", "ಪಾವತಿ")} <strong>{NAME_EN} (R)</strong></span><span>{bi("via Cashfree Payments", "Cashfree Payments ಮೂಲಕ")}</span></p>
                            <p class="cf-or"><span>{bi("or pay by UPI QR and enter the UTR", "ಅಥವಾ UPI QR ಮೂಲಕ ಪಾವತಿಸಿ UTR ನಮೂದಿಸಿ")}</span></p>
                        </div>
                        <!-- /CF-SEVA -->
'''

DONATE_FORM = f'''<!-- CF-DONATE -->
                    <form class="cf-donate" id="cf-donate" novalidate>
                        <div class="cf-donate-head">
                            <span class="pg-card-ic"><ion-icon name="heart-outline"></ion-icon></span>
                            <div>
                                <h2>{bi("Donate online", "ಆನ್‌ಲೈನ್ ದೇಣಿಗೆ")}</h2>
                                <p>{bi(f"Received directly by {NAME_EN} (R). A receipt is emailed to you.", f"ನೇರವಾಗಿ {NAME_KN} (ರಿ) ಸ್ವೀಕರಿಸುತ್ತದೆ. ರಶೀದಿಯನ್ನು ಇಮೇಲ್ ಮಾಡಲಾಗುತ್ತದೆ.")}</p>
                            </div>
                        </div>
                        <fieldset class="cf-amounts"><legend>{bi("Amount (₹)", "ಮೊತ್ತ (₹)")}</legend>
                            <button type="button" data-amt="501">₹501</button><button type="button" data-amt="1001" class="is-on">₹1,001</button><button type="button" data-amt="2501">₹2,501</button><button type="button" data-amt="5001">₹5,001</button><button type="button" data-amt="10001">₹10,001</button>
                            <input type="number" id="cf-amount" name="amount" min="1" max="500000" step="1" inputmode="numeric" value="1001" aria-label="Amount in rupees">
                        </fieldset>
                        <div class="cf-grid">
                            <label>{bi("Purpose", "ಉದ್ದೇಶ")}<select id="cf-purpose" name="purpose">
                                <option value="General donation">General donation / ಸಾಮಾನ್ಯ ದೇಣಿಗೆ</option>
                                <option value="Annadana">Annadana / ಅನ್ನದಾನ</option>
                                <option value="Temple development">Temple development / ದೇವಾಲಯ ಅಭಿವೃದ್ಧಿ</option>
                                <option value="Medical camps">Medical camps / ವೈದ್ಯಕೀಯ ಶಿಬಿರ</option>
                                <option value="Education support">Education support / ಶಿಕ್ಷಣ ನೆರವು</option>
                            </select></label>
                            <label>{bi("Full name", "ಪೂರ್ಣ ಹೆಸರು")}<input id="cf-name" name="name" autocomplete="name" maxlength="80" required></label>
                            <label>{bi("Mobile (10 digits)", "ಮೊಬೈಲ್ (10 ಅಂಕಿ)")}<input id="cf-phone" name="phone" inputmode="numeric" autocomplete="tel-national" maxlength="10" required></label>
                            <label>{bi("Email (for receipt)", "ಇಮೇಲ್ (ರಶೀದಿಗೆ)")}<input id="cf-email" name="email" type="email" autocomplete="email" maxlength="100" required></label>
                            <label class="cf-wide">{bi("Address (optional)", "ವಿಳಾಸ (ಐಚ್ಛಿಕ)")}<input id="cf-address" name="address" autocomplete="street-address" maxlength="200"></label>
                        </div>
                        <p class="cf-err" id="cf-err" role="alert"></p>
                        <button type="submit" class="cf-btn" id="cf-donate-btn"><ion-icon name="lock-closed-outline"></ion-icon><span data-lang="en">Donate ₹<b class="cf-amt-label">1,001</b> securely</span><span data-lang="kn">₹<b class="cf-amt-label">1,001</b> ಸುರಕ್ಷಿತವಾಗಿ ದೇಣಿಗೆ ನೀಡಿ</span></button>
                        <p class="pay-secure"><span><ion-icon name="shield-checkmark"></ion-icon>{bi("UPI · Cards · Net banking · Wallets via Cashfree Payments", "Cashfree Payments ಮೂಲಕ UPI · ಕಾರ್ಡ್ · ನೆಟ್ ಬ್ಯಾಂಕಿಂಗ್")}</span><span><a href="/refund-policy/">{bi("Refund policy", "ಮರುಪಾವತಿ ನೀತಿ")}</a></span></p>
                    </form>
                    <!-- /CF-DONATE -->
'''

SEVA_JS = r'''
        // ============ ONLINE PAYMENT (Cashfree) ============
        // The server works out the price from the seva names, so nobody can change the amount in the browser.
        async function startOnlinePayment(btn) {
            if (!currentBookingData || !window.mkPay) return;
            const d = currentBookingData;
            try {
                await window.mkPay({
                    purpose: 'seva',
                    sevas: cart.map((i) => i.id),
                    customer: { name: d.fullName, phone: d.phone, email: d.email },
                    details: {
                        persons: d.persons, familyMembers: d.familyMembers,
                        specialRequest: d.specialRequest, sevaDate: ADMIN_CONFIG.sevaDate
                    }
                }, btn);
            } catch (err) {
                svToast(err.message || svT('Could not start the payment. Please try again.', 'ಪಾವತಿ ಆರಂಭಿಸಲು ಆಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.'), 'error');
            }
        }
'''


def legal_page(slug, title, kicker_en, kicker_kn, h1_en, h1_kn, desc, body_html):
    shell = (PUB / "trust/index.html").read_text(encoding="utf-8")
    url = f"{SITE}/{slug}/"
    full_title = f"{title} | {NAME_EN}"
    shell = re.sub(r"<title>.*?</title>", f"<title>{full_title}</title>", shell, count=1, flags=re.S)
    shell = re.sub(r'(<meta name="description" content=")[^"]*', rf"\g<1>{desc}", shell, count=1)
    shell = re.sub(r'(<meta (?:property|name)="(?:og|twitter):title" content=")[^"]*', rf"\g<1>{full_title}", shell)
    shell = re.sub(r'(<meta (?:property|name)="(?:og|twitter):description" content=")[^"]*', rf"\g<1>{desc}", shell)
    shell = shell.replace(f"{SITE}/trust/", url)
    shell = re.sub(r'\s*<script type="application/ld\+json">.*?</script>', "", shell, flags=re.S)
    sec_start = shell.index('<section id="page-trust"')
    sec_end = shell.index("</main>")
    section = f'''<section id="page-{slug}" class="page-section pg-page">
            <header class="pg-hero pg-hero--legal">
                <div class="pg-hero-shade"></div>
                <div class="pg-hero-rays" aria-hidden="true"></div>
                <div class="pg-hero-inner">
                    <nav class="pg-crumbs" aria-label="Breadcrumb">
                        <a href="/" data-page="page-home" class="page-nav-link"><ion-icon name="home-outline"></ion-icon>{bi("Home", "ಮುಖಪುಟ")}</a>
                        <ion-icon name="chevron-forward" class="pg-crumb-sep"></ion-icon>
                        <span aria-current="page">{bi(h1_en, h1_kn)}</span>
                    </nav>
                    <span class="pg-kicker">{bi(kicker_en, kicker_kn)}</span>
                    <h1 class="pg-title">{bi(h1_en, h1_kn)}</h1>
                    <div class="pg-orn" aria-hidden="true"><i></i><b></b><i></i></div>
                </div>
            </header>
            {trust_card("trust-id-wrap--legal", show_reg=True)}
            <section class="legal-body">
{body_html}
                <p class="legal-updated">Last updated: 10 November 2026</p>
            </section>
        </section>
    '''
    shell = shell[:sec_start] + section + shell[sec_end:]
    # legal pages need no trust-page carousel/booking scripts beyond the common ones
    dest = PUB / slug / "index.html"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(shell, encoding="utf-8")
    return dest


def patch_common(s):
    # 1. one correct legal name everywhere (header, footer, meta, schema, receipt)
    s = s.replace("Sri Mavinakayinahalli Mukhyaprana Seva Trust", NAME_EN)
    s = s.replace("Sri Mavinakayinahalli<br>Mukhyaprana Seva Trust", "Mavinakayinahalli Sri<br>Mukhyaprana Seva Trust")
    s = s.replace("ಶ್ರೀ ಮಾವಿನಕಾಯಿನಹಳ್ಳಿ ಮುಖ್ಯಪ್ರಾಣ ಸೇವಾ ಟ್ರಸ್ಟ್", NAME_KN)
    s = s.replace("Mukhyaprana Seva Trust(R)", "Mukhyaprana Seva Trust (R)")
    s = s.replace('<span class="hd-b-short">MSMST</span>', f'<span class="hd-b-short">{SHORT}</span>')
    s = s.replace('"alternateName": ["MSMST"', f'"alternateName": ["{SHORT}", "{DEED_NAME}"')
    s = s.replace(' · MSMST</span>', f' · {SHORT}</span>')
    s = s.replace("| Mukhyaprana Seva Trust</title>", f"| {NAME_EN}</title>")
    # schema.org: registration + legal name for the trust
    if '"legalName"' not in s:
        s = s.replace(f'"@id": "{SITE}/#trust",', f'"@id": "{SITE}/#trust",\n          "legalName": "{DEED_NAME}",\n          "foundingDate": "2014-03-05",\n          "identifier": "{REG_NO}",', 1)
    # 2. CSS/JS: cache-busting + 3D polish + payments
    s = re.sub(r'/assets/css/site\.css(\?v=\d+)?', f'/assets/css/site.css?v={V}', s)
    s = re.sub(r'/assets/js/(core|pages|seva|home|vt|depth|payments)\.js(\?v=\d+)?', rf'/assets/js/\1.js?v={V}', s)
    if "/assets/css/enhance.css" not in s:
        s = s.replace(f'<link rel="stylesheet" href="/assets/css/site.css?v={V}">',
                      f'<link rel="stylesheet" href="/assets/css/site.css?v={V}">\n    <link rel="stylesheet" href="/assets/css/enhance.css?v={V}">', 1)
    s = re.sub(r'/assets/css/enhance\.css(\?v=\d+)?', f'/assets/css/enhance.css?v={V}', s)
    if "/assets/js/depth.js" not in s:
        s = s.replace(f'<script src="/assets/js/pages.js?v={V}"></script>\n',
                      f'<script src="/assets/js/pages.js?v={V}"></script>\n    <script src="/assets/js/depth.js?v={V}"></script>\n', 1)
    # 3. footer: operator line + policy links
    if "<!-- FOOTER-LEGAL -->" not in s:
        anchor = '<p class="mt-1" data-lang-key="footer_maintained_by">'
        s = s.replace(anchor, FOOTER_LEGAL + "                " + anchor, 1)
    return s


def add_payments_js(s):
    if "/assets/js/payments.js" not in s:
        s = s.replace(f'<script src="/assets/js/depth.js?v={V}"></script>\n',
                      f'<script src="/assets/js/depth.js?v={V}"></script>\n    <script src="/assets/js/payments.js?v={V}"></script>\n', 1)
    return s


def insert_after_hero(s, sec_id, card):
    if "<!-- TRUST-ID -->" in s:
        return s
    i = s.index(f'<section id="{sec_id}"')
    j = s.index("</header>", s.index('class="pg-hero', i)) + len("</header>")
    return s[:j] + card + s[j:]


def main():
    for rel in PAGES:
        p = PUB / rel
        s = patch_common(p.read_text(encoding="utf-8"))
        if rel == "index.html" and "<!-- TRUST-ID -->" not in s:
            i = s.index('<section id="fx-welcome"')
            s = s[:i] + trust_card("trust-id-wrap--home") + "\n            " + s[i:]
        if rel == "about/index.html":
            s = insert_after_hero(s, "page-about", trust_card())
        if rel == "trust/index.html":
            s = insert_after_hero(s, "page-trust", trust_card(show_trustees=True))
        if rel == "seva-booking/index.html":
            s = add_payments_js(s)
            if "<!-- CF-SEVA -->" not in s:
                a = '<div class="sv-pay-body">'
                s = s.replace(a, SEVA_PAY + "                    " + a, 1)
        if rel == "donate/index.html":
            s = add_payments_js(s)
            if "<!-- CF-DONATE -->" not in s:
                a = '<div class="pg-don-grid">'
                s = s.replace(a, DONATE_FORM + "                    " + a, 1)
        p.write_text(s, encoding="utf-8")
        print("patched", rel)

    # seva.js: online payment hook + correct name on the receipt
    sj = PUB / "assets/js/seva.js"          # old booking script; removed by build_booking.py
    if sj.exists():
        t = sj.read_text(encoding="utf-8").replace("Sri Mavinakayinahalli Mukhyaprana Seva Trust", NAME_EN)
        if "startOnlinePayment" not in t:
            t = t.replace("        // Cancel payment\n", SEVA_JS + "\n        // Cancel payment\n", 1)
        sj.write_text(t, encoding="utf-8")

    # core.js: pages that are not in the old page list (policies, payment status) still count as "inner pages"
    cj = PUB / "assets/js/core.js"
    c = cj.read_text(encoding="utf-8")
    old = "const first = pageFromPath(location.pathname) || 'page-home';"
    new = "const first = pageFromPath(location.pathname) || (document.querySelector('.page-section') || {}).id || 'page-home';"
    c = c.replace(old, new)
    old = "if (!pageId || !document.getElementById(pageId)) return;"
    new = ("if (!pageId || !document.getElementById(pageId)) return;\n"
           "                activePage = pageId;")
    if "activePage = pageId;\n                if (!isInitialLoad" not in c:
        c = c.replace(old, new, 1)
    cj.write_text(c, encoding="utf-8")

    # remove the two old tilt scripts (depth.js replaces both)
    hj = PUB / "assets/js/home.js"
    h = hj.read_text(encoding="utf-8")
    h = h.replace("if (!reduceMotion) $$('[data-tilt]').forEach(initTilt);", "/* tilt: handled by depth.js */")
    hj.write_text(h, encoding="utf-8")
    pj = PUB / "assets/js/pages.js"
    pp = pj.read_text(encoding="utf-8")
    pp = pp.replace("if (fine && !reduce) $$('.pg-page [data-tilt]').forEach((el) => {",
                    "/* tilt: handled by depth.js */ if (false) $$('.pg-page [data-tilt]').forEach((el) => {")
    pj.write_text(pp, encoding="utf-8")

    make_legal_pages()
    make_sitemap()


def make_legal_pages():
    addr_block = f'''
                <div class="legal-card">
                    <h2>{NAME_EN} (R)</h2>
                    <p>Registered as <strong>{DEED_NAME}</strong>, a public charitable trust. Deed of Charitable Trust and Settlement registered at the office of the {REG_OFFICE}, {REG_BOOK}, Document No. <strong>{REG_NO}</strong> (CD No. {REG_CD}), on {REG_DATE}.</p>
                </div>'''
    legal_page("contact", "Contact Us", "We are here to help", "ನಿಮ್ಮ ಸೇವೆಗೆ", "Contact Us", "ಸಂಪರ್ಕಿಸಿ",
               f"Contact {NAME_EN}: phone, email, temple address and registered office.", f'''{addr_block}
                <div class="legal-cols">
                    <div class="legal-card"><h3><ion-icon name="call-outline"></ion-icon> Phone / WhatsApp</h3>
                        <p><a href="tel:+919448076834">+91 94480 76834</a> (Badrinath M S)<br><a href="tel:+919886212590">+91 98862 12590</a> (Krishnamurthy M R)</p></div>
                    <div class="legal-card"><h3><ion-icon name="mail-outline"></ion-icon> Email</h3>
                        <p><a href="mailto:{EMAIL}">{EMAIL}</a><br>We reply within 2 working days.</p></div>
                    <div class="legal-card"><h3><ion-icon name="location-outline"></ion-icon> Temple</h3>
                        <p>{TEMPLE_ADDR}<br><a href="https://www.google.com/maps/search/?api=1&amp;query=Mavinakayinahalli+Anjaneya+Swamy+Temple" target="_blank" rel="noopener">Open in Google Maps</a></p></div>
                    <div class="legal-card"><h3><ion-icon name="business-outline"></ion-icon> Registered office</h3>
                        <p>{REG_ADDR}</p></div>
                </div>
                <p>For questions about a payment, please keep your <strong>Order ID</strong> (starts with <code>MSMPST</code>) ready. It is shown on the payment page and in your receipt email.</p>''')

    legal_page("terms", "Terms and Conditions", "Using this website", "ಈ ವೆಬ್‌ಸೈಟ್ ಬಳಕೆ", "Terms &amp; Conditions", "ನಿಯಮಗಳು ಮತ್ತು ಷರತ್ತುಗಳು",
               f"Terms for seva bookings and donations made on the website of {NAME_EN}.", f'''{addr_block}
                <h2>1. About this website</h2>
                <p>This website (<a href="{SITE}/">{SITE.replace("https://", "")}</a>) is owned and operated by {NAME_EN} (R) (“the Trust”, “we”). By using it, booking a seva or making a donation you agree to these terms.</p>
                <h2>2. Sevas</h2>
                <ul>
                    <li>Sevas are religious services performed by the temple priests at the Sri Pranadevaru temple, Mavinakayinahalli, on the seva date shown at the time of booking.</li>
                    <li>The price of each seva is shown in Indian Rupees (₹) before you pay. The amount charged is the total shown on the payment page.</li>
                    <li>Sevas are performed in the names (and gotra/nakshatra) you provide. Please check these details before paying.</li>
                    <li>If a seva cannot be performed on the chosen date for reasons within the Trust’s control, we will offer another date or a refund under our <a href="/refund-policy/">Refund &amp; Cancellation Policy</a>.</li>
                </ul>
                <h2>3. Delivery of service</h2>
                <p>Sevas are services performed at the temple. Nothing is shipped. A booking confirmation and receipt is shown on screen after payment and sent to the email address you give. Prasada, where offered, is given at the temple to devotees who attend.</p>
                <h2>4. Donations</h2>
                <p>Donations are voluntary contributions to the Trust and are used for its charitable objects as set out in the Trust Deed: temple seva and upkeep, education, medical care, rural development and other objects of general public utility.</p>
                <h2>5. Payments</h2>
                <p>Online payments are processed by Cashfree Payments India Pvt. Ltd., an RBI-authorised payment aggregator. The Trust does not see or store your card, UPI PIN or net-banking details. Donations sent by direct bank transfer (NEFT / IMPS / RTGS) are confirmed from the Trust’s bank statement.</p>
                <h2>6. Your responsibilities</h2>
                <p>Please give correct contact details and do not use the website for any unlawful purpose or to make payments you are not authorised to make.</p>
                <h2>7. Content</h2>
                <p>Text and photographs on this website belong to the Trust or are used with permission, and may not be reused commercially without written consent.</p>
                <h2>8. Liability</h2>
                <p>The Trust is not liable for delays or failures caused by events beyond its reasonable control, including bank or payment network outages. Our total liability for any booking is limited to the amount paid for it.</p>
                <h2>9. Governing law</h2>
                <p>These terms are governed by the laws of India. Courts at Chikkaballapur, Karnataka have jurisdiction.</p>
                <h2>10. Contact</h2>
                <p>Email <a href="mailto:{EMAIL}">{EMAIL}</a> or call <a href="tel:{PHONE_TEL}">{PHONE}</a>. See <a href="/contact/">Contact Us</a>.</p>''')

    legal_page("privacy-policy", "Privacy Policy", "Your information", "ನಿಮ್ಮ ಮಾಹಿತಿ", "Privacy Policy", "ಗೌಪ್ಯತಾ ನೀತಿ",
               f"How {NAME_EN} collects, uses and protects information given for seva bookings and donations.", f'''{addr_block}
                <h2>What we collect</h2>
                <ul>
                    <li>When you book a seva: name, mobile number, email, number of persons, family member names, gotra and nakshatra, and any special request.</li>
                    <li>When you donate: name, mobile number, email, purpose and (optionally) address.</li>
                    <li>Payment records: order ID, amount, status, payment method type and the reference returned by the payment gateway. We never receive your card number, CVV, UPI PIN or net-banking password; these go only to Cashfree Payments.</li>
                </ul>
                <h2>Why we use it</h2>
                <p>To perform the seva in the right names, to issue and email receipts, to contact you about your booking, to keep accounts as required by law, and to answer your questions.</p>
                <h2>Who we share it with</h2>
                <p>Only with Cashfree Payments (to process the payment), with Google (our hosting, database and email services) and with authorities when the law requires it. We do not sell or rent your information.</p>
                <h2>How long we keep it</h2>
                <p>Booking and donation records are kept for as long as needed for accounting and legal requirements (normally 8 years), then deleted.</p>
                <h2>Your choices</h2>
                <p>You may ask us to see, correct or delete your information (subject to legal record-keeping) by writing to <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
                <h2>Cookies and storage</h2>
                <p>The website remembers your language choice (English / Kannada) in your browser. It does not use advertising cookies.</p>''')

    legal_page("refund-policy", "Refund and Cancellation Policy", "Payments", "ಪಾವತಿಗಳು", "Refund &amp; Cancellation Policy", "ಮರುಪಾವತಿ ಮತ್ತು ರದ್ದತಿ ನೀತಿ",
               f"Refund and cancellation policy for seva bookings and donations made to {NAME_EN}.", f'''{addr_block}
                <h2>Seva bookings</h2>
                <ul>
                    <li><strong>Cancellation by you:</strong> email <a href="mailto:{EMAIL}">{EMAIL}</a> or call <a href="tel:{PHONE_TEL}">{PHONE}</a> with your Order ID at least <strong>3 days before</strong> the seva date for a full refund. Later cancellations cannot be refunded, because preparations for the seva will have begun, but we can move the seva to another date once.</li>
                    <li><strong>Cancellation by the Trust:</strong> if a seva cannot be performed on the booked date, you may choose another date or a full refund.</li>
                </ul>
                <h2>Donations</h2>
                <p>Donations are not refundable once received, except when a payment was made <strong>by mistake, twice, or for a wrong amount</strong>. Write to us within <strong>7 days</strong> with the Order ID and we will refund the extra amount.</p>
                <h2>Failed or pending payments</h2>
                <p>If money is deducted but the payment page shows failed or pending, it is usually reversed automatically by your bank within 5–7 working days. If it is not, contact us with the Order ID.</p>
                <h2>How refunds are paid</h2>
                <p>Approved refunds go back to the original payment method through Cashfree Payments within <strong>5–7 working days</strong> of approval. We do not pay refunds in cash.</p>''')

    legal_page("payment-status", "Payment Status", "Thank you", "ಧನ್ಯವಾದಗಳು", "Payment Status", "ಪಾವತಿ ಸ್ಥಿತಿ",
               "Status and receipt for your online payment.", '''
                <div id="ps" class="ps" aria-live="polite">
                    <div class="ps-wait"><span class="sv-spin" aria-hidden="true"></span><p>Checking your payment…</p></div>
                </div>''')
    # payment-status: noindex + payments script
    ps = PUB / "payment-status/index.html"
    t = ps.read_text(encoding="utf-8")
    t = re.sub(r'<meta name="robots" content="[^"]*">', '<meta name="robots" content="noindex">', t)
    if 'name="robots"' not in t:
        t = t.replace("<title>", '<meta name="robots" content="noindex">\n    <title>', 1)
    t = add_payments_js(t)
    ps.write_text(t, encoding="utf-8")


def make_sitemap():
    sm = PUB / "sitemap.xml"
    t = sm.read_text(encoding="utf-8")
    for slug in ["contact", "terms", "privacy-policy", "refund-policy"]:
        loc = f"{SITE}/{slug}/"
        if loc not in t:
            t = t.replace("</urlset>", f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>2026-11-10</lastmod>\n  </url>\n</urlset>")
    sm.write_text(t, encoding="utf-8")


if __name__ == "__main__":
    main()
