"""Build the new Firebase seva booking portal page (public/seva-booking/index.html)
and remove the old UPI-QR / UTR / Google-Sheet booking flow.

Run after patch_site.py:  python tools/build_booking.py   (safe to run again)
"""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUB = ROOT / "public"
V = "4"

NAK = ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha",
       "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula",
       "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"]
RASHI = ["Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya", "Tula", "Vrishchika", "Dhanu", "Makara", "Kumbha", "Meena"]


def bi(en, kn):
    return f'<span data-lang="en">{en}</span><span data-lang="kn">{kn}</span>'


SECTION = f'''<section id="page-sevas" class="page-section pg-page">
            <header class="pg-hero pg-hero--seva">
                <div class="pg-hero-bg" style="background-image:url('https://raw.githubusercontent.com/chiranjeevims87-dotcom/mkhalli/main/IMG_20220421_104402.jpg')"></div>
                <div class="pg-hero-shade"></div>
                <div class="pg-hero-rays" aria-hidden="true"></div>
                <div class="pg-hero-inner">
                    <nav class="pg-crumbs" aria-label="Breadcrumb">
                        <a href="/" data-page="page-home" class="page-nav-link"><ion-icon name="home-outline"></ion-icon>{bi("Home", "ಮುಖಪುಟ")}</a>
                        <ion-icon name="chevron-forward" class="pg-crumb-sep"></ion-icon>
                        <span aria-current="page">{bi("Seva Booking", "ಸೇವಾ ಬುಕಿಂಗ್")}</span>
                    </nav>
                    <span class="pg-kicker">{bi("Sri Pranadevaru, Mavinakayinahalli", "ಶ್ರೀ ಪ್ರಾಣದೇವರು, ಮಾವಿನಕಾಯಿನಹಳ್ಳಿ")}</span>
                    <h1 class="pg-title">{bi("Book a Seva", "ಸೇವೆ ಬುಕ್ ಮಾಡಿ")}</h1>
                    <p class="pg-sub">{bi("Choose the date and sevas, give the names for the sankalpa, and pay securely online. Your receipt arrives by email.", "ದಿನಾಂಕ ಮತ್ತು ಸೇವೆಗಳನ್ನು ಆರಿಸಿ, ಸಂಕಲ್ಪದ ಹೆಸರುಗಳನ್ನು ನೀಡಿ, ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ಸುರಕ್ಷಿತವಾಗಿ ಪಾವತಿಸಿ. ರಶೀದಿ ಇಮೇಲ್‌ಗೆ ಬರುತ್ತದೆ.")}</p>
                    <div class="pg-orn" aria-hidden="true"><i></i><b></b><i></i></div>
                </div>
            </header>

            <div class="bk" id="bk">
                <ol class="bk-steps" id="bk-steps">
                    <li class="is-on"><button type="button" class="bk-step-btn" data-go="bk-s1"><b>1</b>{bi("Date &amp; sevas", "ದಿನಾಂಕ ಮತ್ತು ಸೇವೆ")}</button></li>
                    <li><button type="button" class="bk-step-btn" data-go="bk-s2"><b>2</b>{bi("Sankalpa &amp; contact", "ಸಂಕಲ್ಪ ಮತ್ತು ಸಂಪರ್ಕ")}</button></li>
                    <li><button type="button" class="bk-step-btn" data-go="bk-sum"><b>3</b>{bi("Pay", "ಪಾವತಿ")}</button></li>
                </ol>
                <p class="bk-note" id="bk-note" hidden></p>
                <div class="bk-status" id="bk-status" aria-live="polite"><span class="sv-spin" aria-hidden="true"></span></div>

                <div class="bk-grid">
                    <div class="bk-main">
                        <section class="bk-card" id="bk-s1" aria-labelledby="bk-h1">
                            <h2 id="bk-h1"><span class="bk-num">1</span>{bi("Choose the seva date", "ಸೇವಾ ದಿನಾಂಕ ಆರಿಸಿ")}</h2>
                            <div class="bk-dates" id="bk-dates" role="radiogroup" aria-label="Seva date"></div>
                            <p class="bk-err" id="bk-err-date" role="alert"></p>
                            <h3>{bi("Choose sevas", "ಸೇವೆಗಳನ್ನು ಆರಿಸಿ")} <small>{bi("tap to add · you can choose more than one", "ಸೇರಿಸಲು ಒತ್ತಿ · ಒಂದಕ್ಕಿಂತ ಹೆಚ್ಚು ಆರಿಸಬಹುದು")}</small></h3>
                            <div class="bk-sevas" id="bk-sevas" role="group" aria-label="Sevas"></div>
                            <p class="bk-err" id="bk-err-sevas" role="alert"></p>
                        </section>

                        <section class="bk-card" id="bk-s2" aria-labelledby="bk-h2">
                            <h2 id="bk-h2"><span class="bk-num">2</span>{bi("Names for the sankalpa", "ಸಂಕಲ್ಪಕ್ಕೆ ಹೆಸರುಗಳು")}</h2>
                            <p class="bk-help">{bi("The priest will perform the seva in these names. Gotra, nakshatra and rashi are optional.", "ಅರ್ಚಕರು ಈ ಹೆಸರುಗಳಲ್ಲಿ ಸೇವೆ ಮಾಡುತ್ತಾರೆ. ಗೋತ್ರ, ನಕ್ಷತ್ರ, ರಾಶಿ ಐಚ್ಛಿಕ.")}</p>
                            <div class="bk-names" id="bk-names"></div>
                            <p class="bk-err" id="bk-err-names" role="alert"></p>
                            <button type="button" class="bk-add" id="bk-add"><ion-icon name="person-add-outline"></ion-icon>{bi("Add another family member", "ಇನ್ನೊಬ್ಬ ಕುಟುಂಬ ಸದಸ್ಯರನ್ನು ಸೇರಿಸಿ")}</button>

                            <h3>{bi("Your contact details", "ನಿಮ್ಮ ಸಂಪರ್ಕ ವಿವರಗಳು")}</h3>
                            <div class="bk-fields">
                                <label>{bi("Mobile number *", "ಮೊಬೈಲ್ ಸಂಖ್ಯೆ *")}<input id="bk-phone" inputmode="numeric" autocomplete="tel-national" maxlength="10" placeholder="98XXXXXXXX"><span class="bk-err" id="bk-err-phone" role="alert"></span></label>
                                <label>{bi("Email (receipt is sent here) *", "ಇಮೇಲ್ (ರಶೀದಿ ಇಲ್ಲಿಗೆ) *")}<input id="bk-email" type="email" autocomplete="email" maxlength="100" placeholder="you@example.com"><span class="bk-err" id="bk-err-email" role="alert"></span></label>
                                <label>{bi("Town / city", "ಊರು")}<input id="bk-place" autocomplete="address-level2" maxlength="80"></label>
                                <label>{bi("People attending", "ಭಾಗವಹಿಸುವವರು")}<span class="bk-stepper"><button type="button" data-step="-1" aria-label="Fewer">−</button><input id="bk-persons" type="number" min="1" max="50" value="1" inputmode="numeric"><button type="button" data-step="1" aria-label="More">+</button></span></label>
                                <label class="bk-wide">{bi("Special request (optional)", "ವಿಶೇಷ ವಿನಂತಿ (ಐಚ್ಛಿಕ)")}<textarea id="bk-note-in" rows="2" maxlength="300"></textarea></label>
                            </div>
                        </section>
                    </div>

                    <aside class="bk-summary" id="bk-sum" aria-labelledby="bk-h3">
                        <div class="bk-sum-card">
                            <h2 id="bk-h3"><span class="bk-num">3</span>{bi("Your booking", "ನಿಮ್ಮ ಬುಕಿಂಗ್")} <span class="bk-count" id="bk-count">0</span></h2>
                            <p class="bk-sum-date"><ion-icon name="calendar-outline"></ion-icon><span id="bk-sum-date"></span></p>
                            <ul class="bk-sum-list" id="bk-sum-list"></ul>
                            <p class="bk-sum-total">{bi("Total", "ಒಟ್ಟು")} <b>₹<span class="bk-total">0</span></b></p>
                            <button type="button" class="cf-btn" id="bk-pay"><ion-icon name="lock-closed-outline"></ion-icon><span data-lang="en">Pay ₹<b class="bk-total">0</b> securely</span><span data-lang="kn">₹<b class="bk-total">0</b> ಸುರಕ್ಷಿತವಾಗಿ ಪಾವತಿಸಿ</span></button>
                            <p class="bk-err" id="bk-err-pay" role="alert"></p>
                            <p class="pay-secure"><span><ion-icon name="shield-checkmark"></ion-icon>{bi("UPI · Cards · Net banking · Wallets", "UPI · ಕಾರ್ಡ್ · ನೆಟ್ ಬ್ಯಾಂಕಿಂಗ್ · ವ್ಯಾಲೆಟ್")}</span><span>{bi("Paid to", "ಪಾವತಿ")} <strong>Mavinakayinahalli Sri Mukhyaprana Seva Trust (R)</strong> {bi("via Cashfree Payments", "Cashfree Payments ಮೂಲಕ")}</span></p>
                            <p class="bk-policy"><a href="/refund-policy/">{bi("Cancellation &amp; refund policy", "ರದ್ದತಿ ಮತ್ತು ಮರುಪಾವತಿ ನೀತಿ")}</a> · <a href="/terms/">{bi("Terms", "ನಿಯಮಗಳು")}</a></p>
                        </div>
                    </aside>
                </div>

                <div class="bk-bar" id="bk-bar" aria-hidden="true">
                    <span>{bi("Total", "ಒಟ್ಟು")} <b>₹<span class="bk-total">0</span></b></span>
                    <button type="button" class="cf-btn" id="bk-bar-pay"><ion-icon name="lock-closed-outline"></ion-icon>{bi("Pay now", "ಈಗ ಪಾವತಿಸಿ")}</button>
                </div>
                <datalist id="bk-nakshatras">{"".join(f'<option value="{n}">' for n in NAK)}</datalist>
                <datalist id="bk-rashis">{"".join(f'<option value="{r}">' for r in RASHI)}</datalist>
            </div>
        </section>
    '''


