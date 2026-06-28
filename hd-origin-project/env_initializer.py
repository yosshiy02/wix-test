import os
import string
import ctypes
import socket
import getpass
import shutil
from pathlib import Path
from datetime import datetime

PROJECT_DIR = Path(__file__).resolve().parent
ENV_PATH = PROJECT_DIR / ".env"
ENV_EXAMPLE_PATH = PROJECT_DIR / ".env.example"
PROJECT_DRIVE = PROJECT_DIR.anchor


def get_available_drives():
    drives = []

    if os.name == "nt":
        try:
            bitmask = ctypes.windll.kernel32.GetLogicalDrives()
            for i, letter in enumerate(string.ascii_uppercase):
                if bitmask & (1 << i):
                    drives.append(f"{letter}:\\")
        except Exception:
            pass

    if not drives:
        drives.append(str(PROJECT_DIR.anchor))

    return drives


def read_existing_env():
    data = {}

    if not ENV_PATH.exists():
        return data

    for line in ENV_PATH.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()

        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        data[key.strip()] = value.strip()

    return data


def is_file(path_text):
    if not path_text:
        return False
    try:
        return Path(path_text).exists() and Path(path_text).is_file()
    except Exception:
        return False


def is_dir(path_text):
    if not path_text:
        return False
    try:
        return Path(path_text).exists() and Path(path_text).is_dir()
    except Exception:
        return False


def uniq_paths(paths):
    seen = set()
    result = []

    for p in paths:
        if not p:
            continue

        try:
            rp = str(Path(p).resolve())
        except Exception:
            rp = str(p)

        key = rp.lower()
        if key not in seen:
            seen.add(key)
            result.append(Path(rp))

    return result


def find_exe_from_path(exe_name):
    found = shutil.which(exe_name)
    if found and Path(found).exists():
        return str(Path(found).resolve())
    return ""


def find_node_path(existing=None):
    candidates = []

    if existing and is_file(existing):
        candidates.append(existing)

    # 1. プロジェクトと同じドライブを最優先
    for base in [
        Path(PROJECT_DRIVE) / "Apps" / "NodeJS",
        Path(PROJECT_DRIVE) / "Apps" / "nodejs",
        Path(PROJECT_DRIVE) / "NodeJS",
        Path(PROJECT_DRIVE) / "nodejs",
    ]:
        candidates.append(base / "node.exe")

    # 2. 全ドライブのよく使う配置
    for drive in get_available_drives():
        d = Path(drive)

        candidates.extend([
            d / "Apps" / "NodeJS" / "node.exe",
            d / "Apps" / "nodejs" / "node.exe",
            d / "Program Files" / "nodejs" / "node.exe",
            d / "Program Files (x86)" / "nodejs" / "node.exe",
        ])

    # 3. PATH
    path_node = find_exe_from_path("node.exe") or find_exe_from_path("node")
    if path_node:
        candidates.append(path_node)

    for candidate in uniq_paths(candidates):
        if candidate.exists() and candidate.is_file():
            return str(candidate.resolve())

    # 4. 探索範囲を絞った追加検索
    for drive in get_available_drives():
        for root in [
            Path(drive) / "Apps",
            Path(drive) / "Program Files",
            Path(drive) / "Program Files (x86)",
        ]:
            if not root.exists():
                continue

            try:
                for node_exe in root.glob("**/node.exe"):
                    if node_exe.exists() and node_exe.is_file():
                        return str(node_exe.resolve())
            except Exception:
                continue

    return ""


def find_npm_cmd(node_path):
    if not node_path:
        return ""

    node_dir = Path(node_path).resolve().parent

    candidates = [
        node_dir / "npm.cmd",
        node_dir / "npm",
    ]

    path_npm = find_exe_from_path("npm.cmd") or find_exe_from_path("npm")
    if path_npm:
        candidates.append(path_npm)

    for candidate in uniq_paths(candidates):
        if candidate.exists() and candidate.is_file():
            return str(candidate.resolve())

    return ""


def valid_pg_bin(bin_path):
    if not bin_path:
        return False

    p = Path(bin_path)

    return (
        p.exists()
        and p.is_dir()
        and (p / "psql.exe").exists()
        and (p / "pg_dump.exe").exists()
        and (p / "pg_restore.exe").exists()
    )


def find_pg_bin(existing=None):
    candidates = []

    if existing and valid_pg_bin(existing):
        candidates.append(existing)

    # 1. プロジェクトと同じドライブを最優先
    for version in ["17", "16", "15"]:
        candidates.extend([
            Path(PROJECT_DRIVE) / "Apps" / "PostgreSQL" / version / "bin",
            Path(PROJECT_DRIVE) / "PostgreSQL" / version / "bin",
            Path(PROJECT_DRIVE) / "Program Files" / "PostgreSQL" / version / "bin",
        ])

    # 2. 全ドライブのよく使う配置
    for drive in get_available_drives():
        d = Path(drive)

        for version in ["17", "16", "15", "14"]:
            candidates.extend([
                d / "Apps" / "PostgreSQL" / version / "bin",
                d / "PostgreSQL" / version / "bin",
                d / "Program Files" / "PostgreSQL" / version / "bin",
                d / "Program Files (x86)" / "PostgreSQL" / version / "bin",
            ])

    # 3. PATHのpsql.exeからbinを逆算
    psql_path = find_exe_from_path("psql.exe") or find_exe_from_path("psql")
    if psql_path:
        candidates.append(Path(psql_path).resolve().parent)

    for candidate in uniq_paths(candidates):
        if valid_pg_bin(candidate):
            return str(candidate.resolve())

    # 4. 探索範囲を絞った追加検索
    for drive in get_available_drives():
        for root in [
            Path(drive) / "Apps" / "PostgreSQL",
            Path(drive) / "PostgreSQL",
            Path(drive) / "Program Files" / "PostgreSQL",
            Path(drive) / "Program Files (x86)" / "PostgreSQL",
        ]:
            if not root.exists():
                continue

            try:
                for psql_exe in root.glob("**/psql.exe"):
                    bin_path = psql_exe.parent
                    if valid_pg_bin(bin_path):
                        return str(bin_path.resolve())
            except Exception:
                continue

    return ""


