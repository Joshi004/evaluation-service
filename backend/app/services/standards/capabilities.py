"""Per-framework sampling fields a recipe may set but that framework will
silently drop -- decision D4 (docs/IMPLEMENTATION_PHASES.md Section 0.8).

`min_p` is the only v1 entry: EvalScope's `GenerateConfig` has no `min_p`
field, and its `openai_api` request builder never reads `model_extra`, so
a non-zero `min_p` recorded against the `evalscope` framework never
reaches vLLM. Rather than reject that value at load time, a recipe is
allowed to record it -- someone's recommended settings, say -- and the
mismatch surfaces as a warning wherever the recipe is shown to a human
(the Standards page here, and Phase 6's Submit override editor).
"""

FRAMEWORK_UNSUPPORTED_SAMPLING_FIELDS: dict[str, set[str]] = {
    "evalscope": {"min_p"},
}
