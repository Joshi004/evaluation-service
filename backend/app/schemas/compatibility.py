"""`CompatibilityFinding` and `CompatibilityReport` -- the shapes
`app.services.compatibility.validator.validate_compatibility` returns.
See docs/CHECKPOINT_REGISTRATION_PHASES.md Section 0.5 and Phase 6.

Pydantic, not a frozen dataclass, for the same reason
`app.schemas.discovery`'s DTOs are Pydantic: a `CompatibilityFinding`
crosses the API boundary embedded in `RunPreviewPair`
(app/schemas/runs.py), so one definition keeps the validator's own
return shape and the wire response from drifting apart.
"""

from typing import Literal

from pydantic import BaseModel, computed_field


class CompatibilityFinding(BaseModel):
    """One rule's verdict on a (checkpoint, serving profile, standard,
    sampling profile) tuple. `code` is `snake_case`, stable, and never
    changes once shipped (R-D27) -- it is what the frontend groups and
    styles on, and what a log line is worth searching for. `message` is
    for humans and will be reworded over time; `field` names what a
    human should look at, e.g. `'sampling.max_tokens'`.
    """

    code: str
    field: str
    message: str


class CompatibilityReport(BaseModel):
    """One rule pass's full result. `status` is derived from `errors`,
    never set independently (R-D28): a separately assigned status is a
    field that can contradict the list beside it.
    """

    errors: list[CompatibilityFinding] = []
    warnings: list[CompatibilityFinding] = []

    @computed_field
    @property
    def status(self) -> Literal["valid", "invalid"]:
        return "invalid" if self.errors else "valid"
