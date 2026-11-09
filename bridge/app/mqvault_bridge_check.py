"""Build gate: the package must pass the read-only check (claims S1/S2) before it is compiled."""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "prototype"))
import check_readonly  # noqa: E402

problems = [p for f in sorted((pathlib.Path(__file__).parent / "mqvault_bridge").rglob("*.py")) for p in check_readonly.violations(f)]
print("\n".join(problems) or "read-only check: clean")
sys.exit(1 if problems else 0)
