# Fields & Report Assets

Search keywords: XLSXField, PDFField, HTMLField, BokehField, report file generation

## Scope

- Lex custom field types for binary/rendered assets
- Report generation patterns and file attachment behavior

## Key Points

- Lex extends Django field ecosystem with report/visualization-oriented field types.
- `XLSXField` and `PDFField` support deterministic artifact generation from model calculations.
- Report models typically calculate dataframes first, then serialize to output assets.
- Field selection and naming should be consistent with downstream report consumption.

## Where to Expand

- `docs/_context/lex_examples/CalculationModelExplain.py`: report generation writing into a `FileField`

## LLM Prompt Starters

- "Create a report model that writes an XLSX output with deterministic sheet naming."
- "Choose between HTML/PDF/XLSX custom fields for this output requirement and justify briefly."
