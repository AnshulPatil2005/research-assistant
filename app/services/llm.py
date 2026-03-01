from openai import OpenAI
from app.core.config import settings
import structlog
import re
from typing import List, Dict, Optional

logger = structlog.get_logger()

class LLMClient:
    def __init__(self):
        self.provider = settings.LLM_PROVIDER
        self.model = settings.LLM_MODEL
        self.client: Optional[OpenAI] = None

    def _ensure_client(self):
        if self.client is not None:
            return self.client

        if self.provider == "openrouter":
            if not settings.OPENROUTER_API_KEY:
                raise ValueError("OPENROUTER_API_KEY is not set. Please add it to your .env file.")
            self.client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=settings.OPENROUTER_API_KEY,
            )
        else:
            raise ValueError(f"Unknown provider: {self.provider}. Only 'openrouter' is supported.")
        return self.client

    def _infer_claim_type(self, claim_text: str) -> str:
        lowered = (claim_text or "").lower()
        if any(k in lowered for k in ["we use", "method", "approach", "model", "algorithm", "pipeline", "procedure"]):
            return "method"
        if any(k in lowered for k in ["result", "improve", "achieve", "outperform", "accuracy", "score", "metric"]):
            return "result"
        if any(k in lowered for k in ["assume", "assumption", "suppose", "given that", "under the condition"]):
            return "assumption"
        return "result"

    def extract_claims_with_types(self, text: str) -> List[Dict[str, str]]:
        system_prompt = (
            "You are a research assistant. Extract atomic research claims from the input text. "
            "Allowed claim types are METHOD, RESULT, ASSUMPTION. "
            "Return only a bulleted list where each item follows this exact format: "
            "- [TYPE] claim sentence. "
            "Each claim must be a single standalone sentence grounded in the input. "
            "If no clear claims exist, return an empty response."
        )
        response = self.generate_response(text, system_prompt=system_prompt)

        claims: List[Dict[str, str]] = []
        typed_line_re = re.compile(r"^\s*[-*]\s*\[(METHOD|RESULT|ASSUMPTION)\]\s*(.+?)\s*$", re.IGNORECASE)

        for line in response.split('\n'):
            line = line.strip()
            if not line:
                continue

            match = typed_line_re.match(line)
            if match:
                raw_type = match.group(1).lower()
                claim = match.group(2).strip()
                if claim:
                    claims.append({"text": claim, "claim_type": raw_type})
                continue

            # Fallback parsing if provider returns bullets without [TYPE]
            if line.startswith(("-", "*")):
                claim = line.lstrip("-* ").strip()
                claim = re.sub(r"^\[(?:METHOD|RESULT|ASSUMPTION)\]\s*", "", claim, flags=re.IGNORECASE)
                if claim:
                    claims.append({"text": claim, "claim_type": self._infer_claim_type(claim)})

        return claims

    def extract_claims(self, text: str):
        # Backward-compatible helper for older call sites.
        return [c["text"] for c in self.extract_claims_with_types(text)]

    def generate_response(self, prompt: str, system_prompt: str = None):
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        messages.append({"role": "user", "content": prompt})
        
        try:
            client = self._ensure_client()
            response = client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                # stream=True # Support streaming later?
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            return "Sorry, I encountered an error while generating the response."

llm_client = LLMClient()
