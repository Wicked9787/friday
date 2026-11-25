# Quick check of blocks A, B (panels, long timer) and Y (3.0 features: several jobs, partner message).
import os
src = open(os.path.join(os.path.dirname(__file__), "full.py")).read()
top = src[:src.index("async def main():")]
exec(top)
ab = src[src.index("        # ---------- A. upgrade from v1 data ----------"):src.index("        # ---------- C. settings controls ----------")]
y = src[src.index("        # ---------- Y. 3.0 features ----------"):src.index("        # ---------- P. 3.1 on the web page ----------")]
code = '''
async def quick():
    from playwright.async_api import async_playwright
    sc = "Jarvis" if PROFILE == "batsie" else "Friday"
    term = "ma'am" if PROFILE == "batsie" else "boss"
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"])
''' + ab + y + '''        await b.close()
    for name, good, detail in RESULTS:
        print(("  ok  " if good else "  XX  ") + name + ("" if good else "  -> " + str(detail)[:300]))
asyncio.run(quick())
'''
exec(code)
