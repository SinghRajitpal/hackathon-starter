import json

import pytest

from nzlib.gemini import GeminiJson, RateLimited


def test_gemini_caches_and_retries_on_rate_limit(tmp_path):
    calls = []

    def fake_generate(model, prompt, schema):
        calls.append(prompt)
        if len(calls) == 1:
            raise RateLimited()
        return json.dumps({"ok": True})

    sleeps = []
    client = GeminiJson(fake_generate, tmp_path, min_interval=0, sleep=sleeps.append, clock=lambda: 0.0)
    assert client("p", {"type": "object"}) == {"ok": True}
    assert client("p", {"type": "object"}) == {"ok": True}
    assert len(calls) == 2
    assert sleeps == [10.0]


def test_gemini_gives_up_after_max_attempts(tmp_path):
    def always_limited(model, prompt, schema):
        raise RateLimited()

    client = GeminiJson(always_limited, tmp_path, min_interval=0, max_attempts=2, sleep=lambda s: None, clock=lambda: 0.0)
    with pytest.raises(RuntimeError):
        client("p", {"type": "object"})
