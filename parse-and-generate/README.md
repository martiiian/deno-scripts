# About
This is a simple script written in TS for dyno.
It parses meta-json document, rename files and generate SQL script.

## Example
```bash
deno run --unstable --allow-read --allow-write index.ts fixtures/test-meta.json ./fixtures/testfiles/ dist/biba.sql
```