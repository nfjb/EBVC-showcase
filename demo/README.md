# Demo data

Fictional deal flow for Skarv Ventures (spec §1). Company names are invented, websites use
the reserved `.example` domain, and LPs, angels and funds are made up.

- `inbound_records.csv`: 412 raw inbound records for about 300 companies over four
  channels, with duplicate spellings and 25 warm intros (including the Robotix AI showcase:
  website form in June, two partner emails in July, an LP intro in August, LinkedIn last
  week).
- `signals.csv`: the enrichment mock (dated hires, traction, news and announced rounds).

Upload both on **Deal flow uploads**, or press *Use the bundled demo files* there.

To regenerate them (reproducible, fixed seed):

```bash
pip install faker
python demo/_generate.py
```
