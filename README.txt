NERD 4 SALE GAMING - LOCAL WINDOWS VERSION

1. Install Node.js 22 or newer from https://nodejs.org (LTS recommended).
2. Extract the entire ZIP. Do not run the startup file from inside the ZIP.
3. Double-click START-WINDOWS.bat. No npm install is needed.
4. Keep the command window open while using the site. If the browser opens before the server starts, refresh it.

Website: http://127.0.0.1:3000
Admin:   http://127.0.0.1:3000/admin
Stop:    press Ctrl+C in the command window.

The local admin does not require ChatGPT login. The server listens only on this
computer, and rejects requests from other hosts and cross-origin inventory writes.
Do not expose this local testing server to the internet.

Upload a ManaBox CSV in Admin. Inventory is saved in data/inventory.json and
remains after closing the browser or restarting. Back up the entire data folder.
TCGplayer reference prices via Scryfall are cached in data/prices.json for 24 hours.
Images and pricing require internet access. Cards need a Scryfall ID for pricing.
CSV prices are ignored. Missing prices display as a dash.

Local changes do not update the hosted website. This package is a standalone
Node.js version of the current design, with file storage replacing hosted storage.
A snapshot of published inventory is included if it could be downloaded during
packaging; otherwise upload your CSV to initialize the inventory.

Edit public/index.html for page text, public/style.css for appearance,
public/catalog.js for the card list behavior, and public/admin.html for local admin.
Logo: public/nerd-4-sale-logo.png.

Mac/Linux: open a terminal in this folder and run: node server.mjs

BUY LISTS
Customers use Sell your cards on the main page. Name, email and cellphone are required.
Preview & price the CSV first, then submit. ManaBox and common TCGplayer exports
are supported. Scryfall IDs, set/card numbers, or product IDs help exact matching.
Unmatched entries remain unpriced. CSV prices are ignored.
Admin has a separate Submitted buy lists section with archive/restore/delete,
price sorting and Download original CSV. Original files are stored under
data/buylist-files and records under data/buylists. Back up the entire data folder.
Deleting a buy list also deletes its stored original CSV. Archived prices remain fixed.
Inventory supports set/name and high/low price sorting. Large inventories may
take time to load market prices for accurate sorting.

TCGPLAYER E/G/J FORMAT
Choose TCGplayer in the CSV format menu for E=Name, G=Collector Number,
J=Foil/Nonfoil. Other fields use their column headers. Admin can download
both the unchanged original and the converted ManaBox CSV. Prices and totals
are displayed in admin only; main-page price sorting is still available.

TCGplayer E/G/J/P format: quantity is read from column P.

SEALED PRODUCTS
The main page has separate Singles and Sealed sections, both showing prices.
Buy-list uploads hide customer-facing prices; admin keeps the saved values.
Admin has a TCGplayer sealed CSV import, original CSV download, and contents editor.
Unopened/Sealed rows are imported; single-card rows are excluded.
Sealed reference prices are TCG Market Price snapshots from the uploaded CSV,
not live Scryfall prices. Secret Lair contents are shown for verified matches;
reference card art may differ from the included edition. Missing contents can
be entered in Admin. Seed data includes 54 sealed products/94 units from the
provided CSV. Future imports are saved to data/inventory/sealed.json and
data/inventory/sealed-source.csv. Back up the entire data folder.
Buy-list filenames now include the customer name and Buy-List.

SEALED DISPLAY UPDATE
Sealed pagination uses two rows: 6 products on desktop, 4 on tablet, 2 on mobile.
Secret Lair card images use verified Scryfall SLD printing IDs. If an exact
printing is unavailable, a name-only entry is shown instead of unrelated art.
A leading Secret Lair Drop: prefix is removed from displayed product names.

COMPLETE CONTENTS UPDATE
All 54 products from the supplied inventory now have exact product-level
contents and Scryfall printing matches. Includes SLD, token, Countdown Kit,
and the exact reprints in the Angels Commander deck. Fixed contents are
included; variable bonus packs are excluded. Custom admin contents remain
preserved. Old inventory data picks up updated contents without re-upload.
