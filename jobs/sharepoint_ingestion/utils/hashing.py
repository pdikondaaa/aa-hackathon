import hashlib


def compute_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def compute_sha256_file(file_path: str) -> str:
    with open(file_path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()
