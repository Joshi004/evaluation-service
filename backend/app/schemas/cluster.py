"""Response shapes for the cluster resource -- today, just the SLURM
partition listing behind the Submit page's partition picker.

These are also the return type of `ClusterRuntime.list_partitions()`
(app/services/cluster/ports.py), so a partition is described the same
way whether it arrived through the API or was read straight out of an
implementation -- the same pattern app/schemas/discovery.py already
follows for `ModelDiscovery`.
"""

from pydantic import BaseModel


class SlurmPartition(BaseModel):
    """One partition as `scontrol show partition` reports it. `hidden`
    is why this listing has to come from the cluster rather than being
    hardcoded: `background` (this deployment's own default,
    Settings.slurm_partition) is a real partition with `Hidden=YES`, so
    it never appears in SLURM's own unqualified `sinfo`/`squeue`
    output, only in a `scontrol --all` listing like this one.

    `allowed` reflects nothing here -- `AllowGroups`/`AllowAccounts` are
    deliberately not surfaced (see `SshSlurmClusterRuntime.list_partitions`'s
    docstring): a partition this account cannot actually use still shows
    up, and sbatch is what gives the real answer if it's picked anyway.
    """

    name: str
    state: str
    hidden: bool
    priority_tier: int


class ClusterPartitions(BaseModel):
    """GET /api/v1/cluster/partitions' whole response: every partition
    the cluster reports, plus which one this deployment falls back to
    when a submit doesn't name one explicitly -- so the picker can
    label that option "Default" without hardcoding the name itself.
    """

    default_partition: str
    partitions: list[SlurmPartition]
