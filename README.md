# Freddie's Library

One list of Freddie's books and toys, with some marked as wishes that family can claim
("I'll get this") so nobody buys the same gift twice. It's a plain static site
(`index.html`, `styles.css`, `app.js`, `config.js`) with no build step, served by GitHub Pages.

- **Data:** a Supabase project (`freddies-library`) holds the `items` table. The schema is in
  [`supabase/schema.sql`](supabase/schema.sql).
- **Who can do what:** anyone with the link can view the list and claim a wish. Only the admin,
  signed in with an email listed in the `editors` table, can add, edit or remove things.
- **ISBN autofill:** typing (or, on Android Chrome, scanning) a book's ISBN fills in the title,
  author and cover from [Open Library](https://openlibrary.org/developers/api).
- **Run it locally:** `python3 -m http.server` in this folder, then open http://localhost:8000.
