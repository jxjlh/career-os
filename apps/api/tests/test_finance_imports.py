from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.db.models import FinanceImport
from app.main import app

HEADERS = {"Authorization": "Bearer dev"}
USER_B_HEADERS = {
    "Authorization": "Bearer dev",
    "X-Dev-User-Id": "00000000-0000-0000-0000-000000000002",
}


class FakeOcrProvider:
    def __init__(self, confidence: str = "0.92") -> None:
        self.confidence = confidence

    def extract(self, image: bytes, content_type: str):
        from app.domains.finance.ocr import ExtractedHoldingRow

        assert image == b"image"
        assert content_type == "image/png"
        return [
            ExtractedHoldingRow(
                name="易方达蓝筹精选",
                symbol="005827",
                market="CN",
                asset_class="fund",
                currency="CNY",
                quantity="100",
                unit_price="1.23",
                confidence=self.confidence,
                raw_text="易方达蓝筹精选 005827 100 1.23",
            )
        ]


async def _uploaded_path(path: str, content: bytes, content_type: str) -> str:
    assert path.startswith("finance-imports/")
    assert content == b"image"
    assert content_type == "image/png"
    return path


def _account(client: TestClient, headers: dict[str, str]) -> str:
    response = client.post(
        "/api/v1/finance/accounts",
        headers=headers,
        json={
            "name": f"基金账户-{uuid4().hex[:8]}",
            "market": "CN",
            "currency": "CNY",
            "accountType": "fund",
        },
    )
    assert response.status_code == 201
    return response.json()["data"]["id"]


