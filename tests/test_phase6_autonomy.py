from evolution.mutator import MutationConfig, generate_mutations
from strategy_genome.encoding import create_genome_from_dict, default_genome_document
from ai.hypothesis_agent import HypothesisAgent


def test_generate_mutations_produces_variants():
    base_doc = default_genome_document()
    genome = create_genome_from_dict(base_doc)
    generations = generate_mutations([genome], MutationConfig(variants_per_parent=3, allowed_horizons=("1h",)))
    assert generations, "Expected at least one mutation generation"
    produced = generations[0].produced
    assert len(produced) == 3
    for candidate in produced:
        assert candidate.features, "Mutated candidate should include features metadata"
        assert candidate.horizon in {"1h"}, "Horizon should respect allowed list"


def test_hypothesis_agent_deterministic_summary():
    agent = HypothesisAgent()
    evaluations = [
        {"strategy_id": "alpha", "roi": 0.05, "sharpe": 1.4, "max_drawdown": 0.1, "score": 0.8},
        {"strategy_id": "beta", "roi": -0.03, "sharpe": 0.4, "max_drawdown": 0.25, "score": 0.2},
    ]
    report = agent.analyse(evaluations, [])
    assert report.summary
    assert report.winners
    assert isinstance(report.winners, list)

