import string
import ctypes
import socket
import getpass
from pathlib import Path
from datetime import datetime

project_dir = Path(__file__).resolve().parent
env_path = project_dir / ".env"
env_example_path = project_dir / ".env.example"


def get_available_drives():
    bitmask = ctypes.windll.kernel32.GetLogicalDrives()
    drives = []
    for i, letter in enumerate(string.ascii_uppercase):
        if bitmask & (1 << i):
            drives.append(f"{letter}:\\")
    return drives


def read_existing_env():
    data = {}

    if not env_path.exists():
        return data

    for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
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


def find_pg_bin():
    candidates = [
        Path(r"C:\Program Files\PostgreSQL\17\bin"),
        Path(r"C:\Program Files\PostgreSQL\16\bin"),
        Path(r"C:\Program Files\PostgreSQL\15\bin"),
    ]

    for candidate in candidates:
        if (candidate / "pg_dump.exe").exists() and (candidate / "pg_restore.exe").exists():
            return str(candidate.resolve())

    for drive in get_available_drives():
        base_dir = Path(drive) / "Program Files" / "PostgreSQL"

        if not base_dir.exists():
            continue

        versions = sorted(base_dir.glob("*"), reverse=True)

        for version_dir in versions:
            bin_path = version_dir / "bin"

            if (bin_path / "pg_dump.exe").exists() and (bin_path / "pg_restore.exe").exists():
                return str(bin_path.resolve())

    return ""


def find_node_path():
    for drive in get_available_drives():
        candidates = [
            Path(drive) / "Program Files" / "nodejs" / "node.exe",
            Path(drive) / "Program Files (x86)" / "nodejs" / "node.exe",
        ]

        for candidate in candidates:
            if candidate.exists():
                return str(candidate.resolve())

    return ""


def find_chrome_path():
    for drive in get_available_drives():
        candidates = [
            Path(drive) / "Program Files" / "Google" / "Chrome" / "Application" / "chrome.exe",
            Path(drive) / "Program Files (x86)" / "Google" / "Chrome" / "Application" / "chrome.exe",
        ]

        for candidate in candidates:
            if candidate.exists():
                return str(candidate.resolve())

    return ""

def find_dropbox_backup_dir():
    relative_parts = ["DROPBOX", "Dropbox", "HDDBTEST", "HDDB_PROJECT", "web_receiver", "backup"]

    for drive in get_available_drives():
        candidate = Path(drive).joinpath(*relative_parts)
        if candidate.exists() and candidate.is_dir():
            return str(candidate.resolve())

    for drive in get_available_drives():
        dropbox_root = Path(drive) / "DROPBOX" / "Dropbox"
        if dropbox_root.exists() and dropbox_root.is_dir():
            candidate = dropbox_root / "HDDBTEST" / "HDDB_PROJECT" / "web_receiver" / "backup"
            candidate.mkdir(parents=True, exist_ok=True)
            return str(candidate.resolve())

    return ""


def ensure_gitignore():
    gitignore_path = project_dir / ".gitignore"
    current = ""

    if gitignore_path.exists():
        current = gitignore_path.read_text(encoding="utf-8", errors="ignore")

    required_lines = [
        ".env",
        ".env.*",
        "!.env.example",
        "node_modules/",
        "backup/*.backup",
        "backup/*.dump",
        "backup/*.sql",
        "*.log",
        ".vs/",
        "bin/",
        "obj/",
        "Thumbs.db",
        "Desktop.ini",
    ]

    additions = []

    for line in required_lines:
        if line not in current:
            additions.append(line)

    if additions:
        with gitignore_path.open("a", encoding="utf-8") as f:
            f.write("\n# HD Origin Project local files\n")
            for line in additions:
                f.write(line + "\n")


existing = read_existing_env()

db_password = existing.get("DB_PASSWORD", "")

if not db_password:
    print("DB_PASSWORD が .env にありません。初回のみ入力してください。")
    db_password = getpass.getpass("DB_PASSWORD: ")

backup_dir = find_dropbox_backup_dir() or existing.get("BACKUP_DIR", "")

if not backup_dir:
    backup_dir = str((project_dir / "backup").resolve())

Path(backup_dir).mkdir(parents=True, exist_ok=True)

env_vars = {
    "PROJECT_DIR": str(project_dir.resolve()),
    "PORT": existing.get("PORT", "3000"),
    "APP_NAME": existing.get("APP_NAME", "HD Origin Project"),

    "DB_HOST": existing.get("DB_HOST", "127.0.0.1"),
    "DB_PORT": existing.get("DB_PORT", "5432"),
    "DB_NAME": existing.get("DB_NAME", "hd_origin_project"),
    "DB_USER": existing.get("DB_USER", "postgres"),
    "DB_PASSWORD": db_password,

    "PG_BIN_PATH": find_pg_bin(),
    "BACKUP_DIR": backup_dir,
    "BACKUP_KEEP_NORMAL": existing.get("BACKUP_KEEP_NORMAL", "10"),
    "BACKUP_KEEP_BEFORE_RESTORE": existing.get("BACKUP_KEEP_BEFORE_RESTORE", "3"),
    "PROJECT_BACKUP_KEEP": existing.get("PROJECT_BACKUP_KEEP", "5"),

    "NODE_PATH": find_node_path(),
    "CHROME_PATH": find_chrome_path(),
}

with env_path.open("w", encoding="utf-8") as f:
    for key, value in env_vars.items():
        f.write(f"{key}={value if value is not None else ''}\n")

    hostname = socket.gethostname()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    f.write(f"# LOG: updated on {timestamp} by {hostname}\n")

with env_example_path.open("w", encoding="utf-8") as f:
    f.write("PROJECT_DIR=C:\\path\\to\\hd-origin-project\n")
    f.write("PORT=3000\n")
    f.write("APP_NAME=HD Origin Project\n")
    f.write("DB_HOST=127.0.0.1\n")
    f.write("DB_PORT=5432\n")
    f.write("DB_NAME=hd_origin_project\n")
    f.write("DB_USER=postgres\n")
    f.write("DB_PASSWORD=CHANGE_ME\n")
    f.write("PG_BIN_PATH=C:\\Program Files\\PostgreSQL\\17\\bin\n")
    f.write("BACKUP_DIR=C:\\path\\to\\backup\n")
    f.write("NODE_PATH=C:\\Program Files\\nodejs\\node.exe\n")
    f.write("CHROME_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe\n")

ensure_gitignore()

print("")
print(".env を最新版で上書きしました。")
print(f"PROJECT_DIR : {env_vars['PROJECT_DIR']}")
print(f"PG_BIN_PATH : {env_vars['PG_BIN_PATH']}")
print(f"BACKUP_DIR  : {env_vars['BACKUP_DIR']}")
print(f"NODE_PATH   : {env_vars['NODE_PATH']}")
print(f"CHROME_PATH : {env_vars['CHROME_PATH']}")
print("")
print("完了です。")