def _upload(client: TestClient, monkeypatch, *, confidence: str = "0.92") -> dict:
    monkeypatch.setattr("app.domains.finance.ocr.get_holding_ocr_provider", lambda: FakeOcrProvider(confidence))
    monkeypatch.setattr("app.domains.finance.router.upload_object", _uploaded_path)
    response = client.post(
        "/api/v1/finance/imports/screenshot",
        headers=HEADERS,
        files={"file": ("holding.png", b"image", "image/png")},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def _reviewed_rows(imported: dict, account_id: str) -> list[dict]:
    rows = imported["rows"]
    rows[0]["accountId"] = account_id
    rows[0]["occurredOn"] = "2026-08-17"
    rows[0]["notes"] = "截图识别后手动确认"
    return rows


def test_confirmed_import_deletes_temporary_object_and_creates_idempotent_transaction(monkeypatch) -> None:
    deleted: list[str] = []

    async def _delete(path: str) -> None:
        deleted.append(path)

    monkeypatch.setattr("app.domains.finance.service.delete_object", _delete)
    with TestClient(app) as client:
        imported = _upload(client, monkeypatch)
        rows = _reviewed_rows(imported, _account(client, HEADERS))

        updated = client.patch(
            f"/api/v1/finance/imports/{imported['id']}", headers=HEADERS, json={"rows": rows}
        )
        assert updated.status_code == 200
        assert updated.json()["data"]["rows"][0]["accountId"] == rows[0]["accountId"]

        confirmed = client.post(
            f"/api/v1/finance/imports/{imported['id']}/confirm", headers=HEADERS, json={"rows": rows}
        )
        assert confirmed.status_code == 200, confirmed.text
        assert confirmed.json()["data"]["status"] == "confirmed"
        assert confirmed.json()["data"]["temporaryObjectPath"] is None
        assert deleted == [imported["temporaryObjectPath"]]

        repeated = client.post(
            f"/api/v1/finance/imports/{imported['id']}/confirm", headers=HEADERS, json={"rows": rows}
        )
        assert repeated.status_code == 200
        assert deleted == [imported["temporaryObjectPath"]]
        transactions = client.get("/api/v1/finance/transactions", headers=HEADERS).json()["data"]
        assert len([item for item in transactions if item["source"] == "screenshot_import"]) == 1


def test_discard_and_expiry_each_delete_temporary_object_once(monkeypatch) -> None:
    deleted: list[str] = []

    async def _delete(path: str) -> None:
        deleted.append(path)

    monkeypatch.setattr("app.domains.finance.service.delete_object", _delete)
    with TestClient(app) as client:
        imported = _upload(client, monkeypatch)
        discarded = client.post(f"/api/v1/finance/imports/{imported['id']}/discard", headers=HEADERS)
        assert discarded.status_code == 200
        assert discarded.json()["data"]["status"] == "discarded"
        assert discarded.json()["data"]["temporaryObjectPath"] is None

        expiring = _upload(client, monkeypatch)
        with SessionLocal() as db:
            record = db.get(FinanceImport, expiring["id"])
            assert record is not None
            record.expires_at = datetime.now(UTC) - timedelta(seconds=1)
            db.commit()
        expired = client.get(f"/api/v1/finance/imports/{expiring['id']}", headers=HEADERS)
        assert expired.status_code == 200
        assert expired.json()["data"]["status"] == "expired"
        assert expired.json()["data"]["temporaryObjectPath"] is None
        assert deleted == [imported["temporaryObjectPath"], expiring["temporaryObjectPath"]]


def test_import_requires_configured_ocr_and_rejects_unsupported_files(monkeypatch) -> None:
    from app.core.errors import AppError

    monkeypatch.setattr(
        "app.domains.finance.ocr.get_holding_ocr_provider",
        lambda: (_ for _ in ()).throw(AppError("OCR_NOT_CONFIGURED", "OCR 未配置", 503)),
    )
    with TestClient(app) as client:
        missing = client.post(
            "/api/v1/finance/imports/screenshot",
            headers=HEADERS,
            files={"file": ("holding.png", b"image", "image/png")},
        )
        assert missing.status_code == 503
        assert missing.json()["error"]["code"] == "OCR_NOT_CONFIGURED"

        unsupported = client.post(
            "/api/v1/finance/imports/screenshot",
            headers=HEADERS,
            files={"file": ("holding.gif", b"image", "image/gif")},
        )
        assert unsupported.status_code == 422
        assert unsupported.json()["error"]["code"] == "INVALID_IMPORT_IMAGE"

        monkeypatch.setattr("app.domains.finance.ocr.get_holding_ocr_provider", lambda: FakeOcrProvider())
        monkeypatch.setattr("app.domains.finance.router._IMPORT_UPLOAD_LIMIT_BYTES", 2)
        too_large = client.post(
            "/api/v1/finance/imports/screenshot",
            headers=HEADERS,
            files={"file": ("holding.png", b"image", "image/png")},
        )
        assert too_large.status_code == 413
        assert too_large.json()["error"]["code"] == "IMPORT_IMAGE_TOO_LARGE"


def test_low_confidence_rows_require_review_and_imports_are_user_isolated(monkeypatch) -> None:
    with TestClient(app) as client:
        imported = _upload(client, monkeypatch, confidence="0.20")
        assert imported["needsReview"] is True
        assert imported["rows"][0]["confidence"] == "0.20"
        assert client.get(f"/api/v1/finance/imports/{imported['id']}", headers=USER_B_HEADERS).status_code == 404
        assert client.patch(
            f"/api/v1/finance/imports/{imported['id']}",
            headers=USER_B_HEADERS,
            json={"rows": imported["rows"]},
        ).status_code == 404
        assert client.post(f"/api/v1/finance/imports/{imported['id']}/discard", headers=USER_B_HEADERS).status_code == 404


def test_ocr_failure_deletes_temporary_object_before_clearing_sensitive_data(monkeypatch) -> None:
    deleted: list[str] = []
    stored: list[str] = []

    class FailingOcrProvider:
        def extract(self, image: bytes, content_type: str):
            raise RuntimeError("upstream unavailable")

    async def _delete(path: str) -> None:
        deleted.append(path)

    async def _store(path: str, content: bytes, content_type: str) -> str:
        stored.append(path)
        return path

    monkeypatch.setattr("app.domains.finance.ocr.get_holding_ocr_provider", lambda: FailingOcrProvider())
    monkeypatch.setattr("app.domains.finance.router.upload_object", _store)
    monkeypatch.setattr("app.domains.finance.service.delete_object", _delete)
    with TestClient(app) as client:
        failed = client.post(
            "/api/v1/finance/imports/screenshot",
            headers=HEADERS,
            files={"file": ("holding.png", b"image", "image/png")},
        )
        assert failed.status_code == 503
        assert failed.json()["error"]["code"] == "OCR_EXTRACTION_FAILED"

    with SessionLocal() as db:
        failed_import = (
            db.query(FinanceImport)
            .filter(FinanceImport.status == "failed")
            .order_by(FinanceImport.created_at.desc())
            .first()
        )
        assert failed_import is not None
        assert deleted == stored
        assert failed_import.status == "failed"
        assert failed_import.temporary_object_path is None
        assert failed_import.raw_ocr_text is None
