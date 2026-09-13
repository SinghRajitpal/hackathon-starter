"""Demand exposure (DE) and beneficiary share (BEN) from classified segments (PDF §5, spec D7)."""

LABELS = ("exposed", "beneficiary", "neutral", "electricity_generation")


def de_ben(segments: list[dict], generation_mix: dict | None) -> dict:
    """segments: [{"revenue": float, "label": one of LABELS}].

    generation_mix: {"fossil_share": 0..1, "renewable_share": 0..1} of owned generation (MWh), or None.
    Returns {"de", "ben", "needs_generation_mix"}; de/ben None when revenue is unusable.
    """
    total = sum(max(float(s["revenue"]), 0.0) for s in segments)
    if total <= 0:
        return {"de": None, "ben": None, "needs_generation_mix": False}
    de = ben = 0.0
    needs_mix = False
    for s in segments:
        share = max(float(s["revenue"]), 0.0) / total
        if s["label"] == "exposed":
            de += share
        elif s["label"] == "beneficiary":
            ben += share
        elif s["label"] == "electricity_generation":
            if generation_mix is None:
                needs_mix = True
                continue
            de += share * generation_mix["fossil_share"]
            ben += share * generation_mix["renewable_share"]
    de = min(de, 1.0)
    return {"de": de, "ben": min(ben, 1.0 - de), "needs_generation_mix": needs_mix}
