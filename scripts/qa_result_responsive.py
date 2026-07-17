from pathlib import Path
import re

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:3000/geo.tenten.co"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ARTIFACTS = Path("artifacts/qa")
ARTIFACTS.mkdir(parents=True, exist_ok=True)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=CHROME)
    for name, viewport in (
        ("desktop", {"width": 1440, "height": 1000}),
        ("mobile", {"width": 390, "height": 844}),
    ):
        context = browser.new_context(viewport=viewport, device_scale_factor=1)
        context.grant_permissions(
            ["clipboard-read", "clipboard-write"],
            origin="http://127.0.0.1:3000",
        )
        page = context.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'share', { value: undefined })")
        page.goto(BASE_URL, wait_until="domcontentloaded")
        page.locator("text=INSPECTION COMPLETE").wait_for(timeout=15_000)

        score_label = page.locator(".overall-score").get_attribute("aria-label") or ""
        target_match = re.search(r"(\d+) 分", score_label)
        assert target_match
        target_score = int(target_match.group(1))
        initial_score = int(page.locator(".overall-score b").inner_text())
        page.wait_for_timeout(1_650)
        final_score = int(page.locator(".overall-score b").inner_text())

        assert page.locator(".score-ring").count() == 4
        assert initial_score < final_score == target_score
        assert page.locator(".result-actions button").evaluate("button => button.getBoundingClientRect().height") >= 44
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

        if name == "desktop":
            page.locator(".result-actions button").click()
            page.get_by_text("已複製連結").or_(page.get_by_text("已分享")).wait_for(timeout=3_000)

        if name == "mobile":
            page.locator(".score-overview").screenshot(
                path=str(ARTIFACTS / "result-mobile-score-card.png")
            )

        page.screenshot(path=str(ARTIFACTS / f"result-{name}-viewport.png"), full_page=False)
        context.close()

    reduced_context = browser.new_context(
        viewport={"width": 1024, "height": 800},
        reduced_motion="reduce",
    )
    reduced_page = reduced_context.new_page()
    reduced_page.goto(BASE_URL, wait_until="domcontentloaded")
    reduced_page.locator(".overall-score b").wait_for(timeout=15_000)
    reduced_page.wait_for_timeout(100)
    reduced_label = reduced_page.locator(".overall-score").get_attribute("aria-label") or ""
    reduced_target = int(re.search(r"(\d+) 分", reduced_label).group(1))
    assert int(reduced_page.locator(".overall-score b").inner_text()) == reduced_target
    reduced_context.close()

    browser.close()
    print("QA result responsive: PASS | score motion + reduced motion + 1440x1000 + 390x844")
