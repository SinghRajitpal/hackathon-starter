"""Cached, throttled, JSON-only Gemini calls (spec D6). The network boundary is injected for tests."""
import hashlib
import json
import time
from pathlib import Path
from typing import Callable

DEFAULT_MODEL = "gemini-3.5-flash"


class RateLimited(Exception):
    pass


Generate = Callable[[str, str, dict], str]


class GeminiJson:
    def __init__(
        self,
        generate: Generate,
        cache_dir: Path,
        model: str = DEFAULT_MODEL,
        min_interval: float = 6.0,
        max_attempts: int = 5,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ):
        self.generate = generate
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.model = model
        self.min_interval = min_interval
        self.max_attempts = max_attempts
        self.sleep = sleep
        self.clock = clock
        self._last_call = -1e18
        self.calls = 0

    def _key(self, prompt: str, schema: dict) -> str:
        payload = json.dumps({"model": self.model, "prompt": prompt, "schema": schema}, sort_keys=True)
        return hashlib.sha256(payload.encode()).hexdigest()

    def __call__(self, prompt: str, schema: dict) -> dict:
        path = self.cache_dir / f"{self._key(prompt, schema)}.json"
        if path.exists():
            return json.loads(path.read_text())
        for attempt in range(self.max_attempts):
            wait = self.min_interval - (self.clock() - self._last_call)
            if wait > 0:
                self.sleep(wait)
            self._last_call = self.clock()
            try:
                self.calls += 1
                data = json.loads(self.generate(self.model, prompt, schema))
            except RateLimited:
                self.sleep(10.0 * 2**attempt)
                continue
            path.write_text(json.dumps(data))
            return data
        raise RuntimeError(f"Gemini rate limit persisted after {self.max_attempts} attempts")


def google_generate(api_key: str) -> Generate:
    """Real network boundary: google-genai client, temperature 0, JSON schema, no thinking tokens."""
    from google import genai
    from google.genai import errors, types

    client = genai.Client(api_key=api_key)

    def generate(model: str, prompt: str, schema: dict) -> str:
        try:
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0,
                    response_mime_type="application/json",
                    response_json_schema=schema,
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                ),
            )
        except errors.ClientError as exc:
            if exc.code == 429:
                raise RateLimited() from exc
            raise
        return response.text

    return generate
