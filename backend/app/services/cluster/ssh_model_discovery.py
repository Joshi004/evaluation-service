"""The SSH/SFTP implementation of the `ModelDiscovery` port.

`list_checkpoint_candidates` walks the configured models area with one
`find`; `inspect_checkpoint` and `validate_checkpoint` each read one
candidate's own files. Every reference passes through
`services.discovery.references.validate_reference` first (R-D10), and
every inference rule lives in `services.discovery.inspection` as a pure
function over already-read dicts and filenames -- this class only does
the I/O and assembles the DTOs.
"""

import json
import posixpath
import shlex
from datetime import UTC, datetime
from typing import Any

from app.config import get_settings
from app.schemas.discovery import (
    CheckpointAvailability,
    CheckpointCandidate,
    CheckpointInspection,
)
from app.services.cluster import connector
from app.services.discovery import inspection
from app.services.discovery.references import validate_reference

settings = get_settings()

# The two filenames that mark a directory as a checkpoint candidate --
# a full model's own config, or a LoRA adapter's.
_CANDIDATE_CONFIG_FILENAMES = ("config.json", "adapter_config.json")


def _parse_json_text(text: str | None) -> dict[str, Any] | None:
    """An already-read file's text as a dict, or None if it was never
    read, isn't valid JSON, or doesn't parse to an object -- the shape
    every file this module reads is expected to have.
    """
    if text is None:
        return None
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


