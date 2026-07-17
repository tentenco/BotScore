from pathlib import Path
from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:3000"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ARTIFACTS = Path("artifacts/qa")
ARTIFACTS.mkdir(parents=True, exist_ok=True)


def assert_no_horizontal_overflow(page):
    overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
    assert not overflow, "page has horizontal overflow"


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=CHROME)
    errors = []

    page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    page.on("console", lambda message: errors.append(f"console:{message.type}:{message.text}:{message.location}") if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(f"pageerror:{error}"))
    page.on("response", lambda response: errors.append(f"http:{response.status}:{response.url}") if response.status >= 400 else None)
    page.goto(BASE_URL, wait_until="networkidle")
    assert "AI 會引用你嗎" in page.locator("h1").inner_text()
    assert page.get_by_role("button", name="免費檢測").count() == 2
    assert_no_horizontal_overflow(page)
    page.screenshot(path=str(ARTIFACTS / "landing-desktop.png"), full_page=True)

    mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    mobile.goto(BASE_URL, wait_until="networkidle")
    assert mobile.locator("#site-url").is_visible()
    assert_no_horizontal_overflow(mobile)
    mobile.screenshot(path=str(ARTIFACTS / "landing-mobile.png"), full_page=True)

    browser.close()
    assert not errors, "browser errors: " + " | ".join(errors)
    print("QA landing smoke: PASS")