def find_chrome_path(existing=None):
    candidates = []

    if existing and is_file(existing):
        candidates.append(existing)

    for drive in get_available_drives():
        d = Path(drive)

        candidates.extend([
            d / "Program Files" / "Google" / "Chrome" / "Application" / "chrome.exe",
            d / "Program Files (x86)" / "Google" / "Chrome" / "Application" / "chrome.exe",
        ])

    for candidate in uniq_paths(candidates):
        if candidate.exists() and candidate.is_file():
            return str(candidate.resolve())

    return ""


def find_dropbox_backup_dir(existing=None):
    # 既存BACKUP_DIRが実在するなら尊重
    if existing and is_dir(existing):
        return str(Path(existing).resolve())

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

    # Dropboxが無いPCではプロジェクト内backupへ逃がす
    local_backup = PROJECT_DIR / "web_receiver" / "backup"
    local_backup.mkdir(parents=True, exist_ok=True)
    return str(local_backup.resolve())


def ensure_gitignore():
    gitignore_path = PROJECT_DIR / ".gitignore"
    current = ""

    if gitignore_path.exists():
        current = gitignore_path.read_text(encoding="utf-8", errors="ignore")

    required_lines = [
        ".env",
        ".env.*",
        "!.env.example",
        "node_modules/",
        "web_receiver/node_modules/",
        "web_receiver/backup/*.backup",
        "web_receiver/backup/*.dump",
        "web_receiver/backup/*.sql",
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


def write_env_example():
    with ENV_EXAMPLE_PATH.open("w", encoding="utf-8") as f:
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
        f.write("BACKUP_KEEP_NORMAL=10\n")
        f.write("BACKUP_KEEP_BEFORE_RESTORE=3\n")
        f.write("PROJECT_BACKUP_KEEP=5\n")
        f.write("NODE_PATH=C:\\Program Files\\nodejs\\node.exe\n")
        f.write("CHROME_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe\n")


def main():
    existing = read_existing_env()

    db_password = existing.get("DB_PASSWORD", "")

    if not db_password:
        print("DB_PASSWORD が .env にありません。初回のみ入力してください。")
        db_password = getpass.getpass("DB_PASSWORD: ")

    node_path = find_node_path(existing.get("NODE_PATH", ""))
    pg_bin_path = find_pg_bin(existing.get("PG_BIN_PATH", ""))
    chrome_path = find_chrome_path(existing.get("CHROME_PATH", ""))
    backup_dir = find_dropbox_backup_dir(existing.get("BACKUP_DIR", ""))

    env_vars = {
        "PROJECT_DIR": str(PROJECT_DIR.resolve()),
        "PORT": existing.get("PORT", "3000"),
        "APP_NAME": existing.get("APP_NAME", "HD Origin Project"),

        "DB_HOST": existing.get("DB_HOST", "127.0.0.1"),
        "DB_PORT": existing.get("DB_PORT", "5432"),
        "DB_NAME": existing.get("DB_NAME", "hd_origin_project"),
        "DB_USER": existing.get("DB_USER", "postgres"),
        "DB_PASSWORD": db_password,

        "PG_BIN_PATH": pg_bin_path,
        "BACKUP_DIR": backup_dir,
        "BACKUP_KEEP_NORMAL": existing.get("BACKUP_KEEP_NORMAL", "10"),
        "BACKUP_KEEP_BEFORE_RESTORE": existing.get("BACKUP_KEEP_BEFORE_RESTORE", "3"),
        "PROJECT_BACKUP_KEEP": existing.get("PROJECT_BACKUP_KEEP", "5"),

        "NODE_PATH": node_path,
        "CHROME_PATH": chrome_path,
    }

    with ENV_PATH.open("w", encoding="utf-8") as f:
        for key, value in env_vars.items():
            f.write(f"{key}={value if value is not None else ''}\n")

        hostname = socket.gethostname()
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        f.write(f"# LOG: updated on {timestamp} by {hostname}\n")

    write_env_example()
    ensure_gitignore()

    npm_path = find_npm_cmd(node_path)

    print("")
    print(".env を最新版で上書きしました。")
    print(f"PROJECT_DIR : {env_vars['PROJECT_DIR']}")
    print(f"PG_BIN_PATH : {env_vars['PG_BIN_PATH']}")
    print(f"BACKUP_DIR  : {env_vars['BACKUP_DIR']}")
    print(f"NODE_PATH   : {env_vars['NODE_PATH']}")
    print(f"NPM_PATH    : {npm_path}")
    print(f"CHROME_PATH : {env_vars['CHROME_PATH']}")

    print("")
    if not env_vars["NODE_PATH"]:
        print("警告: NODE_PATH が見つかりません。Node.js の場所を確認してください。")
    if not npm_path:
        print("警告: npm.cmd が見つかりません。Node.js ZIPの展開状態を確認してください。")
    if not env_vars["PG_BIN_PATH"]:
        print("警告: PG_BIN_PATH が見つかりません。PostgreSQL の場所を確認してください。")

    print("")
    print("完了です。")


if __name__ == "__main__":
    main()
