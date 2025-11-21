from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from knowledge.base import KnowledgeBaseService
from knowledge.repository import get_entry_by_period, get_latest_entry, list_entries, get_all_tags, list_entries_by_tags

router = APIRouter()
service = KnowledgeBaseService()


@router.get("/")
def get_recent(limit: int = 10, tags: Optional[str] = Query(None, description="Comma-separated tags to filter by")) -> Dict[str, Any]:
    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        return {"entries": list_entries_by_tags(tag_list, limit=limit)}
    return {"entries": list_entries(limit=limit)}


@router.get("/latest")
def get_latest() -> Dict[str, Any]:
    entry = get_latest_entry()
    if not entry:
        raise HTTPException(status_code=404, detail="No knowledge entries recorded.")
    return {"entry": entry}


@router.get("/{period}")
def get_period(period: str) -> Dict[str, Any]:
    entry = get_entry_by_period(period)
    if not entry:
        raise HTTPException(status_code=404, detail=f"No knowledge entry for period '{period}'.")
    return {"entry": entry}


@router.get("/search")
def search_knowledge(q: str = Query(..., min_length=2), limit: int = Query(default=10, ge=1, le=50)) -> Dict[str, Any]:
    results = service.search(q, limit=limit)
    return {"results": results}


@router.post("/pin/{period}")
def pin_knowledge_entry(period: str) -> Dict[str, Any]:
    try:
        updated = service.pin_entry(period)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"entry": updated}


@router.get("/tags")
def get_tags() -> Dict[str, Any]:
    """Get all unique tags from knowledge entries."""
    tags = get_all_tags()
    return {"tags": tags}


@router.get("/{entry_id}/export")
def export_knowledge_entry(entry_id: str, format: str = Query("markdown", regex="^(markdown|json|pdf)$")) -> Response:
    """Export knowledge entry in specified format."""
    entry = get_entry_by_period(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Knowledge entry not found")
    
    if format == "json":
        import json
        content = json.dumps(entry, indent=2, default=str)
        return Response(
            content=content,
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=knowledge_{entry_id}.json"}
        )
    elif format == "markdown":
        # Convert to markdown
        md_content = f"# Knowledge Entry: {entry_id}\n\n"
        md_content += f"**Period**: {entry.get('period', 'N/A')}\n"
        md_content += f"**Generated**: {entry.get('generated_at', 'N/A')}\n\n"
        md_content += "## Summary\n\n"
        md_content += entry.get('summary', 'No summary available') + "\n\n"
        
        if entry.get('top_strategies'):
            md_content += "## Top Strategies\n\n"
            for i, strat in enumerate(entry.get('top_strategies', []), 1):
                md_content += f"{i}. **{strat.get('name', 'Unknown')}** - Sharpe: {strat.get('sharpe', 'N/A')}\n"
            md_content += "\n"
        
        if entry.get('tags'):
            md_content += "## Tags\n\n"
            md_content += ", ".join(entry.get('tags', [])) + "\n\n"
        
        return Response(
            content=md_content,
            media_type="text/markdown",
            headers={"Content-Disposition": f"attachment; filename=knowledge_{entry_id}.md"}
        )
    elif format == "pdf":
        # PDF generation would require reportlab or similar
        # For now, return error
        raise HTTPException(status_code=501, detail="PDF export not yet implemented")
    
    raise HTTPException(status_code=400, detail="Invalid format")

