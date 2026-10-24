from langgraph.graph import END, START, StateGraph

from .nodes import evaluate, finish, route, teacher_review
from .state import State


def build_graph():
    """evaluate -> (teacher_review | finish) -> END"""
    g = StateGraph(State)
    g.add_node("evaluate", evaluate)
    g.add_node("teacher_review", teacher_review)
    g.add_node("finish", finish)
    g.add_edge(START, "evaluate")
    g.add_conditional_edges("evaluate", route,
                            {"teacher_review": "teacher_review", "finish": "finish"})
    g.add_edge("teacher_review", END)
    g.add_edge("finish", END)
    return g.compile()


graph = build_graph()
