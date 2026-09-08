"""Response shape for GET /api/v1/recipes.

Returns [] this phase -- Phase 2 is what actually loads /standards YAML
into the recipe table.
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
