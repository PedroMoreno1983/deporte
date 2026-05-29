"""The registry must import cleanly and expose every (provider, kind) pair."""
from app.imports import _REGISTRY, get_importer, supported_pairs
from app.models.import_job import ImportKind, ImportProvider


def test_registry_has_all_providers():
    assert len(_REGISTRY) == 6
    assert get_importer(ImportProvider.CATAPULT, ImportKind.GPS_SESSION) is not None
    assert get_importer(ImportProvider.WYSCOUT, ImportKind.MATCH_EVENTS) is not None
    assert get_importer(ImportProvider.WYSCOUT, ImportKind.MATCH_STATS) is not None
    assert get_importer(ImportProvider.GARMIN_FIT, ImportKind.GPS_SESSION) is not None
    # Unsupported combination → None, never a crash.
    assert get_importer(ImportProvider.CATAPULT, ImportKind.MATCH_EVENTS) is None


def test_supported_pairs_are_serialisable():
    pairs = supported_pairs()
    assert len(pairs) == 6
    for p in pairs:
        assert set(p) == {"provider", "kind", "label"}
        assert isinstance(p["label"], str) and p["label"]
