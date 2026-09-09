"""Pure inference rules over an already-read `config.json` /
`adapter_config.json` / `model.safetensors.index.json` and a candidate's
file listing -- no I/O, so every rule for what an inspection reports is
readable in one place. `app.services.cluster.ssh_model_discovery` does
the reading and calls these; nothing here touches the network.

See docs/CHECKPOINT_REGISTRATION_PHASES.md Phase 2, item 5.
"""

from dataclasses import dataclass
from typing import Any


def infer_model_type(config: dict[str, Any]) -> str | None:
    model_type = config.get("model_type")
    return model_type if isinstance(model_type, str) else None


def infer_architecture(config: dict[str, Any]) -> str | None:
    architectures = config.get("architectures")
    if isinstance(architectures, list) and architectures and isinstance(architectures[0], str):
        return architectures[0]
    return None


def infer_context_length(config: dict[str, Any]) -> int | None:
    context_length = config.get("max_position_embeddings")
    return context_length if isinstance(context_length, int) else None


def infer_torch_dtype(config: dict[str, Any]) -> str | None:
    """`torch_dtype` is the key older checkpoints use; transformers 4.56+
    (confirmed against the seeded checkpoint, written by 4.56.2) renamed
    it to `dtype`. Reading `dtype` first means a current checkpoint
    doesn't inspect to None just because this DTO field keeps the old
    name (Section 0.5 fixes `CheckpointInspection.torch_dtype`'s name;
    this is only about which config.json key can feed it).
    """
    dtype = config.get("dtype")
    if isinstance(dtype, str):
        return dtype
    torch_dtype = config.get("torch_dtype")
    return torch_dtype if isinstance(torch_dtype, str) else None


def infer_quantization(config: dict[str, Any]) -> str | None:
    quantization_config = config.get("quantization_config")
    if isinstance(quantization_config, dict):
        quant_method = quantization_config.get("quant_method")
        if isinstance(quant_method, str):
            return quant_method
    return None


def infer_base_model(
    config: dict[str, Any],
    adapter_config: dict[str, Any] | None,
    candidate_directory_name: str,
) -> str | None:
    """Best effort, in order: an adapter's own base model, then
    `config["_name_or_path"]` when it says something other than this
    directory's own name. A hint the registration UI shows to help a
    person pick a parent -- never a lineage FK (R-D5):
    `parent_checkpoint_id` is set only by explicit selection.
    """
    if adapter_config is not None:
        base_model_name = adapter_config.get("base_model_name_or_path")
        if isinstance(base_model_name, str) and base_model_name:
            return base_model_name

    name_or_path = config.get("_name_or_path")
    if isinstance(name_or_path, str) and name_or_path and name_or_path != candidate_directory_name:
        return name_or_path

    return None


@dataclass(frozen=True)
class WeightLayout:
    """What a candidate's own file listing says about its weights.
    `missing_shards` lives here, rather than being recomputed
    separately, so `inspect_checkpoint`'s shard count and
    `validate_checkpoint`'s `incomplete` rule read the same computation
    and can never disagree about one candidate.
    """

    weight_format: str | None  # 'safetensors' | 'bin'
    shard_count: int | None
    missing_shards: list[str]


def infer_weight_layout(
    filenames: list[str], safetensors_index: dict[str, Any] | None
) -> WeightLayout:
    """`*.safetensors` count, else `pytorch_model*.bin` count -- the two
    weight formats registration needs to tell apart. When
    `model.safetensors.index.json` is present, its `weight_map` names
    the authoritative shard set; any shard it names that is missing
    from `filenames` is a truncated download, not just an unusual
    layout, so it is reported rather than silently ignored.
    """
    safetensor_files = sorted(name for name in filenames if name.endswith(".safetensors"))
    if safetensor_files:
        missing_shards: list[str] = []
        if safetensors_index is not None:
            weight_map = safetensors_index.get("weight_map")
            if isinstance(weight_map, dict):
                named_shards = {
                    shard_name for shard_name in weight_map.values() if isinstance(shard_name, str)
                }
                missing_shards = sorted(named_shards - set(filenames))
        return WeightLayout(
            weight_format="safetensors",
            shard_count=len(safetensor_files),
            missing_shards=missing_shards,
        )

    bin_files = sorted(
        name for name in filenames if name.startswith("pytorch_model") and name.endswith(".bin")
    )
    if bin_files:
        return WeightLayout(weight_format="bin", shard_count=len(bin_files), missing_shards=[])

    return WeightLayout(weight_format=None, shard_count=None, missing_shards=[])
