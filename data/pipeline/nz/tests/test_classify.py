from nzlib import classify

ITEMS = [
    {"id": 0, "company": "Exxon Mobil", "sub_industry": "Integrated Oil & Gas", "segment": "Upstream"},
    {"id": 1, "company": "Ford", "sub_industry": "Automobile Manufacturers", "segment": "FordModelE"},
    {"id": 2, "company": "Ford", "sub_industry": "Automobile Manufacturers", "segment": "FordCredit"},
]


def test_prompt_lists_every_item_and_both_product_lists():
    prompt = classify.build_prompt(ITEMS, ["crude oil", "natural gas"], ["electric vehicles and charging"])
    assert 'segment="FordModelE"' in prompt
    assert "crude oil; natural gas" in prompt
    assert "electric vehicles and charging" in prompt


def test_parse_labels_keeps_valid_answers_and_flags_the_rest():
    response = {
        "items": [
            {"id": 0, "label": "exposed", "reason": "oil production"},
            {"id": 1, "label": "green", "reason": "?"},
            {"id": 0, "label": "neutral", "reason": "duplicate"},
            {"id": 9, "label": "exposed", "reason": "unknown id"},
        ]
    }
    out = classify.parse_labels(response, ITEMS)
    assert out[0] == {"label": "exposed", "reason": "oil production", "flag": None}
    assert out[1]["label"] == "neutral" and out[1]["flag"] == "classification-invalid-label"
    assert out[2]["flag"] == "classification-missing"
    assert set(out) == {0, 1, 2}


def test_batches_split_by_size():
    assert [len(b) for b in classify.batches(list(range(120)), 50)] == [50, 50, 20]
