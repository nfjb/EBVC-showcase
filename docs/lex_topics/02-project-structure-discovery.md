# Project Structure & Auto-Discovery

Search keywords: project structure, app.py, discovery, excluded files

## Scope

- Expected project layout for Lex users
- Model discovery behavior and exclusions
- File placement conventions

## Key Points

- Lex auto-discovers model classes from user project Python files.
- Underscore-prefixed/internal bootstrap files are treated specially (`_structure.py`, `_streamlit_structure.py`, auth settings).
- Discovery excludes framework/bootstrap/build folders and migration/system files.
- Stable naming and file placement reduce registration and serializer wiring errors.
- **Naming conventions are not here.** How to name a class, field, method or variable is `20-LEX-SPECIFICATIONS.md` section H.1; this file covers only where files go and which ones discovery skips.

## LLM Prompt Starters

- "Generate a Lex-ready project tree and explain which files are required vs optional."
- "Check my module layout against auto-discovery rules and list what Lex will ignore."
