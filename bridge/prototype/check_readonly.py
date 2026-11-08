"""Prototype of security claim S1/S2 (docs/features/mt5-bridge.md): fail if bridge code can trade or touch passwords.

Scans every .py file under the given directory (default: this folder) with the AST, not with text search,
so comments and docstrings do not count and aliasing tricks like getattr(mt5, "order_send") are caught.

Usage: python -I check_readonly.py [dir]   -> exit 0 = clean, 1 = violations printed
"""
from __future__ import annotations

import ast
import pathlib
import sys

FORBIDDEN_NAMES = {
    "order_send", "order_check", "order_calc_margin", "order_calc_profit", "Close", "positions_close",
    "eval", "exec", "compile", "__import__", "importlib", "subprocess", "os.system", "pickle", "marshal",
}
FORBIDDEN_STRINGS = {"order_send", "order_check", "accounts.dat", "password"}
ALLOWED_INITIALIZE_KWARGS = {"path", "timeout"}


def violations(path: pathlib.Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8-sig"), filename=str(path))
    found: list[str] = []
    for node in ast.walk(tree):
        name = None
        if isinstance(node, ast.Name):
            name = node.id
        elif isinstance(node, ast.Attribute):
            name = node.attr
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            for alias in node.names:
                root = (getattr(node, "module", None) or alias.name).split(".")[0]
                if root in FORBIDDEN_NAMES or alias.name in FORBIDDEN_NAMES:
                    found.append(f"{path}:{node.lineno}: forbidden import {alias.name}")
        if name in FORBIDDEN_NAMES:
            found.append(f"{path}:{node.lineno}: forbidden name {name}")
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            # Docstrings are statements of their own; only string values used in code matter.
            lowered = node.value.lower()
            for needle in FORBIDDEN_STRINGS:
                if needle in lowered and not _is_docstring(tree, node):
                    found.append(f"{path}:{node.lineno}: forbidden string {needle!r}")
        if isinstance(node, ast.Call) and isinstance(node.func, (ast.Name, ast.Attribute, ast.Subscript)):
            callee = node.func.attr if isinstance(node.func, ast.Attribute) else getattr(node.func, "id", None)
            if isinstance(node.func, ast.Subscript) and isinstance(node.func.slice, ast.Constant):
                callee = node.func.slice.value
            if callee == "initialize":
                extra = {kw.arg for kw in node.keywords} - ALLOWED_INITIALIZE_KWARGS
                if extra or node.args:
                    found.append(f"{path}:{node.lineno}: initialize() may only receive path/timeout, got {sorted(extra) or 'positional args'}")
    return found


def _is_docstring(tree: ast.AST, constant: ast.Constant) -> bool:
    for node in ast.walk(tree):
        body = getattr(node, "body", None)
        if isinstance(body, list) and body and isinstance(body[0], ast.Expr) and body[0].value is constant:
            return True
    return False


def main() -> int:
    root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).parent)
    me = pathlib.Path(__file__).resolve()
    problems = [problem for file in sorted(root.rglob("*.py")) if file.resolve() != me for problem in violations(file)]
    print("\n".join(problems) or f"read-only check: clean ({root})")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