class SshModelDiscovery:
    """`ModelDiscovery` over the same pooled login connection
    `SshSlurmClusterRuntime` uses. `get_model_discovery()` in
    `__init__.py` is the one place that constructs it (R-D12).
    """

    async def list_checkpoint_candidates(self) -> list[CheckpointCandidate]:
        """One `find` for the whole tree (R-T7: bounded by
        `discovery_max_depth`, the same command timeout as every other
        connector call), then one SFTP `readdir` per unique parent
        directory for `modified_at` -- never a `du` here (R-T8: size
        belongs in `inspect_checkpoint` only).
        """
        # config.json sits one level below the candidate directory itself.
        find_depth = settings.discovery_max_depth + 1
        name_clauses = " -o ".join(
            f"-name {shlex.quote(name)}" for name in _CANDIDATE_CONFIG_FILENAMES
        )
        command = (
            f"find {shlex.quote(settings.cluster_models_root)} -maxdepth {find_depth} "
            f"-name '.*' -prune -o -type f \\( {name_clauses} \\) -print"
        )
        result = await connector.run_command(command)

        # A directory holding both config.json and adapter_config.json
        # must still yield exactly one candidate -- a dict, keyed by
        # directory, does that dedup for free.
        candidate_directories: dict[str, None] = {}
        for line in result.stdout.splitlines():
            config_path = line.strip()
            if config_path:
                candidate_directories[posixpath.dirname(config_path)] = None

        parent_directories = sorted({posixpath.dirname(path) for path in candidate_directories})
        listings = await connector.list_remote_directories(parent_directories)
        entry_by_parent_and_name = {
            (parent, entry.name): entry for parent, entries in listings.items() for entry in entries
        }

        candidates = []
        for candidate_directory in sorted(candidate_directories):
            parent = posixpath.dirname(candidate_directory)
            name = posixpath.basename(candidate_directory)
            entry = entry_by_parent_and_name.get((parent, name))
            candidates.append(
                CheckpointCandidate(
                    reference=candidate_directory,
                    display_name=name,
                    modified_at=entry.modified_at if entry is not None else None,
                )
            )
        return candidates

    async def inspect_checkpoint(self, reference: str) -> CheckpointInspection:
        """Validates the reference (R-D10), resolves it to its canonical
        form (symlinks included -- R-D23: two spellings of one directory
        must read as one checkpoint), then reads config.json,
        generation_config.json, adapter_config.json, and
        model.safetensors.index.json over one SFTP session (R-D9),
        lists the directory to determine weight format and shard count,
        and gets the total size with one `du -sb`. Never raises for a
        missing optional file -- it is recorded in `problems` and the
        field is left None (R-D15); only an invalid reference or a dead
        connection escapes this method.
        """
        validated = validate_reference(reference)
        canonical = await self._canonical_reference(validated)
        display_name = posixpath.basename(canonical)

        config_path = posixpath.join(canonical, "config.json")
        generation_config_path = posixpath.join(canonical, "generation_config.json")
        adapter_config_path = posixpath.join(canonical, "adapter_config.json")
        index_path = posixpath.join(canonical, "model.safetensors.index.json")
        texts = await connector.read_remote_texts(
            [config_path, generation_config_path, adapter_config_path, index_path]
        )

        problems: list[str] = []

        config = _parse_json_text(texts[config_path])
        if texts[config_path] is None:
            problems.append("config.json could not be read")
        elif config is None:
            problems.append("config.json is not valid JSON")

        generation_config = _parse_json_text(texts[generation_config_path])
        if texts[generation_config_path] is None:
            problems.append("generation_config.json could not be read")
        elif generation_config is None:
            problems.append("generation_config.json is not valid JSON")

        # adapter_config.json and the safetensors index are both
        # legitimately absent for most checkpoints (no LoRA adapter,
        # single-shard weights) -- only a present-but-unparsable file
        # is a problem worth reporting.
        adapter_config = _parse_json_text(texts[adapter_config_path])
        if texts[adapter_config_path] is not None and adapter_config is None:
            problems.append("adapter_config.json is not valid JSON")

        safetensors_index = _parse_json_text(texts[index_path])
        if texts[index_path] is not None and safetensors_index is None:
            problems.append("model.safetensors.index.json is not valid JSON")

        listings = await connector.list_remote_directories([canonical])
        entries = listings.get(canonical, [])
        if not entries:
            problems.append("directory listing failed or returned no entries")
        filenames = [entry.name for entry in entries if not entry.is_directory]

        weight_layout = inspection.infer_weight_layout(filenames, safetensors_index)
        if weight_layout.weight_format is None:
            problems.append("no weight files found (.safetensors or .bin)")
        if weight_layout.missing_shards:
            problems.append(f"missing shard(s): {', '.join(weight_layout.missing_shards)}")

        size_bytes = await self._checkpoint_size_bytes(canonical)
        if size_bytes is None:
            problems.append("could not determine checkpoint size (du failed)")

        return CheckpointInspection(
            reference=canonical,
            display_name=display_name,
            model_type=inspection.infer_model_type(config) if config is not None else None,
            architecture=inspection.infer_architecture(config) if config is not None else None,
            base_model=(
                inspection.infer_base_model(config, adapter_config, display_name)
                if config is not None
                else None
            ),
            context_length=(
                inspection.infer_context_length(config) if config is not None else None
            ),
            torch_dtype=inspection.infer_torch_dtype(config) if config is not None else None,
            quantization=inspection.infer_quantization(config) if config is not None else None,
            weight_format=weight_layout.weight_format,
            shard_count=weight_layout.shard_count,
            size_bytes=size_bytes,
            generation_config=generation_config,
            source_config=config,
            readable=config is not None,
            problems=problems,
            missing_requirements=inspection.missing_model_requirements(
                config, weight_layout, filenames
            ),
        )

    async def validate_checkpoint(self, reference: str) -> CheckpointAvailability:
        """`unavailable` when the directory or config.json is gone or
        unreadable; `incomplete` when config.json is present but no
        weight file is, or a named shard is missing; `available`
        otherwise. `detail` always carries the specific reason for a
        non-available result.
        """
        validated = validate_reference(reference)
        checked_at = datetime.now(UTC)

        config_path = posixpath.join(validated, "config.json")
        index_path = posixpath.join(validated, "model.safetensors.index.json")
        texts = await connector.read_remote_texts([config_path, index_path])
        config = _parse_json_text(texts[config_path])

        listings = await connector.list_remote_directories([validated])
        entries = listings.get(validated, [])
        filenames = [entry.name for entry in entries if not entry.is_directory]

        if config is None or not entries:
            detail = (
                "config.json is missing or unreadable"
                if config is None
                else "the checkpoint directory is missing or unreadable"
            )
            return CheckpointAvailability(
                reference=validated,
                status="unavailable",
                detail=detail,
                size_bytes=None,
                checked_at=checked_at,
            )

        safetensors_index = _parse_json_text(texts[index_path])
        weight_layout = inspection.infer_weight_layout(filenames, safetensors_index)
        size_bytes = await self._checkpoint_size_bytes(validated)

        if weight_layout.weight_format is None:
            return CheckpointAvailability(
                reference=validated,
                status="incomplete",
                detail="no weight files found (.safetensors or .bin)",
                size_bytes=size_bytes,
                checked_at=checked_at,
            )
        if weight_layout.missing_shards:
            return CheckpointAvailability(
                reference=validated,
                status="incomplete",
                detail=f"missing shard(s): {', '.join(weight_layout.missing_shards)}",
                size_bytes=size_bytes,
                checked_at=checked_at,
            )

        return CheckpointAvailability(
            reference=validated,
            status="available",
            detail=None,
            size_bytes=size_bytes,
            checked_at=checked_at,
        )

    async def _checkpoint_size_bytes(self, validated_reference: str) -> int | None:
        """One `du -sb` -- shared by inspect and validate rather than
        duplicated, since both need the exact same number and neither
        needs it more than once per call (R-T8).
        """
        result = await connector.run_command(f"du -sb {shlex.quote(validated_reference)}")
        if result.exit_status != 0 or not result.stdout.strip():
            return None
        try:
            return int(result.stdout.split(maxsplit=1)[0])
        except ValueError:
            return None

    async def _canonical_reference(self, validated_reference: str) -> str:
        """The reference with every symlink resolved, so two spellings
        of one directory cannot become two checkpoints (R-D23). Now that
        a reference can name anything rather than only paths under one
        curated root, an automount alias or a convenience symlink in a
        home directory is a realistic way to register the same weights
        twice under two names.

        Falls back to the reference as given when `readlink -f` fails --
        a path that does not resolve is something the inspection this
        feeds should report as a missing config, not a reason to refuse
        to look at all.
        """
        result = await connector.run_command(f"readlink -f {shlex.quote(validated_reference)}")
        canonical = result.stdout.strip()
        if result.exit_status != 0 or not canonical:
            return validated_reference
        return validate_reference(canonical)
