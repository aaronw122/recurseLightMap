---
title: "Arclight Light Map"
author: "human:aaron"
version: 2
created: 2026-10-15
---

# Arclight Light Map

## WANT
A simple web app showing a 2D map of the space with a pre-drawn rough guess of the lightbulb rows. On site, you correct the map and label each bulb with its arclight number, which gives the correct mapping of light numbers 1–55.

- The map opens with the floor plan and a rough guess of bulb positions grouped into rows. The rows are guessed from the walkthrough video and the floor plan.
- Your friend lights a bulb from the arclight app and calls out its number. You tap that bulb on the map and enter the number.
- Editing:
  - Assign or change the number on any bulb.
  - Add a bulb where one is missing from the guess.
  - Delete an extra bulb.
  - Drag a bulb to correct its position.
  - Move a bulb to a different row, or add and delete rows.
- Each bulb shows its arclight number, or appears visibly blank if it has no number yet. Rows are visually distinct.
- A running list shows which numbers 1–55 are still unassigned.
- Export the result as a mapping file (arclight number → row, position in row, x/y). Generate a clean 2D map from that file that can be ported into the arclight.local web app later.
- Progress survives refreshes and phone sleep.

## DON'T
- No connection to arclight: no API calls, no flashing, no proxy. Numbers come from a person reading the arclight app aloud.
- Don't modify the arclight package, its config, or Rose's phone UI.
- Don't renumber hardware; this is a mapping layer only.
- Don't integrate into arclight.local yet. Porting comes later.
- Only numbers 1–55; 56–115 are out of scope.
- No camera-simulation / HAP-video work.
- Keep it simple: no frameworks, servers, or accounts unless strictly needed.

## LIKE
- The existing arclight.local:8081 tool (visual reference only)
- Rose's arclight phone app
- Building egress sign floor plan (`/Users/aaron/Downloads/IMG_1456.png`)
- Walkthrough video (`/Users/aaron/Downloads/IMG_1457.MOV`)

## FOR
- Aaron with a phone (or laptop), walking the Recurse space while a friend drives the arclight app.
- Floor: one long rectangle with Exit Stair A at the top-left, fire escape at the bottom-right, 3 columns along the centerline, offices on the left end and rooms along the top wall, and ceiling lights on track and pipe runs.
- A standalone static web app in this repo (`recurseLightMap`).

## ENSURE
- Opening the app shows the floor plan with pre-placed bulbs grouped into rows, before any input.
- Tapping a bulb and entering a number labels it. The same number can't be on two bulbs: assigning a duplicate is blocked or moves it, with a clear indication either way.
- Bulbs can be added, deleted, dragged, and moved between rows. Rows can be added and deleted.
- Numbers outside 1–55 are rejected. The unassigned list always equals {1..55} minus the assigned numbers.
- Reloading the page or locking the phone loses no edits.
- Exporting and re-importing the mapping JSON reproduces the identical map.
- The generated map is readable on a phone: every number is legible and rows are distinguishable.

## TRUST
- [autonomous] Initial row/bulb guess, floor plan trace, stack, visual design, file schema
- [ask] Nothing else is expected to need approval
