from playwright.sync_api import Page, expect, sync_playwright
import time

def test_geohealth_dashboard(page: Page):
    # Go to local app
    page.goto("http://localhost:3000")

    # Wait for map to load (the pulsing marker logic or geocoder)
    time.sleep(3)

    # Look for the Sidebar
    expect(page.get_by_text("GeoHealth V1")).to_be_visible()

    # Instead of geocoder, try simulating a map click directly to trigger API
    # Center of Nigeria roughly
    page.mouse.click(400, 400)

    # Wait for API to return results and stop loading
    time.sleep(5)

    # Take screenshot of the result
    page.screenshot(path="verification/geohealth_dashboard.png", full_page=True)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_geohealth_dashboard(page)
        finally:
            browser.close()
