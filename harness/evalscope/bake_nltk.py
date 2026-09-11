"""Prefetches the NLTK corpora IFEval's and IFBench's constraint
checkers need, at build time rather than on first use.

nltk being installed does not fetch its corpora -- the checkers call
nltk.download() lazily on first use (confirmed by reading evalscope's
vendored evalscope/benchmarks/ifeval/instructions_util.py at the pinned
commit: nltk.word_tokenize() and nltk.data.load('tokenizers/punkt_tab/...')
both trigger a lazy fetch). In a container with no network egress at run
time, that first call would be a mid-run failure instead of a build-time
one. See docs/IMPLEMENTATION_PHASES.md Phase 4, item 1.

The package list matches what the reference tool-call harness downloads
for the same checkers. punkt/punkt_tab are the two this pinned commit's
IFEval checkers actually call; the other three are harmless to prefetch
alongside them and keep this list matched to the documented reference
behaviour rather than to only what one file's grep turned up. IFBench
(Phase 5) needs no new package here -- its own
evalscope/benchmarks/ifbench/instructions_util.py calls the same
check_nltk_data('punkt_tab') and check_nltk_data('stopwords'), confirmed
against the same pinned commit, both already covered below.
"""

import os

import nltk

_NLTK_DATA_DIR = os.environ.get("NLTK_DATA", "/opt/nltk_data")

_PACKAGES = (
    "punkt",
    "punkt_tab",
    "stopwords",
    "averaged_perceptron_tagger_eng",
    "cmudict",
)

for package in _PACKAGES:
    nltk.download(package, download_dir=_NLTK_DATA_DIR, quiet=True)