def main():
    # ---- seva booking page
    p = PUB / "seva-booking/index.html"
    s = p.read_text(encoding="utf-8")
    a = s.index('<section id="page-sevas"')
    b = s.index("</main>")
    s = s[:a] + SECTION + s[b:]
    s = re.sub(r'\s*<script src="/assets/js/seva\.js[^"]*"></script>', "", s)
    if "/assets/js/booking.js" not in s:
        s = re.sub(r'(<script src="/assets/js/payments\.js[^"]*"></script>)', rf'\1\n    <script src="/assets/js/booking.js?v={V}"></script>', s)
    s = re.sub(r'/assets/(css|js)/([a-z]+)\.(css|js)\?v=\d+', rf'/assets/\1/\2.\3?v={V}', s)
    s = s.replace('content="Book a Seva Online | ', 'content="Book a Seva Online | ')
    p.write_text(s, encoding="utf-8")
    print("built seva-booking")

    # ---- donate page: drop the UPI QR card (online donation + bank transfer remain)
    p = PUB / "donate/index.html"
    s = p.read_text(encoding="utf-8")
    s = re.sub(r'\s*<div class="pg-don-or" aria-hidden="true">.*?</div>\s*(?=<div class="pg-card pg-don-qr)', "\n", s, flags=re.S)
    i = s.find('<div class="pg-card pg-don-qr')
    if i != -1:
        # remove the card: walk balanced <div> tags
        depth, j = 0, i
        for m in re.finditer(r"<div\b|</div>", s[i:]):
            depth += 1 if m.group(0) == "<div" else -1
            if depth == 0:
                j = i + m.end()
                break
        s = s[:i] + s[j:]
    s = re.sub(r'/assets/(css|js)/([a-z]+)\.(css|js)\?v=\d+', rf'/assets/\1/\2.\3?v={V}', s)
    p.write_text(s, encoding="utf-8")
    print("donate: QR card removed" if 'pg-don-qr' not in s else "donate: QR card still present!")

    # ---- every page: new asset version so browsers fetch the new files
    for f in PUB.rglob("index.html"):
        t = f.read_text(encoding="utf-8")
        t2 = re.sub(r'/assets/(css|js)/([a-z]+)\.(css|js)\?v=\d+', rf'/assets/\1/\2.\3?v={V}', t)
        if t2 != t:
            f.write_text(t2, encoding="utf-8")

    # the old Google-Sheet / UPI booking script is no longer used anywhere
    old = PUB / "assets/js/seva.js"
    if old.exists():
        old.unlink()
        print("removed assets/js/seva.js")


if __name__ == "__main__":
    main()
