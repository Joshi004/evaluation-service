"""Standards / methodology endpoints.

Will render the version-controlled recipe YAML files under /standards
(see docker-compose.yml) readably: what each benchmark measures, every
Layer 2 setting and its source, the changelog, and the reference run it
was verified against. See EVAL_SERVICE_PLAN.md, Section 5 and Section 13
("Standards / methodology" page).

No routes yet.
"""

from fastapi import APIRouter

router = APIRouter()
