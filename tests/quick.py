# Quick check of the 3.1.1 live-voice parts (the full simulation still runs before anything ships).
import os, re
src = open(os.path.join(os.path.dirname(__file__), "full.py")).read()
top = src[:src.index("async def main():")]
exec(top)
r_block = src[src.index("        # ---------- R. 3.1.1 live voice ----------"):src.index("        # ---------- Q. 3.1 phone jobs")]
q_block = src[src.index("        # ---------- Q. 3.1 phone jobs"):src.index('        ok("Z no errors with the iPhone add-ons"')]
code = '''
async def quick():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required"])
        sc = "Friday" if PROFILE == "sky" else "Jarvis"
        scheme = sc.lower()
        ctx, pg, err = await new_ctx(b, SEED_V1 % {"sc": sc})
        await pg.goto(BASE, wait_until="load"); await pg.wait_for_timeout(2500)
        await pg.evaluate("document.getElementById('whatsnew').classList.add('hidden')")
''' + r_block + q_block + '''        ok("Z no page errors", not err and not errq, (err + errq)[:6])
        await b.close()
    for name, good, detail in RESULTS:
        print(("  ok  " if good else "  XX  ") + name + ("" if good else "  -> " + detail))
asyncio.run(quick())
'''
exec(code)
