from pydantic import BaseModel


class MigrationStatusResponse(BaseModel):
    mode: str
    backend: str
    auth: str
    notes: list[str]
