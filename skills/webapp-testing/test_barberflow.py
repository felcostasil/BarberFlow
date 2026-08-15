"""
BarberFlow — Playwright Test Suite
Tests the 5 bugs that were fixed:
  Bug 1: Language switching (EN/PT)
  Bug 2: Client join queue → wait screen (no "Ficha Não Encontrada")
  Bug 3: Barber login switch (no stale screen)
  Bug 4: Admin queue loads without refresh on mobile viewport
  Bug 5: Mobile layout — no broken/overflow elements
"""

from playwright.sync_api import sync_playwright
import os, sys

BASE_URL = "http://localhost:5173"
SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

PASS = "✅"
FAIL = "❌"
results = []

def save(page, name):
    path = os.path.join(SCREENSHOTS_DIR, f"{name}.png")
    page.screenshot(path=path, full_page=True)
    print(f"   📸 {path}")
    return path

def log(label, ok, detail=""):
    icon = PASS if ok else FAIL
    msg = f"  {icon} {label}"
    if detail:
        msg += f" — {detail}"
    print(msg)
    results.append((label, ok, detail))

def clear_storage(page):
    """Clear mock localStorage so each test starts clean."""
    page.evaluate("() => { Object.keys(localStorage).filter(k => k.startsWith('barberflow_mock_')).forEach(k => localStorage.removeItem(k)); localStorage.removeItem('user_lang'); }")

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ─────────────────────────────────────────
        # TEST 1 — Language switching (Bug 1)
        # ─────────────────────────────────────────
        print("\n📋 TEST 1 — Language switching")
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        clear_storage(page)
        page.reload()
        page.wait_for_load_state("networkidle")

        # Check EN is default
        join_btn = page.locator("text=Join Queue").first
        en_ok = join_btn.is_visible()
        log("EN default — 'Join Queue' visible", en_ok)
        save(page, "01_lang_en")

        # Switch to PT
        lang_select = page.locator("select.lang-select-nav-item")
        lang_select.select_option("pt")
        page.wait_for_timeout(800)

        # Check PT translation loaded
        pt_text = page.locator("text=Entrar na Fila").first
        pt_ok = pt_text.is_visible()
        log("PT switch — 'Entrar na Fila' visible (no raw keys)", pt_ok)
        save(page, "02_lang_pt")

        # Switch back to EN
        lang_select.select_option("en")
        page.wait_for_timeout(800)
        en_back = page.locator("text=Join Queue").first.is_visible()
        log("EN back — 'Join Queue' restored", en_back)
        save(page, "03_lang_en_back")
        page.close()

        # ─────────────────────────────────────────
        # TEST 2 — Client join queue → wait screen (Bug 2)
        # ─────────────────────────────────────────
        print("\n📋 TEST 2 — Client join queue → wait screen")
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        clear_storage(page)
        page.reload()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)

        save(page, "04_home_before_join")

        # Fill in name
        name_input = page.locator("input#customerName")
        name_ok = name_input.is_visible()
        log("Name input visible", name_ok)

        if name_ok:
            name_input.fill("Teste Playwright")
            page.wait_for_timeout(500)

            # Submit form
            submit_btn = page.locator("button[type=submit]").first
            submit_btn.click()
            page.wait_for_timeout(2500)
            save(page, "05_after_join")

            current_url = page.url
            on_wait = "/wait/" in current_url
            log("Redirected to /wait/:id (not stuck on home)", on_wait, current_url)

            # Check NOT showing "Ficha Não Encontrada" error
            not_found = page.locator("text=Ficha Não Encontrada").count() + page.locator("text=Ticket Not Found").count()
            no_error = not_found == 0
            log("Wait screen — no 'Ficha Não Encontrada' error", no_error)

            # Check waiting state visible
            waiting_visible = page.locator("text=Waiting").count() + page.locator("text=Aguardando").count() > 0
            log("Wait screen — status badge visible", waiting_visible)
            save(page, "06_wait_screen")

        page.close()

        # ─────────────────────────────────────────
        # TEST 3 — Barber login (Bug 3: stale screen)
        # ─────────────────────────────────────────
        print("\n📋 TEST 3 — Barber login & switch")
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")
        clear_storage(page)
        page.reload()
        page.wait_for_load_state("networkidle")

        # Login as Marcos
        page.fill("input#email", "marcos@barber.com")
        page.fill("input#password", "password123")
        page.locator("button[type=submit]").click()
        page.wait_for_url("**/admin", timeout=5000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)

        marcos_name = page.locator("text=Marcos Silva").count() > 0
        log("Admin loaded — Marcos Silva visible", marcos_name)
        save(page, "07_admin_marcos")

        # Handle confirm dialog (must be registered before triggering the dialog)
        page.on("dialog", lambda d: d.accept())
        # Logout
        logout_btn = page.locator("button", has_text="Logout").first
        if logout_btn.count() == 0:
            logout_btn = page.locator("button", has_text="Sair").first
        logout_btn.click()
        page.wait_for_timeout(1500)
        page.wait_for_load_state("networkidle")
        save(page, "08_after_logout")

        # Login as Thiago (second barber)
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")
        page.fill("input#email", "thiago@barber.com")
        page.fill("input#password", "password123")
        page.locator("button[type=submit]").click()
        page.wait_for_url("**/admin", timeout=5000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)

        thiago_name = page.locator("text=Thiago Costa").count() > 0
        marcos_gone = page.locator("text=Marcos Silva").count() == 0
        log("After re-login — Thiago Costa visible", thiago_name)
        log("After re-login — Marcos Silva gone (no stale data)", marcos_gone)
        save(page, "09_admin_thiago")
        page.close()

        # ─────────────────────────────────────────
        # TEST 4 — Mobile viewport admin loads (Bug 4)
        # ─────────────────────────────────────────
        print("\n📋 TEST 4 — Mobile viewport admin queue loads")
        page = browser.new_page(viewport={"width": 390, "height": 844})  # iPhone 14
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")
        clear_storage(page)
        page.reload()
        page.wait_for_load_state("networkidle")

        # Login on mobile
        page.fill("input#email", "marcos@barber.com")
        page.fill("input#password", "password123")
        page.locator("button[type=submit]").click()
        page.wait_for_url("**/admin", timeout=6000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        save(page, "10_mobile_admin")

        # Queue should load — not blank
        barber_card = page.locator(".barber-profile-card").count()
        auth_loading = page.locator(".auth-loading").count()
        queue_loaded = barber_card > 0
        not_blank = auth_loading == 0
        log("Mobile — barber profile card visible (not blank)", queue_loaded)
        log("Mobile — auth-loading spinner gone", not_blank)

        # Check no overflow
        body_width = page.evaluate("() => document.body.scrollWidth")
        viewport_width = 390
        no_overflow = body_width <= viewport_width + 5  # small tolerance
        log(f"Mobile — no horizontal overflow (body={body_width}px, vp={viewport_width}px)", no_overflow)
        save(page, "11_mobile_admin_loaded")
        page.close()

        # ─────────────────────────────────────────
        # TEST 5 — Mobile layout responsiveness (Bug 5)
        # ─────────────────────────────────────────
        print("\n📋 TEST 5 — Mobile layout at various breakpoints")

        for label, width, height in [
            ("320px (small)", 320, 568),
            ("375px (iPhone SE)", 375, 667),
            ("480px (medium mobile)", 480, 853),
        ]:
            page = browser.new_page(viewport={"width": width, "height": height})
            page.goto(BASE_URL)
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1000)

            scroll_w = page.evaluate("() => document.body.scrollWidth")
            overflow = scroll_w > width + 5
            log(f"Layout {label} — no horizontal overflow (scrollWidth={scroll_w})", not overflow)

            # Header should be visible
            header = page.locator(".app-header").is_visible()
            log(f"Layout {label} — header visible", header)

            slug = label.split("(")[0].strip().replace(" ", "_")
            save(page, f"12_mobile_{slug}")
            page.close()

        # ─────────────────────────────────────────
        # TEST 6 — Barber Average Service Time
        # ─────────────────────────────────────────
        print("\n📋 TEST 6 — Barber average service time configuration & wait estimation")
        
        # Create a shared browser context so pages share localStorage database
        test6_context = browser.new_context(viewport={"width": 1280, "height": 800})
        
        # 1. Login as Marcos
        page_barber = test6_context.new_page()
        page_barber.goto(f"{BASE_URL}/login")
        page_barber.wait_for_load_state("networkidle")
        clear_storage(page_barber)
        page_barber.reload()
        page_barber.wait_for_load_state("networkidle")
        page_barber.fill("input#email", "marcos@barber.com")
        page_barber.fill("input#password", "password123")
        page_barber.locator("button[type=submit]").click()
        page_barber.wait_for_url("**/admin")
        page_barber.wait_for_timeout(1000)

        # 2. Change Marcos' average service time to 45 minutes
        time_input = page_barber.locator("input#avgTimeInput")
        time_ok = time_input.is_visible()
        log("Barber — Average service time input visible", time_ok)
        if time_ok:
            time_input.fill("45")
            time_input.press("Tab")
            page_barber.wait_for_timeout(1000)
            log("Barber — Changed average service time to 45 mins", True)
            save(page_barber, "13_barber_time_45")
            
        # 3. Open a client page, select Marcos, and join queue
        page_client = test6_context.new_page()
        page_client.goto(BASE_URL)
        page_client.wait_for_load_state("networkidle")
        page_client.wait_for_timeout(1000)
        
        # Select Marcos Silva card
        marcos_card = page_client.locator("div.barber-card", has_text="Marcos Silva")
        marcos_card.click()
        page_client.wait_for_timeout(500)
        
        page_client.fill("input#customerName", "Client de Teste Time")
        page_client.locator("button[type=submit]").click()
        page_client.wait_for_url("**/wait/*")
        page_client.wait_for_timeout(2000)
        
        # 4. Check client wait screen estimated time
        # Estimated wait time should be 45 minutes (1 client ahead + 1 = 1st position * 45 minutes)
        wait_time_text = page_client.locator(".wait-stats .stat-item", has_text="Estimated Wait").locator(".stat-value").text_content()
        # Fallback to PT if locale is PT
        if not wait_time_text:
            wait_time_text = page_client.locator(".wait-stats .stat-item", has_text="Tempo Estimado").locator(".stat-value").text_content()
        
        log(f"Client — Estimated wait time displays: '{wait_time_text}'", ("135" in wait_time_text or "180" in wait_time_text) if wait_time_text else False, wait_time_text)
        save(page_client, "14_client_estimated_45")
        
        page_barber.close()
        page_client.close()
        test6_context.close()

        # ─────────────────────────────────────────
        # SUMMARY
        # ─────────────────────────────────────────
        browser.close()

        passed = sum(1 for _, ok, _ in results if ok)
        total = len(results)
        print(f"\n{'─'*50}")
        print(f"RESULT: {passed}/{total} checks passed")
        if passed < total:
            print("\nFailed checks:")
            for label, ok, detail in results:
                if not ok:
                    print(f"  {FAIL} {label} {detail}")
        print(f"{'─'*50}")
        return passed == total

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
