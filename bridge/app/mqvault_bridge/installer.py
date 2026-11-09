"""Per-user self-install of the single-file Bridge (no admin rights, no UAC, no service — §3.1).

Double-clicking MQVaultBridge.exe copies it to %LOCALAPPDATA%\\MQVault\\Bridge\\bin, registers it to start at sign-in
(HKCU Run) and in "Installed apps" (HKCU Uninstall), then starts the installed copy. Everything stays inside the
current user's profile and registry hive.
"""
from __future__ import annotations

import ctypes
import os
import pathlib
import shutil
import sys
import winreg

from . import config

APP_NAME = "MQVault Bridge"
RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
UNINSTALL_KEY = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\MQVaultBridge"
RUN_VALUE = "MQVaultBridge"
EXE_NAME = "MQVaultBridge.exe"


def running_exe() -> pathlib.Path | None:
    """Path of the packaged .exe, or None when running from source (python -m mqvault_bridge)."""
    candidate = pathlib.Path(os.path.abspath(sys.argv[0]))
    return candidate if candidate.suffix.lower() == ".exe" and candidate.name.lower() != "python.exe" else None


def installed_exe() -> pathlib.Path:
    return config.app_dir() / "bin" / EXE_NAME


def is_installed_copy(exe: pathlib.Path) -> bool:
    return exe.resolve() == installed_exe().resolve()


def message(text: str, error: bool = False) -> None:
    flags = 0x10 if error else 0x40  # MB_ICONERROR / MB_ICONINFORMATION
    ctypes.windll.user32.MessageBoxW(None, text, APP_NAME, flags)


def install(source: pathlib.Path) -> pathlib.Path:
    target = installed_exe()
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".new")
    shutil.copy2(source, temporary)
    os.replace(temporary, target)
    command = f'"{target}"'
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
        winreg.SetValueEx(key, RUN_VALUE, 0, winreg.REG_SZ, command)
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, UNINSTALL_KEY) as key:
        for name, value in {
            "DisplayName": APP_NAME, "DisplayVersion": config.VERSION, "Publisher": "MQVault",
            "InstallLocation": str(target.parent), "DisplayIcon": str(target), "UninstallString": f'{command} --uninstall',
        }.items():
            winreg.SetValueEx(key, name, 0, winreg.REG_SZ, value)
        winreg.SetValueEx(key, "NoModify", 0, winreg.REG_DWORD, 1)
        winreg.SetValueEx(key, "NoRepair", 0, winreg.REG_DWORD, 1)
        winreg.SetValueEx(key, "EstimatedSize", 0, winreg.REG_DWORD, max(1, target.stat().st_size // 1024))
    return target


def uninstall() -> None:
    """Removes autostart, the Installed-apps entry, the device key, the queue and logs. Trades in the journal stay.
    The PC should also be disconnected on the site (Connected computers → Disconnect)."""
    for path, value in ((RUN_KEY, RUN_VALUE), (UNINSTALL_KEY, None)):
        try:
            if value is None:
                winreg.DeleteKey(winreg.HKEY_CURRENT_USER, path)
            else:
                with winreg.OpenKey(winreg.HKEY_CURRENT_USER, path, 0, winreg.KEY_SET_VALUE) as key:
                    winreg.DeleteValue(key, value)
        except FileNotFoundError:
            pass
    home = config.app_dir()
    for item in home.iterdir():
        if item.name == "bin":
            continue
        shutil.rmtree(item, ignore_errors=True) if item.is_dir() else item.unlink(missing_ok=True)
    # The running .exe cannot delete itself: Windows removes it (and the folder) at the next restart.
    for leftover in (installed_exe(), installed_exe().parent, home):
        ctypes.windll.kernel32.MoveFileExW(str(leftover), None, 0x4)  # MOVEFILE_DELAY_UNTIL_REBOOT


def start_installed() -> None:
    os.startfile(str(installed_exe()))  # noqa: S606 - starts our own installed copy, no shell, no arguments
