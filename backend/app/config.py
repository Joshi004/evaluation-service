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
    # The configured models area (Phase 2). The seeded checkpoint lives
    # directly under it; candidates can also nest below that, e.g. in
    # rl/ and sft/ subdirectories.
    cluster_models_root: str = "/home/shared/agentic_slm/models"
    # How deep below cluster_models_root to look for a candidate
    # directory. config.json sits one level below the candidate itself,
    # so the `find` bound used by discovery is this value plus one.
    discovery_max_depth: int = 2

    # Our own server (Appendix C).
    output_root: str = "/data/evalsvc/runs"
    # Two settings for one directory: output_root is where the backend
    # reads the run tree, output_root_host_path is what `docker run -v`
    # is given, because the harness container is created by the host
    # Docker daemon and never sees our own mount namespace. Same split
    # as CLUSTER_SSH_KEY_HOST_PATH below and in docker-compose.yml.
    output_root_host_path: str = "./runs"
    hf_home: str = "/data/evalsvc/hf-cache"
    harness_image: str = "registry.local/evalscope:2ce95c3"
    # The docker-compose network the backend's own container is on, so
    # a harness container joins it and can reach the Phase 3 tunnel at
    # http://backend:PORT/v1 (see services/cluster/tunnel.py).
    harness_docker_network: str = "evaluation-service_default"
    catalog_dir: str = "/catalog"


@lru_cache
def get_settings() -> Settings:
    return Settings()
