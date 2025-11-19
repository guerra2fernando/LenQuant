"""Generate lightweight HTML evaluation dashboards for trained models."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, Optional

import pandas as pd

OUTPUT_DIR = Path("reports/model_eval")

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>{title}</title>
    <style>
      :root {{
        color-scheme: dark;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #020617;
        color: #e2e8f0;
      }}
      body {{ margin: 2.5rem auto; max-width: 960px; padding: 0 1.5rem; }}
      h1, h2 {{ color: #38bdf8; margin-bottom: 0.75rem; }}
      h3 {{ color: #7dd3fc; }}
      .card {{
        background: rgba(15, 23, 42, 0.85);
        border-radius: 16px;
        box-shadow: 0px 25px 50px -12px rgba(15, 23, 42, 0.65);
        padding: 1.75rem;
        margin-bottom: 1.75rem;
      }}
      .label {{ display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; }}
      .badge {{ display: inline-block; border-radius: 999px; padding: 0.2rem 0.75rem; background: rgba(56, 189, 248, 0.16); color: #38bdf8; font-weight: 600; font-size: 0.75rem; }}
      table {{ width: 100%; border-collapse: collapse; }}
      th, td {{ text-align: left; padding: 0.6rem 0.4rem; border-bottom: 1px solid rgba(148, 163, 184, 0.2); }}
      th {{ color: #94a3b8; font-weight: 600; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.05em; }}
      .metrics {{ display: flex; flex-wrap: wrap; gap: 1rem; }}
      .metric-card {{
        flex: 1 1 13rem;
        background: linear-gradient(135deg, rgba(30, 64, 175, 0.25), rgba(15, 118, 110, 0.25));
        border-radius: 14px;
        padding: 1rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }}
      .metric-card span {{ font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; color: #cbd5f5; }}
      .metric-card strong {{ font-size: 1.6rem; font-weight: 700; color: #f8fafc; }}
      .bar {{ height: 9px; background: rgba(148, 163, 184, 0.18); border-radius: 999px; overflow: hidden; }}
      .bar-inner {{
        height: 100%;
        background: linear-gradient(90deg, rgba(59, 130, 246, 0.85) 0%, rgba(236, 72, 153, 0.85) 100%);
      }}
      .footer {{ text-align: right; font-size: 0.75rem; color: #64748b; margin-top: 1.5rem; }}
    </style>
  </head>
  <body>
    <div class="card">
      <h1>{title}</h1>
      <p class="label">
        <span class="badge">{algorithm}</span>
        <span>Symbol • <strong>{symbol}</strong></span>
        <span>Horizon • <strong>{horizon}</strong></span>
      </p>
      <p class="label">Training window • {train_start} &rarr; {train_end}</p>
      <p class="label">Generated • {generated_at}</p>
    </div>

    <div class="card">
      <h2>Key Metrics</h2>
      <div class="metrics">
        {metric_cards}
      </div>
    </div>

    {shap_section}
    {prediction_section}

    <p class="footer">LenQuant Forecast Suite • {generated_at}</p>
  </body>
</html>
"""


def _metric_cards(metrics: Dict[str, Dict[str, float]]) -> str:
    cards = []
    for split in ("val", "test"):
        split_metrics = metrics.get(split, {})
        for name in ("rmse", "mae", "directional_accuracy"):
            value = split_metrics.get(name)
            if value is None:
                continue
            label = f"{split.upper()} {name.upper()}"
            if name == "directional_accuracy":
                display = f"{value * 100:.1f}%"
            else:
                display = f"{value:.6f}"
            cards.append(
                f'<div class="metric-card"><span>{label}</span><strong>{display}</strong></div>'
            )
    if not cards:
        cards.append('<div class="metric-card"><span>INFO</span><strong>No metrics recorded</strong></div>')
    return "\n".join(cards)


def _shap_section(shap_summary: Optional[Iterable[Dict[str, float]]]) -> str:
    if not shap_summary:
        return ""
    values = [item["importance"] for item in shap_summary if item.get("importance") is not None]
    if not values:
        return ""
    max_val = max(values) or 1.0
    rows = []
    for item in shap_summary:
        importance = float(item["importance"])
        percent = min(100.0, (importance / max_val) * 100.0)
        rows.append(
            "<tr>"
            f"<td>{item['feature']}</td>"
            f"<td>{importance:.6f}</td>"
            f'<td><div class="bar"><div class="bar-inner" style="width:{percent:.2f}%"></div></div></td>'
            "</tr>"
        )
    table = (
        '<div class="card">'
        "<h2>Top SHAP Features</h2>"
        "<table>"
        "<thead><tr><th>Feature</th><th>Mean |SHAP|</th><th>Contribution</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody>"
        "</table>"
        "</div>"
    )
    return table


def _prediction_section(csv_path: Optional[str], limit: int = 25) -> str:
    if not csv_path:
        return ""
    path = Path(csv_path)
    if not path.exists():
        return ""
    df = pd.read_csv(path).tail(limit)
    if df.empty:
        return ""
    rows = []
    for _, row in df.iterrows():
        ts = pd.to_datetime(row.get("timestamp")).isoformat() if "timestamp" in row else ""
        pred = float(row.get("prediction", 0.0))
        actual = float(row.get("actual", 0.0))
        rows.append(
            "<tr>"
            f"<td>{ts}</td>"
            f"<td>{pred:.6f}</td>"
            f"<td>{actual:.6f}</td>"
            "</tr>"
        )
    table = (
        '<div class="card">'
        "<h2>Recent Predictions</h2>"
        "<table>"
        "<thead><tr><th>Timestamp</th><th>Predicted</th><th>Actual</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody>"
        "</table>"
        "</div>"
    )
    return table


def generate_dashboard(
    model_metadata: Dict[str, object],
    metrics: Dict[str, Dict[str, float]],
    shap_summary: Optional[Iterable[Dict[str, float]]],
    evaluation_csv_path: Optional[str],
) -> Path:
    """Render an HTML dashboard for a trained model and return the output path."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    generated_at = datetime.utcnow().isoformat()
    html = HTML_TEMPLATE.format(
        title=f"Model Evaluation — {model_metadata.get('model_id', 'unknown_model')}",
        algorithm=model_metadata.get("algorithm", "Unknown"),
        symbol=model_metadata.get("symbol", "Unknown"),
        horizon=model_metadata.get("horizon", "Unknown"),
        train_start=model_metadata.get("train_start", "N/A"),
        train_end=model_metadata.get("train_end", "N/A"),
        generated_at=generated_at,
        metric_cards=_metric_cards(metrics),
        shap_section=_shap_section(shap_summary),
        prediction_section=_prediction_section(evaluation_csv_path),
    )

    output_path = OUTPUT_DIR / f"{model_metadata.get('model_id', 'unknown_model')}_dashboard.html"
    output_path.write_text(html)
    return output_path

