/**
 * Server-Side AI Usage Tracking, Token Metrics, and Spending Caps
 * AI Document Review & Routing Agent
 */

export interface TokenUsageRecord {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
}

export interface UsageMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  dailySpentUsd: number;
  monthlySpentUsd: number;
  lastResetDay: string;
  lastResetMonth: string;
}

// Configured standard model pricing per 1M tokens (Gemini 3.8 Flash baseline)
// Input: $0.075 / 1M tokens ($0.000000075 / token)
// Output: $0.30 / 1M tokens ($0.00000030 / token)
const PRICING = {
  inputPerToken: 0.000000075,
  outputPerToken: 0.00000030
};

export class UsageTracker {
  private dailyBudgetUsd: number;
  private monthlyBudgetUsd: number;
  private warningThresholdPct: number;

  private metrics: UsageMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    dailySpentUsd: 0,
    monthlySpentUsd: 0,
    lastResetDay: new Date().toISOString().slice(0, 10),
    lastResetMonth: new Date().toISOString().slice(0, 7)
  };

  constructor() {
    this.dailyBudgetUsd = parseFloat(process.env.AI_DAILY_BUDGET_USD || '10.00');
    this.monthlyBudgetUsd = parseFloat(process.env.AI_MONTHLY_BUDGET_USD || '150.00');
    this.warningThresholdPct = parseFloat(process.env.AI_BUDGET_WARN_PCT || '80');
  }

  private checkDayMonthRoll(): void {
    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = new Date().toISOString().slice(0, 7);

    if (this.metrics.lastResetDay !== today) {
      this.metrics.dailySpentUsd = 0;
      this.metrics.lastResetDay = today;
    }
    if (this.metrics.lastResetMonth !== thisMonth) {
      this.metrics.monthlySpentUsd = 0;
      this.metrics.lastResetMonth = thisMonth;
    }
  }

  /**
   * Checks if an AI operation is allowed within configured daily/monthly budgets.
   */
  public isOperationAllowed(): {
    allowed: boolean;
    reason?: string;
    dailySpent: number;
    dailyBudget: number;
    monthlySpent: number;
    monthlyBudget: number;
    isWarning: boolean;
  } {
    this.checkDayMonthRoll();

    const dailyPct = (this.metrics.dailySpentUsd / this.dailyBudgetUsd) * 100;
    const monthlyPct = (this.metrics.monthlySpentUsd / this.monthlyBudgetUsd) * 100;
    const isWarning = dailyPct >= this.warningThresholdPct || monthlyPct >= this.warningThresholdPct;

    if (this.metrics.dailySpentUsd >= this.dailyBudgetUsd) {
      return {
        allowed: false,
        reason: `Daily AI spending limit of $${this.dailyBudgetUsd.toFixed(2)} reached ($${this.metrics.dailySpentUsd.toFixed(4)} spent today).`,
        dailySpent: this.metrics.dailySpentUsd,
        dailyBudget: this.dailyBudgetUsd,
        monthlySpent: this.metrics.monthlySpentUsd,
        monthlyBudget: this.monthlyBudgetUsd,
        isWarning: true
      };
    }

    if (this.metrics.monthlySpentUsd >= this.monthlyBudgetUsd) {
      return {
        allowed: false,
        reason: `Monthly AI spending limit of $${this.monthlyBudgetUsd.toFixed(2)} reached ($${this.metrics.monthlySpentUsd.toFixed(4)} spent this month).`,
        dailySpent: this.metrics.dailySpentUsd,
        dailyBudget: this.dailyBudgetUsd,
        monthlySpent: this.metrics.monthlySpentUsd,
        monthlyBudget: this.monthlyBudgetUsd,
        isWarning: true
      };
    }

    return {
      allowed: true,
      dailySpent: this.metrics.dailySpentUsd,
      dailyBudget: this.dailyBudgetUsd,
      monthlySpent: this.metrics.monthlySpentUsd,
      monthlyBudget: this.monthlyBudgetUsd,
      isWarning
    };
  }

  /**
   * Records completed AI call metrics based on actual token usage metadata.
   */
  public recordCall(usage?: { promptTokens?: number; completionTokens?: number }, success = true): void {
    this.checkDayMonthRoll();
    this.metrics.totalRequests++;

    if (!success) {
      this.metrics.failedRequests++;
      return;
    }

    this.metrics.successfulRequests++;

    const pTokens = usage?.promptTokens || 0;
    const cTokens = usage?.completionTokens || 0;
    const total = pTokens + cTokens;

    this.metrics.totalPromptTokens += pTokens;
    this.metrics.totalCompletionTokens += cTokens;
    this.metrics.totalTokens += total;

    // Calculate cost based on actual provider token usage metadata
    const cost = pTokens * PRICING.inputPerToken + cTokens * PRICING.outputPerToken;
    this.metrics.estimatedCostUsd += cost;
    this.metrics.dailySpentUsd += cost;
    this.metrics.monthlySpentUsd += cost;
  }

  public getSummary() {
    this.checkDayMonthRoll();
    const dailyPct = (this.metrics.dailySpentUsd / this.dailyBudgetUsd) * 100;
    const monthlyPct = (this.metrics.monthlySpentUsd / this.monthlyBudgetUsd) * 100;

    return {
      metrics: { ...this.metrics },
      budgets: {
        dailyBudgetUsd: this.dailyBudgetUsd,
        monthlyBudgetUsd: this.monthlyBudgetUsd,
        warningThresholdPct: this.warningThresholdPct,
        dailyUsedPct: Math.min(100, Math.round(dailyPct)),
        monthlyUsedPct: Math.min(100, Math.round(monthlyPct)),
        isWarning: dailyPct >= this.warningThresholdPct || monthlyPct >= this.warningThresholdPct
      },
      pricing: { ...PRICING },
      disclaimer:
        'Application-level spending caps prevent outgoing AI API requests initiated by this server instance once the configured budget is reached. They may not immediately stop provider-side billing unless enforced at the cloud account provider level.'
    };
  }

  public resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      dailySpentUsd: 0,
      monthlySpentUsd: 0,
      lastResetDay: new Date().toISOString().slice(0, 10),
      lastResetMonth: new Date().toISOString().slice(0, 7)
    };
  }

  public updateBudgets(daily?: number, monthly?: number): void {
    if (daily !== undefined && daily > 0) this.dailyBudgetUsd = daily;
    if (monthly !== undefined && monthly > 0) this.monthlyBudgetUsd = monthly;
  }
}

export const usageTracker = new UsageTracker();
