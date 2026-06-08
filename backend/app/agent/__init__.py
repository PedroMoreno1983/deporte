"""Agentic layer: a tool-using assistant grounded in the club's real data.

The agent never invents numbers — every fact comes from a tool that runs a
*club-scoped* query against the platform's own data/models. This package is the
product core of the "GaaS" offering: the existing APIs/services become the
agent's tools, and a tool-calling runtime lets an LLM orchestrate them.
"""
from .runtime import run_agent, AgentResult
from .tools import build_tools

__all__ = ["run_agent", "AgentResult", "build_tools"]
