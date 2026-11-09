"""Entry point for the packaged MQVaultBridge.exe (Nuitka compiles this file)."""
import multiprocessing
import sys

from mqvault_bridge.__main__ import main

if __name__ == "__main__":
    multiprocessing.freeze_support()
    sys.exit(main())
