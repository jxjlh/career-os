"""Backward-compatible entry point for building complete word books.

The old implementation ignored the book-word relation table and selected a
shared top-5,000 frequency list for every book. Keep this filename for existing
deployment or maintenance commands, but delegate to the complete importer.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from build_complete_word_books import build


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source_dir", type=Path)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "app/domains/english/seeds",
    )
    args = parser.parse_args()
    build(args.source_dir, args.output_dir)
