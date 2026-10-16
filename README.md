# Recurse light map

Editable 2D map of the arclight bulbs (numbers 1–55). It starts from a rough guess of the rows and is corrected on site.

## Run

```sh
npm start            # node serve.mjs → prints http://<this-laptop-ip>:8000; open it on a phone
```

There is no build step and no arclight connection.

## On site

1. A friend lights one bulb in the arclight app and calls out its number.
2. Tap that bulb on the map, type the number, and press **Set**. You can also tap a number in the bottom "Unassigned" bar first and then tap the bulb.
   - A number already on another bulb moves to the new bulb, and the old bulb flashes blank.
3. Fix the map as you go:
   - **Add bulb:** tap empty floor. The bulb joins the nearest row, or the row you picked in **Rows → +**.
   - **Move a bulb:** select it, then drag it.
   - **Delete a bulb, change its row, or reorder it:** use the bottom sheet.
   - **Rows dialog:** rename, reorder, reverse, add or delete rows.
4. **Undo** reverts the last edit. Every edit is saved in the browser.
5. When the counter reads 55/55: **Export → Download mapping.json**. Commit it as `data/mapping.json`.

## Generate the map

```sh
npm run map          # data/mapping.json → dist/map.svg + dist/map.html
```

The **Export** dialog can also download `map.svg` and `map.html` directly from the phone.

## Files

- `src/floorplan.js`: floor plan traced from the Exit Stair A sign.
- `data/mapping.json`: the committed mapping. Browsers open this file. A browser's own saved edits are used only while this file is unchanged; once it changes, the file wins and the old copy is kept in localStorage under `arclight-light-map:v1:backup`.
- `src/seed.js`: the starting guess, taken from the walkthrough video and its narration.
- `src/model.js`: the state and validation logic. Run the tests with `npm test`.
- `src/render-map.js`: the SVG and HTML renderer, shared by the app and `gen-map.mjs`.
