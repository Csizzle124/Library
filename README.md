# Freddie's Library

A home for Freddie's books and toys, a wish list family can claim gifts from, and a few
bedtime extras (reading log, story picker, toy rotation, pass-along box). It's a plain
static site: `index.html`, `styles.css`, `app.js` and `config.js`, with no build step.

## How it fits together

- **Hosting:** GitHub Pages serves the files straight from the `main` branch.
- **Data:** a Supabase project (`freddies-library`) holds the catalog as one JSON document
  in the `library` table, wish-list claims in `claims`, and photos in the public `photos`
  storage bucket. The schema is in [`supabase/schema.sql`](supabase/schema.sql).
- **Who can do what:** anyone with the link can browse and claim a wish without an account.
  Only signed-in accounts whose email is in the `editors` table can change the library or
  upload photos. Whoever claims a gift can undo it from the same browser.
- **ISBN autofill:** typing an ISBN (or scanning its barcode with any phone's camera) fills in the title,
  author and cover from [Open Library](https://openlibrary.org/developers/api).

## Common jobs

- **Let another grown-up edit:** in the Supabase dashboard, open the SQL editor and run
  `insert into public.editors (email) values ('their@email.com');`. They then use
  "Grown-up sign in" → "Create an account" on the site.
- **Run it locally:** `python3 -m http.server` in this folder, then open http://localhost:8000.
