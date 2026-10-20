# Extending the animation skill

A **child skill** is a specialized animation skill (a stick-fight series, product explainers, logo stings) that runs the base [SKILL.md](SKILL.md) loop with some decisions already made. The base keeps the workflow, the checks and the route references in one place, and each child holds only what makes it specific.

## How a child runs

The child's `SKILL.md` sends the agent to the base first, then supplies **slots**: named values that replace the base's open decisions. The agent follows the base steps, using the child's slot values wherever a step would otherwise choose or ask. Where the child and the base differ, the child wins. Each base step's **Done when** still applies unless the child replaces that step.

## Slots

Fill only the slots the child fixes; every slot left out stays open, and the base decides it as usual.

| Slot | What it fixes | Base step |
| --- | --- | --- |
| **Route** | One route, or a shorter list to choose from | 2 |
| **Brief** | Defaults that replace the base table, extra required fields, and questions to always ask | 1 |
| **Methods** | Preferred methods and extra craft rules | 2, 4, 6 |
| **Style** | Look rules: palette, line weight, fonts, character designs, camera language | 4, 6 |
| **Assets** | Starter project, rigs, components or templates shipped in the child's folder, and how to copy them in | 3 |
| **Checks** | Extra things to verify in every look pass | 5 |
| **Deliverable** | Format, naming, destination and what to report | 7 |
| **Steps** | Steps to add (`after step N: ...`) or a step's body to replace | any |

## Template

```markdown
---
name: <child-name>
description: "<what it makes>. Use when <the trigger that is specific to this child>."
---

# <Title>

Specializes the [animation](../animation/SKILL.md) skill: read it and follow its steps, using the slots below. Where this file and the base differ, this file wins.

## Slots

- **Route:** <route>; read [routes/<route>.md](../animation/routes/<route>.md).
- **Brief:** <defaults and extra required fields>
- **Methods:** <...>
- **Style:** <...>
- **Assets:** copy `template/` from this skill's folder into the new project.
- **Checks:** <...>
- **Deliverable:** <...>

## Steps

- After step 1: <...>
```

## Writing a child

- Follow the writing-for-agents skill. A child that should fire on its own trigger word keeps a model-facing description; one that you only ever type sets `disable-model-invocation: true`.
- Point to base files by relative path (`../animation/...`), since every skill sits in the same skills folder. Keep base material in the base: a child restates a rule only to change it.
- Put an asset in the child once a second project needs it. Starter projects work best when they already pass the route's smoke test.
- When two children need the same addition, move it into the base (a new `METHODS.md` section or route detail), so every child gets it.
