"""Validates a checkpoint discovery reference before it reaches any
remote command or SFTP call (R-D10). Every operation in `ModelDiscovery`
-- list, inspect, validate -- resolves its reference through here
first; `shlex.quote()` is then applied on top wherever a reference
reaches a shell command, as defence in depth rather than because this
function alone is trusted to be enough.
"""

import posixpath


class InvalidReferenceError(Exception):
    """A reference that failed validation. The router maps this to 400
    -- a failed validation is rejected outright, never a sanitised retry
    (R-D10).
    """


def validate_reference(reference: str) -> str:
    """Normalises `reference` and confirms it is a well-formed absolute
    path, raising InvalidReferenceError otherwise. Any absolute path is
    accepted -- a checkpoint is no longer confined to one configured
    models root, so this is a syntactic check, not a containment one.

    A literal ".." segment is rejected outright rather than resolved
    away -- R-D10 calls for a 400, not a sanitised retry, so this does
    not try to be clever about what a traversal attempt would normalise
    to. Uses posixpath rather than os.path: a reference names a path on
    the remote cluster, which is always POSIX, regardless of what this
    backend process itself runs on. This function does no I/O, so it
    cannot resolve a symlink -- `SshModelDiscovery._canonical_reference`
    does that over SSH, on a reference that has already passed here.
    """
    if "\x00" in reference:
        raise InvalidReferenceError("reference contains a null byte")

    if ".." in reference.split("/"):
        raise InvalidReferenceError(f"reference must not contain '..': {reference!r}")

    if not posixpath.isabs(reference):
        raise InvalidReferenceError(f"reference must be an absolute path: {reference!r}")

    return posixpath.normpath(reference)
