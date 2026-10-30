"""
RailBus Intelligence Engine - Data Acquisition Layer
Responsible for loading, validating, and structuring input data:
1. Train Data (Schedules, station stops, arrival times, delays)
2. Passenger Data (Bookings, interest submissions, historical growth)
3. Context Data (Weekdays, holidays, festivals, seasonality, weather)
4. Historical Data (Route averages and past event baselines)
"""
import os
from typing import Dict, Any, List, Optional
import pandas as pd

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")


class DataAcquisitionLayer:
    """Manages raw data ingestion and runtime validation."""

    def __init__(self, data_dir: str = DATA_DIR):
        self.data_dir = data_dir
        self._train_events_df: Optional[pd.DataFrame] = None
        self._snapshots_df: Optional[pd.DataFrame] = None
        self.load_data()

    def load_data(self):
        trains_file = os.path.join(self.data_dir, "train_arrival_events.csv")
        snapshots_file = os.path.join(self.data_dir, "railbus_demand_snapshots.csv")

        if os.path.exists(trains_file):
            self._train_events_df = pd.read_csv(trains_file)
            self._train_events_df["service_date"] = pd.to_datetime(self._train_events_df["service_date"])
        else:
            self._train_events_df = pd.DataFrame()

        if os.path.exists(snapshots_file):
            self._snapshots_df = pd.read_csv(snapshots_file)
            self._snapshots_df["service_date"] = pd.to_datetime(self._snapshots_df["service_date"])
        else:
            self._snapshots_df = pd.DataFrame()

    def get_all_train_events(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Returns sorted list of train arrival events."""
        if self._train_events_df is None or self._train_events_df.empty:
            return []
        
        # Sort by service date descending to show latest events
        sorted_df = self._train_events_df.sort_values(by=["service_date", "scheduled_arrival"], ascending=[False, True]).head(limit)
        return sorted_df.to_dict(orient="records")

    def get_event_by_id(self, event_id: str) -> Optional[Dict[str, Any]]:
        """Fetch train event metadata by event_id."""
        if self._train_events_df is None or self._train_events_df.empty:
            return None
        matches = self._train_events_df[self._train_events_df["event_id"] == event_id]
        if matches.empty:
            return None
        rec = matches.iloc[0].to_dict()
        rec["service_date"] = str(rec["service_date"])[:10]
        return rec

    def get_snapshots_for_event(self, event_id: str, horizon: Optional[float] = None) -> List[Dict[str, Any]]:
        """Fetch route snapshots for a specific event and horizon."""
        if self._snapshots_df is None or self._snapshots_df.empty:
            return []
        sub = self._snapshots_df[self._snapshots_df["event_id"] == event_id]
        if horizon is not None:
            sub = sub[sub["snapshot_hours_before_arrival"] == horizon]
        records = sub.to_dict(orient="records")
        for r in records:
            r["service_date"] = str(r["service_date"])[:10]
        return records

    def get_historical_route_stats(self) -> Dict[str, Dict[str, float]]:
        """Station-wise historical demand stats for baseline comparisons."""
        if self._snapshots_df is None or self._snapshots_df.empty:
            return {}
        grouped = self._snapshots_df.groupby("destination_station")["final_railbus_passengers_actual_synthetic"]
        return {
            station: {
                "mean": round(float(vals.mean()), 1),
                "std": round(float(vals.std()), 1),
                "min": int(vals.min()),
                "max": int(vals.max())
            }
            for station, vals in grouped
        }
