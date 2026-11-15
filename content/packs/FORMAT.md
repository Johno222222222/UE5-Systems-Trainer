# Lesson pack format

A lesson pack is one JSON file in this folder. The app reads every `*.json` file here when it starts. Add a file, restart the app, and the new program or course shows up. You do not change any code.

The Windows install ships this folder inside the app. It does not read the folder you cloned. Extra packs you add yourself go in the `packs` folder next to your projects (the same folder Settings calls **Open folder**). Restart after you add a file. A pack that is missing or is not valid JSON is named on the Programs and Courses pages instead of leaving those pages blank.

Files that do not end in `.json` (this note, for example) are ignored. Files are read in alphabetical order. The first program or course with a given `id` wins. A later file that repeats an id is skipped and reported.

## Top of the file

```json
{
  "format": "ue5-architect-pack",
  "version": 1,
  "programs": [],
  "courses": []
}
```

A file may contain programs, courses, or both.

## Program

A program is a guided path that ends by loading a starter project into Tools.

| Field | What it is |
| --- | --- |
| `id` | Stable id, used in saved progress. |
| `title`, `summary` | What Home and the program list show. |
| `modules` | Ordered teaching modules. |
| `modify_tasks` | At least five tasks checked against settings on this computer. |
| `compares` | The same feature built two ways. |
| `map` | Clickable nodes. Must include `input`, `interaction`, `health`, and `ui`. |
| `starter` | The project loaded into Tools. Needs `system_name`, `cpp_header`, and `cpp_source`. |

### Module step

```json
{
  "id": "look-timer",
  "title": "Look with a timer",
  "reveal": { "nodes": ["Timer Trace"], "functions": ["BeginPlay"] },
  "predict": {
    "prompt": "When should this look for an actor?",
    "choices": ["On a timer.", "On Tick."],
    "answer": 0,
    "why": "Tick would keep tracing while you stand still."
  },
  "why": "A timer sleeps between looks.",
  "task": "Which function starts the timer?",
  "accept": ["beginplay", "begin play"]
}
```

`reveal` must name at least one node or function. `answer` is the index of the right choice. `accept` is a list of phrases. The typed task passes when the answer contains one of them, ignoring case. Checking a task does not call the model.

### Modify task

```json
{
  "id": "trace-500-ignore",
  "title": "A 500 cm trace that ignores the player",
  "prompt": "Set the look trace.",
  "fields": [
    { "key": "trace_distance", "label": "Trace distance", "kind": "number", "unit": "cm" },
    { "key": "ignore_player", "label": "Ignore the player", "kind": "bool" }
  ],
  "pass": {
    "all": [
      { "key": "trace_distance", "eq": 500 },
      { "key": "ignore_player", "eq": true }
    ]
  },
  "hints": [
    { "key": "trace_distance", "text": "The trace length is not the one this task asks for." }
  ],
  "pass_detail": "500 cm, and the player is ignored.",
  "fail_detail": "Those settings do not pass this task."
}
```

`kind` is `number`, `bool`, or `choice`. A choice field adds `options`: `{ "value", "label" }`.

`pass` is `all` (every clause) or `any` (one clause). A clause is `{ "key", "eq" }`, `gte`, `lte`, or `neq`. The task passes only when the rule matches. A wrong value fails. The check runs on this computer.

### Compare and map

`compares[]` has `id`, `title`, `feature`, `note`, `left`, and `right`. Each side has `label` and `body`.

`map.nodes[]` has `id`, `title`, and `detail`. `map.edges[]` has `from` and `to`, using node ids.

## Course

A course is scored. `pass_mark` is a percent. Each module needs a takeaway, an assignment, a quiz, and a diff.

```json
{
  "id": "example-course",
  "title": "Example course",
  "summary": "Four modules.",
  "pass_mark": 70,
  "modules": [
    {
      "id": "look",
      "title": "Looking",
      "takeaway": "One sentence to keep.",
      "assignment": { "prompt": "Say the distance.", "accept": ["500"] },
      "quiz": [
        {
          "id": "q1",
          "prompt": "What runs the trace?",
          "choices": ["A timer.", "Tick."],
          "answer": 0,
          "why": "Tick keeps running while you stand still.",
          "review_prompt": "How is the look check scheduled?"
        }
      ],
      "diff": {
        "id": "d1",
        "prompt": "Which version has the bug?",
        "review_prompt": "Which side is the broken check?",
        "why": "The right-hand side traces on Tick.",
        "bug": "right",
        "left": { "label": "Timer", "code": "SetTimer(...);" },
        "right": { "label": "Tick", "code": "void Tick() {}" }
      }
    }
  ]
}
```

A course needs at least four modules. `bug` is `"left"` or `"right"`. `review_prompt` is the reworded line used when a wrong answer comes back.

Scores are saved in the local library. Submitting a module again replaces that module's score.

A wrong quiz answer, or the wrong side of a diff, is queued for the next three sessions. It is not shown again in the session you missed it. The review uses `review_prompt`, not the original wording. A right answer on review removes it. Another miss schedules it for three more sessions.

## Saved progress

Progress for packs lives in the same local library as projects (`progress.study`). A library saved before this stage has no `study` block and still opens.
