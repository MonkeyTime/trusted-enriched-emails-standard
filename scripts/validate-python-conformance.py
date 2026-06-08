from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "packages" / "python" / "src"))

from realtime_mail import ActionValidator, ManifestValidator, MessageValidator, ValidationError  # noqa: E402


CASES = [
    ("conformance/valid-manifest.acme.json", ManifestValidator, True),
    ("conformance/invalid-manifest.missing-keys.json", ManifestValidator, False),
    ("conformance/invalid-manifest.unknown-channel-property.json", ManifestValidator, False),
    ("conformance/valid-message.invoice.json", MessageValidator, True),
    ("conformance/invalid-message.script-without-capability.json", MessageValidator, False),
    ("conformance/invalid-message.unknown-property.json", MessageValidator, False),
    ("conformance/valid-action.open-url.json", ActionValidator, True),
    ("conformance/invalid-action.no-user-gesture.json", ActionValidator, False),
    ("conformance/invalid-action.cross-domain-url.json", ActionValidator, False),
]


def main() -> int:
    failures = 0
    for file_name, validator, should_be_valid in CASES:
        value = json.loads((ROOT / file_name).read_text(encoding="utf-8"))
        try:
            validator.parse(value)
            if should_be_valid:
                print(f"PASS {file_name}")
            else:
                print(f"FAIL {file_name}: expected validation failure")
                failures += 1
        except ValidationError as error:
            if should_be_valid:
                print(f"FAIL {file_name}: {error}")
                failures += 1
            else:
                print(f"PASS {file_name}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
