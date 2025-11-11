from __future__ import annotations

from db.client import get_database_name, mongo_client


def main() -> None:
    with mongo_client() as client:
        db = client[get_database_name()]
        intraday = db["sim_runs_intraday"]
        intraday.create_index("cohort_id", unique=True)
        intraday.create_index("created_at")
        intraday.create_index([("bankroll", 1), ("allocation_policy", 1)])

        summaries = db["cohort_summaries"]
        summaries.create_index("cohort_id", unique=True)
        summaries.create_index("generated_at")
    print("Intraday cohort indexes ensured.")


if __name__ == "__main__":
    main()
