from __future__ import annotations

from abc import ABC, abstractmethod

from ..models import StrategyContext, StrategyResult


class BaseStrategy(ABC):
    @abstractmethod
    def evaluate(self, context: StrategyContext) -> StrategyResult:
        raise NotImplementedError
