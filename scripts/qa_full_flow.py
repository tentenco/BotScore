from pathlib import Path
from time import time
from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:3000"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ARTIFACTS = Path("artifacts/qa")
ARTIFACTS.mkdir(parents=True, exist_ok=True)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=CHROME)
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda error: errors.append(f"pageerror:{error}"))
    page.on("console", lambda message: errors.append(f"console:{message.text}:{message.location}") if message.type == "error" and "favicon" not in message.text else None)

    page.goto(BASE_URL, wait_until="networkidle")
    page.locator("#site-url").fill("https://geo.tenten.co/")
    page.locator(".hero-copy .audit-form button").click()
    page.wait_for_url("**/geo.tenten.co", timeout=15_000)
    page.locator(".progress-stage").wait_for(timeout=15_000)
    page.screenshot(path=str(ARTIFACTS / "audit-live-progress.png"), full_page=False)
    page.locator("text=INSPECTION COMPLETE").wait_for(timeout=150_000)
    assert page.locator(".overall-score b").inner_text().strip()
    assert page.locator(".finding-row").count() >= 3
    page.screenshot(path=str(ARTIFACTS / "audit-public-result.png"), full_page=True)

    page.locator("#lead-email").fill(f"qa+{int(time())}@example.com")
    page.locator("#lead-name").fill("Tenten QA")
    page.locator("#lead-company").fill("Tenten")
    page.locator(".lead-submit").click()
    page.wait_for_url("**/report/**", timeout=30_000)
    page.wait_for_load_state("networkidle")
    assert page.locator("text=COMPLETE EVIDENCE REPORT").is_visible()
    assert page.locator(".report-finding").count() >= 40
    assert "準備度檢測" in page.locator(".report-banner").inner_text()
    page.screenshot(path=str(ARTIFACTS / "audit-full-report.png"), full_page=True)

    report_url = page.url
    finding_count = page.locator(".report-finding").count()
    browser.close()
    assert not errors, "browser errors: " + " | ".join(errors)
    print(f"QA full flow: PASS | findings={finding_count} | report={report_url}")
