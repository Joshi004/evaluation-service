# Evaluation Service — EvalScope harness image.
#
# Built from the pinned commit, not PyPI: only a from-source build lets
# adapter patches apply at all (docs/IMPLEMENTATION_PHASES.md Phase 4,
# Appendix B). The backend spawns one fresh container from this image
# per run (app/services/harness/runner.py); this image is never a
# long-running service itself, which is also why its docker-compose.yml
# entry carries `profiles: ["build-only"]`.
#
# Two things are baked in at build time rather than fetched at run
# time, because a container with no network egress must never
# discover a missing corpus or a stalled dataset download mid-run:
#   1. bake_nltk.py     -- the NLTK corpora IFEval's and IFBench's
#                          checkers call nltk.download() for lazily on
#                          first use.
#   2. prefetch_dataset.py -- opencompass/ifeval, allenai/IFBench_test,
#                          AI-ModelScope/gsm8k, AI-ModelScope/gpqa_diamond
#                          and TIGER-Lab/MMLU-Pro (Phase 5), each loaded
#                          through the exact path a real eval run takes,
#                          so the run-time cache check hits and the
#                          network is never touched. This prefetched
#                          snapshot is what decision D3 means by "the
#                          image tag is the dataset pin" -- see S-D31
#                          (docs/STANDARDS_AND_PROFILES_PHASES.md Phase
#                          5) for why the tag itself changed alongside
#                          the dataset set below.

FROM python:3.12-slim

ARG EVALSCOPE_REV=2ce95c314ed379a94e28c7f44aa8b0c3fe74eb85

# NLTK_DATA: where bake_nltk.py's corpora live.
# MODELSCOPE_CACHE: where prefetch_dataset.py's dataset snapshots live --
#   every dataset name above is a ModelScope id, loaded via EvalScope's
#   own ModelScope-backed loader (confirmed from evalscope's own
#   dataset-hub loader at the pinned commit). HF_HOME and
#   HF_DATASETS_CACHE are set for parity with a future Hugging-Face-
#   hosted benchmark; nothing in v1 reads them. EVALSCOPE_CACHE covers
#   evalscope's own misc on-disk state so nothing it writes lands
#   outside this one baked-in tree.
ENV NLTK_DATA=/opt/nltk_data \
    HF_HOME=/opt/hf-cache \
    HF_DATASETS_CACHE=/opt/hf-cache/datasets \
    MODELSCOPE_CACHE=/opt/hf-cache/modelscope \
    EVALSCOPE_CACHE=/opt/hf-cache/evalscope

# git is needed only to fetch the pinned commit; purged from this same
# layer so it never lands in the final image. `ifbench` joins `ifeval`
# here in Phase 5 -- confirmed against the pinned commit's own
# pyproject.toml: `IFBenchAdapter.__init__` calls
# `check_import(['emoji', 'syllapy', 'nltk'], extra='ifbench')`, so the
# `ifeval` extra alone is not enough for IFBench to import.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && pip install --no-cache-dir "evalscope[ifeval,ifbench] @ git+https://github.com/modelscope/evalscope.git@${EVALSCOPE_REV}" \
    && apt-get purge -y git \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY bake_nltk.py prefetch_dataset.py run_eval.py /opt/harness/

RUN python /opt/harness/bake_nltk.py \
    && python /opt/harness/prefetch_dataset.py

ENTRYPOINT ["python", "/opt/harness/run_eval.py"]
