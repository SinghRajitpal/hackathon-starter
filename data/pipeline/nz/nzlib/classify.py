"""Gemini prompt and strict parsing for segment classification (PDF §5, spec D5 tier 2)."""

LABELS = ["exposed", "beneficiary", "neutral", "electricity_generation"]
BATCH_SIZE = 50

CLASSIFY_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "label": {"type": "string", "enum": LABELS},
                    "reason": {"type": "string"},
                },
                "required": ["id", "label", "reason"],
            },
        }
    },
    "required": ["items"],
}


def build_prompt(items: list[dict], exposed: list[str], beneficiary: list[str]) -> str:
    """items: [{"id": int, "company": str, "sub_industry": str, "segment": str}]."""
    lines = "\n".join(
        f'{i["id"]}. company="{i["company"]}" sub_industry="{i["sub_industry"]}" segment="{i["segment"]}"' for i in items
    )
    return (
        "You classify business segments of S&P 500 companies for a net-zero scenario model.\n"
        "Labels:\n"
        f"- exposed: the segment mainly sells one of these product lines: {'; '.join(exposed)}.\n"
        f"- beneficiary: the segment mainly sells one of these product lines: {'; '.join(beneficiary)}.\n"
        "- electricity_generation: the segment sells electricity produced by the company's own mix of power plants "
        "(regulated or merchant utilities); the fuel mix is handled separately.\n"
        "- neutral: anything else, including financing, insurance, services unrelated to the lists above.\n"
        "Use only the lists above. When unsure, choose neutral. Give a short reason for each item.\n"
        f"Segments:\n{lines}\n"
        "Return every id exactly once."
    )


def parse_labels(response: dict, items: list[dict]) -> dict[int, dict]:
    """Map id → {"label", "reason", "flag"}; missing or invalid answers become neutral with a flag."""
    expected = {i["id"] for i in items}
    out: dict[int, dict] = {}
    for entry in response.get("items", []):
        item_id = entry.get("id")
        if item_id not in expected or item_id in out:
            continue
        label = entry.get("label")
        if label in LABELS:
            out[item_id] = {"label": label, "reason": entry.get("reason", ""), "flag": None}
        else:
            out[item_id] = {"label": "neutral", "reason": "", "flag": "classification-invalid-label"}
    for item_id in expected - out.keys():
        out[item_id] = {"label": "neutral", "reason": "", "flag": "classification-missing"}
    return out


def batches(items: list[dict], size: int = BATCH_SIZE) -> list[list[dict]]:
    return [items[i : i + size] for i in range(0, len(items), size)]
