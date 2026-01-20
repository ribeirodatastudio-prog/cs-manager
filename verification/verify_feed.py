from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # 1. Start App
        print("Navigating to app...")
        page.goto("http://localhost:5173")

        # Check if we are on Welcome Screen
        print("Filling Welcome Form...")
        page.get_by_placeholder("Enter Team Name...").fill("Ferrari")
        page.get_by_placeholder("Driver 1...").fill("Leclerc")
        page.get_by_placeholder("Driver 2...").fill("Sainz")

        page.get_by_text("Establish Team").click()

        # 2. HQ -> Qualifying
        print("Starting Qualifying...")
        # Wait for transition
        page.wait_for_timeout(1000)
        page.get_by_text("START QUALIFYING").click()

        # 3. Qualifying -> Race
        print("Starting Race...")
        page.wait_for_timeout(1000)
        page.get_by_text("Start Race").click()

        # 4. In Race
        print("Verifying Race View...")
        # Check if "Team Radio" header is present
        expect(page.get_by_text("Team Radio")).to_be_visible()

        # Speed up
        print("Speeding up...")
        page.get_by_text("1x").click() # -> 2x
        page.wait_for_timeout(500)
        page.get_by_text("2x").click() # -> 10x

        # Wait for a few seconds for laps to happen (at 10x, 30s/10 = 3s per lap)
        # Wait 15s -> ~5 laps. Enough for feed.
        print("Simulating Race...")
        page.wait_for_timeout(15000)

        # Take screenshot
        print("Taking Screenshot...")
        page.screenshot(path="verification/verification.png")
        print("Screenshot saved to verification/verification.png")

    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="verification/error.png")
        raise e

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
