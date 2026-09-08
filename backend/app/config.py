"""Application configuration, loaded from environment variables / .env.

See docker-compose.yml for how DATABASE_URL is supplied in the
containerized dev environment.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Evaluation Service"
    api_v1_prefix: str = "/api/v1"

    database_url: str = "postgresql+asyncpg://eval_service:eval_service@postgres:5432/eval_service"

    cors_origins: list[str] = ["http://localhost:5173"]

    # The cluster, which used to be a table (Appendix C). With one cluster,
    # every cluster_id would be a constant on five tables, so these are
    # deployment config next to the SSH key rather than data in a UI.
    # Unused until Phase 3 -- declared now so the config surface exists
    # up front. Per decision D9, v1 authenticates as a personal account,
    # so every value here is plain config, never a secret store, and the
    # key path points at a file mounted read-only rather than holding key
    # content directly.
    cluster_ssh_host: str = "login-6"
    cluster_ssh_user: str = "naresh"
    cluster_ssh_key_path: str = "/secrets/cluster_ssh_key"
    # The backend image runs as root (no USER in the Dockerfile), so this
    # is where a read-only mount of the developer's own known_hosts lands
    # -- see docker-compose.yml. Verifying the login node's host key for
    # real (rather than known_hosts=None) costs nothing here: validation
    # already SSHed to it by hand, so the entry already exists.
    cluster_ssh_known_hosts_path: str = "/root/.ssh/known_hosts"
    cluster_ssh_port: int = 22
    cluster_proxy_jump: str = "login-6"
    slurm_partition: str = "main"
    slurm_walltime_seconds: int = 7200
    cluster_log_root: str = "/home/shared/eval-service/logs"

    # Our own server (Appendix C). Also unused until later phases.
    output_root: str = "/data/evalsvc/runs"
    hf_home: str = "/data/evalsvc/hf-cache"
    harness_image: str = "registry.local/evalscope:2ce95c3"
    standards_dir: str = "/standards"


@lru_cache
def get_settings() -> Settings:
    return Settings()
