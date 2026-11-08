import json
import os
import sys
import time

import requests
from dotenv import dotenv_values

KEY = dotenv_values("/app/backend/.env").get("GEMINI_TEST_API_KEY") or os.environ.get("GEMINI_TEST_API_KEY")
API = [l.split("=", 1)[1].strip() for l in open("/app/frontend/.env") if l.startswith("REACT_APP_BACKEND_URL")][0] + "/api"
MODEL = sys.argv[2] if len(sys.argv) > 2 else "gemini-3.5-flash-lite"
H = {"X-LLM-Provider": "gemini", "X-LLM-Model": MODEL, "X-LLM-Key": KEY or ""}
S = requests.Session()
S.post(f"{API}/auth/login", json={"email": "tester@example.com", "password": "Testpass123"}).raise_for_status()
STATE = "/app/tests/live_state.json"


def gen(body):
    t = time.time()
    r = S.post(f"{API}/generate", json=body, headers=H)
    r.raise_for_status()
    jid = r.json()["job_id"]
    while time.time() - t < 280:
        time.sleep(3)
        j = S.get(f"{API}/generate/{jid}").json()
        if j["status"] != "running":
            print(f"  {j['status']} in {time.time() - t:.0f}s, {j['chars']} chars")
            if j["status"] == "error":
                print("  ERROR:", j["detail"])
                return None
            return j["result"]
    print("  timed out")


def report(r):
    bp = r["blueprint_pseudocode"]
    whys = [l.strip() for l in bp.splitlines() if l.strip().upper().startswith(("WHY:", "// WHY:"))]
    print("  name:", r["system_name"])
    print("  nodes/edges:", len(r["node_graph_nodes"]), len(r["node_graph_edges"]), "| steps:", len(r["setup_guide"]),
          "| steps with why:", sum(1 for s in r["setup_guide"] if s.get("why")))
    print("  bp WHY lines:", len(whys), whys[:2])
    print("  params:", [(p["key"], p["value"]) for p in r["tunable_parameters"]])
    print("  modules:", [(m["name"], m["included"]) for m in r["modules"]])
    print("  header/source chars:", len(r["cpp_header"]), len(r["cpp_source"]))
    ids = {n["id"] for n in r["node_graph_nodes"]}
    print("  dangling edges:", sum(1 for e in r["node_graph_edges"] if e["from_node"] not in ids or e["to_node"] not in ids))
    print("  applied_changes:", r.get("applied_changes"))
    print("  shared_attributes:", r.get("shared_attributes"))


step = sys.argv[1]
if step == "key":
    print(S.post(f"{API}/ai/test-key", headers=H).json())
elif step == "gen":
    ctx = {"prompt": "A health and damage component with heal over time and a death event", "blueprint_class": "ActorComponent",
           "complexity": 50, "modularity": 70, "performance_vs_flexibility": 50, "tick_rate": 30, "network_replicated": False}
    r = gen({**ctx, "project_context": "Co-op multiplayer action RPG"})
    if r:
        report(r)
        json.dump({"first": r, "ctx": ctx}, open(STATE, "w"))
elif step == "regen":
    st = json.load(open(STATE))
    first = st["first"]
    p0 = first["tunable_parameters"][0]
    drop = next(m["name"] for m in first["modules"] if m["included"])
    changes = [f"Set {p0['label']} ({p0['key']}) = {p0['value'] * 2} (was {p0['value']})", f"Remove module {drop}",
               "Add new module ShieldAbsorb", "Make the system network replicated", "Designer note: Use a Gameplay Tag for the dead state instead of a bool"]
    print("  requested:", changes)
    r = gen({**st["ctx"], "network_replicated": True, "extra_modules": ["ShieldAbsorb"], "removed_modules": [drop],
             "parameter_overrides": {p0["key"]: p0["value"] * 2}, "designer_notes": "Use a Gameplay Tag for the dead state instead of a bool",
             "change_requests": changes, "previous_system": first, "project_context": "Co-op multiplayer action RPG"})
    if r:
        report(r)
        print("  'Replicated' in header:", "Replicated" in r["cpp_header"], "| GameplayTag in code:", "GameplayTag" in (r["cpp_header"] + r["cpp_source"]))
        st["second"] = r
        json.dump(st, open(STATE, "w"))
elif step == "stack":
    st = json.load(open(STATE))
    stam = gen({"prompt": "A stamina system for sprinting and dodging with regen delay", "blueprint_class": "ActorComponent",
                "complexity": 40, "modularity": 70, "performance_vs_flexibility": 50, "tick_rate": 30, "network_replicated": True})
    if not stam:
        sys.exit()
    print("  stamina:", stam["system_name"])
    keep = lambda x: {k: x[k] for k in ("system_name", "summary", "modules", "tunable_parameters", "network_notes", "cpp_header")}
    r = gen({"prompt": f"Stack these systems into one integrated system: {st['second']['system_name']} + {stam['system_name']}",
             "blueprint_class": "ActorComponent", "complexity": 55, "modularity": 75, "performance_vs_flexibility": 50, "tick_rate": 30,
             "network_replicated": True, "stack_systems": [keep(st["second"]), keep(stam)]})
    if r:
        report(r)
