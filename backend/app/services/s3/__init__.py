"""S3 checkpoint browsing and staging.

EVAL_SERVICE_PLAN.md, Section 7: lists checkpoints in S3 with our own
credentials, registers them with lineage info, and — only when a run
needs weights that aren't already verified on the cluster — submits a
CPU-only staging job that runs `aws s3 sync` directly from S3 to the
cluster's shared NFS. Bytes never pass through our server.

Staging credentials are meant to be short-lived and scoped to one prefix
via `sts:AssumeRole`, minted per staging job rather than held as a
long-lived key.

Not implemented yet. `boto3` / `aiobotocore` will be added as a dependency
when this is built out.
"""
