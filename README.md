# brm-search

A simple search for Brevet Randonneurs Mondiaux (BRM) events.

## Installation

```bash
bun install --frozen-lockfile
```

## Environment variables

Copy [.env.example](.env.example) to `.env` and fill in the values.

Required for login/account:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

To enable per-user synced plans, run the SQL in [supabase/user_plans.sql](supabase/user_plans.sql)
in your Supabase SQL editor.

## Export

Load the data from the BRM website and save it to a JSON file.

```bash
bun export
```

## Import

Load the data from the JSON file and save it to Algolia.

```bash
bun import
```

## Development

Run the website locally.

```bash
bun dev
```
