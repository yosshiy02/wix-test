import os
import socket
import getpass
from pathlib import Path
from datetime import datetime

PROJECT_ROOT = Path(__file__).resolve().parent
RUNTIME_PATHS_FILE = PROJECT_ROOT / "HD_ORIGIN_RUNTIME_PATHS.txt"
ENV_PATH_FILE = PROJECT_ROOT / ".env_path.txt"
ENV_EXAMPLE_PATH = PROJECT_ROOT / ".env.example"

SECRET_KEYS = [
    "DB_PASSWORD",
    "OPENAI_API_KEY",
    "HD_ORIGIN_RECEIPT_API_KEY",
    "AZURE_DOCUMENT_INTELLIGENCE_KEY",
    "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT",
]


def read_key_value_file(path):
    data = {}

    p = Path(path)

    if not p.exists() or not p.is_file():
        return data

    for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()

        if not line:
            continue

        if line.startswith("#"):
            continue

        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        data[key.strip()] = value.strip()

    return data


def write_secret_env(path, data):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)

    hostname = socket.gethostname()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with p.open("w", encoding="utf-8", newline="\n") as f:
        for key in SECRET_KEYS:
            f.write(f"{key}={data.get(key, '')}\n")

        f.write(f"# LOG: updated on {timestamp} by {hostname}\n")


def write_env_example():
    with ENV_EXAMPLE_PATH.open("w", encoding="utf-8", newline="\n") as f:
        f.write("DB_PASSWORD=CHANGE_ME\n")
        f.write("OPENAI_API_KEY=\n")
        f.write("HD_ORIGIN_RECEIPT_API_KEY=\n")
        f.write("AZURE_DOCUMENT_INTELLIGENCE_KEY=\n")
        f.write("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=\n")

def build_env_path(value):
    raw = (value or "").strip().strip('"')

    if not raw:
        return None

    p = Path(raw)

    if p.name.lower() == ".env":
        return p.resolve()

    if p.name.upper() == "ORIGIN":
        return (p / ".env").resolve()

    if p.name.upper() == "HDDBTEST":
        return (p / "HDDB_PROJECT" / "ORIGIN" / ".env").resolve()

    return (p / "HDDBTEST" / "HDDB_PROJECT" / "ORIGIN" / ".env").resolve()


def resolve_env_path(runtime):
    env_path = os.environ.get("HD_ORIGIN_ENV_PATH", "").strip().strip('"')

    p = build_env_path(env_path)
    if p:
        return p

    env_path = runtime.get("HD_ORIGIN_ENV_PATH", "").strip().strip('"')

    p = build_env_path(env_path)
    if p:
        return p

    raise FileNotFoundError(
        "HD_ORIGIN_ENV_PATH was not found. Run start_hd_origin.bat first."
    )


def main():
    if not RUNTIME_PATHS_FILE.exists():
        raise FileNotFoundError(
            "HD_ORIGIN_RUNTIME_PATHS.txt was not found. Run start_hd_origin.bat first."
        )

    runtime = read_key_value_file(RUNTIME_PATHS_FILE)
    env_path = resolve_env_path(runtime)

    existing_target_env = read_key_value_file(env_path)
    old_project_env = read_key_value_file(PROJECT_ROOT / ".env")

    secret_data = {}

    for key in SECRET_KEYS:
        secret_data[key] = existing_target_env.get(key, old_project_env.get(key, ""))

    if not secret_data.get("DB_PASSWORD"):
        print("DB_PASSWORD is missing.")
        secret_data["DB_PASSWORD"] = getpass.getpass("DB_PASSWORD: ")

    write_secret_env(env_path, secret_data)
    write_env_example()

    ENV_PATH_FILE.write_text(str(env_path), encoding="utf-8", newline="\n")

    print("")
    print("env_initializer completed.")
    print(f"ENV_PATH: {env_path}")
    print("")
    print(".env keys:")
    for key in SECRET_KEYS:
        print(key)
    print("")


if __name__ == "__main__":
    main()