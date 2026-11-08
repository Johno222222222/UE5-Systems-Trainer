import asyncio, os, time
from emergentintegrations.llm.chat import LlmChat, UserMessage
k = os.environ["GEMINI_TEST_API_KEY"]
async def t(m):
    t0 = time.time()
    try:
        r = await asyncio.wait_for(LlmChat(api_key=k, session_id="t", system_message="Reply OK").with_model("gemini", m).with_params(max_tokens=512).send_message(UserMessage(text="Say OK")), 25)
        return f"{m} OK {r[:15]!r} {time.time()-t0:.1f}s"
    except Exception as e:
        return f"{m} FAIL {type(e).__name__} " + str(e).replace(k, "***")[:260].replace("\n", " ")
async def main():
    ms = ["gemini-2.5-flash-lite", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-lite-latest", "gemini-3.8-flash", "gemini-3.1-pro-preview", "gemini-2.5-pro"]
    for line in await asyncio.gather(*[t(m) for m in ms]):
        print(line, flush=True)
asyncio.run(main())
