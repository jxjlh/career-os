from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class AIContentCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)

    type: str
    inputJson: dict
    outputJson: dict
    provider: str
    model: str


class AIContentResponse(BaseModel):
    id: str
    type: str
    inputJson: dict
    outputJson: dict
    provider: str
    model: str
    createdAt: str | None = None
