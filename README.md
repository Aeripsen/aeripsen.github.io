# aeripsen.github.io

The source of [aeripsen.github.io](https://aeripsen.github.io), the personal site of Sepehr Jafari: network security and machine learning, Toronto.

It is a static site. Plain HTML, one stylesheet and two scripts, no framework, no build step, no dependencies. GitHub Pages serves the `main` branch as it is.

## What a visitor finds

| Page | What is on it |
|---|---|
| `index.html` | The idea in one paragraph and an interactive reject knob drawn from FlowSentry's measured results, then the projects. |
| `research.html` | The SECRYPT 2026 paper (first author), the dataset, what the paper measured and, kept separate, what the FlowSentry reimplementation measured on attack families held out of training. |
| `flowsentry.html` | FlowSentry, and the benchmark where a plain forest beat its two-stage architecture. |
| `ledgersentry.html` | LedgerSentry, card-fraud detection with the review queue priced and the confidence interval printed. |
| `ids.html` | The multi-protocol IoT detection work, stated as design and capture rig, not a finished system. |
| `imic.html` | A bilingual charity site he maintains as a volunteer. |
| `method.html` | How he runs parallel automated work and checks it. |

## Where the numbers come from

The figures on the pages are copied from files in the public repos they describe, and each figure is printed next to its source file:

- FlowSentry numbers: `artifacts/metrics.json`, `artifacts/benchmark.json` and `artifacts/hierarchy_benchmark.json` in [Aeripsen/flowsentry](https://github.com/Aeripsen/flowsentry).
- LedgerSentry numbers: `artifacts/metrics_ulb_creditcard.json` and `artifacts/bootstrap_ulb_creditcard.json` in [Aeripsen/ledgersentry](https://github.com/Aeripsen/ledgersentry).
- Paper numbers: the SECRYPT 2026 paper, [DOI 10.5220/0015033600004103](https://doi.org/10.5220/0015033600004103). The held-out-family numbers on `research.html` are FlowSentry's, not the paper's, and the page says so.

The knob on the front page (`assets/instrument.js`) steps through the seven thresholds that were actually measured, because the artifact contains no more than that. It does not interpolate.

## Run it locally

```
git clone https://github.com/Aeripsen/aeripsen.github.io
cd aeripsen.github.io
python -m http.server 8000
```

Then open http://localhost:8000. Any static file server works; there is nothing to install.

## Layout

- `*.html`: one file per page, styles in `assets/site.css`
- `assets/instrument.js`: the reject knob; `assets/site.js`: injects the shared header and footer so the pages cannot drift apart
- `robots.txt`: allows the site, keeps the tailored resume PDFs out of search
