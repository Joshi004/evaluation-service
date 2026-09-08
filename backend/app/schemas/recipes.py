"""Response shapes for GET /api/v1/recipes and anything else that shows
a recipe's fields to a human.
"""

from datetime import datetime

from pydantic import BaseModel


class RecipeListItem(BaseModel):
    id: int
    hash: str
    label: str | None
    benchmark: str
    framework: str
    task_name: str
    created_at: datetime


class RecipeFieldWarning(BaseModel):
    """A recipe field whose value is recorded but has no effect for this
    recipe's framework -- e.g. a non-zero `min_p` under evalscope
    (decision D4; see app/services/standards/capabilities.py). Computed
    by the backend, not stored, and surfaced next to the field wherever
    a recipe is shown to a human: the Standards page and Phase 6's
    Submit dry-run preview both need the exact same warning text, which
    is why this lives here rather than in each caller's own schema
    module.
    """

    field: str
    message: str
