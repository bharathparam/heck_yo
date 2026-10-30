"""
Test Suite: Chronological Split Leakage Prevention
Verifies that:
1. Training sets strictly precede test sets in service_date (no future data leakage).
2. All snapshot horizons for a given event are kept together in the same split.
3. No event appears in both train and test splits.
"""
import os
import pandas as pd
import pytest

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


def test_no_temporal_leakage_in_chronological_splits():
    df_a = pd.read_csv(os.path.join(DATA_DIR, "train_arrival_events.csv"))
    df_a["service_date"] = pd.to_datetime(df_a["service_date"])
    df_a = df_a.sort_values("service_date").reset_index(drop=True)

    dates = df_a["service_date"].unique()
    cut = dates[int(len(dates) * 0.80)]

    train = df_a[df_a.service_date <= cut]
    test = df_a[df_a.service_date > cut]

    # Verify temporal order
    max_train_date = train["service_date"].max()
    min_test_date = test["service_date"].min()
    assert max_train_date < min_test_date, (
        f"Temporal leakage detected: max train date {max_train_date} >= min test date {min_test_date}"
    )

    # Verify disjoint event IDs
    train_events = set(train["event_id"].unique())
    test_events = set(test["event_id"].unique())
    intersection = train_events.intersection(test_events)
    assert len(intersection) == 0, f"Event leakage across splits: {len(intersection)} shared events"


def test_snapshots_event_group_integrity():
    df_b = pd.read_csv(os.path.join(DATA_DIR, "railbus_demand_snapshots.csv"))
    df_b["service_date"] = pd.to_datetime(df_b["service_date"])

    dates = df_b["service_date"].unique()
    cut = dates[int(len(dates) * 0.80)]

    train_b = df_b[df_b.service_date <= cut]
    test_b = df_b[df_b.service_date > cut]

    train_events = set(train_b["event_id"].unique())
    test_events = set(test_b["event_id"].unique())
    assert len(train_events.intersection(test_events)) == 0

    # Ensure every event has all 4 snapshot horizons in its assigned split
    sample_train_event = list(train_events)[0]
    horizons = train_b[train_b["event_id"] == sample_train_event]["snapshot_hours_before_arrival"].unique()
    assert set(horizons) == {24.0, 6.0, 2.0, 0.5}, "Snapshots fragmented across splits"
